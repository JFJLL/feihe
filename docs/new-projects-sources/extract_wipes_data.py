# -*- coding: utf-8 -*-
import csv
from datetime import datetime, timezone
import io
import json
import os
import re
import subprocess
import sys

SPREADSHEET_TOKEN = "Ero1shDTFhVzwttqDMLceZQ4nMb"
SPREADSHEET_NODE_TOKEN = "Jo2cwK3c9ishJdkq40ycfNSMnTh"
DOC_TOKEN = "LtZ5dlPvnoiA8OxsvAUcV2lAnWb"
DOC_NODE_TOKEN = "VDyYwLnG9ivYpOko7eocjEvrnag"

def run_cmd(cmd, timeout=60):
    print(f"Executing: {cmd}")
    try:
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8", timeout=timeout)
        if res.returncode != 0:
            print(f"Command failed (code {res.returncode}): {res.stderr}", file=sys.stderr)
            return None
        return json.loads(res.stdout)
    except subprocess.TimeoutExpired:
        print(f"Command timed out after {timeout}s: {cmd}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Failed to parse JSON: {e}", file=sys.stderr)
        return None

def parse_annotated_csv(annotated_csv_str):
    if not annotated_csv_str:
        return []
    lines = annotated_csv_str.splitlines()
    clean_lines = []
    row_regex = re.compile(r"^\[row=\d+\]\s*")
    for line in lines:
        clean_line = row_regex.sub("", line)
        clean_lines.append(clean_line)
    reader = csv.reader(io.StringIO("\n".join(clean_lines)))
    return [row for row in reader]

def parse_num(val):
    if isinstance(val, (int, float)):
        return val
    if not isinstance(val, str):
        return None
    cleaned = re.sub(r'[¥,%\s≤≥<>=]', '', val)
    try:
        return float(cleaned) if '.' in cleaned else int(cleaned)
    except Exception:
        return None

def get_target_item(row):
    if not row or len(row) < 6:
        return None
    tgt = row[3].strip() if len(row) > 3 and row[3] else None
    act = parse_num(row[4]) if len(row) > 4 and row[4] else None
    prog = row[5].strip() if len(row) > 5 and row[5] else None
    return {"target": tgt, "actual": act, "progress": prog}

def parse_kpi_from_og_rows(og_rows):
    if not og_rows or len(og_rows) < 12:
        return {}
    return {
        "daily_seeding": {
            "cpuv": get_target_item(og_rows[1]),
            "tao_search": get_target_item(og_rows[2]),
            "exposure_kfs": get_target_item(og_rows[3]),
            "cpm": get_target_item(og_rows[4]),
            "interaction_kfs": get_target_item(og_rows[5]),
            "cpe": get_target_item(og_rows[6]),
            "hit_rate_interactions_ge_1000": get_target_item(og_rows[7]),
        },
        "medical_expert": {
            "exposure_kfs": get_target_item(og_rows[8]),
            "cpm": get_target_item(og_rows[9]),
            "interaction_kfs": get_target_item(og_rows[10]),
            "cpe": get_target_item(og_rows[11]),
        },
        "cid": {
            "component_clicks": parse_num(og_rows[2][8]) if len(og_rows) > 2 and len(og_rows[2]) > 8 else None,
            "component_click_cost": parse_num(og_rows[3][8]) if len(og_rows) > 3 and len(og_rows[3]) > 8 else None,
        }
    }

