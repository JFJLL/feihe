import { canonicalIndustryBrand } from './industry-brand';
import type {
  IndustryQuery,
  IndustryV2Config,
  IndustryV2Note,
  IndustryV2FetchResult,
} from './industry-v2-types';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value).trim() : '';

function parseCount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  }
  const str = String(value).replace(/,/g, '').trim();
  if (!str || str === '--') return null;
  const parsed = Number(str);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  const str = String(value).replace(/,/g, '').trim();
  if (!str || str === '--') return null;
  const parsed = Number(str);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseReportedTotal(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return Number.isInteger(val) && val >= 0 ? val : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return null;
    const num = Number(trimmed);
    return Number.isSafeInteger(num) && num >= 0 ? num : null;
  }
  return null;
}

export function isValidCalendarDate(yyyyMmDd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return false;
  const parts = yyyyMmDd.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const testDate = new Date(Date.UTC(y, m - 1, d));
  return (
    testDate.getUTCFullYear() === y &&
    testDate.getUTCMonth() === m - 1 &&
    testDate.getUTCDate() === d
  );
}

export function parseShanghaiDate(value: unknown): { publishedAt: string | null; publishedDate: string | null } {
  if (value == null || value === '') {
    return { publishedAt: null, publishedDate: null };
  }

  let ms: number | null = null;

  try {
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value <= 0 || value > 8.64e15) return { publishedAt: null, publishedDate: null };
      ms = value < 1e11 ? value * 1000 : value;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || trimmed === '--') return { publishedAt: null, publishedDate: null };

      if (/^\d{10,13}$/.test(trimmed)) {
        const num = Number(trimmed);
        if (Number.isFinite(num) && num > 0 && num < 8.64e15) {
          ms = num < 1e11 ? num * 1000 : num;
        }
      } else {
        const datePart = trimmed.slice(0, 10);
        if (!isValidCalendarDate(datePart)) return { publishedAt: null, publishedDate: null };
        let isoCandidate = trimmed;
        if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
          isoCandidate = trimmed.replace(' ', 'T') + '+08:00';
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          isoCandidate = `${trimmed}T00:00:00+08:00`;
        }
        const parsed = Date.parse(isoCandidate);
        if (Number.isFinite(parsed) && parsed > 0 && parsed < 8.64e15) {
          ms = parsed;
        }
      }
    }

    if (ms == null || !Number.isFinite(ms) || ms <= 0 || ms > 8.64e15) {
      return { publishedAt: null, publishedDate: null };
    }

    const shanghaiOffsetMs = 8 * 3600 * 1000;
    const shanghaiTime = new Date(ms + shanghaiOffsetMs);
    const publishedDate = shanghaiTime.toISOString().slice(0, 10);
    if (!isValidCalendarDate(publishedDate)) return { publishedAt: null, publishedDate: null };
    const publishedAt = new Date(ms).toISOString();

    return { publishedAt, publishedDate };
  } catch {
    return { publishedAt: null, publishedDate: null };
  }
}

export function parseCoverUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    const isAllowedDomain = host === 'xhscdn.com' || host.endsWith('.xhscdn.com') ||
      host === 'xiaohongshu.com' || host.endsWith('.xiaohongshu.com');
    if (!isAllowedDomain) return null;
    return u.href;
  } catch {
    return null;
  }
}

export type ParseIndustryNoteContext = {
  query: IndustryQuery;
  config?: IndustryV2Config;
  targetDate?: string;
  capturedAt?: string;
};

