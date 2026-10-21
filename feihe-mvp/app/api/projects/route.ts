import { getAuthenticatedUser, requireProjectAccess, jsonError } from '@/lib/api-auth';
import { blobGet } from '@/lib/blob-store';
import { db, ensureSchema } from '@/lib/db';
import { saveOrganizationEntry, validateProjectReferences, ensureOwnerMembership } from '@/lib/organization';
import { automaticProjectColor, isValidLogoUrl, parseLogoKey } from '@/lib/project-form';
import { TEMPLATE_GUIDES, templateGuide } from '@/lib/project-templates';
import { projectReadiness } from '@/lib/onboarding';
import { transformMappedRows, type FieldMappingRule, type MappingContext } from '@/lib/field-mapping';
import { loadStructureBlueprint, type StructureBlueprint } from '@/lib/project-structure';
import { DefinitionError } from '@/lib/metrics/definitions';

export const dynamic = 'force-dynamic';
const text = (value: unknown) => String(value || '').trim();
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || `project-${crypto.randomUUID().slice(0, 8)}`;

const PROJECT_SELECT = 'p.id,p.name,p.spu,p.brand,p.category,p.description,p.status,p.color,COALESCE(p.logo_url,\'\') AS logoUrl,p.start_at AS startAt,p.end_at AS endAt,p.org_id AS orgId,p.department_id AS departmentId,p.client_id AS clientId,p.owner_id AS ownerId,p.template_id AS templateId,p.is_archived AS isArchived,p.onboarding_status AS onboardingStatus,p.created_by AS createdBy,p.updated_at AS updatedAt,d.name AS departmentName,c.name AS clientName,u.name AS ownerName,COALESCE(t.name,CASE WHEN p.template_id=\'blank\' THEN \'空白项目\' ELSE \'未配置方向\' END) AS templateName,(SELECT ps.updated_at FROM project_settings ps WHERE ps.project_id=p.id AND ps.key=\'campaign_dashboard\') AS campaignSnapshotAt';
const PROJECT_JOINS = ' FROM projects p LEFT JOIN departments d ON d.id=p.department_id LEFT JOIN clients c ON c.id=p.client_id LEFT JOIN users u ON u.id=p.owner_id LEFT JOIN project_templates t ON t.id=p.template_id ';
const DIRECTORY_SQL = 'SELECT u.id,u.name,u.email,u.role,u.department_id AS departmentId FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE d.org_id=? OR u.department_id IS NULL ORDER BY u.name';

async function validateAndAuthorizeLogo(
  request: Request,
  logoUrl: string,
  user: { userId: string; role: string },
  existingLogoUrl?: string
): Promise<{ error?: string; status?: number } | null> {
  if (!logoUrl) return null;
  if (!isValidLogoUrl(logoUrl)) {
    return { error: '项目 Logo 必须为系统内上传的有效本地路径或留空', status: 400 };
  }
  const key = parseLogoKey(logoUrl);
  if (!key) return { error: '无效的 Logo 资源标识', status: 400 };

  // Verify the target blob actually exists on storage; disallow fabricated keys
  const blobObject = await blobGet(key);
  if (!blobObject) {
    return { error: '指定的 Logo 资源不存在或尚未上传', status: 400 };
  }

  // If this logo is already bound to the project, allow any authorized project editor/admin to keep it
  if (existingLogoUrl && parseLogoKey(existingLogoUrl) === key) {
    return null;
  }

  if (key.startsWith('uploads/logos/')) {
    const parts = key.split('/');
    const uploaderId = parts[2];
    if (uploaderId !== user.userId && user.role !== 'platform_admin') {
      return { error: '无权使用其他用户上传的 Logo 资源', status: 403 };
    }
  } else if (key.startsWith('projects/')) {
    const parts = key.split('/');
    const sourceProjectId = parts[1];
    const accessCheck = await requireProjectAccess(request, sourceProjectId, 'read');
    if (!accessCheck.ok) {
      return { error: accessCheck.error || '无权使用该项目的 Logo 资源', status: accessCheck.status || 403 };
    }
  } else {
    return { error: '非法的 Logo 存储路径', status: 400 };
  }
  return null;
}

