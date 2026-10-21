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
  // Strip CSS import for node SSR
  const sanitized = raw.replace(/import\s+['"][^'"]+\.css['"];?/g, '');
  const compiled = ts.transpileModule(sanitized, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(filename);
  const customRequire = name => {
    if (name.endsWith('.css')) return {};
    if (name.startsWith('.')) return loadComponent(path.resolve(path.dirname(filename), name.endsWith('.tsx') ? name : `${name}.tsx`));
    return nativeRequire(name);
  };
  vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, {})(customRequire, result, result.exports);
  moduleCache.set(filename, result.exports);
  return result.exports;
}

console.log('Loading CampaignCharts for comprehensive SSR unit verification...');
const charts = loadComponent('features/campaign/CampaignCharts.tsx');

const {
  MetricStrip,
  ChartPanel,
  HorizontalBarChart,
  DonutChart,
  BudgetComparisonChart,
  TargetBulletChart,
  ScatterChart,
  CAMPAIGN_PALETTE,
} = charts;

// Shared charts must distinguish missing values from an actual zero.
{
  const matrix = renderToStaticMarkup(React.createElement(charts.MatrixHeatmapChart, {
    rows: ['complete', 'partial'], cols: ['A', 'B'], unit: '元', cells: [
      { row: 'complete', col: 'A', value: 0 },
      { row: 'complete', col: 'B', value: 10 },
      { row: 'partial', col: 'A', value: 10 },
      { row: 'partial', col: 'B', value: null },
    ],
  }));
  assert(matrix.includes('>0元<'), 'Matrix renders a true zero');
  const partial = matrix.slice(matrix.indexOf('>partial<'));
  assert(partial.includes('>—<'), 'Missing cell remains missing');
  assert(!partial.includes('>10元</td>'), 'Incomplete row must not display a complete total');
  const zero = renderToStaticMarkup(React.createElement(charts.CampaignFunnelChart, {
    stages: [{ stage: 'empty', value: 0, unit: '次' }],
  }));
  assert(zero.includes('width:0.0%'), 'Zero stage must not draw a positive bar');
  assert(!zero.includes('NaN') && !zero.includes('Infinity'), 'Empty scales remain finite');
  const partialStack = renderToStaticMarkup(React.createElement(charts.StackedHorizontalBarChart, {
    rows: [{ label: 'partial', segments: { paid: 10, organic: null } }], normalize100: true,
    segments: [{ key: 'paid', label: 'paid', color: '#2c7168' }, { key: 'organic', label: 'organic', color: '#8273a3' }],
  }));
  assert(partialStack.includes('数据不完整'), 'Incomplete stacked data is explicit');
  assert(!partialStack.includes('width:100%'), 'Incomplete data cannot imply 100% composition');
}

// 1. Test MetricStrip
console.log('Testing MetricStrip...');
{
  const html = renderToStaticMarkup(React.createElement(MetricStrip, {
    items: [
      { label: '总预算', value: 1200000, unit: '元', note: '计划总额' },
      { label: '已消耗', value: 890000, unit: '元', note: '实际执行' },
      { label: '点击量', value: 45000, unit: '次', note: '曝光引流' },
      { label: 'CPUV成本', value: null, unit: '元', note: '日报待更新' },
    ],
  }));
  assert(html.includes('ca-metric-strip'), 'MetricStrip has root container');
  assert(html.includes('1,200,000'), 'Formats 1200000 with commas');
  assert(html.includes('890,000'), 'Formats 890000 with commas');
  assert(html.includes('—'), 'Missing value renders em-dash — without falsifying 0');
  assert(!html.includes('0 元') && !html.includes('>0<'), 'Null value is not converted to 0');
}

// 2. Test ChartPanel
console.log('Testing ChartPanel...');
{
  const html = renderToStaticMarkup(React.createElement(ChartPanel, {
    title: '预算执行分布',
    subtitle: '核心渠道消耗对比',
    actions: React.createElement('button', { type: 'button' }, '导出明细'),
    children: React.createElement('div', null, '图表内容'),
  }));
  assert(html.includes('ca-panel'), 'ChartPanel has ca-panel container');
  assert(html.includes('预算执行分布'), 'Contains title');
  assert(html.includes('核心渠道消耗对比'), 'Contains subtitle');
  assert(html.includes('导出明细'), 'Contains actions');
}

