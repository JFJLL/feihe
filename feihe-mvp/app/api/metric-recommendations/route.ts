import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { getProjectDatasets } from '@/lib/datasets';
import { recommendMetrics, fieldRoleErrors, supportsBusinessDomain, defaultBusinessDomain, requiredBusinessMetricKeys, type BusinessDomain, type FieldRoles } from '@/lib/metrics/recommendations';
import { evaluateCardMetric } from '@/lib/metrics/engine';
import { prepareReusableMetric, getDefinition, DefinitionError } from '@/lib/metrics/definitions';
import { validateCardConfig } from '@/lib/metrics/config';
import { validateBusinessRecords } from '@/lib/business-records';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url), access = await requireProjectAccess(request, url.searchParams.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const dataset = (await getProjectDatasets(access.context!.projectId)).find(item => item.id === url.searchParams.get('datasetId'));
  if (!dataset) return jsonError('请选择本项目已经导入的数据集');
  let roles: FieldRoles | undefined;
  try { if (url.searchParams.has('roles')) roles = JSON.parse(url.searchParams.get('roles')!); } catch { return jsonError('字段对应格式无效'); }
  const roleErrors = roles === undefined ? [] : fieldRoleErrors(dataset, roles); if (roleErrors.length) return jsonError(roleErrors.join('；'));
  const templateId = String(access.context!.project.template_id || 'general_workbench'), domain = url.searchParams.get('domain') || defaultBusinessDomain(templateId);
  if (domain && !supportsBusinessDomain(templateId, domain)) return jsonError('此项目未启用该业务模块');
  const suggested = recommendMetrics(dataset, templateId, roles, domain as BusinessDomain | undefined);
  const recommendations = await Promise.all(suggested.recommendations.map(async item => ({ ...item, preview: await evaluateCardMetric(access.context!.projectId, item.config) })));
  return Response.json({ ok: true, dataset, ...suggested, recommendations }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  let body: { projectId?: string; datasetId?: string; datasetVersion?: number; selected?: string[]; roles?: FieldRoles; bindBusiness?: boolean; domain?: BusinessDomain };
  try { body = await request.json(); } catch { return jsonError('无效的推荐配置'); }
  const access = await requireProjectAccess(request, body.projectId, 'manage');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const context = access.context!, dataset = (await getProjectDatasets(context.projectId)).find(item => item.id === body.datasetId);
  if (!dataset) return jsonError('数据集不属于当前项目');
  if (body.datasetVersion !== dataset.version) return jsonError('数据已更新，请重新读取实际字段后确认推荐', 409);
  const roleErrors = body.roles === undefined ? [] : fieldRoleErrors(dataset, body.roles); if (roleErrors.length) return jsonError(roleErrors.join('；'));
  const templateId = String(context.project.template_id || 'general_workbench'), domain = body.domain || defaultBusinessDomain(templateId);
  if (domain && !supportsBusinessDomain(templateId, domain)) return jsonError('此项目未启用该业务模块');
  const plan = recommendMetrics(dataset, templateId, body.roles, domain);
  if (!Array.isArray(body.selected) || !body.selected.length || new Set(body.selected).size !== body.selected.length || body.selected.some(key => !plan.recommendations.some(item => item.key === key))) return jsonError('请选择有效的推荐指标');
  if (body.bindBusiness && (!domain || plan.missing.length)) return jsonError('业务分析仍缺少字段：' + plan.missing.join('、'));
  const requiredKeys = requiredBusinessMetricKeys(domain, plan.roles);
  if (body.bindBusiness && requiredKeys.some(key => !body.selected!.includes(key))) return jsonError('业务页需要确认所有已对应字段的推荐指标；也可先只创建所选指标');
  const errors = plan.recommendations.filter(item => body.selected!.includes(item.key)).flatMap(item => validateCardConfig(item.config, [dataset]));
  if (errors.length) return jsonError(errors.join('；'));
  const confirmed: Array<{ metricId: string; key: string; views: typeof plan.recommendations[number]['views'] }> = [];
  try {
    if (body.bindBusiness) await validateBusinessRecords(dataset, domain!, plan.roles);
    const guard = { condition: 'EXISTS(SELECT 1 FROM datasets WHERE project_id=? AND id=? AND version=?)', values: [context.projectId, dataset.id, dataset.version] as unknown[] };
    const prepared = [], snapshots: Array<{ id: string; json: string }> = [];
    for (const item of plan.recommendations.filter(item => body.selected!.includes(item.key))) {
      const id = context.projectId + ':recommended:' + dataset.id + ':' + encodeURIComponent(item.key);
      let existing;
      try { existing = await getDefinition(context.projectId, id); } catch (error) { if (!(error instanceof DefinitionError && error.status === 404)) throw error; }
      if (existing) {
        const config = existing.protocol.versions.find(version => version.version === existing.protocol.version)!.config;
        for (const key of ['datasetId', 'aggregation', 'field', 'numField', 'denField', 'dateField', 'format', 'unit', 'percentScale', 'missingPolicy', 'ratioBasis'] as const) if ((config[key] || '') !== (item.config[key] || '')) throw new DefinitionError('此推荐指标已有经过编辑的口径，请从指标页确认；不会覆盖已有规则', 409);
        snapshots.push({ id, json: existing.row.filterJson });
      } else {
        const metric = await prepareReusableMetric(context, { id, name: item.name, config: item.config, expectedVersion: 0 }, false, guard);
        prepared.push(metric); snapshots.push({ id, json: metric.json });
      }
      confirmed.push({ metricId: id, key: item.key, views: item.views });
    }
    const statements = prepared.flatMap(metric => metric.statements), confirmationToken = crypto.randomUUID();
    const metricGuard = snapshots.map(() => 'EXISTS(SELECT 1 FROM metric_definitions WHERE project_id=? AND id=? AND filter_json=?)').join(' AND ');
    if (body.bindBusiness) {
      const metricIds = Object.fromEntries(confirmed.map(item => [item.key === 'content_records' || item.key === 'comment_records' ? 'records' : item.key, item.metricId]));
      const binding = { kind: 'dataset_' + domain, datasetId: dataset.id, roles: plan.roles, metricIds, confirmedDatasetVersion: dataset.version, confirmationToken };
      const settingKey = 'analytics:' + domain;
      statements.push(db().prepare('INSERT INTO project_settings(id,project_id,key,value,updated_at) SELECT ?,?,?,?,? WHERE ' + guard.condition + ' AND ' + metricGuard + ' ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at')
        .bind(context.projectId + ':' + settingKey, context.projectId, settingKey, JSON.stringify(binding), new Date().toISOString(), ...guard.values, ...snapshots.flatMap(metric => [context.projectId, metric.id, metric.json])));
    }
    if (statements.length) {
      await db().batch(statements);
      if (body.bindBusiness) {
        const setting = await db().prepare('SELECT value FROM project_settings WHERE project_id=? AND key=?').bind(context.projectId, 'analytics:' + domain).first<{ value: string }>();
        if (!setting || JSON.parse(setting.value).confirmationToken !== confirmationToken) throw new DefinitionError('数据或指标在确认期间发生变化，请重新读取后确认', 409);
      }
    }
    const currentDataset = (await getProjectDatasets(context.projectId)).find(item => item.id === dataset.id);
    if (currentDataset?.version !== dataset.version) throw new DefinitionError('数据在确认期间发生变化，请重新读取后确认', 409);
    for (const metric of prepared) await metric.confirm();
    return Response.json({ ok: true, confirmed });
  } catch (error) { return jsonError(error instanceof Error ? error.message : '推荐保存失败', error instanceof DefinitionError ? error.status : 500); }
}
