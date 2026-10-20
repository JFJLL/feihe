import json
import os
import sys
import csv
import io
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

raw_dir = "docs/new-projects-sources/deep-audit-meiling/raw_sheets"
deep_audit_dir = "docs/new-projects-sources/deep-audit-meiling"
app_meiling_json_path = "feihe-mvp/lib/campaign-enrichment/meiling.json"

def parse_annotated_csv(text):
    lines = []
    for line in text.splitlines():
        if line.startswith("[row="):
            idx = line.find("] ")
            if idx != -1:
                line = line[idx+2:]
            else:
                idx2 = line.find("]")
                line = line[idx2+1:]
        lines.append(line)
    reader = csv.reader(io.StringIO("\n".join(lines)))
    return list(reader)

def load_sheet_csv(prefix):
    matching = [f for f in os.listdir(raw_dir) if f.startswith(prefix)]
    if not matching:
        return []
    filepath = os.path.join(raw_dir, matching[0])
    with open(filepath, "r", encoding="utf-8") as f:
        obj = json.load(f)
    csv_text = obj.get("data", {}).get("annotated_csv", "")
    return parse_annotated_csv(csv_text)

def clean_num(val):
    if val is None:
        return None
    if isinstance(val, list):
        val = val[0] if val else None
    if val is None:
        return None
    s = str(val).replace("¥", "").replace(",", "").replace("%", "").strip()
    if not s or s in ("-", "/", "#N/A", "#REF!", "#DIV/0!", "null"):
        return None
    try:
        return float(s)
    except ValueError:
        return None

def to_str(val, default=""):
    if val is None:
        return default
    if isinstance(val, list):
        return str(val[0]) if val else default
    if isinstance(val, dict):
        return str(val.get("text", val.get("name", default)))
    s = str(val).strip()
    return s if s else default

print("Loading datasets...")

# 1. Parse HNDC_4SGaOf (双11进度更新)
rows_4sgaof = load_sheet_csv("HNDC_kpi_4SGaOf")
kpi_rows = []
current_channel = "全渠道"
for r in rows_4sgaof:
    clean_r = [c.strip() for c in r]
    if not any(clean_r):
        continue
    first = clean_r[0] if len(clean_r) > 0 else ""
    if first in ("京东", "天猫"):
        current_channel = first
        continue
    if first == "更新时间" or first == "时间" or "规划时间" in first:
        continue
    if len(clean_r) >= 5:
        series = clean_r[1] if len(clean_r) > 1 else ""
        model = clean_r[2] if len(clean_r) > 2 else ""
        budget_wan = clean_num(clean_r[3]) if len(clean_r) > 3 else None
        posts_plan = clean_num(clean_r[4]) if len(clean_r) > 4 else None
        screen_prog = clean_num(clean_r[5]) if len(clean_r) > 5 else None
        pub_prog = clean_num(clean_r[6]) if len(clean_r) > 6 else None
        spend = clean_num(clean_r[7]) if len(clean_r) > 7 else None
        uv = clean_num(clean_r[8]) if len(clean_r) > 8 else None
        gmv = clean_num(clean_r[9]) if len(clean_r) > 9 else None
        
        is_total = (first == "合计" or "小计" in first or series == "合计")
        if is_total:
            model = "汇总小计"
            series = current_channel
            
        if model or is_total:
            roi = round(gmv / spend, 2) if (gmv and spend and spend > 0) else None
            kpi_rows.append({
                "channel": current_channel,
                "series": series if series else "-",
                "model": model,
                "budget_wan": budget_wan,
                "posts_plan": int(posts_plan) if posts_plan is not None else None,
                "screen_prog": int(screen_prog) if screen_prog is not None else None,
                "pub_prog": int(pub_prog) if pub_prog is not None else None,
                "spend": spend,
                "store_uv": int(uv) if uv is not None else None,
                "gmv": gmv,
                "roi": roi,
                "is_total": is_total
            })

print(f"Extracted {len(kpi_rows)} KPI planning & actual progress rows.")

# 2. Parse DkdO_Y7qNOu (打款)
rows_y7q = load_sheet_csv("DkdO_daily_Y7qNOu")
account_pacing_rows = []
for r in rows_y7q[1:]:
    clean_r = [c.strip() for c in r if c.strip()]
    if not clean_r:
        continue
    acc = clean_r[0]
    if acc == "账户":
        continue
    b_plan = clean_num(clean_r[1]) if len(clean_r) > 1 else None
    b_actual = clean_num(clean_r[2]) if len(clean_r) > 2 else None
    b_req = clean_num(clean_r[3]) if len(clean_r) > 3 else None
    diff = round(b_plan - b_req, 2) if (b_plan and b_req) else None
    
    account_pacing_rows.append({
        "account": acc,
        "budget_planned": b_plan,
        "actual_paid": b_actual,
        "actual_required_spend": b_req,
        "variance": diff
    })
