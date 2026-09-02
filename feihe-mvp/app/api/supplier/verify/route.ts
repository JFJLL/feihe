import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { similarity } from '@/lib/store';
import { fetchAllComments } from '@/lib/xhs';
import { finishJob, logAction, startJob } from '@/lib/ops';
import { getProjectSetting, projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!(await apiUser(true))) return jsonError('请先登录', 401);
  try {
    const body = await request.json() as { noteIds?: string[]; projectId?: string }; const project=projectId(body.projectId);
    await ensureSchema(); const d1 = db();
    const acceptance=await getProjectSetting(project,'acceptance',{supplierSimilarity:.58}); const threshold=Math.min(1,Math.max(.3,Number(acceptance.supplierSimilarity||.58)));
    const selected = (body.noteIds || []).filter(Boolean).slice(0, 40);
    const rows = selected.length
      ? await d1.prepare(`SELECT id,note_id AS noteId,planned_content AS plannedContent FROM supplier_comments WHERE project_id=? AND note_id IN (${selected.map(() => '?').join(',')})`).bind(project,...selected).all<{ id: number; noteId: string; plannedContent: string }>()
      : await d1.prepare('SELECT id,note_id AS noteId,planned_content AS plannedContent FROM supplier_comments WHERE project_id=? AND visibility=\'待核验\' LIMIT 300').bind(project).all<{ id: number; noteId: string; plannedContent: string }>();
    const grouped = new Map<string, typeof rows.results>();
    for (const row of rows.results || []) grouped.set(row.noteId, [...(grouped.get(row.noteId) || []), row]);
    const summary = { exact: 0, modified: 0, missing: 0, failedNotes: 0 };
    const jobId = await startJob('supplier_verify',`核验 ${grouped.size} 篇供应商评论`,rows.results.length,project);
    for (const [noteId, planned] of grouped) {
      try {
        const live = await fetchAllComments(noteId,project); const now = new Date().toISOString();
        for (const row of planned) {
          let best = { score: 0, content: '' };
          for (const comment of live.comments) { const score = similarity(row.plannedContent, comment.content); if (score > best.score) best = { score, content: comment.content }; }
          const visibility = best.score === 1 ? '当前外显-原文一致' : best.score >= threshold ? '当前外显-有修改' : '当前未外显';
          if (best.score === 1) summary.exact += 1; else if (best.score >= threshold) summary.modified += 1; else summary.missing += 1;
          await d1.prepare('UPDATE supplier_comments SET visibility=?,matched_content=?,verified_at=? WHERE id=?').bind(visibility,best.score>=threshold?best.content:null,now,row.id).run();
        }
      } catch { summary.failedNotes += 1; }
    }
    await finishJob(jobId, { succeeded: summary.exact + summary.modified + summary.missing, failed: summary.failedNotes, message: `外显 ${summary.exact + summary.modified}，未外显 ${summary.missing}` });
    await logAction('供应商外显核验','supplier','',`原文 ${summary.exact}，修改 ${summary.modified}，未外显 ${summary.missing}`,project);
    return Response.json({ ok: true, summary, notes: grouped.size, jobId });
  } catch (error) { return jsonError(error instanceof Error ? error.message : '核验失败', 500); }
}
