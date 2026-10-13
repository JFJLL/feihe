import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1' });
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/product-metrics-api', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(() => vite.close());
const projects = await vite.ssrLoadModule('/app/api/projects/route.ts');
const datasets = await vite.ssrLoadModule('/app/api/datasets/route.ts');
const definitions = await vite.ssrLoadModule('/app/api/metric-definitions/route.ts');
const metrics = await vite.ssrLoadModule('/app/api/metrics/route.ts');
const boards = await vite.ssrLoadModule('/app/api/dashboards/route.ts');
const dataMap = await vite.ssrLoadModule('/app/api/data-map/route.ts');
const { db } = await vite.ssrLoadModule('/lib/db.ts');
const req = (body, user = 'user-editor') => new Request('http://localhost/api', { method: 'POST', headers: { 'x-user-id': user, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const index = (project, user = 'user-editor') => definitions.GET(new Request('http://localhost/api/metric-definitions?projectId=' + project, { headers: { 'x-user-id': user } }));
let projectId, datasetId, metricId, metricKey, config, standardId;
test('shared metric API: a real definition and one real binding replace repeated embedded calculations', async () => {
  const created = await projects.POST(req({ action: 'create', name: '共享口径API', templateId: 'general_workbench' })); projectId = (await created.json()).id;
  const data = await datasets.POST(req({ projectId, sourceId: 'consult', name: '咨询成交', rows: [{ 成交: 10, 咨询: null, 渠道: '门店' }, { 成交: null, 咨询: 100, 渠道: '线上' }, { 成交: 20, 咨询: 100, 渠道: '门店' }] })); datasetId = (await data.json()).dataset.id;
  config = { datasetId, aggregation: 'ratio', numField: '成交', denField: '咨询', ratioBasis: 'paired', missingPolicy: 'skip', format: 'percent', unit: '%' };
  const saved = await definitions.POST(req({ action: 'save', projectId, name: '成交率', config })); assert.equal(saved.status, 200);
  const body = await saved.json(); metricId = body.id; metricKey = body.key; assert.equal(body.version, 1);
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM metric_bindings WHERE metric_id=?').bind(metricId).first()).n, 1);
  const preview = await metrics.POST(req({ projectId, card: { metricId } })); assert.equal(preview.status, 200);
  const result = (await preview.json()).metric; assert.equal(result.formattedValue, '20.0%'); assert.equal(result.pairedValidCount, 1); assert.equal(result.definition.id, metricId); assert.equal(result.definition.version, 1);
});
test('shared metric API: publication stores only a reference and both presentations resolve the same current version', async () => {
  const response = await boards.POST(req({ projectId, cards: [{ title: '总盘', type: 'metric_card', config: { metricId, numField: '恶意覆盖' } }, { title: '渠道', type: 'breakdown', config: { metricId, groupBy: '渠道' } }] })); assert.equal(response.status, 200);
  const stored = await db().prepare('SELECT config_json AS config FROM dashboard_cards WHERE project_id=?').bind(projectId).all();
  stored.results.forEach(row => { const value = JSON.parse(row.config); assert.equal(value.metricId, metricId); assert.equal(value.metricVersionPolicy, 'latest'); assert.equal(value.numField, undefined); });
  const updated = await definitions.POST(req({ action: 'save', projectId, id: metricId, expectedVersion: 1, name: '成交率', config: { ...config, ratioBasis: 'independent' } })); assert.equal(updated.status, 200);
  const results = await metrics.POST(req({ projectId, cards: [{ metricId }, { metricId, groupBy: '渠道', type: 'breakdown' }] }));
  const values = (await results.json()).metrics; values.forEach(value => { assert.equal(value.formattedValue, '15.0%'); assert.equal(value.definition.version, 2); });
  assert.equal(values[1].groups.find(group => group.label === '门店').formattedValue, '30.0%');
  const state = await (await index(projectId)).json(); assert.equal(state.metrics[0].impact.cards, 2); assert.equal(state.metrics[0].versions.length, 2);
});
test('shared metric API: pinned history, concurrent update rejection and the key API preserve their declared rule', async () => {
  const old = await metrics.POST(req({ projectId, card: { metricId, metricVersionPolicy: 'pinned', metricVersion: 1 } })); assert.equal((await old.json()).metric.formattedValue, '20.0%');
  const conflict = await definitions.POST(req({ action: 'save', projectId, id: metricId, expectedVersion: 1, name: '不能覆盖', config })); assert.equal(conflict.status, 409); assert.equal((await conflict.json()).serverVersion, 2);
  const current = await metrics.GET(new Request('http://localhost/api/metrics?projectId=' + projectId + '&key=' + metricKey, { headers: { 'x-user-id': 'user-editor' } })); assert.equal((await current.json()).metric.formattedValue, '15.0%');
});
test('shared metric API: viewer reads, cannot write, and an unrelated project cannot resolve the id', async () => {
  await projects.POST(req({ action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' }));
  assert.equal((await index(projectId, 'user-viewer')).status, 200);
  assert.equal((await definitions.POST(req({ action: 'save', projectId, name: '拒绝', config }, 'user-viewer'))).status, 403);
  const other = (await (await projects.POST(req({ action: 'create', name: '其他来源项目', templateId: 'general_workbench' }))).json()).id;
  assert.equal((await metrics.POST(req({ projectId: other, card: { metricId } }))).status, 404);
  assert.equal((await index(projectId, 'user-outsider')).status, 403);
});
test('shared metric API: legacy editors cannot mutate the shared object or binding outside version checks', async () => {
  assert.equal((await metrics.POST(req({ projectId, key: metricKey, name: '旧入口覆盖', aggregation: 'count' }))).status, 409);
  assert.equal((await dataMap.POST(req({ action: 'save', entity: 'metric', projectId, id: metricId, name: '覆盖' }))).status, 409);
  assert.equal((await dataMap.POST(req({ action: 'delete', entity: 'binding', projectId, id: metricId + ':binding' }))).status, 409);
});
test('shared metric API: standard templates require platform administration and contain no project source or period', async () => {
  assert.equal((await definitions.POST(req({ action: 'publish_standard', projectId, metricId }))).status, 403);
  const published = await definitions.POST(req({ action: 'publish_standard', projectId, metricId }, 'user-admin')); assert.equal(published.status, 200); standardId = (await published.json()).id;
  const state = await (await index(projectId)).json(); assert.equal(state.standards.length, 1);
  assert.equal(state.standards[0].config.datasetId, undefined); assert.equal(state.standards[0].config.from, undefined); assert.equal(state.standards[0].config.to, undefined);
  assert.equal((await metrics.POST(req({ projectId, card: { metricId: standardId } }))).status, 404);
  const bound = await definitions.POST(req({ action: 'save', projectId, name: '同名指标独立绑定', config: { ...config, ratioBasis: 'independent' }, standardId, standardVersion: 1 })); assert.equal(bound.status, 200);
  assert.equal((await bound.json()).standardId, standardId);
});
test('shared metric API: invalid ratio fields, incompatible count units and unknown fixed versions never publish', async () => {
  assert.equal((await definitions.POST(req({ action: 'save', projectId, name: '错误分母', config: { ...config, denField: '不存在' } }))).status, 400);
  assert.equal((await definitions.POST(req({ action: 'save', projectId, name: '错误计数单位', config: { datasetId, aggregation: 'count', format: 'percent', unit: '%', percentScale: 'fraction' } }))).status, 400);
  assert.equal((await metrics.POST(req({ projectId, card: { metricId, metricVersionPolicy: 'pinned', metricVersion: 900 } }))).status, 409);
});
