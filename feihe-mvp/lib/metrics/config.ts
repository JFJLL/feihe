import { parseProjectDate } from '../date-values';

export type CardAggregation = 'count' | 'nonempty_count' | 'distinct_count' | 'sum' | 'avg' | 'ratio';
export interface CardMetricConfig {
  id?: string;
  title?: string;
  type?: string;
  datasetId?: string;
  mode?: 'template' | 'custom';
  metric?: string;
  aggregation?: CardAggregation;
  field?: string;
  numField?: string;
  denField?: string;
  groupBy?: string;
  dateField?: string;
  from?: string;
  to?: string;
  missingPolicy?: 'skip' | 'zero';
  unit?: string;
  format?: 'number' | 'percent' | 'currency' | 'compact';
}
export type MetricDataset = { id: string; sourceId?: string; columns?: Array<{ key: string; name: string; type: string }> };
export const TEMPLATE_METRICS = ['task_total', 'task_completed', 'task_completion_rate', 'budget_total', 'spent_total', 'budget_spent_rate', 'conversion_rate'];
export function isTemplateCard(card: CardMetricConfig) {
  // Explicit aggregation always wins over a legacy template key.
  return card.mode !== 'custom' && !card.aggregation && TEMPLATE_METRICS.includes(card.metric || '');
}

export function validateCardConfig(card: CardMetricConfig, datasets: MetricDataset[], requireTitle = false): string[] {
  const errors: string[] = [];
  if (requireTitle && !String(card.title || '').trim()) errors.push('请填写卡片标题');
  const dataset = datasets.find(d => d.id === card.datasetId || d.sourceId === card.datasetId);
  if (!dataset) errors.push('请选择当前项目的有效数据集');
  const columns = dataset?.columns || [];
  const requireField = (key: string | undefined, label: string, numeric = false) => {
    const column = columns.find(c => c.key === key);
    if (!key || !column) errors.push(`${label}不存在，请重新选择`);
    else if (numeric && column.type !== 'number') errors.push(`${label}必须为数值类型`);
  };
  if (!isTemplateCard(card)) {
    const agg = card.aggregation;
    if (!['count', 'nonempty_count', 'distinct_count', 'sum', 'avg', 'ratio'].includes(agg || '')) errors.push('请选择有效的指标计算方式');
    if (agg === 'ratio') {
      requireField(card.numField, '分子字段', true);
      requireField(card.denField, '分母字段', true);
      if (card.field) errors.push('比率计算不能同时绑定目标字段');
    } else if (agg !== 'count') requireField(card.field, '目标字段', agg === 'sum' || agg === 'avg');
    else if (card.field) errors.push('记录行数不绑定字段，请使用字段非空数');
    if (agg !== 'ratio' && (card.numField || card.denField)) errors.push('当前计算方式不适用分子分母');
  } else {
    const aliasField = (keys: string[], label: string, numeric = false) => requireField(keys.find(key => columns.some(c => c.key === key)), label, numeric);
    if (['task_completed', 'task_completion_rate'].includes(card.metric!)) aliasField(['status', '状态', 'state'], '任务状态字段');
    if (['budget_total', 'budget_spent_rate'].includes(card.metric!)) aliasField(['budget', '预算', 'plan_budget'], '预算字段', true);
    if (['spent_total', 'budget_spent_rate'].includes(card.metric!)) aliasField(['spent', 'actual_spent', '实际支出', '支出'], '支出字段', true);
    if (card.metric === 'conversion_rate') {
      requireField(card.numField || '成交人数', '分子字段', true);
      requireField(card.denField || '咨询人数', '分母字段', true);
    }
  }
  if (card.type && !['metric_card', 'progress_card', 'breakdown'].includes(card.type)) errors.push('不支持的卡片呈现形式');
  if (card.type === 'breakdown' && !card.groupBy) errors.push('细分对比卡必须选择分组维度');
  if (card.groupBy) requireField(card.groupBy, '分组字段');
  if (card.dateField) {
    requireField(card.dateField, '日期字段');
    const column = columns.find(c => c.key === card.dateField);
    if (column && column.type !== 'date') errors.push('日期字段必须为日期类型');
  }
  if ((card.from || card.to) && !card.dateField) errors.push('指定日期范围必须选择日期字段');
  for (const value of [card.from, card.to]) {
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || parseProjectDate(value) === null)) errors.push('日期范围格式无效');
  }
  if (card.from && card.to && card.from > card.to) errors.push('结束日期不能早于开始日期');
  if (card.missingPolicy && !['skip', 'zero'].includes(card.missingPolicy)) errors.push('不支持的缺失值规则');
  return errors;
}
