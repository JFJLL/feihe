import { DEFAULT_PROJECT_ID, db, ensureSchema } from './db';

export function projectId(value: unknown) {
  const id = String(value || DEFAULT_PROJECT_ID).trim();
  return /^[a-z0-9_-]{1,48}$/i.test(id) ? id : DEFAULT_PROJECT_ID;
}

export async function getProjectSetting<T>(project: string, key: string, fallback: T): Promise<T> {
  await ensureSchema();
  const row = await db().prepare('SELECT value FROM project_settings WHERE project_id=? AND key=?').bind(projectId(project), key).first<{ value: string }>();
  if (!row?.value) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}

export async function saveProjectSetting(project: string, key: string, value: unknown) {
  await ensureSchema(); const id = projectId(project); const now = new Date().toISOString();
  await db().prepare(`INSERT INTO project_settings(id,project_id,key,value,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
    .bind(`${id}:${key}`, id, key, JSON.stringify(value), now).run();
}
