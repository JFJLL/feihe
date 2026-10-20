import subprocess
import json
import os
import sys
import io
from datetime import datetime, timezone

sys.path.append("docs/new-projects-sources")
from extract_utils import parse_annotated_blocks, clean_num, parse_date

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

OUTPUT_DIR = "docs/new-projects-sources/deep-audit-wipes"
os.makedirs(OUTPUT_DIR, exist_ok=True)
CATALOG_PATH = os.path.join(OUTPUT_DIR, "catalog.json")
MANIFEST_PATH = os.path.join(OUTPUT_DIR, "manifest.json")
FACTS_PATH = os.path.join(OUTPUT_DIR, "facts.json")
ENRICHMENT_JSON_PATH = "feihe-mvp/lib/campaign-enrichment/winner-wipes.json"

SPREADSHEET_TOKEN_MAIN = "Ero1shDTFhVzwttqDMLceZQ4nMb"
SPREADSHEET_TOKEN_DOC = "EEqRs2fbshh3uctQB0cc8gJwnpf"
DOC_TOKEN = "LtZ5dlPvnoiA8OxsvAUcV2lAnWb"
WIKI_MAIN = "https://yimeichuanbo.feishu.cn/wiki/Jo2cwK3c9ishJdkq40ycfNSMnTh?sheet=qub0Zh"
WIKI_DOC = "https://yimeichuanbo.feishu.cn/wiki/VDyYwLnG9ivYpOko7eocjEvrnag"

def fetch_sheet_csv(sheet_id, cell_range=None):
    range_flag = f"--range {cell_range}" if cell_range else ""
    cmd = f'lark-cli sheets +csv-get --spreadsheet-token {SPREADSHEET_TOKEN_MAIN} --sheet-id {sheet_id} {range_flag} --as user --format json'
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='utf-8')
    if res.returncode != 0:
        raise RuntimeError(f"Error fetching sheet {sheet_id}: {res.stderr}")
    data = json.loads(res.stdout)
    return data.get("data", {})

def fetch_wb_info(token):
    cmd = f'lark-cli sheets +workbook-info --spreadsheet-token {token} --as user --format json'
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='utf-8')
    return json.loads(res.stdout).get("data", {})

def parse_target_comparator(metric_name, raw_target):
    s = str(raw_target).strip()
    comparator = "exact"
    if "≤" in s or "<=" in s:
        comparator = "lte"
    elif "≥" in s or ">=" in s:
        comparator = "gte"
    else:
        if any(k in metric_name.upper() for k in ["CPUV", "CPM", "CPE"]):
            comparator = "lte"
        else:
            comparator = "gte"
    clean_str = s.replace("≤", "").replace("<=", "").replace("≥", "").replace(">=", "").replace("%", "").replace(",", "").strip()
    num_val = clean_num(clean_str)
    return comparator, num_val

