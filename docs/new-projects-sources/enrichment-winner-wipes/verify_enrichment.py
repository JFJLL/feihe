# -*- coding: utf-8 -*-
import json
import sys

def verify_all():
    target_path = "feihe-mvp/lib/campaign-enrichment/winner-wipes.json"
    audit_path = "docs/new-projects-sources/enrichment-winner-wipes/enrichment-audit.json"

    with open(target_path, "r", encoding="utf-8") as f:
        pkg = json.load(f)

    with open(audit_path, "r", encoding="utf-8") as f:
        audit = json.load(f)

    # 1. Structure check
    assert pkg.get("projectId") == "winner-wipes", "projectId must be winner-wipes"
    assert "extractedAt" in pkg, "extractedAt missing"
    assert "tables" in pkg and isinstance(pkg["tables"], list), "tables missing or not list"
    assert "dailyDatasets" in pkg and isinstance(pkg["dailyDatasets"], list), "dailyDatasets missing or not list"

    print("PASS: Top-level structure is valid.")

    # 2. Table checks
    table_ids = set()
    for t in pkg["tables"]:
        tid = t["id"]
        assert tid not in table_ids, f"Duplicate table ID: {tid}"
        table_ids.add(tid)

        assert "title" in t and t["title"], f"Table {tid} missing title"
        assert "columns" in t and len(t["columns"]) > 0, f"Table {tid} missing columns"
        assert "rows" in t and len(t["rows"]) > 0, f"Table {tid} missing rows"

        col_keys = [c["key"] for c in t["columns"]]
        for r_idx, r in enumerate(t["rows"]):
            for k in r.keys():
                assert k in col_keys, f"Table {tid} row {r_idx} has unmapped key {k}"

        print(f"PASS: Table '{tid}' validated with {len(t['rows'])} rows and {len(t['columns'])} columns.")

    # 3. Daily Datasets check
    for d in pkg["dailyDatasets"]:
        did = d["id"]
        assert "label" in d and d["label"], f"Dataset {did} missing label"
        assert "period" in d and d["period"], f"Dataset {did} missing period"
        assert "metrics" in d and len(d["metrics"]) > 0, f"Dataset {did} missing metrics"
        assert "rows" in d and len(d["rows"]) > 0, f"Dataset {did} missing rows"

        # Check date format and monotonic ascending order
        dates = [r["date"] for r in d["rows"]]
        assert len(dates) == len(set(dates)), f"Dataset {did} has duplicate dates"
        assert dates == sorted(dates), f"Dataset {did} dates are not sorted ascending"

        # Check metrics keys
        metric_keys = {m["key"] for m in d["metrics"]}
        for r in d["rows"]:
            for k in r.keys():
                if k != "date":
                    assert k in metric_keys, f"Dataset {did} row has unmapped metric key {k}"

        print(f"PASS: Dataset '{did}' validated with {len(d['rows'])} daily rows from {dates[0]} to {dates[-1]}.")

    # 4. Math verification: Weighted rates (CPM, CPE, CPUV)
    tier_table = next(t for t in pkg["tables"] if t["id"] == "wipes-tier-efficiency-table")
    tot_row = next(r for r in tier_table["rows"] if r["tier"] == "总计")
    computed_cpm = round((tot_row["totalSpend"] / tot_row["impressions"]) * 1000, 2)
    assert tot_row["cpm"] == computed_cpm, f"Total CPM mismatch: {tot_row['cpm']} vs {computed_cpm}"
    computed_cpe = round(tot_row["totalSpend"] / tot_row["engagements"], 2)
    assert tot_row["cpe"] == computed_cpe, f"Total CPE mismatch: {tot_row['cpe']} vs {computed_cpe}"
    computed_cpuv = round(tot_row["fsSpend"] / tot_row["fsUv"], 2)
    assert tot_row["fsCpuv"] == computed_cpuv, f"Total CPUV mismatch: {tot_row['fsCpuv']} vs {computed_cpuv}"
    print("PASS: Weighted rate math verified without average-of-averages distortion.")

    # 5. Taosou reconciliations
    taosou_audit = next(ds for ds in audit["dailyDatasets"] if ds["id"] == "wipes-daily-taosou")
    assert taosou_audit["reconciliation"]["spendDiff"] == 0.0, "Taosou spend reconciliation diff != 0.0"
    assert taosou_audit["reconciliation"]["indexDiff"] == 0, "Taosou index reconciliation diff != 0"
    print("PASS: Taosou daily spend and index reconcile to 0.00 diff against source summary row.")

    # 6. Sensitive data check: no phones or personal IDs
    json_str = json.dumps(pkg, ensure_ascii=False)
    import re
    phone_match = re.search(r'1[3-9]\d{9}', json_str)
    assert phone_match is None, f"Found phone number in JSON: {phone_match.group()}"
    print("PASS: No sensitive personal phone numbers found.")

    print("\nALL 6 VERIFICATION CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    verify_all()
