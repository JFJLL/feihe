import json

with open('docs/new-projects-sources/deep-audit-meiling/coverage_audit.json', 'r', encoding='utf-8') as f:
    cov = json.load(f)

print(f'Total sheets in audit: {len(cov)}')
status_counts = {}
for s in cov:
    st = s.get('status', 'unknown')
    status_counts[st] = status_counts.get(st, 0) + 1

print('Status breakdown:', status_counts)
has_more_true = [s for s in cov if s.get('has_more')]
print(f'Sheets with has_more=True (chunked by API limit): {len(has_more_true)}')
for s in has_more_true:
    print(f"  {s['workbook']} -> {s['sheet_name']} ({s['sheet_id']}): range={s['actual_range']}, rows={s['row_count']}")

print('\nFull compact coverage table (51 sheets):')
for i, s in enumerate(cov):
    print(f"{i+1:2d}. [{s['workbook'][:4]}] {s['sheet_name']:25s} ({s['sheet_id']:6s}) | range: {s.get('actual_range', '-'):12s} | rows: {s.get('row_count', 0):5d} | has_more: {str(s.get('has_more', False)):5s} | status: {s['status']}")
