import json, csv, io, re, sys, os
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

raw_dir = 'docs/new-projects-sources/huang-tiane/source-a/raw'
wb2_files = [f for f in os.listdir(raw_dir) if f.startswith('wb2_commercial_daily_')]

print(f"=== Inspecting {len(wb2_files)} WB2 sheets ===")
for fname in sorted(wb2_files):
    fpath = os.path.join(raw_dir, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        d = json.load(f)
    csv_text = d.get('annotated_csv', '')
    blocks = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', csv_text, flags=re.DOTALL)
    non_empty = [b for b in blocks if any(cell.strip() for cell in next(csv.reader(io.StringIO(b[1].strip()))))]
    print(f"\n--- {fname} (total: {len(blocks)}, non-empty: {len(non_empty)}) ---")
    for rnum, content in non_empty[:5]:
        r = next(csv.reader(io.StringIO(content.strip())))
        print(f"  Row {rnum}: {[c[:20] for c in r[:8] if c.strip()]}")
