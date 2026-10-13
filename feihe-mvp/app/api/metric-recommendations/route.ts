import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { getProjectDatasets } from '@/lib/datasets';
import { recommendMetrics, fieldRoleErrors, type FieldRoles } from '@/lib/metrics/recommendations';
import { evaluateCardMetric } from '@/lib/metrics/engine';
import { saveReusableMetric, getDefinition, DefinitionError } from '@/lib/metrics/definitions';
import { validateCardConfig } from '@/lib/metrics/config';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url), access = await requireProjectAccess(request, url.searchParams.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const dataset = (await getProjectDatasets(access.context!.projectId)).find(item => item.id === url.searchParams.get('datasetId'));
  if (!dataset) return jsonError('请选择本项目已经导入的数据集');
  let roles: FieldRoles | undefined;
  try { if (url.searchParams.has('roles')) roles = JSON.parse(url.searchParams.get('roles')!); } catch { return jsonError('字段对应格式无效'); }
  const roleErrors = roles === undefined ? [] : fieldRoleErrors(dataset, roles); if (roleErrors.length) return jsonError(roleErrors.join('；'));
  const suggested = recommendMetrics(dataset, String(access.context!.project.template_id || 'general_workbench'), roles);
  const recommendations = await Promise.all(suggested.recommendations.map(async item => ({ ...item, preview: await evaluateCardMetric(access.context!.projectId, item.config) })));
  return Response.json({ ok: true, dataset, ...suggested, recommendations }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  let body: { projectId?: string; datasetId?: string; datasetVersion?: number; selected?: string[]; roles?: FieldRoles; bindBusiness?: boolean };
  try { body = await request.json(); } catch { return jsonError('无效的推荐配置'); }
  const access = await requireProjectAccess(request, body.projectId, 'manage');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const context = access.context!, dataset = (await getProjectDatasets(context.projectId)).find(item => item.id === body.datasetId);
  if (!dataset) return jsonError('数据集不属于当前项目');
  if (body.datasetVersion !== dataset.version) return jsonError('数据已更新，请重新读取实际字段后确认推荐', 409);
  const roleErrors = body.roles === undefined ? [] : fieldRoleErrors(dataset, body.roles); if (roleErrors.length) return jsonError(roleErrors.join('；'));
  const plan = recommendMetrics(dataset, String(context.project.template_id || 'general_workbench'), body.roles);
  if (!Array.isArray(body.selected) || !body.selected.length || new Set(body.selected).size !== body.selected.length || body.selected.some(key => !plan.recommendations.some(item => item.key === key))) return jsonError('请选择有效的推荐指标');
  if (body.bindBusiness && (context.project.template_id !== 'ad_performance' || plan.missing.length)) return jsonError('投放分析仍缺少字段：' + plan.missing.join('、'));
  if (body.bindBusiness && ['spend', 'impressions', 'clicks', 'ctr'].some(key => !body.selected!.includes(key))) return jsonError('投放页需要确认广告消耗、曝光、点击与点击率');
  const errors = plan.recommendations.filter(item => body.selected!.includes(item.key)).flatMap(item => validateCardConfig(item.config, [dataset]));
  if (errors.length) return jsonError(errors.join('；'));
  const confirmed: Array<{ metricId: string; key: string; views: typeof plan.recommendations[number]['views'] }> = [];
  try {
    for (const item of plan.recommendations.filter(item => body.selected!.includes(item.key))) {
      const id = context.projectId + ':recommended:' + dataset.id + ':' + encodeURIComponent(item.key);
      let existing;
      try { existing = await getDefinition(context.projectId, id); } catch (error) { if (!(error instanceof DefinitionError && error.status === 404)) throw error; }
      if (existing) {
        const config = existing.protocol.versions.find(version => version.version === existing.protocol.version)!.config;
        for (const key of ['datasetId', 'aggregation', 'field', 'numField', 'denField', 'dateField', 'format', 'unit', 'percentScale', 'missingPolicy', 'ratioBasis'] as const) if ((config[key] || '') !== (item.config[key] || '')) throw new DefinitionError('此推荐指标已有经过编辑的口径，请从指标页确认；不会覆盖已有规则', 409);
      } else await saveReusableMetric(context, { id, name: item.name, config: item.config, expectedVersion: 0 });
      confirmed.push({ metricId: id, key: item.key, views: item.views });
    }
    if (body.bindBusiness) {
      const binding = { kind: 'dataset_ad', datasetId: dataset.id, roles: plan.roles, metricIds: Object.fromEntries(confirmed.map(item => [item.key, item.metricId])), confirmedDatasetVersion: dataset.version };
      await db().prepare("INSERT INTO project_settings(id,project_id,key,value,updated_at) VALUES(?,?,'analytics:ad',?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(context.projectId + ':analytics:ad', context.projectId, JSON.stringify(binding), new Date().toISOString()).run();
    }
    return Response.json({ ok: true, confirmed });
  } catch (error) { return jsonError(error instanceof Error ? error.message : '推荐保存失败', error instanceof DefinitionError ? error.status : 500); }
}
