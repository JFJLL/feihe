import json
import os
import sys
import csv
import io
from collections import defaultdict, Counter

sys.stdout.reconfigure(encoding='utf-8')

raw_dir = "docs/new-projects-sources/deep-audit-meiling/raw_sheets"
deep_audit_dir = "docs/new-projects-sources/deep-audit-meiling"
meiling_json_path = "feihe-mvp/lib/campaign-enrichment/meiling.json"

def parse_annotated_csv(text):
    lines = []
    for line in text.splitlines():
        if line.startswith("[row="):
            idx = line.find("] ")
            if idx != -1: line = line[idx+2:]
            else:
                idx2 = line.find("]")
                line = line[idx2+1:]
        lines.append(line)
    return list(csv.reader(io.StringIO("\n".join(lines))))

def clean_f(val):
    if not val: return 0.0
    s = str(val).replace('¥', '').replace(',', '').replace('%', '').strip()
    try: return float(s)
    except: return 0.0

def mine_multi_line_and_funnel():
    print("Mining multi-line summary and full funnel...")
    sources_map = [
        ('自采天猫种草', 'D9ddm3', 11, 12, 13, 17, 19),
        ('自采京东种草', 'BI2xBs', 11, 12, 13, 17, 19),
        ('自采红猫CID', 'FpcDvG', 11, 12, 13, 17, 19),
        ('自采红京CID', 'qTB7Td', 11, 12, 13, 17, 19),
        ('代采星伴种草', 'ACntPW', 11, 12, 13, 17, 19),
        ('UDS', 'Q6XGXp', 9, 10, 11, 20, None),
        ('代付京东种草', 'DHweyP', 11, 12, 13, 17, 19),
        ('对投京东种草', 'zF2qee', 11, 12, 13, 17, 19),
        ('JDS', 'TxNNS6', 11, 12, 13, 17, None),
        ('京东对投CID', 'E2KFmU', 11, 12, 13, 17, 19),
    ]

    all_files = os.listdir(raw_dir)
    total_spend, total_imp, total_clicks, total_eng, total_uv = 0.0, 0, 0, 0, 0
    line_rows = []

    for name, prefix, c_spend, c_imp, c_click, c_eng, c_uv in sources_map:
        matches = [f for f in all_files if prefix in f]
        if not matches:
            continue
        fname = matches[0]
        with open(f'{raw_dir}/{fname}', 'r', encoding='utf-8') as f:
            rows = parse_annotated_csv(json.load(f)['data']['annotated_csv'])
        s_spend, s_imp, s_click, s_eng, s_uv = 0.0, 0, 0, 0, 0
        for r in rows[1:]:
            if len(r) > c_spend:
                s_spend += clean_f(r[c_spend])
                s_imp += int(clean_f(r[c_imp]))
                s_click += int(clean_f(r[c_click]))
                s_eng += int(clean_f(r[c_eng])) if c_eng and len(r) > c_eng else 0
                s_uv += int(clean_f(r[c_uv])) if c_uv and len(r) > c_uv else 0

        total_spend += s_spend
        total_imp += s_imp
        total_clicks += s_click
        total_eng += s_eng
        total_uv += s_uv

        ctr = round((s_click / s_imp * 100), 2) if s_imp > 0 else 0.0
        cpc = round((s_spend / s_click), 2) if s_click > 0 else None
        cpe = round((s_spend / s_eng), 2) if s_eng > 0 else None
        cpuv = round((s_spend / s_uv), 2) if s_uv > 0 else None

        line_rows.append({
            "line_name": name,
            "spend": round(s_spend, 2),
            "impressions": s_imp,
            "clicks": s_click,
            "ctr": ctr,
            "cpc": cpc,
            "engagements": s_eng,
            "cpe": cpe,
            "uv": s_uv,
            "cpuv": cpuv,
            "status": "投放中" if s_spend > 0 else "待启动"
        })

    multi_line_table = {
        "id": "meiling-enrich-multi-line-summary",
        "title": "双11各细分投放线投放消耗与转化效能汇总（10大投放线）",
        "sourceId": "src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd",
        "period": "2026-09-30 ~ 2026-10-18",
        "type": "summary",
        "columns": [
            {"key": "line_name", "label": "细分投放线", "type": "string"},
            {"key": "spend", "label": "消耗金额(元)", "type": "number"},
            {"key": "impressions", "label": "展现量", "type": "number"},
            {"key": "clicks", "label": "点击量", "type": "number"},
            {"key": "ctr", "label": "点击率(%)", "type": "number"},
            {"key": "cpc", "label": "平均点击成本(元)", "type": "number"},
            {"key": "engagements", "label": "互动量", "type": "number"},
            {"key": "cpe", "label": "平均互动成本(元)", "type": "number"},
            {"key": "uv", "label": "站外活跃进店UV", "type": "number"},
            {"key": "cpuv", "label": "平均进店成本(元)", "type": "number"},
            {"key": "status", "label": "投放状态", "type": "string"}
        ],
        "rows": line_rows
    }

    funnel_stages = [
        {
            "stage": "品牌曝光展现",
            "stage_key": "impressions",
            "value": total_imp,
            "unit": "次",
            "conversion_label": "基准曝光池",
            "cost_label": f"总消耗 ¥{total_spend:,.2f}",
            "subtext": "跨10大投放线全网触达"
        },
        {
            "stage": "种草点击浏览",
            "stage_key": "clicks",
            "value": total_clicks,
            "unit": "次",
            "conversion_label": f"CTR {(total_clicks / total_imp * 100):.2f}%",
            "cost_label": f"CPC ¥{(total_spend / total_clicks):.2f}",
            "subtext": "兴趣受众深度图文/视频阅读"
        },
        {
            "stage": "深度互动交互",
            "stage_key": "engagements",
            "value": total_eng,
            "unit": "次",
            "conversion_label": f"互动率 {(total_eng / total_clicks * 100):.2f}%",
            "cost_label": f"CPE ¥{(total_spend / total_eng):.2f}",
            "subtext": "点赞/收藏/评论/分享"
        },
        {
            "stage": "电商进店引流",
            "stage_key": "store_uv",
            "value": total_uv,
            "unit": "UV",
            "conversion_label": f"进店率 {(total_uv / total_clicks * 100):.2f}%",
            "cost_label": f"CPUV ¥{(total_spend / total_uv):.2f}",
            "subtext": "回传京东/天猫店铺活跃UV"
        }
    ]

    full_funnel_table = {
        "id": "meiling-enrich-full-funnel",
        "title": "双11种草投流全链路转化漏斗（展现→点击→互动→进店UV）",
        "sourceId": "src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd",
        "period": "2026-09-30 ~ 2026-10-18",
        "type": "funnel",
        "columns": [
            {"key": "stage", "label": "转化层级", "type": "string"},
            {"key": "value", "label": "绝对规模", "type": "number"},
            {"key": "unit", "label": "单位", "type": "string"},
            {"key": "conversion_label", "label": "转化率", "type": "string"},
            {"key": "cost_label", "label": "单位成本/总值", "type": "string"},
            {"key": "subtext", "label": "链路含义", "type": "string"}
        ],
        "rows": funnel_stages
    }

    return multi_line_table, full_funnel_table

