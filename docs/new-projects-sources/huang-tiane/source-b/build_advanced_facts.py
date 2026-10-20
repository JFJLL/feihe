import csv, io, json, re, math, sys, datetime, collections
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path("docs/new-projects-sources/huang-tiane/source-b")
RAW = ROOT / "raw"
RAW_A = Path("docs/new-projects-sources/huang-tiane/source-a/raw")

def read_b(name):
    j = json.loads((RAW / name).read_text(encoding="utf-8"))
    return list(csv.reader(io.StringIO(re.sub(r"^\[row=\d+\] ?", "", j["annotated_csv"], flags=re.M))))

def read_a(name):
    j = json.loads((RAW_A / name).read_text(encoding="utf-8"))
    return list(csv.reader(io.StringIO(re.sub(r"^\[row=\d+\] ?", "", j["annotated_csv"], flags=re.M))))

def cell(r, i):
    return r[i].strip() if i < len(r) else ""

def num(v, pct=False):
    s = str(v or "").strip()
    if not s or s.startswith("#") or s in ("-", "—", "/", "#DIV/0!", "#REF!", "#N/A") or ("%" in s and not pct):
        return None
    try:
        n = float(s.replace(",", "").replace("¥", "").replace("￥", "").replace("%", ""))
        return n if math.isfinite(n) else None
    except ValueError:
        return None

def to_int_or_none(v):
    n = num(v)
    if n is None:
        return None
    return int(round(n))

def to_float_or_none(v, digits=2):
    n = num(v)
    if n is None:
        return None
    return round(n, digits)

def pct_points(v):
    """
    Normalize all percentage fields strictly to percentage points (e.g. 14.23 means 14.23%).
    Missing/invalid returns None.
    """
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.startswith("#") or s in ("-", "—", "/", "#DIV/0!", "#REF!", "#N/A"):
        return None
    if s.endswith("%"):
        try:
            return round(float(s[:-1].replace(",", "")), 4)
        except ValueError:
            return None
    try:
        f = float(s.replace(",", ""))
        if abs(f) <= 1.0 and f != 0:
            return round(f * 100.0, 4)
        return round(f, 4)
    except ValueError:
        return None

print("=== BUILDING FINAL ADVANCED FACTS (COMPLETE) ===")
facts_path = ROOT / "facts.json"
facts = json.loads(facts_path.read_text(encoding="utf-8"))

src_brand = {
    "id": "src-huang-tiane-brand-fs",
    "name": "黄天鹅品牌线26年10月项目报表-fs",
    "url": "https://yimeichuanbo.feishu.cn/sheets/F42ksAyO8hKRGNt2plhccnSWnNh",
    "status": "ready",
    "provenance": "feishu",
    "detail": "权威品牌投放源工作簿，包含日投放数据、广告类型、定向人群、搜索词类、素材形式、受众画像等透视表。"
}
src_commerce = {
    "id": "src-huang-tiane-commerce-canonical",
    "name": "黄天鹅商销日报主数据源",
    "url": "https://yimeichuanbo.feishu.cn/wiki/CqyPwlUTNiiD0lkXlZJcuyIYnCc",
    "status": "ready",
    "provenance": "feishu",
    "detail": "权威商销投放源，7770条真实明细记录底表c46f52及通投人群、创意透视表。"
}
src_cid = {
    "id": "src-huang-tiane-cid-fs",
    "name": "黄天鹅天猫CID 26年10月项目报表-fs",
    "url": "https://yimeichuanbo.feishu.cn/sheets/F42ksAyO8hKRGNt2plhccnSWnNh",
    "status": "ready",
    "provenance": "feishu",
    "detail": "天猫CID投放端报表（Source-A WB3），包含标准投、人群定向、素材形式等透视快照。"
}
src_manual = {
    "id": "src-huang-tiane-manual",
    "name": "同事日报补充",
    "status": "manual",
    "provenance": "manual",
    "detail": "同事10/20转发的蛋品行业大盘参考快照（10/1~10/17）及人工提报口径对照。"
}

facts["sources"] = [src_brand, src_commerce, src_cid, src_manual]

# Core 3 tables (summary, budget, commerce-summary)
core_table_ids = {"huang-brand-summary", "huang-brand-budget", "huang-commerce-summary"}
tables = [t for t in facts.get("tables", []) if t["id"] in core_table_ids]
for t in tables:
    if "rows" in t and len(t["rows"]) > 0:
        for r in t["rows"]:
            r["isSummary"] = True
        if t["id"] == "huang-brand-summary":
            t["sourceId"] = "src-huang-tiane-brand-fs"
            t["sourceSheetId"] = "Nm3Sev"
        elif t["id"] == "huang-brand-budget":
            t["sourceId"] = "src-huang-tiane-brand-fs"
            t["sourceSheetId"] = "Nm3Sev"
        elif t["id"] == "huang-commerce-summary":
            t["sourceId"] = "src-huang-tiane-commerce-canonical"
            t["sourceSheetId"] = "c46f52"


# -------------------------------------------------------------
# 1. huang-industry-benchmarks (用户原文12行，无eval，数字lower/upper，独立accountCount)
# -------------------------------------------------------------
print("\n--- 1. Industry Benchmarks (12 rows with numeric ranges) ---")
benchmarks_rows = [
    {"category": "生食/有机蛋", "accountCount": 6, "metric": "CTR", "lower": 11.17, "upper": 14.94, "unit": "%", "isSummary": False},
    {"category": "生食/有机蛋", "accountCount": 6, "metric": "CPC", "lower": 0.27, "upper": 0.37, "unit": "元", "isSummary": False},
    {"category": "生食/有机蛋", "accountCount": 6, "metric": "CPM", "lower": 36.86, "upper": 49.29, "unit": "元", "isSummary": False},
    {"category": "生食/有机蛋", "accountCount": 6, "metric": "CPE", "lower": 27.93, "upper": 37.35, "unit": "元", "isSummary": False},
    {"category": "生食/有机蛋", "accountCount": 6, "metric": "CPI", "lower": 0.98, "upper": 1.30, "unit": "元", "isSummary": False},
    {"category": "生食/有机蛋", "accountCount": 6, "metric": "CPTI", "lower": 4.70, "upper": 6.28, "unit": "元", "isSummary": False},
    {"category": "新鲜蛋", "accountCount": 169, "metric": "CTR", "lower": 9.69, "upper": 12.96, "unit": "%", "isSummary": False},
    {"category": "新鲜蛋", "accountCount": 169, "metric": "CPC", "lower": 0.26, "upper": 0.34, "unit": "元", "isSummary": False},
    {"category": "新鲜蛋", "accountCount": 169, "metric": "CPM", "lower": 29.83, "upper": 39.89, "unit": "元", "isSummary": False},
    {"category": "新鲜蛋", "accountCount": 169, "metric": "CPE", "lower": 21.91, "upper": 29.30, "unit": "元", "isSummary": False},
    {"category": "新鲜蛋", "accountCount": 169, "metric": "CPI", "lower": 0.54, "upper": 0.72, "unit": "元", "isSummary": False},
    {"category": "新鲜蛋", "accountCount": 169, "metric": "CPTI", "lower": 2.08, "upper": 2.78, "unit": "元", "isSummary": False}
]

