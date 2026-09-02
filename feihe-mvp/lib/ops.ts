import { DEFAULT_PROJECT_ID, db, ensureSchema } from './db';
import { getProjectSetting, projectId, saveProjectSetting } from './projects';

export async function getSetting<T>(key: string, fallback: T, project = DEFAULT_PROJECT_ID): Promise<T> {
  return getProjectSetting(project, key, fallback);
}

export async function saveSetting(key: string, value: unknown, project = DEFAULT_PROJECT_ID) {
  return saveProjectSetting(project, key, value);
}

export async function startJob(type: string, title: string, total = 0, project = DEFAULT_PROJECT_ID) {
  await ensureSchema();
  const id = crypto.randomUUID();
  await db().prepare('INSERT INTO jobs(id,project_id,type,title,total,created_at) VALUES(?,?,?,?,?,?)')
    .bind(id, projectId(project), type, title, total, new Date().toISOString()).run();
  return id;
}

export async function finishJob(id: string, values: { succeeded: number; failed?: number; message?: string }) {
  const failed = values.failed || 0; const total = values.succeeded + failed;
  await db().prepare(`UPDATE jobs SET status=?,progress=100,total=CASE WHEN total=0 THEN ? ELSE total END,
    succeeded=?,failed=?,message=?,finished_at=? WHERE id=?`)
    .bind(failed && !values.succeeded ? '失败' : failed ? '部分完成' : '已完成', total, values.succeeded, failed, values.message || '', new Date().toISOString(), id).run();
}

export async function failJob(id: string, message: string) {
  await db().prepare('UPDATE jobs SET status=?,message=?,finished_at=? WHERE id=?')
    .bind('失败', message, new Date().toISOString(), id).run();
}

export async function logAction(action: string, targetType = '', targetId = '', detail = '', project = DEFAULT_PROJECT_ID) {
  await ensureSchema();
  await db().prepare('INSERT INTO action_logs(project_id,action,target_type,target_id,detail,created_at) VALUES(?,?,?,?,?,?)')
    .bind(projectId(project), action, targetType, targetId, detail, new Date().toISOString()).run();
}
