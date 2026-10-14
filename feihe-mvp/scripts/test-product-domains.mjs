import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1' });
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/product-domains-api', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } }); after(() => vite.close());
const projects = await vite.ssrLoadModule('/app/api/projects/route.ts'), recommendations = await vite.ssrLoadModule('/app/api/metric-recommendations/route.ts'), analytics = await vite.ssrLoadModule('/app/api/business-analytics/route.ts'), ops = await vite.ssrLoadModule('/app/api/ops/route.ts');
const { saveDataset } = await vite.ssrLoadModule('/lib/datasets.ts');
const { db } = await vite.ssrLoadModule('/lib/db.ts');
const settings = await vite.ssrLoadModule('/app/api/settings/route.ts'), dashboards = await vite.ssrLoadModule('/app/api/dashboards/route.ts'), reports = await vite.ssrLoadModule('/app/api/reports/route.ts');
const req = (body, user = 'user-editor') => new Request('http://localhost/api', { method: 'POST', headers: { 'x-user-id': user, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const get = (projectId, suffix = '') => new Request('http://localhost/api?projectId=' + projectId + suffix, { headers: { 'x-user-id': 'user-editor' } });
async function project(templateId, rows) {
  const response = await projects.POST(req({ action: 'create', name: '领域来源' + templateId, templateId })); assert.equal(response.status, 200); const id = (await response.json()).id;
  const dataset = await saveDataset(id, 'own-domain-source', '业务原表', rows);
  const plan = await (await recommendations.GET(get(id, '&datasetId=' + dataset.id))).json();
  return { id, dataset, plan };
}
test('domain red: imported content can bind its own source to the content business page and shared readings metric', async () => {
  const data = await project('content_marketing', [{ 内容编号: 'article-a', 发布日期: '2026-11-01', 标题: '业务教程', 阅读量: 1000, 互动量: 10, 内容费用: 50 }, { 内容编号: 'article-b', 发布日期: '2026-11-02', 标题: '案例分享', 阅读量: 2000, 互动量: 20, 内容费用: 100 }]);
  const saved = await recommendations.POST(req({ projectId: data.id, datasetId: data.dataset.id, datasetVersion: data.dataset.version, selected: data.plan.recommendations.map(metric => metric.key), roles: data.plan.roles, bindBusiness: true })); assert.equal(saved.status, 200);
  const result = await (await analytics.GET(get(data.id, '&kind=content'))).json(); assert.equal(result.configured, true); assert.equal(result.metrics.reads.value, 3000); assert.equal(result.records.total, 2); assert.equal(result.records.items[0].recordId, 'article-a');
});
test('domain red: imported comments become project comment records and sentiment/status analysis rather than an empty note pool', async () => {
  const data = await project('comment_qc', [{ 评论编号: 'c1', 记录日期: '2026-11-01', 评论内容: '需要回复咨询', 情感: '问题', 处置状态: '待处理' }, { 评论编号: 'c2', 记录日期: '2026-11-01', 评论内容: '体验很好', 情感: '正面', 处置状态: '已处理' }, { 评论编号: 'c3', 记录日期: '2026-11-02', 评论内容: '未标注的记录', 情感: null, 处置状态: '待处理' }]);
  const saved = await recommendations.POST(req({ projectId: data.id, datasetId: data.dataset.id, datasetVersion: data.dataset.version, selected: data.plan.recommendations.map(metric => metric.key), roles: data.plan.roles, bindBusiness: true })); assert.equal(saved.status, 200);
  const result = await (await analytics.GET(get(data.id, '&kind=comment'))).json(); assert.equal(result.configured, true); assert.equal(result.metrics.records.value, 3); assert.equal(result.records.total, 3); assert.equal(result.status.groups.find(group => group.label === '待处理').value, 2);
});
test('domain red: a new comment project has no inherited200/30 acceptance targets or automatic ready confirmation', async () => {
  const data = await project('comment_qc', [{ 评论内容: '真实来源记录' }]); const result = await (await ops.GET(get(data.id, '&fresh=1'))).json();
  assert.equal(result.settings.acceptance.reportCount, 0); assert.equal(result.settings.acceptance.baseCount, 0); assert.equal(result.settings.acceptance.targetsConfirmed, false);
});
const contentRows = [{ 内容编号: 'a', 发布日期: '2026-11-01T12:00:00+08:00', 标题: '教程', 阅读量: 1000, 渠道: '门店' }, { 内容编号: 'b', 发布日期: '2026-11-02T00:00:00+08:00', 标题: '案例', 阅读量: 2000, 渠道: '线上' }, { 内容编号: 'c', 发布日期: null, 标题: '无日期', 阅读量: null, 渠道: '门店' }];
async function bind(data, extra = {}) {
  const response = await recommendations.POST(req({ projectId: data.id, datasetId: data.dataset.id, datasetVersion: data.dataset.version, selected: data.plan.recommendations.map(metric => metric.key), roles: data.plan.roles, bindBusiness: true, ...extra }));
  const result = await response.json(); return { response, result };
}
test('domain API: complete-batch duplicate/blank IDs and empty comment text reject before any shared metric or binding is written', async () => {
  for (const [template, rows] of [['content_marketing', Array.from({ length: 31 }, (_, index) => ({ 内容编号: index === 30 ? 'id0' : 'id' + index, 阅读量: index }))], ['content_marketing', [{ 内容编号: '', 阅读量: 100 }]], ['comment_qc', [{ 评论内容: '' }]], ['comment_qc', [{ 评论编号: 'same', 评论内容: '甲' }, { 评论编号: 'same', 评论内容: '乙' }]]]) {
    const data = await project(template, rows), saved = await bind(data); assert.equal(saved.response.status, 400); assert.match(saved.result.error, /重复|不能为空|缺少字段/);
    assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM metric_definitions WHERE project_id=?').bind(data.id).first()).n, 0);
    assert.equal((await db().prepare("SELECT COUNT(*) AS n FROM project_settings WHERE project_id=? AND key LIKE 'analytics:%'").bind(data.id).first()).n, 0);
  }
});
test('domain API: business records, scalar/trend/group values share project-day and common-filter rules; undated records stay out of the requested day', async () => {
  const data = await project('content_marketing', contentRows); assert.equal((await bind(data)).response.status, 200);
  const query = { from: '2026-11-01', to: '2026-11-01', filters: [{ key: '渠道', value: '门店' }] }, result = await (await analytics.GET(get(data.id, '&kind=content&query=' + encodeURIComponent(JSON.stringify(query))))).json();
  assert.equal(result.metrics.reads.value, 1000); assert.equal(result.metrics.records.value, 1); assert.equal(result.records.total, 1); assert.equal(result.records.items[0].recordId, 'a'); assert.equal(result.trend.trend[0].value, 1000); assert.equal(result.channel.groups[0].value, 1000);
  assert.equal(result.metrics.reads.appliedQuery.undatedRows, 1);
  const all = await (await analytics.GET(get(data.id, '&kind=content'))).json(); assert.equal(all.metrics.records.value, 3); assert.equal(all.metrics.reads.value, 3000); assert.equal(all.metrics.reads.sampleSize, 2);
});
test('domain API: missing optional fields are absent, source labels are not fabricated, and row position is explicitly not a stable comment key', async () => {
  const data = await project('comment_qc', [{ 评论内容: '只有内容，没有情感或状态' }]); assert.equal((await bind(data)).response.status, 200);
  const result = await (await analytics.GET(get(data.id, '&kind=comment'))).json(); assert.equal(result.metrics.records.value, 1); assert.equal(result.metrics.sentiment, undefined); assert.equal(result.sentiment, null); assert.equal(result.status, null); assert.equal(result.trend, null);
  assert.equal(result.records.items[0].identity, 'row_position'); assert.equal(result.identityPolicy, 'row_position'); assert.deepEqual(result.capabilities, { sourceLabels: true, automaticCollection: false, automaticTreatment: false });
});
test('domain API: pagination is real, latest source updates retain the binding and clamp the actual current page', async () => {
  const data = await project('comment_qc', Array.from({ length: 31 }, (_, index) => ({ 评论编号: 'c' + index, 评论内容: '记录' + index, 处置状态: '待处理' }))); assert.equal((await bind(data)).response.status, 200);
  const query = '&kind=comment&query=' + encodeURIComponent(JSON.stringify({ detailPage: 3 })); let result = await (await analytics.GET(get(data.id, query))).json(); assert.equal(result.records.page, 3); assert.equal(result.records.items.length, 1); assert.equal(result.records.items[0].recordId, 'c30');
  await saveDataset(data.id, 'own-domain-source', '业务原表', [{ 评论编号: 'c0', 评论内容: '更新记录', 处置状态: '已处理' }]);
  result = await (await analytics.GET(get(data.id, query))).json(); assert.equal(result.records.page, 1); assert.equal(result.records.totalPages, 1); assert.equal(result.records.items[0].commentText, '更新记录'); assert.equal(result.status.groups[0].label, '已处理'); assert.equal(result.metrics.records.definition.version, 1);
});
test('domain API: invalid latest source data and removed/retyped fields fail explicitly rather than returning the previous normal values', async () => {
  const data = await project('comment_qc', [{ 评论编号: 'c1', 评论内容: '原记录' }]); assert.equal((await bind(data)).response.status, 200);
  await saveDataset(data.id, 'own-domain-source', '业务原表', [{ 评论编号: 'c1', 评论内容: '原记录' }, { 评论编号: 'c1', 评论内容: '重复' }]);
  const response = await analytics.GET(get(data.id, '&kind=comment')); assert.equal(response.status, 409); assert.match((await response.json()).error, /重复/);
  const content = await project('content_marketing', contentRows); assert.equal((await bind(content)).response.status, 200); await saveDataset(content.id, 'own-domain-source', '业务原表', [{ 内容编号: 'a', 阅读量: '不是数值' }]);
  const changed = await analytics.GET(get(content.id, '&kind=content')); assert.equal(changed.status, 409); assert.match((await changed.json()).error, /字段已变化/);
});
test('domain API: untrusted URL, foreign source/module, viewer writes and stale dataset versions reject without successful local mutations', async () => {
  const data = await project('content_marketing', [{ 内容链接: 'javascript:alert(1)', 阅读量: 1 }]); assert.equal((await bind(data)).response.status, 400);
  const valid = await project('content_marketing', contentRows); assert.equal((await recommendations.POST(req({ projectId: valid.id, datasetId: data.dataset.id, datasetVersion: data.dataset.version, selected: ['content_records'] }))).status, 400);
  assert.equal((await bind(valid, { domain: 'ad' })).response.status, 400);
  assert.equal((await bind(valid, { datasetVersion: 0 })).response.status, 409);
  assert.equal((await projects.POST(req({ action: 'add_member', projectId: valid.id, userId: 'user-viewer', role: 'viewer' }))).status, 200);
  assert.equal((await recommendations.POST(req({ projectId: valid.id, datasetId: valid.dataset.id, datasetVersion: valid.dataset.version, selected: ['content_records'], roles: valid.plan.roles, bindBusiness: true }, 'user-viewer'))).status, 403);
  assert.equal((await analytics.GET(new Request('http://localhost/api?projectId=' + valid.id + '&kind=content', { headers: { 'x-user-id': 'user-no-access' } }))).status, 403);
});
test('domain API: actual SQL/audit failure rolls back shared definitions and business binding; retry reuses one collection and correct audit actor', async () => {
  const data = await project('content_marketing', contentRows);
  await db().prepare("CREATE TEMP TRIGGER domain_audit_abort BEFORE INSERT ON action_logs WHEN NEW.project_id='" + data.id + "' AND NEW.target_type='metric_definition' BEGIN SELECT RAISE(ABORT,'domain audit unavailable'); END").run();
  assert.equal((await bind(data)).response.status, 500);
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM metric_definitions WHERE project_id=?').bind(data.id).first()).n, 0); assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM metric_bindings WHERE project_id=?').bind(data.id).first()).n, 0);
  assert.equal((await db().prepare("SELECT COUNT(*) AS n FROM project_settings WHERE project_id=? AND key='analytics:content'").bind(data.id).first()).n, 0);
  await db().prepare('DROP TRIGGER domain_audit_abort').run();
  const first = await bind(data), second = await bind(data); assert.equal(first.response.status, 200); assert.equal(second.response.status, 200); assert.deepEqual(first.result.confirmed, second.result.confirmed);
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM metric_definitions WHERE project_id=?').bind(data.id).first()).n, data.plan.recommendations.length);
  const logs = await db().prepare("SELECT actor_user_id FROM action_logs WHERE project_id=? AND target_type='metric_definition'").bind(data.id).all(); assert.equal(logs.results.length, data.plan.recommendations.length); assert.ok(logs.results.every(row => row.actor_user_id === 'user-editor'));
});
test('domain API: published content scalar, trend, group and real saved report reference the exact same metric ID/version and local rows', async () => {
  const data = await project('content_marketing', contentRows), saved = await bind(data); assert.equal(saved.response.status, 200);
  const metricId = saved.result.confirmed.find(item => item.key === 'reads').metricId, initial = await (await dashboards.GET(get(data.id))).json();
  const published = await dashboards.POST(req({ projectId: data.id, version: initial.dashboards[0].version, cards: [{ id: 'reads', title: '阅读总量', type: 'metric_card', config: { metricId, rangePolicy: 'project' } }, { id: 'reads-trend', title: '阅读趋势', type: 'time_trend', config: { metricId, rangePolicy: 'project' } }, { id: 'reads-channel', title: '阅读渠道', type: 'breakdown', config: { metricId, groupBy: '渠道', rangePolicy: 'project' } }], layout: { kind: 'project_board', version: 1, query: { from: '2026-11-01', to: '2026-11-01' } } })); assert.equal(published.status, 200);
  const business = await (await analytics.GET(get(data.id, '&kind=content'))).json(); assert.equal(business.metrics.reads.value, 1000); assert.equal(business.records.total, 1); assert.equal(business.metrics.reads.definition.id, metricId);
  const report = await reports.POST(req({ projectId: data.id })); assert.equal(report.status, 200); const stored = await report.json();
  for (const metric of stored.spec.metrics) { assert.equal(metric.metricId, metricId); assert.equal(metric.metricVersion, 1); assert.equal(metric.result.value, 1000); }
  assert.deepEqual(stored.spec.queryConfig, { from: '2026-11-01', to: '2026-11-01' });
});
test('domain API: zero remains unconfirmed, positive acceptance targets require an explicit settings save, and historical Qicui targets are preserved', async () => {
  const data = await project('comment_qc', [{ 评论内容: '无固定目标' }]);
  assert.equal((await settings.POST(req({ projectId: data.id, acceptance: { reportCount: 0, baseCount: 0 } }))).status, 200);
  let value = (await (await ops.GET(get(data.id, '&fresh=1'))).json()).settings.acceptance; assert.equal(value.reportCount, 0); assert.equal(value.targetsConfirmed, false);
  assert.equal((await settings.POST(req({ projectId: data.id, acceptance: { reportCount: 40, baseCount: 10, brandTopRate: 0.25 } }))).status, 200);
  value = (await (await ops.GET(get(data.id, '&fresh=1'))).json()).settings.acceptance; assert.equal(value.reportCount, 40); assert.equal(value.baseCount, 10); assert.equal(value.targetsConfirmed, true);
  assert.equal((await settings.POST(req({ projectId: data.id, acceptance: { reportCount: -1, baseCount: 0 } }))).status, 400); assert.equal((await settings.POST(req({ projectId: data.id, acceptance: { reportCount: 10, baseCount: 40 } }))).status, 400);
  const { defaultAcceptance, acceptanceTargetsConfirmed } = await vite.ssrLoadModule('/lib/business-targets.ts'); const historical = defaultAcceptance('qicui'); assert.equal(historical.reportCount, 200); assert.equal(historical.baseCount, 30); assert.equal(acceptanceTargetsConfirmed(historical), true);
  assert.equal((await db().prepare("SELECT actor_user_id FROM action_logs WHERE project_id=? AND action='更新设置' ORDER BY id DESC LIMIT 1").bind(data.id).first()).actor_user_id, 'user-editor');
});
test('domain API: a valid shared metric edit updates the dedicated scalar/trend/group at v2 rather than silently continuing the old calculation', async () => {
  const data = await project('content_marketing', contentRows), saved = await bind(data); assert.equal(saved.response.status, 200); const metricId = saved.result.confirmed.find(item => item.key === 'reads').metricId;
  const definitions = await vite.ssrLoadModule('/app/api/metric-definitions/route.ts');
  const changed = await definitions.POST(req({ projectId: data.id, action: 'save', id: metricId, name: '单条平均阅读', expectedVersion: 1, config: { ...data.plan.recommendations.find(item => item.key === 'reads').config, aggregation: 'avg' } })); assert.equal(changed.status, 200);
  const result = await (await analytics.GET(get(data.id, '&kind=content'))).json(); assert.equal(result.metrics.reads.value, 1500); assert.equal(result.metrics.reads.definition.version, 2); assert.equal(result.metrics.reads.definition.name, '单条平均阅读'); assert.equal(result.trend.trend[0].value, 1000); assert.equal(result.channel.groups.find(group => group.label === '门店').value, 1000);
  assert.equal((await bind(data)).response.status, 409);
});
test('domain API: authorized content structure reuse binds its typed business page to new private records and new metric IDs', async () => {
  const source = await project('content_marketing', contentRows), saved = await bind(source); assert.equal(saved.response.status, 200); const originalId = saved.result.confirmed.find(item => item.key === 'reads').metricId;
  const initial = await (await dashboards.GET(get(source.id))).json(); assert.equal((await dashboards.POST(req({ projectId: source.id, version: initial.dashboards[0].version, cards: [{ id: 'source-reads', title: '阅读总量', type: 'metric_card', config: { metricId: originalId } }] }))).status, 200);
  const structure = await vite.ssrLoadModule('/app/api/project-structure/route.ts'); const preview = await (await structure.GET(get(source.id, '&mode=source'))).json();
  const created = await projects.POST(req({ action: 'create', name: '第二内容部门', templateId: 'content_marketing', structureProjectId: source.id, structureRevision: preview.blueprint.revision, structureConfirmed: true })); assert.equal(created.status, 200); const newId = (await created.json()).id;
  const dataset = await saveDataset(newId, 'second-private-content-source', '本部门内容', [{ 内容编号: 'own-new', 发布日期: '2026-11-03', 阅读量: 500, 渠道: '独立渠道', 标题: '新部门记录' }]);
  const own = await (await structure.GET(get(newId))).json(); const bindings = Object.fromEntries(own.blueprint.groups.map(group => [group.key, { datasetId: dataset.id, datasetVersion: dataset.version, fields: Object.fromEntries(group.fields.map(field => [field.key, field.key])) }]));
  const response = await structure.POST(req({ projectId: newId, revision: own.blueprint.revision, bindings, selectedCards: own.blueprint.cards.map(card => card.key), targets: {} })); assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const result = await (await analytics.GET(get(newId, '&kind=content'))).json(); assert.equal(result.configured, true); assert.equal(result.metrics.reads.value, 500); assert.notEqual(result.metrics.reads.definition.id, originalId); assert.equal(result.records.items[0].recordId, 'own-new');
  assert.equal((await (await analytics.GET(get(source.id, '&kind=content'))).json()).metrics.reads.value, 3000);
});