tables.append({
    "id": "huang-industry-benchmarks",
    "title": "蛋品行业大盘投放基准对照表 (生食/有机蛋 vs 新鲜蛋)",
    "period": "2026-10-01 ~ 2026-10-17",
    "sourceId": "src-huang-tiane-manual",
    "sourceSheetId": "manual_industry_benchmarks",
    "category": "kpi",
    "percentScale": "points",
    "note": "来源：用户10/20转发日报人工快照。行业参考大盘上下限区间(数字尺度，CTR单位为百分数点，成本单位元)。10/1-10/17与10/19投放不同期，仅供参考，不作同周期考核；不设主观评价标签。",
    "columns": [
        {"key": "category", "title": "品类类型", "type": "string", "align": "center"},
        {"key": "accountCount", "title": "有效账户数", "type": "number", "align": "right"},
        {"key": "metric", "title": "参考指标", "type": "string", "align": "center"},
        {"key": "lower", "title": "行业下限", "type": "number", "align": "right"},
        {"key": "upper", "title": "行业上限", "type": "number", "align": "right"},
        {"key": "unit", "title": "单位", "type": "string", "align": "center"}
    ],
    "rows": benchmarks_rows
})

# -------------------------------------------------------------
# 2. huang-brand-ad-types (品牌广告类型: QEoiVr row4严格对齐)
# -------------------------------------------------------------
print("\n--- 2. Brand Ad Types (QEoiVr row4) ---")
qe_rows = read_b("brand_fs_QEoiVr.json")
ad_type_rows = []
ad_type_summary = None
for r in qe_rows[4:7]:
    t_name = cell(r, 0)
    if not t_name: continue
    is_sum = (t_name == "总计")
    display_name = "信息流 (Feeds)" if t_name == "信" else ("搜索 (Search)" if t_name == "搜" else t_name)
    si = to_int_or_none(cell(r, 12))
    sti = to_int_or_none(cell(r, 14))
    stotal = (si + sti) if (si is not None and sti is not None) else None
    item = {
        "adType": display_name,
        "rawType": t_name,
        "spend": to_float_or_none(cell(r, 1)),
        "spendRatio": pct_points(cell(r, 17)),
        "impressions": to_int_or_none(cell(r, 2)),
        "clicks": to_int_or_none(cell(r, 3)),
        "ctr": pct_points(cell(r, 4)),
        "cpc": to_float_or_none(cell(r, 5)),
        "cpm": to_float_or_none(cell(r, 6)),
        "plays5s": to_int_or_none(cell(r, 7)),
        "ctr5s": pct_points(cell(r, 8)),
        "cpc5s": to_float_or_none(cell(r, 9)),
        "engagements": to_int_or_none(cell(r, 10)),
        "cpe": to_float_or_none(cell(r, 11)),
        "seed_i": si,
        "cpi": to_float_or_none(cell(r, 13)),
        "seed_ti": sti,
        "cpti": to_float_or_none(cell(r, 15)),
        "seed_total": stotal,
        "cp_total": to_float_or_none(cell(r, 16)),
        "isSummary": is_sum
    }
    ad_type_rows.append(item)
    if is_sum:
        ad_type_summary = item

