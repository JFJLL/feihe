import {
  parseFeishuAuthConfig,
  findAuthApp,
  parseCookies,
  serializeCookie,
  verifyFeishuSessionToken,
  FEISHU_SESSION_COOKIE,
} from '@/lib/feishu-login';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const config = parseFeishuAuthConfig();
  const cookies = parseCookies(request.headers.get('cookie'));
  const sessionToken = cookies[FEISHU_SESSION_COOKIE];

  if (!sessionToken) {
    return Response.json(
      { authenticated: false, user: null },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  }

  const user = verifyFeishuSessionToken(sessionToken, config.sessionSecret);
  if (!user) {
    return Response.json(
      { authenticated: false, user: null },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  }

  // Security rule 7: Verify enterprise is still configured and tenant key is still allowed
  const authApp = findAuthApp(config, user.enterpriseKey);
  if (
    !authApp ||
    !authApp.tenantKeys ||
    authApp.tenantKeys.length === 0 ||
    !authApp.tenantKeys.includes(user.tenantKey)
  ) {
    // Enterprise was removed or tenant revoked -> invalidate session
    const isSecure = config.baseUrl.startsWith('https://');
    const clearCookie = serializeCookie(FEISHU_SESSION_COOKIE, '', {
      maxAge: 0,
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      path: '/',
    });
    return Response.json(
      { authenticated: false, user: null },
      {
        headers: {
          'Set-Cookie': clearCookie,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }

  return Response.json(
    {
      authenticated: true,
      user: {
        openId: user.openId,
        unionId: user.unionId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        tenantKey: user.tenantKey,
        enterpriseKey: authApp.key,
        enterpriseName: authApp.name,
        loginAt: user.loginAt,
      },
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}
