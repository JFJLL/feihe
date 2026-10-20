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

const { CampaignOverviewPage } = overviewModule;
const { CampaignDailyPage } = dailyModule;

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

  // Check that exactly 4 metric items are rendered in metric strip
  const metricItemMatches = overviewHtml.match(/class="ca-metric-item"/g) || [];
  assert.equal(metricItemMatches.length, 4, `Overview must render exactly 4 compact metrics, got ${metricItemMatches.length}`);

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

// 3. Project-specific deep verification
console.log("\nDeep testing Winner Wipes datasets...");
{
  const res = await fetch(`http://localhost:5173/api/campaign-dashboard?projectId=winner-wipes`);
  const dashboard = (await res.json()).dashboard;

  const dailyHtml = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard }));
  assert(dailyHtml.includes("稳健玉米湿巾投放日趋势"), "Wipes has correct daily title");
  assert(dailyHtml.includes("2026-09-16 ~ 2026-10-18"), "Wipes has correct 33-day period");
  console.log("✓ Wipes daily 33-day dataset verified!");
}

console.log("\nDeep testing Meiling datasets...");
{
  const res = await fetch(`http://localhost:5173/api/campaign-dashboard?projectId=meiling`);
  const dashboard = (await res.json()).dashboard;

  const dailyHtml = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard }));
  assert(dailyHtml.includes("自采天猫种草日流水 (19天 · 推荐)"), "Meiling defaults to longer seed dataset");
  assert(dailyHtml.includes("京东对投CID日表现 (3天 · 30日归因 · 单子渠道)"), "Meiling CID is labeled with 30-day attribution and single channel");
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
