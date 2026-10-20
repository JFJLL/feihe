import json
import subprocess
import os
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

work_dir = "docs/new-projects-sources/deep-audit-meiling"
raw_dir = os.path.join(work_dir, "raw_sheets")
os.makedirs(raw_dir, exist_ok=True)

catalog_path = os.path.join(work_dir, "catalog.json")
with open(catalog_path, "r", encoding="utf-8") as f:
    catalog = json.load(f)

# -------------------------------------------------------------
# 1. Fetch missing Base tables (6 missing)
# -------------------------------------------------------------
base_token = catalog["base_inventory"]["base_token"]
remaining_base_tables = [
    {"id": "tblEE8G56GSpngf1", "name": "7-8月产品匹配规则", "out": "base_78_matching.ndjson"},
    {"id": "tbltCR6P2mQIidsd", "name": "7-8月样机信息表", "out": "base_78_yangji.ndjson"},
    {"id": "tblohi0dmMCuJ4wm", "name": "7-8月KOC(供图)进度表", "out": "base_78_koc.ndjson"},
    {"id": "tblnAwGAiAAMNu2z", "name": "618产品匹配规则", "out": "base_618_matching.ndjson"},
    {"id": "tblObq4NnsHMFT2t", "name": "618样机信息表", "out": "base_618_yangji.ndjson"},
    {"id": "tblxEoETSU6uBBSN", "name": "618KOC(供图)进度表", "out": "base_618_koc.ndjson"}
]

for t in remaining_base_tables:
    out_path = os.path.join(work_dir, t["out"])
    if not os.path.exists(out_path):
        print(f"Fetching Base table {t['name']} ({t['id']})...")
        cmd = [
            "lark-cli.cmd", "base", "+record-list",
            "--base-token", base_token,
            "--table-id", t["id"],
            "--format", "ndjson",
            "--limit", "2000",
            "--output", out_path,
            "--overwrite",
            "--as", "user"
        ]
        p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print(f"  Result: {p.returncode}")

# -------------------------------------------------------------
# 2. Fetch all missing sheets from workbooks
# -------------------------------------------------------------
wb_map = {
    "DkdO_double11_daily": {"token": "RoAtsw3KTh56ZBtT7cmcTYaznJb", "prefix": "DkdO_daily"},
    "HNDC_kpi_mgmt": {"token": "N2bssx2dBh8xyItaFEfccqaznHY", "prefix": "HNDC_kpi"},
    "MMPZ_618_review": {"token": "XSKrspszhhgvPvtxMNicmYlUnEc", "prefix": "MMPZ_618"}
}

coverage_records = []

for wb in catalog["workbooks_inventory"]:
    wb_name = wb["name"]
    info = wb_map[wb_name]
    wb_token = info["token"]
    prefix = info["prefix"]
    
    for s in wb["sheets"]:
        s_id = s["sheet_id"]
        s_name = s["sheet_name"]
        row_cap = s.get("row_count", 0)
        safe_name = "".join(c for c in s_name if c.isalnum() or c in ("_", "-"))
        out_file = f"{prefix}_{s_id}_{safe_name}.json"
        out_path = os.path.join(raw_dir, out_file)
        
        # If already exists and valid
        if os.path.exists(out_path):
            try:
                with open(out_path, "r", encoding="utf-8") as fp:
                    d = json.load(fp)
                data = d.get("data", {})
                actual_range = data.get("actual_range", "")
                has_more = data.get("has_more", False)
                r_cnt = data.get("row_count", 0)
                
                # evaluate status
                csv_text = data.get("annotated_csv", "")
                status = "full"
                if not actual_range or r_cnt == 0:
                    status = "empty"
                elif all("#REF!" in line or not line.strip() for line in csv_text.splitlines()[1:] if line.strip()):
                    status = "ref_error"
                
                coverage_records.append({
                    "workbook": wb_name,
                    "sheet_id": s_id,
                    "sheet_name": s_name,
                    "row_count": r_cnt,
                    "col_count": data.get("col_count", 0),
                    "actual_range": actual_range,
                    "has_more": has_more,
                    "status": status,
                    "cached": True
                })
                continue
            except Exception:
                pass
        
        # Download
        print(f"Downloading sheet {wb_name} -> {s_name} ({s_id}, ~{row_cap} rows)...")
        # For large sheets (> 2000 rows), use max-chars 500000 or output-path
        cmd = [
            "lark-cli.cmd", "sheets", "+csv-get",
            "--spreadsheet-token", wb_token,
            "--sheet-id", s_id,
            "--as", "user",
            "--format", "json"
        ]
        if row_cap > 5000:
            cmd.extend(["--max-chars", "1000000"])
            
        p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if p.returncode == 0:
            try:
                data_obj = json.loads(p.stdout.decode("utf-8"))
                with open(out_path, "w", encoding="utf-8") as fp:
                    json.dump(data_obj, fp, ensure_ascii=False)
                d = data_obj.get("data", {})
                actual_range = d.get("actual_range", "")
                has_more = d.get("has_more", False)
                r_cnt = d.get("row_count", 0)
                csv_text = d.get("annotated_csv", "")
                status = "full"
                if not actual_range or r_cnt == 0:
                    status = "empty"
                elif all("#REF!" in line or not line.strip() for line in csv_text.splitlines()[1:] if line.strip()):
                    status = "ref_error"
                    
                coverage_records.append({
                    "workbook": wb_name,
                    "sheet_id": s_id,
                    "sheet_name": s_name,
                    "row_count": r_cnt,
                    "col_count": d.get("col_count", 0),
                    "actual_range": actual_range,
                    "has_more": has_more,
                    "status": status,
                    "cached": False
                })
                print(f"  OK: range={actual_range}, rows={r_cnt}, has_more={has_more}")
            except Exception as e:
                print(f"  Parse error: {e}")
        else:
            err = p.stderr.decode("utf-8", errors="replace")
            print(f"  Fail: {err[:150]}")
            coverage_records.append({
                "workbook": wb_name,
                "sheet_id": s_id,
                "sheet_name": s_name,
                "status": "failed",
                "error": err[:150]
            })
        time.sleep(0.3)

with open(os.path.join(work_dir, "coverage_audit.json"), "w", encoding="utf-8") as fp:
    json.dump(coverage_records, fp, ensure_ascii=False, indent=2)

print("Coverage download script finished!")
