import sys

content = r'''# -*- coding: utf-8 -*-
import csv,io,json,re,math,sys,datetime
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path("docs/new-projects-sources/huang-tiane/source-a")
RAW=ROOT/"raw"
def read(name):
    p=RAW/name
    obj=json.loads(p.read_text(encoding="utf-8"))
    return list(csv.reader(io.StringIO(re.sub(r"^\[row=\d+\] ?", "", obj["annotated_csv"], flags=re.M))))
def cell(row,i):
    return row[i].strip() if i<len(row) else ""
def num(value,percent=False):
    value=str(value or "").strip()
    if not value or value.startswith("#") or value in ("-","—","/"): return None
    if "%" in value and not percent: return None
    try:
        n=float(value.replace(",","").replace("¥","").replace("￥","").replace("%",""))
        return n if math.isfinite(n) else None
    except ValueError: return None
def date(value):
    m=re.fullmatch(r"(\d{4})[/-](\d{1,2})[/-](\d{1,2})",str(value).strip())
    if not m: return None
    try: return datetime.date(*map(int,m.groups())).isoformat()
    except ValueError: return None
def flag(value):
    return True if value=="\u662f" else False if value=="\u5426" else None
cols={"index":"\u5e8f\u53f7","kol_name":"\u8fbe\u4eba\u6635\u79f0","account_tier":"\u8d26\u53f7\u91cf\u7ea7","fans_w":"\u7c89\u4e1d\u6570\uff08\u4e07\uff09","kol_type":"\u8fbe\u4eba\u7c7b\u578b","content_type":"\u5185\u5bb9\u7c7b\u578b","content_direction":"\u5185\u5bb9\u65b9\u5411","dish_type":"\u83dc\u54c1\u65b9\u5411","price_raw":"\u5e73\u53f0\u88f8\u4ef7\uff08\u5143\uff09","price_with_fee":"\u542b\u5e73\u53f0\u8d39\u62a5\u4ef7\uff08\u5143\uff09","script_stage":"\u811a\u672c\u767b\u8bb0","draft_stage":"\u521d\u7a3f\u767b\u8bb0","scheduled_date":"\u9884\u8ba1\u53d1\u5e03\u65e5\u671f","execution_status":"\u6267\u884c\u8fdb\u5ea6","actual_publish_date":"\u5b9e\u9645\u53d1\u5e03\u65e5\u671f","source_date_text":"\u539f\u8868\u65e5\u671f\u5907\u6ce8","note_id":"\u7b14\u8bb0ID","asset_collected":"\u7d20\u6750\u5df2\u6536\u96c6","account_name":"\u8d26\u53f7\u540d\u79f0","publish_date":"\u53d1\u5e03\u65e5\u671f","fs_active":"FS\u6295\u653e","cid_active":"CID\u6295\u653e","commerce_active":"\u5546\u9500\u6295\u653e"}
def table(id,title,rows,source,period):
    keys=list(rows[0]) if rows else []
    return {"id":id,"title":title,"period":period,"sourceId":source["id"],"sourceUrl":source["url"],"columns":[{"key":k,"title":cols.get(k,k),"type":"number" if k in ("index","fans_w","price_raw","price_with_fee") else "string"} for k in keys],"rows":rows}
def source(id,name,url,rawname):
    ts=datetime.datetime.fromtimestamp((RAW/rawname).stat().st_mtime,datetime.timezone.utc).isoformat()
    return {"id":id,"name":name,"url":url,"status":"ready","fetchedAt":ts,"detail":"\u5b8c\u6574\u539f\u8868\u8bfb\u53d6\uff1b\u6838\u5fc3\u4e8b\u5b9e\u5df2\u63d0\u53d6\uff0c\u7ec6\u5206\u7ef4\u5ea6\u7ee7\u7eed\u6574\u7406"}
s1=source("src-huang-tiane-kol-execution","\u9ec4\u5929\u9e45\u7ea2\u4e66\u79cd\u8349\u6267\u884c\u8868","https://yimeichuanbo.feishu.cn/wiki/HfYRwSbEKiBex5ks2uwc9S9ynog","wb1_kol_execution_GIQjnY.json")
s2=source("src-huang-tiane-cid-fs","\u9ec4\u5929\u9e45\u7ea2\u732bCID\u6295\u653e\u62a5\u8868","https://yimeichuanbo.feishu.cn/wiki/KpHrwJt1picaxBkWB9NcaLlsnih","wb3_cid_fs_daily_Nm3Sev.json")
kol=[]
for r in read("wb1_kol_execution_GIQjnY.json")[1:]:
    if not any(x.strip() for x in r): continue
    kol.append({"index":num(cell(r,0)),"kol_name":cell(r,1),"account_tier":cell(r,2),"fans_w":num(cell(r,5)),"kol_type":cell(r,6),"content_type":cell(r,7),"content_direction":cell(r,8),"dish_type":cell(r,10),"price_raw":num(cell(r,15)),"price_with_fee":num(cell(r,16)),"script_stage":cell(r,18),"draft_stage":cell(r,19),"scheduled_date":cell(r,20),"execution_status":cell(r,21),"actual_publish_date":date(cell(r,23)),"source_date_text":cell(r,23),"note_id":cell(r,24),"asset_collected":flag(cell(r,30))})
assert len(kol)==31, len(kol)
assert sum(r["execution_status"]=="\u5df2\u53d1\u5e03" for r in kol)==18
assert sum(r["asset_collected"] is True for r in kol)==18
kos=[]
for r in read("wb1_kol_execution_wZtAgh.json")[1:]:
    if not any(x.strip() for x in r): continue
    kos.append({"account_name":cell(r,0),"account_tier":cell(r,3),"content_type":cell(r,4),"publish_date":date(cell(r,5)),"source_date_text":cell(r,5),"note_id":cell(r,7),"fs_active":flag(cell(r,9)),"cid_active":flag(cell(r,10)),"commerce_active":flag(cell(r,11))})
fields=[("spend","\u6d88\u8017","\u5143"),("ctr","\u70b9\u51fb\u7387","%"),("cpc","\u70b9\u51fb\u6210\u672c","\u5143/\u6b21"),("cpm","\u5343\u6b21\u66dd\u5149\u6210\u672c","\u5143"),("orders","\u8ba2\u5355\u91cf","\u5355"),("gmv","\u6210\u4ea4GMV","\u5143"),("roi","\u6210\u4ea4ROI","\u500d"),("uv","\u8fdb\u5e97\u91cf","\u4eba\u6b21"),("cpuv","\u8fdb\u5e97\u6210\u672c","\u5143/\u4eba\u6b21"),("aov","\u5ba2\u5355\u4ef7","\u5143/\u5355")]
raw=read("wb3_cid_fs_daily_Nm3Sev.json")
datasets=[]
for off,slug,label,expected in [(0,"standard","\u6807\u51c6\u6295",(59024.76,1918,192884.09,3955)),(12,"simple","\u7b80\u5355\u6295",(42403.02,2257,168346.72,5434))]:
    records={}
    for r in raw:
        d=date(cell(r,off))
        if not d or not ("2026-10-01"<=d<="2026-10-19"): continue
        assert d not in records, (slug,d)
        records[d]={"date":d,**{key:num(cell(r,off+i),key=="ctr") for i,(key,_,_) in enumerate(fields,1)}}
    rows=sorted(records.values(),key=lambda r:r["date"])
    assert len(rows)==19,(slug,len(rows))
    for key,total in zip(("spend","orders","gmv","uv"),expected):
        values=[r[key] for r in rows]
        assert all(v is not None for v in values),(slug,key,"missing")
        assert abs(sum(values)-total)<0.05,(slug,key,sum(values),total)
    datasets.append({"id":"huang-cid-"+slug+"-daily","label":"\u7ea2\u732bCID \u00b7 "+label,"period":rows[0]["date"]+" ~ "+rows[-1]["date"],"sourceId":s2["id"],"sourceUrl":s2["url"],"note":"\u6807\u51c6\u6295\u4e0e\u7b80\u5355\u6295\u5404\u81ea\u72ec\u7acb\u7edf\u8ba1\uff1b\u8fdb\u5e97\u91cf\u4e0d\u53ef\u8de8\u8d26\u53f7\u53bb\u91cd\u3002","metrics":[{"key":k,"label":l,"unit":u} for k,l,u in fields],"rows":rows})
joined=[]
a={r["date"]:r for r in datasets[0]["rows"]}
b={r["date"]:r for r in datasets[1]["rows"]}
for d in sorted(set(a)|set(b)):
    row={"date":d}
    for key in ("spend","orders","gmv","uv"):
        vals=[part.get(d,{}).get(key) for part in (a,b)]
        row[key]=round(sum(vals),2) if all(v is not None for v in vals) else None
    for key,numer,denom in [("roi","gmv","spend"),("cpuv","spend","uv"),("aov","gmv","orders")]:
        row[key]=round(row[numer]/row[denom],4) if row[numer] is not None and row[denom] is not None and row[denom]>0 else None
    joined.append(row)
metrics=[{"key":k,"label":("\u8fdb\u5e97\u91cf\uff08\u8d26\u53f7\u5408\u8ba1\uff0c\u975e\u53bb\u91cd\uff09" if k=="uv" else l),"unit":u} for k,l,u in fields if k in joined[0]]
datasets.append({"id":"huang-cid-total-daily","label":"\u7ea2\u732bCID \u00b7 \u4e24\u7c7b\u6295\u653e\u5408\u8ba1","period":"2026-10-01 ~ 2026-10-19","sourceId":s2["id"],"sourceUrl":s2["url"],"note":"\u6309\u65e5\u671f\u5bf9\u9f50\u6807\u51c6\u6295\u4e0e\u7b80\u5355\u6295\uff0c\u89c4\u6a21\u76f8\u52a0\uff0cROI\u6309GMV/\u6d88\u8017\u91cd\u7b97\uff1b\u8fdb\u5e97\u91cf\u4e3a\u8d26\u53f7\u53e0\u52a0\u975e\u53bb\u91cd\uff0c\u672a\u5e73\u5747CTR/CPC\u3002","metrics":metrics,"rows":joined})
out={"projectId":"huang-tiane","buildStatus":"in_progress","generatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"sources":[s1,s2],"tables":[table("huang-creator-execution","10\u6708\u8fbe\u4eba\u6267\u884c\u660e\u7ec6",kol,s1,"10\u6708\u6267\u884c\u8868\u8bfb\u53d6\u5feb\u7167"),table("huang-kos-notes","10\u6708KOS\u7b14\u8bb0\u660e\u7ec6",kos,s1,"10\u6708KOS\u53d1\u5e03\u8868\u8bfb\u53d6\u5feb\u7167")],"dailyDatasets":datasets,"kpis":[]}
(ROOT/"facts.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"tables":[[t["id"],len(t["rows"])] for t in out["tables"]],"datasets":[[d["id"],len(d["rows"])] for d in datasets],"cid_totals":{k:round(sum(r[k] for r in joined),2) for k in ("spend","orders","gmv","uv")}},ensure_ascii=False))
'''

# Unescape \uXXXX in raw content
decoded = content.encode('utf-8').decode('unicode-escape')
with open('docs/new-projects-sources/huang-tiane/source-a/build_core_facts.py', 'w', encoding='utf-8') as f:
    f.write(decoded)
print("build_core_facts.py generated cleanly.")