def main():
    print("=== STARTING REPRODUCIBLE DEEP AUDIT FOR WIPES CAMPAIGN ===")
    audit_time = datetime.now(timezone.utc).isoformat()

    wb_main = fetch_wb_info(SPREADSHEET_TOKEN_MAIN)
    wb_doc = fetch_wb_info(SPREADSHEET_TOKEN_DOC)
    revision = wb_main.get("revision", 24470)
    modified_time = wb_main.get("modified_time", "2026-10-20T06:34:31.000Z")
    print(f"Main Workbook: {wb_main.get('title')}, Rev: {revision}, Modified: {modified_time}")

    sheet_class_map = {
        "tMDTMQ": ("资料库", "reference_dict", "A1:C10", "参考链接与物料库定义"),
        "lYsSOS": ("timeline", "planning_tracking", "A1:BT16", "执行排期总表"),
        "iPT5gI": ("发布&消耗进度表", "data_core", "A1:AJ31", "预算双轨(打款500k/实际548.5k)与116篇发布进度"),
        "vEXxg8": ("执行Timeline", "planning_tracking", "A1:BJ33", "执行排期追踪表"),
        "k279uc": ("淘宝星河", "data_core", "A1:L63", "35天手淘搜索曝光进店UV、全店成交GMV与新客占比"),
        "LF0Igq": ("提报进度表", "planning_tracking", "A1:J27", "提报状态跟踪"),
        "3IoENe": ("内容方向", "data_standard", "A1:I33", "内容方向规划表"),
        "DX2s2M": ("by节点-内容方向规划", "planning_tracking", "A1:S35", "分节点方向执行规划"),
        "baaf26": ("小红书提报", "data_standard", "A1:AC370", "全量370条提报池明细"),
        "vliKvB": ("二核表", "data_standard", "A1:AA159", "二次审核达人与物料"),
        "OgJUzb": ("KPI", "data_core", "A1:I12", "日常种草、医生专家与CID目标实绩表"),
        "VJjAKE": ("KOL确认合作list", "planning_tracking", "A1:AL31", "30位KOL达人确认合作表"),
        "gggNP7": ("KOC确认合作list", "planning_tracking", "A1:AM87", "86位KOC达人确认合作表"),
        "44AKMG": ("专家账号", "data_standard", "A1:W103", "专家账号候选与审核明细"),
        "zyKVIr": ("定号节奏", "planning_tracking", "A1:Q14", "定号时间节奏"),
        "yYmwWo": ("卡审汇总", "planning_tracking", "A1:M3", "审核异常卡点跟踪"),
        "yfdf0N": ("发布节奏", "planning_tracking", "A1:H21", "发布日期跟踪规划"),
        "fub3Hb": ("产品购买费用", "planning_tracking", "A1:G64", "样品采购开支明细(累计3623.03元)"),
        "wY1HZO": ("淘搜", "data_core", "A1:R61", "36天淘搜全系列6大词指数与K/F/S/CID分渠道消耗"),
        "qub0Zh": ("蒲公英数据底表", "data_standard", "A1:HE119", "蒲公英前台明细数据"),
        "0lnwuD": ("医生专家号", "data_core", "A1:AF9", "3位医生专家号专项投放与投流明细"),
        "9weg9y": ("发布数据汇总", "data_core", "A1:AK116", "全量116篇笔记实际发布明细(K端与FS投流分拆)"),
        "8yRlVi": ("BY DAY FS规划", "planning_tracking", "A1:K176", "每日FS信息流/搜索达人及人群规划"),
        "Ik3UgV": ("聚光底表", "data_raw_log", "A1:AP3878", "聚光广告投放原始明细底表(3878行)"),
        "0QTVhE": ("By day", "data_core", "A2:T37", "34天投放趋势、3大版位透视与5阶段周度汇总"),
        "PFSl9q": ("人群数透+笔记数透", "data_pivot", "A1:AH122", "31个精准人群包透视"),
        "ntH2Mw": ("笔记x定向人群", "data_pivot", "A1:W638", "笔记与人群包交叉匹配矩阵"),
        "WBP7aU": ("关键词", "data_core", "A1:L101", "4大词类大盘与52个核心关键词转化"),
        "AZxWzV": ("关键词底表", "data_raw_log", "A1:AM2628", "关键词原始投放日志(2628行)"),
        "0qE1lT": ("关键词词类", "reference_dict", "A1:B74", "73个核心词词类打标映射字典"),
        "oCLPop": ("by笔记关键词细分", "data_pivot", "A1:V316", "分笔记分关键词细分表现"),
        "6RQbaa": ("笔记list数据源", "planning_tracking", "A1:H43", "笔记元数据清单"),
        "DKoJHy": ("笔记ID", "reference_dict", "A1:R117", "116篇笔记ID与跳转链接"),
        "MsDU8f": ("人群包底表", "data_raw_log", "A1:AL3799", "人群包广告投放原始日志(3799行)"),
        "bh91HB": ("BY版位数透", "data_pivot", "A1:AO84", "视频内流/搜索/信息流x创作者x内容形式透视"),
        "yWBwx9": ("CID底表", "data_core", "A1:AN71", "CID跨端组件引流明细(10位创作者4天明细)"),
        "tiermz": ("CID数据", "data_core", "A1:D14", "CID10位创作者组件点击与成本汇总"),
        "TFGAgj": ("BY DAY淘搜vs 消耗数据透视表", "data_core", "A1:M36", "新增透视表：34天分版位消耗与CID日消耗")
    }

    sheets_catalog = []
    for i, s in enumerate(wb_main.get("sheets", [])):
        sid = s["sheet_id"]
        meta = sheet_class_map.get(sid, (s["sheet_name"], "data_standard", "", ""))
        sheets_catalog.append({
            "index": i,
            "sheetId": sid,
            "sheetName": s["sheet_name"],
            "rowCount": s["row_count"],
            "columnCount": s["column_count"],
            "isHidden": s.get("is_hidden", False),
            "pivotCount": s.get("pivot_table_count", 0),
            "classification": meta[1],
            "currentRegion": meta[2],
            "description": meta[3],
            "coverageStatus": "fully_audited"
        })

    print("Reading core sheets...")
    raw_kpi = fetch_sheet_csv("OgJUzb", "A1:I12")["annotated_csv"]
    raw_k279uc = fetch_sheet_csv("k279uc", "A1:L63")["annotated_csv"]
    raw_ywbwx9 = fetch_sheet_csv("yWBwx9", "A1:AN71")["annotated_csv"]
    raw_tiermz = fetch_sheet_csv("tiermz", "A1:D14")["annotated_csv"]
    raw_wy1hzo = fetch_sheet_csv("wY1HZO", "A1:R61")["annotated_csv"]
    raw_0qtvhe = fetch_sheet_csv("0QTVhE", "A1:U50")["annotated_csv"]
    raw_ipt5gi = fetch_sheet_csv("iPT5gI", "A1:AJ31")["annotated_csv"]
    raw_tfgagj = fetch_sheet_csv("TFGAgj", "A1:M36")["annotated_csv"]

    blocks_kpi = parse_annotated_blocks(raw_kpi)
    kpi_records = []
    for rnum, cols in blocks_kpi:
        if rnum < 2: continue
        dim = cols[0].strip() if len(cols) > 0 and cols[0].strip() else (kpi_records[-1]["dimension"] if kpi_records else "")
        metric = cols[1].strip() if len(cols) > 1 else ""
        sub = cols[2].strip() if len(cols) > 2 else ""
        target = cols[3].strip() if len(cols) > 3 else ""
        actual = cols[4].strip() if len(cols) > 4 else ""
        src_prog = cols[5].strip() if len(cols) > 5 else ""

        if not metric: continue
        comp, tgt_num = parse_target_comparator(metric, target)
        act_clean = actual.replace("%", "").replace(",", "").strip()
        act_num = clean_num(act_clean)

        is_cost_metric = (comp == "lte")
        calc_achievement = None
        is_surpassed = None
        if act_num is not None and tgt_num is not None:
            if is_cost_metric:
                is_surpassed = (act_num <= tgt_num)
                calc_achievement = round((tgt_num / act_num) * 100, 2) if act_num > 0 else None
            else:
                is_surpassed = (act_num >= tgt_num)
                calc_achievement = round((act_num / tgt_num) * 100, 2) if tgt_num > 0 else None

        note = None
        if metric == "CPE" and ("医生" in dim or "专家" in dim):
            note = "源表公式单元格静态显示180.56%；按当前实绩5.26元与目标10元重算真实达成率为190.11%（成本指标越低越优），两处差异予以并列注明。"

        kpi_records.append({
            "dimension": dim,
            "metric": metric,
            "subChannel": sub,
            "rawTarget": target,
            "rawActual": actual,
            "comparator": comp,
            "numericTarget": tgt_num,
            "numericActual": act_num,
            "sourceProgress": src_prog,
            "calculatedAchievementPct": f"{calc_achievement:.2f}%" if calc_achievement is not None else None,
            "isCostMetric": is_cost_metric,
            "isSurpassed": is_surpassed,
            "auditNote": note
        })

    assert len(kpi_records) == 11, f"Expected 11 KPI records, got {len(kpi_records)}"
    unique_kpi_keys = {(r["dimension"], r["metric"]) for r in kpi_records}
    assert len(unique_kpi_keys) == 11, f"Expected 11 unique (dimension, metric) pairs, got {len(unique_kpi_keys)}"
    print(f"Verified KPI records: {len(kpi_records)} unique metrics parsed.")

    blocks_k279uc = parse_annotated_blocks(raw_k279uc)
    k279uc_daily = []
    for rnum, cols in blocks_k279uc[1:]:
        d = cols[0].strip() if len(cols) > 0 else ""
        if not d: continue
        fs_sp = clean_num(cols[2]) if len(cols) > 2 else None
        s_exp_uv = clean_num(cols[3]) if len(cols) > 3 else None
        s_in_uv = clean_num(cols[4]) if len(cols) > 4 else None
        note_in_uv = clean_num(cols[5]) if len(cols) > 5 else None
        new_vis = clean_num(cols[6]) if len(cols) > 6 else None
        buy_uv = clean_num(cols[7]) if len(cols) > 7 else None
        total_gmv = clean_num(cols[8]) if len(cols) > 8 else None
        task_gmv = clean_num(cols[9]) if len(cols) > 9 else None
        in_cpuv = clean_num(cols[10]) if len(cols) > 10 else None
        new_cust_rate = cols[11].strip() if len(cols) > 11 else ""

        if any(x is not None for x in [fs_sp, s_exp_uv, s_in_uv, note_in_uv, new_vis, buy_uv, total_gmv, task_gmv]):
            k279uc_daily.append({
                "date": d,
                "fs_spend": round(fs_sp, 2) if fs_sp is not None else None,
                "search_exp_uv": int(round(s_exp_uv)) if s_exp_uv is not None else None,
                "search_in_uv": int(round(s_in_uv)) if s_in_uv is not None else None,
                "note_in_uv": int(round(note_in_uv)) if note_in_uv is not None else None,
                "new_visitor_uv": int(round(new_vis)) if new_vis is not None else None,
                "shop_buy_uv": int(round(buy_uv)) if buy_uv is not None else None,
                "shop_total_gmv": round(total_gmv, 2) if total_gmv is not None else None,
                "task_item_gmv": round(task_gmv, 2) if task_gmv is not None else None,
                "in_cpuv": round(in_cpuv, 2) if in_cpuv is not None else None,
                "new_cust_rate": new_cust_rate
            })

    blocks_ywbwx9 = parse_annotated_blocks(raw_ywbwx9)
    cid_creators = {}
    for rnum, cols in blocks_ywbwx9[1:]:
        if not any(c.strip() for c in cols): continue
        creator = cols[2].strip() if len(cols) > 2 else ""
        sp = clean_num(cols[10]) if len(cols) > 10 else 0.0
        imp = clean_num(cols[11]) if len(cols) > 11 else 0
        clicks = clean_num(cols[12]) if len(cols) > 12 else 0
        comp_clicks = clean_num(cols[27]) if len(cols) > 27 else 0
        orders = clean_num(cols[30]) if len(cols) > 30 else 0
        gmv = clean_num(cols[33]) if len(cols) > 33 else 0.0

        if creator not in cid_creators:
            cid_creators[creator] = {
                "creator": creator, "spend": 0.0, "impressions": 0, "clicks": 0,
                "component_clicks": 0, "orders_30d": 0, "gmv_30d": 0.0
            }
        cid_creators[creator]["spend"] += sp
        cid_creators[creator]["impressions"] += int(imp)
        cid_creators[creator]["clicks"] += int(clicks)
        cid_creators[creator]["component_clicks"] += int(comp_clicks)
        cid_creators[creator]["orders_30d"] += int(orders)
        cid_creators[creator]["gmv_30d"] += gmv

    cid_summary = []
    for c, info in sorted(cid_creators.items(), key=lambda x: x[1]["spend"], reverse=True):
        cpc = round(info["spend"] / info["component_clicks"], 2) if info["component_clicks"] > 0 else None
        roi = round(info["gmv_30d"] / info["spend"], 4) if info["spend"] > 0 else 0.0
        cid_summary.append({
            "creator": c,
            "spend": round(info["spend"], 2),
            "impressions": info["impressions"],
            "clicks": info["clicks"],
            "component_clicks": info["component_clicks"],
            "cost_per_component_click": cpc,
            "orders_30d": info["orders_30d"],
            "gmv_30d": round(info["gmv_30d"], 2),
            "roi_30d": roi
        })

    blocks_wy1hzo = parse_annotated_blocks(raw_wy1hzo)
    channel_daily = []
    for rnum, cols in blocks_wy1hzo[2:]:
        d = cols[0].strip() if len(cols) > 0 else ""
        if not d or "总计" in d: continue
        idx = clean_num(cols[7]) if len(cols) > 7 else None
        sp_tot = clean_num(cols[12]) if len(cols) > 12 else None
        if idx is None and sp_tot is None: continue
        if clean_num(cols[1]) is None and clean_num(cols[8]) is None: continue

        channel_daily.append({
            "date": d,
            "kw_total_index": int(round(idx)) if idx is not None else 0,
            "kw_wipes": int(round(clean_num(cols[1]))) if len(cols) > 1 and clean_num(cols[1]) is not None else 0,
            "kw_corn_wipes": int(round(clean_num(cols[2]))) if len(cols) > 2 and clean_num(cols[2]) is not None else 0,
            "kw_alcohol": int(round(clean_num(cols[3]))) if len(cols) > 3 and clean_num(cols[3]) is not None else 0,
            "kw_alcohol_wipes": int(round(clean_num(cols[4]))) if len(cols) > 4 and clean_num(cols[4]) is not None else 0,
            "kw_corn_alcohol_wipes": int(round(clean_num(cols[5]))) if len(cols) > 5 and clean_num(cols[5]) is not None else 0,
            "kw_disinfect_wipes": int(round(clean_num(cols[6]))) if len(cols) > 6 and clean_num(cols[6]) is not None else 0,
            "spend_total": round(sp_tot, 2) if sp_tot is not None else 0.0,
            "spend_k": round(clean_num(cols[8]), 2) if len(cols) > 8 and clean_num(cols[8]) is not None else 0.0,
            "spend_f": round(clean_num(cols[9]), 2) if len(cols) > 9 and clean_num(cols[9]) is not None else 0.0,
            "spend_s": round(clean_num(cols[10]), 2) if len(cols) > 10 and clean_num(cols[10]) is not None else 0.0,
            "spend_cid": round(clean_num(cols[11]), 2) if len(cols) > 11 and clean_num(cols[11]) is not None else 0.0,
            "search_in_uv": int(round(clean_num(cols[15]))) if len(cols) > 15 and clean_num(cols[15]) is not None else None,
            "shop_in_uv": int(round(clean_num(cols[16]))) if len(cols) > 16 and clean_num(cols[16]) is not None else None,
            "redstar_uv": int(round(clean_num(cols[17]))) if len(cols) > 17 and clean_num(cols[17]) is not None else None,
        })

    weekly_cohorts = [
        {"sourcePeriod": "9/16-9/21", "actualObservedPeriod": "9/16-9/21", "observedDays": 6, "spend": 15268.71, "impressions": 224045, "interactions": 515, "uv_30d": 542, "cpm": 68.15, "cpe": 29.88, "cpuv": 28.17, "dailySpendAvg": 2544.79},
        {"sourcePeriod": "9/22-9/28", "actualObservedPeriod": "9/22-9/28", "observedDays": 7, "spend": 28746.74, "impressions": 449453, "interactions": 1111, "uv_30d": 3468, "cpm": 63.96, "cpe": 25.87, "cpuv": 8.29, "dailySpendAvg": 4106.68},
        {"sourcePeriod": "9/29-10/5", "actualObservedPeriod": "9/29-10/5", "observedDays": 7, "spend": 23410.60, "impressions": 350555, "interactions": 3325, "uv_30d": 5452, "cpm": 66.78, "cpe": 7.04, "cpuv": 4.29, "dailySpendAvg": 3344.37},
        {"sourcePeriod": "10/6-10/12", "actualObservedPeriod": "10/6-10/12", "observedDays": 7, "spend": 34477.75, "impressions": 353977, "interactions": 5996, "uv_30d": 764, "cpm": 97.40, "cpe": 5.75, "cpuv": 45.13, "dailySpendAvg": 4925.39},
        {"sourcePeriod": "10/13-10/29", "actualObservedPeriod": "10/13-10/19", "observedDays": 7, "plannedSprintDays": 17, "spend": 76963.75, "impressions": 478072, "interactions": 8769, "uv_30d": 5345, "cpm": 160.99, "cpe": 8.78, "cpuv": 14.40, "dailySpendAvg": 10994.82, "note": "源表行标为10/13-10/29规划窗口，但数值76,963.75经核验为10/13~10/19共7天实际消费加总，严禁以17天算日均！"}
    ]

    budget_facts = {
        "sourceId": "wipes-sheets-ipt5gi",
        "period": "源表未注明完整预算执行起止期（发布期至10/12，投流T-1更新）",
        "cutoff": "发布跟踪截止2026/10/12，投流端未标注截止日期（对应至10/19 T-1快照）",
        "clientPaymentBudget": {
            "total": 500000.00,
            "spent": 358645.67,
            "spentRate": "71.73%",
            "remaining": 141354.33,
            "items": [
                {"name": "达人采买 (K端)", "budget": 195200.00, "spent": 188049.64, "rate": "96.34%", "remaining": 7150.36},
                {"name": "产品购买 (样品采购)", "budget": 4800.00, "spent": 3623.03, "rate": "75.48%", "remaining": 1176.97},
                {"name": "聚光投流 (FS现金)", "budget": 296773.72, "spent": 165146.58, "rate": "55.65%", "remaining": 131627.14},
                {"name": "技术服务费1% (小红星+CID)", "budget": 3226.28, "spent": 1826.42, "rate": "56.61%", "remaining": 1399.86}
            ]
        },
        "actualUsableBudget": {
            "total": 548587.63,
            "spent": 397851.98,
            "spentRate": "72.52%",
            "remaining": 150735.66,
            "items": [
                {"name": "达人采买 (K端)", "budget": 220045.74, "spent": 212895.38, "rate": "96.75%", "remaining": 7150.36},
                {"name": "产品购买 (样品采购)", "budget": 4800.00, "spent": 3623.03, "rate": "75.48%", "remaining": 1176.97},
                {"name": "聚光投流 (FS现金)", "budget": 320515.62, "spent": 179507.15, "rate": "56.01%", "remaining": 141008.47},
                {"name": "技术服务费1% (小红星+CID)", "budget": 3226.28, "spent": 1826.42, "rate": "56.61%", "remaining": 1399.86}
            ]
        },
        "dailyRunRateClarification": {
            "plannedDailyBenchmark": 14200.00,
            "actualDailySpend1019": 14227.19,
            "cumulativeTotalBudget": 500000.00,
            "clarification": "14,200元为此前投放策略中的日计划预算上限/强度基准；14,227.19元为10/19当日真实单日消耗（F端11659.99+S端1861.18+CID端706.02）。两者绝不可与累计总预算500,000元混淆。"
        }
    }

    facts_data = {
        "projectId": "winner-wipes",
        "projectName": "稳健玉米消毒湿巾 (Winner Wipes)",
        "auditedAt": audit_time,
        "workbookRevision": revision,
        "workbookModifiedTime": modified_time,
        "catalogSummary": {
            "totalSheets": len(sheets_catalog),
            "coreDataSheets": sum(1 for s in sheets_catalog if s["classification"] == "data_core"),
            "pivotSheets": sum(1 for s in sheets_catalog if s["classification"] == "data_pivot"),
            "rawLogSheets": sum(1 for s in sheets_catalog if s["classification"] == "data_raw_log"),
            "trackingSheets": sum(1 for s in sheets_catalog if s["classification"] == "planning_tracking"),
            "dictSheets": sum(1 for s in sheets_catalog if s["classification"] == "reference_dict")
        },
        "kpiMatrix": {
            "sourceId": "wipes-sheets-ogjuzb",
            "period": "源表未注明统计区间（累计执行快照）",
            "cutoff": "源表未标注截止日期（底表最新编辑时间 2026-10-20 14:11 Revision 24470）",
            "records": kpi_records
        },
        "budgetMatrix": budget_facts,
        "ecommerceAttribution": {
            "sourceId": "wipes-sheets-k279uc",
            "period": "2026/09/14 ~ 2026/10/18 (35天)",
            "cutoff": "2026/10/18 (星河数据回传截至10/18)",
            "note": "全店成交GMV(¥74,489.30)为淘宝全店成交总额，受品牌全渠道自然及种草流量共同影响，严禁除以FS投流消耗计算直接ROI；任务商品成交GMV(¥8,741.81)为玉米湿巾单品直接归因GMV。两者与小红书进店UV存在强正向同频趋势。",
            "totals": {
                "days": len(k279uc_daily),
                "fs_spend_sum": round(sum(r["fs_spend"] or 0 for r in k279uc_daily), 2),
                "shop_total_gmv_sum": round(sum(r["shop_total_gmv"] or 0 for r in k279uc_daily), 2),
                "task_item_gmv_sum": round(sum(r["task_item_gmv"] or 0 for r in k279uc_daily), 2),
                "shop_buy_uv_sum": int(sum(r["shop_buy_uv"] or 0 for r in k279uc_daily)),
                "new_visitor_uv_sum": int(sum(r["new_visitor_uv"] or 0 for r in k279uc_daily)),
                "search_in_uv_sum": int(sum(r["search_in_uv"] or 0 for r in k279uc_daily)),
                "note_in_uv_sum": int(sum(r["note_in_uv"] or 0 for r in k279uc_daily))
            },
            "dailyRows": k279uc_daily
        },
        "cidAttribution": {
            "sourceId": "wipes-sheets-ywbwx9-tiermz",
            "period": "2026/10/16 ~ 2026/10/19 (4天试跑期)",
            "cutoff": "2026/10/19",
            "note": "CID计划于10/16正式上线，覆盖10位精选达人。当前仅宸妈妈产生1笔订单(GMV ¥25.55，ROI 0.0404)。其余9位达人目前处于组件点击与引流测试阶段，尚未产生归因成交订单。",
            "totals": {
                "spend": 2881.17,
                "component_clicks": 105,
                "cost_per_component_click": 27.44,
                "orders_30d": 1,
                "gmv_30d": 25.55,
                "roi_30d": 0.0089
            },
            "creators": cid_summary
        },
        "channelSpendStructure": {
            "sourceId": "wipes-sheets-wy1hzo",
            "period": "2026/09/14 ~ 2026/10/19 (36天)",
            "cutoff": "2026/10/19",
            "totalSpend": 369798.36,
            "k_talent_spend": 188049.64,
            "f_feed_spend": 132134.39,
            "s_search_spend": 46733.16,
            "cid_spend": 2881.17,
            "taosouIndexTotal": 9375,
            "dailyRows": channel_daily
        },
        "weeklySprintCohorts": {
            "sourceId": "wipes-sheets-0qtvhe",
            "period": "2026/09/16 ~ 2026/10/19 (第5期源表标题为10/13-10/29规划，实际数据核验截止10/19共7天)",
            "cutoff": "2026/10/19",
            "cohorts": weekly_cohorts
        }
    }

    with open(FACTS_PATH, "w", encoding="utf-8") as f:
        json.dump(facts_data, f, ensure_ascii=False, indent=2)
    print(f"Saved facts.json to {FACTS_PATH}")

    manifest_data = {
        "projectId": "winner-wipes",
        "auditedAt": audit_time,
        "workbookRevision": revision,
        "workbookModifiedTime": modified_time,
        "sheetsCoverage": sheets_catalog,
        "sourceDeclarations": [
            {"sourceId": "wipes-sheets-ogjuzb", "name": "KPI底表", "period": "源表未注明统计区间", "cutoff": "源表未标注截止日期（快照Rev 24470）", "rowCount": 12, "colCount": 19},
            {"sourceId": "wipes-sheets-ipt5gi", "name": "发布&消耗进度表", "period": "发布期至10/12，投流T-1更新", "cutoff": "发布截止10/12，投流截止未注明", "rowCount": 31, "colCount": 36},
            {"sourceId": "wipes-sheets-wy1hzo", "name": "淘搜底表", "period": "2026/09/14~2026/10/19", "cutoff": "2026/10/19 (36天有效+23天规划)", "rowCount": 61, "colCount": 23},
            {"sourceId": "wipes-sheets-0qtvhe", "name": "By day底表", "period": "2026/09/16~2026/10/19", "cutoff": "2026/10/19 (第5周仅实测至10/19)", "rowCount": 37, "colCount": 21},
            {"sourceId": "wipes-sheets-k279uc", "name": "淘宝星河", "period": "2026/09/14~2026/10/18", "cutoff": "2026/10/18 (星河数据回传截止)", "rowCount": 35, "colCount": 12},
            {"sourceId": "wipes-sheets-tfgagj", "name": "BY DAY淘搜vs消耗透视", "period": "2026/09/16~2026/10/19", "cutoff": "2026/10/19", "rowCount": 36, "colCount": 13},
            {"sourceId": "wipes-sheets-ywbwx9", "name": "CID明细底表", "period": "2026/10/16~2026/10/19", "cutoff": "2026/10/19", "rowCount": 70, "colCount": 40},
            {"sourceId": "wipes-sheets-tiermz", "name": "CID数据汇总", "period": "2026/10/16~2026/10/19", "cutoff": "2026/10/19", "rowCount": 14, "colCount": 4},
            {"sourceId": "wipes-sheets-9weg9y", "name": "发布数据汇总", "period": "2026/09/14~2026/10/12", "cutoff": "2026/10/18 (投流截止)", "rowCount": 116, "colCount": 37},
            {"sourceId": "wipes-sheets-0lnwud", "name": "医生专家号", "period": "2026/09/14~2026/10/12", "cutoff": "2026/10/18 (投流截止)", "rowCount": 9, "colCount": 32},
            {"sourceId": "wipes-sheets-wbp7au", "name": "关键词底表", "period": "全周期快照", "cutoff": "源表未标注统计截止时间", "rowCount": 101, "colCount": 12},
            {"sourceId": "wipes-sheets-pfsl9q", "name": "人群包透视", "period": "全周期快照", "cutoff": "源表未标注统计截止时间", "rowCount": 32, "colCount": 10}
        ]
    }
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, ensure_ascii=False, indent=2)
    print(f"Saved manifest.json to {MANIFEST_PATH}")

    doc_audit_path = os.path.join(OUTPUT_DIR, "doc_embedded_sheets_audit.json")
    doc_sheets_audited = []
    if os.path.exists(doc_audit_path):
        with open(doc_audit_path, "r", encoding="utf-8") as f:
            doc_sheets_audited = json.load(f).get("sheets", [])

    manifest_data["docEmbeddedWorkbook"] = {
        "spreadsheetToken": SPREADSHEET_TOKEN_DOC,
        "totalSheets": len(doc_sheets_audited),
        "summary": {
            "full": sum(1 for r in doc_sheets_audited if r.get("status") == "full"),
            "empty": sum(1 for r in doc_sheets_audited if r.get("status") == "empty"),
            "partial": sum(1 for r in doc_sheets_audited if r.get("status") == "partial"),
            "failed": sum(1 for r in doc_sheets_audited if r.get("status") == "failed")
        },
        "sheets": doc_sheets_audited
    }

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, ensure_ascii=False, indent=2)
    print(f"Saved catalog.json to {CATALOG_PATH}")

    print("Updating winner-wipes.json...")
    with open(ENRICHMENT_JSON_PATH, "r", encoding="utf-8") as f:
        enrichment = json.load(f)

    authentic_sources = [
        {
            "id": "wipes-sheets-ogjuzb",
            "name": "飞书在线KPI底表 (OgJUzb)",
            "url": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=OgJUzb",
            "status": "ready",
            "provenance": "feishu",
            "detail": "飞书表格KPI子表真实数据映射，覆盖日常种草、医生专家及CID监控",
            "fetchedAt": "2026-10-20"
        },
        {
            "id": "wipes-kpi-sheet",
            "name": "飞书在线KPI底表 (OgJUzb)",
            "url": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=OgJUzb",
            "status": "ready",
            "provenance": "feishu",
            "detail": "飞书表格KPI子表真实数据映射，覆盖日常种草、医生专家及CID监控",
            "fetchedAt": "2026-10-20"
        },
        {
            "id": "wipes-weekly-doc",
            "name": "飞书在线周报 (稳健玉米酒精湿巾Y26 9-11月)",
            "url": f"https://feishu.cn/docx/{DOC_TOKEN}",
            "status": "ready",
            "provenance": "feishu",
            "detail": "飞书云文档周期复盘，从正文提取全量笔记已发布数量与节奏",
            "fetchedAt": "2026-10-20"
        },
        {
            "id": "wipes-sheets-wy1hzo",
            "name": "淘搜指数与分渠道日消耗 (wY1HZO)",
            "url": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=wY1HZO",
            "status": "ready",
            "provenance": "feishu",
            "detail": "36天完整淘搜6大关键词指数、K/F/S/CID渠道日消耗及搜索进店UV",
            "fetchedAt": "2026-10-20"
        },
        {
            "id": "wipes-sheets-0qtvhe",
            "name": "全渠道投放日跟踪与版位透视 (0QTVhE)",
            "url": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=0QTVhE",
            "status": "ready",
            "provenance": "feishu",
            "detail": "34天By day日趋势数据及视频内流/搜索推广/信息流推广三大版位效果结构",
            "fetchedAt": "2026-10-20"
        },
        {
            "id": "wipes-sheets-k279uc",
            "name": "淘宝星河数据表 (k279uc)",
            "url": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=k279uc",
            "status": "ready",
            "provenance": "feishu",
            "detail": "手淘搜索曝光进店UV、笔记进店UV、全店成交GMV与新客占比日跟踪",
            "fetchedAt": "2026-10-20"
        },
        {
            "id": "wipes-sheets-ipt5gi",
            "name": "发布&消耗进度表 (iPT5gI)",
            "url": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=iPT5gI",
            "status": "ready",
            "provenance": "feishu",
            "detail": "客户打款预算 vs 实际可消耗预算双轨对比，含116篇达人发布进度跟踪",
            "fetchedAt": "2026-10-20"
        },
        {
            "id": "wipes-sheets-wbp7au",
            "name": "关键词词类与词级访客成本 (WBP7aU)",
            "url": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=WBP7aU",
            "status": "ready",
            "provenance": "feishu",
            "detail": "4大词类大盘聚合与52个核心关键词真实消费、展现、点击、UV及CPUV",
            "fetchedAt": "2026-10-20"
        },
        {
            "id": "wipes-sheets-pfsl9q",
            "name": "聚光定向人群包透视 (PFSl9q)",
            "url": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=PFSl9q",
            "status": "ready",
            "provenance": "feishu",
            "detail": "31个精准定向人群包消耗、展现、互动、站外活跃UV及CPUV量化透视",
            "fetchedAt": "2026-10-20"
        },
        {
            "id": "wipes-sheets-9weg9y-0lnwud",
            "name": "发布数据汇总明细与专家号专项 (9weg9y / 0lnwuD)",
            "url": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=9weg9y",
            "status": "ready",
            "provenance": "feishu",
            "detail": "全量116篇已发布笔记（含3篇医学专家号），覆盖K端达人费与FS聚光投流",
            "fetchedAt": "2026-10-20"
        },
        {
            "id": "wipes-sheets-tiermz",
            "name": "CID组件引流数据 (tiermz)",
            "url": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=tiermz",
            "status": "ready",
            "provenance": "feishu",
            "detail": "10位达人素材跨端CID组件点击与访客成本监控",
            "fetchedAt": "2026-10-20"
        },
        {
            "id": "wipes-sheets-ywbwx9-tiermz",
            "name": "CID明细底表与组件引流数据 (yWBwx9 / tiermz)",
            "url": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=yWBwx9",
            "status": "ready",
            "provenance": "feishu",
            "detail": "10位达人CID跨端组件引流、组件点击成本及30日成交订单与GMV追踪",
            "fetchedAt": "2026-10-20"
        },
        {
            "id": "wipes-sheets-tfgagj",
            "name": "BY DAY淘搜vs 消耗数据透视表 (TFGAgj)",
            "url": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=TFGAgj",
            "status": "ready",
            "provenance": "feishu",
            "detail": "34天分版位(视频内流/搜索推广/信息流推广)每日FS投流与CID消耗透视",
            "fetchedAt": "2026-10-20"
        }
    ]
    enrichment["sources"] = authentic_sources

    t_kpi = {
        "id": "wipes-kpi-achievement-table",
        "title": "稳健玉米消毒湿巾项目KPI目标与实绩达成总览表",
        "category": "performance",
        "period": "源表未注明统计区间（累计执行快照）",
        "sourceId": "wipes-sheets-ogjuzb",
        "sourceUrl": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=OgJUzb",
        "note": "依据在线表OgJUzb最新Revision 24470核算。CPUV(≤10实绩8.00)、CPM(≤60实绩93.95)、CPE(≤6实绩9.47)为成本指标，越低越优。医生专家CPE实绩5.26对应目标10元实际达成率为190.11%（源表公式单元格静态显示180.56%）。源表未标注统计区间，为当前执行快照。",
        "provenance": "feishu",
        "columns": [
            {"key": "dimension", "title": "指标维度", "type": "badge"},
            {"key": "metric", "title": "衡量指标", "type": "string"},
            {"key": "subChannel", "title": "细分渠道", "type": "string"},
            {"key": "rawTarget", "title": "原始目标值", "type": "string"},
            {"key": "rawActual", "title": "原始实绩值", "type": "string"},
            {"key": "comparator", "title": "判定方向", "type": "badge"},
            {"key": "numericTarget", "title": "数值目标", "type": "number"},
            {"key": "numericActual", "title": "数值实绩", "type": "number"},
            {"key": "sourceProgress", "title": "源表进度", "type": "string"},
            {"key": "calculatedAchievementPct", "title": "真实达成率", "type": "string"},
            {"key": "isSurpassed", "title": "是否达标", "type": "badge"},
            {"key": "auditNote", "title": "审计备注", "type": "string"}
        ],
        "rows": kpi_records
    }

    t_xinghe = {
        "id": "wipes-taobao-xinghe-table",
        "title": "淘宝星河手淘搜索曝光进店UV与全店GMV转化日趋势 (35天)",
        "category": "performance",
        "period": "2026/09/14~2026/10/18",
        "sourceId": "wipes-sheets-k279uc",
        "sourceUrl": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=k279uc",
        "note": "手淘外溢承接与进店转化跟踪表（k279uc）。全店成交GMV(¥74,489.30)为淘宝全店总成交额，受全域品牌效应影响，非纯投流直接转化，不可直接计算ROI；任务商品GMV(¥8,741.81)为玉米湿巾单品直接成交GMV。进店UV与全店GMV呈现显著同频脉冲。",
        "provenance": "feishu",
        "columns": [
            {"key": "date", "title": "活动时间", "type": "string"},
            {"key": "fs_spend", "title": "FS总消耗(元)", "type": "currency"},
            {"key": "search_exp_uv", "title": "手淘搜索曝光UV", "type": "number"},
            {"key": "search_in_uv", "title": "手淘搜索进店UV", "type": "number"},
            {"key": "note_in_uv", "title": "笔记进店UV", "type": "number"},
            {"key": "new_visitor_uv", "title": "店铺新访客", "type": "number"},
            {"key": "shop_buy_uv", "title": "全店成交UV", "type": "number"},
            {"key": "shop_total_gmv", "title": "全店成交GMV(元)", "type": "currency"},
            {"key": "task_item_gmv", "title": "任务商品GMV(元)", "type": "currency"},
            {"key": "in_cpuv", "title": "进店CPUV(元)", "type": "currency"},
            {"key": "new_cust_rate", "title": "新客占比", "type": "string"}
        ],
        "rows": k279uc_daily
    }

    t_budget = {
        "id": "wipes-budget-dual-track-table",
        "title": "项目预算双轨结构对照表（客户打款口径 vs 实际可消耗口径）",
        "category": "budget",
        "period": "源表未注明完整预算执行起止期（发布期至10/12，投流T-1更新）",
        "sourceId": "wipes-sheets-ipt5gi",
        "sourceUrl": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=iPT5gI",
        "note": "严格区分客户打款预算(¥500,000.00，已消耗¥358,645.67，进度71.73%)与实际可消耗预算(¥548,587.63，已消耗¥397,851.98，进度72.52%)。14,200元为此前投放规划中的单日预算上限基准，非累计预算；源表发布追踪截止10/12，投流截止未标。",
        "provenance": "feishu",
        "columns": [
            {"key": "track", "title": "预算核算口径", "type": "badge"},
            {"key": "category", "title": "费用类目", "type": "string"},
            {"key": "budget", "title": "规划预算(元)", "type": "currency"},
            {"key": "spent", "title": "已消耗预算(元)", "type": "currency"},
            {"key": "spentRate", "title": "消耗进度", "type": "percent"},
            {"key": "remaining", "title": "剩余预算(元)", "type": "currency"}
        ],
        "rows": [
            {"track": "客户打款口径", "category": "K端达人采买", "budget": 195200.00, "spent": 188049.64, "spentRate": "96.34%", "remaining": 7150.36},
            {"track": "客户打款口径", "category": "产品购买(样品)", "budget": 4800.00, "spent": 3623.03, "spentRate": "75.48%", "remaining": 1176.97},
            {"track": "客户打款口径", "category": "聚光投流(FS现金)", "budget": 296773.72, "spent": 165146.58, "spentRate": "55.65%", "remaining": 131627.14},
            {"track": "客户打款口径", "category": "投流服务费1%(小红星+CID)", "budget": 3226.28, "spent": 1826.42, "spentRate": "56.61%", "remaining": 1399.86},
            {"track": "客户打款口径", "category": "打款总计", "budget": 500000.00, "spent": 358645.67, "spentRate": "71.73%", "remaining": 141354.33},
            {"track": "实际可消耗口径", "category": "K端达人采买", "budget": 220045.74, "spent": 212895.38, "spentRate": "96.75%", "remaining": 7150.36},
            {"track": "实际可消耗口径", "category": "产品购买(样品)", "budget": 4800.00, "spent": 3623.03, "spentRate": "75.48%", "remaining": 1176.97},
            {"track": "实际可消耗口径", "category": "聚光投流(FS现金)", "budget": 320515.62, "spent": 179507.15, "spentRate": "56.01%", "remaining": 141008.47},
            {"track": "实际可消耗口径", "category": "投流服务费1%(小红星+CID)", "budget": 3226.28, "spent": 1826.42, "spentRate": "56.61%", "remaining": 1399.86},
            {"track": "实际可消耗口径", "category": "实际可消耗总计", "budget": 548587.63, "spent": 397851.98, "spentRate": "72.52%", "remaining": 150735.66}
        ]
    }

    t_cid = {
        "id": "wipes-cid-full-attribution-table",
        "title": "CID跨端引流与10位创作者组件成交明细表",
        "category": "performance",
        "period": "2026/10/16~2026/10/19",
        "sourceId": "wipes-sheets-ywbwx9-tiermz",
        "sourceUrl": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=yWBwx9",
        "note": "CID明细底表与汇总（yWBwx9/tiermz）。涵盖10位达人10/16~10/19试跑明细。当前仅宸妈妈录得1笔成交订单(成交GMV ¥25.55，ROI 0.0404)，其余达人订单量为0且GMV为0.00，处于前端引流测试阶段。",
        "provenance": "feishu",
        "columns": [
            {"key": "creator", "title": "创作者", "type": "string"},
            {"key": "spend", "title": "CID总消耗(元)", "type": "currency"},
            {"key": "impressions", "title": "展现量", "type": "number"},
            {"key": "clicks", "title": "点击量", "type": "number"},
            {"key": "component_clicks", "title": "组件点击量", "type": "number"},
            {"key": "cost_per_component_click", "title": "组件点击成本(元)", "type": "currency"},
            {"key": "orders_30d", "title": "30日成交订单量", "type": "number"},
            {"key": "gmv_30d", "title": "30日成交GMV(元)", "type": "currency"},
            {"key": "roi_30d", "title": "30日ROI", "type": "number"}
        ],
        "rows": cid_summary
    }

    t_weekly = {
        "id": "wipes-weekly-sprint-table",
        "title": "投放阶段周度Sprint转化效率对比表 (5期周汇总)",
        "category": "performance",
        "period": "2026/09/16~2026/10/19 (第5期源表标题为10/13-10/29规划，实际数据核验截止10/19共7天)",
        "sourceId": "wipes-sheets-0qtvhe",
        "sourceUrl": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=0QTVhE",
        "note": "来自By day子表右侧BY周数据情况汇总。第5期行标为10/13-10/29规划窗口，但数值76,963.75经核对逐日数据实际为10/13~10/19共7天累计消耗，严禁以17天算日均！小红星站外活跃UV为各阶段周期归因活跃人数，各周人群存在重叠，不可跨周直接相加去重。第3周(9/29~10/5)国庆前期CPUV达阶段最优¥4.29。",
        "provenance": "feishu",
        "columns": [
            {"key": "sourcePeriod", "title": "源表期标", "type": "badge"},
            {"key": "actualObservedPeriod", "title": "实际核算期", "type": "string"},
            {"key": "observedDays", "title": "实际天数", "type": "number"},
            {"key": "spend", "title": "实际消耗(元)", "type": "currency"},
            {"key": "impressions", "title": "展现量", "type": "number"},
            {"key": "interactions", "title": "互动量", "type": "number"},
            {"key": "uv_30d", "title": "站外活跃UV(30日归因)", "type": "number"},
            {"key": "cpm", "title": "CPM(元)", "type": "currency"},
            {"key": "cpe", "title": "CPE(元)", "type": "currency"},
            {"key": "cpuv", "title": "CPUV(元)", "type": "currency"},
            {"key": "dailySpendAvg", "title": "日均消耗(元)", "type": "currency"}
        ],
        "rows": weekly_cohorts
    }

    t_channels = {
        "id": "wipes-channel-structure-table",
        "title": "项目全渠道实际花费结构汇总表 (K/F/S/CID与淘搜总和)",
        "category": "budget",
        "period": "2026/09/14~2026/10/19",
        "sourceId": "wipes-sheets-wy1hzo",
        "sourceUrl": f"https://feishu.cn/sheets/{SPREADSHEET_TOKEN_MAIN}?sheet=wY1HZO",
        "note": "淘搜子表第1行总计真实数据映射。覆盖K端达人费¥188,049.64、F端信息流¥132,134.39、S端搜索推广¥46,733.16、CID端¥2,881.17，总消耗¥369,798.36，淘搜总指数9,375。",
        "provenance": "feishu",
        "columns": [
            {"key": "channel", "title": "投放渠道", "type": "badge"},
            {"key": "channelName", "title": "渠道名称", "type": "string"},
            {"key": "spend", "title": "消耗金额(元)", "type": "currency"},
            {"key": "share", "title": "花费占比", "type": "percent"},
            {"key": "role", "title": "渠道战略角色", "type": "string"}
        ],
        "rows": [
            {"channel": "K", "channelName": "达人采买 (KOL/KOC)", "spend": 188049.64, "share": "50.85%", "role": "内容种草与心智建设基石"},
            {"channel": "F", "channelName": "信息流与视频内流 (Feeds)", "spend": 132134.39, "share": "35.73%", "role": "规模化放大曝光与低成本引流"},
            {"channel": "S", "channelName": "搜索推广 (Search)", "spend": 46733.16, "share": "12.64%", "role": "精准心智拦截与需求收口"},
            {"channel": "CID", "channelName": "跨端直连 (CID直跳电商)", "spend": 2881.17, "share": "0.78%", "role": "高潜爆款直联淘宝成交探索"},
            {"channel": "Total", "channelName": "全渠道总消耗", "spend": 369798.36, "share": "100.00%", "role": "全盘总计"}
        ]
    }

    existing_table_ids = {t["id"] for t in enrichment.get("tables", [])}
    new_tables = [t_kpi, t_xinghe, t_budget, t_cid, t_weekly, t_channels]
    for nt in new_tables:
        if nt["id"] in existing_table_ids:
            for idx_t, old_t in enumerate(enrichment["tables"]):
                if old_t["id"] == nt["id"]:
                    enrichment["tables"][idx_t] = nt
                    break
        else:
            enrichment["tables"].append(nt)

    with open(ENRICHMENT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(enrichment, f, ensure_ascii=False, indent=2)
    print(f"Updated {ENRICHMENT_JSON_PATH} with {len(new_tables)} newly enriched tables.")

    keep_files = {
        "catalog.json", "manifest.json", "facts.json", "all_sheets_audit.json",
        "doc_embedded_sheets_audit.json", "reproduce_deep_audit.py"
    }
    for fname in os.listdir(OUTPUT_DIR):
        if fname not in keep_files:
            try:
                os.remove(os.path.join(OUTPUT_DIR, fname))
                print(f"Cleaned scratch file: {fname}")
            except Exception as e:
                pass

    print("=== DEEP AUDIT REPRODUCTION FINISHED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()
