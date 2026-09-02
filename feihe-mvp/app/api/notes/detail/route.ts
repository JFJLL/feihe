import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await apiUser())) return jsonError('请先登录', 401);
  const params=new URL(request.url).searchParams; const id=params.get('id'); const project=projectId(params.get('projectId')); if (!id) return jsonError('缺少笔记 ID');
  await ensureSchema(); const d1 = db();
  const [note, snapshots, comments] = await Promise.all([
    d1.prepare(`SELECT n.id,n.url,n.author,n.title,pn.source_type AS sourceType,pn.pipeline,pn.product_scope AS productScope,pn.last_fetched_at AS lastFetchedAt,
      pn.comment_total AS commentTotal,pn.positive_count AS positiveCount,pn.negative_count AS negativeCount,pn.question_count AS questionCount,pn.brand_mention_top5 AS brandMentionTop5,pn.status FROM notes n JOIN project_notes pn ON pn.note_id=n.id WHERE n.id=? AND pn.project_id=?`).bind(id,project).first(),
    d1.prepare(`SELECT captured_at AS capturedAt,l1_count AS l1Count,l2_count AS l2Count,total_count AS totalCount,positive_count AS positiveCount,negative_count AS negativeCount,question_count AS questionCount FROM comment_snapshots WHERE project_id=? AND note_id=? ORDER BY captured_at DESC LIMIT 12`).bind(project,id).all(),
    d1.prepare(`SELECT id,content,author,sentiment,category,action,treatment_status AS treatmentStatus,last_seen_at AS lastSeenAt,disappeared_at AS disappearedAt,reply_count AS replyCount FROM key_comments WHERE project_id=? AND note_id=? ORDER BY last_seen_at DESC LIMIT 60`).bind(project,id).all(),
  ]);
  return Response.json({ ok: true, note, snapshots: snapshots.results, comments: comments.results });
}
