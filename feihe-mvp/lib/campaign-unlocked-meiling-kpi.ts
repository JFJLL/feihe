/**
 * Unlocked KPI adapter for Meiling Campaign Dashboard.
 *
 * Implements pure function `applyUnlockedMeilingKpi` to parse unlocked
 * Meiling KPI sheets from the internal maintained workbook RQffw002Aik9aNkW9PScJ05knre
 * (7-8月KPI, 618KPI, 双11进度更新). The former HNDCwmdpkiw4DgkFSNycB3cbnSc copy is no longer used.
 *
 * Dynamic parsing from rows; idempotent with prefix 'meiling-kpi-unlocked-'.
 */

import type {
  CampaignDashboard, CampaignKpi, CampaignSource,
  CampaignTable, CampaignTableRow, CampaignTableColumn, KpiDirection,
} from './campaign-types';

export const UNLOCKED_MEILING_PREFIX = 'meiling-kpi-unlocked-';
const REUSED_SOURCE_ID = 'src-meiling-node-RQffw002Aik9aNkW9PScJ05knre';

interface RawTarget {
  wiki_token?: string; url?: string; readAt?: string; batch_readAt?: string;
  node_details?: { title?: string };
  core_sub_sheets?: Array<{ sheetId: string; title: string; rows: unknown[][] }>;
}

interface ParsedMetric {
  periodKey: string; periodLabel: string; group: string; groupKey: string;
  kpiKey: string; label: string; unit: string; direction: KpiDirection;
  target: number | null; actual: number | null; rawActual: string; isExcluded: boolean; note: string;
}

interface Double11Summary {
  planFeeWan: number | null; planPosts: number | null;
  screenedPosts: number | null; publishedPosts: number | null; adSpend: number | null;
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).replace(/[¥,\s]/g, '').trim();
  if (s === '' || s === '-' || s === '/') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseVal(cell: unknown): { num: number | null; raw: string; isExcluded: boolean } {
  if (cell === null || cell === undefined) return { num: null, raw: '', isExcluded: false };
  const str = String(cell).trim();
  if (str === '') return { num: null, raw: '', isExcluded: false };
  if (str === '/' || str === '-' || str === '不考核' || str === '京东代采考核') return { num: null, raw: str, isExcluded: true };
  if (str.endsWith('%')) {
    const rawVal = str.slice(0, -1).replace(/[,\s]/g, '').trim();
    if (rawVal === '') return { num: null, raw: str, isExcluded: false };
    const n = Number(rawVal);
    return { num: Number.isFinite(n) ? n : null, raw: str, isExcluded: false };
  }
  return { num: parseNum(str), raw: str, isExcluded: false };
}

const toGroupKey = (s: string): string => s.includes('自采') ? 'self' : s.includes('京东') ? 'jd' : (s.includes('天猫') || s.includes('星伴')) ? 'tmall' : s.includes('uds') ? 'uds' : (s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'grp');

function extractDateNotes(rows: unknown[][]): string {
  return rows.flatMap((r) => {
    if (!Array.isArray(r) || !r[0]) return [];
    const s = String(r[0]).trim();
    return (s.includes('前端更新') || s.includes('投流更新')) ? [`${s.endsWith('：') || s.endsWith(':') ? s : `${s}：`}${r[1] ? String(r[1]).trim() : ''}`] : [];
  }).join('；');
}

