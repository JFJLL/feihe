import type {
  CampaignDashboard,
  CampaignKpi,
  CampaignSource,
  CampaignTable,
} from './campaign-types';

interface KpiDef {
  id: string;
  label: string;
  dim: string;
  scope: string;
  unit: string;
  dir: 'lower' | 'higher' | 'neutral';
  isTgt: boolean;
  rowIdx?: number;
  cidRow?: number;
  grp?: 'daily_seeding' | 'medical_expert' | 'cid';
  fld?: string;
}

interface WipesSnapshotInput {
  readAt?: unknown;
  url?: unknown;
  backend_fields?: {
    kpi?: Record<string, Record<string, unknown>>;
  };
  extracted_sheets?: {
    OgJUzb?: {
      rows?: string[][];
    };
  };
}

interface WipesWeeklyInput {
  readAt?: unknown;
  url?: unknown;
  content?: unknown;
}

const KPI_DEFS: KpiDef[] = [
  { id: 'wipes-online-daily-cpuv', label: '日常种草 · CPUV (FS)', dim: '日常种草', scope: 'CPUV (FS)', unit: '元', dir: 'lower', isTgt: true, rowIdx: 1, grp: 'daily_seeding', fld: 'cpuv' },
  { id: 'wipes-online-daily-tao-search', label: '日常种草 · 淘搜指数', dim: '日常种草', scope: '淘搜 (9-11月加总)', unit: '指数', dir: 'higher', isTgt: true, rowIdx: 2, grp: 'daily_seeding', fld: 'tao_search' },
  { id: 'wipes-online-daily-exposure', label: '日常种草 · 曝光量 (KFS)', dim: '日常种草', scope: '曝光量 (KFS)', unit: '次', dir: 'higher', isTgt: true, rowIdx: 3, grp: 'daily_seeding', fld: 'exposure_kfs' },
  { id: 'wipes-online-daily-cpm', label: '日常种草 · CPM (FS)', dim: '日常种草', scope: 'CPM (FS)', unit: '元', dir: 'lower', isTgt: true, rowIdx: 4, grp: 'daily_seeding', fld: 'cpm' },
  { id: 'wipes-online-daily-interaction', label: '日常种草 · 互动量 (KFS)', dim: '日常种草', scope: '互动量 (KFS)', unit: '次', dir: 'higher', isTgt: true, rowIdx: 5, grp: 'daily_seeding', fld: 'interaction_kfs' },
  { id: 'wipes-online-daily-cpe', label: '日常种草 · CPE (FS)', dim: '日常种草', scope: 'CPE (FS)', unit: '元', dir: 'lower', isTgt: true, rowIdx: 6, grp: 'daily_seeding', fld: 'cpe' },
  { id: 'wipes-online-daily-hit-rate', label: '日常种草 · 爆文率 (KFS)', dim: '日常种草', scope: '爆文率 (互动≥1000)', unit: '%', dir: 'higher', isTgt: true, rowIdx: 7, grp: 'daily_seeding', fld: 'hit_rate_interactions_ge_1000' },
  { id: 'wipes-online-doc-exposure', label: '医生专家 · 曝光量 (KFS)', dim: '医生专家', scope: '曝光量 (KFS)', unit: '次', dir: 'higher', isTgt: true, rowIdx: 8, grp: 'medical_expert', fld: 'exposure_kfs' },
  { id: 'wipes-online-doc-cpm', label: '医生专家 · CPM (FS)', dim: '医生专家', scope: 'CPM (FS)', unit: '元', dir: 'lower', isTgt: true, rowIdx: 9, grp: 'medical_expert', fld: 'cpm' },
  { id: 'wipes-online-doc-interaction', label: '医生专家 · 互动量 (KFS)', dim: '医生专家', scope: '互动量 (KFS)', unit: '次', dir: 'higher', isTgt: true, rowIdx: 10, grp: 'medical_expert', fld: 'interaction_kfs' },
  { id: 'wipes-online-doc-cpe', label: '医生专家 · CPE (FS)', dim: '医生专家', scope: 'CPE (FS)', unit: '元', dir: 'lower', isTgt: true, rowIdx: 11, grp: 'medical_expert', fld: 'cpe' },
  { id: 'wipes-online-cid-clicks', label: 'CID · 组件点击量', dim: 'CID', scope: '组件点击量', unit: '次', dir: 'neutral', isTgt: false, cidRow: 2, grp: 'cid', fld: 'component_clicks' },
  { id: 'wipes-online-cid-cost', label: 'CID · 组件点击成本', dim: 'CID', scope: '组件点击成本', unit: '元', dir: 'neutral', isTgt: false, cidRow: 3, grp: 'cid', fld: 'component_click_cost' },
];

