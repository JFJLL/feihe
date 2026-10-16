import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { getProjectDatasets } from '@/lib/datasets';
import { listReusableMetrics, saveReusableMetric, getDefinition, standardNamespace, DefinitionError } from '@/lib/metrics/definitions';
import type { CardMetricConfig } from '@/lib/metrics/config';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const access = await requireProjectAccess(request, new URL(request.url).searchParams.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const context = access.context!;
  const [metrics, standards, datasets] = await Promise.all([listReusableMetrics(context.projectId), listReusableMetrics(standardNamespace(context.user.orgId)), getProjectDatasets(context.projectId)]);
  return Response.json({ ok: true, metrics, standards, datasets, canManage: context.canManage && !context.project.is_archived, canMaintainStandards: context.isPlatformAdmin }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  let body: { projectId?: string; action?: string; metricId?: string; id?: string; name?: string; description?: string; config?: CardMetricConfig; expectedVersion?: number; standardId?: string; standardVersion?: number };
  try { body = await request.json(); } catch { return jsonError('无效的请求体'); }
  const access = await requireProjectAccess(request, body.projectId, 'manage');
  if (!access.ok) return jsonError(access.error!, access.status!);
  try {
    const context = access.context!;
    if (body.action === 'publish_standard') {
      if (!context.isPlatformAdmin) return jsonError('需要平台管理员维护公司标准模板', 403);
      const metric = await getDefinition(context.projectId, String(body.metricId || ''));
      const config = metric.protocol.versions.find(item => item.version === metric.protocol.version)!.config;
      return Response.json({ ok: true, ...await saveReusableMetric(context, { ...body, name: body.name || metric.row.name, config }, true) });
    }
    if (body.action !== 'save') return jsonError('不支持的指标操作');
    return Response.json({ ok: true, ...await saveReusableMetric(context, body) });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : '保存指标失败', serverVersion: error instanceof DefinitionError ? error.serverVersion : undefined }, { status: error instanceof DefinitionError ? error.status : 500 });
  }
}
