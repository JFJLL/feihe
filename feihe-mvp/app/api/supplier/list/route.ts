import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await apiUser())) return jsonError('请先登录', 401);
  await ensureSchema();
  const d1 = db();
  const url = new URL(request.url);
  const project = projectId(url.searchParams.get('projectId'));
  const visibility = (url.searchParams.get('visibility') || '').trim();
  const query = (url.searchParams.get('query') || '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
  const offset = (page - 1) * pageSize;

  const conditions = ['sc.project_id = ?'];
  const params: unknown[] = [project];

  if (visibility) {
    conditions.push('sc.visibility = ?');
    params.push(visibility);
  }
  if (query) {
    conditions.push('(sc.note_id LIKE ? OR sc.creator LIKE ? OR sc.planned_content LIKE ? OR sc.matched_content LIKE ?)');
    const q = '%' + query + '%';
    params.push(q, q, q, q);
  }

  const whereClause = ' WHERE ' + conditions.join(' AND ');

  const [totalRow, summaryRows, itemsRows] = await Promise.all([
    d1.prepare('SELECT COUNT(*) AS total FROM supplier_comments sc' + whereClause).bind(...params).first<{ total: number }>(),
    d1.prepare('SELECT COUNT(*) AS total, ' +
      "SUM(CASE WHEN visibility = '当前外显-原文一致' THEN 1 ELSE 0 END) AS exactCount, " +
      "SUM(CASE WHEN visibility = '当前外显-有修改' THEN 1 ELSE 0 END) AS modifiedCount, " +
      "SUM(CASE WHEN visibility = '当前未外显' THEN 1 ELSE 0 END) AS missingCount, " +
      "SUM(CASE WHEN visibility = '待核验' THEN 1 ELSE 0 END) AS pendingCount " +
      'FROM supplier_comments sc WHERE sc.project_id = ?').bind(project).first<{
      total: number;
      exactCount: number;
      modifiedCount: number;
      missingCount: number;
      pendingCount: number;
    }>(),
    d1.prepare('SELECT id, note_id AS noteId, note_url AS noteUrl, creator, ' +
      'planned_content AS plannedContent, comment_format AS commentFormat, ' +
      'visibility, matched_content AS matchedContent, verified_at AS verifiedAt ' +
      'FROM supplier_comments sc' + whereClause + ' ' +
      "ORDER BY COALESCE(verified_at, '') DESC, id DESC " +
      'LIMIT ? OFFSET ?').bind(...params, pageSize, offset).all(),
  ]);

  const total = Number(totalRow?.total || 0);
  const summary = {
    total: Number(summaryRows?.total || 0),
    exactCount: Number(summaryRows?.exactCount || 0),
    modifiedCount: Number(summaryRows?.modifiedCount || 0),
    missingCount: Number(summaryRows?.missingCount || 0),
    pendingCount: Number(summaryRows?.pendingCount || 0),
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
