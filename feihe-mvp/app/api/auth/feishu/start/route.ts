import {
  parseFeishuAuthConfig,
  findAuthApp,
  sanitizeReturnUrl,
  generateFeishuOAuthState,
  serializeCookie,
  FEISHU_STATE_COOKIE,
} from '@/lib/feishu-login';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const config = parseFeishuAuthConfig();
  if (!config.enabled) {
    return new Response('飞书企业登录未启用', { status: 404 });
  }
  if (!config.apps.length) {
    return new Response('未配置任何飞书企业应用', { status: 500 });
  }

  const url = new URL(request.url);
  const appKey = url.searchParams.get('app');
  const rawRedirect = url.searchParams.get('redirect');

  const authApp = findAuthApp(config, appKey);
  if (!authApp) {
    return new Response('未找到对应的飞书企业应用', { status: 404 });
  }
  if (!authApp.appId) {
    return new Response('该企业的飞书应用 ID 未配置', { status: 500 });
  }
  if (!authApp.tenantKeys || authApp.tenantKeys.length === 0) {
    return new Response('该企业未配置飞书租户白名单 (tenantKeys 不能为空)', { status: 500 });
  }

  const safeReturnUrl = sanitizeReturnUrl(rawRedirect, config.baseUrl);
  const stateResult = generateFeishuOAuthState(authApp.key, safeReturnUrl, config.sessionSecret);
  if (!stateResult.success || !stateResult.state) {
    return new Response(stateResult.error || '登录请求过多，请稍候重试', { status: 503 });
  }
  const state = stateResult.state;
  const callbackUrl = `${config.baseUrl}/api/auth/feishu/callback`;

  const authorizeQuery = new URLSearchParams({
    client_id: authApp.appId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    state,
  });
  const authorizeUrl = `https://accounts.feishu.cn/open-apis/authen/v1/authorize?${authorizeQuery.toString()}`;

  const isSecure = config.baseUrl.startsWith('https://');
  const stateCookie = serializeCookie(FEISHU_STATE_COOKIE, state, {
    maxAge: 600, // 10 minutes
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      'Set-Cookie': stateCookie,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
