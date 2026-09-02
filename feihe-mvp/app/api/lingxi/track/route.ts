import { apiUser, jsonError } from '@/lib/api-auth';
import { getLingxiTrackData } from '@/lib/lingxi';
import { projectId } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await apiUser())) return jsonError('请先登录', 401);
  const url = new URL(request.url);
  const project = projectId(url.searchParams.get('projectId'));
  const startDate = url.searchParams.get('startDate') || '2026-08-23';
  const endDate = url.searchParams.get('endDate') || '2026-08-30';
  const subMarket = url.searchParams.get('subMarket') || '母婴出行';

  const result = getLingxiTrackData(startDate, endDate, subMarket);
  return Response.json(result);
}
