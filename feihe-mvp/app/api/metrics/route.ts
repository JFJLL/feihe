import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { computeMetric, evaluateCardMetric, getProjectMetrics, type CardMetricConfig } from '@/lib/metrics/engine';
import { logAction } from '@/lib/ops';
import { getProjectDatasets } from '@/lib/datasets';
import { validateCardConfig } from '@/lib/metrics/config';
import { DefinitionError, definitionProtocol } from '@/lib/metrics/definitions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawProject = url.searchParams.get('projectId');
  const access = await requireProjectAccess(request, rawProject, 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  const key = url.searchParams.get('key') || url.searchParams.get('metric');
  if (key) {
    const from = url.searchParams.get('from') || undefined;
    const to = url.searchParams.get('to') || undefined;
    const source = url.searchParams.get('source') || url.searchParams.get('datasetId') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const scope = url.searchParams.get('scope') || undefined;
    const groupBy = url.searchParams.get('groupBy') || undefined;

    const result = await computeMetric(project, key, { from, to, source, status, scope, groupBy });
    return Response.json({ ok: true, metric: result });
  }

  const metrics = await getProjectMetrics(project);
  return Response.json({ ok: true, metrics });
}

export async function POST(request: Request) {
  let body: {
    projectId?: string;
    action?: string;
    card?: CardMetricConfig;
    cards?: CardMetricConfig[];
    key?: string;
    name?: string;
    description?: string;
    unit?: string;
    aggregation?: string;
    formula?: string;
    format?: string;
    filterJson?: string;
    percentScale?: CardMetricConfig['percentScale'];
    ratioBasis?: CardMetricConfig['ratioBasis'];
    missingPolicy?: CardMetricConfig['missingPolicy'];
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('无效的请求体');
  }

  // Handle batch evaluation or single card preview (requires read access)
  if (body.action === 'evaluate' || body.cards || body.card) {
    const access = await requireProjectAccess(request, body.projectId, 'read');
    if (!access.ok) return jsonError(access.error!, access.status!);
    const project = access.context!.projectId;

    if (body.card) {
      const errors = validateCardConfig(body.card, await getProjectDatasets(project));
      if (errors.length) return Response.json({ ok: false, error: errors.join('；'), validationErrors: errors }, { status: 400 });
      try { return Response.json({ ok: true, metric: await evaluateCardMetric(project, body.card) }); }
      catch (error) { return jsonError(error instanceof Error ? error.message : '指标计算失败', error instanceof DefinitionError ? error.status : 500); }
    }

    if (Array.isArray(body.cards)) {
      const datasets = await getProjectDatasets(project);
      const metrics = await Promise.all(body.cards.map(async c => {
        const errors = validateCardConfig(c, datasets);
        try { return errors.length ? { key: c.metric || 'custom', name: c.title || '指标', value: null, formattedValue: '—', sampleSize: 0, status: 'error', statusLabel: errors.join('；'), validationErrors: errors } : await evaluateCardMetric(project, c); }
        catch (error) { return { key: c.metricId || c.metric || 'custom', name: c.title || '指标', value: null, formattedValue: '—', sampleSize: 0, status: 'error', statusLabel: error instanceof Error ? error.message : '指标计算失败' }; }
      }));
      return Response.json({ ok: true, metrics });
    }
  }

  // Handle saving metric definition (requires manage access)
  const access = await requireProjectAccess(request, body.projectId, 'manage');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  const key = String(body.key || '').trim();
  const name = String(body.name || '').trim();
  if (!key || !name) return jsonError('请填写指标标识与指标名称');

  await ensureSchema();
  const d1 = db();
  const id = `${project}:${key}`;
  const current = await d1.prepare('SELECT filter_json AS filterJson FROM metric_definitions WHERE key=? AND project_id=?').bind(key, project).first<{ filterJson: string }>();
  if (definitionProtocol(current?.filterJson)) return jsonError('请从项目指标页编辑共享定义，不能绕过版本确认', 409);
  const now = new Date().toISOString();
  let protocol: Record<string, unknown>;
  try { protocol = JSON.parse(body.filterJson || '{}'); } catch { return jsonError('指标配置必须是合法 JSON'); }
  if (!protocol || typeof protocol !== 'object' || Array.isArray(protocol)) return jsonError('指标配置必须是对象');
  for (const option of ['percentScale', 'ratioBasis', 'missingPolicy'] as const) {
    if (body[option] !== undefined) protocol[option] = body[option];
  }
  if (protocol.percentScale && !['fraction', 'percentage_points'].includes(String(protocol.percentScale))) return jsonError('不支持的百分比数值口径');
  if (protocol.ratioBasis && !['paired', 'independent'].includes(String(protocol.ratioBasis))) return jsonError('不支持的比率样本口径');
  if (protocol.missingPolicy && !['skip', 'zero'].includes(String(protocol.missingPolicy))) return jsonError('不支持的缺失值规则');
  if (body.aggregation !== 'ratio' && (body.format === 'percent' || body.unit === '%') && !protocol.percentScale) return jsonError('请明确百分比数值口径，历史配置不会自动转换');

  try {
    await d1
      .prepare(
        `INSERT INTO metric_definitions(id, project_id, key, name, description, unit, aggregation, formula, format, filter_json, aliases_json, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, description=excluded.description, unit=excluded.unit, aggregation=excluded.aggregation, formula=excluded.formula, format=excluded.format, filter_json=excluded.filter_json, updated_at=excluded.updated_at`
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
        JSON.stringify(protocol),
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
