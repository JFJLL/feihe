import subprocess
import json
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

TOKEN = "Ero1shDTFhVzwttqDMLceZQ4nMb"
TARGET_SIDS = ["Ik3UgV", "ntH2Mw", "AZxWzV", "MsDU8f"]
RAW_FULL_DIR = "docs/new-projects-sources/deep-audit-wipes/raw-full"
AUDIT_JSON_PATH = "docs/new-projects-sources/deep-audit-wipes/all_sheets_audit.json"
MANIFEST_PATH = "docs/new-projects-sources/deep-audit-wipes/manifest.json"
CATALOG_PATH = "docs/new-projects-sources/deep-audit-wipes/catalog.json"
os.makedirs(RAW_FULL_DIR, exist_ok=True)

def fetch_one(sid):
    print(f"\n>>> Fetching full raw sheet: {sid} ...")
    cmd = [
        "rtk", "lark-cli", "sheets", "+csv-get",
        "--spreadsheet-token", TOKEN,
        "--sheet-id", sid,
        "--as", "user",
        "--format", "json",
        "--max-chars", "100000000"
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=180)
    except subprocess.TimeoutExpired:
        print(f"FAILED: {sid} timed out after 180s")
        return None

    if res.returncode != 0:
        print(f"FAILED: {sid} exit code {res.returncode}")
        print(f"STDERR: {res.stderr[:500]}")
        return None

    try:
        parsed = json.loads(res.stdout)
    except Exception as e:
        print(f"FAILED to parse JSON from {sid}: {e}")
        print(f"STDOUT sample: {res.stdout[:300]}")
        return None

    data = parsed.get("data", {})
    has_more = data.get("has_more")
    actual_range = data.get("actual_range")
    current_region = data.get("current_region")
    annotated_csv = data.get("annotated_csv", "")
    lines = annotated_csv.splitlines()
    non_empty = [l for l in lines if l.strip() and not l.strip().endswith("] ,,,,,,,,,,,,,,,,,,")]

    print(f"RESULT: {sid} | has_more={has_more} | actual_range={actual_range} | region={current_region} | lines={len(lines)} | non_empty={len(non_empty)}")

    # Save full JSON payload
    out_file = os.path.join(RAW_FULL_DIR, f"{sid}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(res.stdout)
    print(f"Saved full JSON to: {out_file} ({os.path.getsize(out_file)} bytes)")

    return {
        "sid": sid,
        "has_more": has_more,
        "actual_range": actual_range,
        "current_region": current_region,
        "lines_count": len(lines),
        "non_empty_count": len(non_empty)
    }

def main():
    print("=== STARTING FULL RAW FETCH FOR 4 REMAINING SHEETS ===")
    results = {}
    for sid in TARGET_SIDS:
        res = fetch_one(sid)
        if res:
            results[sid] = res

    print("\n=== SUMMARY OF FETCH RESULTS ===")
    for sid, r in results.items():
        print(f"  - {sid}: has_more={r['has_more']}, actual_range={r['actual_range']}, non_empty={r['non_empty_count']}")

    # Update all_sheets_audit.json
    if os.path.exists(AUDIT_JSON_PATH):
        with open(AUDIT_JSON_PATH, "r", encoding="utf-8") as f:
            audit_data = json.load(f)
        for s in audit_data.get("sheets", []):
            sid = s.get("sheetId")
            if sid in results:
                r = results[sid]
                s["hasMore"] = r["has_more"]
                s["actualRange"] = r["actual_range"]
                s["linesReturned"] = r["lines_count"]
                s["nonEmptyLines"] = r["non_empty_count"]
                s["coverageStatus"] = "fully_audited"
                s["rawJsonPath"] = f"docs/new-projects-sources/deep-audit-wipes/raw-full/{sid}.json"
        with open(AUDIT_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)
        print("Updated all_sheets_audit.json successfully.")

    # Update manifest.json & catalog.json
    for path in [MANIFEST_PATH, CATALOG_PATH]:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                m_data = json.load(f)
            for s in m_data.get("sheetsCoverage", []):
                sid = s.get("sheetId")
                if sid in results:
                    r = results[sid]
                    s["hasMore"] = r["has_more"]
                    s["coverageStatus"] = "fully_audited"
                    s["rawJsonPath"] = f"docs/new-projects-sources/deep-audit-wipes/raw-full/{sid}.json"
            with open(path, "w", encoding="utf-8") as f:
                json.dump(m_data, f, ensure_ascii=False, indent=2)
            print(f"Updated {os.path.basename(path)} successfully.")

    print("=== FULL RAW FETCH COMPLETED ===")

if __name__ == "__main__":
    main()
