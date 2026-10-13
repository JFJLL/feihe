import type { Dataset } from '../datasets';
import type { CardMetricConfig, CardPresentationType } from './config';

export type FieldRoles = { date?: string; channel?: string; spend?: string; impressions?: string; clicks?: string; consultations?: string; deals?: string };
export type MetricRecommendation = { key: string; name: string; explanation: string; config: CardMetricConfig; views: Array<{ type: CardPresentationType; title: string; groupBy?: string }> };
const aliases: Record<keyof FieldRoles, string[]> = {
  date: ['日期', '记录日期', '投放日期', 'date', 'record_date', 'report_date'], channel: ['渠道', '投放渠道', 'channel', 'platform'],
  spend: ['花费', '消耗', '广告消耗', 'cost', 'spend', 'actual_spend'], impressions: ['曝光', '曝光量', '展示量', '展现', 'impressions', 'exposure'],
  clicks: ['点击', '点击量', 'clicks'], consultations: ['咨询人数', '咨询量', 'consultations', 'consult'], deals: ['成交人数', '成交量', 'deals', 'sales'],
};
export function fieldRoleErrors(dataset: Dataset, roles: FieldRoles) {
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return ['不支持的业务字段映射'];
  const errors: string[] = [];
  for (const [role, key] of Object.entries(roles)) {
    if (!Object.hasOwn(aliases, role)) { errors.push('不支持的业务字段映射'); continue; }
    if (!key) continue;
    const column = dataset.columns.find(column => column.key === key);
    if (!column || (role === 'date' ? column.type !== 'date' : role === 'channel' ? !['text', 'category'].includes(column.type) : column.type !== 'number' || column.numericUnit === 'percent')) errors.push('推荐字段类型不适用：' + role);
  }
  return errors;
}
export function inferFieldRoles(dataset: Dataset): FieldRoles {
  const roles: FieldRoles = {};
  for (const role of Object.keys(aliases) as Array<keyof FieldRoles>) {
    const column = dataset.columns.find(column => aliases[role].some(name => name.toLowerCase() === column.name.toLowerCase() || name.toLowerCase() === column.key.toLowerCase()) && (role === 'date' ? column.type === 'date' : role === 'channel' ? ['text', 'category'].includes(column.type) : column.type === 'number' && column.numericUnit !== 'percent'));
    if (column) roles[role] = column.key;
  }
  const dates = dataset.columns.filter(column => column.type === 'date');
  if (!roles.date && dates.length === 1) roles.date = dates[0].key;
  return roles;
}
export function recommendMetrics(dataset: Dataset, templateId: string, roles = inferFieldRoles(dataset)) {
  const base: CardMetricConfig = { datasetId: dataset.id, mode: 'custom', metric: 'custom', missingPolicy: 'skip', displayOrigin: 'auto', format: 'number', dateField: roles.date };
  const list: MetricRecommendation[] = [];
  const add = (key: string, name: string, config: CardMetricConfig, explanation: string) => {
    const views: MetricRecommendation['views'] = [{ type: 'metric_card', title: name }];
    if (roles.date) views.push({ type: 'time_trend', title: name + '趋势' });
    if (roles.channel) views.push({ type: 'breakdown', title: name + '按' + (dataset.columns.find(column => column.key === roles.channel)?.name || '分类'), groupBy: roles.channel });
    list.push({ key, name, explanation, config: { ...base, ...config }, views });
  };
  add('records', '记录数量', { aggregation: 'count' }, '统计原表记录行数，不要求任务、预算或负责人列。');
  if (templateId === 'ad_performance') {
    for (const [role, name] of [['spend', '广告消耗'], ['impressions', '曝光量'], ['clicks', '点击量']] as const) if (roles[role]) add(role, name, { aggregation: 'sum', field: roles[role] }, '合计来源中的' + dataset.columns.find(column => column.key === roles[role])?.name + '；未声明币种时保留普通数值。');
    if (roles.clicks && roles.impressions) add('ctr', '点击率', { aggregation: 'ratio', numField: roles.clicks, denField: roles.impressions, ratioBasis: 'paired', unit: '%', format: 'percent' }, '默认仅使用点击与曝光同时有效的记录；每日和全盘按合计点击/曝光计算。');
  } else {
    for (const column of dataset.columns.filter(column => column.type === 'number').slice(0, 6)) {
      const percent = column.numericUnit === 'percent';
      add('field:' + column.key, column.name + (percent ? '平均值' : '合计'), { aggregation: percent ? 'avg' : 'sum', field: column.key, ...(percent ? { format: 'percent', unit: '%', percentScale: column.percentScale } : {}) }, percent ? '沿用来源百分比存储口径；缺失值不补零。' : '合计实际数值，名称不会自动指定货币单位。');
    }
    if (roles.consultations && roles.deals) add('conversion', '成交率', { aggregation: 'ratio', numField: roles.deals, denField: roles.consultations, ratioBasis: 'paired', format: 'percent', unit: '%' }, '成交人数/咨询人数，缺失不补零，默认按成对有效记录计算。');
  }
  const required: Array<keyof FieldRoles> = templateId === 'ad_performance' ? ['date', 'spend', 'impressions', 'clicks'] : [];
  return { roles, recommendations: list, missing: required.filter(role => !roles[role]).map(role => aliases[role][0]) };
}
