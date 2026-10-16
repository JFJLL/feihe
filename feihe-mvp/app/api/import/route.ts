import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { importRows, type ImportKind, type ImportRow } from '@/lib/import-rows';
import { finishJob, logAction, startJob } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { kind?: ImportKind; rows?: ImportRow[]; projectId?: string; sourceId?: string } = {};
  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonError('无效的请求数据');
  }

  const access = await requireProjectAccess(request, body.projectId, 'write');
  if (!access.ok) return jsonError(access.error!, access.status!);

  const project = access.context!.projectId;
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!body.kind || !rows.length) return jsonError('没有可导入的数据');

  try {
    const sourceId = body.sourceId || 'default_supplier';
    const jobId = await startJob('import', body.kind === 'owned' ? '导入自有笔记' : '导入供应商交付', rows.length, project);
    const result = await importRows(body.kind, rows, true, project, sourceId);
    await finishJob(jobId, { succeeded: result.imported, failed: result.skipped, message: `导入 ${result.imported} 条` });
    await logAction('导入数据', body.kind, '', `${result.imported} 条，跳过 ${result.skipped} 条`, project);
    return Response.json({ ok: true, ...result, jobId });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '导入失败', 500);
  }
}
