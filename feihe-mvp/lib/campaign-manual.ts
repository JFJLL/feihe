/**
 * Static supplementary data manually extracted from user-provided campaign daily reports.
 *
 * IMPORTANT:
 * - provenance: 'manual' (offline manual curation from user daily reports/screenshots).
 * - period: '10.16–10.18 日报（截图未注明年份）' for Kailas,
 *           '10.19 日报（原文未注明年份）' for Meiling and Winner Wipes.
 * - This file contains static snapshot numbers only and does NOT represent real-time
 *   online sync or verified Feishu connection.
 * - Do NOT sum current period values with cumulative values.
 * - T-2 cost metrics reflect attribution lag and must NOT be recalculated directly
 *   using current period spend.
 */

import type {
  CampaignActionItem,
  CampaignDashboard,
  CampaignKpi,
  CampaignProjectId,
  CampaignSource,
  CampaignTable,
  CampaignTableColumn,
} from './campaign-types';

export type CampaignTableCategory = 'budget' | 'performance' | 'execution' | 'kpi';

export interface ManualCampaignTable extends CampaignTable {
  category?: CampaignTableCategory;
}

// ============================================================================
// 1. Kailas (凯乐石)
// ============================================================================

const KAILAS_PERIOD = '10.16–10.18 日报（截图未注明年份）';

const kailasSources: CampaignSource[] = [
  {
    id: 'manual-report',
    name: '凯乐石10.16–10.18日报截图',
    status: 'manual',
    detail: '人工根据用户提供日报截图录入，截图未注明年份；非实时在线飞书同步，未实际访问飞书接口',
    fetchedAt: '2026-10-19',
    provenance: {
      type: 'manual',
      sourceName: '用户提供截图',
      note: '人工离线静态录入，非在线实时同步',
    },
  },
];

const kailasKpis: CampaignKpi[] = [
  {
    id: 'kailas-budget-total',
    label: '规划总预算',
    value: 850000,
    unit: '元',
    target: 850000,
    direction: 'neutral',
    period: KAILAS_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '规划总预算',
  },
  {
    id: 'kailas-spend-total',
    label: '累计总消耗',
    value: 906818.64,
    unit: '元',
    target: 850000,
    direction: 'lower',
    period: KAILAS_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '累计消耗已超总预算56,818.64元',
  },
  {
    id: 'kailas-budget-remaining',
    label: '预算剩余',
    value: -56818.64,
    unit: '元',
    target: 0,
    direction: 'higher',
    period: KAILAS_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '超预算执行，差额为负',
  },
  {
    id: 'kailas-budget-progress',
    label: '预算执行进度',
    value: 106.68,
    unit: '%',
    target: 100,
    direction: 'neutral',
    period: KAILAS_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '执行进度超100%',
  },
  {
    id: 'kailas-q3-search-index',
    label: 'Q3搜索指数',
    value: 140447,
    unit: '',
    target: null,
    direction: 'higher',
    period: 'Q3',
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '用户日报截图记录之Q3搜索指数',
  },
  {
    id: 'kailas-today-budget',
    label: '截图今日预算',
    value: 100,
    unit: '元',
    target: null,
    direction: 'neutral',
    period: KAILAS_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '截图当前今日预算设置',
  },
];

const kailasBudgetColumns: CampaignTableColumn[] = [
  { key: 'line', title: '预算行', type: 'string', align: 'left' },
  { key: 'planned', title: '规划预算(元)', type: 'currency', align: 'right' },
  { key: 'spend', title: '消耗金额(元)', type: 'currency', align: 'right' },
  { key: 'remaining', title: '预算剩余(元)', type: 'currency', align: 'right' },
  { key: 'progress', title: '执行进度', type: 'percent', align: 'right' },
  { key: 'note', title: '说明', type: 'string', align: 'left' },
];

const kailasPlacementColumns: CampaignTableColumn[] = [
  { key: 'placement', title: '版位', type: 'string', align: 'left' },
  { key: 'spend', title: '消耗(元)', type: 'currency', align: 'right' },
  { key: 'ctr', title: 'CTR(%)', type: 'percent', align: 'right' },
  { key: 'cpc', title: 'CPC(元)', type: 'currency', align: 'right' },
  { key: 'cpm', title: 'CPM(元)', type: 'currency', align: 'right' },
  { key: 'cpe', title: 'CPE(元)', type: 'currency', align: 'right' },
  { key: 'uv', title: 'UV', type: 'number', align: 'right' },
  { key: 'cpuv', title: 'CPUV(元)', type: 'currency', align: 'right' },
];

