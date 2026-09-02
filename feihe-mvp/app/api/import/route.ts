import { apiUser, jsonError } from '@/lib/api-auth';
import { importRows, type ImportKind, type ImportRow } from '@/lib/import-rows';
import { finishJob, logAction, startJob } from '@/lib/ops';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!(await apiUser(true))) return jsonError('请先登录', 401);
  try {
    const body = await request.json() as { kind?: ImportKind; rows?: ImportRow[]; projectId?: string };
    const project=projectId(body.projectId);
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 5000) : [];
    if (!body.kind || !rows.length) return jsonError('没有可导入的数据');
    const jobId = await startJob('import', body.kind === 'owned' ? '导入自有笔记' : '导入供应商交付', rows.length,project);
    const result = await importRows(body.kind, rows,true,project);
    await finishJob(jobId, { succeeded: result.imported, failed: result.skipped, message: `导入 ${result.imported} 条` });
    await logAction('导入数据',body.kind,'',`${result.imported} 条，跳过 ${result.skipped} 条`,project);
    return Response.json({ ok: true, ...result, jobId });
  } catch (error) { return jsonError(error instanceof Error ? error.message : '导入失败', 500); }
}
