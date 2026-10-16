import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1' });
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/product-components-api', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } }); after(() => vite.close());
const boards = await vite.ssrLoadModule('/app/api/dashboards/route.ts'); const { db } = await vite.ssrLoadModule('/lib/db.ts');
const projects = await vite.ssrLoadModule('/app/api/projects/route.ts'); const { saveDataset } = await vite.ssrLoadModule('/lib/datasets.ts');
const request = (body, user = 'user-admin') => new Request('http://localhost/api', { method: 'POST', headers: { 'x-user-id': user, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const read = async () => (await boards.GET(new Request('http://localhost/api?projectId=qicui', { headers: { 'x-user-id': 'user-admin' } }))).json();
test('component red: publishing registered business components changes the real team layout/version without replacing any existing cards', async () => {
  const before = await read(), board = before.dashboards[0];
  const response = await boards.POST(request({ projectId: 'qicui', action: 'set_components', dashboardId: board.id, version: board.version, components: ['content-effects', 'budget'] }));
  assert.equal(response.status, 200, await response.clone().text()); const confirmed = await response.json();
  assert.deepEqual(confirmed.layout.businessComponents, ['content-effects', 'budget']); assert.equal(confirmed.version, board.version + 1);
  const after = await read(); assert.deepEqual(after.cards, before.cards); assert.deepEqual(JSON.parse(after.dashboards[0].layoutJson).businessComponents, ['content-effects', 'budget']);
});
test('component API: malformed/duplicate identifiers, foreign dashboard, unrelated template and viewer writes do not modify the team layout', async () => {
  const before = await read(), base = before.dashboards[0];
  for (const components of [['not-registered'], ['budget', 'budget'], 'budget', [null]]) assert.equal((await boards.POST(request({ projectId: 'qicui', version: base.version, action: 'set_components', components }))).status, 400);
  assert.equal((await projects.POST(request({ action: 'add_member', projectId: 'qicui', userId: 'user-viewer', role: 'viewer' }))).status, 200);
  assert.equal((await boards.POST(request({ projectId: 'qicui', version: base.version, action: 'set_components', components: ['budget'] }, 'user-viewer'))).status, 403);
  const other = await projects.POST(request({ action: 'create', name: '无笔记的普通部门', templateId: 'general_workbench' })); const otherId = (await other.json()).id;
  assert.equal((await boards.POST(request({ projectId: otherId, dashboardId: base.id, version: base.version, action: 'set_components', components: ['budget'] }))).status, 400);
  assert.deepEqual(await read(), before);
});
test('component API: a shared-card publication preserves component layout and common period; stale/force component requests cannot overwrite it', async () => {
  const before = await read(), base = before.dashboards[0]; const own = await saveDataset('qicui', 'component-regression-source', '组件与指标不同来源', [{ day: '2026-09-30', amount: 100 }, { day: '2026-09-30', amount: 200 }]);
  const query = { from: '2026-09-30', to: '2026-09-30' };
  const response = await boards.POST(request({ projectId: 'qicui', version: base.version, cards: [{ id: 'actual-component-card', title: '项目独立金额', type: 'metric_card', config: { datasetId: own.id, mode: 'custom', metric: 'custom', aggregation: 'sum', field: 'amount', dateField: 'day' } }], layout: { kind: 'project_board', version: 1, query } })); assert.equal(response.status, 200); assert.deepEqual((await response.json()).layout.businessComponents, JSON.parse(base.layoutJson).businessComponents);
  const actual = await read(); const saved = await boards.POST(request({ projectId: 'qicui', version: actual.dashboards[0].version, action: 'set_components', components: [] })); assert.equal(saved.status, 200);
  const empty = await read(); assert.deepEqual(empty.cards, actual.cards); assert.deepEqual(JSON.parse(empty.dashboards[0].layoutJson).businessComponents, []); assert.deepEqual(JSON.parse(empty.dashboards[0].layoutJson).query, query);
  const stale = await boards.POST(request({ projectId: 'qicui', version: actual.dashboards[0].version, force: true, action: 'set_components', components: ['decision'] })); assert.equal(stale.status, 409);
});
test('component API: audit SQL failure rolls the version/layout back and retry records the actual non-platform-admin publisher', async () => {
  assert.equal((await projects.POST(request({ action: 'add_member', projectId: 'qicui', userId: 'user-editor', role: 'project_admin' }))).status, 200);
  const before = await read(), base = before.dashboards[0];
  await db().prepare("CREATE TEMP TRIGGER component_audit_abort BEFORE INSERT ON action_logs WHEN NEW.action='发布业务组件布局' BEGIN SELECT RAISE(ABORT,'component audit unavailable'); END").run();
  assert.equal((await boards.POST(request({ projectId: 'qicui', version: base.version, action: 'set_components', components: ['content-effects', 'budget'] }, 'user-editor'))).status, 500); assert.deepEqual(await read(), before);
  await db().prepare('DROP TRIGGER component_audit_abort').run();
  const saved = await boards.POST(request({ projectId: 'qicui', version: base.version, action: 'set_components', components: ['content-effects', 'budget'] }, 'user-editor')); assert.equal(saved.status, 200);
  const audit = await db().prepare("SELECT actor_user_id FROM action_logs WHERE action='发布业务组件布局' ORDER BY id DESC LIMIT 1").first(); assert.equal(audit.actor_user_id, 'user-editor');
});
test('component red: a stale component publication reports the actual server version and preserves the confirmed layout', async () => {
  const before = await read(), board = before.dashboards[0];
  const auditBefore = (await db().prepare("SELECT COUNT(*) AS n FROM action_logs WHERE action='发布业务组件布局' AND project_id='qicui'").first()).n;
  const saved = await boards.POST(request({ projectId: 'qicui', action: 'set_components', version: board.version, components: ['budget'] })); assert.equal(saved.status, 200);
  const stale = await boards.POST(request({ projectId: 'qicui', action: 'set_components', version: board.version, components: ['content-effects'] })); assert.equal(stale.status, 409);
  assert.equal((await stale.json()).serverVersion, board.version + 1); assert.deepEqual(JSON.parse((await read()).dashboards[0].layoutJson).businessComponents, ['budget']);
  assert.equal((await db().prepare("SELECT COUNT(*) AS n FROM action_logs WHERE action='发布业务组件布局' AND project_id='qicui'").first()).n, auditBefore + 1);
});
