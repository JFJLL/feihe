import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Isolate DB in memory and file storage in temp dir; never touch production DB or data/files
const testFilesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feihe-logo-test-'));
Object.assign(process.env, {
  LOCAL_DB_PATH: ':memory:',
  LOCAL_DB_NO_SEED: 'true',
  ENABLE_TEST_AUTH: '1',
  LOCAL_FILES_PATH: testFilesDir,
});

const vite = await createServer({
  configFile: false,
  cacheDir: 'node_modules/.vite/project-logo-test',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  resolve: { alias: { '@': path.resolve('.') } },
});
after(async () => {
  await vite.close();
  try {
    fs.rmSync(testFilesDir, { recursive: true, force: true });
  } catch {}
});

const projectsRoute = await vite.ssrLoadModule('/app/api/projects/route.ts');
const logoRoute = await vite.ssrLoadModule('/app/api/projects/logo/route.ts');
const { db, ensureSchema } = await vite.ssrLoadModule('/lib/db.ts');
const { isValidLogoUrl, parseLogoKey } = await vite.ssrLoadModule('/lib/project-form.ts');

await ensureSchema();

function jsonReq(route, body, user = 'user-editor') {
  return route.POST(
    new Request('http://localhost/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user,
      },
      body: JSON.stringify(body),
    })
  );
}

function getReq(route, query = {}, user = 'user-editor') {
  const qs = new URLSearchParams(query).toString();
  return route.GET(
    new Request('http://localhost/api/projects' + (qs ? '?' + qs : ''), {
      headers: { 'x-user-id': user },
    })
  );
}

// Valid 1x1 PNG bytes
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

test('logo upload: unauthenticated upload is rejected with 401', async () => {
  const form = new FormData();
  form.append('file', new File([VALID_PNG_BYTES], 'logo.png', { type: 'image/png' }));
  const res = await logoRoute.POST(
    new Request('http://localhost/api/projects/logo', {
      method: 'POST',
      headers: { 'x-unauthenticated': '1' },
      body: form,
    })
  );
  assert.equal(res.status, 401);
});

test('logo upload: accepts valid PNG and returns valid scoped URL pattern', async () => {
  const form = new FormData();
  form.append('file', new File([VALID_PNG_BYTES], 'brand-icon.png', { type: 'image/png' }));
  const res = await logoRoute.POST(
    new Request('http://localhost/api/projects/logo', {
      method: 'POST',
      headers: { 'x-user-id': 'user-editor' },
      body: form,
    })
  );
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(isValidLogoUrl(data.logoUrl), 'Logo URL must match allowed pattern');
  assert.ok(parseLogoKey(data.logoUrl));
  assert.ok(parseLogoKey(data.logoUrl).startsWith('uploads/logos/user-editor/'));
});

test('logo upload: rejects SVG and script injection attempts', async () => {
  const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  const form = new FormData();
  form.append('file', new File([svgContent], 'malicious.svg', { type: 'image/svg+xml' }));
  const res = await logoRoute.POST(
    new Request('http://localhost/api/projects/logo', {
      method: 'POST',
      headers: { 'x-user-id': 'user-editor' },
      body: form,
    })
  );
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error.includes('SVG') || data.error.includes('不支持'));
});

test('logo upload: rejects oversized files exceeding 2MB on server', async () => {
  const oversized = new Uint8Array(2 * 1024 * 1024 + 10);
  oversized.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const form = new FormData();
  form.append('file', new File([oversized], 'huge.png', { type: 'image/png' }));
  const res = await logoRoute.POST(
    new Request('http://localhost/api/projects/logo', {
      method: 'POST',
      headers: { 'x-user-id': 'user-editor' },
      body: form,
    })
  );
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error.includes('2MB'));
});

test('project creation: generic project with optional brand and SPU omitted succeeds', async () => {
  const res = await jsonReq(projectsRoute, {
    action: 'create',
    name: '通用无品牌项目',
    templateId: 'general_workbench',
  });
  assert.equal(res.status, 200);
  const { id } = await res.json();

  const row = await db().prepare('SELECT brand, spu, logo_url FROM projects WHERE id=?').bind(id).first();
  assert.equal(row.brand, '');
  assert.equal(row.spu, '');
  assert.equal(row.logo_url, '');
});

