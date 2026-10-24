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
  const sanitized = raw.replace(/import\s+['"][^'"]+\.css['"];?/g, '');
  const compiled = ts.transpileModule(sanitized, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(filename);
  const customRequire = name => {
    if (name.endsWith('.css')) return {};
    if (name.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filename), name);
      if (fs.existsSync(`${resolved}.ts`)) return loadComponent(`${resolved}.ts`);
      if (fs.existsSync(`${resolved}.tsx`)) return loadComponent(`${resolved}.tsx`);
      if (fs.existsSync(resolved)) return loadComponent(resolved);
    }
    return nativeRequire(name);
  };
  vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, {})(customRequire, result, result.exports);
  moduleCache.set(filename, result.exports);
  return result.exports;
}

console.log('Loading CampaignCharts for boundary & correctness verification...');
const charts = loadComponent('features/campaign/CampaignCharts.tsx');

const {
  DualArenaChart,
  ButterflyCostChart,
  ScatterChart,
  PlacementScorecardChart,
  HorizontalBarChart,
  TargetBulletChart,
  LollipopRankChart,
} = charts;

// ============================================================================
// 1. DualArenaChart: zero / null / halfmissing / bothmissing / tinypositive / advantage
// ============================================================================
console.log('Testing DualArenaChart boundary conditions...');
{
  // 1a. Both missing -> no proportion bar, fallback text, em-dash
  const bothMissingHtml = renderToStaticMarkup(React.createElement(DualArenaChart, {
    leftTitle: '阵营A',
    rightTitle: '阵营B',
    leftPrimary: null,
    rightPrimary: null,
    metrics: [],
  }));
  assert(!bothMissingHtml.includes('ca-arena-track"'), 'Both missing must not draw proportion bar');
  assert(bothMissingHtml.includes('暂无可比较消耗'), 'Both missing explains lack of comparable spend');
  assert(bothMissingHtml.includes('—'), 'Both missing displays em-dash for percentage');

  // 1b. Half missing (left=100, right=null) -> must NOT draw fake 100/0 or 50/50 proportion bar
  const halfMissingHtml = renderToStaticMarkup(React.createElement(DualArenaChart, {
    leftTitle: '阵营A',
    rightTitle: '阵营B',
    leftPrimary: 100,
    rightPrimary: null,
    metrics: [],
  }));
  assert(!halfMissingHtml.includes('ca-arena-track"'), 'Half missing must not draw proportion bar');
  assert(halfMissingHtml.includes('暂无可比较消耗'), 'Half missing indicates cannot compare');
  assert(!halfMissingHtml.includes('100.0%'), 'Half missing does not fabricate 100% share');
  assert(!halfMissingHtml.includes('50.0%'), 'Half missing does not default to 50% share');

  // 1c. Both zero -> total = 0, no proportion bar
  const zeroHtml = renderToStaticMarkup(React.createElement(DualArenaChart, {
    leftTitle: '阵营A',
    rightTitle: '阵营B',
    leftPrimary: 0,
    rightPrimary: 0,
    metrics: [],
  }));
  assert(!zeroHtml.includes('ca-arena-track"'), 'Zero total must not draw proportion bar');
  assert(zeroHtml.includes('暂无可比较消耗'), 'Zero total explains no comparable spend');

  // 1d. Normal valid ratio -> draws proportion bar with correct percentages
  const normalHtml = renderToStaticMarkup(React.createElement(DualArenaChart, {
    leftTitle: '阵营A',
    rightTitle: '阵营B',
    leftPrimary: 300,
    rightPrimary: 700,
    metrics: [
      { label: '展现量 (规模)', leftValue: 50000, rightValue: 20000 }, // higherIsBetter omitted
      { label: '点击率 CTR', leftValue: 3.5, rightValue: 1.2, unit: '%', higherIsBetter: true },
      { label: '点击成本 CPC', leftValue: 0.8, rightValue: 1.5, unit: '元', higherIsBetter: false },
      { label: '微正值指标', leftValue: 0.001, rightValue: 100, higherIsBetter: true },
      { label: '缺失指标', leftValue: null, rightValue: 50, higherIsBetter: false },
    ],
  }));
  assert(normalHtml.includes('ca-arena-track"'), 'Normal data renders proportion bar');
  assert(normalHtml.includes('30.0%'), 'Left proportion 30.0%');
  assert(normalHtml.includes('70.0%'), 'Right proportion 70.0%');

  // 1e. Metrics advantage test: higherIsBetter omitted must NOT judge advantage or display '高优'
  const arenaRows = normalHtml.split('class="ca-arena-row"');
  const row0 = arenaRows[1];
  assert(!row0.includes('优势'), 'Omitted higherIsBetter must not judge advantage for scale');
  assert(!row0.includes('高优') && !row0.includes('低优'), 'Omitted higherIsBetter must not display direction badge');

  // 1f. Efficiency metrics: CTR (higher=better) and CPC (lower=better) properly judge advantage
  const row1 = arenaRows[2];
  assert(row1.includes('优势'), 'CTR 3.5 > 1.2 judges advantage');
  assert(row1.includes('高优'), 'CTR shows 高优');

  const row2 = arenaRows[3];
  assert(row2.includes('优势'), 'CPC 0.8 < 1.5 judges advantage');
  assert(row2.includes('低优'), 'CPC shows 低优');

  // 1g. Tiny positive test: 0.001 must not be clamped up to 6%
  const row3 = arenaRows[4];
  assert(row3.includes('width:0.001%'), 'Tiny positive 0.001/100 does not artificially inflate to 6%');
  assert(!row3.includes('width:6%'), 'Does not use Math.max(6, ...) clamp');
}

