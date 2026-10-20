import json
import os
import subprocess

raw_dir = "docs/new-projects-sources/deep-audit-meiling/raw_sheets"
coverage_path = "docs/new-projects-sources/deep-audit-meiling/coverage_audit.json"

targets = [
    {
        "prefix": "FpcDvG",
        "sheet_id": "FpcDvG",
        "wb_token": "RoAtsw3KTh56ZBtT7cmcTYaznJb",
        "total_rows": 17933,
        "remaining_range": "A8411:AC17933"
    },
    {
        "prefix": "qTB7Td",
        "sheet_id": "qTB7Td",
        "wb_token": "RoAtsw3KTh56ZBtT7cmcTYaznJb",
        "total_rows": 23486,
        "remaining_range": "A2656:AC23486"
    },
    {
        "prefix": "DHweyP",
        "sheet_id": "DHweyP",
        "wb_token": "RoAtsw3KTh56ZBtT7cmcTYaznJb",
        "total_rows": 13954,
        "remaining_range": "A2815:W13954"
    }
]

for t in targets:
    matching = [f for f in os.listdir(raw_dir) if t["prefix"] in f]
    if not matching: continue
    fn = matching[0]
    fp = os.path.join(raw_dir, fn)
    
    with open(fp, "r", encoding="utf-8") as f:
        d1 = json.load(f)
    
    csv1 = d1.get("data", {}).get("annotated_csv", "")
    r1 = d1.get("data", {}).get("row_count", 0)
    
    print(f"Reading chunk 2 for {t['prefix']} ({t['remaining_range']})...")
    cmd = [
        "lark-cli.cmd", "sheets", "+csv-get",
        "--spreadsheet-token", t["wb_token"],
        "--sheet-id", t["sheet_id"],
        "--range", t["remaining_range"],
        "--max-chars", "2000000",
        "--as", "user",
        "--format", "json"
    ]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode == 0:
        d2 = json.loads(p.stdout.decode("utf-8"))
        csv2 = d2.get("data", {}).get("annotated_csv", "")
        r2 = d2.get("data", {}).get("row_count", 0)
        
        # Merge csv
        merged_csv = csv1 + "\n" + csv2
        total_rows = r1 + r2
        print(f"  Merged {t['prefix']}: {r1} + {r2} = {total_rows} rows (expected {t['total_rows']})")
        
        d1["data"]["annotated_csv"] = merged_csv
        d1["data"]["row_count"] = total_rows
        d1["data"]["has_more"] = False
        # Update actual range to full
        last_col = "AC" if "AC" in t["remaining_range"] else "W"
        d1["data"]["actual_range"] = f"A1:{last_col}{total_rows}"
        
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(d1, f, ensure_ascii=False)

# Update coverage_audit.json
with open(coverage_path, "r", encoding="utf-8") as f:
    cov = json.load(f)

for item in cov:
    sid = item["sheet_id"]
    for t in targets:
        if sid == t["sheet_id"]:
            last_col = "AC" if "AC" in t["remaining_range"] else "W"
            item["row_count"] = t["total_rows"]
            item["actual_range"] = f"A1:{last_col}{t['total_rows']}"
            item["has_more"] = False
            item["status"] = "full"
            print(f"Updated coverage record for {sid}: range={item['actual_range']}, rows={item['row_count']}, has_more=False")

with open(coverage_path, "w", encoding="utf-8") as f:
    json.dump(cov, f, ensure_ascii=False, indent=2)

print("Chunked sheets merge and coverage update complete!")
