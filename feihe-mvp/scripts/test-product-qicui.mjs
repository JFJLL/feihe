import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import path from 'node:path';
Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1', KEYSTONE_API_KEY: '', KEYSTONE_MODEL: '' });
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/product-qicui-api', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(() => vite.close());
const [reports, projects, dashboards] = await Promise.all(['/app/api/reports/route.ts','/app/api/projects/route.ts','/app/api/dashboards/route.ts'].map(file => vite.ssrLoadModule(file)));
const { db, ensureSchema } = await vite.ssrLoadModule('/lib/db.ts'); await ensureSchema();
const req = (body, user = 'user-editor') => new Request('http://localhost/api', { method: 'POST', headers: { 'x-user-id': user, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const get = (route, params, user = 'user-editor') => route.GET(new Request('http://localhost/api?' + new URLSearchParams(params), { headers: { 'x-user-id': user } }));
assert.equal((await projects.POST(req({ action:'add_member', projectId:'qicui', userId:'user-editor', role:'project_admin' },'user-admin'))).status,200);
for (let i=1;i<=3;i++) {
  await db().prepare('INSERT INTO notes(id,url,title,published_at) VALUES(?,?,?,?)').bind('api-qicui-'+i,'https://example.test/'+i,'受控内容'+i,'2026-09-30').run();
  await db().prepare('INSERT INTO project_notes(id,project_id,note_id,added_at) VALUES(?,?,?,?)').bind('api-pn-'+i,'qicui','api-qicui-'+i,'2026-09-30').run();
  await db().prepare('INSERT INTO note_profiles(note_id,read_count,interaction_count,source_metrics_json,updated_at) VALUES(?,?,?,?,?)').bind('api-qicui-'+i,(i+1)*10000,i*100,JSON.stringify({read_count:(i+1)*10000,interaction_count:i*100}),'2026-09-30').run();
}
let first;
test('qicui red: actual historic business data can generate a frozen project report with no generic metric cards', async()=>{
  const state = await (await get(reports,{projectId:'qicui'})).json(); assert.equal(state.board.cardCount,0); assert.equal(state.businessAvailable,true);
  const response = await reports.POST(req({projectId:'qicui'})); assert.equal(response.status,200); first = await response.json();
  assert.equal(first.spec.business.snapshot.metrics.readCount,90000); assert.equal(first.spec.business.snapshot.metrics.noteCount,3); assert.equal(first.spec.business.snapshot.metrics.interactionCount,600);
  assert.equal(first.spec.projectId,'qicui'); assert.equal(first.spec.aiStatus,'not_enabled');
  assert.ok(first.spec.sections.some(section=>section.id==='qicui-content'));
  const stored = await db().prepare('SELECT created_by,report_spec_json FROM report_versions WHERE id=?').bind(first.reportId).first(); assert.equal(stored.created_by,'user-editor'); assert.deepEqual(JSON.parse(stored.report_spec_json),first.spec);
});

test('qicui report: later content updates change new reports and preserve the actual stored historic snapshot', async()=>{
  await db().prepare('UPDATE note_profiles SET read_count=? WHERE note_id=?').bind(50000,'api-qicui-1').run();
  const next=await (await reports.POST(req({projectId:'qicui'}))).json(); assert.equal(next.spec.business.snapshot.metrics.readCount,120000); assert.notEqual(next.spec.business.fingerprint,first.spec.business.fingerprint);
  assert.deepEqual((await (await get(reports,{projectId:'qicui',id:first.reportId})).json()).report.spec,first.spec);
  assert.equal(next.spec.business.acceptance.reportCount,200); assert.equal(next.spec.business.acceptance.baseCount,30); assert.equal(next.spec.business.acceptance.brandTopRate,0.4);
  assert.equal(next.spec.business.snapshot.feishu.intelligence,undefined);
});
test('qicui report: exact publication calendar range includes end-day timestamps and excludes missing or next-day content', async()=>{
  for (const [id,date] of [['api-qicui-1','2026-09-30T23:50:00+08:00'],['api-qicui-2','2026-10-01T00:00:00+08:00'],['api-qicui-3',null]]) await db().prepare('UPDATE notes SET published_at=? WHERE id=?').bind(date,id).run();
  const response=await reports.POST(req({projectId:'qicui',query:{from:'2026-09-30',to:'2026-09-30'}})); assert.equal(response.status,200); const result=await response.json(); assert.equal(result.spec.business.snapshot.metrics.noteCount,1); assert.equal(result.spec.business.snapshot.metrics.readCount,50000);
  for(let i=1;i<=3;i++)await db().prepare('UPDATE notes SET published_at=? WHERE id=?').bind('2026-09-30','api-qicui-'+i).run();
});
test('qicui report: a measured zero and legacy missing default remain different, and raw cache intelligence is not mutated', async()=>{
  const {readFeishuData}=await vite.ssrLoadModule('/lib/feishu-sync.ts'); const before=await readFeishuData('qicui',true); assert.ok(before.intelligence);
  for(const [id,provenance] of [['zero',JSON.stringify({read_count:0,interaction_count:0})],['missing',null]]) {
    await db().prepare('INSERT INTO notes(id,url,title,published_at) VALUES(?,?,?,?)').bind(id,'https://example.test/'+id,id,'2026-09-30').run();
    await db().prepare('INSERT INTO project_notes(id,project_id,note_id,added_at) VALUES(?,?,?,?)').bind('pn-'+id,'qicui',id,'2026-09-30').run();
    await db().prepare('INSERT INTO note_profiles(note_id,source_metrics_json,updated_at) VALUES(?,?,?)').bind(id,provenance,'2026-09-30').run();
  }
  const result=await (await reports.POST(req({projectId:'qicui'}))).json(); const rows=result.spec.business.snapshot.notes; assert.equal(rows.find(n=>n.id==='zero').readCount,0); assert.equal(rows.find(n=>n.id==='missing').readCount,null); assert.equal(result.spec.business.kpis.find(k=>k.key==='qicui-reads').note,'实际观测 4 / 5 篇；未观测不补零'); assert.ok((await readFeishuData('qicui')).intelligence);
});
test('qicui report: real stale version, incompatible field filters and an empty generic-only report cannot create false successful versions', async()=>{
  const initial=await (await get(dashboards,{projectId:'qicui'})).json(); const version=initial.dashboards[0].version; assert.equal((await dashboards.POST(req({action:'set_components',projectId:'qicui',version,components:[]}))).status,200);
  const before=await db().prepare('SELECT COUNT(*) AS n FROM report_versions WHERE project_id=?').bind('qicui').first();
  assert.equal((await reports.POST(req({projectId:'qicui',dashboardVersion:version}))).status,409);
  assert.equal((await reports.POST(req({projectId:'qicui',query:{filters:[{key:'channel',value:'甲'}]}}))).status,400);
  assert.equal((await reports.POST(req({projectId:'qicui',includeBusiness:false}))).status,400);
  assert.equal((await reports.POST(req({projectId:'qicui',includeBusiness:'yes'}))).status,400);
  assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM report_versions WHERE project_id=?').bind('qicui').first()).n,before.n);
});
test('qicui report: audit insertion failure rolls report back, retry keeps the real author and viewers cannot write', async()=>{
  const before=await db().prepare('SELECT COUNT(*) AS n FROM report_versions WHERE project_id=?').bind('qicui').first();
  await db().prepare("CREATE TEMP TRIGGER qicui_report_failure BEFORE INSERT ON action_logs BEGIN SELECT RAISE(ABORT, 'qicui audit rollback'); END").run();
  try { assert.equal((await reports.POST(req({projectId:'qicui'}))).status,500); assert.equal((await db().prepare('SELECT COUNT(*) AS n FROM report_versions WHERE project_id=?').bind('qicui').first()).n,before.n); } finally { await db().prepare('DROP TRIGGER qicui_report_failure').run(); }
  assert.equal((await projects.POST(req({action:'add_member',projectId:'qicui',userId:'user-project-manager',role:'editor'}))).status,200);
  const result=await (await reports.POST(req({projectId:'qicui'},'user-project-manager'))).json(); assert.equal((await db().prepare('SELECT created_by FROM report_versions WHERE id=?').bind(result.reportId).first()).created_by,'user-project-manager');
  assert.equal((await projects.POST(req({action:'add_member',projectId:'qicui',userId:'user-viewer',role:'viewer'}))).status,200);
  assert.equal((await get(reports,{projectId:'qicui'},'user-viewer')).status,200); assert.equal((await reports.POST(req({projectId:'qicui'},'user-viewer'))).status,403); assert.equal((await get(reports,{projectId:'qicui'},'user-no-access')).status,403);
});
test('qicui agent entry: the original generator now consumes the same project business facts without fabricated market claims', async()=>{
  const agent=await vite.ssrLoadModule('/app/api/agent/route.ts'); const response=await agent.POST(req({projectId:'qicui',prompt:'本项目经营与内容复盘'})); assert.equal(response.status,200); const result=await response.json(); assert.equal(result.spec.business.snapshot.metrics.readCount,120000); assert.equal(result.spec.aiStatus,'not_enabled'); assert.equal(JSON.stringify(result.spec).includes('灵犀大盘母婴搜索均值'),false); assert.equal(JSON.stringify(result.spec).includes('BeBeBus'),false);
});
test('qicui action: another actual editor resolves an owned pending item, audit author is retained and missing/foreign/viewer requests cannot succeed', async()=>{
  const actions=await vite.ssrLoadModule('/app/api/actions/workbench/route.ts'); const now='2026-09-30T12:00:00+08:00';
  await db().prepare('INSERT INTO key_comments(id,project_id,note_id,content,sentiment,category,action,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('qicui-api-action','qicui','api-qicui-1','受控需回复咨询','问题','咨询','需达人回复',now,now).run();
  assert.equal((await actions.POST(req({projectId:'qicui',action:'resolve',rawId:'qicui-api-action',source:'key-comment'},'user-viewer'))).status,403);
  assert.equal((await actions.POST(req({projectId:'qicui',action:'resolve',rawId:'missing-action',source:'key-comment'}))).status,404);
  assert.equal((await actions.POST(req({projectId:'qicui',action:'resolve',rawId:'qicui-api-action',source:'key-comment',method:'已回复'},'user-project-manager'))).status,200);
  const actual=await db().prepare('SELECT treatment_status,treatment_method FROM key_comments WHERE id=?').bind('qicui-api-action').first(); assert.equal(actual.treatment_status,'已处理'); assert.equal(actual.treatment_method,'已回复');
  const audit=await db().prepare("SELECT actor_user_id FROM action_logs WHERE action='处置待办' AND target_id=? ORDER BY id DESC LIMIT 1").bind('qicui-api-action').first(); assert.equal(audit.actor_user_id,'user-project-manager');
  const report=await (await reports.POST(req({projectId:'qicui'}))).json(); assert.equal(report.spec.business.snapshot.metrics.actions.handled,1); assert.equal(first.spec.business.snapshot.metrics.actions.total,0); assert.equal(first.spec.business.snapshot.metrics.actions.handled,null);
});

test('qicui report red: an undated shared count cannot block dated business reporting or be silently claimed as a period result',async()=>{
  const {saveDataset}=await vite.ssrLoadModule('/lib/datasets.ts'); const definitions=await vite.ssrLoadModule('/app/api/metric-definitions/route.ts');
  const dataset=await saveDataset('qicui','undated-shared-source','无日期任务表',[{value:1},{value:2}],[{key:'value',name:'编号',type:'number'}]);
  const defined=await definitions.POST(req({projectId:'qicui',action:'save',name:'无日期记录数',expectedVersion:0,config:{datasetId:dataset.id,aggregation:'count',format:'number',missingPolicy:'skip'}})); assert.equal(defined.status,200); const metricId=(await defined.json()).id;
  const board=await (await get(dashboards,{projectId:'qicui'})).json(); assert.equal((await dashboards.POST(req({projectId:'qicui',version:board.dashboards[0].version,cards:[{id:'undated-report-card',title:'无日期记录数',type:'metric_card',config:{metricId,rangePolicy:'project'}}]}))).status,200);
  const response=await reports.POST(req({projectId:'qicui',query:{from:'2026-09-30',to:'2026-09-30'}})); assert.equal(response.status,200); const result=await response.json();
  assert.equal(result.spec.business.snapshot.metrics.readCount,120000); assert.equal(result.spec.metrics[0].metricId,metricId); assert.equal(result.spec.metrics[0].metricVersion,1);
  assert.equal(result.spec.metrics[0].result.status,'needs_configuration'); assert.equal(result.spec.metrics[0].result.datasetVersion,dataset.version); assert.equal(result.spec.metrics[0].result.totalRows,2); assert.equal(result.spec.metrics[0].result.value,null); assert.equal(result.spec.metrics[0].result.formattedValue,'—'); assert.match(result.spec.metrics[0].result.statusLabel,/日期字段/); assert.match(result.spec.kpis.find(k=>k.label==='无日期记录数').note,/未计算/);
});