const kailasUgcColumns: CampaignTableColumn[] = [
  { key: 'item', title: '板块', type: 'string', align: 'left' },
  { key: 'spend', title: '消耗(元)', type: 'currency', align: 'right' },
  { key: 'ctr', title: 'CTR(%)', type: 'percent', align: 'right' },
  { key: 'cpc', title: 'CPC(元)', type: 'currency', align: 'right' },
  { key: 'cpm', title: 'CPM(元)', type: 'currency', align: 'right' },
  { key: 'cpe', title: 'CPE(元)', type: 'currency', align: 'right' },
  { key: 'uv', title: 'UV', type: 'number', align: 'right' },
  { key: 'cpuv', title: 'CPUV(元)', type: 'currency', align: 'right' },
  { key: 'note', title: '说明', type: 'string', align: 'left' },
];

const kailasTables: ManualCampaignTable[] = [
  {
    id: 'kailas-budget-lines',
    category: 'budget',
    title: '预算行规划与执行情况',
    period: KAILAS_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    columns: kailasBudgetColumns,
    rows: [
      {
        line: 'F (信息流/效果广告)',
        planned: 621000,
        spend: 713891.08,
        remaining: -92891.08,
        progress: '114.96%',
        note: '超支 -92,891.08 元，执行进度达 114.96%',
      },
      {
        line: 'S (搜索广告)',
        planned: 169000,
        spend: 150567.69,
        remaining: 18432.31,
        progress: '89.09%',
        note: '结余 18,432.31 元，执行进度 89.09%',
      },
      {
        line: 'UGC (用户内容种草)',
        planned: 60000,
        spend: 42359.87,
        remaining: 17640.13,
        progress: '70.60%',
        note: '结余 17,640.13 元，执行进度 70.60%',
      },
      {
        line: '汇总',
        planned: 850000,
        spend: 906818.64,
        remaining: -56818.64,
        progress: '106.68%',
        note: '总超支 -56,818.64 元，执行进度 106.68%',
      },
    ],
  },
  {
    id: 'kailas-fs-placements',
    category: 'performance',
    title: 'FS版位投放效果明细',
    period: KAILAS_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    columns: kailasPlacementColumns,
    rows: [
      {
        placement: '视频',
        spend: 122315.07,
        ctr: 11.81,
        cpc: 2.07,
        cpm: 244.47,
        cpe: 2.03,
        uv: 2110,
        cpuv: 54.05,
      },
      {
        placement: '搜索',
        spend: 150567.69,
        ctr: 6.92,
        cpc: 0.49,
        cpm: 33.81,
        cpe: 63.77,
        uv: 2174,
        cpuv: 36.16,
      },
      {
        placement: '信息',
        spend: 591576.01,
        ctr: 10.72,
        cpc: 0.41,
        cpm: 43.61,
        cpe: 38.68,
        uv: 6976,
        cpuv: 52.43,
      },
      {
        placement: '汇总',
        spend: 864458.77,
        ctr: 9.83,
        cpc: 0.47,
        cpm: 46.68,
        cpe: 11.09,
        uv: 11260,
        cpuv: 49.60,
      },
    ],
  },
  {
    id: 'kailas-ugc-summary',
    category: 'performance',
    title: 'UGC板块投放汇总',
    period: KAILAS_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    columns: kailasUgcColumns,
    rows: [
      {
        item: 'UGC汇总',
        spend: 42359.87,
        ctr: 11.31,
        cpc: 0.33,
        cpm: 37.13,
        cpe: 9.20,
        uv: 0,
        cpuv: null,
        note: '无UV时CPUV呈null（UV=0不可除，不可误判为零成本）',
      },
    ],
  },
];

