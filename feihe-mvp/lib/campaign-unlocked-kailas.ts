/**
 * Kailas (凯乐石) Bi-weekly Meeting Unlocked Adapter.
 * Consumes dynamic rows from `access-update-new-links.json` for target `Y8...` (replaces `LT1M...`).
 */

import type {
  CampaignDashboard, CampaignKpi, CampaignSource, CampaignSourceStatus,
  CampaignTable, KpiComparison,
} from './campaign-types';

export interface UnlockedWikiTarget {
  wiki_token?: string;
  url?: string;
  readAt?: string;
  expected_replaces?: string;
  docx_content?: unknown;
  core_sub_sheets?: Array<{ sheetId: string; title: string; rows?: unknown[][] }>;
}

export interface UnlockedNewLinksPayload {
  targets?: UnlockedWikiTarget[];
}

export function parseNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = typeof val === 'number' ? (Number.isFinite(val) ? String(val) : '') : String(val).trim();
  if (!s || s === '/' || s === '-' || s.includes('#REF') || s.includes('#VALUE') || s.includes('#N/A')) return null;
  const cleaned = s.replace(/[¥￥,\s%]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractTargetFromHeader(header: unknown, defaultComp?: KpiComparison): { target: number | null; comp?: KpiComparison } {
  if (typeof header !== 'string') return { target: null, comp: defaultComp };
  const m = header.match(/目标\s*([<>]=?|≤|≥)?\s*([\d.]+)/);
  if (!m) return { target: null, comp: defaultComp };
  const op = m[1];
  let comp = defaultComp;
  if (op === '<') comp = 'lt';
  else if (op === '<=' || op === '≤') comp = 'lte';
  else if (op === '>') comp = 'gt';
  else if (op === '>=' || op === '≥') comp = 'gte';
  return { target: parseNum(m[2]), comp };
}

function extractDocxString(c: unknown): string {
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>;
    if (typeof o.content === 'string') return o.content;
    const doc = o.document as Record<string, unknown> | undefined;
    if (typeof doc?.content === 'string') return doc.content;
  }
  return '';
}

const SOURCE_LT1 = 'src-kailas-node-LT1MwikWci8LTDk0UL7coXfrnVb';
const PREFIX = 'kailas-unlocked-';

