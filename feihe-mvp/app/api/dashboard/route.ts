import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { projectId } from '@/lib/projects';
import { cacheNoteCovers } from '@/lib/note-covers';
import { DAILY_DATA, ALL_DATES } from '@/features/overview/overview-data';

export const dynamic = 'force-dynamic';

type Row = Record<string, string | number | null>;
const resultRows = (value: { results?: unknown[] } | null | undefined) => ((value?.results || []) as Row[]);

type CacheEntry = { json: string; timestamp: number };
const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10_000;

// 确保在任何部署环境（即使未手工跑 Python 导入）也能自动补齐 61 天真实日度数据
async function ensureDailyKpiSeeded(d1: ReturnType<typeof db>, project: string) {
  try {
    const existingDates = await d1.prepare('SELECT date FROM daily_kpi_metrics WHERE project_id=?').bind(project).all<{ date: string }>();
    const existingSet = new Set((existingDates.results || []).map((r) => r.date));

    const missingDates = ALL_DATES.filter((d) => !existingSet.has(d));
    if (!missingDates.length) return;

    const now = new Date().toISOString();
    const stmts = missingDates.map((dateKey) => {
      const d = DAILY_DATA[dateKey];
      return d1.prepare(`INSERT OR REPLACE INTO daily_kpi_metrics (
        id, project_id, date, plan_spend, actual_spend, achieve_pct,
        feed_spend, feed_ctr, search_spend, search_ctr, xhm_cpuv, xhx_cpuv,
        notes_today, comments_today, impressions, clicks, interactions, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        `${project}:${dateKey}`, project, dateKey, d.plan_spend, d.actual_spend, d.achieve_pct,
        d.feed_spend, d.feed_ctr, d.search_spend, d.search_ctr, d.xhm_cpuv, d.xhx_cpuv,
        d.notes_today, d.comments_today, d.actual_spend * 12, d.actual_spend * 0.8, d.comments_today * 20, now
      );
    });
    await d1.batch(stmts);
  } catch (err) {
    console.warn('ensureDailyKpiSeeded warning:', err);
  }
}

export async function GET(request: Request) {
  try {
    if (!(await apiUser())) return jsonError('请先登录', 401);
    await ensureSchema();
    const d1 = db();
   const params = new URL(request.url).searchParams;
   const project = projectId(params.get('projectId'));
   const fresh = params.get('fresh') === '1' || Boolean(params.get('_t'));
   const cleanParams = new URLSearchParams(params);
   cleanParams.delete('fresh');
   cleanParams.delete('_t');
   const cacheKey = `dash:${project}:${cleanParams.toString()}`;

   if (fresh) {
     for (const k of memoryCache.keys()) {
       if (k.startsWith(`dash:${project}:`)) {
         memoryCache.delete(k);
       }
     }
   } else {
   const cached = memoryCache.get(cacheKey);
   if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
     return new Response(cached.json, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
          'X-Cache': 'HIT',
        },
      });
    }
   }

    // 确保日度表已就绪
    await ensureDailyKpiSeeded(d1, project);

    const clauses: string[] = ['pn.project_id=?'];
    const values: string[] = [project];
    const from = params.get('from');
    const to = params.get('to');
    const source = params.get('source');
    const status = params.get('status');
    const scope = params.get('scope');

    if (from) {
      clauses.push('(date(COALESCE(pn.last_fetched_at,n.published_at))>=date(?) OR COALESCE(pn.last_fetched_at,n.published_at) IS NULL)');
      values.push(from);
    }
    if (to) {
      clauses.push('(date(COALESCE(pn.last_fetched_at,n.published_at))<=date(?) OR COALESCE(pn.last_fetched_at,n.published_at) IS NULL)');
      values.push(to);
    }
    if (source) { clauses.push('pn.source_type=?'); values.push(source); }
    if (status) { clauses.push('pn.status=?'); values.push(status); }
    if (scope) { clauses.push('pn.product_scope=?'); values.push(scope); }

    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const bind = (sql: string) => d1.prepare(sql).bind(...values);
    const trendValues = [from || '2000-01-01', to || '2999-12-31'];

    const [
      pipelines,
      noteAgg,
      supplierAgg,
      actionAgg,
      keyComments,
      notes,
      trend,
      sourceDist,
      scopeDist,
      statusDist,
      topics,
      brands,
      formats,
      levels,
      categories,
      locations,
      dataQuality,
      topNotes,
      adsTotals,
      adsAccounts,
      cachedCoversList,
      dailyKpiList,
    ] = await Promise.all([
      d1.prepare('SELECT key AS id,name,target_count AS targetCount,delivered_count AS deliveredCount,budget,spent FROM project_pipelines WHERE project_id=? ORDER BY rowid').bind(project).all(),
      bind(`SELECT COUNT(*) AS noteCount, COALESCE(SUM(pn.comment_total),0) AS commentTotal,
        COALESCE(SUM(pn.positive_count),0) AS positiveCount, COALESCE(SUM(pn.negative_count),0) AS negativeCount,
        COALESCE(SUM(pn.question_count),0) AS questionCount, COALESCE(SUM(p.exposure),0) AS exposure,
        COALESCE(SUM(p.read_count),0) AS readCount, COALESCE(SUM(p.interaction_count),0) AS interactionCount,
        COALESCE(SUM(p.note_price),0) AS creatorCost, COALESCE(SUM(p.like_count),0) AS likeCount,
        COALESCE(SUM(p.favorite_count),0) AS favoriteCount, COALESCE(SUM(p.share_count),0) AS shareCount,
        SUM(CASE WHEN p.promoted=1 THEN 1 ELSE 0 END) AS promotedCount,
        SUM(CASE WHEN p.cooperation=1 THEN 1 ELSE 0 END) AS commercialCount,
        SUM(CASE WHEN n.published_at IS NOT NULL OR pn.source_type='owned' THEN 1 ELSE 0 END) AS publishedCount
        FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where}`).first<Row>(),
      d1.prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN visibility='当前外显-原文一致' THEN 1 ELSE 0 END) AS exactCount,
        SUM(CASE WHEN visibility='当前外显-有修改' THEN 1 ELSE 0 END) AS modifiedCount,
        SUM(CASE WHEN visibility='当前未外显' THEN 1 ELSE 0 END) AS missingCount,
        SUM(CASE WHEN visibility='待核验' THEN 1 ELSE 0 END) AS pendingCount FROM supplier_comments WHERE project_id=?`).bind(project).first<Row>(),
      d1.prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN treatment_status='已处理' THEN 1 ELSE 0 END) AS handled,
        SUM(CASE WHEN action='需删除' AND treatment_status!='已处理' THEN 1 ELSE 0 END) AS deletePending,
        SUM(CASE WHEN action='需达人回复' AND treatment_status!='已处理' THEN 1 ELSE 0 END) AS replyPending,
        SUM(CASE WHEN disappeared_at IS NOT NULL THEN 1 ELSE 0 END) AS disappeared
        FROM key_comments WHERE project_id=? AND action!='保留观察'`).bind(project).first<Row>(),
      d1.prepare(`SELECT id,note_id AS noteId,content,author,sentiment,category,action,treatment_status AS treatmentStatus,
        treatment_method AS treatmentMethod,last_seen_at AS lastSeenAt,disappeared_at AS disappearedAt,reply_count AS replyCount
        FROM key_comments WHERE project_id=? ORDER BY CASE WHEN treatment_status='待处理' THEN 0 ELSE 1 END, last_seen_at DESC LIMIT 80`).bind(project).all(),
      bind(`SELECT n.id,n.url,n.author,n.title,pn.source_type AS sourceType,pn.pipeline,pn.level,pn.product_scope AS productScope,
        n.published_at AS publishedAt,pn.last_fetched_at AS lastFetchedAt,pn.comment_total AS commentTotal,
        pn.positive_count AS positiveCount,pn.negative_count AS negativeCount,pn.question_count AS questionCount,
        pn.brand_mention_top5 AS brandMentionTop5,pn.status,p.cover_url AS coverUrl,p.category1,p.category2,
        p.cooperation,p.promoted,p.note_type AS noteType,p.note_price AS notePrice,p.exposure,
        p.read_count AS readCount,p.interaction_count AS interactionCount,p.like_count AS likeCount,
        p.favorite_count AS favoriteCount,p.share_count AS shareCount,p.fans_count AS fansCount,
        p.creator_level AS creatorLevel,p.province,p.city,p.gender,p.brand,
        CASE WHEN p.exposure>0 THEN p.note_price*1000.0/p.exposure ELSE 0 END AS cpm,
        CASE WHEN p.read_count>0 THEN p.note_price*1.0/p.read_count ELSE 0 END AS cpr,
        CASE WHEN p.interaction_count>0 THEN p.note_price*1.0/p.interaction_count ELSE 0 END AS cpe,
        CASE WHEN p.read_count>0 THEN p.interaction_count*1.0/p.read_count ELSE 0 END AS engagementRate
        FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where}
        ORDER BY COALESCE(pn.last_fetched_at,n.published_at) DESC LIMIT 500`).all(),
      d1.prepare(`WITH latest AS (
        SELECT *,ROW_NUMBER() OVER(PARTITION BY note_id,date(captured_at) ORDER BY captured_at DESC) AS rn
        FROM comment_snapshots WHERE project_id=? AND date(captured_at) BETWEEN date(?) AND date(?)
      ) SELECT date(captured_at) AS date,SUM(total_count) AS total,SUM(positive_count) AS positive,
        SUM(negative_count) AS negative,SUM(question_count) AS question,SUM(irrelevant_count) AS irrelevant
        FROM latest WHERE rn=1 GROUP BY date(captured_at) ORDER BY date(captured_at)`).bind(project,...trendValues).all(),
      bind(`SELECT pn.source_type AS name,COUNT(*) AS count,SUM(pn.comment_total) AS comments FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where} GROUP BY pn.source_type ORDER BY count DESC`).all(),
      bind(`SELECT pn.product_scope AS name,COUNT(*) AS count,SUM(pn.comment_total) AS comments FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where} GROUP BY pn.product_scope ORDER BY count DESC`).all(),
      bind(`SELECT pn.status AS name,COUNT(*) AS count FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where} GROUP BY pn.status ORDER BY count DESC`).all(),
      d1.prepare(`SELECT category AS name,sentiment,COUNT(*) AS count,
        SUM(CASE WHEN treatment_status='待处理' THEN 1 ELSE 0 END) AS pending
        FROM key_comments WHERE project_id=? AND disappeared_at IS NULL GROUP BY category,sentiment ORDER BY count DESC LIMIT 16`).bind(project).all(),
      bind(`SELECT COALESCE(NULLIF(p.brand,''),CASE WHEN pn.product_scope='竞品' THEN '其他竞品' ELSE '本品' END) AS brand,
        COUNT(*) AS notes,SUM(pn.comment_total) AS comments,SUM(pn.positive_count) AS positive,
        SUM(pn.negative_count) AS negative,SUM(pn.question_count) AS question,
        SUM(p.read_count) AS reads,SUM(p.interaction_count) AS interactions,SUM(p.note_price) AS cost
        FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where} GROUP BY brand ORDER BY comments DESC,notes DESC LIMIT 12`).all(),
      bind(`SELECT COALESCE(NULLIF(p.note_type,''),'待补充') AS name,COUNT(*) AS count,SUM(p.interaction_count) AS interactions
        FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where} GROUP BY name ORDER BY count DESC`).all(),
      bind(`SELECT COALESCE(NULLIF(p.creator_level,''),'待补充') AS name,COUNT(*) AS count,AVG(p.read_count) AS avgRead,
        AVG(p.interaction_count) AS avgInteraction,AVG(CASE WHEN p.interaction_count>0 THEN p.note_price*1.0/p.interaction_count END) AS avgCpe
        FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where} GROUP BY name ORDER BY count DESC LIMIT 10`).all(),
      bind(`SELECT COALESCE(NULLIF(p.category1,''),'待补充') AS name,COUNT(*) AS count,SUM(p.read_count) AS reads,
        SUM(p.interaction_count) AS interactions FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where} GROUP BY name ORDER BY count DESC LIMIT 10`).all(),
      bind(`SELECT COALESCE(NULLIF(p.province,''),'待补充') AS name,COUNT(*) AS count,SUM(pn.comment_total) AS comments
        FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where} GROUP BY name ORDER BY count DESC LIMIT 12`).all(),
      bind(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN p.note_id IS NOT NULL THEN 1 ELSE 0 END) AS profileCount,
        SUM(CASE WHEN p.read_count>0 OR p.interaction_count>0 THEN 1 ELSE 0 END) AS metricCount,
        SUM(CASE WHEN p.category1!='' THEN 1 ELSE 0 END) AS categoryCount,
        SUM(CASE WHEN p.creator_level!='' THEN 1 ELSE 0 END) AS creatorCount,
        SUM(CASE WHEN pn.last_fetched_at IS NOT NULL THEN 1 ELSE 0 END) AS commentFetched,
        SUM(CASE WHEN n.url!='' THEN 1 ELSE 0 END) AS linkedCount
        FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where}`).first<Row>(),
      bind(`SELECT n.id,n.title,n.author,pn.product_scope AS productScope,pn.comment_total AS commentTotal,
        pn.positive_count AS positiveCount,pn.negative_count AS negativeCount,pn.question_count AS questionCount,
        p.read_count AS readCount,p.interaction_count AS interactionCount,p.note_price AS notePrice,
        p.creator_level AS creatorLevel,p.category1,p.brand,p.cover_url AS coverUrl,pn.status,
        CASE WHEN p.interaction_count>0 THEN p.note_price*1.0/p.interaction_count ELSE 0 END AS cpe
        FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where}
        ORDER BY (COALESCE(p.interaction_count,0)+pn.comment_total) DESC LIMIT 12`).all(),
      d1.prepare(`SELECT COUNT(*) AS accounts, COALESCE(SUM(spend),0) AS spend, COALESCE(SUM(impressions),0) AS impressions,
        COALESCE(SUM(clicks),0) AS clicks, COALESCE(SUM(interactions),0) AS interactions,
        CASE WHEN SUM(impressions)>0 THEN SUM(clicks)*1.0/SUM(impressions) ELSE 0 END AS ctr
        FROM paid_ad_metrics WHERE project_id=?`).bind(project).first(),
      d1.prepare(`SELECT account_name AS account, brand_name AS brand, metric_date AS metricDate, spend, impressions, clicks, ctr, interactions, balance
        FROM paid_ad_metrics WHERE project_id=? ORDER BY metric_date DESC, spend DESC LIMIT 60`).bind(project).all(),
      d1.prepare(`SELECT note_id AS noteId FROM note_covers WHERE project_id=? AND status='已缓存'`).bind(project).all<{ noteId: string }>(),
      (async (): Promise<{ results: Row[] }> => {
        try {
          return await d1.prepare(`SELECT date, plan_spend, actual_spend, achieve_pct, feed_spend, feed_ctr, search_spend, search_ctr, xhm_cpuv, xhx_cpuv, notes_today, comments_today, impressions, clicks, interactions FROM daily_kpi_metrics WHERE project_id=? ORDER BY date ASC`).bind(project).all<Row>();
        } catch {
          return { results: [] };
        }
      })(),
    ]);

    const topNoteRows = resultRows(topNotes);
    const cachedCoverSet = new Set(cachedCoversList.results.map((c) => c.noteId));

    for (const row of topNoteRows) {
      if (cachedCoverSet.has(String(row.id))) {
        row.coverUrl = `/api/note-covers?projectId=${encodeURIComponent(project)}&noteId=${encodeURIComponent(String(row.id))}`;
      }
    }
    for (const row of resultRows(notes)) {
      if (cachedCoverSet.has(String(row.id))) {
        row.coverUrl = `/api/note-covers?projectId=${encodeURIComponent(project)}&noteId=${encodeURIComponent(String(row.id))}`;
      }
    }

    const missingCoverIds = topNoteRows
      .filter((row) => !cachedCoverSet.has(String(row.id)))
      .map((row) => String(row.id))
      .slice(0, 6);
    if (missingCoverIds.length > 0) {
      void cacheNoteCovers(missingCoverIds, project, 6).catch(() => {});
    }

    const note = noteAgg || {};
    const positive = Number(note.positiveCount || 0);
    const negative = Number(note.negativeCount || 0);
    const question = Number(note.questionCount || 0);
    const commentTotal = Number(note.commentTotal || 0);
    const base = Math.max(1, commentTotal);
    const readCount = Number(note.readCount || 0);
    const interactionCount = Number(note.interactionCount || 0);
    const cost = Number(note.creatorCost || 0);
    const exposure = Number(note.exposure || 0);

    const payload = {
      ok: true,
      pipelines: pipelines.results,
      metrics: {
        ...note,
        noteCount: Number(note.noteCount || 0),
        commentTotal,
        positiveCount: positive,
        positiveRate: positive / base,
        negativeCount: negative,
        negativeRate: negative / base,
        questionCount: question,
        questionRate: question / base,
        neutralCount: Math.max(0, commentTotal - positive - negative - question),
        engagementRate: readCount ? interactionCount / readCount : 0,
        cpm: exposure ? (cost * 1000) / exposure : 0,
        cpr: readCount ? cost / readCount : 0,
        cpe: interactionCount ? cost / interactionCount : 0,
        supplier: supplierAgg || {},
        actions: actionAgg || {},
      },
      analytics: {
        trend: resultRows(trend),
        sourceDistribution: resultRows(sourceDist),
        scopeDistribution: resultRows(scopeDist),
        statusDistribution: resultRows(statusDist),
        topics: resultRows(topics),
        brands: resultRows(brands),
        formats: resultRows(formats),
        creatorLevels: resultRows(levels),
        categories: resultRows(categories),
        locations: resultRows(locations),
        dataQuality: dataQuality || {},
        topNotes: topNoteRows,
      },
      keyComments: keyComments.results,
      notes: notes.results,
      ads: { totals: adsTotals || {}, accounts: adsAccounts.results || [] },
      dailyMetrics: resultRows(dailyKpiList),
      projectId: project,
      filters: { from, to, source, status, scope },
      syncedAt: new Date().toISOString(),
    };

    const jsonStr = JSON.stringify(payload);
    memoryCache.set(cacheKey, { json: jsonStr, timestamp: Date.now() });

    return new Response(jsonStr, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    console.error('api/dashboard error:', err);
    return jsonError(err instanceof Error ? err.message : '数据接口处理失败', 500);
  }
}
