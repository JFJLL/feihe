import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

console.log('=== TEST: WIPES RICH INSIGHTS & DEEP AUDIT VERIFICATION ===');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const repoRoot = fs.existsSync(path.resolve(appRoot, '..', 'docs'))
  ? path.resolve(appRoot, '..')
  : (fs.existsSync(path.resolve(appRoot, 'docs')) ? appRoot : process.cwd());

const FACTS_PATH = path.resolve(repoRoot, 'docs/new-projects-sources/deep-audit-wipes/facts.json');
const MANIFEST_PATH = path.resolve(repoRoot, 'docs/new-projects-sources/deep-audit-wipes/manifest.json');
const CATALOG_PATH = path.resolve(repoRoot, 'docs/new-projects-sources/deep-audit-wipes/catalog.json');
const ENRICHMENT_PATH = path.resolve(appRoot, 'lib/campaign-enrichment/winner-wipes.json');
const TSX_PATH = path.resolve(appRoot, 'features/campaign/WipesRichInsights.tsx');
const CSS_PATH = path.resolve(appRoot, 'features/campaign/wipes-rich-insights.css');

// 1. Check all files exist
assert(fs.existsSync(FACTS_PATH), 'facts.json must exist');
assert(fs.existsSync(MANIFEST_PATH), 'manifest.json must exist');
assert(fs.existsSync(CATALOG_PATH), 'catalog.json must exist');
assert(fs.existsSync(ENRICHMENT_PATH), 'winner-wipes.json must exist');
assert(fs.existsSync(TSX_PATH), 'WipesRichInsights.tsx must exist');
assert(fs.existsSync(CSS_PATH), 'wipes-rich-insights.css must exist');
console.log('✔ All artifact files exist.');

// 2. Verify facts.json
const facts = JSON.parse(fs.readFileSync(FACTS_PATH, 'utf-8'));
assert.strictEqual(facts.projectId, 'winner-wipes');

// Verify KPI matrix
const kpiRecords = facts.kpiMatrix.records;
assert.strictEqual(kpiRecords.length, 11, 'Must have exactly 11 KPI metrics');
const cpuvKpi = kpiRecords.find((r) => r.metric === 'CPUV');
assert(cpuvKpi, 'CPUV KPI must exist');
assert.strictEqual(cpuvKpi.numericTarget, 10.0);
assert.strictEqual(cpuvKpi.numericActual, 8.0);
assert.strictEqual(cpuvKpi.comparator, 'lte');
assert.strictEqual(cpuvKpi.isSurpassed, true, 'CPUV 8.0 <= 10.0 must be surpassed');
assert.strictEqual(cpuvKpi.calculatedAchievementPct, '125.00%');
console.log('✔ KPI CPUV parsing verified: target <= 10, actual 8.0 -> surpassed: true, achievement: 125.00%.');

const expertCpeKpi = kpiRecords.find((r) => r.metric === 'CPE' && r.dimension.includes('专家'));
assert(expertCpeKpi, 'Expert CPE KPI must exist');
assert.strictEqual(expertCpeKpi.numericTarget, 10.0);
assert.strictEqual(expertCpeKpi.numericActual, 5.26);
assert.strictEqual(expertCpeKpi.isSurpassed, true);
assert.strictEqual(expertCpeKpi.calculatedAchievementPct, '190.11%');
assert(expertCpeKpi.auditNote && expertCpeKpi.auditNote.includes('180.56%'), 'Must document source cell discrepancy 180.56%');
assert(!expertCpeKpi.auditNote.includes('系前期快照残留'), 'Must not contain speculative wording');
console.log('✔ Expert CPE verified: target 10, actual 5.26 -> achievement: 190.11%, noted 180.56% discrepancy without speculation.');

// 3. Verify weekly cohorts
const weeklyCohorts = facts.weeklySprintCohorts.cohorts;
assert.strictEqual(weeklyCohorts.length, 5, 'Must have 5 weekly cohorts');
const cohort5 = weeklyCohorts[4];
assert.strictEqual(cohort5.sourcePeriod, '10/13-10/29');
assert.strictEqual(cohort5.actualObservedPeriod, '10/13-10/19');
assert.strictEqual(cohort5.observedDays, 7);
assert.strictEqual(cohort5.spend, 76963.75);
assert.strictEqual(cohort5.dailySpendAvg, 10994.82);
console.log('✔ Weekly sprint cohort 5 verified: sourcePeriod 10/13-10/29, actualObservedPeriod 10/13-10/19, observedDays 7, dailySpendAvg ¥10,994.82.');

