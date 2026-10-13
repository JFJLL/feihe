import { parseProjectDate } from '../date-values';
import type { PercentScale } from '../numeric-values';

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
  percentScale?: PercentScale;
  ratioBasis?: 'paired' | 'independent';
  unit?: string;
  format?: 'number' | 'percent' | 'currency' | 'compact';
  displayOrigin?: 'auto' | 'manual';
  displayNeedsConfirmation?: boolean;
}
export type MetricColumn = { key: string; name: string; type: string; numericUnit?: string; percentScale?: PercentScale };
export type MetricDataset = { id: string; sourceId?: string; columns?: MetricColumn[] };
export function isCountAggregation(aggregation?: string) { return ['count', 'nonempty_count', 'distinct_count'].includes(aggregation || ''); }
function isCurrencyUnit(unit?: string) { return /^(元|人民币|￥|¥|CNY|RMB|USD|美元|\$)$/i.test(unit?.trim() || ''); }
export function resultDisplayErrors(card: { aggregation?: string; metric?: string; mode?: string; format?: string; unit?: string; percentScale?: string; displayOrigin?: string; displayNeedsConfirmation?: boolean }) {
  const errors: string[] = [];
  const count = isCountAggregation(card.aggregation) || (!card.aggregation && card.mode !== 'custom' && card.metric === 'task_total');
  if (count && (card.format === 'percent' || card.format === 'currency' || card.unit?.trim() === '%' || isCurrencyUnit(card.unit) || card.percentScale)) errors.push('计数结果不能使用百分比、金额单位或百分比数值口径');
  if (card.displayNeedsConfirmation) errors.push('目标字段已变化，请确认当前显示设置或选择适用的显示格式');
  if (card.displayOrigin && !['auto', 'manual'].includes(card.displayOrigin)) errors.push('不支持的显示设置来源');
  return errors;
}