// ============================================================================
// 2. ButterflyCostChart: scale note / no conclusion bias / tiny positive / zero / null
// ============================================================================
console.log('Testing ButterflyCostChart...');
{
  const butterflyHtml = renderToStaticMarkup(React.createElement(ButterflyCostChart, {
    data: [
      { label: '渠道A', leftVal: 0.5, rightVal: 15.0, spend: 50000 },
      { label: '渠道B', leftVal: 1.2, rightVal: 8.0, spend: 30000 },
      { label: '渠道C', leftVal: 0, rightVal: null, spend: 10000 },
      { label: '渠道D', leftVal: 0.01, rightVal: 20.0, spend: 5000 },
    ],
    leftLabel: '点击成本 CPC',
    rightLabel: '曝光成本 CPM',
  }));

  // Note requirements
  assert(butterflyHtml.includes('左右独立刻度'), 'ButterflyCostChart explicitly notes 左右独立刻度');
  assert(butterflyHtml.includes('本组最低'), 'Uses 本组最低 without inferring business effectiveness');
  assert(!butterflyHtml.includes('最优引流'), 'Removes subjective 最优引流');
  assert(!butterflyHtml.includes('⚡低耗'), 'Removes emoji and subjective ⚡低耗');

  // Zero & missing handling
  assert(butterflyHtml.includes('width:0%'), 'Zero value has 0% width bar');
  assert(butterflyHtml.includes('>—<'), 'Missing right value renders em-dash');

  // Real proportion without Math.max(6, ...)
  assert(!butterflyHtml.includes('width:6%'), 'Does not artificially expand small positive to 6%');
}

