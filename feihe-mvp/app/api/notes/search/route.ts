import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { noteIdFrom } from '@/lib/store';
import { searchNotes } from '@/lib/xhs';
import { finishJob, logAction, startJob } from '@/lib/ops';

export const dynamic = 'force-dynamic';

function text(value: unknown) { return value == null ? '' : String(value); }
function number(value: unknown) { const result = Number(value); return Number.isFinite(result) ? result : 0; }
function first(...values: unknown[]) { return values.find((value) => value != null && value !== '') ?? ''; }
function creatorTier(fans: number) { if (fans < 1000) return '素人'; if (fans < 5000) return 'KOC'; if (fans < 50000) return '初级达人'; if (fans < 500000) return '腰部达人'; return '头部达人'; }

export async function POST(request: Request) {
  let body: { keywords?: string[] | string; startDate?: string; endDate?: string; maxPages?: number; projectId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('无效的请求体');
  }

  const access = await requireProjectAccess(request, body.projectId, 'write');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  try {
    const keywords = (Array.isArray(body.keywords) ? body.keywords : text(body.keywords).split(/[，,\n]+/)).map((x) => x.trim()).filter(Boolean).slice(0, 8);
    if (!keywords.length || !body.startDate || !body.endDate) return jsonError('请填写关键词和时间范围');
    const jobId = await startJob('note_search', `关键词扫描：${keywords.join(' / ')}`, keywords.length, project);
    const all: Array<Record<string, unknown>> = [];
    let rawCount = 0;
    for (const keyword of keywords) {
      const result = await searchNotes(keyword, body.startDate, body.endDate, Math.min(10, Math.max(1, Number(body.maxPages || 3))), project);
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
          publishedAt: text(first(noteInfo.uploadTime, noteInfo.createTime, raw.publishedAt, raw.publishTime, raw.uploadTime)),
          noteType: noteTypeCode === 2 ? '视频' : '图文',
          coverUrl: text(first(noteInfo.coverImage, raw.coverUrl, noteInfo.cover)),
          exposure: number(first(interaction.readNum, interaction.exposure, raw.exposure, interaction.viewNum)),
          readCount: number(first(interaction.readNum, raw.readCount, interaction.views)),
          interactionCount: number(first(interaction.interNum, raw.interactionCount, interaction.interaction)),
          likeCount: number(first(interaction.likeNum, raw.likeCount, interaction.likes)),
          favoriteCount: number(first(interaction.collectNum, raw.favoriteCount, interaction.collects)),
          shareCount: number(first(interaction.shareNum, raw.shareCount, interaction.shares)),
          fansCount: fans,
          creatorLevel: creatorTier(fans),
          notePrice: number(first(price.picturePrice, price.videoPrice, raw.notePrice)),
          picturePrice: number(first(price.picturePrice, raw.picturePrice)),
          videoPrice: number(first(price.videoPrice, raw.videoPrice)),
          province: locationParts[0] || '', city: locationParts[1] || locationParts[0] || '',
          gender: text(first(userInfo.gender, raw.gender)) === '1' ? '女' : text(first(userInfo.gender, raw.gender)) === '0' ? '男' : '',
        });
      }
    }
    await ensureSchema(); const d1 = db();
    const statements: Array<{ run(): Promise<unknown> }> = [];
    for (const note of all) {
      statements.push(d1.prepare(`INSERT INTO notes(id,url,author,title,source_type,pipeline,level,product_scope,published_at,status)
        VALUES(?,?,?,?,'scan','value_scan','P3','竞品',?,'待抓取') ON CONFLICT(id) DO UPDATE SET
        url=excluded.url,author=excluded.author,title=excluded.title,published_at=COALESCE(excluded.published_at,notes.published_at)`).bind(note.id, note.url, note.author, note.title, note.publishedAt || null));
      statements.push(d1.prepare(`INSERT INTO project_notes(id,project_id,note_id,source_type,pipeline,level,product_scope,status,added_at)
        VALUES(?,?,?,'scan','value_scan','P3','竞品','待抓取',?) ON CONFLICT(id) DO NOTHING`).bind(`${project}:${note.id}`, project, note.id, new Date().toISOString()));
      statements.push(d1.prepare(`INSERT INTO note_profiles(note_id,cover_url,note_type,note_price,exposure,read_count,interaction_count,like_count,favorite_count,share_count,fans_count,creator_level,picture_price,video_price,province,city,gender,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(note_id) DO UPDATE SET
        cover_url=CASE WHEN excluded.cover_url!='' THEN excluded.cover_url ELSE note_profiles.cover_url END,
        exposure=excluded.exposure,read_count=excluded.read_count,interaction_count=excluded.interaction_count,
        like_count=excluded.like_count,favorite_count=excluded.favorite_count,share_count=excluded.share_count,
        fans_count=excluded.fans_count,creator_level=excluded.creator_level,picture_price=excluded.picture_price,video_price=excluded.video_price,
        province=excluded.province,city=excluded.city,gender=excluded.gender,updated_at=excluded.updated_at`).bind(
        note.id, note.coverUrl, note.noteType, note.notePrice, note.exposure, note.readCount, note.interactionCount,
        note.likeCount, note.favoriteCount, note.shareCount, note.fansCount, note.creatorLevel, note.picturePrice, note.videoPrice,
        note.province, note.city, note.gender, new Date().toISOString()
      ));
    }
    for (let i = 0; i < statements.length; i += 80) await d1.batch(statements.slice(i, i + 80));
    await finishJob(jobId, { succeeded: all.length, failed: 0, message: `抓取到 ${all.length} 篇相关笔记` });
    await logAction('关键词内容扫描', 'note', keywords.join(','), `原始结果 ${rawCount} 条，去重入库 ${all.length} 篇`, project);
    return Response.json({ ok: true, count: all.length, rawCount, jobId });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '关键词扫描失败', 500);
  }
}
