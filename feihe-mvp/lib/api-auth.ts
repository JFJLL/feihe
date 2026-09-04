import { getChatGPTUser } from '@/app/chatgpt-auth';
import { envVar } from '@/lib/runtime-env';

export async function apiUser(requireWrite = false) {
  const user = await getChatGPTUser();
  if (user) return user;
  if (process.env.NODE_ENV !== 'production') return { userId: 'local', email: 'local@feihe', displayName: '本地用户', fullName: '本地用户' };
  if (!requireWrite && envVar('PUBLIC_SITE_ACCESS') === 'true') {
    return { userId: 'public-viewer', email: '', displayName: '公开访客', fullName: '公开访客' };
  }
  return null;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}