// ============================================================================
// 3. ScatterChart: finite coordinates, no quadrant conclusions, mean lines preserved
// ============================================================================
console.log('Testing ScatterChart...');
{
  const scatterHtml = renderToStaticMarkup(React.createElement(ScatterChart, {
    data: [
      { label: '计划1', x: 10, y: 100, size: 500 },
      { label: '计划2', x: 20, y: 200, size: 800 },
      { label: '计划3', x: 0, y: 0, size: null },
    ],
    xLabel: '成本',
    yLabel: '转化',
  }));

  // Must keep mean lines
  assert(scatterHtml.includes('X均值'), 'Keeps X均值 line');
  assert(scatterHtml.includes('Y均值'), 'Keeps Y均值 line');

  // Must NOT include subjective quadrant conclusions
  assert(!scatterHtml.includes('高效优质区'), 'Removes 高效优质区 quadrant conclusion');
  assert(!scatterHtml.includes('放量竞争区'), 'Removes 放量竞争区 quadrant conclusion');
  assert(!scatterHtml.includes('高本待优区'), 'Removes 高本待优区 quadrant conclusion');
  assert(!scatterHtml.includes('低耗观察区'), 'Removes 低耗观察区 quadrant conclusion');
}

// ============================================================================
// 4. PlacementScorecardChart: totals, partial coverage, share denominator, no emoji
// ============================================================================
console.log('Testing PlacementScorecardChart...');
{
  // 4a. All missing -> total is not ¥0, shares are em-dash
  const allMissingHtml = renderToStaticMarkup(React.createElement(PlacementScorecardChart, {
    rows: [
      { name: '版位1', spend: null, ctr: null },
      { name: '版位2', spend: null, ctr: null },
    ],
  }));
  assert(!allMissingHtml.includes('总额 ¥0'), 'All missing must not display 总额 ¥0');
  assert(allMissingHtml.includes('总额 —'), 'All missing displays 总额 —');
  assert(allMissingHtml.includes('span class="ca-scorecard-pct">(—)'), 'All missing displays (—) share in legend');

  // 4b. Partial missing -> labeled 已知消耗 with coverage, not pretending to be complete total
  const partialHtml = renderToStaticMarkup(React.createElement(PlacementScorecardChart, {
    rows: [
      { name: '版位1', spend: 300, ctr: 2.1 },
      { name: '版位2', spend: null, ctr: null },
      { name: '版位3', spend: 700, ctr: 3.5 },
      { name: '版位4', spend: null, ctr: 1.8 },
    ],
  }));
  assert(partialHtml.includes('已知消耗'), 'Partial data calls sum 已知消耗');
  assert(partialHtml.includes('覆盖 2/4'), 'Partial data gives coverage 2/4');
  assert(!partialHtml.includes('总额 ¥1,000'), 'Partial sum must not pretend to be full total');
  assert(partialHtml.includes('span class="ca-scorecard-pct">(—)'), 'Incomplete dataset does not fabricate shares');

  // 4c. All zero -> denominator 0, does not display fake share
  const allZeroHtml = renderToStaticMarkup(React.createElement(PlacementScorecardChart, {
    rows: [
      { name: '版位1', spend: 0, ctr: 1.0 },
      { name: '版位2', spend: 0, ctr: 2.0 },
    ],
  }));
  assert(allZeroHtml.includes('总额 ¥0'), 'All zero displays 总额 ¥0');
  assert(!allZeroHtml.includes('NaN'), 'All zero denominator does not produce NaN');
  assert(allZeroHtml.includes('span class="ca-scorecard-pct">(—)'), 'Zero sum cannot calculate share, renders (—)');

  // 4d. Complete with true zero -> real 0 renders 0.0%, non-zero renders correct share
  const completeHtml = renderToStaticMarkup(React.createElement(PlacementScorecardChart, {
    rows: [
      { name: '版位A', spend: 0, ctr: 1.0, cpc: 1.5 },
      { name: '版位B', spend: 400, ctr: 3.0, cpc: 0.8 },
      { name: '版位C', spend: 600, ctr: 2.0, cpc: 1.2 },
    ],
  }));
  assert(completeHtml.includes('总额 ¥1,000'), 'Complete data displays full 总额');
  assert(completeHtml.includes('0.0%'), 'Real zero displays 0.0% not em-dash');
  assert(completeHtml.includes('40.0%'), 'Row B displays 40.0%');
  assert(completeHtml.includes('60.0%'), 'Row C displays 60.0%');

  // 4e. No emoji decorations
  assert(!completeHtml.includes('🏆'), 'Removes trophy emoji');
  assert(!completeHtml.includes('⚡'), 'Removes lightning emoji');
  assert(completeHtml.includes('最高'), 'Uses neutral 最高');
  assert(completeHtml.includes('最低'), 'Uses neutral 最低');
}

