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
  const view = (url.searchParams.get('view') || 'registry').trim();
  const query = (url.searchParams.get('query') || '').trim();
  const from = (url.searchParams.get('from') || '').trim();
  const to = (url.searchParams.get('to') || '').trim();
  const source = (url.searchParams.get('source') || '').trim();
  const scope = (url.searchParams.get('scope') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();
  const category = (url.searchParams.get('category') || '').trim();
  const monitored = (url.searchParams.get('monitored') || '').trim();
  const sort = (url.searchParams.get('sort') || '').trim();
  const order = (url.searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
  const offset = (page - 1) * pageSize;

  const conditions = ['pn.project_id = ?'];
  const params: unknown[] = [project];

  if (view === 'publishing') {
    conditions.push("pn.source_type IN ('owned', 'commercial')");
  }

  if (query) {
    conditions.push('(n.title LIKE ? OR n.author LIKE ? OR n.id LIKE ?)');
    const q = '%' + query + '%';
    params.push(q, q, q);
  }
  if (from) {
    conditions.push('(date(COALESCE(n.published_at, pn.last_fetched_at, pn.added_at)) >= date(?) OR COALESCE(n.published_at, pn.last_fetched_at, pn.added_at) IS NULL)');
    params.push(from);
  }
  if (to) {
    conditions.push('(date(COALESCE(n.published_at, pn.last_fetched_at, pn.added_at)) <= date(?) OR COALESCE(n.published_at, pn.last_fetched_at, pn.added_at) IS NULL)');
    params.push(to);
  }
  if (source) {
    conditions.push('pn.source_type = ?');
    params.push(source);
  }
  if (scope) {
    conditions.push('pn.product_scope = ?');
    params.push(scope);
  }
  if (status) {
    conditions.push('pn.status = ?');
    params.push(status);
  }
  if (category) {
    conditions.push('p.category1 = ?');
    params.push(category);
  }
  if (monitored === '1') {
    conditions.push("(pn.status != '待抓取' OR pn.last_fetched_at IS NOT NULL)");
  } else if (monitored === '0') {
    conditions.push("(pn.status = '待抓取' AND pn.last_fetched_at IS NULL)");
  }

  const whereClause = ' WHERE ' + conditions.join(' AND ');

  let orderBy = 'COALESCE(pn.last_fetched_at, n.published_at, pn.added_at) DESC, n.id DESC';
  if (sort === 'reads' || sort === 'readCount') {
    orderBy = 'p.read_count ' + order + ', n.id DESC';
  } else if (sort === 'interactions' || sort === 'interactionCount') {
    orderBy = 'p.interaction_count ' + order + ', n.id DESC';
  } else if (sort === 'comments' || sort === 'commentTotal') {
    orderBy = 'pn.comment_total ' + order + ', n.id DESC';
  } else if (sort === 'publishedAt') {
    orderBy = 'COALESCE(n.published_at, pn.added_at) ' + order + ', n.id DESC';
  } else if (sort === 'lastFetchedAt') {
    orderBy = 'pn.last_fetched_at ' + order + ', n.id DESC';
  } else if (sort === 'cpe') {
    orderBy = 'CASE WHEN p.interaction_count > 0 AND p.note_price IS NOT NULL THEN 0 ELSE 1 END, (p.note_price / p.interaction_count) ' + order + ', n.id DESC';
  }

  const countSql = 'SELECT COUNT(*) AS total FROM notes n JOIN project_notes pn ON pn.note_id = n.id LEFT JOIN note_profiles p ON p.note_id = n.id' + whereClause;

  const summarySql = `
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN (p.cover_url IS NOT NULL AND p.cover_url != '') THEN 1 ELSE 0 END) AS coverCount,
      SUM(CASE WHEN (p.category1 IS NOT NULL AND p.category1 != '') THEN 1 ELSE 0 END) AS categoryCount,
      SUM(CASE WHEN (p.read_count IS NOT NULL AND p.read_count > 0) OR (p.interaction_count IS NOT NULL AND p.interaction_count > 0) THEN 1 ELSE 0 END) AS performanceMetricCount,
      SUM(CASE WHEN (n.url IS NOT NULL AND n.url != '') THEN 1 ELSE 0 END) AS linkCount,
      SUM(CASE WHEN (p.creator_level IS NOT NULL AND p.creator_level != '') THEN 1 ELSE 0 END) AS creatorLevelCount,
      SUM(CASE WHEN (p.read_count IS NOT NULL AND p.read_count > 0) THEN 1 ELSE 0 END) AS readMetricCount,
      SUM(CASE WHEN (p.interaction_count IS NOT NULL AND p.interaction_count > 0) THEN 1 ELSE 0 END) AS interactionMetricCount,
      SUM(CASE WHEN pn.source_type IN ('owned', 'commercial') THEN 1 ELSE 0 END) AS ownedCount,
      SUM(CASE WHEN pn.source_type = 'commercial' OR p.cooperation = 1 THEN 1 ELSE 0 END) AS commercialCount,
      SUM(CASE WHEN pn.source_type = 'owned' AND (n.published_at IS NOT NULL AND n.published_at != '') THEN 1 ELSE 0 END) AS ownedPublishedCount,
      SUM(CASE WHEN (n.published_at IS NOT NULL AND n.published_at != '') THEN 1 ELSE 0 END) AS publishedCount,
      SUM(CASE WHEN pn.source_type = 'keyword_scan' THEN 1 ELSE 0 END) AS scanCount,
      SUM(CASE WHEN (p.cover_url IS NOT NULL AND p.cover_url != '') 
                AND (p.read_count IS NOT NULL AND p.read_count > 0) 
                AND (p.category1 IS NOT NULL AND p.category1 != '') THEN 1 ELSE 0 END) AS completeCount,
      SUM(CASE WHEN pn.status = '符合且能汇报' THEN 1 ELSE 0 END) AS reportableCount,
      SUM(CASE WHEN pn.status = '符合基础要求' THEN 1 ELSE 0 END) AS baseCount,
      SUM(CASE WHEN pn.status LIKE '%补充%' THEN 1 ELSE 0 END) AS supplementCount,
      SUM(CASE WHEN pn.status != '待抓取' OR pn.last_fetched_at IS NOT NULL THEN 1 ELSE 0 END) AS fetchedCount,
      SUM(CASE WHEN pn.status = '待抓取' AND pn.last_fetched_at IS NULL THEN 1 ELSE 0 END) AS unfetchedCount,
      COALESCE(SUM(pn.comment_total), 0) AS totalComments,
      COALESCE(SUM(p.read_count), 0) AS totalReads,
      COALESCE(SUM(p.interaction_count), 0) AS totalInteractions
    FROM notes n
    JOIN project_notes pn ON pn.note_id = n.id
    LEFT JOIN note_profiles p ON p.note_id = n.id
    WHERE pn.project_id = ?
  `;

  const listSql = `
    SELECT 
      n.id, n.url, n.author, n.title, n.published_at AS publishedAt,
      pn.source_type AS sourceType, pn.pipeline, pn.level, pn.product_scope AS productScope,
      pn.status, pn.last_fetched_at AS lastFetchedAt,
      pn.comment_total AS commentTotal, pn.positive_count AS positiveCount,
      pn.negative_count AS negativeCount, pn.question_count AS questionCount,
      pn.brand_mention_top5 AS brandMentionTop5, pn.added_at AS addedAt,
      p.cover_url AS coverUrl, p.category1, p.category2, p.note_type AS noteType,
      p.read_count AS readCount, p.interaction_count AS interactionCount,
      p.like_count AS likeCount, p.favorite_count AS favoriteCount,
      p.creator_level AS creatorLevel, p.brand, p.note_price AS notePrice,
      CASE WHEN p.interaction_count > 0 AND p.note_price IS NOT NULL THEN ROUND(p.note_price / p.interaction_count, 2) ELSE NULL END AS cpe,
      snap.captured_at AS latestSnapshotTime,
      snap.l1_count AS latestL1Count,
      snap.l2_count AS latestL2Count,
      snap.total_count AS latestSnapshotTotal,
      prev_snap.total_count AS prevSnapshotTotal,
      CASE WHEN snap.total_count IS NULL THEN NULL WHEN prev_snap.total_count IS NULL THEN NULL ELSE (snap.total_count - prev_snap.total_count) END AS commentDelta,
      CASE WHEN pn.status != '待抓取' OR pn.last_fetched_at IS NOT NULL OR snap.captured_at IS NOT NULL THEN 1 ELSE 0 END AS isFetched,
      CASE WHEN (p.cover_url IS NOT NULL AND p.cover_url != '') 
            AND (p.read_count IS NOT NULL AND p.read_count > 0) 
            AND (p.category1 IS NOT NULL AND p.category1 != '') THEN 1 ELSE 0 END AS isProfileComplete,
      COALESCE(kc.pendingCount, 0) AS pendingRiskCount
    FROM notes n
    JOIN project_notes pn ON pn.note_id = n.id
    LEFT JOIN note_profiles p ON p.note_id = n.id
    LEFT JOIN (
      SELECT note_id, captured_at, l1_count, l2_count, total_count,
             ROW_NUMBER() OVER(PARTITION BY note_id ORDER BY captured_at DESC) AS rn
      FROM comment_snapshots WHERE project_id = ?
    ) snap ON snap.note_id = n.id AND snap.rn = 1
    LEFT JOIN (
      SELECT note_id, total_count,
             ROW_NUMBER() OVER(PARTITION BY note_id ORDER BY captured_at DESC) AS rn
      FROM comment_snapshots WHERE project_id = ?
    ) prev_snap ON prev_snap.note_id = n.id AND prev_snap.rn = 2
    LEFT JOIN (
      SELECT note_id, COUNT(*) AS pendingCount
      FROM key_comments
      WHERE project_id = ? AND treatment_status = '待处理'
      GROUP BY note_id
    ) kc ON kc.note_id = n.id
    ` + whereClause + `
    ORDER BY ` + orderBy + `
    LIMIT ? OFFSET ?
  `;

  const coverageFeedbackSql = `
    SELECT 
      COALESCE(NULLIF(p.category1, ''), '待补充内容方向') AS direction,
      SUM(CASE WHEN pn.source_type = 'owned' THEN 1 ELSE 0 END) AS owned,
      SUM(CASE WHEN pn.source_type = 'commercial' OR p.cooperation = 1 THEN 1 ELSE 0 END) AS commercial,
      SUM(CASE WHEN pn.source_type = 'keyword_scan' THEN 1 ELSE 0 END) AS natural,
      COALESCE(SUM(p.interaction_count), 0) AS interactions,
      COALESCE(SUM(pn.comment_total), 0) AS comments
    FROM notes n
    JOIN project_notes pn ON pn.note_id = n.id
    LEFT JOIN note_profiles p ON p.note_id = n.id
    WHERE pn.project_id = ?
    GROUP BY direction
    ORDER BY natural DESC, owned DESC
  `;

  const [totalRow, summaryRow, itemsRows, feedbackRows] = await Promise.all([
    d1.prepare(countSql).bind(...params).first<{ total: number }>(),
    d1.prepare(summarySql).bind(project).first<{
      total: number;
      coverCount: number;
      categoryCount: number;
      performanceMetricCount: number;
      linkCount: number;
      creatorLevelCount: number;
      readMetricCount: number;
      interactionMetricCount: number;
      ownedCount: number;
      commercialCount: number;
      ownedPublishedCount: number;
      publishedCount: number;
      scanCount: number;
      completeCount: number;
      reportableCount: number;
      baseCount: number;
      supplementCount: number;
      fetchedCount: number;
      unfetchedCount: number;
      totalComments: number;
      totalReads: number;
      totalInteractions: number;
    }>(),
    d1.prepare(listSql).bind(project, project, project, ...params, pageSize, offset).all(),
    d1.prepare(coverageFeedbackSql).bind(project).all<{ direction: string; owned: number; commercial: number; natural: number; interactions: number; comments: number }>(),
  ]);

  const total = Number(totalRow?.total || 0);
  const summary = {
    total: Number(summaryRow?.total || 0),
    coverCount: Number(summaryRow?.coverCount || 0),
    categoryCount: Number(summaryRow?.categoryCount || 0),
    performanceMetricCount: Number(summaryRow?.performanceMetricCount || 0),
    linkCount: Number(summaryRow?.linkCount || 0),
    creatorLevelCount: Number(summaryRow?.creatorLevelCount || 0),
    readMetricCount: Number(summaryRow?.readMetricCount || 0),
    interactionMetricCount: Number(summaryRow?.interactionMetricCount || 0),
    ownedCount: Number(summaryRow?.ownedCount || 0),
    commercialCount: Number(summaryRow?.commercialCount || 0),
    ownedPublishedCount: Number(summaryRow?.ownedPublishedCount || 0),
    publishedCount: Number(summaryRow?.publishedCount || 0),
    scanCount: Number(summaryRow?.scanCount || 0),
    completeCount: Number(summaryRow?.completeCount || 0),
    missingProfileCount: Math.max(0, Number(summaryRow?.total || 0) - Number(summaryRow?.performanceMetricCount || 0)),
    reportableCount: Number(summaryRow?.reportableCount || 0),
    baseCount: Number(summaryRow?.baseCount || 0),
    supplementCount: Number(summaryRow?.supplementCount || 0),
    fetchedCount: Number(summaryRow?.fetchedCount || 0),
    unfetchedCount: Number(summaryRow?.unfetchedCount || 0),
    totalComments: Number(summaryRow?.totalComments || 0),
    totalReads: Number(summaryRow?.totalReads || 0),
    totalInteractions: Number(summaryRow?.totalInteractions || 0),
  };

  return Response.json({
    ok: true,
    items: itemsRows.results || [],
    total,
    page,
    pageSize,
    summary,
    coverageFeedback: feedbackRows.results || [],
  });
}
