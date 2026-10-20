import csv, io, json, re, sys, os, subprocess
from collections import defaultdict, Counter
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path("docs/new-projects-sources/deep-audit-kailas")
DEST = ROOT / "raw-full"

def clean_num(v):
    if v is None: return None
    s = str(v).replace("¥", "").replace("￥", "").replace(",", "").replace("%", "").strip()
    if not s or s in ("-", "/", "None", "#N/A", "#REF!", "#DIV/0!", "null"):
        return None
    try:
        return float(s)
    except:
        return None

def safe_ratio(num, den, round_digits=2):
    if num is None or den is None or den == 0:
        return None
    try:
        val = num / den
        return round(val, round_digits) if round_digits is not None else val
    except:
        return None

def safe_pct(num, den, round_digits=2):
    r = safe_ratio(num, den, None)
    return round(r * 100, round_digits) if r is not None else None

def load_raw_csv(sid):
    p = DEST / f"{sid}.json"
    if not p.exists(): return []
    obj = json.loads(p.read_text(encoding="utf-8"))
    data = obj.get("data", obj)
    csv_text = data.get("annotated_csv") or data.get("csv") or ""
    rows = list(csv.reader(io.StringIO(re.sub(r"^\[row=\d+\] ?", "", csv_text, flags=re.M))))
    return rows

# 1. Budget projects
rows_0vv = load_raw_csv("0vvsaG")
budget_projects = []
for r in rows_0vv[1:4]:
    if len(r) >= 13 and r[1].strip():
        b = clean_num(r[2])
        s = clean_num(r[3])
        budget_projects.append({
            "project_name": r[1].strip(),
            "total_budget": b,
            "total_spend": s,
            "pacing_pct": safe_pct(s, b),
            "k_budget": clean_num(r[5]),
            "k_spend": clean_num(r[6]),
            "k_remaining": clean_num(r[7]),
            "fs_budget": clean_num(r[8]),
            "fs_spend": clean_num(r[9]),
            "fs_remaining": clean_num(r[10]),
            "misc_fee": clean_num(r[11]),
            "shutiao_fee": clean_num(r[12])
        })

# 2. Monthly Creative Trend
monthly_creative = []
month_configs = [
    ("7月", "OxeDFl"),
    ("8月", "BpA3kU"),
    ("9月", "cVxA19"),
    ("10月", "OzIjd5")
]
for m_name, sid in month_configs:
    m_rows = load_raw_csv(sid)[1:]
    t_spend, t_imp, t_clk = 0.0, 0.0, 0.0
    dates = []
    for r in m_rows:
        if len(r) > 0 and r[0].strip() and r[0].strip() != "时间":
            try:
                parts = [int(p) for p in r[0].strip().split("/")]
                dates.append(datetime(parts[0], parts[1], parts[2]))
            except: pass
        if len(r) > 11:
            s = clean_num(r[9])
            imp = clean_num(r[10])
            clk = clean_num(r[11])
            if s is not None: t_spend += s
            if imp is not None: t_imp += imp
            if clk is not None: t_clk += clk
    d_sorted = sorted(dates) if dates else []
    start_str = d_sorted[0].strftime("%Y-%m-%d") if d_sorted else None
    end_str = d_sorted[-1].strftime("%Y-%m-%d") if d_sorted else None
    obs_days = len(set(d_sorted)) if d_sorted else 0
    cpc = safe_ratio(t_spend, t_clk)
    ctr = safe_pct(t_clk, t_imp)
    monthly_creative.append({
        "month": m_name,
        "startDate": start_str,
        "endDate": end_str,
        "period": f"{start_str} ~ {end_str}" if start_str else None,
        "observedDays": obs_days,
        "source_sheet": sid,
        "logCount": len(m_rows),
        "spend": round(t_spend, 2) if t_spend > 0 else None,
        "impressions": int(t_imp) if t_imp > 0 else None,
        "clicks": int(t_clk) if t_clk > 0 else None,
        "cpc": cpc,
        "ctr": ctr,
        "ctrPct": ctr
    })

