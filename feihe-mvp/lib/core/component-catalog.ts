/**
 * Component Catalog with AI Selection Guide
 * Inspired by Tencent Beacon (灯塔) Component Library (data/cl-components.json)
 *
 * Defines all official dashboard components, their schema, display traits,
 * aiDescription, and autoMatchRule for automated layout synthesis.
 */

import type { ComponentType } from './types';

export interface ComponentCatalogEntry {
  type: ComponentType;
  name: string;
  category: '数据展示' | '图表' | '筛选' | '洞察' | '布局';
  description: string;
  aiDescription: string;
  autoMatchRule: {
    requiredFields?: string[];
    fieldTypes?: Record<string, string>;
    conditionSummary: string;
  };
  supportedFormats?: string[];
  supportsDrilldown?: boolean;
  defaultWidth?: 'full' | 'half' | 'third' | 'two-thirds' | 'quarter';
}

export const COMPONENT_CATALOG: Record<ComponentType, ComponentCatalogEntry> = {
  'metric-card': {
    type: 'metric-card',
    name: '核心指标卡',
    category: '数据展示',
    description: '展示关键原子指标、金额、完成进度或同比/环比变化。',
    aiDescription: '用于看板顶部或板块首部的核心KPI提炼。当源数据包含单值汇总（如总花费、总曝光、总互动、ROI、完成率等）时必选。支持金额货币、百分比、整数格式化，支持目标值与对比增减。',
    autoMatchRule: {
      requiredFields: ['field'],
      conditionSummary: '单行或聚合后的原子数值列，如 spend, impressions, ctr, budget_progress',
    },
    supportedFormats: ['number', 'integer', 'currency', 'percent'],
    supportsDrilldown: true,
    defaultWidth: 'quarter',
  },
  'data-table': {
    type: 'data-table',
    name: '明细数据表格',
    category: '数据展示',
    description: '展示多维明细、达人列表、版位明细或分渠道详细指标。支持列排序与格式化。',
    aiDescription: '当源数据包含多列（>3列）且行数较多（如执行明细、达人投放单、版位拆解）时选用。支持列级格式化（货币、百分比）、分页及冻结列。',
    autoMatchRule: {
      conditionSummary: '包含维度字段（如达人名、标题、渠道）与多个对应度量指标的明细数据集',
    },
    supportsDrilldown: true,
    defaultWidth: 'full',
  },
  'date-range-filter': {
    type: 'date-range-filter',
    name: '日期范围筛选器',
    category: '筛选',
    description: '快捷日期范围与自定义起止日期筛选。',
    aiDescription: '当数据集包含日期字段（date/timestamp）且需要全局联动或分日切片时置于顶部。',
    autoMatchRule: {
      requiredFields: ['date'],
      conditionSummary: '数据集中包含连续日期时间序列',
    },
    defaultWidth: 'full',
  },
  'select-filter': {
    type: 'select-filter',
    name: '下拉维度筛选器',
    category: '筛选',
    description: '针对渠道、版位、阶段、达人层级等离散维度做条件切片。',
    aiDescription: '当数据表具备明确分类维度（如 channel, tier, platform）时使用，提供单选或多选。',
    autoMatchRule: {
      conditionSummary: '存在基数适中（2-15个不同取值）的离散枚举维度',
    },
    defaultWidth: 'third',
  },
  'line-bar-combo': {
    type: 'line-bar-combo',
    name: '双轴线柱组合图',
    category: '图表',
    description: '双坐标轴图表，柱图展示规模（消耗/曝光），折线展示效率或比率（CTR/CPM/ROI）。',
    aiDescription: '核心趋势分析利器。当且仅当同时存在“规模度量”（如消耗、展现量、互动量）与“率值/成本度量”（如CTR、CPM、CPE、ROI）按时间或分类排列时自动选用。',
    autoMatchRule: {
      requiredFields: ['xField', 'yField', 'y2Field'],
      conditionSummary: '包含 X 轴维度 + 柱轴数值字段 (yField) + 折线轴比率/成本字段 (y2Field)',
    },
    supportsDrilldown: true,
    defaultWidth: 'half',
  },
  'time-series': {
    type: 'time-series',
    name: '时间序列趋势图',
    category: '图表',
    description: '单指标或多指标的分日连续走势折线/面积图。',
    aiDescription: '适合展示单一或多个同量纲指标随日期的演进走势，用于监控投放波动与节奏。',
    autoMatchRule: {
      requiredFields: ['xField', 'yField'],
      conditionSummary: 'X轴为 ISO 日期格式，Y轴为时间序列度量',
    },
    supportsDrilldown: true,
    defaultWidth: 'half',
  },
  'target-bullet': {
    type: 'target-bullet',
    name: '目标对比子弹图',
    category: '图表',
    description: '紧凑展示规划预算/考核目标与实际完成进度的横向或纵向对比。',
    aiDescription: '当源数据包含目标值（target/budget）与实际值（actual/spent）对偶字段时选用。直观呈现达成百分比与差额。',
    autoMatchRule: {
      requiredFields: ['field', 'targetField'],
      conditionSummary: '存在明确的目标值列（target）与当前完成值列（actual/value）',
    },
    supportsDrilldown: false,
    defaultWidth: 'third',
  },
  'multi-line-deck': {
    type: 'multi-line-deck',
    name: '多业务线横向对比组',
    category: '图表',
    description: '用于多渠道、多版位或多业务线的并列卡片与指标矩阵。',
    aiDescription: '适合四条投放线、三大渠道或主要版位的横向对比卡片组，每张卡展示该线的核心指标群。',
    autoMatchRule: {
      conditionSummary: '存在固定少量的业务分类（如 2~5 个渠道/产品线），各分类有平行的指标矩阵',
    },
    supportsDrilldown: true,
    defaultWidth: 'full',
  },
  'donut-rose': {
    type: 'donut-rose',
    name: '南丁格尔玫瑰/环形图',
    category: '图表',
    description: '展示品类、版位或达人层级的构成占比与相对体量。',
    aiDescription: '当分析整体构造成分（如达人层级占比、花费结构、渠道份额）且类别在 3~8 个之间时选用。',
    autoMatchRule: {
      requiredFields: ['categoryField', 'field'],
      conditionSummary: '分类维度（类别名）+ 非负数绝对值列（总和等于整体或构成比例）',
    },
    supportsDrilldown: true,
    defaultWidth: 'half',
  },
  'percent-stack': {
    type: 'percent-stack',
    name: '百分比堆叠图',
    category: '图表',
    description: '展示不同阶段或不同维度内部 100% 构成的变化。',
    aiDescription: '当各类别求和为 100% 结构（如正面/中性/负面评论占比、各阶段预算消耗占比）时选用。',
    autoMatchRule: {
      requiredFields: ['seriesFields'],
      conditionSummary: '多个加和为常数或需要观测内部比例变动的分类指标序列',
    },
    supportsDrilldown: true,
    defaultWidth: 'half',
  },
  'capability-radar': {
    type: 'capability-radar',
    name: '多维综合雷达图',
    category: '图表',
    description: '评估达人表现、渠道综合能力或产品维度的综合评分。',
    aiDescription: '用于 4~7 个维度（如曝光力、互动率、转化力、性价比、品牌契合度）的综合能力雷达画像。',
    autoMatchRule: {
      conditionSummary: '存在多个平行的评分或标准化比率指标（0-100 或 0-1）',
    },
    supportsDrilldown: true,
    defaultWidth: 'half',
  },
  'pareto-chart': {
    type: 'pareto-chart',
    name: '帕累托二八贡献图',
    category: '图表',
    description: '柱状降序排列各项目贡献，折线叠加累计百分比（80/20法则）。',
    aiDescription: '用于识别贡献了 80% 互动/消耗/销量的核心头部达人或关键曝光版位。',
    autoMatchRule: {
      requiredFields: ['categoryField', 'field'],
      conditionSummary: '细分实体列表（达人/关键词/SKU）按贡献度排序且需呈现二八集中度',
    },
    supportsDrilldown: true,
    defaultWidth: 'half',
  },
  'contribution-waterfall': {
    type: 'contribution-waterfall',
    name: '增减贡献瀑布图',
    category: '图表',
    description: '展示各阶段增减变动对最终净变化的阶梯式贡献。',
    aiDescription: '用于预算消耗流水变动、阶段利润拆解、或各渠道对总增量的阶段阶梯增减贡献分析。',
    autoMatchRule: {
      requiredFields: ['categoryField', 'field'],
      conditionSummary: '存在连续阶段或维度的增减变动值（正负 delta）并汇总为净变动',
    },
    supportsDrilldown: true,
    defaultWidth: 'half',
  },
  'effect-scatter': {
    type: 'effect-scatter',
    name: '效果散点象限图',
    category: '图表',
    description: '以成本为横轴、产出效果为纵轴，点大小为曝光量，划分四大价值象限。',
    aiDescription: '达人矩阵或投放版位价值象限分析利器。X轴放成本/单价，Y轴放互动率/ROI，气泡大小为总消耗。',
    autoMatchRule: {
      requiredFields: ['xField', 'yField'],
      conditionSummary: '存在两个独立连续变量（投入 vs 产出），适合气泡/散点对比分布',
    },
    supportsDrilldown: true,
    defaultWidth: 'full',
  },
  'distribution-histogram': {
    type: 'distribution-histogram',
    name: '数值分布直方图',
    category: '图表',
    description: '展示笔记互动量、单篇报价或播放量的区间频数分布。',
    aiDescription: '用于分析数值指标在各数值区间的集中程度（如千元以下、1k-3k、3k-5k、5k以上达人分布）。',
    autoMatchRule: {
      conditionSummary: '大量连续数值样本（如笔记互动数），需要分箱（bucket）观测频数',
    },
    supportsDrilldown: true,
    defaultWidth: 'half',
  },
  'grouped-boxplot': {
    type: 'grouped-boxplot',
    name: '分组箱线图',
    category: '图表',
    description: '展示不同达人层级或不同渠道指标的分位数（中位数、四分位、离群点）。',
    aiDescription: '适合深入探究不同层级（头部/腰部/初级/KOC）的互动成本或CPM波动区间。',
    autoMatchRule: {
      conditionSummary: '分层分类下的离散样本分布，需观测中位数与极值分布',
    },
    supportsDrilldown: true,
    defaultWidth: 'half',
  },
  'comment-qc-panel': {
    type: 'comment-qc-panel',
    name: '舆情与评论质检面板',
    category: '数据展示',
    description: '外显核验、负向拦截、核心诉求关键词与质检合格率。',
    aiDescription: '当包含评论/外显/合规检查数据时使用。展示好评率、负向拦截数、待核验清单及高频负向词。',
    autoMatchRule: {
      conditionSummary: '源数据包含评论文本、正负向情感标注或外显审核状态',
    },
    supportsDrilldown: true,
    defaultWidth: 'full',
  },
  'analysis-insight-card': {
    type: 'analysis-insight-card',
    name: 'AI 洞察与建议卡',
    category: '洞察',
    description: '结构化提炼业务结论、风险预警与执行优化建议，绑定关联数据查询。',
    aiDescription: '由 Agent 或规则引擎基于数据提炼的核心洞察卡片。带有清晰的证据引用与行动项。',
    autoMatchRule: {
      conditionSummary: '存在关键异常（超预算、未达标、高效高潜版位），需要明确行动项',
    },
    supportsDrilldown: false,
    defaultWidth: 'full',
  },
};

