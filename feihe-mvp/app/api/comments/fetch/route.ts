import { apiUser, jsonError } from '@/lib/api-auth';
import { fetchAllComments } from '@/lib/xhs';
import { noteIdFrom, saveFetchedComments } from '@/lib/store';
import { finishJob, logAction, startJob } from '@/lib/ops';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!(await apiUser(true))) return jsonError('请先登录', 401);
  try {
    const body = await request.json() as { noteIds?: string[] | string; projectId?: string }; const project=projectId(body.projectId);
    const values = Array.isArray(body.noteIds) ? body.noteIds : String(body.noteIds || '').split(/[\s,，]+/);
    const noteIds = [...new Set(values.map(noteIdFrom).filter((id) => /^[0-9a-f]{24}$/i.test(id)))].slice(0, 20);
    if (!noteIds.length) return jsonError('请输入有效的笔记 ID 或链接');
    const jobId = await startJob('comment_fetch',`抓取 ${noteIds.length} 篇笔记全量评论`,noteIds.length,project);
    const results = [];
    for (const noteId of noteIds) {
      try {
        const fetched = await fetchAllComments(noteId,project);
        const metrics = await saveFetchedComments(noteId,fetched.comments,fetched.fetchedL1,fetched.fetchedL2,project);
        results.push({ ok: true, noteId, reportedL1: fetched.reportedL1, fetchedL1: fetched.fetchedL1, fetchedL2: fetched.fetchedL2, ...metrics });
      } catch (error) {
        results.push({ ok: false, noteId, error: error instanceof Error ? error.message : String(error) });
      }
    }
    const succeeded = results.filter((item) => item.ok).length;
    await finishJob(jobId, { succeeded, failed: results.length - succeeded, message: `完成 ${succeeded}/${results.length} 篇` });
    await logAction('全量评论抓取','note_batch',noteIds.join(','),`成功 ${succeeded}，失败 ${results.length - succeeded}`,project);
    return Response.json({ ok: results.some((item) => item.ok), results, jobId });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '抓取失败', 500);
  }
}
