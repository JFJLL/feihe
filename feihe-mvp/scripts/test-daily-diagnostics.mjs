#!/usr/bin/env node

/**
 * test-daily-diagnostics.mjs
 *
 * Focused unit tests for Campaign Daily Diagnostics:
 * 1. 累积 gap 缺日断线（不隐性补0，缺失日为 null，有数据日正常累加）
 * 2. 周内缺 click 时加权效率严格为 null（不以缺分母的局部数据充全周）
 * 3. spend=0, clicks>0 产出合法的成本 0（散点与指标卡不误杀 0）
 * 4. spend>0, gmv=0 产出合法的 ROI 0（散点与指标卡不误杀 0）
 * 5. all-null 全空系列安全阻断（hasValidData=false，不出假图）
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const moduleCache = new Map();
function loadTsModule(filename) {
  filename = path.resolve(__dirname, filename);
  if (!filename.endsWith('.ts') && !filename.endsWith('.tsx')) {
    if (fs.existsSync(`${filename}.ts`)) filename = `${filename}.ts`;
    else if (fs.existsSync(`${filename}.tsx`)) filename = `${filename}.tsx`;
  }
  if (moduleCache.has(filename)) return moduleCache.get(filename);
  const raw = fs.readFileSync(filename, 'utf8');
  const sanitized = raw.replace(/import\s+['"][^'"]+\.css['"];?/g, '');
  const compiled = ts.transpileModule(sanitized, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(filename);
  const customRequire = (name) => {
    if (name.endsWith('.css')) return {};
    if (name.startsWith('.')) {
      return loadTsModule(path.resolve(path.dirname(filename), name));
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

const diagMod = loadTsModule('../features/campaign/daily-diagnostics-model.ts');
const dailyMod = loadTsModule('../features/campaign/campaign-daily-model.ts');

console.log('=== 1. 测试累积走势 Gap 缺日断线与覆盖率统计 ===');
const gapDataset = {
  id: 'test-gap-dataset',
  label: '测试断线数据集',
  period: '2026-10-01 ~ 2026-10-03',
  metrics: [
    { key: 'spend', label: '花费', unit: '元' },
    { key: 'clicks', label: '点击量', unit: '次' },
  ],
  rows: [],
};
const gapCalendarRows = [
  { date: '2026-10-01', spend: 100, clicks: 50 },
  { date: '2026-10-02', spend: null, clicks: null }, // 缺日
  { date: '2026-10-03', spend: 200, clicks: 80 },
];

const cumResult = diagMod.computeCumulativeTrend(gapDataset, gapCalendarRows);
assert.equal(cumResult.hasValidData, true, '两序列有数据时 hasValidData 应为 true');
assert.equal(cumResult.totalDays, 3, '总天数应为 3');
assert.equal(cumResult.spendPrefixCount, 1, '消耗前缀有效连续天数应为 1');
assert.equal(cumResult.rows[0].cum_spend, 100, '第1天严格前缀累计消耗 100');
assert.equal(cumResult.rows[1].cum_spend, null, '缺日累计消耗必须为 null (严格前缀中止)');
assert.equal(cumResult.rows[1].cum_output, null, '缺日累计产出必须为 null (严格前缀中止)');
assert.equal(cumResult.rows[2].cum_spend, null, '遇缺日后后续累计严格为 null (不作跳空累加或隐性补0)');
assert.equal(cumResult.rows[2].cum_output, null, '遇缺日后产出累计亦严格为 null');
console.log('✓ 严格前缀累计遇缺日即中止机制校验通过');

console.log('\n=== 2. 测试周内缺分母 (如点击) 时加权效率严格判定 ===');
const weekDataset = {
  id: 'test-week-dataset',
  label: '测试周度数据集',
  period: '2026-10-12 ~ 2026-10-18', // 2026-W42 整周
  metrics: [
    { key: 'spend', label: '花费', unit: '元' },
    { key: 'clicks', label: '点击量', unit: '次' },
  ],
  rows: [],
};

// 周内前6天有值，周日缺 clicks
const weekCalendarRows = [
  { date: '2026-10-12', spend: 100, clicks: 50 },
  { date: '2026-10-13', spend: 100, clicks: 50 },
  { date: '2026-10-14', spend: 100, clicks: 50 },
  { date: '2026-10-15', spend: 100, clicks: 50 },
  { date: '2026-10-16', spend: 100, clicks: 50 },
  { date: '2026-10-17', spend: 100, clicks: 50 },
  { date: '2026-10-18', spend: 100, clicks: null }, // 缺点击
];

const weeklyResult = diagMod.computeWeeklyPacing(weekDataset, weekCalendarRows);
assert.equal(weeklyResult.weeks.length, 1, '应有 1 个周分组');
const w1 = weeklyResult.weeks[0];
assert.equal(w1.validDays, 7, '消耗7天有值');
assert.equal(w1.calendarDays, 7, '日历7天');
assert.equal(w1.isFullCalendarWeek, true, '7天自然整周');
assert.equal(w1.isCompleteInSpan, true, '区间内采集完整');
assert.equal(w1.weekSpend, 700, '周消耗为 700');
assert.equal(w1.weightedEfficiency, null, '周内有任一天缺 clicks 时，加权效率必须严格返回 null，不以局部冒充全周');
console.log('✓ 周内缺分母加权效率严格返回 null 校验通过');

console.log('\n=== 3. 测试 spend=0, clicks>0 产出合法的真实 CPC=0 ===');
const zeroSpendDataset = {
  id: 'test-zero-spend',
  label: '免费/自然流量测试',
  period: '2026-10-01 ~ 2026-10-02',
  metrics: [
    { key: 'spend', label: '花费', unit: '元' },
    { key: 'clicks', label: '点击量', unit: '次' },
    { key: 'cpc', label: '点击成本', unit: '元' },
  ],
  rows: [],
};
const zeroSpendRows = [
  { date: '2026-10-01', spend: 0, clicks: 120, cpc: 0 },
  { date: '2026-10-02', spend: 50, clicks: 50, cpc: 1.0 },
];

const scatterZero = diagMod.computeScaleCostScatter(zeroSpendDataset, zeroSpendRows);
assert.equal(scatterZero.points.length, 2, 'spend=0 和 cpc=0 必须保留在散点图中，不可误杀');
assert.equal(scatterZero.points[0].label, '10-01', '散点 label 必须为简短 MM-DD，避免画布截断为 2026-1...');
assert.ok(scatterZero.points[0].detail.includes('2026-10-01'), '散点 detail 完整保留全量日期与费用');
assert.equal(scatterZero.points[0].x, 0, '第1点 x 应为 0');
assert.equal(scatterZero.points[0].y, 0, '第1点 y 应为 0');

const summaryZero = dailyMod.computeSummaryMetrics(zeroSpendDataset, zeroSpendRows);
const cpcMetric = summaryZero[3];
assert.equal(cpcMetric.label, '综合加权 CPC');
assert.equal(cpcMetric.value, '0.29', '0消耗与50消耗加权 CPC 正常计算');
console.log('✓ 真实 0 成本在散点图与汇总指标中合法保留通过');

console.log('\n=== 4. 测试 spend>0, gmv=0 产出合法的真实 ROI=0 ===');
const zeroGmvDataset = {
  id: 'test-cid-zero-gmv',
  label: 'CID 零产出测试',
  period: '2026-10-01 ~ 2026-10-02',
  metrics: [
    { key: 'spend', label: '花费', unit: '元' },
    { key: 'gmv', label: '成交GMV', unit: '元' },
    { key: 'roi', label: '成交ROI', unit: '倍' },
  ],
  rows: [],
};
const zeroGmvRows = [
  { date: '2026-10-01', spend: 100, gmv: 0, roi: 0 },
  { date: '2026-10-02', spend: 200, gmv: 0, roi: 0 },
];

const scatterRoi = diagMod.computeScaleCostScatter(zeroGmvDataset, zeroGmvRows);
assert.equal(scatterRoi.points.length, 2, 'ROI=0 必须保留在散点图中');
assert.equal(scatterRoi.points[0].y, 0, '第1点 ROI 为 0');

const summaryRoi = dailyMod.computeSummaryMetrics(zeroGmvDataset, zeroGmvRows);
const roiMetric = summaryRoi[3];
assert.equal(roiMetric.label, '周期综合 ROI');
assert.equal(roiMetric.value, '0', '总花费300产生GMV 0，综合 ROI 遵循 fmtNum 格式化契约输出 "0"');
console.log('✓ 真实 0 ROI 在散点图与综合指标中合法保留通过');

console.log('\n=== 5. 测试 All-Null 全空系列安全阻断 ===');
const allNullDataset = {
  id: 'test-all-null',
  label: '全空测试',
  period: '2026-10-01 ~ 2026-10-02',
  metrics: [
    { key: 'spend', label: '花费', unit: '元' },
    { key: 'gmv', label: '成交GMV', unit: '元' },
  ],
  rows: [],
};
const allNullRows = [
  { date: '2026-10-01', spend: null, gmv: null },
  { date: '2026-10-02', spend: null, gmv: null },
];

const cumNull = diagMod.computeCumulativeTrend(allNullDataset, allNullRows);
assert.equal(cumNull.hasValidData, false, '全空系列 hasValidData 必须为 false');

const scatterNull = diagMod.computeScaleCostScatter(allNullDataset, allNullRows);
assert.equal(scatterNull.hasEnoughPoints, false, '全空系列散点 hasEnoughPoints 必须为 false');
assert.equal(scatterNull.points.length, 0, '散点集合为空');

const weeklyNull = diagMod.computeWeeklyPacing(allNullDataset, allNullRows);
assert.equal(weeklyNull.hasValidData, false, '全空系列周度 hasValidData 必须为 false');

const heatmapNull = diagMod.computeMetricHeatmap(allNullDataset, allNullRows);
assert.equal(heatmapNull.length, 0, '全空系列热力图行数必须为 0，不绘制虚假空卡');
console.log('✓ All-Null 全空系列安全阻断校验通过');

console.log('\n======================================================');
console.log('🎉 分日诊断与核心口径专项自动化测试 5/5 全部通过！');
console.log('======================================================');
