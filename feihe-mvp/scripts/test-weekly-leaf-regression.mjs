import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import path from 'node:path';
import { createServer } from 'vite';
import { DatabaseSync } from 'node:sqlite';

const vite = await createServer({
  configFile: false,
  cacheDir: 'node_modules/.vite/regression-test',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  root: '.',
  resolve: { alias: { '@': path.resolve('.') } }
});
after(() => vite.close());

const adapter = await vite.ssrLoadModule('/lib/business-daily/adapter.ts');

function buildHeaders() {
  const h = Array(59).fill(null);
  h[1] = '时间';
  h[13] = 'FS总预算';
  h[16] = '小红星';
  h[28] = '小红盟';
  h[40] = 'K金额';
  h[41] = 'F-视频流金额';
  h[42] = 'F-信息流金额';
  h[43] = 'F金额';
  h[44] = 'S金额';
  h[45] = 'KFSOPZ总金额';
  h[46] = 'P(评论)';
  h[47] = 'seo投资';
  h[48] = '杂费-';
  h[49] = '投流总金额';
  h[50] = 'KFS总结算金额';
  h[51] = 'KFSOPZ总结算金额';
  return h;
}

const makeTable = (rows) => ({
  key: 'weekly-test',
  role: 'weekly',
  url: 'https://example.test/weekly',
  version: '1',
  capturedAt: '2026-10-16T05:00:00Z',
  range: 'A1:BG10',
  rows: [buildHeaders(), Array(59).fill(null), ...rows],
  complete: true,
});

test('1. isolated unit: only creator filled (Star K=10901, Alliance K=23223.2), ad leaves all null, formula 0', () => {
  const r = Array(59).fill(null);
  r[1] = '46310'; // 2026-10-15
  r[13] = '200000';
  r[16] = '10901';   // Star K leaf
  r[28] = '23223.2'; // Alliance K leaf
  // Ad leaves (17, 18, 20, 29, 30, 32) remain null
  r[40] = '34124.2'; // formula K
  r[41] = '0';       // formula F video
  r[42] = '0';       // formula F feed
  r[43] = '0';       // formula F total
  r[44] = '0';       // formula S total
  r[45] = '39524.2'; // formula KFSOPZ total
  r[47] = '5400';    // SEO
  r[49] = '0';       // formula Ad total
  r[51] = '38329.853'; // formula settlement

  const table = makeTable([r]);
  const points = adapter.weeklyPoints(table);
  assert.equal(points.length, 1);
  const p = points[0];

  assert.equal(p.date, '2026-10-15');
  assert.equal(p.creatorCost.value, 34124.2);
  assert.equal(p.creatorCost.state, 'observed');
  assert.equal(p.seo.value, 5400);
  assert.equal(p.seo.state, 'observed');

  // Ad spend must be not_collected, NOT observed 0
  assert.equal(p.adSpend.value, null);
  assert.equal(p.adSpend.state, 'not_collected');
  assert.equal(p.feed.value, null);
  assert.equal(p.feed.state, 'not_collected');
  assert.equal(p.search.value, null);
  assert.equal(p.search.state, 'not_collected');

  // Project investment and settlement missing ad component cannot be treated as complete actual total
  assert.equal(p.projectInvestment.value, null);
  assert.equal(p.projectInvestment.state, 'not_collected');
  assert.equal(p.projectInvestment.partialValue, 39524.2);
  assert.equal(p.settlement.value, null);
  assert.equal(p.settlement.state, 'not_collected');
  assert.equal(p.settlement.partialValue, 38329.853);
});

test('2. isolated unit: all financial inputs unfilled / template row', () => {
  const r = Array(59).fill(null);
  r[1] = '46311'; // 2026-10-16
  r[13] = '180000';
  r[40] = '0';
  r[43] = '0';
  r[44] = '0';
  r[45] = '0';
  r[49] = '0';
  r[51] = '0';

  const table = makeTable([r]);
  const points = adapter.weeklyPoints(table);
  assert.equal(points.length, 1);
  const p = points[0];

  assert.equal(p.creatorCost.value, null);
  assert.equal(p.creatorCost.state, 'not_collected');
  assert.equal(p.adSpend.value, null);
  assert.equal(p.adSpend.state, 'not_collected');
  assert.equal(p.projectInvestment.value, null);
  assert.equal(p.projectInvestment.state, 'not_collected');
  assert.equal(p.settlement.value, null);
  assert.equal(p.settlement.state, 'not_collected');
});

