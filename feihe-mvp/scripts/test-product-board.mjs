import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1' });
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/product-board-api', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(() => vite.close());
const projects = await vite.ssrLoadModule('/app/api/projects/route.ts');
const definitions = await vite.ssrLoadModule('/app/api/metric-definitions/route.ts');
const metrics = await vite.ssrLoadModule('/app/api/metrics/route.ts');
const boards = await vite.ssrLoadModule('/app/api/dashboards/route.ts');
const { saveDataset } = await vite.ssrLoadModule('/lib/datasets.ts');
const { evaluateCardMetric } = await vite.ssrLoadModule('/lib/metrics/engine.ts');
const { db } = await vite.ssrLoadModule('/lib/db.ts');
const req = (body, user = 'user-editor') => new Request('http://localhost/api', { method: 'POST', headers: { 'x-user-id': user, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const projectId = (await (await projects.POST(req({ action: 'create', name: '共同周期API', templateId: 'general_workbench' }))).json()).id;
const dataset = await saveDataset(projectId, 'four-columns', '咨询成交', [
  { at: '2026-10-01 12:00:00', channel: '门店', consult: 100, sales: 20 },
  { at: '2026-10-01 23:59:59', channel: '线上', consult: 100, sales: 10 },
  { at: '2026-10-02 00:00:00', channel: '门店', consult: 100, sales: 50 },
  { at: null, channel: '门店', consult: 100, sales: 90 },
], [{ key: 'at', name: '日期', type: 'date' }, { key: 'channel', name: '渠道', type: 'text' }, { key: 'consult', name: '咨询人数', type: 'number' }, { key: 'sales', name: '成交人数', type: 'number' }]);
const config = { datasetId: dataset.id, aggregation: 'ratio', numField: 'sales', denField: 'consult', dateField: 'at', missingPolicy: 'skip', ratioBasis: 'paired', format: 'percent', unit: '%' };
const metricId = (await (await definitions.POST(req({ action: 'save', projectId, name: '成交率', config }))).json()).id;
const query = { from: '2026-10-01', to: '2026-10-01' };
test('board API: project period excludes undated records and the next midnight, includes end-day noon', async () => {
  const response = await metrics.POST(req({ projectId, query, card: { metricId } })); assert.equal(response.status, 200);
  const value = (await response.json()).metric; assert.equal(value.formattedValue, '15.0%'); assert.equal(value.pairedValidCount, 2);
});
test('board API: time buckets and table rows share the same definition, full calculation and context', async () => {
  const result = await evaluateCardMetric(projectId, { metricId, type: 'time_trend' }, query);
  assert.equal(result.formattedValue, '15.0%'); assert.equal(result.trend.length, 1); assert.equal(result.trend[0].formattedValue, '15.0%'); assert.equal(result.trend[0].pairedValidCount, 2);
  const table = await evaluateCardMetric(projectId, { metricId, type: 'detail_table' }, query);
  assert.equal(table.detail.total, 2); assert.equal(table.detail.columns.find(c => c.key === 'sales').name, '成交人数'); assert.equal(table.detail.rows[0].sales, 20);
});
test('board API: project filter is applied to every presentation and an independent card range is labeled', async () => {
  const filtered = await evaluateCardMetric(projectId, { metricId, type: 'time_trend' }, { ...query, filters: [{ key: 'channel', value: '门店' }] });
  assert.equal(filtered.formattedValue, '20.0%'); assert.equal(filtered.trend[0].formattedValue, '20.0%');
  const independent = await evaluateCardMetric(projectId, { metricId, rangePolicy: 'independent', from: '2026-10-02', to: '2026-10-02' }, query);
  assert.equal(independent.formattedValue, '50.0%'); assert.equal(independent.appliedQuery.rangePolicy, 'independent');
});
test('board API: canonical period, filter, target and shared reference survive atomic publication and GET', async () => {
  const layout = { kind: 'project_board', version: 1, query: { ...query, filters: [{ key: 'channel', value: '门店' }] } };
  const saved = await boards.POST(req({ projectId, layout, cards: [{ title: '目标成交率', type: 'progress_card', config: { metricId, target: 20 } }, { title: '日期走势', type: 'time_trend', config: { metricId } }, { title: '原始明细', type: 'detail_table', config: { metricId } }] }));
  assert.equal(saved.status, 200);
  const state = await (await boards.GET(new Request('http://localhost/api/dashboards?projectId=' + projectId, { headers: { 'x-user-id': 'user-editor' } }))).json();
  assert.deepEqual(JSON.parse(state.dashboards[0].layoutJson), layout);
  assert.equal(JSON.parse(state.cards[0].configJson).target, 20); assert.equal(JSON.parse(state.cards[0].configJson).numField, undefined);
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM dashboard_cards WHERE project_id=?').bind(projectId).first()).n, 3);
});
test('board API: invalid date, unknown filter, missing date binding and invalid targets cannot produce normal results or publish', async () => {
  for (const query of [{ from: '2026-02-30' }, { from: '2026-10-02', to: '2026-10-01' }, { filters: [{ key: 'other-project-field', value: 'x' }] }]) {
    assert.equal((await metrics.POST(req({ projectId, query, card: { metricId } }))).status, 400);
  }
  for (const target of [0, -1, '20']) assert.equal((await boards.POST(req({ projectId, cards: [{ title: '无效目标', type: 'progress_card', config: { metricId, target } }] }))).status, 400);
  const noDate = (await (await definitions.POST(req({ action: 'save', projectId, name: '尚未设置时间', config: { ...config, dateField: '' } }))).json()).id;
  assert.equal((await metrics.POST(req({ projectId, query, card: { metricId: noDate } }))).status, 400);
  assert.equal((await boards.POST(req({ projectId, layout: { kind: 'project_board', version: 1, query }, cards: [{ title: '错误周期', type: 'metric_card', config: { metricId: noDate } }] }))).status, 400);
});
test('board API: table pagination uses storage keys, clamps overflow and never changes the all-row metric', async () => {
  const rows = Array.from({ length: 31 }, (_, i) => ({ at: '2026-10-01', channel: '门店', consult: 100, sales: i + 1 }));
  await saveDataset(projectId, 'four-columns', '咨询成交', rows, dataset.columns);
  const result = await evaluateCardMetric(projectId, { metricId, type: 'detail_table' }, { ...query, detailPage: 99 });
  assert.equal(result.detail.page, 3); assert.equal(result.detail.totalPages, 3); assert.equal(result.detail.total, 31); assert.equal(result.detail.rows.length, 1); assert.equal(result.detail.rows[0].sales, 31);
  assert.equal(result.formattedValue, '16.0%'); assert.equal(result.sampleSize, 31);
});
test('board API: saved query shares optimistic conflict and viewer protection with cards', async () => {
  await projects.POST(req({ action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' }));
  const before = await db().prepare('SELECT version,layout_json AS layout FROM dashboards WHERE project_id=?').bind(projectId).first();
  assert.equal((await boards.POST(req({ projectId, version: before.version - 1, layout: { kind: 'project_board', version: 1, query: {} }, cards: [] }))).status, 409);
  assert.equal((await boards.POST(req({ projectId, version: before.version, layout: { kind: 'project_board', version: 1, query: {} }, cards: [] }, 'user-viewer'))).status, 403);
  assert.deepEqual(await db().prepare('SELECT version,layout_json AS layout FROM dashboards WHERE project_id=?').bind(projectId).first(), before);
});
test('board API: paired/independent daily ratios retain genuine zero, missing gaps and observed coverage', async () => {
  const data = await saveDataset(projectId, 'daily-ratio', '成对时间表', [
    { at: '2026-10-01', channel: '门店', consult: null, sales: 10 },
    { at: '2026-10-01', channel: '门店', consult: 100, sales: null },
    { at: '2026-10-01', channel: '门店', consult: 100, sales: 20 },
    { at: '2026-10-03', channel: '门店', consult: 100, sales: 0 },
    { at: null, channel: '门店', consult: 100, sales: 50 },
  ], dataset.columns);
  const card = { ...config, datasetId: data.id, type: 'time_trend' }, period = { from: '2026-10-01', to: '2026-10-03' };
  const paired = await evaluateCardMetric(projectId, card, period);
  assert.equal(paired.trend[0].formattedValue, '20.0%'); assert.equal(paired.trend[0].pairedValidCount, 1);
  assert.equal(paired.trend[1].date, '2026-10-02'); assert.equal(paired.trend[1].value, null);
  assert.equal(paired.trend[2].formattedValue, '0.0%'); assert.equal(paired.trend[2].pairedValidCount, 1);
  assert.equal(paired.appliedQuery.undatedRows, 1);
  const independent = await evaluateCardMetric(projectId, { ...card, ratioBasis: 'independent' }, period);
  assert.equal(independent.trend[0].formattedValue, '15.0%'); assert.equal(independent.trend[0].numeratorValidCount, 2); assert.equal(independent.trend[0].denominatorValidCount, 2); assert.equal(independent.trend[0].pairedValidCount, 1);
  const zero = await evaluateCardMetric(projectId, { ...card, missingPolicy: 'zero' }, period);
  assert.equal(zero.trend[0].formattedValue, '15.0%'); assert.equal(zero.trend[0].calculationSampleSize, 3); assert.equal(zero.trend[0].pairedValidCount, 1);
});
test('board API: missing averages use the same effective sample in scalar/group/day and percent target protocol stays fractional', async () => {
  const data = await saveDataset(projectId, 'daily-average', '平均时间表', [{ at: '2026-10-01', channel: '门店', sales: 10 }, { at: '2026-10-01', channel: '门店', sales: null }], dataset.columns);
  const result = await evaluateCardMetric(projectId, { datasetId: data.id, type: 'time_trend', aggregation: 'avg', field: 'sales', dateField: 'at', groupBy: 'channel', missingPolicy: 'skip' }, query);
  assert.equal(result.value, 10); assert.equal(result.sampleSize, 1); assert.equal(result.groups[0].value, 10); assert.equal(result.trend[0].value, 10); assert.equal(result.trend[0].sampleSize, 1);
  const percent = await saveDataset(projectId, 'fraction-average', '比例', [{ at: '2026-10-01', percent: '0.5%' }, { at: '2026-10-01', percent: '1.5%' }]);
  const definition = await definitions.POST(req({ projectId, action: 'save', name: '比例平均', config: { datasetId: percent.id, aggregation: 'avg', field: 'percent', dateField: 'at', format: 'percent', unit: '%', percentScale: 'fraction' } }));
  const id = (await definition.json()).id;
  const saved = await boards.POST(req({ projectId, layout: { kind: 'project_board', version: 1, query: {} }, cards: [{ title: '比例目标', type: 'progress_card', config: { metricId: id, target: 0.02 } }] })); assert.equal(saved.status, 200);
  assert.equal(JSON.parse((await saved.json()).cards[0].configJson).target, 0.02);
  const trend = await evaluateCardMetric(projectId, { metricId: id, type: 'time_trend' }); assert.equal(trend.value, 0.01); assert.equal(trend.trend[0].formattedValue, '1.0%');
});
test('board API: a UTC instant is grouped and bounded in the configured project time zone', async () => {
  for (const [timeZone, last, next] of [['Asia/Shanghai', '2026-10-01T15:59:59Z', '2026-10-01T16:00:00Z'], ['America/New_York', '2026-10-02T03:59:59Z', '2026-10-02T04:00:00Z']]) {
    await db().prepare("INSERT INTO project_settings(id,project_id,key,value,updated_at) VALUES(?,?,'timezone',?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(projectId + ':timezone', projectId, JSON.stringify(timeZone), new Date().toISOString()).run();
    const data = await saveDataset(projectId, 'timezone', '时区表', [{ at: last, consult: 100, sales: 10 }, { at: next, consult: 100, sales: 50 }], dataset.columns);
    const result = await evaluateCardMetric(projectId, { ...config, datasetId: data.id, type: 'time_trend' }, query);
    assert.equal(result.formattedValue, '10.0%'); assert.equal(result.trend.length, 1); assert.equal(result.trend[0].date, '2026-10-01'); assert.equal(result.appliedQuery.timeZone, timeZone);
  }
});
test('board API: a goal confirmed against fractional percent cannot silently become a count goal after a shared definition update', async () => {
  const row = await db().prepare("SELECT id,filter_json AS config FROM metric_definitions WHERE project_id=? AND name='比例平均'").bind(projectId).first();
  const original = JSON.parse(row.config).versions[0].config;
  const card = await db().prepare("SELECT config_json AS config FROM dashboard_cards WHERE project_id=? AND title='比例目标'").bind(projectId).first();
  const reference = JSON.parse(card.config);
  assert.equal(reference.target, 0.02);
  const updated = await definitions.POST(req({ action: 'save', projectId, id: row.id, expectedVersion: 1, name: '比例平均', config: { ...original, aggregation: 'count', field: '', format: 'number', unit: '', percentScale: undefined } })); assert.equal(updated.status, 200);
  const stale = await metrics.POST(req({ projectId, card: { ...reference, type: 'progress_card' } }));
  assert.equal(stale.status, 400); assert.match((await stale.json()).error, /目标.*单位|单位.*目标/);
  const fresh = await metrics.POST(req({ projectId, card: { metricId: row.id, type: 'progress_card', target: 3 } })); assert.equal(fresh.status, 200); assert.equal((await fresh.json()).metric.value, 2);
});
test('board API: legacy minimum/maximum keys retain date-range evaluation when the shared board adds query validation', async () => {
  for (const [aggregation, expected] of [['min', 1], ['max', 31]]) {
    const key = 'legacy_' + aggregation;
    const saved = await metrics.POST(req({ projectId, key, name: '历史' + aggregation, aggregation, formula: 'sales', format: 'number' })); assert.equal(saved.status, 200);
    const params = new URLSearchParams({ projectId, key, datasetId: dataset.id, from: '2026-10-01', to: '2026-10-01' });
    const result = await metrics.GET(new Request('http://localhost/api/metrics?' + params, { headers: { 'x-user-id': 'user-editor' } })); assert.equal(result.status, 200); assert.equal((await result.json()).metric.value, expected);
  }
});
