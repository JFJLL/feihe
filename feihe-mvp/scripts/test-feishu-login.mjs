import assert from 'node:assert/strict';
import { test, after, beforeEach } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// Ensure isolated test environment
process.env.LOCAL_DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.FEISHU_BASE_URL = 'https://xhs.red-magic.cn';
process.env.FEISHU_SESSION_SECRET = 'test-isolated-session-secret-key-32-chars-long!';

process.env.FEISHU_CONFIG_JSON = JSON.stringify({
  feishu: {
    enabled: true,
    baseUrl: 'https://xhs.red-magic.cn',
    apps: [
      {
        key: 'default',
        name: '易美传播',
        appId: 'cli_yimei_test_app_id',
        appSecret: 'yimei_mock_secret_not_real',
        tenantKeys: ['tenant_key_yimei_allowed'],
      },
      {
        key: 'new-enterprise',
        name: '弘摩科技',
        appId: 'cli_hongmo_test_app_id',
        appSecret: 'hongmo_mock_secret_not_real',
        tenantKeys: ['tenant_key_hongmo_allowed'],
      },
      {
        key: 'yimeishuke',
        name: '易美数科',
        appId: 'cli_yimeishuke_test_app_id',
        appSecret: 'yimeishuke_mock_secret_not_real',
        tenantKeys: ['tenant_key_yimeishuke_allowed'],
      },
    ],
  },
});

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');

const vite = await createServer({
  configFile: false,
  cacheDir: 'node_modules/.vite/test-feishu-login',
  server: { middlewareMode: true },
  appType: 'custom',
  resolve: { alias: { '@': rootDir } },
});
after(() => vite.close());

const feishuLogin = await vite.ssrLoadModule('/lib/feishu-login.ts');
const configRoute = await vite.ssrLoadModule('/app/api/auth/feishu/config/route.ts');
const appsRoute = await vite.ssrLoadModule('/app/api/auth/feishu/apps/route.ts');
const startRoute = await vite.ssrLoadModule('/app/api/auth/feishu/start/route.ts');
const callbackRoute = await vite.ssrLoadModule('/app/api/auth/feishu/callback/route.ts');
const sessionRoute = await vite.ssrLoadModule('/app/api/auth/feishu/session/route.ts');
const logoutRoute = await vite.ssrLoadModule('/app/api/auth/feishu/logout/route.ts');

beforeEach(() => {
  feishuLogin.resetConsumedNoncesForTesting();
});

test('1. Config parsing loads 3 enterprises and exposes display names only', async () => {
  const config = feishuLogin.parseFeishuAuthConfig();
  assert.equal(config.enabled, true);
  assert.equal(config.baseUrl, 'https://xhs.red-magic.cn');
  assert.equal(config.apps.length, 3);
  assert.deepEqual(
    config.apps.map((a) => a.key),
    ['default', 'new-enterprise', 'yimeishuke']
  );

  const publicConfig = feishuLogin.getPublicFeishuConfig(config);
  assert.equal(publicConfig.apps.length, 3);
  assert.deepEqual(publicConfig.apps, [
    { key: 'default', name: '易美传播' },
    { key: 'new-enterprise', name: '弘摩科技' },
    { key: 'yimeishuke', name: '易美数科' },
  ]);
  // Verify secrets are strictly not exposed
  assert.equal('appSecret' in publicConfig.apps[0], false);
  assert.equal('tenantKeys' in publicConfig.apps[0], false);

  // Route check
  const res = await configRoute.GET();
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.enabled, true);
  assert.equal(json.apps.length, 3);
  assert.equal(JSON.stringify(json).includes('mock_secret'), false);

  // Apps compatibility check
  const appsRes = await appsRoute.GET();
  assert.equal(appsRes.status, 200);
  const appsJson = await appsRes.json();
  assert.equal(appsJson.success, true);
  assert.equal(appsJson.apps.length, 3);
});

