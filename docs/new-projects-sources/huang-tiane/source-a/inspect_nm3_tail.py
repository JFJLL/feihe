import json, csv, io, re, sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

with open('docs/new-projects-sources/huang-tiane/source-a/raw/wb3_cid_fs_daily_Nm3Sev.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

blocks = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', d['annotated_csv'], flags=re.DOTALL)
for b in blocks[29:40]:
    r = next(csv.reader(io.StringIO(b[1].strip())))
    if any(c.strip() for c in r):
        print(f"Row {b[0]}: {[c.strip() for c in r[:12]]}")
