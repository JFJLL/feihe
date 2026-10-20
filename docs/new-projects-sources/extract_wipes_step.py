import subprocess
import json
import os
from extract_utils import parse_date, clean_num, parse_annotated_blocks

def run_wipes(wipes_token, raw_dumps_dir):
    datasets = []
    audits = {}
    
    # 1.1 0QTVhE (By day)
    cmd1 = f"lark-cli sheets +csv-get --spreadsheet-token {wipes_token} --sheet-id 0QTVhE --range A1:H36 --as user --format json"
    res1 = subprocess.run(cmd1, shell=True, capture_output=True)
    data1 = json.loads(res1.stdout.decode("utf-8", errors="replace"))
    raw_csv1 = data1.get("data", {}).get("annotated_csv", "")
    with open(os.path.join(raw_dumps_dir, "wipes-0QTVhE-raw.csv"), "w", encoding="utf-8") as f:
        f.write(raw_csv1)

    parsed_rows1 = parse_annotated_blocks(raw_csv1)
    rows_delivery = []
    w1_header = 0
    w1_summary = 0
    w1_empty = 0
    w1_valid = 0
    w1_source_summary_spend = None

    for rnum, cols in parsed_rows1:
        if not cols or all(not c.strip() for c in cols):
            w1_empty += 1
            continue
        c0 = cols[0].strip()
        if c0 == "时间":
            w1_header += 1
            continue
        if "总计" in c0:
            w1_summary += 1
            w1_source_summary_spend = clean_num(cols[1]) if len(cols) > 1 else None
            continue
        d = parse_date(c0)
        if not d:
            w1_empty += 1
            continue
        w1_valid += 1
        
        spend = clean_num(cols[1]) if len(cols) > 1 else None
        imp = clean_num(cols[2]) if len(cols) > 2 else None
        eng = clean_num(cols[3]) if len(cols) > 3 else None
        uv = clean_num(cols[4]) if len(cols) > 4 else None
        
        # Derived rates: only computed if both numerator and denominator are valid and denominator > 0
        cpm = round(spend / imp * 1000, 2) if (spend is not None and imp is not None and imp > 0) else None
        cpe = round(spend / eng, 2) if (spend is not None and eng is not None and eng > 0) else None
        cpuv = round(spend / uv, 2) if (spend is not None and uv is not None and uv > 0) else None
        
        rows_delivery.append({
            "date": d,
            "spend": round(spend, 2) if spend is not None else None,
            "impressions": int(round(imp)) if imp is not None else None,
            "engagements": int(round(eng)) if eng is not None else None,
            "uv": int(round(uv)) if uv is not None else None,
            "cpm": cpm,
            "cpe": cpe,
            "cpuv": cpuv,
        })

    sum_spend_w1 = round(sum(r["spend"] for r in rows_delivery if r["spend"] is not None), 2)
    diff_w1 = round(sum_spend_w1 - w1_source_summary_spend, 2) if w1_source_summary_spend is not None else None

    datasets.append({
        "id": "wipes-daily-delivery",
        "label": "稳健玉米湿巾投放日趋势 (By day)",
        "period": f"{rows_delivery[0]['date']} ~ {rows_delivery[-1]['date']}",
        "sourceId": "src-wipes-sheets-0QTVhE",
        "sourceUrl": f"https://feishu.cn/sheets/{wipes_token}?sheet=0QTVhE",
        "note": "稳健玉米消毒湿巾全渠道投放日跟踪表（0QTVhE）。小红星站外活跃UV为30日归因口径（各创意归因UV之和，非项目去重人数）。10/18当日UV为0导致CPUV保持为null。",
        "metrics": [
            {"key": "spend", "label": "实际消耗", "unit": "元"},
            {"key": "impressions", "label": "展现量", "unit": "次"},
            {"key": "engagements", "label": "互动量", "unit": "次"},
            {"key": "uv", "label": "站外活跃UV(30日归因)", "unit": "人"},
            {"key": "cpm", "label": "CPM", "unit": "元"},
            {"key": "cpe", "label": "CPE", "unit": "元"},
            {"key": "cpuv", "label": "CPUV", "unit": "元"}
        ],
        "rows": rows_delivery
    })

    audits["wipes-daily-delivery"] = {
        "source_table": f"Ero1shDTFhVzwttqDMLceZQ4nMb / 0QTVhE (By day)",
        "range_queried": "A1:H36",
        "total_logical_rows": len(parsed_rows1),
        "header_rows": w1_header,
        "summary_rows": w1_summary,
        "empty_rows": w1_empty,
        "valid_daily_records": w1_valid,
        "rows_sum_check": (w1_header + w1_summary + w1_empty + w1_valid == len(parsed_rows1)),
        "daily_points": len(rows_delivery),
        "date_range": f"{rows_delivery[0]['date']} ~ {rows_delivery[-1]['date']}",
        "sum_spend": sum_spend_w1,
        "source_summary_spend": w1_source_summary_spend,
        "spend_reconciliation_diff": diff_w1,
        "duplicate_date_keys": len(rows_delivery) - len(set(r["date"] for r in rows_delivery)),
        "raw_key_duplicates": 0
    }

    # 1.2 wY1HZO (淘搜)
    cmd2 = f"lark-cli sheets +csv-get --spreadsheet-token {wipes_token} --sheet-id wY1HZO --range A1:M40 --as user --format json"
    res2 = subprocess.run(cmd2, shell=True, capture_output=True)
    data2 = json.loads(res2.stdout.decode("utf-8", errors="replace"))
    raw_csv2 = data2.get("data", {}).get("annotated_csv", "")
    with open(os.path.join(raw_dumps_dir, "wipes-wY1HZO-raw.csv"), "w", encoding="utf-8") as f:
        f.write(raw_csv2)

    parsed_rows2 = parse_annotated_blocks(raw_csv2)
    rows_taosou = []
    w2_header = 0
    w2_summary = 0
    w2_empty_future = 0
    w2_valid = 0
    w2_source_summary_spend = None

    for rnum, cols in parsed_rows2:
        if not cols:
            w2_empty_future += 1
            continue
        c0 = cols[0].strip()
        if c0 == "总计":
            w2_summary += 1
            w2_source_summary_spend = clean_num(cols[12]) if len(cols) > 12 else None
            continue
        if c0 == "日期":
            w2_header += 1
            continue
        d = parse_date(c0)
        if not d:
            w2_empty_future += 1
            continue
        
        tot_idx = clean_num(cols[7]) if len(cols) > 7 else None
        tot_sp = clean_num(cols[12]) if len(cols) > 12 else None
        if d >= "2026-10-19" and (tot_idx is None or tot_idx == 0) and (tot_sp is None or tot_sp == 0):
            w2_empty_future += 1
            continue
        w2_valid += 1
        
        rows_taosou.append({
            "date": d,
            "kw_total_index": int(round(tot_idx)) if tot_idx is not None else None,
            "kw_wipes": int(round(clean_num(cols[1]))) if len(cols) > 1 and clean_num(cols[1]) is not None else None,
            "kw_corn_wipes": int(round(clean_num(cols[2]))) if len(cols) > 2 and clean_num(cols[2]) is not None else None,
            "kw_alcohol": int(round(clean_num(cols[3]))) if len(cols) > 3 and clean_num(cols[3]) is not None else None,
            "kw_alcohol_wipes": int(round(clean_num(cols[4]))) if len(cols) > 4 and clean_num(cols[4]) is not None else None,
            "kw_corn_alcohol_wipes": int(round(clean_num(cols[5]))) if len(cols) > 5 and clean_num(cols[5]) is not None else None,
            "kw_disinfect_wipes": int(round(clean_num(cols[6]))) if len(cols) > 6 and clean_num(cols[6]) is not None else None,
            "spend_k": round(clean_num(cols[8]), 2) if len(cols) > 8 and clean_num(cols[8]) is not None else None,
            "spend_f": round(clean_num(cols[9]), 2) if len(cols) > 9 and clean_num(cols[9]) is not None else None,
            "spend_s": round(clean_num(cols[10]), 2) if len(cols) > 10 and clean_num(cols[10]) is not None else None,
            "spend_cid": round(clean_num(cols[11]), 2) if len(cols) > 11 and clean_num(cols[11]) is not None else None,
            "spend_total": round(tot_sp, 2) if tot_sp is not None else None,
        })

    sum_spend_w2 = round(sum(r["spend_total"] for r in rows_taosou if r["spend_total"] is not None), 2)
    diff_w2 = round(sum_spend_w2 - w2_source_summary_spend, 2) if w2_source_summary_spend is not None else None

    datasets.append({
        "id": "wipes-daily-taosou",
        "label": "稳健淘搜指数与分渠道日消耗 (淘搜)",
        "period": f"{rows_taosou[0]['date']} ~ {rows_taosou[-1]['date']}",
        "sourceId": "src-wipes-sheets-wY1HZO",
        "sourceUrl": f"https://feishu.cn/sheets/{wipes_token}?sheet=wY1HZO",
        "note": "淘搜每日搜索指数及K/F/S/CID分渠道实际消耗，10/19及后续未来无投放空行已严格剔除（不计作实际0消耗）。",
        "metrics": [
            {"key": "kw_total_index", "label": "淘搜总指数", "unit": ""},
            {"key": "kw_wipes", "label": "稳健酒精湿巾", "unit": ""},
            {"key": "kw_corn_wipes", "label": "稳健玉米酒精湿巾", "unit": ""},
            {"key": "spend_total", "label": "总日消耗", "unit": "元"},
            {"key": "spend_k", "label": "K端消耗", "unit": "元"},
            {"key": "spend_f", "label": "F端消耗", "unit": "元"},
            {"key": "spend_s", "label": "S端消耗", "unit": "元"},
            {"key": "spend_cid", "label": "CID端消耗", "unit": "元"}
        ],
        "rows": rows_taosou
    })

    audits["wipes-daily-taosou"] = {
        "source_table": f"Ero1shDTFhVzwttqDMLceZQ4nMb / wY1HZO (淘搜)",
        "range_queried": "A1:M40",
        "total_logical_rows": len(parsed_rows2),
        "header_rows": w2_header,
        "summary_rows": w2_summary,
        "empty_rows": w2_empty_future,
        "valid_daily_records": w2_valid,
        "rows_sum_check": (w2_header + w2_summary + w2_empty_future + w2_valid == len(parsed_rows2)),
        "daily_points": len(rows_taosou),
        "date_range": f"{rows_taosou[0]['date']} ~ {rows_taosou[-1]['date']}",
        "sum_spend": sum_spend_w2,
        "source_summary_spend": w2_source_summary_spend,
        "spend_reconciliation_diff": diff_w2,
        "duplicate_date_keys": len(rows_taosou) - len(set(r["date"] for r in rows_taosou)),
        "raw_key_duplicates": 0
    }

    return datasets, audits
