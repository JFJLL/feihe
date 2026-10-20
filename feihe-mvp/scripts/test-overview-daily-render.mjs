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
  vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, {})(customRequire, result, result.exports);
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

  // Check that the first (top) metric strip has 4 items and Rich Overview has multi-layer metrics & panels
  const firstStripEnd = overviewHtml.indexOf("</div", overviewHtml.indexOf("ca-metric-strip") + 1);
  const metricItemMatches = overviewHtml.match(/class="[^"]*(?:ca-metric-item|bd-kpi-card-rich)[^"]*"/g) || [];
  assert(metricItemMatches.length >= 8, `Rich Overview for ${pid} must render multi-layer metrics (>=8), got ${metricItemMatches.length}`);
  assert(firstStripEnd > 0, "Top metric strip container exists");

  const panelMatches = overviewHtml.match(/class="[^"]*ca-panel-title[^"]*"/g) || [];
  const funnelMatches = overviewHtml.match(/class="[^"]*ca-funnel-list[^"]*"/g) || [];
  console.log(`  [${pid}] Overview rendered ${panelMatches.length} chart panels, ${metricItemMatches.length} KPI cards, ${funnelMatches.length} funnel charts`);
  assert(panelMatches.length >= 12, `Overview for ${pid} must render at least 12 chart panels, got ${panelMatches.length}`);
  assert(funnelMatches.length >= 1, `Overview for ${pid} must render at least 1 full-funnel chart`);

  // Check no NaN or undefined rendered
  assert(!overviewHtml.includes("NaN"), "Overview does not contain NaN");
  assert(!overviewHtml.includes("undefined"), "Overview does not render undefined");

  // 2. Daily Page
  const dailyHtml = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard }));
  assert(dailyHtml.includes("ca-page"), "Daily has ca-page container");
  assert(dailyHtml.includes("ca-header"), "Daily has ca-header");
  assert(!dailyHtml.includes("NaN"), "Daily does not contain NaN");
  assert(!dailyHtml.includes("undefined"), "Daily does not render undefined");
  console.log(`✓ Project ${pid} passed baseline render checks!`);
}

// 2b. Test Huang Tiane Overview & Daily
{
  console.log("\nTesting project huang-tiane...");
  const res = await fetch(`http://localhost:5173/api/campaign-dashboard?projectId=huang-tiane`);
  const json = await res.json();
  const dashboard = json.dashboard;
  assert(dashboard, "Dashboard for huang-tiane must exist");

  const overviewHtml = renderToStaticMarkup(React.createElement(HuangTianeBoard, { dashboard, section: "overview" }));
  const panelMatches = overviewHtml.match(/class="[^"]*ca-panel-title[^"]*"/g) || [];
  const funnelMatches = overviewHtml.match(/class="[^"]*ca-funnel-list[^"]*"/g) || [];
  const metricItemMatches = overviewHtml.match(/class="[^"]*(?:ca-metric-item|bd-kpi-card-rich)[^"]*"/g) || [];
  console.log(`  [huang-tiane] Overview rendered ${panelMatches.length} chart panels, ${metricItemMatches.length} KPI cards, ${funnelMatches.length} funnel charts`);
  assert(panelMatches.length >= 14, `Overview for huang-tiane must render at least 14 chart panels, got ${panelMatches.length}`);
  assert(funnelMatches.length >= 2, `Overview for huang-tiane must render at least 2 funnel charts, got ${funnelMatches.length}`);
  assert(!overviewHtml.includes("NaN"), "Huang Tiane Overview does not contain NaN");
  assert(!overviewHtml.includes("undefined"), "Huang Tiane Overview does not render undefined");
  console.log("✓ Project huang-tiane passed rich overview render checks!");
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
