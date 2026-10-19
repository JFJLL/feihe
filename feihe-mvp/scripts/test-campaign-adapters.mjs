/**
 * Real Data Mutation Tests for Campaign Adapters
 * Tests pure TS adapter functions against docs source JSONs and genuine mutation counterexamples.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS_SOURCES = path.resolve(ROOT, "../docs/new-projects-sources");

// 1. Direct imports of real pure TS adapter functions
import {
  KAILAS_MANUAL_DASHBOARD,
  MEILING_MANUAL_DASHBOARD,
  WIPES_MANUAL_DASHBOARD,
} from "../lib/campaign-manual.ts";

import { applyWipesSnapshot } from "../lib/campaign-online-wipes.ts";
import { applyMeilingSnapshot } from "../lib/campaign-online-meiling.ts";
// Dynamic import handled in test to isolate Kailas syntax/load issues

function loadJson(relPath) {
  const full = path.join(DOCS_SOURCES, relPath);
  if (!fs.existsSync(full)) {
    throw new Error(`Source JSON not found: ${full}`);
  }
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  const status = pass ? "PASS" : "FAIL";
  console.log(`[${status}] ${name}${detail ? ` -> ${detail}` : ""}`);
}

async function runTests() {
  console.log("=== Running Campaign Adapter Mutation Tests ===\n");

  const wipesSheetsRaw = loadJson("wipes-sheets.json");
  const wipesWeeklyRaw = loadJson("wipes-weekly.json");
  const meilingBaseRaw = loadJson("meiling-base.json");
  const kailasSheetsRaw = loadJson("kailas-sheets.json");

  // -------------------------------------------------------------
  // Test 1: Wipes (稳健酒精湿巾)
  // -------------------------------------------------------------
  // 1.1 改变 wipes 源 actual/target 后 KPI 卡和比较表跟着变
  try {
    const mutatedWipes = JSON.parse(JSON.stringify(wipesSheetsRaw));
    mutatedWipes.backend_fields.kpi.daily_seeding.cpuv.actual = 19.88;
    mutatedWipes.backend_fields.kpi.daily_seeding.cpuv.target = 30.00;

    const res = applyWipesSnapshot(WIPES_MANUAL_DASHBOARD, mutatedWipes, wipesWeeklyRaw);
    const cpuvKpi = res.kpis.find((k) => k.id.includes("cpuv"));
    const compTable = res.tables.find((t) => t.id === "wipes-kpi-comparison-table");
    const cpuvRow = compTable?.rows?.find((r) => String(r.scope).includes("CPUV"));

    const kpiChanged = cpuvKpi?.value === 19.88 && cpuvKpi?.target === 30.00;
    const tableChanged = cpuvRow && String(cpuvRow.actual).includes("19.88");

    if (kpiChanged && tableChanged) {
      record("Wipes: 变异 actual/target 驱动 KPI 与表格变化", true);
    } else {
      record(
        "Wipes: 变异 actual/target 驱动 KPI 与表格变化",
        false,
        `KPI val=${cpuvKpi?.value}, target=${cpuvKpi?.target}, table row actual=${cpuvRow?.actual}`
      );
    }
  } catch (e) {
    record("Wipes: 变异 actual/target 驱动 KPI 与表格变化", false, e.message);
  }

  // 1.2 删 actual 不回退 8.23
  try {
    const mutatedWipes = JSON.parse(JSON.stringify(wipesSheetsRaw));
    delete mutatedWipes.backend_fields.kpi.daily_seeding.cpuv.actual;
    if (mutatedWipes.extracted_sheets?.OgJUzb?.rows) {
      mutatedWipes.extracted_sheets.OgJUzb.rows = [];
    }

    const res = applyWipesSnapshot(WIPES_MANUAL_DASHBOARD, mutatedWipes, wipesWeeklyRaw);
    const cpuvKpi = res.kpis.find((k) => k.id.includes("cpuv"));
    const compTable = res.tables.find((t) => t.id === "wipes-kpi-comparison-table");
    const cpuvRow = compTable?.rows?.find((r) => String(r.scope).includes("CPUV"));

    const kpiNot823 = cpuvKpi?.value !== 8.23;
    const tableNot823 = !String(cpuvRow?.actual ?? "").includes("8.23");

    if (kpiNot823 && tableNot823) {
      record("Wipes: 删 actual 不回退 8.23", true);
    } else {
      record(
        "Wipes: 删 actual 不回退 8.23",
        false,
        `kpi.value=${cpuvKpi?.value}, table.actual=${cpuvRow?.actual} (回退到了硬编码8.23)`
      );
    }
  } catch (e) {
    record("Wipes: 删 actual 不回退 8.23", false, e.message);
  }

  // 1.3 删 weekly 不造 116 发布
  try {
    const res = applyWipesSnapshot(WIPES_MANUAL_DASHBOARD, wipesSheetsRaw, null);
    const hasWeeklySource = res.sources.some((s) => s.id === "wipes-weekly-doc");
    const hasExecutionTable = res.tables.some((t) => t.id === "wipes-execution-progress-table");

    if (!hasWeeklySource && !hasExecutionTable) {
      record("Wipes: 删 weekly 不造 116 发布与周报表", true);
    } else {
      record(
        "Wipes: 删 weekly 不造 116 发布与周报表",
        false,
        `hasWeeklySource=${hasWeeklySource}, hasExecutionTable=${hasExecutionTable}`
      );
    }
  } catch (e) {
    record("Wipes: 删 weekly 不造 116 发布与周报表", false, e.message);
  }


  // 1.4 补测：snapshot.explicit null 实际保持 null (无伪造回退/无NaN)
  try {
    const mutatedWipes = JSON.parse(JSON.stringify(wipesSheetsRaw));
    mutatedWipes.backend_fields.kpi.daily_seeding.cpuv.actual = null;
    mutatedWipes.backend_fields.kpi.daily_seeding.cpm.actual = null;

    const res = applyWipesSnapshot(WIPES_MANUAL_DASHBOARD, mutatedWipes, wipesWeeklyRaw);
    const cpuvKpi = res.kpis.find((k) => k.id === "wipes-online-daily-cpuv");
    const cpmKpi = res.kpis.find((k) => k.id === "wipes-online-daily-cpm");

    const preservesNull = cpuvKpi?.value === null && cpmKpi?.value === null;
    if (preservesNull) {
      record("Wipes: explicit null 实际保持 null (无回退/无NaN)", true);
    } else {
      record(
        "Wipes: explicit null 实际保持 null (无回退/无NaN)",
        false,
        `cpuv=${cpuvKpi?.value}, cpm=${cpmKpi?.value}`
      );
    }
  } catch (e) {
    record("Wipes: explicit null 实际保持 null (无回退/无NaN)", false, e.message);
  }

  // 1.5 补测：改变 weekly 周期文本动态反映新周期
  try {
    const mutatedWeekly = JSON.parse(JSON.stringify(wipesWeeklyRaw));
    mutatedWeekly.content = mutatedWeekly.content.replace(
      /#\s*时间周期[：:][^\n]+/,
      "# 时间周期：2026/11/01-11/20"
    ).replace(
      /(?:截止|截至)[^\n，,。\r]*?(?:发布完毕|已发布完毕)/,
      "截至11/21已发布完毕"
    );

    const res = applyWipesSnapshot(WIPES_MANUAL_DASHBOARD, wipesSheetsRaw, mutatedWeekly);
    const execTable = res.tables.find((t) => t.id === "wipes-execution-progress-table");
    const matchesNewPeriod =
      execTable?.period?.includes("2026/11/01-11/20") &&
      execTable?.period?.includes("截至11/21已发布完毕");

    if (matchesNewPeriod) {
      record("Wipes: 改变 weekly 周期文本动态反映新周期", true, `period=${execTable?.period}`);
    } else {
      record(
        "Wipes: 改变 weekly 周期文本动态反映新周期",
        false,
        `table.period=${execTable?.period}`
      );
    }
  } catch (e) {
    record("Wipes: 改变 weekly 周期文本动态反映新周期", false, e.message);
  }

  // -------------------------------------------------------------
  // Test 2: Meiling (美菱)
  // -------------------------------------------------------------
  // 2.1 删候选池 stats 不回退 1096
  try {
    const mutatedMeiling = JSON.parse(JSON.stringify(meilingBaseRaw));
    delete mutatedMeiling.viewScope.view_records_count;
    delete mutatedMeiling.summary_candidate_pool_N1096;

    const res = applyMeilingSnapshot(MEILING_MANUAL_DASHBOARD, mutatedMeiling);
    const poolKpi = res.kpis.find((k) => k.id.includes("candidate-pool"));

    if (poolKpi && poolKpi.value !== 1096) {
      record("Meiling: 删候选池 stats 不回退 1096", true, `val=${poolKpi.value}`);
    } else {
      record(
        "Meiling: 删候选池 stats 不回退 1096",
        false,
        `poolKpi.value=${poolKpi?.value} (回退到了硬编码1096)`
      );
    }
  } catch (e) {
    record("Meiling: 删候选池 stats 不回退 1096", false, e.message);
  }

  // 2.2 改 confirmed/published 记录结果动态变化
  try {
    const mutatedMeiling = JSON.parse(JSON.stringify(meilingBaseRaw));
    // 强制把前50条设为已发布，其余设为未确认
    mutatedMeiling.records = mutatedMeiling.records.map((r, i) => ({
      ...r,
      "二核确认合作": i < 50,
      "审核进度": i < 30 ? "已发布" : "可推进",
      "发布状态": i < 30 ? "已发布" : "未发布",
    }));

    const res = applyMeilingSnapshot(MEILING_MANUAL_DASHBOARD, mutatedMeiling);
    const confirmedKpi = res.kpis.find((k) => k.id === "meiling-online-confirmed-total");
    const publishedKpi = res.kpis.find((k) => k.id === "meiling-online-published-count");

    if (confirmedKpi?.value === 50 && publishedKpi?.value === 30) {
      record("Meiling: 改 records 驱动 confirmed/published 动态计算", true);
    } else {
      record(
        "Meiling: 改 records 驱动 confirmed/published 动态计算",
        false,
        `confirmed=${confirmedKpi?.value} (期望50), published=${publishedKpi?.value} (期望30)`
      );
    }
  } catch (e) {
    record("Meiling: 改 records 驱动 confirmed/published 动态计算", false, e.message);
  }

  // 2.3 无忧嵌502 不能归小确杏502
  try {
    const mutatedMeiling = JSON.parse(JSON.stringify(meilingBaseRaw));
    mutatedMeiling.records = [
      {
        "达人昵称": "测试达人",
        "二核确认合作": true,
        "审核进度": "已发布",
        "推荐产品": "无忧嵌502",
      },
    ];

    const res = applyMeilingSnapshot(MEILING_MANUAL_DASHBOARD, mutatedMeiling);
    const prodTable = res.tables.find((t) => t.id === "meiling-online-product-distribution");
    const pro502Row = prodTable?.rows?.find((r) => String(r.productGroup).includes("502pro"));
    const wuyouRow = prodTable?.rows?.find((r) => String(r.productGroup).includes("无忧嵌"));

    const pro502Count = Number(pro502Row?.count ?? 0);
    const wuyouCount = Number(wuyouRow?.count ?? 0);

    if (pro502Count === 0 && wuyouCount === 1) {
      record("Meiling: 无忧嵌502 不归小确杏502", true);
    } else {
      record(
        "Meiling: 无忧嵌502 不归小确杏502",
        false,
        `502proRow=${pro502Count}, wuyouRow=${wuyouCount} (无忧嵌502被误分配给502pro)`
      );
    }
  } catch (e) {
    record("Meiling: 无忧嵌502 不归小确杏502", false, e.message);
  }

  // -------------------------------------------------------------
  // Test 3: Idempotency & Referential Integrity
  // -------------------------------------------------------------
  // 3.1 重复 apply 幂等性
  try {
    const once = applyMeilingSnapshot(MEILING_MANUAL_DASHBOARD, meilingBaseRaw);
    const twice = applyMeilingSnapshot(once, meilingBaseRaw);

    const sEq = once.sources.length === twice.sources.length;
    const kEq = once.kpis.length === twice.kpis.length;
    const tEq = once.tables.length === twice.tables.length;

    if (sEq && kEq && tEq) {
      record("Idempotency: 重复 apply 不追加 sources/kpis/tables", true);
    } else {
      record(
        "Idempotency: 重复 apply 不追加 sources/kpis/tables",
        false,
        `sources: ${once.sources.length}->${twice.sources.length}, kpis: ${once.kpis.length}->${twice.kpis.length}, tables: ${once.tables.length}->${twice.tables.length}`
      );
    }
  } catch (e) {
    record("Idempotency: 重复 apply 不追加 sources/kpis/tables", false, e.message);
  }

  // 3.2 所有 sourceId 真实存在
  try {
    const dashWipes = applyWipesSnapshot(WIPES_MANUAL_DASHBOARD, wipesSheetsRaw, wipesWeeklyRaw);
    const dashMeiling = applyMeilingSnapshot(MEILING_MANUAL_DASHBOARD, meilingBaseRaw);
    let dashKailas = KAILAS_MANUAL_DASHBOARD;
    try {
      const { applyKailasSnapshot } = await import("../lib/campaign-online-kailas.ts");
      dashKailas = applyKailasSnapshot(KAILAS_MANUAL_DASHBOARD, kailasSheetsRaw);
    } catch (e) {
      // isolated from referential check
    }

    function checkSourceRefs(dash, label) {
      const validSources = new Set(dash.sources.map((s) => s.id));
      const dangling = [];
      for (const k of dash.kpis) {
        if (k.sourceId && !validSources.has(k.sourceId)) {
          dangling.push(`kpi:${k.id}->${k.sourceId}`);
        }
      }
      for (const t of dash.tables) {
        if (t.sourceId && !validSources.has(t.sourceId)) {
          dangling.push(`table:${t.id}->${t.sourceId}`);
        }
      }
      return dangling;
    }

    const dW = checkSourceRefs(dashWipes, "Wipes");
    const dM = checkSourceRefs(dashMeiling, "Meiling");
    const dK = checkSourceRefs(dashKailas, "Kailas");
    const allDangling = [...dW, ...dM, ...dK];

    if (allDangling.length === 0) {
      record("Referential: 所有 kpi/table.sourceId 均在 sources 中存在", true);
    } else {
      record(
        "Referential: 所有 kpi/table.sourceId 均在 sources 中存在",
        false,
        `发现未定义 sourceId: ${allDangling.join(", ")}`
      );
    }
  } catch (e) {
    record("Referential: 所有 kpi/table.sourceId 均在 sources 中存在", false, e.message);
  }

  // -------------------------------------------------------------
  // Test 4: Kailas (凯乐石)
  // -------------------------------------------------------------
  // 4.1 Kai 副本 0 不覆盖 manual 906818.64
  try {
    const mutatedKailas = JSON.parse(JSON.stringify(kailasSheetsRaw));
    // 强制副本日报消费为 0
    const pwSheet = mutatedKailas.sheets.find((s) => s.sheetId === "pwNPq2");
    if (pwSheet && pwSheet.value) {
      pwSheet.value[3] = ["", "汇总", "", 0];
    }

    const { applyKailasSnapshot } = await import("../lib/campaign-online-kailas.ts");
    const res = applyKailasSnapshot(KAILAS_MANUAL_DASHBOARD, mutatedKailas);
    const spendKpi = res.kpis.find((k) => k.id.includes("spend") || k.label.includes("消耗") || k.label.includes("花费"));

    if (spendKpi && spendKpi.value === 906818.64) {
      record("Kailas: 副本 0 不覆盖 manual 906818.64", true, `value=${spendKpi.value}`);
    } else {
      record(
        "Kailas: 副本 0 不覆盖 manual 906818.64",
        false,
        `spendKpi.value=${spendKpi?.value} (期望906818.64)`
      );
    }
  } catch (e) {
    record("Kailas: 副本 0 不覆盖 manual 906818.64", false, e.message);
  }

  console.log("\n=== Summary ===");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
}

runTests();
