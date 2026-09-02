import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { logAction } from '@/lib/ops';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!(await apiUser(true))) return jsonError('请先登录', 401);
  try {
    const body = await request.json() as { id?: string; status?: string; method?: string; projectId?: string }; const project=projectId(body.projectId);
    if (!body.id) return jsonError('缺少评论 ID');
    await ensureSchema();
    await db().prepare('UPDATE key_comments SET treatment_status=?, treatment_method=? WHERE id=? AND project_id=?').bind(body.status||'已处理',body.method||'人工确认',body.id,project).run();
    await logAction('评论处置','comment',body.id,`${body.status||'已处理'} · ${body.method||'人工确认'}`,project);
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error instanceof Error ? error.message : '更新失败', 500); }
}