/**
 * Matches appropriate components given dataset column characteristics.
 */
export function matchComponentsForDataset(columns: Array<{ key: string; role?: string; type?: string }>): ComponentType[] {
  const recommendations: ComponentType[] = [];
  const colKeys = new Set(columns.map(c => c.key.toLowerCase()));
  const hasDate = columns.some(c => c.role === 'TIMESTAMP' || c.key.toLowerCase().includes('date') || c.key.toLowerCase().includes('day'));
  const metrics = columns.filter(c => c.role === 'METRIC' || c.type === 'number');
  const ratios = columns.filter(c => c.role === 'RATIO' || c.key.toLowerCase().includes('ctr') || c.key.toLowerCase().includes('cpm') || c.key.toLowerCase().includes('rate') || c.key.toLowerCase().includes('roi'));

  if (metrics.length > 0) {
    recommendations.push('metric-card');
  }
  if (hasDate && metrics.length > 0 && ratios.length > 0) {
    recommendations.push('line-bar-combo');
  } else if (hasDate && metrics.length > 0) {
    recommendations.push('time-series');
  }
  if (columns.length >= 4) {
    recommendations.push('data-table');
  }
  if (colKeys.has('channel') || colKeys.has('tier') || colKeys.has('category') || colKeys.has('placement')) {
    recommendations.push('donut-rose');
  }
  if (colKeys.has('spend') && (colKeys.has('interactions') || colKeys.has('impressions') || colKeys.has('uv'))) {
    recommendations.push('effect-scatter');
  }
  return recommendations;
}