tables.append({
    "id": "huang-brand-ad-types",
    "title": "品牌线广告类型投放表现 (信息流 vs 搜索)",
    "period": "2026-10-01 ~ 2026-10-19",
    "sourceId": "src-huang-tiane-brand-fs",
    "sourceSheetId": "QEoiVr",
    "sourceUrl": "https://yimeichuanbo.feishu.cn/sheets/F42ksAyO8hKRGNt2plhccnSWnNh?sheet=QEoiVr",
    "category": "performance",
    "percentScale": "points",
    "summary": ad_type_summary,
    "note": "来源于Sheet QEoiVr Row 4-7。信息流占消耗73.29%(13.07万元)，搜索占26.71%(4.76万元)。种草总人数由I+TI相加(信息流93,150人，搜索176,700人，总计269,850人)。比率指标统一为百分数点。总计行已标记isSummary=true并在summary另存。",
    "columns": [
        {"key": "adType", "title": "广告类型", "type": "string", "align": "left"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "spendRatio", "title": "消耗占比(%)", "type": "number", "align": "right"},
        {"key": "impressions", "title": "展现量", "type": "number", "align": "right"},
        {"key": "clicks", "title": "点击量", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"},
        {"key": "cpm", "title": "千次展现成本(CPM)", "type": "currency", "align": "right"},
        {"key": "plays5s", "title": "5s播放量", "type": "number", "align": "right"},
        {"key": "ctr5s", "title": "5s播放率(%)", "type": "number", "align": "right"},
        {"key": "engagements", "title": "互动量", "type": "number", "align": "right"},
        {"key": "cpe", "title": "互动成本(CPE)", "type": "currency", "align": "right"},
        {"key": "seed_i", "title": "种草I人群", "type": "number", "align": "right"},
        {"key": "seed_ti", "title": "种草TI人群", "type": "number", "align": "right"},
        {"key": "seed_total", "title": "种草总人群(I+TI)", "type": "number", "align": "right"},
        {"key": "cp_total", "title": "种草总成本(元)", "type": "currency", "align": "right"}
    ],
    "rows": ad_type_rows
})

# -------------------------------------------------------------
# 3. huang-brand-audiences (品牌定向人群: 2gbbSY 严格 rows 7..41 共35行，排除第二个pivot)
# -------------------------------------------------------------
print("\n--- 3. Brand Audiences (2gbbSY rows 7..41 exactly 35 rows) ---")
aud_rows = read_b("brand_fs_2gbbSY.json")
brand_audience_rows = []
for r in aud_rows[6:41]: # rows 7..41
    aud_name = cell(r, 0)
    if not aud_name: continue
    sp = to_float_or_none(cell(r, 1))
    if sp is None: continue
    si = to_int_or_none(cell(r, 12))
    sti = to_int_or_none(cell(r, 14))
    stotal = (si + sti) if (si is not None and sti is not None) else to_int_or_none(cell(r, 16))
    brand_audience_rows.append({
        "audience": aud_name,
        "spend": sp,
        "impressions": to_int_or_none(cell(r, 2)),
        "clicks": to_int_or_none(cell(r, 3)),
        "ctr": pct_points(cell(r, 4)),
        "cpc": to_float_or_none(cell(r, 5)),
        "cpm": to_float_or_none(cell(r, 6)),
        "plays5s": to_int_or_none(cell(r, 7)),
        "ctr5s": pct_points(cell(r, 8)),
        "engagements": to_int_or_none(cell(r, 10)),
        "cpe": to_float_or_none(cell(r, 11)),
        "seed_i": si,
        "seed_ti": sti,
        "seed_total": stotal,
        "cp_total": to_float_or_none(cell(r, 17)),
        "isSummary": False
    })

# Row 42 is total row for Feeds audiences (130,706.05)
r42 = aud_rows[41] if len(aud_rows) > 41 else []
aud_total_summary = {
    "audience": "信息流定向人群总计",
    "spend": to_float_or_none(cell(r42, 1)),
    "impressions": to_int_or_none(cell(r42, 2)),
    "clicks": to_int_or_none(cell(r42, 3)),
    "ctr": pct_points(cell(r42, 4)),
    "cpc": to_float_or_none(cell(r42, 5)),
    "cpm": to_float_or_none(cell(r42, 6)),
    "plays5s": to_int_or_none(cell(r42, 7)),
    "ctr5s": pct_points(cell(r42, 8)),
    "engagements": to_int_or_none(cell(r42, 10)),
    "cpe": to_float_or_none(cell(r42, 11)),
    "seed_i": to_int_or_none(cell(r42, 12)),
    "seed_ti": to_int_or_none(cell(r42, 14)),
    "seed_total": to_int_or_none(cell(r42, 16)),
    "cp_total": to_float_or_none(cell(r42, 17)),
    "isSummary": True
}

brand_audience_rows.sort(key=lambda x: (x["spend"] if x["spend"] is not None else -1), reverse=True)
assert len(brand_audience_rows) == 35, f"Expected 35 audience rows, got {len(brand_audience_rows)}"
assert abs(sum(r["spend"] for r in brand_audience_rows) - 130706.05) < 0.1, "Audience sum must equal 130706.05"

tables.append({
    "id": "huang-brand-audiences",
    "title": "品牌线定向人群投放表现 (信息流版位)",
    "period": "2026-10-01 ~ 2026-10-19 (信息流版位)",
    "sourceId": "src-huang-tiane-brand-fs",
    "sourceSheetId": "2gbbSY",
    "sourceUrl": "https://yimeichuanbo.feishu.cn/sheets/F42ksAyO8hKRGNt2plhccnSWnNh?sheet=2gbbSY",
    "category": "performance",
    "percentScale": "points",
    "summary": aud_total_summary,
    "note": "来源于Sheet 2gbbSY信息流定向人群透视(Row 4广告类型=信)，严格提取Row 7..41共35个人群细分(isSummary=false)，未串入下方Row 71开始的第二个独立词类透视。35个人群消耗总计130,706.05元(另存于summary对象)。",
    "columns": [
        {"key": "audience", "title": "定向人群", "type": "string", "align": "left"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "impressions", "title": "展现量", "type": "number", "align": "right"},
        {"key": "clicks", "title": "点击量", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"},
        {"key": "cpm", "title": "千次展现成本(CPM)", "type": "currency", "align": "right"},
        {"key": "plays5s", "title": "5s播放量", "type": "number", "align": "right"},
        {"key": "engagements", "title": "互动量", "type": "number", "align": "right"},
        {"key": "cpe", "title": "互动成本(CPE)", "type": "currency", "align": "right"},
        {"key": "seed_i", "title": "种草I人群", "type": "number", "align": "right"},
        {"key": "seed_ti", "title": "种草TI人群", "type": "number", "align": "right"},
        {"key": "seed_total", "title": "种草总人群(I+TI)", "type": "number", "align": "right"},
        {"key": "cp_total", "title": "种草总成本", "type": "currency", "align": "right"}
    ],
    "rows": brand_audience_rows
})

# -------------------------------------------------------------
# 4. huang-brand-keywords (品牌搜索词类: UJzwTd rows 5..14 共10行)
# -------------------------------------------------------------
print("\n--- 4. Brand Keyword Categories (UJzwTd rows 5..14 exactly 10 rows) ---")
kw_rows = read_b("brand_fs_UJzwTd.json")
brand_kw_rows = []
for r in kw_rows[4:14]: # rows 5..14
    cat = cell(r, 0)
    if not cat: continue
    sp = to_float_or_none(cell(r, 1))
    if sp is None: continue
    brand_kw_rows.append({
        "keywordCategory": cat,
        "spend": sp,
        "impressions": to_int_or_none(cell(r, 2)),
        "clicks": to_int_or_none(cell(r, 3)),
        "ctr": pct_points(cell(r, 4)),
        "cpc": to_float_or_none(cell(r, 5)),
        "cpm": to_float_or_none(cell(r, 6)),
        "isSummary": False
    })

r15 = kw_rows[14] if len(kw_rows) > 14 else []
kw_total_summary = {
    "keywordCategory": "搜索词类总计",
    "spend": to_float_or_none(cell(r15, 1)),
    "impressions": to_int_or_none(cell(r15, 2)),
    "clicks": to_int_or_none(cell(r15, 3)),
    "ctr": pct_points(cell(r15, 4)),
    "cpc": to_float_or_none(cell(r15, 5)),
    "cpm": to_float_or_none(cell(r15, 6)),
    "isSummary": True
}
brand_kw_rows.sort(key=lambda x: (x["spend"] if x["spend"] is not None else -1), reverse=True)
assert len(brand_kw_rows) == 10, f"Expected 10 keyword rows, got {len(brand_kw_rows)}"
assert abs(sum(r["spend"] for r in brand_kw_rows) - 47636.54) < 0.1, "Keyword sum must equal 47636.54"

tables.append({
    "id": "huang-brand-keywords",
    "title": "品牌线搜索词类投放表现",
    "period": "2026-10-01 ~ 2026-10-19",
    "sourceId": "src-huang-tiane-brand-fs",
    "sourceSheetId": "UJzwTd",
    "sourceUrl": "https://yimeichuanbo.feishu.cn/sheets/F42ksAyO8hKRGNt2plhccnSWnNh?sheet=UJzwTd",
    "category": "performance",
    "percentScale": "points",
    "summary": kw_total_summary,
    "note": "来源于Sheet UJzwTd搜索数据透视Row 5..14共10个词类细分(isSummary=false)。品牌词贡献最大搜索消耗(2.88万元)，品类需求词与溏心蛋相关词次之。总计47,636.54元另存于summary对象。",
    "columns": [
        {"key": "keywordCategory", "title": "搜索词类", "type": "string", "align": "left"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "impressions", "title": "展现量", "type": "number", "align": "right"},
        {"key": "clicks", "title": "点击量", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"},
        {"key": "cpm", "title": "千次展现成本(CPM)", "type": "currency", "align": "right"}
    ],
    "rows": brand_kw_rows
})

# -------------------------------------------------------------
# 5. huang-brand-note-types, tiers, and content tags (hKnPdA)
# -------------------------------------------------------------
print("\n--- 5. Brand Note Forms, Tiers & Tags (hKnPdA) ---")
note_rows = read_b("brand_fs_hKnPdA.json")

# Note formats (rows 6:8, row 8 is total)
brand_note_type_rows = []
note_type_summary = None
for r in note_rows[5:8]:
    fmt = cell(r, 0)
    if not fmt: continue
    is_sum = (fmt == "总计")
    item = {
        "noteFormat": fmt,
        "spend": to_float_or_none(cell(r, 1)),
        "impressions": to_int_or_none(cell(r, 2)),
        "clicks": to_int_or_none(cell(r, 3)),
        "ctr": pct_points(cell(r, 4)),
        "cpc": to_float_or_none(cell(r, 5)),
        "cpm": to_float_or_none(cell(r, 6)),
        "plays5s": to_int_or_none(cell(r, 7)),
        "isSummary": is_sum
    }
    brand_note_type_rows.append(item)
    if is_sum: note_type_summary = item

tables.append({
    "id": "huang-brand-note-types",
    "title": "品牌线笔记形式投放表现 (视频 vs 图文)",
    "period": "2026-10-01 ~ 2026-10-19",
    "sourceId": "src-huang-tiane-brand-fs",
    "sourceSheetId": "hKnPdA",
    "category": "performance",
    "percentScale": "points",
    "summary": note_type_summary,
    "columns": [
        {"key": "noteFormat", "title": "素材形式", "type": "string", "align": "left"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "impressions", "title": "展现量", "type": "number", "align": "right"},
        {"key": "clicks", "title": "点击量", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"},
        {"key": "cpm", "title": "千次展现成本(CPM)", "type": "currency", "align": "right"},
        {"key": "plays5s", "title": "5s播放量", "type": "number", "align": "right"}
    ],
    "rows": brand_note_type_rows
})

# KOL tiers (rows 14:19 are 6 tiers, row 20 is total)
brand_tier_rows = []
tier_summary = None
for r in note_rows[13:20]:
    tier = cell(r, 0)
    if not tier or tier == "达人量级": continue
    is_sum = (tier == "总计")
    item = {
        "tier": tier,
        "spend": to_float_or_none(cell(r, 1)),
        "impressions": to_int_or_none(cell(r, 2)),
        "clicks": to_int_or_none(cell(r, 3)),
        "ctr": pct_points(cell(r, 4)),
        "cpc": to_float_or_none(cell(r, 5)),
        "cpm": to_float_or_none(cell(r, 6)),
        "isSummary": is_sum
    }
    brand_tier_rows.append(item)
    if is_sum: tier_summary = item

tables.append({
    "id": "huang-brand-kol-tiers",
    "title": "品牌线达人量级投放表现",
    "period": "2026-10-01 ~ 2026-10-19",
    "sourceId": "src-huang-tiane-brand-fs",
    "sourceSheetId": "hKnPdA",
    "category": "performance",
    "percentScale": "points",
    "summary": tier_summary,
    "note": "来源于Sheet hKnPdA达人量级透视。精选博主(3-10w)为核心中坚，消耗12.65万元(占比70.9%)。总计行已标记isSummary=true并在summary另存。",
    "columns": [
        {"key": "tier", "title": "达人量级", "type": "string", "align": "left"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "impressions", "title": "展现量", "type": "number", "align": "right"},
        {"key": "clicks", "title": "点击量", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"},
        {"key": "cpm", "title": "千次展现成本(CPM)", "type": "currency", "align": "right"}
    ],
    "rows": brand_tier_rows
})

# Content tags (rows 25:35 are 11 content tags, row 36 is total 178342.67)
brand_tag_rows = []
tag_summary = None
for r in note_rows[24:36]: # rows 25..36
    tag = cell(r, 0)
    if not tag or tag == "内容标签": continue
    is_sum = (tag == "总计")
    item = {
        "contentTag": tag,
        "spend": to_float_or_none(cell(r, 1)),
        "impressions": to_int_or_none(cell(r, 2)),
        "clicks": to_int_or_none(cell(r, 3)),
        "ctr": pct_points(cell(r, 4)),
        "cpc": to_float_or_none(cell(r, 5)),
        "cpm": to_float_or_none(cell(r, 6)),
        "plays5s": to_int_or_none(cell(r, 7)),
        "isSummary": is_sum
    }
    brand_tag_rows.append(item)
    if is_sum: tag_summary = item

tables.append({
    "id": "huang-brand-content-tags",
    "title": "品牌线笔记内容标签投放表现",
    "period": "2026-10-01 ~ 2026-10-19",
    "sourceId": "src-huang-tiane-brand-fs",
    "sourceSheetId": "hKnPdA",
    "category": "performance",
    "percentScale": "points",
    "summary": tag_summary,
    "note": "来源于Sheet hKnPdA内容标签透视，完整提取全部11个内容标签（美食制作、送礼-长辈、运动健身、生活记录、商业财经、文化创意、中秋囤货、送礼-值得感谢的人、养生分享、节庆送礼、好物分享），消耗合计与总表完全吻合(178,342.67元)。总计行标记isSummary=true并在summary另存。",
    "columns": [
        {"key": "contentTag", "title": "内容标签", "type": "string", "align": "left"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "impressions", "title": "展现量", "type": "number", "align": "right"},
        {"key": "clicks", "title": "点击量", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"},
        {"key": "cpm", "title": "千次展现成本(CPM)", "type": "currency", "align": "right"},
        {"key": "plays5s", "title": "5s播放量", "type": "number", "align": "right"}
    ],
    "rows": brand_tag_rows
})

# -------------------------------------------------------------
# 6. huang-brand-demographics (7pkBrd: 性别, 年龄, 性别X年龄, 59个省市全量)
# -------------------------------------------------------------
print("\n--- 6. Brand Demographics (7pkBrd) ---")
demo_rows = read_b("brand_fs_7pkBrd.json")

# Gender (rows 3:5 are breakdown, row 6 is total)
gender_rows = []
gender_summary = None
for r in demo_rows[2:6]:
    g = cell(r, 0)
    if not g: continue
    is_sum = (g == "总计")
    item = {
        "gender": g,
        "spend": to_float_or_none(cell(r, 1)),
        "impressions": to_int_or_none(cell(r, 2)),
        "clicks": to_int_or_none(cell(r, 3)),
        "ctr": pct_points(cell(r, 4)),
        "cpc": to_float_or_none(cell(r, 5)),
        "cpm": to_float_or_none(cell(r, 6)),
        "engagements": to_int_or_none(cell(r, 7)),
        "cpe": to_float_or_none(cell(r, 8)),
        "isSummary": is_sum
    }
    gender_rows.append(item)
    if is_sum: gender_summary = item

tables.append({
    "id": "huang-brand-gender",
    "title": "品牌线受众性别分布表现",
    "period": "2026-10-01 ~ 2026-10-19",
    "sourceId": "src-huang-tiane-brand-fs",
    "sourceSheetId": "7pkBrd",
    "category": "performance",
    "percentScale": "points",
    "summary": gender_summary,
    "note": "来源于Sheet 7pkBrd受众性别透视。女性受众占消耗92.4%(16.48万元)。总计178,342.69元(isSummary=true)与日表178,342.67元存在0.02元微小差值，保留原表数据不猜原因。",
    "columns": [
        {"key": "gender", "title": "性别", "type": "string", "align": "center"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "impressions", "title": "展现量", "type": "number", "align": "right"},
        {"key": "clicks", "title": "点击量", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"},
        {"key": "cpm", "title": "千次展现成本(CPM)", "type": "currency", "align": "right"},
        {"key": "engagements", "title": "互动量", "type": "number", "align": "right"},
        {"key": "cpe", "title": "互动成本(CPE)", "type": "currency", "align": "right"}
    ],
    "rows": gender_rows
})

# Pure Age Group (rows 11:18 are 8 age groups, row 19 is total)
age_rows = []
age_summary = None
for r in demo_rows[10:19]:
    ag = cell(r, 0)
    if not ag: continue
    is_sum = (ag == "总计")
    item = {
        "ageGroup": ag,
        "spend": to_float_or_none(cell(r, 1)),
        "impressions": to_int_or_none(cell(r, 2)),
        "clicks": to_int_or_none(cell(r, 3)),
        "ctr": pct_points(cell(r, 4)),
        "cpc": to_float_or_none(cell(r, 5)),
        "cpm": to_float_or_none(cell(r, 6)),
        "engagements": to_int_or_none(cell(r, 7)),
        "cpe": to_float_or_none(cell(r, 8)),
        "isSummary": is_sum
    }
    age_rows.append(item)
    if is_sum: age_summary = item

tables.append({
    "id": "huang-brand-age",
    "title": "品牌线受众年龄分布表现",
    "period": "2026-10-01 ~ 2026-10-19",
    "sourceId": "src-huang-tiane-brand-fs",
    "sourceSheetId": "7pkBrd",
    "category": "performance",
    "percentScale": "points",
    "summary": age_summary,
    "note": "来源于Sheet 7pkBrd原表年龄独立汇总。33-40岁消耗最高(5.92万元)，28-32岁次之(4.70万元)。指标由原表原量严格计算，未加权平均比率。总计行已标记isSummary=true并在summary另存。",
    "columns": [
        {"key": "ageGroup", "title": "年龄区间", "type": "string", "align": "center"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "impressions", "title": "展现量", "type": "number", "align": "right"},
        {"key": "clicks", "title": "点击量", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"},
        {"key": "cpm", "title": "千次展现成本(CPM)", "type": "currency", "align": "right"},
        {"key": "engagements", "title": "互动量", "type": "number", "align": "right"},
        {"key": "cpe", "title": "互动成本(CPE)", "type": "currency", "align": "right"}
    ],
    "rows": age_rows
})

# Gender x Age 2D Cross Table (rows 3:28, col 11:20 with forward-filled gender)
gender_age_rows = []
cur_gender = "未知"
for r in demo_rows[2:30]:
    g_raw = cell(r, 11)
    if g_raw and not g_raw.endswith("总计") and g_raw not in ("性别", "总计"):
        cur_gender = g_raw
    ag = cell(r, 12)
    sp = to_float_or_none(cell(r, 13))
    if not ag or ag in ("年龄", "总计") or sp is None:
        continue
    gender_age_rows.append({
        "gender": cur_gender,
        "ageGroup": ag,
        "genderAge": f"{cur_gender} {ag}",
        "spend": sp,
        "impressions": to_int_or_none(cell(r, 14)),
        "clicks": to_int_or_none(cell(r, 15)),
        "ctr": pct_points(cell(r, 16)),
        "cpc": to_float_or_none(cell(r, 17)),
        "cpm": to_float_or_none(cell(r, 18)),
        "engagements": to_int_or_none(cell(r, 19)),
        "cpe": to_float_or_none(cell(r, 20)),
        "isSummary": False
    })

tables.append({
    "id": "huang-brand-gender-age",
    "title": "品牌线受众性别×年龄二维细分表现",
    "period": "2026-10-01 ~ 2026-10-19",
    "sourceId": "src-huang-tiane-brand-fs",
    "sourceSheetId": "7pkBrd",
    "category": "performance",
    "percentScale": "points",
    "note": "来源于Sheet 7pkBrd右侧L:U列原始二维透视表，向下填充性别前缀，完整覆盖女/男/未知各个年龄交叉细分(均为isSummary=false)。",
    "columns": [
        {"key": "gender", "title": "性别", "type": "string", "align": "center"},
        {"key": "ageGroup", "title": "年龄区间", "type": "string", "align": "center"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "impressions", "title": "展现量", "type": "number", "align": "right"},
        {"key": "clicks", "title": "点击量", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"},
        {"key": "cpm", "title": "千次展现成本(CPM)", "type": "currency", "align": "right"},
        {"key": "engagements", "title": "互动量", "type": "number", "align": "right"},
        {"key": "cpe", "title": "互动成本(CPE)", "type": "currency", "align": "right"}
    ],
    "rows": gender_age_rows
})

# Province / Region: ALL 59 rows (rows 24..82, row 83 is total)
province_rows = []
province_summary = None
for r in demo_rows[23:83]: # rows 24..83
    prov = cell(r, 0)
    if not prov or prov == "省份": continue
    is_sum = (prov == "总计")
    sp = to_float_or_none(cell(r, 1))
    if sp is None: continue
    item = {
        "province": prov,
        "spend": sp,
        "impressions": to_int_or_none(cell(r, 2)),
        "clicks": to_int_or_none(cell(r, 3)),
        "ctr": pct_points(cell(r, 4)),
        "cpc": to_float_or_none(cell(r, 5)),
        "cpm": to_float_or_none(cell(r, 6)),
        "engagements": to_int_or_none(cell(r, 7)),
        "cpe": to_float_or_none(cell(r, 8)),
        "isSummary": is_sum
    }
    province_rows.append(item)
    if is_sum: province_summary = item

tables.append({
    "id": "huang-brand-provinces",
    "title": "品牌线受众地域（省份与地区）投放表现",
    "period": "2026-10-01 ~ 2026-10-19",
    "sourceId": "src-huang-tiane-brand-fs",
    "sourceSheetId": "7pkBrd",
    "category": "performance",
    "percentScale": "points",
    "summary": province_summary,
    "note": "来源于Sheet 7pkBrd地域透视，完整提取全部59个省市/地区（含国内省市及海外归属地区，无人工截断）。广东为最大投放省份(2.79万元)。总消耗178,342.69元与总表存在0.02元差值，保留原表数据。总计行标记isSummary=true并在summary另存。",
    "columns": [
        {"key": "province", "title": "省份/地区", "type": "string", "align": "center"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "impressions", "title": "展现量", "type": "number", "align": "right"},
        {"key": "clicks", "title": "点击量", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"},
        {"key": "cpm", "title": "千次展现成本(CPM)", "type": "currency", "align": "right"},
        {"key": "engagements", "title": "互动量", "type": "number", "align": "right"},
        {"key": "cpe", "title": "互动成本(CPE)", "type": "currency", "align": "right"}
    ],
    "rows": province_rows
})

# -------------------------------------------------------------
# 7. huang-commerce-audiences (商销定向人群: yjajuP 通投版位筛选)
# -------------------------------------------------------------
print("\n--- 7. Commerce Audiences (yjajuP) ---")
comm_aud_raw = read_b("shangxiao_yjajuP.json")
comm_aud_rows = []
comm_aud_summary = None
for r in comm_aud_raw[6:33]:
    aud = cell(r, 0)
    if not aud or aud == "（全部）": continue
    is_sum = (aud == "总计")
    item = {
        "audience": aud,
        "spend": to_float_or_none(cell(r, 1)),
        "uv": to_int_or_none(cell(r, 2)),
        "cpuv": to_float_or_none(cell(r, 3)),
        "cart": to_int_or_none(cell(r, 4)),
        "costPerCart": to_float_or_none(cell(r, 5)),
        "orders": to_int_or_none(cell(r, 6)),
        "costPerOrder": to_float_or_none(cell(r, 7)),
        "gmv": to_float_or_none(cell(r, 8)),
        "roi": to_float_or_none(cell(r, 9)),
        "impressions": to_int_or_none(cell(r, 10)),
        "clicks": to_int_or_none(cell(r, 11)),
        "ctr": pct_points(cell(r, 12)), # e.g. 0.05005 -> 5.0053%
        "cpc": to_float_or_none(cell(r, 13)),
        "isSummary": is_sum
    }
    comm_aud_rows.append(item)
    if is_sum: comm_aud_summary = item

tables.append({
    "id": "huang-commerce-audiences",
    "title": "商销定向人群转化表现表 (通投版位)",
    "period": "通投版位·源透视快照",
    "sourceId": "src-huang-tiane-commerce-canonical",
    "sourceSheetId": "yjajuP",
    "category": "performance",
    "percentScale": "points",
    "summary": comm_aud_summary,
    "note": "来源于Sheet yjajuP内容X人群透视，Header显示时间为(全部)，版位为通投。智能定向贡献最大成交(10,926元GMV, ROI 1.32)。消耗合计23,807.93元，GMV 27,090.00元，非全期底表全量。总计行已标记isSummary=true并在summary另存。",
    "columns": [
        {"key": "audience", "title": "定向人群", "type": "string", "align": "left"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "gmv", "title": "成交GMV(元)", "type": "currency", "align": "right"},
        {"key": "roi", "title": "ROI", "type": "number", "align": "right"},
        {"key": "orders", "title": "支付订单量", "type": "number", "align": "right"},
        {"key": "costPerOrder", "title": "订单成本(元)", "type": "currency", "align": "right"},
        {"key": "cart", "title": "加购量", "type": "number", "align": "right"},
        {"key": "uv", "title": "商品访客量", "type": "number", "align": "right"},
        {"key": "cpuv", "title": "访客成本(元)", "type": "currency", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"}
    ],
    "rows": comm_aud_rows
})

# -------------------------------------------------------------
# 8. huang-commerce-creatives (商销创意素材: Vw00Q9 Sheet9透视)
# -------------------------------------------------------------
print("\n--- 8. Commerce Creatives (Vw00Q9) ---")
crt_raw = read_b("shangxiao_Vw00Q9.json")
comm_creative_rows = []
creative_total_summary = None
for r in crt_raw[1:]:
    name = cell(r, 0)
    if not name or name == "创意名称":
        continue
    imp = to_int_or_none(cell(r, 8))
    orders = to_int_or_none(cell(r, 2))
    gmv = to_float_or_none(cell(r, 4))
    roi = to_float_or_none(cell(r, 5))
    clk = to_int_or_none(cell(r, 9))
    ctr = pct_points(cell(r, 10))
    cpc = to_float_or_none(cell(r, 11))
    cpm = to_float_or_none(cell(r, 12))
    order_cost = to_float_or_none(cell(r, 3))
    
    item = {
        "creativeName": name,
        "orders": orders,
        "sourceReportedCostPerOrder": order_cost,
        "gmv": gmv,
        "roi": roi,
        "impressions": imp,
        "clicks": clk,
        "ctr": ctr,
        "cpc": cpc,
        "cpm": cpm,
        "isSummary": (name == "总计")
    }
    if name == "总计":
        creative_total_summary = item
    else:
        comm_creative_rows.append(item)

comm_creative_rows.sort(key=lambda x: (x["gmv"] if x["gmv"] is not None else -1, x["orders"] if x["orders"] is not None else -1), reverse=True)

tables.append({
    "id": "huang-commerce-creatives",
    "title": "商销创意素材转化表现明细表 (Sheet9)",
    "period": "Sheet9·创意转化透视快照",
    "sourceId": "src-huang-tiane-commerce-canonical",
    "sourceSheetId": "Vw00Q9",
    "category": "performance",
    "percentScale": "points",
    "summary": creative_total_summary,
    "note": "来源于Sheet Vw00Q9(Sheet9)商销创意透视。已严格从明细rows剔除原表Row 200总计行(总订单58单，总GMV 3,612.30元另存于summary对象)。源表订单成本列(sourceReportedCostPerOrder)部分存在原始公式差异，保留命名提示供业务查阅，不作强行覆写。",
    "columns": [
        {"key": "creativeName", "title": "创意名称/达人", "type": "string", "align": "left"},
        {"key": "gmv", "title": "成交GMV(元)", "type": "currency", "align": "right"},
        {"key": "roi", "title": "ROI", "type": "number", "align": "right"},
        {"key": "orders", "title": "支付订单量", "type": "number", "align": "right"},
        {"key": "sourceReportedCostPerOrder", "title": "源表订单成本(参考)", "type": "currency", "align": "right"},
        {"key": "impressions", "title": "展现量", "type": "number", "align": "right"},
        {"key": "clicks", "title": "点击量", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"}
    ],
    "rows": comm_creative_rows
})

# -------------------------------------------------------------
# 9. CID Tables from Source-A WB3 (广告类型, 人群, 笔记) - Exact Filters & Periods
# -------------------------------------------------------------
print("\n--- 9. CID Tables (Source-A WB3) ---")
cid_qe_raw = read_a("wb3_cid_fs_daily_QEoiVr.json")
cid_ad_type_rows = []
cid_ad_summary = None
for r in cid_qe_raw[3:7]:
    tname = cell(r, 0)
    if not tname: continue
    is_sum = (tname == "总计")
    item = {
        "adCategory": "标准投",
        "adType": tname,
        "spend": to_float_or_none(cell(r, 1)),
        "ctr": pct_points(cell(r, 2)),
        "cpc": to_float_or_none(cell(r, 3)),
        "cpm": to_float_or_none(cell(r, 4)),
        "orders": to_int_or_none(cell(r, 5)),
        "gmv": to_float_or_none(cell(r, 6)),
        "roi": to_float_or_none(cell(r, 7)),
        "isSummary": is_sum
    }
    cid_ad_type_rows.append(item)
    if is_sum: cid_ad_summary = item

tables.append({
    "id": "huang-cid-ad-types",
    "title": "天猫CID广告类型投放表现 (标准投)",
    "period": "标准投·源透视选择日期（日期项未展开）",
    "sourceId": "src-huang-tiane-cid-fs",
    "sourceSheetId": "QEoiVr",
    "sourceUrl": "https://yimeichuanbo.feishu.cn/sheets/F42ksAyO8hKRGNt2plhccnSWnNh",
    "category": "performance",
    "percentScale": "points",
    "summary": cid_ad_summary,
    "note": "来源于Source-A WB3 CID项目报表Sheet QEoiVr，Header显示时间为(多项)筛选且未展开，C1标记为标准投，消耗合计26,456.30元，GMV 73,017.33元。简单投Row 10出现#REF!公式引用错误。总计行已标记isSummary=true并在summary另存。",
    "columns": [
        {"key": "adCategory", "title": "投放模式", "type": "string", "align": "center"},
        {"key": "adType", "title": "广告类型", "type": "string", "align": "left"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "orders", "title": "支付订单量", "type": "number", "align": "right"},
        {"key": "gmv", "title": "成交GMV(元)", "type": "currency", "align": "right"},
        {"key": "roi", "title": "ROI", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"},
        {"key": "cpm", "title": "千次展现成本(CPM)", "type": "currency", "align": "right"}
    ],
    "rows": cid_ad_type_rows
})

cid_aud_raw = read_a("wb3_cid_fs_daily_2gbbSY.json")
cid_audience_rows = []
cid_aud_summary = None
for r in cid_aud_raw[5:19]:
    aname = cell(r, 0)
    if not aname or aname == "人群定向": continue
    is_sum = (aname == "总计")
    item = {
        "audience": aname,
        "spend": to_float_or_none(cell(r, 2)),
        "ctr": pct_points(cell(r, 3)),
        "cpc": to_float_or_none(cell(r, 4)),
        "cpm": to_float_or_none(cell(r, 5)),
        "orders": to_int_or_none(cell(r, 6)),
        "gmv": to_float_or_none(cell(r, 7)),
        "roi": to_float_or_none(cell(r, 8)),
        "isSummary": is_sum
    }
    cid_audience_rows.append(item)
    if is_sum: cid_aud_summary = item

tables.append({
    "id": "huang-cid-audiences",
    "title": "天猫CID定向人群转化表现表",
    "period": "信息流·源透视选择日期（日期项未展开）",
    "sourceId": "src-huang-tiane-cid-fs",
    "sourceSheetId": "2gbbSY",
    "category": "performance",
    "percentScale": "points",
    "summary": cid_aud_summary,
    "note": "来源于Source-A WB3 CID Sheet 2gbbSY，Header显示时间为(多项)筛选且未展开，广告类型为信息流，计划模式为(全部)。属于信息流全计划模式筛选子集，消耗合计13,103.96元，GMV 21,007.49元。总计行已标记isSummary=true并在summary另存。",
    "columns": [
        {"key": "audience", "title": "定向人群", "type": "string", "align": "left"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "orders", "title": "支付订单量", "type": "number", "align": "right"},
        {"key": "gmv", "title": "成交GMV(元)", "type": "currency", "align": "right"},
        {"key": "roi", "title": "ROI", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"},
        {"key": "cpm", "title": "千次展现成本(CPM)", "type": "currency", "align": "right"}
    ],
    "rows": cid_audience_rows
})

cid_notes_raw = read_a("wb3_cid_fs_daily_hKnPdA.json")
cid_note_type_rows = []
cid_note_summary = None
for r in cid_notes_raw[4:9]:
    fmt = cell(r, 0)
    if not fmt: continue
    is_sum = (fmt == "总计")
    item = {
        "noteFormat": fmt,
        "spend": to_float_or_none(cell(r, 1)),
        "ctr": pct_points(cell(r, 2)),
        "cpc": to_float_or_none(cell(r, 3)),
        "cpm": to_float_or_none(cell(r, 4)),
        "orders": to_int_or_none(cell(r, 5)),
        "gmv": to_float_or_none(cell(r, 6)),
        "roi": to_float_or_none(cell(r, 7)),
        "isSummary": is_sum
    }
    cid_note_type_rows.append(item)
    if is_sum: cid_note_summary = item

tables.append({
    "id": "huang-cid-note-types",
    "title": "天猫CID笔记形式转化表现 (视频 vs 图文)",
    "period": "源透视快照·全广告类型汇总",
    "sourceId": "src-huang-tiane-cid-fs",
    "sourceSheetId": "hKnPdA",
    "category": "performance",
    "percentScale": "points",
    "summary": cid_note_summary,
    "note": "来源于Source-A WB3 CID Sheet hKnPdA，Header显示时间为(全部)，广告类型为(全部)。视频+图文消耗合计59,024.76元，GMV 192,884.09元。总计行已标记isSummary=true并在summary另存。",
    "columns": [
        {"key": "noteFormat", "title": "笔记形式", "type": "string", "align": "left"},
        {"key": "spend", "title": "消耗(元)", "type": "currency", "align": "right"},
        {"key": "orders", "title": "支付订单量", "type": "number", "align": "right"},
        {"key": "gmv", "title": "成交GMV(元)", "type": "currency", "align": "right"},
        {"key": "roi", "title": "ROI", "type": "number", "align": "right"},
        {"key": "ctr", "title": "点击率(%)", "type": "number", "align": "right"},
        {"key": "cpc", "title": "点击成本(CPC)", "type": "currency", "align": "right"},
        {"key": "cpm", "title": "千次展现成本(CPM)", "type": "currency", "align": "right"}
    ],
    "rows": cid_note_type_rows
})

# -------------------------------------------------------------
# 10. Core KPIs (动态取自品牌汇总，label规范)
# -------------------------------------------------------------
# Extract dynamic CTR and CPE from huang-brand-summary
b_sum_row = next((t["rows"][0] for t in tables if t["id"] == "huang-brand-summary"), {})
brand_ctr_val = b_sum_row.get("ctr", 12.72) # 12.72
brand_cpe_val = b_sum_row.get("cpe", 31.81) # 31.81
brand_spend_val = b_sum_row.get("spend", 178342.67)
brand_imp_val = b_sum_row.get("impressions", 4100531)
brand_clk_val = b_sum_row.get("clicks", 521402)
brand_seed_val = b_sum_row.get("seed_total", 269850)

c_sum_row = next((t["rows"][0] for t in tables if t["id"] == "huang-commerce-summary"), {})
comm_spend_val = c_sum_row.get("spend", 25025.29)
comm_orders_val = c_sum_row.get("orders", 558)
comm_gmv_val = c_sum_row.get("gmv", 28023.72)
comm_roi_val = round(comm_gmv_val / comm_spend_val, 2) if (comm_spend_val and comm_gmv_val) else 1.12

facts["kpis"] = [
    {"id": "kpi-brand-total-spend", "label": "品牌线10月总消耗", "value": brand_spend_val, "unit": "元", "target": 565475.09, "direction": "lower", "comparison": "lte", "sourceId": "src-huang-tiane-brand-fs", "period": "2026-10-01 ~ 2026-10-19", "provenance": "feishu"},
    {"id": "kpi-brand-total-impressions", "label": "品牌线10月总展现量", "value": brand_imp_val, "unit": "次", "target": None, "direction": "higher", "sourceId": "src-huang-tiane-brand-fs", "period": "2026-10-01 ~ 2026-10-19", "provenance": "feishu"},
    {"id": "kpi-brand-total-clicks", "label": "品牌线10月总点击量", "value": brand_clk_val, "unit": "次", "target": None, "direction": "higher", "sourceId": "src-huang-tiane-brand-fs", "period": "2026-10-01 ~ 2026-10-19", "provenance": "feishu"},
    {"id": "kpi-brand-ctr", "label": "品牌线10月汇总点击率 (CTR)", "value": brand_ctr_val, "unit": "%", "target": None, "direction": "higher", "sourceId": "src-huang-tiane-brand-fs", "period": "2026-10-01 ~ 2026-10-19", "provenance": "feishu"},
    {"id": "kpi-brand-cpe", "label": "品牌线10月综合互动成本 (CPE)", "value": brand_cpe_val, "unit": "元", "target": None, "direction": "lower", "sourceId": "src-huang-tiane-brand-fs", "period": "2026-10-01 ~ 2026-10-19", "provenance": "feishu"},
    {"id": "kpi-brand-seed-total", "label": "品牌线10月种草总人群 (I+TI)", "value": brand_seed_val, "unit": "人", "target": None, "direction": "higher", "sourceId": "src-huang-tiane-brand-fs", "period": "2026-10-01 ~ 2026-10-19", "provenance": "feishu"},
    {"id": "kpi-commerce-total-spend", "label": "商销全周期总消耗", "value": comm_spend_val, "unit": "元", "target": None, "direction": "lower", "sourceId": "src-huang-tiane-commerce-canonical", "period": "2026-07-27 ~ 2026-10-19", "provenance": "feishu"},
    {"id": "kpi-commerce-total-orders", "label": "商销全周期支付订单量", "value": comm_orders_val, "unit": "单", "target": None, "direction": "higher", "sourceId": "src-huang-tiane-commerce-canonical", "period": "2026-07-27 ~ 2026-10-19", "provenance": "feishu"},
    {"id": "kpi-commerce-total-gmv", "label": "商销全周期成交GMV", "value": comm_gmv_val, "unit": "元", "target": None, "direction": "higher", "sourceId": "src-huang-tiane-commerce-canonical", "period": "2026-07-27 ~ 2026-10-19", "provenance": "feishu"},
    {"id": "kpi-commerce-total-roi", "label": "商销全周期投资回报率 (ROI)", "value": comm_roi_val, "unit": "", "target": 1.0, "direction": "higher", "comparison": "gte", "sourceId": "src-huang-tiane-commerce-canonical", "period": "2026-07-27 ~ 2026-10-19", "provenance": "feishu"}
]

# -------------------------------------------------------------
# Write Back to facts.json with buildStatus: complete
# -------------------------------------------------------------
# Update dailyDatasets sourceIds
for ds in facts.get("dailyDatasets", []):
    if ds["id"] == "huang-brand-daily":
        ds["sourceId"] = "src-huang-tiane-brand-fs"
        ds["sourceSheetId"] = "Nm3Sev"
    elif ds["id"] == "huang-commerce-daily":
        ds["sourceId"] = "src-huang-tiane-commerce-canonical"
        ds["sourceSheetId"] = "c46f52"

facts["tables"] = tables
facts["buildStatus"] = "complete"
facts["percentScale"] = "points"
facts["updatedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

facts_path.write_text(json.dumps(facts, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n==========================================")
print(f"SUCCESS: Output written to {facts_path}")
print(f"BuildStatus: {facts['buildStatus']}")
print(f"PercentScale: {facts['percentScale']}")
print(f"Total Tables in facts.json: {len(tables)}")
for t in tables:
    sum_note = f" (summary saved)" if "summary" in t and t["summary"] else ""
    print(f"  [{t['id']}] {t['title']} | {len(t['rows'])} rows | period={t['period']}{sum_note}")
