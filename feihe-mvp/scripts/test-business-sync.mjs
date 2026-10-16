import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import path from 'node:path';
import fs from 'node:fs';
import { createServer } from 'vite';

Object.assign(process.env, {
  LOCAL_DB_PATH: ":memory:",
  LOCAL_DB_NO_SEED: "true",
  ENABLE_TEST_AUTH: "1",
  REQUIRE_PROD_AUTH: "false"
});

const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite/business-sync-test",
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  resolve: { alias: { "@": path.resolve(".") } }
});
after(() => vite.close());
const sync=await vite.ssrLoadModule('/lib/business-sync/store.ts');const daily=await vite.ssrLoadModule('/lib/business-daily/store.ts');const api=await vite.ssrLoadModule('/app/api/business-sync/route.ts');const {db}=await vite.ssrLoadModule('/lib/db.ts');await sync.ensureSyncSchema();
const spec={type:'feishu_table',sourceKey:'budget',sourceUrl:'https://example.test/budget',role:'budget_plan',sheetId:'sheet1'};
await daily.configureBusiness('qicui',{bindings:[{key:'budget',role:'budget_plan',url:spec.sourceUrl}]});
const req=(body,user='user-admin')=>new Request('http://localhost/api',{method:'POST',headers:{'x-user-id':user,'Content-Type':'application/json'},body:JSON.stringify(body)});
const get=(projectId,user='user-admin')=>api.GET(new Request('http://localhost/api?'+new URLSearchParams({projectId}),{headers:{'x-user-id':user}}));
let taskId;
test('sync binding: rejects foreign source, credential payload, invalid window/interval, and stale configuration',async()=>{
  await assert.rejects(()=>sync.saveSyncTask('qicui','Bad',{...spec,sourceKey:'other'}),/绑定/);
  await assert.rejects(()=>sync.saveSyncTask('qicui','Bad',{...spec,secret:'test'}),/凭据/);
  await assert.rejects(()=>sync.saveSyncTask('qicui','Bad',spec,1),/间隔/);
  taskId=(await sync.saveSyncTask('qicui','预算只读同步',spec,60)).id;
  await assert.rejects(()=>sync.saveSyncTask('qicui','旧配置',spec,60,0),e=>e.status===409);
  await assert.rejects(()=>sync.taskAction('qicui',taskId,'queue','range-invalid','2026-10-14','2026-10-01'),/区间/);
});
test('claim: duplicate workers cannot run one task concurrently; success preserves actual business date and retry scheduling',async()=>{
  const task=(await sync.dueTasks())[0];const first=await sync.claimTask(task);assert.ok(first);assert.equal(await sync.claimTask(task),null);
  await sync.finishTask(task,first,{rows:10,through:'2026-10-13'});
  const current=await db().prepare('SELECT * FROM business_sync_tasks WHERE id=?').bind(taskId).first();assert.equal(current.business_through,'2026-10-13');assert.ok(current.last_success_at);assert.equal((await sync.dueTasks()).length,0);
  await sync.taskAction('qicui',taskId,'queue','retry-request-01');const retry=(await sync.dueTasks())[0];const claim=await sync.claimTask(retry);
  await sync.finishTask(retry,claim,{rows:0,error:new Error('Cookie=pin=sensitive; key=sensitive\nupstream failed')});
  const failed=await db().prepare('SELECT * FROM business_sync_tasks WHERE id=?').bind(taskId).first();assert.equal(failed.last_success_at,current.last_success_at);assert.equal(failed.business_through,'2026-10-13');assert.equal(failed.retry_count,1);assert.ok(!failed.last_error.includes('sensitive'));assert.ok(Date.parse(failed.next_run_at)>Date.now());
});
test('pause/resume: in-flight late results are discarded; frozen snapshots and previous successful dates stay intact',async()=>{
  await sync.taskAction('qicui',taskId,'queue','pause-request-01');const task=(await sync.dueTasks())[0];const claim=await sync.claimTask(task);
  await sync.taskAction('qicui',taskId,'pause','');assert.equal(await sync.ownsClaim(task,claim.token),false);await sync.finishTask(task,claim,{rows:99,through:'2026-10-14'});
  assert.equal((await sync.syncStatus('qicui')).tasks[0].state,'paused');assert.equal((await sync.syncStatus('qicui')).tasks[0].business_through,'2026-10-13');
  await assert.rejects(()=>sync.taskAction('qicui',taskId,'queue','still-paused-1'),e=>e.status===409);
  await sync.taskAction('qicui',taskId,'resume','');assert.equal((await sync.dueTasks()).length,1);
});
test('backfill: duplicate requests are idempotent, successful ranges are consumed once and old windows do not replay forever',async()=>{
  await sync.taskAction('qicui',taskId,'queue','backfill-request-01','2026-10-01','2026-10-13');assert.equal((await sync.taskAction('qicui',taskId,'queue','backfill-request-01','2026-10-01','2026-10-13')).duplicate,true);
  const task=(await sync.dueTasks())[0];const claim=await sync.claimTask(task);assert.equal(claim.request.window_from,'2026-10-01');await sync.finishTask(task,claim,{rows:13,through:'2026-10-13'});
  await sync.taskAction('qicui',taskId,'queue','recent-request-02');const fresh=(await sync.dueTasks())[0];const next=await sync.claimTask(fresh);assert.equal(next.request.window_from,null);await sync.finishTask(fresh,next,{rows:0});
  const success=await db().prepare('SELECT business_through FROM business_sync_tasks WHERE id=?').bind(taskId).first();assert.equal(success.business_through,'2026-10-13');
});
test('recover: expired leases produce an interrupted log and a new owner; source status and role visibility remain project scoped',async()=>{
  await sync.taskAction('qicui',taskId,'queue','crash-request-01');const task=(await sync.dueTasks())[0];const old=await sync.claimTask(task);assert.ok(old);
  const future=new Date(Date.now()+16*60000).toISOString();const recovered=await sync.claimTask(task,future);assert.ok(recovered);assert.notEqual(recovered.token,old.token);assert.equal((await db().prepare('SELECT status FROM sync_jobs WHERE id=?').bind(old.runId).first()).status,'interrupted');await sync.finishTask(task,recovered,{rows:1},future);
  await db().prepare("INSERT INTO project_members(id,project_id,user_id,role,created_at,updated_at) VALUES('sync-viewer','qicui','sync-viewer','viewer',?,?)").bind(future,future).run();
  assert.equal((await get('qicui','sync-viewer')).status,200);assert.equal((await api.POST(req({projectId:'qicui',action:'pause',taskId},'sync-viewer'))).status,403);assert.equal((await get('qicui','unrelated')).status,403);
  assert.equal((await sync.syncStatus('another-project')).tasks.length,0);await assert.rejects(()=>sync.taskAction('another-project',taskId,'pause',''),e=>e.status===404);
});
test('diagnostics: quoted JSON credentials and complete bearer tokens are removed from public errors',()=>{
  const result=sync.safeSyncError(new Error('Authorization: Bearer hidden-value\n{"access_token":"hidden-json","cookie":"hidden-cookie"}'));
  for(const secret of ['hidden-value','hidden-json','hidden-cookie'])assert.equal(result.includes(secret),false);
});
test('distinct backfill windows are each processed; older data does not move the successful business date backward',async()=>{
  await sync.taskAction('qicui',taskId,'queue','two-windows-a','2026-10-01','2026-10-03');
  await sync.taskAction('qicui',taskId,'queue','two-windows-b','2026-10-04','2026-10-06');
  let task=(await sync.dueTasks())[0],claim=await sync.claimTask(task);assert.equal(claim.request.window_from,'2026-10-01');await sync.finishTask(task,claim,{rows:3,through:'2026-10-03'});
  assert.equal((await db().prepare('SELECT processed_at FROM business_sync_requests WHERE id=?').bind('qicui:two-windows-b').first()).processed_at,null);
  task=(await sync.dueTasks())[0];assert.ok(task);claim=await sync.claimTask(task);assert.equal(claim.request.window_from,'2026-10-04');await sync.finishTask(task,claim,{rows:3,through:'2026-10-06'});
  assert.equal((await sync.syncStatus('qicui')).tasks[0].business_through,'2026-10-13');
});
