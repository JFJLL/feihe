import json
import sys
import os
import datetime

# Ensure local directory is in python path and locate repo root via __file__
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

repo_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
dest_file = os.path.join(repo_root, "feihe-mvp", "lib", "campaign-daily-data.json")
raw_dumps_dir = os.path.join(current_dir, "raw-daily-dumps")
audit_file = os.path.join(current_dir, "campaign-daily-audit.json")

os.makedirs(raw_dumps_dir, exist_ok=True)

from extract_wipes_step import run_wipes
from extract_meiling_step import run_meiling
from extract_kailas_step import run_kailas

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

final_store = {
    "winner-wipes": [],
    "meiling": [],
    "kailas": []
}
audit_log = {}

print(f"Repo root resolved via __file__: {repo_root}")
print(">>> [1/3] Extracting Winner Wipes...")
wipes_token = "Ero1shDTFhVzwttqDMLceZQ4nMb"
w_datasets, w_audits = run_wipes(wipes_token, raw_dumps_dir)
final_store["winner-wipes"] = w_datasets
audit_log.update(w_audits)

print(">>> [2/3] Extracting Meiling...")
meiling_token = "RoAtsw3KTh56ZBtT7cmcTYaznJb"
m_datasets, m_audits = run_meiling(meiling_token, raw_dumps_dir)
final_store["meiling"] = m_datasets
audit_log.update(m_audits)

print(">>> [3/3] Extracting Kailas...")
kailas_token = "X7CasjHnThuFA2tPYuscN6NBnMf"
k_datasets, k_audits = run_kailas(kailas_token, raw_dumps_dir)
final_store["kailas"] = k_datasets
audit_log.update(k_audits)

# Audit missing coverage per metric across each dataset
for proj_id, dsets in final_store.items():
    for ds in dsets:
        ds_id = ds["id"]
        rows = ds["rows"]
        total_pts = len(rows)
        coverage_map = {}
        for m in ds["metrics"]:
            k = m["key"]
            null_n = sum(1 for r in rows if r.get(k) is None)
            coverage_map[k] = {
                "null_points": null_n,
                "valid_points": total_pts - null_n,
                "coverage_pct": f"{round((total_pts - null_n) / total_pts * 100, 1)}%" if total_pts > 0 else "0%"
            }
        if ds_id in audit_log:
            audit_log[ds_id]["missing_coverage"] = coverage_map

# Write ONLY to single app destination
json_content = json.dumps(final_store, ensure_ascii=False, indent=2)
with open(dest_file, "w", encoding="utf-8") as f:
    f.write(json_content)

with open(audit_file, "w", encoding="utf-8") as f:
    json.dump({
        "audit_version": "2.1.0-strict-coverage",
        "generated_at": datetime.datetime.now().astimezone().isoformat(),
        "datasets_audit": audit_log
    }, f, ensure_ascii=False, indent=2)

print("\n>>> ALL EXTRACTIONS & AUDITS COMPLETE!")
print(f"Single App Output: {dest_file}")
print(f"Data JSON size: {len(json_content.encode('utf-8')) / 1024:.2f} KB (strictly < 200KB)")
print(f"Audit log saved to: {audit_file}")
