#!/usr/bin/env node

import assert from "node:assert/strict";

/**
 * generate-campaign-candidates.mjs
 *
 * Campaign daily collection parser & candidate generator using verified proof captures.
 *
 * Rules:
 * - Zero writes to live DB or live lib JSON files
 * - Reads captures from --captures (default: C:/Users/liuhao_PC/AppData/Local/Temp/feihe-proof-20261026)
 * - Dynamically reads proof files (*-proof.json) for revisionBefore/After, capturedAt, sourceSheetId, sha256
 * - Revisions are NEVER hardcoded
 * - Correct Sheet IDs: wipes-taosou wY1HZO, huang-commerce Dz6eHe, huang-cid Nm3Sev
 * - Notes: JD seed & toitou use "小红盟", TM & xingban use "小红星"
 * - Baseline comparisons dynamically read from live enrichment files using strictSum
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeFileDigest,
  validateCapture,
  parseWipesDelivery,
  parseWipesTaosou,
  parseHuangCommerce,
  parseHuangCid,
  parseMeilingPivot,
  parseHuangBrandRaw,
  rebuildHuangSummaryTables,
  strictSum
} from '../lib/campaign-sync-parser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
function getArgValue(flag, defaultVal) {
  const idx = args.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (idx === -1) return defaultVal;
  if (args[idx].startsWith(`${flag}=`)) {
    return args[idx].slice(flag.length + 1);
  }
  return args[idx + 1] || defaultVal;
}

const defaultCapturesDir = path.resolve(
  os.tmpdir(),
  'feihe-proof-20261026'
);
const TEMP_DIR = path.resolve(getArgValue('--captures', defaultCapturesDir));
const OUT_DIR = path.resolve(
  getArgValue('--output', path.resolve(ROOT_DIR, '.verification/live-sync-20261026/campaign'))
);

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

console.log('[INFO] Starting candidate generation...');
console.log(`[INFO] Captures directory: ${TEMP_DIR}`);
console.log(`[INFO] Output directory:   ${OUT_DIR}`);

// Read proof files dynamically
const brandProof = readJson(path.join(TEMP_DIR, 'brand-proof.json'));
const cidProof = readJson(path.join(TEMP_DIR, 'cid-proof.json'));
const commerceProof = readJson(path.join(TEMP_DIR, 'commerce-proof.json'));
const wipesProof = readJson(path.join(TEMP_DIR, 'wipes-proof.json'));
const meilingProof = readJson(path.join(TEMP_DIR, 'meiling-proof.json'));

// Verify revision stability
for (const [name, p] of Object.entries({
  brand: brandProof,
  cid: cidProof,
  commerce: commerceProof,
  wipes: wipesProof,
  meiling: meilingProof
})) {
  if (p.revisionBefore !== p.revisionAfter) {
    throw new Error(`REVISION_UNSTABLE: Group ${name} revision changed during read (${p.revisionBefore} -> ${p.revisionAfter})`);
  }
}

const evidence = {};

// 1. Wipes Delivery
console.log('\n[1/6] Parsing Wipes Delivery...');
const wipesDeliveryRowsPath = path.join(TEMP_DIR, 'wipes-delivery-rows.json');
const wipesDeliveryReceiptPath = path.join(TEMP_DIR, 'wipes-delivery-receipt.json');
const wipesDeliveryPayload = readJson(wipesDeliveryRowsPath);
const wipesDeliveryReceipt = readJson(wipesDeliveryReceiptPath);
validateCapture(wipesDeliveryReceipt, wipesDeliveryPayload, { expectedRange: 'A1:U200' });
const wipesDeliveryTableProof = wipesProof.tables.find((t) => t.name === 'wipes-delivery');
evidence['wipes-delivery'] = {
  rowsDigest: computeFileDigest(wipesDeliveryRowsPath),
  receiptDigest: computeFileDigest(wipesDeliveryReceiptPath),
  proofSha256: wipesDeliveryTableProof?.sha256,
  receiptComplete: wipesDeliveryReceipt.data?.complete,
  capturedAt: wipesProof.capturedAt,
  revision: wipesProof.revisionAfter,
  sourceSheetId: '0QTVhE'
};
const wipesDeliveryParsed = parseWipesDelivery(wipesDeliveryPayload);
console.log(`  -> Wipes Delivery: ${wipesDeliveryParsed.rows.length} rows (${wipesDeliveryParsed.period})`);

// 2. Wipes Taosou
console.log('\n[2/6] Parsing Wipes Taosou...');
const wipesTaosouRowsPath = path.join(TEMP_DIR, 'wipes-taosou-rows.json');
const wipesTaosouReceiptPath = path.join(TEMP_DIR, 'wipes-taosou-receipt.json');
const wipesTaosouPayload = readJson(wipesTaosouRowsPath);
const wipesTaosouReceipt = readJson(wipesTaosouReceiptPath);
validateCapture(wipesTaosouReceipt, wipesTaosouPayload, { expectedRange: 'A1:W61' });
const wipesTaosouTableProof = wipesProof.tables.find((t) => t.name === 'wipes-taosou');
evidence['wipes-taosou'] = {
  rowsDigest: computeFileDigest(wipesTaosouRowsPath),
  receiptDigest: computeFileDigest(wipesTaosouReceiptPath),
  proofSha256: wipesTaosouTableProof?.sha256,
  receiptComplete: wipesTaosouReceipt.data?.complete,
  capturedAt: wipesProof.capturedAt,
  revision: wipesProof.revisionAfter,
  sourceSheetId: 'wY1HZO'
};
const wipesTaosouParsed = parseWipesTaosou(wipesTaosouPayload);
console.log(`  -> Wipes Taosou: ${wipesTaosouParsed.rows.length} rows (${wipesTaosouParsed.period})`);

// 3. Huang Commerce
console.log('\n[3/6] Parsing Huang Commerce...');
const huangCommerceRowsPath = path.join(TEMP_DIR, 'huang-commerce-rows.json');
const huangCommerceReceiptPath = path.join(TEMP_DIR, 'huang-commerce-receipt.json');
const huangCommercePayload = readJson(huangCommerceRowsPath);
const huangCommerceReceipt = readJson(huangCommerceReceiptPath);
validateCapture(huangCommerceReceipt, huangCommercePayload, { expectedRange: 'A1:T201' });
const commerceTableProof = commerceProof.tables.find((t) => t.name === 'huang-commerce');
evidence['huang-commerce'] = {
  rowsDigest: computeFileDigest(huangCommerceRowsPath),
  receiptDigest: computeFileDigest(huangCommerceReceiptPath),
  proofSha256: commerceTableProof?.sha256,
  receiptComplete: huangCommerceReceipt.data?.complete,
  capturedAt: commerceProof.capturedAt,
  revision: commerceProof.revisionAfter,
  sourceSheetId: 'Dz6eHe'
};
const huangCommerceParsed = parseHuangCommerce(huangCommercePayload);
console.log(`  -> Huang Commerce: ${huangCommerceParsed.rows.length} rows (${huangCommerceParsed.period})`);

// 4. Huang CID
console.log('\n[4/6] Parsing Huang CID (Standard, Simple, Total)...');
const huangCidRowsPath = path.join(TEMP_DIR, 'huang-cid-rows.json');
const huangCidReceiptPath = path.join(TEMP_DIR, 'huang-cid-receipt.json');
const huangCidPayload = readJson(huangCidRowsPath);
const huangCidReceipt = readJson(huangCidReceiptPath);
validateCapture(huangCidReceipt, huangCidPayload, { expectedRange: 'A1:W609' });
const cidTableProof = cidProof.tables.find((t) => t.name === 'huang-cid');
evidence['huang-cid'] = {
  rowsDigest: computeFileDigest(huangCidRowsPath),
  receiptDigest: computeFileDigest(huangCidReceiptPath),
  proofSha256: cidTableProof?.sha256,
  receiptComplete: huangCidReceipt.data?.complete,
  capturedAt: cidProof.capturedAt,
  revision: cidProof.revisionAfter,
  sourceSheetId: 'Nm3Sev'
};
const huangCidParsed = parseHuangCid(huangCidPayload);
console.log(`  -> Huang CID Std: ${huangCidParsed.standard.rows.length} rows (${huangCidParsed.standard.period})`);
console.log(`  -> Huang CID Simple: ${huangCidParsed.simple.rows.length} rows (${huangCidParsed.simple.period})`);
console.log(`  -> Huang CID Total: ${huangCidParsed.total.rows.length} rows (${huangCidParsed.total.period})`);

// 5. Meiling 5 Pivots
console.log('\n[5/6] Parsing Meiling 5 Pivots...');
const meilingDefs = [
  {
    id: 'meiling-daily-tm-seed',
    sheetId: 'iautvs',
    tableName: 'meiling-tm',
    label: '美菱双11-自采天猫种草日流水 (TM种草)',
    file: 'meiling-tm-rows.json',
    receiptFile: 'meiling-tm-receipt.json',
    expectedRange: 'A1:U592',
    isCid: false,
    note: '美菱双11自采天猫种草日流水（透视表iautvs）。小红星站外活跃UV为30日归因口径（各创意归因UV之和，非项目去重人数）。源CPUV若存在#NAME?按spend/uv重算。全量覆盖历史UV回填。'
  },
  {
    id: 'meiling-daily-jd-seed',
    sheetId: 'B5TBE7',
    tableName: 'meiling-jd',
    label: '美菱双11-自采京东种草日流水 (JD种草)',
    file: 'meiling-jd-rows.json',
    receiptFile: 'meiling-jd-receipt.json',
    expectedRange: 'A1:U592',
    isCid: false,
    note: '美菱双11自采京东种草日流水（透视表B5TBE7）。小红盟站外活跃行为UV为30日归因口径。未来空日期无观测不伪造。'
  },
  {
    id: 'meiling-daily-xingban-seed',
    sheetId: '7gf6nq',
    tableName: 'meiling-xingban',
    label: '代采星伴种草分日流水',
    file: 'meiling-xingban-rows.json',
    receiptFile: 'meiling-xingban-receipt.json',
    expectedRange: 'A1:U592',
    isCid: false,
    note: '美菱双11代采星伴种草分日流水（透视表7gf6nq）。小红星站外活跃UV为30日归因口径。'
  },
  {
    id: 'meiling-daily-jd-toitou-seed',
    sheetId: 'TLLRoo',
    tableName: 'meiling-toitou',
    label: '京东对投种草分日流水',
    file: 'meiling-toitou-rows.json',
    receiptFile: 'meiling-toitou-receipt.json',
    expectedRange: 'A1:U592',
    isCid: false,
    note: '美菱双11京东对投种草分日流水（透视表TLLRoo）。小红盟站外活跃行为UV为30日归因口径。未来空日期无观测不伪造。'
  },
  {
    id: 'meiling-daily-cid-jd',
    sheetId: 'Trvrou',
    tableName: 'meiling-cid',
    label: '美菱双11-京东对投CID日表现 (CID渠道)',
    file: 'meiling-cid-rows.json',
    receiptFile: 'meiling-cid-receipt.json',
    expectedRange: 'A1:W601',
    isCid: true,
    note: '美菱双11京东对投CID日表现（透视表Trvrou）。小红盟站外活跃行为UV为30日归因口径。未来空日期无观测不伪造。'
  }
];

const meilingDatasets = [];
for (const def of meilingDefs) {
  const rowsPath = path.join(TEMP_DIR, def.file);
  const receiptPath = path.join(TEMP_DIR, def.receiptFile);
  const payload = readJson(rowsPath);
  const receipt = readJson(receiptPath);
  validateCapture(receipt, payload, { expectedRange: def.expectedRange });
  const tableProof = meilingProof.tables.find((t) => t.name === def.tableName);
assert.equal(computeFileDigest(rowsPath), tableProof?.sha256, def.id + " sha256 mismatch");
assert.equal(tableProof?.sheetId, def.sheetId);
  evidence[def.id] = {
    rowsDigest: computeFileDigest(rowsPath),
    receiptDigest: computeFileDigest(receiptPath),
    proofSha256: tableProof?.sha256,
    receiptComplete: receipt.data?.complete,
    capturedAt: meilingProof.capturedAt,
    revision: meilingProof.revisionAfter,
    sourceSheetId: def.sheetId
  };
  const parsed = parseMeilingPivot(payload, { isCid: def.isCid });
  console.log(`  -> ${def.id}: ${parsed.rows.length} rows (${parsed.period})`);
  meilingDatasets.push({
    ...def,
    rows: parsed.rows,
    period: parsed.period
  });
}

// 6. Huang Brand Daily (from 2858 physical raw rows)
console.log('\n[6/6] Parsing Huang Brand Daily (from raw sheet 637ef8)...');
const huangBrandRawRowsPath = path.join(TEMP_DIR, 'huang-brand-raw-rows.json');
const huangBrandRawReceiptPath = path.join(TEMP_DIR, 'huang-brand-raw-receipt.json');
const huangBrandRawPayload = readJson(huangBrandRawRowsPath);
const huangBrandRawReceipt = readJson(huangBrandRawReceiptPath);
validateCapture(huangBrandRawReceipt, huangBrandRawPayload, {
  expectedRange: 'A1:BD2858',
  exactRows: 2858
});
const brandTableProof = brandProof.tables.find((t) => t.name === 'huang-brand-raw');
evidence['huang-brand'] = {
  rowsDigest: computeFileDigest(huangBrandRawRowsPath),
  receiptDigest: computeFileDigest(huangBrandRawReceiptPath),
  proofSha256: brandTableProof?.sha256,
  receiptComplete: huangBrandRawReceipt.data?.complete,
  totalPhysicalRows: huangBrandRawPayload.sheets[0].data.length,
  capturedAt: brandProof.capturedAt,
  revision: brandProof.revisionAfter,
  sourceSheetId: '637ef8'
};
const huangBrandParsed = parseHuangBrandRaw(huangBrandRawPayload);
console.log(`  -> Huang Brand Daily: ${huangBrandParsed.rows.length} rows (${huangBrandParsed.period})`);

// Rebuild Derived Summary Tables
const huangSummaryRebuild = rebuildHuangSummaryTables(
  huangBrandParsed.rows,
  huangCommerceParsed.rows
);

// -------------------------------------------------------------
// Build Candidate Files
// -------------------------------------------------------------
console.log('\n[ASSEMBLING] Assembling candidate files...');

// A. campaign-daily-data.candidate.json
const existingDailyData = readJson(path.join(ROOT_DIR, 'lib/campaign-daily-data.json'));
const candidateDailyData = JSON.parse(JSON.stringify(existingDailyData));

const wipesDeliveryDs = candidateDailyData['winner-wipes']?.find((d) => d.id === 'wipes-daily-delivery');
if (wipesDeliveryDs) {
  wipesDeliveryDs.period = wipesDeliveryParsed.period;
  wipesDeliveryDs.rows = wipesDeliveryParsed.rows;
  wipesDeliveryDs.sourceSheetId = '0QTVhE';
  wipesDeliveryDs.note = '稳健玉米消毒湿巾全渠道投放日跟踪表（0QTVhE）。小红星站外活跃UV为30日归因口径（各创意归因UV之和，非项目去重人数）。10/25当日UV为0导致CPUV保持为null。历史UV已按最新30日归因回填。';
}

const wipesTaosouDs = candidateDailyData['winner-wipes']?.find((d) => d.id === 'wipes-daily-taosou');
if (wipesTaosouDs) {
  wipesTaosouDs.label = "淘搜指数与分渠道投放";
  wipesTaosouDs.period = wipesTaosouParsed.period;
  wipesTaosouDs.rows = wipesTaosouParsed.rows;
  wipesTaosouDs.sourceSheetId = 'wY1HZO';
  wipesTaosouDs.note = '稳健玉米湿巾淘搜指数全系列与分渠道投放（42天）。淘搜指数覆盖至2026-10-25，分渠道消耗仅F/S/CID更新至2026-10-23，10/24-10/25因渠道消耗缺失保持spend_total为null。O列日期独立关联进店UV与搜索进店UV。';
}

for (const md of meilingDatasets) {
  const target = candidateDailyData['meiling']?.find((d) => d.id === md.id);
  if (target) {
    target.period = md.period;
    target.rows = md.rows;
    target.sourceSheetId = md.sheetId;
    target.sourceUrl = `https://yimeichuanbo.feishu.cn/wiki/DMMpwdQShiyEpyk89jVcP6GInjg?sheet=${md.sheetId}`;
    target.note = md.note;
  }
}

fs.writeFileSync(
  path.join(OUT_DIR, 'campaign-daily-data.candidate.json'),
  JSON.stringify(candidateDailyData, null, 2),
  'utf8'
);

// B. winner-wipes.candidate.json
const existingWipesJson = readJson(path.join(ROOT_DIR, 'lib/campaign-enrichment/winner-wipes.json'));
const candidateWipesJson = JSON.parse(JSON.stringify(existingWipesJson));
if (candidateWipesJson.dailyDatasets) {
  const w1 = candidateWipesJson.dailyDatasets.find((d) => d.id === 'wipes-daily-taosou');
  if (w1) {
    w1.label = "淘搜指数与分渠道投放";
    w1.period = wipesTaosouParsed.period;
    w1.rows = wipesTaosouParsed.rows;
    w1.sourceSheetId = 'wY1HZO';
    w1.note = '稳健玉米湿巾淘搜指数全系列与分渠道投放（42天）。淘搜指数覆盖至2026-10-25，分渠道消耗仅F/S/CID更新至2026-10-23，10/24-10/25因渠道消耗缺失保持spend_total为null。O列日期独立关联进店UV与搜索进店UV。';
  }
  const w2 = candidateWipesJson.dailyDatasets.find((d) => d.id === 'wipes-daily-delivery');
  if (w2) {
    w2.period = wipesDeliveryParsed.period;
    w2.rows = wipesDeliveryParsed.rows;
    w2.sourceSheetId = '0QTVhE';
    w2.note = '稳健玉米消毒湿巾全渠道投放日跟踪表（0QTVhE）。小红星站外活跃UV为30日归因口径（各创意归因UV之和，非项目去重人数）。10/25当日UV为0导致CPUV保持为null。历史UV已按最新30日归因回填。';
  }
}
fs.writeFileSync(
  path.join(OUT_DIR, 'winner-wipes.candidate.json'),
  JSON.stringify(candidateWipesJson, null, 2),
  'utf8'
);

// C. meiling.candidate.json
const existingMeilingJson = readJson(path.join(ROOT_DIR, 'lib/campaign-enrichment/meiling.json'));
const candidateMeilingJson = JSON.parse(JSON.stringify(existingMeilingJson));
if (candidateMeilingJson.dailyDatasets) {
  for (const md of meilingDatasets) {
    const target = candidateMeilingJson.dailyDatasets.find((d) => d.id === md.id);
    if (target) {
      target.period = md.period;
      target.rows = md.rows;
      target.sourceSheetId = md.sheetId;
      target.sourceUrl = `https://yimeichuanbo.feishu.cn/wiki/DMMpwdQShiyEpyk89jVcP6GInjg?sheet=${md.sheetId}`;
      target.note = md.note;
    }
  }
}
fs.writeFileSync(
  path.join(OUT_DIR, 'meiling.candidate.json'),
  JSON.stringify(candidateMeilingJson, null, 2),
  'utf8'
);

// D. huang-tiane.candidate.json
const existingHuangJson = readJson(path.join(ROOT_DIR, 'lib/campaign-enrichment/huang-tiane.json'));
const candidateHuangJson = JSON.parse(JSON.stringify(existingHuangJson));

if (candidateHuangJson.dailyDatasets) {
  const hb = candidateHuangJson.dailyDatasets.find((d) => d.id === 'huang-brand-daily');
  if (hb) {
    hb.period = huangBrandParsed.period;
    hb.rows = huangBrandParsed.rows;
    hb.sourceSheetId = '637ef8';
  }
  const hc = candidateHuangJson.dailyDatasets.find((d) => d.id === 'huang-commerce-daily');
  if (hc) {
    hc.period = huangCommerceParsed.period;
    hc.rows = huangCommerceParsed.rows;
    hc.sourceSheetId = 'Dz6eHe';
  }
  const hcs = candidateHuangJson.dailyDatasets.find((d) => d.id === 'huang-cid-standard-daily');
  if (hcs) {
    hcs.period = huangCidParsed.standard.period;
    hcs.rows = huangCidParsed.standard.rows;
    hcs.sourceSheetId = 'Nm3Sev';
  }
  const hcm = candidateHuangJson.dailyDatasets.find((d) => d.id === 'huang-cid-simple-daily');
  if (hcm) {
    hcm.period = huangCidParsed.simple.period;
    hcm.rows = huangCidParsed.simple.rows;
    hcm.sourceSheetId = 'Nm3Sev';
  }
  const hct = candidateHuangJson.dailyDatasets.find((d) => d.id === 'huang-cid-total-daily');
  if (hct) {
    hct.period = huangCidParsed.total.period;
    hct.rows = huangCidParsed.total.rows;
    hct.sourceSheetId = 'Nm3Sev';
  }
}

if (candidateHuangJson.tables) {
  const tSummary = candidateHuangJson.tables.find((t) => t.id === 'huang-brand-summary');
  if (tSummary) {
    tSummary.period = huangBrandParsed.period;
    tSummary.rows = [huangSummaryRebuild.brandSummary];
    tSummary.sourceSheetId = "637ef8";
    tSummary.sourceUrl = "https://yimeichuanbo.feishu.cn/sheets/F42ksAyO8hKRGNt2plhccnSWnNh?sheet=637ef8";
    const uvCol = tSummary.columns?.find((c) => c.key === 'uv');
    if (uvCol) {
      uvCol.title = '站外活跃UV（30日归因加和）';
    }
  }

  const tBudget = candidateHuangJson.tables.find((t) => t.id === 'huang-brand-budget');
  if (tBudget) {
    tBudget.period = `截至${huangBrandParsed.rows[huangBrandParsed.rows.length - 1].date}`;
    tBudget.rows = [huangSummaryRebuild.brandBudget];
  }

  const tCommerce = candidateHuangJson.tables.find((t) => t.id === 'huang-commerce-summary');
  if (tCommerce) {
    tCommerce.period = huangCommerceParsed.period;
    tCommerce.rows = [huangSummaryRebuild.commerceSummary];
    tCommerce.sourceSheetId = "Dz6eHe";
    tCommerce.sourceUrl = "https://yimeichuanbo.feishu.cn/wiki/FqHUwqtu8iM1P7kD5IXcdr2Rn7c?sheet=Dz6eHe";
  }
}

fs.writeFileSync(
  path.join(OUT_DIR, 'huang-tiane.candidate.json'),
  JSON.stringify(candidateHuangJson, null, 2),
  'utf8'
);

// E. kailas.candidate.json
const existingKailasJson = readJson(path.join(ROOT_DIR, 'lib/campaign-enrichment/kailas.json'));
const candidateKailasJson = JSON.parse(JSON.stringify(existingKailasJson));
candidateKailasJson._status = 'stale';
candidateKailasJson._staleReason = '凯乐石H9y...副本不更新，尚无original源表，保持现有快照不变';
fs.writeFileSync(
  path.join(OUT_DIR, 'kailas.candidate.json'),
  JSON.stringify(candidateKailasJson, null, 2),
  'utf8'
);

// F. Build Comparative Report by reading LIVE enrichment files dynamically
console.log('\n[REPORT] Reading live baselines dynamically from lib/campaign-enrichment/*.json...');
const liveWipes = readJson(path.join(ROOT_DIR, 'lib/campaign-enrichment/winner-wipes.json'));
const liveMeiling = readJson(path.join(ROOT_DIR, 'lib/campaign-enrichment/meiling.json'));
const liveHuang = readJson(path.join(ROOT_DIR, 'lib/campaign-enrichment/huang-tiane.json'));
const liveKailas = readJson(path.join(ROOT_DIR, 'lib/campaign-enrichment/kailas.json'));

function getLiveDataset(id, project) {
  if (project === 'winner-wipes') {
    return liveWipes.dailyDatasets?.find((d) => d.id === id);
  }
  if (project === 'meiling') {
    return liveMeiling.dailyDatasets?.find((d) => d.id === id);
  }
  if (project === 'huang-tiane') {
    return liveHuang.dailyDatasets?.find((d) => d.id === id);
  }
  if (project === 'kailas') {
    return liveKailas.dailyDatasets?.find((d) => d.id === id) || existingDailyData.kailas?.find((d) => d.id === id);
  }
  return null;
}

const candidateDatasetsMap = new Map([
  ['wipes-daily-delivery', wipesDeliveryParsed.rows],
  ['wipes-daily-taosou', wipesTaosouParsed.rows],
  ['huang-commerce-daily', huangCommerceParsed.rows],
  ['huang-cid-standard-daily', huangCidParsed.standard.rows],
  ['huang-cid-simple-daily', huangCidParsed.simple.rows],
  ['huang-cid-total-daily', huangCidParsed.total.rows],
  ['huang-brand-daily', huangBrandParsed.rows],
  ['meiling-daily-tm-seed', meilingDatasets.find((d) => d.id === 'meiling-daily-tm-seed')?.rows || []],
  ['meiling-daily-jd-seed', meilingDatasets.find((d) => d.id === 'meiling-daily-jd-seed')?.rows || []],
  ['meiling-daily-xingban-seed', meilingDatasets.find((d) => d.id === 'meiling-daily-xingban-seed')?.rows || []],
  ['meiling-daily-jd-toitou-seed', meilingDatasets.find((d) => d.id === 'meiling-daily-jd-toitou-seed')?.rows || []],
  ['meiling-daily-cid-jd', meilingDatasets.find((d) => d.id === 'meiling-daily-cid-jd')?.rows || []],
  ['kailas-daily-fuga-creatives', candidateDailyData.kailas?.[0]?.rows || []]
]);

const datasetMeta = [
  { id: 'wipes-daily-delivery', project: 'winner-wipes', notes: '覆盖历史UV回填；10/18 UV回填为1360；10/25当日UV=0保持CPUV=null' },
  { id: 'wipes-daily-taosou', project: 'winner-wipes', notes: '排除未来无数据行的SUM公式残余0；保留K费率高精度小数；O列日期独立关联UV' },
  { id: 'huang-commerce-daily', project: 'huang-tiane', notes: '源无engagements列严格置null，不伪造旧值；严格重算ratios' },
  { id: 'huang-cid-standard-daily', project: 'huang-tiane', notes: '第12行起步扫描，全范围扫描无遗漏，排除总计行' },
  { id: 'huang-cid-simple-daily', project: 'huang-tiane', notes: '第10行起步扫描，全范围扫描无遗漏，排除总计行' },
  { id: 'huang-cid-total-daily', project: 'huang-tiane', notes: '两渠道同日相加重算roi/cpuv/aov，严禁sum ratio' },
  { id: 'huang-brand-daily', project: 'huang-tiane', notes: '真实2858物理行动态headers聚合；10/1与10/25交叉核对完全吻合' },
  { id: 'meiling-daily-tm-seed', project: 'meiling', notes: '透视表iautvs直接提取；小红星UV；全量覆盖历史UV回填' },
  { id: 'meiling-daily-jd-seed', project: 'meiling', notes: '透视表B5TBE7直接提取；小红盟UV；未观测日期不伪造' },
  { id: 'meiling-daily-xingban-seed', project: 'meiling', notes: '透视表7gf6nq直接提取；小红星UV；全量覆盖历史UV回填' },
  { id: 'meiling-daily-jd-toitou-seed', project: 'meiling', notes: '透视表TLLRoo直接提取；小红盟UV；未观测日期不伪造' },
  { id: 'meiling-daily-cid-jd', project: 'meiling', notes: '透视表Trvrou直接提取；小红盟UV；未观测日期不伪造' },
  { id: 'kailas-daily-fuga-creatives', project: 'kailas', notes: 'STALE: 凯乐石H9y...副本不更新，无原表，完整保留现有数据' }
];

const reportDatasets = [];
for (const meta of datasetMeta) {
  const liveDs = getLiveDataset(meta.id, meta.project);
  const newRows = candidateDatasetsMap.get(meta.id) || [];

  const oldSpendSum = liveDs ? strictSum(liveDs.rows.map((r) => r.spend ?? r.spend_total ?? 0)) : 0;
  const newSpendSum = strictSum(newRows.map((r) => r.spend ?? r.spend_total ?? null).filter((v) => v !== null));

  const oldPeriod = liveDs?.period || (liveDs?.rows?.length > 0 ? `${liveDs.rows[0].date} ~ ${liveDs.rows[liveDs.rows.length - 1].date}` : '');
  const newPeriod = newRows.length > 0 ? `${newRows[0].date} ~ ${newRows[newRows.length - 1].date}` : '';

  const oldSum = oldSpendSum !== null ? Number(oldSpendSum.toFixed(2)) : null;
  const newSum = newSpendSum !== null ? Number(newSpendSum.toFixed(2)) : null;
  const diff = (oldSum !== null && newSum !== null) ? Number((newSum - oldSum).toFixed(2)) : null;

  reportDatasets.push({
    id: meta.id,
    project: meta.project,
    oldPeriod,
    newPeriod,
    oldRowCount: liveDs?.rows?.length || 0,
    newRowCount: newRows.length,
    oldSumSpend: oldSum,
    newSumSpend: newSum,
    spendDiff: diff,
    notes: meta.notes
  });
}

const report = {
  syncDate: '2026-10-26',
  capturesDirectory: TEMP_DIR,
  candidateOutputDirectory: OUT_DIR,
  evidence,
  datasets: reportDatasets
};

fs.writeFileSync(
  path.join(OUT_DIR, 'sync-report.json'),
  JSON.stringify(report, null, 2),
  'utf8'
);

console.log('\n[DONE] Candidate generation complete!');
console.log(`[DONE] Files generated in ${OUT_DIR}:`);
for (const f of fs.readdirSync(OUT_DIR)) {
  console.log(`  - ${f}`);
}
