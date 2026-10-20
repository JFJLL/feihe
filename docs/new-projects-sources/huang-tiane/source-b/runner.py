
import os, sys, json, subprocess, time, datetime

TARGET_DIR = r"docs/new-projects-sources/huang-tiane/source-b"
RAW_DIR = os.path.join(TARGET_DIR, "raw")
os.makedirs(RAW_DIR, exist_ok=True)

tz_cst = datetime.timezone(datetime.timedelta(hours=8))
now_iso = datetime.datetime.now(tz_cst).isoformat()

workbooks = [
    {
        "key": "brand_fs",
        "token": "F42ksAyO8hKRGNt2plhccnSWnNh",
        "title": "黄天鹅品牌线26年10月项目报表-fs",
        "url": "https://yimeichuanbo.feishu.cn/sheets/F42ksAyO8hKRGNt2plhccnSWnNh?sheet=Nm3Sev",
        "role": "canonical_brand"
    },
    {
        "key": "shangxiao",
        "token": "SgrMsEgYFhtxALtFK6Acf849n56",
        "wiki_node_token": "CqyPwlUTNiiD0lkXlZJcuyIYnCc",
        "title": "黄天鹅商销日报表 副本",
        "url": "https://yimeichuanbo.feishu.cn/wiki/CqyPwlUTNiiD0lkXlZJcuyIYnCc",
        "role": "canonical_shangxiao"
    }
]

catalog = {
    "project": "huang-tiane",
    "sub_agent": "source-b",
    "updated_at": now_iso,
    "status": "fetching",
    "notes": {
        "brand_fs": "Canonical brand performance workbook (17 sheets)",
        "shangxiao": "Canonical commercial sales workbook (8 sheets). Token: SgrMsEgYFhtxALtFK6Acf849n56",
        "alternate_shangxiao_token": "K0GQsM5aohAdG9tyOC4cAzNFnYf (Agent A duplicate copy; will be compared to avoid 2x double counting)"
    },
    "workbooks": []
}

def run_cmd(cmd_str):
    p = subprocess.run(cmd_str, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return p.stdout, p.stderr, p.returncode

for wb in workbooks:
    token = wb["token"]
    print("Inspecting workbook " + wb["title"] + " (" + token + ")...")
    stdout, stderr, code = run_cmd(f"lark-cli sheets +workbook-info --token {token}")
    if code != 0:
        print("Error workbook-info: " + stderr)
        continue
    info = json.loads(stdout)
    sheets = info["data"]["sheets"]
    wb_entry = {
        "workbook_key": wb["key"],
        "title": wb["title"],
        "token": token,
        "url": wb["url"],
        "role": wb["role"],
        "revision": info["data"].get("revision"),
        "sheets_count": len(sheets),
        "sheets": []
    }
    for s in sheets:
        s_item = {
            "sheet_id": s["sheet_id"],
            "sheet_name": s["sheet_name"],
            "index": s["index"],
            "row_count": s["row_count"],
            "col_count": s["column_count"],
            "is_hidden": s.get("is_hidden", False),
            "frozen_rows": s.get("frozen_rows", 0),
            "frozen_cols": s.get("frozen_columns", 0),
            "pivot_table_count": s.get("pivot_table_count", 0),
            "read_status": "pending"
        }
        wb_entry["sheets"].append(s_item)
    catalog["workbooks"].append(wb_entry)

with open(os.path.join(TARGET_DIR, "catalog.json"), "w", encoding="utf-8") as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)
with open(os.path.join(TARGET_DIR, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print("Catalog saved with all sheets listed. Now reading raw data...")

for wb in catalog["workbooks"]:
    wb_key = wb["workbook_key"]
    wb_token = wb["token"]
    for s in wb["sheets"]:
        sid = s["sheet_id"]
        sname = s["sheet_name"]
        out_file = os.path.join(RAW_DIR, wb_key + "_" + sid + ".json")
        print("Fetching " + wb_key + " / " + sname + " (" + sid + ", " + str(s["row_count"]) + "x" + str(s["col_count"]) + ")...")
        t0 = time.time()
        cmd = f"lark-cli sheets +csv-get --spreadsheet-token {wb_token} --sheet-id {sid} --output-path \"{out_file}\" --as user"
        stdout, stderr, code = run_cmd(cmd)
        dur = time.time() - t0
        if code != 0:
            print("  Failed: " + stderr)
            s["read_status"] = "error"
            s["error"] = stderr
        else:
            try:
                res = json.loads(stdout)
                complete = res.get("data", {}).get("complete", False)
                bytes_w = res.get("data", {}).get("bytes_written", 0)
                s["read_status"] = "done" if complete else "truncated"
                s["complete"] = complete
                s["raw_file"] = wb_key + "_" + sid + ".json"
                s["raw_bytes"] = bytes_w
                s["fetch_duration_sec"] = round(dur, 2)
                print("  Done in " + str(round(dur, 1)) + "s, bytes: " + str(bytes_w) + ", complete: " + str(complete))
            except Exception as e:
                print("  Parse error: " + str(e))
                s["read_status"] = "parse_error"

catalog["status"] = "raw_fetched"
catalog["updated_at"] = datetime.datetime.now(tz_cst).isoformat()

with open(os.path.join(TARGET_DIR, "catalog.json"), "w", encoding="utf-8") as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)
with open(os.path.join(TARGET_DIR, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print("All 25 sheets fetched! Catalog and manifest updated.")
