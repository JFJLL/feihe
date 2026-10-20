import json
import os
import csv
import io

raw_dir = "docs/new-projects-sources/deep-audit-meiling/raw_sheets"
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

def parse_clean_float(val):
    if not val: return 0.0
    try:
        return float(val.replace(",", "").replace("%", "").strip())
    except ValueError:
        return 0.0

def aggregate_daily(prefix, channel_name, source_id):
    f = [x for x in os.listdir(raw_dir) if prefix in x][0]
    with open(os.path.join(raw_dir, f), "r", encoding="utf-8") as fp:
        d = json.load(fp)
    rows = parse_annotated_csv(d["data"]["annotated_csv"])
    
    # Cols: date=0, spend=11, imp=12, clicks=13, ctr=14, cpc=15, cpm=16, eng=17, cpe=18, uv=19
    daily = {}
    for r in rows[1:]:
        if len(r) > 13:
            date_raw = r[0].strip()
            if not date_raw or not date_raw.startswith("2026"):
                continue
            date_norm = date_raw.replace("/", "-")
            spend = parse_clean_float(r[11])
            imp = int(parse_clean_float(r[12]))
            clicks = int(parse_clean_float(r[13]))
            eng = int(parse_clean_float(r[17])) if len(r) > 17 else 0
            uv = int(parse_clean_float(r[19])) if len(r) > 19 else 0
            
            if date_norm not in daily:
                daily[date_norm] = {"spend": 0.0, "impressions": 0, "clicks": 0, "engagements": 0, "uv": 0}
            daily[date_norm]["spend"] += spend
            daily[date_norm]["impressions"] += imp
            daily[date_norm]["clicks"] += clicks
            daily[date_norm]["engagements"] += eng
            daily[date_norm]["uv"] += uv
            
    records = []
    for d_str in sorted(daily.keys()):
        info = daily[d_str]
        sp = round(info["spend"], 2)
        im = info["impressions"]
        cl = info["clicks"]
        en = info["engagements"]
        u = info["uv"]
        ctr = round(cl / im * 100, 2) if im > 0 else None
        cpc = round(sp / cl, 2) if cl > 0 else None
        cpe = round(sp / en, 2) if en > 0 else None
        cpuv = round(sp / u, 2) if u > 0 else None
        records.append({
            "date": d_str,
            "spend": sp,
            "impressions": im,
            "clicks": cl,
            "ctr": ctr,
            "cpc": cpc,
            "engagements": en,
            "cpe": cpe,
            "uv": u,
            "cpuv": cpuv
        })
    return records

xingban_records = aggregate_daily("ACntPW", "代采星伴种草", "sheet:RoAtsw3KTh56ZBtT7cmcTYaznJb:ACntPW")
toitou_records = aggregate_daily("zF2qee", "京东对投种草", "sheet:RoAtsw3KTh56ZBtT7cmcTYaznJb:zF2qee")

with open(meiling_json_path, "r", encoding="utf-8") as fp:
    app_data = json.load(fp)

existing_datasets = app_data.get("dailyDatasets", [])
existing_ids = {d["id"] for d in existing_datasets}

if "meiling-daily-xingban-seed" not in existing_ids:
    existing_datasets.append({
        "id": "meiling-daily-xingban-seed",
        "label": "代采星伴种草分日流水",
        "period": f"{xingban_records[0]['date']} ~ {xingban_records[-1]['date']}",
        "sourceId": "sheet:RoAtsw3KTh56ZBtT7cmcTYaznJb:ACntPW",
        "sourceUrl": "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=ACntPW",
        "note": "由ACntPW数据源2979条明细按日聚合",
        "metrics": {"totalSpend": round(sum(r['spend'] for r in xingban_records), 2)},
        "rows": xingban_records
    })

if "meiling-daily-jd-toitou-seed" not in existing_ids:
    existing_datasets.append({
        "id": "meiling-daily-jd-toitou-seed",
        "label": "京东对投种草分日流水",
        "period": f"{toitou_records[0]['date']} ~ {toitou_records[-1]['date']}",
        "sourceId": "sheet:RoAtsw3KTh56ZBtT7cmcTYaznJb:zF2qee",
        "sourceUrl": "https://yimeichuanbo.feishu.cn/sheets/RoAtsw3KTh56ZBtT7cmcTYaznJb?sheet=zF2qee",
        "note": "由zF2qee数据源13954条明细按日聚合",
        "metrics": {"totalSpend": round(sum(r['spend'] for r in toitou_records), 2)},
        "rows": toitou_records
    })

app_data["dailyDatasets"] = existing_datasets

with open(meiling_json_path, "w", encoding="utf-8") as fp:
    json.dump(app_data, fp, ensure_ascii=False, indent=2)

print(f"Added daily datasets! Total dailyDatasets now: {len(existing_datasets)}")
