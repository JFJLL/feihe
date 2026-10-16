import { db } from '../db';
import { businessConfig, currentBundle, DailyError, ensureBusinessSchema, fingerprint } from '../business-daily/store';
import { calendarDay, publicNoteLink, rectificationNotes } from '../business-daily/adapter';
import type { SourceRef, SourceTable } from '../business-daily/types';
import { analyzeConversation, CONTEXT_RULE_VERSION } from './analyze';
import type { CommentJudgment, CommentQueue, ConversationCapture, NoteArchive, NoteQueueItem, NoteReview, Sentiment } from './types';
let ready: Promise<void> | null = null;
export async function ensureCommentOpsSchema() {
  await ensureBusinessSchema();
  if (!ready) ready = db().batch([
    db().prepare(`CREATE TABLE IF NOT EXISTS business_note_archives(project_id TEXT NOT NULL,note_id TEXT NOT NULL,data_json TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(project_id,note_id))`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_comment_captures(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,note_id TEXT NOT NULL,captured_at TEXT NOT NULL,complete INTEGER NOT NULL,payload_json TEXT NOT NULL,metrics_json TEXT NOT NULL)`),
    db().prepare(`CREATE INDEX IF NOT EXISTS idx_business_comment_captures ON business_comment_captures(project_id,note_id,captured_at)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_comment_analyses(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,note_id TEXT NOT NULL,capture_id TEXT NOT NULL,created_at TEXT NOT NULL,payload_json TEXT NOT NULL,summary_json TEXT NOT NULL)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_comment_heads(project_id TEXT NOT NULL,note_id TEXT NOT NULL,capture_id TEXT NOT NULL,analysis_id TEXT NOT NULL,PRIMARY KEY(project_id,note_id))`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_note_reviews(project_id TEXT NOT NULL,note_id TEXT NOT NULL,version INTEGER NOT NULL,data_json TEXT NOT NULL,PRIMARY KEY(project_id,note_id))`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_comment_corrections(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,note_id TEXT NOT NULL,comment_id TEXT NOT NULL,content_hash TEXT NOT NULL,created_at TEXT NOT NULL,actor TEXT NOT NULL,data_json TEXT NOT NULL)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_note_review_history(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,note_id TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL,data_json TEXT NOT NULL)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_comment_jobs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,note_id TEXT NOT NULL,status TEXT NOT NULL,queued_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,lease_token TEXT,lease_expires_at TEXT,error TEXT NOT NULL DEFAULT '',attempts INTEGER NOT NULL DEFAULT 0,next_run_at TEXT NOT NULL)`),
    db().prepare(`CREATE INDEX IF NOT EXISTS idx_business_comment_jobs ON business_comment_jobs(project_id,note_id,updated_at)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_note_link_checks(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,note_id TEXT NOT NULL,checked_at TEXT NOT NULL,state TEXT NOT NULL,evidence_json TEXT NOT NULL)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_comment_deliveries(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,note_id TEXT NOT NULL,source_key TEXT NOT NULL,source_row INTEGER NOT NULL,capture_id TEXT NOT NULL,status TEXT NOT NULL,comment_day TEXT,data_json TEXT NOT NULL)`),
    db().prepare(`CREATE INDEX IF NOT EXISTS idx_business_comment_deliveries ON business_comment_deliveries(project_id,note_id,source_key)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_comment_settings(project_id TEXT PRIMARY KEY,confidence_threshold REAL NOT NULL,brands_json TEXT NOT NULL,competitors_json TEXT NOT NULL,updated_at TEXT NOT NULL)`),
  ]).then(() => undefined).catch(e => { ready = null; throw e; });
  await ready;
}
const text = (v: unknown) => String(v ?? '').trim();
const headerIndex = (s: SourceTable, regex: RegExp) => (s.rows[0] || []).findIndex(v => regex.test(text(v)));
const sourceRef = (s: SourceTable, row?: number): SourceRef => ({sourceKey:s.key,url:s.url,version:s.version,capturedAt:s.capturedAt,captureId:s.captureId,range:s.range,row});
const missing = {value:null,state:'not_collected' as const,reason:'尚无该笔记对应日期的投放观测'};
export function stableNoteId(value: unknown) { const raw=text(value); return raw.match(/(?:explore|discovery\/item)\/([a-f0-9]{24})(?:[/?#]|$)/i)?.[1]?.toLowerCase() || (/^[a-f0-9]{24}$/i.test(raw) ? raw.toLowerCase() : null); }
export async function getCommentSettings(projectId: string) {
  await ensureCommentOpsSchema();
  const row = await db().prepare("SELECT * FROM business_comment_settings WHERE project_id=?").bind(projectId).first<{confidence_threshold:number;brands_json:string;competitors_json:string;updated_at:string}>();
  if (row) return { confidenceThreshold: row.confidence_threshold, brands: JSON.parse(row.brands_json) as string[], competitors: JSON.parse(row.competitors_json) as string[], updatedAt: row.updated_at };
  const bConfig = await businessConfig(projectId);
  return { confidenceThreshold: 0.75, brands: bConfig?.brands || (projectId === "qicui" ? ["启萃", "飞鹤"] : []), competitors: bConfig?.competitorWords || (projectId === "qicui" ? ["爱他美", "合生元"] : []), updatedAt: "" };
}
export async function saveCommentSettings(projectId: string, input: { confidenceThreshold?: number; brands?: string[]; competitors?: string[] }) {
  await ensureCommentOpsSchema();
  const current = await getCommentSettings(projectId);
  const threshold = typeof input.confidenceThreshold === "number" && input.confidenceThreshold >= 0.1 && input.confidenceThreshold <= 1 ? input.confidenceThreshold : current.confidenceThreshold;
  const brands = Array.isArray(input.brands) ? [...new Set(input.brands.map(text).filter(Boolean))] : current.brands;
  const competitors = Array.isArray(input.competitors) ? [...new Set(input.competitors.map(text).filter(Boolean))] : current.competitors;
  const now = new Date().toISOString();
  await db().prepare("INSERT INTO business_comment_settings VALUES(?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET confidence_threshold=excluded.confidence_threshold,brands_json=excluded.brands_json,competitors_json=excluded.competitors_json,updated_at=excluded.updated_at").bind(projectId, threshold, JSON.stringify(brands), JSON.stringify(competitors), now).run();
  return { confidenceThreshold: threshold, brands, competitors, updatedAt: now };
}
function emptyArchive(id: string): NoteArchive { return {id,title:'',content:'',author:'',tier:'',publishedDay:null,links:[],linkState:'unchecked',linkCheckedAt:null,monthlySpend:missing,spendMonth:null,spendScope:'未取得笔记日消耗；月累计来源独立排序',sourceAudit:'',sourceProblem:'',sourceOwner:'',registeredDeliveries:null,sources:[],updatedAt:''}; }
export async function refreshCommentArchives(projectId: string) {
  await ensureCommentOpsSchema(); const bundle=await currentBundle(projectId), notes=new Map<string,NoteArchive>();
  const deliveriesStatements=[],deliveryCounts=new Map<string,number>();
  for (const s of bundle.tables.filter(t=>t.role==='rectification')) for (const n of rectificationNotes(s)) {
    const old=notes.get(n.id), candidate={...emptyArchive(n.id),author:n.author,publishedDay:n.publishedDay,monthlySpend:n.monthSpend,spendMonth:s.periodFrom?.slice(0,7) || null,sourceAudit:n.audit,sourceProblem:[n.problem,n.advice,n.correction].filter(Boolean).join('；'),sourceOwner:n.owner,sources:[n.source],updatedAt:s.capturedAt};
    // Source scope is required for month sorting; do not guess it from capture time.
    if (old && Date.parse(old.updatedAt)>Date.parse(s.capturedAt)) continue;
    candidate.links=[n.link].filter(Boolean);notes.set(n.id,candidate);
    const raw=s.rows[(n.source.row || 1)-1]?.[4];if (/^https?:\/\//.test(text(raw)))candidate.links.unshift(text(raw));
  }
  for (const s of bundle.tables.filter(t=>t.role==='execution')) {
    const id=headerIndex(s,/^笔记ID$/i),pub=headerIndex(s,/^发布日期$/),name=headerIndex(s,/^达人昵称$/),title=headerIndex(s,/笔记标题|^标题$/),link=headerIndex(s,/笔记链接|笔记URL/),tier=headerIndex(s,/博主粉丝数量级|达人层级/);
    if(id<0 || pub<0)throw new DailyError('执行表缺少稳定笔记ID或发布日期，未更新巡查档案');
    s.rows.slice(1).forEach((r,index)=>{const noteId=stableNoteId(r[id]);if(!noteId)return;const n=notes.get(noteId) || emptyArchive(noteId);n.title=text(r[title]) || n.title;n.author=text(r[name]) || n.author;n.tier=text(r[tier]) || n.tier;n.publishedDay=calendarDay(r[pub]) || n.publishedDay;if(link>=0 && /^https?:/.test(text(r[link])))n.links.push(text(r[link]));n.sources.push(sourceRef(s,index+2));n.updatedAt=[n.updatedAt,s.capturedAt].sort().at(-1)!;notes.set(noteId,n);});
  }
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
  for(const s of bundle.tables.filter(t=>t.role==='comment_register')) {
    const link=headerIndex(s,/^笔记链接$/),body=headerIndex(s,/^评论话术$/),date=headerIndex(s,/^评论时间$/),operator=headerIndex(s,/^上评$/),author=headerIndex(s,/博主昵称/),tier=headerIndex(s,/达人量级/),form=headerIndex(s,/^评论形式$/),reply=headerIndex(s,/盖楼回复/),proof=headerIndex(s,/^截图$/),owner=headerIndex(s,/^执行人$/),direction=headerIndex(s,/^执行方向$/),progress=headerIndex(s,/^执行进度$/);
    if([link,body,date,operator].some(i=>i<0))throw new DailyError('评论登记表字段发生变化，未覆盖最近登记');
    deliveriesStatements.push(db().prepare('DELETE FROM business_comment_deliveries WHERE project_id=? AND source_key=?').bind(projectId,s.key));
    s.rows.slice(1).forEach((r,index)=>{
      const noteId=stableNoteId(r[link]);if(!text(r[body]))return;
      const commentDay=calendarDay(r[date]),registered=Boolean(commentDay && commentDay<=today && text(r[operator]));
      const status=registered ? 'registered':'planned';
      const data={link:text(r[link]),content:text(r[body]),commentDay,operator:text(r[operator]),form:text(r[form]),replyRelation:text(r[reply]),screenshot:r[proof] ?? null,owner:text(r[owner]),direction:text(r[direction]),progress:text(r[progress]),source:sourceRef(s,index+2),evidence:registered ? '源表登记评论时间与上评人员；尚未证明平台实际可见':'计划/待执行登记；不计为交付'};
      deliveriesStatements.push(db().prepare('INSERT INTO business_comment_deliveries VALUES(?,?,?,?,?,?,?,?,?)').bind(`${projectId}:${s.key}:${index+2}`,projectId,noteId || '',s.key,index+2,s.captureId || s.version,status,commentDay,JSON.stringify(data)));
      if(!noteId)return;
      if(registered)deliveryCounts.set(noteId,(deliveryCounts.get(noteId) || 0)+1);
      const n=notes.get(noteId) || emptyArchive(noteId);n.author ||= text(r[author]);n.tier ||= text(r[tier]);n.sourceOwner ||= text(r[owner]);if(!n.sources.some(ref=>ref.sourceKey===s.key))n.sources.push(sourceRef(s,index+2));if(!n.links.includes(text(r[link])))n.links.push(text(r[link]));n.updatedAt=[n.updatedAt,s.capturedAt].sort().at(-1)!;notes.set(noteId,n);
    });
  }
  const supplier=await db().prepare('SELECT note_id,COUNT(*) AS n FROM supplier_comments WHERE project_id=? GROUP BY note_id').bind(projectId).all<{note_id:string;n:number}>();
  const deliveries=new Map(supplier.results.map(r=>[r.note_id,r.n]));
  const statements=[];
  for(const note of notes.values()) {
    const prior=await db().prepare('SELECT data_json FROM business_note_archives WHERE project_id=? AND note_id=?').bind(projectId,note.id).first<{data_json:string}>();
    const archived: NoteArchive | null=prior ? JSON.parse(prior.data_json) : null;
    if(archived){note.content=archived.content;note.linkState=archived.linkState;note.linkCheckedAt=archived.linkCheckedAt;note.links.push(...archived.links);note.title ||= archived.title;}
    note.links=[...new Set(note.links.filter(u=>{try{const url=new URL(u);return ['www.xiaohongshu.com','xiaohongshu.com','xhslink.com'].includes(url.hostname) && !url.username && !url.password;}catch{return false;}}))];
    if(!note.links.length)note.links.push(publicNoteLink('',note.id));
    note.registeredDeliveries=bundle.tables.some(s=>s.role==='comment_register') ? deliveryCounts.get(note.id) || 0:deliveries.has(note.id) ? deliveries.get(note.id)! : null;
    statements.push(db().prepare(`INSERT INTO business_note_archives VALUES(?,?,?,?) ON CONFLICT(project_id,note_id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at`).bind(projectId,note.id,JSON.stringify(note),note.updatedAt));
  }
  if(statements.length || deliveriesStatements.length)await db().batch([...deliveriesStatements,...statements]);return {notes:notes.size};
}
export async function noteArchive(projectId: string, noteId: string): Promise<NoteArchive> {
  await ensureCommentOpsSchema();if(!stableNoteId(noteId))throw new DailyError('笔记ID无效');
  const row=await db().prepare('SELECT data_json FROM business_note_archives WHERE project_id=? AND note_id=?').bind(projectId,noteId).first<{data_json:string}>();
  if(!row)throw new DailyError('本项目笔记档案不存在',404);return JSON.parse(row.data_json);
}
const emptyReview = (): NoteReview => ({version:0,state:'unchecked',owner:'',deadline:null,reason:'',inspectedAt:null,actor:'',analysisId:null});
async function reviewFor(projectId: string,noteId: string,analysisId: string | null) {
  const row=await db().prepare('SELECT data_json FROM business_note_reviews WHERE project_id=? AND note_id=?').bind(projectId,noteId).first<{data_json:string}>();
  const review:NoteReview=row ? JSON.parse(row.data_json) : emptyReview();
  if(review.analysisId && review.analysisId!==analysisId)return {...review,state:'pending_review' as const,stale:true};return review;
}
export async function storeConversation(projectId: string,input: ConversationCapture) {
  const note=await noteArchive(projectId,input.noteId);
  if(!Number.isFinite(Date.parse(input.capturedAt)) || input.comments.length>10000)throw new DailyError('采集时间或评论范围无效');
  const seen=new Set<string>();for(const c of input.comments){if(!c.id || seen.has(c.id) || ![1,2].includes(c.depth) || (c.depth===2 && !c.parentId))throw new DailyError('评论ID、回复关系重复或缺失');seen.add(c.id);}
  if(input.comments.some(c=>c.parentId && !seen.has(c.parentId)))throw new DailyError('回复缺少对应主评论');
  for(const v of [input.platformTotal,input.reportedRoots])if(v!==null && (!Number.isSafeInteger(v) || v<0))throw new DailyError('平台评论总数无效');
  const roots=input.comments.filter(c=>c.depth===1).length;
  if(input.complete && input.reportedRoots!==null && roots<input.reportedRoots)throw new DailyError('主评论未完整采集');
  if(input.complete && input.comments.some(c=>c.depth===1 && c.replyCount!==null && input.comments.filter(child=>child.parentId===c.id).length<c.replyCount!))throw new DailyError('回复未完整采集');
  const commentSettings = await getCommentSettings(projectId);
  const judgments=analyzeConversation(input.comments,{title:input.note?.title || note.title,content:input.note?.content || note.content,brands:commentSettings.brands,competitors:commentSettings.competitors,confidenceThreshold:commentSettings.confidenceThreshold});
  const id=projectId+':'+await fingerprint(input), analysisId=projectId+':'+await fingerprint({id,rules:CONTEXT_RULE_VERSION,brands:commentSettings.brands,competitors:commentSettings.competitors,confidenceThreshold:commentSettings.confidenceThreshold});
  const metrics={id,capturedAt:input.capturedAt,complete:input.complete,platformTotal:input.platformTotal,totalScope:input.totalScope,fetched:input.comments.length,analyzed:judgments.length,reportedRoots:input.reportedRoots,roots,coverage:input.totalScope==='all' && input.platformTotal!==null ? (input.platformTotal===0 ? (input.complete ? 1:null):Math.min(1,input.comments.length/input.platformTotal)):input.reportedRoots!==null ? (input.reportedRoots===0 ? (input.complete ? 1:null):Math.min(1,roots/input.reportedRoots)):null};
  const head=await db().prepare('SELECT c.captured_at,c.complete FROM business_comment_heads h JOIN business_comment_captures c ON c.id=h.capture_id AND c.project_id=h.project_id WHERE h.project_id=? AND h.note_id=?').bind(projectId,input.noteId).first<{captured_at:string;complete:number}>();
  const advance=!head || (input.complete || !head.complete) && input.capturedAt>=head.captured_at;
  const statements=[db().prepare('INSERT OR IGNORE INTO business_comment_captures VALUES(?,?,?,?,?,?,?)').bind(id,projectId,input.noteId,input.capturedAt,input.complete ? 1:0,JSON.stringify(input),JSON.stringify(metrics)),db().prepare('INSERT OR IGNORE INTO business_comment_analyses VALUES(?,?,?,?,?,?,?)').bind(analysisId,projectId,input.noteId,id,new Date().toISOString(),JSON.stringify(judgments),JSON.stringify({ruleVersion:CONTEXT_RULE_VERSION,needsReview:judgments.filter(j=>j.needsReview).length}))];
  if(advance)statements.push(db().prepare(`INSERT INTO business_comment_heads VALUES(?,?,?,?) ON CONFLICT(project_id,note_id) DO UPDATE SET capture_id=excluded.capture_id,analysis_id=excluded.analysis_id WHERE (SELECT captured_at FROM business_comment_captures WHERE id=excluded.capture_id)>=(SELECT captured_at FROM business_comment_captures WHERE id=business_comment_heads.capture_id) AND ((SELECT complete FROM business_comment_captures WHERE id=excluded.capture_id)=1 OR (SELECT complete FROM business_comment_captures WHERE id=business_comment_heads.capture_id)=0)`).bind(projectId,input.noteId,id,analysisId));
  if(input.note && advance){note.title=input.note.title || note.title;note.content=input.note.content || note.content;note.author=input.note.author || note.author;note.publishedDay=input.note.publishedDay || note.publishedDay;note.links=[...new Set([...note.links,...(input.note.links || []).filter(u=>stableNoteId(u)===input.noteId)])];statements.push(db().prepare('UPDATE business_note_archives SET data_json=? WHERE project_id=? AND note_id=?').bind(JSON.stringify(note),projectId,input.noteId));}
  await db().batch(statements);return {id,analysisId,advanced:advance,metrics};
}
export async function readCommentQueue(projectId: string,month: string,queue='active',offset=0,limit=30): Promise<Omit<CommentQueue,'canWrite'>> {
  await ensureCommentOpsSchema();if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !['active','new','history'].includes(queue) || !Number.isSafeInteger(offset) || offset<0 || !Number.isInteger(limit) || limit<1 || limit>100)throw new DailyError('巡查范围或分页无效');
  const raw=await db().prepare('SELECT data_json FROM business_note_archives WHERE project_id=?').bind(projectId).all<{data_json:string}>();
  const notes=raw.results.map(r=>JSON.parse(r.data_json) as NoteArchive).filter(n=>queue==='active' ? n.spendMonth===month && n.monthlySpend.value!==null && n.monthlySpend.value>0:queue==='new' ? n.publishedDay?.startsWith(month):!n.publishedDay || !n.publishedDay.startsWith(month));
  notes.sort((a,b)=>queue==='active' ? (b.monthlySpend.value ?? -1)-(a.monthlySpend.value ?? -1) || a.id.localeCompare(b.id):(b.publishedDay || '').localeCompare(a.publishedDay || '') || a.id.localeCompare(b.id));
  const states=await db().prepare('SELECT r.note_id,r.data_json,h.analysis_id FROM business_note_reviews r LEFT JOIN business_comment_heads h ON h.project_id=r.project_id AND h.note_id=r.note_id WHERE r.project_id=?').bind(projectId).all<{note_id:string;data_json:string;analysis_id:string}>();
  const reviews=new Map(states.results.map(r=>{const review:NoteReview=JSON.parse(r.data_json);return [r.note_id,{...review,stale:Boolean(review.analysisId && review.analysisId!==r.analysis_id)}] as const;}));
  const checked=notes.filter(n=>{const r=reviews.get(n.id);return Boolean(r?.inspectedAt && !r.stale && r.state!=='unchecked');}), qualified=checked.filter(n=>reviews.get(n.id)?.state==='qualified');
  const items:NoteQueueItem[]=[];for(const note of notes.slice(offset,offset+limit)){
    const head=await db().prepare('SELECT c.metrics_json,h.analysis_id FROM business_comment_heads h JOIN business_comment_captures c ON c.id=h.capture_id AND c.project_id=h.project_id WHERE h.project_id=? AND h.note_id=?').bind(projectId,note.id).first<{metrics_json:string;analysis_id:string}>();
    const attempt=await db().prepare('SELECT status,updated_at AS updatedAt,error FROM business_comment_jobs WHERE project_id=? AND note_id=? ORDER BY updated_at DESC,id DESC LIMIT 1').bind(projectId,note.id).first<{status:string;updatedAt:string;error:string}>();
    items.push({...note,review:await reviewFor(projectId,note.id,head?.analysis_id || null),capture:head ? JSON.parse(head.metrics_json):null,lastAttempt:attempt});
  }
  const config=await businessConfig(projectId),hasDelivery=config?.bindings.some(b=>b.role==='comment_register');
  const unmatched=await db().prepare("SELECT COUNT(*) AS n FROM business_comment_deliveries WHERE project_id=? AND note_id='' AND status='registered'").bind(projectId).first<{n:number}>();
  return {projectId,month,queue,ranking:queue==='active' ? '当月累计消耗排序 · 无日粒度笔记消耗，尚不能提供每日TOP100':'按发布日期筛选；历史投放不计为当月新发',items,total:notes.length,offset,hasMore:offset+items.length<notes.length,summary:{checked:checked.length,qualified:qualified.length,total:notes.length,qualityRate:checked.length ? qualified.length/checked.length:null,checkedCoverage:notes.length ? checked.length/notes.length:null},sourceStatus:{deliveries:hasDelivery ? `已接评论执行副本；登记时间与上评人员满足条件才计交付登记，计划独立列出；未证明平台可见。${unmatched?.n || 0}条登记尚缺稳定笔记ID，已保留来源行，不归入其他笔记。`:'交付登记表待接可读副本；已有供应商登记仅作为独立累计事实',comments:'指定评论采集账号未配置时保持未采集；失败不会显示零'}};
}
export async function commentNoteDetail(projectId: string,noteId: string,deliveryOffset=0,deliveryLimit=20) {
  if(!Number.isSafeInteger(deliveryOffset) || deliveryOffset<0 || !Number.isInteger(deliveryLimit) || deliveryLimit<1 || deliveryLimit>100)throw new DailyError('交付登记分页无效');
  const note=await noteArchive(projectId,noteId);
  const head=await db().prepare('SELECT * FROM business_comment_heads WHERE project_id=? AND note_id=?').bind(projectId,noteId).first<{capture_id:string;analysis_id:string}>();
  const capture=head ? await db().prepare('SELECT payload_json,metrics_json FROM business_comment_captures WHERE id=? AND project_id=? AND note_id=?').bind(head.capture_id,projectId,noteId).first<{payload_json:string;metrics_json:string}>():null;
  const analysis=head ? await db().prepare('SELECT payload_json FROM business_comment_analyses WHERE id=? AND project_id=?').bind(head.analysis_id,projectId).first<{payload_json:string}>():null;
  const judgments:CommentJudgment[]=analysis ? JSON.parse(analysis.payload_json):[];
  const comments:ConversationCapture['comments']=capture ? JSON.parse(capture.payload_json).comments:[];
  const corrections=await db().prepare('SELECT * FROM business_comment_corrections WHERE project_id=? AND note_id=? ORDER BY created_at,id').bind(projectId,noteId).all<{id:string;comment_id:string;content_hash:string;data_json:string;actor:string;created_at:string}>();
  for(const row of corrections.results){const comment=comments.find(c=>c.id===row.comment_id),j=judgments.find(c=>c.commentId===row.comment_id);if(comment && j && row.content_hash===await fingerprint(comment.content)){const corrected=JSON.parse(row.data_json);Object.assign(j,{target:corrected.target,sentiment:corrected.sentiment,needsReview:false,corrected:true,correctionId:row.id,reasons:[...j.reasons,'人工纠正：'+corrected.reason]});}}
  const history=await db().prepare('SELECT actor,created_at,data_json FROM business_note_review_history WHERE project_id=? AND note_id=? ORDER BY created_at DESC,id DESC LIMIT 50').bind(projectId,noteId).all();
  const attempts=await db().prepare('SELECT id,status,updated_at,error,attempts FROM business_comment_jobs WHERE project_id=? AND note_id=? ORDER BY updated_at DESC,id DESC LIMIT 10').bind(projectId,noteId).all();
  const config=await businessConfig(projectId),keys=config?.bindings.filter(b=>b.role==='comment_register').map(b=>b.key) || [];
  const deliveries=keys.length ? await db().prepare(`SELECT status,data_json FROM business_comment_deliveries WHERE project_id=? AND note_id=? AND source_key IN (${keys.map(()=>'?').join(',')}) ORDER BY comment_day,source_key,source_row LIMIT ? OFFSET ?`).bind(projectId,noteId,...keys,deliveryLimit,deliveryOffset).all<{status:string;data_json:string}>():{results:[]};
  const deliveryTotal=keys.length ? await db().prepare(`SELECT COUNT(*) AS n FROM business_comment_deliveries WHERE project_id=? AND note_id=? AND source_key IN (${keys.map(()=>'?').join(',')})`).bind(projectId,noteId,...keys).first<{n:number}>():null;
  return {note,analysisId:head?.analysis_id || null,capture:capture ? JSON.parse(capture.payload_json):null,metrics:capture ? JSON.parse(capture.metrics_json):null,judgments,review:await reviewFor(projectId,noteId,head?.analysis_id || null),history:history.results,corrections:corrections.results.map(r=>({id:r.id,commentId:r.comment_id,actor:r.actor,at:r.created_at,...JSON.parse(r.data_json)})),attempts:attempts.results,deliveries:{items:deliveries.results.map(r=>({status:r.status,...JSON.parse(r.data_json)})),total:deliveryTotal?.n || 0,offset:deliveryOffset,hasMore:deliveryOffset+deliveries.results.length<(deliveryTotal?.n || 0)}};
}
export async function correctComment(projectId: string,noteId: string,commentId: string,input:{sentiment:Sentiment;target:string;reason:string;analysisId:string},actor:string) {
  const detail=await commentNoteDetail(projectId,noteId),comment=detail.capture?.comments.find((c:{id:string})=>c.id===commentId);
  if(!comment || detail.analysisId!==input.analysisId)throw new DailyError('评论或分析版本已变化，请刷新后复核',409);
  if(!['positive','negative','question','neutral','mixed','uncertain'].includes(input.sentiment) || !input.target?.trim() || input.target.length>200 || input.reason?.trim().length<5 || input.reason.length>1000)throw new DailyError('请填写评价对象、情绪及至少5字纠正依据');
  const id=crypto.randomUUID(),now=new Date().toISOString();await db().prepare('INSERT INTO business_comment_corrections VALUES(?,?,?,?,?,?,?,?)').bind(id,projectId,noteId,commentId,await fingerprint(comment.content),now,actor,JSON.stringify(input)).run();
  return {id};
}
export async function saveNoteReview(projectId: string,noteId: string,input:NoteReview,actor:string) {
  if(!input || typeof input!=='object' || !Number.isSafeInteger(input.version))throw new DailyError('巡查记录格式无效');
  const detail=await commentNoteDetail(projectId,noteId),current=detail.review;
  if(current.version!==input.version || detail.analysisId!==input.analysisId)throw new DailyError('巡查或分析版本已变化，请刷新后复核',409);
  if(!['unchecked','needs_fix','pending_review','qualified'].includes(input.state) || !input.owner?.trim() || input.owner.length>200 || input.reason?.trim().length<5 || input.reason.length>1500 || input.deadline && calendarDay(input.deadline)!==input.deadline)throw new DailyError('负责人、整改/复核依据或截止日期无效');
  if(input.state==='qualified' && (!detail.capture?.comments.length || detail.judgments.some(j=>j.needsReview)))throw new DailyError('尚无检查样本或低置信度评论未复核，不能判为合格');
  const now=new Date().toISOString(),data={version:current.version+1,state:input.state,owner:input.owner,deadline:input.deadline || null,reason:input.reason,analysisId:input.analysisId,actor,inspectedAt:input.state==='unchecked' || !detail.capture?.comments.length ? null:now};
  await db().batch([db().prepare(`INSERT INTO business_note_reviews VALUES(?,?,?,?) ON CONFLICT(project_id,note_id) DO UPDATE SET version=excluded.version,data_json=excluded.data_json WHERE business_note_reviews.version=?`).bind(projectId,noteId,data.version,JSON.stringify(data),current.version),db().prepare('INSERT INTO business_note_review_history SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM business_note_reviews WHERE project_id=? AND note_id=? AND data_json=?)').bind(crypto.randomUUID(),projectId,noteId,actor,now,JSON.stringify(data),projectId,noteId,JSON.stringify(data))]);
  const applied=await db().prepare('SELECT data_json FROM business_note_reviews WHERE project_id=? AND note_id=?').bind(projectId,noteId).first<{data_json:string}>();if(applied?.data_json!==JSON.stringify(data))throw new DailyError('巡查记录并发变化，未覆盖，请刷新',409);return data;
}
export async function queueCommentCollection(projectId:string,noteId:string,requestId:string,actor:string) {
  await noteArchive(projectId,noteId);if(!/^[a-zA-Z0-9:_-]{8,128}$/.test(requestId))throw new DailyError('采集请求无效');
  const id=projectId+':'+requestId,prior=await db().prepare('SELECT note_id FROM business_comment_jobs WHERE id=? AND project_id=?').bind(id,projectId).first<{note_id:string}>();
  if(prior){if(prior.note_id!==noteId)throw new DailyError('请求已用于其他笔记',409);return {id,duplicate:true};}
  const running=await db().prepare("SELECT id FROM business_comment_jobs WHERE project_id=? AND note_id=? AND status IN ('queued','running','retry')").bind(projectId,noteId).first();if(running)throw new DailyError('该笔记已有排队或执行中的任务',409);
  const now=new Date().toISOString();await db().prepare("INSERT INTO business_comment_jobs(id,project_id,note_id,status,queued_by,created_at,updated_at,next_run_at) VALUES(?,?,?,'queued',?,?,?,?)").bind(id,projectId,noteId,actor,now,now,now).run();return {id,duplicate:false};
}
