import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1', KEYSTONE_API_KEY: '', KEYSTONE_MODEL: '' });
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/product-reports-api', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(() => vite.close());
const [projects, reports, dashboards, definitions, metrics, exports, agent] = await Promise.all(['/app/api/projects/route.ts', '/app/api/reports/route.ts', '/app/api/dashboards/route.ts', '/app/api/metric-definitions/route.ts', '/app/api/metrics/route.ts', '/app/api/report-html/route.ts', '/app/api/agent/route.ts'].map(file => vite.ssrLoadModule(file)));
const { saveDataset } = await vite.ssrLoadModule('/lib/datasets.ts');
const { db } = await vite.ssrLoadModule('/lib/db.ts');
const req = (body, user = 'user-editor') => new Request('http://localhost/api', { method: 'POST', headers: { 'x-user-id': user, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const get = (route, params, user = 'user-editor') => route.GET(new Request('http://localhost/api?' + new URLSearchParams(params), { headers: { 'x-user-id': user } }));
const projectId = (await (await projects.POST(req({ action: 'create', name: '陌生咨询部门', templateId: 'general_workbench' }))).json()).id;
const columns = [{ key: 'day', name: '业务日', type: 'date' }, { key: 'channel', name: '渠道', type: 'category' }, { key: 'consult', name: '咨询人数', type: 'number' }, { key: 'deal', name: '成交人数', type: 'number' }];
const dataset = await saveDataset(projectId, 'report-source', '原业务表', [{ day: '2026-10-01', channel: '门店', consult: 100, deal: 20 }, { day: '2026-10-02', channel: '线上', consult: 200, deal: 10 }, { day: '2026-09-29', channel: '门店', consult: 50, deal: 10 }, { day: '2026-09-30', channel: '线上', consult: 50, deal: 10 }], columns);
const config = { datasetId: dataset.id, aggregation: 'sum', field: 'consult', dateField: 'day', format: 'number', missingPolicy: 'skip' };
const saved = await definitions.POST(req({ projectId, action: 'save', name: '咨询人数', config, expectedVersion: 0 })); assert.equal(saved.status, 200); const metricId = (await saved.json()).id;
const cards = [{ id: 'scalar', title: '咨询人数', type: 'metric_card', config: { metricId, rangePolicy: 'project' } }, { id: 'trend', title: '咨询趋势', type: 'time_trend', config: { metricId, rangePolicy: 'project' } }, { id: 'groups', title: '咨询按渠道', type: 'breakdown', config: { metricId, groupBy: 'channel', rangePolicy: 'project' } }];
const initialBoardVersion = (await (await get(dashboards, { projectId })).json()).dashboards[0].version;
const board = await dashboards.POST(req({ projectId, version: initialBoardVersion, cards, layout: { kind: 'project_board', version: 1, query: { from: '2026-10-01', to: '2026-10-02' } } })); assert.equal(board.status, 200); const boardVersion = (await board.json()).version; assert.equal(boardVersion, initialBoardVersion + 1);
let first;
test('report API: a saved report uses the published metric ID/version, exact project period, real daily/group data and prior period', async () => {
  const response = await reports.POST(req({ projectId, dashboardVersion: boardVersion })); assert.equal(response.status, 200); first = await response.json();
  assert.equal(first.spec.kind, 'project_metrics_report'); assert.equal(first.spec.projectId, projectId); assert.equal(first.spec.dashboardVersion, boardVersion); assert.deepEqual(first.spec.queryConfig, { from: '2026-10-01', to: '2026-10-02' });
  assert.equal(first.spec.kpis[0].value, '300'); assert.equal(first.spec.metrics[0].previous.value, 100); assert.equal(first.spec.metrics[0].comparison, '较上期 +200');
  for (const metric of first.spec.metrics) { assert.equal(metric.metricId, metricId); assert.equal(metric.metricVersion, 1); assert.equal(metric.result.value, 300); assert.deepEqual(metric.result.trend.map(row => row.value), [100, 200]); }
  assert.deepEqual(first.spec.metrics[2].result.groups.map(row => row.value), [100, 200]); assert.equal(first.spec.datasets[0].version, 1); assert.equal(first.spec.aiStatus, 'not_enabled');
  assert.equal(JSON.stringify(first.spec).includes('母婴'), false); assert.equal(JSON.stringify(first.spec).includes('启萃'), false);
  const persisted = await db().prepare('SELECT created_by,source_manifest_json FROM report_versions WHERE id=?').bind(first.reportId).first(); assert.equal(persisted.created_by, 'user-editor'); assert.equal(JSON.parse(persisted.source_manifest_json)[0].datasetId, dataset.id);
});
test('report API: editing one definition changes new reports and cards while the saved original snapshot remains unchanged', async () => {
  assert.equal((await definitions.POST(req({ projectId, action: 'save', id: metricId, name: '咨询人数', config: { ...config, aggregation: 'avg' }, expectedVersion: 1 }))).status, 200);
  const second = await (await reports.POST(req({ projectId }))).json(); assert.equal(second.spec.kpis[0].value, '150'); for (const metric of second.spec.metrics) { assert.equal(metric.metricVersion, 2); assert.equal(metric.result.value, 150); }
  assert.equal((await (await metrics.POST(req({ projectId, card: { metricId, rangePolicy: 'project' }, query: first.spec.queryConfig }))).json()).metric.value, 150);
  const original = await (await get(reports, { projectId, id: first.reportId })).json(); assert.deepEqual(original.report.spec, first.spec);
  const exported = await get(exports, { projectId, id: first.reportId, download: '1' }); assert.equal(exported.status, 200); assert.match(exported.headers.get('Content-Disposition'), /^attachment/); assert.match(await exported.text(), /<b>300<\/b>/);
  assert.equal((await (await get(definitions, { projectId })).json()).metrics[0].impact.reports, 2);
});
test('report API: shared filters and independent card periods keep their actual semantics, not a cosmetic report caption', async () => {
  const filtered = await (await reports.POST(req({ projectId, query: { from: '2026-10-01', to: '2026-10-02', filters: [{ key: 'channel', value: '门店' }] } }))).json(); assert.equal(filtered.spec.kpis[0].value, '100'); assert.equal(filtered.spec.metrics[2].result.groups.length, 1);
  assert.deepEqual((await (await get(reports, { projectId, id: filtered.reportId })).json()).query, filtered.spec.queryConfig);
  const published = await dashboards.POST(req({ projectId, version: boardVersion, cards: [{ ...cards[0], config: { metricId, rangePolicy: 'independent', from: '2026-09-29', to: '2026-09-30' } }], layout: { kind: 'project_board', version: 1, query: first.spec.queryConfig } })); assert.equal(published.status, 200);
  const independent = await (await reports.POST(req({ projectId }))).json(); assert.equal(independent.spec.kpis[0].value, '50'); assert.equal(independent.spec.metrics[0].result.appliedQuery.from, '2026-09-29'); assert.equal(independent.spec.metrics[0].comparison, '独立周期，不与项目上期比较');
});
test('report API: stale board, invalid period and foreign project/report reads reject without creating a snapshot', async () => {
  const count = await db().prepare('SELECT COUNT(*) AS n FROM report_versions WHERE project_id=?').bind(projectId).first();
  assert.equal((await reports.POST(req({ projectId, dashboardVersion: boardVersion }))).status, 409);
  assert.equal((await reports.POST(req({ projectId, query: { from: '2026-02-30' } }))).status, 400);
  assert.equal((await get(reports, { projectId, id: 'foreign-report' })).status, 404);
  assert.equal((await get(reports, { projectId }, 'user-no-access')).status, 403);
  assert.equal((await get(exports, { projectId, id: first.reportId }, 'user-no-access')).status, 403);
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM report_versions WHERE project_id=?').bind(projectId).first()).n, count.n);
});
test('report API: viewer can read/export but cannot generate; another business member can create a report with their own audit identity', async () => {
  await projects.POST(req({ action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' })); await projects.POST(req({ action: 'add_member', projectId, userId: 'user-project-manager', role: 'editor' }));
  assert.equal((await get(reports, { projectId }, 'user-viewer')).status, 200); assert.equal((await get(exports, { projectId, id: first.reportId }, 'user-viewer')).status, 200); assert.equal((await reports.POST(req({ projectId }, 'user-viewer'))).status, 403);
  const authored = await (await reports.POST(req({ projectId }, 'user-project-manager'))).json(); assert.equal((await db().prepare('SELECT created_by FROM report_versions WHERE id=?').bind(authored.reportId).first()).created_by, 'user-project-manager');
});
test('report API: report history really paginates and clamps out-of-range pages without losing old versions', async () => {
  for (let i = 0; i < 17; i++) assert.equal((await reports.POST(req({ projectId }))).status, 200);
  const page1 = await (await get(reports, { projectId, page: '1' })).json(); const page2 = await (await get(reports, { projectId, page: '999' })).json(); assert.equal(page1.reports.length, 20); assert.equal(page2.pagination.page, 2); assert.equal(page2.total, 22); assert.equal(page2.reports.length, 2); assert.equal(page2.reports.some(row => row.id === first.reportId), true);
});
test('report API: the retained assistant endpoint delegates to project metrics and does not populate a non-social report with legacy facts', async () => {
  const response = await agent.POST(req({ projectId, prompt: '咨询人数和成交率' })); assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.spec.kind, 'project_metrics_report'); assert.equal(result.spec.metrics[0].metricId, metricId); assert.equal(result.spec.kpis[0].value, '50'); assert.equal(result.plan.endpoints.length, 0);
});
test('report API: a rate change is an absolute percentage-point change, not an unlabeled relative growth percentage', async () => {
  const ratio = await definitions.POST(req({ projectId, action: 'save', name: '成交率', config: { datasetId: dataset.id, dateField: 'day', aggregation: 'ratio', numField: 'deal', denField: 'consult', ratioBasis: 'paired', missingPolicy: 'skip', format: 'percent', unit: '%' } })); assert.equal(ratio.status, 200); const ratioId = (await ratio.json()).id;
  const version = (await (await get(dashboards, { projectId })).json()).dashboards[0].version;
  const saved = await dashboards.POST(req({ projectId, version, cards: [{ title: '成交率', type: 'metric_card', config: { metricId: ratioId, rangePolicy: 'project' } }], layout: { kind: 'project_board', version: 1, query: first.spec.queryConfig } })); assert.equal(saved.status, 200);
  const report = await (await reports.POST(req({ projectId }))).json(); assert.equal(report.spec.metrics[0].result.value, 10); assert.equal(report.spec.metrics[0].previous.value, 20); assert.equal(report.spec.metrics[0].comparison, '较上期 −10.0 个百分点');
});
test('report API: a genuine local audit write failure rolls back the report and does not leave a falsely failed saved snapshot', async () => {
  const count = (await db().prepare('SELECT COUNT(*) AS n FROM report_versions WHERE project_id=?').bind(projectId).first()).n;
  await db().prepare("CREATE TRIGGER report_audit_failure BEFORE INSERT ON action_logs WHEN NEW.action='生成项目指标报告' BEGIN SELECT RAISE(ABORT,'isolated audit write failure'); END").run();
  try { assert.equal((await reports.POST(req({ projectId }))).status, 500); assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM report_versions WHERE project_id=?').bind(projectId).first()).n, count); }
  finally { await db().prepare('DROP TRIGGER report_audit_failure').run(); }
});
test('report API: an unsupported action cannot bypass the project report path into the legacy social generator', async () => {
  const response = await agent.POST(req({ projectId, action: 'unknown-operation', prompt: '查看咨询人数' })); assert.equal(response.status, 400);
});
