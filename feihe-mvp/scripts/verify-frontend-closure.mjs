import assert from 'node:assert/strict';
import { createServer } from 'vite';
import path from 'node:path';

console.log('====================================================');
console.log('  FEIHE FRONTEND PRODUCT CLOSURE VERIFICATION SUITE');
console.log('  Testing deep user flows, closure & data precision');
console.log('====================================================\n');

process.env.LOCAL_DB_PATH = ':memory:';
process.env.LOCAL_DB_NO_SEED = 'true';
process.env.ENABLE_TEST_AUTH = '1';

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  resolve: {
    alias: {
      '@': path.resolve(process.cwd()),
    },
  },
});

const { db, ensureSchema } = await vite.ssrLoadModule('/lib/db.ts');
const { computeMetric, isStatusCompleted } = await vite.ssrLoadModule('/lib/metrics/engine.ts');
const { saveDataset, getProjectDatasets } = await vite.ssrLoadModule('/lib/datasets.ts');
const { importRows } = await vite.ssrLoadModule('/lib/import-rows.ts');
const { POST: projectsPost, GET: projectsGet } = await vite.ssrLoadModule('/app/api/projects/route.ts');
const { POST: dashboardsPost, GET: dashboardsGet } = await vite.ssrLoadModule('/app/api/dashboards/route.ts');
const { POST: feishuInspect } = await vite.ssrLoadModule('/app/api/feishu/inspect/route.ts');

await ensureSchema();
const d1 = db();

