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
  if (moduleCache.has(filename)) return moduleCache.get(filename);
  const raw = fs.readFileSync(filename, 'utf8');
  // Strip CSS imports for Node SSR
  const sanitized = raw.replace(/import\s+['"][^'"]+\.css['"];?/g, '');
  const compiled = ts.transpileModule(sanitized, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(filename);
  const customRequire = (name) => {
    if (name.endsWith('.css')) return {};
    if (name.startsWith('.')) {
      return loadComponent(path.resolve(path.dirname(filename), name.endsWith('.tsx') ? name : `${name}.tsx`));
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

console.log('=== Starting CampaignComboChart Contract and SSR Test Suite ===\n');

const chartFilePath = 'features/campaign/CampaignComboChart.tsx';
const cssFilePath = 'features/campaign/campaign-combo.css';

// 1. Contract & File Existence Checks
console.log('1. Checking file existence & code contracts...');
assert(fs.existsSync(chartFilePath), 'CampaignComboChart.tsx must exist');
assert(fs.existsSync(cssFilePath), 'campaign-combo.css must exist');

const chartCode = fs.readFileSync(chartFilePath, 'utf8');
const cssCode = fs.readFileSync(cssFilePath, 'utf8');

assert(chartCode.includes('export function CampaignComboChart'), 'Must export CampaignComboChart named component');
assert(chartCode.includes('export type ComboSeries'), 'Must export type ComboSeries');
assert(chartCode.includes('export type CampaignComboChartProps'), 'Must export type CampaignComboChartProps');
assert(chartCode.includes('export const CAMPAIGN_PALETTE'), 'Must export CAMPAIGN_PALETTE');
assert(chartCode.includes('export function fmtAxisTick'), 'Must export fmtAxisTick');
assert(chartCode.includes('export function fmtXAxisTick'), 'Must export fmtAxisTick');
assert(chartCode.includes("import './campaign-combo.css'"), 'Must import campaign-combo.css');

// Must NOT contain double card shell, duplicate h4 title, or "N项" badge
assert(!chartCode.includes('ca-combo-card'), 'Must not have ca-combo-card shell to avoid double card with ChartPanel');
assert(!chartCode.includes('ca-combo-header'), 'Must not have duplicate header');
assert(!chartCode.includes('ca-combo-title'), 'Must not have duplicate h4 title element');
assert(!chartCode.includes('ca-combo-badge'), 'Must not have N项 badge');

// Palette color checks
const requiredPalette = ['#2c7168', '#8273a3', '#b88a45', '#bd7964', '#8c9ba5'];
for (const col of requiredPalette) {
  assert(chartCode.includes(col), `Chart TSX must include palette color ${col}`);
  assert(cssCode.includes(col), `CSS must include palette color ${col}`);
}
console.log('  ✓ Files, clean wrapper contract, and palette colors validated.');

// Load component for SSR testing
const comboModule = loadComponent(chartFilePath);
const { CampaignComboChart, CAMPAIGN_PALETTE, fmtAxisTick, fmtXAxisTick } = comboModule;

// 2. Unit Testing fmtAxisTick (Step-based auto decimals & 万 unit)
console.log('\n2. Testing fmtAxisTick precision & 万 format...');
{
  // Large numbers with 万 and 亿
  assert.equal(fmtAxisTick(15000, 5000), '1.5万', 'Formats 15000 as 1.5万 (no w)');
  assert.equal(fmtAxisTick(1200000, 300000), '120万', 'Formats 1200000 as 120万');
  assert.equal(fmtAxisTick(250000000, 50000000), '2.5亿', 'Formats 250000000 as 2.5亿');

  // Small values (e.g. 0.01 ROI) with step < 0.1
  assert.equal(fmtAxisTick(0.01, 0.01), '0.01', 'Preserves 0.01 with 2 decimals when step=0.01');
  assert.equal(fmtAxisTick(0.025, 0.005), '0.025', 'Preserves 0.025 with 3 decimals when step=0.005');
  assert.equal(fmtAxisTick(0.0015, 0.0005), '0.0015', 'Preserves 4 decimals when step<0.001');

  // Zero and round numbers
  assert.equal(fmtAxisTick(0, 10), '0', 'Formats 0 as 0');
  assert.equal(fmtAxisTick(100, 25), '100', 'Formats 100 as 100');
  console.log('  ✓ fmtAxisTick auto decimals and 万 unit passed.');
}

// 3. Multi-Metric Dual-Axis Chart SSR Test
console.log('\n3. Testing multi-metric dual-axis chart (grouped bar + line + point)...');
{
  const series = [
    { key: 'leads', label: '曝光线索', unit: '条', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
    { key: 'clicks', label: '点击量', unit: '条', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.purple },
    { key: 'cpa', label: '获客成本', unit: '元', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.gold },
    { key: 'benchmark', label: '对标成本', unit: '元', axis: 'right', kind: 'point', color: CAMPAIGN_PALETTE.terracotta },
  ];

  const rows = [
    { date: '2026-03-01', leads: 1200, clicks: 450, cpa: 18.5, benchmark: 20 },
    { date: '2026-03-02', leads: 1500, clicks: 620, cpa: 16.2, benchmark: 20 },
    { date: '2026-03-03', leads: 900, clicks: 310, cpa: 22.0, benchmark: null },
    { date: '2026-03-04', leads: 2100, clicks: 890, cpa: 14.8, benchmark: 18 },
  ];

  const html = renderToStaticMarkup(React.createElement(CampaignComboChart, {
    rows,
    series,
    title: '活动投放多指标组合趋势',
    xLabel: '投放日期',
  }));

  // Clean wrapper
  assert(html.includes('ca-combo-wrap'), 'Has ca-combo-wrap container');
  assert(html.includes('data-testid="campaign-combo-chart"'), 'Has structured data-testid');
  assert(html.includes('role="graphics-document"'), 'SVG has graphics-document role');
  assert(html.includes('<title>活动投放多指标组合趋势</title>'), 'Title preserved in SVG title');

  // Axis visibility & unit clarity
  assert(html.includes('条 (左轴)'), 'Left axis has explicit unit and label');
  assert(html.includes('元 (右轴)'), 'Right axis has explicit unit and label');

  // Readout always displays active/latest row with all series columns (NO layout jump!)
  assert(html.includes('ca-combo-readout-main'), 'Readout has main series columns container');
  assert(html.includes('2026-03-04'), 'Readout defaults to latest row date');
  assert(html.includes('2,100'), 'Readout renders latest row leads');
  assert(html.includes('890'), 'Readout renders latest row clicks');
  assert(html.includes('14.8'), 'Readout renders latest row cpa');
  assert(html.includes('18'), 'Readout renders latest row benchmark');
  assert(!html.includes('悬停或按箭头键切换'), 'Readout does not contain redundant hint text');

  // Legend marks: bar swatch, line swatch, point swatch
  assert(html.includes('ca-combo-swatch-bar'), 'Legend contains bar swatch');
  assert(html.includes('ca-combo-swatch-line'), 'Legend contains line swatch');
  assert(html.includes('ca-combo-swatch-point'), 'Legend contains point swatch');

  // Grouped bars: 2 bar series (leads and clicks)
  const barLeadsMatches = html.match(/data-metric-type="bar"[^>]*data-series-key="leads"/g);
  const barClicksMatches = html.match(/data-metric-type="bar"[^>]*data-series-key="clicks"/g);
  assert(barLeadsMatches && barLeadsMatches.length === 4, 'Renders 4 bars for leads series');
  assert(barClicksMatches && barClicksMatches.length === 4, 'Renders 4 bars for clicks series');

  // Point series: discrete points only, no connecting lines
  const pointMatches = html.match(/data-metric-type="point"[^>]*data-series-key="benchmark"/g);
  assert(pointMatches && pointMatches.length === 3, 'Renders 3 discrete points for benchmark (1 null omitted)');
  assert(!html.includes('data-metric-type="line" data-series-key="benchmark"'), 'Point series does not draw continuous line');

  // Distinct date tick labels check (must NOT all be 2026-10-...)
  assert(html.includes('>03-01<'), 'X axis displays 03-01');
  assert(html.includes('>03-04<'), 'X axis displays 03-04');
  assert(!html.includes('2026-03-…'), 'Dates are not all truncated to identical 2026-03-…');
  assert(html.includes('text-anchor="start"'), 'First tick anchored to start to avoid left clipping');
  assert(html.includes('text-anchor="end"'), 'Last tick anchored to end to avoid right clipping');
  console.log('  ✓ Dual-axis combo chart render passed with distinct MM-DD date ticks and clean anchors.');
}

// 4. Testing Zero Distinction, Pure Proportional Height & Null Line Breaking
console.log('\n4. Testing zero vs null, proportional height, and line breaking...');
{
  const series = [
    { key: 'volume', label: '实际件数', unit: '件', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
    { key: 'rate', label: '转化率', unit: '%', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.gold },
  ];

  const rows = [
    { date: '2026-03-01', volume: 100, rate: 5.5 },
    { date: '2026-03-02', volume: 0, rate: null },   // 0 volume, null rate (BREAKS LINE!)
    { date: '2026-03-03', volume: null, rate: 6.2 }, // null volume (NO BAR), rate 6.2
    { date: '2026-03-04', volume: 0.1, rate: 7.1 },  // tiny spend 0.1
  ];

  const html = renderToStaticMarkup(React.createElement(CampaignComboChart, {
    rows,
    series,
    title: '零值与微小支出比例检验',
  }));

  // 0 volume: rendered as zero baseline tick line with data-is-zero="true"
  assert(html.includes('data-is-zero="true"'), 'Zero value bar explicitly rendered with data-is-zero="true"');
  assert(html.includes('data-value="0"'), 'Zero value rendered with data-value="0"');

  // Null volume on row index 2: no bar rendered
  assert(!html.includes('data-row-index="2" data-row-key="2026-03-03" data-value='), 'Null volume datum has no bar');

  // Proportional height check for tiny value 0.1: height should NOT be forced to Math.max(1.5, ...)
  const matchTiny = html.match(/<rect[^>]*height="([^"]+)"[^>]*data-row-key="2026-03-04"[^>]*data-value="0.1"/);
  assert(matchTiny, 'Tiny value bar rendered');
  const tinyHeight = parseFloat(matchTiny[1]);
  assert(tinyHeight < 1.0, `Tiny spend 0.1 has direct proportional height ${tinyHeight} < 1.0px (no artificial exaggeration)`);

  // Line breaks at rate: null
  const linePaths = html.match(/<path[^>]*data-metric-type="line"[^>]*>/g);
  assert(linePaths && linePaths.length === 1, 'Line broke across null rate, producing 1 multi-point path');

  console.log('  ✓ Proportional bar height, zero baseline indicator, and line breaks verified.');
}

// 5. Testing Band-Safe Bar Clusting (35 days × 4 series on mobile width)
console.log('\n5. Testing band-safe bar clustering (35 days × 4 series)...');
{
  const series = [
    { key: 'b1', label: '系列1', unit: '件', axis: 'left', kind: 'bar' },
    { key: 'b2', label: '系列2', unit: '件', axis: 'left', kind: 'bar' },
    { key: 'b3', label: '系列3', unit: '件', axis: 'left', kind: 'bar' },
    { key: 'b4', label: '系列4', unit: '件', axis: 'left', kind: 'bar' },
  ];

  const rows = Array.from({ length: 35 }, (_, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, '0')}`,
    b1: 10 + i,
    b2: 20 + i,
    b3: 15 + i,
    b4: 30 + i,
  }));

  const html = renderToStaticMarkup(React.createElement(CampaignComboChart, {
    rows,
    series,
    title: '高密度柱状簇测试',
  }));

  // Verify all bars render without crash
  const allBars = html.match(/data-metric-type="bar"/g);
  assert.equal(allBars?.length, 35 * 4, 'All 140 bars rendered');

  // Verify bar width is bounded within band (e.g. width < 5px for 35 days)
  const widthMatches = html.match(/width="([0-9.]+)"[^>]*data-metric-type="bar"/);
  assert(widthMatches, 'Bar has width attribute');
  const barW = parseFloat(widthMatches[1]);
  assert(barW <= 4.0, `Bar width ${barW} strictly bounded within band to prevent overlap`);
  console.log(`  ✓ 35 days × 4 series bar width dynamically adapted to ${barW.toFixed(2)}px without cross-band overlap.`);
}

// 6. Testing All Null Rows Gives Empty State (Not Blank Axes)
console.log('\n6. Testing all-null rows gives empty state card...');
{
  const series = [
    { key: 'leads', label: '线索', unit: '条', axis: 'left', kind: 'bar' },
    { key: 'roi', label: 'ROI', unit: '%', axis: 'right', kind: 'line' },
  ];

  const allNullRows = [
    { date: '2026-03-01', leads: null, roi: null },
    { date: '2026-03-02', leads: null, roi: null },
  ];

  const html = renderToStaticMarkup(React.createElement(CampaignComboChart, {
    rows: allNullRows,
    series,
    title: '全空测试',
  }));

  assert(html.includes('ca-combo-empty'), 'All null rows renders ca-combo-empty');
  assert(html.includes('暂无可绘制的多指标组合数据'), 'Displays friendly empty state title');
  assert(!html.includes('<svg'), 'Does not render blank axes when all rows are null');
  console.log('  ✓ All-null rows renders clean empty state without drawing blank dummy axes.');
}

// 7. Single Data Point & Chinese Long Label Truncation
console.log('\n7. Testing single data point and Chinese long label truncation...');
{
  const series = [{ key: 'v', label: '指标', unit: '个', axis: 'left', kind: 'bar' }];

  // Single data point
  const singleHtml = renderToStaticMarkup(React.createElement(CampaignComboChart, {
    rows: [{ date: '2026-03-01', v: 50 }],
    series,
    title: '单点测试',
  }));
  assert(!singleHtml.includes('NaN'), 'Single data point produces NO NaN');
  assert(!singleHtml.includes('Infinity'), 'Single data point produces NO Infinity');

  // Chinese label truncation
  const longLabel = "\u98de\u9e64\u661f\u98de\u5e06\u5353\u777f\u521d\u751f\u5a74\u513f\u9636\u6bb5\u5168\u57df\u63a8\u5e7f";
  const longLabelHtml = renderToStaticMarkup(React.createElement(CampaignComboChart, {
    rows: [{ category: longLabel, v: 800 }],
    series,
    xKey: "category",
    title: "长文本测试",
  }));
  assert(longLabelHtml.includes(longLabel.slice(0, 7) + "\u2026"), "Long label trimmed with ellipsis");
  assert(longLabelHtml.includes(`<title>${longLabel}</title>`), "Full label preserved in title");
  console.log('  ✓ Single data point and Chinese label truncation passed.');
}

console.log('\n===============================================================');
console.log('🎉 ALL 7 REFINED CAMPAIGN COMBO CHART TESTS PASSED PERFECTLY!');
console.log('===============================================================');
