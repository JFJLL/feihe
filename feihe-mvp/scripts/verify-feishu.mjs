import assert from 'node:assert/strict';
import { createServer } from 'vite';

process.env.LOCAL_DB_PATH=':memory:';
process.env.LOCAL_DB_NO_SEED='true';
process.env.FEISHU_APP_ID='test-app';
process.env.FEISHU_APP_SECRET='test-secret';
const vite=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom'});
const originalFetch=globalThis.fetch;
try {
  const {overviewPeriod,sumMetric,finiteMetric,matchedBudget}=await vite.ssrLoadModule('/features/overview/overview-view-model.ts');
  const series=[{date:'2026-09-03',actual_spend:20,plan_spend:40},{date:'2026-07-01',actual_spend:10,plan_spend:20},{date:'2026-10-01',actual_spend:999}];
  const period=overviewPeriod(series,'');
  assert.equal(period.date,'2026-09-03','latest date is sorted, outside-quarter data excluded');
  assert.equal(period.quarterDay,65,'calendar progress includes dates without a data row');
  assert.equal(period.monthDays,30);
  assert.equal(sumMetric(period.quarterRows,'actual_spend'),30);
  assert.equal(sumMetric(period.monthRows,'actual_spend'),20);
  assert.equal(overviewPeriod(series,'2026-07-01').quarterRows.length,1,'historical view excludes later spend');
  assert.equal(overviewPeriod([],'').daily,undefined,'empty source must not use demo data');
  assert.equal(sumMetric([{date:'2026-07-01',x:null}],'x'),null,'missing totals stay missing');
  assert.equal(sumMetric([{date:'2026-07-01',x:0}],'x'),0,'real zero remains zero');
  assert.equal(finiteMetric(NaN),null);
  assert.deepEqual(matchedBudget([{actual_spend:10,plan_spend:20},{actual_spend:90,plan_spend:null}]),{spend:10,plan:20,count:1},'compare plans only with spend from the same dates');
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
  const kpiRow = (values) => Object.assign(Array(43).fill(null), values);
  const kpiRows = [Array(43).fill('header'), Array(43).fill('header'),
    kpiRow({0:'Q3',1:'YM',2:'7月',3:'启萃-总',4:'K-达人',5:'KPI',6:100,25:'15%'}),
    kpiRow({5:'实际',6:80,25:'16%'}), kpiRow({5:'达成率',6:'80%'}),
    kpiRow({4:'TTL',5:'KPI',6:1000}), kpiRow({5:'实际',6:900}),
    kpiRow({3:'启萃-星',4:'TTL',5:'KPI',6:300}), kpiRow({5:'实际',6:250}),
    kpiRow({3:'启萃-盟',4:'TTL',5:'KPI',6:700}), kpiRow({5:'实际',6:650})];
  const internalRows = [Array(29).fill('header'),Array(29).fill('header'),
    kpiRow({0:6,1:'启萃-星',2:'达人',3:'KPI',4:525767.5,7:1314419,10:13144,14:40}),
    kpiRow({0:6,3:'实际',4:403876,7:6188575,9:660038,10:75968,14:5.32})];
  const commentRows = [
    ['7月执行统计',null,null,null,null,null,null,null,'8月执行统计'],
    ['执行时间','执行类型','纯文案','表情包','执行数量','完成进度','结算进度',null,'执行时间','执行类型','纯文案','执行数量','完成进度','结算进度'],
    ['7月3日','达人评论',249,81,330,'已完成','未结算',null,'8月7日达人','达人评论',281,281,'已完成','未结算'],
    [46268,'素人评论',0,0,0,'已完成','未结算']];
  const parsedKpi = model.parseKpiWeekly(kpiRows);
  assert.equal(parsedKpi.filter(r=>r.dimension==='实际').length,4,'merged labels carry into actual rows');
  assert.equal(parsedKpi[1].project,'启萃-总');
  assert.equal(parsedKpi[1].viralRate,0.16);
  const kpiView = await vite.ssrLoadModule('/features/overview/kpi-view-model.ts');
  const scopes = kpiView.kpiScopes(parsedKpi);
  assert.equal(scopes.length,4);
  const totalScope = scopes.find(s=>s.rows[0].project==='启萃-总' && s.rows[0].subItem==='TTL');
  assert.equal(kpiView.compareKpi(totalScope.rows).actual.cost,900,'do not add total + star + alliance + channel detail');
  assert.equal(kpiView.compareKpi([...totalScope.rows,totalScope.rows[1]]).actual,null,'duplicate actual scope is ambiguous');
  assert.equal(model.parseKpiWeekly([...kpiRows,[],kpiRow({5:'实际',6:999})]).length,parsedKpi.length,'blank section resets labels');
  const internal = model.parseKpiInternal(internalRows);
  assert.equal(internal[1].cost,403876,'cost is E, not CPUV in F');
  assert.equal(internal[1].exposure,6188575);
  assert.equal(internal[1].interaction,75968);
  assert.equal(internal[1].lat,'达人');
  const comments = model.parseCommentSummary(commentRows);
  assert.equal(comments.length,3,'nonstandard dates and zero remain in monthly totals');
  assert.equal(comments.reduce((s,r)=>s+r.total,0),611);
  assert.equal(comments.filter(r=>!r.date).length,2,'do not invent years');
  assert.equal(model.parseCommentSummary([['9月执行统计'],commentRows[1].slice(0,7),['9月1日','达人评论',10,0,10,'已完成']])[0].month,'9月');
  const scenes = await vite.ssrLoadModule('/features/content/scene-performance.ts');
  const scene = scenes.scenePerformance([{category1:'转奶',creatorLevel:'KOC',interactionCount:0,notePrice:10},{category1:'转奶',creatorLevel:'KOC',interactionCount:10,notePrice:30},{category1:'转奶',creatorLevel:'KOC'}])[0];
  assert.equal(scene.avg,5,'zero participates, missing does not');
  assert.equal(scene.cpe,4,'paired cost / paired interactions');
  assert.equal(scene.costSamples,2);
  assert.equal(scenes.scenePerformance([{interactionCount:0,notePrice:10}])[0].cpe,null);
  console.log('PASS: real KPI layouts, merged labels, disjoint scopes, comment month discovery, missing dates, paired scene metrics');
  const historical = [...pgy]; historical[13]='abcdef123456789012345678'; historical[11]='2026-01-01'; historical[24]=0; historical[31]=null;
  creator[17]='2-补充转奶场景';creator[18]='补充二级场景';
  const sheets={
    '3Wsban':[Array(40).fill('header'),pgy,historical], '4bTvDu':[Array(20).fill('header'),creator],
    '1XSPsH':[...ads,...Array.from({length:2100},()=>Array(44).fill(null)),ad(46269,'搜索推广',0,50,0)],
    'kMYs9o':[Array(57).fill(null),weekHead,weekly,future],
    'PNZ39H':[['周期','日期','灵犀','聚光'],['',46268,100,200]],
    '7XkqoO':[['人群','','新手妈妈'],['阶段','','孕期'],['痛点','','选奶'],['达人','','KOL']],
    '7G0dkc':[['阶段'],['孕期','妈妈','','','喂养','转奶','图文']],
    'Kg5KCQ':kpiRows, 'FZqyGk':internalRows, 'RMwjy9':commentRows,
    'ICUwp9':[['标题','作者','互动','评论'],['样例笔记','达人',100,10]],
    'bBV9tp':[['日期','飞鹤','启萃','早阶'],[46268,100,50,0]],
    'V5bEy9':[['说明'],['类型','原因','原话术','替换话术'],['措辞','待核对','原文','替换']],
    'ctIAHL':[['说明'],[],['时间','周','品牌','品线','分类'],['7月','第一周','品牌A','品线A','包装']],
    'vKuDWB':[['说明'],['表头'],['7月','收集人','小红书','产品']],
    'q79OwB':[['序号','达人','链接'],[1,'达人','https://example.com/note']],
    'f4berX':[['序号','达人','链接'],[1,'达人','https://example.com/note']],
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
  assert.equal(result.reports.length,24);assert.equal(result.sourcesUpdated,5);
  assert.ok(ranges.some(r=>r.startsWith('1XSPsH!J2001:')),'read appended rows beyond old limits');
  assert.equal(result.latestDate,'2026-09-04','explicit zero row still counts');
  const dbmod=await vite.ssrLoadModule('/lib/db.ts');
  const sql=dbmod.db();
  assert.ok(await sql.prepare('SELECT id FROM notes WHERE id=?').bind(historical[13]).first(),'historical notes outside 90 days are imported');
  assert.equal((await sql.prepare('SELECT category1 FROM note_profiles WHERE note_id=?').bind(creator[5]).first()).category1,'2-补充转奶场景','supplementary category wins without guessing');
  const provenance=JSON.parse((await sql.prepare('SELECT source_metrics_json FROM note_profiles WHERE note_id=?').bind(historical[13]).first()).source_metrics_json);
  assert.equal(provenance.read_count,0,'explicit zero is recorded');
  assert.equal(provenance.interaction_count,null,'missing source cell stays missing');
  assert.equal((await sync.readFeishuData('qicui')).kpiWeekly.filter(r=>r.dimension==='实际').length,4);
  await sql.prepare("UPDATE feishu_sheet_snapshots SET fingerprint='old-parser' WHERE sheet_id='Kg5KCQ'").run();
  const migrated=await sync.readFeishuData('qicui',true);
  assert.equal(migrated.kpiWeekly.length,0,'old normalized KPI data is not shown after parser upgrade');
  assert.match(migrated.reports.find(r=>r.sheetId==='Kg5KCQ').error,/重新核对/);
  await sync.syncFeishuSpreadsheets('qicui');
  assert.equal((await sync.readFeishuData('qicui')).kpiWeekly.filter(r=>r.dimension==='实际').length,4,'resync repairs outdated snapshots');
  await sql.prepare("UPDATE project_notes SET status='已处理',comment_total=32 WHERE note_id=?").bind(pgy[13]).run();
  pgy[8]='更新后的标题';pgy[24]=200;creator[16]='更新后的标题';
  const second=await sync.syncFeishuSpreadsheets('qicui');
  assert.equal(second.ok,true);assert.equal(second.reports.filter(r=>r.changed).length,2);
  assert.equal((await sql.prepare('SELECT title FROM notes WHERE id=?').bind(pgy[13]).first()).title,'更新后的标题');
  assert.equal((await sql.prepare('SELECT read_count FROM note_profiles WHERE note_id=?').bind(pgy[13]).first()).read_count,200);
  assert.equal((await sql.prepare('SELECT comment_total FROM project_notes WHERE note_id=?').bind(pgy[13]).first()).comment_total,32);
  const third=await sync.syncFeishuSpreadsheets('qicui');assert.equal(third.reports.filter(r=>r.changed).length,0);
  const before=await sync.readFeishuData('qicui');broken='1XSPsH';
  const failure=await sync.syncFeishuSpreadsheets('qicui');assert.equal(failure.ok,false);assert.equal(failure.sourcesUpdated,4);
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
