import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { logAction } from '@/lib/ops';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await apiUser())) return jsonError('请先登录', 401);
  await ensureSchema();
  const d1 = db();
  const url = new URL(request.url);
  const project = projectId(url.searchParams.get('projectId'));
  const query = (url.searchParams.get('query') || '').trim();
  const action = (url.searchParams.get('action') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();
  const sentiment = (url.searchParams.get('sentiment') || '').trim();
  const category = (url.searchParams.get('category') || '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
  const offset = (page - 1) * pageSize;

  const conditions = ['kc.project_id = ?'];
  const params: unknown[] = [project];

  if (query) {
    conditions.push('(kc.content LIKE ? OR kc.note_id LIKE ? OR kc.author LIKE ? OR n.title LIKE ? OR n.author LIKE ?)');
    const q = '%' + query + '%';
    params.push(q, q, q, q, q);
  }
  if (action) {
    conditions.push('kc.action = ?');
    params.push(action);
  }
  if (status) {
    conditions.push('kc.treatment_status = ?');
    params.push(status);
  }
  if (sentiment) {
    conditions.push('kc.sentiment = ?');
    params.push(sentiment);
  }
  if (category) {
    conditions.push('kc.category = ?');
    params.push(category);
  }

  const whereClause = ' WHERE ' + conditions.join(' AND ');

  const [totalRow, summaryRows, itemsRows] = await Promise.all([
    d1.prepare('SELECT COUNT(*) AS total FROM key_comments kc LEFT JOIN notes n ON n.id = kc.note_id' + whereClause).bind(...params).first<{ total: number }>(),
    d1.prepare('SELECT COUNT(*) AS total, ' +
      "SUM(CASE WHEN treatment_status = '待处理' AND action = '需达人回复' THEN 1 ELSE 0 END) AS replyPending, " +
      "SUM(CASE WHEN treatment_status = '待处理' AND action = '需删除' THEN 1 ELSE 0 END) AS deletePending, " +
      "SUM(CASE WHEN treatment_status = '待处理' AND action = '需补充' THEN 1 ELSE 0 END) AS supplementPending, " +
      "SUM(CASE WHEN treatment_status = '已处理' THEN 1 ELSE 0 END) AS handledCount " +
      'FROM key_comments kc WHERE kc.project_id = ?').bind(project).first<{
      total: number;
      replyPending: number;
      deletePending: number;
      supplementPending: number;
      handledCount: number;
    }>(),
    d1.prepare('SELECT kc.id, kc.note_id AS noteId, kc.content, kc.author, kc.sentiment, ' +
      'kc.category, kc.action, kc.treatment_status AS treatmentStatus, ' +
      'kc.treatment_method AS treatmentMethod, kc.last_seen_at AS lastSeenAt, ' +
      'kc.disappeared_at AS disappearedAt, kc.reply_count AS replyCount, ' +
      'n.title AS noteTitle, n.author AS noteAuthor, n.url AS noteUrl ' +
      'FROM key_comments kc LEFT JOIN notes n ON n.id = kc.note_id' + whereClause + ' ' +
      "ORDER BY CASE WHEN kc.treatment_status = '待处理' THEN 0 ELSE 1 END, kc.last_seen_at DESC " +
      'LIMIT ? OFFSET ?').bind(...params, pageSize, offset).all(),
  ]);

  const total = Number(totalRow?.total || 0);
  const summary = {
    total: Number(summaryRows?.total || 0),
    replyPending: Number(summaryRows?.replyPending || 0),
    deletePending: Number(summaryRows?.deletePending || 0),
    supplementPending: Number(summaryRows?.supplementPending || 0),
    handledCount: Number(summaryRows?.handledCount || 0),
  };

  return Response.json({
    ok: true,
    items: itemsRows.results || [],
    total,
    page,
    pageSize,
    summary,
  });
}

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
