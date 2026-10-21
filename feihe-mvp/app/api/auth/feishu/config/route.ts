import { parseFeishuAuthConfig, getPublicFeishuConfig } from '@/lib/feishu-login';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = parseFeishuAuthConfig();
  const publicConfig = getPublicFeishuConfig(config);
  return Response.json(publicConfig, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
