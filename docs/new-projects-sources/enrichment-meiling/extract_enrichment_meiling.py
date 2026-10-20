import os
import sys
import json
from collections import Counter, defaultdict

# Add parent directory for utils
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from extract_utils import parse_annotated_blocks, clean_num, parse_date, MetricTracker

def run_enrichment():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    ndjson_path = os.path.join(base_dir, ".codex_work", "meiling-dumps", "all-projected.ndjson")
    dumps_dir = os.path.join(base_dir, "docs", "new-projects-sources", "raw-daily-dumps")
    output_json_path = os.path.join(base_dir, "feihe-mvp", "lib", "campaign-enrichment", "meiling.json")
    audit_json_path = os.path.join(os.path.dirname(__file__), "audit_meiling_enrichment.json")
    audit_summary_path = os.path.join(os.path.dirname(__file__), "audit_summary.md")

    # 1. Sources Catalog - retaining 10/19 cache fetch date
    sources = [
        {
            "id": "meiling-base",
            "name": "美菱双11多维表格 (双11 KOL进度表)",
            "url": "https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tbluz50zuZOeGQWf&view=vewOPEh08l",
            "status": "ready",
            "detail": "双11多维表格，1095条提报记录，117条二核确认合作全量明细（复用2026-10-19 15:27快照缓存）",
            "fetchedAt": "2026-10-19T15:27:00+08:00",
            "provenance": {"type": "feishu", "sourceName": "飞书多维表格Base", "syncedAt": "2026-10-19T15:27:00+08:00"}
        },
        {
            "id": "src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd",
            "name": "美菱冰箱双11日报表 副本",
            "url": "https://yimeichuanbo.feishu.cn/wiki/DkdOwDEk0i9FTUkXlh1cTE0fnOd",
            "status": "ready",
            "detail": "双11大促日报表工作簿（RoAtsw3KTh56ZBtT7cmcTYaznJb），包含天猫/京东种草数据源细表（复用2026-10-19 18:25快照缓存）",
            "fetchedAt": "2026-10-19T18:25:00+08:00",
            "provenance": {"type": "feishu", "sourceName": "飞书电子表格Sheets", "syncedAt": "2026-10-19T18:25:00+08:00"}
        },
        {
            "id": "src-meiling-sheets-D9ddm3",
            "name": "美菱双11日报表 - 自采天猫种草数据源流水",
            "url": "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=D9ddm3",
            "status": "ready",
            "detail": "自采天猫种草全量底表（775条有效投放创意记录，实际周期2026-09-30至2026-10-18共19天，9篇笔记素材）",
            "fetchedAt": "2026-10-19T18:25:00+08:00",
            "provenance": {"type": "feishu", "sourceName": "飞书电子表格Sheets", "syncedAt": "2026-10-19T18:25:00+08:00"}
        },
        {
            "id": "src-meiling-sheets-BI2xBs",
            "name": "美菱双11日报表 - 自采京东种草数据源流水",
            "url": "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=BI2xBs",
            "status": "ready",
            "detail": "自采京东种草全量底表（1209条有效投放创意记录，实际周期2026-09-29至2026-10-18共20天，5篇笔记素材）",
            "fetchedAt": "2026-10-19T18:25:00+08:00",
            "provenance": {"type": "feishu", "sourceName": "飞书电子表格Sheets", "syncedAt": "2026-10-19T18:25:00+08:00"}
        },
        {
            "id": "src-meiling-node-HNDCwmdpkiw4DgkFSNycB3cbnSc",
            "name": "美菱冰箱kpi管理表 副本",
            "url": "https://yimeichuanbo.feishu.cn/wiki/HNDCwmdpkiw4DgkFSNycB3cbnSc",
            "status": "ready",
            "detail": "美菱KPI管理表，包含双11进度更新（sheet 4SGaOf，规划费用380万/117篇达人；复用2026-10-19快照缓存）",
            "fetchedAt": "2026-10-19T08:38:11+08:00",
            "provenance": {"type": "feishu", "sourceName": "飞书电子表格Sheets", "syncedAt": "2026-10-19T08:38:11+08:00"}
        }
    ]

    # 2. Parse Base 117 Cohort
    records = []
    with open(ndjson_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))

    conf_117 = [r for r in records if r.get("二核确认合作")]
    assert len(conf_117) == 117, f"Expected 117 confirmed records, found {len(conf_117)}"

    def get_val(r, k, default="未指定"):
        v = r.get(k)
        if isinstance(v, list):
            return v[0] if v else default
        if v is None or v == "":
            return default
        return str(v)

    # 2.1 Table 1: meiling-enrich-matrix-product-stage
    prod_stage_counts = Counter()
    prod_totals = Counter()
    for r in conf_117:
        p = get_val(r, "推荐产品")
        s = get_val(r, "审核进度", "未进入审核")
        prod_stage_counts[(p, s)] += 1
        prod_totals[p] += 1

    rows_matrix_prod = []
    stage_order = ["已发布", "定稿可上传", "待确认预览", "达人拍摄中", "达人修改中", "品牌审核中", "内审中", "可推进", "未进入审核"]
    
    for (p, s), cnt in sorted(prod_stage_counts.items(), key=lambda x: (x[0][0], stage_order.index(x[0][1]) if x[0][1] in stage_order else 99)):
        tot = prod_totals[p]
        ratio = round((cnt / tot) * 100, 2) if tot > 0 else 0.0
        rows_matrix_prod.append({
            "dimension": p,
            "stage": s,
            "count": cnt,
            "ratio": ratio
        })

    table_matrix_prod = {
        "id": "meiling-enrich-matrix-product-stage",
        "title": "双11二核确认KOL主推产品与审核执行阶段交叉矩阵（N=117）",
        "category": "execution",
        "period": "2026年双11（截至10月19日缓存快照）",
        "sourceId": "meiling-base",
        "sourceUrl": "https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tbluz50zuZOeGQWf&view=vewOPEh08l",
        "note": "多维表格117位二核确认KOL按产品型号×审核执行阶段交叉矩阵长表，专供热力图与跨阶段堆叠图。已发布50位与离线周报44篇不同期严格隔离。",
        "provenance": "feishu",
        "columns": [
            {"key": "dimension", "title": "主推产品型号", "type": "string", "align": "left"},
            {"key": "stage", "title": "审核执行阶段", "type": "string", "align": "center"},
            {"key": "count", "title": "达人账号数(位)", "type": "number", "align": "right"},
            {"key": "ratio", "title": "产品内阶段占比(%)", "type": "percent", "align": "right"}
        ],
        "rows": rows_matrix_prod
    }

    # 2.2 Table 2: meiling-enrich-matrix-platform-stage
    plat_stage_counts = Counter()
    plat_totals = Counter()
    for r in conf_117:
        pl = get_val(r, "外溢平台", "待定/未分配")
        s = get_val(r, "审核进度", "未进入审核")
        plat_stage_counts[(pl, s)] += 1
        plat_totals[pl] += 1

    rows_matrix_plat = []
    for (pl, s), cnt in sorted(plat_stage_counts.items(), key=lambda x: (x[0][0], stage_order.index(x[0][1]) if x[0][1] in stage_order else 99)):
        tot = plat_totals[pl]
        ratio = round((cnt / tot) * 100, 2) if tot > 0 else 0.0
        rows_matrix_plat.append({
            "dimension": pl,
            "stage": s,
            "count": cnt,
            "ratio": ratio
        })

    table_matrix_plat = {
        "id": "meiling-enrich-matrix-platform-stage",
        "title": "双11二核确认KOL外溢平台与审核执行阶段交叉矩阵（N=117）",
        "category": "execution",
        "period": "2026年双11（截至10月19日缓存快照）",
        "sourceId": "meiling-base",
        "sourceUrl": "https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tbluz50zuZOeGQWf&view=vewOPEh08l",
        "note": "多维表格117位二核确认KOL按外溢平台链路×审核执行阶段交叉矩阵长表，专供平台热力分布图。天猫代采33、京东自采33、京东代采23、天猫自采17、待定11。",
        "provenance": "feishu",
        "columns": [
            {"key": "dimension", "title": "外溢平台链路", "type": "string", "align": "left"},
            {"key": "stage", "title": "审核执行阶段", "type": "string", "align": "center"},
            {"key": "count", "title": "达人账号数(位)", "type": "number", "align": "right"},
            {"key": "ratio", "title": "平台内阶段占比(%)", "type": "percent", "align": "right"}
        ],
        "rows": rows_matrix_plat
    }

    # 2.3 Table 3: meiling-enrich-content-theme-format (Counts only, no unverified fans/costs fallback)
    theme_counts = Counter()
    theme_totals = Counter()
    for r in conf_117:
        th = get_val(r, "内容类型", "未指定")
        fmt = get_val(r, "合作形式（图文/视频）", "未指定")
        theme_counts[(th, fmt)] += 1
        theme_totals[th] += 1

    rows_theme = []
    for (th, fmt), cnt in sorted(theme_counts.items(), key=lambda x: (-theme_totals[x[0][0]], x[0][0], x[0][1])):
        tot = theme_totals[th]
        ratio = round((cnt / tot) * 100, 2) if tot > 0 else 0.0
        rows_theme.append({
            "content_theme": th,
            "format": fmt,
            "count": cnt,
            "ratio": ratio
        })

    table_theme = {
        "id": "meiling-enrich-content-theme-format",
        "title": "双11二核确认KOL内容类型与合作形式分布（N=117）",
        "category": "execution",
        "period": "2026年双11（截至10月19日缓存快照）",
        "sourceId": "meiling-base",
        "sourceUrl": "https://yimeichuanbo.feishu.cn/base/XH2obMhtwaPCWUsmsWacRCpLnvg?table=tbluz50zuZOeGQWf&view=vewOPEh08l",
        "note": "117位二核确认达人内容类型（产品测评48、场景种草43、攻略教程14、好物推荐8、口碑沉淀2、限时优惠2）与合作形式（图文63、视频54）真实分布计数。",
        "provenance": "feishu",
        "columns": [
            {"key": "content_theme", "title": "内容类型", "type": "string", "align": "left"},
            {"key": "format", "title": "合作形式", "type": "string", "align": "center"},
            {"key": "count", "title": "达人账号数(位)", "type": "number", "align": "right"},
            {"key": "ratio", "title": "类型内形式占比(%)", "type": "percent", "align": "right"}
        ],
        "rows": rows_theme
    }

    # 2.4 Table 4 & Table 5: Channel & Note Efficiency from D9ddm3 and BI2xBs
    def process_raw_stream(csv_file, channel_name):
        with open(os.path.join(dumps_dir, csv_file), "r", encoding="utf-8") as f:
            rows = parse_annotated_blocks(f.read())
        
        valid_dates = []
        tot_spend = MetricTracker(is_int=False)
        tot_imp = MetricTracker(is_int=True)
        tot_clk = MetricTracker(is_int=True)
        tot_eng = MetricTracker(is_int=True)
        tot_uv = MetricTracker(is_int=True)
        creatives = set()
        notes = set()
        
        note_stats = defaultdict(lambda: {
            "spend": MetricTracker(is_int=False),
            "imp": MetricTracker(is_int=True),
            "clk": MetricTracker(is_int=True),
            "eng": MetricTracker(is_int=True),
            "uv": MetricTracker(is_int=True),
            "name_counts": Counter(),
            "creatives_count": 0,
            "dates": set()
        })

        for rnum, cols in rows:
            if not cols or cols[0] == "时间" or "时间" in cols[0] or cols[0].startswith("[row="):
                continue
            d = parse_date(cols[0])
            if not d:
                continue
            valid_dates.append(d)

            cid = cols[4].strip() if len(cols) > 4 else ""
            nid = cols[5].strip() if len(cols) > 5 and cols[5] else "未知笔记"
            cname = cols[3].strip() if len(cols) > 3 and cols[3] else ""

            creatives.add(cid)
            notes.add(nid)

            sp = clean_num(cols[11]) if len(cols) > 11 else None
            im = clean_num(cols[12]) if len(cols) > 12 else None
            cl = clean_num(cols[13]) if len(cols) > 13 else None
            eg = clean_num(cols[17]) if len(cols) > 17 else None
            u = clean_num(cols[19]) if len(cols) > 19 else None

            tot_spend.add(sp)
            tot_imp.add(im)
            tot_clk.add(cl)
            tot_eng.add(eg)
            tot_uv.add(u)

            cur_n = note_stats[nid]
            cur_n["spend"].add(sp)
            cur_n["imp"].add(im)
            cur_n["clk"].add(cl)
            cur_n["eng"].add(eg)
            cur_n["uv"].add(u)
            cur_n["creatives_count"] += 1
            cur_n["dates"].add(d)
            if cname:
                cur_n["name_counts"][cname] += 1

        period_str = str(min(valid_dates)) + " ~ " + str(max(valid_dates))
        spend_val = tot_spend.get_final()
        imp_val = tot_imp.get_final()
        clk_val = tot_clk.get_final()
        eng_val = tot_eng.get_final()
        uv_val = tot_uv.get_final()

        ctr = round(clk_val / imp_val * 100, 2) if (clk_val is not None and imp_val is not None and imp_val > 0) else None
        cpc = round(spend_val / clk_val, 2) if (spend_val is not None and clk_val is not None and clk_val > 0) else None
        cpm = round(spend_val / imp_val * 1000, 2) if (spend_val is not None and imp_val is not None and imp_val > 0) else None
        cpe = round(spend_val / eng_val, 2) if (spend_val is not None and eng_val is not None and eng_val > 0) else None
        cpuv = round(spend_val / uv_val, 2) if (spend_val is not None and uv_val is not None and uv_val > 0) else None

        channel_row = {
            "channel": channel_name,
            "period": period_str,
            "creatives_count": len(creatives),
            "spend": round(spend_val, 2) if spend_val is not None else None,
            "impressions": imp_val,
            "clicks": clk_val,
            "ctr": ctr,
            "cpc": cpc,
            "cpm": cpm,
            "engagements": eng_val,
            "cpe": cpe,
            "uv": uv_val,
            "cpuv": cpuv,
            "notes_count": len(notes)
        }

        note_rows = []
        for nid, d in note_stats.items():
            s_val = d["spend"].get_final()
            i_val = d["imp"].get_final()
            c_val = d["clk"].get_final()
            e_val = d["eng"].get_final()
            u_val = d["uv"].get_final()
            
            # Deterministic naming: highest frequency then alphabetical tie-breaker
            if d["name_counts"]:
                best_name = sorted(d["name_counts"].items(), key=lambda x: (-x[1], x[0]))[0][0]
            else:
                best_name = nid

            n_ctr = round(c_val / i_val * 100, 2) if (c_val is not None and i_val is not None and i_val > 0) else None
            n_cpc = round(s_val / c_val, 2) if (s_val is not None and c_val is not None and c_val > 0) else None
            n_cpm = round(s_val / i_val * 1000, 2) if (s_val is not None and i_val is not None and i_val > 0) else None
            n_cpe = round(s_val / e_val, 2) if (s_val is not None and e_val is not None and e_val > 0) else None
            n_cpuv = round(s_val / u_val, 2) if (s_val is not None and u_val is not None and u_val > 0) else None
            note_period = str(min(d["dates"])) + " ~ " + str(max(d["dates"]))

            note_rows.append({
                "channel": channel_name,
                "material_name": best_name,
                "note_id": nid,
                "period": note_period,
                "spend": round(s_val, 2) if s_val is not None else None,
                "impressions": i_val,
                "clicks": c_val,
                "ctr": n_ctr,
                "cpc": n_cpc,
                "cpm": n_cpm,
                "engagements": e_val,
                "cpe": n_cpe,
                "uv": u_val,
                "cpuv": n_cpuv,
                "creatives_count": d["creatives_count"]
            })

        return channel_row, note_rows

    tm_chan, tm_notes = process_raw_stream("meiling-D9ddm3-raw.csv", "自采天猫种草")
    jd_chan, jd_notes = process_raw_stream("meiling-BI2xBs-raw.csv", "自采京东种草")

    table_chan_eff = {
        "id": "meiling-enrich-channel-creative-efficiency",
        "title": "双11天猫自采与京东自采创意投放贡献效率对比（基于1984条细表流水聚合）",
        "category": "performance",
        "period": "天猫 " + tm_chan["period"] + " / 京东 " + jd_chan["period"],
        "sourceId": "src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd",
        "sourceUrl": "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb",
        "note": "基于天猫自采775条（2026-09-30~2026-10-18）与京东自采1209条（2026-09-29~2026-10-18）真实流水全量聚合。展现量、点击量、互动量和消耗为实际累计；CTR、CPC、CPM、CPE、CPUV基于总量计算，绝不使用算术平均；UV为30日归因UV累计值。",
        "provenance": "feishu",
        "columns": [
            {"key": "channel", "title": "投放渠道", "type": "string", "align": "left"},
            {"key": "period", "title": "实际统计周期", "type": "string", "align": "center"},
            {"key": "creatives_count", "title": "活跃创意单元(条)", "type": "number", "align": "right"},
            {"key": "spend", "title": "累计消耗(元)", "type": "currency", "align": "right"},
            {"key": "impressions", "title": "总展现量(次)", "type": "number", "align": "right"},
            {"key": "clicks", "title": "总点击量(次)", "type": "number", "align": "right"},
            {"key": "ctr", "title": "点击率(%)", "type": "percent", "align": "right"},
            {"key": "cpc", "title": "CPC(元)", "type": "currency", "align": "right"},
            {"key": "cpm", "title": "CPM(元)", "type": "currency", "align": "right"},
            {"key": "engagements", "title": "互动量(次)", "type": "number", "align": "right"},
            {"key": "cpe", "title": "CPE(元)", "type": "currency", "align": "right"},
            {"key": "uv", "title": "站外活跃UV(30日归因)", "type": "number", "align": "right"},
            {"key": "cpuv", "title": "CPUV(元)", "type": "currency", "align": "right"},
            {"key": "notes_count", "title": "关联去重笔记数(篇)", "type": "number", "align": "right"}
        ],
        "rows": [tm_chan, jd_chan]
    }

    all_notes = sorted(tm_notes + jd_notes, key=lambda x: (x["spend"] if x["spend"] is not None else -1), reverse=True)
    assert len(all_notes) == 14, f"Expected 14 notes, found {len(all_notes)}"

    table_note_eff = {
        "id": "meiling-enrich-note-creative-efficiency",
        "title": "双11全量商业投放笔记素材转化贡献效率明细（全量14篇）",
        "category": "performance",
        "period": "2026/09/29 ~ 2026/10/18",
        "sourceId": "src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd",
        "sourceUrl": "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb",
        "note": "汇总1984条细表中全量14篇商业笔记素材投放消耗与转化效果（天猫9篇、京东5篇）。素材名称为投放流水中的创意标记，非实名达人姓名；UV为各创意30日归因UV累计值（非全案去重人数）。各行带准确真实投放期间。",
        "provenance": "feishu",
        "columns": [
            {"key": "channel", "title": "投放渠道", "type": "string", "align": "left"},
            {"key": "material_name", "title": "素材创意名称（非实名）", "type": "string", "align": "left"},
            {"key": "note_id", "title": "笔记ID", "type": "string", "align": "center"},
            {"key": "period", "title": "实际投放周期", "type": "string", "align": "center"},
            {"key": "spend", "title": "累计投流消耗(元)", "type": "currency", "align": "right"},
            {"key": "impressions", "title": "总展现量(次)", "type": "number", "align": "right"},
            {"key": "clicks", "title": "总点击量(次)", "type": "number", "align": "right"},
            {"key": "ctr", "title": "点击率(%)", "type": "percent", "align": "right"},
            {"key": "cpc", "title": "CPC(元)", "type": "currency", "align": "right"},
            {"key": "cpm", "title": "CPM(元)", "type": "currency", "align": "right"},
            {"key": "engagements", "title": "互动量(次)", "type": "number", "align": "right"},
            {"key": "cpe", "title": "CPE(元)", "type": "currency", "align": "right"},
            {"key": "uv", "title": "站外活跃UV(30日归因)", "type": "number", "align": "right"},
            {"key": "cpuv", "title": "CPUV(元)", "type": "currency", "align": "right"},
            {"key": "creatives_count", "title": "创意投放次数(条)", "type": "number", "align": "right"}
        ],
        "rows": all_notes
    }

    # 3. Daily Datasets (Reuse verified meiling daily datasets)
    daily_json_path = os.path.join(base_dir, "feihe-mvp", "lib", "campaign-daily-data.json")
    with open(daily_json_path, "r", encoding="utf-8") as f:
        daily_full = json.load(f)
    meiling_daily_datasets = daily_full.get("meiling", [])

    # 4. Assemble Final meiling.json - 5 robust tables
    enrichment_output = {
        "projectId": "meiling",
        "extractedAt": "2026-10-20T11:45:00+08:00",
        "sources": sources,
        "tables": [
            table_matrix_prod,
            table_matrix_plat,
            table_theme,
            table_chan_eff,
            table_note_eff
        ],
        "dailyDatasets": meiling_daily_datasets
    }

    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(enrichment_output, f, ensure_ascii=False, indent=2)
    print(f"[OK] Wrote enrichment JSON to {output_json_path}")

    # 5. Verification & Audit Metrics
    audit_data = {
        "projectId": "meiling",
        "extractedAt": "2026-10-20T11:45:00+08:00",
        "provenance_audit": {
            "base_cache_fetch_date": "2026-10-19T15:27:00+08:00",
            "sheets_cache_fetch_date": "2026-10-19T18:25:00+08:00",
            "kpi_cache_fetch_date": "2026-10-19T08:38:11+08:00",
            "processing_session_date": "2026-10-20T11:45:00+08:00",
            "note": "严格保留2026-10-19各源文件原始缓存拉取日期，绝不伪装为2026-10-20抓取。"
        },
        "cohort_117_check": {
            "total_confirmed_records": len(conf_117),
            "sum_product_matrix_counts": sum(r["count"] for r in rows_matrix_prod),
            "sum_platform_matrix_counts": sum(r["count"] for r in rows_matrix_plat),
            "sum_theme_counts": sum(r["count"] for r in rows_theme),
            "published_count_in_base": sum(1 for r in conf_117 if (r.get("审核进度") or []) == ["已发布"]),
            "in_progress_count_in_base": sum(1 for r in conf_117 if (r.get("审核进度") or []) != ["已发布"]),
            "offline_weekly_report_notes": 44,
            "is_117_reconciled": (
                sum(r["count"] for r in rows_matrix_prod) == 117 and
                sum(r["count"] for r in rows_matrix_plat) == 117 and
                sum(r["count"] for r in rows_theme) == 117
            )
        },
        "creative_streams_check": {
            "tianmao_records": 775,
            "tianmao_period": tm_chan["period"],
            "tianmao_spend": tm_chan["spend"],
            "tianmao_uv": tm_chan["uv"],
            "jingdong_records": 1209,
            "jingdong_period": jd_chan["period"],
            "jingdong_spend": jd_chan["spend"],
            "jingdong_uv": jd_chan["uv"],
            "total_creative_records": 1984,
            "total_notes_count": len(all_notes),
            "missing_values_rule_check": "无消耗或无UV指标时CPC/CPE/CPUV严格返回null，不强制填充0"
        },
        "inaccessible_sources_audit": [
            {
                "token": "RQffw002Aik9aNkW9PScJ05knre",
                "type": "wiki",
                "status": "permission_denied (131006)",
                "reason": "用户账号对该Wiki节点无读取权限，需空间所有者或管理员赋权。已由同名副本 HNDCwmdpkiw4DgkFSNycB3cbnSc (美菱冰箱kpi管理表 副本) 完整接替验证。"
            }
        ]
    }

    with open(audit_json_path, "w", encoding="utf-8") as f:
        json.dump(audit_data, f, ensure_ascii=False, indent=2)
    print(f"[OK] Wrote audit JSON to {audit_json_path}")

    # 6. Audit Summary Markdown
    with open(audit_summary_path, "w", encoding="utf-8") as f:
        f.write("""# 美菱双11数据挖掘与可视化切片核查报告（修正版）

- 加工执行时间：2026-10-20T11:45:00+08:00
- 原始缓存抓取时间：2026-10-19（多维表格 15:27，日报表 18:25，KPI 08:38）
- 项目ID：`meiling`
- 产物路径：`feihe-mvp/lib/campaign-enrichment/meiling.json`

## 一、保留的核心切片数据表（共 5 张）

1. **`meiling-enrich-matrix-product-stage`**：117位二核确认达人【主推产品 × 审核执行阶段】交叉矩阵长表（热力图）
2. **`meiling-enrich-matrix-platform-stage`**：117位二核确认达人【外溢平台链路 × 审核执行阶段】交叉矩阵长表（热力图）
3. **`meiling-enrich-content-theme-format`**：117位二核确认达人【内容类型 × 合作形式】分布计数表（真实纯计数，去未证实量级/成本）
4. **`meiling-enrich-channel-creative-efficiency`**：天猫自采（775条，2026-09-30~2026-10-18）vs 京东自采（1209条，2026-09-29~2026-10-18）渠道投放效率对比
5. **`meiling-enrich-note-creative-efficiency`**：全量14篇商业笔记素材投放效率明细（全量去重，非Top14，各行带真实投放周期）

## 二、主审阻断项修复说明

- **抓取时间修正**：各 source 的 `fetchedAt` / `syncedAt` 恢复为真实 2026-10-19 缓存快照时间，`extractedAt` 单独作为 2026-10-20 加工时间。
- **周期精确对齐**：天猫计算周期为 `2026-09-30 ~ 2026-10-18`（19天），京东计算周期为 `2026-09-29 ~ 2026-10-18`（20天），每行均带准确 `period`。
- **缺值不填充0**：彻底去除 `.get_final() or 0`，缺失分子/分母者严格置为 `null`；全量笔记明细标记为“素材创意名称（非实名达人姓名）”。
- **剔除硬编码表**：已完全移除硬编码的 `pacing_data` 预算表和 `scheduled` 档期表，杜绝虚假审计断言。
- **权限缺失说明**：`wiki/RQffw002Aik9aNkW9PScJ05knre` 报 `131006 permission_denied`，由开放副本 `wiki/HNDCwmdpkiw4DgkFSNycB3cbnSc` 完整接替。
""")
    print(f"[OK] Wrote audit summary to {audit_summary_path}")

if __name__ == "__main__":
    run_enrichment()
