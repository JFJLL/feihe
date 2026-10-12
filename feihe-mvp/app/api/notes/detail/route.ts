import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id');
  if (!id) return jsonError('缺少笔记 ID');

  const access = await requireProjectAccess(request, params.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  await ensureSchema();
  const d1 = db();
  const [note, snapshots, comments] = await Promise.all([
    d1
      .prepare(
        `SELECT n.id, n.url, n.author, n.title, n.published_at AS publishedAt,
      pn.source_type AS sourceType, pn.pipeline, pn.level, pn.product_scope AS productScope,
      pn.status, pn.last_fetched_at AS lastFetchedAt,
      pn.comment_total AS commentTotal, pn.positive_count AS positiveCount,
      pn.negative_count AS negativeCount, pn.question_count AS questionCount,
      pn.brand_mention_top5 AS brandMentionTop5, pn.added_at AS addedAt,
      COALESCE(pnp.cover_url, p.cover_url, '') AS coverUrl,
      COALESCE(pnp.content, p.content, '') AS content,
      COALESCE(pnp.category1, p.category1, '') AS category1,
      COALESCE(pnp.category2, p.category2, '') AS category2,
      COALESCE(pnp.cooperation, p.cooperation, 0) AS cooperation,
      COALESCE(pnp.promoted, p.promoted, 0) AS promoted,
      COALESCE(pnp.note_type, p.note_type, '') AS noteType,
      COALESCE(pnp.note_price, p.note_price, 0) AS notePrice,
      p.exposure, p.read_count AS readCount, p.interaction_count AS interactionCount,
      p.like_count AS likeCount, p.favorite_count AS favoriteCount, p.share_count AS shareCount,
      p.fans_count AS fansCount, p.creator_level AS creatorLevel,
      COALESCE(pnp.picture_price, p.picture_price, 0) AS picturePrice,
      COALESCE(pnp.video_price, p.video_price, 0) AS videoPrice,
      p.province, p.city, p.gender,
      COALESCE(pnp.brand, p.brand, '') AS brand,
      COALESCE(pnp.updated_at, p.updated_at) AS profileUpdatedAt
      FROM notes n
      JOIN project_notes pn ON pn.note_id=n.id AND pn.project_id=?
      LEFT JOIN note_project_profiles pnp ON pnp.project_id=pn.project_id AND pnp.note_id=n.id
      LEFT JOIN note_profiles p ON p.note_id=n.id
      WHERE n.id=?`
      )
      .bind(project, id)
      .first(),
    d1
      .prepare(
        `SELECT captured_at AS capturedAt, l1_count AS l1Count, l2_count AS l2Count, total_count AS totalCount,
        positive_count AS positiveCount, negative_count AS negativeCount, question_count AS questionCount
        FROM comment_snapshots WHERE project_id=? AND note_id=? ORDER BY captured_at DESC LIMIT 12`
      )
      .bind(project, id)
      .all(),
    d1
      .prepare(
        `SELECT id, content, author, sentiment, category, action, treatment_status AS treatmentStatus,
        last_seen_at AS lastSeenAt, disappeared_at AS disappearedAt, reply_count AS replyCount
        FROM key_comments WHERE project_id=? AND note_id=? ORDER BY last_seen_at DESC LIMIT 60`
      )
      .bind(project, id)
      .all(),
  ]);

  if (!note) return jsonError('笔记不存在或不属于当前项目', 404);

  return Response.json({ ok: true, note, snapshots: snapshots.results, comments: comments.results });
}
