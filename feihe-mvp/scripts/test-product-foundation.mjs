import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1' });
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/product-foundation', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(() => vite.close());
const projects = await vite.ssrLoadModule('/app/api/projects/route.ts');
const auth = await vite.ssrLoadModule('/lib/api-auth.ts');
const { db } = await vite.ssrLoadModule('/lib/db.ts');
const post = (body, user = 'user-editor') => projects.POST(new Request('http://localhost/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': user }, body: JSON.stringify(body) }));
const get = (user = 'user-editor', projectId) => projects.GET(new Request('http://localhost/api/projects' + (projectId ? '?projectId=' + projectId : ''), { headers: { 'x-user-id': user } }));
async function productionCheck(run) {
  const previous = { ENABLE_TEST_AUTH: process.env.ENABLE_TEST_AUTH, REQUIRE_PROD_AUTH: process.env.REQUIRE_PROD_AUTH, FEIHE_AUTH_GATEWAY_SECRET: process.env.FEIHE_AUTH_GATEWAY_SECRET, NODE_ENV: process.env.NODE_ENV };
  delete process.env.ENABLE_TEST_AUTH;
  process.env.REQUIRE_PROD_AUTH = 'true';
  process.env.NODE_ENV = 'production';
  process.env.FEIHE_AUTH_GATEWAY_SECRET = 'isolated-gateway-test-secret-only';
  try { await run(); } finally { for (const [k, v] of Object.entries(previous)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}
test('production: unverified administrator header is rejected', async () => {
  await productionCheck(async () => assert.equal(await auth.getAuthenticatedUser(new Request('http://localhost/api/projects', { headers: { 'x-user-id': 'user-admin' } })), null));
});
test('production: arbitrary bearer and missing identity never fall back to administrator', async () => {
  await productionCheck(async () => {
    assert.equal(await auth.getAuthenticatedUser(new Request('http://localhost/api/projects', { headers: { authorization: 'Bearer arbitrary-unverified-token' } })), null);
    assert.equal(await auth.getAuthenticatedUser(new Request('http://localhost/api/projects')), null);
  });
});
test('production: signed gateway identity is verified and raw user header cannot override it', async () => {
  await get();
  await productionCheck(async () => {
    const userId = 'user-project-manager', timestamp = String(Date.now());
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(process.env.FEIHE_AUTH_GATEWAY_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId + '\n' + timestamp))).toString('hex');
    const user = await auth.getAuthenticatedUser(new Request('http://localhost/api/projects', { headers: { 'x-feihe-user-id': userId, 'x-feihe-auth-timestamp': timestamp, 'x-feihe-auth-signature': signature, 'x-user-id': 'user-admin' } }));
    assert.equal(user?.userId, userId); assert.equal(user?.role, 'user');
  });
});
test('organization: authorized admin creates and updates a new department with a stable id', async () => {
  const created = await post({ action: 'save_department', name: '咨询服务试点部' }, 'user-admin');
  assert.equal(created.status, 200);
  const id = (await created.json()).id;
  const edited = await post({ action: 'save_department', id, name: '咨询服务部' }, 'user-admin');
  assert.equal(edited.status, 200); assert.equal((await edited.json()).id, id);
  const ws = await (await get()).json(); assert.ok(ws.metadata.departments.some(d => d.id === id && d.name === '咨询服务部'));
});
test('organization: admin manages clients; ordinary users are denied organization writes', async () => {
  const created = await post({ action: 'save_client', name: '晨风试点客户', industry: '服务' }, 'user-admin');
  assert.equal(created.status, 200);
  const id = (await created.json()).id;
  assert.equal((await post({ action: 'save_client', id, name: '越权更名' })).status, 403);
  const ws = await (await get()).json(); assert.ok(ws.metadata.clients.some(c => c.id === id && c.name === '晨风试点客户'));
});
test('project: invalid department/client/owner references are rejected before insert', async () => {
  for (const bad of [{ departmentId: 'missing-dept' }, { clientId: 'missing-client' }, { ownerId: 'missing-user' }]) {
    const res = await post({ action: 'create', name: '拒绝非法关联', ...bad });
    assert.equal(res.status, 400);
  }
  assert.equal((await db().prepare("SELECT COUNT(*) AS count FROM projects WHERE name='拒绝非法关联'").first()).count, 0);
});
test('project: general and blank starts do not install task/budget assumptions', async () => {
  for (const templateId of ['general_workbench', 'blank']) {
    const res = await post({ action: 'create', name: '中性首用 ' + templateId, templateId });
    assert.equal(res.status, 200);
    const id = (await res.json()).id;
    const cards = await db().prepare('SELECT config_json FROM dashboard_cards WHERE project_id=?').bind(id).all();
    assert.deepEqual(cards.results, []);
  }
});
test('project: new content projects do not inherit confirmed Qicui targets', async () => {
  const res = await post({ action: 'create', name: '新内容客户', templateId: 'content_marketing' }); assert.equal(res.status, 200);
  const id = (await res.json()).id;
  const rows = await db().prepare('SELECT target_count FROM project_pipelines WHERE project_id=?').bind(id).all();
  assert.ok(rows.results.length > 0); assert.ok(rows.results.every(r => r.target_count === 0));
});
test('project: visible list includes actual viewer role and owner identity; metadata exposes selection users', async () => {
  const created = await post({ action: 'create', id: 'product-viewer-scope', name: '查看者项目' }); assert.equal(created.status, 200);
  await post({ action: 'add_member', projectId: 'product-viewer-scope', userId: 'user-viewer', role: 'viewer' });
  const workspace = await (await get('user-viewer')).json();
  const item = workspace.projects.find(p => p.id === 'product-viewer-scope');
  assert.equal(item.projectRole, 'viewer'); assert.equal(item.canManage, false); assert.equal(item.ownerName, '业务编辑者(张晓)');
  assert.ok(workspace.metadata.users.some(u => u.id === 'user-editor'));
});
test('project: selecting another owner adds that confirmed owner as project administrator', async () => {
  const created = await post({ action: 'create', name: '负责人交接', ownerId: 'user-project-manager' }); assert.equal(created.status, 200);
  const id = (await created.json()).id;
  const detail = await (await get('user-project-manager', id)).json();
  assert.equal(detail.projectRole, 'project_admin');
  assert.ok(detail.members.some(m => m.userId === 'user-project-manager' && m.role === 'project_admin'));
});

test('organization: an admin can register a verified company account for owner and member selection without database edits', async () => {
  const created = await post({ action: 'save_user', id: 'product-company-member', name: '咨询团队新成员', email: 'consulting@example.test', departmentId: 'dept-operations' }, 'user-admin');
  assert.equal(created.status, 200);
  const workspace = await (await get()).json();
  assert.ok(workspace.metadata.users.some(u => u.id === 'product-company-member' && u.name === '咨询团队新成员'));
  assert.equal((await post({ action: 'save_user', id: 'member-admin-forgery', name: '不允许提升', email: 'forged@example.test', departmentId: 'dept-operations', role: 'platform_admin' }, 'user-admin')).status, 400);
});
test('project: member assignments reject unknown directory accounts and unsupported roles', async () => {
  const created = await post({ action: 'create', name: '真实成员规则' }); const id = (await created.json()).id;
  assert.equal((await post({ action: 'add_member', projectId: id, userId: 'unregistered-company-account', role: 'viewer' })).status, 400);
  assert.equal((await post({ action: 'add_member', projectId: id, userId: 'user-viewer', role: 'invalid-role' })).status, 400);
});