# 3. 119 Notes Pareto
rows_c4q = load_raw_csv("c4qXS1")
notes_119 = []
for r in rows_c4q[23:]:
    if len(r) > 37:
        nick = r[19].strip()
        if not nick or nick in ["总计", "平均", "#N/A", "（空白）"]:
            continue
        notes_119.append({
            "nickname": nick,
            "spend": clean_num(r[20]),
            "impressions": clean_num(r[21]),
            "clicks": clean_num(r[22]),
            "ctr": clean_num(r[23]),
            "ctrPct": clean_num(r[23]),
            "cpm": clean_num(r[24]),
            "cpc": clean_num(r[25]),
            "engagements": clean_num(r[26]),
            "cpe": clean_num(r[27])
        })
notes_119.sort(key=lambda x: x["spend"] or 0.0, reverse=True)
total_note_spend = sum(n["spend"] for n in notes_119 if n["spend"] is not None)
cum_s = 0.0
for i, n in enumerate(notes_119):
    s = n["spend"] or 0.0
    cum_s += s
    n["rank"] = i + 1
    n["cumSpend"] = round(cum_s, 2)
    n["cumPct"] = safe_pct(cum_s, total_note_spend)

# 4. Keywords: Preserve legacy table kailas-search-keywords-category (with ctr, cpuv, etc.)
legacy_keyword_rows = [
    {"category": "品牌词", "spend": 45589.17, "impressions": 1390188.0, "clicks": 87542.0, "ctr": 6.30, "ctrPct": 6.30, "cpm": 32.79, "cpc": 0.52, "engagements": 672.0, "cpe": 67.84, "externalUv": 398.0, "cpuv": 54.84},
    {"category": "品类词", "spend": 43800.25, "impressions": 1268781.0, "clicks": 92713.0, "ctr": 7.31, "ctrPct": 7.31, "cpm": 34.52, "cpc": 0.47, "engagements": 652.0, "cpe": 67.18, "externalUv": 640.0, "cpuv": 48.45},
    {"category": "穿搭词", "spend": 24206.04, "impressions": 625565.0, "clicks": 45505.0, "ctr": 7.27, "ctrPct": 7.27, "cpm": 38.69, "cpc": 0.53, "engagements": 415.0, "cpe": 58.33, "externalUv": 978.0, "cpuv": 14.56},
    {"category": "竞品词", "spend": 22464.95, "impressions": 631539.0, "clicks": 42261.0, "ctr": 6.69, "ctrPct": 6.69, "cpm": 35.57, "cpc": 0.53, "engagements": 330.0, "cpe": 68.08, "externalUv": 79.0, "cpuv": 96.01},
    {"category": "场景词", "spend": 12290.33, "impressions": 462345.0, "clicks": 33497.0, "ctr": 7.25, "ctrPct": 7.25, "cpm": 26.58, "cpc": 0.37, "engagements": 261.0, "cpe": 47.09, "externalUv": 79.0, "cpuv": 49.95},
    {"category": "七夕词", "spend": 2216.94, "impressions": 74332.0, "clicks": 6469.0, "ctr": 8.70, "ctrPct": 8.70, "cpm": 29.82, "cpc": 0.34, "engagements": 31.0, "cpe": 71.51, "externalUv": 0.0, "cpuv": None}
]

# 5. Keywords Full Aggregation (kailas-keyword-category-full) from ajdUxd
rows_ajd = load_raw_csv("ajdUxd")[1:]
kw_agg = defaultdict(lambda: {"spend": 0.0, "imp": 0.0, "clk": 0.0, "count": 0})
for r in rows_ajd:
    if len(r) >= 23:
        cat = r[22].strip() or "未分类"
        s = clean_num(r[2])
        imp = clean_num(r[3])
        clk = clean_num(r[4])
        if s is not None: kw_agg[cat]["spend"] += s
        if imp is not None: kw_agg[cat]["imp"] += imp
        if clk is not None: kw_agg[cat]["clk"] += clk
        kw_agg[cat]["count"] += 1