def mine_audience_demographics():
    print("Mining audience age and core cities...")
    # Age from MMPZ_618_ML6sDi_蒲公英数据 (N=105)
    with open(f'{raw_dir}/MMPZ_618_ML6sDi_蒲公英数据.json', 'r', encoding='utf-8') as f:
        rows = parse_annotated_csv(json.load(f)['data']['annotated_csv'])

    ages = {'<18岁': [], '18~24岁': [], '25~34岁': [], '35~44岁': [], '45岁及以上': []}
    for r in rows[3:]:
        if len(r) > 85:
            try:
                for k, idx in [('<18岁', 81), ('18~24岁', 82), ('25~34岁', 83), ('35~44岁', 84), ('45岁及以上', 85)]:
                    ages[k].append(float(r[idx].replace('%', '')))
            except:
                pass

    age_rows = []
    for k, v in ages.items():
        avg_pct = round(sum(v) / len(v), 2) if v else 0.0
        note = ""
        if k == '25~34岁': note = "独居安家/新婚首套/小户型扩容主力（近半壁江山）"
        elif k == '35~44岁': note = "二胎家庭/大容量除菌保鲜升级需求"
        elif k == '45岁及以上': note = "成熟家庭/线下转线上换新置换"
        elif k == '18~24岁': note = "大学生/初入职场尝鲜尝新"
        else: note = "前置潜在品牌心智沉淀"
        age_rows.append({
            "age_group": k,
            "ratio": avg_pct,
            "sample_size": len(v),
            "persona_note": note
        })

    age_table = {
        "id": "meiling-enrich-audience-age",
        "title": "美菱冰箱受众人口学画像：年龄段分布（蒲公英真实样本N=105）",
        "sourceId": "src-meiling-node-MMPZwhQbMiVmIKkcyb9c7mDQnHp",
        "period": "2026历史与双11受众画像",
        "type": "summary",
        "columns": [
            {"key": "age_group", "label": "年龄段", "type": "string"},
            {"key": "ratio", "label": "人群占比(%)", "type": "number"},
            {"key": "sample_size", "label": "样本笔记数", "type": "number"},
            {"key": "persona_note", "label": "人群特征与场景需求", "type": "string"}
        ],
        "rows": age_rows
    }

    # Top 12 Cities from base_double11_kol.ndjson
    cities_counter = Counter()
    with open(f'{deep_audit_dir}/base_double11_kol.ndjson', 'r', encoding='utf-8') as f:
        for line in f:
            obj = json.loads(line)
            geo = obj.get('地域', '')
            if geo:
                if isinstance(geo, list): geo = geo[0]
                parts = str(geo).strip().split()
                city = parts[1] if len(parts) >= 2 else parts[0]
                city = city.replace('市', '')
                cities_counter[city] += 1

    city_rows = []
    for city, count in cities_counter.most_common(12):
        city_rows.append({
            "city": city,
            "kol_count": count,
            "tier": "新一线/一线" if city in ['上海', '北京', '广州', '深圳', '成都', '杭州', '重庆', '武汉', '苏州', '长沙', '郑州'] else "二线核心"
        })

    city_table = {
        "id": "meiling-enrich-audience-cities",
        "title": "双11核心达人与受众渗透Top 12城市分布",
        "sourceId": "meiling-base",
        "period": "2026双11战役",
        "type": "summary",
        "columns": [
            {"key": "city", "label": "核心城市", "type": "string"},
            {"key": "kol_count", "label": "达人/受众分布指数", "type": "number"},
            {"key": "tier", "label": "城市梯队", "type": "string"}
        ],
        "rows": city_rows
    }

    return age_table, city_table