function extractSheetMetrics(rows: unknown[][], periodKey: string, periodLabel: string): ParsedMetric[] {
  if (rows.length === 0) return [];
  const header = rows[0];
  const defs = [
    { key: 'ctr', label: 'CTR点击率', unit: '%', direction: 'higher' as KpiDirection, p: /ctr/i, tp: /≥\s*([\d.]+)/ }, { key: 'viralRate', label: '爆文率', unit: '%', direction: 'higher' as KpiDirection, p: /爆文率/i, tp: /≥\s*([\d.]+)/ },
    { key: 'cpc', label: 'CPC阅读成本', unit: '元', direction: 'lower' as KpiDirection, p: /cpc/i, tp: /≤\s*([\d.]+)/ }, { key: 'cpe', label: 'CPE互动成本', unit: '元', direction: 'lower' as KpiDirection, p: /cpe/i, tp: /≤\s*([\d.]+)/ },
    { key: 'cpuv', label: 'CPUV活跃成本', unit: '元', direction: 'lower' as KpiDirection, p: /cpuv/i, tp: /≤\s*([\d.]+)/ }, { key: 'roi', label: 'ROI产出比', unit: '', direction: 'higher' as KpiDirection, p: /roi/i, tp: /≥\s*([\d.]+)/ },
  ].map((d) => {
    let colIdx = -1, baseTarget: number | null = null, jdLteTarget: number | null = null;
    header.forEach((c, idx) => {
      if (!c || !d.p.test(String(c))) return;
      colIdx = idx;
      const m = String(c).match(d.tp); if (m) baseTarget = Number(m[1]);
      const mJd = String(c).match(/京东代采\s*≤\s*([\d.]+)/); if (mJd) jdLteTarget = Number(mJd[1]);
    });
    return { ...d, colIdx, baseTarget, jdLteTarget };
  }).filter((d) => d.colIdx >= 0);

  const metrics: ParsedMetric[] = [];
  let currentGroup = '';
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const col0 = row[0] ? String(row[0]).trim() : '';
    if (col0 && (col0.includes('更新') || col0.includes('合同') || col0.includes('KPI') || col0.includes('kpi') || col0.includes('序号'))) break;
    if (col0) currentGroup = col0;
    if (!currentGroup) continue;

    const hasAnyMetric = defs.some((d) => row[d.colIdx] !== null && row[d.colIdx] !== undefined && String(row[d.colIdx]).trim() !== '');
    if (!hasAnyMetric) continue;

    for (const d of defs) {
      const parsed = parseVal(row[d.colIdx]);
      const isJd = currentGroup.includes('京东');
      const target = isJd && d.key === 'cpuv' && d.jdLteTarget !== null ? d.jdLteTarget : d.baseTarget;
      metrics.push({
        periodKey, periodLabel, group: currentGroup, groupKey: toGroupKey(currentGroup),
        kpiKey: d.key, label: d.label, unit: d.unit, direction: d.direction,
        target, actual: parsed.isExcluded ? null : parsed.num,
        rawActual: parsed.raw || '-', isExcluded: parsed.isExcluded,
        note: `${currentGroup} ${d.label}（${periodLabel}）`,
      });
    }
  }
  return metrics;
}

function parseContractRules(rows: unknown[][]): CampaignTableRow[] {
  const rules: CampaignTableRow[] = [];
  let currentScope = '';
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const col0 = row[0] ? String(row[0]).trim() : '';
    if (col0.includes('达人服务KPI') || col0.includes('合同签署kpi') || (col0.includes('代采') && col0.includes('KPI'))) currentScope = col0;
    else if (/^\d+$/.test(col0) && row[1]) {
      rules.push({ scope: currentScope || '合同签署KPI', index: Number(col0), kpiName: String(row[1]).trim(), targetRule: row[2] ? String(row[2]).trim() : '-', status: '合同约定指标（未单独拆分实际完成）' });
    }
  }
  return rules;
}

function parseDouble11(rows: unknown[][]): { summaryRow: Double11Summary | null; tableRows: CampaignTableRow[] } {
  const tableRows: CampaignTableRow[] = [];
  let currentChannel = '', currentSeries = '', summaryRow: Double11Summary | null = null;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const col0 = row[0] ? String(row[0]).trim() : '';
    if (col0 === '京东' || col0 === '天猫') { currentChannel = col0; currentSeries = ''; continue; }
    if (col0 === '更新时间' || (row[1] === '系列' && row[2] === '型号')) continue;
    if (col0 === '合计' || row[1] === '合计') {
      const isTotal = !currentChannel;
      const fee = parseNum(row[3]), posts = parseNum(row[4]), screen = parseNum(row[5]), pub = parseNum(row[6]), spend = parseNum(row[7]);
      if (isTotal && !summaryRow) summaryRow = { planFeeWan: fee, planPosts: posts, screenedPosts: screen, publishedPosts: pub, adSpend: spend };
      tableRows.push({
        channel: isTotal ? '全渠道总计' : `${currentChannel}小计`, series: '-', model: '-',
        planFeeWan: fee, planPosts: posts, screenedPosts: screen, publishedPosts: pub,
        adSpend: spend, inStore: parseNum(row[8]), gmv: parseNum(row[9]),
      });
      continue;
    }
    if (!currentChannel) continue;
    if (row[1]) currentSeries = String(row[1]).trim();
    const model = row[2] ? String(row[2]).trim() : '';
    if (!model) continue;
    tableRows.push({
      channel: currentChannel, series: currentSeries, model,
      planFeeWan: parseNum(row[3]), planPosts: parseNum(row[4]), screenedPosts: parseNum(row[5]),
      publishedPosts: parseNum(row[6]), adSpend: parseNum(row[7]), inStore: parseNum(row[8]), gmv: parseNum(row[9]),
    });
  }
  return { summaryRow, tableRows };
}

