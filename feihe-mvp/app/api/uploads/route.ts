import { blobDelete, blobPut } from '@/lib/blob-store';
import { requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return jsonError('请选择文件');
    if (file.size > 25 * 1024 * 1024) return jsonError('单个文件不能超过 25MB');

    const access = await requireProjectAccess(request, form.get('projectId'), 'write');
    if (!access.ok) return jsonError(access.error!, access.status!);
    const project = access.context!.projectId;

    const id = crypto.randomUUID();
    const key = `projects/${project}/agent-assets/${id}/${file.name}`;
    await blobPut(key, await file.arrayBuffer(), file.type || 'application/octet-stream');
    let summary = '{}';
    try {
      summary = JSON.stringify(JSON.parse(String(form.get('summary') || '{}')));
    } catch {}

    await db()
      .prepare(`INSERT INTO uploaded_assets(id,project_id,file_name,content_type,size,r2_key,status,summary_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, project, file.name, file.type || '', file.size, key, '已上传', summary, access.context!.user.userId, new Date().toISOString())
      .run();

    return Response.json({ ok: true, id, fileName: file.name, size: file.size });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '上传失败', 500);
  }
}

export async function DELETE(request: Request) {
  let body: { id?: string; projectId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('无效的请求体');
  }

  const access = await requireProjectAccess(request, body.projectId, 'write');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;

  try {
    await ensureSchema();
    const row = await db()
      .prepare('SELECT r2_key AS r2Key FROM uploaded_assets WHERE id=? AND project_id=?')
      .bind(String(body.id || ''), project)
      .first<{ r2Key: string }>();
    if (!row) return jsonError('文件不存在', 404);

    await blobDelete(row.r2Key);
    await db().prepare('DELETE FROM uploaded_assets WHERE id=? AND project_id=?').bind(String(body.id), project).run();
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '删除失败', 500);
  }
}
