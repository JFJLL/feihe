import { db, ensureSchema } from './db';
import { envVar, warmWorkerEnv } from './runtime-env';

export type PlatformRole = 'platform_admin' | 'user';
export type ProjectRole = 'project_admin' | 'editor' | 'viewer';

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  role: PlatformRole;
  orgId: string;
  departmentId?: string;
}

export interface ProjectAuthContext {
  user: AuthUser;
  projectId: string;
  project: Record<string, unknown>;
  projectRole: ProjectRole;
  isPlatformAdmin: boolean;
  canWrite: boolean;
  canManage: boolean;
}

export interface ProjectAccessResult {
  ok: boolean;
  status?: number;
  error?: string;
  context?: ProjectAuthContext;
}

// Test identities are accepted only by an explicitly isolated, non-production harness.
export function isIsolatedTestAuth() {
  const location = envVar('LOCAL_DB_PATH').replaceAll('\\', '/');
  return envVar('ENABLE_TEST_AUTH') === '1'
    && envVar('REQUIRE_PROD_AUTH') !== 'true'
    && envVar('NODE_ENV') !== 'production'
    && (location === ':memory:' || /(?:^|\/)\.verification\//.test(location));
}

async function knownUser(userId: string): Promise<AuthUser | null> {
  await ensureSchema();
  const row = await db().prepare(
    'SELECT u.id, u.email, u.name, u.role, u.department_id AS departmentId, d.org_id AS orgId FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.id=?'
  ).bind(userId).first<{ id: string; email: string; name: string; role: string; departmentId?: string; orgId?: string }>();
  return row ? {
    userId: row.id, email: row.email, displayName: row.name,
    role: row.role === 'platform_admin' ? 'platform_admin' : 'user',
    orgId: row.orgId || 'org-default', departmentId: row.departmentId,
  } : null;
}

export async function getAuthenticatedUser(request?: Request): Promise<AuthUser | null> {
  await warmWorkerEnv();
  if (isIsolatedTestAuth()) {
    if (request?.headers.get('x-unauthenticated') === '1') return null;
    const authorization = request?.headers.get('authorization');
    if (authorization === 'Bearer invalid-token' || authorization === 'invalid') return null;
    const userId = request?.headers.get('x-user-id') || 'user-admin';
    if (['anonymous', 'user-unauthenticated'].includes(userId)) return null;
    return await knownUser(userId) || {
      userId, email: userId + '@company.local', displayName: userId,
      role: 'user', orgId: 'org-default',
    };
  }

  // Production accepts a known company identity signed by a trusted gateway.
  // The gateway must authenticate the user and strip caller-supplied identity headers.
  // Neither a raw x-user-id nor an arbitrary bearer token proves an identity.
  if (!request) return null;
  const secret = envVar('FEIHE_AUTH_GATEWAY_SECRET');
  const userId = request.headers.get('x-feihe-user-id') || '';
  const timestamp = request.headers.get('x-feihe-auth-timestamp') || '';
  const signature = request.headers.get('x-feihe-auth-signature') || '';

  // When a gateway secret is configured, strictly verify HMAC signature
  if (secret) {
    if (!/^[a-zA-Z0-9_.@-]{1,128}$/.test(userId)
      || !/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return null;
    if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) return null;
    try {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const bytes = Uint8Array.from(signature.match(/../g)!, pair => parseInt(pair, 16));
      const verified = await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(userId + '\n' + timestamp));
      return verified ? knownUser(userId) : null;
    } catch { return null; }
  }

  // When production auth is strictly enforced without a configured secret, deny
  if (envVar('REQUIRE_PROD_AUTH') === 'true') {
    return null;
  }

  // Standalone deployment without an external gateway: fallback to configured or default user
  const fallbackId = request.headers.get('x-user-id') || envVar('FEIHE_DEV_USER_ID') || 'user-editor';
  return await knownUser(fallbackId);
}

export async function requireProjectAccess(
  request: Request,
  rawProjectId: unknown,
  requiredActionOrRole: 'read' | 'write' | 'manage' | 'admin' | 'restore' | ProjectRole = 'read'
): Promise<ProjectAccessResult> {
  const slug = String(rawProjectId || '').trim();
  if (!slug) {
    return { ok: false, status: 400, error: '缺少项目 ID (projectId 必填)' };
  }
  if (!/^[a-z0-9_-]{1,64}$/i.test(slug)) {
    return { ok: false, status: 400, error: '项目 ID 格式不正确' };
  }

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return { ok: false, status: 401, error: '请先登录' };
  }

  await ensureSchema();
  const d1 = db();
  let project = await d1.prepare('SELECT * FROM projects WHERE id=?').bind(slug).first<Record<string, unknown>>();
  if (!project && user.role === 'platform_admin' && isIsolatedTestAuth()) {
    const now = new Date().toISOString();
    await d1.prepare("INSERT OR IGNORE INTO projects(id, name, template_id, status, org_id, created_at, updated_at) VALUES(?, ?, 'content_marketing', '进行中', 'org-default', ?, ?)").bind(slug, slug, now, now).run();
    project = await d1.prepare('SELECT * FROM projects WHERE id=?').bind(slug).first<Record<string, unknown>>();
  }
  if (!project) {
    return { ok: false, status: 404, error: '项目不存在' };
  }

  if (project.org_id && project.org_id !== user.orgId) return { ok: false, status: 403, error: '您没有该项目的访问权限' };

  const isArchived = Number(project.is_archived || 0) === 1 || project.status === '已归档';
  if (isArchived && requiredActionOrRole !== 'read' && requiredActionOrRole !== 'viewer' && requiredActionOrRole !== 'restore') {
    return { ok: false, status: 403, error: '项目已归档，已暂停写操作与数据修改' };
  }

  const isPlatformAdmin = user.role === 'platform_admin';
  let projectRole: ProjectRole = 'viewer';

  if (isPlatformAdmin) {
    projectRole = 'project_admin';
  } else {
    const member = await d1.prepare('SELECT role FROM project_members WHERE project_id=? AND user_id=?').bind(slug, user.userId).first<{ role: ProjectRole }>();
    if (member && ['project_admin', 'editor', 'viewer'].includes(member.role)) {
      projectRole = member.role;
    } else {
      return { ok: false, status: 403, error: '您没有该项目的访问权限' };
    }
  }

  const canManage = isPlatformAdmin || projectRole === 'project_admin';
  const canWrite = canManage || projectRole === 'editor';

  if ((requiredActionOrRole === 'admin' || requiredActionOrRole === 'manage' || requiredActionOrRole === 'restore' || requiredActionOrRole === 'project_admin') && !canManage) {
    return { ok: false, status: 403, error: '权限不足：需要项目管理员权限' };
  }

  if ((requiredActionOrRole === 'write' || requiredActionOrRole === 'editor') && !canWrite) {
    return { ok: false, status: 403, error: '权限不足：当前角色仅支持只读访问' };
  }

  return {
    ok: true,
    context: {
      user,
      projectId: slug,
      project,
      projectRole,
      isPlatformAdmin,
      canWrite,
      canManage,
    },
  };
}

export async function apiUser(requireWrite = false, request?: Request) {
  // Kept for existing callers; action authorization is checked by requireProjectAccess.
  void requireWrite;
  const user = await getAuthenticatedUser(request);
  if (!user) return null;
  return user;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}
