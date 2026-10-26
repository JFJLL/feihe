import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import path from 'node:path';
import { createServer } from 'vite';

Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true' });
const vite = await createServer({
  configFile: false,
  cacheDir: 'node_modules/.vite/keyword-scope-test',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  resolve: { alias: { '@': path.resolve('.') } }
});
after(() => vite.close());

const adapter = await vite.ssrLoadModule('/lib/business-daily/adapter.ts');
const sync = await vite.ssrLoadModule('/lib/business-sync/store.ts');
const store = await vite.ssrLoadModule('/lib/business-daily/store.ts');
await store.ensureBusinessSchema();

function makeKeywordBundle(header5, scopeExtra = {}) {
  const header = ['市场出价', '搜索指数', '关键词', '消费占比', '消费', header5, 'CTR', 'CPC'];
  const row = [22.6, 350000, '新生儿奶粉', 0.07, 99000, 340, 0.1, 9.8];
  return {
    tables: [
      {
        key: 'keywords',
        role: 'keywords',
        url: 'https://example.test/keywords',
        version: '1',
        capturedAt: '2026-10-26T00:00:00Z',
        range: 'A1:H2',
        rows: [header, row],
        complete: true,
        ...scopeExtra
      }
    ]
  };
}

test('scopeText: explicit scopeLabel takes priority', () => {
  const bundle = makeKeywordBundle(' cpuv ', { scopeLabel: '近三日数据，具体起止日期由来源维护' });
  const view = adapter.buildDailyView('qicui', bundle, '2026-10-26');
  const kwTable = view.tables.find(t => t.title === '关键词消耗排行');
  assert(kwTable, 'table exists');
  assert.equal(kwTable.scope, '近三日数据，具体起止日期由来源维护');
  assert.equal(kwTable.columns[5], 'CPUV');
});

test('scopeText: formatted range when periodFrom and periodTo are present', () => {
  const bundle = makeKeywordBundle(' CP星盟UV', { periodFrom: '2026-10-01', periodTo: '2026-10-31' });
  const view = adapter.buildDailyView('qicui', bundle, '2026-10-26');
  const kwTable = view.tables.find(t => t.title === '关键词消耗排行');
  assert(kwTable, 'table exists');
  assert.equal(kwTable.scope, '2026-10-01 至 2026-10-31；月累计底表，无逐日日期与星盟拆分');
  assert.equal(kwTable.columns[5], 'CP星盟UV');
});

test('scopeText: unknown period without scopeLabel is NOT mistakenly marked as near-3-days', () => {
  const bundle = makeKeywordBundle('cpuv', {}); // no scopeLabel, no periodFrom/To
  const view = adapter.buildDailyView('qicui', bundle, '2026-10-26');
  const kwTable = view.tables.find(t => t.title === '关键词消耗排行');
  assert(kwTable, 'table exists');
  assert.equal(kwTable.scope, '来源快照，统计区间未标明');
  assert.notEqual(kwTable.scope, '近三日数据，具体起止日期由来源维护');
  assert.equal(kwTable.columns[5], 'CPUV');
});

test('validateSyncSpec validates scopeLabel as string and enforces <= 200 length cap', async () => {
  // Setup valid binding
  await store.configureBusiness('qicui', {
    alertThresholdPoints: 5,
    bindings: [
      { key: 'keywords', role: 'keywords', url: 'https://example.test/keywords' }
    ]
  }, 0);

  // Valid scopeLabel
  await sync.validateSyncSpec('qicui', {
    type: 'feishu_table',
    sourceKey: 'keywords',
    sourceUrl: 'https://example.test/keywords',
    role: 'keywords',
    sheetId: 'sheet1',
    scopeLabel: '近三日数据，具体起止日期由来源维护'
  });

  // Invalid: non-string
  await assert.rejects(
    () => sync.validateSyncSpec('qicui', {
      type: 'feishu_table',
      sourceKey: 'keywords',
      sourceUrl: 'https://example.test/keywords',
      role: 'keywords',
      sheetId: 'sheet1',
      scopeLabel: 12345
    }),
    /统计区间说明无效/
  );

  // Invalid: exceeds 200 chars
  await assert.rejects(
    () => sync.validateSyncSpec('qicui', {
      type: 'feishu_table',
      sourceKey: 'keywords',
      sourceUrl: 'https://example.test/keywords',
      role: 'keywords',
      sheetId: 'sheet1',
      scopeLabel: 'a'.repeat(201)
    }),
    /统计区间说明无效/
  );
});
