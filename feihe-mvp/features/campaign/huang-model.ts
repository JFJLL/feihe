import type { CampaignDashboard, CampaignTable, CampaignDailyDataset, CampaignActions } from '../../lib/campaign-types';

export interface HuangCreatorRow {
  index: number | null;
  kol_name: string;
  account_tier: string;
  fans_w: number | null;
  kol_type: string;
  content_type: string;
  content_direction: string;
  dish_type: string;
  price_raw: number | null;
  price_with_fee: number | null;
  script_stage: string;
  draft_stage: string;
  scheduled_date: string;
  execution_status: string;
  actual_publish_date: string | null;
  source_date_text: string;
  note_id: string;
  asset_collected: boolean | null;
}

export interface HuangKosRow {
  account_name: string;
  account_tier: string;
  content_type: string;
  publish_date: string | null;
  source_date_text: string;
  note_id: string;
  fs_active: boolean | null;
  cid_active: boolean | null;
  commerce_active: boolean | null;
}

export interface HuangCreatorTierStat {
  tier: string;
  count: number;
  totalFee: number | null;
  avgFee: number | null;
  publishedCount: number;
}

export interface HuangCreatorDirectionStat {
  direction: string;
  total: number;
  published: number;
}

export interface HuangCommerceMonth {
  month: string;
  monthShort: string;
  label: string;
  spend: number | null;
  gmv: number | null;
  roi: number | null;
  orders: number;
  cart: number;
  days: number;
}

export interface HuangPublishDateComparison {
  date: string;
  creatorCount: number;
  kosCount: number;
}

export interface HuangTableWithMeta {
  id: string;
  title: string;
  period: string;
  note: string;
  rows: Record<string, unknown>[];
  totalSpend: number | null;
}

export interface HuangRegionalPrecision {
  shanghaiSpend: number | null;
  shanghaiImpressions: number | null;
  shanghaiClicks: number | null;
  shanghaiCtr: number | null;
  shanghaiCpc: number | null;
  shanghaiEngagements: number | null;
  shanghaiCpe: number | null;
  shanghaiSpendShare: number | null;
  shanghaiImprShare: number | null;

  beijingSpend: number | null;
  beijingImpressions: number | null;
  beijingClicks: number | null;
  beijingCtr: number | null;
  beijingCpc: number | null;
  beijingEngagements: number | null;
  beijingCpe: number | null;
  beijingSpendShare: number | null;
  beijingImprShare: number | null;

  combinedSpend: number | null;
  combinedImpressions: number | null;
  combinedClicks: number | null;
  combinedSpendShare: number | null;
  combinedImprShare: number | null;

  targetAudienceDenominator: null;
  truePenetration: null;
  penetrationStatusNote: string;
}

export interface HuangContentCapacityModel {
  executedCreatorCount: number;
  executedCreatorPublished: number;
  executedKosCount: number;
  totalContentSupply: number;
  assetCollectedCount: number;
  assetCollectionRate: number;
  theoreticalCapacityLimit: null;
  theoreticalCapacityNote: string;
}

export interface HuangAipsStockModel {
  awarenessImpressions: number | null;
  potentialPlays5s: number | null;
  interestSeedI: number | null;
  deepSeedTi: number | null;
  totalSeed: number | null;
  cpi: number | null;
  cpti: number | null;
  cohortTransitions: null;
  transitionsStatusNote: string;
}

export function parseNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const s = String(val).replace(/[¥￥,%\s]/g, '').trim();
  if (!s || s === '-' || s === '—' || s === '/' || s === 'null' || s === 'None' || s.startsWith('#')) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function strictSum(rows: Record<string, unknown>[], key: string): number | null {
  if (!rows || rows.length === 0) return null;
  let sum = 0;
  for (const r of rows) {
    const val = parseNum(r[key]);
    if (val === null) return null;
    sum += val;
  }
  return Math.round(sum * 100) / 100;
}

export function strictSumInt(rows: Record<string, unknown>[], key: string): number | null {
  if (!rows || rows.length === 0) return null;
  let sum = 0;
  for (const r of rows) {
    const val = parseNum(r[key]);
    if (val === null) return null;
    sum += Math.round(val);
  }
  return sum;
}

export function strictRatio(numer: number | null, denom: number | null, digits = 4): number | null {
  if (numer === null || denom === null || denom <= 0) return null;
  return Number((numer / denom).toFixed(digits));
}

export function formatNum(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return val.toLocaleString('zh-CN', { maximumFractionDigits: digits });
}

