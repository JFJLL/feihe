import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { ...(options.headers || {}) };
    const body = options.body ? Buffer.from(options.body) : null;
    if (body) {
      headers['Content-Length'] = String(body.length);
    }
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          json: async () => JSON.parse(data || '{}'),
          text: async () => data,
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

let TEST_PORT = 5089;
let BASE_URL = 'http://127.0.0.1:' + TEST_PORT;

function getAvailablePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}
const tmpDir = path.resolve(process.cwd(), '.verification', 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });
const tmpDbPath = path.resolve(tmpDir, 'operations-' + process.pid + '-' + Date.now() + '.db');

console.log('==================================================');
console.log('OPERATIONS VERIFICATION SUITE (REAL HTTP & ISOLATED DB)');
console.log('Temporary DB: ' + tmpDbPath);
console.log('Server Target: ' + BASE_URL);
console.log('==================================================\n');

let serverProcess = null;
let localDb = null;

function startServer() {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      LOCAL_DB_PATH: tmpDbPath,
      LOCAL_DB_NO_SEED: 'true',
      PORT: String(TEST_PORT),
      NO_PROXY: '*',
      no_proxy: '*',
    };
    for (const k of ['http_proxy', 'https_proxy', 'all_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY']) {
      delete env[k];
    }
    const cli = path.resolve(process.cwd(), 'node_modules', 'vinext', 'dist', 'cli.js');
    const p = spawn(process.execPath, [cli, 'start', '-p', String(TEST_PORT), '--hostname', '127.0.0.1'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let ready = false;
    p.stdout.on('data', (chunk) => {
      const str = chunk.toString();
      console.log('[SERVER STDOUT]', str.trim());
      if (!ready && (str.includes(String(TEST_PORT)) || str.includes('Ready') || str.includes('http://'))) {
        ready = true;
        setTimeout(resolve, 800);
      }
    });
    p.stderr.on('data', (chunk) => {
      console.error('[SERVER STDERR]', chunk.toString().trim());
    });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (!ready) reject(new Error('Server exited early with code ' + code));
    });
    setTimeout(() => {
      if (!ready) {
        ready = true;
        resolve();
      }
    }, 6000);
    serverProcess = p;
  });
}

function stopServer() {
  if (serverProcess) {
    try {
      serverProcess.kill('SIGKILL');
    } catch {}
    serverProcess = null;
  }
}

async function waitForHttp() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await httpRequest(BASE_URL + '/api/review?projectId=qicui');
      if (res.ok) {
        return;
      }
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Server failed to start in time');
}

