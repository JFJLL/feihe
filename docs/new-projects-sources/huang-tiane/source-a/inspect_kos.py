import json, csv, io, re, sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

with open('docs/new-projects-sources/huang-tiane/source-a/raw/wb1_kol_execution_wZtAgh.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

blocks = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', d['annotated_csv'], flags=re.DOTALL)
headers = next(csv.reader(io.StringIO(blocks[0][1].strip())))

print(f"Total columns: {len(headers)}")
for i, h in enumerate(headers):
    print(f"  Col {i}: {h}")

rows = [next(csv.reader(io.StringIO(b[1].strip()))) for b in blocks[1:]]
print(f"Total rows: {len(rows)}")
for r in rows[:5]:
    print(f"  {r[0]} | {r[3]} | {r[4]} | {r[5]} | {r[7]}")
