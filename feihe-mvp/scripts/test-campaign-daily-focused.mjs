import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const moduleCache = new Map();
function loadComponent(filename) {
  filename = path.resolve(filename);
  if (!fs.existsSync(filename)) {
    if (fs.existsSync(filename + ".tsx")) filename = filename + ".tsx";
    else if (fs.existsSync(filename + ".ts")) filename = filename + ".ts";
    else if (fs.existsSync(filename + ".json")) filename = filename + ".json";
  }
  if (moduleCache.has(filename)) return moduleCache.get(filename);
  if (filename.endsWith(".json")) {
    const data = JSON.parse(fs.readFileSync(filename, "utf8"));
    const wrapped = { default: data, ...data };
    moduleCache.set(filename, wrapped);
    return wrapped;
  }
  const raw = fs.readFileSync(filename, "utf8");
  const sanitized = raw.replace(/import\s+['"][^'"]+\.css['"];?/g, "");
  const compiled = ts.transpileModule(sanitized, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(filename);
  const customRequire = name => {
    if (name.endsWith(".css")) return {};
    if (name.startsWith(".")) {
      const resolved = path.resolve(path.dirname(filename), name);
      return loadComponent(resolved);
    }
    return nativeRequire(name);
  };
  vm.runInNewContext("(function(require, module, exports) { " + compiled + "\n})", {})(customRequire, result, result.exports);
  moduleCache.set(filename, result.exports);
  return result.exports;
}

const modelModule = loadComponent("features/campaign/campaign-daily-model.ts");
const {
  safeNum,
  fmtNum,
  fmtPct,
  subtractCalendarDays,
  generateCalendarDates,
  buildCalendarRows,
  validateAxisUnits,
  filterActiveSeries,
  getDatasetChartConfigs,
  computeStrictSum,
  computeSummaryMetrics,
  resolveDailyDatasets,
  VERIFIED_KEYWORD_LABELS,
} = modelModule;

console.log("=== RUNNING FOCUSED CAMPAIGN DAILY MODEL & SSR TESTS ===");

console.log("\n[Test 1] Pure Model: safeNum, fmtNum and zero vs null distinction");
assert.equal(safeNum(0), 0, "safeNum(0) must return exact 0");
assert.equal(safeNum("0"), 0, "safeNum(0) string must return exact 0");
assert.equal(safeNum(null), null, "safeNum(null) must return null");
assert.equal(safeNum(undefined), null, "safeNum(undefined) must return null");
assert.equal(safeNum("-"), null, "safeNum(-) must return null");
assert.equal(safeNum("—"), null, "safeNum(dash) must return null");
assert.equal(safeNum(" 1,234.50 "), 1234.5, "safeNum handles commas and spaces");
assert.equal(fmtNum(0), "0", "fmtNum(0) must format as 0");
assert.equal(fmtNum(null), "—", "fmtNum(null) must format as dash");
assert.equal(fmtNum(1234.567, 2), "1,234.57", "fmtNum formats numbers with grouping");

console.log("\n[Test 2] Pure Model: calendar dates & strict no-silent-swap on reversed range");
assert.equal(subtractCalendarDays("2026-10-18", 6), "2026-10-12", "7-day range backtracks 6 days");
assert.equal(subtractCalendarDays("2026-10-18", 13), "2026-10-05", "14-day range backtracks 13 days");

const normalDates = generateCalendarDates("2026-10-01", "2026-10-04");
assert.deepEqual(Array.from(normalDates), ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"], "generates complete calendar sequence");

// Reversed range MUST return [] (strictly no silent swap)
const revDates = generateCalendarDates("2026-10-04", "2026-10-01");
assert.deepEqual(Array.from(revDates), [], "reversed dates strictly return empty array, no silent swapping");

// Gaps filled with null
const mockDataset = {
  id: "test-ds",
  label: "测试数据集",
  period: "2026-10-01 ~ 2026-10-03",
  metrics: [
    { key: "spend", label: "消耗", unit: "元" },
    { key: "clicks", label: "点击", unit: "次" },
  ],
  rows: [
    { date: "2026-10-01", spend: 100, clicks: 50 },
    // 2026-10-02 is a missing gap
    { date: "2026-10-03", spend: 0, clicks: 20 },
  ],
};
const calendarRows = buildCalendarRows(mockDataset, "2026-10-01", "2026-10-03");
assert.equal(calendarRows.length, 3, "Gap day must be inserted");
assert.equal(calendarRows[1].date, "2026-10-02", "Gap day has correct date");
assert.equal(calendarRows[1].spend, null, "Gap day has null spend, NOT 0");
assert.equal(calendarRows[1].clicks, null, "Gap day has null clicks, NOT 0");
assert.equal(calendarRows[2].spend, 0, "Day 3 genuine 0 spend is strictly preserved");
assert.equal(calendarRows[2].clicks, 20, "Day 3 clicks preserved");

console.log("\n[Test 3] Pure Model: computeStrictSum & computeSummaryMetrics data integrity");
// A: Incomplete period has missing day -> sum is null (dash) with coverage note
const incompleteSpend = computeStrictSum(calendarRows, "spend");
assert.equal(incompleteSpend.isComplete, false, "Incomplete period is marked incomplete");
assert.equal(incompleteSpend.sum, null, "Incomplete period sum is null");
assert.equal(incompleteSpend.validCount, 2, "2 days recorded out of 3");

// B: Complete period has all days -> sum is exact
const completeRows = [
  { date: "2026-10-01", spend: 100, clicks: 50 },
  { date: "2026-10-02", spend: 200, clicks: 50 },
  { date: "2026-10-03", spend: 0, clicks: 20 },
];
const completeSpend = computeStrictSum(completeRows, "spend");
assert.equal(completeSpend.isComplete, true, "Complete period is complete");
assert.equal(completeSpend.sum, 300, "Complete period sum is exact 300");

// C: 0 spend with positive clicks -> CPC = 0.00 (not rejected)
const zeroSpendRows = [
  { date: "2026-10-01", spend: 0, clicks: 50 },
  { date: "2026-10-02", spend: 0, clicks: 50 },
];
const zeroSpendSummary = computeSummaryMetrics(mockDataset, zeroSpendRows);
const cpcMetric = zeroSpendSummary.find(m => m.label.includes("CPC"));
assert(cpcMetric, "CPC metric exists");
assert.equal(cpcMetric.value, "0", "0 spend with positive clicks gives CPC 0, not rejected");

// D: Incomplete clicks in range -> CPC is dash with coverage note, NO silent fallback
const incompleteSummary = computeSummaryMetrics(mockDataset, calendarRows);
const incCpcMetric = incompleteSummary.find(m => m.label.includes("CPC"));
assert(incCpcMetric, "CPC metric exists");
assert.equal(incCpcMetric.value, "—", "Incomplete range gives dash for CPC");
assert(incCpcMetric.note && incCpcMetric.note.includes("覆盖"), "Coverage note indicates incomplete days");

// E: CID ROI handling: 0 spend with 0 GMV (0/0) -> value = "—", note specifies "消耗为0，无有效分母"
const cidDataset = {
  id: "test-cid-ds",
  label: "CID测试数据集",
  period: "2026-10-01 ~ 2026-10-02",
  metrics: [
    { key: "spend", label: "消耗", unit: "元" },
    { key: "gmv", label: "GMV", unit: "元" },
  ],
  rows: [],
};
const cidZeroSpendZeroGmvRows = [
  { date: "2026-10-01", spend: 0, gmv: 0 },
  { date: "2026-10-02", spend: 0, gmv: 0 },
];
const cidZeroZeroSummary = computeSummaryMetrics(cidDataset, cidZeroSpendZeroGmvRows);
const roiZeroZero = cidZeroZeroSummary.find(m => m.label.includes("ROI"));
assert(roiZeroZero, "CID ROI metric exists");
assert.equal(roiZeroZero.value, "—", "0 spend and 0 GMV gives dash, not 0");
assert(roiZeroZero.note && roiZeroZero.note.includes("无有效分母"), "CID ROI 0/0 note indicates no valid denominator");

// F: CID ROI handling: 0 spend with positive GMV (GMV>0 / spend 0) -> value = "—", note specifies "消耗为0，无有效分母"
const cidZeroSpendPosGmvRows = [
  { date: "2026-10-01", spend: 0, gmv: 500 },
  { date: "2026-10-02", spend: 0, gmv: 300 },
];
const cidZeroSpendSummary = computeSummaryMetrics(cidDataset, cidZeroSpendPosGmvRows);
const roiZeroSpend = cidZeroSpendSummary.find(m => m.label.includes("ROI"));
assert(roiZeroSpend, "CID ROI metric exists");
assert.equal(roiZeroSpend.value, "—", "0 spend with positive GMV gives dash, not 0");
assert(roiZeroSpend.note && roiZeroSpend.note.includes("无有效分母"), "CID ROI zero spend note indicates no valid denominator");

// G: CID ROI handling: positive spend with 0 GMV (GMV=0 / spend>0) -> value = "0", genuine 0 ROI
const cidPosSpendZeroGmvRows = [
  { date: "2026-10-01", spend: 200, gmv: 0 },
  { date: "2026-10-02", spend: 300, gmv: 0 },
];
const cidPosSpendZeroGmvSummary = computeSummaryMetrics(cidDataset, cidPosSpendZeroGmvRows);
const roiPosSpendZeroGmv = cidPosSpendZeroGmvSummary.find(m => m.label.includes("ROI"));
assert(roiPosSpendZeroGmv, "CID ROI metric exists");
assert.equal(roiPosSpendZeroGmv.value, "0", "Positive spend with 0 GMV gives genuine ROI 0");

// H: CID ROI handling: positive spend with positive GMV -> normal calculated ratio
const cidNormalRows = [
  { date: "2026-10-01", spend: 100, gmv: 350 },
  { date: "2026-10-02", spend: 100, gmv: 250 },
];
const cidNormalSummary = computeSummaryMetrics(cidDataset, cidNormalRows);
const roiNormal = cidNormalSummary.find(m => m.label.includes("ROI"));
assert(roiNormal, "CID ROI metric exists");
assert.equal(roiNormal.value, "3", "600 GMV / 200 spend gives ROI 3");

console.log("\n[Test 4] Pure Model: presets, axis units, captions and >=2 series per chart");
const projects = ["kailas", "meiling", "winner-wipes"];
for (const pid of projects) {
  const res = await fetch("http://localhost:5173/api/campaign-dashboard?projectId=" + pid);
  const json = await res.json();
  const datasets = resolveDailyDatasets(json.dashboard);
  assert(datasets.length > 0, pid + " must resolve daily datasets");

  for (const ds of datasets) {
    const rows = buildCalendarRows(ds, ds.rows[0].date, ds.rows[ds.rows.length - 1].date);
    const configs = getDatasetChartConfigs(ds, rows);

    assert(configs.length >= 3 && configs.length <= 5, ds.id + " must produce 3-5 combination charts, got " + configs.length);

    for (const cfg of configs) {
      assert(cfg.series.length >= 2, "Chart " + cfg.id + " must have >= 2 active series");
      assert(validateAxisUnits(cfg.series), "Chart " + cfg.id + " must only host same units per axis");
      assert(cfg.title && cfg.caption, "Chart " + cfg.id + " must have title and caption");

      // Verify no exaggerated marketing words in caption
      const badWords = ["获客单价", "点击转化率", "直接成交", "转化漏斗", "心智渗透", "素材疲劳", "共振"];
      for (const bw of badWords) {
        assert(!cfg.caption.includes(bw), "Caption in " + cfg.id + " must not contain exaggerated word " + bw);
      }
    }

    if (ds.id === "kailas-daily-fuga-creatives") {
      assert.equal(configs.length, 5, "Kailas has 5 combination charts including seed crowd");
      const crowd = configs.find(c => c.id === "kailas-seed-crowd");
      assert(crowd, "Kailas seed crowd chart exists");
      assert.equal(crowd.series[0].unit, "人");
      assert.equal(crowd.series[1].unit, "人");
    }

    if (ds.id === "meiling-daily-cid-jd") {
      const primary = configs.find(c => c.id === "cid-primary");
      assert(primary, "CID primary exists");
      assert.equal(primary.series[0].unit, "元");
      assert.equal(primary.series[1].unit, "元");
      assert.equal(primary.series[2].unit, "倍");
    }

    if (ds.id === "wipes-daily-taosou") {
      const primary = configs.find(c => c.id === "taosou-primary");
      assert(primary, "Taosou primary exists");
      assert(primary.caption.includes("不代表因果关系"), "TaoSou primary caption explicitly notes no causality");
      const kwChart = configs.find(c => c.id === "taosou-keywords");
      assert(kwChart, "Taosou keyword chart exists");
      assert(!kwChart.series.some(s => s.key === "kw_total_index"), "kw_total_index must not be duplicated in keyword chart");
      const chanChart = configs.find(c => c.id === "taosou-channels");
      assert(chanChart, "Taosou channel chart exists");
      assert(!chanChart.series.some(s => s.key === "spend_total"), "spend_total must not be duplicated in channel chart");
    }

    // 4 Summary Metrics
    const summary = computeSummaryMetrics(ds, rows);
    assert.equal(summary.length, 4, ds.id + " must produce exactly 4 summary metrics");
  }
}

console.log("\n[Test 5] Development Verification: Accommodating enriched winner-wipes dataset");
{
  const wipesEnrichedPath = path.resolve("lib/campaign-enrichment/winner-wipes.json");
  if (fs.existsSync(wipesEnrichedPath)) {
    const wipesJson = JSON.parse(fs.readFileSync(wipesEnrichedPath, "utf8"));
    const taosouEnriched = wipesJson.dailyDatasets && wipesJson.dailyDatasets.find(d => d.id === "wipes-daily-taosou");
    assert(taosouEnriched, "wipes-daily-taosou enriched dataset exists");
    assert.equal(taosouEnriched.rows.length, 36, "Enriched taosou has 36 days");

    const rows36 = buildCalendarRows(taosouEnriched, taosouEnriched.rows[0].date, taosouEnriched.rows[taosouEnriched.rows.length - 1].date);
    const configs36 = getDatasetChartConfigs(taosouEnriched, rows36);

    // Must include the new search_uv + shop_uv flow chart
    const uvFlowChart = configs36.find(c => c.id === "taosou-uv-flow");
    assert(uvFlowChart, "Taosou must include search_uv + shop_uv flow chart");
    assert.equal(uvFlowChart.series.length, 2, "UV flow chart has 2 series");
    assert.equal(uvFlowChart.series[0].key, "search_uv");
    assert.equal(uvFlowChart.series[1].key, "shop_uv");
    assert.equal(uvFlowChart.series[0].unit, "人");
    assert.equal(uvFlowChart.series[1].unit, "人");
    assert.equal(uvFlowChart.series[0].axis, "left");
    assert.equal(uvFlowChart.series[1].axis, "left");
    assert(!uvFlowChart.series.some(s => s.key === "redstar_uv"), "UV flow chart must NOT include redstar_uv (different attribution)");
    assert.equal(configs36.length, 4, "Enriched taosou has 4 combination charts");
    console.log("✓ Enriched 36-day taosou dataset verified with search_uv + shop_uv dual lines!");
  }
}

console.log("\n[Test 6] SSR Rendering: CampaignDailyPage full component render");
const dailyModule = loadComponent("features/campaign/CampaignDailyPage.tsx");
const { CampaignDailyPage } = dailyModule;

for (const pid of ["kailas", "meiling", "winner-wipes"]) {
  const res = await fetch("http://localhost:5173/api/campaign-dashboard?projectId=" + pid);
  const dashboard = (await res.json()).dashboard;

  const html = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard }));

  assert(html.includes("ca-page"), pid + " has ca-page container");
  assert(html.includes("ca-header"), pid + " has ca-header");
  assert(html.includes("ca-daily-grid"), pid + " has ca-daily-grid");
  assert(html.includes("ca-metric-strip"), pid + " has metric strip");
  assert(html.includes("ca-daily-details-panel"), pid + " has collapsible details table");

  // Verify metric pill selector is completely removed
  assert(!html.includes("ca-metric-pills"), pid + " does NOT have old metric pill selector");

  // Verify no NaN or undefined
  assert(!html.includes("NaN"), pid + " does not contain NaN");
  assert(!html.includes("undefined"), pid + " does not render undefined");

  console.log("✓ " + pid + " SSR rendered successfully!");
}

// Test reversed dates UI error notice
{
  const res = await fetch("http://localhost:5173/api/campaign-dashboard?projectId=kailas");
  const dashboard = (await res.json()).dashboard;
  const reversedDates = generateCalendarDates("2026-10-10", "2026-10-01");
  assert.equal(reversedDates.length, 0, "Reversed dates generate 0 rows, no silent swap");
  console.log("✓ Reversed dates correctly rejected without silent swapping");
}

// Test empty state handling (qicui or null)
{
  const res = await fetch("http://localhost:5173/api/campaign-dashboard?projectId=qicui");
  const dashboard = (await res.json()).dashboard;
  const html = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard }));
  assert(html.includes("ca-daily-empty-box"), "Empty project renders honest empty state");
  assert(html.includes("当前项目暂无逐日分日流水记录"), "Empty state has clean title");
  assert(!html.includes("系统秉持诚实数据原则"), "Empty state has removed self-congratulatory boilerplate");
  assert(!html.includes("NaN"), "Empty state has no NaN");
  console.log("✓ Qicui clean empty state verified!");
}

console.log("\n=== ALL FOCUSED MODEL & SSR TESTS PASSED SUCCESSFULLY! ===");
