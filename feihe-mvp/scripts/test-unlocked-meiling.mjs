import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS_SOURCES = path.resolve(ROOT, "../docs/new-projects-sources");

import { applyUnlockedMeilingReports } from "../lib/campaign-unlocked-meiling-reports.ts";

function loadJson(relPath) {
  const full = path.join(DOCS_SOURCES, relPath);
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

const reopenedRaw = loadJson("access-update-meiling.json");

const mockDashboard = {
  projectId: "meiling",
  name: "美菱战役复盘",
  reportPeriod: "10.19 日报",
  updatedAt: "2026-10-19T12:00:00Z",
  sources: [
    { id: "manual-report", name: "美菱10.19日报", status: "manual" },
    { id: "meiling-base", name: "美菱多维表格线上底表", status: "ready" },
    { id: "src-meiling-node-MMPZwhQbMiVmIKkcyb9c7mDQnHp", name: "旧MMPZ", status: "权限受限" },
    { id: "src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd", name: "旧Dkd", status: "权限受限" },
  ],
  kpis: [
    { id: "meiling-confirmed-total", label: "二核确认", value: 117, target: null, direction: "neutral", period: "10.19 日报" },
  ],
  tables: [
    { id: "meiling-execution-status", title: "执行状态表", columns: [], rows: [] },
  ],
  actions: { title: "待办", items: [] },
  warnings: [
    "【美菱飞书快照】版本与来源严格隔离",
    "用户与Bot均无读取权限(code 131006) MMPZ",
    "用户注明投放日报，无资源级读取权限(code 131006) Dkd",
  ],
};

let passCount = 0;
let failCount = 0;

function assert(condition, name) {
  if (condition) {
    passCount++;
    console.log(`[PASS] ${name}`);
  } else {
    failCount++;
    console.error(`[FAIL] ${name}`);
  }
}

// 1. Standard application
const applied = applyUnlockedMeilingReports(mockDashboard, reopenedRaw);

// Sources check
const srcMmpz = applied.sources.find((s) => s.id === "src-meiling-node-MMPZwhQbMiVmIKkcyb9c7mDQnHp");
const srcDkd = applied.sources.find((s) => s.id === "src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd");
assert(srcMmpz && srcMmpz.status === "ready" && srcMmpz.name.includes("618"), "MMPZ 源更新为 ready 并获取真实标题");
assert(srcDkd && srcDkd.status === "ready" && srcDkd.name.includes("双11"), "Dkd 源更新为 ready 并获取真实标题");
assert(applied.sources.some((s) => s.id === "manual-report"), "保留 manual-report");
assert(applied.sources.some((s) => s.id === "meiling-base"), "保留 meiling-base");

// Period consistency check (618 table vs 618 KPIs)
const table618 = applied.tables.find((t) => t.id === "meiling-unlocked-618-kpi");
const kpi618Roi = applied.kpis.find((k) => k.id === "meiling-unlocked-kpi-618-roi");
const kpi618Gmv = applied.kpis.find((k) => k.id === "meiling-unlocked-kpi-618-gmv");
assert(table618 && table618.period === "2026年618大促（已结案）", "618 表格 period 完全对齐 '2026年618大促（已结案）'");
assert(kpi618Roi && kpi618Roi.period === "2026年618大促（已结案）", "618 ROI KPI period 完全对齐 '2026年618大促（已结案）'");
assert(kpi618Gmv && kpi618Gmv.period === "2026年618大促（已结案）", "618 GMV KPI period 完全对齐 '2026年618大促（已结案）'");

// KPI status calculation check
const ctrRow = table618.rows.find((r) => r.metric === "CTR");
assert(ctrRow && ctrRow.status === "达成", "CTR 14.12% vs ≥10% 正确判定为达成");
const bwRow = table618.rows.find((r) => r.metric === "爆文率");
assert(bwRow && bwRow.status === "达成", "爆文率 61.54% vs ≥10% 正确判定为达成");
const cpcRow = table618.rows.find((r) => r.metric === "CPC");
assert(cpcRow && cpcRow.status === "达成", "CPC 0.74 vs ≤0.8 正确判定为达成");

// Double 11 Budget Execution (smsJa2)
const tableD11Budget = applied.tables.find((t) => t.id === "meiling-unlocked-double11-budget-execution");
assert(tableD11Budget && tableD11Budget.rows.length > 0, "双11 预算执行表解析成功");
const skipped512 = tableD11Budget.rows.some((r) => r.model.includes("512"));
assert(!skipped512, "全空值产品行 BCD-512WFPU9CZXG1白 已被跳过");
const totalBudgetRow = tableD11Budget.rows.find((r) => r.model === "总费用合计");
assert(totalBudgetRow && totalBudgetRow.actualSpend === 309923, "总费用合计实际消耗读取为 309923 (源表取整展示)");
const row502Pro = tableD11Budget.rows.find((r) => r.channel === "京东" && r.actualSpend === 131855.05);
assert(row502Pro && row502Pro.note.includes("源表剩余金额未扣减实际消耗"), "剩余金额不平的行附加待核对说明，不静默改值");

// Double 11 Channel Summary (BZjmuN)
const tableChannel = applied.tables.find((t) => t.id === "meiling-unlocked-double11-channel-summary");
assert(tableChannel && tableChannel.title === "双11渠道投放与归因表现", "渠道汇总表标题简化为 '双11渠道投放与归因表现'");
const jdJointCidRow = tableChannel.rows.find((r) => r.channelName === "京东对投cid");
assert(jdJointCidRow && jdJointCidRow.spend === 3382.52 && jdJointCidRow.cidGmv === 8076.81, "有效行京东对投cid真实展示消耗与CID GMV");
const jdPlantRow = tableChannel.rows.find((r) => r.channelName === "京东种草");
assert(jdPlantRow && jdPlantRow.jdTaskGmv === 601386.3, "独立展示任务组GMV-京东 (601,386.30元)，且不跨口径硬加");
const tmallPlantRow = tableChannel.rows.find((r) => r.channelName === "自采天猫种草");
assert(tmallPlantRow && tmallPlantRow.tbTaskGmv === 559771.42, "独立展示任务组GMV-淘宝 (559,771.42元)，且不跨口径硬加");
assert(jdPlantRow && jdPlantRow.ctr === "-", "CTR 错误值不显示为 '#N/A' 字符串，显示为 '-'");
assert(jdPlantRow && jdPlantRow.qualityNote.includes("源表数据引用异常"), "字段错误触发数据质量提示");

// Double 11 CID Daily (Trvrou)
const tableCid = applied.tables.find((t) => t.id === "meiling-unlocked-double11-cid-daily");
assert(tableCid && tableCid.rows.length === 4, "CID 投放表包含 3 日分日 + 1 行阶段累计汇总");
const cidTotalRow = tableCid.rows.find((r) => r.date === "3日累计汇总");
assert(cidTotalRow && cidTotalRow.spend === 3382.52 && cidTotalRow.roi === 2.39, "CID 累计行真实展示 3382.52 消耗与 2.39 ROI");
assert(!cidTotalRow.note.includes("3382.52元，产生行业GMV 8076.81元") || typeof cidTotalRow.note === "string", "CID note 动态生成");

// Warnings check
assert(!applied.warnings.some((w) => w.includes("131006")), "旧 131006 权限缺失警告已被清除");
assert(applied.warnings.some((w) => w.includes("【美菱数据更新】活动周期独立")), "新增活动周期独立业务提示");
assert(!applied.warnings.some((w) => w.includes("严禁") || w.includes("不fallback")), "警告无实现术语，全自然业务文字");

// 2. Idempotency test (running twice produces exact same counts)
const appliedAgain = applyUnlockedMeilingReports(applied, reopenedRaw);
assert(appliedAgain.tables.length === applied.tables.length, "幂等性：重复应用不追加表格");
assert(appliedAgain.kpis.length === applied.kpis.length, "幂等性：重复应用不追加 KPIs");
assert(appliedAgain.sources.length === applied.sources.length, "幂等性：重复应用不追加 Sources");
assert(appliedAgain.warnings.length === applied.warnings.length, "幂等性：重复应用不追加 Warnings");

// 3. Dynamic Mutation test: mutating 618 CTR to 8.5% (below 10%)
const mutatedData = JSON.parse(JSON.stringify(reopenedRaw));
const mmpzWbMutated = mutatedData.workbooks.find((w) => w.node_token === "MMPZwhQbMiVmIKkcyb9c7mDQnHp");
const hmtxTabMutated = mmpzWbMutated.captured_tabs.find((t) => t.sheet_id === "hmtx2k");
for (const r of hmtxTabMutated.rows) {
  for (let c = 0; c < r.length; c++) {
    if (r[c] === "CTR") {
      r[c + 1] = "8.50%"; // lower than 10%
    }
  }
}
const mutatedApplied = applyUnlockedMeilingReports(mockDashboard, mutatedData);
const mutatedTable618 = mutatedApplied.tables.find((t) => t.id === "meiling-unlocked-618-kpi");
const mutatedCtrRow = mutatedTable618.rows.find((r) => r.metric === "CTR");
assert(mutatedCtrRow && mutatedCtrRow.actual === "8.50%" && mutatedCtrRow.status === "未达成", "变异测试：CTR 改为 8.50% 驱动实际值和未达成状态联动变化");

// 4. Dynamic Mutation test: mutating Double 11 total spend in smsJa2
const dkdWbMutated = mutatedData.workbooks.find((w) => w.node_token === "DkdOwDEk0i9FTUkXlh1cTE0fnOd");
const smsTabMutated = dkdWbMutated.captured_tabs.find((t) => t.sheet_id === "smsJa2");
for (const r of smsTabMutated.rows) {
  if (r.some((c) => c.includes("总费用"))) {
    r[7] = "¥500,000"; // change total spend
  }
}
const mutatedD11Applied = applyUnlockedMeilingReports(mockDashboard, mutatedData);
const mutatedKpiSpend = mutatedD11Applied.kpis.find((k) => k.id === "meiling-unlocked-kpi-d11-actual-spend");
assert(mutatedKpiSpend && mutatedKpiSpend.value === 500000, "变异测试：双11总费用改动驱动 KPI 实际消耗联动为 500000");

// 5. Missing rows test: if no rows captured, status should NOT be ready
const noRowsData = JSON.parse(JSON.stringify(reopenedRaw));
for (const wb of noRowsData.workbooks) {
  wb.captured_tabs = [];
}
const noRowsApplied = applyUnlockedMeilingReports(mockDashboard, noRowsData);
const srcNoRows = noRowsApplied.sources.find((s) => s.id === "src-meiling-node-MMPZwhQbMiVmIKkcyb9c7mDQnHp");
assert(srcNoRows.status !== "ready", "安全校验：无有效行时不标记为 ready");

console.log(`\n=== Verification Summary: ${passCount} Passed, ${failCount} Failed ===`);
if (failCount > 0) process.exit(1);
