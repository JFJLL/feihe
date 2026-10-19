import datetime
import json
import os
import re
import subprocess
import sys

TARGET_WIKIS = [
    {
        "wiki_token": "Y8S1wy0YUiAtJrkY9G5ceczDnjf",
        "url": "https://yimeichuanbo.feishu.cn/wiki/Y8S1wy0YUiAtJrkY9G5ceczDnjf",
        "expected_replaces": "LT1MwikWci8LTDk0UL7coXfrnVb",
    },
    {
        "wiki_token": "HNDCwmdpkiw4DgkFSNycB3cbnSc",
        "url": "https://yimeichuanbo.feishu.cn/wiki/HNDCwmdpkiw4DgkFSNycB3cbnSc",
        "expected_replaces": "RQffw002Aik9aNkW9PScJ05knre",
    },
]

OUTPUT_JSON_PATH = os.path.join(os.path.dirname(__file__), "access-update-new-links.json")


def run_cmd(cmd):
    res = subprocess.run(cmd, shell=True, capture_output=True)
    if res.returncode != 0:
        err = res.stderr.decode("utf-8", errors="replace")
        out = res.stdout.decode("utf-8", errors="replace")
        return False, {"code": res.returncode, "error": err, "stdout": out}
    try:
        data = json.loads(res.stdout.decode("utf-8"))
        return True, data
    except Exception as e:
        return True, {"raw": res.stdout.decode("utf-8", errors="replace")}


def sanitize_text(text):
    if not isinstance(text, str):
        return text
    # Sanitize 11-digit mobile phone numbers if any
    text = re.sub(r'(?<!\d)1[3-9]\d{9}(?!\d)', '[PHONE_REDACTED]', text)
    return text


def sanitize_row(row):
    return [sanitize_text(c) if isinstance(c, str) else c for c in row]


def get_now_iso():
    return datetime.datetime.now().astimezone().isoformat()


