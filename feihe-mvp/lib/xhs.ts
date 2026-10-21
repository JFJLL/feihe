import type { CommentInput } from './classify';
import { envVar } from './runtime-env';
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
  await ensureSchema();
  const integration = await db().prepare(`SELECT base_url AS baseUrl,config_json AS configJson FROM integrations
    WHERE project_id=? AND provider IN ('redtrend','xiaohongshu') AND enabled=1 ORDER BY CASE provider WHEN 'redtrend' THEN 0 ELSE 1 END LIMIT 1`)
    .bind(projectId(project)).first<{baseUrl:string;configJson:string}>();
  let integrationConfig:Record<string,unknown>={};
  try { integrationConfig=JSON.parse(integration?.configJson||'{}') as Record<string,unknown>; } catch { /* use defaults */ }
  return {
    baseUrl: integration?.baseUrl || envVar('XHS_BASE_URL') || process.env.XHS_BASE_URL || local.xiaohongshu?.base_url || '',
    searchPath: String(integrationConfig.searchPath||'/api/solar/content_square/searchNote'),
    detailPath: String(integrationConfig.detailPath||'/api/solar/note/{noteId}/detail?bizCode='),
    l1Path: String(integrationConfig.l1Path||'/api/solar/note/{noteId}/l1Comments'),
    l2Path: String(integrationConfig.l2Path||'/api/solar/note/{noteId}/l2Comments'),
    l1PageSize: Number(envVar('XHS_COMMENT_L1_PAGE_SIZE') || process.env.XHS_COMMENT_L1_PAGE_SIZE || local.xiaohongshu?.comment_l1_page_size || 20),
    l2PageSize: Number(envVar('XHS_COMMENT_L2_PAGE_SIZE') || process.env.XHS_COMMENT_L2_PAGE_SIZE || local.xiaohongshu?.comment_l2_page_size || 20),
    searchPageSize: Number(envVar('XHS_SEARCH_PAGE_SIZE') || process.env.XHS_SEARCH_PAGE_SIZE || local.xiaohongshu?.search_page_size || 60),
    timeout: Number(envVar('XHS_REQUEST_TIMEOUT_SECONDS') || process.env.XHS_REQUEST_TIMEOUT_SECONDS || local.xiaohongshu?.request_timeout_seconds || 30),
    oss: {
      accessKeyId: envVar('OSS_ACCESS_KEY_ID') || process.env.OSS_ACCESS_KEY_ID || local.oss?.access_key_id || '',
      accessKeySecret: envVar('OSS_ACCESS_KEY_SECRET') || process.env.OSS_ACCESS_KEY_SECRET || local.oss?.access_key_secret || '',
      endpoint: envVar('OSS_ENDPOINT') || process.env.OSS_ENDPOINT || local.oss?.endpoint || '',
      bucket: envVar('OSS_BUCKET') || process.env.OSS_BUCKET || local.oss?.bucket || '',
      objectKey: envVar('OSS_COOKIE_OBJECT') || process.env.OSS_COOKIE_OBJECT || local.oss?.cookie_object || '',
    },
  };
}

