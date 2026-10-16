import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
import { handleFeishuFixture } from '../tests/browser/feishu-fixture.mjs';

process.env.LOCAL_DB_PATH = ':memory:';
process.env.LOCAL_DB_NO_SEED = 'true';
process.env.ENABLE_TEST_AUTH = '1';
process.env.FEISHU_APP_ID = 'fixture-app';
process.env.FEISHU_APP_SECRET = 'fixture-secret';
process.env.KEYSTONE_API_KEY = 'fixture-disabled';
const originalFetch = globalThis.fetch;
const upstreamRequests = [];
globalThis.fetch = async (input, options) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith('https://open.feishu.cn/')) { upstreamRequests.push(url); return handleFeishuFixture(url); }
  return originalFetch(input, options);
};
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/v3-api', server: { middlewareMode: true }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(async () => { globalThis.fetch = originalFetch; await vite.close(); });
const { db, ensureSchema } = await vite.ssrLoadModule('/lib/db.ts');
await ensureSchema();
const d1 = db();
const projects = await vite.ssrLoadModule('/app/api/projects/route.ts');
const datasets = await vite.ssrLoadModule('/app/api/datasets/route.ts');
const dashboards = await vite.ssrLoadModule('/app/api/dashboards/route.ts');
const metrics = await vite.ssrLoadModule('/app/api/metrics/route.ts');
const sync = await vite.ssrLoadModule('/app/api/feishu/sync/route.ts');
const inspect = await vite.ssrLoadModule('/app/api/feishu/inspect/route.ts');

function request(body, userId = 'user-admin') {
  if (body.sourceId) body = { ...body, sourceId: body.projectId + '-' + body.sourceId };
  return new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': userId }, body: JSON.stringify(body) });
}
async function create(id) {
  assert.equal((await projects.POST(request({ action: 'create', id, name: id, templateId: 'general_workbench' }))).status, 200);
  return id;
}
async function source(projectId, id, spreadsheet, sheetId, mappingJson = '[]', range = '') {
  const r = await projects.POST(request({ action: 'save_source', projectId, id: projectId + '-' + id, name: id, spreadsheet, sheetId, mappingJson, range, kind: 'general', type: spreadsheet.includes('/base/') ? 'feishu_bitable' : 'feishu_sheet' }));
  assert.equal(r.status, 200, JSON.stringify(await r.json()));
}
async function getDataset(projectId, sourceId) {
  const ds = await datasets.GET(new Request(`http://localhost/api/datasets?projectId=${projectId}&id=ds-${projectId}-${projectId}-${sourceId}&all=true`));
  assert.equal(ds.status, 200);
  return (await ds.json()).dataset;
}

test('API: historical sync retains verified editor identity even when upstream sheets fail', async () => {
  const projectId = await create('qicui');
  assert.equal((await projects.POST(request({ action: 'add_member', projectId, userId: 'user-editor', role: 'editor' }))).status, 200);
  for (const body of [{ projectId }, { projectId, all: true }]) {
    const result = await sync.POST(request(body, 'user-editor'));
    assert.equal(result.status, 200);
    const data = await result.json();
    assert.equal(data.actorUserId, 'user-editor');
    assert.equal(data.ok, false, 'fixture lacks historical sheets: do not report a successful real Feishu sync');
    assert.ok(data.error);
  }
  const logs = await d1.prepare("SELECT actor_user_id FROM action_logs WHERE project_id=? AND action='飞书历史表格同步'").bind(projectId).all();
  assert.equal(logs.results.length, 2);
  assert.ok(logs.results.every(log => log.actor_user_id === 'user-editor'));
  assert.equal((await sync.POST(request({ projectId, all: true }, 'user-unauthorized'))).status, 403);
});

