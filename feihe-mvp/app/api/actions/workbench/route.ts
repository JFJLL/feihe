import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { projectId } from '@/lib/projects';
import { ensureReviewTables, persistReviewBatch } from '@/lib/review-report';
import { availableReviewDates, reviewByDate } from '@/lib/review-seed';
import { logAction } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await apiUser())) return jsonError('请先登录', 401);
  await ensureSchema();
  const d1 = db();
  await ensureReviewTables(d1);

  const url = new URL(request.url);
  const project = projectId(url.searchParams.get('projectId'));
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
  const offset = (page - 1) * pageSize;

  const source = (url.searchParams.get('source') || 'all').trim();
  const status = (url.searchParams.get('status') || 'pending').trim();
  const action = (url.searchParams.get('action') || '').trim();
  const sentiment = (url.searchParams.get('sentiment') || '').trim();
  const category = (url.searchParams.get('category') || '').trim();
  const date = (url.searchParams.get('date') || '').trim();
  const query = (url.searchParams.get('query') || '').trim();

  const availableDates = await availableReviewDates(project).catch(() => [] as string[]);

  // If date is requested and no review batch exists yet, idempotent ensure batch exists
  if (date) {
    const existing = await d1.prepare('SELECT id FROM note_review_batches WHERE project_id=? AND date_key=? LIMIT 1').bind(project, date).first<{ id: string }>();
    if (!existing) {
      return Response.json({
        ok: true,
        items: [],
        total: 0,
        page,
        pageSize,
        summary: {
          totalPending: 0,
          replyPending: 0,
          deletePending: 0,
          supplementPending: 0,
          observePending: 0,
          handledCount: 0,
        },
        availableDates,
        needsRecalculation: true,
      });
    }
  }

  // Resolve target review date: either explicit user selection, or latest active batch
  const latestBatch = await d1.prepare('SELECT date_key FROM note_review_batches WHERE project_id=? ORDER BY date_key DESC LIMIT 1').bind(project).first<{ date_key: string }>();
  const effectiveReviewDate = date || (latestBatch ? latestBatch.date_key : null);

  // Overall KPI summary counts directly from DB
  const [kcSummary, raSummary] = await Promise.all([
    d1.prepare(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN action LIKE '%回复%' AND treatment_status != '已处理' THEN 1 ELSE 0 END) AS replyPending,
        SUM(CASE WHEN action LIKE '%删%' AND treatment_status != '已处理' THEN 1 ELSE 0 END) AS deletePending,
        SUM(CASE WHEN action LIKE '%补%' AND treatment_status != '已处理' THEN 1 ELSE 0 END) AS supplementPending,
        SUM(CASE WHEN action NOT LIKE '%回复%' AND action NOT LIKE '%删%' AND action NOT LIKE '%补%' AND treatment_status != '已处理' THEN 1 ELSE 0 END) AS observePending,
        SUM(CASE WHEN treatment_status = '已处理' THEN 1 ELSE 0 END) AS handledCount
      FROM key_comments
      WHERE project_id = ? AND disappeared_at IS NULL
    `).bind(project).first<{
      total: number; replyPending: number; deletePending: number; supplementPending: number; observePending: number; handledCount: number;
    }>(),
    d1.prepare(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN (action = 'needReply' OR action LIKE '%回复%') AND status != '已处理' THEN 1 ELSE 0 END) AS replyPending,
        SUM(CASE WHEN (action = 'needDelete' OR action LIKE '%删%') AND status != '已处理' THEN 1 ELSE 0 END) AS deletePending,
        SUM(CASE WHEN (action = 'needSupplement' OR action LIKE '%补%') AND status != '已处理' THEN 1 ELSE 0 END) AS supplementPending,
        SUM(CASE WHEN status = '已处理' THEN 1 ELSE 0 END) AS handledCount
      FROM review_action_items
      WHERE project_id = ? AND active = 1 AND (? = '' OR date_key = ?)
    `).bind(project, effectiveReviewDate || '', effectiveReviewDate || '').first<{
      total: number; replyPending: number; deletePending: number; supplementPending: number; handledCount: number;
    }>(),
  ]);

  const replyPending = Number(kcSummary?.replyPending || 0) + Number(raSummary?.replyPending || 0);
  const deletePending = Number(kcSummary?.deletePending || 0) + Number(raSummary?.deletePending || 0);
  const supplementPending = Number(kcSummary?.supplementPending || 0) + Number(raSummary?.supplementPending || 0);
  const observePending = Number(kcSummary?.observePending || 0);
  const handledCount = Number(kcSummary?.handledCount || 0) + Number(raSummary?.handledCount || 0);
  const totalPending = replyPending + deletePending + supplementPending + observePending;

  // Unified CTE for filtered rows
  const dateParam = date || '';
  const whereClauses: string[] = ['1=1'];
  const filterParams: unknown[] = [project, project];

  if (source === 'key-comment') {
    whereClauses.push("source = 'key-comment'");
  } else if (source === 'review-batch') {
    whereClauses.push("source = 'review-batch'");
  }

  if (status === 'pending') {
    whereClauses.push("status = 'pending'");
  } else if (status === 'handled') {
    whereClauses.push("status = 'handled'");
  }

  if (action) {
    whereClauses.push('action = ?');
    filterParams.push(action);
  }

  if (sentiment) {
    whereClauses.push('sentiment = ?');
    filterParams.push(sentiment);
  }

  if (category) {
    whereClauses.push('category = ?');
    filterParams.push(category);
  }

  if (dateParam) {
    whereClauses.push('(batchDate = ? OR batchDate IS NULL)');
    filterParams.push(dateParam);
  }

  if (query) {
    whereClauses.push('(content LIKE ? OR author LIKE ? OR noteId LIKE ? OR reason LIKE ? OR title LIKE ?)');
    const q = '%' + query + '%';
    filterParams.push(q, q, q, q, q);
  }

  const filterSql = ' WHERE ' + whereClauses.join(' AND ');

  const cteSql = `
    WITH unified AS (
      SELECT 
        'key-comment' AS source,
        kc.id AS rawId,
        'kc-' || kc.id AS id,
        'comment' AS itemType,
        kc.note_id AS noteId,
        kc.author AS author,
        kc.content AS content,
        kc.sentiment AS sentiment,
        kc.category AS category,
        CASE 
          WHEN kc.action LIKE '%回复%' THEN 'reply'
          WHEN kc.action LIKE '%删%' THEN 'delete'
          WHEN kc.action LIKE '%补%' THEN 'supplement'
          ELSE 'observe'
        END AS action,
        CASE WHEN kc.treatment_status = '已处理' THEN 'handled' ELSE 'pending' END AS status,
        kc.treatment_status AS rawStatus,
        kc.treatment_method AS treatmentMethod,
        kc.last_seen_at AS time,
        kc.sentiment || ' · ' || kc.category || ' · ' || kc.action AS reason,
        COALESCE(n.title, '') AS title,
        COALESCE(n.url, '') AS link,
        NULL AS batchDate
      FROM key_comments kc
      LEFT JOIN notes n ON n.id = kc.note_id
      WHERE kc.project_id = ? AND kc.disappeared_at IS NULL

      UNION ALL

      SELECT 
        'review-batch' AS source,
        CAST(ra.id AS TEXT) AS rawId,
        'rb-' || ra.id AS id,
        'note' AS itemType,
        ra.link AS noteId,
        ra.blogger AS author,
        ra.sample_json AS content,
        '' AS sentiment,
        '' AS category,
        CASE 
          WHEN ra.action = 'needReply' OR ra.action LIKE '%回复%' THEN 'reply'
          WHEN ra.action = 'needDelete' OR ra.action LIKE '%删%' THEN 'delete'
          WHEN ra.action = 'needSupplement' OR ra.action LIKE '%补%' THEN 'supplement'
          ELSE 'observe'
        END AS action,
        CASE WHEN ra.status = '已处理' THEN 'handled' ELSE 'pending' END AS status,
        ra.status AS rawStatus,
        '' AS treatmentMethod,
        ra.created_at AS time,
        ra.reason AS reason,
        ra.blogger AS title,
        ra.link AS link,
        ra.date_key AS batchDate
      FROM review_action_items ra
      WHERE ra.project_id = ? AND ra.active = 1 AND (? = '' OR ra.date_key = ?)
    )
  `;

  const [countRes, rowsRes] = await Promise.all([
    d1.prepare(cteSql + ' SELECT COUNT(*) AS total FROM unified' + filterSql).bind(project, project, effectiveReviewDate || '', effectiveReviewDate || '', ...filterParams.slice(2)).first<{ total: number }>(),
    d1.prepare(cteSql + ' SELECT * FROM unified' + filterSql + ' ORDER BY time DESC, id DESC LIMIT ? OFFSET ?')
      .bind(project, project, effectiveReviewDate || '', effectiveReviewDate || '', ...filterParams.slice(2), pageSize, offset).all<{
        source: 'key-comment' | 'review-batch';
        rawId: string;
        id: string;
        itemType: 'comment' | 'note';
        noteId: string;
        author: string;
        content: string;
        sentiment: string;
        category: string;
        action: 'reply' | 'delete' | 'supplement' | 'observe';
        status: 'pending' | 'handled';
        rawStatus: string;
        treatmentMethod: string;
        time: string;
        reason: string;
        title: string;
        link: string;
        batchDate: string | null;
      }>(),
  ]);

  const total = Number(countRes?.total || 0);
  const items = (rowsRes.results || []).map((row) => {
    let displayContent = row.content;
    if (row.source === 'review-batch') {
      try {
        const arr = JSON.parse(row.content || '[]');
        if (Array.isArray(arr) && arr.length > 0) {
          displayContent = arr.map((s) => String((s as { t?: string }).t || s || '')).filter(Boolean).join('；') || '判定需处理笔记';
        } else {
          displayContent = '判定需处理笔记';
        }
      } catch {
        displayContent = '判定需处理笔记';
      }
    }
    return {
      id: row.id,
      rawId: row.rawId,
      source: row.source,
      itemType: row.itemType,
      noteId: row.noteId,
      author: row.author,
      content: displayContent,
      sentiment: row.sentiment,
      category: row.category,
      action: row.action,
      status: row.status,
      treatmentMethod: row.treatmentMethod,
      time: row.time,
      reason: row.reason,
      title: row.title,
      link: row.link,
      batchDate: row.batchDate,
    };
  });

  return Response.json({
    ok: true,
    items,
    total,
    page,
    pageSize,
    summary: {
      totalPending,
      replyPending,
      deletePending,
      supplementPending,
      observePending,
      handledCount,
    },
    availableDates,
  });
}

