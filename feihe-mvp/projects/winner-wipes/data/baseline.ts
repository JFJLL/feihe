import type {
  CampaignDashboard,
  CampaignSource,
  CampaignKpi,
  CampaignTable,
  CampaignTableColumn,
  CampaignActionItem,
} from '@/lib/campaign-types';
import type { ManualCampaignTable } from '@/lib/campaign-manual';

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

export default WIPES_MANUAL_DASHBOARD;