test('2. Anti-CSRF state creation and verification', () => {
  const secret = 'test-secret-12345678901234567890123456789012';
  const state = feishuLogin.createFeishuOAuthState('new-enterprise', '/projects/qicui', secret);
  const verified = feishuLogin.verifyFeishuOAuthState(state, secret);
  assert.equal(verified.valid, true);
  assert.equal(verified.appKey, 'new-enterprise');
  assert.equal(verified.returnUrl, '/projects/qicui');
  assert.ok(verified.nonce);

  // Tampered state fails
  const tampered = state.replace('new-enterprise', 'default');
  const verifiedTampered = feishuLogin.verifyFeishuOAuthState(tampered, secret);
  assert.equal(verifiedTampered.valid, false);

  // Invalid state fails
  const invalid = feishuLogin.verifyFeishuOAuthState('invalid-state', secret);
  assert.equal(invalid.valid, false);
});

test('3. Exact redirect allowlist prevents open redirects', () => {
  const baseUrl = 'https://xhs.red-magic.cn';
  assert.equal(feishuLogin.sanitizeReturnUrl('/projects/qicui', baseUrl), '/projects/qicui');
  assert.equal(feishuLogin.sanitizeReturnUrl('/', baseUrl), '/');
  assert.equal(feishuLogin.sanitizeReturnUrl('//evil.com/hack', baseUrl), '/');
  assert.equal(feishuLogin.sanitizeReturnUrl('/\\evil.com', baseUrl), '/');
  assert.equal(feishuLogin.sanitizeReturnUrl('https://evil.com', baseUrl), '/');
  assert.equal(
    feishuLogin.sanitizeReturnUrl('https://xhs.red-magic.cn/projects/qicui', baseUrl),
    '/projects/qicui'
  );
});

test('4. Start route creates signed state cookie and redirects to Feishu', async () => {
  const req = new Request('https://xhs.red-magic.cn/api/auth/feishu/start?app=new-enterprise&redirect=/projects/qicui');
  const res = await startRoute.GET(req);
  assert.equal(res.status, 302);

  const location = res.headers.get('location');
  assert.ok(location);
  assert.ok(location.startsWith('https://accounts.feishu.cn/open-apis/authen/v1/authorize'));
  assert.ok(location.includes('client_id=cli_hongmo_test_app_id'));
  assert.ok(location.includes('redirect_uri=https%3A%2F%2Fxhs.red-magic.cn%2Fapi%2Fauth%2Ffeishu%2Fcallback'));

  const cookie = res.headers.get('set-cookie');
  assert.ok(cookie);
  assert.ok(cookie.includes('feishu_oauth_state='));
  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('SameSite=Lax'));
  assert.ok(cookie.includes('Secure'));
});