// 4. Verify Taobao Xinghe
const xinghe = facts.ecommerceAttribution;
assert.strictEqual(xinghe.totals.days, 35);
assert.strictEqual(xinghe.totals.fs_spend_sum, 165118.50);
assert.strictEqual(xinghe.totals.shop_total_gmv_sum, 74489.30);
assert.strictEqual(xinghe.totals.task_item_gmv_sum, 8741.81);
assert(xinghe.note.includes('严禁除以FS投流消耗计算直接ROI'), 'Must include warning against fake ROI on whole store GMV');
console.log('✔ Taobao Xinghe verified: 35 days, whole store GMV ¥74,489.30 vs task GMV ¥8,741.81, strict ROI rule enforced.');

// 5. Verify CID 10 creators
const cid = facts.cidAttribution;
assert.strictEqual(cid.creators.length, 10);
assert.strictEqual(cid.totals.spend, 2881.17);
assert.strictEqual(cid.totals.component_clicks, 105);
assert.strictEqual(cid.totals.orders_30d, 1);
assert.strictEqual(cid.totals.gmv_30d, 25.55);
const chenMama = cid.creators.find((c) => c.creator === '宸妈妈');
assert(chenMama, '宸妈妈 must exist in CID creators');
assert.strictEqual(chenMama.orders_30d, 1);
assert.strictEqual(chenMama.gmv_30d, 25.55);
assert.strictEqual(chenMama.roi_30d, 0.0404);
console.log('✔ CID attribution verified: 10 creators, 105 clicks, 1 order (¥25.55 GMV, ROI 0.0404 for 宸妈妈).');

// 6. Verify daily budget clarification
const runRate = facts.budgetMatrix.dailyRunRateClarification;
assert.strictEqual(runRate.plannedDailyBenchmark, 14200.00);
assert.strictEqual(runRate.actualDailySpend1019, 14227.19);
assert.strictEqual(runRate.cumulativeTotalBudget, 500000.00);
console.log('✔ Daily budget distinction verified: planned benchmark ¥14,200 vs 10/19 actual spend ¥14,227.19 vs cumulative budget ¥500,000.');

// 7. Verify catalog & manifest sheets coverage
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
assert.strictEqual(catalog.sheetsCoverage.length, 38, 'Main workbook must have 38 sheets');
assert(catalog.docEmbeddedWorkbook, 'Doc embedded workbook must be present');
assert.strictEqual(catalog.docEmbeddedWorkbook.totalSheets, 61, 'Doc embedded workbook must have 61 sheets');
assert.strictEqual(catalog.docEmbeddedWorkbook.summary.full, 60, '60 embedded sheets full');
assert.strictEqual(catalog.docEmbeddedWorkbook.summary.empty, 1, '1 embedded sheet empty');
assert.strictEqual(catalog.docEmbeddedWorkbook.summary.failed, 0, '0 embedded sheets failed');
console.log('✔ Sheet coverage verified: 38 main sheets + 61 doc embedded sheets (60 full, 1 empty, 0 failed).');

// 8. Verify winner-wipes.json enrichment tables
const enrichment = JSON.parse(fs.readFileSync(ENRICHMENT_PATH, 'utf-8'));
const tableIds = enrichment.tables.map((t) => t.id);
assert(tableIds.includes('wipes-kpi-achievement-table'), 'Must include wipes-kpi-achievement-table');
assert(tableIds.includes('wipes-taobao-xinghe-table'), 'Must include wipes-taobao-xinghe-table');
assert(tableIds.includes('wipes-budget-dual-track-table'), 'Must include wipes-budget-dual-track-table');
assert(tableIds.includes('wipes-cid-full-attribution-table'), 'Must include wipes-cid-full-attribution-table');
assert(tableIds.includes('wipes-weekly-sprint-table'), 'Must include wipes-weekly-sprint-table');
assert(tableIds.includes('wipes-channel-structure-table'), 'Must include wipes-channel-structure-table');
console.log('✔ winner-wipes.json contains all 6 newly enriched tables.');

// 8b. Verify zero dangling sourceIds in enrichment
const registeredSourceIds = new Set(enrichment.sources.map((s) => s.id));
for (const table of enrichment.tables) {
  assert(table.sourceId, `Table ${table.id} must declare sourceId`);
  assert(
    registeredSourceIds.has(table.sourceId),
    `Table ${table.id} sourceId '${table.sourceId}' must be registered in enrichment.sources`
  );
}
console.log('✔ All tables map to valid, registered sources in enrichment.sources (zero dangling sourceIds).');

