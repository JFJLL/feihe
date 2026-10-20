import json, csv, io, re, sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

raw_dir = 'docs/new-projects-sources/huang-tiane/source-a/raw'

for sheet_name, fname in [
    ('广告类型', 'wb3_cid_fs_daily_QEoiVr.json'),
    ('定向人群', 'wb3_cid_fs_daily_2gbbSY.json'),
    ('笔记数据', 'wb3_cid_fs_daily_hKnPdA.json'),
    ('搜索数据', 'wb3_cid_fs_daily_xuQxph.json')
]:
    with open(f'{raw_dir}/{fname}', 'r', encoding='utf-8') as f:
        d = json.load(f)
    blocks = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', d['annotated_csv'], flags=re.DOTALL)
    non_empty = [b for b in blocks if any(cell.strip() for cell in next(csv.reader(io.StringIO(b[1].strip()))))]
    print(f"\n=== {sheet_name} ({fname}): {len(non_empty)} non-empty rows ===")
    for rnum, content in non_empty[:15]:
        r = next(csv.reader(io.StringIO(content.strip())))
        print(f"  Row {rnum}: {[c.strip() for c in r[:8] if c.strip()]}")
