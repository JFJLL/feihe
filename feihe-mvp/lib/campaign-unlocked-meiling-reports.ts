import type {
  CampaignDashboard,
  CampaignKpi,
  CampaignSource,
  CampaignTable,
  CampaignTableColumn,
  CampaignTableRow,
} from './campaign-types';

export const MEILING_UNLOCKED_PREFIX = 'meiling-unlocked-';
export const MEILING_UNLOCKED_WARNING_PREFIX = '【美菱数据更新】';

const PERIOD_618 = '2026年618大促（已结案）';
const PERIOD_D11 = '双11大促执行期（截至10月18日累计）';

interface ReopenedTab {
  sheet_id: string;
  sheet_name: string;
  rows: string[][];
  readAt?: string;
}

interface ReopenedWorkbook {
  node_token: string;
  real_title?: string;
  URL?: string;
  captured_tabs: ReopenedTab[];
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s || s === '-' || s === '/' || s.startsWith('#')) return null;
  const n = parseFloat(s.replace(/[¥￥,\s%]/g, ''));
  return isNaN(n) ? null : n;
}

function parseTarget(s: string): { target: number | null; direction: 'higher' | 'lower' | 'neutral' } {
  if (!s) return { target: null, direction: 'neutral' };
  const direction = s.startsWith('≥') || s.startsWith('>=') ? 'higher' : (s.startsWith('≤') || s.startsWith('<=') ? 'lower' : 'neutral');
  const n = parseFloat(s.replace(/[≥≤>=<\s%¥￥,]/g, ''));
  return { target: isNaN(n) ? null : n, direction };
}

function evaluateStatus(actual: number | null, target: number | null, direction: 'higher' | 'lower' | 'neutral'): string {
  if (actual === null || target === null || direction === 'neutral') return '待核';
  return direction === 'higher' ? (actual >= target ? '达成' : '未达成') : (actual <= target ? '达成' : '未达成');
}

const cols = (defs: [string, string, CampaignTableColumn['type']?, CampaignTableColumn['align']?][]): CampaignTableColumn[] =>
  defs.map(([key, title, type = 'string', align = 'left']) => ({ key, title, type, align }));

