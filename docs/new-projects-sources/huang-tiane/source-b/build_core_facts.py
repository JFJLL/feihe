import csv,io,json,re,math,sys,datetime,collections
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
ROOT=Path("docs/new-projects-sources/huang-tiane/source-b");RAW=ROOT/"raw"
def read(name):
 j=json.loads((RAW/name).read_text(encoding="utf-8"))
 return list(csv.reader(io.StringIO(re.sub(r"^\[row=\d+\] ?","",j["annotated_csv"],flags=re.M))))
def cell(r,i):return r[i].strip() if i<len(r) else ""
def num(v,pct=False):
 s=str(v or "").strip()
 if not s or s.startswith("#") or s in ("-","—","/") or ("%" in s and not pct):return None
 try:
  n=float(s.replace(",","").replace("¥","").replace("￥","").replace("%",""))
  return n if math.isfinite(n) else None
 except ValueError:return None
def day(s):
 s=str(s).strip()
 m=re.fullmatch(r"(\d{4})[/-](\d{1,2})[/-](\d{1,2})",s)
 if not m:return None
 try:return datetime.date(*map(int,m.groups())).isoformat()
 except ValueError:return None
def source(id,name,url,file,detail):
 return {"id":id,"name":name,"url":url,"status":"ready","fetchedAt":datetime.datetime.fromtimestamp((RAW/file).stat().st_mtime,datetime.timezone.utc).isoformat(),"detail":detail}
sb=source("src-huang-tiane-brand-fs","黄天鹅品牌线26年10月项目报表","https://yimeichuanbo.feishu.cn/sheets/F42ksAyO8hKRGNt2plhccnSWnNh","brand_fs_Nm3Sev.json","17个sheet完整读取；日报CPE为31.81，聊天3181为显示差异。")
sc=source("src-huang-tiane-commerce-canonical","黄天鹅商销日报主数据源","https://yimeichuanbo.feishu.cn/wiki/CqyPwlUTNiiD0lkXlZJcuyIYnCc","shangxiao_c46f52.json","8个sheet完整读取；日数据透视存在#REF!，使用日报底表汇总。历史UV类型异常保留缺失。")
bf=[("spend","消耗","元"),("impressions","展现量","次"),("clicks","点击量","次"),("ctr","点击率","%"),("cpc","点击成本","元/次"),("cpm","千次曝光成本","元"),("plays_5s","5秒播放量","次"),("ctr_5s","5秒播放率","%"),("cpc_5s","5秒播放成本","元/次"),("engagements","互动量","次"),("cpe","互动成本","元/次"),("seed_i","种草I人群","人"),("cpi","种草I成本","元/人"),("seed_ti","种草TI人群","人"),("cpti","种草TI成本","元/人"),("seed_total","I+TI人群（源表口径）","人"),("cp_total","I+TI成本","元/人"),("uv","进店量","人次"),("cpuv","进店成本","元/人次")]
br=read("brand_fs_Nm3Sev.json")
brand=[];brand_summary=None
for r in br:
 m=re.fullmatch(r"(\d{1,2})月(\d{1,2})日",cell(r,0))
 values={k:num(cell(r,i),k in ("ctr","ctr_5s")) for i,(k,_,_) in enumerate(bf,1)}
 if m:
  d=datetime.date(2026,*map(int,m.groups())).isoformat()
  if "2026-10-01"<=d<="2026-10-19":brand.append({"date":d,**values})
 elif cell(r,0)=="总计":brand_summary=values
brand.sort(key=lambda r:r["date"])
assert len(brand)==19,len(brand)
assert abs(sum(r["spend"] for r in brand)-178342.67)<0.05
assert sum(r["engagements"] for r in brand)==5606
assert brand_summary["cpe"]==31.81
brand_budget=num(cell(br[1],11));assert brand_budget==565475.09
cf=[("spend",17,"消耗","元"),("impressions",18,"展现量","次"),("clicks",21,"点击量","次"),("engagements",43,"互动量","次"),("uv",49,"7日商品访客量（归因叠加）","人次"),("cart",51,"7日商品加购量","次"),("orders",59,"7日支付订单量（转化时间）","单"),("gmv",61,"7日支付GMV（转化时间）","元")]
rows=read("shangxiao_c46f52.json");head=rows[0]
assert "访客量" in head[49] and "支付订单量" in head[59] and "支付金额" in head[61]
groups=collections.defaultdict(list)
for r in rows[1:]:
 d=day(cell(r,0))
 if d and d<="2026-10-19":groups[d].append(r)
