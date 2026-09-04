import { blobGet, blobPut } from './blob-store';
import { db, ensureSchema } from './db';
import { projectId } from './projects';
import { createNoteDetailFetcher } from './xhs';

type CoverRow = {
  noteId: string;
  sourceUrl: string;
  r2Key: string;
  contentType: string;
  status: string;
  fetchedAt: string | null;
  lastError: string;
};

export type NoteCoverResult = CoverRow & { coverUrl: string; cached: boolean };

const internalUrl = (project: string, noteId: string) =>
  `/api/note-covers?projectId=${encodeURIComponent(project)}&noteId=${encodeURIComponent(noteId)}`;

function firstImage(detail: Record<string, unknown>) {
  const images = Array.isArray(detail.imagesList) ? detail.imagesList : [];
  const first = images.find((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).url === 'string') as Record<string, unknown> | undefined;
  const value = String(first?.url || detail.imageUrl || detail.coverUrl || '');
  return value.startsWith('http://') ? `https://${value.slice(7)}` : value;
}

function extension(contentType: string) {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
}

async function downloadCover(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    headers: { Accept: 'image/avif,image/webp,image/*,*/*' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`封面下载失败 HTTP ${response.status}`);
  const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!contentType.startsWith('image/')) throw new Error(`封面响应类型异常：${contentType}`);
  return { data: await response.arrayBuffer(), contentType };
}

async function existing(project: string, noteId: string) {
  return db().prepare(`SELECT note_id AS noteId,source_url AS sourceUrl,r2_key AS r2Key,content_type AS contentType,
    status,fetched_at AS fetchedAt,last_error AS lastError FROM note_covers WHERE project_id=? AND note_id=?`)
    .bind(project, noteId).first<CoverRow>();
}

async function persistFailure(project: string, noteId: string, message: string) {
  const now = new Date().toISOString();
  await db().prepare(`INSERT INTO note_covers(id,note_id,project_id,status,last_error,updated_at)
    VALUES(?,?,?,'失败',?,?) ON CONFLICT(id) DO UPDATE SET status='失败',last_error=excluded.last_error,updated_at=excluded.updated_at`)
    .bind(`${project}:${noteId}`, noteId, project, message.slice(0, 300), now).run();
}

async function cacheWithFetcher(noteId: string, project: string, fetchDetail: (noteId: string) => Promise<Record<string, unknown>>, force = false): Promise<NoteCoverResult> {
  const cached = await existing(project, noteId);
  if (!force && cached?.status === '已缓存' && cached.r2Key) {
    return { ...cached, coverUrl: internalUrl(project, noteId), cached: true };
  }
  try {
    const detail = await fetchDetail(noteId);
    const sourceUrl = firstImage(detail);
    if (!sourceUrl) throw new Error('笔记详情未返回封面');
    const { data, contentType } = await downloadCover(sourceUrl);
    const r2Key = `projects/${project}/note-covers/${noteId}.${extension(contentType)}`;
    await blobPut(r2Key, data, contentType);
    const now = new Date().toISOString();
    await db().batch([
      db().prepare(`INSERT INTO note_covers(id,note_id,project_id,source_url,r2_key,content_type,status,fetched_at,last_error,updated_at)
        VALUES(?,?,?,?,?,?,'已缓存',?,'',?) ON CONFLICT(id) DO UPDATE SET source_url=excluded.source_url,
        r2_key=excluded.r2_key,content_type=excluded.content_type,status='已缓存',fetched_at=excluded.fetched_at,last_error='',updated_at=excluded.updated_at`)
        .bind(`${project}:${noteId}`, noteId, project, sourceUrl, r2Key, contentType, now, now),
      db().prepare(`INSERT INTO note_profiles(note_id,cover_url,updated_at) VALUES(?,?,?)
        ON CONFLICT(note_id) DO UPDATE SET cover_url=excluded.cover_url,updated_at=excluded.updated_at`)
        .bind(noteId, internalUrl(project, noteId), now),
    ]);
    return { noteId, sourceUrl, r2Key, contentType, status: '已缓存', fetchedAt: now, lastError: '', coverUrl: internalUrl(project, noteId), cached: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : '封面抓取失败';
    await persistFailure(project, noteId, message);
    throw new Error(`${noteId}: ${message}`);
  }
}

export async function cacheNoteCovers(noteIds: string[], rawProject?: string, limit = 12) {
  await ensureSchema();
  const project = projectId(rawProject);
  const ids = [...new Set(noteIds.filter((id) => /^[0-9a-f]{24}$/i.test(id)))].slice(0, limit);
  if (!ids.length) return [] as NoteCoverResult[];
  const fetchDetail = await createNoteDetailFetcher(project);
  const results: NoteCoverResult[] = [];
  for (let index = 0; index < ids.length; index += 2) {
    const batch = await Promise.allSettled(ids.slice(index, index + 2).map((id) => cacheWithFetcher(id, project, fetchDetail)));
    for (const item of batch) if (item.status === 'fulfilled') results.push(item.value);
  }
  return results;
}

export async function getNoteCover(project: string, noteId: string) {
  await ensureSchema();
  const proj = projectId(project);
  const row = await existing(proj, noteId);
  if (!row?.r2Key || row.status !== '已缓存') {
    const profile = await db().prepare('SELECT cover_url AS coverUrl FROM note_profiles WHERE note_id=?').bind(noteId).first<{ coverUrl?: string }>();
    const rawSource = profile?.coverUrl;
    if (rawSource && rawSource.startsWith('http')) {
      const sourceUrl = rawSource.startsWith('http://') ? 'https://' + rawSource.slice(7) : rawSource;
      try {
        const { data, contentType } = await downloadCover(sourceUrl);
        const r2Key = 'projects/' + proj + '/note-covers/' + noteId + '.' + extension(contentType);
        try { await blobPut(r2Key, data, contentType); } catch {}
        const now = new Date().toISOString();
        try {
          await db().prepare(`INSERT INTO note_covers(id,note_id,project_id,source_url,r2_key,content_type,status,fetched_at,last_error,updated_at)
            VALUES(?,?,?,?,?,?,'已缓存',?,'',?) ON CONFLICT(id) DO UPDATE SET source_url=excluded.source_url,
            r2_key=excluded.r2_key,content_type=excluded.content_type,status='已缓存',fetched_at=excluded.fetched_at,last_error='',updated_at=excluded.updated_at`)
            .bind(proj + ':' + noteId, noteId, proj, sourceUrl, r2Key, contentType, now, now).run();
        } catch {}
        return {
          object: {
            body: data,
            contentType,
            etag: data.byteLength + '-' + Math.round(Date.now() / 1000),
          },
          row: {
            noteId,
            sourceUrl,
            r2Key,
            contentType,
            status: '已缓存',
            fetchedAt: now,
            lastError: '',
          },
        };
      } catch {}
    }
    return null;
  }
  if (!row?.r2Key || row.status !== '已缓存') return null;
  const object = await blobGet(row.r2Key);
  if (object) return { object, row };
  if (!row.sourceUrl) return null;
  try {
    const { data, contentType } = await downloadCover(row.sourceUrl);
    try {
      await blobPut(row.r2Key, data, contentType);
    } catch {
      // Still serve the repaired image when the local cache directory is read-only.
    }
    return {
      object: {
        body: data,
        contentType,
        etag: data.byteLength + '-' + Math.round(Date.now() / 1000),
      },
      row,
    };
  } catch {
    return null;
  }
}