def mine_audience_packages():
    print("Mining audience targeting packages...")
    sources = [
        ('自采天猫种草', 'DkdO_daily_D9ddm3_自采天猫种草数据源.json'),
        ('自采京东种草', 'DkdO_daily_BI2xBs_自采京东种草数据源.json'),
        ('自采红猫CID', 'DkdO_daily_FpcDvG_自采红猫cid数据源.json'),
        ('自采红京CID', 'DkdO_daily_qTB7Td_自采红京cid数据源.json'),
    ]

    packages = defaultdict(lambda: {'spend': 0.0, 'imp': 0, 'clicks': 0, 'eng': 0, 'uv': 0, 'lines': set()})
    for line_name, fname in sources:
        with open(f'{raw_dir}/{fname}', 'r', encoding='utf-8') as f:
            rows = parse_annotated_csv(json.load(f)['data']['annotated_csv'])
        for r in rows[1:]:
            if len(r) > 13:
                pkg = r[2].strip()
                if not pkg:
                    pkg = '通投/默认推荐'
                spend = clean_f(r[11])
                imp = int(clean_f(r[12]))
                clicks = int(clean_f(r[13]))
                eng = int(clean_f(r[17])) if len(r) > 17 else 0
                uv = int(clean_f(r[19])) if len(r) > 19 else 0
                packages[pkg]['spend'] += spend
                packages[pkg]['imp'] += imp
                packages[pkg]['clicks'] += clicks
                packages[pkg]['eng'] += eng
                packages[pkg]['uv'] += uv
                packages[pkg]['lines'].add(line_name)

    targeted_pkgs = [(k, v) for k, v in packages.items() if k != '通投/默认推荐']
    sorted_pkgs = sorted(targeted_pkgs, key=lambda x: x[1]['spend'], reverse=True)

    package_rows = []
    for pkg_name, metrics in sorted_pkgs[:10]:
        sp = round(metrics['spend'], 2)
        im = metrics['imp']
        cl = metrics['clicks']
        ctr = round((cl / im * 100), 2) if im > 0 else 0.0
        cpc = round((sp / cl), 2) if cl > 0 else None
        cpe = round((sp / metrics['eng']), 2) if metrics['eng'] > 0 else None
        cpuv = round((sp / metrics['uv']), 2) if metrics['uv'] > 0 else None
        package_rows.append({
            "package_name": pkg_name,
            "spend": sp,
            "impressions": im,
            "clicks": cl,
            "ctr": ctr,
            "cpc": cpc,
            "cpe": cpe,
            "uv": metrics['uv'],
            "cpuv": cpuv,
            "channels": " / ".join(sorted(list(metrics['lines'])))
        })

    package_table = {
        "id": "meiling-enrich-audience-packages",
        "title": "四大满贯定向人群包投放消耗与转化效能对比（Top 10人群包）",
        "sourceId": "src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd",
        "period": "2026-09-30 ~ 2026-10-18",
        "type": "summary",
        "columns": [
            {"key": "package_name", "label": "定向人群包名称", "type": "string"},
            {"key": "spend", "label": "消耗金额(元)", "type": "number"},
            {"key": "impressions", "label": "展现量", "type": "number"},
            {"key": "clicks", "label": "点击量", "type": "number"},
            {"key": "ctr", "label": "点击率(%)", "type": "number"},
            {"key": "cpc", "label": "平均点击成本(元)", "type": "number"},
            {"key": "cpe", "label": "平均互动成本(元)", "type": "number"},
            {"key": "uv", "label": "进店UV", "type": "number"},
            {"key": "cpuv", "label": "平均进店成本(元)", "type": "number"},
            {"key": "channels", "label": "应用投放线", "type": "string"}
        ],
        "rows": package_rows
    }

    return package_table

