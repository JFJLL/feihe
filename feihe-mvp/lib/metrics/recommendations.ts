import type { Dataset, DatasetColumn } from '../datasets';
import type { CardMetricConfig, CardPresentationType } from './config';

export type BusinessDomain = 'ad' | 'content' | 'comment';
export type FieldRoles = { date?: string; channel?: string; spend?: string; impressions?: string; clicks?: string; consultations?: string; deals?: string;
  contentId?: string; commentId?: string; link?: string; title?: string; author?: string; reads?: string; interactions?: string; commentText?: string; sentiment?: string; treatmentStatus?: string };
export type MetricRecommendation = { key: string; name: string; explanation: string; config: CardMetricConfig; views: Array<{ type: CardPresentationType; title: string; groupBy?: string }> };
const aliases: Record<keyof FieldRoles, string[]> = {
  date: ['日期', '记录日期', '投放日期', '发布日期', 'date', 'record_date', 'report_date', 'publish_date'], channel: ['渠道', '投放渠道', '内容分类', 'channel', 'platform'],
  spend: ['花费', '消耗', '广告消耗', '内容费用', 'cost', 'spend', 'actual_spend'], impressions: ['曝光', '曝光量', '展示量', '展现', 'impressions', 'exposure'],
  clicks: ['点击', '点击量', 'clicks'], consultations: ['咨询人数', '咨询量', 'consultations', 'consult'], deals: ['成交人数', '成交量', 'deals', 'sales'],
  contentId: ['内容编号', '内容ID', 'content_id', 'article_id'], commentId: ['评论编号', '评论ID', 'comment_id'], link: ['内容链接', '链接', 'url', 'link'],
  title: ['标题', '内容标题', 'title'], author: ['作者', 'author'], reads: ['阅读量', '阅读数', 'reads', 'read_count'], interactions: ['互动量', '互动数', 'interactions', 'interaction_count'],
  commentText: ['评论内容', '评论正文', 'comment_text'], sentiment: ['情感', '情感标注', 'sentiment'], treatmentStatus: ['处置状态', '处理状态', 'treatment_status'],
};
export function defaultBusinessDomain(templateId: string): BusinessDomain | undefined {
  return templateId === 'ad_performance' ? 'ad' : templateId === 'content_marketing' ? 'content' : templateId === 'comment_qc' ? 'comment' : undefined;
}
export function supportsBusinessDomain(templateId: string, domain: string) {
  return defaultBusinessDomain(templateId) === domain || templateId === 'content_marketing' && domain === 'comment';
}
export function requiredBusinessMetricKeys(domain: BusinessDomain | undefined, roles: FieldRoles) {
  return domain === 'ad' ? ['spend', 'impressions', 'clicks', 'ctr'] : domain === 'content' ? ['content_records', ...['reads', 'interactions', 'spend'].filter(role => roles[role as keyof FieldRoles])] : domain === 'comment' ? ['comment_records', ...['sentiment', 'treatmentStatus'].filter(role => roles[role as keyof FieldRoles])] : [];
}
export function fieldRoleAccepts(role: keyof FieldRoles, column: DatasetColumn) {
  if (role === 'date') return column.type === 'date';
  if (['contentId', 'commentId'].includes(role)) return ['text', 'category', 'number'].includes(column.type) && column.numericUnit !== 'percent';
  if (['channel', 'link', 'title', 'author', 'commentText', 'sentiment', 'treatmentStatus'].includes(role)) return ['text', 'category'].includes(column.type);
  return column.type === 'number' && column.numericUnit !== 'percent';
}
export function fieldRoleErrors(dataset: Dataset, roles: FieldRoles) {
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return ['不支持的业务字段映射'];
  const errors: string[] = [];
  for (const [role, key] of Object.entries(roles)) {
    if (!Object.hasOwn(aliases, role)) { errors.push('不支持的业务字段映射'); continue; }
    if (!key) continue;
    const column = dataset.columns.find(column => column.key === key);
    if (typeof key !== 'string' || !column || !fieldRoleAccepts(role as keyof FieldRoles, column)) errors.push('推荐字段类型不适用：' + role);
  }
  return errors;
}
export function inferFieldRoles(dataset: Dataset): FieldRoles {
  const roles: FieldRoles = {};
  for (const role of Object.keys(aliases) as Array<keyof FieldRoles>) {
    const column = dataset.columns.find(column => aliases[role].some(name => name.toLowerCase() === column.name.toLowerCase() || name.toLowerCase() === column.key.toLowerCase()) && fieldRoleAccepts(role, column));
    if (column) roles[role] = column.key;
  }
  const dates = dataset.columns.filter(column => column.type === 'date');
  if (!roles.date && dates.length === 1) roles.date = dates[0].key;
  return roles;
}
export function recommendMetrics(dataset: Dataset, templateId: string, roles = inferFieldRoles(dataset), domain = defaultBusinessDomain(templateId)) {
  const base: CardMetricConfig = { datasetId: dataset.id, mode: 'custom', metric: 'custom', missingPolicy: 'skip', displayOrigin: 'auto', format: 'number', dateField: roles.date };
  const list: MetricRecommendation[] = [];
  const add = (key: string, name: string, config: CardMetricConfig, explanation: string) => {
    const views: MetricRecommendation['views'] = [{ type: 'metric_card', title: name }];
    if (roles.date) views.push({ type: 'time_trend', title: name + '趋势' });
    if (roles.channel) views.push({ type: 'breakdown', title: name + '按' + (dataset.columns.find(column => column.key === roles.channel)?.name || '分类'), groupBy: roles.channel });
    if (domain === 'comment' && key === 'comment_records') for (const role of ['sentiment', 'treatmentStatus'] as const) if (roles[role]) views.push({ type: 'breakdown', title: role === 'sentiment' ? '来源情感分布' : '来源处置状态', groupBy: roles[role] });
    list.push({ key, name, explanation, config: { ...base, ...config }, views });
  };
  add(domain === 'content' ? 'content_records' : domain === 'comment' ? 'comment_records' : 'records', domain === 'content' ? '内容记录数' : domain === 'comment' ? '评论记录数' : '记录数量', { aggregation: 'count' }, '统计本项目原表记录行数，不要求任务、预算或负责人列。');
  if (domain === 'ad') {
    for (const [role, name] of [['spend', '广告消耗'], ['impressions', '曝光量'], ['clicks', '点击量']] as const) if (roles[role]) add(role, name, { aggregation: 'sum', field: roles[role] }, '合计来源中的' + dataset.columns.find(column => column.key === roles[role])?.name + '；未声明币种时保留普通数值。');
    if (roles.clicks && roles.impressions) add('ctr', '点击率', { aggregation: 'ratio', numField: roles.clicks, denField: roles.impressions, ratioBasis: 'paired', unit: '%', format: 'percent' }, '默认仅使用点击与曝光同时有效的记录；每日和全盘按合计点击/曝光计算。');
  } else if (domain === 'content') {
    for (const [role, name] of [['reads', '阅读总量'], ['interactions', '互动总量'], ['spend', '内容费用']] as const) if (roles[role]) add(role, name, { aggregation: 'sum', field: roles[role] }, '来自已确认的原表字段；缺失不补零，未声明币种不显示货币符号。');
  } else if (domain === 'comment') {
    for (const [role, name] of [['sentiment', '有情感标注的评论'], ['treatmentStatus', '有处置状态的评论']] as const) if (roles[role]) add(role, name, { aggregation: 'nonempty_count', field: roles[role] }, '仅统计来源中真实非空标注；不会自动推断情感或执行处置。');
  } else {
    for (const column of dataset.columns.filter(column => column.type === 'number').slice(0, 6)) {
      const percent = column.numericUnit === 'percent';
      add('field:' + column.key, column.name + (percent ? '平均值' : '合计'), { aggregation: percent ? 'avg' : 'sum', field: column.key, ...(percent ? { format: 'percent', unit: '%', percentScale: column.percentScale } : {}) }, percent ? '沿用来源百分比存储口径；缺失值不补零。' : '合计实际数值，名称不会自动指定货币单位。');
    }
    if (roles.consultations && roles.deals) add('conversion', '成交率', { aggregation: 'ratio', numField: roles.deals, denField: roles.consultations, ratioBasis: 'paired', format: 'percent', unit: '%' }, '成交人数/咨询人数，缺失不补零，默认按成对有效记录计算。');
  }
  const required: Array<keyof FieldRoles> = domain === 'ad' ? ['date', 'spend', 'impressions', 'clicks'] : domain === 'comment' ? ['commentText'] : [];
  const missing = required.filter(role => !roles[role]).map(role => aliases[role][0]);
  if (domain === 'content' && !roles.contentId && !roles.link) missing.push('内容编号或内容链接');
  return { domain, roles, recommendations: list, missing };
}
