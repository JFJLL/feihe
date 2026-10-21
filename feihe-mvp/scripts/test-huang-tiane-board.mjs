#!/usr/bin/env node

/**
 * test-huang-tiane-board.mjs
 *
 * Focused verification for Huang Tiane UI model & component contract:
 * 1. strictSum & strictRatio calculation guarantees (real 0 preserved, missing null, denom 0 returns null)
 * 2. Month label derivation from actual date bounds (no subjective hardcoded terms)
 * 3. KOS defaults ('未标注', no invented persona)
 * 4. Model extraction with facts data (31 creators, 65 KOS, 19 days CID standard/simple/total)
 * 5. HuangTianeBoard module export & props signature
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

console.log('=== 1. 测试 huang-model 纯函数 (strictSum / strictRatio / parseNum) ===');
const modelMod = await import('../features/campaign/huang-model.ts');
const { strictSum, strictSumInt, strictRatio, parseNum, formatCurrency, extractHuangTianeData } = modelMod;
const cur100 = formatCurrency(100);
assert.ok(!cur100.includes('Â'), '金额不得包含 Â 乱码字符');
assert.ok(cur100.startsWith('¥'), '金额必须以真正的 ¥ 符号开头');

// Test parseNum
assert.equal(parseNum(123.45), 123.45);
assert.equal(parseNum('¥123,456.78'), 123456.78);
assert.equal(parseNum('45.6%'), 45.6);
assert.equal(parseNum(0), 0);
assert.equal(parseNum('0'), 0);
assert.equal(parseNum(null), null);
assert.equal(parseNum('—'), null);
assert.equal(parseNum('#DIV/0!'), null);
assert.equal(parseNum('None'), null);

// Test strictSum
const sampleRows = [{ a: 10 }, { a: 20 }, { a: 0 }];
assert.equal(strictSum(sampleRows, 'a'), 30);
const sampleWithNull = [{ a: 10 }, { a: null }, { a: 20 }];
assert.equal(strictSum(sampleWithNull, 'a'), null, '任意行缺失该指标时，strictSum必须返回null');

// Test strictRatio
assert.equal(strictRatio(100, 20), 5);
assert.equal(strictRatio(100, 0), null, '分母为0时strictRatio必须返回null而非0');
assert.equal(strictRatio(null, 50), null, '分子缺失时strictRatio必须返回null');
assert.equal(strictRatio(100, null), null, '分母缺失时strictRatio必须返回null');
console.log('  -> strictSum / strictRatio 纯函数测试通过');

console.log('=== 2. 测试真实 facts.json 结构与数据提取 ===');
const sourceAPath = path.resolve(REPO_ROOT, 'docs/new-projects-sources/huang-tiane/source-a/facts.json');
const sourceBPath = path.resolve(REPO_ROOT, 'docs/new-projects-sources/huang-tiane/source-b/facts.json');
assert.ok(fs.existsSync(sourceAPath), 'source-a/facts.json 必须存在');
assert.ok(fs.existsSync(sourceBPath), 'source-b/facts.json 必须存在');

const dataA = JSON.parse(fs.readFileSync(sourceAPath, 'utf-8'));
const dataB = JSON.parse(fs.readFileSync(sourceBPath, 'utf-8'));

assert.equal(dataA.buildStatus, 'complete', 'source-a buildStatus 必须为 complete');

const mockDashboard = {
  projectId: 'huang-tiane',
  name: '黄天鹅战役复盘',
  reportPeriod: '2026-10-01 ~ 2026-10-19',
  updatedAt: new Date().toISOString(),
  sources: [...(dataA.sources || []), ...(dataB.sources || [])],
  tables: [...(dataA.tables || []), ...(dataB.tables || [])],
  kpis: [],
  actions: { title: '战役执行重点事项', items: [] },
  warnings: [],
  dailyDatasets: [...(dataA.dailyDatasets || []), ...(dataB.dailyDatasets || [])],
};

const extracted = extractHuangTianeData(mockDashboard);

assert.equal(extracted.aipsStocks.awarenessImpressions, null, 'Exposure counts are not AIPS awareness people');
assert.equal(extracted.aipsStocks.potentialPlays5s, null, 'Video plays are not AIPS purchase people');
assert.equal(extracted.aipsStocks.cohortTransitions, null, 'Do not fabricate cohort transitions');
assert.equal(extracted.beijingShanghaiPrecision.truePenetration, null, 'Regional share is not audience penetration');
assert.equal(extracted.contentCapacity.theoreticalCapacityLimit, null, 'Inventory does not establish a capacity ceiling');
assert.equal(extracted.contentCapacity.totalContentSupply, extracted.creatorsPublished + extracted.kosCount);
const regionalMutation = structuredClone(mockDashboard);
const regionTable = regionalMutation.tables.find(table => table.id === 'huang-brand-provinces');
assert(regionTable, 'Regional source is available');
regionTable.rows = regionTable.rows.filter(row => row.province !== '北京');
assert.equal(extractHuangTianeData(regionalMutation).beijingShanghaiPrecision.combinedSpend, null, 'Missing Beijing must not become zero in a combined total');
const matrixMutation = structuredClone(mockDashboard);
matrixMutation.tables.push({ id: 'huang-brand-gender-age', title: 'test', columns: [], rows: [
  { gender: '女', ageGroup: '33-40', spend: null, engagements: null },
  { gender: '男', ageGroup: '18-22', spend: 0, engagements: 0 },
  { gender: '未知', ageGroup: '未知', spend: 1, engagements: 1 },
] });
const matrix = extractHuangTianeData(matrixMutation).genderAgeMatrix;
assert.deepEqual(matrix.ageGroups, ['18-22', '33-40', '未知']);
assert.equal(matrix.cells.find(cell => cell.gender === '女').spend, null);
assert.equal(matrix.cells.find(cell => cell.gender === '男').spend, 0);

// Verify creators
assert.equal(extracted.creatorsCount, 31, '达人总数必须为31位');
assert.equal(extracted.creatorsPublished, 18, '已发布达人必须精确为18位 (不得为0)');
assert.equal(extracted.creatorsAssetCollected, 18, '已收集素材必须为18位');

const rawFees = extracted.creators.map(c => c.price_raw).filter(p => p !== null);
const withFees = extracted.creators.map(c => c.price_with_fee).filter(p => p !== null);
assert.equal(rawFees.length, 31, '全部31位达人裸价必须解析有效');
assert.equal(withFees.length, 31, '全部31位达人含平台费报价必须解析有效');
assert.equal(rawFees.reduce((a, b) => a + b, 0), 289890.0, '达人裸价总和必须对账 289,890.00 元');
assert.equal(withFees.reduce((a, b) => a + b, 0), 324774.0, '达人含平台费总报价必须对账 324,774.00 元');
assert.ok(extracted.creatorsPublishRate > 50, '已发布占比必须 > 50%');

// Verify KOS
assert.equal(extracted.kosCount, 65, 'KOS总数必须为65篇');
assert.equal(extracted.kosWithDate, 65, '全部65篇KOS笔记发布日期必须解析有效（2026-10-19）');
extracted.kosNotes.forEach((k) => {
  assert.ok(k.account_tier, 'KOS账号量级不得为空');
  assert.ok(k.content_type, 'KOS内容类型不得为空');
});

// Verify CID
assert.equal(extracted.cidStandardSpend, 59024.76, 'CID标准投消耗对账必须通过');
assert.equal(extracted.cidStandardOrders, 1918, 'CID标准投订单对账必须通过');
assert.equal(extracted.cidStandardGmv, 192884.09, 'CID标准投GMV对账必须通过');
assert.equal(extracted.cidStandardUv, 3955, 'CID标准投UV对账必须通过');

assert.equal(extracted.cidSimpleSpend, 42403.02, 'CID简单投消耗对账必须通过');
assert.equal(extracted.cidSimpleOrders, 2257, 'CID简单投订单对账必须通过');
assert.equal(extracted.cidSimpleGmv, 168346.72, 'CID简单投GMV对账必须通过');
assert.equal(extracted.cidSimpleUv, 5434, 'CID简单投UV对账必须通过');

assert.equal(extracted.cidTotalSpend, 101427.78, 'CID两类合计消耗对账必须通过');
assert.equal(extracted.cidTotalOrders, 4175, 'CID两类合计订单对账必须通过');
assert.equal(extracted.cidTotalGmv, 361230.81, 'CID两类合计GMV对账必须通过');
assert.equal(extracted.cidTotalUv, 9389, 'CID两类合计UV对账必须通过');

// Verify dynamic date labels in commerceMonths
assert.equal(extracted.commerceMonths.length, 4, '商销必须分为4个自然月区间');
assert.equal(extracted.commerceMonths[0].monthShort, '7月', '商销月份短名必须为 7月');
assert.equal(extracted.commerceMonths[3].monthShort, '10月', '商销月份短名必须为 10月');
extracted.commerceMonths.forEach((m) => {
  assert.ok(m.label.includes(' ~ '), '商销月度标签必须动态包含首末日期');
  assert.ok(!m.label.includes('蓄水'), '商销月度标签不得包含主观“蓄水”等词汇');
  assert.ok(!m.label.includes('大促'), '商销月度标签不得包含主观“大促”等词汇');
});
console.log('  -> 真实数据提取与对账指标验证完全一致');

console.log('=== 3. 静态分析与契约检验 HuangTianeBoard.tsx ===');
const boardFilePath = path.resolve(__dirname, '../features/campaign/HuangTianeBoard.tsx');
assert.ok(fs.existsSync(boardFilePath), 'HuangTianeBoard.tsx 必须存在');
const boardCode = fs.readFileSync(boardFilePath, 'utf-8');
assert.ok(boardCode.includes('export function HuangTianeBoard'), '必须具名导出 HuangTianeBoard 组件');
assert.ok(boardCode.includes('export interface HuangTianeBoardProps'), '必须导出 HuangTianeBoardProps 接口');
assert.ok(boardCode.includes('CAMPAIGN_PALETTE'), '必须使用统一 CAMPAIGN_PALETTE 调色板');
assert.ok(!boardCode.includes('Â'), 'HuangTianeBoard.tsx 不得含有 Â 乱码');
assert.ok(!boardCode.includes('æ'), 'HuangTianeBoard.tsx 不得含有 æ 乱码');
assert.ok(!boardCode.includes('Offset 0') && !boardCode.includes('Offset 12'), '不得包含底层内部 Offset 术语');
assert.ok(!boardCode.includes('深度A_I'), '不得发明深度A_I，必须使用原文字段');
assert.ok(!boardCode.includes('action={'), 'ChartPanel 参数必须为复数 actions，不得为单数 action');
assert.ok(boardCode.includes('actions={'), 'ChartPanel 必须正确传递 actions 插槽');
console.log('  -> HuangTianeBoard 静态契约检查通过');

console.log('\n[PASS] Huang Tiane Board 单元与契约测试全部通过！');
