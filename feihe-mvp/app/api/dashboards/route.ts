import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { logAction } from '@/lib/ops';

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

  // Optimistic concurrency check: version must match unless force is true
  if (body.version !== undefined && !body.force) {
    const existing = await d1.prepare('SELECT version FROM dashboards WHERE id=? AND project_id=?').bind(dashboardId, project).first<{ version: number }>();
    if (existing && existing.version > body.version) {
      return Response.json({
        ok: false,
        error: `看板已被其他成员修改（当前版本 v${existing.version}，您的版本 v${body.version}），检测到并发冲突`,
        conflict: true,
        serverVersion: existing.version,
      }, { status: 409 });
    }
  }

  const existingRecord = await d1.prepare('SELECT version FROM dashboards WHERE id=? AND project_id=?').bind(dashboardId, project).first<{ version: number }>();
  const newVersion = Math.max(existingRecord?.version || 0, body.version || 0) + 1;
  const cards = Array.isArray(body.cards) ? body.cards : [];

  try {
    await d1.prepare('BEGIN TRANSACTION').run();

    await d1
      .prepare(
        `INSERT INTO dashboards(id, project_id, name, is_default, version, layout_json, status, created_at, updated_at)
      VALUES(?, ?, ?, 1, ?, '[]', 'published', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, version=excluded.version, updated_at=excluded.updated_at`
      )
      .bind(dashboardId, project, String(body.name || '默认看板'), newVersion, now, now)
      .run();

    // Clear old cards for this dashboard
    await d1.prepare('DELETE FROM dashboard_cards WHERE dashboard_id=? AND project_id=?').bind(dashboardId, project).run();

    // Insert new cards
    for (const [index, card] of cards.entries()) {
      const cardId = card.id || `card-${project}-${Date.now()}-${index}`;
      const metricKeysJson = JSON.stringify(card.metricKeys || []);
      const configJson = JSON.stringify(card.config || {});
      await d1
        .prepare(
          `INSERT INTO dashboard_cards(id, dashboard_id, project_id, title, type, metric_keys_json, config_json, sort_order, created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(cardId, dashboardId, project, String(card.title || '卡片'), String(card.type || 'metric_card'), metricKeysJson, configJson, card.sortOrder ?? index, now, now)
        .run();
    }

    await d1.prepare('COMMIT').run();
    await logAction('更新看板配置', 'dashboard', dashboardId, `更新 ${cards.length} 张卡片 (v${newVersion})`, project);

    return Response.json({ ok: true, dashboardId, version: newVersion, cardCount: cards.length });
  } catch (err) {
    try {
      await d1.prepare('ROLLBACK').run();
    } catch {}
    return jsonError(err instanceof Error ? err.message : '保存看板失败', 500);
  }
}
