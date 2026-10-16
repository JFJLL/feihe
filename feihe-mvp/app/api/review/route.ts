import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { reviewByDate, availableReviewDates } from '@/lib/review-seed';
import { ensureReviewTables, persistReviewBatch } from '@/lib/review-report';
import { logAction } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { action?: string; id?: number; projectId?: string; date?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('无效的请求体', 400);
  }

  const access = await requireProjectAccess(request, body.projectId, 'write');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  try {
    await ensureSchema();
    const d1 = db();
    await ensureReviewTables(d1);

    if (body.action === 'resolve' && body.id) {
      await d1
        .prepare("UPDATE review_action_items SET status='已处理', handled_at=? WHERE id=? AND project_id=?")
        .bind(new Date().toISOString(), body.id, project)
        .run();
      await logAction('解决待办项', 'review_action', String(body.id), '标记为已处理', project);
      return Response.json({ ok: true });
    }

    if (body.action === 'recalculate' || body.action === 'rebuild') {
      const dateKey = (body.date || '').trim();
      if (!dateKey) return jsonError('缺少日期参数', 400);
      const result = await reviewByDate(project, dateKey).catch(() => null);
      if (!result) return jsonError(dateKey + '暂无判定数据', 404);
      const batchId = await persistReviewBatch(d1, project, result);
      await logAction('重算规则批次', 'review_batch', batchId, `重算 ${dateKey} 批次`, project);
      return Response.json({ ok: true, batchId });
    }

    return jsonError('参数错误', 400);
  } catch (e) {
    console.error('[POST /api/review ERROR]:', e);
    return jsonError(e instanceof Error ? e.message : '更新失败', 500);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const access = await requireProjectAccess(request, url.searchParams.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  await ensureSchema();
  const date = (url.searchParams.get('date') || '').trim();
  const d1 = db();

  if (!date) {
    const dates = await availableReviewDates(project).catch(() => [] as string[]);
    return Response.json({ ok: true, dates });
  }

  const existingBatch = await d1
    .prepare('SELECT id, project_id, date_key, counts_json FROM note_review_batches WHERE project_id=? AND date_key=? LIMIT 1')
    .bind(project, date)
    .first<{ id: string; project_id: string; date_key: string; counts_json: string }>();

  if (!existingBatch) {
    return Response.json({
      ok: true,
      batch: null,
      items: [],
      needsRecalculation: true,
    });
  }

  const items = await d1
    .prepare(
      `SELECT id, item_key, batch_id, project_id, date_key, link, blogger, action, reason, sample_json, status, handled_at, created_at
      FROM review_action_items
      WHERE project_id=? AND date_key=?
      ORDER BY id ASC`
    )
    .bind(project, date)
    .all();

  return Response.json({
    ok: true,
    batch: existingBatch,
    items: items.results || [],
    needsRecalculation: false,
  });
}
