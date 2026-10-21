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
  let target = path.resolve(filename);
  if (!fs.existsSync(target) && !fs.existsSync(target + ".tsx") && !fs.existsSync(target + ".ts") && !fs.existsSync(target + ".json")) {
    const alt = path.resolve("feihe-mvp", filename);
    if (fs.existsSync(alt) || fs.existsSync(alt + ".tsx") || fs.existsSync(alt + ".ts") || fs.existsSync(alt + ".json")) {
      target = alt;
    }
  }
  filename = target;
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
  const sandbox = {
    URLSearchParams: globalThis.URLSearchParams,
    URL: globalThis.URL,
    console: globalThis.console,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  };
  vm.runInNewContext("(function(require, module, exports) { " + compiled + "\n})", sandbox)(customRequire, result, result.exports);
  moduleCache.set(filename, result.exports);
  return result.exports;
}

const modelModule = loadComponent("features/campaign/daily-selection-model.ts");
const {
  isValidIsoDate,
  subtractCalendarDays,
  addCalendarDays,
  computeDayOverDay,
  getSingleDayKPIs,
  getSingleDayDistributions,
  getCrossDatasetDailyComparison,
} = modelModule;

console.log("=== RUNNING SINGLE-DAY SELECTION MODEL & BEHAVIOR TESTS ===");

const wipeSample = { id: 'wipes-daily-delivery', label: 'wipes', period: '2026-10-19', metrics: [
  { key: 'spend', label: '消耗', unit: '元' }, { key: 'impressions', label: '展现', unit: '次' },
  { key: 'engagements', label: '互动', unit: '次' }, { key: 'uv', label: '站外活跃UV', unit: '人' },
  { key: 'cpe', label: 'CPE', unit: '元' }, { key: 'cpuv', label: 'CPUV', unit: '元' },
], rows: [{ date: '2026-10-19', spend: 100, impressions: 1000, engagements: 10, uv: 0, cpe: 10, cpuv: null }] };
const wipeKpis = getSingleDayKPIs(wipeSample, '2026-10-19');
assert.equal(wipeKpis.find(item => item.label === '站外活跃UV').value, '0');
assert.equal(wipeKpis.find(item => item.label === 'CPE').value, '10');
assert(!wipeKpis.some(item => /点击/.test(item.label)), 'Do not spend Wipes KPI slots on unavailable click metrics');
const wipeGroups = getSingleDayDistributions(wipeSample, '2026-10-19');
assert(wipeGroups.flatMap(group => group.items).some(item => item.key === 'uv' && item.formattedValue === '0 人'), 'A zero UV with undefined unit cost stays a recorded zero');

// 1. Date math & validations
console.log("\n[Test 1] Date validation & calendar arithmetic");
assert.equal(isValidIsoDate("2026-10-18"), true);
assert.equal(isValidIsoDate("2026-9-1"), false);
assert.equal(isValidIsoDate("invalid"), false);
assert.equal(subtractCalendarDays("2026-10-01", 1), "2026-09-30");
assert.equal(addCalendarDays("2026-09-30", 1), "2026-10-01");
console.log("✓ Date validation and leap-safe calendar arithmetic verified!");