const kailasActions: CampaignActionItem[] = [
  {
    id: 'kailas-act-1',
    title: '新笔记66全部上线',
    description: '按原日报计划完成66篇新笔记全量上线。',
    status: 'in_progress',
  },
  {
    id: 'kailas-act-2',
    title: '按CPC/CPE/CPUV优选计划',
    description: '根据CPC、CPE与CPUV综合指标优选投放计划，淘汰低效计划。',
    status: 'todo',
  },
  {
    id: 'kailas-act-3',
    title: '高跑量低CPUV笔记放量',
    description: '针对高跑量且低CPUV的优质笔记增加预算进行放量放大。',
    status: 'todo',
  },
  {
    id: 'kailas-act-4',
    title: '主力人群与核心主词精细化定向',
    description: '定向聚焦运动户外、都市机能风、品牌及竞品近30天搜1人群；主词投放聚焦越野鞋推荐、户外冲锋衣、户外运动品牌推荐。',
    status: 'todo',
  },
];

export const KAILAS_MANUAL_DASHBOARD: CampaignDashboard = {
  projectId: 'kailas',
  name: '凯乐石',
  subtitle: '预算与版位效率',
  reportPeriod: KAILAS_PERIOD,
  updatedAt: '2026-10-19',
  templateId: 'campaign_review',
  provenance: {
    type: 'manual',
    sourceName: '凯乐石日报截图',
    note: '用户提供10.16–10.18日报截图手工录入，截图未注明年份；非实时在线飞书同步，未实际访问飞书接口',
  },
  sources: kailasSources,
  kpis: kailasKpis,
  tables: kailasTables,
  actions: {
    title: '凯乐石日报规划动作',
    items: kailasActions,
  },
  warnings: [
    '日报补充部分来源于用户提供的10.16–10.18日报截图（截图未注明年份），手工录入，不随飞书更新。',
    '避免将当期版位消耗与历史累计数据直接相加，两组数据统计区间口径不同。',
    'T-2成本指标（含回传归因）具有延时性，不可直接用当期消耗除以当日转化实时重算。',
    '凯乐石累计总消耗906,818.64元已超总预算850,000.00元（超支-56,818.64元，进度106.68%），重点为F线超支-92,891.08元。',
    'UGC汇总板块UV为0，CPUV呈现为null，不可误判为零成本。',
  ],
};

// ============================================================================
// 2. Meiling (美菱)
// ============================================================================

const MEILING_PERIOD = '10.19 日报（原文未注明年份）';

const meilingSources: CampaignSource[] = [
  {
    id: 'manual-report',
    name: '美菱10.19日报',
    status: 'manual',
    detail: '人工根据用户提供10.19日报录入，原文未注明年份；非实时在线飞书同步，未实际访问飞书接口',
    fetchedAt: '2026-10-19',
    provenance: {
      type: 'manual',
      sourceName: '用户提供日报文本',
      note: '人工离线静态录入，非在线实时同步',
    },
  },
];

const meilingKpis: CampaignKpi[] = [
  {
    id: 'meiling-confirmed-total',
    label: '确认合作',
    value: 108,
    unit: '位',
    target: null,
    direction: 'neutral',
    period: MEILING_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '日报确认合作108位（观测值，非考核目标）',
  },
  {
    id: 'meiling-published-count',
    label: '已发布',
    value: 44,
    unit: '篇',
    target: null,
    direction: 'neutral',
    period: MEILING_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '日报已发布44篇；巡查44篇为同一已发布集合的复核',
  },
  {
    id: 'meiling-breakdown-sum',
    label: '状态明细合计',
    value: 106,
    unit: '篇',
    target: null,
    direction: 'neutral',
    period: MEILING_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '内容状态合计106篇，与确认合作108位需核对口径，不推定缺失两位达人',
  },
  {
    id: 'meiling-roi-jd',
    label: '自采京东 ROI',
    value: 2.02,
    unit: '',
    target: null,
    direction: 'higher',
    period: '累计截至10.18',
    sourceId: 'manual-report',
    provenance: 'manual',
    note: 'K+FS整体ROI为2.02',
  },
  {
    id: 'meiling-roi-tmall',
    label: '自采天猫 ROI',
    value: 2.03,
    unit: '',
    target: null,
    direction: 'higher',
    period: '累计截至10.18',
    sourceId: 'manual-report',
    provenance: 'manual',
    note: 'K+FS整体ROI为2.03',
  },
  {
    id: 'meiling-roi-xingban',
    label: '星伴 ROI',
    value: 0.34,
    unit: '',
    target: null,
    direction: 'higher',
    period: '累计截至10.18',
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '星伴渠道ROI为0.34',
  },
  {
    id: 'meiling-roi-jd-joint',
    label: '京东对投 ROI',
    value: 0.14,
    unit: '',
    target: null,
    direction: 'higher',
    period: '累计截至10.18',
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '京东对投ROI为0.14',
  },
];