// ============================================================================
// 5. HorizontalBarChart, TargetBulletChart & LollipopRankChart: no artificial amplification
// ============================================================================
console.log('Testing HorizontalBarChart, TargetBulletChart & LollipopRankChart real scales...');
{
  const hbarHtml = renderToStaticMarkup(React.createElement(HorizontalBarChart, {
    data: [
      { label: '大值', value: 1000 },
      { label: '零值', value: 0 },
      { label: '极小值', value: 0.05 },
    ],
  }));
  assert(!hbarHtml.includes('width="3"'), 'HorizontalBarChart does not artificially clamp to min 3px');

  const bulletHtml = renderToStaticMarkup(React.createElement(TargetBulletChart, {
    data: [
      { label: '微达成', actual: 0.01, target: 100, direction: 'higher' },
      { label: '零实际', actual: 0, target: 100, direction: 'higher' },
    ],
  }));
  assert(!bulletHtml.includes('width="3"'), 'TargetBulletChart does not artificially clamp to min 3px');

  assert(typeof LollipopRankChart === 'function', 'LollipopRankChart must be exported as a function');
  const lollipopHtml = renderToStaticMarkup(React.createElement(LollipopRankChart, {
    data: [
      { label: 'Top1', value: 10000 },
      { label: 'Top2', value: 0 },
      { label: 'Top3', value: 0.01 },
      { label: 'Top4', value: null },
    ],
  }));
  assert(lollipopHtml.includes('width:0%'), 'Zero value in LollipopRankChart renders 0%');
  assert(!lollipopHtml.includes('width:3%'), 'LollipopRankChart does not clamp tiny value to 3%');
  assert(!lollipopHtml.includes('var(') || !lollipopHtml.includes(')66'), 'LollipopRankChart glow does not contain invalid var()66');
}

