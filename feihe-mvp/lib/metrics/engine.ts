import { parseNumericValue } from '../numeric-values';
import { db, ensureSchema } from '../db';
import { isTemplateCard, type CardMetricConfig } from './config';
import { parseProjectDate, endDayExclusive, DEFAULT_PROJECT_TIME_ZONE } from '../date-values';


export function isStatusCompleted(status: unknown): boolean {
  const s = String(status ?? "").trim();
  if (!s) return false;
  if (/^(未完成|尚未完成|未开始|待开始|进行中|排队中|待处理|异常|失败)$/i.test(s) || /未完成|尚未完成|not done|unfinished/i.test(s)) {
    return false;
  }
  return /^(已完成|完成|done|finished|已达成|已结项|外显成功|已外显)$/i.test(s) || /^完成$/i.test(s);
}

export type AggregationType = 'sum' | 'count' | 'distinct_count' | 'avg' | 'min' | 'max' | 'ratio';
export type MetricStatus = 'ok' | 'zero' | 'empty' | 'missing_source' | 'zero_division' | 'error' | 'missing_field' | 'invalid_value';

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


export type { CardMetricConfig } from './config';

function isMissing(value: unknown) { return value === undefined || value === null || String(value).trim() === ''; }
function numericValues(items: Record<string, unknown>[], field: string, fillZero = false) {
  const observed = items.filter(item => Object.prototype.hasOwnProperty.call(item, field));
  const values: number[] = [];
  let invalid = 0;
  for (const item of items) {
    const raw = item[field];
    if (isMissing(raw)) { if (fillZero) values.push(0); continue; }
    const parsed = parseNumericValue(raw);
    if (parsed !== null) values.push(parsed); else invalid++;
  }
  return { values, observed: observed.length, invalid, sum: values.reduce((a, b) => a + b, 0) };
}

type EngineMetricConfig = Omit<CardMetricConfig, 'aggregation'> & { aggregation?: CardMetricConfig['aggregation'] | AggregationType };

export function evaluateMetricRows(card: EngineMetricConfig, items: Record<string, unknown>[]): MetricComputeResult {
  const base: MetricComputeResult = { key: card.metric || card.field || 'custom', name: card.title || '指标', unit: card.unit || '', value: null, formattedValue: '—', sampleSize: 0, status: 'empty', statusLabel: '无有效数据' };
  const fail = (status: MetricStatus, label: string) => ({ ...base, status, statusLabel: label });
  const fillZero = card.missingPolicy === 'zero';
  const aggregation = card.aggregation || 'sum';
  const field = card.field || (card.metric !== 'custom' ? card.metric : '') || '';
  let result: MetricComputeResult;
  if (aggregation === 'count') {
    result = { ...base, value: items.length, sampleSize: items.length, status: items.length ? 'ok' : 'empty', statusLabel: items.length ? '计算完成' : '无数据记录' };
  } else if (aggregation === 'nonempty_count' || aggregation === 'distinct_count') {
    if (!field || (items.length && !items.some(row => Object.prototype.hasOwnProperty.call(row, field)))) return fail('missing_field', '目标字段不存在');
    const values = items.map(row => row[field]).filter(value => !isMissing(value));
    const count = aggregation === 'nonempty_count' ? values.length : new Set(values.map(value => JSON.stringify(value))).size;
    result = { ...base, value: count, sampleSize: values.length, status: count ? 'ok' : 'zero', statusLabel: '计算完成' };
  } else if (aggregation === 'ratio') {
    const numerator = numericValues(items, card.numField || '', fillZero), denominator = numericValues(items, card.denField || '', fillZero);
    if (numerator.invalid || denominator.invalid) return fail('invalid_value', '分子/分母包含无效数值');
    if (!numerator.values.length || !denominator.values.length) return fail(!numerator.observed || !denominator.observed ? 'missing_field' : 'empty', !numerator.observed || !denominator.observed ? '分子/分母字段不存在' : '分子/分母全空，无法计算');
    if (denominator.sum === 0) return { ...fail('zero_division', '分母为0，无法计算比率'), numerator: numerator.sum, denominator: 0, sampleSize: Math.min(numerator.values.length, denominator.values.length) };
    result = { ...base, value: numerator.sum / denominator.sum * 100, numerator: numerator.sum, denominator: denominator.sum, sampleSize: Math.min(numerator.values.length, denominator.values.length), status: numerator.sum === 0 ? 'zero' : 'ok', statusLabel: '计算完成' };
  } else {
    if (!field) return fail('error', '未选择目标字段');
    const stats = numericValues(items, field, fillZero);
    if (stats.invalid) return fail('invalid_value', '目标字段包含无效数值');
    if (!stats.values.length) return fail(stats.observed ? 'empty' : 'missing_field', stats.observed ? '目标字段全空' : '目标字段不存在');
    const value = aggregation === 'avg' ? stats.sum / stats.values.length
      : aggregation === 'min' ? stats.values.reduce((a, b) => Math.min(a, b), Infinity)
      : aggregation === 'max' ? stats.values.reduce((a, b) => Math.max(a, b), -Infinity) : stats.sum;
    result = { ...base, value, sampleSize: stats.values.length, status: value === 0 ? 'zero' : 'ok', statusLabel: '计算完成' };
  }
  result.formattedValue = aggregation === 'ratio' ? result.value!.toFixed(1) + '%' : formatMetricValue(result.value, card.format || 'number', card.unit || '');
  if (card.groupBy) {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of items) {
      const label = isMissing(row[card.groupBy]) ? '未分类' : String(row[card.groupBy]);
      const rows = groups.get(label) || []; rows.push(row); groups.set(label, rows);
    }
    result.groups = [...groups].map(([label, rows]) => {
      const grouped = evaluateMetricRows({ ...card, groupBy: undefined }, rows);
      return { label, value: grouped.value, count: grouped.sampleSize };
    });
  }
  return result;
}

