import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getCampaignEnrichment,
  mergeById,
  mergeCampaignEnrichment,
} from "../lib/campaign-enrichment-server.ts";

console.log("=== Starting Campaign Enrichment Server & Isolation Test Suite ===\n");

// 1. Whitelist & Project Matching Verification
console.log("1. Testing getCampaignEnrichment whitelist & projectId validation...");
{
  // Whitelisted projects
  const kailasEnrich = getCampaignEnrichment("kailas");
  assert.ok(kailasEnrich, "kailas enrichment should be present");
  assert.equal(kailasEnrich.projectId, "kailas");

  const meilingEnrich = getCampaignEnrichment("meiling");
  assert.ok(meilingEnrich, "meiling enrichment should be present");
  assert.equal(meilingEnrich.projectId, "meiling");

  const wipesEnrich = getCampaignEnrichment("winner-wipes");
  assert.ok(wipesEnrich, "winner-wipes enrichment should be present");
  assert.equal(wipesEnrich.projectId, "winner-wipes");

  // Non-whitelisted or invalid projects must return null
  assert.equal(getCampaignEnrichment("qicui"), null, "qicui is not whitelisted, must return null");
  assert.equal(getCampaignEnrichment("random-fake"), null, "unknown project must return null");
  assert.equal(getCampaignEnrichment(""), null, "empty project must return null");
  assert.equal(getCampaignEnrichment(null), null, "null project must return null");
  console.log("  ✓ Whitelist filtering and projectId validation passed.");
}

// 2. Testing mergeById Pure Helper (Same-ID overwrite, append new)
console.log("\n2. Testing mergeById helper (same-ID overwrite & append)...");
{
  const base = [
    { id: "s1", name: "Source 1", value: 100 },
    { id: "s2", name: "Source 2 Base", value: 200 },
  ];
  const incoming = [
    { id: "s2", name: "Source 2 Updated", value: 999 }, // Overwrite
    { id: "s3", name: "Source 3 New", value: 300 },     // Append
  ];

  const merged = mergeById(base, incoming);
  assert.equal(merged.length, 3, "Merged array should have 3 items");
  assert.equal(merged[0].id, "s1");
  assert.equal(merged[0].value, 100, "Base item preserved");
  assert.equal(merged[1].id, "s2");
  assert.equal(merged[1].name, "Source 2 Updated", "Same ID overwrites base");
  assert.equal(merged[1].value, 999);
  assert.equal(merged[2].id, "s3");
  assert.equal(merged[2].name, "Source 3 New", "New ID appended");

  // Empty edge cases
  assert.deepEqual(mergeById([], []), []);
  assert.deepEqual(mergeById(base, []), base);
  assert.deepEqual(mergeById([], incoming), incoming);
  console.log("  ✓ mergeById helper behaves deterministically.");
}

// 3. Testing mergeCampaignEnrichment Strict Project Isolation
console.log("\n3. Testing mergeCampaignEnrichment project isolation...");
{
  const baseDashboard = {
    projectId: "kailas",
    name: "Kailas Campaign",
    reportPeriod: "2026-Q3",
    updatedAt: "2026-10-20",
    sources: [{ id: "src-1", name: "Base Source" }],
    kpis: [],
    tables: [{ id: "tbl-1", title: "Base Table", columns: [], rows: [] }],
    actions: { items: [] },
    warnings: [],
    dailyDatasets: [{ id: "ds-base", name: "Base Daily", rows: [] }],
  };

  // Attempting to merge meiling payload into kailas dashboard MUST BE REJECTED
  const meilingPayload = {
    projectId: "meiling",
    tables: [{ id: "tbl-meiling", title: "Meiling Injected Table", columns: [], rows: [] }],
  };

  const isolated = mergeCampaignEnrichment(baseDashboard, meilingPayload);
  assert.equal(isolated.tables.length, 1, "Cross-project payload must NOT be merged");
  assert.equal(isolated.tables[0].id, "tbl-1", "Only original project table preserved");

  // Attempting to merge payload with empty projectId MUST BE REJECTED
  const emptyProjectPayload = {
    projectId: "",
    tables: [{ id: "tbl-empty", title: "Empty Project Table", columns: [], rows: [] }],
  };
  const guardedEmpty = mergeCampaignEnrichment(baseDashboard, emptyProjectPayload);
  assert.equal(guardedEmpty.tables.length, 1, "Empty projectId payload must be rejected");

  console.log("  ✓ Cross-project and empty-projectId payloads strictly guarded against leakage.");
}