type CardDisplayChange = { kind: 'field'; field: string } | { kind: 'aggregation'; aggregation: CardAggregation } | { kind: 'dataset'; datasetId: string } | { kind: 'display'; patch: Pick<Partial<CardMetricConfig>, 'format' | 'unit' | 'percentScale'> } | { kind: 'confirm' };
// Only display provenance is tracked; values and percentage storage never change here.
export function transitionCardConfig<T extends CardMetricConfig>(card: T, change: CardDisplayChange, columns: MetricColumn[] = []): T {
  let next = { ...card };
  if (change.kind === 'display') {
    const patch = { ...change.patch };
    if (patch.format) {
      const column = columns.find(c => c.key === card.field);
      patch.unit = patch.format === 'percent' ? '%' : patch.format === 'currency' ? (card.unit && card.unit !== '%' ? card.unit : '元') : (card.unit === '%' || isCurrencyUnit(card.unit) ? '' : card.unit);
      patch.percentScale = patch.format === 'percent' ? (card.percentScale || column?.percentScale) : undefined;
    }
    if (patch.unit !== undefined && !patch.format && next.format !== 'percent' && patch.unit.trim() !== '%') patch.percentScale = undefined;
    return { ...next, ...patch, displayOrigin: 'manual', displayNeedsConfirmation: false };
  }
  if (change.kind === 'confirm') return { ...next, displayOrigin: 'manual', displayNeedsConfirmation: false };
  const intrinsicRatio = card.aggregation === 'ratio' || (isTemplateCard(card) && ['task_completion_rate', 'budget_spent_rate', 'conversion_rate'].includes(card.metric || ''));
  const origin = intrinsicRatio ? 'auto' : card.displayOrigin || (card.format && card.format !== 'number' || card.unit || card.percentScale ? 'manual' : 'auto');
  if (change.kind === 'field') next.field = change.field;
  if (change.kind === 'aggregation') {
    next = { ...next, metric: 'custom', mode: 'custom', aggregation: change.aggregation, field: change.aggregation === 'count' || change.aggregation === 'ratio' || card.aggregation === 'ratio' ? '' : card.field, numField: '', denField: '', ratioBasis: change.aggregation === 'ratio' ? 'paired' : undefined };
  }
  if (change.kind === 'dataset') next = { ...next, datasetId: change.datasetId, mode: 'custom', metric: 'custom', aggregation: 'count', field: '', numField: '', denField: '', groupBy: '', dateField: '', from: '', to: '', ratioBasis: undefined };
  const column = columns.find(c => c.key === next.field);
  const count = isCountAggregation(next.aggregation);
  if (origin === 'manual' && count && ['number', 'compact'].includes(next.format || 'number')) {
    // Older manual preferences can carry an unused scale/unit from their previous field.
    return { ...next, unit: next.unit?.trim() === '%' || isCurrencyUnit(next.unit) ? '' : next.unit, percentScale: undefined, displayOrigin: 'manual', displayNeedsConfirmation: false };
  }
  if (origin === 'auto' || next.aggregation === 'ratio' || (count && resultDisplayErrors({ ...next, displayNeedsConfirmation: false }).length)) {
    const percent = next.aggregation === 'ratio' || (!count && ['sum', 'avg'].includes(next.aggregation || '') && column?.numericUnit === 'percent');
    return { ...next, format: percent ? 'percent' : 'number', unit: percent ? '%' : '', percentScale: percent && next.aggregation !== 'ratio' ? column?.percentScale : undefined, displayOrigin: 'auto', displayNeedsConfirmation: false };
  }
  const bindingChanged = change.kind === 'field' && card.field !== next.field || change.kind === 'dataset' || change.kind === 'aggregation' && isCountAggregation(card.aggregation) !== count;
  const percent = next.format === 'percent' || next.unit === '%';
  const ambiguous = bindingChanged && !count && (percent && (column?.numericUnit !== 'percent' || column.percentScale !== next.percentScale) || column?.numericUnit === 'percent' && (next.format === 'currency' || Boolean(next.unit && next.unit !== '%')));
  return { ...next, displayOrigin: 'manual', displayNeedsConfirmation: Boolean(next.displayNeedsConfirmation || ambiguous) };
}
export const TEMPLATE_METRICS = ['task_total', 'task_completed', 'task_completion_rate', 'budget_total', 'spent_total', 'budget_spent_rate', 'conversion_rate'];
export function ratioSampleLabel(metric: { pairedValidCount?: number; numeratorValidCount?: number; denominatorValidCount?: number; totalRows?: number; calculationSampleSize?: number; ratioBasis?: string }, fillZero = false) {
  const total = metric.totalRows || 0;
  const coverage = (count = 0) => `${count}/${total}（${(total ? count / total * 100 : 0).toFixed(1)}%）`;
  return `${metric.ratioBasis === 'independent' ? '独立汇总' : '成对口径'} · 成对有效 ${metric.pairedValidCount || 0} 行 · 分子有效 ${coverage(metric.numeratorValidCount)} · 分母有效 ${coverage(metric.denominatorValidCount)}${fillZero ? ` · 明确补零，参与计算 ${metric.calculationSampleSize || 0} 行` : ''}`;
}
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
  if (card.percentScale && !['fraction', 'percentage_points'].includes(card.percentScale)) errors.push('不支持的百分比数值口径');
  if (card.ratioBasis && !['paired', 'independent'].includes(card.ratioBasis)) errors.push('不支持的比率样本口径');
  const ratio = card.aggregation === 'ratio' || (isTemplateCard(card) && ['task_completion_rate', 'budget_spent_rate', 'conversion_rate'].includes(card.metric || ''));
  if (!ratio && (card.format === 'percent' || card.unit === '%') && !card.percentScale) errors.push('请确认百分比数值口径；历史配置不会按数值大小自动转换');
  if (!ratio && card.ratioBasis) errors.push('当前计算方式不适用比率样本口径');
  errors.push(...resultDisplayErrors(card));
  const target = columns.find(c => c.key === card.field);
  const scalar = ['sum', 'avg'].includes(card.aggregation || '');
  if (scalar && card.displayOrigin === 'auto' && (card.format === 'percent' || card.unit === '%') && target?.numericUnit !== 'percent') errors.push('自动百分比显示与当前目标字段不兼容，请重新选择显示格式');
  if (scalar && target?.numericUnit === 'percent') {
    if ((card.format === 'percent' || card.unit === '%') && card.percentScale && card.percentScale !== target.percentScale) errors.push('显示百分比口径与来源字段的存储口径不一致');
    if (card.format === 'currency' || isCurrencyUnit(card.unit)) errors.push('百分比来源字段不适用金额显示');
  }
  return errors;
}
