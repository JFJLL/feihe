import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import path from 'node:path';
import {createServer} from 'vite';
Object.assign(process.env,{LOCAL_DB_PATH:':memory:',LOCAL_DB_NO_SEED:'true',ENABLE_TEST_AUTH:'1',REQUIRE_PROD_AUTH:'false'});
const vite=await createServer({configFile:false,cacheDir:'node_modules/.vite/comment-ops-test',server:{middlewareMode:true,hmr:false},appType:'custom',resolve:{alias:{'@':path.resolve('.')}}});after(()=>vite.close());
const ops=await vite.ssrLoadModule('/lib/comment-ops/store.ts'),daily=await vite.ssrLoadModule('/lib/business-daily/store.ts'),analyze=await vite.ssrLoadModule('/lib/comment-ops/analyze.ts'),collector=await vite.ssrLoadModule('/lib/comment-ops/collect.ts'),api=await vite.ssrLoadModule('/app/api/comment-ops/route.ts'),worker=await vite.ssrLoadModule('/lib/comment-ops/worker.ts'),{db}=await vite.ssrLoadModule('/lib/db.ts');
await ops.ensureCommentOpsSchema();
const one='0123456789abcdef01234567',two='1123456789abcdef01234567',old='2123456789abcdef01234567';
const table={key:'execution',role:'execution',url:'https://example.test/execution',version:'1',capturedAt:'2026-10-14T00:00:00Z',range:'A1:G4',complete:true,periodFrom:'2026-10-01',periodTo:'2026-10-31',rows:[['笔记ID','发布日期','达人昵称','笔记标题','笔记链接','博主粉丝数量级','执行进度'],[one,'2026-10-10','甲','换本品的记录','https://www.xiaohongshu.com/explore/'+one,'1w','已发布'],[two,'2026-10-13','乙','宝宝的转奶经历','https://www.xiaohongshu.com/explore/'+two,'10w','已发布'],[old,'2026-09-30','丙','历史笔记','https://www.xiaohongshu.com/explore/'+old,'1w','已发布']]};
const rectRows=[['header'],Array(28).fill('')];rectRows[1][5]='笔记ID';for(const [id,date,spend] of [[one,'2026-10-10',100],[old,'2026-09-30',900]]){const r=Array(28).fill(null);Object.assign(r,{2:'作者',3:date,4:'https://www.xiaohongshu.com/explore/'+id,5:id,17:spend,23:'合格'});rectRows.push(r);}
const rect={...table,key:'rect',role:'rectification',rows:rectRows,range:'A1:AB4'};
await daily.configureBusiness('qicui',{brands:['本品'],competitorWords:['竞品'],bindings:[table,rect].map(t=>({key:t.key,role:t.role,url:t.url}))});await daily.ingestBusinessBundle('qicui',{tables:[table,rect]});
const comment=(id,content,extra={})=>({id,parentId:null,depth:1,content,author:'用户',createdAt:'2026-10-13',replyCount:0,visibility:'api_visible',...extra});
const request=(body,user='user-admin')=>new Request('http://localhost/api',{method:'POST',headers:{'Content-Type':'application/json','x-user-id':user},body:JSON.stringify(body)});
test('context judgments: historical symptoms then improvement, questions, competitor comparison and replies retain their actual targets',()=>{
  const input=[comment('a','宝宝以前胀气，换本品后改善'),comment('b','换本品后还是胀气'),comment('c','本品有改善吗？'),comment('d','以前本品喝着胀气，现在换竞品好了'),comment('e','竞品让我家宝宝便秘'),comment('f','之前有，现在没了',{parentId:'a',depth:2})];
  const result=analyze.analyzeConversation(input,{title:'本品喂养记录',content:'',brands:['本品'],competitors:['竞品']});
  assert.equal(result[0].sentiment,'positive');assert.equal(result[0].needsReview,false);assert.equal(result[1].sentiment,'negative');assert.equal(result[2].sentiment,'question');assert.equal(result[3].needsReview,true);assert.equal(result[4].target,'竞品');assert.equal(result[5].needsReview,true);assert.ok(result[5].evidence.some(t=>t.startsWith('主评论')));
});
test('reviewed semantic regressions: negated improvement never becomes an automatic positive; questions, quotations and multi-brand transitions require appropriate review',()=>{
  const cases=[['宝宝以前胀气，换启萃好了','positive',false],['启萃一点都没有改善','negative',false],['启萃没有任何好转','negative',false],['启萃不长肉','negative',false],['喝启萃没有胀气了','positive',false],['启萃不是没有改善','uncertain',true],['启萃一点都没有改善吗？','question',false],['朋友说“启萃很有改善”，我还没有试过','uncertain',true],['别人说启萃改善了','uncertain',true],['以前启萃喝着胀气，现在换合生元好了','mixed',true],['启萃不便秘了，但没有长肉','mixed',true]];
  for(const [content,expected,review] of cases){const j=analyze.analyzeConversation([comment('regression',content)],{title:'启萃喂养记录',content:'',brands:['启萃'],competitors:['合生元']})[0];assert.equal(j.sentiment,expected,content);assert.equal(j.needsReview,review,content);}
});
test('monthly queues separate old notes with current spend and new publications; unchecked source passes never become quality passes',async()=>{
  const active=await ops.readCommentQueue('qicui','2026-10','active'),fresh=await ops.readCommentQueue('qicui','2026-10','new');assert.deepEqual(active.items.map(n=>n.id),[old,one]);assert.deepEqual(fresh.items.map(n=>n.id),[two,one]);assert.equal(active.summary.qualityRate,null);assert.equal(active.summary.checked,0);assert.equal(active.items[0].capture,null);assert.equal(active.items[0].registeredDeliveries,null);
});
test('real pagination code fetches roots and replies, de-duplicates repeated IDs, and detects stalled/incomplete coverage without claiming zero',async()=>{
  const vendor={pageSize:1,read:async(kind,id,q)=>{if(kind==='detail')return {title:'本品',content:'保存正文'};if(kind==='roots')return q.offset ? {l1CommentTotal:2,l1Comments:[{comment:{id:'r1',content:'本品很适应',subCommentCount:1}},{comment:{id:'r2',content:'在哪里买本品？',subCommentCount:0}}]}:{l1CommentTotal:2,l1Comments:[{comment:{id:'r1',content:'本品很适应',subCommentCount:1}}]};return {l2Comments:[{id:'child1',content:'本品已经适应了'}]};}};
  const result=await collector.collectConversation(one,vendor,{wait:async()=>{}});assert.equal(result.complete,true);assert.equal(result.comments.length,3);assert.equal(result.totalScope,'roots');assert.equal(result.comments[1].parentId,'r1');
  const stalled=await collector.collectConversation(two,{pageSize:1,read:async kind=>kind==='detail' ? {}:{l1CommentTotal:3,l1Comments:[{comment:{id:'r1',content:'本品',subCommentCount:0}}]}},{wait:async()=>{}});assert.equal(stalled.complete,false);assert.equal(stalled.comments.length,1);assert.equal(stalled.platformTotal,3);
});
test('captures: incomplete/late responses retain the last complete archive; stable IDs and parent relations are enforced',async()=>{
  const full={noteId:one,capturedAt:'2026-10-14T01:00:00Z',complete:true,platformTotal:2,totalScope:'roots',reportedRoots:2,comments:[comment('first','宝宝以前胀气，换本品后改善'),comment('second','本品可真好，喝了就过敏')],issues:[]};await ops.storeConversation('qicui',full);const before=await ops.commentNoteDetail('qicui',one);
  await ops.storeConversation('qicui',{...full,capturedAt:'2026-10-14T02:00:00Z',complete:false,reportedRoots:5,comments:[full.comments[0]],issues:['部分回复未采集']});assert.equal((await ops.commentNoteDetail('qicui',one)).analysisId,before.analysisId);
  await ops.storeConversation('qicui',{...full,capturedAt:'2026-10-13T00:00:00Z'});assert.equal((await ops.commentNoteDetail('qicui',one)).capture.capturedAt,full.capturedAt);
  await assert.rejects(()=>ops.storeConversation('qicui',{...full,comments:[full.comments[0],full.comments[0]]}),/重复/);await assert.rejects(()=>ops.storeConversation('qicui',{...full,comments:[comment('child','正文',{parentId:'missing',depth:2})]}),/主评论/);
});
test('human review: low confidence prevents approval, correction preserves evidence, stale versions do not overwrite and new captures require review',async()=>{
  let detail=await ops.commentNoteDetail('qicui',one);const review={...detail.review,state:'qualified',owner:'负责人',reason:'已逐条阅读完整对话',analysisId:detail.analysisId};await assert.rejects(()=>ops.saveNoteReview('qicui',one,review,'reviewer'),/低置信度/);
  await ops.correctComment('qicui',one,'second',{sentiment:'negative',target:'本品',reason:'可真好为反讽，后句明确描述本品体验',analysisId:detail.analysisId},'reviewer');detail=await ops.commentNoteDetail('qicui',one);assert.equal(detail.judgments[1].needsReview,false);assert.equal(detail.corrections.length,1);
  await ops.saveNoteReview('qicui',one,review,'reviewer');await assert.rejects(()=>ops.saveNoteReview('qicui',one,review,'reviewer'),e=>e.status===409);assert.equal((await ops.readCommentQueue('qicui','2026-10')).summary.qualityRate,1);
  await ops.storeConversation('qicui',{...detail.capture,capturedAt:'2026-10-14T03:00:00Z',comments:[...detail.capture.comments,comment('new','本品怎么样？')],platformTotal:3,reportedRoots:3});assert.equal((await ops.commentNoteDetail('qicui',one)).review.state,'pending_review');assert.equal((await ops.readCommentQueue('qicui','2026-10')).summary.qualityRate,null);
});
test('project scope, viewer permissions, queued idempotency and missing credentials do not expose other projects or clear successful data',async()=>{
  const now=new Date().toISOString();await db().prepare("INSERT INTO project_members(id,project_id,user_id,role,created_at,updated_at) VALUES('comment-viewer','qicui','comment-viewer','viewer',?,?)").bind(now,now).run();
  assert.equal((await api.POST(request({projectId:'qicui',noteId:one,action:'collect',requestId:'viewer-request-01'},'comment-viewer'))).status,403);
  assert.equal((await api.GET(new Request('http://localhost/api?projectId=qicui&noteId='+one,{headers:{'x-user-id':'unrelated'}}))).status,403);await assert.rejects(()=>ops.noteArchive('another-project',one),e=>e.status===404);assert.equal((await ops.readCommentQueue('another-project','2026-10')).total,0);
  const queued=await ops.queueCommentCollection('qicui',one,'comment-queue-1','reviewer');assert.equal((await ops.queueCommentCollection('qicui',one,'comment-queue-1','reviewer')).duplicate,true);const head=(await ops.commentNoteDetail('qicui',one)).analysisId;
  const result=await worker.runCommentJobs();assert.equal(result[0].status,'failed');assert.match(result[0].error,/未配置/);assert.equal((await ops.commentNoteDetail('qicui',one)).analysisId,head);assert.equal((await db().prepare('SELECT status FROM business_comment_jobs WHERE id=?').bind(queued.id).first()).status,'failed');
});
test('delivery registration is separate from live capture; future plans and unassigned execution are excluded',async()=>{
  const register={...table,key:'register',role:'comment_register',range:'A1:E4',rows:[['笔记链接','评论话术','评论时间','上评','截图'],['https://www.xiaohongshu.com/explore/'+one,'登记话术','2026-10-01','执行者',null],['https://www.xiaohongshu.com/explore/'+one,'未来计划','2099-10-01','执行者',null],['https://www.xiaohongshu.com/explore/'+two,'尚未确认','2026-10-01',null,null]]};
  const config=await daily.businessConfig('qicui'),row=await db().prepare('SELECT version FROM business_project_config WHERE project_id=?').bind('qicui').first();config.bindings.push({key:register.key,role:register.role,url:register.url});await daily.configureBusiness('qicui',config,row.version);await daily.ingestBusinessBundle('qicui',{tables:[register]});
  const detail=await ops.commentNoteDetail('qicui',one);assert.equal(detail.note.registeredDeliveries,1);assert.equal(detail.deliveries.total,2);assert.equal(detail.deliveries.items[1].status,'planned');assert.equal((await ops.commentNoteDetail('qicui',two)).capture,null);assert.equal((await ops.commentNoteDetail('qicui',two)).note.registeredDeliveries,0);
});
test('saved archives survive dead links; authentication pages and redirects remain uncertain rather than permanently valid',async()=>{
  const {checkNoteLinks}=await vite.ssrLoadModule('/lib/comment-ops/link-check.ts');
  const failed=await checkNoteLinks('qicui',one,async()=>new Response('',{status:404}));assert.equal(failed.state,'unavailable');assert.equal((await ops.commentNoteDetail('qicui',one)).note.id,one);
  const login=await checkNoteLinks('qicui',one,async()=>new Response('<title>登录以查看</title>'+one,{status:200}));assert.equal(login.state,'uncertain');
});

