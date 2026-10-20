import subprocess
import json
import os
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

def run_lark(args):
    cmd = ['lark-cli.cmd'] + args
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        return {'ok': False, 'error': p.stderr.decode('utf-8', errors='replace')}
    try:
        return json.loads(p.stdout.decode('utf-8'))
    except Exception as e:
        return {'ok': True, 'raw': p.stdout.decode('utf-8', errors='replace')}

catalog = {}

# 1. Base tables
base_token = 'XH2obMhtwaPCWUsmsWacRCpLnvg'
print(f"=== Inspecting Base {base_token} ===")
tables_res = run_lark(['base', '+table-list', '--base-token', base_token, '--as', 'user', '--format', 'json'])
catalog['base'] = {
    'base_token': base_token,
    'tables': []
}
if isinstance(tables_res, dict) and 'data' in tables_res:
    items = tables_res['data'].get('tables', [])
    for t in items:
        table_id = t.get('id')
        name = t.get('name')
        rec_cnt = t.get('records_count')
        print(f"  Table: {name} (ID: {table_id}) - {rec_cnt} records")
        catalog['base']['tables'].append({
            'table_id': table_id,
            'name': name,
            'records_count': rec_cnt
        })
else:
    print("Base error:", tables_res)

# 2. Workbooks
workbooks = {
    'MMPZ_618_review': {'token': 'XSKrspszhhgvPvtxMNicmYlUnEc', 'wiki': 'MMPZwhQbMiVmIKkcyb9c7mDQnHp'},
    'DkdO_double11_daily': {'token': 'RoAtsw3KTh56ZBtT7cmcTYaznJb', 'wiki': 'DkdOwDEk0i9FTUkXlh1cTE0fnOd'},
    'HNDC_kpi_mgmt': {'token': 'N2bssx2dBh8xyItaFEfccqaznHY', 'wiki': 'HNDCwmdpkiw4DgkFSNycB3cbnSc'}
}
catalog['workbooks'] = {}

for key, meta in workbooks.items():
    wb_token = meta['token']
    print(f"\n=== Inspecting Workbook {key} ({wb_token}) ===")
    res = run_lark(['sheets', '+workbook-info', '--spreadsheet-token', wb_token, '--as', 'user', '--format', 'json'])
    catalog['workbooks'][key] = {
        'token': wb_token,
        'wiki_token': meta['wiki'],
        'title': res.get('data', {}).get('title'),
        'sheets': []
    }
    if isinstance(res, dict) and 'data' in res:
        sheets = res['data'].get('sheets', [])
        for s in sheets:
            sheet_id = s.get('sheet_id')
            title = s.get('sheet_name')
            row_cnt = s.get('row_count')
            col_cnt = s.get('column_count')
            hidden = s.get('is_hidden', False)
            print(f"  Sheet: {title} (ID: {sheet_id}) - {row_cnt} rows x {col_cnt} cols [hidden: {hidden}]")
            catalog['workbooks'][key]['sheets'].append({
                'sheet_id': sheet_id,
                'sheet_name': title,
                'row_count': row_cnt,
                'column_count': col_cnt,
                'is_hidden': hidden
            })
    else:
        print("Workbook error:", res)

# 3. Docx
docx_info = {'wiki_token': 'UKPKwNHFdi9jk0kBaQKcuO3Anqf', 'docx_token': 'Ugwgd6lKzoURMWxXeJ3c4VzNnFc'}
print(f"\n=== Inspecting Docx {docx_info['wiki_token']} ===")
catalog['docx'] = docx_info

with open('docs/new-projects-sources/deep-audit-meiling/catalog_overview.json', 'w', encoding='utf-8') as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print("\nCatalog saved to docs/new-projects-sources/deep-audit-meiling/catalog_overview.json")
