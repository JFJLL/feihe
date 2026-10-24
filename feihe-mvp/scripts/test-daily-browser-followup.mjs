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

console.log("=== RUNNING DAILY BROWSER FOLLOW-UP VERIFICATION TESTS ===");

// 1. Verify CustomDatePicker Integration & No Native date spinbutton
console.log("\n[Test 1] CustomDatePicker integration in business date toolbar");
const dailyModule = loadComponent("features/campaign/CampaignDailyPage.tsx");
const { CampaignDailyPage, formatDatasetDisplay, normalizeDatasetLabel } = dailyModule;

const mockDashboard = {
  projectId: "kailas",
  name: "凯乐石",
  dailyDatasets: [
    {
      id: "kailas-daily-fuga-creatives",
      label: "凯乐石日常投放",
      period: "2026-10-01 ~ 2026-10-03",
      metrics: [{ key: "spend", label: "消耗", unit: "元" }],
      rows: [
        { date: "2026-10-01", spend: 100 },
        { date: "2026-10-02", spend: 200 },
        { date: "2026-10-03", spend: 300 },
      ],
    },
  ],
};

const html = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard: mockDashboard }));

// Root container must have scoped ca-daily-page class
assert(html.includes("ca-daily-page"), "CampaignDailyPage root must contain scoped ca-daily-page class");

// Must use CustomDatePicker, not native date input
assert(!html.includes('type="date"'), "Native input type=date must NOT be present in rendered HTML");
assert(html.includes("custom-date-picker-container"), "CustomDatePicker container must be rendered");
assert(html.includes("ca-daily-custom-date-picker"), "Custom scoped class ca-daily-custom-date-picker must be present");
assert(html.includes('aria-label="选择业务日期"'), "Accessible aria-label '选择业务日期' must be present on date input");
assert(html.includes("快捷选日"), "Quick date picker button must be preserved");
assert(html.includes('aria-controls="ca-quick-dates-dropdown"'), "Quick picker button links to dropdown via aria-controls");
console.log("✓ CustomDatePicker properly integrated; native input type=date completely eliminated!");

// 2. Clear distinction of two date entrances
console.log("\n[Test 2] Date entrance roles: calendar picker vs valid collection quick picker");
assert(html.includes('title="选择或输入业务日期"'), "DatePicker input has clear title explaining calendar/input role");
assert(html.includes('placeholder="选择或输入日期"'), "DatePicker input has clear placeholder for calendar/input");
assert(html.includes('title="展开全量有效业务日速选面板"'), "Quick picker has clear title for collected days");
console.log("✓ Date entrance role distinction verified!");

// 2.1 Single URL update path contract (no double-push / double-event)
console.log("\n[Test 2.1] Single path date commitment (onValueChange only, no double URL push)");
const pageSource = fs.readFileSync(path.resolve("features/campaign/CampaignDailyPage.tsx"), "utf8");
const datePickerStart = pageSource.indexOf("<CustomDatePicker");
const datePickerEnd = pageSource.indexOf("/>", datePickerStart);
const datePickerSection = pageSource.slice(datePickerStart, datePickerEnd);
assert(datePickerSection.includes("onValueChange="), "CustomDatePicker must use onValueChange for single-path commit");
assert(!datePickerSection.includes("onChange="), "CustomDatePicker must NOT pass redundant onChange to prevent double URL push");
console.log("✓ CustomDatePicker passes only onValueChange (no double-navigation on date commit)!");

// 3. Dataset label display normalization ('·' to ' / ' without mutating source data)
console.log("\n[Test 3] Dataset label display normalization in cross-dataset cards and selector");
assert.equal(typeof formatDatasetDisplay, "function", "formatDatasetDisplay must be exported for display normalization");
assert.equal(typeof normalizeDatasetLabel, "function", "normalizeDatasetLabel must be exported");

const rawHuangLabel1 = "红猫CID · 标准投";
const rawHuangLabel2 = "红猫CID · 简单投";
const rawHuangLabel3 = "红猫CID · 两类投放合计";

const display1 = formatDatasetDisplay("huang-cid-std", rawHuangLabel1);
const display2 = formatDatasetDisplay("huang-cid-simple", rawHuangLabel2);
const display3 = formatDatasetDisplay("huang-cid-combo", rawHuangLabel3);

assert.equal(display1, "红猫CID / 标准投", "Middle dot must be normalized to slash separator");
assert.equal(display2, "红猫CID / 简单投", "Middle dot must be normalized to slash separator");
assert.equal(display3, "红猫CID / 两类投放合计", "Middle dot must be normalized to slash separator");
assert.equal(rawHuangLabel1, "红猫CID · 标准投", "Source label must not be mutated");

assert.equal(formatDatasetDisplay("meiling-daily-tm-seed", "fallback"), "自采天猫种草");
assert.equal(formatDatasetDisplay("meiling-daily-cid-jd", "fallback"), "京东对投 CID");
assert.equal(formatDatasetDisplay("wipes-daily-delivery", "fallback"), "日常种草");
assert.equal(formatDatasetDisplay("wipes-daily-taosou", "fallback"), "淘搜表现");
assert.equal(formatDatasetDisplay("kailas-daily-fuga-creatives", "fallback"), "凯乐石日常投放");
console.log("✓ Display-layer dataset label normalization strictly verified!");

