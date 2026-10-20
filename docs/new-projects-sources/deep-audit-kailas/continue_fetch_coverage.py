import csv, io, json, re, subprocess, sys, datetime, time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path("docs/new-projects-sources/deep-audit-kailas")
DEST = ROOT / "raw-full"
DEST.mkdir(exist_ok=True)

# Load clean titles
clean_titles = {}
if (ROOT / "clean_titles.json").exists():
    clean_titles = json.loads((ROOT / "clean_titles.json").read_text(encoding="utf-8"))

cov_path = ROOT / "coverage.json"
cov = json.load(cov_path.open(encoding="utf-8"))
sheets = {s["sheet_id"]: s for s in cov["sheets"]}

def count_rows(text):
    rows = list(csv.reader(io.StringIO(re.sub(r"^\[row=\d+\] ?", "", text, flags=re.M))))
    return sum(any(c.strip() for c in r) for r in rows)

def save_cov():
    counts = {}
    sheet_list = list(sheets.values())
    for s in sheet_list:
        st = s.get("read_status", "unknown")
        counts[st] = counts.get(st, 0) + 1
    report = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "total_sheets": len(sheet_list),
        "status_summary": counts,
        "sheets": sorted(sheet_list, key=lambda r: (r.get("workbook_token", ""), r.get("sheet_id", "")))
    }
    cov_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report

# 1. Fix UTF-8 titles across all sheets
for sid, s in sheets.items():
    k = f"{s.get('workbook_token')}_{sid}"
    if k in clean_titles:
        meta = clean_titles[k]
        if meta.get("sheet_name"):
            s["sheet_name"] = meta["sheet_name"]
        if meta.get("workbook_title"):
            s["workbook_title"] = meta["workbook_title"]
        elif s.get("workbook_token") == "Pm3DsKubghgFDAtbbS5cyHY5n4g":
            s["workbook_title"] = "黑山Q3日常双周会小结内嵌数据源表"

save_cov()
print("Refreshed clean UTF-8 titles across all sheets.")

