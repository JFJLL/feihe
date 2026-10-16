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
  cacheDir: 'node_modules/.vite/test-409-fixture',
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

test('stale fingerprint and source mutation triggers true HTTP 409 Conflict', async () => {
  const pId = 'fixture-409-project';
  await db().prepare("INSERT INTO projects(id,name,template_id,org_id,created_at,updated_at) VALUES(?,'测试409项目','content_marketing','org-default',?,?)").bind(pId, baseTime, baseTime).run();

  const headers = Array(59).fill(null);
  for (const [i, name] of [[1,'时间'],[13,'FS总预算'],[16,'小红星'],[28,'小红盟'],[40,'K金额'],[43,'F金额'],[44,'S金额'],[45,'KFSOPZ总金额'],[46,'P(评论)'],[47,'seo投资'],[48,'杂费-'],[49,'投流总金额'],[51,'KFSOPZ总结算金额']]) headers[i] = name;

  const row = Array(59).fill(null);
  row[1] = '2026-10-10';
  row[13] = 100;
  for (const i of [16,17,18,20,28,29,30,32]) row[i] = 10;
  row[40] = 20;
  row[43] = 40;
  row[44] = 40;
  row[49] = 80;
  row[45] = 110;
  row[51] = 100;
  for (const start of [16,28]) {
    row[start + 5] = 40;
    row[start + 7] = 20;
    row[start + 8] = 20;
    row[start + 9] = 2;
    row[start + 10] = 1;
    row[start + 11] = 5;
  }

  const tableWeekly = {
    key: 'f_week',
    role: 'weekly',
    rows: [headers, Array(59).fill(null), row],
    version: '1',
    capturedAt: baseTime,
    url: 'https://example.test/f_week',
    complete: true,
    range: 'A1:BG10'
  };

  const kwTable = {
    key: 'f_kw',
    role: 'keywords',
    rows: [
      ['市场出价', '搜索指数', '关键词', '消费占比', '消耗/元', 'CP星盟UV', 'CTR', 'CPC'],
      ['1.0', '500', '测试词条A', '50.0%', '500.00', '10.00', '5.0%', '1.00']
    ],
    version: '1',
    capturedAt: baseTime,
    url: 'https://example.test/f_kw',
    complete: true,
    range: 'A1:H5'
  };

  const config = {
    bindings: [
      { key: 'f_week', role: 'weekly', url: 'https://example.test/f_week' },
      { key: 'f_kw', role: 'keywords', url: 'https://example.test/f_kw' }
    ]
  };

  await store.configureBusiness(pId, config, 0);
  await store.ingestBusinessBundle(pId, { tables: [tableWeekly, kwTable] });

  // 1. Read daily summary to obtain initial fingerprint
  const summaryRes = await (await get(pId, '2026-10-10', { summary: '1' })).json();
  assert.equal(summaryRes.ok, true);
  const initialFingerprint = summaryRes.view.fingerprint;
  assert.ok(initialFingerprint);

  // 2. Requesting detail with WRONG / STALE fingerprint triggers HTTP 409
  const wrongRes = await get(pId, '2026-10-10', {
    part: 'table',
    tableTitle: '关键词消耗排行',
    fingerprint: 'stale_expired_fingerprint_12345'
  });
  assert.equal(wrongRes.status, 409);
  const wrongJson = await wrongRes.json();
  assert.match(wrongJson.error, /来源版本已变化/);

  // 3. Confirming daily with WRONG fingerprint triggers HTTP 409
  const wrongConfirm = await api.POST(req({
    action: 'confirm',
    projectId: pId,
    day: '2026-10-10',
    fingerprint: 'stale_expired_fingerprint_12345'
  }));
  assert.equal(wrongConfirm.status, 409);
  const wrongConfirmJson = await wrongConfirm.json();
  assert.match(wrongConfirmJson.error, /业务数据已变化/);

  // 4. Ingest an updated source version -> Mutates underlying fingerprint
  const updatedTable = structuredClone(kwTable);
  updatedTable.version = '2';
  updatedTable.capturedAt = '2026-10-14T04:00:00Z';
  updatedTable.rows[1][4] = '600.00'; // updated spend
  await store.ingestBusinessBundle(pId, { tables: [updatedTable] });

  // 5. Client attempts to page using the old initialFingerprint -> Real 409 Conflict!
  const mutatedPagingRes = await get(pId, '2026-10-10', {
    part: 'table',
    tableTitle: '关键词消耗排行',
    fingerprint: initialFingerprint
  });
  assert.equal(mutatedPagingRes.status, 409);
  const mutatedJson = await mutatedPagingRes.json();
  assert.match(mutatedJson.error, /来源版本已变化，请刷新日报后再展开明细/);
});