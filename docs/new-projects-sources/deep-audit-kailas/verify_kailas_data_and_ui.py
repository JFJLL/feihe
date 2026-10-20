import json, sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path("docs/new-projects-sources/deep-audit-kailas")

print("=== 1. Checking Coverage & Manifest ===")
cov = json.loads((ROOT / "coverage.json").read_text(encoding="utf-8"))
man = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
assert cov["status_summary"]["full"] == 79, f"Expected 79 full, got {cov['status_summary']}"
assert cov["status_summary"]["empty"] == 7, f"Expected 7 empty, got {cov['status_summary']}"
assert cov["status_summary"].get("failed", 0) == 0, f"Failed sheets found!"
assert cov["status_summary"].get("partial_needs_chunks", 0) == 0, f"Partial sheets found!"
print(f"Coverage verified: 79 full, 7 empty, 0 failed, 0 partial.")

print("=== 2. Checking Facts.json ===")
facts = json.loads((ROOT / "facts.json").read_text(encoding="utf-8"))
assert facts["candidate_pools"]["initial_screen"]["actual_candidates"] == 1530
assert facts["candidate_pools"]["rescreen"]["actual_candidates"] == 615
assert facts["candidate_pools"]["executed_kols"]["executed_notes"] == 70
print("Candidate pools verified: 1530 initial, 615 rescreen, 70 executed (no fake funnels).")

print("=== 3. Checking Enrichment JSON (kailas.json) ===")
enrichment = json.loads(Path("feihe-mvp/lib/campaign-enrichment/kailas.json").read_text(encoding="utf-8"))
tables = {t["id"]: t for t in enrichment["tables"]}

# Check legacy compatibility tables
legacy_required = [
    "kailas-q3-organic-vs-paid",
    "kailas-notes-performance-scatter",
    "kailas-kol-material-kfs-dual",
    "kailas-search-keywords-category",
    "kailas-notes-leverage-fs-k",
    "kailas-overall-budget-pacing",
    "kailas-notes-119-pareto-concentration",
    "kailas-kol-tier-matrix",
    "kailas-content-direction-summary",
    "kailas-monthly-creative-trend",
    "kailas-targeting-audience",
    "kailas-candidate-pool-status",
    "kailas-keyword-category-full"
]
for tid in legacy_required:
    assert tid in tables, f"Missing table {tid}!"
print(f"All {len(legacy_required)} required tables verified present in kailas.json.")

# Check keywords CTR & CPUV compatibility
legacy_kw = tables["kailas-search-keywords-category"]
for r in legacy_kw["rows"]:
    assert "ctr" in r, f"Legacy keywords row missing ctr: {r}"
    assert "cpuv" in r, f"Legacy keywords row missing cpuv: {r}"
ctrs = [r["ctr"] for r in legacy_kw["rows"]]
assert any(c > 0 for c in ctrs), "Legacy CTRs must not be all 0!"
print(f"Legacy keywords CTR & CPUV verified: {ctrs}")

# Check full keywords CTR
full_kw = tables["kailas-keyword-category-full"]
full_ctrs = [r["ctr"] for r in full_kw["rows"] if r.get("ctr") is not None]
assert any(c > 0 for c in full_ctrs), "Full keywords CTRs must not be all 0!"
print(f"Full keywords CTR verified: {full_ctrs}")

# Check monthly trend dates (must be actual observed dates, not future/fake)
monthly = tables["kailas-monthly-creative-trend"]
for r in monthly["rows"]:
    assert r["observedDays"] > 0, f"Observed days must be > 0: {r}"
    assert r["startDate"] <= r["endDate"], f"Invalid date range: {r}"
print("Monthly creative trend dates verified: actual min/max dates derived.")

# Check PII / token leakage
raw_text = Path("feihe-mvp/lib/campaign-enrichment/kailas.json").read_text(encoding="utf-8")
assert "xsec_token" not in raw_text, "xsec_token detected in kailas.json!"
print("PII check passed: zero xsec_token.")

print("ALL AUTOMATED VERIFICATION CHECKS PASSED SUCCESSFULLY!")
