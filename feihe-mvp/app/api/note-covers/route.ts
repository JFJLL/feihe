import { apiUser, jsonError } from '@/lib/api-auth';
import { cacheNoteCovers, getNoteCover } from '@/lib/note-covers';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await apiUser())) return new Response('请先登录', { status: 401 });
  const params = new URL(request.url).searchParams;
  const project = projectId(params.get('projectId'));
  const noteId = String(params.get('noteId') || '');
  if (!/^[0-9a-f]{24}$/i.test(noteId)) return new Response('笔记 ID 无效', { status: 400 });
  const cached = await getNoteCover(project, noteId);
  if (!cached) return new Response('封面尚未缓存', { status: 404 });
  const headers = new Headers();
  headers.set('content-type', cached.object.contentType);
  headers.set('etag', cached.object.etag);
  headers.set('cache-control', 'public, max-age=86400, stale-while-revalidate=604800');
  return new Response(cached.object.body as BodyInit, { headers });
}

export async function POST(request: Request) {
  if (!(await apiUser(true))) return jsonError('请先登录', 401);
  try {
    const body = await request.json() as { projectId?: string; noteIds?: string[]; limit?: number };
    const results = await cacheNoteCovers(body.noteIds || [], body.projectId, Math.min(20, Math.max(1, Number(body.limit || 12))));
    return Response.json({ ok: true, count: results.length, results });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '封面抓取失败', 500);
  }
}
