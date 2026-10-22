import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';

const vite = await createServer({
  configFile: false,
  cacheDir: 'node_modules/.vite/campaign-verify-api',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  resolve: { alias: { '@': path.resolve('.') } },
});

try {
  console.log('[TEST] 开始验证 Campaign Dashboard API 与 Projects 列表 API...');

  const projectsMod = await vite.ssrLoadModule('/app/api/projects/route.ts');
  const campaignMod = await vite.ssrLoadModule('/app/api/campaign-dashboard/route.ts');

  // 1. Test GET /api/projects for user-editor
  const reqProjectsEditor = new Request('http://localhost/api/projects', {
    headers: { 'x-user-id': 'user-editor' },
  });
  const resProjects = await projectsMod.GET(reqProjectsEditor);
  assert.equal(resProjects.status, 200, 'projects API should return 200');
  const projectsData = await resProjects.json();
  assert.equal(projectsData.ok, true);

  const pMap = new Map(projectsData.projects.map((p) => [p.id, p]));
  console.log(`[TEST] user-editor 可见项目数: ${projectsData.projects.length}`);
  assert.ok(pMap.has('qicui'), 'projects must include qicui');
  assert.ok(pMap.has('kailas'), 'projects must include kailas');
  assert.ok(pMap.has('meiling'), 'projects must include meiling');
  assert.ok(pMap.has('winner-wipes'), 'projects must include winner-wipes');

  // Verify campaignSnapshotAt field
  const qicui = pMap.get('qicui');
  const kailas = pMap.get('kailas');
  const meiling = pMap.get('meiling');
  const wipes = pMap.get('winner-wipes');

  assert.equal(qicui.campaignSnapshotAt, null, 'qicui campaignSnapshotAt should be null');
  assert.ok(kailas.campaignSnapshotAt, 'kailas campaignSnapshotAt should exist');
  assert.ok(meiling.campaignSnapshotAt, 'meiling campaignSnapshotAt should exist');
  assert.ok(wipes.campaignSnapshotAt, 'wipes campaignSnapshotAt should exist');
  console.log('[PASS] /api/projects 返回 4 项目且 campaignSnapshotAt 字段正确');

  // 2. Test GET /api/campaign-dashboard for kailas, meiling, winner-wipes
  for (const pid of ['kailas', 'meiling', 'winner-wipes']) {
    const req = new Request(`http://localhost/api/campaign-dashboard?projectId=${pid}`, {
      headers: { 'x-user-id': 'user-editor' },
    });
    const res = await campaignMod.GET(req);
    assert.equal(res.status, 200, `${pid} campaign-dashboard should return 200`);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.projectId, pid);
    assert.ok(Array.isArray(data.dashboard.sources));
    assert.ok(Array.isArray(data.dashboard.kpis));
    assert.ok(Array.isArray(data.dashboard.tables));
    assert.ok(Array.isArray(data.dashboard.dailyDatasets), `${pid} must contain dailyDatasets array`);
    const expectedCounts = { kailas: 1, meiling: 5, "winner-wipes": 2 };
    assert.equal(data.dashboard.dailyDatasets.length, expectedCounts[pid], `${pid} dailyDatasets count mismatch`);
    console.log(`[PASS] ${pid} 看板快照读回成功: sources=${data.dashboard.sources.length}, kpis=${data.dashboard.kpis.length}, tables=${data.dashboard.tables.length}, dailyDatasets=${data.dashboard.dailyDatasets.length}`);
  }

  // 3. Test GET /api/campaign-dashboard for qicui -> must return 400 (template rejection)
  const reqQicui = new Request('http://localhost/api/campaign-dashboard?projectId=qicui', {
    headers: { 'x-user-id': 'user-editor' },
  });
  const resQicui = await campaignMod.GET(reqQicui);
  assert.equal(resQicui.status, 400, 'qicui should be rejected with 400');
  const qicuiErr = await resQicui.json();
  assert.equal(qicuiErr.error, '该项目非轻量营销看板(campaign_review)模板');
  console.log('[PASS] qicui 访问 campaign-dashboard 成功被 400 拦截 (非 campaign_review 模板)');

  // 4. Test GET /api/campaign-dashboard for non-existent project -> must return 403/404
  const reqNonExistent = new Request('http://localhost/api/campaign-dashboard?projectId=project-xyz', {
    headers: { 'x-user-id': 'user-editor' },
  });
  const resNonExistent = await campaignMod.GET(reqNonExistent);
  assert.ok([403, 404].includes(resNonExistent.status), 'non-existent project should return 403 or 404');
  console.log(`[PASS] 不存在项目返回安全状态码 ${resNonExistent.status}`);

  // 5. Test GET /api/campaign-dashboard for user-viewer on kailas -> must return 403 (unauthorized)
  const reqViewerKailas = new Request('http://localhost/api/campaign-dashboard?projectId=kailas', {
    headers: { 'x-user-id': 'user-viewer' },
  });
  const resViewerKailas = await campaignMod.GET(reqViewerKailas);
  assert.equal(resViewerKailas.status, 403, 'user-viewer should have no access to kailas (403)');
  console.log('[PASS] 无成员权限身份 (user-viewer) 访问 kailas 成功返回 403 拦截');

  console.log('\n[ALL TESTS PASSED] 全部 API 鉴权、模板拦截与数据读回用例通过！');
} finally {
  await vite.close();
}
