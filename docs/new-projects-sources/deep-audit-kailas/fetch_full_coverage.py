import csv,io,json,re,subprocess,sys,datetime,concurrent.futures
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path("docs/new-projects-sources/deep-audit-kailas")
DEST=ROOT/"raw-full";DEST.mkdir(exist_ok=True)
old=json.loads((ROOT/"manifest.json").read_text(encoding="utf-8"))
items=old["sheets"]
def count_rows(text):
    rows=list(csv.reader(io.StringIO(re.sub(r"^\[row=\d+\] ?","",text,flags=re.M))))
    return sum(any(c.strip() for c in r) for r in rows)
def fetch(item):
    token=item["workbook_token"];sid=item["sheet_id"]
    out={k:v for k,v in item.items() if k not in ("read_status","business_record_count","fetched_at")}
    out["metadataGridRows"]=item.get("row_count")
    out["requestedFull"]=True
    cmd=["lark-cli.cmd","sheets","+csv-get","--spreadsheet-token",token,"--sheet-id",sid,"--as","user","--format","json"]
    try:
        p=subprocess.run(cmd,capture_output=True,timeout=180)
        text=p.stdout.decode("utf-8-sig",errors="replace")
        obj=json.loads(text)
        (DEST/(sid+".json")).write_text(json.dumps(obj,ensure_ascii=False),encoding="utf-8")
        data=obj.get("data",obj)
        out.update({"actual_range":data.get("actual_range"),"returned_rows":data.get("row_count"),"has_more":data.get("has_more"),"fetched_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"rawFile":str(DEST/(sid+".json"))})
        if p.returncode or obj.get("ok") is False:
            out.update(read_status="failed",error=str(obj.get("error","CLI nonzero"))[:300])
        elif data.get("has_more") is True:
            out.update(read_status="partial_needs_chunks")
        elif "annotated_csv" not in data:
            out.update(read_status="failed",error="missing annotated_csv")
        else:
            out["actual_nonempty_rows"]=count_rows(data["annotated_csv"])
            out["read_status"]="full" if out["actual_nonempty_rows"] else "empty"
    except Exception as e:
        out.update(read_status="failed",error=str(e)[:300],fetched_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
    return out
results=[]
def save():
    counts={}
    for row in results:counts[row["read_status"]]=counts.get(row["read_status"],0)+1
    report={"generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"total_sheets":len(items),"completed_requests":len(results),"status_summary":counts,"sheets":sorted(results,key=lambda r:(r["workbook_token"],r["sheet_id"]))}
    (ROOT/"coverage.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    return report
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    pending=[pool.submit(fetch,item) for item in items]
    for f in concurrent.futures.as_completed(pending):
        result=f.result();results.append(result);save()
        print(result["sheet_id"],result["read_status"],result.get("returned_rows"),flush=True)
report=save()
(ROOT/"manifest.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(report["status_summary"],ensure_ascii=False))