export function parseIndustryV2Note(
  raw: unknown,
  queryOrContext: IndustryQuery | ParseIndustryNoteContext,
  configArg?: IndustryV2Config,
  targetDateArg?: string,
  capturedAtArg?: string,
): IndustryV2Note | null {
  let query: IndustryQuery;
  let config: IndustryV2Config | undefined;
  let targetDate: string | undefined;
  let capturedAt: string | undefined;

  if (queryOrContext && typeof queryOrContext === 'object' && 'query' in queryOrContext) {
    const ctx = queryOrContext as ParseIndustryNoteContext;
    query = ctx.query;
    config = ctx.config;
    targetDate = ctx.targetDate;
    capturedAt = ctx.capturedAt;
  } else {
    query = queryOrContext as IndustryQuery;
    config = configArg;
    targetDate = targetDateArg;
    capturedAt = capturedAtArg;
  }

  if (!query?.id) return null;

  const item = record(raw);
  const noteInfo = record(item.noteInfo ?? item.note_info);
  const userInfo = record(item.userInfo ?? item.user_info);
  const brandInfo = record(item.brandInfo ?? item.brand_info);
  const shareInfo = record(noteInfo.shareInfo ?? item.shareInfo);

  const rawNoteId = text(noteInfo.noteId || noteInfo.id || item.noteId || item.id);
  if (!/^[a-f0-9]{24}$/i.test(rawNoteId)) {
    return null;
  }
  const noteId = rawNoteId.toLowerCase();

  const rawDate = noteInfo.notePublishTime ?? noteInfo.publishTime ?? noteInfo.createTime ?? item.notePublishTime;
  const { publishedAt, publishedDate } = parseShanghaiDate(rawDate);

  if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    if (publishedDate && publishedDate !== targetDate) {
      return null;
    }
  }

  const title = (text(noteInfo.title || noteInfo.noteTitle || noteInfo.desc || noteInfo.content || shareInfo.title) || '无标题笔记').slice(0, 300);
  const content = text(noteInfo.content || noteInfo.desc || '').slice(0, 4000);
  const url = `https://www.xiaohongshu.com/explore/${noteId}`;

  const coverUrl = parseCoverUrl(noteInfo.imageUrl || noteInfo.coverUrl || noteInfo.image || item.coverUrl);

  const rawBrand = text(brandInfo.brandName || brandInfo.brand || item.brandName || item.brand);
  let brand: string;
  if (query.kind === 'competitor') {
    brand = rawBrand || '未识别品牌';
  } else {
    if (rawBrand) {
      brand = canonicalIndustryBrand(rawBrand, config?.brand || '', config?.spu || '');
    } else {
      brand = '未识别品牌';
    }
  }

  const creatorId = text(userInfo.userId || userInfo.id || userInfo.userIdStr) || null;
  const creatorName = text(userInfo.nickName || userInfo.nickname || userInfo.userNickName || userInfo.name) || null;
  const fans = parseCount(userInfo.fansNum ?? userInfo.fans ?? userInfo.fansCount);
  const creatorRegion = text(userInfo.location || userInfo.ipLocation || userInfo.city || userInfo.province) || null;
  const creatorGender = text(userInfo.gender) || null;

  const taxonomy1 = text(noteInfo.taxonomy1 || noteInfo.firstTaxonomy) || null;
  const taxonomy2 = text(noteInfo.taxonomy2 || noteInfo.secondTaxonomy) || null;

  const rawType = noteInfo.noteType ?? noteInfo.type ?? item.noteType;
  let format: 'image' | 'video' | 'unknown' = 'unknown';
  if (rawType === 1 || rawType === '1' || rawType === 'image' || rawType === '图文') {
    format = 'image';
  } else if (rawType === 2 || rawType === '2' || rawType === 'video' || rawType === '视频') {
    format = 'video';
  }

  const rawCooper = noteInfo.cooperNote ?? item.cooperNote ?? noteInfo.isCooperation ?? noteInfo.is_cooperation;
  let commercial: boolean | null = null;
  if (rawCooper === 1 || rawCooper === '1' || rawCooper === true) {
    commercial = true;
  } else if (rawCooper === 0 || rawCooper === '0' || rawCooper === false) {
    commercial = false;
  }

  const rawAd = noteInfo.isAdNote ?? item.isAdNote ?? noteInfo.is_ad_note ?? noteInfo.isAd;
  let promoted: boolean | null = null;
  if (rawAd === 1 || rawAd === '1' || rawAd === true || rawAd === '是') {
    promoted = true;
  } else if (rawAd === 0 || rawAd === '0' || rawAd === false || rawAd === '否') {
    promoted = false;
  }

  const impressions = parseCount(noteInfo.impNum ?? noteInfo.imp_num ?? noteInfo.impressions);
  const reads = parseCount(noteInfo.readNum ?? noteInfo.read_num ?? noteInfo.reads);
  const interactions = parseCount(noteInfo.engageNum ?? noteInfo.engage_num ?? noteInfo.interactions);
  const likes = parseCount(noteInfo.favNum ?? noteInfo.likeNum ?? noteInfo.likes);
  const comments = parseCount(noteInfo.commentNum ?? noteInfo.cmtNum ?? noteInfo.comments);
  const collects = parseCount(noteInfo.collectNum ?? noteInfo.collects);

  let priceRaw: unknown = null;
  if (format === 'image') {
    priceRaw = userInfo.picturePrice ?? userInfo.picture_price ?? noteInfo.notePrice;
  } else if (format === 'video') {
    priceRaw = userInfo.videoPrice ?? userInfo.video_price ?? noteInfo.notePrice;
  } else {
    priceRaw = null;
  }
  const quotedPrice = parsePrice(priceRaw);

  return {
    noteId,
    title,
    content,
    url,
    coverUrl,
    publishedAt,
    publishedDate,
    brand,
    creatorId,
    creatorName,
    fans,
    creatorRegion,
    creatorGender,
    taxonomy1,
    taxonomy2,
    format,
    commercial,
    promoted,
    impressions,
    reads,
    interactions,
    likes,
    comments,
    collects,
    quotedPrice,
    capturedAt: capturedAt || new Date().toISOString(),
    queryIds: [query.id],
  };
}

