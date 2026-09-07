import { createHash } from 'node:crypto';
import { db, ensureSchema } from './db';
import { envVar } from './runtime-env';
import { projectId } from './projects';
import { FEISHU_DOCUMENTS, cellDate, cellText, cellNumber, aggregateAds, parseWeekly, parseSearch, parseMonthly, parsePlanning, type FeishuData, type SheetReport, type SheetDefinition } from './feishu-model';

type Stored = { sheet_id: string; payload_json: string; report_json: string; fingerprint: string };
type FeishuResponse = { code?: number; msg?: string; tenant_access_token?: string; data?: { node?: { obj_token?: string }; sheets?: { sheet_id: string; title: string; grid_properties: { row_count: number; column_count: number } }[]; valueRange?: { values?: unknown[][] } } };
export type FeishuSyncResult = { ok: boolean; importedNotes: number; dailyMetricsUpdated: number; sourcesUpdated: number; latestDate: string; message: string; reports: SheetReport[]; errors?: string[] };

async function storage() {
  await ensureSchema();
  await db().prepare(`CREATE TABLE IF NOT EXISTS feishu_sheet_snapshots (
    project_id TEXT NOT NULL,sheet_id TEXT NOT NULL,payload_json TEXT NOT NULL DEFAULT 'null',
    report_json TEXT NOT NULL,fingerprint TEXT NOT NULL DEFAULT '',PRIMARY KEY(project_id,sheet_id))`).run();
}
async function request(path: string, token?: string, body?: unknown, attempt = 0): Promise<FeishuResponse> {
  const response = await fetch('https://open.feishu.cn/open-apis/'+path, {
    method:body?'POST':'GET', cache:'no-store', signal:AbortSignal.timeout(45000),
    headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
  });
  const data = await response.json() as FeishuResponse;
  if ((data.code===90235 || response.status===429) && attempt<3) {
    await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
    return request(path,token,body,attempt+1);
  }
  if(!response.ok || data.code) throw new Error(`飞书 ${data.code || response.status}：${data.msg || '读取失败'}`);
  return data;
}
async function accessToken() {
  const appId=envVar('FEISHU_APP_ID'), secret=envVar('FEISHU_APP_SECRET');
  if(!appId || !secret) throw new Error('请配置 FEISHU_APP_ID / FEISHU_APP_SECRET');
  const data=await request('auth/v3/tenant_access_token/internal',undefined,{app_id:appId,app_secret:secret});
  if(!data.tenant_access_token) throw new Error('未获取到飞书访问凭证');
  return data.tenant_access_token;
}
async function importNotes(rows: unknown[][], project: string, kind: string) {
  const notes = new Map<string, unknown[]>();
  for(const r of rows.slice(1)) {
    const id=cellText(r[kind==='notes'?13:5]);
    if(!/^[a-f\d]{24}$/i.test(id)) continue;
    const previous=notes.get(id);
    if(!previous || kind!=='notes' || cellDate(r[3])>=cellDate(previous[3])) notes.set(id,r);
  }
  if(!notes.size) throw new Error('未找到有效笔记ID，保留已有数据；请检查表头');
  const statements=[];
  for(const [id,r] of notes) {
    const pgy=kind==='notes';
    const author=cellText(r[pgy?4:3]);
    const title=cellText(r[pgy?8:16]);
    const date=cellDate(r[pgy?11:4]);
    const urlValue=r[pgy?9:6];
    const link=Array.isArray(urlValue)?urlValue.find(x=>x?.link)?.link:cellText(urlValue);
    const url=typeof link==='string' && /^https:\/\/(www\.)?xiaohongshu\.com\//.test(link)?link:`https://www.xiaohongshu.com/explore/${id}`;
    statements.push(db().prepare(`INSERT INTO notes(id,url,author,title,source_type,pipeline,level,product_scope,published_at,status)
      VALUES(?,?,?,?,'commercial','commercial','P2','本品',?,'已收录') ON CONFLICT(id) DO UPDATE SET
      url=excluded.url,author=COALESCE(NULLIF(excluded.author,''),notes.author),
      title=COALESCE(NULLIF(excluded.title,''),notes.title),published_at=COALESCE(excluded.published_at,notes.published_at)`)
      .bind(id,url,author,title,date||null));
    statements.push(db().prepare(`INSERT OR IGNORE INTO project_notes(id,project_id,note_id,source_type,pipeline,level,product_scope,status,added_at)
      VALUES(?,?,?,'commercial','commercial','P2','本品','已收录',?)`).bind(`${project}:${id}`,project,id,new Date().toISOString()));
    if(pgy) {
      const cols=['fans_count','note_price','exposure','read_count','interaction_count','like_count','favorite_count','share_count'];
      const vals=[6,19,23,24,31,33,34,36].map(i=>cellNumber(r[i]));
      statements.push(db().prepare(`INSERT INTO note_profiles(note_id,brand,note_type,${cols.join(',')},updated_at)
        VALUES(?,'启萃',?,${cols.map(()=>'?').join(',')},?) ON CONFLICT(note_id) DO UPDATE SET
        note_type=COALESCE(NULLIF(excluded.note_type,''),note_profiles.note_type),
        ${cols.map(c=>`${c}=COALESCE(excluded.${c},note_profiles.${c})`).join(',')},updated_at=excluded.updated_at`)
        .bind(id,cellText(r[10]),...vals.map(v=>v??0),new Date().toISOString()));
    } else {
      statements.push(db().prepare(`INSERT INTO note_profiles(note_id,brand,creator_level,note_type,category1,category2,updated_at)
        VALUES(?,'启萃',?,?,?,?,?) ON CONFLICT(note_id) DO UPDATE SET
        creator_level=COALESCE(NULLIF(excluded.creator_level,''),note_profiles.creator_level),
        note_type=COALESCE(NULLIF(excluded.note_type,''),note_profiles.note_type),
        category1=COALESCE(NULLIF(excluded.category1,''),note_profiles.category1),
        category2=COALESCE(NULLIF(excluded.category2,''),note_profiles.category2),updated_at=excluded.updated_at`)
        .bind(id,cellText(r[7]),cellText(r[9]),cellText(r[11]),cellText(r[12]),new Date().toISOString()));
    }
  }
  for(let i=0;i<statements.length;i+=150) await db().batch(statements.slice(i,i+150));
  return [...notes].map(([id,r])=>({id,date:cellDate(r[kind==='notes'?11:4])}));
}
async function normalize(rows: unknown[][], sheet: SheetDefinition, project: string): Promise<unknown[]> {
  if(sheet.kind==='notes' || sheet.kind==='creators') return importNotes(rows,project,sheet.kind);
  if(sheet.kind==='ads') {
    if(cellText(rows[0]?.[15])!=='消费' || cellText(rows[0]?.[9])!=='时间') throw new Error('聚光列结构发生变化，请检查时间/消费列');
    return aggregateAds(rows);
  }
  if(sheet.kind==='weekly') {
    if(!cellText(rows[1]?.[15]).includes('信息流')) throw new Error('周投放表结构发生变化，请检查表头');
    return parseWeekly(rows);
  }
  if(sheet.kind==='search') return parseSearch(rows);
  if(sheet.kind==='competitor') return parseMonthly(rows,sheet.id);
  return parsePlanning(rows,sheet.kind);
}

