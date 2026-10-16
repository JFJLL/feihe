import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1' });
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/product-structure-api', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } }); after(() => vite.close());
const projects = await vite.ssrLoadModule('/app/api/projects/route.ts'), metrics = await vite.ssrLoadModule('/app/api/metric-definitions/route.ts'), boards = await vite.ssrLoadModule('/app/api/dashboards/route.ts');
const structureRoute = await vite.ssrLoadModule('/app/api/project-structure/route.ts');
const { saveDataset } = await vite.ssrLoadModule('/lib/datasets.ts'); const { db } = await vite.ssrLoadModule('/lib/db.ts');
const request = (body, user = 'user-editor') => new Request('http://localhost/api', { method: 'POST', headers: { 'x-user-id': user, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const create = async (name, extra = {}, user = 'user-editor') => projects.POST(request({ action: 'create', name, templateId: 'general_workbench', ...extra }, user));
async function sourceProject() {
  const id = (await (await create('已有项目结构')).json()).id, dataset = await saveDataset(id, 'private-document', '客户原表', [{ amount: 100 }, { amount: 200 }]);
  const metric = await metrics.POST(request({ action: 'save', projectId: id, name: '咨询合计', config: { datasetId: dataset.id, mode: 'custom', aggregation: 'sum', field: 'amount' }, expectedVersion: 0 })); assert.equal(metric.status, 200); const metricId = (await metric.json()).id;
  const saved = await boards.POST(request({ projectId: id, version: 1, cards: [{ title: '咨询合计', type: 'metric_card', config: { metricId } }, { title: '本项目咨询目标', type: 'progress_card', config: { metricId, target: 600, targetMetricVersion: 1 } }] })); assert.equal(saved.status, 200);
  return { id, dataset, metricId };
}
test('structure red: a new project explicitly reusing an authorized structure stores a pending blueprint, never the old source or target', async () => {
  const source = await sourceProject(); const response = await create('第二个客户', { structureProjectId: source.id, structureConfirmed: true }); assert.equal(response.status, 200); const saved = await response.json();
  assert.equal(saved.structurePending, true);
  const pending = await db().prepare("SELECT value FROM project_settings WHERE project_id=? AND key='structure_blueprint'").bind(saved.id).first(); assert.ok(pending);
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM datasets WHERE project_id=?').bind(saved.id).first()).n, 0);
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM data_sources WHERE project_id=?').bind(saved.id).first()).n, 0);
  assert.equal(JSON.stringify(JSON.parse(pending.value)).includes(source.dataset.id), false);
  assert.ok(JSON.parse(pending.value).cards.every(card => card.target === undefined));
});
test('structure red: copying a private project without source read permission is refused before creating anything', async () => {
  const source = await sourceProject(), before = (await db().prepare('SELECT COUNT(*) AS n FROM projects').first()).n;
  const response = await create('不得复制无权项目', { structureProjectId: source.id }, 'user-project-manager'); assert.equal(response.status, 403);
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM projects').first()).n, before);
});
async function copiedProject() {
  const source = await sourceProject(), created = await create('独立复用项目', { structureProjectId: source.id, structureConfirmed: true }); assert.equal(created.status, 200);
  const id = (await created.json()).id, pending = await (await structureRoute.GET(new Request('http://localhost/api?projectId=' + id, { headers: { 'x-user-id': 'user-editor' } }))).json();
  const dataset = await saveDataset(id, 'own-document', '新客户业务数据', [{ income: 400 }, { income: 200 }]);
  const choices = { bindings: { g1: { datasetId: dataset.id, datasetVersion: dataset.version, fields: { amount: 'income' } } }, selectedCards: ['c1', 'c2'], targets: { c2: 1200 }, percentConfirmations: {} };
  return { source, id, dataset, revision: pending.blueprint.revision, choices };
}
test('structure API: source preview exposes only rules and field contracts, without source identifiers, values, targets or credentials', async () => {
  const source = await sourceProject(), preview = await structureRoute.GET(new Request('http://localhost/api?mode=source&projectId=' + source.id, { headers: { 'x-user-id': 'user-editor' } })); assert.equal(preview.status, 200);
  const blueprint = (await preview.json()).blueprint;
  assert.equal(blueprint.metrics[0].config.datasetId, undefined); assert.equal(blueprint.metrics[0].config.from, undefined); assert.equal(blueprint.metrics[0].config.to, undefined);
  assert.equal(blueprint.cards[1].requiresTarget, true); assert.equal(blueprint.cards[1].target, undefined); assert.equal(JSON.stringify(blueprint).includes('private-document'), false);
  assert.equal(JSON.stringify(blueprint).includes(source.metricId), false); assert.equal(blueprint.groups[0].fields[0].name, 'amount');
});
test('structure API: source revision change or missing acknowledgement prevents creating a target project', async () => {
  const source = await sourceProject(), before = (await db().prepare('SELECT COUNT(*) AS n FROM projects').first()).n;
  assert.equal((await create('缺少确认', { structureProjectId: source.id })).status, 400);
  assert.equal((await create('已过期结构', { structureProjectId: source.id, structureConfirmed: true, structureRevision: 'stale' })).status, 409);
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM projects').first()).n, before);
});
test('structure API: own fields calculate 600, new goal1200 and shared references publish with no original bindings; retry reuses exact IDs', async () => {
  const target = await copiedProject(), body = { projectId: target.id, revision: target.revision, ...target.choices };
  const plan = await (await structureRoute.GET(new Request('http://localhost/api?projectId=' + target.id + '&choices=' + encodeURIComponent(JSON.stringify(target.choices)), { headers: { 'x-user-id': 'user-editor' } }))).json(); assert.deepEqual(plan.errors, []); assert.equal(plan.previews[0].preview.value, 600);
  const response = await structureRoute.POST(request(body)); assert.equal(response.status, 200); const saved = await response.json(); assert.equal(saved.cards[0].metricId, saved.cards[1].metricId); assert.notEqual(saved.cards[0].metricId, target.source.metricId); assert.equal(saved.cards[1].target, 1200);
  const retry = await structureRoute.POST(request(body)); assert.equal(retry.status, 200); assert.deepEqual((await retry.json()).cards, saved.cards);
  const own = await (await metrics.GET(new Request('http://localhost/api?projectId=' + target.id, { headers: { 'x-user-id': 'user-editor' } }))).json(); assert.equal(own.metrics.length, 1); assert.equal(own.metrics[0].version, 1); assert.equal(own.metrics[0].config.datasetId, target.dataset.id); assert.equal(own.metrics[0].config.field, 'income');
  assert.equal((await boards.POST(request({ projectId: target.id, version: 1, cards: saved.cards.map(card => ({ title: card.title, type: card.type, config: card })) }))).status, 200);
  const persisted = await (await boards.GET(new Request('http://localhost/api?projectId=' + target.id, { headers: { 'x-user-id': 'user-editor' } }))).json(); assert.equal(JSON.parse(persisted.cards[1].configJson).target, 1200); assert.equal(persisted.dashboards[0].status, 'published');
  const original = await (await boards.GET(new Request('http://localhost/api?projectId=' + target.source.id, { headers: { 'x-user-id': 'user-editor' } }))).json(); assert.equal(JSON.parse(original.cards[1].configJson).target, 600);
});
test('structure API: foreign fields, missing new target, stale datasets and viewer cannot apply or leave partial metrics', async () => {
  const target = await copiedProject(), body = { projectId: target.id, revision: target.revision, ...target.choices };
  assert.equal((await structureRoute.POST(request({ ...body, targets: {} }))).status, 400);
  assert.equal((await structureRoute.POST(request({ ...body, bindings: { g1: { ...target.choices.bindings.g1, datasetId: target.source.dataset.id } } }))).status, 400);
  assert.equal((await structureRoute.POST(request({ ...body, bindings: { g1: { ...target.choices.bindings.g1, fields: { amount: 'missing' } } } }))).status, 400);
  await projects.POST(request({ action: 'add_member', projectId: target.id, userId: 'user-viewer', role: 'viewer' })); assert.equal((await structureRoute.POST(request(body, 'user-viewer'))).status, 403);
  await saveDataset(target.id, 'own-document', '新客户业务数据', [{ income: 800 }]); assert.equal((await structureRoute.POST(request(body))).status, 409);
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM metric_definitions WHERE project_id=?').bind(target.id).first()).n, 0);
});
test('structure API: actual audit write failure rolls back the complete import; corrected retry has one metric and the same source', async () => {
  const target = await copiedProject(), body = { projectId: target.id, revision: target.revision, ...target.choices };
  await db().prepare("CREATE TRIGGER structure_audit_failure BEFORE INSERT ON action_logs WHEN NEW.project_id='" + target.id + "' BEGIN SELECT RAISE(ABORT,'isolated structure audit failure'); END").run();
  try { assert.equal((await structureRoute.POST(request(body))).status, 500); } finally { await db().prepare('DROP TRIGGER structure_audit_failure').run(); }
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM metric_definitions WHERE project_id=?').bind(target.id).first()).n, 0);
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM metric_bindings WHERE project_id=?').bind(target.id).first()).n, 0);
  const pending = await db().prepare("SELECT value FROM project_settings WHERE project_id=? AND key='structure_blueprint'").bind(target.id).first(); assert.equal(JSON.parse(pending.value).applied, undefined);
  assert.equal((await structureRoute.POST(request(body))).status, 200); assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM metric_definitions WHERE project_id=?').bind(target.id).first()).n, 1);
});
async function percentageStructure(config = { aggregation: 'avg', format: 'percent', unit: '%', percentScale: 'fraction', displayOrigin: 'auto' }) {
  const sourceId = (await (await create('百分比模板来源')).json()).id;
  const sourceData = await saveDataset(sourceId, 'percent-source', '原百分比表', [{ rate: 0.005 }, { rate: 0.015 }], [{ key: 'rate', name: '完成率', type: 'number', numericUnit: 'percent', percentScale: 'fraction' }]);
  const response = await metrics.POST(request({ action: 'save', projectId: sourceId, name: '完成率平均', config: { datasetId: sourceData.id, field: 'rate', mode: 'custom', ...config }, expectedVersion: 0 })); assert.equal(response.status, 200); const metricId = (await response.json()).id;
  assert.equal((await boards.POST(request({ projectId: sourceId, version: 1, cards: [{ title: '完成率平均', type: 'metric_card', config: { metricId } }] }))).status, 200);
  const targetId = (await (await create('复用百分比规则', { structureProjectId: sourceId, structureConfirmed: true })).json()).id;
  const state = await (await structureRoute.GET(new Request('http://localhost/api?projectId=' + targetId, { headers: { 'x-user-id': 'user-editor' } }))).json(); return { sourceId, targetId, revision: state.blueprint.revision };
}
test('structure API: small percentages retain fractions once; automatic units follow the actual mapped field rather than the old field', async () => {
  const target = await percentageStructure(), fractional = await saveDataset(target.targetId, 'own-percent', '自己的完成率', [{ ownRate: 0.015 }, { ownRate: 0.025 }], [{ key: 'ownRate', name: '达标率', type: 'number', numericUnit: 'percent', percentScale: 'fraction' }]);
  let choices = { bindings: { g1: { datasetId: fractional.id, datasetVersion: fractional.version, fields: { rate: 'ownRate' } } }, selectedCards: ['c1'], targets: {}, percentConfirmations: {} };
  let plan = await (await structureRoute.GET(new Request('http://localhost/api?projectId=' + target.targetId + '&choices=' + encodeURIComponent(JSON.stringify(choices)), { headers: { 'x-user-id': 'user-editor' } }))).json(); assert.deepEqual(plan.errors, []); assert.equal(plan.previews[0].preview.formattedValue, '2.0%'); assert.equal(plan.configured[0].config.percentScale, 'fraction');
  const ordinary = await saveDataset(target.targetId, 'own-amount', '自己的金额', [{ amount: 10 }, { amount: 20 }]); choices = { ...choices, bindings: { g1: { datasetId: ordinary.id, datasetVersion: ordinary.version, fields: { rate: 'amount' } } } };
  plan = await (await structureRoute.GET(new Request('http://localhost/api?projectId=' + target.targetId + '&choices=' + encodeURIComponent(JSON.stringify(choices)), { headers: { 'x-user-id': 'user-editor' } }))).json(); assert.deepEqual(plan.errors, []); assert.equal(plan.previews[0].preview.formattedValue, '15'); assert.equal(plan.configured[0].config.format, 'number'); assert.equal(plan.configured[0].config.unit, ''); assert.equal(plan.configured[0].config.percentScale, undefined);
});
test('structure API: a manually declared historical percentage on a new untyped field requires explicit scale confirmation', async () => {
  const target = await percentageStructure({ aggregation: 'avg', format: 'percent', unit: '%', percentScale: 'fraction', displayOrigin: 'manual' }); const own = await saveDataset(target.targetId, 'own-raw-percent', '待确认百分数', [{ raw: 0.5 }, { raw: 1.5 }]);
  const choices = { bindings: { g1: { datasetId: own.id, datasetVersion: own.version, fields: { rate: 'raw' } } }, selectedCards: ['c1'], targets: {}, percentConfirmations: {} };
  assert.equal((await structureRoute.POST(request({ projectId: target.targetId, revision: target.revision, ...choices }))).status, 400);
  const confirmed = await structureRoute.POST(request({ projectId: target.targetId, revision: target.revision, ...choices, percentConfirmations: { m1: 'percentage_points' } })); assert.equal(confirmed.status, 200);
  const state = await (await metrics.GET(new Request('http://localhost/api?projectId=' + target.targetId, { headers: { 'x-user-id': 'user-editor' } }))).json(); assert.equal(state.metrics[0].config.percentScale, 'percentage_points'); assert.equal(state.metrics[0].config.displayNeedsConfirmation, false);
});
test('structure API: two different original sources require two own bindings and preserve each metric and card order', async () => {
  const sourceId = (await (await create('两个来源的模板')).json()).id;
  const originals = [await saveDataset(sourceId, 'private-a', '来源甲', [{ amount: 100 }]), await saveDataset(sourceId, 'private-b', '来源乙', [{ amount: 200 }])]; const originalMetricIds = [];
  for (let index = 0; index < originals.length; index++) originalMetricIds.push((await (await metrics.POST(request({ action: 'save', projectId: sourceId, name: '来源合计' + index, config: { datasetId: originals[index].id, aggregation: 'sum', field: 'amount' }, expectedVersion: 0 }))).json()).id);
  assert.equal((await boards.POST(request({ projectId: sourceId, version: 1, cards: originalMetricIds.map((metricId, index) => ({ title: '来源合计' + index, type: 'metric_card', config: { metricId } })) }))).status, 200);
  const targetId = (await (await create('独立两个来源', { structureProjectId: sourceId, structureConfirmed: true })).json()).id;
  const own = [await saveDataset(targetId, 'own-a', '新来源甲', [{ revenue: 10 }]), await saveDataset(targetId, 'own-b', '新来源乙', [{ revenue: 20 }])];
  const state = await (await structureRoute.GET(new Request('http://localhost/api?projectId=' + targetId, { headers: { 'x-user-id': 'user-editor' } }))).json(); assert.equal(state.blueprint.groups.length, 2);
  const choices = { bindings: Object.fromEntries(own.map((dataset, index) => ['g' + (index + 1), { datasetId: dataset.id, datasetVersion: dataset.version, fields: { amount: 'revenue' } }])), selectedCards: ['c1', 'c2'], targets: {}, percentConfirmations: {} };
  const plan = await (await structureRoute.GET(new Request('http://localhost/api?projectId=' + targetId + '&choices=' + encodeURIComponent(JSON.stringify(choices)), { headers: { 'x-user-id': 'user-editor' } }))).json(); assert.deepEqual(plan.previews.map(card => card.preview.value), [10, 20]);
  assert.equal((await structureRoute.POST(request({ projectId: targetId, revision: state.blueprint.revision, ...choices }))).status, 200);
  const bound = await db().prepare('SELECT source_id FROM metric_bindings WHERE project_id=? ORDER BY id').bind(targetId).all(); assert.deepEqual(bound.results.map(binding => binding.source_id), ['own-a', 'own-b']);
});
test('structure API: concurrent identical confirmations cannot duplicate metrics, bindings or saved goals', async () => {
  const target = await copiedProject(), body = { projectId: target.id, revision: target.revision, ...target.choices };
  const results = await Promise.all([structureRoute.POST(request(body)), structureRoute.POST(request(body))]); assert.ok(results.some(response => response.status === 200)); assert.ok(results.every(response => [200, 409].includes(response.status)));
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM metric_definitions WHERE project_id=?').bind(target.id).first()).n, 1); assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM metric_bindings WHERE project_id=?').bind(target.id).first()).n, 1);
  const state = await db().prepare("SELECT value FROM project_settings WHERE project_id=? AND key='structure_blueprint'").bind(target.id).first(); assert.equal(JSON.parse(state.value).applied.cards[1].target, 1200);
});