// ============================================================================
// 6. HuangTianeBoard integration & data checks
// ============================================================================
console.log('Testing HuangTianeBoard integration...');
{
  const huang = loadComponent('features/campaign/HuangTianeBoard.tsx');
  const mockDashboard = {
    tables: [
      {
        id: 'huang-brand-kol-tiers',
        name: 'brandKolTiers',
        rows: [
          { tier: '头部KOL', spend: '50000', clicks: '12000', impressions: '150000', cpc: '0.40', cpm: '33.3' },
          { tier: '腰部KOL', spend: '30000', clicks: '8000', impressions: '100000', cpc: '0.38', cpm: '30.0' },
        ],
      },
      {
        id: 'huang-brand-ad-types',
        name: 'brandAdTypes',
        rows: [
          { adType: '信息流', spend: '70000', impressions: '200000', clicks: '15000', ctr: '7.5', cpc: '0.45', cpm: '35', cpe: '1.2' },
          { adType: '搜索', spend: '30000', impressions: '80000', clicks: '6000', ctr: '7.5', cpc: '0.50', cpm: '37.5', cpe: '1.5' },
        ],
      },
      {
        id: 'huang-brand-provinces',
        name: 'brandRegions',
        rows: [
          { province: '北京', spend: '50000', engagements: '3000', cpe: '16.6', ctr: '4.2' },
          { province: '上海', spend: '40000', engagements: '2500', cpe: '16.0', ctr: '4.0' },
        ],
      },
    ],
    dailyDatasets: [
      {
        id: 'huang-cid-standard-daily',
        name: 'cidStandardDaily',
        rows: [{ spend: '120000', gmv: '240000', orders: '3000', uv: '18000' }],
      },
      {
        id: 'huang-cid-simple-daily',
        name: 'cidSimpleDaily',
        rows: [{ spend: '80000', gmv: '120000', orders: '1500', uv: '10000' }],
      },
    ],
  };

  const huangHtml = renderToStaticMarkup(React.createElement(huang.HuangTianeBoard, {
    dashboard: mockDashboard,
    section: 'ads',
  }));

  // Butterfly neutral rating, no hardcoded thresholds
  assert(!huangHtml.includes('ht-butterfly-cost-badge green'), 'Removes arbitrary green rating badge');
  assert(!huangHtml.includes('ht-butterfly-cost-badge amber'), 'Removes arbitrary amber rating badge');
  assert(huangHtml.includes('ht-butterfly-cost-badge neutral'), 'Uses neutral actual cost badge');
  assert(huangHtml.includes('单位成本对比'), 'Header uses 单位成本对比 without subjective evaluation');

  // No medal emojis
  assert(!huangHtml.includes('🥇') && !huangHtml.includes('🥈') && !huangHtml.includes('🥉'), 'Removes medal emojis in region rank');

  // 对决 -> 对比 (both in brand and overview/cid)
  assert(!huangHtml.includes('对决') && !huangHtml.includes('拔河'), 'No 对决 or 拔河 in ads section');

  const huangOverviewHtml = renderToStaticMarkup(React.createElement(huang.HuangTianeBoard, {
    dashboard: mockDashboard,
    section: 'overview',
  }));
  assert(!huangOverviewHtml.includes('效能对决'), 'Removes 效能对决 in overview');
  assert(huangOverviewHtml.includes('红猫CID 标准投与简单投效能对比'), 'Overview uses 效能对比 wording');

  // Scale metrics in DualArenaCard: impressions and clicks must not have winner/advantage
  const startLabel = '展现量 (曝光规模)';
  const endLabel = '点击率 CTR';
  assert(huangHtml.includes(startLabel), `Huang HTML must include '${startLabel}'`);
  assert(huangHtml.includes(endLabel), `Huang HTML must include '${endLabel}'`);
  const idxStart = huangHtml.indexOf(startLabel);
  const idxEnd = huangHtml.indexOf(endLabel);
  assert(idxStart > 0 && idxEnd > idxStart, `'${startLabel}' must precede '${endLabel}'`);
  const huangFeedSearch = huangHtml.slice(idxStart, idxEnd);
  assert(huangFeedSearch.length > 0, 'Extracted slice must not be empty');
  assert(!huangFeedSearch.includes('ht-advantage-badge'), 'Impressions volume row must not show 优势 badge');

  // Huang ratio param test 1: when one side ratio param is missing, preserve source value and show '份额口径需核对' without drawing share track
  const huangOneRatioMissing = renderToStaticMarkup(React.createElement(huang.HuangTianeBoard, {
    dashboard: {
      tables: [
        {
          id: 'huang-brand-ad-types',
          name: 'brandAdTypes',
          rows: [
            { adType: '信息流', spend: '70000', spendRatio: '68.5' },
            { adType: '搜索', spend: '30000', spendRatio: null },
          ],
        },
      ],
    },
    section: 'ads',
  }));
  assert(huangOneRatioMissing.includes('68.5%'), 'Preserves source original ratio value for side A');
  assert(huangOneRatioMissing.includes('份额口径需核对'), 'Incomplete ratio parameter triggers 份额口径需核对');
  assert(!huangOneRatioMissing.includes('class="ht-arena-track"'), 'Incomplete ratio does not draw proportion bar');
  assert(!huangOneRatioMissing.includes('31.5%'), 'Does not fabricate 100 - ratioA when side B ratio is missing');

  // Huang ratio param test 2: 60+60 (sum=120) must preserve original values, not draw bar, and show '份额口径需核对'
  const huang6060 = renderToStaticMarkup(React.createElement(huang.HuangTianeBoard, {
    dashboard: {
      tables: [
        {
          id: 'huang-brand-ad-types',
          name: 'brandAdTypes',
          rows: [
            { adType: '信息流', spend: '60000', spendRatio: '60.0' },
            { adType: '搜索', spend: '60000', spendRatio: '60.0' },
          ],
        },
      ],
    },
    section: 'ads',
  }));
  assert(huang6060.includes('60.0%'), 'Preserves 60.0% source value');
  assert(huang6060.includes('份额口径需核对'), '60+60 invalid sum triggers 份额口径需核对');
  assert(!huang6060.includes('class="ht-arena-track"'), '60+60 must not draw proportion bar');
  assert(!huang6060.includes('50.0%'), 'Does not re-normalize 60+60 to 50/50');

  // Huang ratio param test 3: negative ratio (-10.0 and 110.0) must preserve original values, not draw bar, and show '份额口径需核对'
  const huangNegative = renderToStaticMarkup(React.createElement(huang.HuangTianeBoard, {
    dashboard: {
      tables: [
        {
          id: 'huang-brand-ad-types',
          name: 'brandAdTypes',
          rows: [
            { adType: '信息流', spend: '50000', spendRatio: '-10.0' },
            { adType: '搜索', spend: '50000', spendRatio: '110.0' },
          ],
        },
      ],
    },
    section: 'ads',
  }));
  assert(huangNegative.includes('-10.0%'), 'Preserves -10.0% source value');
  assert(huangNegative.includes('110.0%'), 'Preserves 110.0% source value');
  assert(huangNegative.includes('份额口径需核对'), 'Negative ratio triggers 份额口径需核对');
  assert(!huangNegative.includes('class="ht-arena-track"'), 'Negative ratio must not draw proportion bar');
}

