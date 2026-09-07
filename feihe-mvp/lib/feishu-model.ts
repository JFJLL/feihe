export const FEISHU_DOCUMENTS = [
  { id: 'feishu-daily-kpi-dashboard', title: '启萃｜26年丨分日数据看板', wiki: 'CEsvwg65MikAGOkqKItcR7wkn3b', sheets: [
    { id: '3Wsban', name: '【!】蒲公英数据源（日）@AE', use: '内容管理：笔记、阅读、曝光、互动、报价', end: 'AN', kind: 'notes' },
    { id: '4bTvDu', name: '达人信息数据源-【笔记库】@AE', use: '内容管理：达人层级、形式、场景、发布信息', end: 'T', kind: 'creators' },
    { id: '1XSPsH', name: '聚光数据源（日）@投手', use: '项目总览：聚光全量消耗、曝光、点击、加权CTR（与周投放表范围不同）', end: 'AR', kind: 'ads' },
  ] },
  { id: 'feishu-weekly-trend', title: '【飞鹤启萃】周趋势变化底表', wiki: 'SVwkw52kZiSlLEkQuaNcHvrynGg', sheets: [
    { id: 'kMYs9o', name: '【日更】A-kfsop周投资数据（Q3）', use: '项目总览：预算、星盟消耗、CPUV；仅已填实际投放的日期', end: 'BE', kind: 'weekly' },
    { id: 'PNZ39H', name: '【日更】站内搜索指数@翠娴', use: '竞品分析：启萃灵犀/聚光搜索指数趋势', end: 'D', kind: 'search' },
  ] },
  { id: 'feishu-content-planning', title: '【飞鹤启萃】内容规划all in one', wiki: 'H0iDwGhffiL2UHk9G96cpnR4nBe', sheets: [
    { id: '7XkqoO', name: '内容切角们', use: '内容管理、灵感选题：人群、阶段、痛点、达人类型', end: 'T', kind: 'angles' },
    { id: '7G0dkc', name: '启萃场景库', use: '内容管理、灵感选题：一级/二级场景、内容类型、切入点', end: 'V', kind: 'scenes' },
  ] },
  { id: 'feishu-competitor-monthly', title: '【代理共填】飞鹤竞品月报数据收集表by月更新', wiki: 'J8bnw5Mx4inxbukp2HYcgjMznJg', sheets: [
    ...[['xEsZPK','【标准参考】金领冠-yx'],['BOSe6L','美素佳儿-yx'],['cbP9Vu','爱他美-ym'],['l22y2e','a2-bw'],['eJ5bJH','飞鹤-ym'],['Qwgs53','合生元-bw'],['H8azly','君乐宝-zy']].map(([id,name]) => ({ id, name, use: '竞品分析：品牌/品线月度搜索指数（保留源表原值）', end: 'M', kind: 'competitor' })),
  ] },
];
export type SheetDefinition = typeof FEISHU_DOCUMENTS[number]['sheets'][number];
export type SheetReport = { document: string; sheetId: string; sheetName: string; url: string; usage: string; status: 'success' | 'error'; rows: number; latestDate: string; checkedAt: string; changed: boolean; error?: string };
export type SearchPoint = { date: string; lingxi: number | null; spotlight: number | null };
export type MonthlyPoint = { brand: string; month: string; value: string; sheetId: string };
export type PlanningRow = { audience: string; stage: string; scene: string; detail: string; format: string };
export type FeishuData = {
  checkedAt: string;
  reports: SheetReport[];
  search: SearchPoint[];
  competitor: MonthlyPoint[];
  planning: PlanningRow[];
  latestDate: string;
  daily: Record<string, number | string | null>[];
  intelligence?: import('./competitor-intelligence').CompetitorIntelligenceData;
};

