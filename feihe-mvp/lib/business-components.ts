export const BUSINESS_COMPONENTS = [
  { id: 'decision', title: '今日指标与待办', view: 'overview' },
  { id: 'budget', title: '预算消耗节奏对比', view: 'overview' },
  { id: 'kfs', title: 'KFS投流与采买结构', view: 'overview' },
  { id: 'content-output', title: '种草发布与切角渗透', view: 'overview' },
  { id: 'content-effects', title: '内容效果深度分析', view: 'overview' },
  { id: 'kpi-comparison', title: '内容与投放关键指标对比', view: 'overview' },
  { id: 'top-content', title: '高热内容TOP20', view: 'overview' },
  { id: 'coverage-efficiency', title: '内容覆盖与达人效率', view: 'overview' },
  { id: 'interaction-quality', title: '点赞收藏分享与互动质量', view: 'overview' },
  { id: 'actions', title: '复盘洞察与下一步行动', view: 'overview' },
  { id: 'dictionary', title: '指标口径说明', view: 'overview' },
  { id: 'daily-summary', title: '日报核心指标与前日比较', view: 'daily' },
  { id: 'daily-trends', title: '计划消耗与点击效率趋势', view: 'daily' },
  { id: 'daily-efficiency', title: 'UV成本与每日效率对比', view: 'daily' },
] as const;
export const DEFAULT_BUSINESS_COMPONENTS = BUSINESS_COMPONENTS.map(component => component.id) as string[];
export function businessComponentErrors(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !DEFAULT_BUSINESS_COMPONENTS.includes(id))) return ['请选择已登记的业务组件'];
  if (new Set(value).size !== value.length) return ['业务组件不能重复'];
  return [];
}
