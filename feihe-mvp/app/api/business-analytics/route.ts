import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { getProjectDatasets } from '@/lib/datasets';
import { evaluateCardMetric } from '@/lib/metrics/engine';
import { queryErrors, readDashboardLayout, type MetricQuery } from '@/lib/metrics/query';
import { fieldRoleErrors, supportsBusinessDomain, type FieldRoles } from '@/lib/metrics/recommendations';
import { businessRecords, validateBusinessRecords, safeRecordLink } from '@/lib/business-records';
import { DefinitionError } from '@/lib/metrics/definitions';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url), access = await requireProjectAccess(request, url.searchParams.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const projectId = access.context!.projectId;
  const kind = url.searchParams.get('kind') || 'ad';
  if (!['ad', 'content', 'comment'].includes(kind)) return jsonError('不支持的业务分析');
  if (kind !== 'ad') {
    if (!supportsBusinessDomain(String(access.context!.project.template_id), kind)) return jsonError('此项目未启用该业务模块', 403);
    return readDomainAnalytics(projectId, kind as 'content' | 'comment', url);
  }
  const setting = await db().prepare("SELECT value,updated_at AS confirmedAt FROM project_settings WHERE project_id=? AND key='analytics:ad'").bind(projectId).first<{ value: string; confirmedAt: string }>();
  if (!setting) return Response.json({ ok: true, configured: false });
  try {
    const binding = JSON.parse(setting.value) as { datasetId: string; roles: { channel?: string }; metricIds: Record<string, string> };
    const dataset = (await getProjectDatasets(projectId)).find(item => item.id === binding.datasetId);
    if (!dataset) return jsonError('已确认的投放来源已移除，请重新确认数据来源', 409);
    const fieldErrors = fieldRoleErrors(dataset, binding.roles); if (fieldErrors.length) return jsonError('来源字段已变化，请重新确认：' + fieldErrors.join('；'), 409);
    const board = await db().prepare('SELECT layout_json AS layout FROM dashboards WHERE project_id=? ORDER BY is_default DESC,updated_at DESC LIMIT 1').bind(projectId).first<{ layout: string }>();
    const defaultQuery = readDashboardLayout(board?.layout).query;
    const query: MetricQuery = url.searchParams.has('query') ? JSON.parse(url.searchParams.get('query')!) : defaultQuery;
    const errors = queryErrors(query); if (errors.length) return jsonError(errors.join('；'));
    const values = await Promise.all(['spend', 'impressions', 'clicks', 'ctr'].map(async key => {
      if (!binding.metricIds[key]) throw new Error('投放指标绑定不完整');
      return [key, await evaluateCardMetric(projectId, { metricId: binding.metricIds[key], rangePolicy: 'project' }, query)] as const;
    }));
    const trends = await Promise.all(['spend', 'ctr'].map(async key => [key, await evaluateCardMetric(projectId, { metricId: binding.metricIds[key], type: 'time_trend', rangePolicy: 'project' }, query)] as const));
    const channel = binding.roles.channel ? await evaluateCardMetric(projectId, { metricId: binding.metricIds.spend, type: 'breakdown', groupBy: binding.roles.channel, rangePolicy: 'project' }, query) : null;
    const source = await db().prepare('SELECT name,type,spreadsheet,last_error AS lastError,last_synced_at AS syncedAt FROM data_sources WHERE project_id=? AND id=?').bind(projectId, dataset.sourceId).first();
    return Response.json({ ok: true, configured: true, dataset, source, query, defaultQuery, metrics: Object.fromEntries(values), trends: Object.fromEntries(trends), channel }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error instanceof Error ? error.message : '投放数据读取失败', 400); }
}

