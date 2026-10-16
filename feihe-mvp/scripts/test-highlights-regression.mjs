import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import path from 'node:path';
import { createServer } from 'vite';

process.env.LOCAL_DB_PATH = path.resolve('.verification/business.db');
process.env.LOCAL_DB_NO_SEED = 'true';
process.env.ENABLE_TEST_AUTH = '1';
process.env.REQUIRE_PROD_AUTH = 'false';

const vite = await createServer({
  configFile: false,
  cacheDir: 'node_modules/.vite/highlights-regression',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  resolve: { alias: { '@': path.resolve('.') } }
});
after(() => vite.close());

const store = await vite.ssrLoadModule('/lib/business-daily/store.ts');
const highlights = await vite.ssrLoadModule('/lib/business-daily/highlights.ts');

test('highlights regression: 10-13 and 10-14 extract non-zero real metrics without fabrications', async () => {
  const view13 = await store.latestDaily('qicui', '2026-10-13');
  const h13 = highlights.buildBusinessHighlights(view13);
  assert.ok(h13.search.costs.length === 2);
  assert.equal(h13.search.costs[0].channel, '小红星');
  assert.equal(h13.search.costs[0].actual, 61.76);
  assert.equal(h13.search.costs[0].low, 52.58);
  assert.equal(h13.search.costs[0].high, 65.15);
  assert.equal(h13.search.returnRate, 0.0592);
  assert.ok(h13.search.coreWords.length === 2);
  assert.equal(h13.search.coreWords[0].word, '新生儿奶粉');
  assert.equal(h13.search.coreWords[0].soc, 0.1142);
  assert.equal(h13.search.coreWords[0].rank, 3);

  const view14 = await store.latestDaily('qicui', '2026-10-14');
  const h14 = highlights.buildBusinessHighlights(view14);
  assert.equal(h14.search.costs[0].actual, 60.37);
  assert.ok(h14.today.length >= 2);

  const view15 = await store.latestDaily('qicui', '2026-10-15');
  const h15 = highlights.buildBusinessHighlights(view15);
  assert.ok(h15.today.some(t => t.title.includes('待补齐')));
});

test('highlights resilience: unmatched text or missing narrative never produces 0 or crashes', () => {
  const emptyView = {
    day: '2026-10-14',
    businessThrough: '2026-10-13',
    series: [],
    notes: [],
    narrative: [
      { title: '未知板块', level: 1, text: '无相关格式正文' }
    ],
    tables: []
  };
  const res = highlights.buildBusinessHighlights(emptyView);
  // 验证未匹配时各字段保留 null，而不是强制变 0
  assert.equal(res.search.costs[0].actual, null);
  assert.equal(res.search.costs[0].low, null);
  assert.equal(res.search.costs[0].high, null);
  assert.equal(res.search.returnRate, null);
  assert.equal(res.search.coreWords.length, 0);
  assert.equal(res.feed.audience.length, 0);
  assert.equal(res.maintenance.pure, null);
  assert.equal(res.maintenance.live, null);
  assert.equal(res.seo.indexed, null);
  assert.equal(res.seo.occupied, null);
});

test('highlights scope matching: different month benchmarks are not mixed', () => {
  const mismatchedMonthView = {
    day: '2026-11-14', // 11 月
    businessThrough: '2026-10-13',
    series: [],
    notes: [],
    narrative: [
      {
        title: '搜索侧日报',
        level: 2,
        text: '10月-通用奶粉搜索-benchmark： 星cpuv：52.58~65.15  盟cpuv：161.32~199.89\n10 月启萃：  星cpuv：61.76         盟cpuv：207.41'
      }
    ],
    tables: []
  };
  const res = highlights.buildBusinessHighlights(mismatchedMonthView);
  // 11 月日报不应错配 10 月基准或实际
  assert.equal(res.search.costs[0].actual, null);
  assert.equal(res.search.costs[0].low, null);
  assert.equal(res.search.costs[1].actual, null);
  assert.equal(res.search.costs[1].low, null);
});
