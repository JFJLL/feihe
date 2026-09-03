import { apiUser, jsonError } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { projectId } from '@/lib/projects';
import { reviewByDate, availableReviewDates } from '@/lib/review-seed';
import { ensureReviewTables, persistReviewBatch } from '@/lib/review-report';
export const dynamic = 'force-dynamic';
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
  return Response.json({ ok: true, batchId, ...result, samples: undefined });
}
