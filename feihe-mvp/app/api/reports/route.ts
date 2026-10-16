import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { getProjectDatasets } from '@/lib/datasets';
import { createProjectReport, reportBoard } from '@/lib/project-reports';
import { canonicalQuery, queryErrors, readDashboardLayout, type MetricQuery } from '@/lib/metrics/query';
import { DefinitionError } from '@/lib/metrics/definitions';
import { qicuiBusinessAvailable } from '@/lib/qicui-report';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url), access = await requireProjectAccess(request, url.searchParams.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const projectId = access.context!.projectId;
  let query: MetricQuery | undefined;
  try { if (url.searchParams.has('query')) query = JSON.parse(url.searchParams.get('query')!); } catch { return jsonError('报告周期格式无效'); }
  if (query !== undefined && queryErrors(query).length) return jsonError(queryErrors(query).join('；'));
  const count = await db().prepare('SELECT COUNT(*) AS total FROM report_versions WHERE project_id=?').bind(projectId).first<{ total: number }>();
  const totalPages = Math.max(1, Math.ceil((count?.total || 0) / 20)), page = Math.min(totalPages, Math.max(1, Math.trunc(Number(url.searchParams.get('page')) || 1)));
  const [board, datasets, rows] = await Promise.all([reportBoard(projectId), getProjectDatasets(projectId), db().prepare('SELECT id,title,period_start AS periodStart,period_end AS periodEnd,created_at AS createdAt,created_by AS createdBy FROM report_versions WHERE project_id=? ORDER BY created_at DESC,rowid DESC LIMIT 20 OFFSET ?').bind(projectId, (page - 1) * 20).all()]);
  const id = url.searchParams.get('id') || rows.results[0]?.id;
  const report = id ? await db().prepare('SELECT id,title,report_spec_json AS specJson,created_at AS createdAt,created_by AS createdBy FROM report_versions WHERE project_id=? AND id=?').bind(projectId, id).first() : null;
  if (id && !report) return jsonError('报告不存在或不属于本项目', 404);
  const spec = report ? JSON.parse(String(report.specJson)) : null;
  const reportQuery = query !== undefined ? canonicalQuery(query) : url.searchParams.has('id') && spec?.kind === 'project_metrics_report' ? spec.queryConfig : readDashboardLayout(board?.layoutJson).query;
  return Response.json({ ok: true, board, query: reportQuery, datasets, businessAvailable: await qicuiBusinessAvailable(projectId), reports: rows.results, total: count?.total || 0, pagination: { page, totalPages }, report: report ? { ...report, spec } : null }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function POST(request: Request) {
  let body: { projectId?: string; query?: MetricQuery; dashboardVersion?: number; prompt?: string; includeBusiness?: boolean };
  try { body = await request.json(); } catch { return jsonError('无效的报告请求'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonError('无效的报告请求');
  if (body.includeBusiness !== undefined && typeof body.includeBusiness !== 'boolean') return jsonError('报告内容选择无效');
  const access = await requireProjectAccess(request, body.projectId, 'write');
  if (!access.ok) return jsonError(access.error!, access.status!);
  try { return Response.json(await createProjectReport(access.context!, body)); }
  catch (error) { return jsonError(error instanceof Error ? error.message : '报告生成失败', error instanceof DefinitionError ? error.status : 500); }
}
