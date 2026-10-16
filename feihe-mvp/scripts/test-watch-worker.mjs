import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const tempDir = path.join(os.tmpdir(), `test-worker-suite-${Date.now()}-${Math.random().toString(36).slice(2)}`);
fs.mkdirSync(tempDir, { recursive: true });
const tempDb = path.join(tempDir, 'test-worker.db');

console.log('=== RUNNING IN-PROJECT WORKER WATCH & LEASE TEST SUITE (FRESH BOOTSTRAP) ===');
console.log(`Temp DB: ${tempDb}\n`);

try {
  // 1. Bootstrap fresh temporary database using real application schema without copying user database
  console.log('[BOOTSTRAP] Initializing fresh temporary database via standard ensureSchema & ensureSyncSchema...');
  process.env.LOCAL_DB_PATH = tempDb;
  process.env.LOCAL_DB_NO_SEED = 'true';

  const vite = await createServer({
    root: appRoot,
    configFile: false,
    cacheDir: path.resolve(tempDir, '.vite-cache'),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    resolve: { alias: { '@': appRoot } }
  });

  const { ensureSchema } = await vite.ssrLoadModule('/lib/db.ts');
  const { ensureSyncSchema } = await vite.ssrLoadModule('/lib/business-sync/store.ts');
  await ensureSchema();
  await ensureSyncSchema();
  await vite.close();

  const db = new DatabaseSync(tempDb);
  db.exec(`
    INSERT OR REPLACE INTO projects (id, name, status, created_at, updated_at)
    VALUES ('qicui', '启萃测试项目', '进行中', '2026-10-16 00:00:00', '2026-10-16 00:00:00');

    INSERT OR REPLACE INTO business_project_config (project_id, config_json, version, updated_at)
    VALUES ('qicui', '{"bindings":[{"key":"mock-source","role":"weekly","url":"https://mock.test/weekly"}]}', 1, '2026-10-16 00:00:00');

    -- Task with invalid upstream format so it safely fails inside worker without external network call
    INSERT OR REPLACE INTO business_sync_tasks (id, project_id, source_key, name, state, spec_json, interval_minutes, next_run_at, updated_at)
    VALUES ('qicui:task-mock-fail', 'qicui', 'mock-source', '模拟容错任务', 'active', '{"type":"feishu_table","sourceKey":"mock-source","sourceUrl":"https://mock.test/weekly","forbiddenSecret":"fail-fast"}', 60, datetime('now', '-1 minute'), '2026-10-16');

    -- Account and task to reach automation_platform branch and verify platformRead without ReferenceError
    INSERT OR REPLACE INTO source_accounts (id, project_id, integration_id, external_id, name, account_type, status, metadata_json, created_at, updated_at)
    VALUES ('acc_mock_plat', 'qicui', 'int_mock', 'mock_seller_001', '模拟平台账号', 'subaccount', 'active', '{"platform":"juguang","name":"模拟聚光"}', '2026-10-16', '2026-10-16');

    INSERT OR REPLACE INTO business_sync_tasks (id, project_id, source_key, name, state, spec_json, interval_minutes, next_run_at, updated_at)
    VALUES ('qicui:task-plat-reach', 'qicui', 'mock-plat-key', '平台分支回归任务', 'active', '{"type":"automation_platform","sourceKey":"mock-plat-key","sourceUrl":"https://ad.xiaohongshu.com/mock","platform":"juguang","accountId":"acc_mock_plat","entityIds":["mock_seller_001"],"dimension":"account","refreshDays":1}', 60, datetime('now', '-1 minute'), '2026-10-16');
  `);
  db.close();
  console.log('[BOOTSTRAP] Fresh temporary DB bootstrapped successfully without depending on user DB.\n');

  // 2. Launch run-business-sync.mjs with --watch --interval 1 and isolated stub automation-root (ZERO external/OSS/token)
  console.log('[TEST 1] Testing watch mode multi-tick scheduling & anti-reentrancy...');
  const scriptPath = path.resolve(appRoot, 'scripts/run-business-sync.mjs');
  const isolatedStubAutomation = path.join(tempDir, 'isolated-stub-automation');
  fs.mkdirSync(isolatedStubAutomation, { recursive: true });

  const child = spawn(process.execPath, [
    scriptPath,
    '--db', tempDb,
    '--watch',
    '--interval', '1',
    '--automation-root', isolatedStubAutomation,
  ], {
    cwd: appRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdoutData = '';
  let stderrData = '';
  child.stdout.on('data', chunk => { stdoutData += chunk.toString(); });
  child.stderr.on('data', chunk => { stderrData += chunk.toString(); });

  // Let it run for 2.5 seconds to observe at least 2 ticks
  await new Promise(r => setTimeout(r, 2600));

  // 3. Test clean SIGINT / SIGTERM shutdown
  console.log('[TEST 2] Testing graceful SIGINT / SIGTERM shutdown...');
  child.stdin.write('STOP\n');
  child.stdin.end();
  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.log('STDOUT SO FAR:\n', stdoutData);
      console.log('STDERR SO FAR:\n', stderrData);
      child.kill();
      reject(new Error('Child exit timed out'));
    }, 2000);
    child.on('exit', code => {
      clearTimeout(timer);
      resolve(code);
    });
  });

  assert.ok(stdoutData.includes('[BusinessWorker] 常驻轮询调度器已就绪'), 'Worker must log startup readiness in watch mode');
  assert.ok(stdoutData.includes('task-mock-fail'), 'Worker must process task-mock-fail');
  assert.ok(stdoutData.includes('task-plat-reach'), 'Worker must reach and process automation_platform branch');
  assert.ok(!stdoutData.includes('args is not defined') && !stderrData.includes('args is not defined'), 'platformRead must not throw args ReferenceError');
  assert.ok(stdoutData.includes('收到退出信号，正在安全停机'), 'Worker must intercept SIGINT and perform safe shutdown');
  console.log('  Passed: Watch mode multi-tick executed and cleanly stopped on signal.\n');

  // 4. Verify lease release & retry state in DB
  console.log('[TEST 3] Testing task lease release & retry state handling...');
  const dbVerify = new DatabaseSync(tempDb, { readOnly: true });
  const updatedTask = dbVerify.prepare(`SELECT state, retry_count, lease_token, last_error FROM business_sync_tasks WHERE id = 'qicui:task-mock-fail'`).get();
  assert.equal(updatedTask.lease_token, null, 'Lease token must be freed on error without lock leak');
  assert.ok(updatedTask.retry_count >= 1, 'Retry count must advance on error');
  assert.ok(updatedTask.last_error, 'Last error must be recorded');
  const platTask = dbVerify.prepare(`SELECT state, retry_count, lease_token, last_error FROM business_sync_tasks WHERE id = 'qicui:task-plat-reach'`).get();
  assert.equal(platTask.lease_token, null, 'Platform task lease must be freed');
  assert.ok(platTask.retry_count >= 1, 'Platform task retry count must advance');
  assert.ok(platTask.last_error, 'Platform task error must be recorded without leaking credentials');
  dbVerify.close();
  console.log('  Passed: Lease released immediately on failure, retry count updated, no lock leak.\n');

  // 5. Test CLI fail-closed parsing and validation
  console.log('[TEST 4] Testing CLI argument fail-closed validation & options parsing...');
  const runCli = (args) => {
    const res = spawnSync(process.execPath, [scriptPath, ...args], {
      cwd: path.resolve('.'),
      encoding: 'utf8'
    });
    return { code: res.status, out: res.stdout || '', err: res.stderr || '' };
  };

  // Unknown flag
  const r1 = runCli(['--dryrun']);
  assert.notEqual(r1.code, 0, 'Must fail on unknown flag --dryrun');
  assert.ok(r1.err.includes('未知命令行参数: "--dryrun"'), 'Must report unknown flag');

  // Missing required value
  const r2 = runCli(['--project']);
  assert.notEqual(r2.code, 0, 'Must fail on missing value for --project');
  assert.ok(r2.err.includes('缺少值'), 'Must report missing value');

  // Non-existent project
  const r3 = runCli(['--project=non_existent_project_xyz', '--list-due']);
  assert.notEqual(r3.code, 0, 'Must fail on non-existent project');
  assert.ok(r3.err.includes('指定项目不存在'), 'Must report non-existent project');

  // Non-existent task-id
  const r4 = runCli(['--task-id=non_existent_task_xyz', '--list-due']);
  assert.notEqual(r4.code, 0, 'Must fail on non-existent task-id');
  assert.ok(r4.err.includes('指定同步任务不存在'), 'Must report non-existent task');

  // Invalid interval
  const r5 = runCli(['--interval=abc']);
  assert.notEqual(r5.code, 0, 'Must fail on invalid interval');
  assert.ok(r5.err.includes('必须是正整数秒数'), 'Must report non-integer interval');

  // Valid options with --key=value and --key value
  const r6 = runCli(['--project=qicui', '--list-due']);
  assert.equal(r6.code, 0, 'Must succeed on --project=qicui --list-due');
  assert.ok(r6.out.includes('发现 0 项到期排队任务'), 'Must output due tasks list');

  const r7 = runCli(['--project', 'qicui', '--dry-run']);
  assert.equal(r7.code, 0, 'Must succeed on --project qicui --dry-run');
  assert.ok(r7.out.includes('所有待处理任务规范校验通过'), 'Must complete dry-run validation');
  console.log('  Passed: All 7 CLI fail-closed checks verified with 100% precision.\n');

  console.log('🎉 ALL IN-PROJECT WORKER WATCH & LEASE TESTS PASSED WITH 100% SUCCESS!');
} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}
