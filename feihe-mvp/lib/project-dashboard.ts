import { db, ensureSchema } from './db';
import { readFeishuData } from './feishu-sync';
import { getProjectNotesProjection } from './project-notes-projection';

type Row = Record<string, string | number | boolean | null>;
const resultRows = (value: { results?: unknown[] } | null | undefined) => ((value?.results || []) as Row[]);

// The dashboard and frozen business reports read the same project-scoped queries.
// Callers must validate project access; no HTTP requests or test identity are manufactured.
export async function readProjectDashboard(project: string, params = new URLSearchParams(), fresh = false) {
  await ensureSchema();
  const d1 = db();
   // 确保日度表已就绪
   const feishu = await readFeishuData(project, fresh);

   const clauses: string[] = ['pn.project_id=?'];
    const values: string[] = [project];
    const from = params.get('from');
    const to = params.get('to');
    const source = params.get('source');
    const status = params.get('status');
    const scope = params.get('scope');
    // Legacy content uses publication day, not the later comment-fetch timestamp.
    // Offset timestamps are converted to the platform's Asia/Shanghai calendar.
    const publicationDay = "date(CASE WHEN n.published_at LIKE '%Z' OR n.published_at GLOB '*[+-][0-9][0-9]:[0-9][0-9]' THEN datetime(n.published_at,'+8 hours') ELSE n.published_at END)";

    if (from) {
      clauses.push(`${publicationDay}>=date(?)`);
      values.push(from);
    }
    if (to) {
      clauses.push(`${publicationDay}<=date(?)`);
      values.push(to);
    }
    clauses.push("pn.note_id NOT IN ('6079dab50000000001007a53', '5bec388461d4df00014a2e26')");
    if (source) { clauses.push('pn.source_type=?'); values.push(source); }
    if (status) { clauses.push('pn.status=?'); values.push(status); }
    if (scope) { clauses.push('pn.product_scope=?'); values.push(scope); }

    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    // Old imports sometimes left summary counts at zero despite newer captured snapshots.
    // Prefer a newer project-scoped snapshot, including genuine zero counts after a fresh crawl.
    const snapshotCounts = ['comment_total','positive_count','negative_count','question_count'];
    const snapshotCols = ['total_count','positive_count','negative_count','question_count'];
    const metricColumns = ['fans_count','note_price','exposure','read_count','interaction_count','like_count','favorite_count','share_count'];
    const profileColumns = ['note_id','cover_url','category1','category2','cooperation','promoted','note_type','creator_level','province','city','gender','brand'];
    // Legacy defaults cannot prove an observed zero. A successful source sync records
    // explicit null/zero provenance; all aggregate and chart queries share this view.
    const currentNotes = `WITH current_profiles AS (
      SELECT ${profileColumns.join(',')},${metricColumns.map(c => `CASE WHEN source_metrics_json IS NULL THEN NULLIF(${c},0) WHEN json_type(source_metrics_json,'$.${c}')='null' THEN NULL ELSE ${c} END AS ${c}`).join(',')}
      FROM note_profiles
    ), ranked_snapshots AS (
      SELECT *,ROW_NUMBER() OVER(PARTITION BY project_id,note_id ORDER BY captured_at DESC,id DESC) AS rn FROM comment_snapshots WHERE quarantine_reason=''
    ), current_project_notes AS (
      SELECT pn.id,pn.project_id,pn.note_id,pn.source_type,pn.pipeline,pn.level,pn.product_scope,pn.status,
      pn.last_fetched_at,pn.brand_mention_top5,pn.added_at,
      ${snapshotCounts.map((c,i)=>`CASE WHEN s.captured_at IS NOT NULL AND (pn.last_fetched_at IS NULL OR s.captured_at >= pn.last_fetched_at) THEN s.${snapshotCols[i]} ELSE pn.${c} END AS ${c}`).join(',')}
      FROM project_notes pn LEFT JOIN ranked_snapshots s ON s.note_id=pn.note_id AND s.project_id=pn.project_id AND s.rn=1
    ) `;
    const bind = (sql: string) => d1.prepare(currentNotes + sql.replaceAll('JOIN project_notes pn','JOIN current_project_notes pn').replaceAll('JOIN note_profiles p','JOIN current_profiles p')).bind(...values);
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
    ] = await Promise.all([
      d1.prepare('SELECT key AS id,name,target_count AS targetCount,delivered_count AS deliveredCount,budget,spent FROM project_pipelines WHERE project_id=? ORDER BY rowid').bind(project).all(),
      bind(`SELECT COUNT(*) AS noteCount, COALESCE(SUM(pn.comment_total),0) AS commentTotal,
        COALESCE(SUM(pn.positive_count),0) AS positiveCount, COALESCE(SUM(pn.negative_count),0) AS negativeCount,
        COALESCE(SUM(pn.question_count),0) AS questionCount, COALESCE(SUM(p.exposure),0) AS exposure,
        COALESCE(SUM(p.read_count),0) AS readCount, COALESCE(SUM(p.interaction_count),0) AS interactionCount,
        COALESCE(SUM(p.note_price),0) AS creatorCost, COALESCE(SUM(p.like_count),0) AS likeCount,
        COALESCE(SUM(p.favorite_count),0) AS favoriteCount, COALESCE(SUM(p.share_count),0) AS shareCount,
        SUM(CASE WHEN p.promoted=1 THEN 1 ELSE 0 END) AS promotedCount,
        SUM(CASE WHEN pn.source_type='commercial' OR p.cooperation=1 THEN 1 ELSE 0 END) AS commercialCount,
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
        ORDER BY COALESCE(pn.last_fetched_at,n.published_at) DESC,n.id`).all(),
      d1.prepare(`WITH latest AS (
        SELECT *,ROW_NUMBER() OVER(PARTITION BY note_id,date(captured_at) ORDER BY captured_at DESC) AS rn
        FROM comment_snapshots WHERE quarantine_reason='' AND project_id=? AND date(captured_at) BETWEEN date(?) AND date(?)
      ) SELECT date(captured_at) AS date,SUM(total_count) AS total,SUM(positive_count) AS positive,
        SUM(negative_count) AS negative,SUM(question_count) AS question,SUM(irrelevant_count) AS irrelevant
        FROM latest WHERE rn=1 GROUP BY date(captured_at) ORDER BY date(captured_at)`).bind(project,...trendValues).all(),
      bind(`SELECT pn.source_type AS name,COUNT(*) AS count,SUM(pn.comment_total) AS comments FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where} GROUP BY pn.source_type ORDER BY count DESC`).all(),
      bind(`SELECT pn.product_scope AS name,COUNT(*) AS count,SUM(pn.comment_total) AS comments FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where} GROUP BY pn.product_scope ORDER BY count DESC`).all(),
      bind(`SELECT pn.status AS name,COUNT(*) AS count FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where} GROUP BY pn.status ORDER BY count DESC`).all(),
      d1.prepare(`SELECT category AS name,sentiment,COUNT(*) AS count,
        SUM(CASE WHEN treatment_status='待处理' THEN 1 ELSE 0 END) AS pending
        FROM key_comments WHERE project_id=? AND disappeared_at IS NULL GROUP BY category,sentiment ORDER BY count DESC`).bind(project).all(),
      bind(`SELECT CASE WHEN p.brand IN ('启萃','飞鹤启萃','飞鹤') OR (pn.product_scope != '竞品' AND (p.brand IS NULL OR p.brand = '' OR p.brand = '本品')) THEN '启萃' WHEN pn.product_scope = '竞品' THEN COALESCE(NULLIF(p.brand,''), '其他竞品') ELSE COALESCE(NULLIF(p.brand,''), '启萃') END AS brand,
        COUNT(*) AS notes,SUM(pn.comment_total) AS comments,SUM(pn.positive_count) AS positive,
        SUM(pn.negative_count) AS negative,SUM(pn.question_count) AS question,
        SUM(p.read_count) AS reads,SUM(p.interaction_count) AS interactions,SUM(p.note_price) AS cost,
        COUNT(p.interaction_count) AS interactionSamples,
        SUM(CASE WHEN p.read_count IS NOT NULL AND p.interaction_count IS NOT NULL THEN p.read_count END) AS pairedReads,
        SUM(CASE WHEN p.read_count IS NOT NULL AND p.interaction_count IS NOT NULL THEN p.interaction_count END) AS pairedInteractions,
        SUM(CASE WHEN p.note_price IS NOT NULL AND p.interaction_count IS NOT NULL THEN p.note_price END) AS pairedCost,
        SUM(CASE WHEN p.note_price IS NOT NULL AND p.interaction_count IS NOT NULL THEN p.interaction_count END) AS costInteractions
        FROM notes n JOIN project_notes pn ON pn.note_id=n.id LEFT JOIN note_profiles p ON p.note_id=n.id${where}
        /* SQLite resolves GROUP BY brand to p.brand; ordinal 1 groups the normalized CASE expression. */
        GROUP BY 1 ORDER BY comments DESC,notes DESC,brand`).all(),
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
    ]);

    let noteRows = resultRows(notes);
    let note = noteAgg || {};
    let categoryRows = resultRows(categories);
    let levelRows = resultRows(levels);
    let brandRows = resultRows(brands);
    let formatRows = resultRows(formats);
    let sourceDistRows = resultRows(sourceDist);
    let scopeDistRows = resultRows(scopeDist);
    let statusDistRows = resultRows(statusDist);
    let qualityData = dataQuality || {};
    let locationRows = resultRows(locations);
    let trendRows = resultRows(trend);

    if (noteRows.length === 0) {
      const projected = await getProjectNotesProjection(d1, project, { from, to, source, status, scope });
      if (projected.length > 0) {
        noteRows = projected;
        const observedExposures = projected.map(n => n.exposure).filter((v): v is string | number => v !== null);
        const observedReads = projected.map(n => n.readCount).filter((v): v is string | number => v !== null);
        const observedInteractions = projected.map(n => n.interactionCount).filter((v): v is string | number => v !== null);
        const observedCosts = projected.map(n => n.notePrice).filter((v): v is string | number => Number(v) > 0);
        const totalComments = projected.reduce((s: number, n) => s + (Number(n.commentTotal) || 0), 0);

        note = {
          noteCount: projected.length,
          commentTotal: totalComments,
          exposure: observedExposures.reduce((s: number, v) => s + Number(v), 0),
          readCount: observedReads.reduce((s: number, v) => s + Number(v), 0),
          interactionCount: observedInteractions.reduce((s: number, v) => s + Number(v), 0),
          creatorCost: observedCosts.reduce((s: number, v) => s + Number(v), 0),
          publishedCount: projected.filter(n => Boolean(n.publishedAt)).length,
          positiveCount: null,
          negativeCount: null,
          questionCount: null,
          sentimentAvailable: false,
        };

        const catMap = new Map();
        for (const n of projected) {
          if (!n.category1) continue;
          const k = String(n.category1);
          const cur = catMap.get(k) || { name: k, count: 0, reads: 0, interactions: 0 };
          cur.count++;
          if (n.readCount) cur.reads += Number(n.readCount);
          if (n.interactionCount) cur.interactions += Number(n.interactionCount);
          catMap.set(k, cur);
        }
        categoryRows = [...catMap.values()].sort((a,b) => b.count - a.count).slice(0, 10);

        const lvlMap = new Map();
        for (const n of projected) {
          const lvl = String(n.creatorLevel || '未分层');
          const cur = lvlMap.get(lvl) || { name: lvl, count: 0, totalRead: 0, readSamples: 0, totalInter: 0, interSamples: 0, totalCost: 0 };
          cur.count++;
          if (n.readCount) { cur.totalRead += Number(n.readCount); cur.readSamples++; }
          if (n.interactionCount) { cur.totalInter += Number(n.interactionCount); cur.interSamples++; }
          if (n.notePrice) cur.totalCost += Number(n.notePrice);
          lvlMap.set(lvl, cur);
        }
        levelRows = [...lvlMap.values()].map(l => ({
          name: l.name,
          count: l.count,
          avgRead: l.readSamples ? Math.round(l.totalRead / l.readSamples) : 0,
          avgInteraction: l.interSamples ? Math.round(l.totalInter / l.interSamples) : 0,
          avgCpe: l.interSamples && l.totalInter ? l.totalCost / l.totalInter : 0,
        })).sort((a,b) => b.count - a.count);

        const fmtMap = new Map();
        for (const n of projected) {
          if (!n.noteType) continue;
          const k = String(n.noteType);
          const cur = fmtMap.get(k) || { name: k, count: 0, interactions: 0 };
          cur.count++;
          if (n.interactionCount) cur.interactions += Number(n.interactionCount);
          fmtMap.set(k, cur);
        }
        formatRows = [...fmtMap.values()].sort((a,b) => b.count - a.count);

        const locMap = new Map();
        for (const n of projected) {
          if (!n.province) continue;
          const k = String(n.province);
          const cur = locMap.get(k) || { name: k, count: 0, comments: 0 };
          cur.count++;
          if (n.commentTotal) cur.comments += Number(n.commentTotal);
          locMap.set(k, cur);
        }
        locationRows = [...locMap.values()].sort((a,b) => b.count - a.count).slice(0, 12);

        brandRows = [{
          brand: '启萃',
          notes: projected.length,
          comments: totalComments,
          positive: null,
          negative: null,
          question: null,
          reads: observedReads.reduce((s: number, v) => s + Number(v), 0),
          interactions: observedInteractions.reduce((s: number, v) => s + Number(v), 0),
          cost: observedCosts.reduce((s: number, v) => s + Number(v), 0),
          interactionSamples: observedInteractions.length,
        }];

        sourceDistRows = [{ name: 'owned', count: projected.length, comments: totalComments }];
        scopeDistRows = [{ name: '本品', count: projected.length, comments: totalComments }];
        statusDistRows = [{ name: '已发布', count: projected.length }];

        qualityData = {
          total: projected.length,
          profileCount: projected.length,
          metricCount: observedInteractions.length,
          categoryCount: projected.filter(n => n.category1).length,
          creatorCount: projected.filter(n => n.creatorLevel).length,
          commentFetched: projected.filter(n => Number(n.commentTotal) > 0).length,
          linkedCount: projected.filter(n => n.url).length,
        };
      }
    }

    if (trendRows.length === 0) {
      const deliveryTrends = await d1.prepare(
        "SELECT comment_day AS date, COUNT(*) AS total, COUNT(*) AS deliveryCount, NULL AS positive, NULL AS negative, NULL AS question, NULL AS irrelevant, 0 AS sentimentAvailable, 'delivery' AS seriesType, '登记交付量' AS title FROM business_comment_deliveries WHERE project_id=? AND comment_day IS NOT NULL GROUP BY comment_day ORDER BY comment_day"
      ).bind(project).all<{ date: string; total: number; deliveryCount: number; positive: number | null; negative: number | null; question: number | null; irrelevant: number | null; sentimentAvailable: number; seriesType: string; title: string }>();
      trendRows = deliveryTrends.results || [];
    }

    const topNoteRows = noteRows.length > 0 && resultRows(topNotes).length === 0
      ? [...noteRows].sort((a,b) => ((Number(b.interactionCount) || 0) + (Number(b.commentTotal) || 0)) - ((Number(a.interactionCount) || 0) + (Number(a.commentTotal) || 0))).slice(0, 12)
      : resultRows(topNotes);

    for (const row of topNoteRows) {
      if (row.id) {
        row.coverUrl = `/api/note-covers?resolve=1&projectId=${encodeURIComponent(project)}&noteId=${encodeURIComponent(String(row.id))}`;
      }
    }
    for (const row of noteRows) {
      if (row.id) {
        row.coverUrl = `/api/note-covers?resolve=1&projectId=${encodeURIComponent(project)}&noteId=${encodeURIComponent(String(row.id))}`;
      }
    }


    // note already computed above
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
        readCount,
        interactionCount,
        commentTotal,
        positiveCount: null,
        positiveRate: null,
        negativeCount: null,
        negativeRate: null,
        questionCount: null,
        questionRate: null,
        neutralCount: null,
        sentimentAvailable: false,
        engagementRate: readCount ? interactionCount / readCount : 0,
        cpm: exposure ? (cost * 1000) / exposure : 0,
        cpr: readCount ? cost / readCount : 0,
        cpe: interactionCount ? cost / interactionCount : 0,
        supplier: supplierAgg || {},
        actions: actionAgg || {},
      },
      analytics: {
        trend: trendRows,
        trendType: 'delivery',
        trendTitle: '登记交付量',
        sentimentAvailable: false,
        sourceDistribution: sourceDistRows,
        scopeDistribution: scopeDistRows,
        statusDistribution: statusDistRows,
        topics: resultRows(topics),
        brands: brandRows,
        formats: formatRows,
        creatorLevels: levelRows,
        categories: categoryRows,
        locations: locationRows,
        dataQuality: qualityData,
        topNotes: topNoteRows,
      },
      keyComments: keyComments.results,
      notes: ((noteRows || []) as Array<Record<string, unknown>>).map((row): Row => {

        const rawCover = typeof row.coverUrl === 'string' ? row.coverUrl : '';
        const coverUrl = rawCover;
        const rawTitle = typeof row.title === 'string' ? row.title : '';
        const title = (rawTitle && rawTitle !== '#N/A') ? rawTitle : '标题待同步';
        const rawAuthor = typeof row.author === 'string' ? row.author : '';
        const author = (rawAuthor && rawAuthor !== '未知作者') ? rawAuthor : '作者待同步';
        return { ...row, coverUrl, title, author } as Row;
      }),
      ads: { totals: adsTotals || {}, accounts: adsAccounts.results || [] },
      dailyMetrics: feishu.daily,
      feishu,
      projectId: project,
      filters: { from, to, source, status, scope },
      syncedAt: new Date().toISOString(),
    };


  return payload;
}
export type ProjectDashboardData = Awaited<ReturnType<typeof readProjectDashboard>>;
