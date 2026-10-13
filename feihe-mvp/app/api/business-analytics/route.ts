import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { getProjectDatasets } from '@/lib/datasets';
import { evaluateCardMetric } from '@/lib/metrics/engine';
import { queryErrors, readDashboardLayout, type MetricQuery } from '@/lib/metrics/query';
import { fieldRoleErrors } from '@/lib/metrics/recommendations';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url), access = await requireProjectAccess(request, url.searchParams.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const projectId = access.context!.projectId;
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