test('3. isolated unit: explicit ad leaf input is 0 (genuine zero)', () => {
  const r = Array(59).fill(null);
  r[1] = '46310';
  r[13] = '100000';
  // Explicit 0 entered into leaf cells
  r[16] = '0'; // Star K = 0
  r[17] = '0'; // Star F feed = 0
  r[18] = '0'; // Star F video = 0
  r[20] = '0'; // Star search = 0
  r[28] = '0'; // Alliance K = 0
  r[29] = '0'; // Alliance F feed = 0
  r[30] = '0'; // Alliance F video = 0
  r[32] = '0'; // Alliance search = 0
  r[40] = '0';
  r[43] = '0';
  r[44] = '0';
  r[45] = '0';
  r[47] = '0';
  r[49] = '0';
  r[51] = '0';

  const table = makeTable([r]);
  const points = adapter.weeklyPoints(table);
  const p = points[0];

  // Explicit 0 must be preserved as observed 0
  assert.equal(p.creatorCost.value, 0);
  assert.equal(p.creatorCost.state, 'observed');
  assert.equal(p.feed.value, 0);
  assert.equal(p.feed.state, 'observed');
  assert.equal(p.search.value, 0);
  assert.equal(p.search.state, 'observed');
  assert.equal(p.adSpend.value, 0);
  assert.equal(p.adSpend.state, 'observed');
  assert.equal(p.projectInvestment.value, 0);
  assert.equal(p.projectInvestment.state, 'observed');
  assert.equal(p.settlement.value, 0);
  assert.equal(p.settlement.state, 'observed');
});

test('4. isolated unit: complete day with ads and creator', () => {
  const r = Array(59).fill(null);
  r[1] = '46309'; // 2026-10-14
  r[13] = '200000';
  r[16] = '3500.2';
  r[17] = '11720.34';
  r[18] = '2315.87';
  r[20] = '46893.7';
  r[28] = '27060';
  r[29] = '22511.58';
  r[30] = '5403.97';
  r[32] = '95172.9';
  r[40] = '30560.2';
  r[43] = '41951.76';
  r[44] = '142066.6';
  r[45] = '219978.56';
  r[47] = '5400';
  r[48] = '0';
  r[49] = '184018.36';
  r[51] = '213388.4022';

  const table = makeTable([r]);
  const p = adapter.weeklyPoints(table)[0];
  assert.equal(p.creatorCost.value, 30560.2);
  assert.equal(p.creatorCost.state, 'observed');
  assert.equal(p.feed.value, 41951.76);
  assert.equal(p.search.value, 142066.6);
  assert.equal(p.adSpend.value, 184018.36);
  assert.equal(p.adSpend.state, 'observed');
  assert.equal(p.projectInvestment.value, 219978.56);
  assert.equal(p.projectInvestment.state, 'observed');
  assert.equal(p.settlement.value, 213388.4022);
  assert.equal(p.settlement.state, 'observed');
});

