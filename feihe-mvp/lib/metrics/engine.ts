import { db, ensureSchema } from '../db';


export function isStatusCompleted(status: unknown): boolean {
  const s = String(status ?? "").trim();
  if (!s) return false;
  if (/^(未完成|尚未完成|未开始|待开始|进行中|排队中|待处理|异常|失败)$/i.test(s) || /未完成|尚未完成|not done|unfinished/i.test(s)) {
    return false;
  }
  return /^(已完成|完成|done|finished|已达成|已结项|外显成功|已外显)$/i.test(s) || /^完成$/i.test(s);
}

export type AggregationType = 'sum' | 'count' | 'distinct_count' | 'avg' | 'min' | 'max' | 'ratio';
export type MetricStatus = 'ok' | 'zero' | 'empty' | 'missing_source' | 'zero_division' | 'error';

export interface MetricDefinition {
  id: string;
  projectId: string;
  key: string;
  name: string;
  description: string;
  unit: string;
  aggregation: AggregationType;
  formula: string;
  format: string;
  numeratorKey?: string;
  denominatorKey?: string;
  missingPolicy?: 'null' | 'zero' | 'skip';
  filterJson?: string;
}

export interface MetricComputeResult {
  key: string;
  name: string;
  unit: string;
  value: number | null;
  formattedValue: string;
  sampleSize: number;
  status: MetricStatus;
  statusLabel: string;
  numerator?: number | null;
  denominator?: number | null;
  groups?: Array<{ label: string; value: number | null; count: number }>;
}

export interface MetricFilterOptions {
  from?: string;
  to?: string;
  source?: string;
  status?: string;
  scope?: string;
  category?: string;
  groupBy?: string;
}

export function formatMetricValue(val: number | null, format = 'number', unit = ''): string {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return '—';
  }
  if (format === 'percent' || unit === '%') {
    return (val * (val <= 1 && val > -1 ? 100 : 1)).toFixed(1) + '%';
  }
  if (format === 'currency' || unit === '元') {
    return '¥' + val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (format === 'compact') {
    if (Math.abs(val) >= 10000) return (val / 10000).toFixed(1) + 'w';
    if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'k';
    return String(Math.round(val));
  }
  return val.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + (unit ? ' ' + unit : '');
}

export async function getProjectMetrics(projectId: string): Promise<MetricDefinition[]> {
  await ensureSchema();
  const d1 = db();
  const rows = await d1.prepare(
    'SELECT id, project_id AS projectId, key, name, description, unit, aggregation, formula, format, aliases_json AS aliasesJson FROM metric_definitions WHERE project_id=? ORDER BY name'
  ).bind(projectId).all<MetricDefinition>();
  return rows.results || [];
}