// 3. Test HorizontalBarChart
console.log('Testing HorizontalBarChart...');
{
  // Empty test
  const emptyHtml = renderToStaticMarkup(React.createElement(HorizontalBarChart, { data: [] }));
  assert(emptyHtml.includes('ca-empty'), 'Empty data renders ca-empty');

  // Normal, null and zero values test with height=190 and 9 rows
  const nineRows = [
    { label: '渠道1', value: 100 },
    { label: '渠道2', value: 200 },
    { label: '渠道3', value: 0 },   // 0 实际
    { label: '渠道4', value: null },// 缺失值
    { label: '渠道5', value: 300 },
    { label: '渠道6', value: 400 },
    { label: '渠道7', value: 500 },
    { label: '渠道8', value: 600 },
    { label: '渠道9', value: 700 },
  ];
  const normalHtml = renderToStaticMarkup(React.createElement(HorizontalBarChart, {
    data: nineRows,
    height: 190,
    unit: '元',
  }));
  assert(normalHtml.includes('渠道9'), 'Bottom row is not cropped');
  assert(!normalHtml.includes('viewBox="0 0 620 190"'), 'Does not force height 190 with 9 rows');
  assert(normalHtml.includes('0 元') || normalHtml.includes('原值 0'), 'Zero value rendered as 0 or 原值 0');
  assert(normalHtml.includes('未录入'), 'Null datum renders placeholder 未录入');
  assert(normalHtml.includes('ca-chart-readout-empty'), 'Renders placeholder readout preventing layout jump');
  assert(normalHtml.includes('tabindex="0"') || normalHtml.includes('tabIndex="0"'), 'Bar items are focusable');
}

// 4. Test DonutChart
console.log('Testing DonutChart...');
{
  const emptyHtml = renderToStaticMarkup(React.createElement(DonutChart, { data: [] }));
  assert(emptyHtml.includes('ca-empty'), 'Empty DonutChart renders ca-empty');

  const normalHtml = renderToStaticMarkup(React.createElement(DonutChart, {
    data: [
      { label: '信息流', value: 300000 },
      { label: '搜索专区', value: 200000 },
      { label: '测试0值', value: 0 },
      { label: '线下媒介', value: null },
    ],
    unit: '元',
    centerLabel: '总投放额',
  }));
  assert(normalHtml.includes('500,000'), 'Center total sums positive values correctly');
  assert(normalHtml.includes('60.0%'), 'Calculates 300000 / 500000 = 60.0%');
  assert(normalHtml.includes('40.0%'), 'Calculates 200000 / 500000 = 40.0%');
  assert(normalHtml.includes('测试0值'), '0-value item preserved in legend');
  assert(normalHtml.includes('线下媒介'), 'Null item preserved in legend');
  assert(normalHtml.includes('未录入'), 'Null item marked as 未录入');
}

