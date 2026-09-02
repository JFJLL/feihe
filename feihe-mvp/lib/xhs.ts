import type { CommentInput } from './classify';
import { env as workerEnv } from 'cloudflare:workers';
import { DEFAULT_PROJECT_ID, db, ensureSchema } from './db';
import { projectId } from './projects';

type Config = {
  oss?: { access_key_id?: string; access_key_secret?: string; endpoint?: string; bucket?: string; cookie_object?: string };
  xiaohongshu?: { base_url?: string; comment_l1_page_size?: number; comment_l2_page_size?: number; search_page_size?: number; request_timeout_seconds?: number };
};

export type FetchedComment = CommentInput & { depth: 1 | 2 };

async function localConfig(): Promise<Config> {
  try {
    const [{ readFile }, path] = await Promise.all([import('node:fs/promises'), import('node:path')]);
    return JSON.parse(await readFile(path.resolve(process.cwd(), '..', 'config.json'), 'utf8')) as Config;
  } catch {
    return {};
  }
}

async function settings(project = DEFAULT_PROJECT_ID) {
  const local = await localConfig();
  const runtime = workerEnv as unknown as Record<string, string | undefined>;
  await ensureSchema();
  const integration = await db().prepare(`SELECT base_url AS baseUrl,config_json AS configJson FROM integrations
    WHERE project_id=? AND provider IN ('redtrend','xiaohongshu') AND enabled=1 ORDER BY CASE provider WHEN 'redtrend' THEN 0 ELSE 1 END LIMIT 1`)
    .bind(projectId(project)).first<{baseUrl:string;configJson:string}>();
  let integrationConfig:Record<string,unknown>={};
  try { integrationConfig=JSON.parse(integration?.configJson||'{}') as Record<string,unknown>; } catch { /* use defaults */ }
  return {
    baseUrl: integration?.baseUrl || runtime.XHS_BASE_URL || process.env.XHS_BASE_URL || local.xiaohongshu?.base_url || '',
    searchPath: String(integrationConfig.searchPath||'/api/solar/content_square/searchNote'),
    detailPath: String(integrationConfig.detailPath||'/api/solar/note/{noteId}/detail?bizCode='),
    l1Path: String(integrationConfig.l1Path||'/api/solar/note/{noteId}/l1_comments'),
    l2Path: String(integrationConfig.l2Path||'/api/solar/note/{noteId}/l2_comments'),
    l1PageSize: Number(runtime.XHS_COMMENT_L1_PAGE_SIZE || process.env.XHS_COMMENT_L1_PAGE_SIZE || local.xiaohongshu?.comment_l1_page_size || 20),
    l2PageSize: Number(runtime.XHS_COMMENT_L2_PAGE_SIZE || process.env.XHS_COMMENT_L2_PAGE_SIZE || local.xiaohongshu?.comment_l2_page_size || 20),
    searchPageSize: Number(runtime.XHS_SEARCH_PAGE_SIZE || process.env.XHS_SEARCH_PAGE_SIZE || local.xiaohongshu?.search_page_size || 60),
    timeout: Number(runtime.XHS_REQUEST_TIMEOUT_SECONDS || process.env.XHS_REQUEST_TIMEOUT_SECONDS || local.xiaohongshu?.request_timeout_seconds || 30),
    oss: {
      accessKeyId: runtime.OSS_ACCESS_KEY_ID || process.env.OSS_ACCESS_KEY_ID || local.oss?.access_key_id || '',
      accessKeySecret: runtime.OSS_ACCESS_KEY_SECRET || process.env.OSS_ACCESS_KEY_SECRET || local.oss?.access_key_secret || '',
      endpoint: runtime.OSS_ENDPOINT || process.env.OSS_ENDPOINT || local.oss?.endpoint || '',
      bucket: runtime.OSS_BUCKET || process.env.OSS_BUCKET || local.oss?.bucket || '',
      objectKey: runtime.OSS_COOKIE_OBJECT || process.env.OSS_COOKIE_OBJECT || local.oss?.cookie_object || '',
    },
  };
}