function buildCompTable(id: string, title: string, period: string, metrics: ParsedMetric[]): CampaignTable {
  const columns: CampaignTableColumn[] = [
    { key: 'period', title: '考核周期', type: 'string' }, { key: 'group', title: '采买形式/任务组', type: 'string' },
    { key: 'kpiName', title: '考核指标', type: 'string' }, { key: 'target', title: '目标值', type: 'string', align: 'right' },
    { key: 'actual', title: '实际值', type: 'string', align: 'right' }, { key: 'status', title: '考核状态', type: 'string', align: 'center' },
    { key: 'note', title: '口径说明', type: 'string' },
  ];
  return {
    id, category: 'kpi', title, period, sourceId: REUSED_SOURCE_ID, provenance: 'feishu', columns,
    rows: metrics.map((m) => ({
      period: m.periodLabel, group: m.group, kpiName: m.label,
      target: m.target !== null ? `${m.direction === 'lower' ? '≤' : '≥'}${m.target}${m.unit}` : '-',
      actual: m.rawActual || (m.actual !== null ? `${m.actual}${m.unit}` : '-'),
      status: m.isExcluded ? (m.rawActual === '不考核' ? '不考核' : (m.rawActual.includes('考核') ? '非本组考核' : '未考核'))
        : (m.actual !== null && m.target !== null ? ((m.direction === 'lower' ? m.actual <= m.target : m.actual >= m.target) ? '达标' : '未达标') : '待录入'),
      note: m.note,
    })),
  };
}