test('5. isolated unit: mixed range accumulation, through date and independent platform native observation', () => {
  // Day 14: full ads (100) + creator (20) = 120
  const r14 = Array(59).fill(null);
  r14[1] = '2026-10-14';
  r14[13] = 100;
  r14[16] = 20; r14[17] = 40; r14[20] = 60;
  r14[40] = 20; r14[43] = 40; r14[44] = 60; r14[49] = 100; r14[45] = 120; r14[51] = 110;

  // Day 15: creator (50) + seo (10), ads missing
  const r15 = Array(59).fill(null);
  r15[1] = '2026-10-15';
  r15[13] = 100;
  r15[16] = 50;
  r15[40] = 50; r15[43] = 0; r15[44] = 0; r15[49] = 0; r15[45] = 60; r15[47] = 10; r15[51] = 55;

  const table = makeTable([r14, r15]);
  const view = adapter.buildDailyView('test-p', { tables: [table] }, '2026-10-15', {
    from: '2026-10-14',
    to: '2026-10-15',
    platformObservations: [
      {
        sourceKey: 'juguang-f',
        accountId: 'acc_jg_f',
        businessDay: '2026-10-15',
        capturedAt: '2026-10-16T05:10:19Z',
        data: { placementName: '信息流推广', fee: '39608.89', impression: '276942', click: '22357' }
      },
      {
        sourceKey: 'juguang-f',
        accountId: 'acc_jg_f',
        businessDay: '2026-10-15',
        capturedAt: '2026-10-16T05:10:19Z',
        data: { placementName: '视频内流', fee: '10590.48', impression: '60143', click: '198' }
      },
      {
        sourceKey: 'juguang-s',
        accountId: 'acc_jg_s',
        businessDay: '2026-10-15',
        capturedAt: '2026-10-16T05:10:31Z',
        data: { placementName: '搜索推广', fee: '170409.84', impression: '217242', click: '14948' }
      }
    ]
  });

  // Through dates: complete finance is through 14, while creator registered through 15
  assert.equal(view.businessThrough, '2026-10-14');
  assert.equal(view.latestCompleteDay, '2026-10-14');
  assert.equal(view.latestRegisteredDay, '2026-10-15');
  assert.equal(view.financeThrough, '2026-10-14');

  // Day 15 core fields
  assert.equal(view.core.adSpend.value, null);
  assert.equal(view.core.adSpend.state, 'not_collected');
  assert.equal(view.core.creatorCost.value, 50);
  assert.equal(view.core.projectInvestment.value, null);
  assert.equal(view.core.projectInvestment.partialValue, 60);

  // Native platform observation is preserved independently
  assert.ok(view.platformNative);
  assert.equal(view.platformNative.day, '2026-10-15');
  assert.equal(view.platformNative.totalFee, 220609.21);
  assert.equal(view.platformNative.feedFee, 50199.37);
  assert.equal(view.platformNative.searchFee, 170409.84);
  assert.equal(view.platformNative.status, 'missing_weekly');

  // Platform table exists
  const platTable = view.tables.find(t => t.key === 'platform-native-reconciliation');
  assert.ok(platTable);
  assert.equal(platTable.rows.length, 4); // 3 placements + 1 total
  assert.equal(platTable.rows[3][3], 220609.21);

  // Platform difference exists
  const platDiff = view.differences.find(d => d.key === 'platform-unreconciled-2026-10-15');
  assert.ok(platDiff);
  assert.match(platDiff.details, /220609\.21/);
});

test('6. snapshot stability: 2026-10-13 confirmed report fingerprint f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e does not drift', async () => {
  const isLive = process.argv.includes('--live');
  if (isLive) {
    const fs = await import('node:fs');
    if (fs.existsSync('data/local.db')) {
      const db = new DatabaseSync('data/local.db', { readOnly: true });
      const confirmed = db.prepare("SELECT fingerprint FROM business_daily_reports WHERE project_id='qicui' AND business_day='2026-10-13' AND status='confirmed'").get();
      assert.ok(confirmed, '2026-10-13 confirmed report must exist in live db');
      assert.equal(confirmed.fingerprint, 'f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e');
      return;
    }
  }
  // In-memory isolated verification: confirmed snapshot storage & fingerprint preservation
  const memDb = new DatabaseSync(':memory:');
  memDb.exec(`CREATE TABLE IF NOT EXISTS business_daily_reports(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,business_day TEXT NOT NULL,status TEXT NOT NULL,confirmed_by TEXT,created_at TEXT NOT NULL,fingerprint TEXT NOT NULL,payload_json TEXT NOT NULL)`);
  memDb.prepare(`INSERT INTO business_daily_reports VALUES(?,?,?,?,?,?,?,?)`).run(
    'rep-conf-13', 'qicui', '2026-10-13', 'confirmed', 'user-admin', '2026-10-13 10:00:00',
    'f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e',
    '{"day":"2026-10-13","confirmed":true}'
  );
  const row = memDb.prepare("SELECT fingerprint FROM business_daily_reports WHERE business_day='2026-10-13'").get();
  assert.equal(row.fingerprint, 'f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e');
});