test('project-scoped comment settings: threshold, brands and competitors isolate from qicui defaults', async () => {
  const customProject = 'custom-test-project';
  const now = new Date().toISOString();
  await db().prepare("INSERT INTO projects(id,name,status,created_at,updated_at) VALUES(?,'自定义项目','active',?,?) ON CONFLICT(id) DO NOTHING").bind(customProject, now, now).run();
  
  const initial = await ops.getCommentSettings(customProject);
  assert.equal(initial.confidenceThreshold, 0.75);
  assert.deepEqual(initial.brands, []);
  assert.deepEqual(initial.competitors, []);

  await ops.saveCommentSettings(customProject, {
    confidenceThreshold: 0.85,
    brands: ['小飞鹤', '臻爱'],
    competitors: ['合生元', '喜宝']
  });

  const updated = await ops.getCommentSettings(customProject);
  assert.equal(updated.confidenceThreshold, 0.85);
  assert.deepEqual(updated.brands, ['小飞鹤', '臻爱']);
  assert.deepEqual(updated.competitors, ['合生元', '喜宝']);

  const qicuiSettings = await ops.getCommentSettings('qicui');
  assert.notDeepEqual(qicuiSettings.brands, updated.brands);
});

test('enhanced context edge cases: quotations, stopped-product transitions, competitor contrasts and omitted multi-brand replies require review', () => {
  const cases = [
    { content: '有人说启萃胀气，我家没有', expectedSentiment: 'uncertain', expectedReview: true },
    { content: '爱他美便秘，启萃我还没试', expectedSentiment: 'negative', expectedReview: true },
    { content: '医生让停了启萃，后面便便才正常', expectedSentiment: 'uncertain', expectedReview: true },
    { content: '停了启萃之后就改善了', expectedSentiment: 'uncertain', expectedReview: true },
    { content: '宝宝以前胀气，换启萃好了', expectedSentiment: 'positive', expectedReview: false },
  ];

  for (const c of cases) {
    const j = analyze.analyzeConversation([comment('probe', c.content)], {
      title: '启萃喂养记录',
      content: '',
      brands: ['启萃'],
      competitors: ['爱他美', '合生元']
    })[0];
    assert.equal(j.sentiment, c.expectedSentiment, c.content);
    assert.equal(j.needsReview, c.expectedReview, c.content);
  }

  // Multi-brand parent omitted reference
  const parent = comment('p1', '合生元和启萃哪个好呀？');
  const reply = comment('r1', '一直便秘，千万别买', { parentId: 'p1', depth: 2 });
  const judged = analyze.analyzeConversation([parent, reply], {
    title: '推荐',
    content: '',
    brands: ['启萃'],
    competitors: ['合生元']
  });
  assert.equal(judged[1].needsReview, true);
  assert.equal(judged[1].confidence <= 0.5, true);
});
