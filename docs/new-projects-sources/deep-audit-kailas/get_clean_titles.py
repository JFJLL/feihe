import subprocess, json, sys
sys.stdout.reconfigure(encoding='utf-8')
tokens = [
    'ZuBzsoC0fhuQ8Fte13pcdHcxnQg',
    'DsGFs2SxehA0setiGvdcHZuhn7d',
    'X7CasjHnThuFA2tPYuscN6NBnMf',
    'Pm3DsKubghgFDAtbbS5cyHY5n4g'
]
title_map = {}
for t in tokens:
    cmd = ['lark-cli.cmd', 'sheets', '+workbook-info', '--spreadsheet-token', t, '--as', 'user', '--format', 'json']
    p = subprocess.run(cmd, capture_output=True)
    obj = json.loads(p.stdout.decode('utf-8', errors='replace'))
    data = obj.get('data', {})
    wb_title = data.get('title')
    sheets = data.get('sheets', [])
    print(f'=== WB: {wb_title} ({t}) Sheets: {len(sheets)} ===')
    for s in sheets:
        sid = s.get('sheet_id')
        sname = s.get('sheet_name')
        title_map[(t, sid)] = {
            'workbook_title': wb_title,
            'sheet_name': sname,
            'row_count': s.get('row_count'),
            'column_count': s.get('column_count')
        }
        print(f"  {sid}: {sname}")

with open('docs/new-projects-sources/deep-audit-kailas/clean_titles.json', 'w', encoding='utf-8') as f:
    json.dump({f"{k[0]}_{k[1]}": v for k, v in title_map.items()}, f, ensure_ascii=False, indent=2)
print(f'Saved {len(title_map)} titles to clean_titles.json')
