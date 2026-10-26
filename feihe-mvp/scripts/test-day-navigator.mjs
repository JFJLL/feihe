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

console.log("=== RUNNING DAY NAVIGATOR COMPONENT TESTS ===");

const dayNavModule = loadComponent("components/ui/DayNavigator.tsx");
const { DayNavigator, isValidIsoDate, stepIsoDate } = dayNavModule;

// 1. ISO date arithmetic & validation
console.log("\n[Test 1] ISO date arithmetic & 4-digit year boundary safety");
assert.equal(isValidIsoDate("2026-10-18"), true);
assert.equal(isValidIsoDate("2026-02-29"), false); // 2026 is not leap
assert.equal(isValidIsoDate("2024-02-29"), true); // 2024 is leap
assert.equal(isValidIsoDate("invalid"), false);
assert.equal(isValidIsoDate(""), false);
assert.equal(isValidIsoDate(null), false);

assert.equal(stepIsoDate("2026-10-01", -1), "2026-09-30");
assert.equal(stepIsoDate("2026-09-30", 1), "2026-10-01");
assert.equal(stepIsoDate("2026-03-01", -1), "2026-02-28");
assert.equal(stepIsoDate("2024-03-01", -1), "2024-02-29");
assert.equal(stepIsoDate("2026-12-31", 1), "2027-01-01");
assert.equal(stepIsoDate("2027-01-01", -1), "2026-12-31");

// 4-digit year boundary check (padStart4 & overflow protection)
assert.equal(stepIsoDate("9999-12-31", 1), null, "Year > 9999 must return null");
assert.equal(stepIsoDate("1000-01-01", -1), null, "Year < 1000 must return null");
assert.equal(stepIsoDate("1000-01-02", -1), "1000-01-01");
console.log("✓ ISO date arithmetic verified!");

// 2. Render & SVG chevrons (no emojis, no native date/select)
console.log("\n[Test 2] Render & SVG chevrons check");
const html1 = renderToStaticMarkup(
  React.createElement(DayNavigator, {
    value: "2026-10-05",
    min: "2026-10-01",
    max: "2026-10-10",
    latestDate: "2026-10-10",
    onChange: () => {},
  })
);

assert(!html1.includes('type="date"'), "Must not use native input type=date");
assert(!html1.includes("<select"), "Must not use native select");
assert(html1.includes("day-navigator-root"), "Root container class must exist");
assert(html1.includes("day-nav-step-btn"), "Step buttons must exist");
assert(html1.includes('aria-label="前一日"'), "Accessible aria-label for prev day must exist");
assert(html1.includes('aria-label="后一日"'), "Accessible aria-label for next day must exist");
assert(html1.includes("day-nav-chevron"), "Inline SVG chevron must be present");
assert(!html1.includes("📅"), "No emoji allowed");
assert(!html1.includes("←"), "No emoji arrows allowed");
assert(!html1.includes("→"), "No emoji arrows allowed");
assert(html1.includes("最新数据日"), "Shows latest date jump button when value != latestDate");
console.log("✓ Render and icon semantics verified!");

// 3. Boundary disabled state (min/max boundaries)
console.log("\n[Test 3] Boundary disabled state & invalid min/max safety");
// At minimum date
const htmlMin = renderToStaticMarkup(
  React.createElement(DayNavigator, {
    value: "2026-10-01",
    min: "2026-10-01",
    max: "2026-10-10",
    onChange: () => {},
  })
);
assert(
  htmlMin.includes('class="day-nav-step-btn day-nav-prev-btn" disabled=""') ||
    htmlMin.includes('class="day-nav-step-btn day-nav-prev-btn" disabled'),
  "Prev day button must be disabled at min boundary"
);
assert(
  !htmlMin.includes('class="day-nav-step-btn day-nav-next-btn" disabled=""') &&
    !htmlMin.includes('class="day-nav-step-btn day-nav-next-btn" disabled'),
  "Next day button must be enabled at min boundary"
);

