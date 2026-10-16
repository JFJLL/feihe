import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { getCompetitorConfig } from '@/lib/competitors/db';

export const dynamic = 'force-dynamic';

function isValidHttpUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawId = params.get('id');
  if (!rawId) return jsonError('缺少笔记 ID', 400);

  const access = await requireProjectAccess(request, params.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  await ensureSchema();
  const d1 = db();

  const cleanId = rawId.trim();
  const strippedId = cleanId.includes(':') ? cleanId.split(':')[1] : cleanId;
  const lowerId = strippedId.toLowerCase();

  // 1. 先尝试传统 notes 表与 project_notes
  let note: Record<string, any> | null = null;
  let snapshots: any[] = [];
  let comments: any[] = [];
  let source: 'legacy' | 'projection' | 'competitor' = 'legacy';

  try {
    const legacyRow = await d1
      .prepare(
        `SELECT n.id, n.url, n.author, n.title, n.published_at AS publishedAt,
        pn.source_type AS sourceType, pn.pipeline, pn.level, pn.product_scope AS productScope,
        pn.status, pn.last_fetched_at AS lastFetchedAt,
        pn.comment_total AS commentTotal, pn.positive_count AS positiveCount,
        pn.negative_count AS negativeCount, pn.question_count AS questionCount,
        pn.brand_mention_top5 AS brandMentionTop5, pn.added_at AS addedAt,
        COALESCE(p.cover_url, '') AS coverUrl,
        COALESCE(p.content, '') AS content,
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
        WHERE n.id=? OR n.id=?`
      )
      .bind(project, strippedId, lowerId)
      .first<Record<string, any>>();

    if (legacyRow) {
      note = legacyRow;
      const [snapRes, commentRes] = await Promise.all([
        d1
          .prepare(
            `SELECT captured_at AS capturedAt, l1_count AS l1Count, l2_count AS l2Count, total_count AS totalCount,
            positive_count AS positiveCount, negative_count AS negativeCount, question_count AS questionCount
            FROM comment_snapshots WHERE project_id=? AND (note_id=? OR note_id=?) ORDER BY captured_at DESC LIMIT 12`
          )
          .bind(project, strippedId, lowerId)
          .all(),
        d1
          .prepare(
            `SELECT id, content, author, sentiment, category, action, treatment_status AS treatmentStatus,
            last_seen_at AS lastSeenAt, disappeared_at AS disappearedAt, reply_count AS replyCount
            FROM key_comments WHERE project_id=? AND (note_id=? OR note_id=?) ORDER BY last_seen_at DESC LIMIT 60`
          )
          .bind(project, strippedId, lowerId)
          .all(),
      ]);
      snapshots = snapRes.results || [];
      comments = commentRes.results || [];
    }
  } catch {}

  // 2. 本品投影检索（同源投影按真实 noteId 取详情）
  if (!note) {
    try {
      const archiveRow = await d1
        .prepare(
          `SELECT note_id, data_json, updated_at FROM business_note_archives
          WHERE project_id=? AND (note_id=? OR note_id=? OR lower(note_id)=?) LIMIT 1`
        )
        .bind(project, strippedId, cleanId, lowerId)
        .first<{ note_id: string; data_json: string; updated_at: string }>();

      let archData: Record<string, any> = {};
      if (archiveRow?.data_json) {
        try {
          archData = JSON.parse(archiveRow.data_json);
        } catch {}
      }

      const execCapture = await d1
        .prepare(
          `SELECT payload_json, captured_at FROM business_captures
          WHERE project_id=? AND source_key='execution' ORDER BY captured_at DESC LIMIT 1`
        )
        .bind(project)
        .first<{ payload_json: string; captured_at: string }>();

      let execLine: unknown[] | null = null;
      let execHeaders: string[] = [];
      if (execCapture?.payload_json) {
        try {
          const parsed = JSON.parse(execCapture.payload_json);
          const rows = parsed.rows || [];
          if (rows.length > 1) {
            execHeaders = (rows[0] || []).map((h: unknown) => String(h || '').replace(/\r?\n/g, ' ').trim());
            const colId = execHeaders.findIndex((h: string) => h.includes('笔记ID'));
            const idx = colId >= 0 ? colId : 32;
            for (let i = 1; i < rows.length; i++) {
              if (String(rows[i][idx] || '').trim().toLowerCase() === lowerId) {
                execLine = rows[i];
                break;
              }
            }
          }
        } catch {}
      }

      if (archiveRow || execLine) {
        source = 'projection';
        const delivRow = await d1
          .prepare(
            `SELECT count(*) as c FROM business_comment_deliveries
            WHERE project_id=? AND (note_id=? OR note_id=? OR lower(note_id)=?)`
          )
          .bind(project, strippedId, cleanId, lowerId)
          .first<{ c: number }>();
        const deliveredCount = Number(delivRow?.c || 0);

        let title = archData.title || '';
        let author = archData.author || '';
        let url = Array.isArray(archData.links) && archData.links[0] ? String(archData.links[0]).trim() : '';
        let publishedAt = archData.publishedDay || null;
        let creatorLevel = archData.tier || '';
        let content = typeof archData.content === 'string' ? archData.content.trim() : '';
        let pipeline = archiveRow ? 'rectification' : 'execution';

        let exposure: number | null = null;
        let readCount: number | null = null;
        let interactionCount: number | null = null;
        let commentTotal = deliveredCount;
        let category1 = '';
        let category2 = '';
        let noteType = '';
        let notePrice: number | null = null;

        if (execLine) {
          const findCol = (name: string, fallback: number) => {
            const i = execHeaders.findIndex((h: string) => h.includes(name));
            return i >= 0 ? i : fallback;
          };
          if (execLine[findCol('标题', 34)]) title = String(execLine[findCol('标题', 34)]).trim();
          if (execLine[findCol('达人昵称', 4)]) author = String(execLine[findCol('达人昵称', 4)]).trim();
          if (execLine[findCol('发布链接', 31)]) url = String(execLine[findCol('发布链接', 31)]).trim();
          if (execLine[findCol('博主粉丝数量级', 8)]) creatorLevel = String(execLine[findCol('博主粉丝数量级', 8)]).trim();
          if (execLine[findCol('一级场景', 22)]) category1 = String(execLine[findCol('一级场景', 22)]).trim();
          if (execLine[findCol('二级场景', 23)]) category2 = String(execLine[findCol('二级场景', 23)]).trim();
          if (execLine[findCol('笔记类型', 24)]) noteType = String(execLine[findCol('笔记类型', 24)]).trim();
          if (execLine[findCol('自然曝光量', 40)]) exposure = Number(execLine[findCol('自然曝光量', 40)]) || null;
          if (execLine[findCol('自然阅读量', 41)]) readCount = Number(execLine[findCol('自然阅读量', 41)]) || null;
          if (execLine[findCol('互动量', 43)]) interactionCount = Number(execLine[findCol('互动量', 43)]) || null;
          if (execLine[findCol('评论量', 37)]) {
            const c = Number(execLine[findCol('评论量', 37)]);
            if (!isNaN(c)) commentTotal = Math.max(commentTotal, c);
          }
          if (execLine[findCol('总合作价/元', 18)]) notePrice = Number(execLine[findCol('总合作价/元', 18)]) || null;
          pipeline = 'execution';
        }

        if (!isValidHttpUrl(url) && /^[a-f0-9]{24}$/i.test(lowerId)) {
          url = `https://www.xiaohongshu.com/discovery/item/${lowerId}`;
        }

        const profileRow = await d1
          .prepare(
            "SELECT cover_url AS coverUrl, content FROM note_profiles WHERE note_id=? OR lower(note_id)=? LIMIT 1"
          )
          .bind(strippedId, lowerId)
          .first<{ coverUrl?: string; content?: string }>();

        const coverUrl = profileRow?.coverUrl || '';
        if (profileRow?.content && !content) {
          content = profileRow.content;
        }

        note = {
          id: lowerId,
          url: isValidHttpUrl(url) ? url : '',
          author: author || '未知作者',
          title: title || '标题待同步',
          content,
          sourceType: 'owned',
          pipeline,
          level: creatorLevel || 'P3',
          productScope: '本品',
          publishedAt,
          lastFetchedAt: archiveRow?.updated_at || execCapture?.captured_at || null,
          commentTotal,
          naturalComments: commentTotal,
          deliveredComments: deliveredCount,
          positiveCount: 0,
          negativeCount: 0,
          questionCount: 0,
          brandMentionTop5: 0,
          status: '已发布',
          coverUrl,
          category1,
          category2,
          cooperation: 1,
          promoted: 0,
          noteType,
          notePrice,
          exposure,
          readCount,
          interactionCount,
          likeCount: null,
          favoriteCount: null,
          shareCount: null,
          fansCount: null,
          creatorLevel,
          province: '',
          city: '',
          gender: '',
          brand: '启萃',
        };

        const [snapRes, commentRes] = await Promise.all([
          d1
            .prepare(
              `SELECT captured_at AS capturedAt, l1_count AS l1Count, l2_count AS l2Count, total_count AS totalCount,
              positive_count AS positiveCount, negative_count AS negativeCount, question_count AS questionCount
              FROM comment_snapshots WHERE project_id=? AND (note_id=? OR lower(note_id)=?) ORDER BY captured_at DESC LIMIT 12`
            )
            .bind(project, strippedId, lowerId)
            .all(),
          d1
            .prepare(
              `SELECT id, content, author, sentiment, category, action, treatment_status AS treatmentStatus,
              last_seen_at AS lastSeenAt, disappeared_at AS disappearedAt, reply_count AS replyCount
              FROM key_comments WHERE project_id=? AND (note_id=? OR lower(note_id)=?) ORDER BY last_seen_at DESC LIMIT 60`
            )
            .bind(project, strippedId, lowerId)
            .all(),
        ]);
        snapshots = snapRes.results || [];
        comments = commentRes.results || [];

        // 若 key_comments 为空，则附带实际交付记录作为反馈证据
        if (comments.length === 0 && deliveredCount > 0) {
          const rawDelivs = await d1
            .prepare(
              `SELECT id, comment_day, data_json, status FROM business_comment_deliveries
              WHERE project_id=? AND (note_id=? OR lower(note_id)=?) LIMIT 60`
            )
            .bind(project, strippedId, lowerId)
            .all<{ id: string; comment_day: string; data_json: string; status: string }>();

          comments = (rawDelivs.results || []).map((d, idx) => {
            let data: Record<string, any> = {};
            try {
              data = JSON.parse(d.data_json);
            } catch {}
            return {
              id: d.id || `delivery-${idx}`,
              noteId: lowerId,
              content: data.content || '已登记交付评论',
              author: data.operator || '交付登记人员',
              sentiment: '未分析',
              category: data.direction || '供应商交付',
              action: data.replyRelation || '交付登记',
              treatmentStatus: d.status || '已登记',
              lastSeenAt: d.comment_day || '',
              replyCount: 0,
            };
          });
        }
      }
    } catch {}
  }

  // 3. 竞品笔记检索（严格按对应 project + task 查询，跨项目隔离）
  if (!note) {
    try {
      const compConfig = await getCompetitorConfig(project);
      if (compConfig?.isConfigured && compConfig.taskId) {
        const row = await d1
          .prepare(
            `SELECT * FROM competitor_notes
            WHERE project_id=? AND task_id=? AND (raw_note_id=? OR id=? OR raw_note_id=? OR id=?) LIMIT 1`
          )
          .bind(project, compConfig.taskId, strippedId, strippedId, cleanId, cleanId)
          .first<Record<string, any>>();

        if (row) {
          source = 'competitor';
          let parsedRaw: Record<string, any> = {};
          if (row.raw_payload_json) {
            try {
              parsedRaw = JSON.parse(row.raw_payload_json);
            } catch {}
          }

          let consumerIssues: any[] = [];
          if (row.consumer_issues_json) {
            try {
              consumerIssues = JSON.parse(row.consumer_issues_json);
            } catch {}
          }

          const validUrl = isValidHttpUrl(row.note_url) ? String(row.note_url).trim() : '';

          let coverUrl = '';
          let imageList: string[] = [];
          if (Array.isArray(parsedRaw.imageList)) {
            imageList = parsedRaw.imageList.filter(Boolean);
            if (imageList[0]) coverUrl = imageList[0];
          } else if (typeof parsedRaw.imageList === 'string') {
            try {
              const arr = JSON.parse(parsedRaw.imageList);
              if (Array.isArray(arr)) {
                imageList = arr.filter(Boolean);
                if (imageList[0]) coverUrl = imageList[0];
              }
            } catch {}
          }

          const brand = row.brand_attributed === 'unknown' ? '待识别品牌' : row.brand_attributed;
          const status = row.content_nature === 'commercial' ? '商业合作' : row.content_nature === 'natural' ? '真实自费' : '特征待补全';
          const creatorLevel = row.creator_tier === 'unknown' ? '粉丝数未提供' : row.creator_tier;

          note = {
            id: row.raw_note_id,
            url: validUrl,
            author: row.author_name || '未知博主',
            title: row.title || '无标题笔记',
            content: row.content || parsedRaw.content || parsedRaw.desc || '',
            sourceType: row.content_nature === 'commercial' ? 'commercial' : 'keyword_scan',
            pipeline: 'competitor_monitor',
            level: creatorLevel,
            creatorLevel,
            productScope: '竞品',
            status,
            publishedAt: row.pub_time ? row.pub_time.slice(0, 10) : null,
            lastFetchedAt: row.insert_time || row.updated_at || null,
            commentTotal: Number(row.comment_count || 0),
            positiveCount: 0,
            negativeCount: 0,
            questionCount: consumerIssues.length,
            brandMentionTop5: 0,
            coverUrl,
            imageList,
            category1: row.product_line || '竞品品线',
            category2: row.keyword_hit ? `关键词: ${row.keyword_hit}` : '',
            cooperation: row.content_nature === 'commercial' ? 1 : 0,
            promoted: 0,
            noteType: row.content_type || '普通笔记',
            notePrice: null,
            exposure: null,
            readCount: null,
            interactionCount: Number(row.interaction_total || 0),
            likeCount: Number(row.liked_count || 0),
            favoriteCount: Number(row.collected_count || 0),
            shareCount: Number(row.share_count || 0),
            fansCount: null,
            province: row.ip_location || '',
            city: '',
            gender: parsedRaw.gender || '',
            brand,
          };

          comments = consumerIssues.map((iss: any, idx: number) => ({
            id: `issue-${row.raw_note_id}-${idx}`,
            noteId: row.raw_note_id,
            content: iss.excerpt || iss.keyword,
            author: row.author_name || '真实笔记证据',
            sentiment: '消费反馈',
            category: iss.category || '线索',
            action: iss.keyword || '',
            treatmentStatus: '线索核验',
            lastSeenAt: row.pub_time || '',
            replyCount: 0,
          }));
        }
      }
    } catch {}
  }

  if (!note) {
    return jsonError('笔记不存在或不属于当前项目', 404);
  }

  return Response.json({
    ok: true,
    note,
    snapshots,
    comments,
    source,
    capabilities: {
      canEdit: source === 'legacy',
      canDelete: source === 'legacy',
      canCalibrate: source === 'legacy',
      readonlyReason:
        source === 'projection'
          ? '飞书/蒲公英业务同源快照，保持只读对齐'
          : source === 'competitor'
          ? '竞品第三方采集快照，保持原始事实只读查看'
          : undefined,
    },
  });
}
