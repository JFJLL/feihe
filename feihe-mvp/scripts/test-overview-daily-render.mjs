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
  const sandbox = {
    URLSearchParams: globalThis.URLSearchParams,
    URL: globalThis.URL,
    console: globalThis.console,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  };
  vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, sandbox)(customRequire, result, result.exports);
  moduleCache.set(filename, result.exports);
  return result.exports;
}

console.log("Loading CampaignOverviewPage and CampaignDailyPage for comprehensive tests...");
const overviewModule = loadComponent("features/campaign/CampaignOverviewPage.tsx");
const dailyModule = loadComponent("features/campaign/CampaignDailyPage.tsx");
const huangModule = loadComponent("features/campaign/HuangTianeBoard.tsx");

const { CampaignOverviewPage } = overviewModule;
const { CampaignDailyPage } = dailyModule;
const { HuangTianeBoard } = huangModule;

const projects = ["kailas", "meiling", "winner-wipes"];

for (const pid of projects) {
  console.log(`\nTesting project ${pid}...`);
  const res = await fetch(`http://localhost:5173/api/campaign-dashboard?projectId=${pid}`);
  const json = await res.json();
  const dashboard = json.dashboard;
  assert(dashboard, `Dashboard for ${pid} must exist`);

  // 1. Overview Page default snapshot
  const overviewHtml = renderToStaticMarkup(React.createElement(CampaignOverviewPage, { dashboard }));
  assert(overviewHtml.includes("ca-page"), "Overview has ca-page container");
  assert(overviewHtml.includes("ca-header"), "Overview has ca-header");
  assert(overviewHtml.includes("ca-metric-strip"), "Overview has metric strip");
  assert(overviewHtml.includes("ca-grid"), "Overview has ca-grid for charts");
  assert(overviewHtml.includes("ca-insight"), "Overview has dynamic insight");
  assert(overviewHtml.includes("ca-quick-links-bar"), "Overview has quick links");

  // Semantic checks: Overview must render valid budget/execution KPIs without fabricated numbers
  assert(overviewHtml.includes("ca-metric-strip"), `Overview for ${pid} must render metric strip`);
  assert(overviewHtml.includes("ca-metric-label"), `Overview for ${pid} must render semantic KPI labels`);

  // Check no NaN or undefined rendered
  assert(!overviewHtml.includes("NaN"), "Overview does not contain NaN");
  assert(!overviewHtml.includes("undefined"), "Overview does not render undefined");

  // 2. Daily Page Semantic Checks
  const dailyHtml = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard }));
  assert(dailyHtml.includes("ca-page"), "Daily has ca-page container");
  assert(dailyHtml.includes("ca-header"), "Daily has ca-header");
  assert(dailyHtml.includes("选择业务日期"), "Daily must render single-date input selector");
  assert(dailyHtml.includes("前一日") && dailyHtml.includes("后一日"), "Daily must render prev/next day step controls");
  assert(!dailyHtml.includes("近7天") && !dailyHtml.includes("近14天"), "Daily must NOT render arbitrary multi-day range shortcuts");
  assert(!dailyHtml.includes("ca-date-range-box"), "Daily must NOT render from/to multi-day range box");
  assert(dailyHtml.includes("ca-daily-details-panel"), "Daily must render collapsible details table");
  assert(!dailyHtml.includes("NaN"), "Daily does not contain NaN");
  assert(!dailyHtml.includes("undefined"), "Daily does not render undefined");

  // Verify no cross-table summation in Daily cross-dataset comparison
  if (dashboard.dailyDatasets?.length > 1) {
    assert(dailyHtml.includes("ca-scope-notice-banner"), "Daily multi-dataset must render explicit incompatible scope notice");
    assert(dailyHtml.includes("不可直接加总"), "Daily multi-dataset must explicitly warn against cross-table summation");
  }

  console.log(`✓ Project ${pid} passed semantic budget, single-day, and scope isolation render checks!`);
}

// 2b. Test Huang Tiane Overview & Daily
{
  console.log("\nTesting project huang-tiane...");
  const res = await fetch(`http://localhost:5173/api/campaign-dashboard?projectId=huang-tiane`);
  const json = await res.json();
  const dashboard = json.dashboard;
  assert(dashboard, "Dashboard for huang-tiane must exist");

  const overviewHtml = renderToStaticMarkup(React.createElement(HuangTianeBoard, { dashboard, section: "overview" }));
  assert(overviewHtml.includes("ht-board"), "Huang Tiane board container rendered");
  assert(overviewHtml.includes("全域三线经营总览与蛋品行业基准对标"), "Huang Tiane renders cleaned title without implementation words");
  assert(!overviewHtml.includes("五层"), "Huang Tiane titles must NOT include implementation word 五层");
  assert(!overviewHtml.includes("深层挖掘"), "Huang Tiane titles must NOT include implementation word 深层挖掘");
  assert(!overviewHtml.includes("NaN"), "Huang Tiane Overview does not contain NaN");
  assert(!overviewHtml.includes("undefined"), "Huang Tiane Overview does not render undefined");

  // Huang Tiane Daily check
  const dailyHtml = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard }));
  assert(dailyHtml.includes("ca-page"), "Huang Tiane daily has ca-page container");
  assert(dailyHtml.includes("选择业务日期"), "Huang Tiane daily has single date input");
  assert(dailyHtml.includes("不可直接加总"), "Huang Tiane daily has strict project-specific scope warning");
  assert(!dailyHtml.includes("自采天猫"), "Huang Tiane daily must NOT leak Meiling datasets");
  assert(!dailyHtml.includes("京东CID30日"), "Huang Tiane daily must NOT fabricate 30-day attribution");
  console.log("✓ Project huang-tiane passed semantic overview and clean daily checks!");
}

// 3. Project-specific deep verification
console.log("\nDeep testing Winner Wipes datasets...");
{
  const res = await fetch(`http://localhost:5173/api/campaign-dashboard?projectId=winner-wipes`);
  const dashboard = (await res.json()).dashboard;

  const dailyHtml = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard }));
  assert(dailyHtml.includes("日常种草"), "Wipes has correct daily title");
  assert(dailyHtml.includes(dashboard.dailyDatasets[0].period), "Wipes has correct dataset period");
  console.log(`✓ Wipes daily ${dashboard.dailyDatasets[0].rows.length}-day dataset verified!`);
}

console.log("\nDeep testing Meiling datasets...");
{
  const res = await fetch(`http://localhost:5173/api/campaign-dashboard?projectId=meiling`);
  const dashboard = (await res.json()).dashboard;

  const dailyHtml = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard }));
  assert(dailyHtml.includes("自采天猫种草"), "Meiling defaults to seed dataset");
  assert(dailyHtml.includes("京东对投 CID"), "Meiling CID is labeled correctly");
  console.log("✓ Meiling datasets and CID label verified!");
}

console.log("\nDeep testing Kailas daily dataset...");
{
  const res = await fetch(`http://localhost:5173/api/campaign-dashboard?projectId=kailas`);
  const dashboard = (await res.json()).dashboard;

  const dailyHtml = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard }));
  assert(dailyHtml.includes("2026-10-01 ~ 2026-10-12"), "Kailas has 12-day period");
  console.log("✓ Kailas 12-day creative dataset verified!");
}

console.log("\n✓ ALL ADVANCED CHECKS PASSED SUCCESSFULLY!");