test('project creation: brand and SPU length > 50 characters are rejected', async () => {
  const longBrand = '飞'.repeat(51);
  const resBrand = await jsonReq(projectsRoute, {
    action: 'create',
    name: '超长品牌测试',
    brand: longBrand,
  });
  assert.equal(resBrand.status, 400);
  const dataBrand = await resBrand.json();
  assert.ok(dataBrand.error.includes('品牌名称不能超过50字'));

  const longSpu = '帆'.repeat(51);
  const resSpu = await jsonReq(projectsRoute, {
    action: 'create',
    name: '超长SPU测试',
    spu: longSpu,
  });
  assert.equal(resSpu.status, 400);
  const dataSpu = await resSpu.json();
  assert.ok(dataSpu.error.includes('SPU不能超过50字'));
});

test('project creation: rejecting arbitrary external/data/file logo URLs', async () => {
  for (const badUrl of [
    'https://attacker.example.com/logo.png',
    'http://localhost/evil.png',
    'data:image/png;base64,AAAA',
    'file:///etc/passwd',
    'javascript:alert(1)',
    '/api/projects/logo?key=../../etc/passwd',
  ]) {
    const res = await jsonReq(projectsRoute, {
      action: 'create',
      name: '任意URL注入测试',
      logoUrl: badUrl,
    });
    assert.equal(res.status, 400, `Should reject ${badUrl}`);
  }
});

test('project creation: user cannot bind another user uploaded logo (403)', async () => {
  const form = new FormData();
  form.append('file', new File([VALID_PNG_BYTES], 'user-a.png', { type: 'image/png' }));
  const uploadRes = await logoRoute.POST(
    new Request('http://localhost/api/projects/logo', {
      method: 'POST',
      headers: { 'x-user-id': 'user-other' },
      body: form,
    })
  );
  assert.equal(uploadRes.status, 200);
  const otherLogoUrl = (await uploadRes.json()).logoUrl;

  // User user-editor tries to bind user-other's logo
  const res = await jsonReq(projectsRoute, {
    action: 'create',
    name: '跨用户Logo盗用测试',
    logoUrl: otherLogoUrl,
  }, 'user-editor');
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.ok(data.error.includes('无权使用其他用户'));
});