const meilingFourLinesColumns: CampaignTableColumn[] = [
  { key: 'name', title: '任务组', type: 'string', align: 'left' },
  { key: 'kSpend', title: 'K消耗(元)', type: 'currency', align: 'right' },
  { key: 'fsSpend', title: 'FS消耗(元)', type: 'currency', align: 'right' },
  { key: 'cpc', title: 'CPC(元)', type: 'currency', align: 'right' },
  { key: 'ctr', title: 'CTR(%)', type: 'percent', align: 'right' },
  { key: 'cpuv', title: 'CPUV(T-2)(元)', type: 'currency', align: 'right' },
  { key: 'gmv', title: 'GMV任务组(元)', type: 'currency', align: 'right' },
  { key: 'kfsRoi', title: 'K+FS ROI', type: 'number', align: 'right' },
];

const meilingExecutionColumns: CampaignTableColumn[] = [
  { key: 'stage', title: '执行阶段/状态', type: 'string', align: 'left' },
  { key: 'count', title: '数量(篇)', type: 'number', align: 'right' },
  { key: 'note', title: '说明', type: 'string', align: 'left' },
];


const meilingCurrentPeriodColumns: CampaignTableColumn[] = [
  { key: 'name', title: '任务组/形式', type: 'string', align: 'left' },
  { key: 'spend', title: '消耗(元)', type: 'currency', align: 'right' },
  { key: 'cpc', title: 'CPC(元)', type: 'currency', align: 'right' },
  { key: 'cpe', title: 'CPE(元)', type: 'currency', align: 'right' },
  { key: 'ctr', title: 'CTR(%)', type: 'percent', align: 'right' },
  { key: 'uv', title: '站外UV(T-2)', type: 'number', align: 'right' },
  { key: 'cpuv', title: 'CPUV(T-2)', type: 'currency', align: 'right' },
  { key: 'gmv', title: '聚光GMV', type: 'currency', align: 'right' },
  { key: 'fsRoi', title: 'FS ROI', type: 'number', align: 'right' },
];

