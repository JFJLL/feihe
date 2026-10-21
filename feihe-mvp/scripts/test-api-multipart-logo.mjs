import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Strictly isolate memory DB and temp file storage; never touch real DB or data/files
const testFilesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feihe-api-multipart-'));
Object.assign(process.env, {
  LOCAL_DB_PATH: ':memory:',
  LOCAL_DB_NO_SEED: 'true',
  ENABLE_TEST_AUTH: '1',
  LOCAL_FILES_PATH: testFilesDir,
});

const vite = await createServer({
  configFile: false,
  cacheDir: 'node_modules/.vite/api-multipart-test',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  resolve: { alias: { '@': path.resolve('.') } },
});

const originalFetch = globalThis.fetch;
let lastHeaders = null;

const logoRoute = await vite.ssrLoadModule('/app/api/projects/logo/route.ts');
const { api, ApiError } = await vite.ssrLoadModule('/lib/hooks/use-project-data.ts');
const { ensureSchema } = await vite.ssrLoadModule('/lib/db.ts');
const { isValidLogoUrl, parseLogoKey } = await vite.ssrLoadModule('/lib/project-form.ts');

await ensureSchema();

globalThis.fetch = async (input, init) => {
  const rawUrl = typeof input === 'string' ? input : input.url;
  const targetUrl = rawUrl.startsWith('http') ? rawUrl : 'http://localhost' + rawUrl;
  const req = input instanceof Request ? input : new Request(targetUrl, init);
  lastHeaders = new Headers(req.headers);

  if (rawUrl.includes('/api/projects/logo')) {
    if (req.method === 'POST') return await logoRoute.POST(req);
    if (req.method === 'GET') return await logoRoute.GET(req);
  }
  return new Response(JSON.stringify({ ok: true, echo: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

after(async () => {
  globalThis.fetch = originalFetch;
  await vite.close();
  try {
    fs.rmSync(testFilesDir, { recursive: true, force: true });
  } catch {}
});

const VALID_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

test('api helper FormData: deletes application/json and preserves multipart boundary', async () => {
  const formData = new FormData();
  formData.append('file', new File([VALID_PNG_BYTES], 'avatar.png', { type: 'image/png' }));

  const result = await api('/api/projects/logo', {
    method: 'POST',
    headers: { 'x-user-id': 'user-editor' },
    body: formData,
  });

  assert.equal(result.ok, true);
  assert.ok(isValidLogoUrl(result.logoUrl));
  assert.ok(parseLogoKey(result.logoUrl).startsWith('uploads/logos/user-editor/'));

  // Verify headers passed to fetch
  const contentType = lastHeaders.get('Content-Type');
  assert.ok(contentType, 'Content-Type must exist on multipart request');
  assert.ok(contentType.startsWith('multipart/form-data'), 'Must be multipart/form-data');
  assert.ok(contentType.includes('boundary='), 'Must include multipart boundary parameter');
  assert.notEqual(contentType, 'application/json');
});

test('api helper JSON: retains application/json when body is plain string/JSON', async () => {
  await api('/api/other-endpoint', {
    method: 'POST',
    body: JSON.stringify({ action: 'test' }),
  });

  const contentType = lastHeaders.get('Content-Type');
  assert.equal(contentType, 'application/json');
});

test('api helper error handling: wraps server 400 into ApiError with message and status', async () => {
  const formData = new FormData();
  formData.append('file', new File(['<svg><script>alert(1)</script></svg>'], 'test.svg', { type: 'image/svg+xml' }));

  await assert.rejects(
    async () => {
      await api('/api/projects/logo', {
        method: 'POST',
        headers: { 'x-user-id': 'user-editor' },
        body: formData,
      });
    },
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 400);
      assert.ok(err.message.includes('SVG') || err.message.includes('不支持'));
      return true;
    }
  );
});

test('api helper end-to-end: upload via api helper and retrieve via api helper', async () => {
  const formData = new FormData();
  formData.append('file', new File([VALID_PNG_BYTES], 'real-logo.png', { type: 'image/png' }));

  const uploadRes = await api('/api/projects/logo', {
    method: 'POST',
    headers: { 'x-user-id': 'user-editor' },
    body: formData,
  });

  assert.equal(uploadRes.ok, true);
  assert.ok(uploadRes.logoUrl);

  // Perform authenticated GET request through the route
  const getRes = await logoRoute.GET(
    new Request('http://localhost' + uploadRes.logoUrl, {
      headers: { 'x-user-id': 'user-editor' },
    })
  );
  assert.equal(getRes.status, 200);
  assert.equal(getRes.headers.get('content-type'), 'image/png');
  assert.equal(getRes.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(getRes.headers.get('cache-control'), 'private, no-store');
});
