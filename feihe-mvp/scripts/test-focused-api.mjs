import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
import { handleFeishuFixture } from '../tests/browser/feishu-fixture.mjs';

Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1', FEISHU_APP_ID: 'fixture-app', FEISHU_APP_SECRET: 'fixture-secret', KEYSTONE_API_KEY: 'fixture-disabled' });
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = String(input instanceof Request ? input.url : input);
  return url.startsWith('https://open.feishu.cn/') ? handleFeishuFixture(url) : originalFetch(input, options);
};
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/focused-api', server: { middlewareMode: true }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(async () => { globalThis.fetch = originalFetch; await vite.close(); });
const projects = await vite.ssrLoadModule('/app/api/projects/route.ts');
const datasets = await vite.ssrLoadModule('/app/api/datasets/route.ts');
const metrics = await vite.ssrLoadModule('/app/api/metrics/route.ts');
const dashboards = await vite.ssrLoadModule('/app/api/dashboards/route.ts');
const sync = await vite.ssrLoadModule('/app/api/feishu/sync/route.ts');
const inspect = await vite.ssrLoadModule('/app/api/feishu/inspect/route.ts');
const { inferColumnType } = await vite.ssrLoadModule('/lib/column-types.ts');
const { db, ensureSchema } = await vite.ssrLoadModule('/lib/db.ts');
await ensureSchema();
function post(route, body) { return route.POST(new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-admin' }, body: JSON.stringify(body) })); }
function get(route, query) { return route.GET(new Request('http://localhost/api/test?' + new URLSearchParams(query), { headers: { 'x-user-id': 'user-admin' } })); }
async function created(projectId) { assert.equal((await post(projects, { action: 'create', id: projectId, name: projectId, templateId: 'general_workbench' })).status, 200); }
async function saved(projectId, documentToken, rules, id) {
  const result = await post(inspect, { projectId, url: 'https://fixture.feishu.cn/sheets/' + documentToken });
  assert.equal(result.status, 200); const detected = (await result.json()).detected;
  const context = { projectId, documentToken: detected.documentToken, sheetId: 'sheetA', fields: detected.preview.schema || detected.preview.headers.map(key => ({ key, type: inferColumnType(detected.preview.rows.map(row => row[key])) })) };
  const response = await post(projects, { action: 'save_source', projectId, id, name: '验收来源', kind: 'general', type: 'feishu_sheet', spreadsheet: 'https://fixture.feishu.cn/sheets/' + documentToken, sheetId: 'sheetA', mappingJson: JSON.stringify({ context, rules }) });
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json())); return (await response.json()).id;
}
async function dataset(projectId) {
  const list = (await (await get(datasets, { projectId })).json()).datasets;
  assert.equal(list.length, 1);
  return (await (await get(datasets, { projectId, id: list[0].id, all: 'true' })).json()).dataset;
}

