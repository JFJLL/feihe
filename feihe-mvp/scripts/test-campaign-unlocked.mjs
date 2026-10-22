/**
 * Independent QA Test Suite for Campaign Unlocked Adapters
 *
 * Verifies cross-adapter chaining, dynamic mutation counterexamples,
 * period consistency, strict comparison, missing value handling,
 * fraction/percentage scale correctness, and idempotency.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS_SOURCES = path.resolve(ROOT, "../docs/new-projects-sources");

import {
  KAILAS_MANUAL_DASHBOARD,
  MEILING_MANUAL_DASHBOARD,
} from "../lib/campaign-manual.ts";

import { applyMeilingSnapshot } from "../lib/campaign-online-meiling.ts";
import { applyKailasSnapshot } from "../lib/campaign-online-kailas.ts";
import {
  applyUnlockedMeilingKpi,
  UNLOCKED_MEILING_PREFIX,
} from "../lib/campaign-unlocked-meiling-kpi.ts";
import {
  applyUnlockedMeilingReports,
  MEILING_UNLOCKED_PREFIX,
} from "../lib/campaign-unlocked-meiling-reports.ts";
import { applyUnlockedKailas } from "../lib/campaign-unlocked-kailas.ts";

function loadJson(relPath) {
  const full = path.join(DOCS_SOURCES, relPath);
  if (!fs.existsSync(full)) {
    throw new Error(`Source JSON not found: ${full}`);
  }
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

// Historical fixtures were captured from the now-retired copy nodes. Normalize the
// identifiers at load time so adapters exercise the internal maintained sources.
function normalizeLegacyTokens(value) {
  const clone = JSON.parse(JSON.stringify(value));
  const tokenMap = {
    HNDCwmdpkiw4DgkFSNycB3cbnSc: "RQffw002Aik9aNkW9PScJ05knre",
    MMPZwhQbMiVmIKkcyb9c7mDQnHp: "E7LWwhPFhi8XNTkSXvoceiZfnJh",
    DkdOwDEk0i9FTUkXlh1cTE0fnOd: "DMMpwdQShiyEpyk89jVcP6GInjg",
  };
  const urlMap = {
    "https://yimeichuanbo.feishu.cn/wiki/HNDCwmdpkiw4DgkFSNycB3cbnSc":
      "https://yimeichuanbo.feishu.cn/wiki/RQffw002Aik9aNkW9PScJ05knre",
    "https://yimeichuanbo.feishu.cn/wiki/MMPZwhQbMiVmIKkcyb9c7mDQnHp":
      "https://yimeichuanbo.feishu.cn/wiki/E7LWwhPFhi8XNTkSXvoceiZfnJh",
    "https://yimeichuanbo.feishu.cn/wiki/DkdOwDEk0i9FTUkXlh1cTE0fnOd":
      "https://yimeichuanbo.feishu.cn/wiki/DMMpwdQShiyEpyk89jVcP6GInjg",
  };
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    for (const [key, item] of Object.entries(node)) {
      if (typeof item === "string") {
        if (item in tokenMap) node[key] = tokenMap[item];
        else if (item in urlMap) node[key] = urlMap[item];
        else {
          let next = item;
          for (const [oldToken, newToken] of Object.entries(tokenMap)) {
            next = next.split(oldToken).join(newToken);
          }
          node[key] = next;
        }
      } else {
        walk(item);
      }
    }
  };
  walk(clone);
  return clone;
}

const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  const status = pass ? "PASS" : "FAIL";
  console.log(`[${status}] ${name}${detail ? ` -> ${detail}` : ""}`);
}

async function runTests() {
  console.log("=== Running Campaign Unlocked Adapters QA Tests ===\n");

  const meilingBaseRaw = loadJson("meiling-base.json");
  const kailasSheetsRaw = loadJson("kailas-sheets.json");
  const newLinksRaw = normalizeLegacyTokens(loadJson("access-update-new-links.json"));
  const meilingReportsRaw = normalizeLegacyTokens(loadJson("access-update-meiling.json"));

  // Construct realistic baseline dashboards
  const meilingOnline = applyMeilingSnapshot(MEILING_MANUAL_DASHBOARD, meilingBaseRaw);
  const kailasOnline = applyKailasSnapshot(KAILAS_MANUAL_DASHBOARD, kailasSheetsRaw);

  // -------------------------------------------------------------
  // Test 1: Meiling 串联互不删除 (KPI + Reports 双向串联卡表共存)
  // -------------------------------------------------------------
  try {
    const chain1 = applyUnlockedMeilingReports(
      applyUnlockedMeilingKpi(meilingOnline, newLinksRaw),
      meilingReportsRaw
    );
    const chain2 = applyUnlockedMeilingKpi(
      applyUnlockedMeilingReports(meilingOnline, meilingReportsRaw),
      newLinksRaw
    );

    const kpiTables1 = chain1.tables.filter((t) => t.id.startsWith(UNLOCKED_MEILING_PREFIX));
    const repTables1 = chain1.tables.filter((t) => t.id.startsWith(MEILING_UNLOCKED_PREFIX));
    const kpiCards1 = chain1.kpis.filter((k) => k.id.startsWith(UNLOCKED_MEILING_PREFIX));
    const repCards1 = chain1.kpis.filter((k) => k.id.startsWith(MEILING_UNLOCKED_PREFIX));

    const kpiTables2 = chain2.tables.filter((t) => t.id.startsWith(UNLOCKED_MEILING_PREFIX));
    const repTables2 = chain2.tables.filter((t) => t.id.startsWith(MEILING_UNLOCKED_PREFIX));

    const tablesCoexist =
      kpiTables1.length === 4 &&
      repTables1.length === 4 &&
      kpiTables2.length === 4 &&
      repTables2.length === 4;
    const cardsCoexist = kpiCards1.length === 26 && repCards1.length === 4;

    if (tablesCoexist && cardsCoexist) {
      record(
        "Meiling: 串联互不删除 (KPI与Reports适配器卡表完整共存)",
        true,
        `KPI表=${kpiTables1.length}, Reports表=${repTables1.length}, KPI卡=${kpiCards1.length}, Reports卡=${repCards1.length}`
      );
    } else {
      record(
        "Meiling: 串联互不删除 (KPI与Reports适配器卡表完整共存)",
        false,
        `kpiTables=${kpiTables1.length}/4, repTables=${repTables1.length}/4, kpiCards=${kpiCards1.length}/26, repCards=${repCards1.length}/4`
      );
    }
  } catch (e) {
    record("Meiling: 串联互不删除 (KPI与Reports适配器卡表完整共存)", false, e.message);
  }

  // -------------------------------------------------------------
  // Test 2: 全链路重复应用幂等性 (Idempotency & No Duplicate IDs)
  // -------------------------------------------------------------
  try {
    const once = applyUnlockedMeilingReports(
      applyUnlockedMeilingKpi(meilingOnline, newLinksRaw),
      meilingReportsRaw
    );
    const twice = applyUnlockedMeilingReports(
      applyUnlockedMeilingKpi(once, newLinksRaw),
      meilingReportsRaw
    );

    const sEq = once.sources.length === twice.sources.length;
    const kEq = once.kpis.length === twice.kpis.length;
    const tEq = once.tables.length === twice.tables.length;

    const sourceIdSet = new Set();
    let hasDupSource = false;
    for (const s of twice.sources) {
      if (sourceIdSet.has(s.id)) { hasDupSource = true; break; }
      sourceIdSet.add(s.id);
    }

    const kpiIdSet = new Set();
    let hasDupKpi = false;
    for (const k of twice.kpis) {
      if (kpiIdSet.has(k.id)) { hasDupKpi = true; break; }
      kpiIdSet.add(k.id);
    }

    const tableIdSet = new Set();
    let hasDupTable = false;
    for (const t of twice.tables) {
      if (tableIdSet.has(t.id)) { hasDupTable = true; break; }
      tableIdSet.add(t.id);
    }

    const isIdempotent = sEq && kEq && tEq && !hasDupSource && !hasDupKpi && !hasDupTable;
    if (isIdempotent) {
      record(
        "Idempotency: 全链路串联重复应用幂等且无ID重复",
        true,
        `sources=${twice.sources.length}, kpis=${twice.kpis.length}, tables=${twice.tables.length}`
      );
    } else {
      record(
        "Idempotency: 全链路串联重复应用幂等且无ID重复",
        false,
        `sEq=${sEq}, kEq=${kEq}, tEq=${tEq}, dupSource=${hasDupSource}, dupKpi=${hasDupKpi}, dupTable=${hasDupTable}`
      );
    }
  } catch (e) {
    record("Idempotency: 全链路串联重复应用幂等且无ID重复", false, e.message);
  }

  // -------------------------------------------------------------
  // Test 3: 旧 KPI blocked placeholder 清除
  // -------------------------------------------------------------
  try {
    const hadPlaceholder = meilingOnline.tables.some(
      (t) => t.id === "meiling-online-kpi-status"
    );
    const chained = applyUnlockedMeilingReports(
      applyUnlockedMeilingKpi(meilingOnline, newLinksRaw),
      meilingReportsRaw
    );
    const placeholderCleared = !chained.tables.some(
      (t) => t.id === "meiling-online-kpi-status"
    );

    if (hadPlaceholder && placeholderCleared) {
      record(
        "Meiling: 旧 KPI blocked placeholder 清除",
        true,
        "meiling-online-kpi-status 已被解锁新表替代并清除"
      );
    } else {
      record(
        "Meiling: 旧 KPI blocked placeholder 清除",
        false,
        `hadPlaceholder=${hadPlaceholder}, placeholderCleared=${placeholderCleared}`
      );
    }
  } catch (e) {
    record("Meiling: 旧 KPI blocked placeholder 清除", false, e.message);
  }

  // -------------------------------------------------------------
  // Test 4: 统计周期严格隔离 (618 vs 7-8月 vs 双11 统计期不混)
  // -------------------------------------------------------------
  try {
    const chained = applyUnlockedMeilingReports(
      applyUnlockedMeilingKpi(meilingOnline, newLinksRaw),
      meilingReportsRaw
    );

    const t618Rep = chained.tables.find((t) => t.id === "meiling-unlocked-618-kpi");
    const t618Kpi = chained.tables.find((t) => t.id === "meiling-kpi-unlocked-kpi-618");
    const tD11Budget = chained.tables.find(
      (t) => t.id === "meiling-unlocked-double11-budget-execution"
    );
    const tD11KpiBudget = chained.tables.find(
      (t) => t.id === "meiling-kpi-unlocked-double11-budget"
    );

    const kpi618Roi = chained.kpis.find((k) => k.id === "meiling-unlocked-kpi-618-roi");
    const kpiD11Spend = chained.kpis.find(
      (k) => k.id === "meiling-unlocked-kpi-d11-actual-spend"
    );

    const no618Cross =
      !String(t618Rep?.period).includes("双11") &&
      !String(t618Kpi?.period).includes("双11") &&
      !String(kpi618Roi?.period).includes("双11");
    const noD11Cross =
      !String(tD11Budget?.period).includes("618") &&
      !String(tD11KpiBudget?.period).includes("618") &&
      !String(kpiD11Spend?.period).includes("618");

    if (no618Cross && noD11Cross) {
      record(
        "Period: 统计周期严格隔离 (618历史复盘与双11大促不混淆)",
        true,
        `618Period="${t618Rep?.period}", D11Period="${tD11Budget?.period}"`
      );
    } else {
      record(
        "Period: 统计周期严格隔离 (618历史复盘与双11大促不混淆)",
        false,
        `no618Cross=${no618Cross}, noD11Cross=${noD11Cross}`
      );
    }
  } catch (e) {
    record("Period: 统计周期严格隔离 (618历史复盘与双11大促不混淆)", false, e.message);
  }

  // -------------------------------------------------------------
  // Test 5: CPC target 变动动态驱动考核判定 (反例变异)
  // -------------------------------------------------------------
  try {
    const normalDash = applyUnlockedMeilingKpi(meilingOnline, newLinksRaw);
    const t618Normal = normalDash.tables.find((t) => t.id === "meiling-kpi-unlocked-kpi-618");
    const jdCpcNormal = t618Normal?.rows?.find(
      (r) => String(r.group).includes("京东") && String(r.kpiName).includes("CPC")
    );

    const mutatedNewLinks = JSON.parse(JSON.stringify(newLinksRaw));
    const hndc = mutatedNewLinks.targets.find(
      (t) => t.wiki_token === "RQffw002Aik9aNkW9PScJ05knre"
    );
    const fklc = hndc.core_sub_sheets.find((s) => s.sheetId === "FkLCad");
    fklc.rows[0][22] = "CPC≤0.5";

    const mutatedDash = applyUnlockedMeilingKpi(meilingOnline, mutatedNewLinks);
    const t618Mutated = mutatedDash.tables.find((t) => t.id === "meiling-kpi-unlocked-kpi-618");
    const jdCpcMutated = t618Mutated?.rows?.find(
      (r) => String(r.group).includes("京东") && String(r.kpiName).includes("CPC")
    );

    const normalPass = jdCpcNormal?.status === "达标";
    const mutatedFail = jdCpcMutated?.status === "未达标";

    if (normalPass && mutatedFail) {
      record(
        "Mutation: CPC 目标变动动态驱动考核判定 (0.8达标 -> 0.5未达标)",
        true,
        `正常目标=${jdCpcNormal?.target}(${jdCpcNormal?.status}) -> 变异目标=${jdCpcMutated?.target}(${jdCpcMutated?.status})`
      );
    } else {
      record(
        "Mutation: CPC 目标变动动态驱动考核判定 (0.8达标 -> 0.5未达标)",
        false,
        `normalStatus=${jdCpcNormal?.status}, mutatedStatus=${jdCpcMutated?.status}`
      );
    }
  } catch (e) {
    record("Mutation: CPC 目标变动动态驱动考核判定 (0.8达标 -> 0.5未达标)", false, e.message);
  }

  // -------------------------------------------------------------
  // Test 6: actual null 保持 null 不转 0 或误判达成
  // -------------------------------------------------------------
  try {
    const chained = applyUnlockedMeilingReports(
      applyUnlockedMeilingKpi(meilingOnline, newLinksRaw),
      meilingReportsRaw
    );
    const bzTable = chained.tables.find(
      (t) => t.id === "meiling-unlocked-double11-channel-summary"
    );
    const naRow = bzTable?.rows?.find((r) => String(r.qualityNote).includes("源表数据引用异常"));

    const preservesNull = naRow && naRow.spend === null && naRow.totalRoi === null;
    const notesError = naRow && String(naRow.qualityNote).includes("保持原表留白");

    if (preservesNull && notesError) {
      record(
        "Fidelity: actual 缺失与公式错误保留 null (不转 0 且注记错误)",
        true,
        `channel="${naRow.channelName}", spend=${naRow.spend}, roi=${naRow.totalRoi}, note="${naRow.qualityNote}"`
      );
    } else {
      record(
        "Fidelity: actual 缺失与公式错误保留 null (不转 0 且注记错误)",
        false,
        `spend=${naRow?.spend}, roi=${naRow?.totalRoi}, note=${naRow?.qualityNote}`
      );
    }
  } catch (e) {
    record("Fidelity: actual 缺失与公式错误保留 null (不转 0 且注记错误)", false, e.message);
  }

  // -------------------------------------------------------------
  // Test 7: 618 CTR 百分比正常达成 / 变异后不达成 (防 100x fraction 误判)
  // -------------------------------------------------------------
  try {
    const chained = applyUnlockedMeilingReports(
      applyUnlockedMeilingKpi(meilingOnline, newLinksRaw),
      meilingReportsRaw
    );
    const table618Normal = chained.tables.find((t) => t.id === "meiling-unlocked-618-kpi");
    const ctrNormal = table618Normal?.rows?.find((r) => r.metric === "CTR");

    const mutatedReopened = JSON.parse(JSON.stringify(meilingReportsRaw));
    const mmpz = mutatedReopened.workbooks.find(
      (w) => w.node_token === "E7LWwhPFhi8XNTkSXvoceiZfnJh"
    );
    const hmtx = mmpz.captured_tabs.find((t) => t.sheet_id === "hmtx2k");
    for (const row of hmtx.rows) {
      for (let c = 0; c < row.length - 2; c++) {
        if (row[c] && String(row[c]).trim() === "CTR") {
          row[c + 1] = "9.80%";
        }
      }
    }

    const mutatedRepDash = applyUnlockedMeilingReports(meilingOnline, mutatedReopened);
    const table618Mutated = mutatedRepDash.tables.find((t) => t.id === "meiling-unlocked-618-kpi");
    const ctrMutated = table618Mutated?.rows?.find((r) => r.metric === "CTR");

    const normalPass = ctrNormal?.status === "达成";
    const mutatedFail = ctrMutated?.status === "未达成";

    if (normalPass && mutatedFail) {
      record(
        "MetricScale: 618 CTR 百分比正常达成 / 变异后不达成 (无100倍比例误判)",
        true,
        `正常=${ctrNormal?.actual} vs ${ctrNormal?.target}(${ctrNormal?.status}) -> 变异=${ctrMutated?.actual} vs ${ctrMutated?.target}(${ctrMutated?.status})`
      );
    } else {
      record(
        "MetricScale: 618 CTR 百分比正常达成 / 变异后不达成 (无100倍比例误判)",
        false,
        `normalStatus=${ctrNormal?.status}, mutatedStatus=${ctrMutated?.status}`
      );
    }
  } catch (e) {
    record("MetricScale: 618 CTR 百分比正常达成 / 变异后不达成 (无100倍比例误判)", false, e.message);
  }

  // -------------------------------------------------------------
  // Test 8: 新四 sourceId 严格沿用旧 LT1/RQff/MMPZ/Dkd 且 status 为 ready
  // -------------------------------------------------------------
  try {
    const kUnlocked = applyUnlockedKailas(kailasOnline, newLinksRaw);
    const mChained = applyUnlockedMeilingReports(
      applyUnlockedMeilingKpi(meilingOnline, newLinksRaw),
      meilingReportsRaw
    );

    const sLT1 = kUnlocked.sources.find((s) => s.id === "src-kailas-node-LT1MwikWci8LTDk0UL7coXfrnVb");
    const sRQff = mChained.sources.find((s) => s.id === "src-meiling-node-RQffw002Aik9aNkW9PScJ05knre");
    const sMMPZ = mChained.sources.find((s) => s.id === "src-meiling-node-MMPZwhQbMiVmIKkcyb9c7mDQnHp");
    const sDkd = mChained.sources.find((s) => s.id === "src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd");

    const allExist = sLT1 && sRQff && sMMPZ && sDkd;
    const allReady =
      sLT1?.status === "ready" &&
      sRQff?.status === "ready" &&
      sMMPZ?.status === "ready" &&
      sDkd?.status === "ready";

    if (allExist && allReady) {
      record(
        "Sources: 新四 sourceId 严格沿用旧 LT1/RQff/MMPZ/Dkd 且状态均为 ready",
        true,
        `LT1=${sLT1?.status}, RQff=${sRQff?.status}, MMPZ=${sMMPZ?.status}, Dkd=${sDkd?.status}`
      );
    } else {
      record(
        "Sources: 新四 sourceId 严格沿用旧 LT1/RQff/MMPZ/Dkd 且状态均为 ready",
        false,
        `allExist=${allExist}, allReady=${allReady}`
      );
    }
  } catch (e) {
    record("Sources: 新四 sourceId 严格沿用旧 LT1/RQff/MMPZ/Dkd 且状态均为 ready", false, e.message);
  }

  // -------------------------------------------------------------
  // Test 9: Kailas 严格 comparison 判定 (< vs ≥)
  // -------------------------------------------------------------
  try {
    const kUnlocked = applyUnlockedKailas(kailasOnline, newLinksRaw);

    const ctrKpi = kUnlocked.kpis.find((k) => k.id.includes("kpi-ctr"));
    const cpcKpi = kUnlocked.kpis.find((k) => k.id.includes("kpi-cpc"));
    const cpeKpi = kUnlocked.kpis.find((k) => k.id.includes("kpi-cpe"));
    const cpmKpi = kUnlocked.kpis.find((k) => k.id.includes("kpi-cpm"));

    const ctrIsGte = ctrKpi?.comparison === "gte";
    const cpcIsLt = cpcKpi?.comparison === "lt";
    const cpeIsLt = cpeKpi?.comparison === "lt";
    const cpmIsLt = cpmKpi?.comparison === "lt";

    if (ctrIsGte && cpcIsLt && cpeIsLt && cpmIsLt) {
      record(
        "Kailas: 严格 comparison 字段比较 (CTR为gte, 成本CPC/CPE/CPM为lt)",
        true,
        `ctr=${ctrKpi?.comparison}, cpc=${cpcKpi?.comparison}, cpe=${cpeKpi?.comparison}, cpm=${cpmKpi?.comparison}`
      );
    } else {
      record(
        "Kailas: 严格 comparison 字段比较 (CTR为gte, 成本CPC/CPE/CPM为lt)",
        false,
        `ctr=${ctrKpi?.comparison}(期望gte), cpc=${cpcKpi?.comparison}(期望lt)`
      );
    }
  } catch (e) {
    record("Kailas: 严格 comparison 字段比较 (CTR为gte, 成本CPC/CPE/CPM为lt)", false, e.message);
  }

  // -------------------------------------------------------------
  // Test 10: Kailas 动态变异驱动 (数据联动非硬编码)
  // -------------------------------------------------------------
  try {
    const mutatedKLinks = JSON.parse(JSON.stringify(newLinksRaw));
    const y8 = mutatedKLinks.targets.find(
      (t) => t.wiki_token === "Y8S1wy0YUiAtJrkY9G5ceczDnjf"
    );
    const jpk = y8.core_sub_sheets.find((s) => s.sheetId === "JPKUX9");
    jpk.rows[1][4] = "18.5%";
    jpk.rows[1][5] = "0.42";

    const kMutated = applyUnlockedKailas(kailasOnline, mutatedKLinks);
    const kCtr = kMutated.kpis.find((k) => k.id.includes("kpi-ctr"));
    const kCpc = kMutated.kpis.find((k) => k.id.includes("kpi-cpc"));
    const jpkTable = kMutated.tables.find((t) => t.id.includes("performance-JPKUX9"));
    const totalRow = jpkTable?.rows?.[0];

    const ctrChanged = kCtr?.value === 18.5 && totalRow?.ctr === 18.5;
    const cpcChanged = kCpc?.value === 0.42 && totalRow?.cpc === 0.42;

    if (ctrChanged && cpcChanged) {
      record(
        "Kailas: JPKUX9 数据变异联动驱动 KPI 卡与总览表更新",
        true,
        `CTR=${kCtr?.value}%(期望18.5%), CPC=${kCpc?.value}元(期望0.42)`
      );
    } else {
      record(
        "Kailas: JPKUX9 数据变异联动驱动 KPI 卡与总览表更新",
        false,
        `kCtr=${kCtr?.value}, kCpc=${kCpc?.value}, rowCtr=${totalRow?.ctr}, rowCpc=${totalRow?.cpc}`
      );
    }
  } catch (e) {
    record("Kailas: JPKUX9 数据变异联动驱动 KPI 卡与总览表更新", false, e.message);
  }

  // -------------------------------------------------------------
  // Test 11: Kailas 幂等性与引用完整性 (Idempotency & Referential Integrity)
  // -------------------------------------------------------------
  try {
    const once = applyUnlockedKailas(kailasOnline, newLinksRaw);
    const twice = applyUnlockedKailas(once, newLinksRaw);

    const sEq = once.sources.length === twice.sources.length;
    const kEq = once.kpis.length === twice.kpis.length;
    const tEq = once.tables.length === twice.tables.length;

    const validSources = new Set(twice.sources.map((s) => s.id));
    const danglingKpis = twice.kpis.filter((k) => k.sourceId && !validSources.has(k.sourceId));
    const danglingTables = twice.tables.filter((t) => t.sourceId && !validSources.has(t.sourceId));

    const isIdempotent = sEq && kEq && tEq;
    const isReferentiallySound = danglingKpis.length === 0 && danglingTables.length === 0;

    if (isIdempotent && isReferentiallySound) {
      record(
        "Kailas: 重复 apply 幂等且无悬空 sourceId",
        true,
        `sources=${twice.sources.length}, kpis=${twice.kpis.length}, tables=${twice.tables.length}`
      );
    } else {
      record(
        "Kailas: 重复 apply 幂等且无悬空 sourceId",
        false,
        `isIdempotent=${isIdempotent}, danglingKpis=${danglingKpis.length}, danglingTables=${danglingTables.length}`
      );
    }
  } catch (e) {
    record("Kailas: 重复 apply 幂等且无悬空 sourceId", false, e.message);
  }

  console.log("\n=== Summary ===");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
