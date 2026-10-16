import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import crypto from 'node:crypto';
import path from 'node:path';
import { createServer } from 'vite';
import { buildDevEnvironment } from './dev.mjs';

const isLiveSmoke = process.argv.includes('--live') || process.env.TEST_LIVE_DB === '1';

if (!isLiveSmoke) {
  process.env.LOCAL_DB_PATH = ':memory:';
  process.env.LOCAL_DB_NO_SEED = 'true';
} else {
  delete process.env.LOCAL_DB_PATH;
  delete process.env.LOCAL_DB_NO_SEED;
}

// Use actual Vite server to load the real plugin from vite.config.ts and real auth verification from lib/api-auth.ts
const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  resolve: { alias: { '@': path.resolve('.') } },
});
after(() => vite.close());

const { devAuthGatewayPlugin } = await vite.ssrLoadModule('/vite.config.ts');
const { getAuthenticatedUser } = await vite.ssrLoadModule('/lib/api-auth.ts');
const TEST_SECRET = 'test-local-dev-secret-32-bytes-long!';

function setupMockServer(listenAddress = '127.0.0.1') {
  let registeredMiddleware = null;
  const plugin = devAuthGatewayPlugin();
  plugin.configureServer({
    httpServer: {
      address: () => ({ address: listenAddress, port: 5173 }),
    },
    middlewares: {
      use: (fn) => {
        registeredMiddleware = fn;
      },
    },
  });
  return registeredMiddleware;
}

function executeMiddleware(middleware, options = {}) {
  const headers = { ...(options.headers || {}) };
  const req = {
    headers,
    socket: {
      remoteAddress: options.remoteAddress ?? '127.0.0.1',
    },
  };
  let nextCalled = false;
  middleware(req, {}, () => {
    nextCalled = true;
  });
  return { req, nextCalled, headers: req.headers };
}

test('dev runner: buildDevEnvironment generates secret in dev, preserves and never replaces company key in prod', () => {
  // 1. Normal local dev: generates devLocalSecret and defaults gateway secret to it
  const devEnv = buildDevEnvironment({ NODE_ENV: 'development' }, {});
  assert.ok(devEnv.FEIHE_DEV_LOCAL_SECRET);
  assert.equal(devEnv.FEIHE_DEV_LOCAL_SECRET.length, 64);
  assert.equal(devEnv.FEIHE_AUTH_GATEWAY_SECRET, devEnv.FEIHE_DEV_LOCAL_SECRET);

  // 2. Production auth required: MUST NOT set dev secret, and MUST preserve company gateway key
  const prodEnvWithKey = buildDevEnvironment({
    REQUIRE_PROD_AUTH: 'true',
    FEIHE_AUTH_GATEWAY_SECRET: 'real-company-gateway-key-secret-123',
  }, {});
  assert.equal(prodEnvWithKey.FEIHE_DEV_LOCAL_SECRET, undefined);
  assert.equal(prodEnvWithKey.FEIHE_AUTH_GATEWAY_SECRET, 'real-company-gateway-key-secret-123');

  // 3. NODE_ENV=production without gateway key: MUST NOT inject any dev secret
  const prodEnvNoKey = buildDevEnvironment({
    NODE_ENV: 'production',
  }, {});
  assert.equal(prodEnvNoKey.FEIHE_DEV_LOCAL_SECRET, undefined);
  assert.equal(prodEnvNoKey.FEIHE_AUTH_GATEWAY_SECRET, undefined);
});