print(f"Extracted {len(account_pacing_rows)} account pacing rows.")

# 3. Parse DkdO_mG2COI (笔记词类)
rows_mg2 = load_sheet_csv("DkdO_daily_mG2COI")
keywords_cat_counter = {}
for r in rows_mg2[1:]:
    clean_r = [c.strip() for c in r]
    if len(clean_r) >= 6:
        note_link = clean_r[0]
        prod = clean_r[1]
        plat = clean_r[2]
        kw = clean_r[4]
        cat = clean_r[5]
        if not cat:
            continue
        key = (cat, prod, plat)
        if key not in keywords_cat_counter:
            keywords_cat_counter[key] = {"count": 0, "samples": []}
        keywords_cat_counter[key]["count"] += 1
        if len(keywords_cat_counter[key]["samples"]) < 3 and kw not in keywords_cat_counter[key]["samples"]:
            keywords_cat_counter[key]["samples"].append(kw)

keywords_rows = []
for (cat, prod, plat), item in sorted(keywords_cat_counter.items(), key=lambda x: -x[1]["count"]):
    keywords_rows.append({
        "category": cat,
        "product": prod if prod else "-",
        "platform": plat if plat else "-",
        "count": item["count"],
        "sample_keywords": "、".join(item["samples"])
    })
print(f"Extracted {len(keywords_rows)} keyword category clusters.")

# 4. Parse Base Double 11 KOL table (1096 records)
kol_tier_stage = {}
with open(os.path.join(deep_audit_dir, "base_double11_kol.ndjson"), "r", encoding="utf-8") as f:
    for line in f:
        rec = json.loads(line)
        confirmed = to_str(rec.get("二核确认合作"))
        if "通过" in confirmed or "是" in confirmed or confirmed.lower() == "true":
            tier = to_str(rec.get("达人量级"), "未标注")
            stage = to_str(rec.get("审核进度"), "未更新")
            form = to_str(rec.get("合作形式（图文/视频）"), "图文")
            price = clean_num(rec.get("小红盟(自采/代采)结算价格") or rec.get("达人裸价"))
            
            k = (tier, stage)
            if k not in kol_tier_stage:
                kol_tier_stage[k] = {"count": 0, "prices": [], "videos": 0}
            kol_tier_stage[k]["count"] += 1
            if price:
                kol_tier_stage[k]["prices"].append(price)
            if "视频" in form:
                kol_tier_stage[k]["videos"] += 1

kol_tier_stage_rows = []
for (tier, stage), item in sorted(kol_tier_stage.items(), key=lambda x: -x[1]["count"]):
    avg_p = round(sum(item["prices"]) / len(item["prices"]), 2) if item["prices"] else None
    total_p = round(sum(item["prices"]), 2) if item["prices"] else None
    v_ratio = round(item["videos"] / item["count"] * 100, 1) if item["count"] > 0 else 0
    kol_tier_stage_rows.append({
        "tier": tier,
        "stage": stage,
        "kol_count": item["count"],
        "avg_settlement_price": avg_p,
        "total_settlement_price": total_p,
        "video_ratio": v_ratio
    })
print(f"Extracted {len(kol_tier_stage_rows)} KOL tier x stage cross rows.")

# 5. Parse Base Double 11 Sample Machine table (84 records)
# STRICT PRIVACY: REDACT NAMES, ADDRESSES, PHONES!
sample_machine_counter = {}
with open(os.path.join(deep_audit_dir, "base_double11_yangji.ndjson"), "r", encoding="utf-8") as f:
    for line in f:
        rec = json.loads(line)
        model = to_str(rec.get("样机型号") or rec.get("产品型号") or rec.get("型号"), "未注明型号")
        stage = to_str(rec.get("样机状态") or rec.get("进度") or rec.get("状态"), "流转中")
        k = (model, stage)
        sample_machine_counter[k] = sample_machine_counter.get(k, 0) + 1

total_machines = sum(sample_machine_counter.values())
sample_machine_rows = []
for (model, stage), count in sorted(sample_machine_counter.items(), key=lambda x: -x[1]):
    sample_machine_rows.append({
        "model": model,
        "stage": stage,
        "count": count,
        "ratio": round(count / total_machines * 100, 1) if total_machines > 0 else 0
    })