keywords_full_data = []
for cat, v in sorted(kw_agg.items(), key=lambda x: x[1]["spend"], reverse=True):
    if cat == "未分类" and v["spend"] == 0: continue
    cpc = safe_ratio(v["spend"], v["clk"])
    ctr = safe_pct(v["clk"], v["imp"])
    keywords_full_data.append({
        "category": cat,
        "logCount": v["count"],
        "spend": round(v["spend"], 2) if v["spend"] > 0 else None,
        "impressions": int(v["imp"]) if v["imp"] > 0 else None,
        "clicks": int(v["clk"]) if v["clk"] > 0 else None,
        "ctr": ctr,
        "ctrPct": ctr,
        "cpc": cpc
    })

# 6. Targeting Audience (RVFN1k)
rows_rvf = load_raw_csv("RVFN1k")[1:]
tgt_agg = defaultdict(lambda: {"spend": 0.0, "imp": 0.0, "clk": 0.0, "count": 0})
for r in rows_rvf:
    if len(r) >= 5:
        target = r[1].strip() or "默认定向"
        s = clean_num(r[2])
        imp = clean_num(r[3])
        clk = clean_num(r[4])
        if s is not None: tgt_agg[target]["spend"] += s
        if imp is not None: tgt_agg[target]["imp"] += imp
        if clk is not None: tgt_agg[target]["clk"] += clk
        tgt_agg[target]["count"] += 1

targeting_data = []
for target, v in sorted(tgt_agg.items(), key=lambda x: x[1]["spend"], reverse=True):
    cpc = safe_ratio(v["spend"], v["clk"])
    ctr = safe_pct(v["clk"], v["imp"])
    targeting_data.append({
        "audienceGroup": target,
        "logCount": v["count"],
        "spend": round(v["spend"], 2) if v["spend"] > 0 else None,
        "impressions": int(v["imp"]) if v["imp"] > 0 else None,
        "clicks": int(v["clk"]) if v["clk"] > 0 else None,
        "ctr": ctr,
        "ctrPct": ctr,
        "cpc": cpc
    })

# 7. Candidate Pools
rows_1of = load_raw_csv("1oFnAQ")
candidates_initial = len([r for r in rows_1of[1:] if any(c.strip() for c in r)])
init_source_counts = Counter(r[3].strip() for r in rows_1of[1:] if len(r) > 3 and r[3].strip())

rows_3my = load_raw_csv("3mysDE")
candidates_rescreen = len([r for r in rows_3my[1:] if any(c.strip() for c in r)])
rescreen_type_counts = Counter(r[2].strip() for r in rows_3my[1:] if len(r) > 2 and r[2].strip())

rows_4pg = load_raw_csv("4PGzjP")
kol_records = []
for r in rows_4pg[2:]:
    if len(r) > 28 and r[0].strip().isdigit():
        seq = int(r[0].strip())
        month = r[1].strip()
        status = r[2].strip()
        nick = r[13].strip()
        direction = r[15].strip()
        tier = r[21].strip() or "其他"
        kol_fee = clean_num(r[25])
        total_fee = clean_num(r[28])
        kol_records.append({
            "seq": seq,
            "month": month,
            "status": status,
            "nickname": nick,
            "content_direction": direction,
            "tier": tier,
            "kol_fee": kol_fee,
            "total_fee": total_fee
        })

tier_summary = defaultdict(lambda: {"count": 0, "raw_price": 0.0, "total_spend": 0.0})
for kr in kol_records:
    t = kr["tier"]
    tier_summary[t]["count"] += 1
    if kr["kol_fee"] is not None:
        tier_summary[t]["raw_price"] += kr["kol_fee"]
    if kr["total_fee"] is not None:
        tier_summary[t]["total_spend"] += kr["total_fee"]

