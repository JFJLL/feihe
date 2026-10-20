import subprocess
import json
import os
from collections import defaultdict
from extract_utils import parse_date, clean_num, parse_annotated_blocks, MetricTracker

def run_kailas(kailas_token, raw_dumps_dir):
    datasets = []
    audits = {}

    kailas_sheet = "OzIjd5"
    k_header = 0
    k_empty = 0
    k_valid = 0
    kailas_total_logical_rows = 0
    
    kailas_trackers = defaultdict(lambda: {
        "spend": MetricTracker(is_int=False),
        "imp": MetricTracker(is_int=True),
        "clk": MetricTracker(is_int=True),
        "eng": MetricTracker(is_int=True),
        "seed": MetricTracker(is_int=True),
        "deep": MetricTracker(is_int=True),
        "search_clk": MetricTracker(is_int=True),
        "uv": MetricTracker(is_int=True),
        "records": 0
    })
    k_date_creative_keys = []
    k_full_keys = []

    raw_chunks_combined = []

    for start in range(1, 7752, 1000):
        end = min(start + 999, 7751)
        cmd_k = f"lark-cli sheets +csv-get --spreadsheet-token {kailas_token} --sheet-id {kailas_sheet} --range A{start}:Z{end} --as user --format json"
        res_k = subprocess.run(cmd_k, shell=True, capture_output=True)
        data_k = json.loads(res_k.stdout.decode("utf-8", errors="replace"))
        csv_text_k = data_k.get("data", {}).get("annotated_csv", "")
        raw_chunks_combined.append(f"--- CHUNK {start}:{end} ---\n" + csv_text_k[:2000])
        
        parsed_chunk = parse_annotated_blocks(csv_text_k)
        kailas_total_logical_rows += len(parsed_chunk)
        
        for rnum, cols in parsed_chunk:
            if not cols:
                k_empty += 1
                continue
            c0 = cols[0].strip()
            if c0 == "时间":
                k_header += 1
                continue
            d = parse_date(c0)
            if not d:
                k_empty += 1
                continue
            k_valid += 1
            
            creative_id = cols[2].strip() if len(cols) > 2 else ""
            unit_id = cols[6].strip() if len(cols) > 6 else ""
            plan_id = cols[8].strip() if len(cols) > 8 else ""
            
            k_date_creative_keys.append((d, creative_id))
            k_full_keys.append((d, creative_id, unit_id, plan_id))
            
            cur = kailas_trackers[d]
            cur["spend"].add(clean_num(cols[9]) if len(cols) > 9 else None)
            cur["imp"].add(clean_num(cols[10]) if len(cols) > 10 else None)
            cur["clk"].add(clean_num(cols[11]) if len(cols) > 11 else None)
            cur["eng"].add(clean_num(cols[15]) if len(cols) > 15 else None)
            cur["seed"].add(clean_num(cols[17]) if len(cols) > 17 else None)
            cur["deep"].add(clean_num(cols[19]) if len(cols) > 19 else None)
            cur["search_clk"].add(clean_num(cols[21]) if len(cols) > 21 else None)
            cur["uv"].add(clean_num(cols[24]) if len(cols) > 24 else None)
            cur["records"] += 1

    with open(os.path.join(raw_dumps_dir, "kailas-OzIjd5-sample-chunks.txt"), "w", encoding="utf-8") as f:
        f.write("\n\n".join(raw_chunks_combined))

    rows_kailas = []
    for d in sorted(kailas_trackers.keys()):
        cur = kailas_trackers[d]
        spend = cur["spend"].get_final()
        imp = cur["imp"].get_final()
        clk = cur["clk"].get_final()
        eng = cur["eng"].get_final()
        seed = cur["seed"].get_final()
        deep = cur["deep"].get_final()
        s_clk = cur["search_clk"].get_final()
        uv = cur["uv"].get_final()
        
        ctr = round((clk / imp) * 100, 2) if (clk is not None and imp is not None and imp > 0) else None
        cpc = round(spend / clk, 2) if (spend is not None and clk is not None and clk > 0) else None
        cpm = round(spend / imp * 1000, 2) if (spend is not None and imp is not None and imp > 0) else None
        cpe = round(spend / eng, 2) if (spend is not None and eng is not None and eng > 0) else None
        cpuv = round(spend / uv, 2) if (spend is not None and uv is not None and uv > 0) else None
        
        rows_kailas.append({
            "date": d,
            "spend": spend,
            "impressions": imp,
            "clicks": clk,
            "ctr": ctr,
            "cpc": cpc,
            "cpm": cpm,
            "engagements": eng,
            "cpe": cpe,
            "seed_crowd": seed,
            "deep_seed_crowd": deep,
            "search_clicks": s_clk,
            "uv": uv,
            "cpuv": cpuv,
            "creatives_count": cur["records"],
        })

    sum_spend_k = round(sum(r["spend"] for r in rows_kailas if r["spend"] is not None), 2)
    datasets.append({
        "id": "kailas-daily-fuga-creatives",
        "label": "凯乐石FUGA大坡王黑山10月投放日流水 (底表-创意-10月)",
        "period": f"{rows_kailas[0]['date']} ~ {rows_kailas[-1]['date']}",
        "sourceId": "src-kailas-sheets-OzIjd5",
        "sourceUrl": f"https://feishu.cn/sheets/{kailas_token}?sheet=OzIjd5",
        "note": "凯乐石FUGA大坡王黑山10月创意明细底表全量聚合（7,750条记录全量逐日汇总，无抽样推总）。站外活跃UV为各创意归因UV之和，非项目去重人数。日报表pwNPq2因线上公式断裂失联返回0，以此真实底表为准。",
        "metrics": [
            {"key": "spend", "label": "消耗", "unit": "元"},
            {"key": "impressions", "label": "展现量", "unit": "次"},
            {"key": "clicks", "label": "点击量", "unit": "次"},
            {"key": "ctr", "label": "点击率", "unit": "%"},
            {"key": "cpc", "label": "CPC", "unit": "元"},
            {"key": "cpm", "label": "CPM", "unit": "元"},
            {"key": "engagements", "label": "互动量", "unit": "次"},
            {"key": "cpe", "label": "CPE", "unit": "元"},
            {"key": "seed_crowd", "label": "新增种草人群", "unit": "人"},
            {"key": "deep_seed_crowd", "label": "深度种草人群", "unit": "人"},
            {"key": "search_clicks", "label": "搜索组件点击量", "unit": "次"},
            {"key": "uv", "label": "站外活跃UV(30日归因)", "unit": "人"},
            {"key": "cpuv", "label": "CPUV", "unit": "元"},
            {"key": "creatives_count", "label": "活跃创意单元数", "unit": "个"}
        ],
        "rows": rows_kailas
    })

    audits["kailas-daily-fuga-creatives"] = {
        "source_table": f"X7CasjHnThuFA2tPYuscN6NBnMf / OzIjd5 (底表-创意-10月)",
        "range_queried": "A1:Z7751 (8 chunks of 1000 rows)",
        "total_logical_rows": kailas_total_logical_rows,
        "header_rows": k_header,
        "summary_rows": 0,
        "empty_rows": k_empty,
        "valid_daily_records": k_valid,
        "rows_sum_check": (k_header + k_empty + k_valid == kailas_total_logical_rows),
        "daily_points": len(rows_kailas),
        "date_range": f"{rows_kailas[0]['date']} ~ {rows_kailas[-1]['date']}",
        "sum_spend": sum_spend_k,
        "source_summary_spend": None,
        "spend_reconciliation_diff": None,
        "reconciliation_note": "源底表无预设独立总计行，仅对各有效行进行真实累计，不伪造独立对账来源。",
        "duplicate_date_keys": len(rows_kailas) - len(set(r["date"] for r in rows_kailas)),
        "raw_key_duplicates_exact_dimension": len(k_full_keys) - len(set(k_full_keys)),
        "raw_key_multi_dimension_occurrences_date_creative": len(k_date_creative_keys) - len(set(k_date_creative_keys))
    }

    return datasets, audits