// ============================================================================
// 7. CSS Contract: no fake width regression (.ca-arena-track-bar min-width / padding / divider)
// ============================================================================
console.log('Testing CSS contracts...');
{
  const css = fs.readFileSync('features/campaign/campaign-analytics.css', 'utf8');

  // 1. .ca-arena-track-bar rule block
  const trackBarMatch = css.match(/\.ca-arena-track-bar\s*\{([^}]+)\}/);
  assert(trackBarMatch, 'Must find .ca-arena-track-bar rule in campaign-analytics.css');
  const trackBarBody = trackBarMatch[1];
  assert(!trackBarBody.includes('min-width: 28px'), '.ca-arena-track-bar must not enforce min-width 28px');
  assert(trackBarBody.includes('min-width: 0') || trackBarBody.includes('min-width:0'), '.ca-arena-track-bar must set min-width: 0');
  assert(trackBarBody.includes('padding-inline: 0') || trackBarBody.includes('padding: 0'), '.ca-arena-track-bar must reset padding to 0');

  // 2. .ca-arena-track-left and .ca-arena-track-right rule blocks
  const leftMatch = css.match(/\.ca-arena-track-left\s*\{([^}]+)\}/);
  assert(leftMatch, 'Must find .ca-arena-track-left rule in campaign-analytics.css');
  assert(leftMatch[1].includes('padding-left: 0') || leftMatch[1].includes('padding-left:0'), '.ca-arena-track-left must set padding-left: 0');

  const rightMatch = css.match(/\.ca-arena-track-right\s*\{([^}]+)\}/);
  assert(rightMatch, 'Must find .ca-arena-track-right rule in campaign-analytics.css');
  assert(rightMatch[1].includes('padding-right: 0') || rightMatch[1].includes('padding-right:0'), '.ca-arena-track-right must set padding-right: 0');

  // 3. .ca-arena-track-divider rule block
  const dividerMatch = css.match(/\.ca-arena-track-divider\s*\{([^}]+)\}/);
  assert(dividerMatch, 'Must find .ca-arena-track-divider rule in campaign-analytics.css');
  assert(dividerMatch[1].includes('display: none') || dividerMatch[1].includes('display:none'), '.ca-arena-track-divider rule body must set display: none');
}

console.log('✓ All boundary & correctness checks passed successfully!');