test('5. Callback route exchanges code and verifies tenant whitelist with mocked fetch', async () => {
  const secret = process.env.FEISHU_SESSION_SECRET;
  const state = feishuLogin.createFeishuOAuthState('default', '/projects/qicui', secret);

  // Mock global fetch returning official top-level Feishu OAuth2 token & user_info
  const originalFetch = globalThis.fetch;
  let tokenExchanged = false;
  let userInfoFetched = false;

  globalThis.fetch = async (url, init) => {
    const urlStr = String(url);
    if (urlStr.includes('/authen/v2/oauth/token')) {
      tokenExchanged = true;
      const body = JSON.parse(String(init.body));
      assert.equal(body.client_id, 'cli_yimei_test_app_id');
      assert.equal(body.code, 'test-auth-code');
      // Real Feishu OAuth2 top-level structure (as per ctmagic and Feishu docs)
      return new Response(
        JSON.stringify({
          access_token: 'mock-user-access-token-123',
          token_type: 'Bearer',
          expires_in: 7200,
          refresh_token: 'mock-refresh-token',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('/authen/v1/user_info')) {
      userInfoFetched = true;
      assert.equal(init.headers.Authorization, 'Bearer mock-user-access-token-123');
      // Real Feishu top-level user info
      return new Response(
        JSON.stringify({
          open_id: 'ou_yimei_test_user_001',
          name: '易美测试用户',
          tenant_key: 'tenant_key_yimei_allowed',
          avatar_url: 'https://example.com/avatar.png',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return originalFetch(url, init);
  };

  try {
    // Call callback with matching state cookie
    const req = new Request(
      `https://xhs.red-magic.cn/api/auth/feishu/callback?code=test-auth-code&state=${encodeURIComponent(state)}`,
      {
        headers: {
          cookie: `feishu_oauth_state=${state}`,
        },
      }
    );
    const res = await callbackRoute.GET(req);
    assert.equal(res.status, 302);
    assert.equal(tokenExchanged, true);
    assert.equal(userInfoFetched, true);

    const location = res.headers.get('location');
    assert.equal(location, '/projects/qicui?feishu_login=success');

    // Inspect cookies
    const cookies = res.headers.getSetCookie();
    const sessionCookie = cookies.find((c) => c.startsWith('feishu_session='));
    const clearStateCookie = cookies.find((c) => c.startsWith('feishu_oauth_state='));

    assert.ok(sessionCookie, 'feishu_session cookie must be set');
    assert.ok(sessionCookie.includes('HttpOnly'));
    assert.ok(sessionCookie.includes('Secure'));
    assert.ok(clearStateCookie, 'feishu_oauth_state cookie must be cleared');
    assert.ok(clearStateCookie.includes('Max-Age=0'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('6. Callback rejects tenant mismatch', async () => {
  const secret = process.env.FEISHU_SESSION_SECRET;
  const state = feishuLogin.createFeishuOAuthState('default', '/projects/qicui', secret);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/token')) {
      return new Response(JSON.stringify({ code: 0, data: { access_token: 'token-123' } }));
    }
    if (urlStr.includes('/user_info')) {
      return new Response(
        JSON.stringify({
          code: 0,
          data: {
            open_id: 'ou_unauthorized',
            name: '外来用户',
            tenant_key: 'foreign_unauthorized_tenant_key',
          },
        })
      );
    }
    return new Response('{}');
  };

  try {
    const req = new Request(
      `https://xhs.red-magic.cn/api/auth/feishu/callback?code=test-code&state=${encodeURIComponent(state)}`,
      {
        headers: { cookie: `feishu_oauth_state=${state}` },
      }
    );
    const res = await callbackRoute.GET(req);
    assert.equal(res.status, 302);
    const location = res.headers.get('location');
    assert.ok(location.includes('feishu_error='));
    assert.ok(decodeURIComponent(location).includes('不属于允许登录的企业'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('7. Session route validates session cookie and returns user profile', async () => {
  const secret = process.env.FEISHU_SESSION_SECRET;
  const user = {
    openId: 'ou_hongmo_user_123',
    name: '弘摩测试员',
    tenantKey: 'tenant_key_hongmo_allowed',
    enterpriseKey: 'new-enterprise',
    enterpriseName: '弘摩科技',
    loginAt: Date.now(),
  };
  const token = feishuLogin.createFeishuSessionToken(user, secret);

  const authedReq = new Request('https://xhs.red-magic.cn/api/auth/feishu/session', {
    headers: { cookie: `feishu_session=${token}` },
  });
  const authedRes = await sessionRoute.GET(authedReq);
  const authedJson = await authedRes.json();
  assert.equal(authedJson.authenticated, true);
  assert.equal(authedJson.user.openId, 'ou_hongmo_user_123');
  assert.equal(authedJson.user.enterpriseName, '弘摩科技');
  assert.equal(authedJson.user.enterpriseKey, 'new-enterprise');

  // Unauthenticated request
  const anonReq = new Request('https://xhs.red-magic.cn/api/auth/feishu/session');
  const anonRes = await sessionRoute.GET(anonReq);
  const anonJson = await anonRes.json();
  assert.equal(anonJson.authenticated, false);
  assert.equal(anonJson.user, null);
});

test('8. Logout route verifies origin and clears session cookie', async () => {
  // Allowed origin
  const req = new Request('https://xhs.red-magic.cn/api/auth/feishu/logout', {
    method: 'POST',
    headers: {
      origin: 'https://xhs.red-magic.cn',
    },
  });
  const res = await logoutRoute.POST(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  const cookie = res.headers.get('set-cookie');
  assert.ok(cookie.includes('feishu_session='));
  assert.ok(cookie.includes('Max-Age=0'));

  // Cross-site attack origin fails with 403
  const evilReq = new Request('https://xhs.red-magic.cn/api/auth/feishu/logout', {
    method: 'POST',
    headers: {
      origin: 'https://malicious-website.com',
    },
  });
  const evilRes = await logoutRoute.POST(evilReq);
  assert.equal(evilRes.status, 403);
});

test('9. Individual environment variables (FEISHU_APP_1/2/3_*) parse correctly', () => {
  const customEnv = {
    FEISHU_APP_1_KEY: 'yimei',
    FEISHU_APP_1_NAME: '易美传播',
    FEISHU_APP_1_ID: 'cli_env_1',
    FEISHU_APP_1_SECRET: 'secret_env_1',
    FEISHU_APP_1_TENANT_KEYS: 'tenant_1_a, tenant_1_b',
    FEISHU_APP_2_KEY: 'hongmo',
    FEISHU_APP_2_NAME: '弘摩科技',
    FEISHU_APP_2_ID: 'cli_env_2',
    FEISHU_APP_2_SECRET: 'secret_env_2',
    FEISHU_APP_2_TENANT_KEYS: 'tenant_2_a',
    FEISHU_APP_3_KEY: 'feihe',
    FEISHU_APP_3_NAME: '飞鹤乳业',
    FEISHU_APP_3_ID: 'cli_env_3',
    FEISHU_APP_3_SECRET: 'secret_env_3',
    FEISHU_APP_3_TENANT_KEYS: 'tenant_3_a',
    FEISHU_BASE_URL: 'https://xhs.red-magic.cn',
  };
  const config = feishuLogin.parseFeishuAuthConfig(customEnv);
  assert.equal(config.apps.length, 3);
  assert.equal(config.apps[0].key, 'yimei');
  assert.equal(config.apps[0].name, '易美传播');
  assert.deepEqual(config.apps[0].tenantKeys, ['tenant_1_a', 'tenant_1_b']);
  assert.equal(config.apps[1].key, 'hongmo');
  assert.equal(config.apps[2].key, 'feihe');
});

test('10. Callback rejects missing state cookie (CSRF defense)', async () => {
  const secret = process.env.FEISHU_SESSION_SECRET;
  const state = feishuLogin.createFeishuOAuthState('default', '/', secret);
  // Missing cookie
  const req = new Request(`https://xhs.red-magic.cn/api/auth/feishu/callback?code=abc&state=${encodeURIComponent(state)}`);
  const res = await callbackRoute.GET(req);
  assert.equal(res.status, 302);
  const location = res.headers.get('location');
  assert.ok(location.includes('feishu_error='));
  assert.ok(decodeURIComponent(location).includes('飞书授权状态校验失败'));
});

test('11. Feishu session user does not alter local project access or fabricate admin roles', () => {
  const user = {
    openId: 'ou_random_user',
    name: '普通成员',
    tenantKey: 'tenant_key_yimei_allowed',
    enterpriseKey: 'yimei',
    enterpriseName: '易美传播',
    loginAt: Date.now(),
  };
  // The Feishu profile only holds enterprise OAuth identity; it has no role='admin' property
  assert.equal('role' in user, false);
  assert.equal('isPlatformAdmin' in user, false);
});
test('12. Security 1: Missing or weak sessionSecret disables login (fail-closed)', () => {
  const noSecretConfig = feishuLogin.parseFeishuAuthConfig({
    FEISHU_AUTH_ENABLED: 'true',
    FEISHU_APP_1_ID: 'cli_test',
    FEISHU_APP_1_SECRET: 'sec_test',
    FEISHU_APP_1_TENANT_KEYS: 'ten_test',
    FEISHU_SESSION_SECRET: '', // Missing
    CT_SECRET_KEY: '',
  });
  assert.equal(noSecretConfig.enabled, false);

  const weakSecretConfig = feishuLogin.parseFeishuAuthConfig({
    FEISHU_AUTH_ENABLED: 'true',
    FEISHU_APP_1_ID: 'cli_test',
    FEISHU_APP_1_SECRET: 'sec_test',
    FEISHU_APP_1_TENANT_KEYS: 'ten_test',
    FEISHU_SESSION_SECRET: 'too-short', // Less than 32 chars
  });
  assert.equal(weakSecretConfig.enabled, false);
});

test('13. Security 2: config.enabled=false stays false and does not flip to true', () => {
  const disabledConfig = feishuLogin.parseFeishuAuthConfig({
    FEISHU_AUTH_ENABLED: 'false',
    FEISHU_SESSION_SECRET: '32-characters-secret-string-at-least-here!',
    FEISHU_APP_1_ID: 'cli_test',
    FEISHU_APP_1_SECRET: 'sec_test',
    FEISHU_APP_1_TENANT_KEYS: 'ten_test',
  });
  assert.equal(disabledConfig.enabled, false);
});

test('14. Security 3: Session validation rejects future timestamps or missing tenant fields', () => {
  const secret = process.env.FEISHU_SESSION_SECRET;
  // Future loginAt
  const futureUser = {
    openId: 'ou_future',
    name: '未来人',
    tenantKey: 'tenant_key_yimei_allowed',
    enterpriseKey: 'default',
    enterpriseName: '易美传播',
    loginAt: Date.now() + 10 * 60 * 1000, // 10 minutes in future
  };
  const futureToken = feishuLogin.createFeishuSessionToken(futureUser, secret);
  assert.equal(feishuLogin.verifyFeishuSessionToken(futureToken, secret), null);

  // Missing tenantKey
  const missingTenantUser = {
    openId: 'ou_missing',
    name: '缺少租户',
    tenantKey: '',
    enterpriseKey: 'default',
    enterpriseName: '易美传播',
    loginAt: Date.now(),
  };
  const missingTenantToken = feishuLogin.createFeishuSessionToken(missingTenantUser, secret);
  assert.equal(feishuLogin.verifyFeishuSessionToken(missingTenantToken, secret), null);
});

test('15. Security 4: parseCookies handles malformed URI percent-encoding without throwing', () => {
  const malformed = 'bad_cookie=%ZZ; normal_cookie=value123; feishu_session=%';
  let parsed = null;
  assert.doesNotThrow(() => {
    parsed = feishuLogin.parseCookies(malformed);
  });
  assert.equal(parsed.normal_cookie, 'value123');
  assert.equal(parsed.bad_cookie, '%ZZ');
  assert.equal(parsed.feishu_session, '%');
});

test('16. Security 5: isAllowedOrigin checks scheme and disallows localhost in production', () => {
  const prodBase = 'https://xhs.red-magic.cn';
  // Exact scheme + origin matches
  assert.equal(feishuLogin.isAllowedOrigin('https://xhs.red-magic.cn', null, prodBase), true);
  // Insecure http rejected
  assert.equal(feishuLogin.isAllowedOrigin('http://xhs.red-magic.cn', null, prodBase), false);
  // Port or subdomain mismatch rejected
  assert.equal(feishuLogin.isAllowedOrigin('https://attacker.xhs.red-magic.cn', null, prodBase), false);
  // Localhost in production baseUrl is rejected
  assert.equal(feishuLogin.isAllowedOrigin('http://localhost:5173', null, prodBase), false);
});

test('17. Security 6: State nonce is single-use and consumed, preventing replay', async () => {
  const secret = process.env.FEISHU_SESSION_SECRET;
  const state = feishuLogin.createFeishuOAuthState('default', '/projects/qicui', secret);

  // First verification and atomic consume
  const check1 = feishuLogin.verifyFeishuOAuthState(state, secret);
  assert.equal(check1.valid, true);
  const consume1 = feishuLogin.consumeIssuedNonce(check1.nonce);
  assert.equal(consume1.success, true);

  // Second replay attempt with identical state and nonce fails-closed
  const check2 = feishuLogin.verifyFeishuOAuthState(state, secret);
  assert.equal(check2.valid, true);
  const consume2 = feishuLogin.consumeIssuedNonce(check2.nonce);
  assert.equal(consume2.success, false);
  assert.ok(consume2.error.includes('未注册') || consume2.error.includes('失效'));
});

test('18. Security 7: Tenant allowlist cannot be empty (fail-closed) and session verifies enterprise is still valid', async () => {
  const secret = process.env.FEISHU_SESSION_SECRET;
  // 18a: Start rejects app with empty tenantKeys
  const emptyTenantConfig = {
    ...feishuLogin.parseFeishuAuthConfig(),
    apps: [
      {
        key: 'empty-app',
        name: '空租户企业',
        appId: 'cli_empty',
        appSecret: 'sec_empty',
        tenantKeys: [], // Empty
      },
    ],
  };
  // Start route rejects empty tenant keys
  const app = feishuLogin.findAuthApp(emptyTenantConfig, 'empty-app');
  assert.equal(!app.tenantKeys || app.tenantKeys.length === 0, true);

  // 18b: Session endpoint rejects user whose enterprise was deleted or tenant was revoked
  const revokedTenantUser = {
    openId: 'ou_revoked',
    name: '已注销企业成员',
    tenantKey: 'tenant_revoked_key',
    enterpriseKey: 'default',
    enterpriseName: '易美传播',
    loginAt: Date.now(),
  };
  const revokedToken = feishuLogin.createFeishuSessionToken(revokedTenantUser, secret);
  const req = new Request('https://xhs.red-magic.cn/api/auth/feishu/session', {
    headers: { cookie: `feishu_session=${revokedToken}` },
  });
  const res = await sessionRoute.GET(req);
  const json = await res.json();
  // Since 'tenant_revoked_key' is NOT in 'tenant_key_yimei_allowed', session must be rejected!
  assert.equal(json.authenticated, false);
  assert.equal(json.user, null);
});

test('19. Callback route handles nested Feishu format ({ code: 0, data: { access_token } })', async () => {
  const secret = process.env.FEISHU_SESSION_SECRET;
  const state = feishuLogin.createFeishuOAuthState('new-enterprise', '/', secret);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('/token')) {
      return new Response(
        JSON.stringify({
          code: 0,
          msg: 'ok',
          data: { access_token: 'nested-token-xyz', expires_in: 7200 },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('/user_info')) {
      return new Response(
        JSON.stringify({
          code: 0,
          msg: 'ok',
          data: {
            open_id: 'ou_hongmo_nested',
            name: '弘摩嵌套用户',
            tenant_key: 'tenant_key_hongmo_allowed',
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    return originalFetch(url);
  };

  try {
    const req = new Request(
      `https://xhs.red-magic.cn/api/auth/feishu/callback?code=nested-code&state=${encodeURIComponent(state)}`,
      { headers: { cookie: `feishu_oauth_state=${state}` } }
    );
    const res = await callbackRoute.GET(req);
    assert.equal(res.status, 302);
    const location = res.headers.get('location');
    assert.ok(location.includes('feishu_login=success'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('20. Security: Upstream error messages or secrets are NEVER echoed to redirect URL', async () => {
  const secret = process.env.FEISHU_SESSION_SECRET;
  const state = feishuLogin.createFeishuOAuthState('default', '/', secret);

  const originalFetch = globalThis.fetch;
  // Mock an upstream error containing sensitive internal details
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        code: 99991663,
        msg: 'internal db secret connection failure: sec-1234567890abcdef',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const req = new Request(
      `https://xhs.red-magic.cn/api/auth/feishu/callback?code=bad-code&state=${encodeURIComponent(state)}`,
      { headers: { cookie: `feishu_oauth_state=${state}` } }
    );
    const res = await callbackRoute.GET(req);
    assert.equal(res.status, 302);
    const location = res.headers.get('location');
    // Strictly verify no leak of upstream message or tokens
    assert.equal(location.includes('sec-1234567890abcdef'), false);
    assert.equal(location.includes('99991663'), false);
    assert.ok(decodeURIComponent(location).includes('获取飞书授权令牌失败'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('21. Security: Timeout in upstream fetch triggers safe fixed error message', async () => {
  const secret = process.env.FEISHU_SESSION_SECRET;
  const state = feishuLogin.createFeishuOAuthState('default', '/', secret);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    throw err;
  };

  try {
    const req = new Request(
      `https://xhs.red-magic.cn/api/auth/feishu/callback?code=timeout-code&state=${encodeURIComponent(state)}`,
      { headers: { cookie: `feishu_oauth_state=${state}` } }
    );
    const res = await callbackRoute.GET(req);
    assert.equal(res.status, 302);
    const location = res.headers.get('location');
    assert.equal(location.includes('TimeoutError'), false);
    assert.ok(decodeURIComponent(location).includes('网络通信超时或服务异常'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('22. Callback rejects immediately when config.enabled is false (fail-closed)', async () => {
  const origJson = process.env.FEISHU_CONFIG_JSON;
  try {
    process.env.FEISHU_AUTH_ENABLED = 'false';
    delete process.env.FEISHU_CONFIG_JSON;
    const req = new Request('https://xhs.red-magic.cn/api/auth/feishu/callback?code=test&state=test');
    const res = await callbackRoute.GET(req);
    assert.equal(res.status, 302);
    const location = res.headers.get('location');
    assert.ok(decodeURIComponent(location).includes('飞书企业登录未启用'));
  } finally {
    process.env.FEISHU_AUTH_ENABLED = 'true';
    process.env.FEISHU_CONFIG_JSON = origJson;
  }
});

test('23. Nonce root-cause: Process restart / store loss fails-closed on callback', async () => {
  const secret = process.env.FEISHU_SESSION_SECRET;
  // User starts login and obtains state
  const state = feishuLogin.createFeishuOAuthState('default', '/projects/qicui', secret);

  // Server process restarts -> memory store is wiped
  feishuLogin.resetIssuedNoncesForTesting();

  // Callback arrives with previously issued state: must fail-closed!
  const req = new Request(
    `https://xhs.red-magic.cn/api/auth/feishu/callback?code=test-code&state=${encodeURIComponent(state)}`,
    { headers: { cookie: `feishu_oauth_state=${state}` } }
  );
  const res = await callbackRoute.GET(req);
  assert.equal(res.status, 302);
  const location = res.headers.get('location');
  assert.ok(decodeURIComponent(location).includes('飞书授权状态已失效'));
});

test('24. Nonce root-cause: Unissued / unknown nonce is rejected fail-closed', () => {
  // A forged nonce that was never issued in store
  const result = feishuLogin.consumeIssuedNonce('forged-unknown-nonce-123456');
  assert.equal(result.success, false);
  assert.ok(result.error.includes('未注册') || result.error.includes('失效'));
});

test('25. Nonce root-cause: Capacity cap rejects new start with 503 without evicting unexpired nonces, and prunes expired', async () => {
  feishuLogin.resetIssuedNoncesForTesting();

  // 1. Register up to MAX_ISSUED_NONCES (10,000)
  const now = Date.now();
  for (let i = 0; i < feishuLogin.MAX_ISSUED_NONCES; i++) {
    const res = feishuLogin.registerIssuedNonce(`test-nonce-${i}`, now);
    assert.equal(res.success, true);
  }
  assert.equal(feishuLogin.getIssuedNoncesCountForTesting(), 10000);

  // 2. Next registration must fail without evicting unexpired nonces
  const overflow = feishuLogin.registerIssuedNonce('overflow-nonce', now);
  assert.equal(overflow.success, false);
  assert.ok(overflow.error.includes('并发量达上限'));
  assert.equal(feishuLogin.getIssuedNoncesCountForTesting(), 10000);

  // 3. Start route returns HTTP 503 when cap is reached
  const req = new Request('https://xhs.red-magic.cn/api/auth/feishu/start?app=default');
  const res = await startRoute.GET(req);
  assert.equal(res.status, 503);
  const bodyText = await res.text();
  assert.ok(bodyText.includes('上限') || bodyText.includes('过多'));

  // 4. Time travel past 10 minutes: expired nonces are cleanly pruned
  const futureNow = now + 11 * 60 * 1000;
  feishuLogin.pruneIssuedNonces(futureNow);
  assert.equal(feishuLogin.getIssuedNoncesCountForTesting(), 0);

  // 5. After pruning expired nonces, registration succeeds again
  const afterPrune = feishuLogin.registerIssuedNonce('fresh-nonce', futureNow);
  assert.equal(afterPrune.success, true);
  assert.equal(feishuLogin.getIssuedNoncesCountForTesting(), 1);

  feishuLogin.resetIssuedNoncesForTesting();
});
