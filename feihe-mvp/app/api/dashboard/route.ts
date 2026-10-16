import { requireProjectAccess, apiUser, jsonError } from '@/lib/api-auth';
import { ensureSchema } from '@/lib/db';

import { readProjectDashboard } from '@/lib/project-dashboard';

export const dynamic = 'force-dynamic';


type CacheEntry = { json: string; timestamp: number };
const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 120_000;

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const rawProject = params.get('projectId');
    const access = typeof requireProjectAccess === 'function'
      ? await requireProjectAccess(request, rawProject, 'read')
      : (await apiUser() ? { ok: true, status: 200, error: '', context: { projectId: String(rawProject || 'qicui'), user: { userId: 'admin' } } } : { ok: false, status: 401, error: '请先登录' });
    if (!access.ok) return jsonError(access.error!, access.status!);
    const project = access.context!.projectId;

    await ensureSchema();
    const fresh = params.get('fresh') === '1' || Boolean(params.get('_t'));
    const cleanParams = new URLSearchParams(params);
    cleanParams.delete('fresh');
    cleanParams.delete('_t');
    const userId = access.context?.user?.userId || 'admin';
    const cacheKey = `dash:${userId}:${project}:${cleanParams.toString()}`;

   if (fresh) {
     for (const k of memoryCache.keys()) {
       if (k.startsWith(`dash:${project}:`)) {
         memoryCache.delete(k);
       }
     }
   } else {
   const cached = memoryCache.get(cacheKey);
   if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
     return new Response(cached.json, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=180',
          'X-Cache': 'HIT',
        },
      });
    }
   }

    const payload = await readProjectDashboard(project, params, fresh);

    const jsonStr = JSON.stringify(payload);
    memoryCache.set(cacheKey, { json: jsonStr, timestamp: Date.now() });

    return new Response(jsonStr, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=180',
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    console.error('api/dashboard error:', err);
    return jsonError(err instanceof Error ? err.message : '数据接口处理失败', 500);
  }
}