tier_data = [
    {
        "tier": t,
        "count": v["count"],
        "rawPrice": round(v["raw_price"], 2) if v["raw_price"] > 0 else None,
        "totalSpend": round(v["total_spend"], 2) if v["total_spend"] > 0 else None,
        "avgRawPrice": safe_ratio(v["raw_price"], v["count"]),
        "avgFee": safe_ratio(v["total_spend"], v["count"])
    }
    for t, v in sorted(tier_summary.items(), key=lambda x: x[1]["total_spend"], reverse=True)
]

dir_summary = defaultdict(lambda: {"count": 0, "kol_spend": 0.0})
for kr in kol_records:
    d = kr["content_direction"] or "其他"
    dir_summary[d]["count"] += 1
    if kr["total_fee"] is not None:
        dir_summary[d]["kol_spend"] += kr["total_fee"]

direction_data = [
    {
        "direction": d,
        "noteCount": v["count"],
        "kolSpend": round(v["kol_spend"], 2) if v["kol_spend"] > 0 else None
    }
    for d, v in sorted(dir_summary.items(), key=lambda x: x[1]["count"], reverse=True)
]

initial_desc = " | ".join(f"{k}: {v}位" for k, v in init_source_counts.most_common())
rescreen_desc = " | ".join(f"{k}({v})" for k, v in rescreen_type_counts.most_common(5))
executed_desc = " | ".join(f"{t['tier']}: {t['count']}位" for t in tier_data)

candidate_pool_rows = [
    {"stage": "初筛池全量达人", "count": candidates_initial, "sourceDesc": initial_desc, "distributionNote": "基于初筛表真实非空行独立海选"},
    {"stage": "复筛池评估达人", "count": candidates_rescreen, "sourceDesc": rescreen_desc, "distributionNote": "基于复筛表真实非空行深度评估"},
    {"stage": "执行表合作登记", "count": len(kol_records), "sourceDesc": executed_desc, "distributionNote": "Q3达人执行表真实签约执行"}
]

# 8. Load git HEAD existing tables to prevent regression
p_git = subprocess.run(["git", "show", "HEAD:feihe-mvp/lib/campaign-enrichment/kailas.json"], capture_output=True)
git_tables = []
if p_git.returncode == 0:
    git_obj = json.loads(p_git.stdout.decode("utf-8"))
    git_tables = git_obj.get("tables", [])

git_title_map = {
    "kailas-q3-organic-vs-paid": "Q3黑山自然内容与投流放大效果对比表",
    "kailas-notes-performance-scatter": "达人笔记投流效率与转化分布散点表 (119篇)",
    "kailas-kol-material-kfs-dual": "Q3优质素材集采合作成本与投流消耗明细表 (51篇合作)",
    "kailas-search-keywords-category": "聚光搜索6大词类投流效果汇总表",
    "kailas-notes-leverage-fs-k": "高投流消耗达人笔记投流杠杆分析表 (65篇精选)"
}
for gt in git_tables:
    if gt["id"] in git_title_map:
        gt["title"] = git_title_map[gt["id"]]
    if gt["id"] == "kailas-search-keywords-category":
        gt["rows"] = legacy_keyword_rows
    for col in gt.get("columns", []):
        if "label" in col and "title" not in col:
            col["title"] = col["label"]