export function applyUnlockedKailas(dashboard: CampaignDashboard, newLinks: unknown): CampaignDashboard {
  if (!newLinks || typeof newLinks !== 'object') return dashboard;
  const target = ((newLinks as UnlockedNewLinksPayload).targets || []).find(
    (t) => t.wiki_token === 'Y8S1wy0YUiAtJrkY9G5ceczDnjf' || t.expected_replaces === 'LT1MwikWci8LTDk0UL7coXfrnVb'
  );
  if (!target) return dashboard;

  const sheets = target.core_sub_sheets || [];
  const [zp, jpk, xnlx] = [sheets.find((s) => s.sheetId === 'ZpT73Q'), sheets.find((s) => s.sheetId === 'JPKUX9'), sheets.find((s) => s.sheetId === 'xnlxN4')];

  // 1. Periods strictly from docx evidence without static date fallbacks
  const docx = extractDocxString(target.docx_content);
  const mQ3 = docx.match(/统计周期[：:]\s*([0-9.\-~–\sQ]+)/i) || docx.match(/数据周期为\s*([0-9.\-~–]+)/);
  const q3Period = mQ3?.[1]?.trim() || '日期待核';
  const mSeed = docx.match(/#\s*([0-9]{1,2}\.[0-9]{1,2}\s*[-~–]\s*[0-9]{1,2}\.[0-9]{1,2})/);
  const seedPeriod = mSeed?.[1]?.trim() || '日期待核';

  // 2. Sources: ready requires valid rows; reuse LT1 ID, drop LT1 unauthorized duplicates, preserve H9 0 diff
  const hasValidRows = sheets.some((s) => Array.isArray(s.rows) && s.rows.length > 1);
  const sourceStatus: CampaignSourceStatus = hasValidRows ? 'ready' : 'pending';
  const unlockedSource: CampaignSource = {
    id: SOURCE_LT1,
    name: '黑山Q3日常双周会小结资料 副本',
    url: target.url || 'https://yimeichuanbo.feishu.cn/wiki/Y8S1wy0YUiAtJrkY9G5ceczDnjf',
    status: sourceStatus,
    detail: hasValidRows ? '黑山Q3双周会小结（已解锁替换原LT1 · 核心指标/数据总览/预算）' : '黑山Q3双周会小结（已匹配节点，待提取有效数据）',
    fetchedAt: target.readAt || null,
    provenance: 'feishu',
  };

  const sources = dashboard.sources
    .filter((s) => !s.id.includes('unauthorized-LT1'))
    .map((s) => (s.id === SOURCE_LT1 ? unlockedSource : s));
  if (!sources.some((s) => s.id === SOURCE_LT1)) sources.push(unlockedSource);

  // 3. Tables: clean user titles without token codes; number columns for count metrics
  const newTables: CampaignTable[] = [];
  if (zp?.rows && zp.rows.length > 1) {
    newTables.push({
      id: PREFIX + 'budget-ZpT73Q',
      category: 'budget',
      title: '26年9月K侧核心指标概览',
      period: q3Period + ' · 含KFS返点',
      sourceId: SOURCE_LT1,
      provenance: 'feishu',
      columns: [
        { key: 'metric', title: '指标', type: 'string', align: 'left' },
        { key: 'planned', title: '规划执行(元/篇)', type: 'number', align: 'right' },
        { key: 'actual', title: '已执行(元/篇)', type: 'number', align: 'right' },
        { key: 'progress', title: '消耗进度', type: 'percent', align: 'right' },
        { key: 'status', title: '是否在正常进度', type: 'string', align: 'center' },
        { key: 'timeProgress', title: '时间进度', type: 'percent', align: 'right' },
      ],
      rows: zp.rows.slice(1).map((r) => ({
        metric: String(r[0] ?? '').trim(),
        planned: parseNum(r[1]), actual: parseNum(r[2]),
        progress: r[3] != null ? String(r[3]).trim() : null,
        status: r[4] != null ? String(r[4]).trim() : null,
        timeProgress: r[5] != null ? String(r[5]).trim() : null,
      })).filter((r) => r.metric),
    });
  }

  if (jpk?.rows && jpk.rows.length >= 6) {
    const r = jpk.rows;
    newTables.push({
      id: PREFIX + 'performance-JPKUX9',
      category: 'performance',
      title: '26年9月K侧数据总览',
      period: q3Period,
      sourceId: SOURCE_LT1,
      provenance: 'feishu',
      columns: [
        { key: 'label', title: '渠道/端', type: 'string', align: 'left' },
        { key: 'spend', title: '消耗(元)', type: 'currency', align: 'right' },
        { key: 'imp', title: '曝光量', type: 'number', align: 'right' },
        { key: 'read', title: '阅读量', type: 'number', align: 'right' },
        { key: 'inter', title: '互动量', type: 'number', align: 'right' },
        { key: 'ctr', title: 'CTR(%)', type: 'percent', align: 'right' },
        { key: 'cpc', title: 'CPC(元)', type: 'currency', align: 'right' },
        { key: 'cpe', title: 'CPE(元)', type: 'currency', align: 'right' },
        { key: 'cpm', title: 'CPM(元)', type: 'currency', align: 'right' },
        { key: 'cpti', title: 'CPTI(元)', type: 'currency', align: 'right' },
        { key: 'cpuv', title: 'CPUV(元)', type: 'currency', align: 'right' },
      ],
      rows: [
        { label: '总量 (含返点)', spend: parseNum(r[1]?.[0]), imp: parseNum(r[1]?.[1]), read: parseNum(r[1]?.[2]), inter: parseNum(r[1]?.[3]), ctr: parseNum(r[1]?.[4]), cpc: parseNum(r[1]?.[5]), cpe: parseNum(r[1]?.[6]), cpm: parseNum(r[1]?.[7]), cpti: parseNum(r[1]?.[8]), cpuv: parseNum(r[1]?.[9]) },
        { label: String(r[2]?.[0] || '内容端消耗(自然)').trim(), spend: parseNum(r[3]?.[0]), imp: parseNum(r[3]?.[1]), read: parseNum(r[3]?.[2]), inter: parseNum(r[3]?.[3]), ctr: parseNum(r[3]?.[4]), cpc: parseNum(r[3]?.[5]), cpe: parseNum(r[3]?.[6]), cpm: parseNum(r[3]?.[7]), cpti: parseNum(r[3]?.[8]), cpuv: parseNum(r[3]?.[9]) },
        { label: String(r[4]?.[0] || '投流端消耗(含返点)').replace(/\n/g, ' ').trim(), spend: parseNum(r[5]?.[0]), imp: parseNum(r[5]?.[1]), read: parseNum(r[5]?.[2]), inter: parseNum(r[5]?.[3]), ctr: parseNum(r[5]?.[4]), cpc: parseNum(r[5]?.[5]), cpe: parseNum(r[5]?.[6]), cpm: parseNum(r[5]?.[7]), cpti: parseNum(r[5]?.[8]), cpuv: parseNum(r[5]?.[9]) },
      ],
    });
  }

  if (xnlx?.rows && xnlx.rows.length > 1) {
    newTables.push({
      id: PREFIX + 'budget-xnlxN4',
      category: 'budget',
      title: '日常种草现金预算消耗进度',
      period: seedPeriod + ' 阶段小结 (业务期 7.16-今 累计截至该小结)',
      sourceId: SOURCE_LT1,
      provenance: 'feishu',
      columns: [
        { key: 'segment', title: '业务期', type: 'string', align: 'left' },
        { key: 'type', title: '类别', type: 'string', align: 'center' },
        { key: 'planned', title: '规划消耗(元)', type: 'currency', align: 'right' },
        { key: 'spend', title: '实际消费(元)', type: 'currency', align: 'right' },
        { key: 'remaining', title: '剩余金额(元)', type: 'currency', align: 'right' },
        { key: 'progress', title: '消耗进度', type: 'percent', align: 'right' },
        { key: 'timeProgress', title: '时间进度', type: 'percent', align: 'right' },
      ],
      rows: xnlx.rows.slice(1).map((r) => ({
        segment: r[0] != null && String(r[0]).trim() ? String(r[0]).trim() : '黑山日常种草',
        type: r[1] != null ? String(r[1]).trim() : '',
        planned: parseNum(r[2]), spend: parseNum(r[3]), remaining: parseNum(r[4]),
        progress: r[5] != null ? String(r[5]).trim() : null,
        timeProgress: r[6] != null ? String(r[6]).trim() : null,
      })).filter((r) => r.type || r.planned !== null || r.spend !== null),
    });
  }

  // 4. Dynamic KPIs: retains cards if target exists even when actual is missing (待数据)
  const newKpis: CampaignKpi[] = [];
  if (jpk?.rows && jpk.rows.length >= 2) {
    const [h, v] = [jpk.rows[0], jpk.rows[1]];
    const configs: Array<{ id: string; label: string; col: number; defComp: KpiComparison; dir: 'lower' | 'higher'; unit: string }> = [
      { id: 'ctr', label: 'CTR (点击率)', col: 4, defComp: 'gte', dir: 'higher', unit: '%' },
      { id: 'cpc', label: 'CPC (点击成本)', col: 5, defComp: 'lt', dir: 'lower', unit: '元' },
      { id: 'cpe', label: 'CPE (互动成本)', col: 6, defComp: 'lt', dir: 'lower', unit: '元' },
      { id: 'cpm', label: 'CPM (千次曝光成本)', col: 7, defComp: 'lt', dir: 'lower', unit: '元' },
    ];
    for (const c of configs) {
      const info = extractTargetFromHeader(h[c.col], c.defComp);
      const val = parseNum(v[c.col]);
      if (val !== null || info.target !== null) {
        newKpis.push({
          id: PREFIX + 'kpi-' + c.id, label: c.label, value: val, target: info.target,
          unit: c.unit, direction: c.dir, comparison: info.comp, sourceId: SOURCE_LT1, period: q3Period, provenance: 'feishu',
        });
      }
    }
  }

  if (zp?.rows) {
    const pubRow = zp.rows.find((r) => Array.isArray(r) && String(r[0]).includes('发布'));
    if (pubRow) {
      const [tVal, aVal] = [parseNum(pubRow[1]), parseNum(pubRow[2])];
      if (aVal !== null || tVal !== null) {
        newKpis.push({
          id: PREFIX + 'kpi-publish', label: '笔记发布量', value: aVal, target: tVal,
          unit: '篇', direction: 'higher', sourceId: SOURCE_LT1, period: q3Period, note: pubRow[3] ? '完成进度 ' + pubRow[3] : undefined, provenance: 'feishu',
        });
      }
    }
    const spendRow = zp.rows.find((r) => Array.isArray(r) && String(r[0]).includes('总消耗'));
    if (spendRow) {
      const [sT, sA] = [parseNum(spendRow[1]), parseNum(spendRow[2])];
      if (sA !== null || sT !== null) {
        newKpis.push({
          id: PREFIX + 'kpi-budget', label: '总消耗预算进度', value: sA, target: sT,
          unit: '元', direction: 'neutral', sourceId: SOURCE_LT1, period: q3Period, note: spendRow[3] ? '执行进度 ' + spendRow[3] + ' (仅作预算参考)' : undefined, provenance: 'feishu',
        });
      }
    }
  }

  // 5. Clean only LT1 related warnings; do not broadly wipe other projects
  const cleanWarnings = dashboard.warnings.filter(
    (w) =>
      !w.includes('LT1MwikWci8LTDk0UL7coXfrnVb') &&
      !w.includes('LT1') &&
      !(w.includes('凯乐石') && (w.includes('未能读取标题') || w.includes('131006')))
  );

  return {
    ...dashboard,
    sources,
    tables: [...dashboard.tables.filter((t) => !t.id.startsWith(PREFIX)), ...newTables],
    kpis: [...dashboard.kpis.filter((k) => !k.id.startsWith(PREFIX)), ...newKpis],
    warnings: cleanWarnings,
  };
}