export async function GET(request?: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return jsonError('请通过已验证的公司身份入口登录', 401);
  await ensureSchema();
  const d1 = db();
  const targetProjectId = request ? new URL(request.url).searchParams.get('projectId') : null;
  if (targetProjectId) {
    const access = await requireProjectAccess(request!, targetProjectId, 'read');
    if (!access.ok) return jsonError(access.error!, access.status!);
    const context = access.context!;
    const [project, members, availableUsers, onboarding] = await Promise.all([
      d1.prepare('SELECT ' + PROJECT_SELECT + PROJECT_JOINS + ' WHERE p.id=?').bind(context.projectId).first(),
      d1.prepare('SELECT pm.id,pm.project_id AS projectId,pm.user_id AS userId,pm.role,COALESCE(u.name,pm.user_id) AS name,COALESCE(u.email,\'\') AS email,u.department_id AS departmentId FROM project_members pm LEFT JOIN users u ON u.id=pm.user_id WHERE pm.project_id=? ORDER BY pm.created_at').bind(context.projectId).all(),
      d1.prepare(DIRECTORY_SQL).bind(user.orgId).all(),
      d1.prepare('SELECT current_step AS currentStep,completed_steps_json AS completedStepsJson,selected_template_id AS selectedTemplateId FROM project_onboarding WHERE project_id=?').bind(context.projectId).first<{ completedStepsJson?: string }>(),
    ]);
    let steps: string[] = [];
    try { steps = JSON.parse(onboarding?.completedStepsJson || '[]'); } catch {}
    return Response.json({ ok: true, project, members: members.results, availableUsers: availableUsers.results, onboarding,
      currentUser: user,
    isDevLocal: Boolean(request?.headers.get('x-feihe-dev-mode') === '1'), projectRole: context.projectRole, canManage: context.canManage,
      canWrite: context.canWrite && !Number(context.project.is_archived), readiness: await projectReadiness(context.projectId, steps) });
  }

  const admin = user.role === 'platform_admin';
  const filter = 'p.org_id=?' + (admin ? '' : " AND p.id IN (SELECT project_id FROM project_members WHERE user_id=? AND role IN ('project_admin','editor','viewer'))");
  const filterValues = admin ? [user.orgId] : [user.orgId, user.userId];
  const role = admin ? "'project_admin'" : '(SELECT role FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=?)';
  const roleValues = admin ? [] : [user.userId];
  const projectSQL = 'SELECT ' + PROJECT_SELECT + ',' + role + ' AS projectRole,'
    + 'EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=?) AS isParticipant,'
    + '(SELECT COUNT(*) FROM project_notes pn WHERE pn.project_id=p.id) AS noteCount,'
    + "(SELECT COUNT(*) FROM project_notes pn WHERE pn.project_id=p.id AND pn.status='符合且能汇报') AS reportableCount,"
    + '(SELECT COUNT(*) FROM data_sources s WHERE s.project_id=p.id) AS sourceCount,'
    + '(SELECT COALESCE(SUM(ds.row_count),0) FROM datasets ds WHERE ds.project_id=p.id) AS dataRowCount,'
    + 'COALESCE((SELECT MAX(ds.updated_at) FROM datasets ds WHERE ds.project_id=p.id),(SELECT MAX(s.last_synced_at) FROM data_sources s WHERE s.project_id=p.id)) AS dataUpdatedAt'
    + PROJECT_JOINS + ' WHERE ' + filter + ' ORDER BY p.is_archived,p.updated_at DESC';
  const [projects, sources, departments, clients, templates, users] = await Promise.all([
    d1.prepare(projectSQL).bind(...roleValues, user.userId, ...filterValues).all<Record<string, unknown>>(),
    d1.prepare('SELECT s.id,s.project_id AS projectId,s.type,s.name,s.spreadsheet,s.sheet_id AS sheetId,s.range,s.kind,s.sync_frequency AS syncFrequency,s.status,s.last_synced_at AS lastSyncedAt,s.last_row_count AS lastRowCount,s.mapping_json AS mappingJson,s.last_error AS lastError,s.updated_at AS updatedAt FROM data_sources s JOIN projects p ON p.id=s.project_id WHERE ' + filter + ' ORDER BY s.updated_at DESC').bind(...filterValues).all(),
    d1.prepare('SELECT id,name FROM departments WHERE org_id=? ORDER BY name').bind(user.orgId).all(),
    d1.prepare('SELECT id,name,industry FROM clients WHERE org_id=? ORDER BY name').bind(user.orgId).all(),
    d1.prepare('SELECT id,name,description,icon,modules_json AS modulesJson FROM project_templates ORDER BY name').all<{ id: string; name: string; description: string; icon: string; modulesJson: string }>(),
    d1.prepare(DIRECTORY_SQL).bind(user.orgId).all<{ id: string; name: string; email: string; role: string }>(),
  ]);
  const catalog = templates.results.map(t => ({ ...t, ...templateGuide(t.id) }));
  if (!catalog.some(t => t.id === 'blank')) catalog.push({ ...templateGuide('blank')!, icon: '' });
  const visible = projects.results.map(p => ({ ...p,
    canManage: admin || p.projectRole === 'project_admin',
    canWrite: !Number(p.isArchived) && (admin || ['project_admin', 'editor'].includes(String(p.projectRole))),
    canDelete: admin && p.id !== 'qicui' }));
  return Response.json({ ok: true, projects: visible, sources: sources.results, metadata: {
    departments: departments.results, clients: clients.results, templates: catalog, users: users.results,
    canManageOrganization: admin, platformContacts: users.results.filter(u => u.role === 'platform_admin'), currentUser: user,
    isDevLocal: Boolean(request?.headers.get('x-feihe-dev-mode') === '1'),
  } });
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
  const caller = await getAuthenticatedUser(request);
  if (!caller) return jsonError('请通过已验证的公司身份入口登录', 401);
  await ensureSchema();
  const d1 = db();
  if (action === 'save_client' || action === 'save_department' || action === 'save_user') return saveOrganizationEntry(caller, action, body);

  if (action === 'create') {
    const user = caller;
    if (!user) return jsonError('请先登录', 401);

    const name = text(body.name);
    if (!name) return jsonError('请填写项目名称');

    let templateId = text(body.templateId) || 'general_workbench';
    let structure: StructureBlueprint | undefined;
    if (body.structureProjectId) {
      const sourceAccess = await requireProjectAccess(request, body.structureProjectId, 'read');
      if (!sourceAccess.ok) return jsonError(sourceAccess.error!, sourceAccess.status!);
      if (body.structureConfirmed !== true) return jsonError('请确认仅复用结构，重新接入本项目来源并设置目标');
      try {
        structure = await loadStructureBlueprint(sourceAccess.context!);
        if (body.structureRevision && body.structureRevision !== structure.revision) return jsonError('来源项目结构已变化，请重新预览后确认', 409);
        templateId = structure.templateId;
      } catch (error) { return jsonError(error instanceof Error ? error.message : '结构读取失败', error instanceof DefinitionError ? error.status : 500); }
    }
    const departmentId = text(body.departmentId) || user.departmentId || 'dept-general';
    const clientId = text(body.clientId) || null;
    const ownerId = text(body.ownerId) || user.userId;
    const status = text(body.status) || '筹备中';
    const color = text(body.color) || automaticProjectColor(name);
    const description = text(body.description);
    const spu = text(body.spu);
    const brand = text(body.brand);
    const category = text(body.category);
    const logoUrl = text(body.logoUrl || body.logo);
    const startAt = text(body.startAt) || null;
    const endAt = text(body.endAt) || null;

    if (name.length > 100) return jsonError('项目名称不能超过100字');
    if (brand.length > 50) return jsonError('品牌名称不能超过50字');
    if (spu.length > 50) return jsonError('产品/SPU不能超过50字');
    const logoCheck = await validateAndAuthorizeLogo(request, logoUrl, user);
    if (logoCheck) {
      return jsonError(logoCheck.error || '非法的 Logo 资源', logoCheck.status || 400);
    }
    const referenceError = await validateProjectReferences(user, { departmentId, ownerId, clientId, templateId, status, color });
    if (referenceError) return jsonError(referenceError);

    let id = text(body.id) ? slug(text(body.id)) : slug(name);
    const exists = await d1.prepare('SELECT id FROM projects WHERE id=?').bind(id).first();
    if (exists) id = `${id}-${Date.now().toString(36).slice(-4)}`;

    const projectStatement = d1
      .prepare(
        `INSERT INTO projects(id, name, spu, brand, category, description, status, color, logo_url, start_at, end_at,
        org_id, department_id, client_id, owner_id, template_id, is_archived, onboarding_status, created_by, created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'source', ?, ?, ?)`
      )
      .bind(id, name, spu, brand, category, description, status, color, logoUrl, startAt, endAt, user.orgId, departmentId, clientId, ownerId, templateId, user.userId, now, now);
    if (structure) await d1.batch([projectStatement, d1.prepare("INSERT INTO project_settings(id,project_id,key,value,updated_at) VALUES(?,?,'structure_blueprint',?,?)").bind(id + ':structure', id, JSON.stringify(structure), now)]);
    else await projectStatement.run();

    // Add creator as project administrator
    await d1
      .prepare(`INSERT OR IGNORE INTO project_members(id, project_id, user_id, role, created_at, updated_at) VALUES(?, ?, ?, 'project_admin', ?, ?)`)
      .bind(`${id}:${user.userId}`, id, user.userId, now, now)
      .run();

    await ensureOwnerMembership(id, ownerId);

    // Initialize onboarding state
    await d1
      .prepare(`INSERT OR IGNORE INTO project_onboarding(project_id, current_step, completed_steps_json, selected_template_id, updated_at) VALUES(?, 'source', '["template"]', ?, ?)`)
      .bind(id, templateId, now)
      .run();

    // Create default dashboard from template
    const templateRow = await d1.prepare('SELECT default_dashboard_json FROM project_templates WHERE id=?').bind(templateId).first<{ default_dashboard_json: string }>();
    let cards: Array<Record<string, unknown>> = [];
    if (!structure && !TEMPLATE_GUIDES.some(t => t.id === templateId) && templateRow?.default_dashboard_json) {
      try {
        const parsed = JSON.parse(templateRow.default_dashboard_json) as { cards?: Array<Record<string, unknown>> };
        cards = parsed.cards || [];
      } catch {}
    }

    const dashboardId = `dash-${id}-default`;
    await d1
      .prepare(`INSERT OR IGNORE INTO dashboards(id, project_id, name, is_default, version, layout_json, status, created_at, updated_at) VALUES(?, ?, '团队工作台', 1, 1, '[]', 'draft', ?, ?)`)
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
        ['viral', '口碑爆文维护', 0],
        ['value_scan', '价值内容扫描', 0],
        ['commercial', '商业内容执行', 0],
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
        .bind(`${id}:acceptance`, id, 'acceptance', JSON.stringify({ reportCount: 0, baseCount: 0, brandTopRate: 0, freshnessHours: 24, supplierSimilarity: 0.58, targetsConfirmed: false }), now)
        .run();
    }

    return Response.json({ ok: true, id, templateId, structurePending: Boolean(structure) });
  }

  // All other actions require existing project access check
  const rawId = body.projectId;
  const access = await requireProjectAccess(request, rawId, action === 'delete' ? 'admin' : action === 'restore' ? 'restore' : 'manage');
  if (!access.ok) return jsonError(access.error!, access.status!);

  const id = access.context!.projectId;

  let readiness: Awaited<ReturnType<typeof projectReadiness>> | undefined;
  if (body.onboardingStatus === 'ready') {
    const previous = await d1.prepare('SELECT completed_steps_json FROM project_onboarding WHERE project_id=?').bind(id).first<{ completed_steps_json: string }>();
    let savedSteps: string[] = []; try { savedSteps = JSON.parse(previous?.completed_steps_json || '[]'); } catch {}
    const requestedSteps = [...savedSteps.filter(s => s === 'skip:members'), ...(Array.isArray(body.completedSteps) ? body.completedSteps.map(String) : [])];
    readiness = await projectReadiness(id, requestedSteps);
    if (!readiness.ready) return Response.json({ ok: false, error: '初始化必要条件未完成：' + readiness.blockedSteps.join('、'), readiness }, { status: 400 });
  }

  if (action === 'update_onboarding') {
    const statusVal = text(body.onboardingStatus) || 'pending';
    const completedSteps = readiness?.completedSteps || (Array.isArray(body.completedSteps) ? body.completedSteps.filter(s => s === 'skip:members') : []);
    const stepsJson = JSON.stringify(completedSteps);
    await d1.prepare(`UPDATE projects SET onboarding_status=?, updated_at=? WHERE id=?`).bind(statusVal, now, id).run();
    await d1.prepare(`UPDATE project_onboarding SET current_step=?, completed_steps_json=?, updated_at=? WHERE project_id=?`).bind(statusVal, stepsJson, now, id).run();
    return Response.json({ ok: true, id, onboardingStatus: statusVal, completedSteps });
  }

  if (action === 'update') {
    if (body.onboardingStatus !== undefined && body.name === undefined) {
      const statusVal = text(body.onboardingStatus) || 'ready';
      await d1.prepare(`UPDATE projects SET onboarding_status=?, updated_at=? WHERE id=?`).bind(statusVal, now, id).run();
      await d1.prepare(`UPDATE project_onboarding SET current_step='ready', completed_steps_json=?, updated_at=? WHERE project_id=?`).bind(JSON.stringify(readiness?.completedSteps || []), now, id).run();
      return Response.json({ ok: true, id, onboardingStatus: statusVal });
    }

    const existing = await d1.prepare('SELECT * FROM projects WHERE id=?').bind(id).first<Record<string, unknown>>();
    if (!existing) return jsonError('项目不存在', 404);

    const name = body.name !== undefined ? text(body.name) : (existing.name as string);
    if (!name) return jsonError('请填写项目名称');
    const spu = body.spu !== undefined ? text(body.spu) : (existing.spu as string);
    const brand = body.brand !== undefined ? text(body.brand) : (existing.brand as string);
    const category = body.category !== undefined ? text(body.category) : (existing.category as string);
    const description = body.description !== undefined ? text(body.description) : (existing.description as string);
    const status = body.status !== undefined ? text(body.status) : (existing.status as string);
    const color = body.color !== undefined ? text(body.color) : (existing.color as string);
    const logoUrl = body.logoUrl !== undefined ? text(body.logoUrl) : body.logo !== undefined ? text(body.logo) : (existing.logo_url as string || '');
    if (brand.length > 50) return jsonError('品牌名称不能超过50字');
    if (spu.length > 50) return jsonError('产品/SPU不能超过50字');
    const logoCheck = await validateAndAuthorizeLogo(request, logoUrl, access.context!.user, existing.logo_url as string || '');
    if (logoCheck) {
      return jsonError(logoCheck.error || '非法的 Logo 资源', logoCheck.status || 400);
    }
    const departmentId = body.departmentId !== undefined ? text(body.departmentId) : (existing.department_id as string);
    const clientId = body.clientId !== undefined ? text(body.clientId) || null : (existing.client_id as string | null);
    const ownerId = body.ownerId !== undefined ? text(body.ownerId) : (existing.owner_id as string);
    const startAt = body.startAt !== undefined ? text(body.startAt) || null : (existing.start_at as string | null);
    const endAt = body.endAt !== undefined ? text(body.endAt) || null : (existing.end_at as string | null);
    const onboardingStatus = body.onboardingStatus !== undefined ? text(body.onboardingStatus) : (existing.onboarding_status as string);
    const referenceError = await validateProjectReferences(access.context!.user, { departmentId: departmentId || 'dept-general', ownerId: ownerId || access.context!.user.userId, clientId, templateId: String(existing.template_id || 'general_workbench'), status, color });
    if (referenceError) return jsonError(referenceError);

    await d1
      .prepare(
        `UPDATE projects SET name=?, spu=?, brand=?, category=?, description=?, status=?, color=?, logo_url=?,
        department_id=?, client_id=?, owner_id=?, start_at=?, end_at=?, onboarding_status=?, updated_at=? WHERE id=?`
      )
      .bind(
        name,
        spu,
        brand,
        category,
        description,
        status || '进行中',
        color || '#1769d5',
        logoUrl,
        departmentId || 'dept-general',
        clientId,
        ownerId || access.context!.user.userId,
        startAt,
        endAt,
        onboardingStatus || 'pending',
        now,
        id
      )
      .run();

    await ensureOwnerMembership(id, ownerId || access.context!.user.userId);

    if (body.onboardingStatus === 'ready') {
      await d1.prepare(`UPDATE project_onboarding SET current_step='ready', completed_steps_json=?, updated_at=? WHERE project_id=?`).bind(JSON.stringify(readiness?.completedSteps || []), now, id).run();
    }
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
    const ownership = await d1.prepare('SELECT project_id FROM data_sources WHERE id=?').bind(sourceId).first<{ project_id: string }>();
    if (ownership && ownership.project_id !== id) return jsonError('数据源不属于当前项目', 403);
    const name = text(body.name);
    if (!name) return jsonError('请填写数据源名称');
    let mapping = '{}';
    try {
      mapping = typeof body.mappingJson === 'string' ? JSON.stringify(JSON.parse(body.mappingJson)) : JSON.stringify(body.mappingJson || {});
    } catch {
      return jsonError('字段映射必须是合法 JSON');
    }
    const parsedMapping = JSON.parse(mapping) as { rules?: FieldMappingRule[]; context?: MappingContext };
    const rules = Array.isArray(parsedMapping) ? parsedMapping : parsedMapping.rules || [];
    const mappingErrors = transformMappedRows([], rules).errors;
    if (mappingErrors.length) return jsonError(mappingErrors.join('；'));
    if (parsedMapping.context && (parsedMapping.context.projectId !== id || parsedMapping.context.sheetId !== text(body.sheetId))) return jsonError('映射上下文与项目或工作表不匹配');
    if (!['general', 'dataset', 'owned', 'supplier'].includes(text(body.kind) || 'owned')) return jsonError('不支持的数据用途类型');
    const status = text(body.status) || (text(body.spreadsheet) && text(body.sheetId) ? '已连接' : '未连接');
    await d1
      .prepare(
        `INSERT INTO data_sources(id,project_id,type,name,spreadsheet,sheet_id,range,kind,sync_frequency,status,mapping_json,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
        type=excluded.type,name=excluded.name,spreadsheet=excluded.spreadsheet,sheet_id=excluded.sheet_id,range=excluded.range,kind=excluded.kind,sync_frequency=excluded.sync_frequency,status=excluded.status,mapping_json=excluded.mapping_json,updated_at=excluded.updated_at`
      )
      .bind(
        sourceId,
        id,
        text(body.type) || 'feishu_sheet',
        name,
        text(body.spreadsheet),
        text(body.sheetId),
        text(body.range),
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

  if (action === 'manage_member' || action === 'add_member' || action === 'update_member_role' || action === 'remove_member') {
    const targetUserId = text(body.userId);
    const role = text(body.role) || 'viewer';
    const subAction = action === 'remove_member' ? 'remove' : (text(body.subAction) || 'upsert');
    if (subAction !== 'remove') {
      if (!['project_admin', 'editor', 'viewer'].includes(role)) return jsonError('请选择有效的项目角色');
      const directoryUser = await d1.prepare('SELECT u.id FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.id=? AND (d.org_id=? OR u.department_id IS NULL)').bind(targetUserId, access.context!.user.orgId).first();
      if (!directoryUser) return jsonError('请选择已登记的公司成员');
    }
    if (!targetUserId) return jsonError('缺少成员用户 ID');
    const existingRole = await d1.prepare('SELECT role FROM project_members WHERE project_id=? AND user_id=?').bind(id, targetUserId).first<{ role: string }>();
    const reducing = subAction === 'remove' || role !== 'project_admin';
    if (reducing && targetUserId === String(access.context!.project.owner_id)) return jsonError('请先在项目资料中交接负责人，再移除或调整该成员');
    if (reducing && existingRole?.role === 'project_admin') {
      const others = await d1.prepare("SELECT COUNT(*) AS n FROM project_members WHERE project_id=? AND user_id<>? AND role='project_admin'").bind(id, targetUserId).first<{ n: number }>();
      if (!others?.n) return jsonError('项目至少需要保留一位项目管理员');
    }

    if (subAction === 'remove') {
      await d1.prepare("DELETE FROM project_members WHERE project_id=? AND user_id=? AND (role<>'project_admin' OR EXISTS(SELECT 1 FROM project_members other WHERE other.project_id=? AND other.user_id<>? AND other.role='project_admin')) AND NOT EXISTS(SELECT 1 FROM projects WHERE id=? AND owner_id=?)").bind(id, targetUserId, id, targetUserId, id, targetUserId).run();
      if (await d1.prepare('SELECT id FROM project_members WHERE project_id=? AND user_id=?').bind(id, targetUserId).first()) return jsonError('成员或负责人在操作期间已变化，请刷新后重试', 409);
      return Response.json({ ok: true, removed: true });
    }

    const existingMem = await d1.prepare('SELECT id FROM project_members WHERE project_id=? AND user_id=?').bind(id, targetUserId).first<{ id: string }>();
    if (existingMem) {
      await d1.prepare("UPDATE project_members SET role=?, updated_at=? WHERE id=? AND (role<>'project_admin' OR ?='project_admin' OR EXISTS(SELECT 1 FROM project_members other WHERE other.project_id=? AND other.user_id<>? AND other.role='project_admin')) AND (?='project_admin' OR NOT EXISTS(SELECT 1 FROM projects WHERE id=? AND owner_id=?))").bind(role, now, existingMem.id, role, id, targetUserId, role, id, targetUserId).run();
      const confirmedRole = await d1.prepare('SELECT role FROM project_members WHERE id=?').bind(existingMem.id).first<{ role: string }>();
      if (confirmedRole?.role !== role) return jsonError('成员或负责人在操作期间已变化，请刷新后重试', 409);
      return Response.json({ ok: true, memberId: existingMem.id, role });
    } else {
      const newId = `${id}:${targetUserId}`;
      await d1.prepare('INSERT INTO project_members(id, project_id, user_id, role, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)').bind(newId, id, targetUserId, role, now, now).run();
      return Response.json({ ok: true, memberId: newId, role });
    }
  }

  return jsonError('不支持的操作');
}
