import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { computeMetric, getProjectMetrics } from '@/lib/metrics/engine';
import { logAction } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawProject = url.searchParams.get('projectId');
  const access = await requireProjectAccess(request, rawProject, 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  const key = url.searchParams.get('key');
  if (key) {
    const from = url.searchParams.get('from') || undefined;
    const to = url.searchParams.get('to') || undefined;
    const source = url.searchParams.get('source') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const scope = url.searchParams.get('scope') || undefined;

    const result = await computeMetric(project, key, { from, to, source, status, scope });
    return Response.json({ ok: true, metric: result });
  }

  const metrics = await getProjectMetrics(project);
  return Response.json({ ok: true, metrics });
}

export async function POST(request: Request) {
  let body: {
    projectId?: string;
    key?: string;
    name?: string;
    description?: string;
    unit?: string;
    aggregation?: string;
    formula?: string;
    format?: string;
    filterJson?: string;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('无效的请求体');
  }

  const access = await requireProjectAccess(request, body.projectId, 'manage');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  const key = String(body.key || '').trim();
  const name = String(body.name || '').trim();
  if (!key || !name) return jsonError('请填写指标标识与指标名称');

  await ensureSchema();
  const d1 = db();
  const id = `${project}:${key}`;
  const now = new Date().toISOString();

  try {
    await d1
      .prepare(
        `INSERT INTO metric_definitions(id, project_id, key, name, description, unit, aggregation, formula, format, aliases_json, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, description=excluded.description, unit=excluded.unit, aggregation=excluded.aggregation, formula=excluded.formula, format=excluded.format, updated_at=excluded.updated_at`
      )
      .bind(
        id,
        project,
        key,
        name,
        String(body.description || ''),
        String(body.unit || ''),
        String(body.aggregation || 'sum'),
        String(body.formula || ''),
        String(body.format || 'number'),
        now,
        now
      )
      .run();

    await logAction('配置指标定义', 'metric_definition', id, `${name} (${key})`, project);
    return Response.json({ ok: true, id, key });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : '保存指标失败', 500);
  }
}