def mine_campaign_evolution():
    print("Mining cross-campaign evolution (618 vs 7-8月 vs 双11)...")
    evolution_rows = [
        {
            "campaign": "2026年618年中大促",
            "period": "2026.05.20 ~ 2026.06.20",
            "status": "已结案",
            "candidate_kols": 515,
            "confirmed_kols": 79,
            "published_posts": 50,
            "k_spend": 737011.00,
            "fs_spend": 1488489.00,
            "total_spend": 2225500.00,
            "gmv": 16959559.42,
            "fs_roi": 12.99,
            "overall_roi": 8.58,
            "milestone": "内容完成率107%，以旧换新人群突破，纯FS ROI 12.99"
        },
        {
            "campaign": "2026年7-8月日常蓄水",
            "period": "2026.07.01 ~ 2026.08.31",
            "status": "已结案",
            "candidate_kols": 538,
            "confirmed_kols": 48,
            "published_posts": 45,
            "k_spend": 408961.50,
            "fs_spend": 711365.00,
            "total_spend": 1120326.50,
            "gmv": 10740000.00,
            "fs_roi": None,
            "overall_roi": 9.59,
            "milestone": "GMV目标达成率103.56%，考核CPE≤10元完成8.6万互动"
        },
        {
            "campaign": "2026年双11年终决战",
            "period": "2026.09.28 ~ 2026.11.20",
            "status": "进行中",
            "candidate_kols": 1096,
            "confirmed_kols": 117,
            "published_posts": 13,
            "k_spend": 80334.41,
            "fs_spend": 424861.59,
            "total_spend": 505196.00,
            "gmv": 1994188.69,
            "fs_roi": 4.80,
            "overall_roi": None,
            "milestone": "初筛完成69.2%，10大投放线并发，进店18,193 UV"
        }
    ]

    evolution_table = {
        "id": "meiling-enrich-campaign-evolution",
        "title": "三大促战役跨期演进对比（618年中 vs 7-8月日常 vs 双11决战）",
        "sourceId": "src-meiling-node-HNDCwmdpkiw4DgkFSNycB3cbnSc",
        "period": "2026年度三大促跨期比对",
        "type": "summary",
        "columns": [
            {"key": "campaign", "label": "大促战役", "type": "string"},
            {"key": "period", "label": "战役周期", "type": "string"},
            {"key": "status", "label": "结案状态", "type": "string"},
            {"key": "candidate_kols", "label": "达人候选池", "type": "number"},
            {"key": "confirmed_kols", "label": "确认达人数", "type": "number"},
            {"key": "published_posts", "label": "发布篇数", "type": "number"},
            {"key": "k_spend", "label": "K费用(元)", "type": "number"},
            {"key": "fs_spend", "label": "FS投流费用(元)", "type": "number"},
            {"key": "total_spend", "label": "K+FS总投入(元)", "type": "number"},
            {"key": "gmv", "label": "实现GMV(元)", "type": "number"},
            {"key": "fs_roi", "label": "纯FS ROI", "type": "number"},
            {"key": "overall_roi", "label": "全案综合ROI", "type": "number"},
            {"key": "milestone", "label": "战役核心里程碑与考核达成", "type": "string"}
        ],
        "rows": evolution_rows
    }

    return evolution_table

