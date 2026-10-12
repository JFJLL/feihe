import { DEFAULT_PROJECT_ID, db, ensureSchema } from './db';

export function projectId(value: unknown, allowFallback = false): string {
  const raw = String(value || '').trim();
  if (!raw) return allowFallback ? DEFAULT_PROJECT_ID : '';
  return /^[a-z0-9_-]{1,64}$/i.test(raw) ? raw : (allowFallback ? DEFAULT_PROJECT_ID : '');
}

export function validateProjectId(value: unknown): { ok: boolean; id: string; error?: string } {
  const id = String(value || '').trim();
  if (!id) return { ok: false, id: '', error: '缺少项目 ID (projectId 必填)' };
  if (!/^[a-z0-9_-]{1,64}$/i.test(id)) return { ok: false, id: '', error: '项目 ID 格式不正确' };
  return { ok: true, id };
}

export function legacyProjectId(value: unknown): string {
  return projectId(value, true);
}

export async function getProjectSetting<T>(project: string, key: string, fallback: T): Promise<T> {
  await ensureSchema();
  const id = projectId(project, false);
  if (!id) return fallback;
  const row = await db().prepare('SELECT value FROM project_settings WHERE project_id=? AND key=?').bind(id, key).first<{ value: string }>();
  if (!row?.value) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}

export async function saveProjectSetting(project: string, key: string, value: unknown) {
  await ensureSchema();
  const id = projectId(project, false);
  if (!id) throw new Error('缺少项目 ID');
  const now = new Date().toISOString();
  await db().prepare(`INSERT INTO project_settings(id,project_id,key,value,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
    .bind(`${id}:${key}`, id, key, JSON.stringify(value), now).run();
}