test('project persistence: full create, edit, and no-logo removal roundtrip', async () => {
  // 1. Upload logo as user-editor
  const form = new FormData();
  form.append('file', new File([VALID_PNG_BYTES], 'valid-logo.png', { type: 'image/png' }));
  const uploadRes = await logoRoute.POST(
    new Request('http://localhost/api/projects/logo', {
      method: 'POST',
      headers: { 'x-user-id': 'user-editor' },
      body: form,
    })
  );
  assert.equal(uploadRes.status, 200);
  const { logoUrl } = await uploadRes.json();

  // 2. Create project with brand, SPU, and logo
  const createRes = await jsonReq(projectsRoute, {
    action: 'create',
    name: '飞鹤智能分析工作台',
    brand: '飞鹤',
    spu: '星飞帆卓睿',
    logoUrl,
    templateId: 'general_workbench',
  });
  assert.equal(createRes.status, 200);
  const { id } = await createRes.json();

  // Verify DB persistence
  const row = await db().prepare('SELECT name, brand, spu, logo_url FROM projects WHERE id=?').bind(id).first();
  assert.equal(row.name, '飞鹤智能分析工作台');
  assert.equal(row.brand, '飞鹤');
  assert.equal(row.spu, '星飞帆卓睿');
  assert.equal(row.logo_url, logoUrl);

  // 3. Verify Project Center Workspace GET returns logoUrl and brand/spu
  const wsRes = await getReq(projectsRoute, {}, 'user-editor');
  assert.equal(wsRes.status, 200);
  const wsData = await wsRes.json();
  const projectItem = wsData.projects.find(p => p.id === id);
  assert.ok(projectItem, 'Project must appear in workspace');
  assert.equal(projectItem.logoUrl, logoUrl);
  assert.equal(projectItem.brand, '飞鹤');
  assert.equal(projectItem.spu, '星飞帆卓睿');

  // 4. Verify File Server GET serves image with nosniff and correct Content-Type
  const fileRes = await logoRoute.GET(
    new Request('http://localhost' + logoUrl, {
      headers: { 'x-user-id': 'user-editor' },
    })
  );
  assert.equal(fileRes.status, 200);
  assert.equal(fileRes.headers.get('content-type'), 'image/png');
  assert.equal(fileRes.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(fileRes.headers.get('cache-control'), 'private, no-store');
  const servedBytes = new Uint8Array(await fileRes.arrayBuffer());
  assert.deepEqual(servedBytes, VALID_PNG_BYTES);

  // 5. Update project: edit brand/SPU, preserve existing logo when omitted
  const updateNoLogoChange = await jsonReq(projectsRoute, {
    action: 'update',
    projectId: id,
    brand: '飞鹤臻爱',
  });
  assert.equal(updateNoLogoChange.status, 200);
  const rowUpdated = await db().prepare('SELECT brand, spu, logo_url FROM projects WHERE id=?').bind(id).first();
  assert.equal(rowUpdated.brand, '飞鹤臻爱');
  assert.equal(rowUpdated.logo_url, logoUrl, 'Omitted logoUrl preserves existing logo');

  // 6. Update project: explicitly remove logo (empty string)
  const updateRemoveLogo = await jsonReq(projectsRoute, {
    action: 'update',
    projectId: id,
    logoUrl: '',
  });
  assert.equal(updateRemoveLogo.status, 200);
  const rowCleared = await db().prepare('SELECT brand, spu, logo_url FROM projects WHERE id=?').bind(id).first();
  assert.equal(rowCleared.logo_url, '', 'Explicit empty logoUrl clears logo');
});

test('adversarial: rejecting absolute, protocol-relative, hash, and extra-param URLs', async () => {
  const validKey = 'uploads/logos/user-editor/valid.png';
  for (const maliciousUrl of [
    `https://evil.example.com/api/projects/logo?key=${validKey}`,
    `http://127.0.0.1/api/projects/logo?key=${validKey}`,
    `//evil.com/api/projects/logo?key=${validKey}`,
    `\\\\evil.com\\api\\projects\\logo?key=${validKey}`,
    `/api/projects/logo?key=${validKey}#hash`,
    `/api/projects/logo?key=${validKey}&extra=1`,
    `/api/projects/logo?other=1&key=${validKey}`,
    `/api/projects/logo?key=${validKey}&key=${validKey}`,
  ]) {
    assert.equal(isValidLogoUrl(maliciousUrl), false, `Must reject ${maliciousUrl}`);
    assert.equal(parseLogoKey(maliciousUrl), null);
    const res = await jsonReq(projectsRoute, {
      action: 'create',
      name: '恶意URL注入防护',
      logoUrl: maliciousUrl,
    });
    assert.equal(res.status, 400, `API must reject ${maliciousUrl}`);
  }
});

test('adversarial: fabricated non-existent blob key is rejected', async () => {
  const ghostUrl = '/api/projects/logo?key=uploads/logos/user-editor/ghost-image.png';
  const res = await jsonReq(projectsRoute, {
    action: 'create',
    name: '伪造资源标识测试',
    logoUrl: ghostUrl,
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error.includes('不存在') || data.error.includes('尚未上传'));
});

test('adversarial: cross-user DELETE rejection and strict authorization', async () => {
  // 1. User A uploads logo
  const form = new FormData();
  form.append('file', new File([VALID_PNG_BYTES], 'user-a-del.png', { type: 'image/png' }));
  const uploadRes = await logoRoute.POST(
    new Request('http://localhost/api/projects/logo', {
      method: 'POST',
      headers: { 'x-user-id': 'user-a' },
      body: form,
    })
  );
  assert.equal(uploadRes.status, 200);
  const { key } = await uploadRes.json();

  // 2. User B tries to delete User A's logo (should fail with 403)
  const delResUnauthorized = await logoRoute.DELETE(
    new Request('http://localhost/api/projects/logo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-b' },
      body: JSON.stringify({ key }),
    })
  );
  assert.equal(delResUnauthorized.status, 403);
  const delData = await delResUnauthorized.json();
  assert.ok(delData.error.includes('无权删除'));

  // 3. User A deletes their own logo (should succeed with 200)
  const delResAuthorized = await logoRoute.DELETE(
    new Request('http://localhost/api/projects/logo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-a' },
      body: JSON.stringify({ key }),
    })
  );
  assert.equal(delResAuthorized.status, 200);
});