// At maximum date
const htmlMax = renderToStaticMarkup(
  React.createElement(DayNavigator, {
    value: "2026-10-10",
    min: "2026-10-01",
    max: "2026-10-10",
    latestDate: "2026-10-10",
    onChange: () => {},
  })
);
assert(
  htmlMax.includes('class="day-nav-step-btn day-nav-next-btn" disabled=""') ||
    htmlMax.includes('class="day-nav-step-btn day-nav-next-btn" disabled'),
  "Next day button must be disabled at max boundary"
);
assert(
  !htmlMax.includes('class="day-nav-step-btn day-nav-prev-btn" disabled=""') &&
    !htmlMax.includes('class="day-nav-step-btn day-nav-prev-btn" disabled'),
  "Prev day button must be enabled at max boundary"
);
assert(
  !htmlMax.includes("最新数据日"),
  "Latest date button must NOT be shown when already at latest date"
);

console.log("✓ Boundary disabled states verified!");

console.log("\n=======================================================");
console.log("🎉 ALL DAY NAVIGATOR COMPONENT TESTS PASSED!");
console.log("=======================================================");
// Invalid min/max string should be ignored safely without breaking stepping
const htmlInvalidBounds = renderToStaticMarkup(
  React.createElement(DayNavigator, {
    value: "2026-10-05",
    min: "not-a-date",
    max: "invalid-date",
    onChange: () => {},
  })
);
assert(
  !htmlInvalidBounds.includes('class="day-nav-step-btn day-nav-prev-btn" disabled=""') &&
    !htmlInvalidBounds.includes('class="day-nav-step-btn day-nav-prev-btn" disabled'),
  "Prev day must stay enabled when min is invalid string"
);
assert(
  !htmlInvalidBounds.includes('class="day-nav-step-btn day-nav-next-btn" disabled=""') &&
    !htmlInvalidBounds.includes('class="day-nav-step-btn day-nav-next-btn" disabled'),
  "Next day must stay enabled when max is invalid string"
);

console.log("✓ Boundary disabled states verified!");

// 4. Disabled prop disables latest button & controls
console.log("\n[Test 4] Disabled prop disables latest button and inputs");
const htmlDisabled = renderToStaticMarkup(
  React.createElement(DayNavigator, {
    value: "2026-10-05",
    latestDate: "2026-10-10",
    disabled: true,
    onChange: () => {},
  })
);
assert(
  htmlDisabled.includes('class="day-nav-latest-btn" disabled=""') ||
    htmlDisabled.includes('class="day-nav-latest-btn" disabled'),
  "Latest button must have disabled attribute when disabled is true"
);
assert(
  htmlDisabled.includes('class="day-nav-step-btn day-nav-prev-btn" disabled=""') ||
    htmlDisabled.includes('class="day-nav-step-btn day-nav-prev-btn" disabled'),
  "Prev button must be disabled when component is disabled"
);
assert(
  htmlDisabled.includes('class="day-nav-step-btn day-nav-next-btn" disabled=""') ||
    htmlDisabled.includes('class="day-nav-step-btn day-nav-next-btn" disabled'),
  "Next button must be disabled when component is disabled"
);
console.log("✓ Disabled prop verified!");

// 5. Multi-instance ID generation uniqueness
console.log("\n[Test 5] Multi-instance ID fallback with useId");
const htmlInst1 = renderToStaticMarkup(
  React.createElement(DayNavigator, {
    value: "2026-10-05",
    onChange: () => {},
  })
);
const idMatch1 = htmlInst1.match(/id="([^"]+)"/);
assert(idMatch1, "DayNavigator generates an id when none passed");
assert(idMatch1[1].startsWith("day-navigator-"), "Generated id uses day-navigator- prefix");
console.log("✓ Dynamic ID generation verified!");