// 4. Testing Null / Missing Dataset Preservation ("无新dataset保留旧")
console.log("\n4. Testing null/empty dataset preservation...");
{
  const baseDashboard = {
    projectId: "winner-wipes",
    name: "Wipes Campaign",
    reportPeriod: "2026-10",
    updatedAt: "2026-10-20",
    sources: [{ id: "src-base", name: "Old Source" }],
    kpis: [],
    tables: [{ id: "tbl-base", title: "Old Table", columns: [], rows: [] }],
    actions: { items: [] },
    warnings: [],
    dailyDatasets: [{ id: "ds-keep", name: "Existing Daily Dataset", rows: [{ date: "2026-10-01" }] }],
  };

  // Enrichment payload with NO dailyDatasets
  const enrichmentNoDatasets = {
    projectId: "winner-wipes",
    tables: [{ id: "tbl-new", title: "New Enriched Table", columns: [], rows: [] }],
  };

  const merged = mergeCampaignEnrichment(baseDashboard, enrichmentNoDatasets);
  assert.equal(merged.dailyDatasets.length, 1, "Existing dailyDataset strictly preserved");
  assert.equal(merged.dailyDatasets[0].id, "ds-keep");
  assert.equal(merged.tables.length, 2, "Tables merged properly");

  // Enrichment payload with overlapping dailyDatasets: same ID overwrites, new ID appends
  const enrichmentWithDatasets = {
    projectId: "winner-wipes",
    dailyDatasets: [
      { id: "ds-keep", name: "Updated Daily Dataset", rows: [{ date: "2026-10-02" }] },
      { id: "ds-added", name: "Added Daily Dataset", rows: [] },
    ],
  };

  const mergedWithDatasets = mergeCampaignEnrichment(baseDashboard, enrichmentWithDatasets);
  assert.equal(mergedWithDatasets.dailyDatasets.length, 2, "Daily datasets merged with overwrite and append");
  assert.equal(mergedWithDatasets.dailyDatasets[0].name, "Updated Daily Dataset", "Same ID daily dataset overwritten");
  assert.equal(mergedWithDatasets.dailyDatasets[1].id, "ds-added", "New daily dataset appended");
  console.log("  ✓ Existing dailyDatasets strictly preserved when incoming has no dataset; overwritten when same ID.");
}

// 5. Client Bundle Isolation Check (Forbidden to import enrichment JSONs in client files)
console.log("\n5. Verifying client bundle isolation (no enrichment JSON imported in client files)...");
{
  const clientDirs = ["features", "components"];
  for (const dir of clientDirs) {
    const fullDir = path.resolve(dir);
    if (!fs.existsSync(fullDir)) continue;
    const files = fs.readdirSync(fullDir, { recursive: true });
    for (const f of files) {
      if (typeof f !== "string" || (!f.endsWith(".tsx") && !f.endsWith(".ts"))) continue;
      const fPath = path.join(fullDir, f);
      const code = fs.readFileSync(fPath, "utf8");
      assert(
        !code.includes("campaign-enrichment/") || fPath.includes("server"),
        `Forbidden enrichment JSON import found in client file: ${fPath}`
      );
    }
  }
  console.log("  ✓ No client component or page imports enrichment JSON directly.");
}

console.log("\n===============================================================");
console.log("🎉 ALL CAMPAIGN ENRICHMENT SERVER & ISOLATION TESTS PASSED (5/5)!");
console.log("===============================================================");
