import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { logAction } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const access = await requireProjectAccess(request, url.searchParams.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  await ensureSchema();
  const d1 = db();

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

  const countSql = `
    SELECT COUNT(*) AS total
    FROM key_comments kc
    JOIN notes n ON n.id = kc.note_id
    JOIN project_notes pn ON pn.note_id = n.id AND pn.project_id = kc.project_id
    ${whereClause}
  `;

  const summarySql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN treatment_status = '待处理' THEN 1 ELSE 0 END) AS pendingTotal,
      SUM(CASE WHEN treatment_status = '已处置' THEN 1 ELSE 0 END) AS processedTotal,
      SUM(CASE WHEN action = '保留观察' THEN 1 ELSE 0 END) AS observeCount,
      SUM(CASE WHEN action = '申请删除' THEN 1 ELSE 0 END) AS deleteCount,
      SUM(CASE WHEN action = '需达人回复' THEN 1 ELSE 0 END) AS replyCount,
      SUM(CASE WHEN action = '私信沟通' THEN 1 ELSE 0 END) AS directMessageCount
    FROM key_comments kc
    WHERE kc.project_id = ?
  `;

  const listSql = `
    SELECT
      kc.id, kc.note_id AS noteId, kc.content, kc.author, kc.created_at AS createdAt,
      kc.sentiment, kc.category, kc.action, kc.treatment_status AS treatmentStatus,
      kc.treatment_method AS treatmentMethod, kc.first_seen_at AS firstSeenAt,
      kc.last_seen_at AS lastSeenAt, kc.disappeared_at AS disappearedAt,
      kc.reply_count AS replyCount,
      n.title AS noteTitle, n.author AS noteAuthor, n.url AS noteUrl
    FROM key_comments kc
    JOIN notes n ON n.id = kc.note_id
    JOIN project_notes pn ON pn.note_id = n.id AND pn.project_id = kc.project_id
    ${whereClause}
    ORDER BY kc.last_seen_at DESC
    LIMIT ? OFFSET ?
  `;

  try {
    const [countResult, summaryResult, listResult] = await Promise.all([
      d1.prepare(countSql).bind(...params).first<{ total: number }>(),
      d1.prepare(summarySql).bind(project).first<Record<string, number>>(),
      d1.prepare(listSql).bind(...params, pageSize, offset).all<Record<string, unknown>>(),
    ]);

    const total = countResult?.total || 0;
    return Response.json({
      ok: true,
      actions: listResult.results || [],
      pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      summary: summaryResult || {},
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '查询舆情处置列表失败', 500);
  }
}

export async function POST(request: Request) {
  let body: { id?: string; action?: string; method?: string; projectId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('无效的请求体');
  }

  const access = await requireProjectAccess(request, body.projectId, 'write');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  try {
    if (!body.id) return jsonError('缺少评论 ID');
    await ensureSchema();
    const d1 = db();

    if (body.action === 'resolve') {
      await d1
        .prepare("UPDATE key_comments SET treatment_status='已处置', treatment_method=? WHERE id=? AND project_id=?")
        .bind(body.method || '人工处理', body.id, project)
        .run();
      await logAction('处置评论', 'key_comment', body.id, `处置方式：${body.method || '人工处理'}`, project);
      return Response.json({ ok: true });
    }

    if (body.action === 'reopen') {
      await d1
        .prepare("UPDATE key_comments SET treatment_status='待处理', treatment_method=NULL WHERE id=? AND project_id=?")
        .bind(body.id, project)
        .run();
      await logAction('重置处置状态', 'key_comment', body.id, '重新打开待处理', project);
      return Response.json({ ok: true });
    }

    return jsonError('不支持的操作');
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '更新舆情处置状态失败', 500);
  }
}