export function cellText(v: unknown): string {
  if (Array.isArray(v)) return v.map(x => x && typeof x === 'object' ? String(x.text || '') : String(x ?? '')).join('').trim();
  return String(v ?? '').trim();
}
export function cellNumber(v: unknown): number | null {
  const s = cellText(v).replace(/[,，￥¥\s]/g, '');
  if (!s || !/^-?\d+(\.\d+)?%?$/.test(s)) return null;
  const n = Number(s.replace('%',''));
  return Number.isFinite(n) ? (s.endsWith('%') ? n / 100 : n) : null;
}
export function cellDate(v: unknown): string {
  const n = typeof v === 'number' ? v : /^\d{5}(\.\d+)?$/.test(cellText(v)) ? Number(v) : null;
  if (n !== null && n > 20000 && n < 100000) return new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0,10);
  const s = cellText(v).replace(/[/.年]/g,'-').replace('月','-').replace('日','');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s|T|$)/);
  if (!m) return '';
  const date = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === date ? date : '';
}
export function parseSearch(rows: unknown[][]): SearchPoint[] {
  return rows.map(r => ({date:cellDate(r[1]),lingxi:cellNumber(r[2]),spotlight:cellNumber(r[3])})).filter(r => r.date && (r.lingxi !== null || r.spotlight !== null)).sort((a,b)=>a.date.localeCompare(b.date));
}
export function parseMonthly(rows: unknown[][], sheetId: string): MonthlyPoint[] {
  const header = rows.findIndex(r => cellText(r[0]).includes('品牌/品线') && cellText(r[1]) === '1月');
  if (header < 0) throw new Error('未找到品牌/品线月度表头');
  const out: MonthlyPoint[] = [];
  for (const row of rows.slice(header+1)) {
    const brand = cellText(row[0]);
    if (/^[二三四五六七八九十][、.]/.test(brand)) break;
    if (!brand || /^(品牌\/品线|口径|备注|来源)/.test(brand)) continue;
    for (let i=1;i<=12;i++) {
      const value=cellText(row[i]);
      if (/^\d+(\.\d+)?\s*万?$/.test(value.replace(/,/g,''))) out.push({brand,month:`${String(i).padStart(2,'0')}月`,value,sheetId});
    }
  }
  return out;
}
export function parsePlanning(rows: unknown[][], kind: string): PlanningRow[] {
  if (kind === 'angles') {
    let audience='';
    return (rows[1] || []).flatMap((v,i)=>{
      if (i<2) return [];
      audience=cellText(rows[0]?.[i]) || audience;
      const detail=cellText(rows[2]?.[i]);
      return detail && detail!=='/' ? [{audience,stage:cellText(v),scene:'内容切角',detail,format:cellText(rows[3]?.[i])}] : [];
    });
  }
  let audience='',stage='',scene='';
  return rows.slice(1).flatMap(r=>{
    if (!cellText(r[5])) return [];
    audience=cellText(r[1]) || audience; stage=cellText(r[0]) || stage; scene=cellText(r[4]) || scene;
    return [{audience,stage,scene,detail:cellText(r[5])+(cellText(r[7])?' · '+cellText(r[7]):''),format:cellText(r[6])}];
  });
}
export function aggregateAds(rows: unknown[][]) {
  const map = new Map<string, Record<string, number | string>>();
  for (const r of rows.slice(1)) {
    const date=cellDate(r[9]); if(!date || cellNumber(r[15])===null) continue;
    const p=map.get(date) || {date,actual_spend:0,feed_spend:0,search_spend:0,impressions:0,clicks:0,interactions:0,feedImpressions:0,feedClicks:0,searchImpressions:0,searchClicks:0};
    const add=(k:string,v:unknown)=>{p[k]=Number(p[k] || 0)+(cellNumber(v) ?? 0);};
    add('actual_spend',r[15]);add('impressions',r[16]);add('clicks',r[17]);add('interactions',r[26]);
    const channel=cellText(r[10]).includes('搜索')?'search':/信息流|视频/.test(cellText(r[10]))?'feed':'';
    if(channel){add(channel+'_spend',r[15]);add(channel+'Impressions',r[16]);add(channel+'Clicks',r[17]);}
    map.set(date,p);
  }
  return [...map.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(p=>({...p,feed_ctr:Number(p.feedImpressions)>0?Number(p.feedClicks)/Number(p.feedImpressions)*100:null,search_ctr:Number(p.searchImpressions)>0?Number(p.searchClicks)/Number(p.searchImpressions)*100:null}));
}
export function parseWeekly(rows: unknown[][]) {
  return rows.flatMap(r=>{
    const date=cellDate(r[1]);
    const actual=[15,16,18,27,28,30].map(i=>cellNumber(r[i]));
    if(!date || actual.every(n=>n===null)) return [];
    const feed=(actual[0]??0)+(actual[1]??0)+(actual[3]??0)+(actual[4]??0);
    const search=(actual[2]??0)+(actual[5]??0);
    const plan=[7,8,9,10].map(i=>cellNumber(r[i]));
    const planSpend=plan.every(n=>n===null)?null:plan.reduce<number>((a,b)=>a+(b??0),0);
    return [{date,plan_spend:planSpend,actual_spend:feed+search,feed_spend:feed,search_spend:search,achieve_pct:planSpend?(feed+search)/planSpend*100:null,xhm_cpuv:cellNumber(r[32]),xhx_cpuv:cellNumber(r[20])}];
  }).sort((a,b)=>a.date.localeCompare(b.date));
}