const meilingTables: ManualCampaignTable[] = [
  {
    id: 'meiling-four-lines',
    category: 'performance',
    title: '四线累计投放与转化表现（累计截至10.18）',
    period: '累计截至10.18',
    sourceId: 'manual-report',
    provenance: 'manual',
    columns: meilingFourLinesColumns,
    rows: [
      {
        name: '自采京东',
        kSpend: 157520,
        fsSpend: 140269.04,
        cpc: 0.85,
        ctr: 9.99,
        cpuv: 29.31,
        gmv: 601386.30,
        kfsRoi: 2.02,
      },
      {
        name: '自采天猫',
        kSpend: 153120,
        fsSpend: 121979.83,
        cpc: 0.71,
        ctr: 11.14,
        cpuv: 24.03,
        gmv: 559771.42,
        kfsRoi: 2.03,
      },
      {
        name: '星伴',
        kSpend: 164010,
        fsSpend: 28371.46,
        cpc: 3.03,
        ctr: 4.60,
        cpuv: 26.39,
        gmv: 66356.07,
        kfsRoi: 0.34,
      },
      {
        name: '京东对投',
        kSpend: 75350,
        fsSpend: 19162.04,
        cpc: 0.83,
        ctr: 9.53,
        cpuv: 76.34,
        gmv: 13587.15,
        kfsRoi: 0.14,
      },
    ],
  },
  {
    id: 'meiling-execution-status',
    category: 'execution',
    title: '内容执行状态明细',
    period: MEILING_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    columns: meilingExecutionColumns,
    rows: [
      { stage: '内审', count: 18, note: '内部初审阶段' },
      { stage: '待品牌审', count: 5, note: '等待品牌方审核' },
      { stage: '修改中', count: 8, note: '脚本或成片根据审稿意见修改中' },
      { stage: '拍摄中', count: 27, note: '达人执行拍摄制作中' },
      { stage: '定稿待发布', count: 4, note: '已定稿，等待排期上线' },
      { stage: '已发布', count: 44, note: '已在小红书上线发布' },
      { stage: '巡查', count: 44, note: '上线巡查监测（与已发布44位对应）' },
      { stage: '待核对差异', count: 2, note: '各状态明细合计106位，与确认合作总数108位存在2位差额，标注待核对' },
      { stage: '确认合作总计', count: 108, note: '日报声明确认合作达人总数' },
    ],
  },
  {
    id: 'meiling-current-period-performance',
    category: 'performance',
    title: '10.16–10.18 当期投放',
    period: '原文未注明年份',
    sourceId: 'manual-report',
    provenance: 'manual',
    columns: meilingCurrentPeriodColumns,
    rows: [
      {
        name: '自采京东种草',
        spend: 28539.17,
        cpc: 0.61,
        cpe: 119.91,
        ctr: null,
        uv: 534,
        cpuv: 53.44,
        gmv: null,
        fsRoi: null,
      },
      {
        name: '自采红京CID',
        spend: 24602.74,
        cpc: 2.16,
        cpe: null,
        ctr: 9.53,
        uv: null,
        cpuv: null,
        gmv: 168171.09,
        fsRoi: 6.84,
      },
      {
        name: '自采天猫种草',
        spend: 19975.19,
        cpc: 0.84,
        cpe: 15.08,
        ctr: null,
        uv: null,
        cpuv: null,
        gmv: null,
        fsRoi: null,
      },
      {
        name: '自采红猫CID',
        spend: 28282.21,
        cpc: 3.88,
        cpe: null,
        ctr: 8.80,
        uv: null,
        cpuv: null,
        gmv: 230508.44,
        fsRoi: 8.15,
      },
      {
        name: '星伴种草',
        spend: 26191.3,
        cpc: 2.95,
        cpe: 107.34,
        ctr: null,
        uv: null,
        cpuv: null,
        gmv: null,
        fsRoi: null,
      },
      {
        name: '代采京东种草',
        spend: 15335.61,
        cpc: 0.73,
        cpe: 34.46,
        ctr: null,
        uv: null,
        cpuv: null,
        gmv: null,
        fsRoi: null,
      },
      {
        name: '代采京东CID',
        spend: 3382.52,
        cpc: 2.51,
        cpe: null,
        ctr: 9.23,
        uv: null,
        cpuv: null,
        gmv: 8076.81,
        fsRoi: 2.39,
      },
    ],
  },
];

const meilingActions: CampaignActionItem[] = [
  {
    id: 'meiling-act-1',
    title: '高跑量笔记按CPUV暂停放大',
    description: '监控高跑量笔记成本，根据CPUV表现及时调整，暂停高成本计划并放大优质计划。',
    status: 'in_progress',
  },
  {
    id: 'meiling-act-2',
    title: '京东对投与星伴测试放量',
    description: '推进京东对投与星伴渠道的测试性放量，观察转化数据。',
    status: 'in_progress',
  },
  {
    id: 'meiling-act-3',
    title: '搜索品类/攻略词调低成本',
    description: '针对搜索端品类词与攻略词进行调价优化，进一步压缩获客成本。',
    status: 'todo',
  },
  {
    id: 'meiling-act-4',
    title: '暂停高消耗低ROI计划观察回溯',
    description: '对高消耗低ROI计划实施暂停操作，预留观察期等待转化数据回溯归因。',
    status: 'todo',
  },
  {
    id: 'meiling-act-5',
    title: '20号天猫节点19日18点后铺量',
    description: '配合20号天猫大促关键节点，于19日18点后启动集中铺量。',
    status: 'todo',
  },
];

