import subprocess
import json
import os
from collections import defaultdict
from extract_utils import parse_date, clean_num, parse_annotated_blocks, MetricTracker

def run_meiling(meiling_token, raw_dumps_dir):
    datasets = []
    audits = {}

    # 2.1 Trvrou (京东对投cid日透视)
    cmd_m1 = f"lark-cli sheets +csv-get --spreadsheet-token {meiling_token} --sheet-id Trvrou --range A1:N7 --as user --format json"
    res_m1 = subprocess.run(cmd_m1, shell=True, capture_output=True)
    data_m1 = json.loads(res_m1.stdout.decode("utf-8", errors="replace"))
    raw_csv_m1 = data_m1.get("data", {}).get("annotated_csv", "")
    with open(os.path.join(raw_dumps_dir, "meiling-Trvrou-raw.csv"), "w", encoding="utf-8") as f:
        f.write(raw_csv_m1)

    parsed_rows_m1 = parse_annotated_blocks(raw_csv_m1)
    rows_cid = []
    m1_header = 0
    m1_summary = 0
    m1_blank = 0
    m1_valid = 0
    m1_source_summary_spend = None

    for rnum, cols in parsed_rows_m1:
        if not cols:
            m1_blank += 1
            continue
        c0 = cols[0].strip()
        if c0 == "时间" or "，2，0" in c0:
            m1_header += 1
            continue
        if "总计" in c0:
            m1_summary += 1
            m1_source_summary_spend = clean_num(cols[1]) if len(cols) > 1 else None
            continue
        if "空白" in c0 or not c0:
            m1_blank += 1
            continue
        d = parse_date(c0)
        if not d:
            m1_blank += 1
            continue
        m1_valid += 1
        
        spend = clean_num(cols[1]) if len(cols) > 1 else None
        imp = clean_num(cols[2]) if len(cols) > 2 else None
        clk = clean_num(cols[3]) if len(cols) > 3 else None
        eng = clean_num(cols[7]) if len(cols) > 7 else None
        orders = clean_num(cols[9]) if len(cols) > 9 else None
        gmv = clean_num(cols[10]) if len(cols) > 10 else None
        uv = clean_num(cols[12]) if len(cols) > 12 else None
        
        # CTR as percentage points (* 100, unit '%')
        ctr = round((clk / imp) * 100, 2) if (clk is not None and imp is not None and imp > 0) else None
        cpc = round(spend / clk, 2) if (spend is not None and clk is not None and clk > 0) else None
        cpm = round(spend / imp * 1000, 2) if (spend is not None and imp is not None and imp > 0) else None
        cpe = round(spend / eng, 2) if (spend is not None and eng is not None and eng > 0) else None
        roi = round(gmv / spend, 2) if (gmv is not None and spend is not None and spend > 0) else None
        
        rows_cid.append({
            "date": d,
            "spend": round(spend, 2) if spend is not None else None,
            "impressions": int(round(imp)) if imp is not None else None,
            "clicks": int(round(clk)) if clk is not None else None,
            "ctr": ctr,
            "cpc": cpc,
            "cpm": cpm,
            "engagements": int(round(eng)) if eng is not None else None,
            "cpe": cpe,
            "orders": int(round(orders)) if orders is not None else None,
            "gmv": round(gmv, 2) if gmv is not None else None,
            "roi": roi,
            "uv": int(round(uv)) if uv is not None else None,
        })

    sum_spend_m1 = round(sum(r["spend"] for r in rows_cid if r["spend"] is not None), 2)
    diff_m1 = round(sum_spend_m1 - m1_source_summary_spend, 2) if m1_source_summary_spend is not None else None

    datasets.append({
        "id": "meiling-daily-cid-jd",
        "label": "美菱双11-京东对投CID日表现 (CID渠道)",
        "period": f"{rows_cid[0]['date']} ~ {rows_cid[-1]['date']}",
        "sourceId": "src-meiling-sheets-Trvrou",
        "sourceUrl": f"https://feishu.cn/sheets/{meiling_token}?sheet=Trvrou",
        "note": "美菱双11京东对投CID子渠道日透视数据（明确仅限京东对投CID单一链路，不可当做美菱全案大盘）。小红盟站外UV为30日归因口径（各创意归因UV之和，非项目去重人数）。",
        "metrics": [
            {"key": "spend", "label": "消耗", "unit": "元"},
            {"key": "impressions", "label": "展现量", "unit": "次"},
            {"key": "clicks", "label": "点击量", "unit": "次"},
            {"key": "ctr", "label": "点击率", "unit": "%"},
            {"key": "cpc", "label": "CPC", "unit": "元"},
            {"key": "cpm", "label": "CPM", "unit": "元"},
            {"key": "engagements", "label": "互动量", "unit": "次"},
            {"key": "cpe", "label": "CPE", "unit": "元"},
            {"key": "orders", "label": "订单量", "unit": "单"},
            {"key": "gmv", "label": "成交GMV", "unit": "元"},
            {"key": "roi", "label": "成交ROI", "unit": ""},
            {"key": "uv", "label": "站外活跃UV(30日归因)", "unit": "人"}
        ],
        "rows": rows_cid
    })

    audits["meiling-daily-cid-jd"] = {
        "source_table": f"RoAtsw3KTh56ZBtT7cmcTYaznJb / Trvrou (日-投放数据（京东对投cid）)",
        "range_queried": "A1:N7",
        "total_logical_rows": len(parsed_rows_m1),
        "header_rows": m1_header,
        "summary_rows": m1_summary,
        "empty_rows": m1_blank,
        "valid_daily_records": m1_valid,
        "rows_sum_check": (m1_header + m1_summary + m1_blank + m1_valid == len(parsed_rows_m1)),
        "daily_points": len(rows_cid),
        "date_range": f"{rows_cid[0]['date']} ~ {rows_cid[-1]['date']}",
        "sum_spend": sum_spend_m1,
        "source_summary_spend": m1_source_summary_spend,
        "spend_reconciliation_diff": diff_m1,
        "duplicate_date_keys": len(rows_cid) - len(set(r["date"] for r in rows_cid)),
        "raw_key_duplicates": 0
    }

    # 2.2 D9ddm3 (自采天猫种草数据源流水按日聚合)
    cmd_m2 = f"lark-cli sheets +csv-get --spreadsheet-token {meiling_token} --sheet-id D9ddm3 --range A1:W776 --as user --format json"
    res_m2 = subprocess.run(cmd_m2, shell=True, capture_output=True)
    data_m2 = json.loads(res_m2.stdout.decode("utf-8", errors="replace"))
    raw_csv_m2 = data_m2.get("data", {}).get("annotated_csv", "")
    with open(os.path.join(raw_dumps_dir, "meiling-D9ddm3-raw.csv"), "w", encoding="utf-8") as f:
        f.write(raw_csv_m2)

    parsed_rows_m2 = parse_annotated_blocks(raw_csv_m2)
    m2_header = 0
    m2_empty = 0
    m2_valid = 0
    
    # Track per date using MetricTracker
    tm_trackers = defaultdict(lambda: {
        "spend": MetricTracker(is_int=False),
        "imp": MetricTracker(is_int=True),
        "clk": MetricTracker(is_int=True),
        "eng": MetricTracker(is_int=True),
        "uv": MetricTracker(is_int=True),
        "records": 0
    })
    tm_date_creative_keys = []
    tm_full_keys = []

    for rnum, cols in parsed_rows_m2:
        if not cols:
            m2_empty += 1
            continue
        c0 = cols[0].strip()
        if c0 == "时间":
            m2_header += 1
            continue
        d = parse_date(c0)
        if not d:
            m2_empty += 1
            continue
        m2_valid += 1
        
        creative_id = cols[4].strip() if len(cols) > 4 else ""
        placement = cols[1].strip() if len(cols) > 1 else ""
        targeting = cols[2].strip() if len(cols) > 2 else ""
        unit_id = cols[8].strip() if len(cols) > 8 else ""
        
        tm_date_creative_keys.append((d, creative_id))
        tm_full_keys.append((d, placement, targeting, creative_id, unit_id))
        
        cur = tm_trackers[d]
        cur["spend"].add(clean_num(cols[11]) if len(cols) > 11 else None)
        cur["imp"].add(clean_num(cols[12]) if len(cols) > 12 else None)
        cur["clk"].add(clean_num(cols[13]) if len(cols) > 13 else None)
        cur["eng"].add(clean_num(cols[17]) if len(cols) > 17 else None)
        cur["uv"].add(clean_num(cols[19]) if len(cols) > 19 else None)
        cur["records"] += 1

    rows_tm = []
    for d in sorted(tm_trackers.keys()):
        cur = tm_trackers[d]
        spend = cur["spend"].get_final()
        imp = cur["imp"].get_final()
        clk = cur["clk"].get_final()
        eng = cur["eng"].get_final()
        uv = cur["uv"].get_final()
        
        ctr = round((clk / imp) * 100, 2) if (clk is not None and imp is not None and imp > 0) else None
        cpc = round(spend / clk, 2) if (spend is not None and clk is not None and clk > 0) else None
        cpm = round(spend / imp * 1000, 2) if (spend is not None and imp is not None and imp > 0) else None
        cpe = round(spend / eng, 2) if (spend is not None and eng is not None and eng > 0) else None
        cpuv = round(spend / uv, 2) if (spend is not None and uv is not None and uv > 0) else None
        
        rows_tm.append({
            "date": d,
            "spend": spend,
            "impressions": imp,
            "clicks": clk,
            "ctr": ctr,
            "cpc": cpc,
            "cpm": cpm,
            "engagements": eng,
            "cpe": cpe,
            "uv": uv,
            "cpuv": cpuv,
            "creatives_count": cur["records"],
        })

    sum_spend_m2 = round(sum(r["spend"] for r in rows_tm if r["spend"] is not None), 2)
    datasets.append({
        "id": "meiling-daily-tm-seed",
        "label": "美菱双11-自采天猫种草日流水 (TM种草)",
        "period": f"{rows_tm[0]['date']} ~ {rows_tm[-1]['date']}",
        "sourceId": "src-meiling-sheets-D9ddm3",
        "sourceUrl": f"https://feishu.cn/sheets/{meiling_token}?sheet=D9ddm3",
        "note": "美菱双11自采天猫种草底表（775条全量投放创意记录按日聚合）。各创意归因UV之和，非项目去重人数。源底表无预设独立总计行，对账金额为各记录实际汇总。",
        "metrics": [
            {"key": "spend", "label": "消耗", "unit": "元"},
            {"key": "impressions", "label": "展现量", "unit": "次"},
            {"key": "clicks", "label": "点击量", "unit": "次"},
            {"key": "ctr", "label": "点击率", "unit": "%"},
            {"key": "cpc", "label": "CPC", "unit": "元"},
            {"key": "cpm", "label": "CPM", "unit": "元"},
            {"key": "engagements", "label": "互动量", "unit": "次"},
            {"key": "cpe", "label": "CPE", "unit": "元"},
            {"key": "uv", "label": "站外活跃UV(30日归因)", "unit": "人"},
            {"key": "cpuv", "label": "CPUV", "unit": "元"},
            {"key": "creatives_count", "label": "活跃创意单元数", "unit": "个"}
        ],
        "rows": rows_tm
    })

    audits["meiling-daily-tm-seed"] = {
        "source_table": f"RoAtsw3KTh56ZBtT7cmcTYaznJb / D9ddm3 (（自采天猫种草）数据源)",
        "range_queried": "A1:W776",
        "total_logical_rows": len(parsed_rows_m2),
        "header_rows": m2_header,
        "summary_rows": 0,
        "empty_rows": m2_empty,
        "valid_daily_records": m2_valid,
        "rows_sum_check": (m2_header + m2_empty + m2_valid == len(parsed_rows_m2)),
        "daily_points": len(rows_tm),
        "date_range": f"{rows_tm[0]['date']} ~ {rows_tm[-1]['date']}",
        "sum_spend": sum_spend_m2,
        "source_summary_spend": None,
        "spend_reconciliation_diff": None,
        "reconciliation_note": "源底表无预设独立总计行，仅对各有效行进行真实累计，不伪造独立对账来源。",
        "duplicate_date_keys": len(rows_tm) - len(set(r["date"] for r in rows_tm)),
        "raw_key_duplicates_exact_dimension": len(tm_full_keys) - len(set(tm_full_keys)),
        "raw_key_multi_dimension_occurrences_date_creative": len(tm_date_creative_keys) - len(set(tm_date_creative_keys))
    }

    # 2.3 BI2xBs (自采京东种草数据源流水按日聚合)
    cmd_m3 = f"lark-cli sheets +csv-get --spreadsheet-token {meiling_token} --sheet-id BI2xBs --range A1:W1210 --as user --format json"
    res_m3 = subprocess.run(cmd_m3, shell=True, capture_output=True)
    data_m3 = json.loads(res_m3.stdout.decode("utf-8", errors="replace"))
    raw_csv_m3 = data_m3.get("data", {}).get("annotated_csv", "")
    with open(os.path.join(raw_dumps_dir, "meiling-BI2xBs-raw.csv"), "w", encoding="utf-8") as f:
        f.write(raw_csv_m3)

    parsed_rows_m3 = parse_annotated_blocks(raw_csv_m3)
    m3_header = 0
    m3_empty = 0
    m3_valid = 0
    
    jd_trackers = defaultdict(lambda: {
        "spend": MetricTracker(is_int=False),
        "imp": MetricTracker(is_int=True),
        "clk": MetricTracker(is_int=True),
        "eng": MetricTracker(is_int=True),
        "uv": MetricTracker(is_int=True),
        "records": 0
    })
    jd_date_creative_keys = []
    jd_full_keys = []

    for rnum, cols in parsed_rows_m3:
        if not cols:
            m3_empty += 1
            continue
        c0 = cols[0].strip()
        if c0 == "时间":
            m3_header += 1
            continue
        d = parse_date(c0)
        if not d:
            m3_empty += 1
            continue
        m3_valid += 1
        
        creative_id = cols[4].strip() if len(cols) > 4 else ""
        placement = cols[1].strip() if len(cols) > 1 else ""
        targeting = cols[2].strip() if len(cols) > 2 else ""
        unit_id = cols[8].strip() if len(cols) > 8 else ""
        
        jd_date_creative_keys.append((d, creative_id))
        jd_full_keys.append((d, placement, targeting, creative_id, unit_id))
        
        cur = jd_trackers[d]
        cur["spend"].add(clean_num(cols[11]) if len(cols) > 11 else None)
        cur["imp"].add(clean_num(cols[12]) if len(cols) > 12 else None)
        cur["clk"].add(clean_num(cols[13]) if len(cols) > 13 else None)
        cur["eng"].add(clean_num(cols[17]) if len(cols) > 17 else None)
        cur["uv"].add(clean_num(cols[19]) if len(cols) > 19 else None)
        cur["records"] += 1

    rows_jd = []
    for d in sorted(jd_trackers.keys()):
        cur = jd_trackers[d]
        spend = cur["spend"].get_final()
        imp = cur["imp"].get_final()
        clk = cur["clk"].get_final()
        eng = cur["eng"].get_final()
        uv = cur["uv"].get_final()
        
        ctr = round((clk / imp) * 100, 2) if (clk is not None and imp is not None and imp > 0) else None
        cpc = round(spend / clk, 2) if (spend is not None and clk is not None and clk > 0) else None
        cpm = round(spend / imp * 1000, 2) if (spend is not None and imp is not None and imp > 0) else None
        cpe = round(spend / eng, 2) if (spend is not None and eng is not None and eng > 0) else None
        cpuv = round(spend / uv, 2) if (spend is not None and uv is not None and uv > 0) else None
        
        rows_jd.append({
            "date": d,
            "spend": spend,
            "impressions": imp,
            "clicks": clk,
            "ctr": ctr,
            "cpc": cpc,
            "cpm": cpm,
            "engagements": eng,
            "cpe": cpe,
            "uv": uv,
            "cpuv": cpuv,
            "creatives_count": cur["records"],
        })

    sum_spend_m3 = round(sum(r["spend"] for r in rows_jd if r["spend"] is not None), 2)
    datasets.append({
        "id": "meiling-daily-jd-seed",
        "label": "美菱双11-自采京东种草日流水 (JD种草)",
        "period": f"{rows_jd[0]['date']} ~ {rows_jd[-1]['date']}",
        "sourceId": "src-meiling-sheets-BI2xBs",
        "sourceUrl": f"https://feishu.cn/sheets/{meiling_token}?sheet=BI2xBs",
        "note": "美菱双11自采京东种草底表（1209条全量投放创意记录按日聚合）。各创意归因UV之和，非项目去重人数。源底表无预设独立总计行，对账金额为各记录实际汇总。",
        "metrics": [
            {"key": "spend", "label": "消耗", "unit": "元"},
            {"key": "impressions", "label": "展现量", "unit": "次"},
            {"key": "clicks", "label": "点击量", "unit": "次"},
            {"key": "ctr", "label": "点击率", "unit": "%"},
            {"key": "cpc", "label": "CPC", "unit": "元"},
            {"key": "cpm", "label": "CPM", "unit": "元"},
            {"key": "engagements", "label": "互动量", "unit": "次"},
            {"key": "cpe", "label": "CPE", "unit": "元"},
            {"key": "uv", "label": "站外活跃UV(30日归因)", "unit": "人"},
            {"key": "cpuv", "label": "CPUV", "unit": "元"},
            {"key": "creatives_count", "label": "活跃创意单元数", "unit": "个"}
        ],
        "rows": rows_jd
    })

    audits["meiling-daily-jd-seed"] = {
        "source_table": f"RoAtsw3KTh56ZBtT7cmcTYaznJb / BI2xBs (（自采京东种草）数据源)",
        "range_queried": "A1:W1210",
        "total_logical_rows": len(parsed_rows_m3),
        "header_rows": m3_header,
        "summary_rows": 0,
        "empty_rows": m3_empty,
        "valid_daily_records": m3_valid,
        "rows_sum_check": (m3_header + m3_empty + m3_valid == len(parsed_rows_m3)),
        "daily_points": len(rows_jd),
        "date_range": f"{rows_jd[0]['date']} ~ {rows_jd[-1]['date']}",
        "sum_spend": sum_spend_m3,
        "source_summary_spend": None,
        "spend_reconciliation_diff": None,
        "reconciliation_note": "源底表无预设独立总计行，仅对各有效行进行真实累计，不伪造独立对账来源。",
        "duplicate_date_keys": len(rows_jd) - len(set(r["date"] for r in rows_jd)),
        "raw_key_duplicates_exact_dimension": len(jd_full_keys) - len(set(jd_full_keys)),
        "raw_key_multi_dimension_occurrences_date_creative": len(jd_date_creative_keys) - len(set(jd_date_creative_keys))
    }

    return datasets, audits
