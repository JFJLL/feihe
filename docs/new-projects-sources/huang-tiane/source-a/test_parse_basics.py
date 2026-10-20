import json, csv, io, re, sys, os
from datetime import datetime

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

a_raw = 'docs/new-projects-sources/huang-tiane/source-a/raw'
b_raw = 'docs/new-projects-sources/huang-tiane/source-b/raw'

print("=== BUILDING FACTS FOR HUANG TIANE ===")

# 1. Parse KOL Execution (wb1_kol_execution_GIQjnY.json)
with open(f'{a_raw}/wb1_kol_execution_GIQjnY.json', 'r', encoding='utf-8') as f:
    d_giq = json.load(f)
blocks_giq = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', d_giq['annotated_csv'], flags=re.DOTALL)
headers_giq = next(csv.reader(io.StringIO(blocks_giq[0][1].strip())))
kol_rows = []
for b in blocks_giq[1:]:
    r = next(csv.reader(io.StringIO(b[1].strip())))
    if any(c.strip() for c in r):
        # strip PII (address, phone if any)
        # Col 1: 达人昵称, Col 2: 账号量级, Col 5: 粉丝数, Col 6: 达人类型, Col 7: 内容类型, Col 8: 内容方向
        # Col 15: 平台裸价, Col 16: 含平台费报价, Col 17: 大纲, Col 18: 脚本, Col 19: 初稿, Col 20: 预计发布日期
        # Col 21: 执行进度, Col 23: 实际发布日期, Col 24: 笔记ID, Col 30: 素材收集情况
        clean_row = {
            'index': int(r[0]) if r[0].isdigit() else len(kol_rows) + 1,
            'kol_name': r[1].strip(),
            'account_tier': r[2].strip(),
            'fans_w': float(r[5].strip()) if r[5].strip().replace('.', '', 1).isdigit() else None,
            'kol_type': r[6].strip(),
            'content_type': r[7].strip(),
            'content_direction': r[8].strip(),
            'dish_type': r[10].strip() if len(r) > 10 else '',
            'price_raw': float(r[15].replace(',', '').replace('¥', '').strip()) if len(r) > 15 and r[15].strip() else None,
            'price_with_fee': float(r[16].replace(',', '').replace('¥', '').strip()) if len(r) > 16 and r[16].strip() else None,
            'script_stage': r[18].strip() if len(r) > 18 else '',
            'draft_stage': r[19].strip() if len(r) > 19 else '',
            'scheduled_date': r[20].strip() if len(r) > 20 else '',
            'execution_status': r[21].strip() if len(r) > 21 else '',
            'actual_publish_date': r[23].strip() if len(r) > 23 else '',
            'note_id': r[24].strip() if len(r) > 24 else '',
            'asset_collected': (r[30].strip() == '是') if len(r) > 30 else False
        }
        kol_rows.append(clean_row)

print(f"Parsed {len(kol_rows)} KOL execution rows.")

# 2. Parse KOS Notes (wb1_kol_execution_wZtAgh.json)
with open(f'{a_raw}/wb1_kol_execution_wZtAgh.json', 'r', encoding='utf-8') as f:
    d_kos = json.load(f)
blocks_kos = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', d_kos['annotated_csv'], flags=re.DOTALL)
kos_rows = []
for b in blocks_kos[1:]:
    r = next(csv.reader(io.StringIO(b[1].strip())))
    if any(c.strip() for c in r):
        kos_rows.append({
            'account_name': r[0].strip(),
            'account_tier': r[3].strip() if len(r) > 3 else '素人消费者',
            'content_type': r[4].strip() if len(r) > 4 else '美食展示',
            'publish_date': r[5].strip() if len(r) > 5 else '',
            'note_id': r[7].strip() if len(r) > 7 else '',
            'fs_active': (r[9].strip() == '是') if len(r) > 9 else False,
            'cid_active': (r[10].strip() == '是') if len(r) > 10 else False,
            'commerce_active': (r[11].strip() == '是') if len(r) > 11 else False,
        })
print(f"Parsed {len(kos_rows)} KOS note rows.")

# 3. Parse CID Daily (wb3_cid_fs_daily_Nm3Sev.json)
with open(f'{a_raw}/wb3_cid_fs_daily_Nm3Sev.json', 'r', encoding='utf-8') as f:
    d_nm3 = json.load(f)