async function runAll() {
  TEST_PORT = await getAvailablePort();
  BASE_URL = 'http://127.0.0.1:' + TEST_PORT;
  console.log('Using dynamic port: ' + TEST_PORT);

  // Initialize schema on the temporary database before starting
  const initDb = new DatabaseSync(tmpDbPath);
  initDb.exec('PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL;');
  initDb.close();

  await startServer();
  await waitForHttp();
  const db = new DatabaseSync(tmpDbPath);
  db.exec('PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL;');
  localDb = db;

  // ----------------------------------------------------
  // MIGRATION TESTS (Schema Versioning & Canonical Ordering)
  // ----------------------------------------------------
  console.log('--- MIGRATION TESTS ---');
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_review_batches(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,date_key TEXT NOT NULL,counts_json TEXT NOT NULL DEFAULT "{}",created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS review_action_items(id INTEGER PRIMARY KEY AUTOINCREMENT,batch_id TEXT NOT NULL,project_id TEXT NOT NULL,date_key TEXT NOT NULL,link TEXT NOT NULL DEFAULT "",blogger TEXT NOT NULL DEFAULT "",action TEXT NOT NULL,reason TEXT NOT NULL DEFAULT "",sample_json TEXT NOT NULL DEFAULT "[]",status TEXT NOT NULL DEFAULT "待处理",created_at TEXT NOT NULL,item_key TEXT);
  `);

  // Scenario A: Two item_key=NULL records, one is '已处理'
  db.prepare('INSERT INTO review_action_items(batch_id, project_id, date_key, link, blogger, action, reason, status, created_at, item_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
    .run('batch:mig:08-30', 'mig-proj', '08-30', 'https://www.xiaohongshu.com/explore/migitem1', '达人A', 'needReply', '待回复1', '待处理', new Date().toISOString());
  db.prepare('INSERT INTO review_action_items(batch_id, project_id, date_key, link, blogger, action, reason, status, created_at, item_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
    .run('batch:mig:08-30', 'mig-proj', '08-30', 'https://www.xiaohongshu.com/explore/migitem1', '达人A', 'needReply', '待回复1', '已处理', new Date().toISOString());

  // Scenario B: Newer random batch + older canonical batch
  db.prepare('INSERT INTO note_review_batches(id, project_id, date_key, counts_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .run('batch:mig-b:08-30', 'mig-b', '08-30', '{"needReply":1}', '2026-08-30T10:00:00.000Z');
  db.prepare('INSERT INTO note_review_batches(id, project_id, date_key, counts_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .run('rand_batch_123', 'mig-b', '08-30', '{"needReply":2}', '2026-08-30T12:00:00.000Z');
  db.prepare('INSERT INTO review_action_items(batch_id, project_id, date_key, link, blogger, action, reason, status, created_at, item_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('rand_batch_123', 'mig-b', '08-30', 'https://www.xiaohongshu.com/explore/migitem2', '达人B', 'needDelete', '待删除', '待处理', new Date().toISOString(), 'mig-b:migitem2:supplier_review:needDelete');

  // Scenario C: Newer canonical batch + older random batch
  db.prepare('INSERT INTO note_review_batches(id, project_id, date_key, counts_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .run('rand_batch_456', 'mig-c', '08-30', '{"needReply":1}', '2026-08-30T09:00:00.000Z');
  db.prepare('INSERT INTO note_review_batches(id, project_id, date_key, counts_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .run('batch:mig-c:08-30', 'mig-c', '08-30', '{"needReply":3}', '2026-08-30T14:00:00.000Z');
  db.prepare('INSERT INTO review_action_items(batch_id, project_id, date_key, link, blogger, action, reason, status, created_at, item_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('rand_batch_456', 'mig-c', '08-30', 'https://www.xiaohongshu.com/explore/migitem3', '达人C', 'needReply', '待回复', '待处理', new Date().toISOString(), 'mig-c:migitem3:supplier_review:needReply');

  // Run migration
  const { runReviewMigration } = await import('../lib/review-report.ts');
  const wrapDb = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async (col) => {
          const row = db.prepare(sql).get(...args);
          if (!row) return null;
          return col ? row[col] : row;
        },
        all: async () => ({ results: db.prepare(sql).all(...args) }),
        run: async () => { db.prepare(sql).run(...args); return { success: true }; },
      }),
      first: async (col) => {
        const row = db.prepare(sql).get();
        if (!row) return null;
        return col ? row[col] : row;
      },
      all: async () => ({ results: db.prepare(sql).all() }),
      run: async () => { db.prepare(sql).run(); return { success: true }; },
    }),
    batch: async (stmts) => { for (const s of stmts) await s.run(); return []; },
  };
  await runReviewMigration(wrapDb);

  // Verify Scenario A
  const migAItems = db.prepare('SELECT id, status, item_key FROM review_action_items WHERE project_id=?').all('mig-proj');
  assert.equal(migAItems.length, 1, 'MIGRATION A: Exactly one row remains after deduplication');
  assert.equal(migAItems[0].status, '已处理', 'MIGRATION A: Winner preserves 已处理 status');
  assert.ok(migAItems[0].item_key, 'MIGRATION A: item_key is truly non-null');
  console.log('✅ PASS: MIGRATION A (NULL item_key backfill & preserve handled status)');

  // Verify Scenario B
  const migBBatches = db.prepare('SELECT id FROM note_review_batches WHERE project_id=?').all('mig-b');
  assert.equal(migBBatches.length, 1, 'MIGRATION B: Exactly 1 canonical batch exists');
  assert.equal(migBBatches[0].id, 'batch:mig-b:08-30', 'MIGRATION B: Canonical ID matches');
  const migBItems = db.prepare('SELECT batch_id FROM review_action_items WHERE project_id=?').all('mig-b');
  assert.equal(migBItems[0].batch_id, 'batch:mig-b:08-30', 'MIGRATION B: Items repointed to canonical batch');
  console.log('✅ PASS: MIGRATION B (Newer random batch + older canonical batch)');

  // Verify Scenario C
  const migCBatches = db.prepare('SELECT id FROM note_review_batches WHERE project_id=?').all('mig-c');
  assert.equal(migCBatches.length, 1, 'MIGRATION C: Exactly 1 canonical batch exists');
  assert.equal(migCBatches[0].id, 'batch:mig-c:08-30', 'MIGRATION C: Canonical ID matches');
  const migCItems = db.prepare('SELECT batch_id FROM review_action_items WHERE project_id=?').all('mig-c');
  assert.equal(migCItems[0].batch_id, 'batch:mig-c:08-30', 'MIGRATION C: Items repointed to canonical batch');
  console.log('✅ PASS: MIGRATION C (Newer canonical batch + older random batch)\n');

  // ----------------------------------------------------
  // TEST A: GET /api/review 纯读取 (5次调用零写入)
  // ----------------------------------------------------
  console.log('--- TEST A: GET /api/review 纯读取 ---');
  for (let i = 0; i < 5; i++) {
    const res = await httpRequest(BASE_URL + '/api/review?projectId=project-test-a&date=08-30');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.batch, null);
    assert.equal(data.items.length, 0);
    assert.equal(data.needsRecalculation, true);
  }
  const batchCountA = db.prepare('SELECT COUNT(*) AS c FROM note_review_batches WHERE project_id=?').get('project-test-a').c;
  const itemCountA = db.prepare('SELECT COUNT(*) AS c FROM review_action_items WHERE project_id=?').get('project-test-a').c;
  assert.equal(batchCountA, 0, 'TEST A: No batch rows inserted during GET requests');
  assert.equal(itemCountA, 0, 'TEST A: No item rows inserted during GET requests');
  console.log('✅ PASS: TEST A (GET 纯读取，5次零写入，返回 needsRecalculation=true)\n');

  // ----------------------------------------------------
  // TEST B: 并发 20 次 recalculate
  // ----------------------------------------------------
  console.log('--- TEST B: 并发 20 次 recalculate ---');
  console.log('Dispatching 20 recalculate requests...');
  const postPromises = Array.from({ length: 20 }, (_, idx) =>
    httpRequest(BASE_URL + '/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'recalculate', projectId: 'qicui', date: '08-30' }),
    }).then((res) => {
      console.log(`  Req ${idx+1} responded: ${res.status}`);
      return res;
    }).catch((err) => {
      console.error(`  Req ${idx+1} error: ${err.message}`);
      throw err;
    })
  );
  const responses = await Promise.all(postPromises);
  for (const r of responses) {
    assert.equal(r.status, 200, 'TEST B: Every response must be HTTP 200');
    const json = await r.json();
    assert.equal(json.ok, true, 'TEST B: Response must report ok: true');
  }
  const batchesB = db.prepare('SELECT COUNT(*) AS c FROM note_review_batches WHERE project_id=? AND date_key=?').get('qicui', '08-30').c;
  assert.equal(batchesB, 1, 'TEST B: Exactly 1 canonical batch created');

  const dupItems = db.prepare('SELECT item_key, COUNT(*) AS c FROM review_action_items WHERE project_id=? GROUP BY item_key HAVING c > 1').all('qicui');
  assert.equal(dupItems.length, 0, 'TEST B: No duplicate item_keys in review_action_items');
  console.log('✅ PASS: TEST B (20次并发重算，恰好1条批次，item_key唯一无冲突)\n');

  // ----------------------------------------------------
  // TEST C: 状态持久化与防复活
  // ----------------------------------------------------
  console.log('--- TEST C: 状态持久化与防复活 ---');
  const getResC1 = await httpRequest(BASE_URL + '/api/review?projectId=qicui&date=08-30&items=1');
  const dataC1 = await getResC1.json();
  assert.ok(dataC1.items.length > 0, 'TEST C: items must be returned');
  const targetItem = dataC1.items[0];

  // Mark as handled
  const resolveRes = await httpRequest(BASE_URL + '/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'resolve', projectId: 'qicui', id: targetItem.id }),
  });
  assert.equal((await resolveRes.json()).ok, true);

  // Recalculate again
  await httpRequest(BASE_URL + '/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'recalculate', projectId: 'qicui', date: '08-30' }),
  });

  // Restart server to test cold start
  console.log('Restarting application server...');
  stopServer();
  await startServer();
  await waitForHttp();

  // Verify status remains handled
  const getResC2 = await httpRequest(BASE_URL + '/api/review?projectId=qicui&date=08-30&items=1');
  const dataC2 = await getResC2.json();
  const verifiedItem = dataC2.items.find((it) => it.id === targetItem.id);
  assert.ok(verifiedItem, 'TEST C: target item exists');
  assert.equal(verifiedItem.status, '已处理', 'TEST C: status preserved across recalculate and restart');
  console.log('✅ PASS: TEST C (状态持久化为已处理，重算及重启后不复活)\n');

  // ----------------------------------------------------
  // TEST D: 失效待办 (达标后自动退出 pending)
  // ----------------------------------------------------
  console.log('--- TEST D: 失效待办生命周期 ---');
  const noteIdD = '66b0a111222333444555d001';
  db.prepare('INSERT INTO supplier_comments(project_id, external_key, note_id, note_url, creator, planned_content, matched_content, comment_format, visibility, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('proj-d', 'ext-d-1', noteIdD, 'https://www.xiaohongshu.com/explore/' + noteIdD, '博主D', '宝宝好喜欢喝', '宝宝好喜欢喝', '纯文案', '当前外显-原文一致', '2026-08-30T00:00:00.000Z');

  // Initial recalculate -> hits needSupplement
  await httpRequest(BASE_URL + '/api/actions/workbench', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'recalculate', projectId: 'proj-d', date: '08-30' }),
  });

  const pendingD1 = db.prepare('SELECT status, active FROM review_action_items WHERE project_id=? AND link LIKE ?').all('proj-d', '%' + noteIdD);
  assert.equal(pendingD1.length, 1);
  assert.equal(pendingD1[0].status, '待处理');
  assert.equal(pendingD1[0].active, 1);

  // Add 35 more positive comments to surpass baseCount 30
  for (let i = 2; i <= 36; i++) {
    db.prepare('INSERT INTO supplier_comments(project_id, external_key, note_id, note_url, creator, planned_content, matched_content, comment_format, visibility, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('proj-d', 'ext-d-' + i, noteIdD, 'https://www.xiaohongshu.com/explore/' + noteIdD, '博主D', '特别好吸收，便便正常' + i, '特别好吸收，便便正常' + i, '纯文案', '当前外显-原文一致', '2026-08-30T00:00:00.000Z');
  }

  // Recalculate again -> no longer hits needSupplement
  await httpRequest(BASE_URL + '/api/actions/workbench', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'recalculate', projectId: 'proj-d', date: '08-30' }),
  });

  const pendingD2 = db.prepare('SELECT status, active, obsolete_at FROM review_action_items WHERE project_id=? AND link LIKE ?').all('proj-d', '%' + noteIdD);
  assert.equal(pendingD2.length, 1);
  assert.equal(pendingD2[0].status, '已失效', 'TEST D: status updated to 已失效');
  assert.equal(pendingD2[0].active, 0, 'TEST D: active set to 0');
  assert.ok(pendingD2[0].obsolete_at, 'TEST D: obsolete_at timestamp populated');
  console.log('✅ PASS: TEST D (达标后自动退出 pending，标记为已失效)\n');

  // ----------------------------------------------------
  // TEST E: 多项目隔离 (/api/review, /api/actions/workbench, /api/agent)
  // ----------------------------------------------------
  console.log('--- TEST E: 多项目数据隔离 ---');
  const resReviewE = await (await httpRequest(BASE_URL + '/api/review?projectId=test-project-b&date=08-30')).json();
  assert.equal(resReviewE.items.length, 0, 'TEST E: review returns 0 items for project-b');

  const resWorkbenchE = await (await httpRequest(BASE_URL + '/api/actions/workbench?projectId=test-project-b')).json();
  assert.equal(resWorkbenchE.items.length, 0, 'TEST E: workbench returns 0 items for project-b');

  const resAgentE = await (await httpRequest(BASE_URL + '/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'test-project-b', prompt: '请根据 8.30 验收复盘生成报告' }),
  })).json();
  assert.equal(resAgentE.ok, true);

  const dbBatchesE = db.prepare('SELECT COUNT(*) AS c FROM note_review_batches WHERE project_id=?').get('test-project-b').c;
  const dbItemsE = db.prepare('SELECT COUNT(*) AS c FROM review_action_items WHERE project_id=?').get('test-project-b').c;
  assert.equal(dbBatchesE, 0, 'TEST E: project-b note_review_batches row count must remain 0');
  assert.equal(dbItemsE, 0, 'TEST E: project-b review_action_items row count must remain 0');
  console.log('✅ PASS: TEST E (多项目隔离，project-b 零数据且 review 表保持0行)\n');

  // ----------------------------------------------------
  // TEST F: Workbench 真实服务端分页 (225 条 key_comments)
  // ----------------------------------------------------
  console.log('--- TEST F: Workbench 225 条真实分页 ---');
  const nowF = new Date().toISOString();
  for (let i = 1; i <= 225; i++) {
    const id = 'kc-f-' + String(i).padStart(3, '0');
    db.prepare('INSERT INTO key_comments(id, project_id, note_id, content, author, created_at, sentiment, category, action, treatment_status, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, 'proj-f', 'note-f', '关键评论内容 ' + i, '用户' + i, nowF, '负向', '产品体验', '需回复', '待处理', nowF, nowF);
  }

  const p1 = await (await httpRequest(BASE_URL + '/api/actions/workbench?projectId=proj-f&page=1&pageSize=20')).json();
  const p6 = await (await httpRequest(BASE_URL + '/api/actions/workbench?projectId=proj-f&page=6&pageSize=20')).json();
  const p12 = await (await httpRequest(BASE_URL + '/api/actions/workbench?projectId=proj-f&page=12&pageSize=20')).json();

  assert.equal(p1.total, 225, 'TEST F: Total count is 225');
  assert.equal(p1.items.length, 20, 'TEST F: Page 1 has 20 items');
  assert.equal(p6.items.length, 20, 'TEST F: Page 6 has 20 items');
  assert.equal(p12.items.length, 5, 'TEST F: Page 12 has 5 items (221-225)');

  // Mark 1 item as handled
  const targetF = p1.items[0];
  await httpRequest(BASE_URL + '/api/actions/workbench', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'resolve', projectId: 'proj-f', rawId: targetF.rawId, source: 'key-comment' }),
  });
  const handledQuery = await (await httpRequest(BASE_URL + '/api/actions/workbench?projectId=proj-f&status=handled')).json();
  assert.equal(handledQuery.total, 1, 'TEST F: Handled query returns 1 item');
  console.log('✅ PASS: TEST F (225条 key_comments 真实分页：P1/P6/P12 与 handled 状态完全匹配)\n');

  // ----------------------------------------------------
  // TEST G: 内容搜索 (完整关键词匹配)
  // ----------------------------------------------------
  console.log('--- TEST G: 内容搜索 ---');
  db.prepare('INSERT INTO notes(id, title, author, source_type) VALUES (?, ?, ?, ?)')
    .run('note-g-1', '测试飞鹤超高端启萃深度测评', '奶粉测评师小王', 'owned');
  db.prepare('INSERT INTO project_notes(id, project_id, note_id, source_type, added_at) VALUES (?, ?, ?, ?, ?)')
    .run('proj-g:note-g-1', 'proj-g', 'note-g-1', 'owned', nowF);

  const resSearch = await (await httpRequest(BASE_URL + '/api/notes/list?projectId=proj-g&query=' + encodeURIComponent('超高端启萃'))).json();
  assert.equal(resSearch.total, 1, 'TEST G: Query matches 1 note');
  assert.equal(resSearch.items[0].id, 'note-g-1');
  console.log('✅ PASS: TEST G (内容台账完整关键词搜索正确过滤)\n');

  // ----------------------------------------------------
  // TEST H: 供应商日期筛选
  // ----------------------------------------------------
  console.log('--- TEST H: 供应商日期筛选 ---');
  db.prepare('INSERT INTO supplier_comments(project_id, external_key, note_id, creator, planned_content, visibility, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('proj-h', 'ext-h-1', 'note-h-1', '博主H1', '内容1', '当前外显-原文一致', '2026-08-28T12:00:00.000Z');
  db.prepare('INSERT INTO supplier_comments(project_id, external_key, note_id, creator, planned_content, visibility, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('proj-h', 'ext-h-2', 'note-h-2', '博主H2', '内容2', '当前外显-原文一致', '2026-08-30T12:00:00.000Z');

  const resH1 = await (await httpRequest(BASE_URL + '/api/supplier/list?projectId=proj-h&from=2026-08-29&to=2026-08-31')).json();
  assert.equal(resH1.total, 1, 'TEST H: Range 08-29 to 08-31 returns 1');
  assert.equal(resH1.items[0].creator, '博主H2');

  const resH2 = await (await httpRequest(BASE_URL + '/api/supplier/list?projectId=proj-h&from=2026-08-27&to=2026-08-28')).json();
  assert.equal(resH2.total, 1, 'TEST H: Range 08-27 to 08-28 returns 1');
  assert.equal(resH2.items[0].creator, '博主H1');
  console.log('✅ PASS: TEST H (供应商列表根据 verified_at 日期区间精准过滤)\n');

  // ----------------------------------------------------
  // TEST I: 核验全部 (650 条待核验批量全量处理)
  // ----------------------------------------------------
  console.log('--- TEST I: 650 条供应商核验全部 ---');
  for (let i = 1; i <= 650; i++) {
    const noteId = '66b0a999000111222333' + String(i % 10).padStart(4, '0');
    db.prepare('INSERT INTO supplier_comments(project_id, external_key, note_id, creator, planned_content, visibility) VALUES (?, ?, ?, ?, ?, ?)')
      .run('proj-i', 'ext-i-' + i, noteId, '达人' + i, '计划话术' + i, '待核验');
  }
  const supCountBefore = db.prepare("SELECT COUNT(*) AS c FROM supplier_comments WHERE project_id=? AND visibility='待核验'").get('proj-i').c;
  assert.equal(supCountBefore, 650, 'TEST I: 650 pending comments seeded');

  const verifyRes = await (await httpRequest(BASE_URL + '/api/supplier/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'proj-i' }),
  })).json();

  assert.equal(verifyRes.ok, true);
  assert.equal(verifyRes.processed, 650, 'TEST I: processed all 650 items across batches');
  assert.equal(verifyRes.remaining, 0, 'TEST I: remaining is 0');
  const supCountAfter = db.prepare("SELECT COUNT(*) AS c FROM supplier_comments WHERE project_id=? AND visibility='待核验'").get('proj-i').c;
  assert.equal(supCountAfter, 0, 'TEST I: 0 pending comments left in database');
  console.log('✅ PASS: TEST I (650条待核验分批循环一次全部完成，剩余0条)\n');

  // ----------------------------------------------------
  // TEST J: 缓存一致性与 fresh 机制
  // ----------------------------------------------------
  console.log('--- TEST J: 缓存一致性与 fresh 机制 ---');
  db.prepare('INSERT INTO projects(id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run('proj-j', '缓存测试项目', nowF, nowF);
  db.prepare('INSERT INTO notes(id, title, source_type) VALUES (?, ?, ?)')
    .run('note-j-1', '测试笔记1', 'owned');
  db.prepare('INSERT INTO project_notes(id, project_id, note_id, source_type, added_at) VALUES (?, ?, ?, ?, ?)')
    .run('proj-j:note-j-1', 'proj-j', 'note-j-1', 'owned', nowF);

  // Warm up cache
  const d1 = await (await httpRequest(BASE_URL + '/api/dashboard?projectId=proj-j')).json();
  assert.equal(d1.metrics.noteCount, 1, 'Initial note count is 1');

  // Direct mutation in DB
  db.prepare('INSERT INTO notes(id, title, source_type) VALUES (?, ?, ?)')
    .run('note-j-2', '测试笔记2', 'owned');
  db.prepare('INSERT INTO project_notes(id, project_id, note_id, source_type, added_at) VALUES (?, ?, ?, ?, ?)')
    .run('proj-j:note-j-2', 'proj-j', 'note-j-2', 'owned', nowF);

  // Normal GET should hit old cache
  const d2 = await (await httpRequest(BASE_URL + '/api/dashboard?projectId=proj-j')).json();
  assert.equal(d2.metrics.noteCount, 1, 'Unfresh GET hits cache (count=1)');

  // Fresh GET should immediately bust cache and return count=2
  const d3 = await (await httpRequest(BASE_URL + '/api/dashboard?projectId=proj-j&fresh=1')).json();
  assert.equal(d3.metrics.noteCount, 2, 'Fresh GET immediately returns updated count=2');

  // Subsequent normal GET should now return count=2
  const d4 = await (await httpRequest(BASE_URL + '/api/dashboard?projectId=proj-j')).json();
  assert.equal(d4.metrics.noteCount, 2, 'Subsequent normal GET hits new cache (count=2)');
  console.log('✅ PASS: TEST J (缓存预热、mutation 后 fresh 请求立即一致，无 10s 延迟)\n');

  console.log('==================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! 100% OPERATIONAL FIDELITY');
  console.log('==================================================\n');
  db.close();
}

try {
  await runAll();
} catch (err) {
  console.error('❌ VERIFICATION SUITE FAILED:', err);
  process.exitCode = 1;
} finally {
  if (localDb) {
    try { localDb.close(); } catch {}
    localDb = null;
  }
  stopServer();
  await new Promise((r) => setTimeout(r, 600));
  try {
    if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
    if (fs.existsSync(tmpDbPath + '-wal')) fs.unlinkSync(tmpDbPath + '-wal');
    if (fs.existsSync(tmpDbPath + '-shm')) fs.unlinkSync(tmpDbPath + '-shm');
    console.log('Temporary DB cleaned up: ' + tmpDbPath);
  } catch (e) {
    console.warn('Failed to clean temp DB:', e.message);
  }
}