// 5. Test BudgetComparisonChart (CRITICAL: overrun must not be clipped, zero actual handled!)
console.log('Testing BudgetComparisonChart & Overrun non-clipping...');
{
  const budgetHtml = renderToStaticMarkup(React.createElement(BudgetComparisonChart, {
    data: [
      { label: '信息流投放', actual: 480000, target: 400000, unit: '元' }, // 超支 120%
      { label: '达人种草', actual: 150000, target: 200000, unit: '元' },   // 75% 正常
      { label: '试用活动', actual: 0, target: 50000, unit: '元' },        // 0 实际消耗
      { label: '品牌搜索', actual: null, target: 100000, unit: '元' },     // 待录入
    ],
    unit: '元',
  }));

  assert(budgetHtml.includes('超支'), 'Highlights over-budget items with 超支');
  assert(budgetHtml.includes('↑超支'), 'Dedicated right column has ↑超支 marker');
  assert(budgetHtml.includes('#bd7964'), 'Overrun uses terracotta alert color #bd7964');
  assert(budgetHtml.includes('未录入'), 'Null actual marked as 未录入');
  assert(budgetHtml.includes('超支 80,000 元'), 'Overrun amount is always readable without hover');
  assert(budgetHtml.includes('data-value="0" style="width:0%'), 'Zero actual has no positive bar');
  assert(budgetHtml.includes('data-value="missing" style="width:0%'), 'Missing actual is not painted as spend');
  assert(!budgetHtml.includes('<svg'), 'Budget labels must not shrink with an SVG viewBox');
  const widths = [...budgetHtml.matchAll(/class="ca-budget-actual"[^>]*style="width:([\d.]+)%/g)].map(match => Number(match[1]));
  assert.equal(widths.length, 4);
  assert(widths.every(width => width >= 0 && width <= 100), 'Overrun bars remain entirely within the shared amount scale');
}

// 6. Test TargetBulletChart (Strict comparison lt/gt, neutral priority, no 归一化达成 for cost)
console.log('Testing TargetBulletChart & Normalized 100% target line...');
{
  // Test 1: comparison lt with actual === target (EQUAL MUST BE UNFAVORABLE!)
  const strictLtEqualHtml = renderToStaticMarkup(React.createElement(TargetBulletChart, {
    data: [
      { label: '严格小于等于边界', actual: 1.5, target: 1.5, unit: '元', comparison: 'lt' },
    ],
  }));
  assert(strictLtEqualHtml.includes('未达到成本目标'), 'Strict lt with equal values is marked as 未达到成本目标, not 成本达标');
  assert(strictLtEqualHtml.includes('(未达到成本目标)'), 'Equal on strict lt is labeled 未达到成本目标 rather than 高于控制目标');

  // Test 2: comparison lt with actual < target
  const strictLtAchievedHtml = renderToStaticMarkup(React.createElement(TargetBulletChart, {
    data: [
      { label: '严格小于达标', actual: 1.2, target: 1.5, unit: '元', comparison: 'lt' },
    ],
  }));
  assert(strictLtAchievedHtml.includes('成本达标'), 'Strict lt with actual < target is marked as 成本达标');

  // Test 3: neutral priority
  const neutralHtml = renderToStaticMarkup(React.createElement(TargetBulletChart, {
    data: [
      { label: '行业基准值', actual: 2.0, target: 1.5, unit: '元', direction: 'neutral' },
    ],
  }));
  assert(neutralHtml.includes('基准参考'), 'Neutral direction is marked as 基准参考 regardless of ratio');

  // Test 3b: Kailas-style higher-only metric legend filter test
  const higherOnlyHtml = renderToStaticMarkup(React.createElement(TargetBulletChart, {
    data: [
      { label: '内容发布量', actual: 120, target: 100, unit: '篇', direction: 'higher' },
    ],
  }));
  assert(higherOnlyHtml.includes('达成目标'), 'Higher-only shows 达成目标');
  assert(higherOnlyHtml.includes('未达目标'), 'Higher-only shows 未达目标');
  assert(higherOnlyHtml.includes('100% 目标线'), 'Higher-only shows 100% 目标线');
  assert(!higherOnlyHtml.includes('成本达标'), 'Higher-only omits irrelevant 成本达标');
  assert(!higherOnlyHtml.includes('未达成本目标'), 'Higher-only omits irrelevant 未达成本目标');
  assert(!higherOnlyHtml.includes('基准参考'), 'Higher-only omits irrelevant 基准参考');

  // Test 4: multi-item comprehensive check
  const bulletHtml = renderToStaticMarkup(React.createElement(TargetBulletChart, {
    data: [
      { label: 'CPUV 成本控制', actual: 1.2, target: 1.5, unit: '元', direction: 'lower' }, // 80% 成本更低 达标
      { label: '零实际成本', actual: 0, target: 1.0, unit: '元', direction: 'lower' },        // 0 实际
      { label: '互动曝光量', actual: 95000, target: 100000, unit: '次', direction: 'higher' }, // 95% 未达标
      { label: '内容爆款率', actual: 18, target: 15, unit: '%', direction: 'higher' },        // 120% 达成
      { label: '千次曝光成本', actual: null, target: 25, unit: '元', direction: 'lower' },     // 未录入
    ],
  }));

  assert(bulletHtml.includes('100% 目标'), 'Explicitly renders normalized 100% 目标 line');
  assert(bulletHtml.includes('成本达标'), 'lower direction <= 100% recognized as 成本达标');
  assert(bulletHtml.includes('未达目标'), 'higher direction < 100% recognized as 未达目标');
  assert(bulletHtml.includes('达成目标'), 'higher direction >= 100% recognized as 达成目标');
  assert(bulletHtml.includes('实际值待登记'), 'Null actual marked as 实际值待登记');
  assert(!bulletHtml.includes('归一化达成'), 'Cost metric does not use 归一化达成 terminology');
  assert(bulletHtml.includes('ca-chart-readout-empty'), 'Renders placeholder readout preventing layout jump');
}

// 7. Test ScatterChart
console.log('Testing ScatterChart...');
{
  const scatterHtml = renderToStaticMarkup(React.createElement(ScatterChart, {
    data: [
      { label: '活动A', x: 12.5, y: 340, size: 5000 },
      { label: '活动B', x: 8.2, y: 520, size: 8000 },
      { label: '活动C', x: null, y: 200, size: 3000 }, // incomplete
    ],
    xLabel: 'CPUV成本 (元)',
    yLabel: '转化ROI (%)',
  }));

  assert(scatterHtml.includes('CPUV成本 (元)'), 'Displays x-axis label');
  assert(scatterHtml.includes('转化ROI (%)'), 'Displays y-axis label');
  assert(scatterHtml.includes('活动A'), 'Includes valid scatter point A');
  assert(scatterHtml.includes('活动B'), 'Includes valid scatter point B');
  assert(scatterHtml.includes('ca-chart-readout-empty'), 'Renders placeholder readout preventing layout jump');
}

console.log('✓ All 7 components rendered successfully in SSR and passed all assertions!');