test('API: non-admin editor single/bulk sync retain actor identity; viewer and outsider denied', async () => {
  const projectId = await create('api-actors');
  for (const [userId, role] of [['user-editor', 'editor'], ['user-viewer', 'viewer']]) assert.equal((await projects.POST(request({ action: 'add_member', projectId, userId, role }))).status, 200);
  await source(projectId, 'one', 'https://fixture.feishu.cn/sheets/FixtureDoc', 'sheetA');
  await source(projectId, 'two', 'https://fixture.feishu.cn/sheets/FixtureDoc', 'sheetB');
  const one = await sync.POST(request({ projectId, sourceId: 'one' }, 'user-editor'));
  assert.equal(one.status, 200);
  assert.equal((await one.json()).actorUserId, 'user-editor');
  const bulk = await sync.POST(request({ projectId, all: true }, 'user-editor'));
  const data = await bulk.json();
  assert.equal(bulk.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.sourcesUpdated, 2);
  const logs = await d1.prepare("SELECT actor_user_id FROM action_logs WHERE project_id=? AND action='飞书表格同步'").bind(projectId).all();
  assert.equal(logs.results.length, 3);
  assert.ok(logs.results.every(log => log.actor_user_id === 'user-editor'));
  for (const actor of ['user-viewer', 'user-unauthorized']) {
    for (const body of [{ projectId, sourceId: 'one' }, { projectId, all: true }]) assert.equal((await sync.POST(request(body, actor))).status, 403);
  }
});
test('API: full spreadsheet reads 5050 records beyond row5000, explicit range is marked limited', async () => {
  const projectId = await create('api-fullsheet');
  await source(projectId, 'big', 'https://fixture.feishu.cn/sheets/FixtureDoc', 'sheetBig');
  const full = await sync.POST(request({ projectId, sourceId: 'big' }));
  assert.equal(full.status, 200);
  assert.equal((await full.json()).scope, 'full_table');
  const ds = await getDataset(projectId, 'big');
  assert.equal(ds.rowCount, 5050);
  assert.equal(ds.rows[5049]['编号'], '5050');
  assert.ok(upstreamRequests.some(url => decodeURIComponent(url).includes('sheetBig!A5001:B5051')));
  await source(projectId, 'limited', 'https://fixture.feishu.cn/sheets/FixtureDoc', 'sheetBig', '[]', 'A1:B3');
  const limited = await sync.POST(request({ projectId, sourceId: 'limited' }));
  assert.equal(limited.status, 200);
  assert.equal((await limited.json()).scope, 'limited_range');
  assert.equal((await getDataset(projectId, 'limited')).rowCount, 2);
});
test('API: real six-page Bitable sync feeds 501-row weighted ratio16.7%', async () => {
  const projectId = await create('api-501');
  await source(projectId, 'base', 'https://fixture.feishu.cn/base/CompleteDoc', 'table1');
  assert.equal((await sync.POST(request({ projectId, sourceId: 'base' }))).status, 200);
  const ds = await getDataset(projectId, 'base');
  assert.equal(ds.rowCount, 501);
  const response = await metrics.POST(request({ projectId, action: 'evaluate', card: { datasetId: ds.id, aggregation: 'ratio', numField: 'numerator', denField: 'denominator' } }));
  assert.equal(response.status, 200);
  const metric = (await response.json()).metric;
  assert.equal(metric.formattedValue, '16.7%');
  assert.equal(metric.sampleSize, 501);
  assert.equal(metric.numerator, 100);
  assert.equal(metric.denominator, 600);
});
test('API: has_more without token rejects publication and preserves previous snapshot', async () => {
  const projectId = await create('api-incomplete');
  await source(projectId, 'base', 'https://fixture.feishu.cn/base/CompleteDoc', 'table1');
  assert.equal((await sync.POST(request({ projectId, sourceId: 'base' }))).status, 200);
  const before = await getDataset(projectId, 'base');
  await source(projectId, 'base', 'https://fixture.feishu.cn/base/IncompleteDoc', 'table1');
  const response = await sync.POST(request({ projectId, sourceId: 'base' }));
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /缺少 page_token/);
  const after = await getDataset(projectId, 'base');
  assert.deepEqual(after.rows, before.rows);
  assert.equal(after.version, before.version);
});
test('API: invalid conversion fails the full import without replacing valid stored rows', async () => {
  const projectId = await create('api-conversion');
  await source(projectId, 'mapped', 'https://fixture.feishu.cn/sheets/FixtureDoc', 'sheetB');
  assert.equal((await sync.POST(request({ projectId, sourceId: 'mapped' }))).status, 200);
  const before = await getDataset(projectId, 'mapped');
  const cases = [
    [{ sourceField: '金额', targetField: 'amount', type: 'number', required: true }, /必填/],
    [{ sourceField: '分组', targetField: 'group', isKey: true }, /主键重复/],
    [{ sourceField: '分组', targetField: 'day', type: 'date' }, /非法日期/],
    [{ sourceField: '分组', targetField: 'flag', type: 'boolean' }, /布尔/],
  ];
  for (const [rule, message] of cases) {
    await source(projectId, 'mapped', 'https://fixture.feishu.cn/sheets/FixtureDoc', 'sheetB', JSON.stringify([rule]));
    const response = await sync.POST(request({ projectId, sourceId: 'mapped' }));
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, message);
    assert.deepEqual((await getDataset(projectId, 'mapped')).rows, before.rows);
  }
});
test('API: changed sheet or document context requires new confirmation', async () => {
  const projectId = await create('api-context');
  const inspection = await inspect.POST(request({ projectId, url: 'https://fixture.feishu.cn/sheets/FixtureDoc', sheetId: 'sheetA' }));
  assert.equal(inspection.status, 200);
  const detected = (await inspection.json()).detected;
  const mappingJson = JSON.stringify({ rules: [], context: { projectId, documentToken: detected.documentToken, sheetId: 'sheetA', fields: detected.preview.headers.map(key => ({ key, type: 'text' })) } });
  await source(projectId, 'same', 'https://fixture.feishu.cn/sheets/OtherDoc', 'sheetA', mappingJson);
  const response = await sync.POST(request({ projectId, sourceId: 'same' }));
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /映射上下文/);
  const changed = await projects.POST(request({ action: 'save_source', projectId, name: 'bad', sheetId: 'sheetB', mappingJson }));
  assert.equal(changed.status, 400);
});
test('API: invalid card config cannot preview or mutate a published dashboard', async () => {
  const projectId = await create('api-validation');
  const created = await datasets.POST(request({ projectId, sourceId: 'values', rows: [{ amount: 100, label: '文字' }] }));
  const datasetId = (await created.json()).dataset.id;
  const valid = { title: '记录', type: 'metric_card', config: { datasetId, aggregation: 'count' } };
  const good = await dashboards.POST(request({ projectId, cards: [valid] }));
  assert.equal(good.status, 200);
  const before = await good.json();
  for (const config of [{ datasetId: 'foreign', aggregation: 'count' }, { datasetId, aggregation: 'sum', field: 'label' }, { datasetId, aggregation: 'ratio', numField: 'amount' }, { datasetId, aggregation: 'count', from: '2026-10-01' }]) {
    assert.equal((await metrics.POST(request({ projectId, action: 'evaluate', card: config }))).status, 400);
    assert.equal((await dashboards.POST(request({ projectId, version: before.version, cards: [{ ...valid, config }] }))).status, 400);
    const stored = (await (await dashboards.GET(new Request(`http://localhost/api/dashboards?projectId=${projectId}`))).json());
    assert.equal(stored.dashboards[0].version, before.version);
    assert.equal(stored.cards[0].title, '记录');
  }
});
test('API: confirmed dashboard IDs and actual multi-step conflict version roundtrip', async () => {
  const projectId = await create('api-version');
  const ds = (await (await datasets.POST(request({ projectId, sourceId: 'v', rows: [{ x: 1 }] }))).json()).dataset;
  const cards = [{ title: '计数', type: 'metric_card', config: { datasetId: ds.id, aggregation: 'count' } }];
  const initial = await (await dashboards.POST(request({ projectId, cards }))).json();
  let version = initial.version;
  for (let i = 0; i < 4; i++) {
    const response = await dashboards.POST(request({ projectId, dashboardId: initial.dashboardId, version, cards }));
    assert.equal(response.status, 200); version = (await response.json()).version;
  }
  const conflict = await dashboards.POST(request({ projectId, dashboardId: initial.dashboardId, version: initial.version, cards }));
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).serverVersion, version);
  const stored = (await (await dashboards.GET(new Request(`http://localhost/api/dashboards?projectId=${projectId}`))).json()).cards;
  assert.ok(stored.every(card => card.id));
  assert.equal(JSON.parse(stored[0].configJson).datasetId, ds.id);
});
test('API: archive denies other writes; only project admin can restore', async () => {
  const projectId = await create('api-restore');
  for (const [userId, role] of [['user-editor', 'project_admin'], ['user-viewer', 'viewer']]) await projects.POST(request({ action: 'add_member', projectId, userId, role }));
  assert.equal((await projects.POST(request({ action: 'archive', projectId }))).status, 200);
  assert.equal((await projects.POST(request({ action: 'restore', projectId }, 'user-viewer'))).status, 403);
  assert.equal((await projects.POST(request({ action: 'update', projectId, name: 'bad' }, 'user-editor'))).status, 403);
  assert.equal((await datasets.POST(request({ projectId, sourceId: 'bad', rows: [{ x: 1 }] }, 'user-editor'))).status, 403);
  assert.equal((await projects.POST(request({ action: 'restore', projectId }, 'user-editor'))).status, 200);
  assert.equal((await projects.POST(request({ action: 'update', projectId, name: 'restored' }, 'user-editor'))).status, 200);
});
