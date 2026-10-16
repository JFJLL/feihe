import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import path from 'node:path';
import { createServer } from 'vite';

Object.assign(process.env, {
  LOCAL_DB_PATH: ':memory:',
  LOCAL_DB_NO_SEED: 'true',
  ENABLE_TEST_AUTH: '1',
  REQUIRE_PROD_AUTH: 'false'
});

const vite = await createServer({
  configFile: false,
  cacheDir: 'node_modules/.vite/second-project-test',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  resolve: { alias: { '@': path.resolve('.') } }
});
after(() => vite.close());

const adapter = await vite.ssrLoadModule('/lib/business-daily/adapter.ts');
const store = await vite.ssrLoadModule('/lib/business-daily/store.ts');
const api = await vite.ssrLoadModule('/app/api/business-daily/route.ts');
const { db } = await vite.ssrLoadModule('/lib/db.ts');
await store.ensureBusinessSchema();

const baseTime = '2026-10-14T02:00:00Z';

// Helpers
const req = (body, user = 'user-admin') => new Request('http://localhost/api', {
  method: 'POST',
  headers: { 'x-user-id': user, 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});
const get = (projectId, day, other = {}, user = 'user-admin') => api.GET(
  new Request('http://localhost/api?' + new URLSearchParams({ projectId, day, ...other }), {
    headers: { 'x-user-id': user }
  })
);

test('second project: authorized API configuration and isolated ingestion pipeline', async () => {
  // 1. Create a brand new independent second project: "brand-b-project"
  await db().prepare("INSERT INTO projects(id,name,template_id,org_id,created_at,updated_at) VALUES('brand-b-project','二号新品牌项目','content_marketing','org-default',?,?)").bind(baseTime,baseTime).run();

  // 2. Prior to configuration, reading daily returns empty / unconfigured state without qicui defaults
  const emptyDaily = await store.latestDaily('brand-b-project', '2026-10-14');
  assert.equal(emptyDaily.core.adSpend.value, null);
  assert.equal(emptyDaily.series.length, 0);
  assert.equal(emptyDaily.tables.length, 0);

  // 3. Define brand-b's own custom sources and bindings (No milk powder, totally distinct keywords and spend)
  const headers = Array(59).fill(null);
  for (const [i, name] of [[1,'时间'],[13,'FS总预算'],[16,'小红星'],[28,'小红盟'],[40,'K金额'],[43,'F金额'],[44,'S金额'],[45,'KFSOPZ总金额'],[46,'P(评论)'],[47,'seo投资'],[48,'杂费-'],[49,'投流总金额'],[51,'KFSOPZ总结算金额']]) headers[i] = name;

  const bDailyRow = Array(59).fill(null);
  bDailyRow[1] = '2026-10-12';
  bDailyRow[13] = 300; // FS预算 300
  // Fill inputIndexes: ix.star(16), 17, 18, 20, ix.alliance(28), 29, 30, 32
  for (const i of [16,17,18,20,28,29,30,32]) bDailyRow[i] = 10;
  bDailyRow[40] = 50;  // K金额 50
  bDailyRow[43] = 100; // F金额 100
  bDailyRow[44] = 100; // S金额 100
  bDailyRow[49] = 200; // 投流 200
  bDailyRow[45] = 260; // 总投入 260
  bDailyRow[51] = 250; // 结算 250
  for (const start of [16,28]) {
    bDailyRow[start + 5] = 100;
    bDailyRow[start + 7] = 80;
    bDailyRow[start + 8] = 90;
    bDailyRow[start + 9] = 10;
    bDailyRow[start + 10] = 5;
    bDailyRow[start + 11] = 15;
  }

  const bWeekly = {
    key: 'brand_b_week',
    role: 'weekly',
    rows: [headers, Array(59).fill(null), bDailyRow],
    version: '1',
    capturedAt: baseTime,
    url: 'https://example.test/brand_b_week',
    complete: true,
    range: 'A1:BG10'
  };

  const bDoc = {
    key: 'brand_b_report',
    url: 'https://example.test/brand_b_report',
    version: '1',
    capturedAt: baseTime,
    year: 2026,
    content: '<h1>10月12日</h1><h2>今日待办</h2><p>二号品牌定制投放动作执行中。</p><h3>搜索侧日报</h3><p>聚焦有机与天然关键词。</p>'
  };

  const bBundle = { tables: [bWeekly], document: bDoc };
  const bConfig = {
    bindings: [
      { key: 'brand_b_week', role: 'weekly', url: 'https://example.test/brand_b_week' },
      { key: 'brand_b_report', role: 'document', url: 'https://example.test/brand_b_report' }
    ],
    alertThresholdPoints: 8,
    brands: ['二号品牌'],
    competitorWords: ['竞品X', '竞品Y']
  };

  // 4. Save independent configuration via AUTHORIZED API ROUTE (POST /api/business-daily action=configure)
  // Verify unauthorized user rejected
  const unauthConf = await api.POST(req({ action: 'configure', projectId: 'brand-b-project', config: bConfig }, 'stranger-user'));
  assert.equal(unauthConf.status, 403);

  // Authorized Admin configuration via API
  const authConf = await api.POST(req({ action: 'configure', projectId: 'brand-b-project', config: bConfig }, 'user-admin'));
  assert.equal(authConf.status, 200);
  const confJson = await authConf.json();
  assert.equal(confJson.ok, true);
  assert.equal(confJson.version, 1);

  // Ingest custom bundle into brand-b-project
  const ingestRes = await store.ingestBusinessBundle('brand-b-project', bBundle);
  assert.equal(ingestRes.receipts.length, 2);

  // 5. Query daily report for brand-b-project and verify accurate calculation
  const bDaily = await store.latestDaily('brand-b-project', '2026-10-12');
  assert.equal(bDaily.core.adSpend.value, 200);
  assert.equal(bDaily.core.creatorCost.value, 50);
  assert.equal(bDaily.core.settlement.value, 250);
  assert.equal(bDaily.series.length, 1);
  assert.equal(bDaily.series[0].date, '2026-10-12');
  assert.ok(bDaily.narrative.some(n => n.text.includes('二号品牌定制投放动作')));

  // Verify qicui is untouched and isolated from brand-b-project data
  const qicuiDaily = await store.latestDaily('qicui', '2026-10-12');
  assert.notEqual(qicuiDaily.fingerprint, bDaily.fingerprint);

  // 6. Test full daily confirmation and immutable snapshot
  const confirmRes = await store.confirmDaily('brand-b-project', '2026-10-12', bDaily.fingerprint, 'user-admin');
  assert.ok(confirmRes.snapshotId.includes('brand-b-project:2026-10-12:confirmed:'));

  const confirmedReport = await store.readDaily('brand-b-project', '2026-10-12', 'confirmed');
  assert.equal(confirmedReport.core.adSpend.value, 200);
  assert.equal(confirmedReport.fingerprint, bDaily.fingerprint);

  // 7. Verify Summary vs Detail paging on brand-b-project
  const summaryRes = await (await get('brand-b-project', '2026-10-12', { summary: '1' })).json();
  assert.equal(summaryRes.ok, true);
  assert.equal(summaryRes.view.isSummary, true);
  // fingerprint is preserved on summary!
  assert.equal(summaryRes.view.fingerprint, bDaily.fingerprint);

  // 8. Verify Cross-Project & Role Access enforcement
  // Stranger access -> 403
  assert.equal((await get('brand-b-project', '2026-10-12', {}, 'unauthorized-user')).status, 403);
  // Viewer can read summary
  await db().prepare("INSERT INTO project_members(id,project_id,user_id,role,created_at,updated_at) VALUES('bm-viewer','brand-b-project','b-viewer','viewer',?,?)").bind(baseTime,baseTime).run();
  assert.equal((await get('brand-b-project', '2026-10-12', {}, 'b-viewer')).status, 200);
  // Viewer cannot confirm -> 403
  assert.equal((await api.POST(req({ action: 'confirm', projectId: 'brand-b-project', day: '2026-10-12', fingerprint: bDaily.fingerprint }, 'b-viewer'))).status, 403);
});