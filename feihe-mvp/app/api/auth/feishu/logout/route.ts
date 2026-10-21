import {
  parseFeishuAuthConfig,
  serializeCookie,
  isAllowedOrigin,
  FEISHU_SESSION_COOKIE,
} from '@/lib/feishu-login';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const config = parseFeishuAuthConfig();
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // CSRF protection: Origin or Referer must match allowed origin
  if (!isAllowedOrigin(origin, referer, config.baseUrl)) {
    return Response.json(
      { success: false, error: '非法的请求来源 (CSRF 校验失败)' },
      { status: 403 }
    );
  }

  const isSecure = config.baseUrl.startsWith('https://');
  const clearCookie = serializeCookie(FEISHU_SESSION_COOKIE, '', {
    maxAge: 0,
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
  });

  return Response.json(
    { success: true },
    {
      headers: {
        'Set-Cookie': clearCookie,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
