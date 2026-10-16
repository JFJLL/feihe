import { requireProjectAccess } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const rawProject = url.searchParams.get('projectId');

  const access = await requireProjectAccess(request, rawProject, 'read');
  if (!access.ok) {
    return new Response(access.error || '无权访问', { status: access.status || 403 });
  }

  const project = access.context!.projectId;
  await ensureSchema();
  const row = await db()
    .prepare('SELECT title, html FROM report_versions WHERE id=? AND project_id=?')
    .bind(id, project)
    .first<{ title: string; html: string }>();

  if (!row) return new Response('报告不存在', { status: 404 });

  const download = url.searchParams.get('download') === '1';
  return new Response(row.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(row.title)}.html`,
      'Cache-Control': 'private, no-store',
    },
  });
}
