import sys, os, json
sys.stdout.reconfigure(encoding='utf-8')

facts_path = 'docs/new-projects-sources/huang-tiane/source-b/facts.json'
with open(facts_path, 'r', encoding='utf-8') as f:
    facts = json.load(f)

print("=== FACTS.JSON VALIDATION ===")
print(f"projectId: {facts.get('projectId')}")
print(f"buildStatus: {facts.get('buildStatus')}")
print(f"period: {facts.get('period')}")

print(f"\n--- Sources ({len(facts.get('sources', []))}) ---")
for s in facts.get('sources', []):
    print(f"  [{s['id']}] {s['name']} | Status: {s['status']}")

print(f"\n--- Tables ({len(facts.get('tables', []))}) ---")
for t in facts.get('tables', []):
    print(f"  [{t['id']}] {t['title']} | Rows: {len(t.get('rows', []))} | Category: {t.get('category')}")

print(f"\n--- Daily Datasets ({len(facts.get('dailyDatasets', []))}) ---")
for ds in facts.get('dailyDatasets', []):
    print(f"  [{ds['id']}] {ds['label']} | Period: {ds['period']} | Rows: {len(ds['rows'])} | Metrics: {len(ds['metrics'])}")
    first_r = ds['rows'][0]
    last_r = ds['rows'][-1]
    print(f"    First row: {first_r['date']}, spend={first_r.get('spend')}")
    print(f"    Last row:  {last_r['date']}, spend={last_r.get('spend')}")

print(f"\n--- KPIs ({len(facts.get('kpis', []))}) ---")
for k in facts.get('kpis', []):
    print(f"  [{k['id']}] {k['label']}: {k['value']} {k.get('unit', '')} (Target: {k.get('target')})")

print("\n=== SUMMARY RECONCILIATION CHECK ===")
# Check Brand sum vs table
brand_ds = next(d for d in facts['dailyDatasets'] if d['id'] == 'huang-brand-daily')
brand_spend_sum = sum(r['spend'] for r in brand_ds['rows'])
brand_imp_sum = sum(r['impressions'] for r in brand_ds['rows'])
brand_clicks_sum = sum(r['clicks'] for r in brand_ds['rows'])
brand_eng_sum = sum(r['engagements'] for r in brand_ds['rows'])
brand_i_sum = sum(r['seed_i'] for r in brand_ds['rows'])
brand_ti_sum = sum(r['seed_ti'] for r in brand_ds['rows'])
brand_uv_sum = sum(r['uv'] for r in brand_ds['rows'])
print(f"Brand Daily Sums: Spend={brand_spend_sum:.2f}, Imp={brand_imp_sum}, Clicks={brand_clicks_sum}, Eng={brand_eng_sum}, I={brand_i_sum}, TI={brand_ti_sum}, UV={brand_uv_sum}")

# Check Commerce sum
comm_ds = next(d for d in facts['dailyDatasets'] if d['id'] == 'huang-commerce-daily')
comm_spend_sum = sum(r['spend'] for r in comm_ds['rows'])
comm_cart_sum = sum(r['cart'] for r in comm_ds['rows'])
comm_orders_sum = sum(r['orders'] for r in comm_ds['rows'])
comm_gmv_sum = sum(r['gmv'] for r in comm_ds['rows'])
print(f"Commerce Daily Full Sums: Spend={comm_spend_sum:.2f}, Cart={comm_cart_sum}, Orders={comm_orders_sum}, GMV={comm_gmv_sum:.2f}, ROI={comm_gmv_sum/comm_spend_sum:.4f}")

# 10/19 check
r1019 = next(r for r in comm_ds['rows'] if r['date'] == '2026-10-19')
print(f"Commerce 2026-10-19: Spend={r1019['spend']}, UV={r1019['uv']}, Cart={r1019['cart']}, Orders={r1019['orders']}, GMV={r1019['gmv']}, ROI={r1019['roi']}")

# Oct check
oct_spend = sum(r['spend'] for r in comm_ds['rows'] if r['date'].startswith('2026-10'))
oct_gmv = sum(r['gmv'] for r in comm_ds['rows'] if r['date'].startswith('2026-10'))
oct_orders = sum(r['orders'] for r in comm_ds['rows'] if r['date'].startswith('2026-10'))
oct_cart = sum(r['cart'] for r in comm_ds['rows'] if r['date'].startswith('2026-10'))
oct_uv = sum(r['uv'] for r in comm_ds['rows'] if r['date'].startswith('2026-10') and r['uv'] is not None)
print(f"Commerce Oct Sums: Spend={oct_spend:.2f}, UV={oct_uv}, Cart={oct_cart}, Orders={oct_orders}, GMV={oct_gmv:.2f}, ROI={oct_gmv/oct_spend:.4f}")