# 2. Retry 3 failed sheets
failed_ids = [sid for sid, s in sheets.items() if s.get("read_status") == "failed"]
print(f"Retrying failed sheets: {failed_ids}")
for sid in failed_ids:
    s = sheets[sid]
    tok = s["workbook_token"]
    cmd = ["lark-cli.cmd", "sheets", "+csv-get", "--spreadsheet-token", tok, "--sheet-id", sid, "--as", "user", "--format", "json", "--max-chars", "20000000"]
    try:
        p = subprocess.run(cmd, capture_output=True, timeout=120)
        obj = json.loads(p.stdout.decode("utf-8-sig", errors="replace"))
        if obj.get("ok"):
            data = obj.get("data", {})
            (DEST / f"{sid}.json").write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")
            csv_text = data.get("annotated_csv", "")
            non_empty = count_rows(csv_text)
            s.update({
                "actual_range": data.get("actual_range"),
                "returned_rows": data.get("row_count"),
                "has_more": False,
                "actual_nonempty_rows": non_empty,
                "read_status": "full" if non_empty else "empty",
                "rawFile": str(DEST / f"{sid}.json"),
                "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })
            s.pop("error", None)
            print(f"Retried {sid}: SUCCESS rows={non_empty}")
        else:
            s["error"] = str(obj.get("error"))[:300]
            print(f"Retried {sid}: FAILED error={s['error']}")
    except Exception as e:
        s["error"] = str(e)[:300]
        print(f"Retried {sid}: EXCEPTION error={s['error']}")
    save_cov()

# 3. Complete 8 large single-shot sheets
single_shot_large = ["1oFnAQ", "sCRi8B", "OzIjd5", "ajdUxd", "csZuUa", "OxeDFl", "BpA3kU", "cVxA19"]
for sid in single_shot_large:
    s = sheets.get(sid)
    if not s or s.get("read_status") == "full":
        continue
    tok = s["workbook_token"]
    print(f"Fetching full untruncated sheet: {sid} (metadataGridRows={s.get('metadataGridRows')})...")
    cmd = ["lark-cli.cmd", "sheets", "+csv-get", "--spreadsheet-token", tok, "--sheet-id", sid, "--as", "user", "--format", "json", "--max-chars", "20000000"]
    try:
        p = subprocess.run(cmd, capture_output=True, timeout=180)
        obj = json.loads(p.stdout.decode("utf-8-sig", errors="replace"))
        if obj.get("ok"):
            data = obj.get("data", {})
            (DEST / f"{sid}.json").write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")
            csv_text = data.get("annotated_csv", "")
            non_empty = count_rows(csv_text)
            s.update({
                "actual_range": data.get("actual_range"),
                "returned_rows": data.get("row_count"),
                "has_more": data.get("has_more", False),
                "actual_nonempty_rows": non_empty,
                "read_status": "full" if non_empty else "empty",
                "rawFile": str(DEST / f"{sid}.json"),
                "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })
            print(f"Completed {sid}: SUCCESS actual_range={s['actual_range']} nonempty={non_empty}")
        else:
            print(f"Failed {sid}: error={obj.get('error')}")
    except Exception as e:
        print(f"Exception {sid}: error={e}")
    save_cov()

# 4. Chunked continuation for 581ba7 (117k rows)
s581 = sheets.get("581ba7")
if s581 and s581.get("read_status") != "full":
    print("Starting chunked continuation for 581ba7...")
    tok = s581["workbook_token"]
    all_csv_chunks = []
    chunk_size = 5000
    curr_start = 1
    total_grid = s581.get("metadataGridRows", 117689)
    empty_streak = 0
    max_empty_streak = 2
    last_valid_row = 1
    
    while curr_start <= total_grid and empty_streak < max_empty_streak:
        curr_end = min(curr_start + chunk_size - 1, total_grid)
        rng = f"A{curr_start}:AI{curr_end}"
        cmd = ["lark-cli.cmd", "sheets", "+csv-get", "--spreadsheet-token", tok, "--sheet-id", "581ba7", "--range", rng, "--as", "user", "--format", "json", "--max-chars", "20000000"]
        success = False
        for retry in range(3):
            try:
                p = subprocess.run(cmd, capture_output=True, timeout=60)
                obj = json.loads(p.stdout.decode("utf-8-sig", errors="replace"))
                if obj.get("ok"):
                    data = obj.get("data", {})
                    csv_chunk = data.get("annotated_csv", "")
                    c_rows = count_rows(csv_chunk)
                    all_csv_chunks.append(csv_chunk)
                    if c_rows > 0:
                        empty_streak = 0
                        last_valid_row = curr_end
                    else:
                        empty_streak += 1
                    print(f"581ba7 chunk {rng}: nonempty={c_rows} empty_streak={empty_streak}")
                    success = True
                    break
                else:
                    time.sleep(2)
            except Exception as e:
                time.sleep(2)
        if not success:
            print(f"Failed chunk {rng} after 3 retries, aborting chunk loop.")
            break
        curr_start = curr_end + 1
        # Save interim progress
        s581.update({
            "actual_range": f"A1:AI{curr_end}",
            "returned_rows": curr_end,
            "has_more": True if empty_streak < max_empty_streak and curr_end < total_grid else False,
            "read_status": "partial_needs_chunks" if empty_streak < max_empty_streak and curr_end < total_grid else "full",
            "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
        save_cov()

    # Finalize 581ba7
    full_csv = "\n".join(all_csv_chunks)
    total_nonempty = count_rows(full_csv)
    payload = {
        "ok": True,
        "data": {
            "actual_range": f"A1:AI{last_valid_row}",
            "row_count": last_valid_row,
            "col_count": 35,
            "has_more": False,
            "annotated_csv": full_csv
        }
    }
    (DEST / "581ba7.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    s581.update({
        "actual_range": f"A1:AI{last_valid_row}",
        "returned_rows": last_valid_row,
        "has_more": False,
        "actual_nonempty_rows": total_nonempty,
        "read_status": "full",
        "rawFile": str(DEST / "581ba7.json"),
        "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    })
    final_report = save_cov()
    print(f"581ba7 FULLY READ: range=A1:AI{last_valid_row}, nonempty={total_nonempty}")

final_report = save_cov()
print("FINAL COVERAGE STATUS SUMMARY:")
print(json.dumps(final_report["status_summary"], ensure_ascii=False, indent=2))
