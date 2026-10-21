import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kailasJsonPath = path.resolve(__dirname, '../lib/campaign-enrichment/kailas.json');
const kailasData = JSON.parse(fs.readFileSync(kailasJsonPath, 'utf-8'));

console.log('Verifying kailas.json payload structure...');
assert.strictEqual(kailasData.projectId, 'kailas', 'projectId is kailas');
assert(Array.isArray(kailasData.tables), 'tables is array');
const expectedTableIds = [
  'kailas-q3-organic-vs-paid', 'kailas-notes-performance-scatter',
  'kailas-kol-material-kfs-dual', 'kailas-search-keywords-category',
  'kailas-notes-leverage-fs-k', 'kailas-overall-budget-pacing',
  'kailas-monthly-creative-trend', 'kailas-notes-119-pareto-concentration',
  'kailas-keyword-category-full', 'kailas-targeting-audience',
  'kailas-candidate-pool-status', 'kailas-kol-tier-matrix',
  'kailas-content-direction-summary', 'kailas-potential-notes-boost',
  'kailas-full-funnel-summary', 'kailas-biweekly-stage-evolution',
  'kailas-tier-direction-matrix', 'kailas-audit-common-issues',
];
assert.deepStrictEqual(kailasData.tables.map(table => table.id).sort(), expectedTableIds.sort(), 'All current source tables exist exactly once');

const tableIds = kailasData.tables.map(t => t.id);
assert(tableIds.includes('kailas-notes-performance-scatter'), 'includes notes scatter table');
assert(tableIds.includes('kailas-q3-organic-vs-paid'), 'includes organic vs paid table');
assert(tableIds.includes('kailas-kol-material-kfs-dual'), 'includes material kfs dual table');
assert(tableIds.includes('kailas-search-keywords-category'), 'includes search keywords table');
assert(tableIds.includes('kailas-notes-leverage-fs-k'), 'includes leverage table');

for (const table of kailasData.tables) {
  assert(table.id, 'table has id');
  assert(table.title, 'table has title');
  assert(table.period, 'table has period');
  assert(table.sourceId, 'table has sourceId');
  assert(kailasData.sources.some(source => source.id === table.sourceId), 'Table provenance references a registered source');
  assert(table.columns, 'table has columns');
  assert(Array.isArray(table.rows), 'table rows is array');

  if (table.id === 'kailas-q3-organic-vs-paid') {
    assert(!table.columns.some(c => c.key === 'role'), 'no role column');
    for (const r of table.rows) {
      assert(!('role' in r), 'no role property in rows');
    }
  }

  if (table.id === 'kailas-notes-performance-scatter') {
    assert(table.columns.some(c => c.key === 'taskSpend'), 'taskSpend in columns');
    assert.strictEqual(table.rows.length, 119, 'exactly 119 notes');
  }
}

console.log('Testing parseFiniteNum & calculateTrackedGroupSum unit test cases...');

function parseFiniteNum(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const s = String(val).trim();
  if (!s || s === '/' || s === '-' || s === '--' || s === '—') return null;
  if (s.includes('#REF') || s.includes('#VALUE') || s.includes('#N/A') || s.includes('#DIV/0!')) return null;
  const cleaned = s.replace(/[¥￥,\s%]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

assert.strictEqual(parseFiniteNum('   '), null, 'Whitespace must return null, not 0');
assert.strictEqual(parseFiniteNum(null), null, 'Null returns null');
assert.strictEqual(parseFiniteNum(0), 0, 'Genuine 0 returns 0');
assert.strictEqual(parseFiniteNum('0'), 0, 'String 0 returns 0');
assert.strictEqual(parseFiniteNum('¥1,234.50'), 1234.5, 'Formatted currency parses correctly');
assert.strictEqual(parseFiniteNum('#DIV/0!'), null, 'Formula error returns null');

function calculateTrackedGroupSum(items) {
  const map = new Map();
  items.forEach((r) => {
    const type = String(r.contentType || '未分类');
    const k = parseFiniteNum(r.kCost);
    const fs = parseFiniteNum(r.fsSpend);
    const cur = map.get(type) || { kSum: 0, kHasMissing: false, kValidCount: 0, fsSum: 0, fsHasMissing: false, fsValidCount: 0, totalRecords: 0 };
    if (k === null) cur.kHasMissing = true; else { cur.kSum += k; cur.kValidCount += 1; }
    if (fs === null) cur.fsHasMissing = true; else { cur.fsSum += fs; cur.fsValidCount += 1; }
    cur.totalRecords += 1;
    map.set(type, cur);
  });
  return Array.from(map.entries()).map(([contentType, v]) => ({
    contentType: contentType + ' (' + v.totalRecords + '篇)',
    rawContentType: contentType,
    kCost: v.kHasMissing || v.kValidCount === 0 ? null : Number(v.kSum.toFixed(2)),
    fsSpend: v.fsHasMissing || v.fsValidCount === 0 ? null : Number(v.fsSum.toFixed(2)),
    count: v.totalRecords,
  }));
}

const gA = calculateTrackedGroupSum([{ contentType: 'A', kCost: 100, fsSpend: 0 }, { contentType: 'A', kCost: 200, fsSpend: 0 }]);
assert.strictEqual(gA[0].kCost, 300);
assert.strictEqual(gA[0].fsSpend, 0, 'Genuine 0 must be 0, not null');
assert.strictEqual(gA[0].count, 2);
assert.strictEqual(gA[0].contentType, 'A (2篇)');

const gB = calculateTrackedGroupSum([{ contentType: 'B', kCost: 100, fsSpend: 50 }, { contentType: 'B', kCost: 200, fsSpend: '   ' }]);
assert.strictEqual(gB[0].kCost, 300);
assert.strictEqual(gB[0].fsSpend, null, 'Any missing in group makes group fsSpend null');

console.log('Kailas enrichment data & group calculation audit passed with 100% assertions!');
