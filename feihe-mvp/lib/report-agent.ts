export type MetricDefinition = { id:string; key:string; name:string; unit:string; aggregation:string; aliasesJson:string };
export type QueryPlan = {
  intent:string; period:{start:string;end:string}; requestedMetrics:string[]; requestedDimensions:string[];
  sources:Array<{id:string;name:string;type:string;reason:string}>; endpoints:Array<{id:string;name:string;method:string;path:string}>;
  warnings:string[]; steps:Array<{name:string;detail:string}>;
};
export type ReportSpec = {
  version:'1.0'; title:string; subtitle:string; period:{start:string;end:string}; generatedAt:string; engine:string;
  summary:string[]; kpis:Array<{key:string;label:string;value:number|string;unit?:string;delta?:string;tone?:string;note?:string}>;
  sections:Array<{id:string;title:string;eyebrow:string;kind:'trend'|'bars'|'table'|'matrix'|'funnel'|'insights'|'cards';description?:string;data:Array<Record<string,string|number>>}>;
  sources:Array<{name:string;type:string;freshness:string;rows:number}>; quality:Array<{label:string;value:number;status:string}>;
};

const iso=(date:Date)=>date.toISOString().slice(0,10);
const atDay=(input:string)=>{const d=new Date(`${input}T00:00:00+08:00`);return Number.isNaN(d.getTime())?new Date():d};

export function parsePeriod(prompt:string,now=new Date()){
  const absolute=[...prompt.matchAll(/(20\d{2})[年\-/.](\d{1,2})[月\-/.](\d{1,2})日?/g)].map(m=>`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`);
  if(absolute.length>=2)return {start:absolute[0],end:absolute[1]};
  if(absolute.length===1)return {start:absolute[0],end:absolute[0]};
  const month=prompt.match(/(20\d{2})年?(\d{1,2})月/);
  if(month){const year=Number(month[1]),m=Number(month[2]);return {start:`${year}-${String(m).padStart(2,'0')}-01`,end:iso(new Date(year,m,0))}}
  const near=prompt.match(/近\s*(\d{1,3})\s*天/);const days=near?Math.min(365,Math.max(1,Number(near[1]))):30;
  const start=new Date(now);start.setDate(start.getDate()-days+1);return {start:iso(start),end:iso(now)};
}

export function buildQueryPlan(prompt:string,metrics:MetricDefinition[],sources:Array<Record<string,unknown>>,endpoints:Array<Record<string,unknown>>):QueryPlan{
  const period=parsePeriod(prompt);const hay=prompt.toLowerCase();
  const matched=metrics.filter(metric=>{let aliases:string[]=[];try{aliases=JSON.parse(metric.aliasesJson||'[]')}catch{}return [metric.name,metric.key,...aliases].some(x=>hay.includes(String(x).toLowerCase()))});
  const requestedMetrics=(matched.length?matched:metrics.filter(x=>['spend','impressions','interactions','published_notes','positive_comments','negative_comments'].includes(x.key))).map(x=>x.key);
  const requestedDimensions=['趋势'];
  if(/达人|博主/.test(prompt))requestedDimensions.push('达人');
  if(/账户|子账户|聚光|投放/.test(prompt))requestedDimensions.push('聚光投放');
  if(/灵犀|母婴|大盘|赛道|机会|排行|top30/.test(prompt))requestedDimensions.push('灵犀母婴大盘');
  if(/内容|笔记|方向/.test(prompt))requestedDimensions.push('内容方向');
  if(/竞品|品牌/.test(prompt))requestedDimensions.push('本竞品对比');
  const chosenSources=sources.filter(s=>String(s.status||'').includes('连接')||String(s.status||'').includes('正常')||String(s.name||'').includes('灵犀')||String(s.name||'').includes('聚光')).map(s=>({id:String(s.id),name:String(s.name),type:String(s.type||'integration'),reason:String(s.kind||s.provider||'已连接')}));
  const chosenEndpoints=endpoints.filter(e=>Number(e.enabled)!==0).slice(0,10).map(e=>({id:String(e.id),name:String(e.name),method:String(e.method),path:String(e.path)}));
  const warnings:string[]=[];
  if(!chosenSources.length)warnings.push('当前没有状态正常的数据源，报告将仅使用项目数据库已有数据。');
  return {intent:/竞品/.test(prompt)?'本竞品与母婴大盘机会复盘':/舆情|评论|口碑/.test(prompt)?'社媒评论与舆情处置看板':/灵犀|赛道|大盘/.test(prompt)?'灵犀母婴大盘与聚光经营看板':'启萃经营与社媒增长全景看板',period,requestedMetrics,requestedDimensions,sources:chosenSources,endpoints:chosenEndpoints,warnings,steps:[
    {name:'理解需求与规划',detail:`识别为 ${/灵犀|赛道/.test(prompt)?'灵犀赛道分析':/竞品/.test(prompt)?'竞品对比':/舆情|评论/.test(prompt)?'舆情分析':'经营全景'}任务，分析周期 ${period.start} 至 ${period.end}`},
    {name:'选择数据地图接口',detail:`匹配 ${chosenSources.length} 个数据源、${chosenEndpoints.length} 个接口，并自动调度聚光与灵犀实时数据`},
    {name:'口径校验与事实组装',detail:'统一费用、曝光、互动、评论、聚光投放消耗与灵犀母婴 13 细分子类目口径，杜绝编造数据'},
    {name:'编译生成看板报告',detail:'输出决策摘要、核心指标、供需四象限、Top 30 排行榜与下一步动作的受控 HTML 报告'},
  ]};
}

