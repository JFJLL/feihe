import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import path from 'node:path';
import { createServer } from 'vite';
Object.assign(process.env, { LOCAL_DB_PATH: ':memory:', LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1', REQUIRE_PROD_AUTH: 'false' });
const vite = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/business-daily-test', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
after(() => vite.close());
const adapter = await vite.ssrLoadModule('/lib/business-daily/adapter.ts');
const store = await vite.ssrLoadModule('/lib/business-daily/store.ts');
const api = await vite.ssrLoadModule('/app/api/business-daily/route.ts');
const { db } = await vite.ssrLoadModule('/lib/db.ts'); await store.ensureBusinessSchema();
const req = (body, user = 'user-admin') => new Request('http://localhost/api', { method: 'POST', headers: { 'x-user-id': user, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const get = (projectId, day, other = {}, user = 'user-admin') => api.GET(new Request('http://localhost/api?' + new URLSearchParams({ projectId, ...(day ? { day } : {}), ...other }), { headers: { 'x-user-id': user } }));
const headers = Array(59).fill(null);
for (const [i, name] of [[1,'时间'],[13,'FS总预算'],[16,'小红星'],[28,'小红盟'],[40,'K金额'],[43,'F金额'],[44,'S金额'],[45,'KFSOPZ总金额'],[46,'P(评论)'],[47,'seo投资'],[48,'杂费-'],[49,'投流总金额'],[51,'KFSOPZ总结算金额']]) headers[i] = name;
function dailyRow(date, spend, { k = 10, empty = false, shop = 10 } = {}) {
  const r = Array(59).fill(null); r[1] = date; r[13] = 50;
  if (!empty) for (const i of [16,17,18,20,28,29,30,32]) r[i] = 0;
  for (const i of [40,43,44,45,46,47,48,49,51]) r[i] = empty ? 0 : i === 40 ? k : i === 49 ? spend : i === 45 ? spend + k + 5 : i === 51 ? spend + k : 0;
  for (const start of [16,28]) { r[start + 5] = spend / 2; r[start + 7] = shop; r[start + 8] = 20; r[start + 9] = 2; r[start + 10] = 1; r[start + 11] = 5; }
  return r;
}
const baseTime = '2026-10-14T02:00:00Z';
const source = (key, role, rows, extra = {}) => ({ key, role, rows, version: '1', capturedAt: baseTime, url: 'https://example.test/' + key, complete: true, range: 'A1:BG20', ...extra });
const weekly = source('week', 'weekly', [headers, Array(59).fill(null), dailyRow('2026-09-30', 100, { k: 0 }), dailyRow('2026-10-01', 40), dailyRow('2026-10-02', 60), dailyRow('2026-10-03', 0, { empty: true })]);
const doc = { key: 'report', url: 'https://example.test/report', version: '1', capturedAt: baseTime, year: 2026, content: '<h1>10月2日</h1><h2>今日待办</h2><p>已登记交付与平台可见分别复核。</p><h3>搜索侧日报</h3><p>真实业务动作保留。</p>' };
const rect = source('rect','rectification',[
  Array(28).fill(null), ['', '', '', '', '', '笔记id'],
  [9,'日常','旧笔记','46295','https://example.test/note?xsec_token=reference','aaaaaaaaaaaaaaaaaaaaaaaa',0,0,0,0,0,0,0,0,0,0,1000,50,0,0,0,0,0,'不合格\n合格笔记','整改','待复核','问题','负责人'],
  [10,'日常','新笔记','46296','https://example.test/new','bbbbbbbbbbbbbbbbbbbbbbbb',0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,'', '', '', '', ''],
], { periodFrom: '2026-10-01', periodTo: '2026-10-31' });
const executionHeader = ['达人昵称','博主粉丝数量级','发布日期','执行进度','笔记ID'];
const execution = source('exec','execution',[executionHeader,['历史','KOC','2026-09-30','已发布','aaaaaaaaaaaaaaaaaaaaaaaa'],['当月','KOC','2026-10-01','已发布','bbbbbbbbbbbbbbbbbbbbbbbb'],['未来','KOC','2026-10-04','已发布','cccccccccccccccccccccccc'],['缺日期','KOC',null,'已发布','dddddddddddddddddddddddd']],{periodFrom:'2026-10-01'});
const bundle = { tables: [weekly, rect, execution], document: doc };
const config = { bindings: [...bundle.tables.map(s => ({ key: s.key, role: s.role, url: s.url })), { key: doc.key, role: 'document', url: doc.url }], alertThresholdPoints: 5 };

test('parser: blank, formula error, genuine zero, currency, percentages and invalid calendar dates remain distinct', () => {
  assert.equal(adapter.cell(null).state, 'missing'); assert.equal(adapter.cell('#DIV/0!').state, 'formula_error'); assert.equal(adapter.cell(0).value, 0);
  assert.equal(adapter.cell('#REF!',undefined,true).state,'formula_error');
  assert.equal(adapter.cell('¥1,234.50').value, 1234.5); assert.equal(adapter.cell('5.92%').value, .0592);
  assert.equal(adapter.calendarDay('46296'), '2026-10-01'); assert.equal(adapter.calendarDay('2026-02-30'), null);
  assert.equal(adapter.ratio(adapter.cell(5),adapter.cell(10)).value,.5); assert.equal(adapter.ratio(adapter.cell(5),adapter.cell(0)).state,'formula_error');
  assert.equal(adapter.addCells([adapter.cell(1),adapter.cell(null)]).value,null);
});
test('daily calculation: monthly production excludes historical investment notes, summary rows and future publications', () => {
  const view = adapter.buildDailyView('p',bundle,'2026-10-02');
  assert.equal(view.core.adSpend.value,60); assert.equal(view.core.creatorCost.value,10); assert.equal(view.core.projectInvestment.value,75);
  assert.deepEqual(view.series.map(p=>p.date),['2026-10-01','2026-10-02']);
  assert.equal(view.notes.length,1); assert.equal(view.notes[0].publishedDay,'2026-09-30'); assert.equal(view.notes[0].monthSpend.value,50);
  assert.equal(view.tables.find(t=>t.title==='当月新发笔记档案').rows.length,1);
  assert.ok(view.differences.some(d=>d.key==='audit-conflict')); assert.ok(view.narrative.some(n=>n.text.includes('真实业务动作')));
  const pending=adapter.buildDailyView('p',bundle,'2026-10-03'); assert.equal(pending.core.adSpend.value,null); assert.equal(pending.core.adSpend.state,'not_collected'); assert.equal(pending.progress.lagPoints,null);
  const old=adapter.buildDailyView('p',bundle,'2026-09-30'); assert.equal(old.core.creatorCost.value,0); assert.equal(old.notes.length,0); assert.equal(old.tables.filter(t=>t.title!=='日 / 周 / 月费用对账').length,0);
});
test('aggregation: UV is source-period sum; disjoint source totals do not manufacture unique users or continuous attribution', () => {
  const view=adapter.buildDailyView('p',bundle,'2026-10-02'); assert.equal(view.funnel.star.shopUv.value,20); assert.equal(view.funnel.star.monitoredShopUv.value,10); assert.match(view.funnel.aggregation,/非跨日去重/);
  const corrupted=structuredClone(bundle); corrupted.tables[0].rows[2][1]='总计'; assert.equal(adapter.weeklyPoints(corrupted.tables[0]).length,3);
  const duplicated=adapter.buildDailyView('p',{tables:[weekly,structuredClone(weekly)]},'2026-10-02'); assert.equal(duplicated.series.length,2); assert.ok(duplicated.differences.some(d=>d.key==='duplicate-day-2026-10-02'));
});
test('SEO: source cumulative day text is preserved, blank TOP3 is unknown and links never turn a profile ID into a note ID', () => {
  const h=Array(22).fill(null);for(const [i,n] of [[2,'关键词'],[9,'首次优化成功日期'],[10,'实际已达成天数'],[11,'占位链接'],[17,'是否有新笔记占位'],[20,'是否TOP3有占位']])h[i]=n;
  const row=Array(22).fill(null);row[2]='受控占位词';row[9]='2026.10.1';row[10]='12/20.';row[11]='https://www.xiaohongshu.com/user/profile/aaaaaaaaaaaaaaaaaaaaaaaa';row[12]='https://www.xiaohongshu.com/explore/bbbbbbbbbbbbbbbbbbbbbbbb';
  const seo=source('seo','seo_acceptance',[h,Array(22).fill(null),row],{periodFrom:'2026-10-01'});
  const view=adapter.buildDailyView('p',{tables:[seo]},'2026-10-14');const data=view.tables.find(t=>t.title==='SEO关键词验收').rows[0];assert.equal(data[2],'12/20.');assert.equal(data[3],null);
  const links=view.tables.find(t=>t.title==='SEO关联笔记').rows;assert.equal(links[0][1],null);assert.equal(links[1][1],'bbbbbbbbbbbbbbbbbbbbbbbb');
  assert.equal(adapter.buildDailyView('p',{tables:[seo]},'2026-09-30').tables.length,0);
});
test('ingest: explicit project binding, duplicate sync, late results, partial failure and last successful values', async () => {
  await store.configureBusiness('qicui',config); await store.ingestBusinessBundle('qicui',bundle);
  const first=await store.latestDaily('qicui','2026-10-02'); const n=(await db().prepare('SELECT count(*) AS n FROM business_captures').first()).n;
  const duplicate=await store.ingestBusinessBundle('qicui',bundle); assert.ok(duplicate.receipts.every(r=>r.state==='unchanged')); assert.equal((await db().prepare('SELECT count(*) AS n FROM business_captures').first()).n,n);
  const failed=structuredClone(bundle);failed.tables[0].complete=false;await assert.rejects(()=>store.ingestBusinessBundle('qicui',failed),/不完整/); assert.equal((await store.latestDaily('qicui','2026-10-02')).fingerprint,first.fingerprint);
  const late=structuredClone(bundle);late.tables[0].capturedAt='2026-10-13T01:00:00Z';late.tables[0].version='old';late.tables[0].rows[4][49]=999;
  assert.equal((await store.ingestBusinessBundle('qicui',late)).receipts[0].state,'late_retained');assert.equal((await store.latestDaily('qicui','2026-10-02')).core.adSpend.value,60);
  await assert.rejects(()=>store.configureBusiness('qicui',{bindings:[{key:'forbidden',role:'weekly',url:'https://example.test/MovYbZbxyaSNdssY1AacZ6WPnDe'}]},1),/允许范围/);
});
test('immutable daily confirmation: later source updates cannot rewrite a confirmed report, and stale confirmation returns conflict', async () => {
  const first=await store.latestDaily('qicui','2026-10-02');await store.confirmDaily('qicui','2026-10-02',first.fingerprint,'user-admin');
  const changed=structuredClone(bundle);changed.tables[0].version='2';changed.tables[0].capturedAt='2026-10-14T03:00:00Z';changed.tables[0].rows[4][49]=70;
  await store.ingestBusinessBundle('qicui',changed); assert.equal((await store.readDaily('qicui','2026-10-02','confirmed')).core.adSpend.value,60);assert.equal((await store.latestDaily('qicui','2026-10-02')).core.adSpend.value,70);
  const frozen=await store.readDaily('qicui','2026-10-02','confirmed');
  const evidence=await store.sourceRows('qicui','week',4,1,frozen.core.adSpend.source.captureId);assert.equal(evidence.rows[0][49],60);
  await assert.rejects(()=>store.sourceRows('foreign','week',4,1,frozen.core.adSpend.source.captureId),/不存在/);
  assert.equal((await api.POST(req({action:'confirm',projectId:'qicui',day:'2026-10-02',fingerprint:first.fingerprint}))).status,409);
  assert.equal((await get('qicui','2026-10-01',{mode:'confirmed'})).status,404);
});
test('project and role isolation: a second project has no inherited data or authorizations; viewers cannot confirm; sources paginate locally', async () => {
  await db().prepare("INSERT INTO projects(id,name,template_id,org_id,created_at,updated_at) VALUES('isolated-second','第二隔离项目','content_marketing','org-default',?,?)").bind(baseTime,baseTime).run();
  const second=await store.latestDaily('isolated-second','2026-10-02');assert.equal(second.sourceVersions.length,0);assert.equal(second.core.adSpend.value,null);assert.equal(second.notes.length,0);
  await assert.rejects(()=>store.ingestBusinessBundle('isolated-second',bundle),/配置/);
  assert.equal((await get('isolated-second','2026-10-02',{sourceKey:'week'})).status,404);
  for (const [id,role] of [['business-viewer','viewer'],['business-editor','editor']]) await db().prepare('INSERT INTO project_members(id,project_id,user_id,role,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id,'qicui',id,role,baseTime,baseTime).run();
  assert.equal((await get('qicui','2026-10-02',{},'business-viewer')).status,200);assert.equal((await get('qicui','2026-10-02',{},'stranger')).status,403);
  assert.equal((await api.POST(req({action:'confirm',projectId:'qicui',day:'2026-10-02',fingerprint:'x'},'business-viewer'))).status,403);
  const page=await (await get('qicui','2026-10-02',{sourceKey:'week',offset:'2',limit:'1'})).json(); assert.equal(page.rows.length,1);assert.equal(page.total,6);assert.equal(page.hasMore,true);
  assert.equal((await get('qicui','2026-10-02',{sourceKey:'week',offset:'-1'})).status,400);
  const parsed=await (await get('qicui','2026-10-02',{sourceKey:'rect',offset:'2',limit:'1'})).json();assert.equal(parsed.rows[0][4],'https://example.test/note');
});

test('initial query resolution: omitting day picks true server latest report day vs explicit historical day preserved', async () => {
  // 1. Omit day: server dynamically selects latest report day from bundle (2026-10-02) without hardcoding
  const resDefault = await get('qicui', '');
  assert.equal(resDefault.status, 200);
  const jsonDefault = await resDefault.json();
  assert.equal(jsonDefault.ok, true);
  assert.equal(jsonDefault.view.day, '2026-10-02', 'API must dynamically select latest report day when day is omitted');
  assert.equal(jsonDefault.view.series.length > 0, true);

  // 2. Explicit historical day: query preserves requested day
  const resHistorical = await get('qicui', '2026-10-01');
  assert.equal(resHistorical.status, 200);
  const jsonHistorical = await resHistorical.json();
  assert.equal(jsonHistorical.ok, true);
  assert.equal(jsonHistorical.view.day, '2026-10-01', 'API must honor explicit requested historical day');
});
