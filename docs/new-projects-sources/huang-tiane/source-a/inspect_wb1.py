import json
import csv
import io
import re
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

with open('docs/new-projects-sources/huang-tiane/source-a/raw/wb1_kol_execution_GIQjnY.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

csv_text = d.get('annotated_csv', '')
blocks = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', csv_text, flags=re.DOTALL)
headers = next(csv.reader(io.StringIO(blocks[0][1].strip())))

print(f"Total columns: {len(headers)}")
for i, h in enumerate(headers):
    print(f"  Col {i}: {h}")

rows = []
for row_num, content in blocks[1:]:
    r = next(csv.reader(io.StringIO(content.strip())))
    rows.append(r)

print(f"\nTotal creator rows: {len(rows)}")

# Let us analyze progress status distribution
progress_counts = {}
budget_sum = 0.0
budget_valid = 0
for r in rows:
    name = r[1]
    status = r[21] if len(r) > 21 else ""
    progress_counts[status] = progress_counts.get(status, 0) + 1
    # Check platform price / budget
    # Check cols 15, 16
    p_price = r[15] if len(r) > 15 else ""
    try:
        val = float(p_price.replace(',', '').replace('¥', '').strip())
        budget_sum += val
        budget_valid += 1
    except:
        pass

print("\nProgress Status Distribution (Col 21 执行进度):")
for k, v in sorted(progress_counts.items(), key=lambda x: -x[1]):
    print(f"  {k or '[empty]'}: {v}")

print(f"\nTotal budget sum from Col 15: {budget_sum} across {budget_valid} rows")

