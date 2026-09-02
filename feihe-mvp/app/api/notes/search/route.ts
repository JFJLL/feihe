import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { noteIdFrom } from '@/lib/store';
import { searchNotes } from '@/lib/xhs';
import { finishJob, logAction, startJob } from '@/lib/ops';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';

function text(value: unknown) { return value == null ? '' : String(value); }
function number(value: unknown) { const result = Number(value); return Number.isFinite(result) ? result : 0; }
function first(...values: unknown[]) { return values.find((value) => value != null && value !== '') ?? ''; }
function creatorTier(fans: number) { if (fans < 1000) return '素人'; if (fans < 5000) return 'KOC'; if (fans < 50000) return '初级达人'; if (fans < 500000) return '腰部达人'; return '头部达人'; }

export async function POST(request: Request) {
  if (!(await apiUser(true))) return jsonError('请先登录', 401);
  try {
    const body = await request.json() as { keywords?: string[] | string; startDate?: string; endDate?: string; maxPages?: number; projectId?: string };
    const project=projectId(body.projectId);
    const keywords = (Array.isArray(body.keywords) ? body.keywords : text(body.keywords).split(/[，,\n]+/)).map((x) => x.trim()).filter(Boolean).slice(0, 8);
    if (!keywords.length || !body.startDate || !body.endDate) return jsonError('请填写关键词和时间范围');
    const jobId = await startJob('note_search',`关键词扫描：${keywords.join(' / ')}`,keywords.length,project);
    const all: Array<Record<string, unknown>> = [];
    let rawCount = 0;
    for (const keyword of keywords) {
      const result = await searchNotes(keyword, body.startDate, body.endDate, Math.min(10, Math.max(1, Number(body.maxPages || 3))),project);
      for (const raw of result.notes) {
        rawCount += 1;
        const noteInfo = (raw.noteInfo || {}) as Record<string, unknown>;
        const userInfo = (raw.userInfo || {}) as Record<string, unknown>;
        const id = noteIdFrom(text(noteInfo.noteId || raw.noteId || raw.noteID || raw.id || raw.note_id));
        if (!/^[0-9a-f]{24}$/i.test(id)) continue;
        const interaction = (raw.interactionInfo || noteInfo.interactionInfo || {}) as Record<string, unknown>;
        const price = (userInfo.priceInfo || raw.priceInfo || {}) as Record<string, unknown>;
        const location = text(first(userInfo.location, raw.location)); const locationParts = location.split(/[-/,，\s]+/).filter(Boolean);
        const noteTypeCode = number(first(noteInfo.noteType, raw.noteType)); const fans = number(first(userInfo.fansNum, userInfo.fansCount, raw.fansNum, raw.followers));
        all.push({
          id, keyword, title: text(first(noteInfo.title, raw.title, raw.noteTitle)),
          author: text(first(userInfo.nickName, userInfo.nickname, raw.authorName, raw.nickname, raw.userName)),
          url: text(first(raw.noteLink, raw.url)) || `https://www.xiaohongshu.com/explore/${id}`,
          publishedAt: text(first(noteInfo.notePublishTime, raw.publishTime, raw.notePublishTime)),
          profile: {
            coverUrl: text(first(noteInfo.imageUrl, noteInfo.coverUrl, noteInfo.cover, raw.coverUrl, raw.cover)),
            content: text(first(noteInfo.content, noteInfo.desc, raw.content, raw.noteContent)),
            category1: text(first(noteInfo.taxonomy1, raw.firstCategoryName, raw.category1, noteInfo.firstCategoryName)),
            category2: text(first(noteInfo.taxonomy2, raw.secondCategoryName, raw.category2, noteInfo.secondCategoryName)),
            cooperation: number(first(noteInfo.cooperNote, raw.cooperNote, raw.isCooperation, raw.cooperation)),
            promoted: /^(1|true|是)$/i.test(text(first(noteInfo.isAdNote, raw.isPromoted, raw.promoted, raw.isFlow))),
            noteType: text(first(noteInfo.noteTypeName, raw.noteTypeName)) || (noteTypeCode === 2 ? '视频' : noteTypeCode === 1 ? '图文' : ''),
            notePrice: number(first(raw.notePrice, raw.price, price.notePrice, noteTypeCode === 2 ? userInfo.videoPrice : userInfo.picturePrice)),
            exposure: number(first(noteInfo.impNum, interaction.impNum, raw.impNum, raw.exposure)),
            readCount: number(first(noteInfo.readNum, interaction.readNum, raw.readNum, raw.readCount)),
            interactionCount: number(first(noteInfo.engageNum, interaction.interNum, interaction.interactionNum, raw.interactionNum, raw.interactionCount)),
            likeCount: number(first(interaction.likeNum, raw.likeNum, raw.likes)),
            favoriteCount: number(first(noteInfo.favNum, interaction.favNum, interaction.collectNum, raw.favNum, raw.favoriteCount)),
            shareCount: number(first(interaction.shareNum, raw.shareNum, raw.shareCount)),
            fansCount: fans,
            creatorLevel: text(first(userInfo.levelName, userInfo.tier, raw.creatorLevel, raw.levelName)) || creatorTier(fans),
            picturePrice: number(first(userInfo.picturePrice, userInfo.imagePrice, price.picturePrice)),
            videoPrice: number(first(userInfo.videoPrice, price.videoPrice)),
            province: text(first(userInfo.province, raw.province, locationParts[0])), city: text(first(userInfo.city, raw.city, locationParts[1])),
            gender: text(first(userInfo.gender, raw.gender)), readMedian: number(first(userInfo.readMedian, userInfo.clickMidNum, userInfo.clickMid, raw.readMedian)),
            interactionMedian: number(first(userInfo.interactionMedian, userInfo.interMidNum, userInfo.interMid, raw.interactionMedian)),
            brand: text(first(raw.brandName, raw.brand, noteInfo.brandName, keyword)),
          },
        });
      }
    }
    await ensureSchema(); const d1 = db();
    for (let i = 0; i < all.length; i += 30) {
      const statements: D1PreparedStatement[] = [];
      for (const note of all.slice(i, i + 30)) {
        const p = note.profile as Record<string, unknown>;
        statements.push(d1.prepare(`INSERT INTO notes(id,url,author,title,source_type,pipeline,product_scope,published_at,status)
          VALUES(?,?,?,?,'keyword_scan','value_scan',?,?, '待抓取')
          ON CONFLICT(id) DO UPDATE SET url=CASE WHEN excluded.url!='' THEN excluded.url ELSE notes.url END,author=CASE WHEN excluded.author!='' THEN excluded.author ELSE notes.author END,title=CASE WHEN excluded.title!='' THEN excluded.title ELSE notes.title END`)
          .bind(note.id, note.url, note.author, note.title, /爱他美|合生元|A2|a2|美素|至初|金领冠|派星/.test(text(note.keyword)) ? '竞品' : '本品', note.publishedAt || null));
        statements.push(d1.prepare(`INSERT INTO project_notes(id,project_id,note_id,source_type,pipeline,product_scope,status,added_at)
          VALUES(?,?,?,'keyword_scan','value_scan',?,'待抓取',?) ON CONFLICT(id) DO UPDATE SET product_scope=excluded.product_scope`)
          .bind(`${project}:${note.id}`,project,note.id,/爱他美|合生元|A2|a2|美素|至初|金领冠|派星/.test(text(note.keyword))?'竞品':'本品',new Date().toISOString()));
        statements.push(d1.prepare(`INSERT INTO note_profiles(note_id,cover_url,content,category1,category2,cooperation,promoted,note_type,note_price,exposure,read_count,interaction_count,like_count,favorite_count,share_count,fans_count,creator_level,picture_price,video_price,province,city,gender,read_median,interaction_median,brand,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(note_id) DO UPDATE SET
          cover_url=excluded.cover_url,content=excluded.content,category1=excluded.category1,category2=excluded.category2,cooperation=excluded.cooperation,promoted=excluded.promoted,note_type=excluded.note_type,note_price=excluded.note_price,exposure=excluded.exposure,read_count=excluded.read_count,interaction_count=excluded.interaction_count,like_count=excluded.like_count,favorite_count=excluded.favorite_count,share_count=excluded.share_count,fans_count=excluded.fans_count,creator_level=excluded.creator_level,picture_price=excluded.picture_price,video_price=excluded.video_price,province=excluded.province,city=excluded.city,gender=excluded.gender,read_median=excluded.read_median,interaction_median=excluded.interaction_median,brand=excluded.brand,updated_at=excluded.updated_at`)
          .bind(note.id,p.coverUrl,p.content,p.category1,p.category2,p.cooperation,p.promoted?1:0,p.noteType,p.notePrice,p.exposure,p.readCount,p.interactionCount,p.likeCount,p.favoriteCount,p.shareCount,p.fansCount,p.creatorLevel,p.picturePrice,p.videoPrice,p.province,p.city,p.gender,p.readMedian,p.interactionMedian,p.brand,new Date().toISOString()));
      }
      await d1.batch(statements);
    }
    await finishJob(jobId, { succeeded: all.length, message: `${keywords.length} 个关键词，入库 ${all.length} 篇` });
    await logAction('关键词扫描','keyword',keywords.join(','),`${body.startDate} 至 ${body.endDate}，入库 ${all.length} 篇`,project);
    return Response.json({ ok: true, count: all.length, rawCount, jobId, notes: all.map((note) => ({
      id: text(note.id), keyword: text(note.keyword), title: text(note.title), author: text(note.author),
      url: text(note.url), publishedAt: text(note.publishedAt),
    })) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '搜索失败', 500);
  }
}