export const MEILING_MANUAL_DASHBOARD: CampaignDashboard = {
  projectId: 'meiling',
  name: '美菱',
  subtitle: '双十一投放与内容执行',
  reportPeriod: MEILING_PERIOD,
  updatedAt: '2026-10-19',
  templateId: 'campaign_review',
  provenance: {
    type: 'manual',
    sourceName: '美菱10.19日报',
    note: '用户提供10.19日报手工录入，原文未注明年份；非实时在线飞书同步，未实际访问飞书接口',
  },
  sources: meilingSources,
  kpis: meilingKpis,
  tables: meilingTables,
  actions: {
    title: '美菱日报规划动作',
    items: meilingActions,
  },
  warnings: [
    '日报补充部分来源于用户提供的10.19日报（原文未注明年份），手工录入，不随飞书更新。',
    '避免将当期版位消耗与历史累计数据直接相加。',
    'T-2口径成本（如CPUV T-2 29.31/24.03/26.39/76.34元）为滞后归因指标，不可直接按当期消耗与单日数据重算。',
    '内容状态合计106篇，与确认合作108位需核对口径，数量相差2，不推定两位达人未归类；巡查44篇为已发布集合复核非新状态，不参与状态sum。',
  ],
};

// ============================================================================
// 3. Winner Wipes (稳健酒精湿巾 - winner-wipes)
// ============================================================================

const WIPES_PERIOD = '10.19 日报（原文未注明年份）';

const wipesSources: CampaignSource[] = [
  {
    id: 'manual-report',
    name: '稳健酒精湿巾10.19日报',
    status: 'manual',
    detail: '人工根据用户提供10.19日报录入，原文未注明年份；非实时在线飞书同步，未实际访问飞书接口',
    fetchedAt: '2026-10-19',
    provenance: {
      type: 'manual',
      sourceName: '用户提供日报文本',
      note: '人工离线静态录入，非在线实时同步',
    },
  },
];

const wipesKpis: CampaignKpi[] = [
  {
    id: 'wipes-cum-spend',
    label: '日常种草累计消耗',
    value: 165346.38,
    unit: '元',
    target: null,
    direction: 'neutral',
    period: '日常种草累计',
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '日常种草累计消耗金额',
  },
  {
    id: 'wipes-cum-progress',
    label: '日常种草进度',
    value: 52.50,
    unit: '%',
    target: 100,
    direction: 'neutral',
    period: '日常种草累计',
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '预算执行进度52.50%',
  },
  {
    id: 'wipes-cum-new-cust',
    label: '新客占比',
    value: 59.73,
    unit: '%',
    target: null,
    direction: 'higher',
    period: '日常种草累计',
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '新客占比59.73%',
  },
  {
    id: 'wipes-cum-ctr',
    label: '日常种草 CTR',
    value: 4.90,
    unit: '%',
    target: null,
    direction: 'higher',
    period: '日常种草累计',
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '累计点击率4.90%',
  },
  {
    id: 'wipes-cum-cpc',
    label: '日常种草 CPC',
    value: 1.89,
    unit: '元',
    target: null,
    direction: 'lower',
    period: '日常种草累计',
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '累计点击成本1.89元',
  },
  {
    id: 'wipes-cum-cpm',
    label: '日常种草 CPM',
    value: 92.60,
    unit: '元',
    target: null,
    direction: 'lower',
    period: '日常种草累计',
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '大盘bench: 79.98–110.19元',
  },
  {
    id: 'wipes-cum-cpe',
    label: '日常种草 CPE',
    value: 9.18,
    unit: '元',
    target: null,
    direction: 'lower',
    period: '日常种草累计',
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '大盘bench: 8.63–11.89元',
  },
  {
    id: 'wipes-cum-cpuv-t2',
    label: '日常种草 CPUV(T-2)',
    value: 7.20,
    unit: '元',
    target: null,
    direction: 'lower',
    period: '日常种草累计(T-2)',
    sourceId: 'manual-report',
    provenance: 'manual',
    note: 'T-2口径进店成本7.20元',
  },
  {
    id: 'wipes-period-budget',
    label: '当期总预算',
    value: 14200,
    unit: '元',
    target: 14200,
    direction: 'neutral',
    period: WIPES_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    note: 'F 11,500 + S 2,000 + CID 700',
  },
  {
    id: 'wipes-cid-spend',
    label: 'CID消耗',
    value: 2175.15,
    unit: '元',
    target: null,
    direction: 'neutral',
    period: WIPES_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    note: '日报记录CID消耗2,175.15元（独立于今日分日预算口径）',
  },
  {
    id: 'wipes-cid-roi',
    label: 'CID ROI',
    value: 0.01,
    unit: '',
    target: null,
    direction: 'neutral',
    period: WIPES_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    note: 'GMV 25.55元，ROI 0.01',
  },
];