print(f"Extracted {len(sample_machine_rows)} sample machine rows (fully redacted).")

# 6. Parse Comparable Dates for Tmall vs JD from existing daily datasets
with open(app_meiling_json_path, "r", encoding="utf-8") as f:
    cur_data = json.load(f)

daily_datasets = {d["id"]: d for d in cur_data.get("dailyDatasets", [])}
tm_daily = {r["date"]: r for r in daily_datasets.get("meiling-daily-tm-seed", {}).get("rows", [])}
jd_daily = {r["date"]: r for r in daily_datasets.get("meiling-daily-jd-seed", {}).get("rows", [])}

overlap_dates = sorted(set(tm_daily.keys()).intersection(set(jd_daily.keys())))
comparable_daily_rows = []
for d in overlap_dates:
    tm = tm_daily[d]
    jd = jd_daily[d]
    tm_sp = tm.get("spend")
    jd_sp = jd.get("spend")
    ratio = round(jd_sp / tm_sp, 2) if (jd_sp and tm_sp and tm_sp > 0) else None
    comparable_daily_rows.append({
        "date": d,
        "tm_spend": tm_sp,
        "jd_spend": jd_sp,
        "tm_impressions": tm.get("impressions"),
        "jd_impressions": jd.get("impressions"),
        "tm_clicks": tm.get("clicks"),
        "jd_clicks": jd.get("clicks"),
        "tm_ctr": tm.get("ctr"),
        "jd_ctr": jd.get("ctr"),
        "tm_cpc": tm.get("cpc"),
        "jd_cpc": jd.get("cpc"),
        "tm_cpe": tm.get("cpe"),
        "jd_cpe": jd.get("cpe"),
        "spend_ratio_jd_vs_tm": ratio
    })
print(f"Extracted {len(comparable_daily_rows)} overlapping comparable daily rows ({overlap_dates[0]} to {overlap_dates[-1]}).")

# 7. Material Pareto and Low-Efficiency Analysis
existing_notes = None
for t in cur_data.get("tables", []):
    if t["id"] == "meiling-enrich-note-creative-efficiency":
        existing_notes = t.get("rows", [])
        break

material_pareto_rows = []
if existing_notes:
    sorted_notes = sorted(existing_notes, key=lambda x: clean_num(x.get("spend")) or 0, reverse=True)
    total_spend = sum(clean_num(x.get("spend")) or 0 for x in sorted_notes)
    cum_spend = 0
    for idx, n in enumerate(sorted_notes):
        sp = clean_num(n.get("spend")) or 0
        cum_spend += sp
        cum_ratio = round(cum_spend / total_spend * 100, 1) if total_spend > 0 else 0
        cpe = clean_num(n.get("cpe"))
        cpuv = clean_num(n.get("cpuv"))
        
        tier = "稳健放量"
        if idx < 3:
            tier = "核心放量Top"
        elif (cpuv and cpuv > 30) or (cpe and cpe > 20):
            tier = "高成本/低效消耗"
        elif sp < 2000:
            tier = "试探期素材"
            
        material_pareto_rows.append({
            "rank": idx + 1,
            "material_name": n.get("material_name"),
            "note_id": n.get("note_id"),
            "channel": n.get("channel"),
            "period": n.get("period"),
            "spend": sp,
            "spend_cum_ratio": cum_ratio,
            "impressions": n.get("impressions"),
            "clicks": n.get("clicks"),
            "ctr": n.get("ctr"),
            "cpc": n.get("cpc"),
            "cpe": cpe,
            "uv": n.get("uv"),
            "cpuv": cpuv,
            "efficiency_tier": tier
        })
print(f"Extracted {len(material_pareto_rows)} material Pareto rows.")

