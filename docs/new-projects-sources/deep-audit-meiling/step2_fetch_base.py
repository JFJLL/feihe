import subprocess
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

base_token = "XH2obMhtwaPCWUsmsWacRCpLnvg"
work_dir = "docs/new-projects-sources/deep-audit-meiling"

tables_to_fetch = [
    {"id": "tbluz50zuZOeGQWf", "name": "双11 KOL进度表", "out": "base_double11_kol.ndjson"},
    {"id": "tblOYMiuP5hTjxbN", "name": "双11供图进度表", "out": "base_double11_gongtu.ndjson"},
    {"id": "tblotoaoy40ShO5k", "name": "双11 样机信息表", "out": "base_double11_yangji.ndjson"},
    {"id": "tblQvZjfvg0TfgSy", "name": "双11 产品匹配规则", "out": "base_double11_matching.ndjson"},
    {"id": "tblzT0CPHCNgzhtS", "name": "7-8月KOL进度表", "out": "base_78_kol.ndjson"},
    {"id": "tbluFs8VE8cmajTm", "name": "618KOL进度表", "out": "base_618_kol.ndjson"}
]

for t in tables_to_fetch:
    out_path = os.path.join(work_dir, t["out"])
    print(f"Fetching table {t['name']} ({t['id']}) -> {out_path}")
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
    if p.returncode != 0:
        print(f"Error fetching {t['name']}: {p.stderr.decode('utf-8', errors='replace')}")
    else:
        print(f"Success fetching {t['name']}: {p.stdout.decode('utf-8', errors='replace')[:200].strip()}")

print("Base fetch step complete.")