export const reportHtml=(spec:ReportSpec)=>`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(spec.title)}</title><style>
  :root{color-scheme:light;font-family:Inter,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background-color:#f8fafc;color:#0f172a}
  body{margin:0;padding:36px 20px;background-color:#f8fafc;color:#0f172a}.wrap{max-width:1440px;margin:auto}
  .head{padding:32px 36px;border-radius:16px;background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#3b82f6 100%);color:#ffffff;box-shadow:0 4px 16px rgba(37,99,235,0.15)}
  .head small{color:#60a5fa;font-weight:700;letter-spacing:1.5px;font-size:11px}
  h1{margin:8px 0 6px;font-size:26px;color:#ffffff;font-weight:700}
  .muted{color:#94a3b8;font-size:13px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:24px 0}
  .kpi{border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,0.03);transition:transform .2s}
  .kpi:hover{transform:translateY(-2px)}
  .kpi span{font-size:12px;color:#64748b;font-weight:500}
  .kpi b{display:block;margin:8px 0;font-size:26px;color:#1d4ed8;font-family:monospace,sans-serif}
  .kpi small{color:#64748b;font-size:11px}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
  .card{border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,0.03);display:flex;flex-direction:column}
  .card.wide{grid-column:1 / -1}
  .card small{color:#60a5fa;font-weight:700;font-size:10px;letter-spacing:1px}
  .card h2{font-size:18px;margin:4px 0 14px;color:#0f172a}
  .card .desc{font-size:12px;color:#475569;margin-top:-8px;margin-bottom:14px}
  .card table{width:100%;border-collapse:collapse;font-size:12px}
  .card th{padding:11px 14px;background:#f1f5f9;color:#334155;text-align:left;border-bottom:2px solid #cbd5e1;font-weight:700;font-size:13px}
  .card td{padding:11px 14px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:500;font-size:13px}
  .card tr:hover td{background:#f8fafc;color:#000000}
  .card ul{margin:0;padding-left:20px}
  .card li{margin:10px 0;color:#334155;font-size:14px;line-height:1.6}
  .case-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .case{overflow:hidden;border:1px solid #e2e8f0;border-radius:11px;background:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.02)}
  .case img{display:block;width:100%;height:150px;object-fit:cover;background:#f1f5f9}
  .case div{padding:12px}
  .case strong{display:block;min-height:36px;font-size:12px;line-height:1.5;color:#0f172a}
  .case p{margin:6px 0;color:#8fa3b9;font-size:10px}
  .case dl{display:grid;grid-template-columns:repeat(3,1fr);margin:0}
  .case dd{margin:3px 0 0;color:#7db0ff;font-weight:700;font-size:12px}
  .case dt{color:#64748b;font-size:9px}
  .pill{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
  .pill.blue{background:rgba(59,130,246,0.15);color:#93c5fd}
  @media(max-width:900px){body{padding:18px}.grid{grid-template-columns:1fr}.case-grid{grid-template-columns:repeat(2,1fr)}}
  </style></head><body><div class="wrap"><section class="head"><small>INTELLIGENCE EXECUTIVE REPORT</small><h1>${escapeHtml(spec.title)}</h1><p class="muted">${escapeHtml(spec.subtitle)} · ${spec.period.start} — ${spec.period.end} · 生成引擎: ${escapeHtml(spec.engine)}</p></section><section class="kpis">${spec.kpis.map(k=>`<article class="kpi"><span>${escapeHtml(k.label)}</span><b>${escapeHtml(String(k.value))}${escapeHtml(k.unit||'')}</b><small>${escapeHtml(k.note||'')}</small></article>`).join('')}</section><section class="grid">${spec.sections.map(s=>`<article class="card ${s.kind==='table'||s.kind==='cards'?'wide':''}"><div><small>${escapeHtml(s.eyebrow)}</small><h2>${escapeHtml(s.title)}</h2>${s.description?`<p class="desc">${escapeHtml(s.description)}</p>`:''}</div>${s.kind==='insights'?`<ul>${s.data.map(x=>`<li>${escapeHtml(String(x.text||''))}</li>`).join('')}</ul>`:s.kind==='cards'?`<div class="case-grid">${s.data.slice(0,8).map(row=>`<article class="case">${row.coverUrl?`<img src="${escapeHtml(String(row.coverUrl))}" alt="">`:''}<div><strong>${escapeHtml(String(row.title||row.noteId||'笔记'))}</strong><p>${escapeHtml(String(row.author||'未知作者'))} · ${escapeHtml(String(row.category||'待分类'))}</p><dl><span><dt>互动</dt><dd>${escapeHtml(String(row.interactions||0))}</dd></span><span><dt>评论</dt><dd>${escapeHtml(String(row.comments||0))}</dd></span><span><dt>负向</dt><dd>${escapeHtml(String(row.negative||0))}</dd></span></dl></div></article>`).join('')}</div>`:s.data&&s.data.length?`<div style="overflow-x:auto;"><table><thead><tr>${Object.keys(s.data[0]||{}).map(k=>`<th>${escapeHtml(k)}</th>`).join('')}</tr></thead><tbody>${s.data.map(row=>`<tr>${Object.values(row).map(v=>`<td>${escapeHtml(String(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<p class="muted">暂无数据</p>`}</article>`).join('')}</section></div></body></html>`;

function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char))}
export const addDays=(date:string,days:number)=>{const d=atDay(date);d.setDate(d.getDate()+days);return iso(d)};
