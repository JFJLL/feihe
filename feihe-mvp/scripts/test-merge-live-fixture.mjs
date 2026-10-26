import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseMergeCliArgs, runMergeProcess } from './merge-candidate-to-live-20261026.mjs';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

const tmpFixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-merge-live-'));
after(() => {
  try {
    fs.rmSync(tmpFixtureDir, { recursive: true, force: true });
  } catch {}
});

async function initEmptyDbWithFullSchema(dbFilePath) {
  process.env.LOCAL_DB_PATH = dbFilePath;
  process.env.LOCAL_DB_NO_SEED = 'true';
  const initVite = await createServer({
    root: appRoot,
    configFile: false,
    cacheDir: path.resolve(os.tmpdir(), `vite-init-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    resolve: { alias: { '@': appRoot } }
  });
  try {
    const store = await initVite.ssrLoadModule('/lib/business-daily/store.ts');
    await store.ensureBusinessSchema();
    const sync = await initVite.ssrLoadModule('/lib/business-sync/store.ts');
    await sync.ensureSyncSchema();
    const commentOps = await initVite.ssrLoadModule('/lib/comment-ops/store.ts');
    await commentOps.ensureCommentOpsSchema();
    const dbMod = await initVite.ssrLoadModule('/lib/db.ts');
    dbMod.closeDatabase();
  } finally {
    await initVite.close();
  }
}

async function setupSyntheticDatabases() {
  const livePath = path.join(tmpFixtureDir, `mock-live-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const candPath = path.join(tmpFixtureDir, `mock-cand-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

  await initEmptyDbWithFullSchema(livePath);
  await initEmptyDbWithFullSchema(candPath);

  // Setup Live DB
  const liveDb = new DatabaseSync(livePath);
  const initialLiveConfig = {
    alertThresholdPoints: 5,
    bindings: [
      { key: 'weekly-q4', role: 'weekly', url: 'https://example.test/weekly-q4' },
      { key: 'keywords', role: 'keywords', url: 'https://example.test/keywords-old' },
      { key: 'comments-register-2026-10', role: 'comment_register', url: 'https://example.test/comments-old' },
      { key: 'business-report', role: 'document', url: 'https://example.test/doc' }
    ]
  };
  liveDb.prepare("INSERT INTO business_project_config VALUES('qicui', ?, 8, '2026-10-20T00:00:00Z')").run(JSON.stringify(initialLiveConfig));
  liveDb.prepare("INSERT INTO business_sync_tasks(id, project_id, source_key, name, state, spec_json, interval_minutes, next_run_at, last_success_at, business_through, updated_at) VALUES('qicui:comments-register-2026-10', 'qicui', 'comments-register-2026-10', '评论登记', 'paused', '{\"type\":\"feishu_table\",\"sourceKey\":\"comments-register-2026-10\",\"sourceUrl\":\"https://example.test/comments-old\",\"role\":\"comment_register\",\"sheetId\":\"92HKJr\",\"range\":\"A1:AH20969\",\"periodFrom\":\"2026-10-01\",\"periodTo\":\"2026-10-31\"}', 360, '2026-10-14T13:43:06.785Z', '2026-10-14T07:43:06.785Z', '2026-10-13', '2026-10-14T13:43:06.785Z')").run();
  liveDb.prepare("INSERT INTO business_sync_tasks(id, project_id, source_key, name, state, spec_json, interval_minutes, next_run_at, last_success_at, business_through, updated_at) VALUES('qicui:weekly-q4', 'qicui', 'weekly-q4', '周表', 'active', '{}', 360, '2026-10-18T05:15:51.884Z', '2026-10-17T23:15:51.884Z', '2026-10-15', '2026-10-17T23:15:51.884Z')").run();
  liveDb.prepare("INSERT INTO business_sync_tasks(id, project_id, source_key, name, state, spec_json, interval_minutes, next_run_at, last_success_at, business_through, updated_at) VALUES('qicui:business-report', 'qicui', 'business-report', '日报', 'active', '{}', 360, '2026-10-18T05:40:09.737Z', '2026-10-17T23:40:09.737Z', '2026-10-15', '2026-10-17T23:40:09.737Z')").run();

  liveDb.prepare("INSERT OR IGNORE INTO projects(id, name, updated_at, created_at) VALUES('meiling', '美菱', '2026-10-20', '2026-10-20')").run();
  liveDb.prepare("INSERT OR IGNORE INTO projects(id, name, updated_at, created_at) VALUES('huang-tiane', '黄天鹅', '2026-10-20', '2026-10-20')").run();
  liveDb.prepare("INSERT INTO data_sources(id, project_id, name, spreadsheet, status, created_at, updated_at) VALUES('src-meiling-node-RQffw002Aik9aNkW9PScJ05knre', 'meiling', '美菱冰箱kpi管理表 副本', 'https://example.test/hndc', '元数据已核验', '2026-10-20', '2026-10-20')").run();
  liveDb.prepare("INSERT INTO data_sources(id, project_id, name, spreadsheet, status, created_at, updated_at) VALUES('src-meiling-node-MMPZwhQbMiVmIKkcyb9c7mDQnHp', 'meiling', '美菱冰箱618复盘数据 副本', 'https://example.test/mmpz-old', '元数据已核验', '2026-10-20', '2026-10-20')").run();
  liveDb.prepare("INSERT INTO data_sources(id, project_id, name, spreadsheet, status, created_at, updated_at) VALUES('src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd', 'meiling', '美菱冰箱双11日报表  副本', 'https://example.test/dkd-old', '元数据已核验', '2026-10-20', '2026-10-20')").run();
  liveDb.prepare("INSERT INTO data_sources(id, project_id, name, spreadsheet, status, created_at, updated_at) VALUES('src-huang-tiane-cid-fs', 'huang-tiane', '黄天鹅红猫CID 26年10月项目报表-fs 副本', 'https://example.test/cid-old', 'ready', '2026-10-20', '2026-10-20')").run();
  liveDb.prepare("INSERT INTO data_sources(id, project_id, name, spreadsheet, status, created_at, updated_at) VALUES('src-huang-tiane-commerce-canonical', 'huang-tiane', '黄天鹅商销日报主表', 'https://example.test/comm-old', 'ready', '2026-10-20', '2026-10-20')").run();
  liveDb.prepare("INSERT INTO data_sources(id, project_id, name, spreadsheet, status, created_at, updated_at) VALUES('src-huang-tiane-commerce-alt', 'huang-tiane', '黄天鹅商销日报副本', 'https://example.test/alt-old', 'ready', '2026-10-20', '2026-10-20')").run();

  liveDb.prepare("INSERT INTO project_settings VALUES('meiling:dash', 'meiling', 'campaign_dashboard', '{\"sources\":[{\"id\":\"src-meiling-node-RQffw002Aik9aNkW9PScJ05knre\",\"name\":\"旧\"}]}', '2026-10-20')").run();
  liveDb.prepare("INSERT INTO project_settings VALUES('huang:dash', 'huang-tiane', 'campaign_dashboard', '{\"sources\":[{\"id\":\"src-huang-tiane-commerce-alt\",\"name\":\"alt\"},{\"id\":\"src-huang-tiane-cid-fs\",\"name\":\"cid\"}]}', '2026-10-20')").run();
  liveDb.close();

  // Setup Candidate DB
  const candDb = new DatabaseSync(candPath);
  candDb.prepare("INSERT INTO sync_jobs VALUES('job-weekly-mock', 'qicui', 'weekly-q4', 'success', 48, 48, 0, '', '2026-10-26T02:52:45Z', '2026-10-26T02:52:54Z', 'unknown', '')").run();
  candDb.prepare("INSERT INTO sync_jobs VALUES('job-report-mock', 'qicui', 'business-report', 'success', 92, 92, 0, '', '2026-10-26T02:53:12Z', '2026-10-26T02:54:36Z', 'unknown', '')").run();
  candDb.prepare("INSERT INTO business_sync_tasks(id, project_id, source_key, name, state, spec_json, interval_minutes, next_run_at, last_success_at, business_through, last_run_id, updated_at) VALUES('qicui:weekly-q4', 'qicui', 'weekly-q4', '周表', 'active', '{}', 360, '2026-10-26T08:52:54.466Z', '2026-10-26T02:52:54.466Z', '2026-10-22', 'job-weekly-mock', '2026-10-26T02:52:54.466Z')").run();
  candDb.prepare("INSERT INTO business_sync_tasks(id, project_id, source_key, name, state, spec_json, interval_minutes, next_run_at, last_success_at, business_through, last_run_id, updated_at) VALUES('qicui:business-report', 'qicui', 'business-report', '日报', 'active', '{}', 360, '2026-10-26T08:54:36.987Z', '2026-10-26T02:54:36.987Z', '2026-10-22', 'job-report-mock', '2026-10-26T02:54:36.987Z')").run();

  // Candidate captures
  const kwPayload = { key: 'keywords', role: 'keywords', url: 'https://yimeichuanbo.feishu.cn/wiki/SbeDwPXAIicEimkRxDVco5I6nse?sheet=154ce5', version: '122', capturedAt: '2026-10-26T03:10:36.198Z', range: 'A1:H2', rows: [['市场出价','搜索指数','关键词','消费占比','消费','cpuv','CTR','CPC'],[22,100,'奶粉',0.1,500,200,0.1,10]], scopeLabel: '近三日数据，具体起止日期由来源维护', complete: true };
  candDb.prepare("INSERT INTO business_captures VALUES('qicui:kw:1', 'qicui', 'keywords', '122', '2026-10-26T03:10:36.198Z', ?, 'hash1')").run(JSON.stringify(kwPayload));
  candDb.prepare("INSERT INTO business_source_heads VALUES('qicui', 'keywords', 'qicui:kw:1', '2026-10-26T03:10:36.198Z')").run();

  const commHeaders = ['序号','更新时间','执行优先级','博主昵称','达人量级','评论形式','盖楼回复','笔记链接','评论话术','评论时间','上评','截图','执行人','执行方向','执行进度'];
  const commDataRow = [1,46300,'P0','小明','初级','单条','无','https://www.xiaohongshu.com/discovery/item/abcdef0123456789abcdef01','宝宝爱喝','2026-10-20','已上评',null,'张三','正向','已完成'];
  const commPayload = { key: 'comments-register-2026-10', role: 'comment_register', url: 'https://yimeichuanbo.feishu.cn/wiki/PGZIwT0Y0iUoIBkAoJVcI9MAnKb', version: '227501', capturedAt: '2026-10-26T03:13:26.226Z', range: 'A1:AO2', rows: [commHeaders, commDataRow], periodFrom: '2026-10-01', periodTo: '2026-10-31', complete: true };
  candDb.prepare("INSERT INTO business_captures VALUES('qicui:comm:1', 'qicui', 'comments-register-2026-10', '227501', '2026-10-26T03:13:26.226Z', ?, 'hash2')").run(JSON.stringify(commPayload));
  candDb.prepare("INSERT INTO business_source_heads VALUES('qicui', 'comments-register-2026-10', 'qicui:comm:1', '2026-10-26T03:13:26.226Z')").run();

  candDb.close();

  return { livePath, candPath };
}

test('parseMergeCliArgs: strictly rejects unknown flags, conflicting flags, and missing values', () => {
  assert.throws(
    () => parseMergeCliArgs(['--dry-run', '--apply']),
    /互斥参数冲突/
  );
  assert.throws(
    () => parseMergeCliArgs(['--unsupported-flag']),
    /未知命令行参数/
  );
  assert.throws(
    () => parseMergeCliArgs(['--db']),
    /缺少路径值/
  );
  assert.throws(
    () => parseMergeCliArgs(['--expected-version', 'not-a-number']),
    /必须为非负安全整数/
  );
  assert.throws(
    () => parseMergeCliArgs(['--expected-version', '-5']),
    /必须为非负安全整数/
  );

  const parsed = parseMergeCliArgs([]);
  assert.equal(parsed.isDryRun, true);
  assert.equal(parsed.isApply, false);
});

test('runMergeProcess: safety guard blocks --apply without explicit --approve', async () => {
  const { livePath, candPath } = await setupSyntheticDatabases();
  await assert.rejects(
    () => runMergeProcess({ customLiveDb: livePath, customCandidateDb: candPath, isApply: true, isApproved: false }),
    /requires explicit --approve flag/
  );
});

test('runMergeProcess: stageDB verification failure leaves live DB 100% untouched', async () => {
  const { livePath, candPath } = await setupSyntheticDatabases();

  // Corrupt candidate payload so stageDB ingest fails semantic checks
  const candDb = new DatabaseSync(candPath);
  const badPayload = { key: 'keywords', role: 'keywords', url: 'https://invalid-url.com', complete: false, version: '', capturedAt: 'invalid' };
  candDb.prepare("UPDATE business_captures SET payload_json=? WHERE source_key='keywords'").run(JSON.stringify(badPayload));
  candDb.close();

  const liveDbBefore = new DatabaseSync(livePath, { readOnly: true });
  const beforeConfig = liveDbBefore.prepare("SELECT version, config_json FROM business_project_config WHERE project_id='qicui'").get();
  const beforeTask = liveDbBefore.prepare("SELECT spec_json FROM business_sync_tasks WHERE id='qicui:comments-register-2026-10'").get();
  liveDbBefore.close();

  // Must reject on stageDB verification without touching live DB
  await assert.rejects(
    () => runMergeProcess({
      customLiveDb: livePath,
      customCandidateDb: candPath,
      isDryRun: false,
      isApply: true,
      isApproved: true,
    }),
    /stageDB 预验证失败，原库未受任何影响/
  );

  // Verify live DB remains 100% untouched
  const liveDbAfter = new DatabaseSync(livePath, { readOnly: true });
  const afterConfig = liveDbAfter.prepare("SELECT version, config_json FROM business_project_config WHERE project_id='qicui'").get();
  const afterTask = liveDbAfter.prepare("SELECT spec_json FROM business_sync_tasks WHERE id='qicui:comments-register-2026-10'").get();
  liveDbAfter.close();

  assert.equal(afterConfig.version, beforeConfig.version);
  assert.equal(afterConfig.config_json, beforeConfig.config_json);
  assert.equal(afterTask.spec_json, beforeTask.spec_json);
});

test('runMergeProcess: aborts on concurrent version collision without modifying live DB', async () => {
  const { livePath, candPath } = await setupSyntheticDatabases();

  const liveDb = new DatabaseSync(livePath);
  const initialRow = liveDb.prepare("SELECT version, config_json FROM business_project_config WHERE project_id='qicui'").get();
  // Concurrent writer bumped version to 9
  liveDb.prepare("UPDATE business_project_config SET version=version+1 WHERE project_id='qicui'").run();
  liveDb.close();

  // Trying to merge expecting old version (8) -> must reject and rollback
  await assert.rejects(
    () => runMergeProcess({
      customLiveDb: livePath,
      customCandidateDb: candPath,
      expectedConfigVersion: initialRow.version,
      isDryRun: false,
      isApply: true,
      isApproved: true,
    }),
    /Concurrent config modification detected in live DB/
  );

  const verifyDb = new DatabaseSync(livePath, { readOnly: true });
  const postCheck = verifyDb.prepare("SELECT version, config_json FROM business_project_config WHERE project_id='qicui'").get();
  verifyDb.close();
  assert.equal(postCheck.version, initialRow.version + 1);
});

test('runMergeProcess: aborts on concurrent note archive modification in live DB without modifying live DB', async () => {
  const { livePath, candPath } = await setupSyntheticDatabases();

  const liveDb = new DatabaseSync(livePath, { readOnly: true });
  const initialConfig = liveDb.prepare("SELECT version, config_json FROM business_project_config WHERE project_id='qicui'").get();
  liveDb.close();

  await assert.rejects(
    () => runMergeProcess({
      customLiveDb: livePath,
      customCandidateDb: candPath,
      simulateConcurrentNoteEdit: true,
      isDryRun: false,
      isApply: true,
      isApproved: true,
    }),
    /Concurrent note archive modification detected in live DB/
  );

  const verifyDb = new DatabaseSync(livePath, { readOnly: true });
  const postCheck = verifyDb.prepare("SELECT version, config_json FROM business_project_config WHERE project_id='qicui'").get();
  const userNote = verifyDb.prepare("SELECT data_json FROM business_note_archives WHERE project_id='qicui' AND note_id='note-user-edit-mid-stage'").get();
  verifyDb.close();

  assert(userNote && userNote.data_json.includes('user edited during stage'));
  assert.equal(postCheck.version, initialConfig.version);
});

test('runMergeProcess: successful merge applies verified delta atomically with backup', async () => {
  const { livePath, candPath } = await setupSyntheticDatabases();

  const result = await runMergeProcess({
    customLiveDb: livePath,
    customCandidateDb: candPath,
    isDryRun: false,
    isApply: true,
    isApproved: true,
  });

  assert.equal(result.status, 'success');
  assert(result.liveBackupPath && fs.existsSync(result.liveBackupPath), 'backup was created');

  const verifyDb = new DatabaseSync(livePath, { readOnly: true });
  const config = JSON.parse(verifyDb.prepare("SELECT config_json FROM business_project_config WHERE project_id='qicui'").get().config_json);
  assert.equal(config.bindings.find(b => b.key === 'keywords')?.url, 'https://yimeichuanbo.feishu.cn/wiki/SbeDwPXAIicEimkRxDVco5I6nse?sheet=154ce5');
  assert.equal(config.bindings.find(b => b.key === 'comments-register-2026-10')?.url, 'https://yimeichuanbo.feishu.cn/wiki/PGZIwT0Y0iUoIBkAoJVcI9MAnKb');

  const commTask = verifyDb.prepare("SELECT state, next_run_at, spec_json FROM business_sync_tasks WHERE id='qicui:comments-register-2026-10'").get();
  assert.equal(commTask.state, 'paused');
  assert.equal(commTask.next_run_at, '2026-10-14T13:43:06.785Z'); // preserved from live
  const commSpec = JSON.parse(commTask.spec_json);
  assert.equal(commSpec.range, undefined, 'range deleted from spec');
  assert.equal(commSpec.sourceUrl, 'https://yimeichuanbo.feishu.cn/wiki/PGZIwT0Y0iUoIBkAoJVcI9MAnKb');

  const weeklyTask = verifyDb.prepare("SELECT last_success_at, business_through, last_run_id FROM business_sync_tasks WHERE id='qicui:weekly-q4'").get();
  assert.equal(weeklyTask.last_run_id, 'job-weekly-mock');
  assert.equal(weeklyTask.business_through, '2026-10-22');

  const reportTask = verifyDb.prepare("SELECT last_success_at, business_through, last_run_id FROM business_sync_tasks WHERE id='qicui:business-report'").get();
  assert.equal(reportTask.last_run_id, 'job-report-mock');
  assert.equal(reportTask.business_through, '2026-10-22');

  const copiedJob = verifyDb.prepare("SELECT * FROM sync_jobs WHERE id='job-weekly-mock'").get();
  assert(copiedJob && copiedJob.status === 'success');

  const deliveries = verifyDb.prepare("SELECT * FROM business_comment_deliveries WHERE project_id='qicui' AND source_key='comments-register-2026-10'").all();
  assert.equal(deliveries.length, 1);

  const noteArchives = verifyDb.prepare("SELECT * FROM business_note_archives WHERE project_id='qicui'").all();
  assert.equal(noteArchives.length, 1);

  const altSource = verifyDb.prepare("SELECT status, is_paused FROM data_sources WHERE id='src-huang-tiane-commerce-alt'").get();
  assert.equal(altSource.status, 'retired');
  assert.equal(altSource.is_paused, 1);

  const huangDash = JSON.parse(verifyDb.prepare("SELECT value FROM project_settings WHERE project_id='huang-tiane' AND key='campaign_dashboard'").get().value);
  assert.equal(huangDash.sources.some(s => s.id === 'src-huang-tiane-commerce-alt'), false, 'alt removed from active sources');

  verifyDb.close();
});
