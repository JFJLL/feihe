import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1' });
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/product-access-api', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } }); after(() => vite.close());
const projects = await vite.ssrLoadModule('/app/api/projects/route.ts'), auth = await vite.ssrLoadModule('/lib/api-auth.ts'), dashboards = await vite.ssrLoadModule('/app/api/dashboards/route.ts');
const { saveDataset } = await vite.ssrLoadModule('/lib/datasets.ts'); const { db } = await vite.ssrLoadModule('/lib/db.ts');
const req = (body, user = 'user-editor') => new Request('http://localhost/api', { method: 'POST', headers: { 'x-user-id': user, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const create = async name => (await (await projects.POST(req({ action: 'create', name, templateId: 'general_workbench' }))).json()).id;
let revokedId;
test('access API: removed creator has neither project access nor project/source visibility', async () => {
  const id = await create('撤销创建者'); assert.equal((await projects.POST(req({ action: 'add_member', projectId: id, userId: 'user-project-manager', role: 'project_admin' }))).status, 200);
  assert.equal((await projects.POST(req({ action: 'update', projectId: id, ownerId: 'user-project-manager' }))).status, 200);
  assert.equal((await projects.POST(req({ action: 'remove_member', projectId: id, userId: 'user-editor' }, 'user-project-manager'))).status, 200);
  revokedId = id;
  const access = await auth.requireProjectAccess(req({}), id, 'read'); assert.equal(access.ok, false); assert.equal(access.status, 403);
  const list = await (await projects.GET(new Request('http://localhost/api/projects', { headers: { 'x-user-id': 'user-editor' } }))).json(); assert.equal(list.projects.some(project => project.id === id), false);
});
test('access API: revoked identity cannot use datasets, metrics, boards, reports, export, business analytics or assistant writes', async () => {
  for (const modulePath of ['dashboard', 'ops', 'datasets', 'metrics', 'dashboards', 'data-workspace', 'metric-definitions', 'reports', 'report-html', 'business-analytics']) {
    const route = await vite.ssrLoadModule('/app/api/' + modulePath + '/route.ts');
    const response = await route.GET(new Request('http://localhost/api?projectId=' + revokedId + '&id=private-test-report', { headers: { 'x-user-id': 'user-editor' } })); assert.equal(response.status, 403, modulePath);
  }
  const agent = await vite.ssrLoadModule('/app/api/agent/route.ts'); assert.equal((await agent.POST(req({ projectId: revokedId, prompt: '当前项目报告' }))).status, 403);
  const sync = await vite.ssrLoadModule('/app/api/feishu/sync/route.ts'); assert.equal((await sync.POST(req({ projectId: revokedId, all: true }))).status, 403);
});
test('access API: concurrent removals cannot leave a legacy project without a project administrator', async () => {
  const id = await create('并发成员规则'); await projects.POST(req({ action: 'add_member', projectId: id, userId: 'user-project-manager', role: 'project_admin' }));
  await db().prepare('UPDATE projects SET owner_id=? WHERE id=?').bind('user-viewer', id).run();
  const replies = await Promise.all(['user-editor', 'user-project-manager'].map(userId => projects.POST(req({ action: 'remove_member', projectId: id, userId }, 'user-admin'))));
  assert.equal(replies.filter(response => response.status === 200).length, 1); assert.equal(replies.filter(response => [400, 409].includes(response.status)).length, 1);
  assert.equal((await db().prepare("SELECT COUNT(*) AS n FROM project_members WHERE project_id=? AND role='project_admin'").bind(id).first()).n, 1);
});
test('access API: current responsible owner cannot be removed or demoted through member operations', async () => {
  const id = await create('负责人保护'); await projects.POST(req({ action: 'add_member', projectId: id, userId: 'user-project-manager', role: 'project_admin' }));
  for (const body of [{ action: 'remove_member' }, { action: 'update_member_role', role: 'viewer' }]) assert.equal((await projects.POST(req({ ...body, projectId: id, userId: 'user-editor' }, 'user-project-manager'))).status, 400);
});
test('access API: legacy inconsistent responsibility still cannot remove the last project administrator', async () => {
  const id = await create('最后管理员'); await db().prepare('UPDATE projects SET owner_id=? WHERE id=?').bind('user-viewer', id).run();
  assert.equal((await projects.POST(req({ action: 'remove_member', projectId: id, userId: 'user-editor' }, 'user-admin'))).status, 400);
});
test('publication API: publishing an existing initially draft board confirms its actual published status', async () => {
  const id = await create('发布真实状态'), dataset = await saveDataset(id, 'status-source', '业务记录', [{ amount: 10 }]);
  const before = await (await dashboards.GET(new Request('http://localhost/api?projectId=' + id, { headers: { 'x-user-id': 'user-editor' } }))).json();
  const response = await dashboards.POST(req({ projectId: id, version: before.dashboards[0].version, cards: [{ title: '记录数量', type: 'metric_card', config: { datasetId: dataset.id, aggregation: 'count', mode: 'custom' } }] })); assert.equal(response.status, 200);
  const after = await (await dashboards.GET(new Request('http://localhost/api?projectId=' + id, { headers: { 'x-user-id': 'user-editor' } }))).json(); assert.equal(after.dashboards[0].status, 'published');
});
test('access API: a registered identity creates projects in its own organization and neither organization sees the other project', async () => {
  const now = new Date().toISOString();
  await db().prepare('INSERT INTO organizations(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)').bind('org-other', '隔离组织', 'other', now, now).run();
  await db().prepare('INSERT INTO departments(id,org_id,name,created_at,updated_at) VALUES(?,?,?,?,?)').bind('dept-other', 'org-other', '隔离部门', now, now).run();
  await db().prepare('INSERT INTO users(id,email,name,role,department_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind('other-org-member', 'other@example.test', '其他组织人员', 'user', 'dept-other', now, now).run();
  const created = await projects.POST(req({ action: 'create', name: '本组织自己的项目', templateId: 'general_workbench' }, 'other-org-member')); assert.equal(created.status, 200); const id = (await created.json()).id;
  assert.equal((await db().prepare('SELECT org_id FROM projects WHERE id=?').bind(id).first()).org_id, 'org-other');
  assert.equal((await auth.requireProjectAccess(req({}, 'other-org-member'), id, 'manage')).ok, true);
  assert.equal((await auth.requireProjectAccess(req({}, 'user-admin'), id, 'read')).status, 403);
  const visible = await (await projects.GET(new Request('http://localhost/api/projects', { headers: { 'x-user-id': 'other-org-member' } }))).json(); assert.deepEqual(visible.projects.map(project => project.id), [id]);
});
