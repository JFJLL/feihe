import subprocess
import json
import os
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

work_dir = "docs/new-projects-sources/deep-audit-meiling"
raw_sheets_dir = os.path.join(work_dir, "raw_sheets")
os.makedirs(raw_sheets_dir, exist_ok=True)

workbooks_sheets = [
    # HNDC KPI management
    {
        "wb_name": "HNDC_kpi",
        "wb_token": "N2bssx2dBh8xyItaFEfccqaznHY",
        "sheets": [
            {"id": "4SGaOf", "name": "双11进度更新"},
            {"id": "SI0mQy", "name": "双11筛号进度透视表"},
            {"id": "L986LN", "name": "7-8月kpi进度总览"},
            {"id": "FkLCad", "name": "618kpi进度总览"},
            {"id": "YDZeE4", "name": "数据透视表"},
            {"id": "5FDWQS", "name": "Sheet10"},
            {"id": "1Km6lH", "name": "618达人数据明细"},
            {"id": "duEfmf", "name": "7-8月达人数据明细"}
        ]
    },
    # DkdO Double 11 Daily
    {
        "wb_name": "DkdO_daily",
        "wb_token": "RoAtsw3KTh56ZBtT7cmcTYaznJb",
        "sheets": [
            {"id": "smsJa2", "name": "byday汇总数据"},
            {"id": "hKnPdA", "name": "笔记数据"},
            {"id": "7pkBrd", "name": "城市数据"},
            {"id": "NFsNpI", "name": "年龄分布"},
            {"id": "mG2COI", "name": "笔记&词类"},
            {"id": "Y7qNOu", "name": "打款"},
            {"id": "BZjmuN", "name": "自采&代采数据汇总"},
            {"id": "iautvs", "name": "日-投放数据（自采天猫种草)"},
            {"id": "0Ng4EP", "name": "定向人群（自采天猫种草）"},
            {"id": "xKvzRm", "name": "日-投放数据（自采红猫cid）"},
            {"id": "HGgP2Z", "name": "定向人群（自采红猫cid）"},
            {"id": "B5TBE7", "name": "日-投放数据（自采京东种草)"},
            {"id": "TBQTUR", "name": "定向人群（自采京东种草）"},
            {"id": "nOJsYT", "name": "日-投放数据（自采红京cid）"},
            {"id": "YnkjWX", "name": "定向人群（自采红京cid）"},
            {"id": "7gf6nq", "name": "日-投放数据（代采星伴种草)"},
            {"id": "7vfv8y", "name": "日-投放数据（uds）"},
            {"id": "O5TsXZ", "name": "日-投放数据（代付京东种草)"},
            {"id": "TLLRoo", "name": "日-投放数据（对投京东种草)"},
            {"id": "w0oPX1", "name": "日-投放数据（jds）"},
            {"id": "Trvrou", "name": "日-投放数据（京东对投cid）"},
            {"id": "hk9XgJ", "name": "日报"}
        ]
    },
    # MMPZ 618 Review
    {
        "wb_name": "MMPZ_618",
        "wb_token": "XSKrspszhhgvPvtxMNicmYlUnEc",
        "sheets": [
            {"id": "4a19cf", "name": "数据汇总"},
            {"id": "sj1rpy", "name": "by笔记fs"},
            {"id": "hmtx2k", "name": "Sheet4"},
            {"id": "xJhK8A", "name": "数据透视表"},
            {"id": "ML6sDi", "name": "蒲公英数据"}
        ]
    }
]

total = sum(len(w["sheets"]) for w in workbooks_sheets)
current = 0

for w in workbooks_sheets:
    wb_token = w["wb_token"]
    wb_name = w["wb_name"]
    for s in w["sheets"]:
        current += 1
        s_id = s["id"]
        s_name = s["name"]
        safe_name = "".join(c for c in s_name if c.isalnum() or c in ("_", "-"))
        out_file = f"{wb_name}_{s_id}_{safe_name}.json"
        out_path = os.path.join(raw_sheets_dir, out_file)
        
        print(f"[{current}/{total}] Fetching {wb_name} -> {s_name} ({s_id})...")
        cmd = [
            "lark-cli.cmd", "sheets", "+csv-get",
            "--spreadsheet-token", wb_token,
            "--sheet-id", s_id,
            "--as", "user",
            "--format", "json"
        ]
        p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if p.returncode != 0:
            err_msg = p.stderr.decode('utf-8', errors='replace')
            print(f"  FAILED: {err_msg[:200]}")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump({"error": err_msg, "sheet_id": s_id, "sheet_name": s_name}, f, ensure_ascii=False)
        else:
            try:
                data = json.loads(p.stdout.decode('utf-8'))
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False)
                row_cnt = data.get("data", {}).get("row_count", 0)
                col_cnt = data.get("data", {}).get("col_count", 0)
                actual_range = data.get("data", {}).get("actual_range", "")
                print(f"  OK: rows={row_cnt}, cols={col_cnt}, range={actual_range}")
            except Exception as e:
                print(f"  JSON parse error: {e}")
        time.sleep(0.3)

print("Sheets fetch complete!")