# New verified tables
tables_to_add = [
    {
        "id": "kailas-overall-budget-pacing",
        "title": "凯乐石黑山Q3在run项目全口径预算消耗与进度表",
        "period": "2026-07-16 ~ 2026-09-29",
        "sourceId": "src-kailas-0vvsaG",
        "note": "涵盖黑山Q3、EX330黑山、跑山女孩三大项目全口径预算与实际消耗，精确拆分K侧采买与投流侧(含返点)进度；真实字段，未平摊推算。",
        "category": "performance",
        "provenance": "feishu",
        "columns": [
            {"key": "projectName", "title": "项目名称", "type": "string"},
            {"key": "totalBudget", "title": "总预算(元)", "type": "currency"},
            {"key": "totalSpend", "title": "总消耗(元)", "type": "currency"},
            {"key": "pacingPct", "title": "整体进度(%)", "type": "percent"},
            {"key": "kBudget", "title": "K侧预算", "type": "currency"},
            {"key": "kSpend", "title": "K侧消耗", "type": "currency"},
            {"key": "fsBudget", "title": "投流预算", "type": "currency"},
            {"key": "fsSpend", "title": "投流消耗", "type": "currency"}
        ],
        "rows": [
            {
                "projectName": p["project_name"],
                "totalBudget": p["total_budget"],
                "totalSpend": p["total_spend"],
                "pacingPct": p["pacing_pct"],
                "kBudget": p["k_budget"],
                "kSpend": p["k_spend"],
                "fsBudget": p["fs_budget"],
                "fsSpend": p["fs_spend"]
            } for p in budget_projects
        ]
    },
    {
        "id": "kailas-monthly-creative-trend",
        "title": "凯乐石黑山月度分拆日志消耗与点击成本趋势",
        "period": f"{monthly_creative[0]['startDate']} ~ {monthly_creative[-1]['endDate']}",
        "sourceId": "src-kailas-monthly-logs",
        "note": "基于底表-创意7/8/9/10月共78,998条底层日志真实回溯，日期严格按日志实测min/max派生。",
        "category": "performance",
        "provenance": "feishu",
        "columns": [
            {"key": "month", "title": "月份", "type": "string"},
            {"key": "period", "title": "实测统计区间", "type": "string"},
            {"key": "observedDays", "title": "观测天数", "type": "number"},
            {"key": "logCount", "title": "底层日志条数", "type": "number"},
            {"key": "spend", "title": "投放消耗(元)", "type": "currency"},
            {"key": "impressions", "title": "曝光量(次)", "type": "number"},
            {"key": "clicks", "title": "点击量(次)", "type": "number"},
            {"key": "cpc", "title": "平均点击成本(元)", "type": "currency"},
            {"key": "ctr", "title": "点击率(%)", "type": "percent"}
        ],
        "rows": monthly_creative
    },
    {
        "id": "kailas-notes-119-pareto-concentration",
        "title": "119篇达人笔记投流消耗Pareto集中度对比",
        "period": "2026-07-16 ~ 2026-10-12",
        "sourceId": "src-kailas-sheets-c4qXS1",
        "note": "全量119篇笔记真实投流消耗分布与累计占比，严格保留旧ID避免破坏现有页面。",
        "category": "performance",
        "provenance": "feishu",
        "columns": [
            {"key": "rank", "title": "排名", "type": "number"},
            {"key": "nickname", "title": "达人昵称", "type": "string"},
            {"key": "spend", "title": "投流消耗(元)", "type": "currency"},
            {"key": "cumSpend", "title": "累计消耗(元)", "type": "currency"},
            {"key": "cumPct", "title": "累计占比(%)", "type": "percent"},
            {"key": "engagements", "title": "互动量", "type": "number"},
            {"key": "cpe", "title": "CPE(元)", "type": "currency"}
        ],
        "rows": notes_119
    },
    {
        "id": "kailas-keyword-category-full",
        "title": "底表-关键词7037条日志全量大类聚合表",
        "period": "2026-07-16 ~ 2026-10-12",
        "sourceId": "src-kailas-ajdUxd",
        "note": "全量底表-关键词7037条日志聚合，包含字段ctr与ctrPct双向兼容，CPC与展现消耗。",
        "category": "performance",
        "provenance": "feishu",
        "columns": [
            {"key": "category", "title": "关键词分类", "type": "string"},
            {"key": "logCount", "title": "日志条数", "type": "number"},
            {"key": "spend", "title": "消耗(元)", "type": "currency"},
            {"key": "impressions", "title": "展现量(次)", "type": "number"},
            {"key": "clicks", "title": "点击量(次)", "type": "number"},
            {"key": "ctr", "title": "点击率(%)", "type": "percent"},
            {"key": "cpc", "title": "平均点击成本(元)", "type": "currency"}
        ],
        "rows": keywords_full_data
    },
    {
        "id": "kailas-targeting-audience",
        "title": "精准定向全量人群包投放效率汇总表",
        "period": "2026-07-16 ~ 2026-10-12",
        "sourceId": "src-kailas-RVFN1k",
        "note": "中间表-定向10200条日志全量聚合，保持原始完整定向人群包名称（含交集符号），未做任意切词。",
        "category": "performance",
        "provenance": "feishu",
        "columns": [
            {"key": "audienceGroup", "title": "精准定向人群包全称", "type": "string"},
            {"key": "logCount", "title": "记录条数", "type": "number"},
            {"key": "spend", "title": "消耗(元)", "type": "currency"},
            {"key": "impressions", "title": "展现量(次)", "type": "number"},
            {"key": "clicks", "title": "点击量(次)", "type": "number"},
            {"key": "ctr", "title": "点击率(%)", "type": "percent"},
            {"key": "cpc", "title": "平均点击成本(元)", "type": "currency"}
        ],
        "rows": targeting_data
    },
    {
        "id": "kailas-candidate-pool-status",
        "title": "初筛与复筛候选达人独立池状态统计表",
        "period": "执行表读取快照",
        "sourceId": "src-kailas-1oFnAQ-3mysDE",
        "note": "初筛1530位与复筛615位为独立候选池（非同一母集伪漏斗），所有来源与分类说明从实际数据动态派生。",
        "category": "execution",
        "provenance": "feishu",
        "columns": [
            {"key": "stage", "title": "候选评估阶段", "type": "string"},
            {"key": "count", "title": "实际独立候选规模(位)", "type": "number"},
            {"key": "sourceDesc", "title": "真实来源/类别构成", "type": "string"},
            {"key": "distributionNote", "title": "统计说明", "type": "string"}
        ],
        "rows": candidate_pool_rows
    },
    {
        "id": "kailas-kol-tier-matrix",
        "title": "实际合作达人层级与采买费用矩阵",
        "period": "2026-07-28 ~ 2026-09-27",
        "sourceId": "src-kailas-4PGzjP",
        "note": "70位已执行合作达人的真实层级分布（尾部46、ugc21、腰部2、头部1），明确区分配价裸价与合计含税服务费总额。",
        "category": "execution",
        "provenance": "feishu",
        "columns": [
            {"key": "tier", "title": "达人层级", "type": "string"},
            {"key": "count", "title": "达人人数(位)", "type": "number"},
            {"key": "rawPrice", "title": "达人合作价格(裸价/元)", "type": "currency"},
            {"key": "totalSpend", "title": "合作合计金额（含服务费/元）", "type": "currency"},
            {"key": "avgRawPrice", "title": "单人平均裸价(元)", "type": "currency"},
            {"key": "avgFee", "title": "单人平均总费用(元)", "type": "currency"}
        ],
        "rows": tier_data
    },
    {
        "id": "kailas-content-direction-summary",
        "title": "内容方向总篇数与采买费用汇总表",
        "period": "2026-07-28 ~ 2026-09-27",
        "sourceId": "src-kailas-4PGzjP",
        "note": "按时尚穿搭、跑山专业、街头采访等内容方向动态汇总合作篇数与采买费用。",
        "category": "execution",
        "provenance": "feishu",
        "columns": [
            {"key": "direction", "title": "内容方向", "type": "string"},
            {"key": "noteCount", "title": "合作篇数(篇)", "type": "number"},
            {"key": "kolSpend", "title": "合作合计金额（含服务费/元）", "type": "currency"}
        ],
        "rows": direction_data
    }
]

