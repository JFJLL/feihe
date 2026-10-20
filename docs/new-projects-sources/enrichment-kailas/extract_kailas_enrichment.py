import subprocess
import json
import os
import sys
import re
import csv
import io
import datetime
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

current_dir = os.path.dirname(os.path.abspath(__file__))
repo_root = os.path.abspath(os.path.join(current_dir, "..", "..", ".."))
output_json_path = os.path.join(repo_root, "feihe-mvp", "lib", "campaign-enrichment", "kailas.json")
audit_log_path = os.path.join(current_dir, "enrichment-audit.json")
raw_dumps_dir = os.path.join(current_dir, "raw-dumps")
os.makedirs(raw_dumps_dir, exist_ok=True)
os.makedirs(os.path.dirname(output_json_path), exist_ok=True)

# Import parse_annotated_blocks from extract_utils
sys.path.insert(0, os.path.abspath(os.path.join(current_dir, "..")))
from extract_utils import parse_annotated_blocks, clean_num

def parse_clean_num(val):
    return clean_num(val)

def fetch_csv_blocks_with_retry(token, sheet_id, cell_range, dump_name=None, retries=3):
    last_err = None
    for attempt in range(retries):
        cmd = f"lark-cli sheets +csv-get --spreadsheet-token {token} --sheet-id {sheet_id} --range {cell_range} --as user --format json"
        res = subprocess.run(cmd, shell=True, capture_output=True)
        if res.returncode == 0:
            try:
                data = json.loads(res.stdout.decode("utf-8", errors="replace"))
                if data.get("ok"):
                    annotated = data.get("data", {}).get("annotated_csv", "")
                    if dump_name:
                        dump_path = os.path.join(raw_dumps_dir, f"{dump_name}.txt")
                        with open(dump_path, "a", encoding="utf-8") as f:
                            f.write(f"\n--- {cell_range} ---\n" + annotated)
                    return parse_annotated_blocks(annotated)
                else:
                    last_err = data.get("error")
            except Exception as e:
                last_err = str(e)
        else:
            last_err = res.stderr.decode("utf-8", errors="replace")
        time.sleep(1.0)
    raise RuntimeError(f"lark-cli failed for {token}/{sheet_id} {cell_range} after {retries} attempts: {last_err}")

def clean_publish_url(raw_url):
    if not raw_url:
        return ""
    u = str(raw_url).strip()
    u_clean = re.sub(r"\?.*$", "", u)
    return u_clean