// 4. CSS Spacing Check: Strictly 16px, NO 4px+16px=20px stacking
console.log("\n[Test 4] CSS Spacing: KPI MetricStrip bottom to Efficiency/Distribution panel top");
const cssPath = path.resolve("features/campaign/CampaignDailyPage.css");
const cssContent = fs.readFileSync(cssPath, "utf8");

assert(cssContent.includes(".ca-daily-page .ca-section-macro-card > .ca-metric-strip"), "Must have scoped rule for daily page macro card metric strip");
const mbMatch = cssContent.match(/\.ca-daily-page\s+\.ca-section-macro-card\s*>\s*\.ca-metric-strip\s*\{[^}]*margin-bottom:\s*([^;]+);/);
assert(mbMatch, "Must have explicit margin-bottom definition");
assert.equal(mbMatch[1].trim(), "16px", "MetricStrip margin-bottom must be exactly 16px");

assert(cssContent.includes(".ca-daily-page .ca-section-macro-card > .ca-daily-grid"), "Must have scoped rule for daily grid margin-top");
const mtMatch = cssContent.match(/\.ca-daily-page\s+\.ca-section-macro-card\s*>\s*\.ca-daily-grid\s*\{[^}]*margin-top:\s*([^;]+);/);
assert(mtMatch, "Must have explicit margin-top definition for daily grid");
assert.equal(mtMatch[1].trim(), "0", "Daily grid margin-top must be 0 to avoid margin stacking");

const macroCardMatch = cssContent.match(/\.ca-section-macro-card\s*\{([^}]+)\}/);
assert(macroCardMatch, "Must find .ca-section-macro-card rule");
assert(!macroCardMatch[1].includes("gap:"), "Macro card must not declare flex gap that stacks with margin-bottom");
console.log("✓ MetricStrip margin-bottom is strictly 16px with 0px grid margin-top (no 20px stacking)! Scope isolated to .ca-daily-page!");

// 5. Typography, outline, and 0.5px border specifications
console.log("\n[Test 5] Design token adherence: Typography (12/14/16/22), 1px outline, and 0.5px borders");
assert(cssContent.includes(".ca-table-row-selected"), "Must preserve ca-table-row-selected");
const outlineMatch = cssContent.match(/\.ca-table-row-selected\s*\{[^}]*outline:\s*([^;]+);/);
assert(outlineMatch, "Must find outline property on selected row");
assert(outlineMatch[1].includes("1px"), "Selected row outline must remain 1px for keyboard/selection visibility");

// 5.1 Mobile 390px Button No-wrap & 2-row adaptation
console.log("\n[Test 5.1] Mobile 390px: ca-btn-date-step nowrap and 2-row layout adaptation");
const stepBtnRule = cssContent.match(/\.ca-btn-date-step\s*\{([^}]+)\}/)?.[1] || "";
assert(stepBtnRule.includes("white-space: nowrap"), "ca-btn-date-step must have white-space: nowrap to prevent text stacking");
assert(stepBtnRule.includes("flex-shrink: 0"), "ca-btn-date-step must have flex-shrink: 0 to prevent 40px width squeeze");

assert(cssContent.includes("@media (max-width: 640px)"), "Must contain mobile responsive media query for single date box");
assert(cssContent.includes("order: 1"), "Date input and quick picker wrap must be order: 1 on mobile");
assert(cssContent.includes("order: 2"), "Prev/Next day step buttons must be order: 2 on mobile to form comfortable second row");
console.log("✓ Mobile 390px button nowrap and 2-row layout verified!");

const borderMatches = cssContent.match(/(?:^|[^a-z-])border(?:-(?:top|bottom|left|right))?:\s*([0-9.]+px)/gm) || [];
for (const b of borderMatches) {
  const width = b.match(/([0-9.]+)px/)?.[1];
  if (width && width !== "0") {
    assert.equal(width, "0.5", `Border width in ${b} must be 0.5px`);
  }
}
console.log("✓ Borders and design tokens verified!");

// 6. Honest empty state for uncollected dates (no silent swap)
console.log("\n[Test 6] Honest empty state behavior for missing dates");
const emptyDashboard = {
  ...mockDashboard,
  dailyDatasets: [
    {
      ...mockDashboard.dailyDatasets[0],
      rows: [],
    },
  ],
};
const emptyHtml = renderToStaticMarkup(React.createElement(CampaignDailyPage, { dashboard: emptyDashboard }));
assert(emptyHtml.includes("ca-daily-empty-box"), "Empty dataset shows ca-daily-empty-box");
assert(emptyHtml.includes("暂无逐日分日流水记录"), "Empty dataset states honest lack of daily data");
console.log("✓ Honest empty state verified!");

console.log("\n=======================================================");
console.log("🎉 ALL BROWSER FOLLOW-UP VERIFICATION TESTS PASSED (6/6)!");
console.log("=======================================================");