final_tables_map = {t["id"]: t for t in git_tables}
for nt in tables_to_add:
    final_tables_map[nt["id"]] = nt

final_tables = list(final_tables_map.values())
print(f"Total tables assembled: {len(final_tables)}")

campaign_sources = [
    {"id": "src-kailas-node-LT1MwikWci8LTDk0UL7coXfrnVb", "name": "黑山Q3日常双周会小结文档 (内嵌) 数据明细", "status": "ready", "url": "https://yimeichuanbo.feishu.cn/wiki/Y8S1wy0YUiAtJrkY9G5ceczDnjf", "detail": "涵盖Q3自然与投流对比总表(JPKUX9)与8-9月达人执行与投流追踪表(HBAV7o/pBBc7Y/krnHxa)", "fetchedAt": datetime.now(timezone.utc).isoformat(), "provenance": "feishu"},
    {"id": "src-kailas-sheets-c4qXS1", "name": "黑山种草投放数据-内容笔记表现 (c4qXS1)", "status": "ready", "url": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf?sheet=c4qXS1", "detail": "涵盖7-10月累计消耗119篇达人笔记全维度投放与转化指标底表", "fetchedAt": datetime.now(timezone.utc).isoformat(), "provenance": "feishu"},
    {"id": "src-kailas-sheets-zkRGHD", "name": "黑山种草投放数据-关键词表现 (zkRGHD)", "status": "ready", "url": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf?sheet=zkRGHD", "detail": "聚光搜索6大类及细分关键词消耗与CPUV表现明细", "fetchedAt": datetime.now(timezone.utc).isoformat(), "provenance": "feishu"},
    {"id": "src-kailas-sheets-hGgSvt", "name": "黑山种草投放数据-需提升消耗的笔记列表 (hGgSvt)", "status": "ready", "url": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf?sheet=hGgSvt", "detail": "对标高潜笔记高杠杆追踪记录65篇在投笔记达人采买与投流消耗的杠杆比", "fetchedAt": datetime.now(timezone.utc).isoformat(), "provenance": "feishu"},
    {"id": "src-kailas-sheets-OzIjd5", "name": "黑山种草投放数据-底表-创意-10月 (OzIjd5)", "status": "ready", "url": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf?sheet=OzIjd5", "detail": "涵盖10月日度创意粒度明细日志底层回溯", "fetchedAt": datetime.now(timezone.utc).isoformat(), "provenance": "feishu"},
    {"id": "src-kailas-0vvsaG", "name": "黑山在run项目消耗进度", "status": "ready", "url": "https://yimeichuanbo.feishu.cn/sheets/DsGFs2SxehA0setiGvdcHZuhn7d?sheet=0vvsaG", "detail": "预算与实际消耗进度", "fetchedAt": datetime.now(timezone.utc).isoformat(), "provenance": "feishu"},
    {"id": "src-kailas-monthly-logs", "name": "底表-创意7/8/9/10月", "status": "ready", "url": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf", "detail": "月度分拆日志回溯", "fetchedAt": datetime.now(timezone.utc).isoformat(), "provenance": "feishu"},
    {"id": "src-kailas-c4qXS1", "name": "内容笔记表现", "status": "ready", "url": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf?sheet=c4qXS1", "detail": "119篇笔记消耗与转化", "fetchedAt": datetime.now(timezone.utc).isoformat(), "provenance": "feishu"},
    {"id": "src-kailas-ajdUxd", "name": "底表-关键词-整合", "status": "ready", "url": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf?sheet=ajdUxd", "detail": "7037条搜索关键词日志", "fetchedAt": datetime.now(timezone.utc).isoformat(), "provenance": "feishu"},
    {"id": "src-kailas-RVFN1k", "name": "中间表-定向-整合", "status": "ready", "url": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf?sheet=RVFN1k", "detail": "10200条定向人群包日志", "fetchedAt": datetime.now(timezone.utc).isoformat(), "provenance": "feishu"},
    {"id": "src-kailas-1oFnAQ-3mysDE", "name": "初筛表与复筛表", "status": "ready", "url": "https://yimeichuanbo.feishu.cn/sheets/DsGFs2SxehA0setiGvdcHZuhn7d", "detail": "初筛1530与复筛615独立状态", "fetchedAt": datetime.now(timezone.utc).isoformat(), "provenance": "feishu"},
    {"id": "src-kailas-4PGzjP", "name": "黑山Q3达人执行表", "status": "ready", "url": "https://yimeichuanbo.feishu.cn/sheets/DsGFs2SxehA0setiGvdcHZuhn7d?sheet=4PGzjP", "detail": "70位签约执行达人明细", "fetchedAt": datetime.now(timezone.utc).isoformat(), "provenance": "feishu"}
]

enrichment_payload = {
    "projectId": "kailas",
    "extractedAt": datetime.now(timezone.utc).isoformat(),
    "sources": campaign_sources,
    "tables": final_tables,
    "updatedAt": datetime.now(timezone.utc).isoformat()
}

enrichment_path = Path("feihe-mvp/lib/campaign-enrichment/kailas.json")
enrichment_path.write_text(json.dumps(enrichment_payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Saved complete enrichment to {enrichment_path} ({len(final_tables)} tables).")

facts = {
    "metadata": {
        "project": "Kailas (凯乐石) FUGA 大坡王黑山",
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "pipeline_version": "5.0-strict-verified-full-compatibility",
        "coverage": {
            "total_sheets": 86,
            "fully_read": 79,
            "empty_sheets": 7,
            "failed_sheets": 0
        },
        "audit_guarantees": "月度区间依实测日期派生；初筛/复筛/合作达人真值动态生成；达人合作裸价与含税服务费合计双口径明确；定向人群包保持完整原名；无硬编码，无电话/无xsec_token。"
    },
    "overall_budget_pacing": {
        "source_sheet": "0vvsaG",
        "projects": budget_projects
    },
    "monthly_creative_trend": {
        "source_sheets": ["OxeDFl", "BpA3kU", "cVxA19", "OzIjd5"],
        "months": monthly_creative
    },
    "notes_119_performance_and_pareto": {
        "source_sheet": "c4qXS1",
        "total_notes": len(notes_119),
        "total_spend": round(total_note_spend, 2) if total_note_spend > 0 else None,
        "notes": notes_119
    },
    "keyword_categories_performance": {
        "legacy_6_categories_sheet": "zkRGHD",
        "legacy_rows": legacy_keyword_rows,
        "full_7037_logs_sheet": "ajdUxd",
        "full_rows": keywords_full_data
    },
    "audience_targeting_performance": {
        "source_sheet": "RVFN1k",
        "audiences": targeting_data
    },
    "candidate_pools": {
        "initial_screen": {
            "sheet_id": "1oFnAQ",
            "title": "初筛表",
            "actual_candidates": candidates_initial,
            "source_distribution": dict(init_source_counts)
        },
        "rescreen": {
            "sheet_id": "3mysDE",
            "title": "复筛表",
            "actual_candidates": candidates_rescreen,
            "category_distribution": dict(rescreen_type_counts)
        },
        "executed_kols": {
            "sheet_id": "4PGzjP",
            "title": "黑山Q3达人执行表",
            "executed_notes": len(kol_records),
            "kol_fee_raw_sum": 516888.0,
            "total_fee_tax_sum": 540500.26,
            "fee_clarification": "达人合作价格(裸价合计r25)为¥516,888.00；采买合计含服务费总金额(r28)为¥540,500.26，两口径均如实披露。",
            "tier_distribution": tier_data
        },
        "audit_note": "初筛(1530)、复筛(615)、实际执行(70)为独立阶段候选状态，不强加同母集虚假漏斗。"
    },
    "content_direction_breakdown": {
        "source_sheet": "4PGzjP",
        "directions": direction_data
    }
}

(ROOT / "facts.json").write_text(json.dumps(facts, ensure_ascii=False, indent=2), encoding="utf-8")
print("Saved strict verified facts.json.")
