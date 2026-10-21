import { parseFeishuAuthConfig, getPublicFeishuConfig } from '@/lib/feishu-login';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = parseFeishuAuthConfig();
  const publicConfig = getPublicFeishuConfig(config);
  return Response.json({
    success: true,
    enabled: publicConfig.enabled,
    apps: publicConfig.apps,
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