export async function evaluateCardMetric(projectId: string, card: CardMetricConfig): Promise<MetricComputeResult> {
  await ensureSchema();
  const d1 = db();
  const dataset = await (card.datasetId
    ? d1.prepare('SELECT id FROM datasets WHERE project_id=? AND (id=? OR source_id=?) LIMIT 1').bind(projectId, card.datasetId, card.datasetId)
    : d1.prepare('SELECT id FROM datasets WHERE project_id=? ORDER BY row_count DESC, created_at ASC LIMIT 1').bind(projectId)).first<{ id: string }>();
  if (!dataset) return { key: card.metric || 'custom', name: card.title || '指标', unit: card.unit || '', value: null, formattedValue: '—', sampleSize: 0, status: 'missing_source', statusLabel: '数据源不存在或已移除' };
  const stored = await d1.prepare('SELECT data_json FROM dataset_rows WHERE dataset_id=? ORDER BY rowid ASC').bind(dataset.id).all<{ data_json: string }>();
  let items: Record<string, unknown>[] = (stored.results || []).map(r => JSON.parse(r.data_json));
  if (card.from || card.to) {
    const zoneSetting = await d1.prepare("SELECT value FROM project_settings WHERE project_id=? AND key='timezone'").bind(projectId).first<{ value: string }>();
    let timeZone = DEFAULT_PROJECT_TIME_ZONE;
    try { timeZone = zoneSetting ? JSON.parse(zoneSetting.value) : timeZone; } catch { timeZone = zoneSetting?.value || timeZone; }
    const startTime = card.from ? parseProjectDate(card.from, timeZone) : null;
    const endTime = card.to ? endDayExclusive(card.to, timeZone) : null;
    if (!card.dateField || (card.from && startTime === null) || (card.to && endTime === null)) return { ...evaluateMetricRows({ aggregation: 'count' }, []), value: null, formattedValue: '—', status: 'error', statusLabel: '日期字段或范围无效' };
    items = items.filter(row => { const time = parseProjectDate(row[card.dateField!], timeZone); return time !== null && (startTime === null || time >= startTime) && (endTime === null || time < endTime); });
  }
  let effective = { ...card };
  if (isTemplateCard(card)) {
    const findField = (...aliases: string[]) => aliases.find(key => items.some(row => key in row)) || aliases[0];
    const budget = findField('budget', '预算', 'plan_budget'), spent = findField('spent', 'actual_spent', '实际支出', '支出');
    switch (card.metric) {
      case 'task_total': effective = { ...card, aggregation: 'count' }; break;
      case 'task_completed': effective = { ...card, aggregation: 'sum', field: '__completed' }; items = items.map(row => ({ ...row, __completed: isMissing(row.status ?? row['状态'] ?? row.state) ? null : isStatusCompleted(row.status ?? row['状态'] ?? row.state) ? 1 : 0 })); break;
      case 'task_completion_rate': effective = { ...card, aggregation: 'ratio', numField: '__completed', denField: '__record' }; items = items.map(row => ({ ...row, __record: 1, __completed: isStatusCompleted(row.status ?? row['状态'] ?? row.state) ? 1 : 0 })); break;
      case 'budget_total': effective = { ...card, aggregation: 'sum', field: budget, format: 'currency' }; break;
      case 'spent_total': effective = { ...card, aggregation: 'sum', field: spent, format: 'currency' }; break;
      case 'budget_spent_rate': effective = { ...card, aggregation: 'ratio', numField: spent, denField: budget }; break;
      case 'conversion_rate': effective = { ...card, aggregation: 'ratio', numField: card.numField || '成交人数', denField: card.denField || '咨询人数' }; break;
    }
  }
  return evaluateMetricRows(effective, items);
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
    const custom = await d1.prepare('SELECT name, unit, aggregation, formula, format FROM metric_definitions WHERE project_id=? AND key=?').bind(projectId, metricKey).first<{ name: string; unit: string; aggregation: string; formula: string; format: string }>();
    const columnsRow = await d1.prepare('SELECT schema_json FROM datasets WHERE id=?').bind(datasetRow.id).first<{ schema_json: string }>();
    const columns = JSON.parse(columnsRow?.schema_json || '[]') as Array<{ key: string; type: string }>;
    const dateField = columns.find(c => c.type === 'date')?.key;
    if (custom) {
      const parts = custom.formula.split('/').map(s => s.trim());
      return evaluateCardMetric(projectId, { title: custom.name, datasetId: datasetRow.id, metric: 'custom', aggregation: custom.aggregation as CardMetricConfig['aggregation'], field: custom.aggregation === 'ratio' ? undefined : custom.formula, numField: custom.aggregation === 'ratio' ? parts[0] : undefined, denField: custom.aggregation === 'ratio' ? parts[1] : undefined, unit: custom.unit, format: custom.format as CardMetricConfig['format'], dateField, from: options.from, to: options.to, groupBy: options.groupBy });
    }
    return evaluateCardMetric(projectId, { datasetId: datasetRow.id, metric: metricKey, dateField, from: options.from, to: options.to, groupBy: options.groupBy });
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
