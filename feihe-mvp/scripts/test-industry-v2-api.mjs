import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
process.env.LOCAL_DB_PATH=':memory:';process.env.LOCAL_DB_NO_SEED='true';process.env.ENABLE_TEST_AUTH='1';process.env.NODE_ENV='test';delete process.env.SITE_ORIGIN;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const vite=await createServer({root,configFile:false,cacheDir:path.join(root,'node_modules/.vite/test-industry-v2-api'),server:{middlewareMode:true,hmr:false,ws:false},appType:'custom',resolve:{alias:{'@':root}}});
after(()=>vite.close());
const {db,ensureSchema}=await vite.ssrLoadModule('/lib/db.ts');await ensureSchema();const d=db(),stamp=new Date().toISOString();
for(const [id,role] of [['v2-admin','platform_admin'],['v2-viewer','user']]) await d.prepare('INSERT INTO users(id,email,name,role,department_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,id+'@test.local',id,role,'dept-general',stamp,stamp).run();
await d.prepare('INSERT INTO projects(id,name,spu,brand,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('kailas','凯乐石','凯乐石fuga','凯乐石',stamp,stamp).run();
await d.prepare('INSERT INTO project_members(id,project_id,user_id,role,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('v2-member','kailas','v2-viewer','viewer',stamp,stamp).run();
const {GET,POST}=await vite.ssrLoadModule('/app/api/industry/route.ts');
const req=(body,headers={})=>new Request('http://localhost/api/industry',{method:'POST',headers:{'content-type':'application/json','x-user-id':'v2-admin',...headers},body:JSON.stringify(body)});
test('read is project-authorized; viewer can read but cannot enqueue or change terms',async()=>{
 assert.equal((await GET(new Request('http://localhost/api/industry?projectId=kailas',{headers:{'x-user-id':'anonymous'}}))).status,401);
 const read=await GET(new Request('http://localhost/api/industry?projectId=kailas',{headers:{'x-user-id':'v2-viewer'}}));assert.equal(read.status,200);const body=await read.json();assert.equal(body.canWrite,false);assert.equal(body.report.version,2);assert.equal(body.report.coverage.expected,120);assert.equal(read.headers.get('cache-control'),'no-store');
 assert.equal((await POST(req({projectId:'kailas',action:'enqueue_v2'},{'x-user-id':'v2-viewer'}))).status,403);
});
test('enqueue is asynchronous and idempotent, never calls external collection',async()=>{
 for(let i=0;i<2;i++){const r=await POST(req({projectId:'kailas',action:'enqueue_v2'}));assert.equal(r.status,200);assert.equal((await r.json()).queued,true);}
 assert.equal((await d.prepare('SELECT COUNT(*) n FROM industry_v2_jobs').first()).n,120);
 assert.equal((await d.prepare("SELECT COUNT(*) n FROM industry_v2_jobs WHERE status!='pending'").first()).n,0);
});
test('same-origin JSON guards and invalid config return explicit client errors',async()=>{
 assert.equal((await POST(req({projectId:'kailas',action:'enqueue_v2'},{origin:'https://evil.invalid'}))).status,403);
 assert.equal((await POST(req({projectId:'kailas',action:'enqueue_v2'},{'content-type':'text/plain'}))).status,415);
 for(const body of [null,[],{projectId:'kailas',action:'save_config_v2',competitorKeywords:[{}]},{projectId:'kailas',action:'save_config_v2',historyDays:365}]) assert.equal((await POST(req(body))).status,400);
});
test('server-side query filter recomputes coverage; invalid/foreign query rejected',async()=>{
 const read=await GET(new Request('http://localhost/api/industry?projectId=kailas',{headers:{'x-user-id':'v2-admin'}}));const x=await read.json();
 const filtered=await GET(new Request('http://localhost/api/industry?projectId=kailas&queryId='+x.configV2.queries[0].id,{headers:{'x-user-id':'v2-admin'}}));const y=await filtered.json();assert.equal(y.configV2.queries.length,4);assert.equal(y.report.config.queries.length,1);assert.equal(y.report.coverage.expected,30);
 assert.equal((await GET(new Request('http://localhost/api/industry?projectId=kailas&queryId=foreign',{headers:{'x-user-id':'v2-admin'}}))).status,400);
});

test('bounded report keeps content evidence resolvable and computes totals before detail truncation',async()=>{
 const store=await vite.ssrLoadModule('/lib/industry-v2-store.ts');
 const config=await store.getIndustryV2Config('kailas'); const now=new Date();
 const job=await store.claimIndustryV2Job(config,now); assert(job);
 const notes=Array.from({length:620},(_,i)=>({noteId:i.toString(16).padStart(24,'0'),title:i<12?'越野山地防滑体验':'日常记录',content:'真实字段形状的隔离测试样本',url:'https://www.xiaohongshu.com/explore/'+i.toString(16).padStart(24,'0'),coverUrl:null,publishedAt:job.date+'T05:00:00Z',publishedDate:job.date,brand:'凯乐石',creatorId:'creator-'+i,creatorName:'测试'+i,fans:5000,creatorRegion:null,creatorGender:null,taxonomy1:null,taxonomy2:null,format:'image',commercial:false,promoted:false,impressions:null,reads:null,interactions:i,likes:null,comments:null,collects:null,quotedPrice:null,capturedAt:now.toISOString(),queryIds:[job.query.id]}));
 await store.finishIndustryV2Job(job,{ok:true,notes,pages:3,reportedTotal:620,truncated:true,error:null},now);
 const response=await GET(new Request('http://localhost/api/industry?projectId=kailas',{headers:{'x-user-id':'v2-admin'}}));
 assert.equal(response.status,200); const {report}=await response.json();
 assert.equal(report.summary.notes,620); assert.equal(report.notes.length,500);
 const detailIds=new Set(report.notes.map(note=>note.noteId));
 for(const group of [...report.content.scenes,...report.content.sellingPoints,...report.content.formats,...report.content.titlePatterns,...report.actions]) for(const id of group.evidenceIds) assert(detailIds.has(id),'unresolvable evidence '+id);
 assert(report.limitations.some(text=>text.includes('500')));
});
