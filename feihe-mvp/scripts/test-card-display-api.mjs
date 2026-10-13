import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1' });
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/card-display-api', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(() => vite.close());
const projects = await vite.ssrLoadModule('/app/api/projects/route.ts');
const datasets = await vite.ssrLoadModule('/app/api/datasets/route.ts');
const metrics = await vite.ssrLoadModule('/app/api/metrics/route.ts');
const dashboards = await vite.ssrLoadModule('/app/api/dashboards/route.ts');
function post(route, body) { return route.POST(new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-admin' }, body: JSON.stringify(body) })); }
function get(route, query) { return route.GET(new Request('http://localhost/api/test?' + new URLSearchParams(query), { headers: { 'x-user-id': 'user-admin' } })); }
async function setup(id) {
  assert.equal((await post(projects, { action: 'create', id, name: id, templateId: 'general_workbench' })).status, 200);
  const response = await post(datasets, { projectId: id, sourceId: 'display', name: '显示测试', columns: [{ key: 'p', name: '完成率', type: 'number', numericUnit: 'percent', percentScale: 'fraction' }, { key: 'amount', name: '金额', type: 'number' }], rows: [{ p: 0.005, amount: 10 }, { p: 0.015, amount: 20 }] });
  assert.equal(response.status, 200); return (await response.json()).dataset.id;
}
test('API preview rejects a count result that inherits percent field units', async () => {
  const projectId = 'card-count-invalid', datasetId = await setup(projectId);
  const response = await post(metrics, { projectId, card: { datasetId, aggregation: 'nonempty_count', field: 'p', format: 'percent', unit: '%', percentScale: 'fraction', displayOrigin: 'auto' } });
  assert.equal(response.status, 400);
});
test('API preview rejects an automatic percent configuration on an ordinary amount field', async () => {
  const projectId = 'card-field-invalid', datasetId = await setup(projectId);
  const response = await post(metrics, { projectId, card: { datasetId, aggregation: 'avg', field: 'amount', format: 'percent', unit: '%', percentScale: 'fraction', displayOrigin: 'auto' } });
  assert.equal(response.status, 400);
});
test('API publish rejects incompatible count units and preserves the existing dashboard', async () => {
  const projectId = 'card-publish-invalid', datasetId = await setup(projectId);
  const before = (await (await get(dashboards, { projectId })).json()).cards;
  const response = await post(dashboards, { projectId, cards: [{ title: '错误计数', type: 'metric_card', config: { datasetId, aggregation: 'distinct_count', field: 'p', format: 'percent', unit: '%', percentScale: 'fraction' } }] });
  assert.equal(response.status, 400);
  assert.deepEqual((await (await get(dashboards, { projectId })).json()).cards, before);
});
test('API unit transitions persist through dashboard publish/GET and full row reads', async () => {
  const { transitionCardConfig } = await vite.ssrLoadModule('/lib/metrics/config.ts');
  const projectId = 'card-display-roundtrip', datasetId = await setup(projectId);
  const columns = [{ key: 'p', name: '完成率', type: 'number', numericUnit: 'percent', percentScale: 'fraction' }, { key: 'amount', name: '金额', type: 'number' }];
  const percent = transitionCardConfig({ datasetId, aggregation: 'avg', displayOrigin: 'auto', format: 'number' }, { kind: 'field', field: 'p' }, columns);
  const amount = transitionCardConfig(percent, { kind: 'field', field: 'amount' }, columns);
  const nonempty = transitionCardConfig(percent, { kind: 'aggregation', aggregation: 'nonempty_count' }, columns);
  const distinct = transitionCardConfig(percent, { kind: 'aggregation', aggregation: 'distinct_count' }, columns);
  const configs = [percent, amount, nonempty, distinct];
  const evaluation = await post(metrics, { projectId, cards: configs }); assert.equal(evaluation.status, 200);
  assert.deepEqual((await evaluation.json()).metrics.map(m => m.formattedValue), ['1.0%', '15', '2', '2']);
  const saved = await post(dashboards, { projectId, cards: configs.map((config, i) => ({ title: '转换' + i, type: 'metric_card', config })) }); assert.equal(saved.status, 200);
  const cards = (await (await get(dashboards, { projectId })).json()).cards;
  assert.deepEqual(cards.map(c => JSON.parse(c.configJson)), configs.map(c => JSON.parse(JSON.stringify(c))));
  for (const c of cards.slice(1)) { const stored = JSON.parse(c.configJson); assert.equal(stored.format, 'number'); assert.equal(stored.unit, ''); assert.equal(stored.percentScale, undefined); }
  const stored = (await (await get(datasets, { projectId, id: datasetId, all: 'true' })).json()).dataset;
  assert.deepEqual(stored.rows.map(r => r.p), [0.005, 0.015]);
});
test('API rejects pending display confirmation but keeps an explicit compatible currency choice', async () => {
  const projectId = 'card-manual-display', datasetId = await setup(projectId);
  const response = await post(metrics, { projectId, card: { datasetId, aggregation: 'avg', field: 'amount', format: 'percent', unit: '%', percentScale: 'fraction', displayOrigin: 'manual', displayNeedsConfirmation: true } });
  assert.equal(response.status, 400);
  const compatible = await post(metrics, { projectId, card: { datasetId, aggregation: 'avg', field: 'amount', format: 'currency', unit: '元', displayOrigin: 'manual' } });
  assert.equal(compatible.status, 200); assert.equal((await compatible.json()).metric.formattedValue, '¥15.00');
});
