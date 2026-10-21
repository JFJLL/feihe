import { blobGet, blobPut, blobDelete } from '@/lib/blob-store';
import { getAuthenticatedUser, requireProjectAccess, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { MAX_LOGO_SIZE, validateLogoFile, detectLogoBufferType, LOGO_KEY_REGEX, parseLogoKey } from '@/lib/project-form';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return new Response('请通过已验证的公司身份入口登录', { status: 401, headers: { 'cache-control': 'no-store' } });
    }

    const url = new URL(request.url);
    const rawKey = url.searchParams.get('key');
    const projectId = url.searchParams.get('projectId');

    let targetKey = rawKey;
    if (!targetKey && projectId) {
      await ensureSchema();
      const row = await db().prepare('SELECT logo_url FROM projects WHERE id=?').bind(projectId).first<{ logo_url: string }>();
      if (row?.logo_url) {
        targetKey = parseLogoKey(row.logo_url);
      }
    }

    if (!targetKey) {
      return new Response('Logo 未找到', { status: 404, headers: { 'cache-control': 'no-store' } });
    }

    // Reject altered paths instead of silently rewriting a requested object key.
    const normalized = targetKey;
    if (!LOGO_KEY_REGEX.test(normalized)) {
      return new Response('非法访问路径', { status: 400 });
    }

    // Authorize caller to access the logo
    if (normalized.startsWith('projects/')) {
      const targetProjectId = normalized.split('/')[1];
      const access = await requireProjectAccess(request, targetProjectId, 'read');
      if (!access.ok) {
        return new Response(access.error || '无权访问该项目的 Logo', { status: access.status || 403, headers: { 'cache-control': 'no-store' } });
      }
    } else if (normalized.startsWith('uploads/logos/')) {
      const uploaderId = normalized.split('/')[2];
      if (caller.userId !== uploaderId && caller.role !== 'platform_admin') {
        await ensureSchema();
        const boundProjects = await db().prepare('SELECT id,logo_url FROM projects WHERE logo_url != ?').bind('').all<{ id: string; logo_url: string }>();
        let authorizedByProject = false;
        for (const p of boundProjects.results) {
          if (parseLogoKey(p.logo_url) !== normalized) continue;
          const access = await requireProjectAccess(request, p.id, 'read');
          if (access.ok) {
            authorizedByProject = true;
            break;
          }
        }
        if (!authorizedByProject) {
          return new Response('无权访问该 Logo 资源', { status: 403, headers: { 'cache-control': 'no-store' } });
        }
      }
    }

    const obj = await blobGet(normalized);
    if (!obj) {
      return new Response('Logo 图片不存在或已过期', { status: 404, headers: { 'cache-control': 'no-store' } });
    }

    // Inspect and bound returned payload bytes using pure Uint8Array (cross-runtime safe)
    const bodyBytes = obj.body instanceof Uint8Array
      ? obj.body
      : obj.body instanceof ArrayBuffer
      ? new Uint8Array(obj.body)
      : ArrayBuffer.isView(obj.body)
      ? new Uint8Array(obj.body.buffer, obj.body.byteOffset, obj.body.byteLength)
      : new Uint8Array(0);

    if (bodyBytes.length > MAX_LOGO_SIZE || bodyBytes.length < 8) {
      return new Response('图片大小超出范围', { status: 400 });
    }
    const sniff = detectLogoBufferType(bodyBytes);
    if (!sniff.valid) {
      return new Response('不支持或不合法的图片内容', { status: 400 });
    }

    const headers = new Headers();
    headers.set('Content-Type', sniff.contentType || 'image/png');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Content-Disposition', 'inline; filename="logo"');
    if (obj.etag) headers.set('ETag', obj.etag);

    return new Response(obj.body as BodyInit, { headers });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : '读取失败', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return jsonError('请通过已验证的公司身份入口登录', 401);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError('无效的表单数据', 400);
    }

    const file = formData.get('file');
    if (!(file instanceof File)) return jsonError('请选择要上传的 Logo 图片', 400);

    if (file.size > MAX_LOGO_SIZE) {
      return jsonError('Logo 图片不能超过 2MB', 400);
    }
    if (file.size < 8) {
      return jsonError('Logo 文件内容过小', 400);
    }

    const fileValidation = validateLogoFile(file);
    if (!fileValidation.valid) {
      return jsonError(fileValidation.error || '不支持的图片格式', 400);
    }

    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > MAX_LOGO_SIZE || buffer.byteLength < 8) {
      return jsonError('Logo 图片大小必须在 8 字节至 2MB 之间', 400);
    }
    const bufferValidation = detectLogoBufferType(buffer);
    if (!bufferValidation.valid) {
      return jsonError(bufferValidation.error || '图片内容无效或包含不被允许的脚本', 400);
    }

    const rawProjectId = String(formData.get('projectId') || '').trim();
    let projectId = '';
    if (rawProjectId) {
      const access = await requireProjectAccess(request, rawProjectId, 'write');
      if (!access.ok) return jsonError(access.error!, access.status!);
      projectId = access.context!.projectId;
    }

    const ext = bufferValidation.contentType === 'image/png'
      ? 'png'
      : bufferValidation.contentType === 'image/webp'
      ? 'webp'
      : bufferValidation.contentType === 'image/gif'
      ? 'gif'
      : 'jpg';

    const fileId = crypto.randomUUID();
    const key = projectId
      ? `projects/${projectId}/logo/${fileId}.${ext}`
      : `uploads/logos/${caller.userId}/${fileId}.${ext}`;

    await blobPut(key, buffer, bufferValidation.contentType || 'image/png');
    const logoUrl = `/api/projects/logo?key=${encodeURIComponent(key)}`;

    return Response.json({
      ok: true,
      logoUrl,
      key,
      contentType: bufferValidation.contentType,
      size: file.size,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Logo 上传失败', 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return jsonError('请通过已验证的公司身份入口登录', 401);

    let body: { key?: string; projectId?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonError('无效的请求数据', 400);
    }

    const rawKey = String(body.key || '').trim();
    if (!rawKey) return jsonError('缺少要删除的文件标识', 400);

    const normalized = rawKey;
    if (!LOGO_KEY_REGEX.test(normalized)) {
      return jsonError('非法文件路径', 400);
    }

    if (normalized.startsWith('uploads/logos/')) {
      const uploaderId = normalized.split('/')[2];
      if (uploaderId !== caller.userId && caller.role !== 'platform_admin') {
        return jsonError('无权删除其他用户的 Logo 资源', 403);
      }
    } else if (normalized.startsWith('projects/')) {
      const targetProjectId = normalized.split('/')[1];
      const access = await requireProjectAccess(request, targetProjectId, 'write');
      if (!access.ok) return jsonError(access.error!, access.status!);
    }

    // Prevent deleting a logo that is currently actively bound to a project
    await ensureSchema();
    const boundProjects = await db().prepare('SELECT logo_url FROM projects WHERE logo_url != ?').bind('').all<{ logo_url: string }>();
    const isBound = boundProjects.results.some(project => parseLogoKey(project.logo_url) === normalized);
    if (isBound) {
      return jsonError('该 Logo 正在被项目使用，不能直接删除', 400);
    }

    await blobDelete(normalized);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '删除失败', 500);
  }
}
