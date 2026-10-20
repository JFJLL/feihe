import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const moduleCache = new Map();
function loadComponent(filename) {
  filename = path.resolve(filename);
  if (!fs.existsSync(filename)) {
    if (fs.existsSync(filename + '.tsx')) filename = filename + '.tsx';
    else if (fs.existsSync(filename + '.ts')) filename = filename + '.ts';
    else if (fs.existsSync(filename + '.json')) filename = filename + '.json';
  }
  if (moduleCache.has(filename)) return moduleCache.get(filename);
  if (filename.endsWith('.json')) {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const wrapped = { default: data, ...data };
    moduleCache.set(filename, wrapped);
    return wrapped;
  }
  const raw = fs.readFileSync(filename, 'utf8');
  const sanitized = raw.replace(/import\s+['"][^'"]+\.css['"];?/g, '');
  const compiled = ts.transpileModule(sanitized, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(filename);
  const customRequire = (name) => {
    if (name.endsWith('.css')) return {};
    if (name.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filename), name);
      return loadComponent(resolved);
    }
    return nativeRequire(name);
  };
  vm.runInNewContext(
    `(function(require, module, exports) { ${compiled}\n})`,
    {}
  )(customRequire, result, result.exports);
  moduleCache.set(filename, result.exports);
  return result.exports;
}

console.log('=== Starting Focused Placement Model, Overview & Ads Tests ===\n');

// 1. Test campaign-placement-model
console.log('1. Testing campaign-placement-model helper functions...');
const model = loadComponent('features/campaign/campaign-placement-model.ts');
const {
  safeNum,
  strictSum,
  strictAdd,
  isSummaryRow,
  extractKailasPlacements,
  extractWipesPlacements,
  extractMeilingFourLines,
  extractMeilingCidDaily,
} = model;

// safeNum checks
assert.equal(safeNum(null), null, 'null -> null');
assert.equal(safeNum(undefined), null, 'undefined -> null');
assert.equal(safeNum(''), null, 'empty -> null');
assert.equal(safeNum('-'), null, 'dash -> null');
assert.equal(safeNum('—'), null, 'em-dash -> null');
assert.equal(safeNum('/'), null, 'slash -> null');
assert.equal(safeNum('未达标'), null, 'status text -> null');
assert.equal(safeNum('#N/A'), null, 'formula error -> null');
assert.equal(safeNum(0), 0, '0 -> 0 (not null!)');
assert.equal(safeNum('0'), 0, '"0" -> 0');
assert.equal(safeNum('1,234.56元'), 1234.56, 'currency cleaned');
assert.equal(safeNum('8.08%'), 8.08, 'percentage cleaned');
assert.equal(safeNum('27,786.34'), 27786.34, 'comma cleaned');
assert.equal(safeNum('abc123'), null, 'strict finite avoids parseFloat substring coercion');

// strictSum & strictAdd checks
assert.equal(strictSum([]), null, 'strictSum empty array -> null');
assert.equal(strictSum([10, null, 20]), null, 'strictSum with missing element -> null');
assert.equal(strictSum([10, 20, 30]), 60, 'strictSum valid array -> 60');
assert.equal(strictAdd(10, null), null, 'strictAdd with missing -> null');
assert.equal(strictAdd(10, 20), 30, 'strictAdd valid -> 30');

console.log('  ✓ Safe parsing and strict accumulation verified.');

// 2. Test Placement Extractions
console.log('\n2. Testing project placement model extraction...');

// Kailas FS placements (must exclude 汇总, keep UGC separated)
const mockKailasFsTable = {
  id: 'kailas-fs-placements',
  title: 'FS版位投放效果明细',
  rows: [
    { placement: '视频', spend: 122315.07, ctr: 11.81, cpc: 2.07, cpm: 244.47, cpe: 2.03, uv: 2110, cpuv: 54.05 },
    { placement: '搜索', spend: 150567.69, ctr: 6.92, cpc: 0.49, cpm: 33.81, cpe: 63.77, uv: 2174, cpuv: 36.16 },
    { placement: '信息', spend: 591576.01, ctr: 10.72, cpc: 0.41, cpm: 43.61, cpe: 38.68, uv: 6976, cpuv: 52.43 },
    { placement: '汇总', spend: 864458.77, ctr: 9.83, cpc: 0.47, cpm: 46.68, cpe: 11.09, uv: 11260, cpuv: 49.6 },
  ],
};
const kailasPlacements = extractKailasPlacements(mockKailasFsTable);
assert.equal(kailasPlacements.length, 3, 'Kailas FS placements must exclude 汇总 (3 valid rows)');
assert.equal(kailasPlacements[0].name, '视频');
assert.equal(kailasPlacements[0].spend, 122315.07);
assert.equal(kailasPlacements[0].cpm, 244.47);
assert.equal(kailasPlacements[0].cpuv, 54.05);

// Winner wipes placements (must preserve video spend 27786.34)
const mockWipesTable = {
  id: 'wipes-current-placements',
  title: '分版位投放效果明细',
  rows: [
    { name: '搜索', spend: 4717.83, ctr: 4.05, cpc: 1.03, cpm: 41.54, cpe: 96.28, cpuv: 26.6 },
    { name: '信息', spend: 4054.23, ctr: 5.9, cpc: 1.59, cpm: 93.8, cpe: 23.99, cpuv: 22.02 },
    { name: '视频', spend: 27786.34, ctr: 8.08, cpc: 6.72, cpm: 543.02, cpe: 6.6, cpuv: 4.3 },
  ],
};
const wipesPlacements = extractWipesPlacements(mockWipesTable);
assert.equal(wipesPlacements.length, 3, 'Wipes placements has 3 rows');
assert.equal(wipesPlacements[2].name, '视频');
assert.equal(wipesPlacements[2].spend, 27786.34, 'Real video spend 27786.34 is preserved');
assert.equal(wipesPlacements[2].cpe, 6.6);
assert.equal(wipesPlacements[2].cpuv, 4.3);