function bytesToBase64(bytes: ArrayBuffer) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function cookiePool(project = DEFAULT_PROJECT_ID, explicitObjectKey?: string) {
  const config = await settings(project);
  const { accessKeyId, accessKeySecret, endpoint, bucket } = config.oss;
  const objectKey = explicitObjectKey || config.oss.objectKey;
  if (!accessKeyId || !accessKeySecret || !endpoint || !bucket || !objectKey) {
    throw new Error('OSS Cookie 配置不完整');
  }
  const date = new Date().toUTCString();
  const canonical = `GET\n\n\n${date}\n/${bucket}/${objectKey.replace(/^\//, '')}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(accessKeySecret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signature = bytesToBase64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical)));
  const endpointUrl = new URL(endpoint);
  const url = `${endpointUrl.protocol}//${bucket}.${endpointUrl.host}/${objectKey.replace(/^\//, '').split('/').map(encodeURIComponent).join('/')}`;
  const response = await fetch(url, { headers: { Date: date, Authorization: `OSS ${accessKeyId}:${signature}` }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Cookie 池下载失败 HTTP ${response.status}`);
  const text = await response.text();
  const pool = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Record<string, string>);
  if (!pool.length) throw new Error('Cookie 池为空');
  return pool;
}

// The note operations worker requires a named project account and its own OSS object.
// Existing legacy callers retain their established behavior; this path has no global-cookie fallback.
export async function createProjectCommentRequester(project: string) {
  await ensureSchema();
  const integration = await db().prepare("SELECT id,base_url,config_json FROM integrations WHERE project_id=? AND provider IN ('redtrend','xiaohongshu','pgy') AND enabled=1 ORDER BY CASE provider WHEN 'pgy' THEN 0 WHEN 'xiaohongshu' THEN 1 ELSE 2 END LIMIT 1").bind(projectId(project)).first<{id:string;base_url:string;config_json:string}>();
  const config = JSON.parse(integration?.config_json || '{}');
  const account = integration ? await db().prepare('SELECT id,external_id,metadata_json FROM source_accounts WHERE id=? AND project_id=? AND integration_id=?').bind(String(config.accountId || ''),projectId(project),integration.id).first<{id:string;external_id:string;metadata_json:string}>() : null;
  const meta = JSON.parse(account?.metadata_json || '{}'), object = String(config.cookieObject || 'KOL/token.txt');
  if (!integration?.base_url || !account || !['xiaohongshu','xhs','pgy'].includes(meta.platform) || !account.external_id) {
    throw new Error('本项目指定评论账号、接口或独立Cookie对象未配置');
  }
  const pool = await cookiePool(project, object);
  // Explicit matching: locate the entry where customerClientId or userId matches the bound external_id
  const matched = pool.filter(c => String(c.customerClientId || c.userId || '') === String(account.external_id));
  if (matched.length === 0) {
    throw new Error(`在凭据池中未匹配到指定账号 (customerClientId: ${account.external_id})，未尝试任意Cookie`);
  }
  if (matched.length > 1) {
    throw new Error(`在凭据池中匹配到多个相同账号凭据 (customerClientId: ${account.external_id})，未尝试任意Cookie`);
  }
  const cookies = matched[0];
  const cookie = Object.entries(cookies).map(([key,value])=>`${key}=${value}`).join('; ');
  const paths = {
    detail: String(config.detailPath || '/api/solar/note/{noteId}/detail?bizCode='),
    roots: String(config.l1Path || '/api/solar/note/{noteId}/l1Comments'),
    replies: String(config.l2Path || '/api/solar/note/{noteId}/l2Comments'),
  };
  const base = new URL(integration.base_url);
  if (!['https:','http:'].includes(base.protocol) || base.username || base.password) throw new Error('评论接口地址无效');
  return {
    async read(kind: keyof typeof paths, noteId: string, query: Record<string, string> = {}) {
      const url = new URL(integration.base_url.replace(/\/$/,'') + paths[kind].replace('{noteId}', encodeURIComponent(noteId)));
      Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
      return requestJson(url.toString(), {
        headers: {
          Cookie: cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          Referer: 'https://pgy.xiaohongshu.com/',
        }
      }, 30);
    },
    pageSize: 100,
  };
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

export function mapSolarComment(noteId: string, value: Record<string, unknown>, depth: 1 | 2, userMap: Record<string, Record<string, unknown>> = {}, parentId?: string): FetchedComment {
  const rawUserId = String(value.userIdStr || value.userId || '');
  const userInfo = userMap[rawUserId] || (value.user || value.author || {}) as Record<string, unknown>;
  const nickname = String(userInfo.userNickName || userInfo.nickname || userInfo.nickName || userInfo.name || '');
  return {
    id: idOf(value) || `${noteId}-${depth}-${String(value.createTime || '')}-${String(value.content || '').slice(0, 12)}`,
    noteId,
    parentId,
    content: String(value.content || ''),
    author: nickname,
    createdAt: String(value.createTime || ''),
    replyCount: Number(value.subCommentCount || 0),
    depth,
  };
}

function mapComment(noteId: string, value: Record<string, unknown>, depth: 1 | 2, parentId?: string): FetchedComment {
  return mapSolarComment(noteId, value, depth, {}, parentId);
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
    const userMap = (item.userMap || {}) as Record<string, Record<string, unknown>>;
    const parentId = idOf(l1);
    comments.push(mapSolarComment(noteId, l1, 1, userMap));
    const l2: Array<Record<string, unknown>> = [];
    const l2Seen = new Set<string>();
    for (const child of (item.l1L2Comments || []) as Array<Record<string, unknown>>) {
      const id = idOf(child); if (id && !l2Seen.has(id)) { l2Seen.add(id); l2.push(child); }
    }
    const expected = Number(l1.subCommentCount || 0);
    let l2Offset = l2.length ? idOf(l2.at(-1)) : '';
    let l2UserMap = userMap;
    while (parentId && l2.length < expected) {
      const url = new URL(`${config.baseUrl.replace(/\/$/, '')}${config.l2Path.replace('{noteId}',noteId)}`);
      url.searchParams.set('offset', l2Offset);
      url.searchParams.set('l1CommentId', parentId);
      url.searchParams.set('pageSize', String(config.l2PageSize));
      const data = await requestJson(url.toString(), { headers }, config.timeout);
      const batch = (data.l2Comments || []) as Array<Record<string, unknown>>;
      if (data.userMap) l2UserMap = { ...l2UserMap, ...(data.userMap as Record<string, Record<string, unknown>>) };
      if (!batch.length) break;
      let added = 0;
      for (const child of batch) {
        const id = idOf(child); if (id && !l2Seen.has(id)) { l2Seen.add(id); l2.push(child); added += 1; }
      }
      const next = idOf(batch.at(-1));
      if (!added || !next || next === l2Offset) break;
      l2Offset = next;
    }
    for (const child of l2) comments.push(mapSolarComment(noteId, child, 2, l2UserMap, parentId));
  }
  return { noteId, reportedL1, fetchedL1: l1Items.length, fetchedL2: comments.filter((c) => c.depth === 2).length, comments };
}

export async function searchNotes(keyword: string, startDate: string, endDate: string, maxPages = 3, project = DEFAULT_PROJECT_ID, options: { cooperNote?: number; pageSize?: number } = {}) {
  const config = await settings(project);
  const cookies = await cookiePool(project);
  const cookie = Object.entries(cookies[0]).map(([key, value]) => `${key}=${value}`).join('; ');
  const headers = { Cookie: cookie, 'Content-Type': 'application/json;charset=UTF-8', Origin: 'https://pgy.xiaohongshu.com', Referer: 'https://pgy.xiaohongshu.com/solar/creative/content', 'User-Agent': 'Mozilla/5.0' };
  const notes: Array<Record<string, unknown>> = [];
  let total = 0;
  const pageSize = Math.max(1, Math.min(60, options.pageSize || config.searchPageSize));
  const cooperNote = options.cooperNote ?? 0;
  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    if (pageNum > 1) await new Promise(resolve => setTimeout(resolve, 1200));
    const data = await requestJson(`${config.baseUrl.replace(/\/$/, '')}${config.searchPath}`, {
      method: 'POST', headers, body: JSON.stringify({ searchWord: keyword, pageSize, pageNum, ...(cooperNote >= 0 ? { cooperNote } : {}), notePublishTimeStart: `${startDate} 00:00:00`, notePublishTimeEnd: `${endDate} 23:59:59`, sorts: [{ column: 'hot', sort: 'desc' }] }),
    }, config.timeout);
    total = Number(data.total || total);
    if (!Array.isArray(data.noteList)) throw new Error('Invalid searchNote response');
    const batch = data.noteList as Array<Record<string, unknown>>;
    notes.push(...batch);
    if (!batch.length || batch.length < pageSize || (total > 0 && notes.length >= total)) break;
  }
  return { keyword, total, fetched: notes.length, notes };
}
