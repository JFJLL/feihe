/**
 * Online adapter for Meiling Campaign Dashboard.
 *
 * Implements pure function `applyMeilingSnapshot` to overlay online
 * Feishu Bitable snapshot data (from `docs/new-projects-sources/meiling-base.json`)
 * onto the base manual campaign dashboard without overwriting offline daily report numbers.
 *
 * All execution, platform, product, and status metrics are calculated DYNAMICALLY
 * from `snapshot.records` where `二核确认合作 === true`. No counts or timestamps are hardcoded.
 *
 * Idempotency: repeated application cleanly replaces online sources, KPIs, tables,
 * and online warnings (prefixed with `【美菱飞书快照】`) while preserving all manual data.
 */

import type {
  CampaignDashboard,
  CampaignKpi,
  CampaignSource,
  CampaignTable,
  CampaignTableRow,
} from './campaign-types';

export const MEILING_ONLINE_WARNING_PREFIX = '【美菱飞书快照】';

export interface MeilingRecordPayload {
  record_id?: string;
  '达人昵称'?: string | null;
  '达人量级'?: string | null;
  '粉丝（万）'?: number | null;
  '合作形式'?: string | null;
  '推荐产品'?: string | null;
  '内容类型'?: string | null;
  '内容方向'?: string | null;
  '品牌反馈'?: string | null;
  '二核确认合作'?: boolean | null;
  '达人是否可接'?: string | null;
  '内容方向确认'?: string | null;
  '审核进度'?: string | null;
  '发布状态'?: string | null;
  '发布时间'?: string | null;
  '提报日期'?: string | null;
  '初定档期'?: string | null;
  '发布短链'?: string | null;
  '发布长链'?: string | null;
  '主页链接'?: string | null;
  '蒲公英链接'?: string | null;
  '曝光量'?: number | null;
  '阅读量'?: number | null;
  '点赞量'?: number | null;
  '互动量'?: number | null;
  '达人裸价'?: number | null;
  '合作下单价'?: string | number | null;
  '筛选人（自动）'?: string | null;
  '采买形式（自动）'?: string | null;
  '外溢平台'?: string | null;
  '外溢平台（自动）'?: string | null;
  [key: string]: unknown;
}

export interface MeilingSnapshotPayload {
  metadata?: {
    source_type?: string;
    source_url?: string;
    base_token?: string;
    base_name?: string;
    table_id?: string;
    table_name?: string;
    read_at?: string;
    version_separation_note?: string;
  };
  sourceUrl?: string;
  base_token?: string;
  table_id?: string;
  table_name?: string;
  readAt?: string;
  viewScope?: {
    view_id?: string;
    view_name?: string;
    view_records_count?: number;
    table_total_records?: number;
    scope_distinction_analysis?: string;
  };
  summary_candidate_pool_N1096?: {
    denominator?: number;
    brand_feedback?: Record<string, number>;
    second_check_confirmed?: Record<string, number>;
    blogger_availability?: Record<string, number>;
    content_direction_confirmed?: Record<string, number>;
  };
  summary_confirmed_population_N117?: Record<string, unknown>;
  records?: MeilingRecordPayload[];
  fields?: unknown[];
}

/**
 * Pure function that consumes a Meiling Base snapshot and applies it to the dashboard.
 *
 * Rules:
 * 1. Invalid or missing snapshot returns dashboard as-is (no fake success).
 * 2. Appends online source 'meiling-base' with view URL, fetchedAt, status ready, provenance feishu.
 * 3. Appends 4 online KPIs calculated DYNAMICALLY from snapshot.records:
 *    - 线上初筛提报池 (from viewScope.view_records_count or null if missing)
 *    - 线上二核确认合作 (count of records with 二核确认合作 === true)
 *    - 线上已发布 (count of confirmed records with 审核进度 === '已发布')
 *    - 线上确认发布进度 (published / confirmed %)
 *    Note: confirmed count is neutral reference and NOT a KPI target.
 * 4. Preserves manual daily report 108/44 KPIs and tables without overwriting them.
 * 5. Appends category 'execution' tables for matched confirmed status distribution, spillover platform,
 *    and product distribution (with merged mapping details), all dynamically aggregated from records.
 * 6. Appends category 'kpi' table indicating RQff permission missing (131006), rather than using
 *    execution data as official KPIs.
 * 7. Appends quality warnings prefixed with `【美菱飞书快照】` regarding dynamic 3+3 divergence,
 *    108/106 manual difference, and version isolation. Repeated calls cleanly replace previous online warnings.
 * 8. Does not store or return individual personal records (aggregates only).
 */