// 2. Day-over-Day computation contract
console.log("\n[Test 2] Day-over-Day computation strictness");
{
  // Normal positive growth
  const dod1 = computeDayOverDay(120, 100, "元");
  assert.equal(dod1.diff, 20);
  assert.equal(dod1.pct, 20);
  assert.equal(dod1.trend, "up");
  assert(dod1.note.includes("+20% 较前日"));

  // Normal decline
  const dod2 = computeDayOverDay(80, 100, "元");
  assert.equal(dod2.diff, -20);
  assert.equal(dod2.pct, -20);
  assert.equal(dod2.trend, "down");
  assert(dod2.note.includes("-20% 较前日"));

  // Zero baseline (cannot divide by zero)
  const dod3 = computeDayOverDay(50, 0, "元");
  assert.equal(dod3.diff, 50);
  assert.equal(dod3.pct, null);
  assert(dod3.note.includes("基数0"));

  // Both zero
  const dod4 = computeDayOverDay(0, 0, "元");
  assert.equal(dod4.diff, 0);
  assert.equal(dod4.trend, "flat");
  assert(dod4.note.includes("持平"));

  // Previous day missing (strictly honest note)
  const dod5 = computeDayOverDay(100, null, "元");
  assert.equal(dod5.isComparable, false);
  assert.equal(dod5.note, "前日暂无流水");

  // Current day uncollected
  const dod6 = computeDayOverDay(null, 100, "元");
  assert.equal(dod6.isComparable, false);
  assert.equal(dod6.note, "当日未采集");
  console.log("✓ Day-over-Day computation edge cases passed!");
}

// 3. Composition vs Metric Comparison distinction
console.log("\n[Test 3] Distribution composition vs metric distinction");
{
  const mockTaosou = {
    id: "wipes-daily-taosou",
    label: "淘搜表现",
    period: "2026-10-01 ~ 2026-10-02",
    metrics: [],
    rows: [
      {
        date: "2026-10-02",
        spend_total: 1000,
        spend_f: 600,
        spend_s: 300,
        spend_k: 100,
        spend_cid: 0,
        kw_total_index: 200,
        kw_wipes: 120,
        kw_corn_wipes: 80,
      },
    ],
  };
  const dists = getSingleDayDistributions(mockTaosou, "2026-10-02");
  const channelDist = dists.find(d => d.id === "taosou-channel-dist");
  assert(channelDist, "Taosou channel dist exists");
  assert.equal(channelDist.isComposition, true, "Channel spend is a true composition");
  const totalShare = channelDist.items.reduce((acc, it) => acc + (it.sharePct || 0), 0);
  assert(Math.abs(totalShare - 100) < 0.2, "Channel shares sum to ~100%");

  const mockKailas = {
    id: "kailas-daily-fuga-creatives",
    label: "凯乐石日常投放",
    period: "2026-10-01 ~ 2026-10-02",
    metrics: [],
    rows: [
      {
        date: "2026-10-02",
        cpc: 0.76,
        cpe: 56.91,
        cpm: 65.07,
      },
    ],
  };
  const kailasDists = getSingleDayDistributions(mockKailas, "2026-10-02");
  const effDist = kailasDists.find(d => d.id === "kailas-eff-dist");
  assert(effDist, "Kailas efficiency group exists");
  assert.notEqual(effDist.isComposition, true, "Different metrics (CPC, CPE, CPM) MUST NOT be marked as composition");
  for (const it of effDist.items) {
    assert.equal(it.sharePct, undefined, "Different metrics must NOT have fake share percentages");
  }
  console.log("✓ Composition vs Metric distinction verified!");
}

