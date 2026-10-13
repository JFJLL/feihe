import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { logAction } from '@/lib/ops';
import { getProjectDatasets } from '@/lib/datasets';
import { validateCardConfig } from '@/lib/metrics/config';
import { resolveCardDefinition, canonicalCardReference, DefinitionError } from '@/lib/metrics/definitions';
import { applyMetricQuery, canonicalQuery, queryErrors, readDashboardLayout, type DashboardLayout } from '@/lib/metrics/query';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawProject = url.searchParams.get('projectId');
  const access = await requireProjectAccess(request, rawProject, 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  await ensureSchema();
  const d1 = db();

  const dashboards = await d1
    .prepare('SELECT id, project_id AS projectId, name, is_default AS isDefault, version, layout_json AS layoutJson, status, updated_at AS updatedAt FROM dashboards WHERE project_id=? ORDER BY is_default DESC, updated_at DESC')
    .bind(project)
    .all<{ id: string; name: string; version: number }>();

  const requestedDashId = url.searchParams.get('dashboardId');
  const targetDashId = requestedDashId || dashboards.results?.[0]?.id || `dash-${project}-default`;

  const cards = await d1
    .prepare('SELECT id, dashboard_id AS dashboardId, project_id AS projectId, title, type, metric_keys_json AS metricKeysJson, config_json AS configJson, sort_order AS sortOrder, updated_at AS updatedAt FROM dashboard_cards WHERE project_id=? AND dashboard_id=? ORDER BY sort_order ASC')
    .bind(project, targetDashId)
    .all();

  return Response.json({
    ok: true,
    dashboards: dashboards.results || [],
    targetDashboardId: targetDashId,
    cards: cards.results || [],
  });
}

