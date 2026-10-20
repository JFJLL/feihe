import json, csv, io, re, sys, os
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

a_raw = 'docs/new-projects-sources/huang-tiane/source-a/raw'
b_raw = 'docs/new-projects-sources/huang-tiane/source-b/raw'

print("=== RECONCILING COMMERCIAL DAILY (A vs B) ===")
# Check c46f52 (日报底表)
with open(f'{a_raw}/wb2_commercial_daily_c46f52.json', 'r', encoding='utf-8') as f:
    da = json.load(f)
with open(f'{b_raw}/shangxiao_c46f52.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

print(f"c46f52: A bytes={len(da['annotated_csv'])}, B bytes={len(db['annotated_csv'])}, A range={da['actual_range']}, B range={db['actual_range']}")
print(f"c46f52 identical: {da['annotated_csv'] == db['annotated_csv']}")

# Check Dz6eHe (日数据)
with open(f'{a_raw}/wb2_commercial_daily_Dz6eHe.json', 'r', encoding='utf-8') as f:
    da = json.load(f)
with open(f'{b_raw}/shangxiao_Dz6eHe.json', 'r', encoding='utf-8') as f:
    db = json.load(f)
print(f"Dz6eHe identical: {da['annotated_csv'] == db['annotated_csv']}")

# Check Vw00Q9 (Sheet9)
with open(f'{a_raw}/wb2_commercial_daily_Vw00Q9.json', 'r', encoding='utf-8') as f:
    da = json.load(f)
with open(f'{b_raw}/shangxiao_Vw00Q9.json', 'r', encoding='utf-8') as f:
    db = json.load(f)
print(f"Vw00Q9 identical: {da['annotated_csv'] == db['annotated_csv']}")

print("\n=== RECONCILING BRAND FS vs CID FS (B vs A) ===")
# Check Nm3Sev (日-投放数据)
with open(f'{a_raw}/wb3_cid_fs_daily_Nm3Sev.json', 'r', encoding='utf-8') as f:
    da = json.load(f)
with open(f'{b_raw}/brand_fs_Nm3Sev.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

print(f"Nm3Sev: A(CID) range={da['actual_range']}, B(Brand) range={db['actual_range']}")
print(f"A(CID) non-empty first 3 rows vs B(Brand) first 3 rows:")
blocks_a = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', da['annotated_csv'], flags=re.DOTALL)
blocks_b = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', db['annotated_csv'], flags=re.DOTALL)

for b in blocks_a[:4]:
    r = next(csv.reader(io.StringIO(b[1].strip())))
    if any(c.strip() for c in r):
        print(f"  CID  Row {b[0]}: {[c.strip() for c in r[:8]]}")
for b in blocks_b[:4]:
    r = next(csv.reader(io.StringIO(b[1].strip())))
    if any(c.strip() for c in r):
        print(f"  Brand Row {b[0]}: {[c.strip() for c in r[:8]]}")