def main():
    print("Starting Feishu resource verification batch...")
    result_data = {
        "batch_readAt": get_now_iso(),
        "identity": "user",
        "domain": "yimeichuanbo.feishu.cn",
        "status": "in_progress",
        "targets": [],
    }

    # Step 1: node-get for each target wiki
    for item in TARGET_WIKIS:
        token = item["wiki_token"]
        url = item["url"]
        print(f"Reading node info for wiki token: {token}...")
        ok, res = run_cmd(f'lark-cli wiki +node-get --node-token "{token}" --as user --format json')
        read_time = get_now_iso()
        target_entry = {
            "wiki_token": token,
            "url": url,
            "readAt": read_time,
            "access_result": "accessible" if ok and res.get("ok") else "error",
            "expected_replaces": item["expected_replaces"],
            "node_details": {},
            "project_attribution": "",
            "sub_sheets_catalog": [],
            "core_sub_sheets": [],
        }

        if ok and res.get("ok"):
            node_data = res.get("data", {})
            title = node_data.get("title", "")
            obj_type = node_data.get("obj_type", "")
            obj_token = node_data.get("obj_token", "")

            target_entry["node_details"] = {
                "title": title,
                "obj_type": obj_type,
                "obj_token": obj_token,
                "node_token": node_data.get("node_token", token),
                "space_id": node_data.get("space_id", ""),
                "owner": node_data.get("owner", ""),
                "updated_at": node_data.get("updated_at", ""),
            }

            # Project attribution confirmation based on real title
            if "黑山" in title or "FUGA" in title or "凯乐石" in title:
                target_entry["project_attribution"] = "Kailas (凯乐石) - FUGA大坡王黑山"
            elif "美菱" in title:
                target_entry["project_attribution"] = "Meiling (美菱) - 美菱冰箱KPI管理"
            else:
                target_entry["project_attribution"] = f"Unknown - Title: {title}"

            # If it's a sheet, get workbook info
            if obj_type == "sheet":
                print(f"Fetching workbook sheets for {obj_token}...")
                wb_ok, wb_res = run_cmd(f'lark-cli sheets +workbook-info --spreadsheet-token "{obj_token}" --as user --format json')
                if wb_ok and wb_res.get("ok"):
                    sheets_meta = wb_res.get("data", {}).get("sheets", [])
                    target_entry["sub_sheets_catalog"] = [
                        {
                            "sheet_id": s.get("sheet_id"),
                            "sheet_name": s.get("sheet_name"),
                            "row_count": s.get("row_count"),
                            "column_count": s.get("column_count"),
                            "is_hidden": s.get("is_hidden", False),
                            "index": s.get("index"),
                        }
                        for s in sheets_meta
                    ]

            # If it's docx, check embedded sheets
            elif obj_type == "docx":
                print(f"Fetching docx content for {obj_token}...")
                doc_ok, doc_res = run_cmd(f'lark-cli docs +fetch --doc "{obj_token}" --doc-format markdown --as user')
                if doc_ok and doc_res.get("ok"):
                    doc_content = doc_res.get("data", {}).get("document", {}).get("content", "")
                    target_entry["docx_content"] = doc_content
                    # Find embedded sheet tokens
                    sheet_matches = re.findall(r'<sheet\s+sheet-id="([^"]+)"\s+token="([^"]+)"></sheet>', doc_content)
                    if sheet_matches:
                        embedded_token = sheet_matches[0][1]
                        target_entry["embedded_spreadsheet_token"] = embedded_token
                        print(f"Fetching embedded workbook sheets for {embedded_token}...")
                        wb_ok, wb_res = run_cmd(f'lark-cli sheets +workbook-info --spreadsheet-token "{embedded_token}" --as user --format json')
                        if wb_ok and wb_res.get("ok"):
                            sheets_meta = wb_res.get("data", {}).get("sheets", [])
                            target_entry["sub_sheets_catalog"] = [
                                {
                                    "sheet_id": s.get("sheet_id"),
                                    "sheet_name": s.get("sheet_name"),
                                    "row_count": s.get("row_count"),
                                    "column_count": s.get("column_count"),
                                    "is_hidden": s.get("is_hidden", False),
                                    "index": s.get("index"),
                                }
                                for s in sheets_meta
                            ]

        else:
            target_entry["error"] = res

        result_data["targets"].append(target_entry)

    # Immediately write initial file so other agents/main agent can check attribution
    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(result_data, f, ensure_ascii=False, indent=2)
    print(f"Initial node-get & catalog saved to {OUTPUT_JSON_PATH}")

    # Step 2: Read small-range complete KPI/budget/summary sub-sheets (max 3 per workbook)
    for target in result_data["targets"]:
        attr = target.get("project_attribution", "")
        obj_type = target.get("node_details", {}).get("obj_type")

        if "美菱" in attr and obj_type == "sheet":
            token = target["node_details"]["obj_token"]
            # 3 core sub-sheets: L986LN (7-8月), FkLCad (618), 4SGaOf (双11)
            core_configs = [
                {
                    "sheet_id": "L986LN",
                    "title": "7-8月kpi进度总览",
                    "range": "A1:AB39",
                    "url": f"https://feishu.cn/sheets/{token}?sheet=L986LN",
                },
                {
                    "sheet_id": "FkLCad",
                    "title": "618kpi进度总览",
                    "range": "A1:AB35",
                    "url": f"https://feishu.cn/sheets/{token}?sheet=FkLCad",
                },
                {
                    "sheet_id": "4SGaOf",
                    "title": "双11进度更新",
                    "range": "A1:J32",
                    "url": f"https://feishu.cn/sheets/{token}?sheet=4SGaOf",
                },
            ]
            for cfg in core_configs:
                s_id = cfg["sheet_id"]
                s_range = cfg["range"]
                print(f"Reading Meiling sheet {s_id} ({cfg['title']})...")
                c_ok, c_res = run_cmd(
                    f'lark-cli sheets +cells-get --spreadsheet-token "{token}" --sheet-id "{s_id}" --range "{s_range}" --as user --format json'
                )
                read_at = get_now_iso()
                if c_ok and c_res.get("ok"):
                    cells = c_res.get("data", {}).get("ranges", [{}])[0].get("cells", [])
                    raw_rows = [[c.get("value") if isinstance(c, dict) else None for c in r] for r in cells]
                    sanitized_rows = [sanitize_row(r) for r in raw_rows]
                    target["core_sub_sheets"].append({
                        "sheetId": s_id,
                        "title": cfg["title"],
                        "range": s_range,
                        "obj_token": token,
                        "URL": cfg["url"],
                        "readAt": read_at,
                        "access_result": "accessible",
                        "rowCount": len(sanitized_rows),
                        "colCount": len(sanitized_rows[0]) if sanitized_rows else 0,
                        "rows": sanitized_rows,
                    })
                else:
                    target["core_sub_sheets"].append({
                        "sheetId": s_id,
                        "title": cfg["title"],
                        "range": s_range,
                        "obj_token": token,
                        "URL": cfg["url"],
                        "readAt": read_at,
                        "access_result": "error",
                        "error": c_res,
                    })

        elif "黑山" in attr or "凯乐石" in attr:
            # Kailas docx embeds sheet Pm3DsKubghgFDAtbbS5cyHY5n4g
            emb_token = target.get("embedded_spreadsheet_token")
            if emb_token:
                core_configs = [
                    {
                        "sheet_id": "ZpT73Q",
                        "title": "26年9月K侧-一、核心指标概览",
                        "range": "A1:F5",
                        "url": f"https://feishu.cn/sheets/{emb_token}?sheet=ZpT73Q",
                    },
                    {
                        "sheet_id": "JPKUX9",
                        "title": "26年9月K侧-数据总览",
                        "range": "A1:J6",
                        "url": f"https://feishu.cn/sheets/{emb_token}?sheet=JPKUX9",
                    },
                    {
                        "sheet_id": "xnlxN4",
                        "title": "9.9-9.27种草端-消耗进度",
                        "range": "A1:G5",
                        "url": f"https://feishu.cn/sheets/{emb_token}?sheet=xnlxN4",
                    },
                ]
                for cfg in core_configs:
                    s_id = cfg["sheet_id"]
                    s_range = cfg["range"]
                    print(f"Reading Kailas sheet {s_id} ({cfg['title']})...")
                    c_ok, c_res = run_cmd(
                        f'lark-cli sheets +cells-get --spreadsheet-token "{emb_token}" --sheet-id "{s_id}" --range "{s_range}" --as user --format json'
                    )
                    read_at = get_now_iso()
                    if c_ok and c_res.get("ok"):
                        cells = c_res.get("data", {}).get("ranges", [{}])[0].get("cells", [])
                        raw_rows = [[c.get("value") if isinstance(c, dict) else None for c in r] for r in cells]
                        sanitized_rows = [sanitize_row(r) for r in raw_rows]
                        target["core_sub_sheets"].append({
                            "sheetId": s_id,
                            "title": cfg["title"],
                            "range": s_range,
                            "obj_token": emb_token,
                            "URL": cfg["url"],
                            "readAt": read_at,
                            "access_result": "accessible",
                            "rowCount": len(sanitized_rows),
                            "colCount": len(sanitized_rows[0]) if sanitized_rows else 0,
                            "rows": sanitized_rows,
                        })
                    else:
                        target["core_sub_sheets"].append({
                            "sheetId": s_id,
                            "title": cfg["title"],
                            "range": s_range,
                            "obj_token": emb_token,
                            "URL": cfg["url"],
                            "readAt": read_at,
                            "access_result": "error",
                            "error": c_res,
                        })

    result_data["status"] = "completed"
    result_data["completed_at"] = get_now_iso()

    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(result_data, f, ensure_ascii=False, indent=2)
    print(f"Final data successfully saved to {OUTPUT_JSON_PATH}")


if __name__ == "__main__":
    main()