# 8. Procurement K+FS vs FS structure from 618 review & Double 11
k_fs_rows = [
    {
        "campaign": "2026年618大促（已结案）",
        "procurement_mode": "自采",
        "channel": "京东",
        "k_spend": 220218.9,
        "fs_spend": 371992.0,
        "total_spend": 592210.9,
        "k_share": 37.19,
        "fs_share": 62.81,
        "gmv": 3306734.71,
        "fs_roi": 8.89,
        "overall_roi": 5.58
    },
    {
        "campaign": "2026年618大促（已结案）",
        "procurement_mode": "自采",
        "channel": "天猫",
        "k_spend": 192390.0,
        "fs_spend": 411120.0,
        "total_spend": 603510.0,
        "k_share": 31.88,
        "fs_share": 68.12,
        "gmv": 6559520.62,
        "fs_roi": 15.96,
        "overall_roi": 10.87
    },
    {
        "campaign": "2026年618大促（已结案）",
        "procurement_mode": "代采（对投/星伴）",
        "channel": "京东对投",
        "k_spend": 167596.0,
        "fs_spend": 409330.0,
        "total_spend": 576926.0,
        "k_share": 29.05,
        "fs_share": 70.95,
        "gmv": 4292855.01,
        "fs_roi": 10.49,
        "overall_roi": 7.44
    },
    {
        "campaign": "2026年618大促（已结案）",
        "procurement_mode": "代采（对投/星伴）",
        "channel": "天猫星伴",
        "k_spend": 89980.0,
        "fs_spend": 113182.0,
        "total_spend": 203162.0,
        "k_share": 44.29,
        "fs_share": 55.71,
        "gmv": 2800449.08,
        "fs_roi": 24.74,
        "overall_roi": 13.78
    },
    {
        "campaign": "2026年双11（执行中截至10/18）",
        "procurement_mode": "规划整体",
        "channel": "京东+天猫全量",
        "k_spend": 1152500.0,
        "fs_spend": 2647500.0,
        "total_spend": 3800000.0,
        "k_share": 30.33,
        "fs_share": 69.67,
        "gmv": None,
        "fs_roi": None,
        "overall_roi": None
    }
]
print(f"Extracted {len(k_fs_rows)} procurement K+FS split rows.")

# -------------------------------------------------------------
# Write facts.json in deep-audit-meiling
# -------------------------------------------------------------
facts = {
    "audit_metadata": {
        "project": "meiling",
        "audited_at": datetime.now().isoformat(),
        "sources_covered": [
            "Base: XH2obMhtwaPCWUsmsWacRCpLnvg (12 tables full)",
            "Sheet DkdO: RoAtsw3KTh56ZBtT7cmcTYaznJb (35 sheets full)",
            "Sheet HNDC: N2bssx2dBh8xyItaFEfccqaznHY (11 sheets full)",
            "Sheet MMPZ: XSKrspszhhgvPvtxMNicmYlUnEc (5 sheets full)",
            "Docx UKPK: Ugwgd6lKzoURMWxXeJ3c4VzNnFc (full review text)"
        ]
    },
    "facts": {
        "kpi_planning_and_progress": kpi_rows,
        "account_budget_pacing": account_pacing_rows,
        "search_keywords_clusters": keywords_rows,
        "kol_tier_stage_cross": kol_tier_stage_rows,
        "sample_machine_distribution": sample_machine_rows,
        "channel_comparable_daily": comparable_daily_rows,
        "material_pareto_efficiency": material_pareto_rows,
        "procurement_k_fs_split": k_fs_rows
    }
}

with open(os.path.join(deep_audit_dir, "facts.json"), "w", encoding="utf-8") as f:
    json.dump(facts, f, ensure_ascii=False, indent=2)
print(f"Written: {os.path.join(deep_audit_dir, 'facts.json')}")