export type IndustryV2SearchFn = (
  keyword: string,
  date: string,
  pageNum: number,
  pageSize: number,
  projectId: string,
) => Promise<{ total?: number | null; noteList?: unknown[] } | Record<string, unknown>>;

export async function fetchIndustryV2Query(
  query: IndustryQuery,
  date: string,
  config: IndustryV2Config,
  options?: { maxPages?: number; pageSize?: number; delayMs?: number },
  injectedSearch?: IndustryV2SearchFn,
): Promise<IndustryV2FetchResult> {
  const failure = (
    msg: string,
    existingNotes: IndustryV2Note[] = [],
    pages = 0,
    total: number | null = null,
    truncated = false,
  ): IndustryV2FetchResult => ({
    ok: false,
    notes: existingNotes,
    pages,
    reportedTotal: total,
    truncated,
    error: msg,
  });

  if (!query?.id || !query?.keyword) {
    return failure('缺少有效的采集关键词或查询 ID');
  }
  if (!isValidCalendarDate(date)) {
    return failure('无效采集日期：日期不存在或格式错误 (必须为有效 YYYY-MM-DD)');
  }

  const maxPages = Math.min(5, Math.max(1, Math.floor(options?.maxPages ?? 3)));
  const pageSize = Math.min(60, Math.max(1, Math.floor(options?.pageSize ?? 60)));
  const delayMs = options?.delayMs ?? (injectedSearch ? 0 : 1000);

  const notesMap = new Map<string, IndustryV2Note>();
  let rawItemsSeen = 0;
  let filteredOutCount = 0;
  let missingDateCount = 0;
  let reportedTotal: number | null = null;
  let pagesFetched = 0;
  let truncated = false;
  let fetchError: string | null = null;
  let hasFailure = false;
  const capturedAt = new Date().toISOString();

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    if (pageNum > 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    let rawData: unknown;
    try {
      if (injectedSearch) {
        rawData = await injectedSearch(query.keyword, date, pageNum, pageSize, config.projectId);
      } else {
        const { searchIndustryNotesPage } = await import('./xhs');
        rawData = await searchIndustryNotesPage(query.keyword, date, date, pageNum, pageSize, config.projectId);
      }
    } catch {
      fetchError = '上游小红书/蒲公英接口请求异常，请检查服务端凭据或网络配置';
      hasFailure = true;
      truncated = true;
      break;
    }

    const respObj = rawData && typeof rawData === 'object' ? (rawData as Record<string, unknown>) : null;
    if (!respObj) {
      fetchError = '上游返回结构不兼容：响应不是有效对象';
      hasFailure = true;
      truncated = true;
      break;
    }

    if (respObj.code != null && Number(respObj.code) !== 0) {
      fetchError = '上游小红书/蒲公英接口请求异常，请检查服务端凭据或网络配置';
      hasFailure = true;
      truncated = true;
      break;
    }

    const dataSection =
      respObj.data && typeof respObj.data === 'object' && !Array.isArray(respObj.data)
        ? (respObj.data as Record<string, unknown>)
        : respObj;

    if (dataSection !== respObj && dataSection.code != null && Number(dataSection.code) !== 0) {
      fetchError = '上游小红书/蒲公英接口请求异常，请检查服务端凭据或网络配置';
      hasFailure = true;
      truncated = true;
      break;
    }

    const rawNoteList = dataSection.noteList ?? dataSection.note_list;
    if (!Array.isArray(rawNoteList)) {
      fetchError = '上游返回结构不兼容：noteList 不是有效数组';
      hasFailure = true;
      truncated = true;
      break;
    }

    pagesFetched = pageNum;

    const parsedTotal = parseReportedTotal(dataSection.total ?? respObj.total);
    if (parsedTotal != null) {
      reportedTotal = parsedTotal;
    }

    const batch = rawNoteList as Array<unknown>;

    // Empty array: valid completed response
    if (batch.length === 0) {
      break;
    }
    rawItemsSeen += batch.length;

    for (const rawItem of batch) {
      const parsed = parseIndustryV2Note(rawItem, {
        query,
        config,
        targetDate: date,
        capturedAt,
      });
      if (parsed) {
        if (parsed.publishedDate === null) {
          missingDateCount++;
        }
        if (notesMap.has(parsed.noteId)) {
          const existing = notesMap.get(parsed.noteId)!;
          if (!existing.queryIds.includes(query.id)) {
            existing.queryIds.push(query.id);
          }
        } else {
          notesMap.set(parsed.noteId, parsed);
        }
      } else {
        filteredOutCount++;
      }
    }

    if (batch.length < pageSize) {
      break;
    }

    if (reportedTotal != null && reportedTotal >= 0 && notesMap.size >= reportedTotal) {
      break;
    }

    if (pageNum === maxPages) {
      if (reportedTotal != null && notesMap.size < reportedTotal) {
        truncated = true;
      } else if (reportedTotal == null && batch.length === pageSize) {
        truncated = true;
      }
      break;
    }
  }

  if (rawItemsSeen > 0 && notesMap.size === 0 && fetchError === null) {
    fetchError = `上游返回 ${rawItemsSeen} 条数据，但全部（${filteredOutCount} 篇）因结构不符或发布日期越界被过滤（有效 0 篇）`;
    hasFailure = true;
    truncated = true;
  }

  if (missingDateCount > 0) {
    truncated = true;
    const missingMsg = `存在 ${missingDateCount} 篇笔记缺失发布日期，标记为截断/未完整`;
    fetchError = fetchError ? `${fetchError}；${missingMsg}` : missingMsg;
  }
  if (filteredOutCount > 0 && notesMap.size > 0) {
    truncated = true;
    const filterMsg = `已过滤 ${filteredOutCount} 篇异常/越界样本`;
    fetchError = fetchError ? `${fetchError}；${filterMsg}` : filterMsg;
  }

  if (reportedTotal != null && notesMap.size < reportedTotal) {
    truncated = true;
  }

  if (hasFailure) {
    return {
      ok: false,
      notes: Array.from(notesMap.values()),
      pages: pagesFetched,
      reportedTotal,
      truncated: true,
      error: fetchError,
    };
  }

  if (reportedTotal != null && notesMap.size < reportedTotal && pagesFetched >= maxPages) {
    truncated = true;
  }

  return {
    ok: true,
    notes: Array.from(notesMap.values()),
    pages: pagesFetched,
    reportedTotal,
    truncated,
    error: fetchError,
  };
}