function bytesToBase64(bytes: ArrayBuffer) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function cookiePool(project = DEFAULT_PROJECT_ID) {
  const config = await settings(project);
  const { accessKeyId, accessKeySecret, endpoint, bucket, objectKey } = config.oss;
  if (!accessKeyId || !accessKeySecret || !endpoint || !bucket || !objectKey) {
    throw new Error('OSS Cookie 配置不完整');
  }
  const date = new Date().toUTCString();
  const canonical = `GET\n\n\n${date}\n/${bucket}/${objectKey.replace(/^\//, '')}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(accessKeySecret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signature = bytesToBase64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical)));
  const endpointUrl = new URL(endpoint);
  const url = `${endpointUrl.protocol}//${bucket}.${endpointUrl.host}/${objectKey.replace(/^\//, '').split('/').map(encodeURIComponent).join('/')}`;
  const response = await fetch(url, { headers: { Date: date, Authorization: `OSS ${accessKeyId}:${signature}` } });
  if (!response.ok) throw new Error(`Cookie 池下载失败 HTTP ${response.status}`);
  const text = await response.text();
  const pool = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Record<string, string>);
  if (!pool.length) throw new Error('Cookie 池为空');
  return pool;
}

export async function createNoteDetailFetcher(project = DEFAULT_PROJECT_ID) {
  const config = await settings(project);
  if (!config.baseUrl) throw new Error('小红书接口地址未配置');
  const cookies = await cookiePool(project);
  const cookie = Object.entries(cookies[0]).map(([key, value]) => `${key}=${value}`).join('; ');
  const headers = {
    Cookie: cookie,
    Accept: 'application/json',
    Referer: 'https://pgy.xiaohongshu.com/',
    'User-Agent': 'Mozilla/5.0',
  };
  return async (noteId: string) => requestJson(
    `${config.baseUrl.replace(/\/$/, '')}${config.detailPath.replace('{noteId}', encodeURIComponent(noteId))}`,
    { headers },
    config.timeout,
  );
}

async function requestJson(url: string, init: RequestInit, timeoutSeconds: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = await response.json() as { code?: number; msg?: string; message?: string; data?: Record<string, unknown> };
    if (!response.ok || (payload.code != null && payload.code !== 0)) {
      throw new Error(payload.msg || payload.message || `HTTP ${response.status}`);
    }
    return payload.data || {};
  } finally {
    clearTimeout(timer);
  }
}

function idOf(value: Record<string, unknown> | undefined) {
  return String(value?.idStr || value?.id || '');
}

function mapComment(noteId: string, value: Record<string, unknown>, depth: 1 | 2, parentId?: string): FetchedComment {
  const user = (value.user || value.author || {}) as Record<string, unknown>;
  return {
    id: idOf(value) || `${noteId}-${depth}-${String(value.createTime || '')}-${String(value.content || '').slice(0, 12)}`,
    noteId,
    parentId,
    content: String(value.content || ''),
    author: String(user.nickname || user.nickName || user.name || ''),
    createdAt: String(value.createTime || ''),
    replyCount: Number(value.subCommentCount || 0),
    depth,
  };
}

