import json
import urllib.request
import urllib.error
import os
import sys
import sqlite3
from datetime import datetime, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CONFIG_PATH = os.path.join(REPO_ROOT, "config.json")
KAILAS_SHEETS_PATH = os.path.join(REPO_ROOT, "docs", "new-projects-sources", "kailas-sheets.json")
LOCAL_DB_PATH = os.path.join(REPO_ROOT, "feihe-mvp", "data", "local.db")

with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    config = json.load(f)

t_cfg = config.get("tencent_docs", {})
access_token = t_cfg.get("access_token")
open_id = t_cfg.get("open_id")
client_id = t_cfg.get("client_id")
file_id = "DZVRxeWtoUVRaVHha"

if not (access_token and open_id and client_id):
    print("[ERROR] config.json 中缺少 tencent_docs 凭据信息", file=sys.stderr)
    sys.exit(1)

headers = {
    "Access-Token": access_token,
    "Open-Id": open_id,
    "Client-Id": client_id
}

def col_to_letter(col_idx):
    result = ""
    while col_idx > 0:
        col_idx, remainder = divmod(col_idx - 1, 26)
        result = chr(65 + remainder) + result
    return result

def fetch_json(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode("utf-8"))

def parse_grid_data(grid_data):
    rows = grid_data.get("rows", [])
    parsed_rows = []
    for r in rows:
        parsed_cols = []
        for v in r.get("values", []):
            if not v:
                parsed_cols.append(None)
                continue
            cv = v.get("cellValue")
            if cv is None:
                parsed_cols.append(None)
            elif "text" in cv:
                parsed_cols.append(cv["text"])
            elif "number" in cv:
                parsed_cols.append(cv["number"])
            elif "select" in cv:
                sel = cv["select"]
                vals = sel.get("value", [])
                opts = {o["id"]: o["text"] for o in sel.get("options", [])}
                matched = [opts.get(val_id, val_id) for val_id in vals]
                parsed_cols.append(",".join(matched) if matched else None)
            elif "time" in cv:
                t = cv["time"]
                parsed_cols.append(f"{t.get('year')}/{t.get('month'):02d}/{t.get('day'):02d}")
            else:
                parsed_cols.append(str(cv))
        parsed_rows.append(parsed_cols)
    return parsed_rows