// Meiling four lines: spend must be fsSpend, totalSpend strictly K+FS, sum matches 309782.37 & 550000
const mockMeilingTable = {
  id: 'meiling-four-lines',
  title: '四线累计投放与转化表现',
  rows: [
    { name: '自采京东', kSpend: 157520, fsSpend: 140269.04, cpc: 0.85, ctr: 9.99, cpuv: 29.31, gmv: 601386.3, kfsRoi: 2.02 },
    { name: '自采天猫', kSpend: 153120, fsSpend: 121979.83, cpc: 0.71, ctr: 11.14, cpuv: 24.03, gmv: 559771.42, kfsRoi: 2.03 },
    { name: '星伴', kSpend: 164010, fsSpend: 28371.46, cpc: 3.03, ctr: 4.6, cpuv: 26.39, gmv: 66356.07, kfsRoi: 0.34 },
    { name: '京东对投', kSpend: 75350, fsSpend: 19162.04, cpc: 0.83, ctr: 9.53, cpuv: 76.34, gmv: 13587.15, kfsRoi: 0.14 },
  ],
};
const meilingLines = extractMeilingFourLines(mockMeilingTable);
assert.equal(meilingLines.length, 4, 'Meiling four lines has 4 rows');
assert.equal(meilingLines[0].spend, 140269.04, 'spend strictly preserves fsSpend');
assert.equal(meilingLines[0].totalSpend, 297789.04, 'totalSpend strictly equals kSpend + fsSpend');

const fsTotal = strictSum(meilingLines.map((r) => r.spend));
const kTotal = strictSum(meilingLines.map((r) => r.kSpend));
assert.equal(Number(fsTotal.toFixed(2)), 309782.37, 'FS total matches 309782.37');
assert.equal(kTotal, 550000, 'K total matches 550000');

console.log('  ✓ Project placement extractions and totals verified.');

// 3. Test CampaignOverviewPage & CampaignAdsPage SSR
console.log('\n3. Testing CampaignOverviewPage and CampaignAdsPage SSR rendering across projects...');
const overviewMod = loadComponent('features/campaign/CampaignOverviewPage.tsx');
const adsMod = loadComponent('features/campaign/CampaignAdsPage.tsx');
const { CampaignOverviewPage } = overviewMod;
const { CampaignAdsPage } = adsMod;

const projectIds = ['kailas', 'meiling', 'winner-wipes'];
for (const pid of projectIds) {
  console.log(`  Checking project ${pid}...`);
  const res = await fetch(`http://localhost:5173/api/campaign-dashboard?projectId=${pid}`);
  const { dashboard } = await res.json();
  assert(dashboard, `Dashboard for ${pid} must exist`);

  // Overview SSR
  const overviewHtml = renderToStaticMarkup(React.createElement(CampaignOverviewPage, { dashboard }));
  assert(overviewHtml.includes('ca-page'), 'Overview renders ca-page');
  assert(overviewHtml.includes('ca-metric-strip'), 'Overview renders metric strip');
  assert(overviewHtml.includes('ca-grid'), 'Overview renders chart grid');
  assert(!overviewHtml.includes('NaN'), 'Overview has no NaN');
  assert(!overviewHtml.includes('Infinity'), 'Overview has no Infinity');
  assert(!overviewHtml.includes('gridColumn: "1 / -1"'), 'Overview daily panel is not full-width (clean 2x2 layout)');
  assert(overviewHtml.includes('data-testid="campaign-combo-chart"'), 'Overview includes CampaignComboChart');
  assert(overviewHtml.includes('ca-details-collapse'), 'Overview includes details collapse');

  // Ads SSR
  const adsHtml = renderToStaticMarkup(React.createElement(CampaignAdsPage, { dashboard }));
  assert(adsHtml.includes('ca-page'), 'Ads renders ca-page');
  assert(adsHtml.includes('ca-toolbar-select'), 'Ads renders view selector');
  assert(adsHtml.includes('ca-metric-strip'), 'Ads renders metric strip');
  assert(adsHtml.includes('ca-grid'), 'Ads renders chart grid');
  assert(adsHtml.includes('data-testid="campaign-combo-chart"'), 'Ads includes CampaignComboChart');
  assert(adsHtml.includes('ca-ads-enrichment-slot'), 'Ads includes enrichment slot');
  assert(
    adsHtml.includes('ca-kdd-root') || adsHtml.includes('mdd-root') || adsHtml.includes('wipes-dive-root'),
    'Ads active CampaignEnrichmentPanels rendered'
  );
  assert(!adsHtml.includes('NaN'), 'Ads has no NaN');
  assert(!adsHtml.includes('Infinity'), 'Ads has no Infinity');

  console.log(`    ✓ ${pid} Overview & Ads SSR verified with rich dual-axis combo charts and enrichment panel.`);
}

console.log('\n===============================================================');
console.log('🎉 ALL FOCUSED SSR & MODEL TESTS PASSED (3/3)');
console.log('===============================================================');