test('dev auth: loopback request with dev runner secret receives valid HMAC gateway identity', async () => {
  process.env.FEIHE_DEV_LOCAL_SECRET = TEST_SECRET;
  process.env.FEIHE_AUTH_GATEWAY_SECRET = TEST_SECRET;
  delete process.env.REQUIRE_PROD_AUTH;
  delete process.env.NODE_ENV;
  delete process.env.FEIHE_DEV_USER_ID;

  const middleware = setupMockServer('127.0.0.1');
  const { headers, nextCalled } = executeMiddleware(middleware, {
    headers: { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173', 'sec-fetch-site': 'same-origin' },
    remoteAddress: '127.0.0.1',
  });

  assert.equal(nextCalled, true);
  assert.equal(headers['x-feihe-user-id'], 'user-editor');
  assert.equal(headers['x-feihe-dev-mode'], '1');
  assert.match(headers['x-feihe-auth-timestamp'], /^\d{13}$/);
  assert.match(headers['x-feihe-auth-signature'], /^[a-f0-9]{64}$/);

  // Real HMAC signature verification via lib/api-auth.ts
  const req = new Request('http://127.0.0.1:5173/api/projects', {
    headers: new Headers(headers),
  });
  const user = await getAuthenticatedUser(req);
  assert.ok(user, 'User should be authenticated');
  assert.equal(user.userId, 'user-editor');
  assert.equal(user.role, 'user');
});

test('dev auth: client forged identity headers are stripped and overridden on loopback', async () => {
  process.env.FEIHE_DEV_LOCAL_SECRET = TEST_SECRET;
  process.env.FEIHE_AUTH_GATEWAY_SECRET = TEST_SECRET;
  delete process.env.REQUIRE_PROD_AUTH;
  delete process.env.NODE_ENV;

  const middleware = setupMockServer('127.0.0.1');
  const forgedHeaders = {
    host: 'localhost:5173',
    origin: 'http://localhost:5173',
    'x-feihe-user-id': 'user-admin',
    'x-user-id': 'user-admin',
    'x-feihe-auth-signature': '0000000000000000000000000000000000000000000000000000000000000000',
    'x-unauthenticated': '1',
  };
  const { headers } = executeMiddleware(middleware, {
    headers: forgedHeaders,
    remoteAddress: '127.0.0.1',
  });

  // Caller-supplied forged user-admin must be replaced by trusted user-editor
  assert.equal(headers['x-feihe-user-id'], 'user-editor');
  assert.equal(headers['x-user-id'], undefined);
  assert.equal(headers['x-unauthenticated'], undefined);

  const req = new Request('http://localhost:5173/api/projects', {
    headers: new Headers(headers),
  });
  const user = await getAuthenticatedUser(req);
  assert.ok(user);
  assert.equal(user.userId, 'user-editor');
});

test('dev auth: cross-site Origin (CSRF attack) is denied loopback identity injection', async () => {
  process.env.FEIHE_DEV_LOCAL_SECRET = TEST_SECRET;
  process.env.FEIHE_AUTH_GATEWAY_SECRET = TEST_SECRET;
  delete process.env.REQUIRE_PROD_AUTH;
  delete process.env.NODE_ENV;

  const middleware = setupMockServer('127.0.0.1');
  const { headers } = executeMiddleware(middleware, {
    headers: { host: '127.0.0.1:5173', origin: 'http://evil.com' },
    remoteAddress: '127.0.0.1',
  });

  assert.equal(headers['x-feihe-user-id'], undefined);
  assert.equal(headers['x-feihe-auth-signature'], undefined);
  assert.equal(headers['x-feihe-dev-mode'], undefined);

  const req = new Request('http://127.0.0.1:5173/api/projects', {
    headers: new Headers(headers),
  });
  const user = await getAuthenticatedUser(req);
  assert.equal(user, null, 'Cross-site origin must not be authenticated');
});

test('dev auth: Sec-Fetch-Site cross-site request is denied loopback identity injection', async () => {
  process.env.FEIHE_DEV_LOCAL_SECRET = TEST_SECRET;
  process.env.FEIHE_AUTH_GATEWAY_SECRET = TEST_SECRET;
  delete process.env.REQUIRE_PROD_AUTH;
  delete process.env.NODE_ENV;

  const middleware = setupMockServer('127.0.0.1');
  const { headers } = executeMiddleware(middleware, {
    headers: { host: '127.0.0.1:5173', 'sec-fetch-site': 'cross-site' },
    remoteAddress: '127.0.0.1',
  });

  assert.equal(headers['x-feihe-user-id'], undefined);
  assert.equal(headers['x-feihe-auth-signature'], undefined);
  assert.equal(headers['x-feihe-dev-mode'], undefined);

  const req = new Request('http://127.0.0.1:5173/api/projects', {
    headers: new Headers(headers),
  });
  const user = await getAuthenticatedUser(req);
  assert.equal(user, null, 'Sec-Fetch-Site cross-site must not be authenticated');
});

test('dev auth: LAN / non-loopback remote address is denied identity injection', async () => {
  process.env.FEIHE_DEV_LOCAL_SECRET = TEST_SECRET;
  process.env.FEIHE_AUTH_GATEWAY_SECRET = TEST_SECRET;
  delete process.env.REQUIRE_PROD_AUTH;
  delete process.env.NODE_ENV;

  const middleware = setupMockServer('127.0.0.1');
  const { headers } = executeMiddleware(middleware, {
    headers: { host: '127.0.0.1:5173', 'x-feihe-user-id': 'user-admin' },
    remoteAddress: '192.168.1.100', // LAN IP
  });

  assert.equal(headers['x-feihe-user-id'], undefined);
  assert.equal(headers['x-feihe-auth-signature'], undefined);
  assert.equal(headers['x-feihe-dev-mode'], undefined);

  const req = new Request('http://127.0.0.1:5173/api/projects', {
    headers: new Headers(headers),
  });
  const user = await getAuthenticatedUser(req);
  assert.equal(user, null, 'LAN request without signed headers must be unauthenticated');
});

test('dev auth: forged Host header from non-loopback domain is denied identity injection', async () => {
  process.env.FEIHE_DEV_LOCAL_SECRET = TEST_SECRET;
  process.env.FEIHE_AUTH_GATEWAY_SECRET = TEST_SECRET;
  delete process.env.REQUIRE_PROD_AUTH;
  delete process.env.NODE_ENV;

  const middleware = setupMockServer('127.0.0.1');
  const { headers } = executeMiddleware(middleware, {
    headers: { host: 'internal-portal.corp.com:5173' },
    remoteAddress: '127.0.0.1',
  });

  assert.equal(headers['x-feihe-user-id'], undefined);
  assert.equal(headers['x-feihe-auth-signature'], undefined);
  assert.equal(headers['x-feihe-dev-mode'], undefined);

  const req = new Request('http://internal-portal.corp.com:5173/api/projects', {
    headers: new Headers(headers),
  });
  const user = await getAuthenticatedUser(req);
  assert.equal(user, null, 'Forged host must be unauthenticated');
});

test('dev auth: when disabled in production, legitimate company gateway signatures are preserved', async () => {
  process.env.FEIHE_AUTH_GATEWAY_SECRET = TEST_SECRET;
  process.env.REQUIRE_PROD_AUTH = 'true';
  delete process.env.FEIHE_DEV_LOCAL_SECRET;

  // Generate a valid gateway signature for user-editor
  const timestamp = String(Date.now());
  const validSig = crypto.createHmac('sha256', TEST_SECRET).update(`user-editor\n${timestamp}`).digest('hex');
  const gatewayHeaders = {
    host: '127.0.0.1:5173',
    'x-feihe-user-id': 'user-editor',
    'x-feihe-auth-timestamp': timestamp,
    'x-feihe-auth-signature': validSig,
  };

  const middleware = setupMockServer('127.0.0.1');
  const { headers } = executeMiddleware(middleware, {
    headers: gatewayHeaders,
    remoteAddress: '127.0.0.1',
  });

  // Crucial: The middleware MUST NOT strip legitimate gateway headers when disabled in production!
  assert.equal(headers['x-feihe-user-id'], 'user-editor');
  assert.equal(headers['x-feihe-auth-signature'], validSig);

  // Verify real company gateway verification succeeds
  const req = new Request('http://127.0.0.1:5173/api/projects', {
    headers: new Headers(headers),
  });
  const user = await getAuthenticatedUser(req);
  assert.ok(user, 'Legitimate gateway signature must be verified successfully in production');
  assert.equal(user.userId, 'user-editor');
  delete process.env.REQUIRE_PROD_AUTH;
});

test('dev auth: direct start without dev runner secret does not inject dev credentials', async () => {
  delete process.env.FEIHE_DEV_LOCAL_SECRET;
  process.env.FEIHE_AUTH_GATEWAY_SECRET = TEST_SECRET;
  delete process.env.REQUIRE_PROD_AUTH;
  delete process.env.NODE_ENV;

  const middleware = setupMockServer('127.0.0.1');
  const { headers } = executeMiddleware(middleware, {
    headers: { host: '127.0.0.1:5173' },
    remoteAddress: '127.0.0.1',
  });

  assert.equal(headers['x-feihe-user-id'], undefined);
  assert.equal(headers['x-feihe-auth-signature'], undefined);
  assert.equal(headers['x-feihe-dev-mode'], undefined);

  const req = new Request('http://127.0.0.1:5173/api/projects', {
    headers: new Headers(headers),
  });
  const user = await getAuthenticatedUser(req);
  assert.equal(user, null, 'Direct start without runner secret must be unauthenticated');
});

test('dev auth: non-loopback server listener (0.0.0.0) disables dev gateway injection', async () => {
  process.env.FEIHE_DEV_LOCAL_SECRET = TEST_SECRET;
  process.env.FEIHE_AUTH_GATEWAY_SECRET = TEST_SECRET;
  delete process.env.REQUIRE_PROD_AUTH;
  delete process.env.NODE_ENV;

  const middleware = setupMockServer('0.0.0.0'); // listening on all interfaces
  const { headers } = executeMiddleware(middleware, {
    headers: { host: '127.0.0.1:5173' },
    remoteAddress: '127.0.0.1',
  });

  assert.equal(headers['x-feihe-user-id'], undefined);
  assert.equal(headers['x-feihe-auth-signature'], undefined);
  assert.equal(headers['x-feihe-dev-mode'], undefined);

  const req = new Request('http://127.0.0.1:5173/api/projects', {
    headers: new Headers(headers),
  });
  const user = await getAuthenticatedUser(req);
  assert.equal(user, null, 'Non-loopback listener must be unauthenticated');
});

test('dev auth: rawHeaders is synchronized with injected HMAC signature', async () => {
  process.env.FEIHE_DEV_LOCAL_SECRET = TEST_SECRET;
  process.env.FEIHE_AUTH_GATEWAY_SECRET = TEST_SECRET;
  delete process.env.REQUIRE_PROD_AUTH;
  delete process.env.NODE_ENV;

  const middleware = setupMockServer('127.0.0.1');
  const rawHeaders = ['Host', '127.0.0.1:5173', 'User-Agent', 'TestRunner', 'x-feihe-user-id', 'spoofed'];
  const req = {
    headers: { host: '127.0.0.1:5173', 'user-agent': 'TestRunner', 'x-feihe-user-id': 'spoofed' },
    rawHeaders,
    socket: { remoteAddress: '127.0.0.1' },
  };
  middleware(req, {}, () => {});

  assert.equal(req.headers['x-feihe-user-id'], 'user-editor');
  assert.ok(Array.isArray(req.rawHeaders));
  assert.ok(req.rawHeaders.includes('x-feihe-user-id'));
  const valIdx = req.rawHeaders.indexOf('x-feihe-user-id') + 1;
  assert.equal(req.rawHeaders[valIdx], 'user-editor');
  assert.ok(req.rawHeaders.includes('x-feihe-auth-signature'));
});

if (isLiveSmoke) {
  test('live smoke: business daily and reports read real data/local.db with sourceVersions and 13 amounts', async () => {
    const { readDaily } = await vite.ssrLoadModule('/lib/business-daily/store.ts');
    const { db } = await vite.ssrLoadModule('/lib/db.ts');
    const { requireProjectAccess } = await vite.ssrLoadModule('/lib/api-auth.ts');

    // Verify 28 reports in real business_daily_reports table
    const count = await db().prepare("SELECT count(*) as c FROM business_daily_reports WHERE project_id='qicui'").first();
    assert.ok(count, 'Count query must return result');
    assert.equal(count.c, 28, 'Must have exactly 28 business daily reports in main database');

    // Verify readDaily for 2026-10-13 has populated sourceVersions and valid amounts
    const view = await readDaily('qicui', '2026-10-13', 'latest');
    assert.ok(view.sourceVersions.length > 0, 'sourceVersions must not be empty');
    assert.equal(view.sourceVersions.length, 25, 'Must have 25 source versions bound');

    const point = view.series.find(p => p.date === '2026-10-13');
    assert.ok(point, 'Must find 2026-10-13 point');
    assert.equal(point.plan.value, 450000);
    assert.equal(point.adSpend.value, 275326.74);
    assert.equal(point.projectInvestment.value, 326140.74);
    assert.equal(point.creatorCost.value, 36344);
    assert.equal(point.settlement.value, 316608.8978);

    // Verify user-editor access: project editor can read and write without being platform admin
    const timestamp = String(Date.now());
    const sig = crypto.createHmac('sha256', TEST_SECRET).update(`user-editor\n${timestamp}`).digest('hex');
    const dummyReq = new Request('http://127.0.0.1:5173/api/business-daily?projectId=qicui', {
      headers: {
        'x-feihe-user-id': 'user-editor',
        'x-feihe-auth-timestamp': timestamp,
        'x-feihe-auth-signature': sig,
      },
    });
    const access = await requireProjectAccess(dummyReq, 'qicui', 'read');
    assert.equal(access.ok, true);
    assert.equal(access.context.projectRole, 'editor');
    assert.equal(access.context.canWrite, true);
    assert.equal(access.context.isPlatformAdmin, false);
  });
} else {
  test('node runtime isolated: project editor access and store queries run without cloudflare worker bindings', async () => {
    const { requireProjectAccess } = await vite.ssrLoadModule('/lib/api-auth.ts');
    const { ensureBusinessSchema, businessConfig } = await vite.ssrLoadModule('/lib/business-daily/store.ts');
    await ensureBusinessSchema();

    // Verify in-memory isolated database works in Node runtime without workerd DB
    const cfg = await businessConfig('test-project');
    assert.equal(cfg, null);

    const timestamp = String(Date.now());
    const sig = crypto.createHmac('sha256', TEST_SECRET).update(`user-editor\n${timestamp}`).digest('hex');
    const dummyReq = new Request('http://127.0.0.1:5173/api/business-daily?projectId=qicui', {
      headers: {
        'x-feihe-user-id': 'user-editor',
        'x-feihe-auth-timestamp': timestamp,
        'x-feihe-auth-signature': sig,
      },
    });
    const access = await requireProjectAccess(dummyReq, 'qicui', 'read');
    assert.equal(access.ok, true);
    assert.equal(access.context.projectRole, 'editor');
    assert.equal(access.context.canWrite, true);
    assert.equal(access.context.isPlatformAdmin, false);
  });
}