def main():
    print("Loading meiling.json...")
    with open(meiling_json_path, "r", encoding="utf-8") as f:
        meiling_data = json.load(f)

    # Check existing tables
    existing_tables = meiling_data.get("tables", [])
    existing_ids = set(t["id"] for t in existing_tables)
    print(f"Existing table count: {len(existing_tables)}")

    # Mine new tables
    multi_line_table, full_funnel_table = mine_multi_line_and_funnel()
    age_table, city_table = mine_audience_demographics()
    package_table = mine_audience_packages()
    evolution_table = mine_campaign_evolution()

    new_tables = [
        full_funnel_table,
        multi_line_table,
        age_table,
        city_table,
        package_table,
        evolution_table
    ]

    valid_source_ids = set(s["id"] for s in meiling_data.get("sources", []))
    for t in new_tables:
        assert t["sourceId"] in valid_source_ids, f"Invalid sourceId {t['sourceId']} for table {t['id']}"

    # Append or update without breaking existing 13 tables
    updated_tables = list(existing_tables)
    for nt in new_tables:
        idx = next((i for i, t in enumerate(updated_tables) if t["id"] == nt["id"]), -1)
        if idx >= 0:
            print(f"Updating table {nt['id']}")
            updated_tables[idx] = nt
        else:
            print(f"Appending table {nt['id']}")
            updated_tables.append(nt)

    meiling_data["tables"] = updated_tables
    print(f"Total tables after merge: {len(updated_tables)}")

    with open(meiling_json_path, "w", encoding="utf-8") as f:
        json.dump(meiling_data, f, ensure_ascii=False, indent=2)
    print("Successfully wrote updated meiling.json!")

if __name__ == "__main__":
    main()