commerce=[]
for d,rs in sorted(groups.items()):
 out={"date":d}
 for k,i,_,_ in cf:
  vals=[num(cell(r,i)) for r in rs]
  out[k]=round(sum(vals),2) if all(v is not None for v in vals) else None
 for k,n,de,mul in [("roi","gmv","spend",1),("cpuv","spend","uv",1),("cost_per_cart","spend","cart",1),("cost_per_order","spend","orders",1),("aov","gmv","orders",1),("cpc","spend","clicks",1),("ctr","clicks","impressions",100),("cpm","spend","impressions",1000),("cpe","spend","engagements",1)]:
  out[k]=round(out[n]/out[de]*mul,4) if out[n] is not None and out[de] is not None and out[de]>0 else None
 commerce.append(out)
assert commerce
totals={}
for k,_,_,_ in cf:
 vals=[r[k] for r in commerce];totals[k]=round(sum(vals),2) if all(v is not None for v in vals) else None
assert abs(totals["spend"]-25025.29)<0.05,totals
assert totals["orders"]==558,totals
assert abs(totals["gmv"]-28023.72)<0.05,totals
extra=[("roi","成交ROI","倍"),("cpuv","商品访客成本","元/人次"),("cost_per_cart","商品加购成本","元/次"),("cost_per_order","支付订单成本","元/单"),("aov","客单价","元/单"),("cpc","点击成本","元/次"),("ctr","点击率","%"),("cpm","千次曝光成本","元"),("cpe","互动成本","元/次")]
cm=[(k,l,u) for k,_,l,u in cf]+extra
def dataset(id,label,rs,metrics,src,note):
 return {"id":id,"label":label,"period":rs[0]["date"]+" ~ "+rs[-1]["date"],"sourceId":src["id"],"sourceUrl":src["url"],"note":note,"metrics":[{"key":k,"label":l,"unit":u} for k,l,u in metrics],"rows":rs}
datasets=[dataset("huang-brand-daily","品牌线FS",brand,bf,sb,"I/TI按源表定义展示，不作为连续转化漏斗。"),dataset("huang-commerce-daily","商销投放",commerce,cm,sc,"跨7-10月累计；按转化时间的7日归因指标。历史UV百分值类型异常保留null，非真实0；来源透视#REF!由原始底表重建。")]
cols={k:l for k,l,u in bf};cols.update({k:l for k,l,u in cm})
def table(id,title,records,src,period,labels=None):
 labels=labels or cols
 return {"id":id,"title":title,"period":period,"sourceId":src["id"],"sourceUrl":src["url"],"columns":[{"key":k,"title":labels.get(k,k),"type":"number" if isinstance(v,(float,int)) else "string"} for k,v in records[0].items()],"rows":records}
tables=[table("huang-brand-summary","品牌线10月汇总（源表）",[brand_summary],sb,datasets[0]["period"]),table("huang-brand-budget","品牌线10月预算与消耗",[{"budget":brand_budget,"spend":brand_summary["spend"],"reportedProgress":num(cell(br[0],0),True),"calculatedProgress":round(brand_summary["spend"]/brand_budget*100,4)}],sb,"截至2026-10-19",{"budget":"10月预算（元）","spend":"累计消耗（元）","reportedProgress":"源表消耗进度（%）","calculatedProgress":"按预算重算进度（%）"}),table("huang-commerce-summary","商销全期底表汇总",[totals],sc,datasets[1]["period"])]
out={"projectId":"huang-tiane","buildStatus":"in_progress","generatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"sources":[sb,sc],"tables":tables,"dailyDatasets":datasets,"kpis":[],"audit":{"commercePivotError":"Dz6eHe!A2=#REF!","commerceSourceRecords":sum(map(len,groups.values())),"commerceInvalidUvDays":sum(r["uv"] is None for r in commerce),"manualReportedGmv":27665.22,"detailComputedGmv":totals["gmv"],"gmvDifference":round(totals["gmv"]-27665.22,2),"manualReportedUv":4652,"note":"聊天累计GMV比原始底表少358.50，恰等于10/19当日GMV，保留来源差异；历史UV不从聊天值摊回日数据。"}}
(ROOT/"facts.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"datasets":[[d["id"],len(d["rows"]),d["period"]] for d in datasets],"totals":totals,"audit":out["audit"]},ensure_ascii=False))
