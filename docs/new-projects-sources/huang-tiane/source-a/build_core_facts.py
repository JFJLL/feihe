# -*- coding: utf-8 -*-
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
    if not value or value.startswith("#") or value in ("-","â","/"): return None
    if "%" in value and not percent: return None
    try:
        n=float(value.replace(",","").replace("¥","").replace("￥","").replace("%",""))
        return n if math.isfinite(n) else None
    except ValueError: return None
def date(value):
    v=str(value or "").strip()
    m=re.fullmatch(r"(\d{4})[/-](\d{1,2})[/-](\d{1,2})",v)
    if m:
        try: return datetime.date(*map(int,m.groups())).isoformat()
        except ValueError: return None
    m2=re.fullmatch(r"(\d{1,2})月(\d{1,2})日",v)
    if m2:
        try: return datetime.date(2026,int(m2.group(1)),int(m2.group(2))).isoformat()
        except ValueError: return None
    return None
def flag(value):
    return True if value=="是" else False if value=="否" else None
cols={"index":"序号","kol_name":"达人昵称","account_tier":"账号量级","fans_w":"粉丝数（万）","kol_type":"达人类型","content_type":"内容类型","content_direction":"内容方向","dish_type":"菜品方向","price_raw":"平台裸价（元）","price_with_fee":"含平台费报价（元）","script_stage":"脚本登记","draft_stage":"初稿登记","scheduled_date":"预计发布日期","execution_status":"执行进度","actual_publish_date":"实际发布日期","source_date_text":"原表日期备注","note_id":"笔记ID","asset_collected":"素材已收集","account_name":"账号名称","publish_date":"发布日期","fs_active":"FS投放","cid_active":"CID投放","commerce_active":"商销投放"}
def table(id,title,rows,source,period):
    keys=list(rows[0]) if rows else []
    return {"id":id,"title":title,"period":period,"sourceId":source["id"],"sourceUrl":source["url"],"columns":[{"key":k,"title":cols.get(k,k),"type":"number" if k in ("index","fans_w","price_raw","price_with_fee") else "string"} for k in keys],"rows":rows}
def source(id,name,url,rawname):
    ts=datetime.datetime.fromtimestamp((RAW/rawname).stat().st_mtime,datetime.timezone.utc).isoformat()
    return {"id":id,"name":name,"url":url,"status":"ready","fetchedAt":ts,"detail":"完整原表读取；核心事实已提取，细分维度继续整理"}
s1=source("src-huang-tiane-kol-execution","黄天鹅红书种草执行表","https://yimeichuanbo.feishu.cn/wiki/HfYRwSbEKiBex5ks2uwc9S9ynog","wb1_kol_execution_GIQjnY.json")
s2=source("src-huang-tiane-cid-fs","黄天鹅红猫CID投放报表","https://yimeichuanbo.feishu.cn/wiki/KpHrwJt1picaxBkWB9NcaLlsnih","wb3_cid_fs_daily_Nm3Sev.json")
kol=[]
for r in read("wb1_kol_execution_GIQjnY.json")[1:]:
    if not any(x.strip() for x in r): continue
    kol.append({"index":num(cell(r,0)),"kol_name":cell(r,1),"account_tier":cell(r,2),"fans_w":num(cell(r,5)),"kol_type":cell(r,6),"content_type":cell(r,7),"content_direction":cell(r,8),"dish_type":cell(r,10),"price_raw":num(cell(r,15)),"price_with_fee":num(cell(r,16)),"script_stage":cell(r,18),"draft_stage":cell(r,19),"scheduled_date":cell(r,20),"execution_status":cell(r,21),"actual_publish_date":date(cell(r,23)),"source_date_text":cell(r,23),"note_id":cell(r,24),"asset_collected":flag(cell(r,30))})
assert len(kol)==31, len(kol)
assert sum(r["execution_status"]=="已发布" for r in kol)==18
assert sum(r["asset_collected"] is True for r in kol)==18
kos=[]
for r in read("wb1_kol_execution_wZtAgh.json")[1:]:
    if not any(x.strip() for x in r): continue
    kos.append({"account_name":cell(r,0),"account_tier":cell(r,3),"content_type":cell(r,4),"publish_date":date(cell(r,5)),"source_date_text":cell(r,5),"note_id":cell(r,7),"fs_active":flag(cell(r,9)),"cid_active":flag(cell(r,10)),"commerce_active":flag(cell(r,11))})
fields=[("spend","消耗","元"),("ctr","点击率","%"),("cpc","点击成本","元/次"),("cpm","千次曝光成本","元"),("orders","订单量","单"),("gmv","成交GMV","元"),("roi","成交ROI","倍"),("uv","进店量","人次"),("cpuv","进店成本","元/人次"),("aov","客单价","元/单")]
raw=read("wb3_cid_fs_daily_Nm3Sev.json")
datasets=[]
for off,slug,label,expected in [(0,"standard","标准投",(59024.76,1918,192884.09,3955)),(12,"simple","简单投",(42403.02,2257,168346.72,5434))]:
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
    datasets.append({"id":"huang-cid-"+slug+"-daily","label":"红猫CID · "+label,"period":rows[0]["date"]+" ~ "+rows[-1]["date"],"sourceId":s2["id"],"sourceUrl":s2["url"],"note":"标准投与简单投各自独立统计；进店量不可跨账号去重。","metrics":[{"key":k,"label":l,"unit":u} for k,l,u in fields],"rows":rows})
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
metrics=[{"key":k,"label":("进店量（账号合计，非去重）" if k=="uv" else l),"unit":u} for k,l,u in fields if k in joined[0]]
datasets.append({"id":"huang-cid-total-daily","label":"红猫CID · 两类投放合计","period":"2026-10-01 ~ 2026-10-19","sourceId":s2["id"],"sourceUrl":s2["url"],"note":"按日期对齐标准投与简单投，规模相加，ROI按GMV/消耗重算；进店量为账号叠加非去重，未平均CTR/CPC。","metrics":metrics,"rows":joined})
out={"projectId":"huang-tiane","buildStatus":"complete","generatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"sources":[s1,s2],"tables":[table("huang-creator-execution","10月达人执行明细",kol,s1,"10月执行表读取快照"),table("huang-kos-notes","10月KOS笔记明细",kos,s1,"10月KOS发布表读取快照")],"dailyDatasets":datasets,"kpis":[]}
(ROOT/"facts.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"tables":[[t["id"],len(t["rows"])] for t in out["tables"]],"datasets":[[d["id"],len(d["rows"])] for d in datasets],"cid_totals":{k:round(sum(r[k] for r in joined),2) for k in ("spend","orders","gmv","uv")}},ensure_ascii=False))

