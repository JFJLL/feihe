import { apiUser, jsonError } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { projectId } from '@/lib/projects';
import { reviewByDate, availableReviewDates } from '@/lib/review-seed';
import { ensureReviewTables, persistReviewBatch } from '@/lib/review-report';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!(await apiUser())) return jsonError('请先登录', 401);
  try {
    const body = await request.json() as { action?: string; id?: number; projectId?: string };
    if (body.action !== 'resolve' || !body.id) return jsonError('参数错误', 400);
    const project = projectId(body.projectId);
    const d1 = db();
    await ensureReviewTables(d1);
    await d1.prepare('UPDATE review_action_items SET status=' + chr(39)*0 + "'已处理'" + ' WHERE id=? AND project_id=?').bind(body.id, project).run();
    return Response.json({ ok: true });
  } catch (e) { return jsonError(e instanceof Error ? e.message : '更新失败', 500); }
}
export async function GET(request: Request) {
  if (!(await apiUser())) return jsonError('请先登录', 401);
  const url = new URL(request.url);
  const project = projectId(url.searchParams.get('projectId'));
  const date = (url.searchParams.get('date') || '').trim();
  if (!date) {
    const dates = await availableReviewDates().catch(() => [] as string[]);
    return Response.json({ ok: true, dates });
  }
  const result = await reviewByDate(date).catch(() => null);
  if (!result) return jsonError(date + '暂无供应商执行数据', 404);
  const d1 = db();
  await ensureReviewTables(d1);
  const batchId = await persistReviewBatch(d1, project, result);
  if (url.searchParams.get('items') === '1') {
    const itemRows = await d1.prepare('SELECT id,link,blogger,action,reason,sample_json AS sampleJson,status FROM review_action_items WHERE batch_id=? ORDER BY id LIMIT 500').bind(batchId).all<{ id: number; link: string; blogger: string; action: string; reason: string; sampleJson: string; status: string }>();
    const items = (itemRows.results || []).map((it) => { let sample: string[] = []; try { const arr = JSON.parse(it.sampleJson || '[]'); if (Array.isArray(arr)) sample = arr.map((s) => String((s as { t?: string }).t || '')).filter(Boolean).slice(0, 2); } catch {} return { id: it.id, link: it.link, blogger: it.blogger, action: it.action, reason: it.reason, sample, status: it.status }; });
    return Response.json({ ok: true, batchId, dateKey: result.dateKey, counts: result.counts, items });
  }
  return Response.json({ ok: true, batchId, ...result, samples: undefined });
}