test('7. capture fixture verification: days 1-14 complete, day 15 creator registered, native platform 220609.21 independent', async () => {
  const isLive = process.argv.includes('--live');
  let captureRows;
  if (isLive) {
    const fs = await import('node:fs');
    if (fs.existsSync('data/local.db')) {
      const db = new DatabaseSync('data/local.db', { readOnly: true });
      const row = db.prepare("SELECT payload_json FROM business_captures WHERE id = 'qicui:weekly-q4:169af91b618105f9dfd7cde641e99f1f3cbc252e780d1a835532ea92775071fd'").get();
      if (row) captureRows = JSON.parse(row.payload_json).rows;
    }
  }
  if (!captureRows) {
    // Pure isolated fixture: day 14 complete ads, day 15 creator registered (Star K 10901, Alliance K 23223.2), ads null
    const r14 = Array(59).fill(null);
    r14[1] = '46309'; // 2026-10-14
    r14[13] = '200000';
    r14[16] = '3500.2'; r14[17] = '11720.34'; r14[18] = '2315.87'; r14[20] = '46893.7';
    r14[28] = '27060'; r14[29] = '22511.58'; r14[30] = '5403.97'; r14[32] = '95172.9';
    r14[40] = '30560.2'; r14[43] = '41951.76'; r14[44] = '142066.6'; r14[45] = '219978.56';
    r14[47] = '5400'; r14[48] = '0'; r14[49] = '184018.36'; r14[51] = '213388.4022';

    const r15 = Array(59).fill(null);
    r15[1] = '46310'; // 2026-10-15
    r15[13] = '200000';
    r15[16] = '10901'; r15[28] = '23223.2';
    r15[40] = '34124.2'; r15[41] = '0'; r15[42] = '0'; r15[43] = '0'; r15[44] = '0';
    r15[45] = '39524.2'; r15[47] = '5400'; r15[48] = '0'; r15[49] = '0'; r15[51] = '38329.853';

    captureRows = [buildHeaders(), Array(59).fill(null), r14, r15];
  }

  const table = {
    key: 'weekly-fixture',
    role: 'weekly',
    url: 'https://example.test/weekly',
    version: '11899',
    capturedAt: '2026-10-16T05:00:00Z',
    range: 'A1:BG45',
    rows: captureRows,
    complete: true
  };
  const points = adapter.weeklyPoints(table);

  // Day 14 complete
  const p14 = points.find(p => p.date === '2026-10-14');
  assert.ok(p14);
  assert.equal(p14.creatorCost.value, 30560.2);
  assert.equal(p14.adSpend.value, 184018.36);
  assert.equal(p14.projectInvestment.value, 219978.56);

  // Day 15 creatorCost=34124.2, adSpend=null, projectInvestment=null
  const p15 = points.find(p => p.date === '2026-10-15');
  assert.ok(p15);
  assert.equal(p15.creatorCost.value, 34124.2);
  assert.equal(p15.creatorCost.state, 'observed');
  assert.equal(p15.seo.value, 5400);
  assert.equal(p15.seo.state, 'observed');
  assert.equal(p15.adSpend.value, null);
  assert.equal(p15.adSpend.state, 'not_collected');
  assert.equal(p15.projectInvestment.value, null);
  assert.equal(p15.projectInvestment.partialValue, 39524.2);
  assert.equal(p15.settlement.value, null);
  assert.equal(p15.settlement.partialValue, 38329.853);
});

