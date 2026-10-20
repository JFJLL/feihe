import json
import os
import sys
import csv
import io

sys.stdout.reconfigure(encoding='utf-8')

raw_dir = "docs/new-projects-sources/deep-audit-meiling/raw_sheets"

def parse_annotated_csv(text):
    lines = []
    for line in text.splitlines():
        if line.startswith("[row="):
            idx = line.find("] ")
            if idx != -1:
                line = line[idx+2:]
            else:
                idx2 = line.find("]")
                line = line[idx2+1:]
        lines.append(line)
    reader = csv.reader(io.StringIO("\n".join(lines)))
    return list(reader)

target_files = [
    ("HNDC_4SGaOf_双11进度更新", "HNDC_kpi_4SGaOf"),
    ("HNDC_SI0mQy_双11筛号进度透视表", "HNDC_kpi_SI0mQy"),
    ("HNDC_FkLCad_618kpi进度总览", "HNDC_kpi_FkLCad"),
    ("DkdO_smsJa2_byday汇总数据", "DkdO_daily_smsJa2"),
    ("DkdO_hKnPdA_笔记数据", "DkdO_daily_hKnPdA"),
    ("DkdO_7pkBrd_城市数据", "DkdO_daily_7pkBrd"),
    ("DkdO_NFsNpI_年龄分布", "DkdO_daily_NFsNpI"),
    ("DkdO_mG2COI_笔记词类", "DkdO_daily_mG2COI"),
    ("DkdO_Y7qNOu_打款", "DkdO_daily_Y7qNOu"),
    ("DkdO_BZjmuN_自采代采汇总", "DkdO_daily_BZjmuN"),
    ("DkdO_Trvrou_京东对投cid", "DkdO_daily_Trvrou"),
    ("MMPZ_4a19cf_618数据汇总", "MMPZ_618_4a19cf"),
    ("MMPZ_sj1rpy_618by笔记fs", "MMPZ_618_sj1rpy")
]

for label, prefix in target_files:
    matching = [f for f in os.listdir(raw_dir) if f.startswith(prefix)]
    if not matching:
        print(f"=== {label}: Not found! ===")
        continue
    filepath = os.path.join(raw_dir, matching[0])
    with open(filepath, "r", encoding="utf-8") as f:
        obj = json.load(f)
    csv_text = obj.get("data", {}).get("annotated_csv", "")
    rows = parse_annotated_csv(csv_text)
    print(f"\n==========================================")
    print(f"=== {label} (Rows: {len(rows)}) ===")
    for i, r in enumerate(rows[:10]):
        clean_r = [c.strip() for c in r]
        while clean_r and clean_r[-1] == "":
            clean_r.pop()
        if any(clean_r):
            print(f"  Row {i+1}: {clean_r[:12]}")