def main():
    print(">>> Starting Kailas Data Enrichment Extraction (Strict Audit & Validation)...")
    extracted_at = datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat()
    
    sources = [
        {
            "id": "src-kailas-node-LT1MwikWci8LTDk0UL7coXfrnVb",
            "name": "黑山Q3日常双周会小结资料 (副本) 核心明细",
            "url": "https://yimeichuanbo.feishu.cn/wiki/Y8S1wy0YUiAtJrkY9G5ceczDnjf",
            "status": "ready",
            "detail": "包含Q3自然与投流对照总览(JPKUX9)及8-9月达人执行与投流追踪表(HBAV7o/pBBc7Y/krnHxa)",
            "fetchedAt": extracted_at
        },
        {
            "id": "src-kailas-sheets-c4qXS1",
            "name": "黑山种草投放数据-内容笔记表现 (c4qXS1)",
            "url": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf?sheet=c4qXS1",
            "status": "ready",
            "detail": "包含7-10月累计在跑119篇达人笔记全维度投流与转化指标快照",
            "fetchedAt": extracted_at
        },
        {
            "id": "src-kailas-sheets-zkRGHD",
            "name": "黑山种草投放数据-关键词表现 (zkRGHD)",
            "url": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf?sheet=zkRGHD",
            "status": "ready",
            "detail": "聚光搜索6大词类及细分搜索词消耗与CPUV表现明细",
            "fetchedAt": extracted_at
        },
        {
            "id": "src-kailas-sheets-hGgSvt",
            "name": "黑山种草投放数据-需提升消耗的笔记列表 (hGgSvt)",
            "url": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf?sheet=hGgSvt",
            "status": "ready",
            "detail": "日报在跑笔记附表，记录65篇在投笔记达人裸价与投流消耗杠杆比",
            "fetchedAt": extracted_at
        }
    ]

    tables = []
    audits = {}

    # Slice 1: Q3 Natural vs Paid Overview
    print("--- [1/5] Extracting Q3 Organic vs Paid Overview (JPKUX9) ---")
    blocks_jp = fetch_csv_blocks_with_retry("Pm3DsKubghgFDAtbbS5cyHY5n4g", "JPKUX9", "A1:J6", "kailas-JPKUX9-raw")
    row_map_jp = {rnum: cols for rnum, cols in blocks_jp}
    r_tot = row_map_jp.get(2, [])
    r_org = row_map_jp.get(4, [])
    r_fs = row_map_jp.get(6, [])

    t1_rows = [
        {
            "channel": "内容端 (达人采买与自然沉淀)",
            "spend": parse_clean_num(r_org[0]) if len(r_org) > 0 else None,
            "impressions": parse_clean_num(r_org[1]) if len(r_org) > 1 else None,
            "reads": parse_clean_num(r_org[2]) if len(r_org) > 2 else None,
            "engagements": parse_clean_num(r_org[3]) if len(r_org) > 3 else None,
            "ctr": parse_clean_num(r_org[4]) if len(r_org) > 4 else None,
            "cpc": parse_clean_num(r_org[5]) if len(r_org) > 5 else None,
            "cpe": parse_clean_num(r_org[6]) if len(r_org) > 6 else None,
            "cpm": parse_clean_num(r_org[7]) if len(r_org) > 7 else None,
            "cpti": parse_clean_num(r_org[8]) if len(r_org) > 8 else None,
            "cpuv": parse_clean_num(r_org[9]) if len(r_org) > 9 else None
        },
        {
            "channel": "投流端 (FS广告商业放量)",
            "spend": parse_clean_num(r_fs[0]) if len(r_fs) > 0 else None,
            "impressions": parse_clean_num(r_fs[1]) if len(r_fs) > 1 else None,
            "reads": parse_clean_num(r_fs[2]) if len(r_fs) > 2 else None,
            "engagements": parse_clean_num(r_fs[3]) if len(r_fs) > 3 else None,
            "ctr": parse_clean_num(r_fs[4]) if len(r_fs) > 4 else None,
            "cpc": parse_clean_num(r_fs[5]) if len(r_fs) > 5 else None,
            "cpe": parse_clean_num(r_fs[6]) if len(r_fs) > 6 else None,
            "cpm": parse_clean_num(r_fs[7]) if len(r_fs) > 7 else None,
            "cpti": parse_clean_num(r_fs[8]) if len(r_fs) > 8 else None,
            "cpuv": parse_clean_num(r_fs[9]) if len(r_fs) > 9 else None
        },
        {
            "channel": "项目全量汇总 (K+FS综合)",
            "spend": parse_clean_num(r_tot[0]) if len(r_tot) > 0 else None,
            "impressions": parse_clean_num(r_tot[1]) if len(r_tot) > 1 else None,
            "reads": parse_clean_num(r_tot[2]) if len(r_tot) > 2 else None,
            "engagements": parse_clean_num(r_tot[3]) if len(r_tot) > 3 else None,
            "ctr": parse_clean_num(r_tot[4]) if len(r_tot) > 4 else None,
            "cpc": parse_clean_num(r_tot[5]) if len(r_tot) > 5 else None,
            "cpe": parse_clean_num(r_tot[6]) if len(r_tot) > 6 else None,
            "cpm": parse_clean_num(r_tot[7]) if len(r_tot) > 7 else None,
            "cpti": parse_clean_num(r_fs[8]) if len(r_fs) > 8 else None,
            "cpuv": parse_clean_num(r_fs[9]) if len(r_fs) > 9 else None
        }
    ]

    tables.append({
        "id": "kailas-q3-organic-vs-paid",
        "title": "Q3黑山自然内容与投流放大效果对照表",
        "period": "2026-07-16 ~ 2026-09-27 (Q3阶段)",
        "sourceId": "src-kailas-node-LT1MwikWci8LTDk0UL7coXfrnVb",
        "sourceUrl": "https://yimeichuanbo.feishu.cn/wiki/Y8S1wy0YUiAtJrkY9G5ceczDnjf",
        "note": "内容端为KOL采购及自然分发沉淀，投流端为FS商业竞价放量；各项指标按原表记录呈现，未跨周期平摊或推算。",
        "category": "performance",
        "provenance": "feishu",
        "columns": [
            {"key": "channel", "title": "投放与沉淀渠道", "type": "string", "align": "left"},
            {"key": "spend", "title": "消耗金额 (元)", "type": "currency", "align": "right"},
            {"key": "impressions", "title": "曝光量 (次)", "type": "number", "align": "right"},
            {"key": "reads", "title": "阅读量 (次)", "type": "number", "align": "right"},
            {"key": "engagements", "title": "互动量 (次)", "type": "number", "align": "right"},
            {"key": "ctr", "title": "点击率 (%)", "type": "percent", "align": "right"},
            {"key": "cpc", "title": "CPC (元)", "type": "currency", "align": "right"},
            {"key": "cpe", "title": "CPE (元)", "type": "currency", "align": "right"},
            {"key": "cpm", "title": "CPM (元)", "type": "currency", "align": "right"},
            {"key": "cpti", "title": "CPTI (元)", "type": "currency", "align": "right"},
            {"key": "cpuv", "title": "CPUV (元)", "type": "currency", "align": "right"}
        ],
        "rows": t1_rows
    })
    audits["kailas-q3-organic-vs-paid"] = {
        "source_rows": len(blocks_jp),
        "last_row_index": 6,
        "valid_channels_count": len(t1_rows),
        "content_spend": t1_rows[0]["spend"],
        "paid_spend": t1_rows[1]["spend"],
        "total_spend": t1_rows[2]["spend"],
        "spend_sum_valid": round(t1_rows[0]["spend"] + t1_rows[1]["spend"], 2) == round(t1_rows[2]["spend"], 2)
    }

    # Slice 2: All Notes Performance Scatter (c4qXS1) in 2 chunks
    print("--- [2/5] Extracting Notes Performance Scatter (c4qXS1) ---")
    blocks_c4_1 = fetch_csv_blocks_with_retry("X7CasjHnThuFA2tPYuscN6NBnMf", "c4qXS1", "T23:AM85", "kailas-c4qXS1-raw")
    blocks_c4_2 = fetch_csv_blocks_with_retry("X7CasjHnThuFA2tPYuscN6NBnMf", "c4qXS1", "T86:AM145", "kailas-c4qXS1-raw")
    blocks_c4 = blocks_c4_1 + blocks_c4_2

    t2_rows = []
    excluded_summary_rows = []
    for rnum, cols in blocks_c4:
        if rnum == 23:
            continue # Header
        if not cols or len(cols) < 2:
            continue
        kol = cols[0].strip()
        if not kol or kol in ['达人昵称', '#N/A', '（空白）'] or '总计' in kol or kol.startswith('#'):
            excluded_summary_rows.append((rnum, kol))
            continue
        spend = parse_clean_num(cols[1]) if len(cols) > 1 else None
        imp = parse_clean_num(cols[2]) if len(cols) > 2 else None
        clk = parse_clean_num(cols[3]) if len(cols) > 3 else None
        ctr = parse_clean_num(cols[4]) if len(cols) > 4 else None
        cpm = parse_clean_num(cols[5]) if len(cols) > 5 else None
        cpc = parse_clean_num(cols[6]) if len(cols) > 6 else None
        eng = parse_clean_num(cols[7]) if len(cols) > 7 else None
        cpe = parse_clean_num(cols[8]) if len(cols) > 8 else None
        seed = parse_clean_num(cols[9]) if len(cols) > 9 else None
        cpi = parse_clean_num(cols[10]) if len(cols) > 10 else None
        deep_seed = parse_clean_num(cols[11]) if len(cols) > 11 else None
        cpti = parse_clean_num(cols[12]) if len(cols) > 12 else None
        s_clk = parse_clean_num(cols[13]) if len(cols) > 13 else None
        cps = parse_clean_num(cols[14]) if len(cols) > 14 else None
        uv = parse_clean_num(cols[15]) if len(cols) > 15 else None
        cpuv = parse_clean_num(cols[16]) if len(cols) > 16 else None
        task_spend = parse_clean_num(cols[17]) if len(cols) > 17 else None
        note_id = cols[18].strip() if len(cols) > 18 else ""

        if spend is None and imp is None and clk is None:
            excluded_summary_rows.append((rnum, kol + " (all nulls)"))
            continue

        t2_rows.append({
            "kolName": kol,
            "noteId": note_id,
            "spend": spend,
            "taskSpend": task_spend,
            "impressions": imp,
            "clicks": clk,
            "ctr": ctr,
            "cpm": cpm,
            "cpc": cpc,
            "engagements": eng,
            "cpe": cpe,
            "seedCrowd": seed,
            "cpi": cpi,
            "deepSeedCrowd": deep_seed,
            "cpti": cpti,
            "searchClicks": s_clk,
            "cps": cps,
            "externalUv": uv,
            "cpuv": cpuv
        })

    tables.append({
        "id": "kailas-notes-performance-scatter",
        "title": "达人笔记投流效果与转化分布快照 (119篇)",
        "period": "全期累计(源表统计截止未注明)",
        "sourceId": "src-kailas-sheets-c4qXS1",
        "sourceUrl": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf?sheet=c4qXS1",
        "note": "快照涵盖有实际消耗或展现的119篇达人笔记明细（原始123行，排除表头1行、#N/A/空白2行、总计汇总1行）；UV为创意归因UV；特别注意：原表CPUV计算分子为小红盟任务期消费(taskSpend)，非总消费(spend)，两口径不可混算。",
        "category": "performance",
        "provenance": "feishu",
        "columns": [
            {"key": "kolName", "title": "达人昵称", "type": "string", "align": "left"},
            {"key": "noteId", "title": "笔记ID", "type": "string", "align": "left"},
            {"key": "spend", "title": "总消费 (元)", "type": "currency", "align": "right"},
            {"key": "taskSpend", "title": "小红盟任务期消费 (元)", "type": "currency", "align": "right"},
            {"key": "impressions", "title": "展现量 (次)", "type": "number", "align": "right"},
            {"key": "clicks", "title": "点击量 (次)", "type": "number", "align": "right"},
            {"key": "ctr", "title": "点击率 (%)", "type": "percent", "align": "right"},
            {"key": "cpm", "title": "CPM (元)", "type": "currency", "align": "right"},
            {"key": "cpc", "title": "CPC (元)", "type": "currency", "align": "right"},
            {"key": "engagements", "title": "互动量 (次)", "type": "number", "align": "right"},
            {"key": "cpe", "title": "CPE (元)", "type": "currency", "align": "right"},
            {"key": "seedCrowd", "title": "新增种草人群", "type": "number", "align": "right"},
            {"key": "cpi", "title": "CPI (元)", "type": "currency", "align": "right"},
            {"key": "deepSeedCrowd", "title": "深度种草人群", "type": "number", "align": "right"},
            {"key": "cpti", "title": "CPTI (元)", "type": "currency", "align": "right"},
            {"key": "searchClicks", "title": "搜组点击", "type": "number", "align": "right"},
            {"key": "cps", "title": "搜组成本 (元)", "type": "currency", "align": "right"},
            {"key": "externalUv", "title": "站外活跃UV(归因)", "type": "number", "align": "right"},
            {"key": "cpuv", "title": "CPUV (元)", "type": "currency", "align": "right"}
        ],
        "rows": t2_rows
    })
    audits["kailas-notes-performance-scatter"] = {
        "raw_logical_blocks": len(blocks_c4),
        "last_row_index": blocks_c4[-1][0] if blocks_c4 else None,
        "valid_snapshot_notes": len(t2_rows),
        "excluded_rows": excluded_summary_rows,
        "sum_spend": round(sum(r["spend"] for r in t2_rows if r["spend"]), 2),
        "sum_task_spend": round(sum(r["taskSpend"] for r in t2_rows if r["taskSpend"]), 2),
        "sum_impressions": sum(r["impressions"] for r in t2_rows if r["impressions"]),
        "sum_engagements": sum(r["engagements"] for r in t2_rows if r["engagements"]),
        "sum_uv_attributed": sum(r["externalUv"] for r in t2_rows if r["externalUv"])
    }

    # Slice 3: Material KFS Dual View (51 Notes Samples)
    print("--- [3/5] Extracting Material Level KFS Dual View (HBAV7o/pBBc7Y/krnHxa) ---")
    subsheets = [
        ("HBAV7o", "A2:AC32", "8月投放批次", "kailas-HBAV7o-raw"),
        ("pBBc7Y", "A2:AC18", "9月上旬批次", "kailas-pBBc7Y-raw"),
        ("krnHxa", "A2:AC15", "9月中下旬批次", "kailas-krnHxa-raw"),
    ]
    t3_rows = []
    subsheet_audit_counts = {}
    for sid, rng, stage_label, dump_file in subsheets:
        blocks_sub = fetch_csv_blocks_with_retry("Pm3DsKubghgFDAtbbS5cyHY5n4g", sid, rng, dump_file)
        valid_in_sub = 0
        for rnum, cols in blocks_sub:
            if not cols or len(cols) < 10:
                continue
            note_id = cols[0].strip()
            if not note_id or note_id.startswith("笔记ID") or "总计" in note_id or note_id.startswith("#"):
                continue
            content_type = cols[1].strip() if len(cols) > 1 else ""
            coop_format = cols[2].strip() if len(cols) > 2 else ""
            tier = cols[3].strip() if len(cols) > 3 else ""
            kol_name = cols[4].strip() if len(cols) > 4 else ""
            k_cost = parse_clean_num(cols[5]) if len(cols) > 5 else None
            pub_date = cols[6].strip() if len(cols) > 6 else ""
            total_kfs = parse_clean_num(cols[8]) if len(cols) > 8 else None
            pgy_imp = parse_clean_num(cols[9]) if len(cols) > 9 else None
            pgy_read = parse_clean_num(cols[10]) if len(cols) > 10 else None
            pgy_eng = parse_clean_num(cols[11]) if len(cols) > 11 else None
            is_viral = cols[12].strip() if len(cols) > 12 else "否"
            pgy_cpe = parse_clean_num(cols[15]) if len(cols) > 15 else None
            
            fs_spend = parse_clean_num(cols[17]) if len(cols) > 17 else None
            fs_imp = parse_clean_num(cols[18]) if len(cols) > 18 else None
            fs_clk = parse_clean_num(cols[19]) if len(cols) > 19 else None
            fs_eng = parse_clean_num(cols[20]) if len(cols) > 20 else None
            fs_ctr = parse_clean_num(cols[21]) if len(cols) > 21 else None
            fs_cpc = parse_clean_num(cols[22]) if len(cols) > 22 else None
            fs_cpe = parse_clean_num(cols[24]) if len(cols) > 24 else None
            ti_scale = parse_clean_num(cols[25]) if len(cols) > 25 else None
            cpti = parse_clean_num(cols[26]) if len(cols) > 26 else None
            uv = parse_clean_num(cols[27]) if len(cols) > 27 else None
            cpuv = parse_clean_num(cols[28]) if len(cols) > 28 else None
            
            t3_rows.append({
                "stage": stage_label,
                "kolName": kol_name,
                "noteId": note_id,
                "contentType": content_type,
                "coopFormat": coop_format,
                "tier": tier,
                "kCost": k_cost,
                "publishDate": pub_date,
                "totalSpendKfs": total_kfs,
                "pgyImp": pgy_imp,
                "pgyRead": pgy_read,
                "pgyEng": pgy_eng,
                "isViral": is_viral,
                "pgyCpe": pgy_cpe,
                "fsSpend": fs_spend,
                "fsImp": fs_imp,
                "fsClick": fs_clk,
                "fsEng": fs_eng,
                "fsCtr": fs_ctr,
                "fsCpc": fs_cpc,
                "fsCpe": fs_cpe,
                "tiScale": ti_scale,
                "cpti": cpti,
                "externalUv": uv,
                "cpuv": cpuv
            })
            valid_in_sub += 1
        subsheet_audit_counts[sid] = {"queried_blocks": len(blocks_sub), "valid_notes": valid_in_sub}

    tables.append({
        "id": "kailas-kol-material-kfs-dual",
        "title": "Q3达人素材级采购成本与投流放量明细表 (51篇样本)",
        "period": "原表批次(8月/9月上旬/9月中下旬，统计截止未注明)",
        "sourceId": "src-kailas-node-LT1MwikWci8LTDk0UL7coXfrnVb",
        "sourceUrl": "https://yimeichuanbo.feishu.cn/wiki/Y8S1wy0YUiAtJrkY9G5ceczDnjf",
        "note": "整合8月、9月上旬及9月下旬三批达人样本（共51篇，非全案总集），打通达人采买金额(K)、自然端曝光互动以及FS商业投流端放大效果；完全脱敏剔除任何个人住址与联系方式。",
        "category": "execution",
        "provenance": "feishu",
        "columns": [
            {"key": "stage", "title": "执行批次", "type": "string", "align": "left"},
            {"key": "kolName", "title": "达人昵称", "type": "string", "align": "left"},
            {"key": "noteId", "title": "笔记ID", "type": "string", "align": "left"},
            {"key": "contentType", "title": "内容类型", "type": "string", "align": "left"},
            {"key": "coopFormat", "title": "合作形式", "type": "string", "align": "center"},
            {"key": "tier", "title": "达人量级", "type": "string", "align": "center"},
            {"key": "kCost", "title": "K端合作金额 (元)", "type": "currency", "align": "right"},
            {"key": "publishDate", "title": "发布日期", "type": "date", "align": "center"},
            {"key": "totalSpendKfs", "title": "总消耗KFS (元)", "type": "currency", "align": "right"},
            {"key": "pgyImp", "title": "自然端曝光", "type": "number", "align": "right"},
            {"key": "pgyRead", "title": "自然端阅读", "type": "number", "align": "right"},
            {"key": "pgyEng", "title": "自然端互动", "type": "number", "align": "right"},
            {"key": "isViral", "title": "是否爆文", "type": "badge", "align": "center"},
            {"key": "pgyCpe", "title": "自然端CPE (元)", "type": "currency", "align": "right"},
            {"key": "fsSpend", "title": "FS投流消耗 (元)", "type": "currency", "align": "right"},
            {"key": "fsImp", "title": "投流展现量", "type": "number", "align": "right"},
            {"key": "fsClick", "title": "投流点击量", "type": "number", "align": "right"},
            {"key": "fsEng", "title": "投流互动量", "type": "number", "align": "right"},
            {"key": "fsCtr", "title": "投流点击率 (%)", "type": "percent", "align": "right"},
            {"key": "fsCpc", "title": "投流CPC (元)", "type": "currency", "align": "right"},
            {"key": "fsCpe", "title": "投流CPE (元)", "type": "currency", "align": "right"},
            {"key": "tiScale", "title": "TI人群规模", "type": "number", "align": "right"},
            {"key": "cpti", "title": "CPTI (元)", "type": "currency", "align": "right"},
            {"key": "externalUv", "title": "归因UV", "type": "number", "align": "right"},
            {"key": "cpuv", "title": "CPUV (元)", "type": "currency", "align": "right"}
        ],
        "rows": t3_rows
    })
    audits["kailas-kol-material-kfs-dual"] = {
        "subsheets": subsheet_audit_counts,
        "total_notes_samples": len(t3_rows),
        "total_k_cost": round(sum(r["kCost"] for r in t3_rows if r["kCost"]), 2),
        "total_fs_spend": round(sum(r["fsSpend"] for r in t3_rows if r["fsSpend"]), 2)
    }

    # Slice 4: Search Keywords Categories (zkRGHD)
    print("--- [4/5] Extracting Search Keywords Categories (zkRGHD) ---")
    blocks_kw = fetch_csv_blocks_with_retry("X7CasjHnThuFA2tPYuscN6NBnMf", "zkRGHD", "O5:Z13", "kailas-zkRGHD-cat-raw")
    t4_rows = []
    excluded_kw_rows = []
    for rnum, cols in blocks_kw:
        if not cols or len(cols) < 2:
            continue
        cat = cols[0].strip()
        if not cat or cat in ['归属', '总计', '（空白）']:
            excluded_kw_rows.append((rnum, cat))
            continue
        t4_rows.append({
            "category": cat,
            "spend": parse_clean_num(cols[1]) if len(cols) > 1 else None,
            "impressions": parse_clean_num(cols[2]) if len(cols) > 2 else None,
            "clicks": parse_clean_num(cols[3]) if len(cols) > 3 else None,
            "ctr": parse_clean_num(cols[4]) if len(cols) > 4 else None,
            "cpm": parse_clean_num(cols[5]) if len(cols) > 5 else None,
            "cpc": parse_clean_num(cols[6]) if len(cols) > 6 else None,
            "engagements": parse_clean_num(cols[7]) if len(cols) > 7 else None,
            "cpe": parse_clean_num(cols[8]) if len(cols) > 8 else None,
            "externalUv": parse_clean_num(cols[9]) if len(cols) > 9 else None,
            "cpuv": parse_clean_num(cols[10]) if len(cols) > 10 else None
        })
    tables.append({
        "id": "kailas-search-keywords-category",
        "title": "聚光搜索6大词类投放效果汇总表",
        "period": "全期累计(源表统计截止未注明)",
        "sourceId": "src-kailas-sheets-zkRGHD",
        "sourceUrl": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf?sheet=zkRGHD",
        "note": "涵盖品牌词、品类词、穿搭词、竞品词、场景词、七夕词6大词类汇总数据；原表各词类CPUV分子基于小红盟归因消费，与搜索总消费口径不同，请勿以总消费重新相除。",
        "category": "performance",
        "provenance": "feishu",
        "columns": [
            {"key": "category", "title": "关键词分类", "type": "string", "align": "left"},
            {"key": "spend", "title": "消费 (元)", "type": "currency", "align": "right"},
            {"key": "impressions", "title": "展现量 (次)", "type": "number", "align": "right"},
            {"key": "clicks", "title": "点击量 (次)", "type": "number", "align": "right"},
            {"key": "ctr", "title": "点击率 (%)", "type": "percent", "align": "right"},
            {"key": "cpm", "title": "CPM (元)", "type": "currency", "align": "right"},
            {"key": "cpc", "title": "CPC (元)", "type": "currency", "align": "right"},
            {"key": "engagements", "title": "互动量 (次)", "type": "number", "align": "right"},
            {"key": "cpe", "title": "CPE (元)", "type": "currency", "align": "right"},
            {"key": "externalUv", "title": "站外活跃UV(归因)", "type": "number", "align": "right"},
            {"key": "cpuv", "title": "CPUV (元)", "type": "currency", "align": "right"}
        ],
        "rows": t4_rows
    })
    audits["kailas-search-keywords-category"] = {
        "raw_logical_blocks": len(blocks_kw),
        "excluded_rows": excluded_kw_rows,
        "valid_categories": len(t4_rows),
        "sum_spend": round(sum(r["spend"] for r in t4_rows if r["spend"]), 2),
        "sum_clicks": sum(r["clicks"] for r in t4_rows if r["clicks"])
    }

    # Slice 5: Notes Leverage FS:K (hGgSvt)
    print("--- [5/5] Extracting Notes Leverage FS:K (hGgSvt) ---")
    blocks_lev = fetch_csv_blocks_with_retry("X7CasjHnThuFA2tPYuscN6NBnMf", "hGgSvt", "A1:F70", "kailas-hGgSvt-raw")
    t5_rows = []
    excluded_lev_rows = []
    for rnum, cols in blocks_lev:
        if rnum == 1:
            continue # Header
        if not cols or len(cols) < 5:
            continue
        kol = cols[0].strip()
        if not kol or kol == "达人昵称" or "总计" in kol:
            excluded_lev_rows.append((rnum, kol))
            continue
        k_raw = parse_clean_num(cols[1]) if len(cols) > 1 else None
        clean_url = clean_publish_url(cols[2]) if len(cols) > 2 else ""
        note_id = cols[3].strip() if len(cols) > 3 else ""
        spend = parse_clean_num(cols[4]) if len(cols) > 4 else None
        leverage = parse_clean_num(cols[5]) if len(cols) > 5 else None
        t5_rows.append({
            "kolName": kol,
            "kRawPrice": k_raw,
            "noteId": note_id,
            "publishUrl": clean_url,
            "fsSpend": spend,
            "fsKLeverage": leverage
        })
    t5_rows.sort(key=lambda x: (x["fsSpend"] or 0), reverse=True)
    tables.append({
        "id": "kailas-notes-leverage-fs-k",
        "title": "需提升消耗的达人笔记投流杠杆分析表 (65篇在跑)",
        "period": "原表批次(日报在跑笔记，统计截止未注明)",
        "sourceId": "src-kailas-sheets-hGgSvt",
        "sourceUrl": "https://yimeichuanbo.feishu.cn/sheets/X7CasjHnThuFA2tPYuscN6NBnMf?sheet=hGgSvt",
        "note": "日报附表记录在投笔记的达人裸价、投流消耗及FS:K比率；发布链接仅保留公开笔记URL路径，已剔除分享查询参数。",
        "category": "execution",
        "provenance": "feishu",
        "columns": [
            {"key": "kolName", "title": "达人昵称", "type": "string", "align": "left"},
            {"key": "kRawPrice", "title": "达人裸价 (元)", "type": "currency", "align": "right"},
            {"key": "noteId", "title": "笔记ID", "type": "string", "align": "left"},
            {"key": "publishUrl", "title": "公开笔记链接", "type": "string", "align": "left"},
            {"key": "fsSpend", "title": "投流消耗 (元)", "type": "currency", "align": "right"},
            {"key": "fsKLeverage", "title": "FS:K 杠杆比", "type": "number", "align": "right"}
        ],
        "rows": t5_rows
    })
    audits["kailas-notes-leverage-fs-k"] = {
        "raw_logical_blocks": len(blocks_lev),
        "excluded_rows": excluded_lev_rows,
        "valid_notes_count": len(t5_rows),
        "max_leverage": max((r["fsKLeverage"] for r in t5_rows if r["fsKLeverage"] is not None), default=None),
        "avg_spend": round(sum(r["fsSpend"] for r in t5_rows if r["fsSpend"]) / len(t5_rows), 2) if t5_rows else None
    }

    final_payload = {
        "projectId": "kailas",
        "extractedAt": extracted_at,
        "sources": sources,
        "tables": tables
    }

    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(final_payload, f, ensure_ascii=False, indent=2)
    print(f">>> Successfully wrote dedicated enrichment JSON to: {output_json_path}")

    with open(audit_log_path, "w", encoding="utf-8") as f:
        json.dump(audits, f, ensure_ascii=False, indent=2)
    print(f">>> Successfully wrote audit report to: {audit_log_path}")

if __name__ == "__main__":
    main()
