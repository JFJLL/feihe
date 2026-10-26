#!/usr/bin/env node

/**
 * test-campaign-sync-fixtures.mjs
 *
 * Production Fixture Test Suite:
 * Uses pure parser functions from lib/campaign-sync-parser.mjs directly.
 * Verifies all 7 core edge cases, input validation, and candidate artifacts.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateCapture,
  safeParseNum,
  strictRatio,
  strictSum,
  parseWipesDelivery,
  parseWipesTaosou,
  parseHuangCommerce,
  parseHuangCid,
  parseMeilingPivot,
  parseHuangBrandRaw,
  rebuildHuangSummaryTables
} from '../lib/campaign-sync-parser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CANDIDATE_DIR = path.resolve(ROOT_DIR, '.verification/live-sync-20261026/campaign');

console.log('=== Campaign Daily Sync Production Fixture Tests ===\n');

// -------------------------------------------------------------
// Test 1: Production validateCapture Rejection of Incomplete/Truncated Sources
// -------------------------------------------------------------
console.log('Test 1: 验证生产 validateCapture 拦截非法与截断源数据...');
assert.throws(() => validateCapture(null, { sheets: [{ range: 'A1:A1', data: [[1]] }] }), /Receipt is missing/);
assert.throws(() => validateCapture({ ok: false }, { sheets: [{ range: 'A1:A1', data: [[1]] }] }), /Receipt ok is not true/);
assert.throws(() => validateCapture({ ok: true, data: {} }, { sheets: [{ range: 'A1:A1', data: [[1]] }] }), /Receipt complete is false/);
assert.throws(() => validateCapture({ ok: true, data: { complete: false } }, { sheets: [{ range: 'A1:A1', data: [[1]] }] }), /Receipt complete is false/);
assert.throws(() => validateCapture({ ok: true, data: { complete: true, truncated: true } }, { sheets: [{ range: 'A1:A1', data: [[1]] }] }), /Receipt indicates truncated=true/);
assert.throws(() => validateCapture({ ok: true, data: { complete: true, has_more: true } }, { sheets: [{ range: 'A1:A1', data: [[1]] }] }), /Receipt indicates has_more=true/);
assert.throws(() => validateCapture({ ok: true, data: { complete: true } }, null), /Payload object is missing/);
assert.throws(() => validateCapture({ ok: true, data: { complete: true } }, { sheets: [] }), /Expected payload.sheets to be single sheet array/);
assert.throws(() => validateCapture({ ok: true, data: { complete: true } }, { sheets: [{ data: [] }] }), /Sheet data is not a non-empty array/);
assert.throws(() => validateCapture({ ok: true, data: { complete: true } }, { sheets: [{ range: 'A1:A1', columns: ['c1'], truncated: true, data: [[1]] }] }), /Sheet object indicates truncated=true/);
assert.throws(() => validateCapture({ ok: true, data: { complete: true } }, { sheets: [{ range: 'A1:B2', columns: ['c1', 'c2'], data: [[1, 2], [3, 4]] }] }, { expectedRange: 'A1:C3' }), /Expected range A1:C3/);

// Range dimension derivation: A1:B2 requires 2 rows and 2 columns
assert.throws(() => validateCapture({ ok: true, data: { complete: true } }, { sheets: [{ range: 'A1:B2', columns: ['c1', 'c2'], data: [[1, 2]] }] }), /Row count mismatch for range A1:B2: expected 2 rows, got 1/);
assert.throws(() => validateCapture({ ok: true, data: { complete: true } }, { sheets: [{ range: 'A1:B2', columns: ['c1'], data: [[1, 2], [3, 4]] }] }), /Column count mismatch for range A1:B2: expected 2 columns, got 1/);
assert.throws(() => validateCapture({ ok: true, data: { complete: true } }, { sheets: [{ range: 'A1:B2', columns: ['c1', 'c2'], data: [[1], [3, 4]] }] }), /Row 0 width mismatch for range A1:B2/);

// Valid capture
assert.equal(validateCapture({ ok: true, data: { complete: true } }, { sheets: [{ range: 'A1:B1', columns: ['c1', 'c2'], data: [['a', 'b']] }] }), true);
console.log('  -> PASS: validateCapture 成功拦截缺失、complete=false、truncated=true、has_more=true、非数组行、多sheet与range不符');

// -------------------------------------------------------------
// Test 2: safeParseNum 严格精度与错误边界
// -------------------------------------------------------------
console.log('\nTest 2: 验证 safeParseNum 保留多位小数与 null 转换...');
assert.equal(safeParseNum(7916.195), 7916.195, '必须保留多位小数，不可被丢失精度');
assert.equal(safeParseNum('7916.195'), 7916.195);
assert.equal(safeParseNum('¥1,234.5678'), 1234.5678);
assert.equal(safeParseNum('45.67%'), 45.67);
assert.equal(safeParseNum(0), 0);
assert.equal(safeParseNum('0'), 0);
assert.equal(safeParseNum(''), null);
assert.equal(safeParseNum(null), null);
assert.equal(safeParseNum(undefined), null);
assert.equal(safeParseNum('-'), null);
assert.equal(safeParseNum('—'), null);
assert.equal(safeParseNum('/'), null);
assert.equal(safeParseNum('#DIV/0!'), null);
assert.equal(safeParseNum('#N/A'), null);
assert.equal(safeParseNum('#NAME?'), null);
assert.equal(safeParseNum('#VALUE!'), null);
console.log('  -> PASS: safeParseNum 正确保留高精度小数且将各类异常值/空字符映射为 null');

// -------------------------------------------------------------
// Test 3: strictRatio 0 分母与 0 消耗处理
// -------------------------------------------------------------
console.log('\nTest 3: 验证 strictRatio 算子（0分母为null，0消耗/正分母为0）...');
assert.equal(strictRatio(100, 20), 5);
assert.equal(strictRatio(0, 20), 0, '0 消耗在分母大于 0 时，单位成本必须为 0 而非 null');
assert.equal(strictRatio(100, 0), null, '分母为 0 时必须返回 null 而非 0 或异常');
assert.equal(strictRatio(0, 0), null, '0/0 必须返回 null');
assert.equal(strictRatio(null, 20), null, '分子为 null 必须返回 null');
assert.equal(strictRatio(100, null), null, '分母为 null 必须返回 null');
console.log('  -> PASS: strictRatio 严格满足业务比率契约');

// -------------------------------------------------------------
// Test 4: strictSum 严格求和规则 (任一必要项缺失返回 null)
// -------------------------------------------------------------
console.log('\nTest 4: 验证 strictSum 严格求和...');
assert.equal(strictSum([10, 20, 30.5]), 60.5);
assert.equal(strictSum([10, 0, 30]), 40, '显式 0 应正常计入');
assert.equal(strictSum([10, null, 30]), null, '任一必要值缺失时，strictSum 必须返回 null，绝不默认为 0');
assert.equal(strictSum([]), null);
console.log('  -> PASS: strictSum 确保缺失项不被篡改并维持强一致性');

// -------------------------------------------------------------
// Test 5: 真实 Parser 拦截重复日期 (Duplicate Dates Rejection)
// -------------------------------------------------------------
console.log('\nTest 5: 验证生产 parser 对真实输入重复日期的直接拒绝...');
const mockDeliveryWithDup = [
  ['时间', '求和项:消费', '求和项:展现量', '求和项:互动量', '求和项:小红星站外活跃UV(30日归因)'],
  ['46281', '100', '1000', '10', '5'],
  ['46281', '100', '1000', '10', '5']
];
assert.throws(() => parseWipesDelivery(mockDeliveryWithDup), /Duplicate date encountered/);

const mockCommerceWithDup = [
  ['时间', '求和项:消费', '商品访客量', '访客成本', '商品加购量', '加购成本', '求和项:7日总支付订单量', '订单成本', '求和项:7日总支付金额', 'ROI', '展现量', '点击量'],
  ['46230', '10', '5', '2', '1', '10', '1', '10', '20', '2', '100', '10'],
  ['46230', '10', '5', '2', '1', '10', '1', '10', '20', '2', '100', '10']
];
assert.throws(() => parseHuangCommerce(mockCommerceWithDup), /Duplicate date encountered/);
console.log('  -> PASS: 生产 parser 直接捕获并抛出重复日期异常');

// -------------------------------------------------------------
// Test 6: 淘搜未来残余公式行排除与显式 0 保留
// -------------------------------------------------------------
console.log('\nTest 6: 验证淘搜未来残余公式行排除与显式 0 保留...');
const mockTaosouRows = [
  ['总计', '10', '10', '10', '10', '10', '10', '60', '100', '0', '0', '0', '100'],
  ['日期', '稳健酒精湿巾', '稳健玉米酒精湿巾', '稳健酒精', '酒精湿巾稳健', '玉米酒精湿巾', '稳健消毒湿巾', '小计', 'K', 'F', 'S', 'CID', '小计'],
  ['46279', '10', '0', '0', '0', '0', '0', '10', '100', '0', '0', '0', '100'],
  ['46280', null, null, null, null, null, null, '0', null, null, null, null, '0']
];
const parsedTaosou = parseWipesTaosou(mockTaosouRows);
assert.equal(parsedTaosou.rows.length, 1, '公式残余 0 行必须被剔除');
assert.equal(parsedTaosou.rows[0].date, '2026-09-14');
assert.equal(parsedTaosou.rows[0].kw_corn_wipes, 0, '显式 0 必须保留为 0');
console.log('  -> PASS: 淘搜成功过滤残余公式空行，显式 0 得到保真留存');

// -------------------------------------------------------------
// Test 7: 生产 CID 合计比率同日重算，单渠道缺失时总指标必须为 null
// -------------------------------------------------------------
console.log('\nTest 7: 验证 CID 两渠道同日相加重算比率与单渠道缺失置 null...');
const mockCidRows = [];
for (let i = 0; i < 9; i++) mockCidRows.push(new Array(23).fill(null));
mockCidRows[9] = new Array(23).fill(null);
mockCidRows[9][12] = '时间';
mockCidRows[9][13] = '消耗';
mockCidRows[9][14] = 'CTR';
mockCidRows[9][15] = 'CPC';
mockCidRows[9][16] = 'CPM';
mockCidRows[9][17] = '订单量';
mockCidRows[9][18] = 'GMV';
mockCidRows[9][19] = 'ROI';
mockCidRows[9][20] = '进店量';
mockCidRows[9][21] = '进店成本';
mockCidRows[9][22] = '客单价';

mockCidRows.push(new Array(23).fill(null));
mockCidRows[10][12] = '46296'; // Simple day 1
mockCidRows[10][13] = '1000';
mockCidRows[10][17] = '50';
mockCidRows[10][18] = '3000';
mockCidRows[10][19] = '3';
mockCidRows[10][20] = '200';

mockCidRows.push(new Array(23).fill(null));
mockCidRows[11][0] = '时间';
mockCidRows[11][1] = '消耗';
mockCidRows[11][2] = 'CTR';
mockCidRows[11][3] = 'CPC';
mockCidRows[11][4] = 'CPM';
mockCidRows[11][5] = '订单量';
mockCidRows[11][6] = 'GMV';
mockCidRows[11][7] = 'ROI';
mockCidRows[11][8] = '进店量';
mockCidRows[11][9] = '进店成本';
mockCidRows[11][10] = '客单价';

mockCidRows.push(new Array(23).fill(null));
mockCidRows[12][0] = '46296'; // Standard day 1
mockCidRows[12][1] = '2000';
mockCidRows[12][5] = '50';
mockCidRows[12][6] = '2000';
mockCidRows[12][7] = '1';
mockCidRows[12][8] = '100';

// Day 2: Only Standard has data, Simple is completely missing on this date
mockCidRows.push(new Array(23).fill(null));
mockCidRows[13][0] = '46297'; // Standard day 2
mockCidRows[13][1] = '500';
mockCidRows[13][5] = '10';
mockCidRows[13][6] = '1000';
mockCidRows[13][8] = '50';

// Day 3: Both channels present, but Standard gmv is null
mockCidRows.push(new Array(23).fill(null));
mockCidRows[14][0] = '46298';
mockCidRows[14][1] = '300';
mockCidRows[14][6] = null; // missing GMV
mockCidRows[14][12] = '46298';
mockCidRows[14][13] = '400';
mockCidRows[14][18] = '800';

mockCidRows.push(new Array(23).fill(null));
mockCidRows[15][0] = '总计';
mockCidRows[15][1] = '2800';
mockCidRows[15][12] = '总计';
mockCidRows[15][13] = '1400';

const parsedCid = parseHuangCid(mockCidRows);
assert.equal(parsedCid.total.rows.length, 3);

// Day 1 verification: strict sum across both channels
const tot1 = parsedCid.total.rows[0];
assert.equal(tot1.spend, 3000);
assert.equal(tot1.gmv, 5000);
assert.equal(tot1.orders, 100);
assert.equal(tot1.uv, 300);
assert.equal(tot1.roi, 1.6667, '合计 ROI 必须由 5000 / 3000 严格重算，不可为 1 + 3 = 4');
assert.equal(tot1.cpuv, 10, '合计 CPUV 必须由 3000 / 300 严格重算');
assert.equal(tot1.aov, 50, '合计客单价必须由 5000 / 100 严格重算');

// Day 2 verification: Simple missing on day 2 -> total metric must be null!
const tot2 = parsedCid.total.rows[1];
assert.equal(tot2.spend, null, '单渠道缺失时，合计 spend 必须为 null，绝不默认为 0');
assert.equal(tot2.gmv, null, '单渠道缺失时，合计 gmv 必须为 null');
assert.equal(tot2.roi, null, '指标缺失时，合计 roi 必须为 null');

// Day 3 verification: Standard gmv is null -> total gmv must be null!
const tot3 = parsedCid.total.rows[2];
assert.equal(tot3.spend, 700);
assert.equal(tot3.gmv, null, '单项指标为 null 时，合计 gmv 必须为 null');
assert.equal(tot3.roi, null, 'gmv 为 null 时，合计 roi 必须为 null，绝不可兜底为 0');
console.log('  -> PASS: CID 合计比率同日基础值累加后重算，单渠道缺失/指标缺失时严格输出 null');

// -------------------------------------------------------------
// Test 8: 生产各类边界测试 (Spend 0, Error, Reconciliation)
// -------------------------------------------------------------
console.log('\nTest 8: 验证各边界（Spend 0、CPUV 0、ROI null、对账抛错断言）...');
// 8.1 Commerce: spend=0, gmv=0 -> ROI is null (not 0!)
const mockCommerceSpendZero = [
  ['时间', '求和项:消费', '商品访客量', '访客成本', '商品加购量', '加购成本', '求和项:7日总支付订单量', '订单成本', '求和项:7日总支付金额', 'ROI', '展现量', '点击量'],
  ['46230', '0', '10', '0', '0', '0', '0', '0', '0', '0', '100', '10'], // spend=0, uv=10, gmv=0
  ['总计', '0', '10', '0', '0', '0', '0', '0', '0', '0', '100', '10']
];
const parsedCommerceZero = parseHuangCommerce(mockCommerceSpendZero);
assert.equal(parsedCommerceZero.rows[0].spend, 0);
assert.equal(parsedCommerceZero.rows[0].uv, 10);
assert.equal(parsedCommerceZero.rows[0].cpuv, 0, 'spend=0 且 uv=10 时，CPUV 必须为 0 而非 null');
assert.equal(parsedCommerceZero.rows[0].roi, null, 'spend=0 时，分母为 0，ROI 必须严格为 null，不可兜底为 0');

// 8.2 Meiling CID: spend=0, gmv=10 -> ROI is null (not 0!)
const mockMeilingCidSpendZero = [
  ['时间', '消耗', '展现', '点击', ' ctr', ' cpc', ' cpm', ' 互动量', ' cpe', '求和项:行业商品成交订单量', '求和项:行业商品GMV', '求和:roi', '求和项:小红盟站外活跃行为UV(30日归因)'],
  ['46311', '0', '100', '10', '0.1', '0', '0', '1', '0', '1', '10', '#DIV/0!', '5'],
  ['总计', '0', '100', '10', '0.1', '0', '0', '1', '0', '1', '10', '#DIV/0!', '5']
];
const parsedMeilingZero = parseMeilingPivot(mockMeilingCidSpendZero, { isCid: true });
assert.equal(parsedMeilingZero.rows[0].spend, 0);
assert.equal(parsedMeilingZero.rows[0].gmv, 10);
assert.equal(parsedMeilingZero.rows[0].roi, null, '美菱 CID spend=0 时，ROI 必须为 null，绝不兜底为 0');

// 8.3 Delivery reconciliation mismatch assertion
const mockDeliveryBadTotal = [
  ['时间', '求和项:消费', '求和项:展现量', '求和项:互动量', '求和项:小红星站外活跃UV(30日归因)'],
  ['46281', '100', '1000', '10', '5'],
  ['总计', '999.99', '1000', '10', '5']
];
assert.throws(() => parseWipesDelivery(mockDeliveryBadTotal), /Spend total mismatch/);
console.log('  -> PASS: spend=0/uv>0返回0、spend=0返回ROI=null、对账不符主动抛错验证全部通过');

// -------------------------------------------------------------
// Test 9: 验证候选文件有效性与契约字段
// -------------------------------------------------------------
console.log('\nTest 9: 验证本地生成的 Candidate 候选文件与有效基线...');
const candidateReport = JSON.parse(
  fs.readFileSync(path.join(CANDIDATE_DIR, 'sync-report.json'), 'utf8')
);
assert.ok(candidateReport.evidence, '报告中必须存在各数据集的真实 evidence 证明');
assert.equal(candidateReport.evidence['wipes-taosou'].sourceSheetId, 'wY1HZO', 'wipes-taosou sheetId 必须为 wY1HZO');
assert.equal(candidateReport.evidence['huang-commerce'].sourceSheetId, 'Dz6eHe', 'huang-commerce sheetId 必须为 Dz6eHe');
assert.equal(candidateReport.evidence['huang-cid'].sourceSheetId, 'Nm3Sev', 'huang-cid sheetId 必须为 Nm3Sev');

const candidateMeiling = JSON.parse(
  fs.readFileSync(path.join(CANDIDATE_DIR, 'meiling.candidate.json'), 'utf8')
);
const jdSeed = candidateMeiling.dailyDatasets.find((d) => d.id === 'meiling-daily-jd-seed');
assert.ok(jdSeed.note.includes('小红盟'), '美菱京东种草 note 必须为小红盟而非小红星');
assert.equal(jdSeed.sourceSheetId, 'B5TBE7', '美菱京东种草 sheetId 必须为 B5TBE7');

const jdToitou = candidateMeiling.dailyDatasets.find((d) => d.id === 'meiling-daily-jd-toitou-seed');
assert.ok(jdToitou.note.includes('小红盟'), '美菱京东对投 note 必须为小红盟而非小红星');
assert.equal(jdToitou.sourceSheetId, 'TLLRoo', '美菱京东对投 sheetId 必须为 TLLRoo');

const candidateHuang = JSON.parse(
  fs.readFileSync(path.join(CANDIDATE_DIR, 'huang-tiane.candidate.json'), 'utf8')
);
const brandSummary = candidateHuang.tables.find((t) => t.id === 'huang-brand-summary');
const uvCol = brandSummary.columns.find((c) => c.key === 'uv');
assert.equal(uvCol.title, '站外活跃UV（30日归因加和）', 'UV 字段必须更正为站外活跃UV（30日归因加和）');

const brandBudget = candidateHuang.tables.find((t) => t.id === 'huang-brand-budget');
assert.equal(brandBudget.rows[0].reportedProgress, null, '异常 reportedProgress 必须置 null');
assert.equal(brandBudget.rows[0].calculatedProgress, 76.6009, '重算进度必须精确为 76.6009');

const commSummary = candidateHuang.tables.find((t) => t.id === 'huang-commerce-summary');
assert.equal(commSummary.rows[0].engagements, null, '商销总表中 engagements 必须严格置 null');

console.log('  -> PASS: 候选文件元数据证明、真实透视表路由、字段口径更正与基线全部校验通过');

console.log('\n=== ALL 9 PRODUCTION FIXTURE TESTS PASSED FLAWLESSLY! ===');
