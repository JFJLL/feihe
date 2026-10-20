import subprocess
import json
import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sheets_to_check = [
    ('DsGFs2SxehA0setiGvdcHZuhn7d', 'DsGFs2SxehA0setiGvdcHZuhn7d (日常执行表)'),
    ('X7CasjHnThuFA2tPYuscN6NBnMf', 'X7CasjHnThuFA2tPYuscN6NBnMf (种草投放数据)'),
    ('Pm3DsKubghgFDAtbbS5cyHY5n4g', 'Pm3DsKubghgFDAtbbS5cyHY5n4g (双周会小结)'),
]

for token, desc in sheets_to_check:
    print(f"=== Checking {desc} ===")
    cmd = f"lark-cli sheets +workbook-info --spreadsheet-token {token} --as user --format json"
    res = subprocess.run(cmd, shell=True, capture_output=True)
    info = json.loads(res.stdout.decode("utf-8", errors="replace"))
    subsheets = info.get("data", {}).get("sheets", [])
    for s in subsheets:
        sid = s.get("sheet_id")
        sname = s.get("sheet_name")
        rows = s.get("row_count")
        cols = s.get("column_count")
        print(f"  Sheet: {sid} | {sname} ({rows}x{cols})")
        
        # sample first 15 rows
        cmd_c = f"lark-cli sheets +csv-get --spreadsheet-token {token} --sheet-id {sid} --range A1:Z15 --as user --format json"
        res_c = subprocess.run(cmd_c, shell=True, capture_output=True)
        try:
            c_data = json.loads(res_c.stdout.decode("utf-8", errors="replace"))
            csv = c_data.get("data", {}).get("annotated_csv", "")
            for term in ["自然", "投流", "曝光", "互动", "非报备", "报备", "UV", "总计"]:
                if term in csv:
                    print(f"    -> matched [{term}] in {sname} ({sid})")
                    for line in csv.splitlines()[:10]:
                        if term in line:
                            print(f"       {line[:140]}")
        except Exception as e:
            print(f"    error getting {sid}: {e}")
