import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCampaignDailyDatasetsByProject } from "../lib/campaign-daily-server.ts";
import { getCampaignDailyDatasets } from "../lib/campaign-daily.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.resolve(__dirname, "../lib/campaign-daily-data.json");
const clientDailyPath = path.resolve(__dirname, "../lib/campaign-daily.ts");

console.log("1. Checking client bundle safety: campaign-daily.ts must NOT import json directly...");
const clientDailyCode = fs.readFileSync(clientDailyPath, "utf-8");
assert(
  !clientDailyCode.includes("campaign-daily-data.json"),
  "Security violation: client-side lib/campaign-daily.ts must not import campaign-daily-data.json directly"
);
console.log("   [PASS] Client code does not bundle raw daily data JSON");

console.log("\n2. Checking raw json existence and size...");
assert(fs.existsSync(jsonPath), "campaign-daily-data.json must exist");
const stat = fs.statSync(jsonPath);
console.log(`   File size: ${(stat.size / 1024).toFixed(2)} KB`);
assert(stat.size < 200 * 1024, "File size must be strictly < 200KB");

// 3. Server extractor tests
console.log("\n3. Testing Server Extractor getCampaignDailyDatasetsByProject...");

// Winner wipes
const wipesDatasets = getCampaignDailyDatasetsByProject("winner-wipes");
assert(Array.isArray(wipesDatasets), "winner-wipes must be an array");
assert.equal(wipesDatasets.length, 2, "winner-wipes should have 2 datasets");

const wipesDelivery = wipesDatasets.find((d) => d.id === "wipes-daily-delivery");
assert(wipesDelivery, "wipes-daily-delivery dataset must exist");
assert.equal(wipesDelivery.rows.length, 33, "wipes-daily-delivery should have 33 daily points");
assert.equal(wipesDelivery.rows[0].date, "2026-09-16");
assert.equal(wipesDelivery.rows[32].date, "2026-10-18");

const wipesTaosou = wipesDatasets.find((d) => d.id === "wipes-daily-taosou");
assert(wipesTaosou, "wipes-daily-taosou dataset must exist");
assert.equal(wipesTaosou.rows.length, 35, "wipes-daily-taosou should have 35 daily points");

// Meiling
const meilingDatasets = getCampaignDailyDatasetsByProject("meiling");
assert(Array.isArray(meilingDatasets), "meiling must be an array");
assert.equal(meilingDatasets.length, 3, "meiling should have 3 datasets");

const meilingCid = meilingDatasets.find((d) => d.id === "meiling-daily-cid-jd");
assert(meilingCid, "meiling-daily-cid-jd dataset must exist");
assert.equal(meilingCid.rows.length, 3, "meiling CID should have 3 daily points");

// Kailas
const kailasDatasets = getCampaignDailyDatasetsByProject("kailas");
assert(Array.isArray(kailasDatasets), "kailas must be an array");
assert.equal(kailasDatasets.length, 1, "kailas should have 1 dataset");

const kailasCreatives = kailasDatasets.find((d) => d.id === "kailas-daily-fuga-creatives");
assert(kailasCreatives, "kailas-daily-fuga-creatives dataset must exist");
assert.equal(kailasCreatives.rows.length, 12, "kailas creatives should have 12 daily points");
assert.equal(
  kailasCreatives.rows.reduce((acc, r) => acc + r.creatives_count, 0),
  7750,
  "All 7750 creatives must be accounted for"
);

// Empty / invalid project
assert.deepEqual(getCampaignDailyDatasetsByProject("non-existent"), [], "Non-existent project must return empty array");
assert.deepEqual(getCampaignDailyDatasetsByProject(""), [], "Empty project must return empty array");

console.log("   [PASS] Server extractor properly isolates project daily datasets");

console.log("\n4. Testing Client Selector getCampaignDailyDatasets...");
// Empty/null cases
assert.deepEqual(getCampaignDailyDatasets(null), [], "null dashboard must return empty array");
assert.deepEqual(getCampaignDailyDatasets(undefined), [], "undefined dashboard must return empty array");
assert.deepEqual(getCampaignDailyDatasets({}), [], "dashboard without dailyDatasets must return empty array");

// Populated case
const mockDashboard = {
  projectId: "meiling",
  dailyDatasets: meilingDatasets,
};
assert.equal(getCampaignDailyDatasets(mockDashboard), meilingDatasets, "Must return attached dailyDatasets");
console.log("   [PASS] Client selector handles empty and populated states safely");

console.log("\nALL DAILY DATASET SECURITY & CONTRACT TESTS PASSED!");
