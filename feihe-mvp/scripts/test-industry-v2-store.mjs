import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import path from 'node:path';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

process.env.LOCAL_DB_PATH = ':memory:';
process.env.LOCAL_DB_NO_SEED = 'true';
process.env.ENABLE_TEST_AUTH = '1';
process.env.NODE_ENV = 'test';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vite = await createServer({ root, configFile: false, cacheDir: path.join(root, 'node_modules/.vite/test-industry-v2-store'), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', resolve: { alias: { '@': root } } });
after(() => vite.close());
const store = await vite.ssrLoadModule('/lib/industry-v2-store.ts');
const { db } = await vite.ssrLoadModule('/lib/db.ts');
await store.ensureIndustryV2Schema();
const d = db(), now = new Date('2026-10-21T02:00:00Z');
for (const [id,brand,spu] of [['kailas','凯乐石','凯乐石fuga'],['meiling','美菱','美菱冰箱'],['winner-wipes','稳健','稳健玉米酒精湿巾'],['huang-tiane','黄天鹅','黄天鹅可生食鸡蛋']]) {
  await d.prepare('INSERT INTO projects(id,name,brand,spu,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,brand,brand,spu,now.toISOString(),now.toISOString()).run();
}
const success = { ok: true, notes: [], pages: 1, reportedTotal: 0, truncated: false, error: null };

test('independent query/day jobs, Shanghai window and idempotent enqueue', async () => {
  const c = await store.getIndustryV2Config('kailas');
  assert.equal(c.queries.length, 4);
  const plan = await store.enqueueIndustryV2(c,now);
  assert.deepEqual(plan,{from:'2026-09-20',to:'2026-10-19',expected:120});
  await store.enqueueIndustryV2(c,now);
  assert.equal((await d.prepare('SELECT COUNT(*) n FROM industry_v2_jobs').first()).n,120);
  assert.equal((await store.readIndustryV2Data(c,now)).coverage.length,120);
  assert.equal(store.shanghaiDay(new Date('2026-10-20T16:00:00Z')),'2026-10-21');
});

test('two claimants cannot duplicate upstream work; valid zero remains complete', async () => {
  const c = await store.getIndustryV2Config('kailas');
  const jobs = await Promise.all([store.claimIndustryV2Job(c,now),store.claimIndustryV2Job(c,now)]);
  assert.equal(jobs.filter(Boolean).length,1);
  const job=jobs.find(Boolean);
  await store.finishIndustryV2Job(job,success,now);
  const r=await store.readIndustryV2Data(c,now);
  assert.equal(r.coverage.filter(x=>x.status==='complete').length,1);
  assert.equal(r.notes.length,0);
  assert.equal(r.coverage.find(x=>x.status==='complete').reportedTotal,0);
  assert.equal((await d.prepare('SELECT used FROM industry_v2_budget WHERE project_id=?').bind('kailas').first()).used,1);
});

test('in-flight configuration changes reject stale commits and do not mix projects', async () => {
  const c=await store.getIndustryV2Config('kailas');
  const job=await store.claimIndustryV2Job(c,now);
  const changed=await store.saveIndustryV2Config('kailas',{competitorKeywords:['其他跑鞋']});
  assert.notEqual(c.scopeKey,changed.scopeKey);
  assert.equal(await store.finishIndustryV2Job(job,success,now),false);
  assert.equal((await store.readIndustryV2Data(changed,now)).coverage.filter(x=>x.status==='complete').length,0);
  assert.equal((await store.readIndustryV2Data(await store.getIndustryV2Config('meiling'),now)).notes.length,0);
});

test('leases recover after process crashes, stale owners cannot overwrite newer results', async () => {
  const c=await store.getIndustryV2Config('meiling'); await store.enqueueIndustryV2(c,now);
  const original=await store.claimIndustryV2Job(c,now);
  const recovered=await store.claimIndustryV2Job(c,new Date(now.getTime()+9*60_000));
  assert.equal(recovered.id,original.id); assert.notEqual(original.token,recovered.token);
  assert.equal(await store.finishIndustryV2Job(original,success,now),false);
  assert.equal(await store.finishIndustryV2Job(recovered,success,now),true);
});

test('daily budget bounds retries, manual enqueue does not bypass it; next date resets budget', async () => {
  const c=await store.getIndustryV2Config('meiling');
  await d.prepare('UPDATE industry_v2_budget SET used=360 WHERE project_id=?').bind('meiling').run();
  await store.enqueueIndustryV2(c,now,true);
  assert.equal(await store.claimIndustryV2Job(c,now),null);
  const next=new Date('2026-10-22T02:00:00Z'); await store.enqueueIndustryV2(c,next);
  const job=await store.claimIndustryV2Job(c,next); assert(job);
  await store.finishIndustryV2Job(job,success,next);
});

test('pause stops automatic work but explicit manual jobs still work; missing SPU cannot reuse old data', async () => {
  const c=await store.saveIndustryV2Config('winner-wipes',{dailyEnabled:false});
  await store.enqueueIndustryV2(c,now); assert.equal(await store.claimIndustryV2Job(c,now),null);
  await store.enqueueIndustryV2(c,now,true); const job=await store.claimIndustryV2Job(c,now); assert(job);
  await store.finishIndustryV2Job(job,success,now);
  await d.prepare("UPDATE projects SET spu='' WHERE id='winner-wipes'").run();
  const empty=await store.getIndustryV2Config('winner-wipes');
  assert.equal(empty.queries.length,0); assert.equal((await store.readIndustryV2Data(empty,now)).notes.length,0);
  await assert.rejects(()=>store.enqueueIndustryV2(empty,now),/SPU/);
});

test('invalid configuration does not write settings; no strings masquerading as numbers', async () => {
  for (const bad of [{historyDays:'30'},{historyDays:10000},{competitorKeywords:[{}]},{competitorKeywords:['海尔','海尔']},{categoryKeyword:' '},{dailyEnabled:'false'}]) await assert.rejects(()=>store.saveIndustryV2Config('huang-tiane',bad));
  const c=await store.getIndustryV2Config('huang-tiane');assert.equal(c.historyDays,30);
});

test('rolling recheck preserves successful observations when refresh fails, without inventing zero', async () => {
  const c=await store.getIndustryV2Config('huang-tiane');
  await store.enqueueIndustryV2(c,now);
  const job=await store.claimIndustryV2Job(c,now);
  const note={noteId:'retained-note',publishedDate:job.date,capturedAt:now.toISOString(),queryIds:[job.query.id]};
  await store.finishIndustryV2Job(job,{...success,notes:[note],reportedTotal:1},now);
  await store.enqueueIndustryV2(c,now);
  assert.equal((await d.prepare('SELECT status FROM industry_v2_jobs WHERE id=?').bind(job.id).first()).status,'complete');
  const next=new Date(now.getTime()+86400_000);
  await store.enqueueIndustryV2(c,next);
  assert.equal((await d.prepare('SELECT status FROM industry_v2_jobs WHERE id=?').bind(job.id).first()).status,'pending');
  // Isolate the old job to exercise its refresh rather than the newer business date.
  await d.prepare("UPDATE industry_v2_jobs SET status='complete' WHERE project_id='huang-tiane' AND id<>?").bind(job.id).run();
  const refresh=await store.claimIndustryV2Job(c,next);
  assert.equal(refresh.id,job.id);
  await store.finishIndustryV2Job(refresh,{ok:false,notes:[],pages:0,reportedTotal:null,truncated:false,error:'upstream unavailable'},next);
  const data=await store.readIndustryV2Data(c,next);
  assert.equal(data.notes.length,1);
  assert.equal(data.notes[0].capturedAt,now.toISOString());
  const coverage=data.coverage.find(row=>row.queryId===job.query.id && row.date===job.date);
  assert.equal(coverage.status,'failed'); assert.equal(coverage.reportedTotal,1); assert.equal(coverage.fetched,1);
});