const wipesCumulativeColumns: CampaignTableColumn[] = [
  { key: 'metric', title: '指标项', type: 'string', align: 'left' },
  { key: 'value', title: '实际数值', type: 'string', align: 'right' },
  { key: 'benchmark', title: '基准区间 / 规划', type: 'string', align: 'left' },
  { key: 'note', title: '分析与达标说明', type: 'string', align: 'left' },
];

const wipesPlacementColumns: CampaignTableColumn[] = [
  { key: 'name', title: '版位', type: 'string', align: 'left' },
  { key: 'spend', title: '消耗(元)', type: 'currency', align: 'right' },
  { key: 'ctr', title: 'CTR(%)', type: 'percent', align: 'right' },
  { key: 'cpc', title: 'CPC(元)', type: 'currency', align: 'right' },
  { key: 'cpm', title: 'CPM(元)', type: 'currency', align: 'right' },
  { key: 'cpe', title: 'CPE(元)', type: 'currency', align: 'right' },
  { key: 'cpuv', title: 'CPUV(元)', type: 'currency', align: 'right' },
];

const wipesCidColumns: CampaignTableColumn[] = [
  { key: 'item', title: 'CID指标项', type: 'string', align: 'left' },
  { key: 'value', title: '数值', type: 'string', align: 'right' },
  { key: 'note', title: '说明', type: 'string', align: 'left' },
];

const wipesBudgetColumns: CampaignTableColumn[] = [
  { key: 'channel', title: '渠道/项目', type: 'string', align: 'left' },
  { key: 'budget', title: '预算(元)', type: 'currency', align: 'right' },
  { key: 'note', title: '说明', type: 'string', align: 'left' },
];

const wipesTables: ManualCampaignTable[] = [
  {
    id: 'wipes-cum-performance',
    category: 'kpi',
    title: '日常种草累计表现与大盘基准',
    period: '日常种草累计',
    sourceId: 'manual-report',
    provenance: 'manual',
    columns: wipesCumulativeColumns,
    rows: [
      {
        metric: '累计消耗',
        value: '165,346.38 元',
        benchmark: '进度 52.50%',
        note: '预算执行已过半',
      },
      {
        metric: '新客占比',
        value: '59.73%',
        benchmark: '-',
        note: '拉新属性明显',
      },
      {
        metric: 'CTR (点击率)',
        value: '4.90%',
        benchmark: '-',
        note: '日报声称达标',
      },
      {
        metric: 'CPC (点击成本)',
        value: '1.89 元',
        benchmark: '-',
        note: '点击成本保持稳定',
      },
      {
        metric: 'CPM (千次展示成本)',
        value: '92.60 元',
        benchmark: '79.98 – 110.19 元',
        note: '处于大盘基准区间内',
      },
      {
        metric: 'CPE (互动成本)',
        value: '9.18 元',
        benchmark: '8.63 – 11.89 元',
        note: '处于大盘基准区间内',
      },
      {
        metric: 'CPUV (T-2进店成本)',
        value: '7.20 元',
        benchmark: '-',
        note: '日报声称达标（T-2滞后归因）',
      },
    ],
  },
  {
    id: 'wipes-current-placements',
    category: 'performance',
    title: '分版位投放效果明细',
    period: WIPES_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    columns: wipesPlacementColumns,
    rows: [
      {
        name: '搜索',
        spend: 4717.83,
        ctr: 4.05,
        cpc: 1.03,
        cpm: 41.54,
        cpe: 96.28,
        cpuv: 26.60,
      },
      {
        name: '信息',
        spend: 4054.23,
        ctr: 5.90,
        cpc: 1.59,
        cpm: 93.80,
        cpe: 23.99,
        cpuv: 22.02,
      },
      {
        name: '视频',
        spend: 27786.34,
        ctr: 8.08,
        cpc: 6.72,
        cpm: 543.02,
        cpe: 6.60,
        cpuv: 4.30,
      },
    ],
  },
  {
    id: 'wipes-cid-performance',
    category: 'performance',
    title: 'CID 引流转化明细',
    period: WIPES_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    columns: wipesCidColumns,
    rows: [
      {
        item: 'CID 消耗',
        value: '2,175.15 元',
        note: '日报记录CID消耗',
      },
      {
        item: '组件点击成本',
        value: '26.52 元',
        note: '组件点击成本26.52元',
      },
      {
        item: '产生 GMV',
        value: '25.55 元',
        note: '引流直接产生GMV 25.55元',
      },
      {
        item: 'CID ROI',
        value: '0.01',
        note: '产出比0.01，维持消耗观察淘搜变化',
      },
    ],
  },
  {
    id: 'wipes-budget-allocation',
    category: 'budget',
    title: '预算分配结构',
    period: WIPES_PERIOD,
    sourceId: 'manual-report',
    provenance: 'manual',
    columns: wipesBudgetColumns,
    rows: [
      { channel: 'F (信息流)', budget: 11500, note: '今日规划预算' },
      { channel: 'S (搜索)', budget: 2000, note: '今日规划预算' },
      { channel: 'CID', budget: 700, note: '今日规划预算' },
      { channel: '合计', budget: 14200, note: '预算合计 14,200 元 = F 11,500 + S 2,000 + CID 700' },
    ],
  },
];