export function formatCurrency(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return '¥' + val.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatWan(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return (val / 10000).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '万';
}

export function formatPercent(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return val.toFixed(digits) + '%';
}

export interface HuangTianeParsedModel {
  brandSummary: Record<string, unknown> | null;
  brandBudget: Record<string, unknown> | null;
  brandDaily: Record<string, unknown>[];
  creators: HuangCreatorRow[];
  kosNotes: HuangKosRow[];
  cidStandard: Record<string, unknown>[];
  cidSimple: Record<string, unknown>[];
  cidTotal: Record<string, unknown>[];
  commerceSummary: Record<string, unknown> | null;
  commerceDaily: Record<string, unknown>[];

  cidTotalSpend: number | null;
  cidTotalGmv: number | null;
  cidOverallRoi: number | null;
  cidTotalOrders: number | null;
  cidTotalUv: number | null;
  cidStandardSpend: number | null;
  cidStandardGmv: number | null;
  cidStandardRoi: number | null;
  cidStandardOrders: number | null;
  cidStandardUv: number | null;
  cidSimpleSpend: number | null;
  cidSimpleGmv: number | null;
  cidSimpleRoi: number | null;
  cidSimpleOrders: number | null;
  cidSimpleUv: number | null;

  brandSpend: number | null;
  brandPeriod: string;
  brandBudgetVal: number | null;
  brandBudgetProgress: number | null;

  creatorsCount: number;
  creatorsPublished: number;
  creatorsPublishRate: number | null;
  creatorsAssetCollected: number;
  creatorsAssetRate: number;
  creatorsTotalFeeWithPlatform: number | null;
  creatorsTotalFeeRaw: number | null;

  creatorTierBreakdown: HuangCreatorTierStat[];
  creatorDirectionBreakdown: HuangCreatorDirectionStat[];
  creatorStatusBreakdown: { status: string; count: number }[];

  kosCount: number;
  kosWithDate: number;
  kosDateBreakdown: { date: string; count: number }[];
  publishDateComparison: HuangPublishDateComparison[];

  cidPeriod: string;
  cidTypeComparison: Record<string, unknown>[];

  commerceSpend: number | null;
  commerceGmv: number | null;
  commerceRoi: number | null;
  commerceOrders: number | null;
  commerceCart: number | null;
  commercePeriod: string;
  commerceMonths: HuangCommerceMonth[];

  // Advanced Tables with metadata
  brandAdTypesTable: HuangTableWithMeta;
  brandAudiencesTable: HuangTableWithMeta;
  brandKeywordsTable: HuangTableWithMeta;
  brandNoteTypesTable: HuangTableWithMeta;
  brandKolTiersTable: HuangTableWithMeta;
  brandAgeTable: HuangTableWithMeta;
  brandProvincesTable: HuangTableWithMeta;
  cidAdTypesTable: HuangTableWithMeta;
  cidAudiencesTable: HuangTableWithMeta;
  cidNoteTypesTable: HuangTableWithMeta;
  commerceCreativesTable: HuangTableWithMeta;
  commerceAudiencesTable: HuangTableWithMeta;
  industryBenchmarksTable: HuangTableWithMeta;
  brandContentTagsTable: HuangTableWithMeta;
  brandGenderTable: HuangTableWithMeta;
  brandGenderAgeTable: HuangTableWithMeta;
  creatorSelectionFunnelTable: HuangTableWithMeta;
  cidPlacementBreakdownTable: HuangTableWithMeta;
  contentAudienceMatrixTable: HuangTableWithMeta;

  brandContentTagsTop: Record<string, unknown>[];
  brandProvincesTop12: Record<string, unknown>[];
  brandKeywordsTop: Record<string, unknown>[];
  brandAudiencesTop10: Record<string, unknown>[];
  commerceCreativesTop10: Record<string, unknown>[];
  creatorFunnelStages: { name: string; value: number; rate: number | null; note?: string }[];
  genderAgeMatrix: {
    genders: string[];
    ageGroups: string[];
    cells: { gender: string; ageGroup: string; spend: number | null; engagements: number | null; cpe: number | null }[];
  };
  cidPlacementsComparison: Record<string, unknown>[];
  beijingShanghaiPrecision: HuangRegionalPrecision;
  contentCapacity: HuangContentCapacityModel;
  aipsStocks: HuangAipsStockModel;

  actions: CampaignActions | null;
}

export function extractHuangTianeData(dashboard: CampaignDashboard): HuangTianeParsedModel {
  const tables = dashboard.tables || [];
  const datasets = dashboard.dailyDatasets || [];

  const tableMap = new Map<string, CampaignTable>();
  tables.forEach((t) => tableMap.set(t.id, t));

  const datasetMap = new Map<string, CampaignDailyDataset>();
  datasets.forEach((d) => datasetMap.set(d.id, d));

  const brandSummaryRow = (tableMap.get('huang-brand-summary')?.rows || [])[0] || null;
  const brandBudgetRow = (tableMap.get('huang-brand-budget')?.rows || [])[0] || null;
  const brandDailyRows = (datasetMap.get('huang-brand-daily')?.rows || []) as Record<string, unknown>[];

  const creatorRowsRaw = tableMap.get('huang-creator-execution')?.rows || [];
  const creators: HuangCreatorRow[] = creatorRowsRaw.map((r) => ({
    index: parseNum(r.index),
    kol_name: String(r.kol_name || ''),
    account_tier: r.account_tier ? String(r.account_tier) : '未标注',
    fans_w: parseNum(r.fans_w),
    kol_type: String(r.kol_type || ''),
    content_type: String(r.content_type || ''),
    content_direction: String(r.content_direction || ''),
    dish_type: String(r.dish_type || ''),
    price_raw: parseNum(r.price_raw),
    price_with_fee: parseNum(r.price_with_fee),
    script_stage: String(r.script_stage || ''),
    draft_stage: String(r.draft_stage || ''),
    scheduled_date: String(r.scheduled_date || ''),
    execution_status: String(r.execution_status || ''),
    actual_publish_date: r.actual_publish_date ? String(r.actual_publish_date) : null,
    source_date_text: String(r.source_date_text || r.actual_publish_date || ''),
    note_id: String(r.note_id || ''),
    asset_collected: typeof r.asset_collected === 'boolean' ? r.asset_collected : (r.asset_collected === '是' ? true : r.asset_collected === '否' ? false : null),
  }));

  const kosRowsRaw = tableMap.get('huang-kos-notes')?.rows || [];
  const kosNotes: HuangKosRow[] = kosRowsRaw.map((r) => ({
    account_name: String(r.account_name || ''),
    account_tier: r.account_tier ? String(r.account_tier) : '未标注',
    content_type: r.content_type ? String(r.content_type) : '未标注',
    publish_date: r.publish_date ? String(r.publish_date) : null,
    source_date_text: String(r.source_date_text || r.publish_date || ''),
    note_id: String(r.note_id || ''),
    fs_active: typeof r.fs_active === 'boolean' ? r.fs_active : (r.fs_active === '是' ? true : r.fs_active === '否' ? false : null),
    cid_active: typeof r.cid_active === 'boolean' ? r.cid_active : (r.cid_active === '是' ? true : r.cid_active === '否' ? false : null),
    commerce_active: typeof r.commerce_active === 'boolean' ? r.commerce_active : (r.commerce_active === '是' ? true : r.commerce_active === '否' ? false : null),
  }));

  const cidStandardRows = (datasetMap.get('huang-cid-standard-daily')?.rows || []) as Record<string, unknown>[];
  const cidSimpleRows = (datasetMap.get('huang-cid-simple-daily')?.rows || []) as Record<string, unknown>[];
  const cidTotalRows = (datasetMap.get('huang-cid-total-daily')?.rows || []) as Record<string, unknown>[];

  const commerceSummaryRow = (tableMap.get('huang-commerce-summary')?.rows || [])[0] || null;
  const commerceDailyRows = (datasetMap.get('huang-commerce-daily')?.rows || []) as Record<string, unknown>[];

  // Spends
  const brandSpend = brandSummaryRow ? parseNum(brandSummaryRow.spend) : null;
  const brandBudgetVal = brandBudgetRow ? parseNum(brandBudgetRow.budget) : null;
  const brandBudgetProgress = brandBudgetRow ? parseNum(brandBudgetRow.calculatedProgress ?? brandBudgetRow.reportedProgress) : null;
  const brandDates = brandDailyRows.map((r) => String(r.date || '')).filter(Boolean).sort();
  const brandPeriod = brandDates.length > 0 ? `${brandDates[0]} ~ ${brandDates[brandDates.length - 1]}` : '2026-10-01 ~ 2026-10-19';

  // CID aggregation using strictSum
  const cidStandardSpend = strictSum(cidStandardRows, 'spend');
  const cidStandardGmv = strictSum(cidStandardRows, 'gmv');
  const cidStandardOrders = strictSumInt(cidStandardRows, 'orders');
  const cidStandardUv = strictSumInt(cidStandardRows, 'uv');
  const cidStandardRoi = strictRatio(cidStandardGmv, cidStandardSpend);

  const cidSimpleSpend = strictSum(cidSimpleRows, 'spend');
  const cidSimpleGmv = strictSum(cidSimpleRows, 'gmv');
  const cidSimpleOrders = strictSumInt(cidSimpleRows, 'orders');
  const cidSimpleUv = strictSumInt(cidSimpleRows, 'uv');
  const cidSimpleRoi = strictRatio(cidSimpleGmv, cidSimpleSpend);

  let cidTotalSpend = strictSum(cidTotalRows, 'spend');
  let cidTotalGmv = strictSum(cidTotalRows, 'gmv');
  let cidTotalOrders = strictSumInt(cidTotalRows, 'orders');
  let cidTotalUv = strictSumInt(cidTotalRows, 'uv');

  if (cidTotalSpend === null && (cidStandardSpend !== null || cidSimpleSpend !== null)) {
    cidTotalSpend = Math.round(((cidStandardSpend || 0) + (cidSimpleSpend || 0)) * 100) / 100;
    cidTotalGmv = Math.round(((cidStandardGmv || 0) + (cidSimpleGmv || 0)) * 100) / 100;
    cidTotalOrders = (cidStandardOrders || 0) + (cidSimpleOrders || 0);
    cidTotalUv = (cidStandardUv || 0) + (cidSimpleUv || 0);
  }
  const cidOverallRoi = strictRatio(cidTotalGmv, cidTotalSpend);

  const cidDates = cidTotalRows.map((r) => String(r.date || '')).filter(Boolean).sort();
  const cidPeriod = cidDates.length > 0 ? `${cidDates[0]} ~ ${cidDates[cidDates.length - 1]}` : '2026-10-01 ~ 2026-10-19';

  // Multi-metric comparative rows for CID
  const cidTypeComparison: Record<string, unknown>[] = [
    {
      type: '标准投',
      spend: cidStandardSpend,
      gmv: cidStandardGmv,
      roi: cidStandardRoi,
      orders: cidStandardOrders,
      uv: cidStandardUv,
    },
    {
      type: '简单投',
      spend: cidSimpleSpend,
      gmv: cidSimpleGmv,
      roi: cidSimpleRoi,
      orders: cidSimpleOrders,
      uv: cidSimpleUv,
    },
  ];

  // Commerce aggregation
  const commerceSpend = commerceSummaryRow
    ? parseNum(commerceSummaryRow.spend)
    : strictSum(commerceDailyRows, 'spend');
  const commerceGmv = commerceSummaryRow
    ? parseNum(commerceSummaryRow.gmv)
    : strictSum(commerceDailyRows, 'gmv');
  const commerceOrders = commerceSummaryRow
    ? strictSumInt([commerceSummaryRow], 'orders')
    : strictSumInt(commerceDailyRows, 'orders');
  const commerceCart = commerceSummaryRow
    ? strictSumInt([commerceSummaryRow], 'cart')
    : strictSumInt(commerceDailyRows, 'cart');
  const commerceRoi = strictRatio(commerceGmv, commerceSpend);

  const commerceDates = commerceDailyRows.map((r) => String(r.date || '')).filter(Boolean).sort();
  const commercePeriod = commerceDates.length > 0 ? `${commerceDates[0]} ~ ${commerceDates[commerceDates.length - 1]}` : '2026-07-27 ~ 2026-10-19';

  // Monthly commerce groups with strictly derived date boundaries
  const monthRowsMap = new Map<string, Record<string, unknown>[]>();
  commerceDailyRows.forEach((r) => {
    const dStr = String(r.date || '');
    const m = dStr.slice(0, 7);
    if (!m) return;
    const list = monthRowsMap.get(m) || [];
    list.push(r);
    monthRowsMap.set(m, list);
  });

  const commerceMonths: HuangCommerceMonth[] = Array.from(monthRowsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, rowsInMonth]) => {
      const datesInMonth = rowsInMonth.map((r) => String(r.date || '')).filter(Boolean).sort();
      const minDate = datesInMonth[0] || m;
      const maxDate = datesInMonth[datesInMonth.length - 1] || m;
      const spend = strictSum(rowsInMonth, 'spend');
      const gmv = strictSum(rowsInMonth, 'gmv');
      const roi = strictRatio(gmv, spend, 2);
      const orders = strictSumInt(rowsInMonth, 'orders') || 0;
      const cart = strictSumInt(rowsInMonth, 'cart') || 0;
      const mNum = parseInt(m.slice(5, 7), 10);
      const monthShort = Number.isFinite(mNum) ? `${mNum}月` : m;
      return {
        month: m,
        monthShort,
        label: `${m} (${minDate} ~ ${maxDate})`,
        spend,
        gmv,
        roi,
        orders,
        cart,
        days: rowsInMonth.length,
      };
    });

  // Creators metrics
  const creatorsCount = creators.length;
  const creatorsPublished = creators.filter((c) => c.execution_status === '已发布').length;
  const creatorsPublishRate = creatorsCount > 0 ? strictRatio(creatorsPublished * 100, creatorsCount, 1) : null;
  const creatorsAssetCollected = creators.filter((c) => c.asset_collected === true).length;
  const creatorsAssetRate = creatorsCount > 0 ? (creatorsAssetCollected / creatorsCount) * 100 : 0;

  // Creator Tier Breakdown with count and fee
  const tierRowsMap = new Map<string, HuangCreatorRow[]>();
  creators.forEach((c) => {
    const list = tierRowsMap.get(c.account_tier) || [];
    list.push(c);
    tierRowsMap.set(c.account_tier, list);
  });
  const creatorTierBreakdown: HuangCreatorTierStat[] = Array.from(tierRowsMap.entries()).map(([tier, list]) => {
    let totalFee: number | null = 0;
    for (const c of list) {
      const f = c.price_with_fee ?? c.price_raw;
      if (f === null) {
        totalFee = null;
        break;
      }
      totalFee += f;
    }
    const avgFee = totalFee !== null && list.length > 0 ? Math.round(totalFee / list.length) : null;
    const publishedCount = list.filter((c) => c.execution_status === '已发布').length;
    return {
      tier,
      count: list.length,
      totalFee: totalFee !== null ? Math.round(totalFee * 100) / 100 : null,
      avgFee,
      publishedCount,
    };
  });

  // Creator Direction Breakdown with total and published
  const dirRowsMap = new Map<string, { total: number; published: number }>();
  creators.forEach((c) => {
    const dir = c.dish_type || c.content_direction || c.content_type || '未注明方向';
    const cur = dirRowsMap.get(dir) || { total: 0, published: 0 };
    cur.total += 1;
    if (c.execution_status === '已发布') cur.published += 1;
    dirRowsMap.set(dir, cur);
  });
  const creatorDirectionBreakdown: HuangCreatorDirectionStat[] = Array.from(dirRowsMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([direction, stats]) => ({
      direction,
      total: stats.total,
      published: stats.published,
    }));

  // Creator Status Breakdown
  const statusMap = new Map<string, number>();
  creators.forEach((c) => {
    const s = c.execution_status || '未记录';
    statusMap.set(s, (statusMap.get(s) || 0) + 1);
  });
  const creatorStatusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  // KOS metrics & date breakdown
  const kosCount = kosNotes.length;
  const kosWithDate = kosNotes.filter((k) => Boolean(k.publish_date)).length;
  const kosDateMap = new Map<string, number>();
  kosNotes.forEach((k) => {
    const d = k.publish_date || (k.source_date_text ? k.source_date_text : '未知日期');
    kosDateMap.set(d, (kosDateMap.get(d) || 0) + 1);
  });
  const kosDateBreakdown = Array.from(kosDateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Joint creator and KOS published date distribution
  const allPublishDatesSet = new Set<string>();
  creators.forEach((c) => {
    if (c.actual_publish_date) allPublishDatesSet.add(c.actual_publish_date);
  });
  kosNotes.forEach((k) => {
    if (k.publish_date) allPublishDatesSet.add(k.publish_date);
  });
  const publishDateComparison: HuangPublishDateComparison[] = Array.from(allPublishDatesSet)
    .sort()
    .map((date) => ({
      date,
      creatorCount: creators.filter((c) => c.actual_publish_date === date).length,
      kosCount: kosNotes.filter((k) => k.publish_date === date).length,
    }));

  // Extract advanced data-driven tables with metadata
  const getTableMeta = (tid: string): HuangTableWithMeta => {
    const tbl = tableMap.get(tid);
    if (!tbl) {
      return { id: tid, title: '', period: '', note: '', rows: [], totalSpend: null };
    }
    const cleanRows = ((tbl.rows || []) as Record<string, unknown>[]).filter((r) => r && !r.isSummary);
    const totalSpend = strictSum(cleanRows, 'spend');
    return {
      id: tid,
      title: tbl.title || '',
      period: tbl.period || '',
      note: tbl.note || '',
      rows: cleanRows,
      totalSpend,
    };
  };

  const brandAdTypesTable = getTableMeta('huang-brand-ad-types');
  const brandAudiencesTable = getTableMeta('huang-brand-audiences');
  brandAudiencesTable.rows = brandAudiencesTable.rows.filter((r) => r.audience !== '#N/A');
  const brandKeywordsTable = getTableMeta('huang-brand-keywords');
  const brandNoteTypesTable = getTableMeta('huang-brand-note-types');
  brandNoteTypesTable.rows = brandNoteTypesTable.rows.map((r) => ({
    ...r,
    rawNoteFormat: r.noteFormat,
    noteFormat: (r.noteFormat === '#N/A' || String(r.noteFormat || '').startsWith('#'))
      ? '未匹配素材形式'
      : r.noteFormat,
  }));
  const brandKolTiersTable = getTableMeta('huang-brand-kol-tiers');
  const brandAgeTable = getTableMeta('huang-brand-age');
  const brandProvincesTable = getTableMeta('huang-brand-provinces');
  const cidAdTypesTable = getTableMeta('huang-cid-ad-types');
  const cidAudiencesTable = getTableMeta('huang-cid-audiences');
  const cidNoteTypesTable = getTableMeta('huang-cid-note-types');
  cidNoteTypesTable.rows = cidNoteTypesTable.rows.map((r) => ({
    ...r,
    rawNoteFormat: r.noteFormat,
    noteFormat: (r.noteFormat === '#N/A' || String(r.noteFormat || '').startsWith('#'))
      ? '未匹配素材形式'
      : r.noteFormat,
  }));
  const commerceCreativesTable = getTableMeta('huang-commerce-creatives');
  const commerceAudiencesTable = getTableMeta('huang-commerce-audiences');
  const industryBenchmarksTable = getTableMeta('huang-industry-benchmarks');
  const brandContentTagsTable = getTableMeta('huang-brand-content-tags');
  const brandGenderTable = getTableMeta('huang-brand-gender');
  const brandGenderAgeTable = getTableMeta('huang-brand-gender-age');
  const creatorSelectionFunnelTable = getTableMeta('huang-creator-selection-funnel');
  const cidPlacementBreakdownTable = getTableMeta('huang-cid-placement-breakdown');
  const contentAudienceMatrixTable = getTableMeta('huang-content-audience-matrix');

  const brandContentTagsTop = [...brandContentTagsTable.rows].sort((a, b) => (parseNum(b.spend) || 0) - (parseNum(a.spend) || 0));
  const brandProvincesTop12 = [...brandProvincesTable.rows].sort((a, b) => (parseNum(b.spend) || 0) - (parseNum(a.spend) || 0)).slice(0, 12);
  const brandKeywordsTop = [...brandKeywordsTable.rows].sort((a, b) => (parseNum(b.spend) || 0) - (parseNum(a.spend) || 0));
  const brandAudiencesTop10 = [...brandAudiencesTable.rows].sort((a, b) => (parseNum(b.spend) || 0) - (parseNum(a.spend) || 0)).slice(0, 10);
  const commerceCreativesTop10 = [...commerceCreativesTable.rows].sort((a, b) => (parseNum(b.gmv) || 0) - (parseNum(a.gmv) || 0)).slice(0, 10);

  const creatorFunnelStages = creatorSelectionFunnelTable.rows.length > 0
    ? creatorSelectionFunnelTable.rows
        .filter((r) => parseNum(r.headcount) !== null)
        .slice(0, 6)
        .map((r) => ({
          name: String(r.stage || ''),
          value: parseNum(r.headcount) || 0,
          rate: parseNum(r.retentionRate),
          note: String(r.statusNote || r.strategyTier || ''),
        }))
    : [
        { name: '① 定档计划', value: creatorsCount, rate: 100.0, note: String(creatorsCount) + '位定档达人' },
        { name: '② 成稿发布', value: creatorsPublished, rate: creatorsPublishRate, note: String(creatorsPublished) + '篇发布上线' },
      ];

  const genderSet = new Set<string>();
  const ageSet = new Set<string>();
  brandGenderAgeTable.rows.forEach((r) => {
    if (r.gender) genderSet.add(String(r.gender));
    if (r.ageGroup) ageSet.add(String(r.ageGroup));
  });
  const genders = ['女', '男'].filter((g) => genderSet.has(g));
  genderSet.forEach((g) => {
    if (g !== '女' && g !== '男' && g !== '未知' && g !== '未标注') {
      genders.push(g);
    }
  });
  if (genderSet.has('未知')) genders.push('未知');
  if (genderSet.has('未标注')) genders.push('未标注');

  const getAgeSortKey = (age: string): number => {
    const clean = age.trim();
    if (clean.includes('<18')) return 10;
    if (clean.includes('18-22')) return 20;
    if (clean.includes('23-27')) return 30;
    if (clean.includes('28-32')) return 40;
    if (clean.includes('33-40')) return 50;
    if (clean.includes('41-50')) return 60;
    if (clean.includes('>50') || clean.includes('50+')) return 70;
    if (clean.includes('未知') || clean.includes('未标注') || clean === 'null' || !clean) return 999;
    const n = parseInt(clean.replace(/\D/g, '') || '900', 10);
    return n;
  };
  const ageGroups = Array.from(ageSet).sort((a, b) => getAgeSortKey(a) - getAgeSortKey(b));
  const cells = brandGenderAgeTable.rows.map((r) => ({
    gender: String(r.gender || ''),
    ageGroup: String(r.ageGroup || ''),
    spend: parseNum(r.spend),
    engagements: parseNum(r.engagements),
    cpe: parseNum(r.cpe),
  }));
  const genderAgeMatrix = { genders, ageGroups, cells };
  // Regional precision calculation for Beijing & Shanghai
  const totalProvSpend = strictSum(brandProvincesTable.rows, 'spend');
  const totalProvImpr = strictSum(brandProvincesTable.rows, 'impressions');

  const shRow = brandProvincesTable.rows.find((r) => r.province === '上海');
  const bjRow = brandProvincesTable.rows.find((r) => r.province === '北京');

  const shanghaiSpend = parseNum(shRow?.spend);
  const shanghaiImpressions = parseNum(shRow?.impressions);
  const shanghaiClicks = parseNum(shRow?.clicks);
  const shanghaiCtr = parseNum(shRow?.ctr);
  const shanghaiCpc = parseNum(shRow?.cpc);
  const shanghaiEngagements = parseNum(shRow?.engagements);
  const shanghaiCpe = parseNum(shRow?.cpe);
  const shanghaiSpendShare = (shanghaiSpend !== null && totalProvSpend !== null && totalProvSpend > 0)
    ? Number(((shanghaiSpend / totalProvSpend) * 100).toFixed(2))
    : null;
  const shanghaiImprShare = (shanghaiImpressions !== null && totalProvImpr !== null && totalProvImpr > 0)
    ? Number(((shanghaiImpressions / totalProvImpr) * 100).toFixed(2))
    : null;

  const beijingSpend = parseNum(bjRow?.spend);
  const beijingImpressions = parseNum(bjRow?.impressions);
  const beijingClicks = parseNum(bjRow?.clicks);
  const beijingCtr = parseNum(bjRow?.ctr);
  const beijingCpc = parseNum(bjRow?.cpc);
  const beijingEngagements = parseNum(bjRow?.engagements);
  const beijingCpe = parseNum(bjRow?.cpe);
  const beijingSpendShare = (beijingSpend !== null && totalProvSpend !== null && totalProvSpend > 0)
    ? Number(((beijingSpend / totalProvSpend) * 100).toFixed(2))
    : null;
  const beijingImprShare = (beijingImpressions !== null && totalProvImpr !== null && totalProvImpr > 0)
    ? Number(((beijingImpressions / totalProvImpr) * 100).toFixed(2))
    : null;

  const combinedSpend = (shanghaiSpend !== null && beijingSpend !== null)
    ? Number(((shanghaiSpend || 0) + (beijingSpend || 0)).toFixed(2))
    : null;
  const combinedImpressions = (shanghaiImpressions !== null && beijingImpressions !== null)
    ? (shanghaiImpressions || 0) + (beijingImpressions || 0)
    : null;
  const combinedClicks = (shanghaiClicks !== null && beijingClicks !== null)
    ? (shanghaiClicks || 0) + (beijingClicks || 0)
    : null;
  const combinedSpendShare = (combinedSpend !== null && totalProvSpend !== null && totalProvSpend > 0)
    ? Number(((combinedSpend / totalProvSpend) * 100).toFixed(2))
    : null;
  const combinedImprShare = (combinedImpressions !== null && totalProvImpr !== null && totalProvImpr > 0)
    ? Number(((combinedImpressions / totalProvImpr) * 100).toFixed(2))
    : null;

  const beijingShanghaiPrecision: HuangRegionalPrecision = {
    shanghaiSpend,
    shanghaiImpressions,
    shanghaiClicks,
    shanghaiCtr,
    shanghaiCpc,
    shanghaiEngagements,
    shanghaiCpe,
    shanghaiSpendShare,
    shanghaiImprShare,

    beijingSpend,
    beijingImpressions,
    beijingClicks,
    beijingCtr,
    beijingCpc,
    beijingEngagements,
    beijingCpe,
    beijingSpendShare,
    beijingImprShare,

    combinedSpend,
    combinedImpressions,
    combinedClicks,
    combinedSpendShare,
    combinedImprShare,

    targetAudienceDenominator: null,
    truePenetration: null,
    penetrationStatusNote: '分母缺失：原报表未提供京沪城市高净值生食蛋目标客群基数，仅提供地域投放份额，不能计算目标人群包渗透率。',
  };

  const contentCapacity: HuangContentCapacityModel = {
    executedCreatorCount: creatorsCount,
    executedCreatorPublished: creatorsPublished,
    executedKosCount: kosCount,
    totalContentSupply: creatorsPublished + kosCount,
    assetCollectedCount: creatorsAssetCollected,
    assetCollectionRate: creatorsAssetRate,
    theoreticalCapacityLimit: null,
    theoreticalCapacityNote: '未测定：原报表未包含小红书蛋品垂类内容容量饱和度与搜索承载天花板，现有登记数仅反映物料供给。',
  };

  const aipsStocks: HuangAipsStockModel = {
    awarenessImpressions: null,
    potentialPlays5s: null,
    interestSeedI: parseNum(brandSummaryRow?.seed_i),
    deepSeedTi: parseNum(brandSummaryRow?.seed_ti),
    totalSeed: parseNum(brandSummaryRow?.seed_total),
    cpi: parseNum(brandSummaryRow?.cpi),
    cpti: parseNum(brandSummaryRow?.cpti),
    cohortTransitions: null,
    transitionsStatusNote: '需千帆双时点受众队列底表支持：阶段流转跃迁率须基于同批受众双时点追踪，当前数据为时点静态存量，不虚构伪流转率。',
  };

  const cidPlacementsComparison = cidPlacementBreakdownTable.rows;

  return {
    brandSummary: brandSummaryRow,
    brandBudget: brandBudgetRow,
    brandDaily: brandDailyRows,
    creators,
    kosNotes,
    cidStandard: cidStandardRows,
    cidSimple: cidSimpleRows,
    cidTotal: cidTotalRows,
    commerceSummary: commerceSummaryRow,
    commerceDaily: commerceDailyRows,

    cidTotalSpend,
    cidTotalGmv,
    cidOverallRoi,
    cidTotalOrders,
    cidTotalUv,
    cidStandardSpend,
    cidStandardGmv,
    cidStandardRoi,
    cidStandardOrders,
    cidStandardUv,
    cidSimpleSpend,
    cidSimpleGmv,
    cidSimpleRoi,
    cidSimpleOrders,
    cidSimpleUv,
    brandSpend,
    brandPeriod,
    brandBudgetVal,
    brandBudgetProgress,
    creatorsCount,
    creatorsPublished,
    creatorsPublishRate,
    creatorsAssetCollected,
    creatorsAssetRate,
    creatorsTotalFeeWithPlatform: strictSum(creators as unknown as Record<string, unknown>[], 'price_with_fee'),
    creatorsTotalFeeRaw: strictSum(creators as unknown as Record<string, unknown>[], 'price_raw'),
    creatorTierBreakdown,
    creatorDirectionBreakdown,
    creatorStatusBreakdown,
    kosCount,
    kosWithDate,
    kosDateBreakdown,
    publishDateComparison,
    cidPeriod,
    cidTypeComparison,
    commerceSpend,
    commerceGmv,
    commerceRoi,
    commerceOrders,
    commerceCart,
    commercePeriod,
    commerceMonths,

    brandAdTypesTable,
    brandAudiencesTable,
    brandKeywordsTable,
    brandNoteTypesTable,
    brandKolTiersTable,
    brandAgeTable,
    brandProvincesTable,
    cidAdTypesTable,
    cidAudiencesTable,
    cidNoteTypesTable,
    commerceCreativesTable,
    commerceAudiencesTable,
    industryBenchmarksTable,
    brandContentTagsTable,
    brandGenderTable,
    brandGenderAgeTable,
    creatorSelectionFunnelTable,
    cidPlacementBreakdownTable,
    contentAudienceMatrixTable,

    brandContentTagsTop,
    brandProvincesTop12,
    brandKeywordsTop,
    brandAudiencesTop10,
    commerceCreativesTop10,
    creatorFunnelStages,
    genderAgeMatrix,
    cidPlacementsComparison,
    beijingShanghaiPrecision,
    contentCapacity,
    aipsStocks,

    actions: dashboard.actions || null,
  };
}