export async function POST(request: Request) {
  if (!(await apiUser(true))) return jsonError('请先登录', 401);
  await ensureSchema();
  const d1 = db();
  await ensureReviewTables(d1);
  try {
    const body = await request.json() as {
      id?: string;
      rawId?: string;
      source?: 'key-comment' | 'review-batch';
      action?: 'resolve' | 'delete' | 'recalculate';
      method?: string;
      projectId?: string;
      date?: string;
    };
    const project = projectId(body.projectId);

    if (body.action === 'recalculate') {
      const dateKey = (body.date || '').trim();
      if (!dateKey) return jsonError('缺少日期参数', 400);
      const result = await reviewByDate(project, dateKey).catch(() => null);
      if (!result) return jsonError(dateKey + '暂无规则判定数据', 404);
      const batchId = await persistReviewBatch(d1, project, result);
      await logAction('重算规则判定批次', 'review_batch', batchId, `重算 ${dateKey} 批次待办`, project);
      return Response.json({ ok: true, batchId });
    }

    const source = body.source || (body.id?.startsWith('rb-') ? 'review-batch' : 'key-comment');
    const rawId = body.rawId || body.id?.replace(/^(kc-|rb-)/, '');
    if (!rawId) return jsonError('缺少项目 ID', 400);

    if (body.action === 'resolve') {
      const method = body.method || '已人工核实处置';
      const now = new Date().toISOString();
      if (source === 'key-comment') {
        await d1.prepare('UPDATE key_comments SET treatment_status = ?, treatment_method = ? WHERE id = ? AND project_id = ?')
          .bind('已处理', method, rawId, project).run();
      } else {
        await d1.prepare("UPDATE review_action_items SET status = '已处理', handled_at = ?, treatment_method = ? WHERE id = ? AND project_id = ?")
          .bind(now, method, Number(rawId), project).run();
      }
      await logAction('处置待办', source, rawId, `标记已处理：${method}`, project);
      return Response.json({ ok: true });
    }

    if (body.action === 'delete') {
      if (source === 'key-comment') {
        await d1.prepare('DELETE FROM key_comments WHERE id = ? AND project_id = ?').bind(rawId, project).run();
      } else {
        await d1.prepare('DELETE FROM review_action_items WHERE id = ? AND project_id = ?').bind(Number(rawId), project).run();
      }
      await logAction('删除待办', source, rawId, '移除待办项', project);
      return Response.json({ ok: true });
    }

    return jsonError('未知操作类型', 400);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : '操作失败', 500);
  }
}