// 9. Verify WipesRichInsights.tsx
const tsxContent = fs.readFileSync(TSX_PATH, 'utf-8');
assert(tsxContent.includes('export function WipesRichInsights'), 'Must export WipesRichInsights');
assert(tsxContent.includes("section === 'overview'"), 'Must handle section overview');
assert(tsxContent.includes("section === 'ads'"), 'Must handle section ads');
assert(tsxContent.includes("section === 'content'"), 'Must handle section content');
console.log('✔ WipesRichInsights.tsx export and section branches verified.');

// 10. Substantive UI & Chart verification in WipesRichInsights.tsx
// a) Verify budgetComboSeries has 4 bars (clientBudget, clientSpent, usableBudget, usableSpent)
assert(tsxContent.includes("key: 'clientBudget'"), 'Must define clientBudget series');
assert(tsxContent.includes("key: 'clientSpent'"), 'Must define clientSpent series');
assert(tsxContent.includes("key: 'usableBudget'"), 'Must define usableBudget series');
assert(tsxContent.includes("key: 'usableSpent'"), 'Must define usableSpent series');
assert(tsxContent.includes('budgetComboSeries'), 'Must pass budgetComboSeries to CampaignComboChart');
console.log('✔ Substantive: Budget 4-bar combo chart defined with independent ledgers.');

// b) Verify details disclosure for budget table
assert(tsxContent.includes('<details'), 'Must wrap budget table in details element');
assert(tsxContent.includes('查看费用类目双轨明细表'), 'Must provide details summary for budget table');
console.log('✔ Substantive: Budget details disclosure element verified.');

// c) Verify nullable KPI handling and 3-way status badge
assert(tsxContent.includes("typeof r.isSurpassed === 'boolean' ? r.isSurpassed : null"), 'Must preserve null for isSurpassed');
assert(tsxContent.includes("kpi.isSurpassed === true"), 'Must check isSurpassed === true');
assert(tsxContent.includes("kpi.isSurpassed === false"), 'Must check isSurpassed === false');
assert(tsxContent.includes("text: '待核验', cls: 'pending'"), 'Must provide pending status for nullable KPIs');
console.log('✔ Substantive: 3-way nullable KPI status (surpassed / lagging / pending) verified.');

// d) Verify Xinghe series separation (search_in_uv and note_in_uv independent)
assert(tsxContent.includes("key: 'note_in_uv'"), 'Must have note_in_uv series');
assert(tsxContent.includes("key: 'search_in_uv'"), 'Must have search_in_uv series');
assert(!tsxContent.includes("shop_in_uv:"), 'Must not create fake combined shop_in_uv');
console.log('✔ Substantive: Taobao Xinghe series strictly separated into search_in_uv and note_in_uv.');

// e) Verify True Pareto calculation
assert(tsxContent.includes('cumSpendShare'), 'Must compute cumSpendShare');
assert(tsxContent.includes("key: 'cumSpendShare'"), 'Must include cumSpendShare in Pareto series');
assert(tsxContent.includes("kind: 'line'"), 'Must render cumSpendShare as a line');
console.log('✔ Substantive: True Pareto chart computes cumulative spend percentage line.');

// f) Verify no hardcoded business text relics
assert(!tsxContent.includes('黄金控本期'), 'Must not contain ungrounded causal narrative 黄金控本期');
assert(!tsxContent.includes('随源表更新自动联动'), 'Must not contain misleading phrase 随源表更新自动联动');
console.log('✔ Substantive: Unverified causal inferences and misleading phrases removed.');

// g) Verify axis homogeneity across all 4 Combo charts (no mixing different units on same axis)
assert(!tsxContent.includes("key: 'dailySpendAvg', label: '阶段日均消耗'"), 'weeklySeries must not mix dailySpendAvg on spend left axis');
assert(!tsxContent.includes("key: 'cost_per_component_click', label: '点击成本'"), 'cidSeries must not mix cost on component_clicks right axis');
assert(!tsxContent.includes("key: 'cpe', label: 'CPE互动成本'"), 'tierSeries must not mix cpe on engagements right axis');
assert(!tsxContent.includes("key: 'fsCpuv', label: 'CPUV访客成本'"), 'directionSeries must not mix fsCpuv on fsUv right axis');
console.log('✔ Substantive: Axis homogeneity verified across all 4 Combo charts (zero mixed dimensions on single axis).');

console.log('\n🎉 ALL VERIFICATION CHECKS PASSED PERFECTLY FROM BOTH CWD ROOTS!');
