export const FEISHU_DOCUMENTS = [
  { id: 'feishu-daily-kpi-dashboard', title: '启萃｜26年丨分日数据看板', wiki: 'CEsvwg65MikAGOkqKItcR7wkn3b', sheets: [
    { id: '3Wsban', name: '【!】蒲公英数据源（日）@AE', use: '内容管理：笔记、阅读、曝光、互动、报价', end: 'AN', kind: 'notes' },
    { id: '4bTvDu', name: '达人信息数据源-【笔记库】@AE', use: '内容管理：达人层级、形式、场景、发布信息', end: 'T', kind: 'creators' },
    { id: '1XSPsH', name: '聚光数据源（日）@投手', use: '项目总览：聚光全量消耗、曝光、点击、加权CTR', end: 'AR', kind: 'ads' },
    { id: 'FZqyGk', name: 'KPI内部管理@PM', use: '项目总览：月度KPI、I+TI人群、爆文率、达人数量', end: 'AY', kind: 'kpi_internal' },
    { id: 'ICUwp9', name: '爆文笔记库', use: '内容管理：近万互动爆文笔记', end: 'Q', kind: 'viral_notes' },
  ] },
  { id: 'feishu-weekly-trend', title: '【飞鹤启萃】周趋势变化底表', wiki: 'SVwkw52kZiSlLEkQuaNcHvrynGg', sheets: [
    { id: 'kMYs9o', name: '【日更】A-kfsop周投资数据（Q3）', use: '项目总览：预算、星盟消耗、CPUV', end: 'BE', kind: 'weekly' },
    { id: 'PNZ39H', name: '【日更】站内搜索指数@翠娴', use: '竞品分析：启萃灵犀/聚光搜索指数趋势', end: 'D', kind: 'search' },
    { id: 'Kg5KCQ', name: '【周五更】启萃日常周KPI监测表@翠娴', use: '项目总览：周度KPI达成率、I+TI人群、爆文率', end: 'AQ', kind: 'kpi_weekly' },
    { id: 'bBV9tp', name: '【月更】I+TI留存@翠娴', use: '项目总览：I+TI人群资产月度趋势', end: 'T', kind: 'iti_retention' },
  ] },
  { id: 'feishu-content-planning', title: '【飞鹤启萃】内容规划all in one', wiki: 'H0iDwGhffiL2UHk9G96cpnR4nBe', sheets: [
    { id: '7XkqoO', name: '内容切角们', use: '内容管理、灵感选题：人群、阶段、痛点、达人类型', end: 'T', kind: 'angles' },
    { id: '7G0dkc', name: '启萃场景库', use: '内容管理、灵感选题：一级/二级场景、内容类型、切入点', end: 'V', kind: 'scenes' },
    { id: 'V5bEy9', name: '卡审话术总结', use: '内容管理：卡审类型、原因、话术、替换话术', end: 'U', kind: 'content_risk' },
    { id: 'ctIAHL', name: '竞品问题收集', use: '竞品分析：品牌、品线、问题类别、讨论点', end: 'V', kind: 'competitor_issues' },
    { id: 'vKuDWB', name: '本品消费者反馈', use: '内容管理：消费者吐槽点、类型、对应话术', end: 'O', kind: 'consumer_feedback' },
  ] },
  { id: 'feishu-competitor-monthly', title: '【代理共填】飞鹤竞品月报数据收集表by月更新', wiki: 'J8bnw5Mx4inxbukp2HYcgjMznJg', sheets: [
    ...[['xEsZPK','【标准参考】金领冠-yx'],['BOSe6L','美素佳儿-yx'],['cbP9Vu','爱他美-ym'],['l22y2e','a2-bw'],['eJ5bJH','飞鹤-ym'],['Qwgs53','合生元-bw'],['H8azly','君乐宝-zy']].map(([id,name]) => ({ id, name, use: '竞品分析：品牌/品线月度搜索指数（保留源表原值）', end: 'M', kind: 'competitor' })),
  ] },
  { id: 'feishu-comment-execution', title: '供应商「启萃」评论区文案+表情包执行文档', wiki: 'Ag0QwaIbain4ZFkOAMLcKI9tnyd', sheets: [
    { id: 'RMwjy9', name: '总表', use: '评论执行：月度执行统计、完成进度、结算进度', end: 'S', kind: 'comment_summary' },
    { id: 'q79OwB', name: '7月达人链接失效量', use: '评论执行：链接失效评论明细', end: 'T', kind: 'comment_broken' },
    { id: 'f4berX', name: '7月达人修改评论', use: '评论执行：需修改评论明细', end: 'R', kind: 'comment_modified' },
  ] },
];
export type SheetDefinition = typeof FEISHU_DOCUMENTS[number]['sheets'][number];
export type SheetReport = { document: string; sheetId: string; sheetName: string; url: string; usage: string; status: 'success' | 'error'; rows: number; latestDate: string; checkedAt: string; changed: boolean; error?: string };
export type SearchPoint = { date: string; lingxi: number | null; spotlight: number | null };
export type MonthlyPoint = { brand: string; month: string; value: string; sheetId: string };
export type PlanningRow = { audience: string; stage: string; scene: string; detail: string; format: string };
export type CommentExecutionRow = { date: string; type: string; textCount: number; emojiCount: number; total: number; progress: string; settlement: string; month: string };
export type CommentBrokenRow = { index: number; blogger: string; noteUrl: string; commentForm: string; replyForm: string; script: string; status: string; remark: string };
export type CommentModifiedRow = { index: number; blogger: string; noteUrl: string; commentForm: string; replyForm: string; script: string; internalReview: string; remark: string; reviewStatus: string };
export type KpiInternalRow = { month: string; project: string; dimension: string; lat: string; cost: number | null; cpuv: number | null; storeUv: number | null; exposure: number | null; readCount: number | null; interaction: number | null; cpm: number | null; cpc: number | null; cpe: number | null; itiTotal: number | null; cpIti: number | null; earlyRatio: number | null; searchUv: number | null; cpSearchUv: number | null; viralCount: number | null; topKol: number | null; waist: number | null; junior: number | null; amateur: number | null; seoJunior: number | null; seoAmateur: number | null; totalCreators: number | null };
export type KpiWeeklyRow = { phase: string; agency: string; period: string; project: string; subItem: string; dimension: string; cost: number | null; settlementCost: number | null; cpuvEcom: number | null; storeUvEcom: number | null; cpuvSpotlight: number | null; storeUvSpotlight: number | null; exposure: number | null; readCount: number | null; interaction: number | null; cpm: number | null; cpc: number | null; cpe: number | null; ctr: number | null; itiTotal: number | null; earlyIti: number | null; cpIti: number | null; earlyItiRatio: number | null; tiTotal: number | null; earlyTiTotal: number | null; viralRate: number | null; topKol: number | null; waist: number | null; junior: number | null; amateur: number | null; seoJunior: number | null; seoAmateur: number | null };
export type ItiRetentionRow = { date: string; feiheIti: number | null; qicuiIti: number | null; qicuiEarlyIti: number | null };
export type ContentRiskRow = { riskType: string; reason: string; originalScript: string; replacementScript: string; tips: string };
export type CompetitorIssueRow = { time: string; week: string; brand: string; productLine: string; category: string; noteUrl: string; discussion: string; remark: string };
export type ConsumerFeedbackRow = { postTime: string; collector: string; platform: string; dimension: string; publishDate: string; noteTitle: string; noteContent: string; noteUrl: string; interaction: number | null; product: string; complaintPoint: string; complaintType: string; commentComplaint: string; responseScript: string };
export type ViralNoteRow = { title: string; author: string; interaction: number | null; comments: number | null; url: string };
export type FeishuData = {
  checkedAt: string;
  reports: SheetReport[];
  search: SearchPoint[];
  competitor: MonthlyPoint[];
  planning: PlanningRow[];
  latestDate: string;
  daily: Record<string, number | string | null>[];
  intelligence?: import('./competitor-intelligence').CompetitorIntelligenceData;
  commentExecution?: CommentExecutionRow[];
  commentBroken?: CommentBrokenRow[];
  commentModified?: CommentModifiedRow[];
  kpiInternal?: KpiInternalRow[];
  kpiWeekly?: KpiWeeklyRow[];
  itiRetention?: ItiRetentionRow[];
  contentRisk?: ContentRiskRow[];
  competitorIssues?: CompetitorIssueRow[];
  consumerFeedback?: ConsumerFeedbackRow[];
  viralNotes?: ViralNoteRow[];
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

// === 新增解析函数 ===

export function parseCommentSummary(rows: unknown[][]): CommentExecutionRow[] {
  const out: CommentExecutionRow[] = [];
  // 7月数据在 A-G 列（索引0-6）：执行时间,执行类型,纯文案,表情包,执行数量,完成进度,结算进度
  // 8月数据在 I-N 列（索引8-13）：执行时间,执行类型,纯文案,执行数量,完成进度,结算进度（无表情包列）
  const months = [
    { month: '7月', cols: { date: 0, type: 1, text: 2, emoji: 3, total: 4, progress: 5, settlement: 6 } },
    { month: '8月', cols: { date: 8, type: 9, text: 10, emoji: -1, total: 11, progress: 12, settlement: 13 } },
  ];
  for (const m of months) {
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i];
      const date = cellDate(r[m.cols.date]);
      const type = cellText(r[m.cols.type]);
      if (!date || !type) continue;
      const textCount = cellNumber(r[m.cols.text]) ?? 0;
      const total = cellNumber(r[m.cols.total]) ?? 0;
      const emojiCount = m.cols.emoji >= 0 ? (cellNumber(r[m.cols.emoji]) ?? 0) : Math.max(0, total - textCount);
      out.push({
        date,
        type,
        textCount,
        emojiCount,
        total,
        progress: cellText(r[m.cols.progress]),
        settlement: cellText(r[m.cols.settlement]),
        month: m.month,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function parseCommentBroken(rows: unknown[][]): CommentBrokenRow[] {
  const out: CommentBrokenRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const index = cellNumber(r[0]);
    const blogger = cellText(r[1]);
    if (!blogger) continue;
    const linkVal = r[2];
    const noteUrl = Array.isArray(linkVal) ? linkVal.find(x => x?.link)?.link || '' : cellText(linkVal);
    out.push({
      index: index ?? i,
      blogger,
      noteUrl,
      commentForm: cellText(r[3]),
      replyForm: cellText(r[4]),
      script: cellText(r[5]),
      status: cellText(r[7]),
      remark: cellText(r[8]),
    });
  }
  return out;
}

export function parseCommentModified(rows: unknown[][]): CommentModifiedRow[] {
  const out: CommentModifiedRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const index = cellNumber(r[0]);
    const blogger = cellText(r[1]);
    if (!blogger) continue;
    const linkVal = r[2];
    const noteUrl = Array.isArray(linkVal) ? linkVal.find(x => x?.link)?.link || '' : cellText(linkVal);
    out.push({
      index: index ?? i,
      blogger,
      noteUrl,
      commentForm: cellText(r[3]),
      replyForm: cellText(r[4]),
      script: cellText(r[5]),
      internalReview: cellText(r[7]),
      remark: cellText(r[8]),
      reviewStatus: cellText(r[10]),
    });
  }
  return out;
}

export function parseKpiInternal(rows: unknown[][]): KpiInternalRow[] {
  const out: KpiInternalRow[] = [];
  // 表头在第2行（索引1），数据从第3行（索引2）开始
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const month = cellText(r[0]);
    const dimension = cellText(r[3]);
    if (!month || !dimension) continue;
    out.push({
      month,
      project: cellText(r[1]),
      dimension,
      lat: cellText(r[4]),
      cost: cellNumber(r[5]),
      cpuv: cellNumber(r[6]),
      storeUv: cellNumber(r[7]),
      exposure: cellNumber(r[8]),
      readCount: cellNumber(r[9]),
      interaction: cellNumber(r[11]),
      cpm: cellNumber(r[12]),
      cpc: cellNumber(r[13]),
      cpe: cellNumber(r[15]),
      itiTotal: cellNumber(r[16]),
      cpIti: cellNumber(r[17]),
      earlyRatio: cellNumber(r[18]),
      searchUv: cellNumber(r[19]),
      cpSearchUv: cellNumber(r[20]),
      viralCount: cellNumber(r[21]),
      topKol: cellNumber(r[22]),
      waist: cellNumber(r[23]),
      junior: cellNumber(r[24]),
      amateur: cellNumber(r[25]),
      seoJunior: cellNumber(r[26]),
      seoAmateur: cellNumber(r[27]),
      totalCreators: cellNumber(r[28]),
    });
  }
  return out;
}

export function parseKpiWeekly(rows: unknown[][]): KpiWeeklyRow[] {
  const out: KpiWeeklyRow[] = [];
  // 表头在第2行（索引1），数据从第3行（索引2）开始
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const phase = cellText(r[0]);
    const period = cellText(r[2]);
    const dimension = cellText(r[5]);
    if (!period || !dimension) continue;
    out.push({
      phase: phase || 'Q3',
      agency: cellText(r[1]),
      period,
      project: cellText(r[3]),
      subItem: cellText(r[4]),
      dimension,
      cost: cellNumber(r[6]),
      settlementCost: cellNumber(r[7]),
      cpuvEcom: cellNumber(r[8]),
      storeUvEcom: cellNumber(r[9]),
      cpuvSpotlight: cellNumber(r[10]),
      storeUvSpotlight: cellNumber(r[11]),
      exposure: cellNumber(r[12]),
      readCount: cellNumber(r[13]),
      interaction: cellNumber(r[14]),
      cpm: cellNumber(r[15]),
      cpc: cellNumber(r[16]),
      cpe: cellNumber(r[17]),
      ctr: cellNumber(r[18]),
      itiTotal: cellNumber(r[19]),
      earlyIti: cellNumber(r[20]),
      cpIti: cellNumber(r[21]),
      earlyItiRatio: cellNumber(r[22]),
      tiTotal: cellNumber(r[23]),
      earlyTiTotal: cellNumber(r[24]),
      viralRate: cellNumber(r[25]),
      topKol: cellNumber(r[26]),
      waist: cellNumber(r[27]),
      junior: cellNumber(r[28]),
      amateur: cellNumber(r[29]),
      seoJunior: cellNumber(r[30]),
      seoAmateur: cellNumber(r[31]),
    });
  }
  return out;
}