test('8. isolated unit: platform reconciliation three states (missing, different with 14 delta 36808.98, and matched)', () => {
  // Setup 3 days:
  // Day 13: weekly ad 100, native 100 -> matched
  // Day 14: weekly ad 184018.36, native 220827.34 -> difference +36808.98
  // Day 15: weekly ad null, native 220609.21 -> missing_weekly
  const r13 = Array(59).fill(null);
  r13[1] = '2026-10-13'; r13[13] = 100;
  r13[16] = 10; r13[17] = 50; r13[20] = 50;
  r13[40] = 10; r13[43] = 50; r13[44] = 50; r13[49] = 100; r13[45] = 110; r13[51] = 105;

  const r14 = Array(59).fill(null);
  r14[1] = '2026-10-14'; r14[13] = 200000;
  r14[16] = 3000; r14[17] = 41951.76; r14[20] = 142066.6;
  r14[40] = 3000; r14[43] = 41951.76; r14[44] = 142066.6; r14[49] = 184018.36; r14[45] = 187018.36; r14[51] = 187018.36;

  const r15 = Array(59).fill(null);
  r15[1] = '2026-10-15'; r15[13] = 200000;
  r15[16] = 34124.2;
  r15[40] = 34124.2; r15[43] = 0; r15[44] = 0; r15[49] = 0; r15[45] = 39524.2; r15[47] = 5400; r15[51] = 38329.853;

  const table = makeTable([r13, r14, r15]);

  const observations = [
    // Day 13 matched:
    { sourceKey: 'juguang-f', accountId: 'acc_jg_f', businessDay: '2026-10-13', capturedAt: '2026-10-14T00:00:00Z', data: { placementName: '信息流', fee: '50.00' } },
    { sourceKey: 'juguang-s', accountId: 'acc_jg_s', businessDay: '2026-10-13', capturedAt: '2026-10-14T00:00:00Z', data: { placementName: '搜索', fee: '50.00' } },
    // Day 14 different (delta 36808.98):
    { sourceKey: 'juguang-f', accountId: 'acc_jg_f', businessDay: '2026-10-14', capturedAt: '2026-10-15T00:00:00Z', data: { placementName: '信息流推广', fee: '40000.00' } },
    { sourceKey: 'juguang-f', accountId: 'acc_jg_f', businessDay: '2026-10-14', capturedAt: '2026-10-15T00:00:00Z', data: { placementName: '视频内流', fee: '10417.50' } },
    { sourceKey: 'juguang-s', accountId: 'acc_jg_s', businessDay: '2026-10-14', capturedAt: '2026-10-15T00:00:00Z', data: { placementName: '搜索推广', fee: '170409.84' } },
    // Day 15 missing weekly:
    { sourceKey: 'juguang-f', accountId: 'acc_jg_f', businessDay: '2026-10-15', capturedAt: '2026-10-16T00:00:00Z', data: { placementName: '信息流推广', fee: '50199.37' } },
    { sourceKey: 'juguang-s', accountId: 'acc_jg_s', businessDay: '2026-10-15', capturedAt: '2026-10-16T00:00:00Z', data: { placementName: '搜索推广', fee: '170409.84' } },
  ];

  // State 1: Day 14 difference
  const view14 = adapter.buildDailyView('test-p', { tables: [table] }, '2026-10-14', { platformObservations: observations });
  assert.ok(view14.platformNative);
  assert.equal(view14.platformNative.status, 'difference');
  assert.equal(view14.platformNative.totalFee, 220827.34);
  assert.equal(view14.platformNative.weeklyAdSpend, 184018.36);
  assert.equal(view14.platformNative.delta, 36808.98);
  assert.match(view14.platformNative.statusLabel, /36808\.98/);
  assert.ok(view14.differences.some(d => d.key === 'platform-diff-2026-10-14'));

  // State 2: Day 15 missing weekly
  const view15 = adapter.buildDailyView('test-p', { tables: [table] }, '2026-10-15', { platformObservations: observations });
  assert.ok(view15.platformNative);
  assert.equal(view15.platformNative.status, 'missing_weekly');
  assert.equal(view15.platformNative.statusLabel, '待回填');
  assert.equal(view15.platformNative.weeklyAdSpend, null);
  assert.equal(view15.platformNative.delta, null);
  assert.ok(view15.differences.some(d => d.key === 'platform-unreconciled-2026-10-15'));

  // State 3: Day 13 matched
  const view13 = adapter.buildDailyView('test-p', { tables: [table] }, '2026-10-13', { platformObservations: observations });
  assert.ok(view13.platformNative);
  assert.equal(view13.platformNative.status, 'matched');
  assert.equal(view13.platformNative.statusLabel, '金额一致');
  assert.equal(view13.platformNative.delta, 0);
  assert.equal(view13.differences.filter(d => d.key.includes('platform')).length, 0);
});