export function applyUnlockedMeilingReports(
  dashboard: CampaignDashboard,
  reopened: unknown
): CampaignDashboard {
  if (!reopened || typeof reopened !== 'object') return dashboard;
  const payload = reopened as { metadata?: { readAt?: string }; workbooks?: ReopenedWorkbook[] };
  if (!Array.isArray(payload.workbooks) || payload.workbooks.length === 0) return dashboard;

  const readAt = payload.metadata?.readAt ||
    payload.workbooks.find((w) => w.captured_tabs?.[0]?.readAt)?.captured_tabs[0]?.readAt ||
    dashboard.updatedAt;

  const wbMap = new Map<string, ReopenedWorkbook>();
  for (const wb of payload.workbooks) wbMap.set(wb.node_token, wb);
  const mmpzWb = wbMap.get('MMPZwhQbMiVmIKkcyb9c7mDQnHp');
  const dkdWb = wbMap.get('DkdOwDEk0i9FTUkXlh1cTE0fnOd');
  if (!mmpzWb && !dkdWb) return dashboard;

  const srcMmpzId = 'src-meiling-node-MMPZwhQbMiVmIKkcyb9c7mDQnHp';
  const srcDkdId = 'src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd';
  const mmpzHasRows = Boolean(mmpzWb?.captured_tabs?.some((t) => t.rows && t.rows.length > 0));
  const dkdHasRows = Boolean(dkdWb?.captured_tabs?.some((t) => t.rows && t.rows.length > 0));

  // 1. Update/Clean Sources (status ready only if valid rows exist)
  const updatedSources: CampaignSource[] = dashboard.sources.map((s) => {
    if (s.id === srcMmpzId && mmpzWb) {
      return { ...s, name: mmpzWb.real_title || s.name, status: mmpzHasRows ? 'ready' : s.status, detail: '飞书文档已开放：618大促历史复盘（已提取考核KPI与全渠道GMV）', fetchedAt: readAt, provenance: { type: 'feishu', sourceName: '飞书电子表格', syncedAt: readAt } };
    }
    if (s.id === srcDkdId && dkdWb) {
      return { ...s, name: dkdWb.real_title || s.name, status: dkdHasRows ? 'ready' : s.status, detail: '飞书文档已开放：双11投放日报（已提取预算进度、渠道汇总与CID分日）', fetchedAt: readAt, provenance: { type: 'feishu', sourceName: '飞书电子表格', syncedAt: readAt } };
    }
    return s;
  });
  const existingSrcIds = new Set(dashboard.sources.map((s) => s.id));
  if (mmpzWb && !existingSrcIds.has(srcMmpzId)) {
    updatedSources.push({ id: srcMmpzId, name: mmpzWb.real_title || '美菱冰箱618复盘数据', url: mmpzWb.URL || 'https://yimeichuanbo.feishu.cn/wiki/MMPZwhQbMiVmIKkcyb9c7mDQnHp', status: mmpzHasRows ? 'ready' : 'pending', detail: '飞书文档已开放：618大促历史结案复盘', fetchedAt: readAt, provenance: { type: 'feishu', sourceName: '飞书电子表格', syncedAt: readAt } });
  }
  if (dkdWb && !existingSrcIds.has(srcDkdId)) {
    updatedSources.push({ id: srcDkdId, name: dkdWb.real_title || '美菱冰箱双11日报表', url: dkdWb.URL || 'https://yimeichuanbo.feishu.cn/wiki/DkdOwDEk0i9FTUkXlh1cTE0fnOd', status: dkdHasRows ? 'ready' : 'pending', detail: '飞书文档已开放：双11投放执行与分日数据', fetchedAt: readAt, provenance: { type: 'feishu', sourceName: '飞书电子表格', syncedAt: readAt } });
  }

  const newTables: CampaignTable[] = [];
  const newKpis: CampaignKpi[] = [];

  // 2. Parse MMPZ (618 Review: KPI & Channel GMV)
  if (mmpzWb && mmpzHasRows) {
    const hmtxTab = mmpzWb.captured_tabs.find((t) => t.sheet_id === 'hmtx2k' || t.sheet_name === 'Sheet4');
    if (hmtxTab && hmtxTab.rows.length > 0) {
      const kpiRowList: CampaignTableRow[] = [];
      const kpiNameSet = new Set(['CTR', '爆文率', 'CPC', 'CPE', 'CPUV', 'ROI']);
      for (const r of hmtxTab.rows) {
        for (let c = 0; c < r.length - 2; c++) {
          const cellName = r[c]?.trim().toUpperCase();
          if (cellName && (kpiNameSet.has(cellName) || cellName === '爆文率')) {
            const displayName = cellName === 'ROI' ? '全案综合ROI' : r[c].trim();
            const actStr = r[c + 1]?.trim() || '';
            const tgtStr = r[c + 2]?.trim() || '';
            const actNum = parseNum(actStr);
            const { target, direction } = parseTarget(tgtStr);
            kpiRowList.push({ metric: displayName, actual: actStr || '-', target: tgtStr || '-', status: evaluateStatus(actNum, target, direction), note: displayName === '全案综合ROI' ? '分母计入达人最终报价与折后投流费用' : '源表618结案考核指标' });
            if (displayName === '全案综合ROI' && actNum !== null) {
              newKpis.push({ id: `${MEILING_UNLOCKED_PREFIX}kpi-618-roi`, label: '618结案全案ROI(历史参考)', value: actNum, target, direction, period: PERIOD_618, sourceId: srcMmpzId, provenance: 'feishu', note: '618结案综合ROI，分母含达人与投流花费，非双11当前指标' });
            }
          }
        }
        if (r[0]?.includes('共计') && r[1]) {
          const totalGmv = parseNum(r[1]);
          if (totalGmv !== null) {
            newKpis.push({ id: `${MEILING_UNLOCKED_PREFIX}kpi-618-gmv`, label: '618结案全渠道总GMV(历史参考)', value: totalGmv, unit: '元', target: null, direction: 'higher', period: PERIOD_618, sourceId: srcMmpzId, provenance: 'feishu', note: '618全渠道总结案GMV（含代采与自采外溢渠道），非双11当前指标' });
          }
        }
      }
      if (kpiRowList.length > 0) {
        newTables.push({ id: `${MEILING_UNLOCKED_PREFIX}618-kpi`, category: 'kpi', title: '618大促历史复盘考核KPI与达成表（历史参考）', period: PERIOD_618, sourceId: srcMmpzId, provenance: 'feishu', columns: cols([['metric', '考核指标项'], ['actual', '实际完成', 'string', 'right'], ['target', '考核目标', 'string', 'right'], ['status', '达成状态', 'string', 'center'], ['note', '口径说明']]), rows: kpiRowList });
      }
    }
  }

  // 3. Parse Dkd (Double 11: Budget, Channel Summary, CID Daily)
  if (dkdWb && dkdHasRows) {
    // 3.1 smsJa2: Double 11 Budget Execution
    const smsTab = dkdWb.captured_tabs.find((t) => t.sheet_id === 'smsJa2');
    if (smsTab && smsTab.rows.length > 0) {
      let d11HeaderIdx = -1;
      let d11TotalIdx = -1;
      for (let i = 0; i < smsTab.rows.length; i++) {
        const r = smsTab.rows[i];
        if (r.some((c) => c.includes('采买形式')) && r.some((c) => c.includes('新费用')) && r.some((c) => c.includes('实际消耗'))) {
          for (let j = i + 1; j < Math.min(smsTab.rows.length, i + 25); j++) {
            if (smsTab.rows[j].some((c) => c.includes('总费用'))) {
              d11HeaderIdx = i; d11TotalIdx = j; break;
            }
          }
        }
      }

      if (d11HeaderIdx !== -1 && d11TotalIdx !== -1) {
        const budgetRows: CampaignTableRow[] = [];
        let currForm = '';
        let currSeries = '';
        let currModel = '';

        for (let i = d11HeaderIdx + 1; i <= d11TotalIdx; i++) {
          const r = smsTab.rows[i];
          const isTotal = r.some((c) => c.includes('总费用'));
          const fsBudget = parseNum(r[5]);
          const newBudget = parseNum(r[6]);
          const actualSpend = parseNum(r[7]);
          const progress = parseNum(r[8]);
          const remaining = parseNum(r[9]);
          const dailyRunRate = parseNum(r[10]);

          const hasValues = [r[4], r[5], r[6], r[7], r[9]].some((v) => parseNum(v) !== null);
          if (!hasValues && !isTotal) continue;

          if (r[0]?.trim()) currForm = r[0].trim();
          if (r[1]?.trim()) currSeries = r[1].trim();
          if (r[2]?.trim()) currModel = r[2].trim();

          let note = isTotal ? '双11大促全期预算与截至10.18累计消耗汇总' : (r[12]?.trim() || '投放品线');
          if (!isTotal && newBudget !== null && actualSpend !== null && remaining !== null) {
            if (Math.abs(remaining - Number((newBudget - actualSpend).toFixed(2))) > 100) {
              note = '源表剩余金额未扣减实际消耗，按原表记录保留待业务核对';
            }
          }

          budgetRows.push({
            procurementForm: isTotal ? '全部' : (currForm || '-'),
            series: isTotal ? '全系合计' : (currSeries || '-'),
            model: isTotal ? '总费用合计' : (r[2]?.trim() || currModel || '-'),
            channel: isTotal ? '-' : (r[3]?.trim() || '-'),
            fsBudget, newBudget, actualSpend,
            progress: progress !== null ? `${progress}%` : '-',
            remaining, dailyRunRate, note,
          });

          if (isTotal) {
            if (actualSpend !== null) {
              newKpis.push({
                id: `${MEILING_UNLOCKED_PREFIX}kpi-d11-actual-spend`,
                label: '双11累计实际消耗(截至10.18)', value: actualSpend, unit: '元', target: newBudget, direction: 'neutral',
                period: PERIOD_D11, sourceId: srcDkdId, provenance: 'feishu',
                note: `调整后总预算${newBudget !== null ? newBudget.toLocaleString() : '-'}元；源表汇总行显示为${actualSpend.toLocaleString()}元（明细累加为309,923.23元）`,
              });
            }
            if (progress !== null) {
              newKpis.push({
                id: `${MEILING_UNLOCKED_PREFIX}kpi-d11-progress`,
                label: '双11预算消耗进度', value: progress, unit: '%', target: null, direction: 'neutral',
                period: PERIOD_D11, sourceId: srcDkdId, provenance: 'feishu',
                note: '截至10.18大促全期累计消耗进度（非单日值）',
              });
            }
          }
        }

        newTables.push({
          id: `${MEILING_UNLOCKED_PREFIX}double11-budget-execution`, category: 'budget',
          title: '双11大促投放执行与预算进度（截至10.18快照）', period: PERIOD_D11, sourceId: srcDkdId, provenance: 'feishu',
          columns: cols([['procurementForm', '采买形式'], ['series', '产品系列'], ['model', '型号规格'], ['channel', '回流渠道', 'string', 'center'], ['fsBudget', '原FS预算(元)', 'currency', 'right'], ['newBudget', '调整后新预算(元)', 'currency', 'right'], ['actualSpend', '实际累计消耗(元)', 'currency', 'right'], ['progress', '消耗进度', 'percent', 'right'], ['remaining', '剩余预算(元)', 'currency', 'right'], ['dailyRunRate', '剩余日均(元)', 'currency', 'right'], ['note', '说明/备注']]),
          rows: budgetRows,
        });
      }
    }

    // 3.2 BZjmuN: Channel Summary (Independent JD/TB task GMV & CID GMV, no cross-summing)
    const bzTab = dkdWb.captured_tabs.find((t) => t.sheet_id === 'BZjmuN');
    if (bzTab && bzTab.rows.length > 1) {
      const channelRows: CampaignTableRow[] = [];
      let currCat = '';
      for (let i = 1; i < Math.min(bzTab.rows.length, 18); i++) {
        const r = bzTab.rows[i];
        if (r[0]?.trim()) currCat = r[0].trim();
        const subName = r[2]?.trim() || r[1]?.trim() || r[0]?.trim() || '';
        if (!subName || subName === '/') continue;

        const ctrRaw = r[7]?.trim() || '';
        const ctrClean = (ctrRaw.startsWith('#') || ctrRaw === '-' || ctrRaw === '/') ? null : ctrRaw;

        // Detect formula error across all displayed fields
        const checkCols = [3, 4, 5, 6, 7, 16, 18, 20, 21, 22];
        const hasFormulaError = checkCols.some((idx) => {
          const val = r[idx]?.trim();
          return Boolean(val && val.startsWith('#'));
        });

        channelRows.push({
          channelCategory: currCat || '渠道汇总',
          channelName: subName,
          kPublishAmount: parseNum(r[3]),
          spend: parseNum(r[4]),
          impressions: parseNum(r[5]),
          clicks: parseNum(r[6]),
          ctr: ctrClean || '-',
          cidGmv: parseNum(r[16]),
          jdTaskGmv: parseNum(r[18]),
          tbTaskGmv: parseNum(r[20]),
          totalGmv: parseNum(r[21]),
          totalRoi: parseNum(r[22]),
          qualityNote: hasFormulaError ? '源表数据引用异常，保持原表留白，待业务源表修复' : '数据正常',
        });
      }

      if (channelRows.length > 0) {
        newTables.push({
          id: `${MEILING_UNLOCKED_PREFIX}double11-channel-summary`, category: 'performance',
          title: '双11渠道投放与归因表现', period: PERIOD_D11, sourceId: srcDkdId, provenance: 'feishu',
          columns: cols([
            ['channelCategory', '采买归属'], ['channelName', '投放渠道/细分项'],
            ['kPublishAmount', '达人发布金额(元)', 'currency', 'right'], ['spend', '广告消耗(元)', 'currency', 'right'],
            ['impressions', '展现量', 'number', 'right'], ['clicks', '点击量', 'number', 'right'],
            ['ctr', 'CTR', 'percent', 'right'],
            ['cidGmv', 'CID GMV(元)', 'currency', 'right'],
            ['jdTaskGmv', '任务组GMV-京东(元)', 'currency', 'right'],
            ['tbTaskGmv', '任务组GMV-淘宝(元)', 'currency', 'right'],
            ['totalGmv', '总GMV(元)', 'currency', 'right'],
            ['totalRoi', '总ROI', 'number', 'right'],
            ['qualityNote', '数据质量与公式说明']
          ]),
          rows: channelRows,
        });
      }
    }

    // 3.3 Trvrou: Daily CID Delivery (10/16 - 10/18, 30-day attribution)
    const cidTab = dkdWb.captured_tabs.find((t) => t.sheet_id === 'Trvrou');
    if (cidTab && cidTab.rows.length > 2) {
      const cidRows: CampaignTableRow[] = [];
      for (let i = 2; i < cidTab.rows.length; i++) {
        const r = cidTab.rows[i];
        const dateStr = r[0]?.trim();
        if (!dateStr || dateStr.includes('空白')) continue;

        const isTotal = dateStr.includes('总计');
        const spend = parseNum(r[1]);
        const gmv = parseNum(r[10]);
        const roi = parseNum(r[11]);
        let note = '分日CID投放明细（ROI分母为单日纯CID广告花费）';
        if (isTotal) {
          note = spend !== null && gmv !== null && roi !== null
            ? `阶段累计汇总（消耗${spend.toLocaleString()}元，GMV ${gmv.toLocaleString()}元，累计ROI ${roi}）`
            : '阶段累计汇总（ROI分母为CID纯广告消耗）';
        }

        cidRows.push({
          date: isTotal ? '3日累计汇总' : dateStr,
          spend, impressions: parseNum(r[2]), clicks: parseNum(r[3]),
          ctr: r[4]?.trim() || '-', cpc: parseNum(r[5]), interactions: parseNum(r[7]),
          orders: parseNum(r[9]), gmv, roi, activeUv: parseNum(r[12]), note,
        });
      }

      if (cidRows.length > 0) {
        newTables.push({
          id: `${MEILING_UNLOCKED_PREFIX}double11-cid-daily`, category: 'performance',
          title: '双11京东对投CID分日投放表现（10/16-10/18）', period: '2026/10/16 ~ 2026/10/18', sourceId: srcDkdId, provenance: 'feishu',
          columns: cols([['date', '日期/周期', 'string', 'center'], ['spend', 'CID消耗(元)', 'currency', 'right'], ['impressions', '展现量', 'number', 'right'], ['clicks', '点击量', 'number', 'right'], ['ctr', 'CTR', 'percent', 'right'], ['cpc', 'CPC(元)', 'currency', 'right'], ['interactions', '互动量', 'number', 'right'], ['orders', '成交订单(30日归因)', 'number', 'right'], ['gmv', '成交GMV(30日归因,元)', 'currency', 'right'], ['roi', '30日ROI', 'number', 'right'], ['activeUv', '站外活跃UV(30日归因)', 'number', 'right'], ['note', '统计说明']]),
          rows: cidRows,
        });
      }
    }
  }

  // 4. Update Tables, KPIs, and Warnings idempotently
  const retainedTables = dashboard.tables.filter((t) => !t.id.startsWith(MEILING_UNLOCKED_PREFIX));
  const retainedKpis = dashboard.kpis.filter((k) => !k.id.startsWith(MEILING_UNLOCKED_PREFIX));

  const newWarnings = [
    `${MEILING_UNLOCKED_WARNING_PREFIX}活动周期独立：618大促复盘与双11大促为不同战役周期，看板中已独立归类，数据分别核算。`,
    `${MEILING_UNLOCKED_WARNING_PREFIX}统计粒度说明：投放执行表为双11大促全期累计进度，CID投放表为单日明细与阶段累计。`,
    `${MEILING_UNLOCKED_WARNING_PREFIX}源表异常保真：渠道汇总表中部分源表公式引用异常，按原样保留空值与说明，待业务源表修复。`,
    `${MEILING_UNLOCKED_WARNING_PREFIX}投产口径说明：618全案ROI包含达人与投流综合成本，双11 CID投放ROI仅计广告消耗，分母口径不同。`,
  ];

  const retainedWarnings = (dashboard.warnings || []).filter((w) => {
    if (w.startsWith(MEILING_UNLOCKED_WARNING_PREFIX)) return false;
    return !(
      w.includes('MMPZ') ||
      w.includes('Dkd') ||
      (w.includes('131006') && (w.includes('读取权限') || w.includes('权限缺失') || w.includes('权限受限')))
    );
  });

  return {
    ...dashboard,
    sources: updatedSources,
    kpis: [...retainedKpis, ...newKpis],
    tables: [...retainedTables, ...newTables],
    warnings: [...retainedWarnings, ...newWarnings],
  };
}
