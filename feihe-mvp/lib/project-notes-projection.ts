import type { MiniDb } from "./db";
import { calendarDay } from "./business-daily/adapter";
import { parseNumericValue } from "./numeric-values";

export type Row = Record<string, string | number | boolean | null>;

export type FilterOpts = {
  from?: string | null;
  to?: string | null;
  source?: string | null;
  status?: string | null;
  scope?: string | null;
};

export async function getProjectNotesProjection(d1: MiniDb, project: string, filters: FilterOpts = {}): Promise<Row[]> {
  try {
    const execCapture = await d1.prepare(
      "SELECT payload_json, source_version, captured_at FROM business_captures WHERE project_id=? AND source_key='execution' ORDER BY captured_at DESC LIMIT 1"
    ).bind(project).first<{ payload_json: string; source_version: string; captured_at: string }>();

    let execRows: unknown[][] = [];
    if (execCapture?.payload_json) {
      try {
        const parsed = JSON.parse(execCapture.payload_json);
        execRows = parsed.rows || [];
      } catch {}
    }

    const archivesRes = await d1.prepare(
      "SELECT note_id, data_json, updated_at FROM business_note_archives WHERE project_id=?"
    ).bind(project).all<{ note_id: string; data_json: string; updated_at: string }>();
    const archives = archivesRes?.results || [];

    const profilesRes = await d1.prepare(
      "SELECT note_id, cover_url FROM note_profiles WHERE cover_url != '' AND cover_url IS NOT NULL"
    ).all<{ note_id: string; cover_url: string }>();
    const coverMap = new Map<string, string>();
    for (const p of profilesRes?.results || []) {
      if (p.note_id && p.cover_url) {
        coverMap.set(String(p.note_id).trim().toLowerCase(), String(p.cover_url).trim());
      }
    }

    const deliveriesRes = await d1.prepare(
      "SELECT note_id, count(*) as c FROM business_comment_deliveries WHERE project_id=? AND note_id!='' GROUP BY note_id"
    ).bind(project).all<{ note_id: string; c: number }>();
    const deliveryMap = new Map<string, number>();
    for (const d of deliveriesRes?.results || []) {
      if (d.note_id) deliveryMap.set(String(d.note_id).trim().toLowerCase(), Number(d.c) || 0);
    }

    const noteMap = new Map<string, Row>();
    for (const a of archives) {
      const id = String(a.note_id).trim().toLowerCase();
      if (!/^[a-f0-9]{24}$/i.test(id)) continue;
      let data: Record<string, any> = {};
      try { data = JSON.parse(a.data_json); } catch {}
      noteMap.set(id, {
        id,
        url: data.links?.[0] || `https://www.xiaohongshu.com/discovery/item/${id}`,
        author: data.author || '',
        title: data.title || '',
        sourceType: 'owned',
        pipeline: 'rectification',
        level: data.tier || 'P3',
        productScope: '本品',
        publishedAt: data.publishedDay || null,
        lastFetchedAt: a.updated_at || null,
        commentTotal: null,
        naturalComments: null,
        deliveredComments: deliveryMap.get(id) || 0,
        positiveCount: null,
        negativeCount: null,
        questionCount: null,
        sentimentAvailable: false,
        brandMentionTop5: 0,
        status: '已发布',
        coverUrl: coverMap.get(id) || '',
        category1: '',
        category2: '',
        cooperation: 1,
        promoted: 0,
        noteType: '',
        notePrice: null,
        exposure: null,
        readCount: null,
        interactionCount: null,
        likeCount: null,
        favoriteCount: null,
        shareCount: null,
        fansCount: null,
        creatorLevel: data.tier || '',
        province: '',
        city: '',
        gender: '',
        brand: '启萃',
        cpm: null,
        cpr: null,
        cpe: null,
        engagementRate: null,
      });
    }

    if (execRows.length > 1) {
      const headers = (execRows[0] || []).map(h => String(h || '').replace(/\r?\n/g, ' ').trim());
      const findCol = (name: string, fallback: number) => {
        const idx = headers.findIndex(h => h.includes(name));
        return idx >= 0 ? idx : fallback;
      };
      const colId = findCol('笔记ID', 32);
      const colTitle = findCol('标题', 34);
      const colAuthor = findCol('达人昵称', 4);
      const colUrl = findCol('发布链接', 31);
      const colPubDate = findCol('发布日期', 30);
      const colLevel = findCol('博主粉丝数量级', 8);
      const colRegion = findCol('常驻ip地域归属', 10);
      const colScene1 = findCol('一级场景', 22);
      const colScene2 = findCol('二级场景', 23);
      const colType = findCol('笔记类型', 24);
      const colPrice = findCol('总合作价/元', 18);
      const colExp = findCol('自然曝光量', 40);
      const colRead = findCol('自然阅读量', 41);
      const colInter = findCol('互动量', 43);
      const colComments = findCol('评论量', 37);

      for (let r = 1; r < execRows.length; r++) {
        const line = execRows[r];
        const rawId = line[colId];
        if (!rawId) continue;
        const id = String(rawId).trim().toLowerCase();
        if (!/^[a-f0-9]{24}$/i.test(id)) continue;

        const existing = noteMap.get(id) || {
          id,
          url: `https://www.xiaohongshu.com/discovery/item/${id}`,
          author: '',
          title: '',
          sourceType: 'owned',
          pipeline: 'execution',
          level: 'P3',
          productScope: '本品',
          publishedAt: null,
          lastFetchedAt: execCapture?.captured_at || null,
          commentTotal: null,
          naturalComments: null,
          deliveredComments: deliveryMap.get(id) || 0,
          positiveCount: null,
          negativeCount: null,
          questionCount: null,
          sentimentAvailable: false,
          brandMentionTop5: 0,
          status: '已发布',
          coverUrl: coverMap.get(id) || '',
          category1: '',
          category2: '',
          cooperation: 1,
          promoted: 0,
          noteType: '',
          notePrice: null,
          exposure: null,
          readCount: null,
          interactionCount: null,
          likeCount: null,
          favoriteCount: null,
          shareCount: null,
          fansCount: null,
          creatorLevel: '',
          province: '',
          city: '',
          gender: '',
          brand: '启萃',
          cpm: null,
          cpr: null,
          cpe: null,
          engagementRate: null,
        };

        if (line[colTitle]) existing.title = String(line[colTitle]).trim();
        if (line[colAuthor]) existing.author = String(line[colAuthor]).trim();
        if (line[colUrl]) existing.url = String(line[colUrl]).trim();
        const pub = calendarDay(line[colPubDate]);
        if (pub) existing.publishedAt = pub;
        if (line[colLevel]) existing.creatorLevel = String(line[colLevel]).trim();
        if (line[colRegion]) existing.province = String(line[colRegion]).trim();
        if (line[colScene1]) existing.category1 = String(line[colScene1]).trim();
        if (line[colScene2]) existing.category2 = String(line[colScene2]).trim();
        if (line[colType]) existing.noteType = String(line[colType]).trim();
        if (line[colPrice] !== null && line[colPrice] !== '' && String(line[colPrice]).trim() !== '') {
          existing.notePrice = parseNumericValue(line[colPrice]);
        }
        existing.pipeline = 'execution';

        const rawExp = line[colExp];
        const rawRead = line[colRead];
        const rawInter = line[colInter];
        const rawComments = line[colComments];

        if (rawExp !== null && rawExp !== '' && String(rawExp).trim() !== '') {
          existing.exposure = parseNumericValue(rawExp);
        }
        if (rawRead !== null && rawRead !== '' && String(rawRead).trim() !== '') {
          existing.readCount = parseNumericValue(rawRead);
        }
        if (rawInter !== null && rawInter !== '' && String(rawInter).trim() !== '') {
          existing.interactionCount = parseNumericValue(rawInter);
        }
        if (rawComments !== null && rawComments !== '' && String(rawComments).trim() !== '') {
          const c = parseNumericValue(rawComments);
          if (c !== null) {
            existing.naturalComments = c;
            existing.commentTotal = c;
          }
        }

        const exp = existing.exposure !== null ? Number(existing.exposure) : null;
        const rd = existing.readCount !== null ? Number(existing.readCount) : null;
        const inter = existing.interactionCount !== null ? Number(existing.interactionCount) : null;
        const pr = existing.notePrice !== null ? Number(existing.notePrice) : null;

        existing.cpm = (exp && pr && exp > 0) ? (pr * 1000) / exp : null;
        existing.cpr = (rd && pr && rd > 0) ? pr / rd : null;
        existing.cpe = (inter && pr && inter > 0) ? pr / inter : null;
        existing.engagementRate = (rd && inter !== null && rd > 0) ? inter / rd : null;

        noteMap.set(id, existing);
      }
    }

    let filtered = [...noteMap.values()];
    if (filters.from) filtered = filtered.filter(n => n.publishedAt && String(n.publishedAt) >= filters.from!);
    if (filters.to) filtered = filtered.filter(n => n.publishedAt && String(n.publishedAt) <= filters.to!);
    if (filters.source) filtered = filtered.filter(n => n.sourceType === filters.source);
    if (filters.status) filtered = filtered.filter(n => n.status === filters.status);
    if (filters.scope) filtered = filtered.filter(n => n.productScope === filters.scope);

    return filtered;
  } catch (err) {
    console.error('getProjectNotesProjection error:', err);
    return [];
  }
}