export function applyUnlockedMeilingKpi(dashboard: CampaignDashboard, newLinks: unknown): CampaignDashboard {
  if (!newLinks || typeof newLinks !== 'object') return dashboard;
  const anyLinks = newLinks as Record<string, unknown>;
  const target = (Array.isArray(anyLinks.targets)
    ? anyLinks.targets.find((t: RawTarget) => t.wiki_token === 'RQffw002Aik9aNkW9PScJ05knre' || (t.url && t.url.includes('RQffw002Aik9aNkW9PScJ05knre')))
    : (anyLinks.wiki_token === 'RQffw002Aik9aNkW9PScJ05knre' ? anyLinks : null)) as RawTarget | null;

  if (!target || !Array.isArray(target.core_sub_sheets) || target.core_sub_sheets.length === 0) return dashboard;

  const sheets = target.core_sub_sheets;
  const l986 = sheets.find((s) => s.sheetId === 'L986LN' || s.title.includes('7-8月'));
  const fklc = sheets.find((s) => s.sheetId === 'FkLCad' || s.title.includes('618'));
  const s11 = sheets.find((s) => s.sheetId === '4SGaOf' || s.title.includes('双11'));

  const l986Notes = l986 ? extractDateNotes(l986.rows) : '';
  const fklcNotes = fklc ? extractDateNotes(fklc.rows) : '';
  const period78 = `7-8月KPI${l986Notes ? `（${l986Notes}）` : ''}`;
  const period618 = `618历史复盘${fklcNotes ? `（${fklcNotes}）` : ''}`;

  const metrics78 = l986 ? extractSheetMetrics(l986.rows, '7-8m', period78) : [];
  const metrics618 = fklc ? extractSheetMetrics(fklc.rows, '618', period618) : [];
  const allMetrics = [...metrics78, ...metrics618];

  const newKpiCards: CampaignKpi[] = allMetrics.filter((m) => !m.isExcluded).map((m) => ({
    id: `${UNLOCKED_MEILING_PREFIX}${m.periodKey}-${m.groupKey}-${m.kpiKey}`,
    label: `${m.group} ${m.label}`, value: m.actual, target: m.target, unit: m.unit, direction: m.direction,
    period: m.periodLabel, sourceId: REUSED_SOURCE_ID, provenance: 'feishu',
    note: `${m.group} ${m.label}：实际 ${m.rawActual}，目标 ${m.target !== null ? `${m.direction === 'lower' ? '≤' : '≥'}${m.target}${m.unit}` : '未设'}${m.actual === null ? '（实际值待录入）' : ''}`,
  }));

  let s11Date = '日期待核';
  if (s11 && Array.isArray(s11.rows)) {
    for (const r of s11.rows) {
      if (Array.isArray(r) && r[0]) {
        const m = String(r[0]).match(/\d{4}[./-]\d{1,2}[./-]\d{1,2}/);
        if (m) { s11Date = m[0]; break; }
      }
    }
  }
  const s11Period = s11Date !== '日期待核' ? `双11进度（截至${s11Date}）` : '双11进度（日期待核）';
  const s11Data = s11 ? parseDouble11(s11.rows) : { summaryRow: null, tableRows: [] };

  if (s11Data.summaryRow) {
    const s = s11Data.summaryRow;
    const s11Configs = [
      ['s11-plan-posts', '双11已发布篇数', s.publishedPosts, s.planPosts, '篇', `双11规划${s.planPosts ?? '-'}篇，已选达人${s.screenedPosts ?? '-'}篇，已发布${s.publishedPosts ?? '-'}篇（观测进度基准，非正式考核达成率）`],
      ['s11-screened-posts', '双11达人筛选进度', s.screenedPosts, s.planPosts, '篇', `已完成达人筛选${s.screenedPosts ?? '-'}篇/规划${s.planPosts ?? '-'}篇（执行推进观测值）`],
      ['s11-plan-fee', '双11规划总费用', s.planFeeWan, null, '万元', `双11全渠道规划总费用${s.planFeeWan ?? '-'}万元（含K+FS计划费用，非投流预算）`],
      ['s11-ad-spend', '双11投流实际消耗', s.adSpend, null, '元', `双11投流实际消耗累计${s.adSpend ?? '-'}元（独立于规划费用，非计划预算）`],
    ] as const;
    for (const [id, label, val, targetVal, unit, note] of s11Configs) {
      if (val !== null) {
        newKpiCards.push({ id: `${UNLOCKED_MEILING_PREFIX}${id}`, label, value: val, target: targetVal, unit, direction: 'neutral', period: s11Period, sourceId: REUSED_SOURCE_ID, provenance: 'feishu', note });
      }
    }
  }

  const newTables: CampaignTable[] = [];
  if (metrics78.length > 0) newTables.push(buildCompTable(`${UNLOCKED_MEILING_PREFIX}kpi-7-8m`, '美菱7-8月KPI目标与实际完成对照表', period78, metrics78));
  if (metrics618.length > 0) newTables.push(buildCompTable(`${UNLOCKED_MEILING_PREFIX}kpi-618`, '美菱618历史KPI目标与实际完成对照表', period618, metrics618));

  if (l986) {
    const contractRules = parseContractRules(l986.rows);
    if (contractRules.length > 0) {
      newTables.push({
        id: `${UNLOCKED_MEILING_PREFIX}contract-rules`, category: 'kpi',
        title: '美菱7-8月合同签署KPI考核规则表（未单独拆分实际完成）', period: period78,
        sourceId: REUSED_SOURCE_ID, provenance: 'feishu', rows: contractRules,
        columns: [
          { key: 'scope', title: '适用范围与产品品线', type: 'string' }, { key: 'index', title: '序号', type: 'number', align: 'center' }, { key: 'kpiName', title: 'KPI指标定义', type: 'string' },
          { key: 'targetRule', title: '合同计算方法与目标', type: 'string' }, { key: 'status', title: '执行状态', type: 'string' },
        ],
      });
    }
  }

  if (s11Data.tableRows.length > 0) {
    newTables.push({
      id: `${UNLOCKED_MEILING_PREFIX}double11-budget`, category: 'budget',
      title: '双11规划与执行进度明细', period: s11Period, sourceId: REUSED_SOURCE_ID, provenance: 'feishu',
      columns: [
        { key: 'channel', title: '渠道分段', type: 'string' }, { key: 'series', title: '系列', type: 'string' }, { key: 'model', title: '型号', type: 'string' },
        { key: 'planFeeWan', title: '规划费用(万元)', type: 'number', align: 'right' }, { key: 'planPosts', title: '规划篇数', type: 'number', align: 'right' }, { key: 'screenedPosts', title: '达人筛选进度', type: 'number', align: 'right' },
        { key: 'publishedPosts', title: '内容发布进度', type: 'number', align: 'right' }, { key: 'adSpend', title: '投流消耗(元)', type: 'currency', align: 'right' }, { key: 'inStore', title: '进店数', type: 'number', align: 'right' }, { key: 'gmv', title: 'GMV(元)', type: 'currency', align: 'right' },
      ],
      rows: s11Data.tableRows,
    });
  }

  const hasValidRows = sheets.some((s) => Array.isArray(s.rows) && s.rows.length > 1);
  const updatedSource: CampaignSource = {
    id: REUSED_SOURCE_ID, name: target.node_details?.title || '美菱冰箱kpi管理表',
    url: target.url || 'https://yimeichuanbo.feishu.cn/wiki/RQffw002Aik9aNkW9PScJ05knre',
    status: hasValidRows ? 'ready' : 'pending',
    detail: hasValidRows ? '内部真实源KPI管理表（含7-8月KPI、618KPI、双11进度更新）' : '内部KPI管理表已访问但无有效行数据',
    fetchedAt: target.readAt || target.batch_readAt || null,
    provenance: { type: 'feishu', sourceName: '飞书文档/表格', externalId: target.wiki_token || 'RQffw002Aik9aNkW9PScJ05knre', syncedAt: target.readAt || target.batch_readAt || null, note: '美菱冰箱KPI管理表内部真实源' },
  };

  const newSources = dashboard.sources.map((s) => (s.id === REUSED_SOURCE_ID ? updatedSource : s));
  if (!dashboard.sources.some((s) => s.id === REUSED_SOURCE_ID)) newSources.push(updatedSource);

  const newKpiIds = new Set(newKpiCards.map((k) => k.id));
  const newTableIds = new Set(newTables.map((t) => t.id));

  const cleanKpis = [...dashboard.kpis.filter((k) => !k.id.startsWith(UNLOCKED_MEILING_PREFIX) && !newKpiIds.has(k.id)), ...newKpiCards];
  const cleanTables = [...dashboard.tables.filter((t) => t.id !== 'meiling-online-kpi-status' && !t.id.startsWith(UNLOCKED_MEILING_PREFIX) && !newTableIds.has(t.id)), ...newTables];
  const cleanWarnings = (dashboard.warnings || []).filter((w) => !(w.includes('官方KPI权限缺失') && (w.includes('美菱') || w.includes('RQff') || w.includes('131006'))) && !w.startsWith('【美菱KPI解锁】'));

  const s11Info = s11Data.summaryRow
    ? `双11表目前包含规划${s11Data.summaryRow.planFeeWan !== null ? `${s11Data.summaryRow.planFeeWan}万元/` : ''}${s11Data.summaryRow.planPosts !== null ? `${s11Data.summaryRow.planPosts}篇` : ''}执行进度`
    : '双11表目前包含执行观测进度';
  cleanWarnings.push(
    `【美菱KPI解锁】官方KPI管理表（HNDC副本）已成功访问并解析7-8月与618历史考核目标；${s11Info}，正式考核KPI目标尚未在底表明确，仅作执行与观测指标。`
  );

  return { ...dashboard, sources: newSources, kpis: cleanKpis, tables: cleanTables, warnings: cleanWarnings };
}
