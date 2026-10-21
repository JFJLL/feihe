import {
  parseFeishuAuthConfig,
  findAuthApp,
  verifyFeishuOAuthState,
  consumeOAuthNonce,
  createFeishuSessionToken,
  parseCookies,
  serializeCookie,
  sanitizeReturnUrl,
  FEISHU_SESSION_COOKIE,
  FEISHU_STATE_COOKIE,
  type FeishuSessionUser,
} from '@/lib/feishu-login';

export const dynamic = 'force-dynamic';

function errorRedirect(targetPath: string, message: string, isSecure: boolean): Response {
  const safePath = targetPath.startsWith('/') ? targetPath : '/';
  const separator = safePath.includes('?') ? '&' : '?';
  const destination = `${safePath}${separator}feishu_error=${encodeURIComponent(message)}`;

  const clearStateCookie = serializeCookie(FEISHU_STATE_COOKIE, '', {
    maxAge: 0,
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: destination,
      'Set-Cookie': clearStateCookie,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export async function GET(request: Request) {
  const config = parseFeishuAuthConfig();
  const isSecure = config.baseUrl.startsWith('https://');

  // 0. Fail-closed: callback disabled if feishu auth is not enabled
  if (!config.enabled) {
    return errorRedirect('/', '飞书企业登录未启用', isSecure);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error') || url.searchParams.get('error_description');

  // Fixed error messages only: NEVER echo upstream error strings or tokens to the URL
  if (oauthError) {
    return errorRedirect('/', '飞书授权未完成或已被取消', isSecure);
  }
  if (!code) {
    return errorRedirect('/', '飞书授权回调参数不完整', isSecure);
  }
  if (!state) {
    return errorRedirect('/', '飞书授权回调参数不完整', isSecure);
  }

  // 1. Verify state cookie (Anti-CSRF & Browser-binding)
  const cookies = parseCookies(request.headers.get('cookie'));
  const storedState = cookies[FEISHU_STATE_COOKIE];
  if (!storedState || storedState !== state) {
    return errorRedirect('/', '飞书授权状态校验失败，请重新登录', isSecure);
  }

  // 2. Verify state token signature and expiration
  const stateCheck = verifyFeishuOAuthState(state, config.sessionSecret);
  if (!stateCheck.valid || !stateCheck.appKey || !stateCheck.nonce) {
    return errorRedirect('/', '飞书授权状态已失效，请重新登录', isSecure);
  }

  // 2b. Consume state nonce to prevent replay attacks
  const nonceConsumption = consumeOAuthNonce(stateCheck.nonce);
  if (!nonceConsumption.success) {
    return errorRedirect('/', '飞书授权状态已失效，请重新登录', isSecure);
  }

  const safeReturnUrl = sanitizeReturnUrl(stateCheck.returnUrl, config.baseUrl);
  const authApp = findAuthApp(config, stateCheck.appKey);
  if (!authApp) {
    return errorRedirect(safeReturnUrl, '企业登录配置异常，请联系管理员', isSecure);
  }

  const callbackUrl = `${config.baseUrl}/api/auth/feishu/callback`;

  try {
    // 3. Exchange code for user access token with 15s timeout
    const tokenRes = await fetch('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: authApp.appId,
        client_secret: authApp.appSecret,
        code,
        redirect_uri: callbackUrl,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const rawToken = (await tokenRes.json()) as Record<string, unknown>;
    if (!tokenRes.ok || (rawToken.code !== undefined && rawToken.code !== 0)) {
      return errorRedirect(safeReturnUrl, '获取飞书授权令牌失败，请重试', isSecure);
    }

    // Feishu OAuth v2 returns access_token at top level OR under data
    const tokenData = (rawToken.data && typeof rawToken.data === 'object' ? rawToken.data : rawToken) as Record<string, unknown>;
    const userAccessToken = typeof tokenData.access_token === 'string' ? tokenData.access_token : '';
    if (!userAccessToken) {
      return errorRedirect(safeReturnUrl, '获取飞书授权令牌失败，请重试', isSecure);
    }

    // 4. Fetch user info with 15s timeout
    const userRes = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      signal: AbortSignal.timeout(15_000),
    });

    const rawUser = (await userRes.json()) as Record<string, unknown>;
    if (!userRes.ok || (rawUser.code !== undefined && rawUser.code !== 0)) {
      return errorRedirect(safeReturnUrl, '获取飞书用户信息失败，请重试', isSecure);
    }

    // Feishu user_info returns fields under data OR at top level
    const userData = (rawUser.data && typeof rawUser.data === 'object' ? rawUser.data : rawUser) as Record<string, unknown>;
    const openId = typeof userData.open_id === 'string' ? userData.open_id : '';
    const tenantKey = typeof userData.tenant_key === 'string' ? userData.tenant_key : '';
    if (!openId || !tenantKey) {
      return errorRedirect(safeReturnUrl, '飞书用户信息缺失必要凭据', isSecure);
    }

    // 5. Tenant key verification against configured allowed enterprises
    // Security rule: tenant allowlist is mandatory and cannot be empty (fail-closed)
    if (!authApp.tenantKeys || authApp.tenantKeys.length === 0) {
      return errorRedirect(safeReturnUrl, '企业登录配置异常，请联系管理员', isSecure);
    }
    const isAllowedTenant = authApp.tenantKeys.includes(tenantKey);
    if (!isAllowedTenant) {
      return errorRedirect(safeReturnUrl, '当前账号不属于允许登录的企业', isSecure);
    }

    // 6. Build session profile
    const name = typeof userData.name === 'string' ? userData.name : typeof userData.en_name === 'string' ? userData.en_name : '飞书用户';
    const avatarUrl = typeof userData.avatar_url === 'string' ? userData.avatar_url : typeof userData.avatar_thumb === 'string' ? userData.avatar_thumb : undefined;
    const unionId = typeof userData.union_id === 'string' ? userData.union_id : undefined;

    const sessionUser: FeishuSessionUser = {
      openId,
      unionId,
      name,
      avatarUrl,
      tenantKey,
      enterpriseKey: authApp.key,
      enterpriseName: authApp.name,
      loginAt: Date.now(),
    };

    const sessionToken = createFeishuSessionToken(sessionUser, config.sessionSecret);

    // 7. Cookies: set session cookie and clear state cookie
    const sessionCookie = serializeCookie(FEISHU_SESSION_COOKIE, sessionToken, {
      maxAge: 7 * 24 * 60 * 60, // 7 days
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      path: '/',
    });

    const clearStateCookie = serializeCookie(FEISHU_STATE_COOKIE, '', {
      maxAge: 0,
      httpOnly: true,
      secure: isSecure,
      sameSite: 'Lax',
      path: '/',
    });

    const separator = safeReturnUrl.includes('?') ? '&' : '?';
    const redirectTarget = `${safeReturnUrl}${separator}feishu_login=success`;

    const response = new Response(null, {
      status: 302,
      headers: {
        Location: redirectTarget,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
    response.headers.append('Set-Cookie', sessionCookie);
    response.headers.append('Set-Cookie', clearStateCookie);
    return response;
  } catch {
    return errorRedirect(safeReturnUrl, '网络通信超时或服务异常，请重试', isSecure);
  }
}
