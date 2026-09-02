import { getChatGPTUser } from '@/app/chatgpt-auth';
import { env } from 'cloudflare:workers';

export async function apiUser(requireWrite = false) {
  const user = await getChatGPTUser();
  if (user) return user;
  if (process.env.NODE_ENV !== 'production') return { userId: 'local', email: 'local@feihe', displayName: '本地用户', fullName: '本地用户' };
  const runtime = env as unknown as Record<string, string | undefined>;
  if (!requireWrite && (runtime.PUBLIC_SITE_ACCESS || process.env.PUBLIC_SITE_ACCESS) === 'true') {
    return { userId: 'public-viewer', email: '', displayName: '公开访客', fullName: '公开访客' };
  }
  return null;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}
