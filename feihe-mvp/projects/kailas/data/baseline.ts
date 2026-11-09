import type {
  CampaignDashboard,
  CampaignSource,
  CampaignKpi,
  CampaignTable,
  CampaignTableColumn,
  CampaignActionItem,
  ManualCampaignTable,
} from '../../../lib/core/types';

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

export default KAILAS_MANUAL_DASHBOARD;
