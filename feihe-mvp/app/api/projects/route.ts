import { getAuthenticatedUser, requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';
const text = (value: unknown) => String(value || '').trim();
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || `project-${crypto.randomUUID().slice(0, 8)}`;

export async function GET(request?: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return jsonError('请先登录', 401);

  await ensureSchema();
  const d1 = db();

  const isPlatformAdmin = user.role === 'platform_admin';
  const filterClause = isPlatformAdmin
    ? '1=1'
    : `(p.id IN (SELECT project_id FROM project_members WHERE user_id='${user.userId}') OR p.created_by='${user.userId}' OR p.owner_id='${user.userId}')`;

  const [projects, sources, departments, clients, templates] = await Promise.all([
    d1
      .prepare(
        `SELECT p.id, p.name, p.spu, p.brand, p.category, p.description, p.status, p.color,
        p.start_at AS startAt, p.end_at AS endAt, p.org_id AS orgId, p.department_id AS departmentId,
        p.client_id AS clientId, p.owner_id AS ownerId, p.template_id AS templateId,
        p.is_archived AS isArchived, p.onboarding_status AS onboardingStatus,
        p.updated_at AS updatedAt,
        COUNT(DISTINCT pn.note_id) AS noteCount,
        SUM(CASE WHEN pn.status='符合且能汇报' THEN 1 ELSE 0 END) AS reportableCount,
        d.name AS departmentName,
        c.name AS clientName,
        t.name AS templateName
        FROM projects p
        LEFT JOIN project_notes pn ON pn.project_id=p.id
        LEFT JOIN departments d ON d.id=p.department_id
        LEFT JOIN clients c ON c.id=p.client_id
        LEFT JOIN project_templates t ON t.id=p.template_id
        WHERE ${filterClause}
        GROUP BY p.id
        ORDER BY CASE p.status WHEN '进行中' THEN 0 WHEN '筹备中' THEN 1 WHEN '已结束' THEN 2 ELSE 3 END, p.updated_at DESC`
      )
      .all(),
    d1
      .prepare(
        `SELECT s.id, s.project_id AS projectId, s.type, s.name, s.spreadsheet, s.sheet_id AS sheetId,
        s.range, s.kind, s.sync_frequency AS syncFrequency, s.status, s.last_synced_at AS lastSyncedAt,
        s.last_row_count AS lastRowCount, s.mapping_json AS mappingJson, s.last_error AS lastError,
        s.updated_at AS updatedAt
        FROM data_sources s
        JOIN projects p ON p.id=s.project_id
        WHERE ${filterClause}
        ORDER BY s.updated_at DESC`
      )
      .all(),
    d1.prepare('SELECT id, name FROM departments ORDER BY name').all(),
    d1.prepare('SELECT id, name, industry FROM clients ORDER BY name').all(),
    d1.prepare('SELECT id, name, description, icon, modules_json AS modulesJson FROM project_templates ORDER BY name').all(),
  ]);

  return Response.json({
    ok: true,
    projects: projects.results,
    sources: sources.results,
    metadata: {
      departments: departments.results,
      clients: clients.results,
      templates: templates.results,
      currentUser: user,
    },
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError('无效的请求数据');
  }

  const action = text(body.action);
  const now = new Date().toISOString();
  await ensureSchema();
  const d1 = db();

  if (action === 'create') {
    const user = await getAuthenticatedUser(request);
    if (!user) return jsonError('请先登录', 401);

    const name = text(body.name);
    if (!name) return jsonError('请填写项目名称');

    const templateId = text(body.templateId) || 'general_workbench';
    const departmentId = text(body.departmentId) || 'dept-general';
    const clientId = text(body.clientId) || null;
    const ownerId = text(body.ownerId) || user.userId;
    const status = text(body.status) || '筹备中';
    const color = text(body.color) || '#1769d5';
    const description = text(body.description);
    const spu = text(body.spu);
    const brand = text(body.brand);
    const category = text(body.category);
    const startAt = text(body.startAt) || null;
    const endAt = text(body.endAt) || null;

    let id = text(body.id) ? slug(text(body.id)) : slug(name);
    const exists = await d1.prepare('SELECT id FROM projects WHERE id=?').bind(id).first();
    if (exists) id = `${id}-${Date.now().toString(36).slice(-4)}`;

    await d1
      .prepare(
        `INSERT INTO projects(id, name, spu, brand, category, description, status, color, start_at, end_at,
        org_id, department_id, client_id, owner_id, template_id, is_archived, onboarding_status, created_by, created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'org-default', ?, ?, ?, ?, 0, 'source', ?, ?, ?)`
      )
      .bind(id, name, spu, brand, category, description, status, color, startAt, endAt, departmentId, clientId, ownerId, templateId, user.userId, now, now)
      .run();

    // Add creator as project administrator
    await d1
      .prepare(`INSERT OR IGNORE INTO project_members(id, project_id, user_id, role, created_at, updated_at) VALUES(?, ?, ?, 'project_admin', ?, ?)`)
      .bind(`${id}:${user.userId}`, id, user.userId, now, now)
      .run();

    // Initialize onboarding state
    await d1
      .prepare(`INSERT OR IGNORE INTO project_onboarding(project_id, current_step, completed_steps_json, selected_template_id, updated_at) VALUES(?, 'source', '["template"]', ?, ?)`)
      .bind(id, templateId, now)
      .run();

    // Create default dashboard from template
    const templateRow = await d1.prepare('SELECT default_dashboard_json FROM project_templates WHERE id=?').bind(templateId).first<{ default_dashboard_json: string }>();
    let cards: Array<Record<string, unknown>> = [];
    if (templateRow?.default_dashboard_json) {
      try {
        const parsed = JSON.parse(templateRow.default_dashboard_json) as { cards?: Array<Record<string, unknown>> };
        cards = parsed.cards || [];
      } catch {}
    }

    const dashboardId = `dash-${id}-default`;
    await d1
      .prepare(`INSERT OR IGNORE INTO dashboards(id, project_id, name, is_default, version, layout_json, status, created_at, updated_at) VALUES(?, ?, '默认看板', 1, 1, '[]', 'published', ?, ?)`)
      .bind(dashboardId, id, now, now)
      .run();

    for (const [index, card] of cards.entries()) {
      const cardId = `card-${id}-${card.id || index + 1}`;
      await d1
        .prepare(`INSERT OR IGNORE INTO dashboard_cards(id, dashboard_id, project_id, title, type, metric_keys_json, config_json, sort_order, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(cardId, dashboardId, id, String(card.title || '指标卡'), String(card.type || 'metric_card'), JSON.stringify(card.metric ? [card.metric] : []), JSON.stringify(card), index, now, now)
        .run();
    }

    // Only configure marketing/comment pipelines if this project explicitly selected those templates!
    if (templateId === 'content_marketing') {
      const pipelines = [
        ['viral', '口碑爆文维护', 200],
        ['value_scan', '价值内容扫描', 60],
        ['commercial', '商业内容执行', 300],
      ] as const;
      await d1.batch(
        pipelines.map(([key, label, target]) =>
          d1.prepare(`INSERT INTO project_pipelines(id,project_id,key,name,target_count) VALUES(?,?,?,?,?)`).bind(`${id}:${key}`, id, key, label, target)
        )
      );
      if (brand || spu) {
        const rules = {
          brands: [brand, spu].filter(Boolean),
          competitors: [],
          positiveWords: ['好用', '推荐', '喜欢', '有效', '值得'],
          negativeWords: ['不好', '踩雷', '失望', '问题', '投诉'],
          questionWords: ['吗', '怎么', '多少', '哪里买'],
          sellingWords: ['出售', '加微', '低价出'],
          irrelevantWords: ['互赞', '打卡', '路过'],
          deleteCompetitorMentions: false,
        };
        await d1
          .prepare(`INSERT INTO project_settings(id,project_id,key,value,updated_at) VALUES(?,?,?,?,?)`)
          .bind(`${id}:rules`, id, 'rules', JSON.stringify(rules), now)
          .run();
      }
    } else if (templateId === 'comment_qc') {
      await d1
        .prepare(`INSERT INTO project_settings(id,project_id,key,value,updated_at) VALUES(?,?,?,?,?)`)
        .bind(`${id}:acceptance`, id, 'acceptance', JSON.stringify({ reportCount: 200, baseCount: 30, brandTopRate: 0.4, freshnessHours: 24, supplierSimilarity: 0.58 }), now)
        .run();
    }

    return Response.json({ ok: true, id, templateId });
  }

  // All other actions require existing project access check
  const rawId = body.projectId;
  const access = await requireProjectAccess(request, rawId, action === 'delete' ? 'admin' : 'manage');
  if (!access.ok) return jsonError(access.error!, access.status!);

  const id = access.context!.projectId;

  if (action === 'update') {
    await d1
      .prepare(
        `UPDATE projects SET name=?, spu=?, brand=?, category=?, description=?, status=?, color=?,
        department_id=?, client_id=?, owner_id=?, start_at=?, end_at=?, updated_at=? WHERE id=?`
      )
      .bind(
        text(body.name),
        text(body.spu),
        text(body.brand),
        text(body.category),
        text(body.description),
        text(body.status) || '进行中',
        text(body.color) || '#1769d5',
        text(body.departmentId) || 'dept-general',
        text(body.clientId) || null,
        text(body.ownerId) || access.context!.user.userId,
        text(body.startAt) || null,
        text(body.endAt) || null,
        now,
        id
      )
      .run();
    return Response.json({ ok: true, id });
  }

  if (action === 'archive') {
    await d1.prepare(`UPDATE projects SET is_archived=1, status='已归档', archived_at=?, updated_at=? WHERE id=?`).bind(now, now, id).run();
    return Response.json({ ok: true, id, status: '已归档' });
  }

  if (action === 'restore') {
    await d1.prepare(`UPDATE projects SET is_archived=0, status='进行中', archived_at=NULL, updated_at=? WHERE id=?`).bind(now, id).run();
    return Response.json({ ok: true, id, status: '进行中' });
  }

  if (action === 'delete') {
    if (!access.context!.isPlatformAdmin) {
      return jsonError('仅平台超级管理员可执行彻底删除操作', 403);
    }
    await d1.batch([
      d1.prepare('DELETE FROM project_members WHERE project_id=?').bind(id),
      d1.prepare('DELETE FROM data_sources WHERE project_id=?').bind(id),
      d1.prepare('DELETE FROM dashboards WHERE project_id=?').bind(id),
      d1.prepare('DELETE FROM dashboard_cards WHERE project_id=?').bind(id),
      d1.prepare('DELETE FROM datasets WHERE project_id=?').bind(id),
      d1.prepare('DELETE FROM dataset_rows WHERE project_id=?').bind(id),
      d1.prepare('DELETE FROM sync_jobs WHERE project_id=?').bind(id),
      d1.prepare('DELETE FROM note_project_profiles WHERE project_id=?').bind(id),
      d1.prepare('DELETE FROM project_notes WHERE project_id=?').bind(id),
      d1.prepare('DELETE FROM supplier_comments WHERE project_id=?').bind(id),
      d1.prepare('DELETE FROM project_settings WHERE project_id=?').bind(id),
      d1.prepare('DELETE FROM projects WHERE id=?').bind(id),
    ]);
    return Response.json({ ok: true, id, deleted: true });
  }

  if (action === 'save_source') {
    const sourceId = text(body.id) || crypto.randomUUID();
    const name = text(body.name);
    if (!name) return jsonError('请填写数据源名称');
    let mapping = '{}';
    try {
      mapping = typeof body.mappingJson === 'string' ? JSON.stringify(JSON.parse(body.mappingJson)) : JSON.stringify(body.mappingJson || {});
    } catch {
      return jsonError('字段映射必须是合法 JSON');
    }
    const status = text(body.status) || (text(body.spreadsheet) && text(body.sheetId) ? '已连接' : '未连接');
    await d1
      .prepare(
        `INSERT INTO data_sources(id,project_id,type,name,spreadsheet,sheet_id,range,kind,sync_frequency,status,mapping_json,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,spreadsheet=excluded.spreadsheet,sheet_id=excluded.sheet_id,range=excluded.range,kind=excluded.kind,sync_frequency=excluded.sync_frequency,status=excluded.status,mapping_json=excluded.mapping_json,updated_at=excluded.updated_at`
      )
      .bind(
        sourceId,
        id,
        text(body.type) || 'feishu_sheet',
        name,
        text(body.spreadsheet),
        text(body.sheetId),
        text(body.range) || 'A1:AZ5000',
        text(body.kind) || 'owned',
        text(body.syncFrequency) || 'manual',
        status,
        mapping,
        now,
        now
      )
      .run();
    return Response.json({ ok: true, id: sourceId });
  }

  if (action === 'remove_source') {
    const sourceId = text(body.id);
    if (!sourceId) return jsonError('缺少数据源 ID');
    await d1.prepare('DELETE FROM data_sources WHERE id=? AND project_id=?').bind(sourceId, id).run();
    return Response.json({ ok: true });
  }

  if (action === 'manage_member') {
    const targetUserId = text(body.userId);
    const role = text(body.role) || 'viewer';
    const subAction = text(body.subAction) || 'upsert';
    if (!targetUserId) return jsonError('缺少成员用户 ID');

    if (subAction === 'remove') {
      await d1.prepare('DELETE FROM project_members WHERE project_id=? AND user_id=?').bind(id, targetUserId).run();
      return Response.json({ ok: true, removed: true });
    }

    await d1
      .prepare(`INSERT INTO project_members(id, project_id, user_id, role, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET role=excluded.role, updated_at=excluded.updated_at`)
      .bind(`${id}:${targetUserId}`, id, targetUserId, role, now, now)
      .run();

    return Response.json({ ok: true, memberId: `${id}:${targetUserId}`, role });
  }

  return jsonError('不支持的操作');
}
