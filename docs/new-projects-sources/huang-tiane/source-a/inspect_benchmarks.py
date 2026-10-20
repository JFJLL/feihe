import json, csv, io, re, sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

with open('docs/new-projects-sources/huang-tiane/source-b/raw/brand_fs_Nm3Sev.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

blocks = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', d['annotated_csv'], flags=re.DOTALL)
for b in blocks[23:60]:
    r = next(csv.reader(io.StringIO(b[1].strip())))
    if any(c.strip() for c in r):
        print(f"Row {b[0]}: {[c.strip() for c in r[:12] if c.strip()]}")
