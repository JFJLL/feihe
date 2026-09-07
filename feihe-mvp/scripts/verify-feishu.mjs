import assert from 'node:assert/strict';
import { createServer } from 'vite';

process.env.LOCAL_DB_PATH=':memory:';
process.env.LOCAL_DB_NO_SEED='true';
process.env.FEISHU_APP_ID='test-app';
process.env.FEISHU_APP_SECRET='test-secret';
const vite=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'});
const originalFetch=globalThis.fetch;
try {
  const model=await vite.ssrLoadModule('/lib/feishu-model.ts');
  const {cellDate,cellNumber,parseWeekly,aggregateAds,parseMonthly,FEISHU_DOCUMENTS}=model;
  assert.equal(cellDate(46268),'2026-09-03');
  assert.equal(cellDate('2026/9/7'),'2026-09-07');
  assert.equal(cellDate('2026-02-31'),'');
  assert.equal(cellNumber('SUM(A1:A8)'),null);
  assert.equal(cellNumber('#DIV/0!'),null);
  assert.equal(cellNumber('0'),0);
  assert.equal(cellNumber('1,234.50'),1234.5);
  const weekly=Array(57).fill(null);weekly[1]=46268;weekly[7]=10;weekly[8]=10;weekly[9]=40;weekly[10]=40;weekly[15]=10;weekly[18]=20;weekly[27]=30;weekly[30]=40;weekly[20]=5;weekly[32]=10;
  const future=Array(57).fill(null);future[1]=46272;future[17]=0;future[29]=0;
  const zero=[...weekly];zero[1]=46269;zero[15]=zero[18]=zero[27]=zero[30]=0;
  assert.equal(parseWeekly([weekly,future]).length,1,'future formula-only rows must not advance date');
  assert.equal(parseWeekly([zero])[0].actual_spend,0,'explicit zero is valid');
  const adHeader=Array(44).fill(null);adHeader[9]='时间';adHeader[15]='消费';
  const ad=(date,placement,spend,impressions,clicks)=>{const r=Array(44).fill(null);Object.assign(r,{9:date,10:placement,15:spend,16:impressions,17:clicks,26:1});return r;};
  const ads=[adHeader,ad(46268,'信息流推广',10,100,10),ad(46268,'视频流推广',20,900,9),ad(46268,'搜索推广',70,2000,100)];
  const daily=aggregateAds(ads)[0];
  assert.equal(daily.actual_spend,100);assert.equal(daily.feed_ctr,1.9);assert.equal(daily.search_ctr,5);
  assert.equal(parseMonthly([['品牌/品线','1月'],['品牌A','35.3万'],['二、其他指标'],['污染数据',999]],'s').length,1);
  console.log('PASS: dates, formulas, zero, future rows, weighted CTR, monthly boundaries');

  const pgy=Array(40).fill(null);pgy[4]='测试达人';pgy[8]='原始标题';pgy[10]='图文';pgy[11]=46268;pgy[13]='123456789012345678901234';pgy[24]=100;pgy[31]=20;
  const creator=Array(20).fill(null);creator[3]='测试达人';creator[4]=46268;creator[5]=pgy[13];creator[7]='KOC';creator[9]='图文';creator[11]='喂养';creator[12]='转奶';creator[16]='原始标题';
  const weekHead=Array(57).fill(null);weekHead[15]='F信息流投资/元';
  const sheets={
    '3Wsban':[Array(40).fill('header'),pgy], '4bTvDu':[Array(20).fill('header'),creator],
    '1XSPsH':[...ads,...Array.from({length:2100},()=>Array(44).fill(null)),ad(46269,'搜索推广',0,50,0)],
    'kMYs9o':[Array(57).fill(null),weekHead,weekly,future],
    'PNZ39H':[['周期','日期','灵犀','聚光'],['',46268,100,200]],
    '7XkqoO':[['人群','','新手妈妈'],['阶段','','孕期'],['痛点','','选奶'],['达人','','KOL']],
    '7G0dkc':[['阶段'],['孕期','妈妈','','','喂养','转奶','图文']],
  };
  for(const s of FEISHU_DOCUMENTS[3].sheets)sheets[s.id]=[['品牌/品线','1月'],[s.name,'12万']];
  let broken='',transient=true,requests=0;
  const ranges=[];
  globalThis.fetch=async(url,options)=>{
    requests++;
    const u=new URL(url);
    if(u.pathname.includes('/auth/'))return Response.json({code:0,tenant_access_token:'test-token'});
    if(u.pathname.includes('get_node'))return Response.json({code:0,data:{node:{obj_token:u.searchParams.get('token')}}});
    if(u.pathname.endsWith('/sheets/query')){
      const doc=FEISHU_DOCUMENTS.find(d=>u.pathname.includes(d.wiki));
      return Response.json({code:0,data:{sheets:doc.sheets.map(s=>({sheet_id:s.id,title:s.name,grid_properties:{row_count:sheets[s.id].length,column_count:57}}))}});
    }
    const range=decodeURIComponent(u.pathname.split('/values/')[1]);ranges.push(range);
    assert.equal(u.searchParams.get('valueRenderOption'),'UnformattedValue');
    assert.equal(options.cache,'no-store');
    const [,sid,startCol,start,,end]=range.match(/(.+)!([A-Z]+)(\d+):([A-Z]+)(\d+)/);
    if(sid===broken)return Response.json({code:99991672,msg:'permission denied'});
    if(sid==='1XSPsH'&&transient){transient=false;return Response.json({code:90235,msg:'Data not ready'});}
    return Response.json({code:0,data:{valueRange:{values:sheets[sid].slice(Number(start)-1,Number(end)).map(r=>startCol==='J'?r.slice(9):r)}}});
  };
  const sync=await vite.ssrLoadModule('/lib/feishu-sync.ts');
  const first=sync.syncFeishuSpreadsheets('qicui');
  assert.equal(sync.syncFeishuSpreadsheets('qicui'),first,'concurrent clicks must share one sync');
  const result=await first;
  assert.equal(result.ok,true,JSON.stringify(result.errors));
  assert.equal(result.reports.length,14);assert.equal(result.sourcesUpdated,4);
  assert.ok(ranges.some(r=>r.startsWith('1XSPsH!J2001:')),'read appended rows beyond old limits');
  assert.equal(result.latestDate,'2026-09-04','explicit zero row still counts');
  const dbmod=await vite.ssrLoadModule('/lib/db.ts');
  const sql=dbmod.db();
  await sql.prepare("UPDATE project_notes SET status='已处理',comment_total=32 WHERE note_id=?").bind(pgy[13]).run();
  pgy[8]='更新后的标题';pgy[24]=200;creator[16]='更新后的标题';
  const second=await sync.syncFeishuSpreadsheets('qicui');
  assert.equal(second.ok,true);assert.equal(second.reports.filter(r=>r.changed).length,2);
  assert.equal((await sql.prepare('SELECT title FROM notes WHERE id=?').bind(pgy[13]).first()).title,'更新后的标题');
  assert.equal((await sql.prepare('SELECT read_count FROM note_profiles WHERE note_id=?').bind(pgy[13]).first()).read_count,200);
  assert.equal((await sql.prepare('SELECT comment_total FROM project_notes WHERE note_id=?').bind(pgy[13]).first()).comment_total,32);
  const third=await sync.syncFeishuSpreadsheets('qicui');assert.equal(third.reports.filter(r=>r.changed).length,0);
  const before=await sync.readFeishuData('qicui');broken='1XSPsH';
  const failure=await sync.syncFeishuSpreadsheets('qicui');assert.equal(failure.ok,false);assert.equal(failure.sourcesUpdated,3);
  const after=await sync.readFeishuData('qicui');assert.deepEqual(after.daily,before.daily,'failed read must preserve last successful data');
  assert.equal(after.reports.find(r=>r.sheetId===broken).status,'error');
  const count=requests;
  await assert.rejects(()=>sync.syncFeishuSpreadsheets('another-project'),/仅绑定/);assert.equal(requests,count);
  assert.equal((await sync.readFeishuData('another-project')).daily.length,0);
  console.log('PASS: full-range sync, transient retry, concurrent deduplication, edits, unchanged detection, operational-state preservation, partial failure and project isolation');
} finally {
  globalThis.fetch=originalFetch;
  await vite.close();
}