def fetch_sheet_rows(file_id, sheet_id, row_count, col_count):
    max_col_letter = col_to_letter(max(col_count, 1))
    all_rows = []
    # Tencent Docs limit: <=1000 rows, <=200 cols, <=10000 cells per call
    safe_cells = 8000
    step = max(1, min(500, safe_cells // max(col_count, 1)))
    for start_r in range(1, max(row_count, 1) + 1, step):
        end_r = min(start_r + step - 1, row_count)
        range_str = f"A{start_r}:{max_col_letter}{end_r}"
        url = f"https://docs.qq.com/openapi/spreadsheet/v3/files/{file_id}/{sheet_id}/{range_str}"
        try:
            data = fetch_json(url)
            chunk_rows = parse_grid_data(data.get("gridData", {}))
            all_rows.extend(chunk_rows)
        except Exception as e:
            print(f"  [WARN] 拉取 {sheet_id} 区间 {range_str} 异常: {e}")
            break
    return all_rows

def sync_kailas():
    print(f"[1/4] 获取腾讯文档文件元数据: {file_id}...")
    meta_url = f"https://docs.qq.com/openapi/spreadsheet/v3/files/{file_id}"
    meta = fetch_json(meta_url)
    props = meta.get("properties", [])
    print(f"  成功获取工作表数量: {len(props)}")

    now_iso = datetime.now(timezone.utc).isoformat()
    tencent_sheets = {}
    for p in props:
        sid = p["sheetId"]
        title = p["title"]
        rc = p.get("rowCount", 0)
        cc = p.get("columnCount", 0)
        print(f"[2/4] 同步工作表 [{sid}] {title} (预计 {rc} 行, {cc} 列)...")
        rows = fetch_sheet_rows(file_id, sid, rc, cc)
        tencent_sheets[title] = {
            "sheetId": sid,
            "title": title,
            "rowCount": len(rows),
            "colCount": cc,
            "rows": rows
        }
        print(f"  已拉取完成: {len(rows)} 行")

    print(f"[3/4] 更新凯乐石数据源快照: {KAILAS_SHEETS_PATH}...")
    with open(KAILAS_SHEETS_PATH, "r", encoding="utf-8") as f:
        kailas_data = json.load(f)

    # 备份现有快照
    backup_path = KAILAS_SHEETS_PATH + ".bak"
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(kailas_data, f, ensure_ascii=False, indent=2)

    kailas_data["readAt"] = now_iso

    # 映射表：腾讯文档 tabName -> 现有 kailas-sheets 中的对应项
    sheet_id_alias_map = {
        "黑山在run项目消耗进度": "0vvsaG",
        "黑山Q3达人执行表": "4PGzjP",
        "达人量级以内容类型分配": "6Mjyco"
    }

    existing_sheets = kailas_data.get("sheets", [])
    existing_by_title = {s.get("tabName"): s for s in existing_sheets}

    updated_sheets = []
    # 保留非腾讯文档的纯飞书表（如常见问题总表 0aRpyJ、日报用 pwNPq2 等）
    for s in existing_sheets:
        t_name = s.get("tabName")
        if t_name not in tencent_sheets:
            updated_sheets.append(s)

    # 注入/更新腾讯文档工作表
    for title, t_info in tencent_sheets.items():
        sid = t_info["sheetId"]
        legacy_id = sheet_id_alias_map.get(title, sid)
        sheet_entry = {
            "spreadsheetToken": file_id,
            "wikiToken": "tencent_docs_origin",
            "documentTitle": f"【腾讯文档原表】26年6月&Q3【FUGA 大坡王黑山】日常执行表",
            "tabName": title,
            "sheetId": legacy_id,
            "tencentSheetId": sid,
            "URL": f"https://docs.qq.com/sheet/{file_id}?tab={sid}",
            "range": f"A1:{col_to_letter(t_info['colCount'])}{t_info['rowCount']}",
            "rowCount": t_info["rowCount"],
            "colCount": t_info["colCount"],
            "readAt": now_iso,
            "value": t_info["rows"]
        }
        updated_sheets.append(sheet_entry)

    kailas_data["sheets"] = updated_sheets
    with open(KAILAS_SHEETS_PATH, "w", encoding="utf-8") as f:
        json.dump(kailas_data, f, ensure_ascii=False, indent=2)
    print(f"  kailas-sheets.json 更新成功，共包含 {len(updated_sheets)} 张工作表")

    print(f"[4/4] 更新数据库 data_sources 表记录...")
    if os.path.exists(LOCAL_DB_PATH):
        conn = sqlite3.connect(LOCAL_DB_PATH)
        c = conn.cursor()
        c.execute("""
            UPDATE data_sources
            SET type = 'tencent_sheet',
                name = '26年6月&Q3【FUGA 大坡王黑山】日常执行表（腾讯文档原表）',
                spreadsheet = ?,
                sheet_id = 'savtm5',
                status = '已连接原表',
                last_synced_at = ?,
                last_row_count = ?,
                mapping_json = ?,
                last_error = '',
                probe_status = 'accessible'
            WHERE id = 'src-kailas-node-S2FRw04w6i21DikL6DVcmfG8nSh'
        """, (
            f"https://docs.qq.com/sheet/{file_id}",
            now_iso,
            tencent_sheets.get("黑山在run项目消耗进度", {}).get("rowCount", 15),
            json.dumps({
                "file_id": file_id,
                "detail": "已通过腾讯文档 OpenAPI 直连原表，支持全量增量读取",
                "source_type": "tencent_docs_openapi"
            }, ensure_ascii=False)
        ))
        conn.commit()
        conn.close()
        print("  local.db data_sources 更新成功")

    print(">>> 凯乐石原腾讯文档同步完成！")

if __name__ == "__main__":
    sync_kailas()
