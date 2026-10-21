import type { IndustryNoteItem, ProviderFetchOptions, ProviderFetchResult } from './industry-types';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
function count(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function publication(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const date = new Date(value < 1e12 ? value * 1000 : value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  const candidate = text(value);
  return /^\d{4}-\d{2}-\d{2}(?:[ T].*)?$/.test(candidate) && Number.isFinite(Date.parse(candidate)) ? candidate : null;
}

export function parseIndustryNote(raw: unknown, options: Pick<ProviderFetchOptions, 'projectId' | 'brand' | 'competitorBrands'>, fetchedAt: string): IndustryNoteItem | null {
  const item = record(raw);
  const note = record(item.noteInfo ?? item.note_info);
  const user = record(item.userInfo ?? item.user_info);
  const brandInfo = record(item.brandInfo ?? item.brand_info);
  const noteId = text(note.noteId);
  if (!/^[a-f\d]{24}$/i.test(noteId)) return null;
  const title = text(note.title) || '无标题笔记';
  // Prefer source attribution. Multiple brand mentions do not establish exclusive attribution.
  const mentioned = [options.brand, ...options.competitorBrands].filter(Boolean).filter(b => title.toLowerCase().includes(b.toLowerCase()));
  const brand = text(brandInfo.brandName) || (new Set(mentioned).size === 1 ? mentioned[0] : '未识别品牌');
  const cooper = note.cooperNote;
  const nature = cooper === 1 || cooper === '1' || cooper === true ? 'commercial'
    : cooper === 0 || cooper === '0' || cooper === false ? 'natural' : 'unknown';
  const cover = text(note.imageUrl);
  let coverUrl: string | null = null;
  try {
    const url = new URL(cover);
    if (url.protocol === 'https:' && /\.(xhscdn|xiaohongshu)\.com$/i.test(url.hostname)) coverUrl = url.href;
  } catch { /* Missing or non-public cover URLs are not rendered. */ }
  return {
    id: `${options.projectId}:${noteId}`, noteId, title,
    bloggerName: text(user.nickName) || null, coverUrl,
    noteUrl: `https://www.xiaohongshu.com/explore/${noteId}`,
    pubTime: publication(note.notePublishTime),
    likedCount: count(note.favNum), commentCount: count(note.commentNum), collectedCount: count(note.collectNum),
    brand, isOurBrand: Boolean(options.brand) && brand.toLowerCase() === options.brand.toLowerCase(),
    nature, sourceProvider: 'pgy', fetchedAt,
  };
}

type Search = (keyword: string, from: string, to: string, pages: number, project: string, options: { cooperNote: number; pageSize: number }) => Promise<{ notes: Array<Record<string, unknown>> }>;

export async function fetchIndustryData(options: ProviderFetchOptions, search?: Search): Promise<ProviderFetchResult> {
  const failure = (message: string): ProviderFetchResult => ({ success: false, provider: 'pgy', liveVerified: false, notes: [], recordCount: 0, errorMessage: message });
  if (!options.spu.trim()) return failure('请先填写项目 SPU，未发起采集。');
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const from = options.dateFrom || new Date(Date.parse(`${today}T00:00:00Z`) - 29 * 86400_000).toISOString().slice(0, 10);
  try {
    const searchNotes = search || (await import('./xhs')).searchNotes;
    // One SPU query, at most two pages per run; no silent expansion to unrelated terms.
    const result = await searchNotes(options.spu.trim(), from, options.dateTo || today,
      Math.min(2, Math.max(1, Math.floor(options.maxPages || 2))), options.projectId,
      { cooperNote: -1, pageSize: Math.min(60, Math.max(1, Math.floor(options.pageSize || 60))) });
    const unique = new Map<string, IndustryNoteItem>();
    const fetchedAt = new Date().toISOString();
    for (const raw of result.notes) {
      const note = parseIndustryNote(raw, options, fetchedAt);
      if (note) unique.set(note.noteId, note);
    }
    if (result.notes.length && !unique.size) return failure('上游返回结构不兼容，未覆盖上次有效数据。');
    return { success: true, provider: 'pgy', liveVerified: true, notes: [...unique.values()], recordCount: unique.size };
  } catch {
    return failure('真实采集失败，请检查服务端蒲公英凭据、接口可用性或网络；未生成模拟数据。');
  }
}
