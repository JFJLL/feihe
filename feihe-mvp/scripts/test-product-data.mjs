import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
import { handleFeishuFixture } from '../tests/browser/feishu-fixture.mjs';
Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1', FEISHU_APP_ID: 'fixture-app', FEISHU_APP_SECRET: 'fixture-secret' });
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => String(input instanceof Request ? input.url : input).startsWith('https://open.feishu.cn/') ? handleFeishuFixture(input) : originalFetch(input, options);
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/product-data-api', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(async () => { globalThis.fetch = originalFetch; await vite.close(); });
const projects = await vite.ssrLoadModule('/app/api/projects/route.ts');
const datasets = await vite.ssrLoadModule('/app/api/datasets/route.ts');
const workspace = await vite.ssrLoadModule('/app/api/data-workspace/route.ts');
const dashboards = await vite.ssrLoadModule('/app/api/dashboards/route.ts');
const sync = await vite.ssrLoadModule('/app/api/feishu/sync/route.ts');
const { db } = await vite.ssrLoadModule('/lib/db.ts');
function req(body, user = 'user-editor') { return new Request('http://localhost/api', { method: 'POST', headers: { 'x-user-id': user, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
function read(projectId, suffix = '', user = 'user-editor') { return workspace.GET(new Request('http://localhost/api/data-workspace?projectId=' + projectId + suffix, { headers: { 'x-user-id': user } })); }
let projectId, datasetId;
test('data workspace API: neutral project lists its own real datasets without a synthetic source', async () => {
  const created = await projects.POST(req({ action: 'create', name: '数据工作台API', templateId: 'general_workbench' }));
  assert.equal(created.status, 200); projectId = (await created.json()).id;
  const result = await datasets.POST(req({ projectId, sourceId: 'manual-test', name: '核对数据', columns: [{ key: 'amount', name: '金额', type: 'number' }, { key: 'day', name: '业务日期', type: 'date' }], rows: [{ amount: 100, day: '2026-10-01' }, { amount: '非法数字', day: '2026-02-30' }, { amount: null, day: null }, { amount: 0, day: '' }] }));
  assert.equal(result.status, 200); datasetId = (await result.json()).dataset.id;
  const response = await read(projectId); assert.equal(response.status, 200);
  const state = await response.json(); assert.equal(state.datasets.length, 1); assert.deepEqual(state.sources, []); assert.equal(state.datasets[0].columns[0].name, '金额');
});
test('data workspace API: full-dataset quality distinguishes missing, invalid and true zero', async () => {
  const state = await (await read(projectId, '&datasetId=' + datasetId)).json();
  assert.equal(state.quality.checkedRows, 4); assert.equal(state.quality.version, 1);
  assert.deepEqual(state.quality.fields, [{ key: 'amount', name: '金额', type: 'number', missing: 1, invalid: 1 }, { key: 'day', name: '业务日期', type: 'date', missing: 2, invalid: 1 }]);
  const stored = await datasets.GET(new Request('http://localhost/api/datasets?projectId=' + projectId + '&id=' + datasetId + '&all=true', { headers: { 'x-user-id': 'user-editor' } }));
  assert.deepEqual((await stored.json()).dataset.rows.map(row => row.amount), [100, '非法数字', null, 0]);
});
test('data workspace API: card lineage resolves a real dataset id and refuses unrelated guesses', async () => {
  const saved = await dashboards.POST(req({ projectId, cards: [{ title: '记录数', type: 'metric_card', config: { datasetId, mode: 'custom', metric: 'custom', aggregation: 'count' } }] }));
  assert.equal(saved.status, 200);
  const state = await (await read(projectId)).json(); assert.equal(state.uses.length, 1);
  assert.deepEqual({ name: state.uses[0].name, kind: state.uses[0].kind, datasetId: state.uses[0].datasetId }, { name: '记录数', kind: 'card', datasetId });
});
test('data workspace API: outsider, unverified identity and foreign dataset cannot read data or quality', async () => {
  assert.equal((await read(projectId, '', 'user-outsider')).status, 403);
  assert.equal((await read(projectId, '', 'anonymous')).status, 401);
  assert.equal((await read(projectId, '&datasetId=foreign-dataset')).status, 404);
});
test('data workspace API: real failed full-batch validation is recorded with actor and no replacement', async () => {
  const source = await projects.POST(req({ action: 'save_source', projectId, name: '失败来源', spreadsheet: 'https://fixture.feishu.cn/sheets/FocusedLateRequiredDoc', sheetId: 'sheetA', type: 'feishu_sheet', kind: 'general', mappingJson: JSON.stringify([{ sourceField: '金额', targetField: '金额', type: 'number', required: true }]) }));
  assert.equal(source.status, 200); const sourceId = (await source.json()).id;
  const failed = await sync.POST(req({ projectId, sourceId })); assert.equal(failed.status, 500);
  const state = await (await read(projectId)).json();
  assert.equal(state.runs[0].status, 'failed'); assert.equal(state.runs[0].sourceId, sourceId);
  assert.equal(state.runs[0].rowsRead, 12); assert.equal(state.runs[0].rowsImported, 0);
  assert.match(state.runs[0].errorSummary, /必填/); assert.equal(state.datasets.length, 1);
  const actor = await db().prepare("SELECT actor_user_id FROM action_logs WHERE project_id=? AND action='飞书表格同步失败'").bind(projectId).first();
  assert.equal(actor.actor_user_id, 'user-editor');
});
test('data workspace API: limited range is recorded per run rather than inferred from an edited source', async () => {
  const source = await projects.POST(req({ action: 'save_source', projectId, name: '明确范围来源', spreadsheet: 'https://fixture.feishu.cn/sheets/FocusedLateRequiredDoc', sheetId: 'sheetA', type: 'feishu_sheet', kind: 'general', range: 'A1:B3', mappingJson: '[]' }));
  assert.equal(source.status, 200); const sourceId = (await source.json()).id;
  const synced = await sync.POST(req({ projectId, sourceId })); assert.equal(synced.status, 200);
  assert.equal((await synced.json()).scope, 'limited_range');
  assert.equal((await projects.POST(req({ action: 'save_source', id: sourceId, projectId, name: '明确范围来源', spreadsheet: 'https://fixture.feishu.cn/sheets/FocusedLateRequiredDoc', sheetId: 'sheetA', type: 'feishu_sheet', kind: 'general', range: 'A1:B4', mappingJson: '[]' }))).status, 200);
  const state = await (await read(projectId)).json(); const run = state.runs.find(item => item.sourceId === sourceId);
  assert.equal(run.scope, 'limited_range'); assert.equal(run.range, 'A1:B3'); assert.equal(run.rowsRead, 2);
  assert.equal(state.sources.find(item => item.id === sourceId).range, 'A1:B4');
});