function parseNum(val: unknown): number | null {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val !== 'string') return null;
  const s = val.replace(/[¥,%\s≤≥<>=]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const KPI_PERIOD = '飞书KPI当前快照（统计截止未注明）';
const WIPES_PREFIXES = [
  '【飞书在线底表核验】',
  '【飞书底表成本核验】',
  '【飞书底表进度核对】',
  '【周报时间周期说明】',
];

/**
 * Pure adapter function mapping online wipes snapshot and weekly reports into CampaignDashboard.
 * Extracts values dynamically without numerical fallbacks.
 */
export function applyWipesSnapshot(
  dashboard: CampaignDashboard,
  snapshot: unknown,
  weekly?: unknown
): CampaignDashboard {
  if (!snapshot || typeof snapshot !== 'object') return dashboard;

  const snap = snapshot as WipesSnapshotInput;
  const backendKpi = snap.backend_fields?.kpi;
  const sheetRows = snap.extracted_sheets?.OgJUzb?.rows;
  if (!backendKpi && (!sheetRows || sheetRows.length === 0)) return dashboard;

  // 1. Extract 13 metrics dynamically
  const items = KPI_DEFS.map((def) => {
    let targetRaw: unknown = null;
    let actualRaw: unknown = null;
    let progRaw: unknown = null;
    let hasBackendField = false;

    // Rule 1: If backend object defines this field (even as null), it is authoritative
    if (backendKpi && def.grp && def.fld) {
      const grp = backendKpi[def.grp];
      if (grp && Object.prototype.hasOwnProperty.call(grp, def.fld)) {
        hasBackendField = true;
        const v = grp[def.fld];
        if (v !== null && typeof v === 'object') {
          const vObj = v as { target?: unknown; actual?: unknown; progress?: unknown };
          targetRaw = vObj.target ?? null;
          actualRaw = vObj.actual ?? null;
          progRaw = vObj.progress ?? null;
        } else {
          actualRaw = v ?? null;
        }
      }
    }

    // Only fallback to rows if backend entry does NOT exist
    if (!hasBackendField && sheetRows) {
      if (def.isTgt && def.rowIdx !== undefined && sheetRows[def.rowIdx]) {
        const r = sheetRows[def.rowIdx];
        targetRaw = r[3] ?? null;
        actualRaw = r[4] ?? null;
        progRaw = r[5] ?? null;
      } else if (!def.isTgt && def.cidRow !== undefined && sheetRows[def.cidRow]) {
        actualRaw = sheetRows[def.cidRow][8] ?? null;
      }
    }

    const actualNum = parseNum(actualRaw);
    const targetNum = parseNum(targetRaw);
    const tgtStr = targetRaw !== null && targetRaw !== undefined ? String(targetRaw).trim() : null;
    const sourceProgress = progRaw ? String(progRaw).trim() : '-';

    let status = '未知';
    if (targetNum !== null && actualNum !== null) {
      status = def.dir === 'lower' ? (actualNum <= targetNum ? '达成' : '未达成') : (actualNum >= targetNum ? '达成' : '未达成');
    }

    let warning = '';
    if (def.isTgt) {
      // Rule 1: If target or actual is missing, warning MUST be '缺少目标或实际值', never '指标达标'
      if (targetNum === null || actualNum === null) {
        warning = '缺少目标或实际值';
      } else if (actualNum > 0 && targetNum > 0 && sourceProgress !== '-') {
        const parsedProg = parseNum(sourceProgress);
        if (parsedProg !== null) {
          const calc = def.dir === 'lower' ? (targetNum / actualNum) * 100 : (actualNum / targetNum) * 100;
          if (Math.abs(calc - parsedProg) > 1.0) {
            // Rule 2: higher is actual/target, lower is target/actual
            const formula = def.dir === 'lower'
              ? `(${targetNum}/${actualNum}=${calc.toFixed(2)}%)`
              : `(${actualNum}/${targetNum}=${calc.toFixed(2)}%)`;
            warning = `源进度${sourceProgress}与算术${formula}不符`;
          }
        }
      }
      if (!warning) {
        warning = status === '未达成' ? (def.dir === 'lower' ? '成本偏高未达标' : '进度滞后未达标') : (def.dir === 'lower' ? '成本优于目标' : '指标达标');
      }
    }

    return { def, actualNum, targetNum, tgtStr, sourceProgress, status, warning };
  });

  // If no actual values exist across all definitions, return unchanged
  if (!items.some((i) => i.actualNum !== null)) return dashboard;

  const readAt = typeof snap.readAt === 'string' && snap.readAt.trim() ? snap.readAt.trim() : null;

  // Rule 5: Ensure sheet=OgJUzb query param via URL searchParams
  let kpiSheetUrl = 'https://feishu.cn/sheets/Ero1shDTFhVzwttqDMLceZQ4nMb?sheet=OgJUzb';
  try {
    const rawUrl = typeof snap.url === 'string' && snap.url.trim() ? snap.url.trim() : 'https://feishu.cn/sheets/Ero1shDTFhVzwttqDMLceZQ4nMb';
    const u = new URL(rawUrl);
    u.searchParams.set('sheet', 'OgJUzb');
    kpiSheetUrl = u.toString();
  } catch {
    kpiSheetUrl = 'https://feishu.cn/sheets/Ero1shDTFhVzwttqDMLceZQ4nMb?sheet=OgJUzb';
  }

  const kpiSource: CampaignSource = {
    id: 'wipes-kpi-sheet',
    name: '飞书在线KPI底表 (OgJUzb)',
    url: kpiSheetUrl,
    status: 'ready',
    detail: '飞书表格KPI子表真实数据映射，覆盖日常种草、医生专家及CID监控',
    fetchedAt: readAt,
    provenance: 'feishu',
  };

  // 2. Build CampaignKpi[] (11 targets + 2 CID)
  const onlineKpis: CampaignKpi[] = items.map(({ def, actualNum, targetNum, tgtStr, sourceProgress, warning }) => {
    const note = def.isTgt
      ? actualNum !== null && targetNum !== null ? `目标${tgtStr}，现阶段${actualNum}，源显示进度${sourceProgress}${warning ? `（${warning}）` : ''}` : '源数据缺失'
      : actualNum !== null ? `CID${def.scope}监控值` : '源数据缺失';
    return {
      id: def.id,
      label: def.label,
      value: actualNum,
      unit: def.unit,
      target: targetNum,
      direction: def.dir,
      period: KPI_PERIOD,
      sourceId: 'wipes-kpi-sheet',
      provenance: 'feishu',
      note,
    };
  });

  const onlineKpiIdSet = new Set(onlineKpis.map((k) => k.id));
  const updatedKpis = [...onlineKpis, ...dashboard.kpis.filter((k) => !onlineKpiIdSet.has(k.id))];

  // 3. Comparison table for 11 targets generated from the exact same extracted items
  const comparisonRows = items
    .filter((i) => i.def.isTgt)
    .map((i) => ({
      dimension: i.def.dim,
      scope: i.def.scope,
      target: i.tgtStr ? (i.tgtStr.endsWith(i.def.unit) ? i.tgtStr : `${i.tgtStr}${i.def.unit}`) : '-',
      actual: i.actualNum !== null ? `${i.actualNum}${i.def.unit}` : '-',
      sourceProgress: i.sourceProgress,
      status: i.status,
      direction: i.def.dir,
      warning: i.warning,
    }));

  const kpiComparisonTable: CampaignTable = {
    id: 'wipes-kpi-comparison-table',
    title: '飞书底表KPI目标与实际对照表 (OgJUzb)',
    category: 'kpi',
    period: KPI_PERIOD,
    sourceId: 'wipes-kpi-sheet',
    provenance: 'feishu',
    columns: [
      { key: 'dimension', title: '指标维度', type: 'string' },
      { key: 'scope', title: '统计口径', type: 'string' },
      { key: 'target', title: '目标值 (KPI)', type: 'string' },
      { key: 'actual', title: '现阶段实际值', type: 'string' },
      { key: 'sourceProgress', title: '源表显示进度', type: 'string' },
      { key: 'status', title: '达成判定', type: 'badge' },
      { key: 'direction', title: '优化方向', type: 'string' },
      { key: 'warning', title: '核对提示与备注', type: 'string' },
    ],
    rows: comparisonRows,
  };

  // 4. Weekly Report Execution table (only if weekly.content is non-empty and numbers are extracted)
  // Rule 3: Dynamic period extraction from '# 时间周期：...' and cutoff sentences
  let weeklySource: CampaignSource | undefined;
  let executionTable: CampaignTable | undefined;
  let execPeriod = '周报统计期未注明';

  if (weekly && typeof weekly === 'object') {
    const w = weekly as WipesWeeklyInput;
    const content = typeof w.content === 'string' ? w.content.trim() : '';
    if (content) {
      const periodMatch = content.match(/#\s*时间周期[：:]\s*([^\n\r]+)/);
      const cutoffMatch = content.match(/(?:截止|截至)[^\n，,。\r]*?(?:发布完毕|已发布完毕)/);
      const pStr = periodMatch ? periodMatch[1].trim() : '';
      const cStr = cutoffMatch ? cutoffMatch[0].trim() : '';
      if (pStr && cStr) {
        execPeriod = `${pStr}（${cStr}）`;
      } else if (pStr) {
        execPeriod = pStr;
      } else if (cStr) {
        execPeriod = cStr;
      }

      const totalMatch = content.match(/所有笔记[（(](\d+)\s*篇[）)]/i) ?? content.match(/(?:总计|全部笔记)[^\d]{0,10}(\d+)\s*篇/i);
      const kolMatch = content.match(/KOL[^\d]{0,10}(\d+)\s*篇/i);
      const kocMatch = content.match(/KOC[^\d]{0,10}(\d+)\s*篇/i);

      if (totalMatch && kolMatch && kocMatch) {
        const weeklyReadAt = typeof w.readAt === 'string' && w.readAt.trim() ? w.readAt.trim() : null;
        weeklySource = {
          id: 'wipes-weekly-doc',
          name: '飞书在线周报 (稳健玉米酒精湿巾Y26 9-11月)',
          url: typeof w.url === 'string' && w.url.trim() ? w.url.trim() : 'https://feishu.cn/docx/LtZ5dlPvnoiA8OxsvAUcV2lAnWb',
          status: 'ready',
          detail: '飞书云文档周期复盘，从正文提取全量笔记已发布数量',
          fetchedAt: weeklyReadAt,
          provenance: 'feishu',
        };

        executionTable = {
          id: 'wipes-execution-progress-table',
          title: '周报已发布数量统计',
          category: 'execution',
          period: execPeriod,
          sourceId: 'wipes-weekly-doc',
          provenance: 'feishu',
          columns: [
            { key: 'metric', title: '发布统计项', type: 'string' },
            { key: 'publishedCount', title: '周报已发布数', type: 'string' },
            { key: 'note', title: '来源说明', type: 'string' },
          ],
          rows: [
            { metric: '全量笔记已发布数', publishedCount: `${totalMatch[1]}篇`, note: '周报正文文本提取已发布数量（不假定计划目标）' },
            { metric: 'KOL已发布数', publishedCount: `${kolMatch[1]}篇`, note: '周报正文文本提取已发布数量' },
            { metric: 'KOC已发布数', publishedCount: `${kocMatch[1]}篇`, note: '周报正文文本提取已发布数量' },
          ],
        };
      }
    }
  }

  // 5. Assemble Sources, Tables and Dynamic Warnings
  const existingSources = dashboard.sources.filter((s) => s.id !== 'wipes-kpi-sheet' && s.id !== 'wipes-weekly-doc');
  const updatedSources = [...existingSources, kpiSource, ...(weeklySource ? [weeklySource] : [])];

  const existingTables = dashboard.tables.filter((t) => t.id !== 'wipes-kpi-comparison-table' && t.id !== 'wipes-execution-progress-table');
  const updatedTables = [kpiComparisonTable, ...(executionTable ? [executionTable] : []), ...existingTables];

  // Rule 4: Dynamic cost warning based on items status
  const unreachedCostItems = items
    .filter((i) => i.def.dir === 'lower' && i.status === '未达成')
    .map((i) => `${i.def.scope}（实际${i.actualNum ?? '-'} / 目标${i.targetNum ?? '-'}）`);

  const costWarning = unreachedCostItems.length > 0
    ? `【飞书底表成本核验】以下成本类指标未达标：${unreachedCostItems.join('、')}。日报声称达标仅反映部分指标。`
    : '【飞书在线底表核验】飞书底表KPI快照未标注统计截止时间，与10.19日报周期不同。';

  const dynamicDiscrepancies = comparisonRows
    .filter((r) => r.warning && r.warning.includes('不符'))
    .map((r) => `【飞书底表进度核对】${r.dimension} ${r.scope}：${r.warning}`);

  // Rule 4: Clear all old wipes warnings first
  const cleanedWarnings = dashboard.warnings.filter(
    (w) => !WIPES_PREFIXES.some((prefix) => w.startsWith(prefix))
  );

  const newWarnings = [
    costWarning,
    ...dynamicDiscrepancies,
  ];
  if (weeklySource) {
    newWarnings.push(`【周报时间周期说明】周报正文统计周期为${execPeriod}，与10.19日报静态数据分属不同时期。`);
  }

  return {
    ...dashboard,
    sources: updatedSources,
    kpis: updatedKpis,
    tables: updatedTables,
    warnings: [...cleanedWarnings, ...newWarnings],
  };
}