function mockReq(url, method = 'GET', body, headers = {}) {
  const h = new Headers({ 'Content-Type': 'application/json', 'x-user-id': 'user-admin', ...headers });
  return new Request('http://127.0.0.1:5173' + url, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ----------------------------------------------------
// Test 1: Status Matching & Task Completion Precision (Dataset A)
// ----------------------------------------------------
console.log('Test 1: 数据集 A 任务状态匹配与完成率精度测试...');
assert.equal(isStatusCompleted('已完成'), true, '已完成判定为 true');
assert.equal(isStatusCompleted('完成'), true, '完成判定为 true');
assert.equal(isStatusCompleted('done'), true, 'done 判定为 true');
assert.equal(isStatusCompleted('finished'), true, 'finished 判定为 true');
assert.equal(isStatusCompleted('未完成'), false, '未完成绝不能判定为 true');
assert.equal(isStatusCompleted('尚未完成'), false, '尚未完成绝不能判定为 true');
assert.equal(isStatusCompleted('not done'), false, 'not done 绝不能判定为 true');
assert.equal(isStatusCompleted('unfinished'), false, 'unfinished 绝不能判定为 true');
assert.equal(isStatusCompleted('进行中'), false, '进行中不能判定为已完成');
assert.equal(isStatusCompleted(''), false, '空值不能判定为已完成');

const testProjA = 'proj-closure-test-a';
await d1.prepare("INSERT OR REPLACE INTO projects(id, name, template_id, status, color, created_at, updated_at) VALUES(?, '数据集A测试项目', 'general_workbench', '进行中', '#2563eb', datetime('now'), datetime('now'))").bind(testProjA).run();
await d1.prepare("INSERT OR IGNORE INTO project_members(id, project_id, user_id, role, created_at, updated_at) VALUES(?, ?, 'user-admin', 'project_admin', datetime('now'), datetime('now'))").bind(`${testProjA}:user-admin`, testProjA).run();

const datasetARows = [
  { '任务名称': '任务一', '状态': '已完成' },
  { '任务名称': '任务二', '状态': '未完成' },
  { '任务名称': '任务三', '状态': '进行中' },
  { '任务名称': '任务四', '状态': '已完成' },
  { '任务名称': '任务五', '状态': '尚未完成' },
  { '任务名称': '任务六', '状态': 'not done' },
  { '任务名称': '任务七', '状态': 'unfinished' },
];
await saveDataset(testProjA, 'tasks-ds-a', '任务状态表A', datasetARows);

const resA_completed = await computeMetric(testProjA, 'task_completed', { source: 'tasks-ds-a' });
assert.equal(resA_completed.value, 2, '7项任务中仅2项真正完成（未完成/尚未完成/not done/unfinished严禁误算）');
console.log('✅ PASS Test 1: 任务状态精确识别完成，无模糊匹配误判\n');

// ----------------------------------------------------
// Test 2: Dataset B 渠道咨询与成交率口径测试 (No Row-Level Average!)
// ----------------------------------------------------
console.log('Test 2: 数据集 B 渠道咨询与成交率全盘口径测试...');
const testProjB = 'proj-closure-test-b';
await d1.prepare("INSERT OR REPLACE INTO projects(id, name, template_id, status, color, created_at, updated_at) VALUES(?, '数据集B测试项目', 'general_workbench', '进行中', '#2563eb', datetime('now'), datetime('now'))").bind(testProjB).run();
await d1.prepare("INSERT OR IGNORE INTO project_members(id, project_id, user_id, role, created_at, updated_at) VALUES(?, ?, 'user-admin', 'project_admin', datetime('now'), datetime('now'))").bind(`${testProjB}:user-admin`, testProjB).run();

const datasetBRows = [
  { '日期': '2026-10-01', '渠道': '渠道 A', '咨询人数': 10, '成交人数': 1 },
  { '日期': '2026-10-02', '渠道': '渠道 B', '咨询人数': 90, '成交人数': 18 },
];
await saveDataset(testProjB, 'conv-ds-b', '渠道咨询与成交表', datasetBRows);

// Compute total consultation & conversion
const mInquiry = await computeMetric(testProjB, 'consultation_total', { source: 'conv-ds-b' });
assert.equal(mInquiry.value, 100, '总咨询人数合计为 100');

const mConversion = await computeMetric(testProjB, 'conversion_total', { source: 'conv-ds-b' });
assert.equal(mConversion.value, 19, '总成交人数合计为 19');

const mConvRate = await computeMetric(testProjB, 'conversion_rate', { source: 'conv-ds-b', groupBy: '渠道' });
assert.equal(mConvRate.formattedValue, '19.0%', '全范围成交率为 19/100 = 19.0%，严禁平均行级比率成 15%！');
assert.equal(mConvRate.groups.length, 2, '按渠道成功细分为2组');
const groupA = mConvRate.groups.find(g => g.label === '渠道 A');
const groupB = mConvRate.groups.find(g => g.label === '渠道 B');
assert.equal(groupA.value, 10, '渠道 A 成交率为 10%');
assert.equal(groupB.value, 20, '渠道 B 成交率为 20%');

// Test date filtering on dataset B
const mDate1 = await computeMetric(testProjB, 'conversion_rate', { source: 'conv-ds-b', from: '2026-10-01', to: '2026-10-01' });
assert.equal(mDate1.formattedValue, '10.0%', '仅选 2026-10-01 时成交率为 10.0%');

const mDate2 = await computeMetric(testProjB, 'conversion_rate', { source: 'conv-ds-b', from: '2026-10-02', to: '2026-10-02' });
assert.equal(mDate2.formattedValue, '20.0%', '仅选 2026-10-02 时成交率为 20.0%');
console.log('✅ PASS Test 2: 数据集 B 全盘与分日加权成交率计算 100% 严谨通过\n');

// ----------------------------------------------------
// Test 3: Onboarding Finish Does NOT Wipe Project Details
// ----------------------------------------------------
console.log('Test 3: 项目初始化完成不损坏已有资料测试...');
const testProjC = 'proj-closure-test-c';
await d1.prepare(`INSERT OR REPLACE INTO projects(
  id, name, spu, brand, category, description, status, color, department_id, client_id, onboarding_status, created_at, updated_at
) VALUES(?, '华北区重点营销项目', '星飞帆4段', '飞鹤', '婴幼儿配方', '重要试点项目说明文字', '筹备中', '#e11d48', 'dept-marketing', 'client-feihe', 'source', datetime('now'), datetime('now'))`).bind(testProjC).run();
await d1.prepare("INSERT OR IGNORE INTO project_members(id, project_id, user_id, role, created_at, updated_at) VALUES(?, ?, 'user-admin', 'project_admin', datetime('now'), datetime('now'))").bind(`${testProjC}:user-admin`, testProjC).run();

// Trigger onboarding update
const finishReq = mockReq('/api/projects', 'POST', {
  action: 'update_onboarding',
  projectId: testProjC,
  onboardingStatus: 'ready',
});
const finishRes = await projectsPost(finishReq);
assert.equal(finishRes.status, 200);

const verifyProjC = await d1.prepare('SELECT * FROM projects WHERE id=?').bind(testProjC).first();
assert.equal(verifyProjC.onboarding_status, 'ready', '初始化状态已更新为 ready');
assert.equal(verifyProjC.name, '华北区重点营销项目', '项目名称未被清空或覆盖');
assert.equal(verifyProjC.brand, '飞鹤', '项目品牌未被清空');
assert.equal(verifyProjC.spu, '星飞帆4段', 'SPU 未被清空');
assert.equal(verifyProjC.description, '重要试点项目说明文字', '项目说明未被破坏');
assert.equal(verifyProjC.status, '筹备中', '业务状态维持原样');
assert.equal(verifyProjC.department_id, 'dept-marketing', '负责部门维持原样');
assert.equal(verifyProjC.color, '#e11d48', '识别色维持原样');
console.log('✅ PASS Test 3: 完成初始化原子操作测试通过，非目标字段 100% 完好\n');

// ----------------------------------------------------
// Test 4: General Data Sync Actually Writes to DB
// ----------------------------------------------------
console.log('Test 4: 通用数据导入真实写入数据集验证...');
const testProjD = 'proj-closure-test-d';
await d1.prepare("INSERT OR REPLACE INTO projects(id, name, template_id, status, color, created_at, updated_at) VALUES(?, '通用导入测试项目', 'general_workbench', '进行中', '#2563eb', datetime('now'), datetime('now'))").bind(testProjD).run();

const generalInputRows = [
  { '任务名称': '执行物料准备', '负责人': '赵六', '预算': 5000, '实际支出': 4200, '状态': '已完成' },
  { '任务名称': '线上社群裂变', '负责人': '孙七', '预算': 12000, '实际支出': 11800, '状态': '进行中' },
  { '任务名称': '复盘报告汇总', '负责人': '周八', '预算': 3000, '实际支出': 0, '状态': '待开始' },
];

const syncResult = await importRows('general', generalInputRows, true, testProjD, 'src-general-real', '通用活动任务表');
assert.equal(syncResult.imported, 3, '导入统计为 3 行');

// Verify dataset and dataset_rows actually exist in DB!
const dsD = await d1.prepare("SELECT * FROM datasets WHERE project_id=? AND source_id='src-general-real'").bind(testProjD).first();
assert.ok(dsD, '数据集记录已真实写入 datasets 表');
assert.equal(dsD.row_count, 3, '数据集行数真实记录为 3');

const rowsD = await d1.prepare("SELECT * FROM dataset_rows WHERE dataset_id=?").bind(dsD.id).all();
assert.equal(rowsD.results.length, 3, 'dataset_rows 表中真实持久化了 3 条记录，严禁假成功！');
console.log('✅ PASS Test 4: 通用数据导入真实落库，杜绝假成功计数\n');

// ----------------------------------------------------
// Test 5: Member Management (Add, Change Role, Remove)
// ----------------------------------------------------
console.log('Test 5: 成员管理完整生命周期闭环验证...');
const testProjE = 'proj-closure-test-e';
await d1.prepare("INSERT OR REPLACE INTO projects(id, name, template_id, status, color, created_at, updated_at) VALUES(?, '成员协作测试项目', 'general_workbench', '进行中', '#2563eb', datetime('now'), datetime('now'))").bind(testProjE).run();
await d1.prepare("INSERT OR IGNORE INTO project_members(id, project_id, user_id, role, created_at, updated_at) VALUES(?, ?, 'user-admin', 'project_admin', datetime('now'), datetime('now'))").bind(`${testProjE}:user-admin`, testProjE).run();

// 1. Add member
const addReq = mockReq('/api/projects', 'POST', {
  action: 'manage_member',
  projectId: testProjE,
  userId: 'user-viewer',
  role: 'editor',
});
const addRes = await projectsPost(addReq);
assert.equal(addRes.status, 200);

const memCheck1 = await d1.prepare("SELECT role FROM project_members WHERE project_id=? AND user_id='user-viewer'").bind(testProjE).first();
assert.equal(memCheck1.role, 'editor', '成员添加成功且角色为 editor');

// 2. Change role
const roleReq = mockReq('/api/projects', 'POST', {
  action: 'manage_member',
  projectId: testProjE,
  userId: 'user-viewer',
  role: 'project_admin',
});
const roleRes = await projectsPost(roleReq);
assert.equal(roleRes.status, 200);

const memCheck2 = await d1.prepare("SELECT role FROM project_members WHERE project_id=? AND user_id='user-viewer'").bind(testProjE).first();
assert.equal(memCheck2.role, 'project_admin', '成员角色已成功更新为 project_admin');

// 3. Remove member
const rmReq = mockReq('/api/projects', 'POST', {
  action: 'manage_member',
  projectId: testProjE,
  userId: 'user-viewer',
  subAction: 'remove',
});
const rmRes = await projectsPost(rmReq);
assert.equal(rmRes.status, 200);

const memCheck3 = await d1.prepare("SELECT * FROM project_members WHERE project_id=? AND user_id='user-viewer'").bind(testProjE).first();
assert.equal(memCheck3, null, '成员已成功从 project_members 中移除');
console.log('✅ PASS Test 5: 成员添加、改权、移除全套生命周期闭环验证通过\n');

// ----------------------------------------------------
// Test 6: Dynamic Dashboard Card Customization & Concurrency
// ----------------------------------------------------
console.log('Test 6: 动态看板卡片自定义与乐观锁并发测试...');
const testProjF = 'proj-closure-test-f';
await d1.prepare("INSERT OR REPLACE INTO projects(id, name, template_id, status, color, created_at, updated_at) VALUES(?, '看板配置测试项目', 'general_workbench', '进行中', '#2563eb', datetime('now'), datetime('now'))").bind(testProjF).run();
await d1.prepare("INSERT OR IGNORE INTO project_members(id, project_id, user_id, role, created_at, updated_at) VALUES(?, ?, 'user-admin', 'project_admin', datetime('now'), datetime('now'))").bind(`${testProjF}:user-admin`, testProjF).run();

const dashPostReq = mockReq('/api/dashboards', 'POST', {
  projectId: testProjF,
  dashboardId: `dash-${testProjF}-custom`,
  name: '运营自定义看板',
  version: 1,
  cards: [
    { title: '总咨询人数', type: 'metric_card', metricKeys: ['consultation_total'] },
    { title: '全盘成交转化率', type: 'progress_card', metricKeys: ['conversion_rate'] },
  ],
});
const dashPostRes = await dashboardsPost(dashPostReq);
assert.equal(dashPostRes.status, 200);

const cardsCheck = await d1.prepare("SELECT title, type FROM dashboard_cards WHERE project_id=? ORDER BY sort_order ASC").bind(testProjF).all();
assert.equal(cardsCheck.results.length, 2, '2 张动态卡片成功持久化入库');
assert.equal(cardsCheck.results[0].title, '总咨询人数');
assert.equal(cardsCheck.results[1].title, '全盘成交转化率');

// Test concurrency 409 conflict
const conflictReq = mockReq('/api/dashboards', 'POST', {
  projectId: testProjF,
  dashboardId: `dash-${testProjF}-custom`,
  version: 1, // Already updated to 2, sending version 1 must trigger 409
  cards: [],
});
const conflictRes = await dashboardsPost(conflictReq);
assert.equal(conflictRes.status, 409, '过旧版本保存严格拦截 409 Conflict，保护成员并发修改');
console.log('✅ PASS Test 6: 动态看板卡片保存、渲染映射与并发版本锁通过\n');

console.log('====================================================');
console.log('  🎉 ALL FRONTEND PRODUCT CLOSURE TESTS PASSED (100%)!');
console.log('====================================================');

process.exit(0);