// 4. Cross-dataset comparison: No Cross-table summation & explicit scope notice
console.log("\n[Test 4] Cross-dataset comparison scope isolation");
{
  const mockDatasets = [
    {
      id: "meiling-daily-tm-seed",
      label: "自采天猫种草",
      period: "2026-10-01 ~ 2026-10-18",
      metrics: [],
      rows: [{ date: "2026-10-18", spend: 6000, impressions: 70000, clicks: 8000, cpc: 0.75 }],
    },
    {
      id: "meiling-daily-cid-jd",
      label: "京东对投CID",
      period: "2026-10-16 ~ 2026-10-18",
      metrics: [],
      rows: [{ date: "2026-10-18", spend: 1300, gmv: 8000, clicks: 450, cpc: 2.88 }],
    },
    {
      id: "meiling-daily-jd-seed",
      label: "自采京东种草",
      period: "2026-09-01 ~ 2026-10-10",
      metrics: [],
      rows: [{ date: "2026-10-10", spend: 5000, impressions: 50000, clicks: 6000, cpc: 0.83 }],
    },
  ];

  const comp = getCrossDatasetDailyComparison(mockDatasets, "2026-10-18", "meiling");
  assert.equal(comp.hasMultiple, true);
  assert(comp.scopeNotice.includes("不可直接加总"), "Explicit warning that scopes cannot be summed");
  assert(comp.scopeNotice.includes("美菱自采天猫/京东种草"), "Project-specific scope notice without fabricated attribution days");

  // Verify each table row is separate with NO fabricated total
  assert.equal(comp.rows.length, 3);
  const tmRow = comp.rows.find(r => r.datasetId === "meiling-daily-tm-seed");
  assert.equal(tmRow.hasDataOnSelectedDate, true);
  assert.equal(tmRow.spend, "¥6,000");

  const jdSeedRow = comp.rows.find(r => r.datasetId === "meiling-daily-jd-seed");
  assert.equal(jdSeedRow.hasDataOnSelectedDate, false, "Dataset out of range on selected date is marked missing");
  console.log("✓ Cross-dataset comparison scope isolation passed!");
}

// 5. SSR & Component Contracts for CampaignDailyPage
console.log("\n[Test 5] SSR Component Contracts for CampaignDailyPage");
const dailyModule = loadComponent("features/campaign/CampaignDailyPage.tsx");
const { CampaignDailyPage } = dailyModule;

for (const pid of ["kailas", "meiling", "winner-wipes"]) {
  const res = await fetch("http://localhost:5173/api/campaign-dashboard?projectId=" + pid);
  const dashboard = (await res.json()).dashboard;
  const html = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard }));

  // Container & core regions
  assert(html.includes("ca-page"), pid + " has ca-page container");
  assert(html.includes("ca-header"), pid + " has ca-header");
  assert(html.includes("ca-daily-toolbar"), pid + " has single-day toolbar");
  assert(html.includes("ca-metric-strip"), pid + " has metric strip");
  assert(html.includes("ca-daily-grid"), pid + " has daily grid");
  assert(html.includes("ca-daily-details-panel"), pid + " has collapsible details table");

  // Single date controls
  assert(html.includes("选择业务日期"), pid + " has single date input");
  assert(html.includes("前一日"), pid + " has prev day button");
  assert(html.includes("后一日"), pid + " has next day button");

  // NO range picker shortcuts
  assert(!html.includes("近7天"), pid + " does NOT have multi-day range shortcut 近7天");
  assert(!html.includes("近14天"), pid + " does NOT have multi-day range shortcut 近14天");
  assert(!html.includes("ca-date-range-box"), pid + " does NOT have start~end range box");

  // CustomSelect used for dataset selection
  if (dashboard.dailyDatasets?.length > 1) {
    assert(html.includes("role=\"combobox\""), pid + " uses CustomSelect combobox for dataset selection");
  }

  // No NaN or undefined
  assert(!html.includes("NaN"), pid + " does NOT contain NaN");
  assert(!html.includes("undefined"), pid + " does NOT contain undefined");
}

// Empty state test: missing date shows no data, does NOT silently replace
{
  const res = await fetch("http://localhost:5173/api/campaign-dashboard?projectId=kailas");
  const dashboard = (await res.json()).dashboard;

  // Temporarily wipe rows to verify missing data behavior
  const emptyDashboard = {
    ...dashboard,
    dailyDatasets: [
      {
        ...dashboard.dailyDatasets[0],
        rows: [],
      },
    ],
  };
  const emptyHtml = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard: emptyDashboard }));
  assert(emptyHtml.includes("ca-daily-empty-box"), "Empty rows trigger honest empty box");
}

console.log("✓ SSR single-day contracts verified across all projects!");
console.log("\n=======================================================");
console.log("🎉 ALL SINGLE-DAY SELECTION TESTS PASSED (5/5)!");
console.log("=======================================================");