export async function computeMetric(
  projectId: string,
  metricKey: string,
  options: MetricFilterOptions = {}
): Promise<MetricComputeResult> {
  await ensureSchema();
  const d1 = db();

  // 1. Check general dataset metrics first
  const datasetQuery = options.source
    ? d1.prepare('SELECT id, name FROM datasets WHERE project_id=? AND (id=? OR source_id=?) LIMIT 1').bind(projectId, options.source, options.source)
    : d1.prepare('SELECT id, name FROM datasets WHERE project_id=? ORDER BY row_count DESC, created_at ASC LIMIT 1').bind(projectId);
  const datasetRow = await datasetQuery.first<{ id: string; name: string }>();

  if (datasetRow) {
    const rows = await d1.prepare('SELECT row_key, data_json FROM dataset_rows WHERE dataset_id=? ORDER BY rowid ASC').bind(datasetRow.id).all<{ row_key: string; data_json: string }>();
    let datasetItems = (rows.results || []).map(r => {
      try { return JSON.parse(r.data_json); } catch { return {}; }
    });

    // Apply time filters if requested
    if (options.from || options.to) {
      datasetItems = datasetItems.filter(item => {
        const d = String(item['日期'] || item.date || item['时间'] || item.created_at || '').trim();
        if (!d) return true;
        if (options.from && d < options.from) return false;
        if (options.to && d > options.to) return false;
        return true;
      });
    }

    // Check custom definition in metric_definitions
    const customDef = await d1.prepare('SELECT * FROM metric_definitions WHERE project_id=? AND key=?').bind(projectId, metricKey).first<{
      key: string;
      name: string;
      unit: string;
      aggregation: string;
      formula: string;
      format: string;
    }>();

    if (customDef) {
      const agg = customDef.aggregation || 'sum';
      const formula = customDef.formula || customDef.name;
      const unit = customDef.unit || '';
      const format = customDef.format || 'number';

      if (agg === 'ratio' || formula.includes('/')) {
        const parts = formula.split('/').map(s => s.trim());
        const numKey = parts[0] || '成交人数';
        const denKey = parts[1] || '咨询人数';

        let numSum = 0;
        let denSum = 0;
        for (const item of datasetItems) {
          const nv = Number(String(item[numKey] ?? '').replace(/[,￥¥%]/g, ''));
          const dv = Number(String(item[denKey] ?? '').replace(/[,￥¥%]/g, ''));
          if (Number.isFinite(nv)) numSum += nv;
          if (Number.isFinite(dv)) denSum += dv;
        }

        if (denSum === 0) {
          return {
            key: metricKey,
            name: customDef.name,
            unit: unit || '%',
            value: null,
            formattedValue: '—',
            sampleSize: datasetItems.length,
            numerator: numSum,
            denominator: 0,
            status: 'zero_division',
            statusLabel: '分母为0，无法计算比率',
          };
        }

        const ratio = (numSum / denSum) * 100;
        let groups: Array<{ label: string; value: number | null; count: number }> | undefined;
        if (options.groupBy) {
          const gMap = new Map<string, { num: number; den: number; count: number }>();
          for (const item of datasetItems) {
            const g = String(item[options.groupBy] || '未分类');
            const entry = gMap.get(g) || { num: 0, den: 0, count: 0 };
            const nv = Number(String(item[numKey] ?? '').replace(/[,￥¥%]/g, ''));
            const dv = Number(String(item[denKey] ?? '').replace(/[,￥¥%]/g, ''));
            if (Number.isFinite(nv)) entry.num += nv;
            if (Number.isFinite(dv)) entry.den += dv;
            entry.count += 1;
            gMap.set(g, entry);
          }
          groups = Array.from(gMap.entries()).map(([label, st]) => ({
            label,
            value: st.den > 0 ? (st.num / st.den) * 100 : null,
            count: st.count,
          }));
        }

        return {
          key: metricKey,
          name: customDef.name,
          unit: unit || '%',
          value: ratio,
          formattedValue: formatMetricValue(ratio, 'percent', '%'),
          sampleSize: datasetItems.length,
          numerator: numSum,
          denominator: denSum,
          groups,
          status: 'ok',
          statusLabel: '计算完成',
        };
      }

      // Sum / Avg / Count
      let totalVal = 0;
      let validCount = 0;
      for (const item of datasetItems) {
        const v = Number(String(item[formula] ?? '').replace(/[,￥¥%]/g, ''));
        if (Number.isFinite(v)) {
          totalVal += v;
          validCount += 1;
        }
      }

      const finalVal = agg === 'avg' ? (validCount > 0 ? totalVal / validCount : 0) : agg === 'count' ? datasetItems.length : totalVal;
      let groups: Array<{ label: string; value: number | null; count: number }> | undefined;
      if (options.groupBy) {
        const gMap = new Map<string, { sum: number; count: number }>();
        for (const item of datasetItems) {
          const g = String(item[options.groupBy] || '未分类');
          const entry = gMap.get(g) || { sum: 0, count: 0 };
          const v = Number(String(item[formula] ?? '').replace(/[,￥¥%]/g, ''));
          if (Number.isFinite(v)) entry.sum += v;
          entry.count += 1;
          gMap.set(g, entry);
        }
        groups = Array.from(gMap.entries()).map(([label, st]) => ({
          label,
          value: agg === 'avg' ? (st.count > 0 ? st.sum / st.count : 0) : st.sum,
          count: st.count,
        }));
      }

      return {
        key: metricKey,
        name: customDef.name,
        unit,
        value: finalVal,
        formattedValue: formatMetricValue(finalVal, format, unit),
        sampleSize: datasetItems.length,
        groups,
        status: datasetItems.length > 0 ? 'ok' : 'empty',
        statusLabel: '计算完成',
      };
    }

    if (metricKey === 'task_total') {
      const count = datasetItems.length;
      return {
        key: metricKey,
        name: '任务总数',
        unit: '项',
        value: count,
        formattedValue: formatMetricValue(count, 'number', '项'),
        sampleSize: count,
        status: count > 0 ? 'ok' : 'empty',
        statusLabel: count > 0 ? '计算完成' : '无数据记录',
      };
    }

    if (metricKey === 'task_completed') {
      const completed = datasetItems.filter(item => {
        const s = item.status || item['状态'] || item.state;
        return isStatusCompleted(s);
      }).length;
      return {
        key: metricKey,
        name: '已完成任务数',
        unit: '项',
        value: completed,
        formattedValue: formatMetricValue(completed, 'number', '项'),
        sampleSize: datasetItems.length,
        status: datasetItems.length > 0 ? (completed > 0 ? 'ok' : 'zero') : 'empty',
        statusLabel: datasetItems.length > 0 ? '计算完成' : '无数据记录',
      };
    }

    if (metricKey === 'task_completion_rate') {
      const total = datasetItems.length;
      if (total === 0) {
        return {
          key: metricKey,
          name: '任务完成率',
          unit: '%',
          value: null,
          formattedValue: '—',
          sampleSize: 0,
          numerator: 0,
          denominator: 0,
          status: 'zero_division',
          statusLabel: '分母为0（样本量不足）',
        };
      }
      const completed = datasetItems.filter(item => {
        const s = item.status || item['状态'] || item.state;
        return isStatusCompleted(s);
      }).length;
      const rate = (completed / total) * 100;
      return {
        key: metricKey,
        name: '任务完成率',
        unit: '%',
        value: rate,
        formattedValue: rate.toFixed(1) + '%',
        sampleSize: total,
        numerator: completed,
        denominator: total,
        status: completed === 0 ? 'zero' : 'ok',
        statusLabel: '计算完成',
      };
    }

    // Dynamic field detection for consultation/conversion
    if (metricKey === 'consultation_total' || metricKey === 'inquiry_total' || metricKey === '咨询人数') {
      const total = datasetItems.reduce((acc, it) => acc + (Number(it['咨询人数'] ?? it.inquiries ?? it.consultations ?? 0) || 0), 0);
      return {
        key: metricKey,
        name: '总咨询人数',
        unit: '人',
        value: total,
        formattedValue: formatMetricValue(total, 'number', '人'),
        sampleSize: datasetItems.length,
        status: datasetItems.length > 0 ? 'ok' : 'empty',
        statusLabel: '计算完成',
      };
    }

    if (metricKey === 'conversion_total' || metricKey === 'order_total' || metricKey === '成交人数') {
      const total = datasetItems.reduce((acc, it) => acc + (Number(it['成交人数'] ?? it.orders ?? it.conversions ?? 0) || 0), 0);
      return {
        key: metricKey,
        name: '总成交人数',
        unit: '人',
        value: total,
        formattedValue: formatMetricValue(total, 'number', '人'),
        sampleSize: datasetItems.length,
        status: datasetItems.length > 0 ? 'ok' : 'empty',
        statusLabel: '计算完成',
      };
    }

    if (metricKey === 'conversion_rate' || metricKey === '成交率') {
      let inqTotal = 0;
      let convTotal = 0;
      for (const it of datasetItems) {
        const inq = Number(it['咨询人数'] ?? it.inquiries ?? 0);
        const conv = Number(it['成交人数'] ?? it.orders ?? 0);
        if (Number.isFinite(inq)) inqTotal += inq;
        if (Number.isFinite(conv)) convTotal += conv;
      }
      if (inqTotal === 0) {
        return {
          key: metricKey,
          name: '成交率',
          unit: '%',
          value: null,
          formattedValue: '—',
          sampleSize: datasetItems.length,
          numerator: convTotal,
          denominator: 0,
          status: 'zero_division',
          statusLabel: '咨询人数为0，无法计算成交率',
        };
      }
      const rate = (convTotal / inqTotal) * 100;
      let groups: Array<{ label: string; value: number | null; count: number }> | undefined;
      if (options.groupBy) {
        const gMap = new Map<string, { inq: number; conv: number; count: number }>();
        for (const it of datasetItems) {
          const g = String(it[options.groupBy] || '未分类');
          const entry = gMap.get(g) || { inq: 0, conv: 0, count: 0 };
          const inq = Number(it['咨询人数'] ?? it.inquiries ?? 0);
          const conv = Number(it['成交人数'] ?? it.orders ?? 0);
          if (Number.isFinite(inq)) entry.inq += inq;
          if (Number.isFinite(conv)) entry.conv += conv;
          entry.count += 1;
          gMap.set(g, entry);
        }
        groups = Array.from(gMap.entries()).map(([label, st]) => ({
          label,
          value: st.inq > 0 ? (st.conv / st.inq) * 100 : null,
          count: st.count,
        }));
      }

      return {
        key: metricKey,
        name: '成交率',
        unit: '%',
        value: rate,
        formattedValue: rate.toFixed(1) + '%',
        sampleSize: datasetItems.length,
        numerator: convTotal,
        denominator: inqTotal,
        groups,
        status: 'ok',
        statusLabel: '计算完成',
      };
    }

    if (metricKey === 'budget_total' || metricKey === 'spent_total' || metricKey === 'budget_spent_rate') {
      let totalBudget = 0;
      let totalSpent = 0;
      for (const item of datasetItems) {
        const b = Number(item.budget ?? item['预算'] ?? item.plan_budget ?? 0);
        const s = Number(item.spent ?? item.actual_spent ?? item['实际支出'] ?? item['支出'] ?? 0);
        if (Number.isFinite(b)) totalBudget += b;
        if (Number.isFinite(s)) totalSpent += s;
      }

      if (metricKey === 'budget_total') {
        return {
          key: metricKey,
          name: '总预算',
          unit: '元',
          value: totalBudget,
          formattedValue: formatMetricValue(totalBudget, 'currency', '元'),
          sampleSize: datasetItems.length,
          status: datasetItems.length > 0 ? 'ok' : 'empty',
          statusLabel: '计算完成',
        };
      }
      if (metricKey === 'spent_total') {
        return {
          key: metricKey,
          name: '实际总支出',
          unit: '元',
          value: totalSpent,
          formattedValue: formatMetricValue(totalSpent, 'currency', '元'),
          sampleSize: datasetItems.length,
          status: datasetItems.length > 0 ? 'ok' : 'empty',
          statusLabel: '计算完成',
        };
      }
      if (metricKey === 'budget_spent_rate') {
        if (totalBudget === 0) {
          return {
            key: metricKey,
            name: '预算执行率',
            unit: '%',
            value: null,
            formattedValue: '—',
            sampleSize: datasetItems.length,
            numerator: totalSpent,
            denominator: 0,
            status: 'zero_division',
            statusLabel: '预算分母为0，无法计算执行率',
          };
        }
        const rate = (totalSpent / totalBudget) * 100;
        return {
          key: metricKey,
          name: '预算执行率',
          unit: '%',
          value: rate,
          formattedValue: rate.toFixed(1) + '%',
          sampleSize: datasetItems.length,
          numerator: totalSpent,
          denominator: totalBudget,
          status: totalSpent === 0 ? 'zero' : 'ok',
          statusLabel: '计算完成',
        };
      }
    }
  }

  // 2. Query project_notes & related tables
  const conditions = ['pn.project_id = ?'];
  const params: unknown[] = [projectId];

  if (options.from) {
    conditions.push('(date(COALESCE(pn.last_fetched_at, n.published_at)) >= date(?) OR COALESCE(pn.last_fetched_at, n.published_at) IS NULL)');
    params.push(options.from);
  }
  if (options.to) {
    conditions.push('(date(COALESCE(pn.last_fetched_at, n.published_at)) <= date(?) OR COALESCE(pn.last_fetched_at, n.published_at) IS NULL)');
    params.push(options.to);
  }
  if (options.source) {
    conditions.push('pn.source_type = ?');
    params.push(options.source);
  }
  if (options.status) {
    conditions.push('pn.status = ?');
    params.push(options.status);
  }
  if (options.scope) {
    conditions.push('pn.product_scope = ?');
    params.push(options.scope);
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ');

  const [noteAgg, supplierAgg, commentAgg, adsAgg] = await Promise.all([
    d1.prepare(`SELECT
      COUNT(*) AS totalNotes,
      COALESCE(SUM(pn.comment_total), 0) AS totalComments,
      COALESCE(SUM(pn.positive_count), 0) AS positiveCount,
      COALESCE(SUM(pn.negative_count), 0) AS negativeCount,
      COALESCE(SUM(p.read_count), 0) AS totalReads,
      COALESCE(SUM(p.interaction_count), 0) AS totalInteractions,
      COALESCE(SUM(p.exposure), 0) AS totalExposure,
      COALESCE(SUM(pnp.note_price), 0) AS totalSpend,
      SUM(CASE WHEN pn.status = '符合且能汇报' THEN 1 ELSE 0 END) AS reportableCount
      FROM project_notes pn
      LEFT JOIN notes n ON n.id = pn.note_id
      LEFT JOIN note_profiles p ON p.note_id = pn.note_id
      LEFT JOIN note_project_profiles pnp ON pnp.project_id = pn.project_id AND pnp.note_id = pn.note_id
      ${whereClause}`).bind(...params).first<Record<string, number>>(),

    d1.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN visibility = '已外显' OR visibility LIKE '%外显%' THEN 1 ELSE 0 END) AS visibleCount,
      SUM(CASE WHEN visibility = '待核验' THEN 1 ELSE 0 END) AS pendingCount
      FROM supplier_comments WHERE project_id = ?`).bind(projectId).first<Record<string, number>>(),

    d1.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN sentiment = '正向' THEN 1 ELSE 0 END) AS positiveTotal,
      SUM(CASE WHEN sentiment = '负向' THEN 1 ELSE 0 END) AS negativeTotal
      FROM key_comments WHERE project_id = ?`).bind(projectId).first<Record<string, number>>(),

    d1.prepare(`SELECT
      COALESCE(SUM(spend), 0) AS totalSpend,
      COALESCE(SUM(impressions), 0) AS totalImpressions,
      COALESCE(SUM(clicks), 0) AS totalClicks
      FROM paid_ad_metrics WHERE project_id = ?`).bind(projectId).first<Record<string, number>>(),
  ]);

  const totalNotes = Number(noteAgg?.totalNotes || 0);

  if (metricKey === 'published_notes') {
    return {
      key: metricKey,
      name: '发布笔记数',
      unit: '篇',
      value: totalNotes,
      formattedValue: formatMetricValue(totalNotes, 'number', '篇'),
      sampleSize: totalNotes,
      status: totalNotes > 0 ? 'ok' : 'zero',
      statusLabel: '计算完成',
    };
  }

  if (metricKey === 'interactions') {
    const v = Number(noteAgg?.totalInteractions || 0);
    return {
      key: metricKey,
      name: '总互动量',
      unit: '次',
      value: v,
      formattedValue: formatMetricValue(v, 'compact', '次'),
      sampleSize: totalNotes,
      status: totalNotes > 0 ? (v > 0 ? 'ok' : 'zero') : 'empty',
      statusLabel: '计算完成',
    };
  }

  if (metricKey === 'reads') {
    const v = Number(noteAgg?.totalReads || 0);
    return {
      key: metricKey,
      name: '总阅读量',
      unit: '次',
      value: v,
      formattedValue: formatMetricValue(v, 'compact', '次'),
      sampleSize: totalNotes,
      status: totalNotes > 0 ? (v > 0 ? 'ok' : 'zero') : 'empty',
      statusLabel: '计算完成',
    };
  }

  if (metricKey === 'cpe') {
    const spend = Number(noteAgg?.totalSpend || 0);
    const interactions = Number(noteAgg?.totalInteractions || 0);
    if (interactions === 0) {
      return {
        key: metricKey,
        name: '互动成本 CPE',
        unit: '元',
        value: null,
        formattedValue: '—',
        sampleSize: totalNotes,
        numerator: spend,
        denominator: interactions,
        status: 'zero_division',
        statusLabel: '互动量为0，无法计算单次互动成本',
      };
    }
    const cpe = spend / interactions;
    return {
      key: metricKey,
      name: '互动成本 CPE',
      unit: '元',
      value: cpe,
      formattedValue: formatMetricValue(cpe, 'currency', '元'),
      sampleSize: totalNotes,
      numerator: spend,
      denominator: interactions,
      status: 'ok',
      statusLabel: '计算完成',
    };
  }

  if (metricKey === 'ctr') {
    const impressions = Number(adsAgg?.totalImpressions || noteAgg?.totalExposure || 0);
    const clicks = Number(adsAgg?.totalClicks || noteAgg?.totalInteractions || 0);
    if (impressions === 0) {
      return {
        key: metricKey,
        name: '点击率 CTR',
        unit: '%',
        value: null,
        formattedValue: '—',
        sampleSize: totalNotes,
        numerator: clicks,
        denominator: impressions,
        status: 'zero_division',
        statusLabel: '曝光数为0，无法计算点击率',
      };
    }
    const ctr = (clicks / impressions) * 100;
    return {
      key: metricKey,
      name: '点击率 CTR',
      unit: '%',
      value: ctr,
      formattedValue: ctr.toFixed(2) + '%',
      sampleSize: totalNotes,
      numerator: clicks,
      denominator: impressions,
      status: 'ok',
      statusLabel: '计算完成',
    };
  }

  if (metricKey === 'spend') {
    const spend = Number(adsAgg?.totalSpend || noteAgg?.totalSpend || 0);
    return {
      key: metricKey,
      name: '总消耗',
      unit: '元',
      value: spend,
      formattedValue: formatMetricValue(spend, 'currency', '元'),
      sampleSize: totalNotes,
      status: spend > 0 ? 'ok' : 'zero',
      statusLabel: '计算完成',
    };
  }

  if (metricKey === 'supplier_visible_rate') {
    const supTotal = Number(supplierAgg?.total || 0);
    const visible = Number(supplierAgg?.visibleCount || 0);
    if (supTotal === 0) {
      return {
        key: metricKey,
        name: '供应商外显达标率',
        unit: '%',
        value: null,
        formattedValue: '—',
        sampleSize: 0,
        numerator: 0,
        denominator: 0,
        status: 'zero_division',
        statusLabel: '暂无供应商交付记录',
      };
    }
    const rate = (visible / supTotal) * 100;
    return {
      key: metricKey,
      name: '供应商外显达标率',
      unit: '%',
      value: rate,
      formattedValue: rate.toFixed(1) + '%',
      sampleSize: supTotal,
      numerator: visible,
      denominator: supTotal,
      status: visible === 0 ? 'zero' : 'ok',
      statusLabel: '计算完成',
    };
  }

  return {
    key: metricKey,
    name: metricKey,
    unit: '',
    value: null,
    formattedValue: '—',
    sampleSize: 0,
    status: 'empty',
    statusLabel: '未配置或暂无数据',
  };
}
