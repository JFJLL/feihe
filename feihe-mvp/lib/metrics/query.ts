import { parseProjectDate } from '../date-values';
import type { CardMetricConfig } from './config';

export type MetricQuery = { from?: string; to?: string; filters?: Array<{ key: string; value: string }>; detailPage?: number };
export type DashboardLayout = { kind: 'project_board'; version: 1; query: MetricQuery; businessComponents?: string[] };
export function queryErrors(query: MetricQuery): string[] {
  const errors: string[] = [];
  if (!query || typeof query !== 'object' || Array.isArray(query)) return ['项目筛选必须是对象'];
  for (const day of [query.from, query.to]) if (day && (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || parseProjectDate(day) === null)) errors.push('项目日期范围无效');
  if (query.from && query.to && query.from > query.to) errors.push('项目结束日期不能早于开始日期');
  if (query.filters !== undefined) {
    if (!Array.isArray(query.filters) || query.filters.length > 3) errors.push('最多支持三个共同字段筛选');
    else if (query.filters.some(filter => !filter || typeof filter.key !== 'string' || !filter.key || typeof filter.value !== 'string')) errors.push('共同字段筛选无效');
  }
  if (query.detailPage !== undefined && (!Number.isInteger(query.detailPage) || query.detailPage < 1)) errors.push('明细页码必须为正整数');
  return errors;
}
export function canonicalQuery(query: MetricQuery = {}): MetricQuery {
  return { ...(query.from ? { from: query.from } : {}), ...(query.to ? { to: query.to } : {}),
    ...(query.filters?.some(filter => filter.value !== '') ? { filters: query.filters.filter(filter => filter.value !== '').map(filter => ({ key: filter.key, value: filter.value })) } : {}) };
}
export function readDashboardLayout(json?: string): DashboardLayout {
  try { const value = JSON.parse(json || '{}'); if (value.kind === 'project_board' && !queryErrors(value.query).length) return { kind: 'project_board', version: 1, query: canonicalQuery(value.query), ...(Array.isArray(value.businessComponents) ? { businessComponents: value.businessComponents } : {}) }; } catch {}
  return { kind: 'project_board', version: 1, query: {} };
}
// An explicit card period (including legacy from/to) remains an independent override.
// Common field filters still apply; only the period can be independently overridden.
export function applyMetricQuery(card: CardMetricConfig, query: MetricQuery = {}) {
  const independent = card.rangePolicy === 'independent' || card.rangePolicy !== 'project' && Boolean(card.from || card.to);
  const period = independent ? { from: card.from, to: card.to } : query.from || query.to ? { from: query.from, to: query.to } : {};
  return { config: { ...card, ...period }, filters: query.filters || [], rangePolicy: independent ? 'independent' as const : 'project' as const };
}