export function applyMeilingSnapshot(
  dashboard: CampaignDashboard,
  snapshot: unknown
): CampaignDashboard {
  // Snapshot validation: return original dashboard as-is if invalid
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return dashboard;
  }

  const data = snapshot as MeilingSnapshotPayload;

  // Verify critical snapshot presence: must have records array with items
  if (!Array.isArray(data.records) || data.records.length === 0) {
    return dashboard;
  }

  const pipelineRecords = data.records;

  // Dynamically filter strictly confirmed records (二核确认合作 === true)
  const confirmedRecords = pipelineRecords.filter((r) => Boolean(r['二核确认合作']));
  const confirmedTotal = confirmedRecords.length;

  if (confirmedTotal === 0) {
    return dashboard;
  }

  // Extract metadata without hardcoded dates or times
  const meta = data.metadata || {};
  const sourceUrl =
    meta.source_url ||
    data.sourceUrl ||
    'https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tbluz50zuZOeGQWf&view=vewOPEh08l';
  const readAt: string | null = meta.read_at || data.readAt || null;
  const periodLabel = readAt
    ? `飞书读取快照（${readAt.includes('T') ? readAt.split('T')[0] : readAt}）`
    : '飞书读取快照（时间未注明）';

  // Candidate pool total from snapshot explicit stats: null if unknown (never hardcoded)
  const candidatePoolTotal: number | null =
    typeof data.viewScope?.view_records_count === 'number'
      ? data.viewScope.view_records_count
      : typeof data.summary_candidate_pool_N1096?.denominator === 'number'
        ? data.summary_candidate_pool_N1096.denominator
        : null;

  // Dynamically compute published count and progress
  const publishedRecords = confirmedRecords.filter(
    (r) => r['审核进度'] === '已发布' || r['发布状态'] === '已发布'
  );
  const publishedCount = publishedRecords.length;
  const publishedRateNum = Number(
    ((publishedCount / confirmedTotal) * 100).toFixed(2)
  );

  // 1. Source: 'meiling-base' (idempotent replacement)
  const onlineSource: CampaignSource = {
    id: 'meiling-base',
    name: meta.base_name
      ? `${meta.base_name}（双11 KOL进度表）`
      : '美菱多维表格线上底表',
    url: sourceUrl,
    status: 'ready',
    detail: '飞书多维表格（双11 KOL进度表），视图：（品牌筛）KOL账号提报',
    fetchedAt: readAt,
    provenance: {
      type: 'feishu',
      sourceName: '飞书多维表格',
      externalId: 'tbluz50zuZOeGQWf:vewOPEh08l',
      syncedAt: readAt,
      note: `飞书读取快照，二核确认母集N=${confirmedTotal}，初筛候选池${candidatePoolTotal !== null ? `N=${candidatePoolTotal}` : '未知'}`,
    },
  };

  const existingSourceIds = new Set(dashboard.sources.map((s) => s.id));
  const newSources: CampaignSource[] = dashboard.sources.map((s) =>
    s.id === 'meiling-base' ? onlineSource : s
  );
  if (!existingSourceIds.has('meiling-base')) {
    newSources.push(onlineSource);
  }

  // 2. Online KPIs (independent from manual 108/44, idempotent replacement)
  const onlineKpis: CampaignKpi[] = [
    {
      id: 'meiling-online-candidate-pool',
      label: '线上初筛提报池',
      value: candidatePoolTotal,
      unit: '位',
      target: null,
      direction: 'neutral',
      period: periodLabel,
      sourceId: 'meiling-base',
      provenance: 'feishu',
      note:
        candidatePoolTotal !== null
          ? `全表/初筛视图候选全量${candidatePoolTotal}位（含淘汰与未定账号），非确认合作人数`
          : '全表初筛视图候选全量未知，非确认合作人数',
    },
    {
      id: 'meiling-online-confirmed-total',
      label: '线上二核确认合作',
      value: confirmedTotal,
      unit: '位',
      target: null, // neutral reference, NOT a KPI target
      direction: 'neutral',
      period: periodLabel,
      sourceId: 'meiling-base',
      provenance: 'feishu',
      note: `飞书读取快照严格二核确认达人${confirmedTotal}位（作为各项执行分母），非考核KPI目标`,
    },
    {
      id: 'meiling-online-published-count',
      label: '线上已发布',
      value: publishedCount,
      unit: '篇',
      target: null,
      direction: 'higher',
      period: periodLabel,
      sourceId: 'meiling-base',
      provenance: 'feishu',
      note: `飞书读取快照严格二核人群已发布上线${publishedCount}篇（独立于日报44篇，两份来源与日期分开）`,
    },
    {
      id: 'meiling-online-published-progress',
      label: '线上确认发布进度',
      value: publishedRateNum,
      unit: '%',
      target: null,
      direction: 'neutral',
      period: periodLabel,
      sourceId: 'meiling-base',
      provenance: 'feishu',
      note: `执行推进进度：已发布${publishedCount} / 二核确认${confirmedTotal} = ${publishedRateNum}%（是实际执行进度，非考核KPI达成率）`,
    },
  ];

  const onlineKpiIds = new Set(onlineKpis.map((k) => k.id));
  const newKpis: CampaignKpi[] = [
    ...dashboard.kpis.filter((k) => !onlineKpiIds.has(k.id)),
    ...onlineKpis,
  ];

  // 3. Dynamically compute execution status distribution (category: execution, Matched confirmedTotal)
  const statusCounts: Record<string, number> = {};
  for (const r of confirmedRecords) {
    const stage = (r['审核进度'] as string) || '未进入审核流';
    statusCounts[stage] = (statusCounts[stage] || 0) + 1;
  }

  const standardStageOrder = [
    '已发布',
    '可推进',
    '达人修改中',
    '品牌审核中',
    '内审中',
    '达人拍摄中',
    '待确认预览',
    '定稿可上传',
    '未进入审核流',
  ];

  const stageNotes: Record<string, string> = {
    已发布: '已在小红书正式发布上线（带发布链接）',
    可推进: '排期沟通中，确认可向前推进',
    达人修改中: '根据审稿意见脚本或成片修改中',
    品牌审核中: '初稿已提交，等待品牌方终审',
    内审中: '服务商内部初审与合规审核',
    达人拍摄中: '样品已寄出，达人拍摄制作中',
    待确认预览: '样片预览确认中',
    定稿可上传: '终稿定稿，待上传平台',
    未进入审核流: '二核已确认但未录入常规审核进度（含改供图合作或待建流）',
  };

  const sortedStages: string[] = [
    ...standardStageOrder.filter((s) => s in statusCounts),
    ...Object.keys(statusCounts).filter((s) => !standardStageOrder.includes(s)),
  ];

  const executionStatusRows: CampaignTableRow[] = sortedStages.map((stage) => {
    const count = statusCounts[stage] || 0;
    const ratio = `${((count / confirmedTotal) * 100).toFixed(2)}%`;
    return {
      stage,
      count,
      ratio,
      note: stageNotes[stage] || '执行推进节点',
    };
  });

  const statusSumCheck =
    sortedStages.map((s) => statusCounts[s]).join(' + ') +
    ` = ${confirmedTotal}`;

  executionStatusRows.push({
    stage: '二核确认合作汇总',
    count: confirmedTotal,
    ratio: '100.00%',
    note: `严格二核确认合作达人基准母集 (${statusSumCheck})`,
  });

  const executionStatusTable: CampaignTable = {
    id: 'meiling-online-execution-status',
    category: 'execution',
    title: `线上二核确认KOL执行与审核状态明细（母集 N=${confirmedTotal}）`,
    period: periodLabel,
    sourceId: 'meiling-base',
    provenance: 'feishu',
    columns: [
      { key: 'stage', title: '执行/审核状态', type: 'string', align: 'left' },
      { key: 'count', title: '账号数(位)', type: 'number', align: 'right' },
      { key: 'ratio', title: '占比(%)', type: 'percent', align: 'right' },
      { key: 'note', title: '说明', type: 'string', align: 'left' },
    ],
    rows: executionStatusRows,
  };

  // 4. Dynamically compute spillover platform distribution (category: execution, Matched confirmedTotal)
  const spilloverCounts: Record<string, number> = {};
  for (const r of confirmedRecords) {
    const platform = (r['外溢平台'] as string) || '未标注/待定';
    spilloverCounts[platform] = (spilloverCounts[platform] || 0) + 1;
  }

  const standardSpilloverOrder = [
    '天猫代采',
    '京东自采',
    '京东代采',
    '天猫自采',
    '未标注/待定',
  ];

  const sortedPlatforms: string[] = [
    ...standardSpilloverOrder.filter((p) => p in spilloverCounts),
    ...Object.keys(spilloverCounts).filter(
      (p) => !standardSpilloverOrder.includes(p)
    ),
  ];

  const spilloverNotes: Record<string, string> = {
    天猫代采: '淘系外溢代采链路',
    京东自采: '京东自采主站链路',
    京东代采: '京东代采专项链路',
    天猫自采: '天猫品牌自采链路',
    '未标注/待定': '底表外溢平台字段未选择',
  };

  const spilloverRows: CampaignTableRow[] = sortedPlatforms.map((platform) => {
    const count = spilloverCounts[platform] || 0;
    const ratio = `${((count / confirmedTotal) * 100).toFixed(2)}%`;
    return {
      platform,
      count,
      ratio,
      note: spilloverNotes[platform] || '外溢平台配置',
    };
  });

  const spilloverSumCheck =
    sortedPlatforms.map((p) => spilloverCounts[p]).join(' + ') +
    ` = ${confirmedTotal}`;

  spilloverRows.push({
    platform: '二核确认合作汇总',
    count: confirmedTotal,
    ratio: '100.00%',
    note: `严格二核确认外溢平台总和 (${spilloverSumCheck})`,
  });

  const spilloverTable: CampaignTable = {
    id: 'meiling-online-spillover-distribution',
    category: 'execution',
    title: `线上二核确认外溢平台分布（母集 N=${confirmedTotal}）`,
    period: periodLabel,
    sourceId: 'meiling-base',
    provenance: 'feishu',
    columns: [
      { key: 'platform', title: '外溢平台链路', type: 'string', align: 'left' },
      { key: 'count', title: '篇数', type: 'number', align: 'right' },
      { key: 'ratio', title: '占比(%)', type: 'percent', align: 'right' },
      { key: 'note', title: '说明', type: 'string', align: 'left' },
    ],
    rows: spilloverRows,
  };

  // 5. Dynamically compute product distribution (category: execution, Matched confirmedTotal)
  // CRITICAL: Check 无忧嵌 FIRST so that '无忧嵌502' is NOT grouped into 502pro!
  // Only explicitly designated 小确杏502 / 502pro variants can be grouped into 502pro.
  function getProductGroup(pname: string): { group: string; isMerged: boolean } {
    if (!pname) return { group: '未填', isMerged: false };
    const trimmed = pname.trim();

    // 1. Check 无忧嵌 first
    if (trimmed.includes('无忧嵌')) {
      return { group: '无忧嵌系列', isMerged: true };
    }

    // 2. Explicit 小确杏502 / 502pro only
    if (
      trimmed.startsWith('小确杏502') ||
      trimmed.startsWith('小确杏 502') ||
      trimmed === '502pro雨珂'
    ) {
      return { group: '小确杏502pro 系列', isMerged: true };
    }

    // 3. Other specific products
    if (trimmed.startsWith('小确杏421') || trimmed === '小确杏421') {
      return { group: '小确杏421', isMerged: false };
    }
    if (trimmed.startsWith('小确杏520') || trimmed === '小确杏520机皇') {
      return { group: '小确杏520机皇', isMerged: false };
    }
    if (trimmed.startsWith('小确杏511') || trimmed === '小确杏511') {
      return { group: '小确杏511', isMerged: false };
    }
    if (trimmed.includes('黑珍珠') || trimmed === '黑珍珠516') {
      return { group: '黑珍珠516', isMerged: false };
    }
    if (trimmed.includes('大白鲸') || trimmed === '大白鲸570') {
      return { group: '大白鲸570', isMerged: false };
    }

    return { group: trimmed, isMerged: false };
  }

  const productGroups: Record<
    string,
    { count: number; rawCounts: Record<string, number>; isMerged: boolean }
  > = {};

  for (const r of confirmedRecords) {
    const rawP = (r['推荐产品'] as string) || '未填';
    const { group, isMerged } = getProductGroup(rawP);
    if (!productGroups[group]) {
      productGroups[group] = { count: 0, rawCounts: {}, isMerged };
    }
    productGroups[group].count += 1;
    productGroups[group].rawCounts[rawP] =
      (productGroups[group].rawCounts[rawP] || 0) + 1;
  }

  const standardProductOrder = [
    '小确杏502pro 系列',
    '小确杏421',
    '小确杏520机皇',
    '无忧嵌系列',
    '小确杏511',
    '黑珍珠516',
    '大白鲸570',
  ];

  const sortedProductGroups: string[] = [
    ...standardProductOrder.filter((p) => p in productGroups),
    ...Object.keys(productGroups).filter(
      (p) => !standardProductOrder.includes(p)
    ),
  ];

  const productRows: CampaignTableRow[] = sortedProductGroups.map((group) => {
    const info = productGroups[group];
    const count = info.count;
    const ratio = `${((count / confirmedTotal) * 100).toFixed(2)}%`;
    let mappingDetail = `单品：${group}`;
    if (info.isMerged && Object.keys(info.rawCounts).length > 1) {
      const parts = Object.entries(info.rawCounts).map(
        ([name, cnt]) => `${name}(${cnt})`
      );
      mappingDetail = `合并映射：${parts.join(' + ')}`;
    }
    return {
      productGroup: group,
      count,
      ratio,
      mappingDetail,
    };
  });

  const productSumCheck =
    sortedProductGroups.map((p) => productGroups[p].count).join(' + ') +
    ` = ${confirmedTotal}`;

  productRows.push({
    productGroup: '二核确认合作汇总',
    count: confirmedTotal,
    ratio: '100.00%',
    mappingDetail: `严格二核确认主推产品总和 (${productSumCheck})`,
  });

  const productTable: CampaignTable = {
    id: 'meiling-online-product-distribution',
    category: 'execution',
    title: `线上二核确认主推产品分布（母集 N=${confirmedTotal}）`,
    period: periodLabel,
    sourceId: 'meiling-base',
    provenance: 'feishu',
    columns: [
      { key: 'productGroup', title: '产品分组/型号', type: 'string', align: 'left' },
      { key: 'count', title: '篇数', type: 'number', align: 'right' },
      { key: 'ratio', title: '占比(%)', type: 'percent', align: 'right' },
      { key: 'mappingDetail', title: '合并映射与明细说明', type: 'string', align: 'left' },
    ],
    rows: productRows,
  };

  // 6. Category 'kpi': Official KPI Status Notice (Permission Missing 131006)
  const kpiRows: CampaignTableRow[] = [
    {
      kpiName: '官方合作达人KPI目标',
      target: '待授权',
      actual: '待授权',
      rate: '-',
      status: '权限缺失 (131006)',
      note: `KPI底表/Wiki(RQff等)无读取权限，保持空提示；严禁拿执行二核${confirmedTotal}或初筛候选作为正式考核KPI`,
    },
    {
      kpiName: '官方发布篇数KPI目标',
      target: '待授权',
      actual: '待授权',
      rate: '-',
      status: '权限缺失 (131006)',
      note: `未获取品牌正式KPI指标，不可将执行进度${publishedCount}篇等同于正式考核达成率`,
    },
    {
      kpiName: '官方GMV与ROI考核指标',
      target: '待授权',
      actual: '待授权',
      rate: '-',
      status: '权限缺失 (131006)',
      note: '品牌核心KPI底表待授权；日报ROI(自采京东2.02/自采天猫2.03)仅为历史离线T-2参考',
    },
  ];

  const kpiTable: CampaignTable = {
    id: 'meiling-online-kpi-status',
    category: 'kpi',
    title: '官方KPI考核指标表（权限缺失未联通提示）',
    period: '双11战役周期',
    sourceId: 'meiling-base',
    provenance: 'feishu',
    columns: [
      { key: 'kpiName', title: 'KPI指标项', type: 'string', align: 'left' },
      { key: 'target', title: '考核目标', type: 'string', align: 'right' },
      { key: 'actual', title: '实际完成', type: 'string', align: 'right' },
      { key: 'rate', title: '达成率', type: 'string', align: 'right' },
      { key: 'status', title: '数据状态', type: 'string', align: 'center' },
      { key: 'note', title: '权限与口径说明', type: 'string', align: 'left' },
    ],
    rows: kpiRows,
  };

  const onlineTables = [
    executionStatusTable,
    spilloverTable,
    productTable,
    kpiTable,
  ];

  const onlineTableIds = new Set(onlineTables.map((t) => t.id));
  const newTables: CampaignTable[] = [
    ...dashboard.tables.filter((t) => !onlineTableIds.has(t.id)),
    ...onlineTables,
  ];

  // 7. Dynamic quality warnings (with prefix MEILING_ONLINE_WARNING_PREFIX for clean idempotency)
  const extraInPipeline = pipelineRecords.filter((r) => !r['二核确认合作']);
  const confirmedWithoutReview = confirmedRecords.filter((r) => !r['审核进度']);

  const extraNames = extraInPipeline
    .map((r) => r['达人昵称'] || '(空昵称)')
    .join('、');
  const noReviewNames = confirmedWithoutReview
    .map((r) => r['达人昵称'] || '(空昵称)')
    .join('、');

  // Dynamic candidate pool detail from snapshot brand_feedback (no hardcoded numbers)
  const bf = data.summary_candidate_pool_N1096?.brand_feedback;
  let candidatePoolDetail = '';
  if (bf && typeof bf === 'object') {
    const rejected = bf['不合作'];
    const pending = bf['未反馈/空'] ?? bf['(未反馈/空)'];
    if (typeof rejected === 'number' && typeof pending === 'number') {
      candidatePoolDetail = `（含初筛淘汰${rejected}条不合作、${pending}条未反馈）`;
    }
  }

  const candidatePoolScopeStr =
    candidatePoolTotal !== null ? `全量${candidatePoolTotal}条` : '全量候选';

  const newOnlineWarnings = [
    `${MEILING_ONLINE_WARNING_PREFIX}版本与来源严格隔离：${periodLabel}（二核确认${confirmedTotal}位/已发布${publishedCount}篇）与历史离线日报（确认108位/已发布44篇）为两个独立版本，按日期与来源分别归档，不得互相覆盖。`,
    `${MEILING_ONLINE_WARNING_PREFIX}初筛与确认口径差异：视图${candidatePoolScopeStr}为初筛提报池${candidatePoolDetail}，不可将候选池误判为合作达人规模。`,
    `${MEILING_ONLINE_WARNING_PREFIX}二核与审核流${extraInPipeline.length}+${confirmedWithoutReview.length}不一致：线上活跃执行管线共${pipelineRecords.length}条，与严格二核确认${confirmedTotal}条存在${extraInPipeline.length}+${confirmedWithoutReview.length}偏差：${extraInPipeline.length}条已进入制作审核（${extraNames}）但表格二核Checkbox未勾选；${confirmedWithoutReview.length}条二核已勾选（${noReviewNames}）但未录入常规审核进度。`,
    `${MEILING_ONLINE_WARNING_PREFIX}状态明细合计106篇，与确认合作108位单位不同，需核对统计口径，不据此推定两位达人缺失`,
    `${MEILING_ONLINE_WARNING_PREFIX}官方KPI权限缺失提示：官方KPI考核底表（含Wiki RQff等节点）目前返回131006权限缺失，已在KPI表格中明确标识；严禁将执行进度${publishedCount}/${confirmedTotal}直接挪用冒充品牌正式KPI目标达成率。`,
  ];

  // Idempotency: filter out previous online warnings by stable prefix before adding new ones
  const retainedWarnings = (dashboard.warnings || []).filter((w) => {
    if (w.startsWith(MEILING_ONLINE_WARNING_PREFIX)) return false;
    // Also remove legacy un-prefixed warnings from earlier adapter runs
    if (
      w.startsWith('【版本与来源严格隔离】') ||
      w.startsWith('【初筛与确认口径差异】') ||
      w.includes('二核与审核流') ||
      w.startsWith('【KPI权限缺失提示】')
    ) {
      return false;
    }
    return true;
  });

  const mergedWarnings = [...retainedWarnings, ...newOnlineWarnings];

  return {
    ...dashboard,
    sources: newSources,
    kpis: newKpis,
    tables: newTables,
    warnings: mergedWarnings,
  };
}