export async function POST(request: Request) {
  let body: {
    projectId?: string;
    dashboardId?: string;
    name?: string;
    version?: number;
    force?: boolean;
    layout?: DashboardLayout;
    cards?: Array<{
      id?: string;
      title: string;
      type: string;
      metricKeys?: string[];
      config?: Record<string, unknown>;
      sortOrder?: number;
    }>;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('无效的请求体');
  }

  const access = await requireProjectAccess(request, body.projectId, 'manage');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  await ensureSchema();
  const d1 = db();
  const now = new Date().toISOString();
  const dashboardId = String(body.dashboardId || `dash-${project}-default`);
  if (body.version !== undefined && (!Number.isInteger(body.version) || body.version < 0)) return jsonError('看板版本必须是非负整数');
  if (!Array.isArray(body.cards)) return jsonError('请提交明确的卡片数组，空看板请提交 []');
  const owner = await d1.prepare('SELECT project_id FROM dashboards WHERE id=?').bind(dashboardId).first<{ project_id: string }>();
  if (owner && owner.project_id !== project) return jsonError('看板不属于当前项目', 403);

  // Optimistic concurrency check: version must match unless force is true
  if (body.version !== undefined && !body.force) {
    const existing = await d1.prepare('SELECT version FROM dashboards WHERE id=? AND project_id=?').bind(dashboardId, project).first<{ version: number }>();
    if (existing && existing.version !== body.version) {
      return Response.json({
        ok: false,
        error: `看板已被其他成员修改（当前版本 v${existing.version}，您的版本 v${body.version}），检测到并发冲突`,
        conflict: true,
        serverVersion: existing.version,
      }, { status: 409 });
    }
  }

  const existingRecord = await d1.prepare('SELECT version,layout_json AS layoutJson FROM dashboards WHERE id=? AND project_id=?').bind(dashboardId, project).first<{ version: number; layoutJson: string }>();
  const newVersion = Math.max(existingRecord?.version || 0, body.version || 0) + 1;
  const cards = Array.isArray(body.cards) ? body.cards : [];
  if (body.layout !== undefined) {
    if (body.layout?.kind !== 'project_board' || body.layout.version !== 1) return jsonError('不支持的看板布局配置');
    const errors = queryErrors(body.layout.query);
    if (errors.length) return jsonError(errors.join('；'));
  }
  const layoutJson = body.layout ? JSON.stringify({ kind: 'project_board', version: 1, query: canonicalQuery(body.layout.query) }) : existingRecord?.layoutJson || JSON.stringify(readDashboardLayout());
  const query = readDashboardLayout(layoutJson).query;

  const datasets = await getProjectDatasets(project);
  const errors: string[] = [];
  const references: Record<string, unknown>[] = [];
  for (const [i, card] of cards.entries()) {
    try {
      const resolved = await resolveCardDefinition(project, { ...card.config, title: card.title, type: card.type });
      const reference = canonicalCardReference(card.config || {});
      references[i] = { ...reference, ...(reference.target !== undefined && resolved.definition ? { targetMetricVersion: resolved.definition.version } : {}) };
      const context = applyMetricQuery(resolved.config, query);
      errors.push(...validateCardConfig(context.config, datasets, true).map(error => '卡片 ' + (i + 1) + '：' + error));
      const dataset = datasets.find(item => item.id === context.config.datasetId || item.sourceId === context.config.datasetId);
      for (const filter of context.filters) if (!dataset?.columns.some(column => column.key === filter.key)) errors.push('卡片 ' + (i + 1) + '：共同筛选字段不属于指标来源：' + filter.key);
    }
    catch (error) { if (error instanceof DefinitionError) errors.push('卡片 ' + (i + 1) + '：' + error.message); else throw error; }
  }
  if (errors.length) return Response.json({ ok: false, error: errors.join('；'), validationErrors: errors }, { status: 400 });
  const confirmedCards = cards.map((card, index) => ({ id: card.id || 'card-' + crypto.randomUUID(), title: card.title, type: card.type, configJson: JSON.stringify(references[index]), metricKeysJson: JSON.stringify(card.metricKeys || []), sortOrder: card.sortOrder ?? index }));
  if (new Set(confirmedCards.map(c => c.id)).size !== confirmedCards.length) return jsonError('卡片 ID 重复');
  const saveStamp = crypto.randomUUID();
  try {
    const expectedVersion = existingRecord?.version || 0;
    const statements = [d1.prepare("INSERT INTO dashboards(id, project_id, name, is_default, version, layout_json, status, created_at, updated_at, save_token) VALUES(?, ?, ?, 1, ?, ?, 'published', ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, version=excluded.version, layout_json=excluded.layout_json, status=excluded.status, updated_at=excluded.updated_at, save_token=excluded.save_token WHERE dashboards.project_id=excluded.project_id AND dashboards.version=?")
    .bind(dashboardId, project, String(body.name || '默认看板'), newVersion, layoutJson, now, now, saveStamp, expectedVersion),
    d1.prepare('DELETE FROM dashboard_cards WHERE dashboard_id=? AND project_id=? AND EXISTS (SELECT 1 FROM dashboards WHERE id=? AND project_id=? AND save_token=?)').bind(dashboardId, project, dashboardId, project, saveStamp)];
    for (const card of confirmedCards) statements.push(d1.prepare(
      'INSERT INTO dashboard_cards(id, dashboard_id, project_id, title, type, metric_keys_json, config_json, sort_order, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM dashboards WHERE id=? AND project_id=? AND save_token=?)'
    ).bind(card.id, dashboardId, project, card.title, card.type, card.metricKeysJson, card.configJson, card.sortOrder, now, now, dashboardId, project, saveStamp));
    await d1.batch(statements);
    const confirmed = await d1.prepare('SELECT version, save_token FROM dashboards WHERE id=? AND project_id=?').bind(dashboardId, project).first<{ version: number; save_token: string }>();
    if (!confirmed || confirmed.save_token !== saveStamp) return Response.json({ ok: false, conflict: true, error: '看板版本发生变化，请保留草稿后重新确认', serverVersion: confirmed?.version }, { status: 409 });
    await logAction('更新看板配置', 'dashboard', dashboardId, '更新 ' + cards.length + ' 张卡片 (v' + newVersion + ')', project, access.context!.user.userId);
    return Response.json({ ok: true, dashboardId, version: confirmed.version, cardCount: confirmedCards.length, cards: confirmedCards, layout: readDashboardLayout(layoutJson) });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : '保存看板失败', 500);
  }
}