export function parseItiRetention(rows: unknown[][]): ItiRetentionRow[] {
  const out: ItiRetentionRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const date = cellDate(r[0]);
    if (!date) continue;
    out.push({
      date,
      feiheIti: cellNumber(r[1]),
      qicuiIti: cellNumber(r[2]),
      qicuiEarlyIti: cellNumber(r[3]),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function parseContentRisk(rows: unknown[][]): ContentRiskRow[] {
  const out: ContentRiskRow[] = [];
  // 表头在第2行（索引1），数据从第3行（索引2）开始
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const riskType = cellText(r[0]);
    if (!riskType) continue;
    out.push({
      riskType,
      reason: cellText(r[1]),
      originalScript: cellText(r[2]),
      replacementScript: cellText(r[3]),
      tips: cellText(r[4]),
    });
  }
  return out;
}

export function parseCompetitorIssues(rows: unknown[][]): CompetitorIssueRow[] {
  const out: CompetitorIssueRow[] = [];
  // 表头在第3行（索引2），数据从第4行（索引3）开始
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    const brand = cellText(r[2]);
    const category = cellText(r[4]);
    if (!brand || !category) continue;
    const linkVal = r[5];
    const noteUrl = Array.isArray(linkVal) ? linkVal.find(x => x?.link)?.link || '' : cellText(linkVal);
    out.push({
      time: cellText(r[0]),
      week: cellText(r[1]),
      brand,
      productLine: cellText(r[3]),
      category,
      noteUrl,
      discussion: cellText(r[6]),
      remark: cellText(r[7]),
    });
  }
  return out;
}

export function parseConsumerFeedback(rows: unknown[][]): ConsumerFeedbackRow[] {
  const out: ConsumerFeedbackRow[] = [];
  // 表头在第2行（索引1），数据从第3行（索引2）开始
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const platform = cellText(r[2]);
    if (!platform) continue;
    const linkVal = r[7];
    const noteUrl = Array.isArray(linkVal) ? linkVal.find(x => x?.link)?.link || '' : cellText(linkVal);
    out.push({
      postTime: cellText(r[0]),
      collector: cellText(r[1]),
      platform,
      dimension: cellText(r[3]),
      publishDate: cellDate(r[4]),
      noteTitle: cellText(r[5]),
      noteContent: cellText(r[6]),
      noteUrl,
      interaction: cellNumber(r[8]),
      product: cellText(r[9]),
      complaintPoint: cellText(r[10]),
      complaintType: cellText(r[11]),
      commentComplaint: cellText(r[12]),
      responseScript: cellText(r[14]),
    });
  }
  return out;
}

export function parseViralNotes(rows: unknown[][]): ViralNoteRow[] {
  const out: ViralNoteRow[] = [];
  // 表头可能在第3行之后，尝试找到包含"标题"或"互动"的行
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some(c => cellText(c).includes('标题') || cellText(c).includes('互动'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return out;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const title = cellText(r[0]) || cellText(r[1]);
    if (!title) continue;
    out.push({
      title,
      author: cellText(r[1]) || cellText(r[2]),
      interaction: cellNumber(r[2]) || cellNumber(r[3]),
      comments: cellNumber(r[3]) || cellNumber(r[4]),
      url: '',
    });
  }
  return out;
}
