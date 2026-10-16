import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1' });
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/product-adapters-api', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(() => vite.close());
const projects = await vite.ssrLoadModule('/app/api/projects/route.ts');
const recommendations = await vite.ssrLoadModule('/app/api/metric-recommendations/route.ts');
const business = await vite.ssrLoadModule('/app/api/business-analytics/route.ts');
const metrics = await vite.ssrLoadModule('/app/api/metrics/route.ts');
const definitions = await vite.ssrLoadModule('/app/api/metric-definitions/route.ts');
const { saveDataset } = await vite.ssrLoadModule('/lib/datasets.ts');
const { db } = await vite.ssrLoadModule('/lib/db.ts');
const req = (body, user = 'user-editor') => new Request('http://localhost/api', { method: 'POST', headers: { 'x-user-id': user, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const get = (route, params, user = 'user-editor') => route.GET(new Request('http://localhost/api?' + new URLSearchParams(params), { headers: { 'x-user-id': user } }));
const create = async templateId => (await (await projects.POST(req({ action: 'create', name: '真实字段API' + templateId, templateId }))).json()).id;
const general = await create('general_workbench');
const generalData = await saveDataset(general, 'four-columns', '陌生部门', [{ day: '2026-10-01', channel: '门店', consult: 100, deal: 20 }, { day: '2026-10-02', channel: '线上', consult: 200, deal: 10 }], [
  { key: 'day', name: '实际业务日', type: 'date' }, { key: 'channel', name: '渠道', type: 'text' }, { key: 'consult', name: '咨询人数', type: 'number' }, { key: 'deal', name: '成交人数', type: 'number' },
]);
let generalPlan, adProject, adData, adPlan, confirmed;
test('recommendation API: real field labels and types produce only valid four-column metrics with actual previews', async () => {
  const response = await get(recommendations, { projectId: general, datasetId: generalData.id }); assert.equal(response.status, 200); generalPlan = await response.json();
  assert.deepEqual(generalPlan.recommendations.map(item => item.name), ['记录数量', '咨询人数合计', '成交人数合计', '成交率']);
  assert.equal(generalPlan.roles.date, 'day'); assert.equal(generalPlan.recommendations[3].preview.formattedValue, '10.0%'); assert.equal(generalPlan.recommendations[3].config.numField, 'deal');
  assert.ok(generalPlan.recommendations.every(item => !['任务完成率', '预算执行率'].includes(item.name)));
});
test('recommendation API: repeated confirmation reuses definitions and real bindings without merging arbitrary names or resetting versions', async () => {
  const body = { projectId: general, datasetId: generalData.id, datasetVersion: 1, selected: generalPlan.recommendations.map(item => item.key) };
  const first = await recommendations.POST(req(body)); assert.equal(first.status, 200); const saved = await first.json();
  const second = await recommendations.POST(req(body)); assert.equal(second.status, 200); assert.deepEqual((await second.json()).confirmed.map(item => item.metricId), saved.confirmed.map(item => item.metricId));
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM metric_definitions WHERE project_id=?').bind(general).first()).n, 4);
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM metric_bindings WHERE project_id=?').bind(general).first()).n, 4);
});
test('recommendation API: confirmed field changes reject stale data and do not silently replace edited metric rules', async () => {
  assert.equal((await recommendations.POST(req({ projectId: general, datasetId: generalData.id, datasetVersion: 0, selected: ['records'] }))).status, 409);
  const state = await (await get(definitions, { projectId: general })).json(); const edited = state.metrics.find(item => item.name === '成交率');
  assert.equal((await definitions.POST(req({ projectId: general, action: 'save', id: edited.id, expectedVersion: 1, name: edited.name, config: { ...edited.config, ratioBasis: 'independent' } }))).status, 200);
  assert.equal((await recommendations.POST(req({ projectId: general, datasetId: generalData.id, datasetVersion: 1, selected: ['conversion'] }))).status, 409);
  const after = await (await get(definitions, { projectId: general })).json(); assert.equal(after.metrics.find(item => item.id === edited.id).config.ratioBasis, 'independent');
});
test('ad adapter API: five actual columns bind the page to the same shared IDs, totals, daily values and channels', async () => {
  adProject = await create('ad_performance'); adData = await saveDataset(adProject, 'five-columns', '另一客户投放', [{ day: '2026-10-01', channel: '另一客户门店', cost: 100, exposure: 1000, hit: 10 }, { day: '2026-10-02', channel: '另一客户线上', cost: 200, exposure: 3000, hit: 60 }], [
    { key: 'day', name: '日期', type: 'date' }, { key: 'channel', name: '渠道', type: 'text' }, { key: 'cost', name: '花费', type: 'number' }, { key: 'exposure', name: '曝光', type: 'number' }, { key: 'hit', name: '点击', type: 'number' },
  ]);
  adPlan = await (await get(recommendations, { projectId: adProject, datasetId: adData.id })).json(); assert.deepEqual(adPlan.missing, []);
  const saved = await recommendations.POST(req({ projectId: adProject, datasetId: adData.id, datasetVersion: 1, selected: adPlan.recommendations.map(item => item.key), bindBusiness: true })); assert.equal(saved.status, 200); confirmed = (await saved.json()).confirmed;
  const value = await (await get(business, { projectId: adProject })).json(); assert.equal(value.configured, true); assert.equal(value.metrics.spend.value, 300); assert.equal(value.metrics.impressions.value, 4000); assert.equal(value.metrics.clicks.value, 70); assert.equal(value.metrics.ctr.numerator, 70); assert.equal(value.metrics.ctr.denominator, 4000); assert.equal(value.metrics.ctr.value, 70 / 4000 * 100); assert.equal(value.metrics.ctr.formattedValue, '1.8%');
  assert.equal(value.metrics.spend.formattedValue, '300'); assert.equal(value.metrics.spend.unit, ''); assert.equal(value.trends.spend.trend[0].value, 100); assert.equal(value.channel.groups[1].value, 200);
  assert.equal(value.metrics.spend.definition.id, confirmed.find(item => item.key === 'spend').metricId);
});
test('ad adapter API: a metric edit changes both the dedicated page and ordinary cards at the actual confirmed version', async () => {
  const state = await (await get(definitions, { projectId: adProject })).json(); const spend = state.metrics.find(item => item.name === '广告消耗');
  assert.equal((await definitions.POST(req({ projectId: adProject, action: 'save', id: spend.id, expectedVersion: 1, name: spend.name, config: { ...spend.config, aggregation: 'avg' } }))).status, 200);
  const result = await (await get(business, { projectId: adProject })).json(); assert.equal(result.metrics.spend.value, 150); assert.equal(result.metrics.spend.definition.version, 2);
  const card = await metrics.POST(req({ projectId: adProject, card: { metricId: spend.id } })); assert.equal((await card.json()).metric.value, 150);
});
test('ad adapter API: project range and field filter are computed locally, not applied to an unrelated historical feed', async () => {
  const query = JSON.stringify({ from: '2026-10-01', to: '2026-10-01', filters: [{ key: 'channel', value: '另一客户门店' }] });
  const result = await (await get(business, { projectId: adProject, query })).json(); assert.equal(result.metrics.spend.value, 100); assert.equal(result.metrics.ctr.formattedValue, '1.0%'); assert.equal(result.trends.spend.trend.length, 1); assert.equal(result.channel.groups.length, 1);
});
test('recommendation/binding API: viewer reads but cannot configure; foreign dataset, invalid field roles and missing ad fields refuse binding', async () => {
  await projects.POST(req({ action: 'add_member', projectId: adProject, userId: 'user-viewer', role: 'viewer' }));
  assert.equal((await get(business, { projectId: adProject }, 'user-viewer')).status, 200);
  assert.equal((await get(business, { projectId: adProject }, 'user-no-access')).status, 403);
  assert.equal((await recommendations.POST(req({ projectId: adProject, datasetId: adData.id, datasetVersion: 1, selected: ['records'] }, 'user-viewer'))).status, 403);
  assert.equal((await recommendations.POST(req({ projectId: general, datasetId: adData.id, datasetVersion: 1, selected: ['records'] }))).status, 400);
  assert.equal((await recommendations.POST(req({ projectId: adProject, datasetId: adData.id, datasetVersion: 1, selected: ['records'], roles: { date: 'cost' } }))).status, 400);
  assert.equal((await recommendations.POST(req({ projectId: general, datasetId: generalData.id, datasetVersion: 1, selected: ['records'], bindBusiness: true }))).status, 400);
});