test('API percent: real inspect/map/sync stores tagged, native fraction and native points once', async () => {
  const projectId = 'focused-api-percent'; await created(projectId);
  const rules = ['比例文本', '均值百分比', '直接比例', '直接百分点'].map(field => ({ sourceField: field, targetField: field, type: 'number', numericUnit: 'percent', sourcePercentScale: field === '直接百分点' ? 'percentage_points' : 'fraction' }));
  const sourceId = await saved(projectId, 'FocusedPercentDoc', rules);
  const synchronized = await post(sync, { projectId, sourceId }); assert.equal(synchronized.status, 200, JSON.stringify(await synchronized.clone().json()));
  const stored = await dataset(projectId);
  assert.deepEqual(stored.rows.map(r => r['比例文本']), [0, 0.005, 0.01, 0.011, 1, 1.5]);
  assert.deepEqual(stored.rows.slice(0, 2).map(r => [r['直接比例'], r['直接百分点']]), [[0.005, 0.005], [0.015, 0.015]]);
  assert.deepEqual(stored.columns.find(c => c.key === '比例文本'), { key: '比例文本', name: '比例文本', type: 'number', numericUnit: 'percent', percentScale: 'fraction' });
  const evaluated = await post(metrics, { projectId, card: { datasetId: stored.id, aggregation: 'avg', field: '均值百分比', format: 'percent', percentScale: 'fraction' } });
  assert.equal(evaluated.status, 200); assert.equal((await evaluated.json()).metric.formattedValue, '1.0%');
});
test('API percent: metric definitions and dashboard round-trip explicit unit, legacy ambiguity rejected', async () => {
  const projectId = 'focused-api-percent', stored = await dataset(projectId);
  assert.equal((await post(metrics, { projectId, key: 'small_avg', name: '普通百分平均', aggregation: 'avg', formula: '均值百分比', unit: '%', format: 'percent', percentScale: 'fraction', filterJson: '{"scope":"kept"}' })).status, 200);
  const definitions = (await (await get(metrics, { projectId })).json()).metrics;
  assert.equal(definitions.find(m => m.key === 'small_avg').percentScale, 'fraction');
  assert.equal(JSON.parse(definitions.find(m => m.key === 'small_avg').filterJson).scope, 'kept');
  assert.equal((await (await get(metrics, { projectId, key: 'small_avg', datasetId: stored.id })).json()).metric.formattedValue, '1.0%');
  const card = { datasetId: stored.id, metric: 'custom', aggregation: 'avg', field: '均值百分比', format: 'percent', percentScale: 'fraction' };
  assert.equal((await post(dashboards, { projectId, cards: [{ title: '普通百分平均', type: 'metric_card', config: card }] })).status, 200);
  assert.deepEqual(JSON.parse((await (await get(dashboards, { projectId })).json()).cards[0].configJson), card);
  assert.equal((await post(metrics, { projectId, key: 'ambiguous', name: '历史模糊', aggregation: 'avg', formula: '均值百分比', unit: '%' })).status, 400);
  assert.equal((await post(metrics, { projectId, card: { ...card, percentScale: undefined } })).status, 400);
});
test('API source: real save succeeds then beyond-preview validation fails; correct same ID, one dataset', async () => {
  const projectId = 'focused-api-source'; await created(projectId);
  const rules = [{ sourceField: '任务', targetField: '任务', type: 'text' }, { sourceField: '金额', targetField: '金额', type: 'number', required: true }];
  const sourceId = await saved(projectId, 'FocusedLateRequiredDoc', rules);
  const failed = await post(sync, { projectId, sourceId }); assert.equal(failed.status, 500); assert.match((await failed.json()).error, /第 12 行.*必填/);
  assert.equal((await (await get(datasets, { projectId })).json()).datasets.length, 0);
  const workspace = await (await get(projects, {})).json(); const sources = workspace.sources.filter(s => s.projectId === projectId);
  assert.equal(sources.length, 1); assert.equal(sources[0].id, sourceId); assert.match(sources[0].lastError, /必填/);
  assert.equal(await saved(projectId, 'FocusedLateRequiredDoc', rules.map(r => ({ ...r, required: false })), sourceId), sourceId);
  assert.equal((await post(sync, { projectId, sourceId })).status, 200);
  const stored = await dataset(projectId); assert.equal(stored.sourceId, sourceId); assert.equal(stored.rowCount, 12); assert.equal(stored.rows[11]['金额'], null);
  assert.equal((await (await get(projects, {})).json()).sources.filter(s => s.projectId === projectId).length, 1);
});
test('API ratio: paired and independent definitions persist their basis and expose actual coverage', async () => {
  const projectId = 'focused-api-ratio'; await created(projectId);
  const rows = [{ n: 10, d: null, g: '缺失' }, { n: null, d: 100, g: '缺失' }, { n: 20, d: 100, g: '完整' }];
  assert.equal((await post(datasets, { projectId, sourceId: 'ratio', name: '比率数据', rows })).status, 200);
  const stored = await dataset(projectId);
  const response = await post(metrics, { projectId, card: { datasetId: stored.id, aggregation: 'ratio', numField: 'n', denField: 'd', groupBy: 'g' } });
  const paired = (await response.json()).metric; assert.equal(response.status, 200); assert.equal(paired.value, 20); assert.equal(paired.sampleSize, 1); assert.equal(paired.groups[0].value, null); assert.equal(paired.groups[0].pairedValidCount, 0);
  assert.equal((await post(metrics, { projectId, key: 'independent', name: '独立汇总', aggregation: 'ratio', formula: 'n/d', unit: '%', ratioBasis: 'independent', missingPolicy: 'skip' })).status, 200);
  const independent = (await (await get(metrics, { projectId, key: 'independent', datasetId: stored.id, groupBy: 'g' })).json()).metric;
  assert.equal(independent.value, 15); assert.equal(independent.numeratorValidCount, 2); assert.equal(independent.denominatorValidCount, 2); assert.equal(independent.pairedValidCount, 1); assert.equal(independent.sampleSize, 1); assert.equal(independent.numeratorCoverage, 2 / 3); assert.equal(independent.groups[0].value, 10);
  assert.equal((await (await get(metrics, { projectId })).json()).metrics.find(m => m.key === 'independent').ratioBasis, 'independent');
});
test('API historical percent: existing configuration returns explicit needs-confirmation with rows unchanged', async () => {
  const projectId = 'focused-api-ratio';
  await db().prepare("INSERT INTO metric_definitions(id,project_id,key,name,aggregation,formula,unit,format,created_at,updated_at) VALUES(?,?,?,'历史百分卡','avg','n','%','percent',?,?)").bind('legacy-percent', projectId, 'legacy-percent', new Date().toISOString(), new Date().toISOString()).run();
  const before = await dataset(projectId);
  const metric = (await (await get(metrics, { projectId, key: 'legacy-percent', datasetId: before.id })).json()).metric;
  assert.equal(metric.status, 'needs_configuration'); assert.equal(metric.value, null);
  assert.deepEqual((await dataset(projectId)).rows, before.rows);
});
test('API dataset: direct percent writes use the same fractional contract; mixed untyped numbers rejected', async () => {
  const projectId = 'focused-api-direct-percent'; await created(projectId);
  assert.equal((await post(datasets, { projectId, sourceId: 'direct', name: '直接百分导入', rows: [{ p: '0.5%' }, { p: '1.5%' }] })).status, 200);
  let stored = await dataset(projectId);
  assert.deepEqual(stored.rows, [{ p: 0.005 }, { p: 0.015 }]);
  assert.equal(stored.columns[0].percentScale, 'fraction');
  assert.equal((await post(datasets, { projectId, sourceId: 'direct', name: '直接百分导入', rows: [{ p: 0.5 }, { p: '1.5%' }], columns: [{ key: 'p', name: '百分字段', type: 'number', numericUnit: 'percent', percentScale: 'percentage_points' }] })).status, 200);
  stored = await dataset(projectId); assert.deepEqual(stored.rows, [{ p: 0.005 }, { p: 0.015 }]); assert.equal(stored.columns[0].percentScale, 'fraction');
  const invalid = await post(datasets, { projectId, sourceId: 'direct', name: '非法混合', rows: [{ p: 0.5 }, { p: '1.5%' }] });
  assert.equal(invalid.status, 500); assert.match((await invalid.json()).error, /声明来源数值单位/);
  assert.deepEqual((await dataset(projectId)).rows, stored.rows);
});