test('adversarial: cannot delete a logo that is currently actively bound to a project', async () => {
  const form = new FormData();
  form.append('file', new File([VALID_PNG_BYTES], 'bound-protect.png', { type: 'image/png' }));
  const uploadRes = await logoRoute.POST(
    new Request('http://localhost/api/projects/logo', {
      method: 'POST',
      headers: { 'x-user-id': 'user-editor' },
      body: form,
    })
  );
  assert.equal(uploadRes.status, 200);
  const { key, logoUrl } = await uploadRes.json();

  const createRes = await jsonReq(projectsRoute, {
    action: 'create',
    name: '绑定防删除项目',
    logoUrl,
  });
  assert.equal(createRes.status, 200);

  const delRes = await logoRoute.DELETE(
    new Request('http://localhost/api/projects/logo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-editor' },
      body: JSON.stringify({ key }),
    })
  );
  assert.equal(delRes.status, 400);
  const delData = await delRes.json();
  assert.ok(delData.error.includes('正在被项目使用'));
});

test('adversarial: non-owner editor can edit project with existing bound logo', async () => {
  // 1. User user-project-manager uploads logo and creates project
  const form = new FormData();
  form.append('file', new File([VALID_PNG_BYTES], 'creator-logo.png', { type: 'image/png' }));
  const uploadRes = await logoRoute.POST(
    new Request('http://localhost/api/projects/logo', {
      method: 'POST',
      headers: { 'x-user-id': 'user-project-manager' },
      body: form,
    })
  );
  assert.equal(uploadRes.status, 200);
  const { logoUrl } = await uploadRes.json();

  const createRes = await jsonReq(projectsRoute, {
    action: 'create',
    name: '创作者归属项目',
    logoUrl,
  }, 'user-project-manager');
  assert.equal(createRes.status, 200);
  const { id } = await createRes.json();

  // 2. Add user-editor as collaborator (project_admin, non-owner)
  const addMemberRes = await jsonReq(projectsRoute, {
    action: 'add_member',
    projectId: id,
    userId: 'user-editor',
    role: 'project_admin',
  }, 'user-project-manager');
  assert.equal(addMemberRes.status, 200);

  // 3. Collaborator (user-editor, who is not the logo uploader) updates project name while keeping the existing bound logo
  const updateRes = await jsonReq(projectsRoute, {
    action: 'update',
    projectId: id,
    name: '协作者维护新名称',
    logoUrl, // keeping the existing bound logo uploaded by user-project-manager
  }, 'user-editor');
  assert.equal(updateRes.status, 200, 'Non-owner manager must be allowed to keep existing bound logo');

  const row = await db().prepare('SELECT name, logo_url FROM projects WHERE id=?').bind(id).first();
  assert.equal(row.name, '协作者维护新名称');
  assert.equal(row.logo_url, logoUrl);
});

test('adversarial: GET requires authentication and denies unauthorized access', async () => {
  // 1. Upload private logo as user-secret
  const form = new FormData();
  form.append('file', new File([VALID_PNG_BYTES], 'secret-logo.png', { type: 'image/png' }));
  const uploadRes = await logoRoute.POST(
    new Request('http://localhost/api/projects/logo', {
      method: 'POST',
      headers: { 'x-user-id': 'user-secret' },
      body: form,
    })
  );
  assert.equal(uploadRes.status, 200);
  const { logoUrl } = await uploadRes.json();

  // 2. Unauthenticated GET returns 401
  const resUnauth = await logoRoute.GET(
    new Request('http://localhost' + logoUrl, {
      headers: { 'x-unauthenticated': '1' },
    })
  );
  assert.equal(resUnauth.status, 401);

  // 3. Unrelated user gets 403 before logo is bound
  const resStranger = await logoRoute.GET(
    new Request('http://localhost' + logoUrl, {
      headers: { 'x-user-id': 'user-stranger' },
    })
  );
  assert.equal(resStranger.status, 403);

  // 4. Owner gets 200
  const resOwner = await logoRoute.GET(
    new Request('http://localhost' + logoUrl, {
      headers: { 'x-user-id': 'user-secret' },
    })
  );
  assert.equal(resOwner.status, 200);
});