async function readDomainAnalytics(projectId: string, kind: 'content' | 'comment', url: URL) {
  const setting = await db().prepare('SELECT value FROM project_settings WHERE project_id=? AND key=?').bind(projectId, 'analytics:' + kind).first<{ value: string }>();
  if (!setting) return Response.json({ ok: true, configured: false }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const binding = JSON.parse(setting.value) as { kind: string; datasetId: string; roles: FieldRoles; metricIds: Record<string, string> };
    const dataset = (await getProjectDatasets(projectId)).find(item => item.id === binding.datasetId);
    if (!dataset || binding.kind !== 'dataset_' + kind) throw new DefinitionError('业务来源已移除或配置无效，请重新确认', 409);
    const errors = fieldRoleErrors(dataset, binding.roles);
    if (errors.length) throw new DefinitionError('来源字段已变化，请重新确认：' + errors.join('；'), 409);
    if (kind === 'content' && !binding.roles.contentId && !binding.roles.link || kind === 'comment' && !binding.roles.commentText) throw new DefinitionError('必要业务字段尚未确认', 409);
    try { await validateBusinessRecords(dataset, kind, binding.roles); } catch (error) { throw new DefinitionError('最新来源数据需要修正：' + (error instanceof Error ? error.message : '记录无效'), 409); }
    const board = await db().prepare('SELECT layout_json AS layout FROM dashboards WHERE project_id=? ORDER BY is_default DESC,updated_at DESC LIMIT 1').bind(projectId).first<{ layout: string }>();
    const defaultQuery = readDashboardLayout(board?.layout).query;
    const query: MetricQuery = url.searchParams.has('query') ? JSON.parse(url.searchParams.get('query')!) : defaultQuery;
    const queryValidation = queryErrors(query); if (queryValidation.length) throw new DefinitionError(queryValidation.join('；'));
    const keys = kind === 'content' ? ['records', ...['reads', 'interactions', 'spend'].filter(role => binding.roles[role as keyof FieldRoles])] : ['records', ...['sentiment', 'treatmentStatus'].filter(role => binding.roles[role as keyof FieldRoles])];
    const values = await Promise.all(keys.map(async key => {
      if (!binding.metricIds[key]) throw new DefinitionError('业务指标绑定不完整，请重新确认', 409);
      const result = await evaluateCardMetric(projectId, { metricId: binding.metricIds[key], rangePolicy: 'project' }, query);
      const config = result.effectiveConfig;
      if (result.datasetId !== dataset.id || config?.dateField !== binding.roles.date || key === 'records' && config?.aggregation !== 'count' || key !== 'records' && config?.field !== binding.roles[key as keyof FieldRoles]) throw new DefinitionError('指标规则与业务来源已不一致，请从数据页重新确认；已有指标不会被覆盖', 409);
      return [key, result] as const;
    }));
    const metrics = Object.fromEntries(values), primaryKey = kind === 'content' && metrics.reads ? 'reads' : 'records';
    const trend = binding.roles.date ? await evaluateCardMetric(projectId, { metricId: binding.metricIds[primaryKey], type: 'time_trend', rangePolicy: 'project' }, query) : null;
    const group = async (field?: string) => field ? evaluateCardMetric(projectId, { metricId: binding.metricIds[kind === 'content' ? primaryKey : 'records'], type: 'breakdown', groupBy: field, rangePolicy: 'project' }, query) : null;
    const [channel, sentiment, status, detail] = await Promise.all([
      group(binding.roles.channel), kind === 'comment' ? group(binding.roles.sentiment) : null, kind === 'comment' ? group(binding.roles.treatmentStatus) : null,
      evaluateCardMetric(projectId, { metricId: binding.metricIds.records, type: 'detail_table', rangePolicy: 'project' }, query),
    ]);
    const source = await db().prepare('SELECT name,type,spreadsheet,last_error AS lastError,last_synced_at AS syncedAt FROM data_sources WHERE project_id=? AND id=?').bind(projectId, dataset.sourceId).first<{ name: string; type: string; spreadsheet: string; lastError: string; syncedAt: string }>();
    const page = detail.detail!;
    return Response.json({ ok: true, configured: true, kind, dataset, source: source ? { ...source, url: safeRecordLink(source.spreadsheet) } : null, roles: binding.roles, query, defaultQuery,
      metrics, trend, channel, sentiment, status, records: { ...page, columns: undefined, rows: undefined, items: businessRecords(page.rows, kind, binding.roles, (page.page - 1) * page.pageSize) },
      capabilities: { sourceLabels: true, automaticCollection: false, automaticTreatment: false }, identityPolicy: binding.roles[kind === 'content' ? 'contentId' : 'commentId'] ? 'source_id' : kind === 'content' ? 'source_link' : 'row_position' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error instanceof Error ? error.message : '业务来源读取失败', error instanceof DefinitionError ? error.status : 400); }
}