blocks_nm3 = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', d_nm3['annotated_csv'], flags=re.DOTALL)
cid_daily_rows = []
for b in blocks_nm3:
    rnum = int(b[0])
    if 13 <= rnum <= 31: # daily rows 10/1 ~ 10/19
        r = next(csv.reader(io.StringIO(b[1].strip())))
        d_str = r[0].strip()
        date_iso = f"2026-{int(d_str.split('/')[1]):02d}-{int(d_str.split('/')[2]):02d}"
        spend = float(r[1].replace(',', '').strip())
        ctr = float(r[2].replace('%', '').strip())
        cpc = float(r[3].strip())
        cpm = float(r[4].strip())
        orders = int(r[5].strip())
        gmv = float(r[6].replace(',', '').strip())
        roi = float(r[7].strip())
        store_visits = int(r[8].strip())
        visit_cost = float(r[9].strip())
        aov = float(r[10].strip()) if len(r) > 10 and r[10].strip() else round(gmv / orders, 2)
        cid_daily_rows.append({
            'date': date_iso,
            'spend': spend,
            'ctr': ctr,
            'cpc': cpc,
            'cpm': cpm,
            'orders': orders,
            'gmv': gmv,
            'roi': roi,
            'store_visits': store_visits,
            'visit_cost': visit_cost,
            'aov': aov
        })
print(f"Parsed {len(cid_daily_rows)} CID daily rows (10/1 ~ 10/19).")

# 4. Parse Brand FS Daily (from source-b/raw/brand_fs_Nm3Sev.json)
with open(f'{b_raw}/brand_fs_Nm3Sev.json', 'r', encoding='utf-8') as f:
    d_b_nm3 = json.load(f)
blocks_b = re.findall(r'\[row=(\d+)\] (.*?)(?=(?:\[row=\d+\])|\Z)', d_b_nm3['annotated_csv'], flags=re.DOTALL)
brand_daily_rows = []
for b in blocks_b:
    rnum = int(b[0])
    if 4 <= rnum <= 22: # rows 4 to 22: 10月1日 ~ 10月19日
        r = next(csv.reader(io.StringIO(b[1].strip())))
        d_str = r[0].strip()
        day_num = int(re.search(r'\d+', d_str.replace('10月', '')).group())
        date_iso = f"2026-10-{day_num:02d}"
        spend = float(r[1].replace(',', '').strip())
        impressions = int(r[2].replace(',', '').strip())
        clicks = int(r[3].replace(',', '').strip())
        ctr = float(r[4].replace('%', '').strip())
        cpc = float(r[5].strip())
        cpm = float(r[6].strip())
        plays_5s = int(r[7].replace(',', '').strip())
        ctr_5s = float(r[8].replace('%', '').strip())
        cpc_5s = float(r[9].strip())
        engagements = int(r[10].replace(',', '').strip())
        cpe = float(r[11].strip())
        # Col 12 to 19:
        seed_i = int(r[12].replace(',', '').strip()) if len(r) > 12 and r[12].strip() else None
        cpi = float(r[13].strip()) if len(r) > 13 and r[13].strip() else None
        seed_ti = int(r[14].replace(',', '').strip()) if len(r) > 14 and r[14].strip() else None
        cpti = float(r[15].strip()) if len(r) > 15 and r[15].strip() else None
        seed_total = int(r[16].replace(',', '').strip()) if len(r) > 16 and r[16].strip() else None
        cp_total = float(r[17].strip()) if len(r) > 17 and r[17].strip() else None
        uv = int(r[18].replace(',', '').strip()) if len(r) > 18 and r[18].strip() else None
        cpuv = float(r[19].replace(',', '').strip()) if len(r) > 19 and r[19].strip() and r[19] != '#DIV/0!' else None
        brand_daily_rows.append({
            'date': date_iso,
            'spend': spend,
            'impressions': impressions,
            'clicks': clicks,
            'ctr': ctr,
            'cpc': cpc,
            'cpm': cpm,
            'plays_5s': plays_5s,
            'ctr_5s': ctr_5s,
            'cpc_5s': cpc_5s,
            'engagements': engagements,
            'cpe': cpe,
            'seed_i': seed_i,
            'cpi': cpi,
            'seed_ti': seed_ti,
            'cpti': cpti,
            'seed_total': seed_total,
            'cp_total': cp_total,
            'uv': uv,
            'cpuv': cpuv
        })
print(f"Parsed {len(brand_daily_rows)} Brand FS daily rows (10/1 ~ 10/19).")
