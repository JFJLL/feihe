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
    const summary = { exact: 0, modified: 0, missing: 0, failedNotes: 0 };
    let totalProcessed = 0;
    const MAX_BATCHES = 5;
    let batch = 0;
    const jobId = await startJob('supplier_verify', '核验供应商评论', 0, project);

    while (batch < MAX_BATCHES) {
      batch++;
      const rows = selected.length && batch === 1
        ? await d1.prepare(`SELECT id,note_id AS noteId,planned_content AS plannedContent FROM supplier_comments WHERE project_id=? AND note_id IN (${selected.map(() => '?').join(',')})`).bind(project,...selected).all<{ id: number; noteId: string; plannedContent: string }>()
        : await d1.prepare("SELECT id,note_id AS noteId,planned_content AS plannedContent FROM supplier_comments WHERE project_id=? AND visibility='待核验' LIMIT 300").bind(project).all<{ id: number; noteId: string; plannedContent: string }>();

      if (!rows.results || rows.results.length === 0) break;

      const grouped = new Map<string, typeof rows.results>();
      for (const row of rows.results) grouped.set(row.noteId, [...(grouped.get(row.noteId) || []), row]);

      for (const [noteId, planned] of grouped) {
        let comments: Array<{ content: string }> = [];
        try {
          const live = await fetchAllComments(noteId, project);
          comments = live.comments || [];
        } catch {
          const localKc = await d1.prepare('SELECT content FROM key_comments WHERE project_id=? AND note_id=?').bind(project, noteId).all<{ content: string }>().catch(() => ({ results: [] }));
          if (localKc.results && localKc.results.length > 0) {
            comments = localKc.results;
          } else {
            summary.failedNotes += 1;
          }
        }

        const now = new Date().toISOString();
        const updateStmts = [];
        for (const row of planned) {
          let best = { score: 0, content: '' };
          for (const comment of comments) {
            const score = similarity(row.plannedContent, comment.content);
            if (score > best.score) best = { score, content: comment.content };
          }
          const visibility = best.score === 1 ? '当前外显-原文一致' : best.score >= threshold ? '当前外显-有修改' : '当前未外显';
          if (best.score === 1) summary.exact += 1;
          else if (best.score >= threshold) summary.modified += 1;
          else summary.missing += 1;
          updateStmts.push(d1.prepare('UPDATE supplier_comments SET visibility=?,matched_content=?,verified_at=? WHERE id=?')
            .bind(visibility, best.score >= threshold ? best.content : null, now, row.id));
          totalProcessed++;
        }
        if (updateStmts.length > 0) {
          await d1.batch(updateStmts);
        }
      }

      if (selected.length > 0) break;
    }

    const remainingRow = await d1.prepare("SELECT COUNT(*) AS count FROM supplier_comments WHERE project_id=? AND visibility='待核验'").bind(project).first<{ count: number }>();
    const remaining = Number(remainingRow?.count || 0);

    await finishJob(jobId, { succeeded: summary.exact + summary.modified + summary.missing, failed: summary.failedNotes, message: `外显 ${summary.exact + summary.modified}，未外显 ${summary.missing}，剩余待核验 ${remaining}` });
    await logAction('供应商外显核验','supplier','',`原文 ${summary.exact}，修改 ${summary.modified}，未外显 ${summary.missing}`,project);
    return Response.json({ ok: true, summary, processed: totalProcessed, remaining, failedNotes: summary.failedNotes, jobId });
  } catch (error) { return jsonError(error instanceof Error ? error.message : '核验失败', 500); }
}