export async function fetchAllComments(noteId: string, project = DEFAULT_PROJECT_ID) {
  const config = await settings(project);
  if (!config.baseUrl) throw new Error('小红书接口地址未配置');
  const cookies = await cookiePool(project);
  const cookie = Object.entries(cookies[0]).map(([key, value]) => `${key}=${value}`).join('; ');
  const headers = { Cookie: cookie, 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };
  const l1Items: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  let offset = '';
  let reportedL1 = 0;

  while (true) {
    const url = new URL(`${config.baseUrl.replace(/\/$/, '')}${config.l1Path.replace('{noteId}',noteId)}`);
    url.searchParams.set('offset', offset);
    url.searchParams.set('pageSize', String(config.l1PageSize));
    url.searchParams.set('l2PageSize', String(config.l2PageSize));
    const data = await requestJson(url.toString(), { headers }, config.timeout);
    reportedL1 = Number(data.l1CommentTotal || reportedL1);
    const batch = (data.l1Comments || []) as Array<Record<string, unknown>>;
    if (!batch.length) break;
    let added = 0;
    for (const item of batch) {
      const id = idOf(item.comment as Record<string, unknown>);
      if (id && !seen.has(id)) { seen.add(id); l1Items.push(item); added += 1; }
    }
    if (reportedL1 && l1Items.length >= reportedL1) break;
    const next = idOf(batch.at(-1)?.comment as Record<string, unknown>);
    if (!added || !next || next === offset) break;
    offset = next;
  }

  const comments: FetchedComment[] = [];
  for (const item of l1Items) {
    const l1 = item.comment as Record<string, unknown>;
    const parentId = idOf(l1);
    comments.push(mapComment(noteId, l1, 1));
    const l2: Array<Record<string, unknown>> = [];
    const l2Seen = new Set<string>();
    for (const child of (item.l1L2Comments || []) as Array<Record<string, unknown>>) {
      const id = idOf(child); if (id && !l2Seen.has(id)) { l2Seen.add(id); l2.push(child); }
    }
    const expected = Number(l1.subCommentCount || 0);
    let l2Offset = l2.length ? idOf(l2.at(-1)) : '';
    while (parentId && l2.length < expected) {
      const url = new URL(`${config.baseUrl.replace(/\/$/, '')}${config.l2Path.replace('{noteId}',noteId)}`);
      url.searchParams.set('offset', l2Offset);
      url.searchParams.set('l1CommentId', parentId);
      url.searchParams.set('pageSize', String(config.l2PageSize));
      const data = await requestJson(url.toString(), { headers }, config.timeout);
      const batch = (data.l2Comments || []) as Array<Record<string, unknown>>;
      if (!batch.length) break;
      let added = 0;
      for (const child of batch) {
        const id = idOf(child); if (id && !l2Seen.has(id)) { l2Seen.add(id); l2.push(child); added += 1; }
      }
      const next = idOf(batch.at(-1));
      if (!added || !next || next === l2Offset) break;
      l2Offset = next;
    }
    for (const child of l2) comments.push(mapComment(noteId, child, 2, parentId));
  }
  return { noteId, reportedL1, fetchedL1: l1Items.length, fetchedL2: comments.filter((c) => c.depth === 2).length, comments };
}

export async function searchNotes(keyword: string, startDate: string, endDate: string, maxPages = 3, project = DEFAULT_PROJECT_ID) {
  const config = await settings(project);
  const cookies = await cookiePool(project);
  const cookie = Object.entries(cookies[0]).map(([key, value]) => `${key}=${value}`).join('; ');
  const headers = { Cookie: cookie, 'Content-Type': 'application/json;charset=UTF-8', Origin: 'https://pgy.xiaohongshu.com', Referer: 'https://pgy.xiaohongshu.com/solar/creative/content', 'User-Agent': 'Mozilla/5.0' };
  const notes: Array<Record<string, unknown>> = [];
  let total = 0;
  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const data = await requestJson(`${config.baseUrl.replace(/\/$/, '')}${config.searchPath}`, {
      method: 'POST', headers, body: JSON.stringify({ searchWord: keyword, pageSize: config.searchPageSize, pageNum, cooperNote: 0, notePublishTimeStart: `${startDate} 00:00:00`, notePublishTimeEnd: `${endDate} 23:59:59`, sorts: [{ column: 'hot', sort: 'desc' }] }),
    }, config.timeout);
    total = Number(data.total || total);
    const batch = (data.noteList || []) as Array<Record<string, unknown>>;
    notes.push(...batch);
    if (!batch.length || notes.length >= total) break;
  }
  return { keyword, total, fetched: notes.length, notes };
}