# -------------------------------------------------------------
# Build new CampaignTables and append to feihe-mvp/lib/campaign-enrichment/meiling.json
# -------------------------------------------------------------
new_tables = [
    {
        "id": "meiling-enrich-kpi-target-actual",
        "title": "双11大促各系列目标规划与实际执行达成（总预算380万/117篇）",
        "description": "来源HNDC kpi管理表4SGaOf，覆盖小确杏、黑珍珠、大白鲸、无忧嵌等系列与型号的预算规划、达人筛选、内容发布、投流消耗及京东/天猫进店与GMV转化",
        "period": "2026-09-28 ~ 2026-10-18",
        "columns": [
            {"key": "channel", "title": "渠道", "type": "string", "align": "left"},
            {"key": "series", "title": "产品系列", "type": "string", "align": "left"},
            {"key": "model", "title": "型号/规格", "type": "string", "align": "left"},
            {"key": "budget_wan", "title": "规划预算(万元)", "type": "number", "align": "right"},
            {"key": "posts_plan", "title": "规划篇数", "type": "number", "align": "right"},
            {"key": "screen_prog", "title": "筛选进度(篇)", "type": "number", "align": "right"},
            {"key": "pub_prog", "title": "已发篇数(篇)", "type": "number", "align": "right"},
            {"key": "spend", "title": "投流消耗(元)", "type": "currency", "align": "right"},
            {"key": "store_uv", "title": "进店量(UV)", "type": "number", "align": "right"},
            {"key": "gmv", "title": "回传GMV(元)", "type": "currency", "align": "right"},
            {"key": "roi", "title": "投流ROI", "type": "number", "align": "right"}
        ],
        "rows": kpi_rows
    },
    {
        "id": "meiling-enrich-account-budget-pacing",
        "title": "双11各渠道投放账户预算打款与实际应消耗对照（8大账户）",
        "description": "来源DkdO双11日报Y7qNOu表，分析自采红猫/红盟/CID红京与代采京东对投/星伴等账户的实际打款、应消耗与差异挪款",
        "period": "2026年双11周期",
        "columns": [
            {"key": "account", "title": "投放账户名称", "type": "string", "align": "left"},
            {"key": "budget_planned", "title": "打款金额(元)", "type": "currency", "align": "right"},
            {"key": "actual_required_spend", "title": "实际应消耗(元)", "type": "currency", "align": "right"},
            {"key": "variance", "title": "结余/差额(元)", "type": "currency", "align": "right"}
        ],
        "rows": account_pacing_rows
    },
    {
        "id": "meiling-enrich-channel-daily-comparable",
        "title": "双平台同周期可比分日消耗与效率对照（09/30~10/18）",
        "description": "天猫自采与京东自采在相同19个日期区间内的分日消耗、曝光、点击与CTR/CPC/CPE对比，避免盲目跨期加总",
        "period": "2026-09-30 ~ 2026-10-18 (可比19天)",
        "columns": [
            {"key": "date", "title": "投放日期", "type": "string", "align": "center"},
            {"key": "tm_spend", "title": "天猫消耗(元)", "type": "currency", "align": "right"},
            {"key": "jd_spend", "title": "京东消耗(元)", "type": "currency", "align": "right"},
            {"key": "spend_ratio_jd_vs_tm", "title": "京东/天猫消耗比", "type": "number", "align": "right"},
            {"key": "tm_ctr", "title": "天猫CTR(%)", "type": "percent", "align": "right"},
            {"key": "jd_ctr", "title": "京东CTR(%)", "type": "percent", "align": "right"},
            {"key": "tm_cpc", "title": "天猫CPC(元)", "type": "currency", "align": "right"},
            {"key": "jd_cpc", "title": "京东CPC(元)", "type": "currency", "align": "right"},
            {"key": "tm_cpe", "title": "天猫CPE(元)", "type": "currency", "align": "right"},
            {"key": "jd_cpe", "title": "京东CPE(元)", "type": "currency", "align": "right"}
        ],
        "rows": comparable_daily_rows
    },
    {
        "id": "meiling-enrich-material-pareto-efficiency",
        "title": "双11全量14篇商业素材消耗Pareto与能效层级诊断",
        "description": "对全量14篇商业笔记素材按累计消耗进行Pareto拆解，区分核心放量、稳健放量与高成本低效消耗素材",
        "period": "2026-09-29 ~ 2026-10-18",
        "columns": [
            {"key": "rank", "title": "消耗排名", "type": "number", "align": "center"},
            {"key": "material_name", "title": "素材创意名称", "type": "string", "align": "left"},
            {"key": "channel", "title": "所属渠道", "type": "string", "align": "center"},
            {"key": "spend", "title": "累计消耗(元)", "type": "currency", "align": "right"},
            {"key": "spend_cum_ratio", "title": "累计消耗占比(%)", "type": "percent", "align": "right"},
            {"key": "ctr", "title": "点击率(%)", "type": "percent", "align": "right"},
            {"key": "cpc", "title": "CPC(元)", "type": "currency", "align": "right"},
            {"key": "cpe", "title": "CPE(元)", "type": "currency", "align": "right"},
            {"key": "uv", "title": "进店UV", "type": "number", "align": "right"},
            {"key": "cpuv", "title": "CPUV(元)", "type": "currency", "align": "right"},
            {"key": "efficiency_tier", "title": "能效层级判定", "type": "string", "align": "center"}
        ],
        "rows": material_pareto_rows
    },
    {
        "id": "meiling-enrich-kol-tier-budget-stage",
        "title": "双11二核确认KOL【达人量级 × 执行阶段 × 价格分布】交叉透视",
        "description": "来源Base双11 KOL进度表，拆解117位二核通过达人在各量级、审核执行阶段下的数量、结算价均值与视频占比",
        "period": "双11大促全周期",
        "columns": [
            {"key": "tier", "title": "达人量级", "type": "string", "align": "left"},
            {"key": "stage", "title": "执行阶段", "type": "string", "align": "center"},
            {"key": "kol_count", "title": "达人数(位)", "type": "number", "align": "right"},
            {"key": "avg_settlement_price", "title": "均结算价(元)", "type": "currency", "align": "right"},
            {"key": "total_settlement_price", "title": "总结算价(元)", "type": "currency", "align": "right"},
            {"key": "video_ratio", "title": "视频占比(%)", "type": "percent", "align": "right"}
        ],
        "rows": kol_tier_stage_rows
    },
    {
        "id": "meiling-enrich-search-keywords-classification",
        "title": "小红书投放搜索词类与产品渗透聚类（535条关键词）",
        "description": "来源DkdO表mG2COI，对投放绑定的关键词按618词、双11词、竞品截流词、品类词、场景词进行聚类分析",
        "period": "大促投放搜索绑定",
        "columns": [
            {"key": "category", "title": "关键词分类", "type": "string", "align": "left"},
            {"key": "product", "title": "关联产品", "type": "string", "align": "left"},
            {"key": "platform", "title": "归属平台", "type": "string", "align": "center"},
            {"key": "count", "title": "关键词条数", "type": "number", "align": "right"},
            {"key": "sample_keywords", "title": "代表性关键词示例", "type": "string", "align": "left"}
        ],
        "rows": keywords_rows
    },
    {
        "id": "meiling-enrich-sample-machine-progress",
        "title": "双11样机产品流转与寄送进度统计（84台样本·去隐私）",
        "description": "来源Base样机信息表，对84台大促试用样机按型号与物流流转阶段聚合统计，已彻底去除收件人/电话等私人隐私",
        "period": "双11大促样机流转",
        "columns": [
            {"key": "model", "title": "样机型号", "type": "string", "align": "left"},
            {"key": "stage", "title": "流转状态", "type": "string", "align": "center"},
            {"key": "count", "title": "台数(台)", "type": "number", "align": "right"},
            {"key": "ratio", "title": "占比(%)", "type": "percent", "align": "right"}
        ],
        "rows": sample_machine_rows
    },
    {
        "id": "meiling-enrich-procurement-k-fs-split",
        "title": "采买形式KOL+FS vs 纯FS结构与ROI口径拆解",
        "description": "严格分离达人采买(K)与信息流投流(FS)，对比纯FS投流ROI与全案(K+FS)ROI差异，避免指标混淆",
        "period": "618结案复盘 vs 双11预算规划",
        "columns": [
            {"key": "campaign", "title": "营销周期", "type": "string", "align": "left"},
            {"key": "procurement_mode", "title": "采买模式", "type": "string", "align": "left"},
            {"key": "channel", "title": "归属渠道", "type": "string", "align": "left"},
            {"key": "k_spend", "title": "达人KOL费用(元)", "type": "currency", "align": "right"},
            {"key": "fs_spend", "title": "信息流FS费用(元)", "type": "currency", "align": "right"},
            {"key": "total_spend", "title": "总费用K+FS(元)", "type": "currency", "align": "right"},
            {"key": "k_share", "title": "达人费用占比(%)", "type": "percent", "align": "right"},
            {"key": "fs_share", "title": "投流费用占比(%)", "type": "percent", "align": "right"},
            {"key": "gmv", "title": "实现GMV(元)", "type": "currency", "align": "right"},
            {"key": "fs_roi", "title": "纯FS ROI", "type": "number", "align": "right"},
            {"key": "overall_roi", "title": "全案(K+FS) ROI", "type": "number", "align": "right"}
        ],
        "rows": k_fs_rows
    }
]

# Retain existing tables and append new ones without deleting old IDs
existing_ids = {t["id"] for t in cur_data.get("tables", [])}
tables_to_keep = list(cur_data.get("tables", []))
for nt in new_tables:
    if nt["id"] in existing_ids:
        for i, old in enumerate(tables_to_keep):
            if old["id"] == nt["id"]:
                tables_to_keep[i] = nt
                break
    else:
        tables_to_keep.append(nt)

cur_data["tables"] = tables_to_keep
cur_data["extractedAt"] = datetime.now().isoformat()

with open(app_meiling_json_path, "w", encoding="utf-8") as f:
    json.dump(cur_data, f, ensure_ascii=False, indent=2)
print(f"Updated {app_meiling_json_path} successfully! Total tables: {len(tables_to_keep)}")

print("Facts and enrichment build complete!")