export async function readFeishuData(project: string): Promise<FeishuData> {
  await storage();
  const stored=(await db().prepare('SELECT * FROM feishu_sheet_snapshots WHERE project_id=?').bind(project).all<Stored>()).results || [];
  const reports=stored.map(s=>JSON.parse(s.report_json) as SheetReport);
  const payload=(id:string)=>JSON.parse(stored.find(s=>s.sheet_id===id)?.payload_json || '[]') || [];
  const ads=payload('1XSPsH') as Record<string,number|string|null>[];
  const weekly=payload('kMYs9o') as Record<string,number|string|null>[];
  const adMap=new Map(ads.map(r=>[String(r.date),r]));
  const dates=[...new Set([...ads,...weekly].map(r=>String(r.date)))].sort();
  const weeklyMap=new Map(weekly.map(r=>[String(r.date),r]));
  const notes=payload('3Wsban') as {id:string;date:string}[];
  const daily=dates.map(date=>{
    const a=adMap.get(date),w=weeklyMap.get(date);
    return {date,plan_spend:w?.plan_spend??null,actual_spend:w?.actual_spend??a?.actual_spend??null,
      feed_spend:w?.feed_spend??a?.feed_spend??null,search_spend:w?.search_spend??a?.search_spend??null,
      ads_spend:a?.actual_spend??null,
      feed_ctr:a?.feed_ctr??null,search_ctr:a?.search_ctr??null,xhm_cpuv:w?.xhm_cpuv??null,xhx_cpuv:w?.xhx_cpuv??null,
      achieve_pct:Number(w?.plan_spend)>0?Number(w?.actual_spend??a?.actual_spend)/Number(w?.plan_spend)*100:null,
      impressions:a?.impressions??null,clicks:a?.clicks??null,interactions:a?.interactions??null,
      notes_today:notes.filter(n=>n.date===date).length,comments_today:null};
  });
  return {checkedAt:reports.map(r=>r.checkedAt).sort().at(-1)||'',reports,
    daily,latestDate:dates.at(-1)||'',search:payload('PNZ39H'),
    competitor:FEISHU_DOCUMENTS[3].sheets.flatMap(s=>payload(s.id)),planning:[...payload('7XkqoO'),...payload('7G0dkc')]};
}
const pending = new Map<string,Promise<FeishuSyncResult>>();
export function syncFeishuSpreadsheets(rawProject?: string): Promise<FeishuSyncResult> {
  const project=projectId(rawProject);
  if(project!=='qicui') return Promise.reject(new Error('这四份飞书文档仅绑定启萃项目；请为当前项目配置独立数据源'));
  const active=pending.get(project);if(active)return active;
  const work=runSync(project).finally(()=>pending.delete(project)); pending.set(project,work); return work;
}
async function runSync(project: string): Promise<FeishuSyncResult> {
  await storage();
  const token=await accessToken(), now=new Date().toISOString();
  const reports:SheetReport[]=[];
  let importedNotes=0;
  for(const doc of FEISHU_DOCUMENTS) {
    let spreadsheet='', metas: NonNullable<NonNullable<FeishuResponse['data']>['sheets']>=[],docError='';
    try {
      spreadsheet=(await request('wiki/v2/spaces/get_node?token='+doc.wiki,token)).data?.node?.obj_token || '';
      if(!spreadsheet) throw new Error('无法解析文档对应的电子表格');
      metas=(await request(`sheets/v3/spreadsheets/${spreadsheet}/sheets/query`,token)).data?.sheets || [];
    } catch(e){docError=e instanceof Error?e.message:String(e);}
    for(const sheet of doc.sheets) {
      const report:SheetReport={document:doc.title,sheetId:sheet.id,sheetName:sheet.name,url:`https://yimeichuanbo.feishu.cn/wiki/${doc.wiki}?sheet=${sheet.id}`,usage:sheet.use,status:'error',rows:0,latestDate:'',checkedAt:now,changed:false};
      try {
        if(docError)throw new Error(docError);
        const meta=metas.find(s=>s.sheet_id===sheet.id);if(!meta)throw new Error('未找到工作表，可能已删除或替换');
        report.sheetName=meta.title;
        const rows:unknown[][]=[];
        const chunkSize=sheet.kind==='ads'?1000:2000;
        for(let start=1;start<=meta.grid_properties.row_count;start+=chunkSize) {
          // J:AR contains raw paid metrics; avoid evaluating thousands of unrelated A:I lookup formulas.
          const range=`${sheet.id}!${sheet.kind==='ads'?'J':'A'}${start}:${sheet.end}${Math.min(start+chunkSize-1,meta.grid_properties.row_count)}`;
          const response=await request(`sheets/v2/spreadsheets/${spreadsheet}/values/${encodeURIComponent(range)}?valueRenderOption=UnformattedValue`,token);
          const values=response.data?.valueRange?.values;
          if(!values)throw new Error('飞书未返回工作表数据');
          rows.push(...(sheet.kind==='ads'?values.map(r=>[...Array(9).fill(null),...r]):values));
        }
        report.rows=rows.filter(r=>r.some(c=>cellText(c)!=='')).length;
        if(report.rows<2)throw new Error('工作表为空，保留上次成功的数据');
        const fingerprint=createHash('sha256').update(JSON.stringify(rows)).digest('hex');
        const previous=await db().prepare('SELECT fingerprint FROM feishu_sheet_snapshots WHERE project_id=? AND sheet_id=?').bind(project,sheet.id).first<{fingerprint:string}>();
        report.changed=previous?.fingerprint!==fingerprint;
        const normalized=await normalize(rows,sheet,project);
        if(!normalized.length)throw new Error('未解析出有效记录，保留上次成功的数据');
        report.latestDate=(normalized as {date?:string;month?:string}[]).map(r=>r.date||r.month||'').filter(Boolean).sort().at(-1)||'';
        report.status='success';
        if(sheet.kind==='notes')importedNotes=normalized.length;
        await db().prepare(`INSERT INTO feishu_sheet_snapshots(project_id,sheet_id,payload_json,report_json,fingerprint) VALUES(?,?,?,?,?)
          ON CONFLICT(project_id,sheet_id) DO UPDATE SET payload_json=excluded.payload_json,report_json=excluded.report_json,fingerprint=excluded.fingerprint`)
          .bind(project,sheet.id,JSON.stringify(normalized),JSON.stringify(report),fingerprint).run();
      } catch(e) {
        report.error=e instanceof Error?e.message:String(e);
        await db().prepare(`INSERT INTO feishu_sheet_snapshots(project_id,sheet_id,report_json) VALUES(?,?,?)
          ON CONFLICT(project_id,sheet_id) DO UPDATE SET report_json=excluded.report_json`).bind(project,sheet.id,JSON.stringify(report)).run();
      }
      reports.push(report);
    }
    const docReports=reports.filter(r=>r.document===doc.title),failed=docReports.filter(r=>r.status==='error');
    await db().prepare(`UPDATE data_sources SET status=?,last_synced_at=CASE WHEN ?=0 THEN ? ELSE last_synced_at END,last_row_count=?,last_error=?,updated_at=? WHERE project_id=? AND id=?`)
      .bind(failed.length?'同步失败':'同步正常',failed.length,now,docReports.reduce((a,b)=>a+b.rows,0),failed.map(r=>`${r.sheetName}: ${r.error}`).join('；'),now,project,doc.id).run();
  }
  const data=await readFeishuData(project), errors=reports.filter(r=>r.status==='error').map(r=>`${r.sheetName}：${r.error}`);
  const succeeded=reports.length-errors.length,changed=reports.filter(r=>r.status==='success'&&r.changed).length;
  return {ok:!errors.length,importedNotes,dailyMetricsUpdated:data.daily.length,sourcesUpdated:FEISHU_DOCUMENTS.filter(d=>reports.filter(r=>r.document===d.title).every(r=>r.status==='success')).length,
    latestDate:data.latestDate,reports,errors:errors.length?errors:undefined,
    message:`已核对 ${succeeded}/${reports.length} 张工作表，${changed?`${changed} 张内容有变化`:'内容无变化'}；投放数据截至 ${data.latestDate||'暂无有效日期'}${errors.length?'；部分同步失败，请查看数据来源明细':''}`};
}
