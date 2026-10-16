import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { cacheNoteCovers, getNoteCover, resolveNoteCoverUrl, isValidNoteId, isNoteInProject } from '@/lib/note-covers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const access = await requireProjectAccess(request, params.get('projectId'), 'read');
  if (!access.ok) return new Response(access.error || '无权访问', { status: access.status || 403 });
  const project = access.context!.projectId;
  const noteId = String(params.get('noteId') || '');
  if (!isValidNoteId(noteId)) return new Response('笔记 ID 无效', { status: 400 });

  const inProject = await isNoteInProject(project, noteId);
  if (!inProject) return new Response('笔记不属于当前项目', { status: 404, headers: { 'cache-control': 'no-store' } });

  if (params.get('resolve') === '1') {
    try {
      const coverUrl = await resolveNoteCoverUrl(project, noteId);
      if (params.get('format') === 'json') return Response.json({ coverUrl }, { headers: { 'cache-control': 'private, no-store' } });
      return new Response(null, { status: 302, headers: { location: coverUrl, 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' } });
    } catch {
      return new Response('暂未获取到笔记封面', { status: 404, headers: { 'cache-control': 'no-store' } });
    }
  }
  const cached = await getNoteCover(project, noteId);
  if (!cached) return new Response('封面尚未缓存', {
    status: 404,
    headers: { 'cache-control': 'no-store' },
  });
  const headers = new Headers();
  headers.set('content-type', cached.object.contentType);
  headers.set('etag', cached.object.etag);
  headers.set('cache-control', 'public, max-age=86400, stale-while-revalidate=604800');
  return new Response(cached.object.body as BodyInit, { headers });
}

export async function POST(request: Request) {
  let body: { projectId?: string; noteIds?: string[]; limit?: number } = {};
  try { body = await request.json() as typeof body; } catch { return jsonError('无效的请求体'); }
  const access = await requireProjectAccess(request, body.projectId, 'write');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;
  try {
    const results = await cacheNoteCovers(body.noteIds || [], project, Math.min(20, Math.max(1, Number(body.limit || 12))));
    return Response.json({ ok: true, count: results.length, results });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '封面抓取失败', 500);
  }
}
