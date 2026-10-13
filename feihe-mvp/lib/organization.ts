import { db } from './db';
import { jsonError, type AuthUser } from './api-auth';
import { PROJECT_STATUSES } from './project-form';

export async function saveOrganizationEntry(user: AuthUser, action: string, body: Record<string, unknown>) {
  if (user.role !== 'platform_admin') return jsonError('需要平台管理员维护客户与部门', 403);
  if (action === 'save_user') {
    const id = String(body.id || '').trim(), name = String(body.name || '').trim(), email = String(body.email || '').trim();
    const departmentId = String(body.departmentId || '').trim();
    if (!/^[a-zA-Z0-9_.@-]{1,128}$/.test(id) || !name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('请填写有效企业账号ID、姓名与邮箱');
    if (body.role !== undefined && body.role !== 'user') return jsonError('成员目录登记不授予平台管理员权限');
    const department = await db().prepare('SELECT id FROM departments WHERE id=? AND org_id=?').bind(departmentId, user.orgId).first();
    if (!department) return jsonError('请选择当前组织的负责部门');
    const existing = await db().prepare('SELECT u.id,d.org_id AS orgId FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.id=?').bind(id).first<{ id: string; orgId?: string }>();
    if (existing?.orgId && existing.orgId !== user.orgId) return jsonError('不能修改其他组织的成员', 403);
    const now = new Date().toISOString();
    await db().prepare("INSERT INTO users(id,email,name,role,department_id,created_at,updated_at) VALUES(?,?,?,'user',?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,department_id=excluded.department_id,updated_at=excluded.updated_at")
      .bind(id, email, name, departmentId, now, now).run();
    return Response.json({ ok: true, id });
  }
  const table = action === 'save_client' ? 'clients' : 'departments';
  const name = String(body.name || '').trim();
  if (!name || name.length > 100) return jsonError('请填写100字以内的名称');
  const suppliedId = String(body.id || '').trim();
  if (suppliedId && !/^[a-z0-9_-]{1,64}$/i.test(suppliedId)) return jsonError('标识格式不正确');
  const d1 = db();
  if (suppliedId && !await d1.prepare('SELECT id FROM ' + table + ' WHERE id=? AND org_id=?').bind(suppliedId, user.orgId).first()) return jsonError('记录不存在或不属于当前组织', 404);
  const duplicate = await d1.prepare('SELECT id FROM ' + table + ' WHERE org_id=? AND name=? COLLATE NOCASE AND id<>?').bind(user.orgId, name, suppliedId).first();
  if (duplicate) return jsonError('该名称已登记，请选择已有记录');
  const id = suppliedId || (table === 'clients' ? 'client-' : 'dept-') + crypto.randomUUID();
  const now = new Date().toISOString();
  if (table === 'clients') {
    await d1.prepare('INSERT INTO clients(id,org_id,name,industry,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,industry=excluded.industry,updated_at=excluded.updated_at')
      .bind(id, user.orgId, name, String(body.industry || '').trim(), now, now).run();
  } else {
    await d1.prepare('INSERT INTO departments(id,org_id,name,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at')
      .bind(id, user.orgId, name, now, now).run();
  }
  return Response.json({ ok: true, id });
}
export async function validateProjectReferences(user: AuthUser, input: { departmentId: string; ownerId: string; clientId: string | null; templateId: string; status: string; color: string }) {
  const d1 = db();
  const [department, owner, client, template] = await Promise.all([
    d1.prepare('SELECT id FROM departments WHERE id=? AND org_id=?').bind(input.departmentId, user.orgId).first(),
    d1.prepare('SELECT u.id FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.id=? AND (d.org_id=? OR u.department_id IS NULL)').bind(input.ownerId, user.orgId).first(),
    input.clientId ? d1.prepare('SELECT id FROM clients WHERE id=? AND org_id=?').bind(input.clientId, user.orgId).first() : Promise.resolve(true),
    input.templateId === 'blank' ? Promise.resolve(true) : d1.prepare('SELECT id FROM project_templates WHERE id=?').bind(input.templateId).first(),
  ]);
  if (!department) return '负责部门不存在或不属于当前组织';
  if (!owner) return '负责人不存在或不属于当前组织';
  if (!client) return '客户不存在或不属于当前组织';
  if (!template) return '业务方向不存在';
  if (!PROJECT_STATUSES.includes(input.status)) return '请选择有效的业务状态';
  if (input.color && !/^#[a-f0-9]{6}$/i.test(input.color)) return '项目识别色格式不正确';
  return null;
}
export async function ensureOwnerMembership(project: string, owner: string) {
  const now = new Date().toISOString();
  await db().prepare("INSERT INTO project_members(id,project_id,user_id,role,created_at,updated_at) VALUES(?,?,?,'project_admin',?,?) ON CONFLICT(id) DO UPDATE SET role='project_admin',updated_at=excluded.updated_at")
    .bind(project + ':' + owner, project, owner, now, now).run();
}