const wipesActions: CampaignActionItem[] = [
  {
    id: 'wipes-act-1',
    title: '保持全棉&稳健/电商人群',
    description: '保持全棉时代与稳健医疗核心人群，以及电商高意向人群定向投放。',
    status: 'in_progress',
  },
  {
    id: 'wipes-act-2',
    title: '暂停滴露高CPUV和高消耗0转化待回溯',
    description: '暂停滴露竞品人群高CPUV计划，以及高消耗0转化的计划，等待数据回溯归因。',
    status: 'todo',
  },
  {
    id: 'wipes-act-3',
    title: '品牌词持投品类场景调优',
    description: '品牌词维持投放，持续优化品类词与细分使用场景词。',
    status: 'in_progress',
  },
  {
    id: 'wipes-act-4',
    title: 'CID维持观察UV与淘搜变化',
    description: '维持CID当前消耗节奏，密切观察UV进店与淘内搜索指数变化。',
    status: 'in_progress',
  },
];

export const WIPES_MANUAL_DASHBOARD: CampaignDashboard = {
  projectId: 'winner-wipes',
  name: '酒精湿巾',
  subtitle: '种草效果与KPI进度',
  reportPeriod: WIPES_PERIOD,
  updatedAt: '2026-10-19',
  templateId: 'campaign_review',
  provenance: {
    type: 'manual',
    sourceName: '稳健酒精湿巾10.19日报',
    note: '用户提供10.19日报手工录入，原文未注明年份；非实时在线飞书同步，未实际访问飞书接口',
  },
  sources: wipesSources,
  kpis: wipesKpis,
  tables: wipesTables,
  actions: {
    title: '酒精湿巾日报规划动作',
    items: wipesActions,
  },
  warnings: [
    '日报补充部分来源于用户提供的10.19日报（原文未注明年份），手工录入，不随飞书更新。',
    '避免将当期版位消耗（搜索4,717.83 / 信息4,054.23 / 视频27,786.34）与日常种草累计消耗（165,346.38）直接相加。',
    'T-2成本指标（如日常种草CPUV T-2 7.20元）具有统计滞后性，不可直接用当期消耗与单日数据重算。',
    '日报声称日常CPUV、淘搜、曝光、互动、爆文率及医生互动/CPE均已达标，但原始日报缺少对应具体目标数值，系统不虚构100%达成率，保留客观数值与声称记录。',
  ],
};

// ============================================================================
// Export Map
// ============================================================================

export const CAMPAIGN_MANUAL_DASHBOARDS: Partial<Record<CampaignProjectId, CampaignDashboard>> = {
  kailas: KAILAS_MANUAL_DASHBOARD,
  meiling: MEILING_MANUAL_DASHBOARD,
  'winner-wipes': WIPES_MANUAL_DASHBOARD,
};

/**
 * Helper to fetch a campaign dashboard by id, supporting 'wipes' alias.
 */
export function getCampaignManualDashboard(
  projectId: string
): CampaignDashboard | undefined {
  if (projectId === 'wipes') {
    return CAMPAIGN_MANUAL_DASHBOARDS['winner-wipes'];
  }
  return CAMPAIGN_MANUAL_DASHBOARDS[projectId as CampaignProjectId];
}