def main():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    now_iso = datetime.now(timezone.utc).astimezone().isoformat()
    
    # 1. Fetch workbook info
    print("1. Fetching workbook info...")
    wb_info = run_cmd(f'lark-cli sheets +workbook-info --spreadsheet-token {SPREADSHEET_TOKEN} --as user --format json', timeout=60)
    sheets_meta = wb_info.get("data", {}).get("sheets", []) if wb_info else []
    
    # 2. Target sheets configuration
    target_sheets = [
        {"sheet_id": "OgJUzb", "name": "KPI", "range": "A1:S25"},
        {"sheet_id": "iPT5gI", "name": "发布&消耗进度表", "range": "A1:AJ30"},
        {"sheet_id": "9weg9y", "name": "发布数据汇总", "range": "A1:AK100"},
        {"sheet_id": "3IoENe", "name": "内容方向", "range": "A1:P30"},
        {"sheet_id": "qub0Zh", "name": "蒲公英数据底表", "range": "A1:AZ100"}
    ]
    
    sheets_result = {
        "readAt": now_iso,
        "spreadsheet_token": SPREADSHEET_TOKEN,
        "spreadsheet_node_token": SPREADSHEET_NODE_TOKEN,
        "url": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN}",
        "wiki_url": f"https://feishu.cn/wiki/{SPREADSHEET_NODE_TOKEN}",
        "title": "【易美】Y26 9-10月 稳健玉米消毒湿巾",
        "all_sheets_catalog": [
            {
                "sheet_id": s.get("sheet_id"),
                "sheet_name": s.get("sheet_name") or s.get("title") or s.get("name"),
                "row_count": s.get("row_count"),
                "column_count": s.get("column_count")
            }
            for s in sheets_meta
        ],
        "extracted_sheets": {}
    }
    
    og_clean_rows = []
    for ts in target_sheets:
        sid = ts["sheet_id"]
        sname = ts["name"]
        srange = ts["range"]
        print(f"Fetching sheet {sname} ({sid}) range {srange}...")
        cmd = f'lark-cli sheets +csv-get --spreadsheet-token {SPREADSHEET_TOKEN} --sheet-id {sid} --range {srange} --as user --format json'
        sheet_res = run_cmd(cmd, timeout=60)
        if sheet_res and sheet_res.get("ok"):
            data = sheet_res.get("data", {})
            raw_csv = data.get("annotated_csv", "")
            clean_rows = parse_annotated_csv(raw_csv)
            if sid == "OgJUzb":
                og_clean_rows = clean_rows
            sheets_result["extracted_sheets"][sid] = {
                "sheet_id": sid,
                "sheet_name": sname,
                "requested_range": srange,
                "actual_range": data.get("actual_range"),
                "current_region": data.get("current_region"),
                "row_count": data.get("row_count"),
                "col_count": data.get("col_count"),
                "annotated_csv": raw_csv,
                "rows": clean_rows
            }
        else:
            print(f"Failed to fetch {sname}")
            
    # 2.1 Dynamically parsed backend_fields from OgJUzb rows (no hardcoding)
    sheets_result["backend_fields"] = {
        "kpi": parse_kpi_from_og_rows(og_clean_rows)
    }
    
    sheets_json_path = os.path.join(out_dir, "wipes-sheets.json")
    with open(sheets_json_path, "w", encoding="utf-8") as f:
        json.dump(sheets_result, f, ensure_ascii=False, indent=2)
    print(f"Saved sheets data to {sheets_json_path}")
    
    # 3. Fetch docx weekly report
    print("3. Fetching weekly report docx...")
    doc_cmd = f'lark-cli docs +fetch --doc {DOC_TOKEN} --as user --doc-format markdown --detail simple --format json'
    doc_res = run_cmd(doc_cmd, timeout=60)
    if doc_res and doc_res.get("ok"):
        doc_data = doc_res.get("data", {}).get("document", {})
        content = doc_data.get("content", "")
        
        if content and content.strip():
            # Strip temporary authcode download URLs
            sanitized_content = re.sub(r'\s*thumbnail-url="[^"]*authcode[^"]*"', '', content)
            
            # Save markdown
            doc_md_path = os.path.join(out_dir, "wipes-weekly.md")
            with open(doc_md_path, "w", encoding="utf-8") as f:
                f.write(sanitized_content)
            print(f"Saved sanitized weekly report markdown to {doc_md_path}")
            
            # Save json with metadata
            doc_json_path = os.path.join(out_dir, "wipes-weekly.json")
            weekly_json = {
                "readAt": now_iso,
                "document_id": DOC_TOKEN,
                "node_token": DOC_NODE_TOKEN,
                "url": f"https://feishu.cn/docx/{DOC_TOKEN}",
                "wiki_url": f"https://feishu.cn/wiki/{DOC_NODE_TOKEN}",
                "title": "【周报】稳健玉米酒精湿巾Y26 9-11月",
                "revision_id": doc_data.get("revision_id"),
                "content_length": len(sanitized_content),
                "is_empty": False,
                "content": sanitized_content
            }
            with open(doc_json_path, "w", encoding="utf-8") as f:
                json.dump(weekly_json, f, ensure_ascii=False, indent=2)
            print(f"Saved sanitized weekly report JSON to {doc_json_path}")
        else:
            print("Warning: fetched document content is empty! Schema:", file=sys.stderr)
            print(json.dumps(doc_res, indent=2), file=sys.stderr)
    else:
        print(f"Failed to fetch docx weekly report. Result: {doc_res}", file=sys.stderr)

if __name__ == "__main__":
    main()
