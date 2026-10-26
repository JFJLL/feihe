import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { createHash } from 'node:crypto';

function computeRowsDigest(rows) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

const candidateDbPath = path.resolve(appRoot, '.verification/live-sync-20261026/qicui-candidate.db');
const liveDbPath = path.resolve(appRoot, 'data/local.db');
const backupDir = path.resolve(appRoot, '.verification/live-sync-20261026');
const exportPayloadPath = path.resolve(backupDir, 'export-payloads-20261026.json');

export function parseMergeCliArgs(argv = process.argv.slice(2)) {
  const allowed = new Set(['dry-run', 'apply', 'approve', 'confirmed', 'db', 'candidate-db', 'expected-version', 'help']);
  let isDryRun = false;
  let isApply = false;
  let isApproved = false;
  let customLiveDb = null;
  let customCandidateDb = null;
  let expectedConfigVersion = null;

  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith('--')) {
      throw new Error(`无效命令行参数: "${item}"。所有选项必须以 "--" 开头。`);
    }
    const key = item.slice(2);
    if (!allowed.has(key)) {
      throw new Error(`未知命令行参数: "--${key}"。可用参数: ${Array.from(allowed).map(f => '--' + f).join(', ')}`);
    }
    if (key === 'dry-run') isDryRun = true;
    else if (key === 'apply') isApply = true;
    else if (key === 'approve' || key === 'confirmed') isApproved = true;
    else if (key === 'db') {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error('参数 "--db" 缺少路径值');
      customLiveDb = argv[++i];
    } else if (key === 'candidate-db') {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error('参数 "--candidate-db" 缺少路径值');
      customCandidateDb = argv[++i];
    } else if (key === 'expected-version') {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error('参数 "--expected-version" 缺少数值');
      const raw = argv[++i];
      const parsedNum = Number(raw);
      if (!Number.isSafeInteger(parsedNum) || parsedNum < 0) {
        throw new Error(`参数 "--expected-version" 必须为非负安全整数 (收到: "${raw}")`);
      }
      expectedConfigVersion = parsedNum;
    } else if (key === 'help') {
      console.log('用法: node scripts/merge-candidate-to-live-20261026.mjs [--dry-run | --apply --approve] [--db <path>] [--candidate-db <path>]');
      process.exit(0);
    }
  }

  if (isDryRun && isApply) {
    throw new Error('互斥参数冲突: 不能同时指定 "--dry-run" 与 "--apply"');
  }
  if (!isDryRun && !isApply) {
    isDryRun = true;
  }

  return { isDryRun, isApply, isApproved, customLiveDb, customCandidateDb, expectedConfigVersion };
}

export function resolvePythonBinary(customBin = null, platform = process.platform, env = process.env) {
  if (customBin && typeof customBin === 'string' && customBin.trim().length > 0) {
    return customBin.trim();
  }
  if (env.PYTHON_BIN && env.PYTHON_BIN.trim().length > 0) {
    return env.PYTHON_BIN.trim();
  }
  if (env.PYTHON && env.PYTHON.trim().length > 0) {
    return env.PYTHON.trim();
  }
  if (env.FEIHE_PYTHON && env.FEIHE_PYTHON.trim().length > 0) {
    return env.FEIHE_PYTHON.trim();
  }
  return platform === 'win32' ? 'python' : 'python3';
}

export function backupLiveDbWithApi(srcDbPath, dstBackupPath, options = {}) {
  const resolvedSrc = path.resolve(srcDbPath);
  const resolvedDst = path.resolve(dstBackupPath);

  const isSamePath = (options.platform || process.platform) === 'win32'
    ? resolvedSrc.toLowerCase() === resolvedDst.toLowerCase()
    : resolvedSrc === resolvedDst;

  if (isSamePath) {
    throw new Error(`SQLite online backup failed: source and destination paths cannot be the same ("${resolvedSrc}")`);
  }

  if (!fs.existsSync(resolvedSrc)) {
    throw new Error(`SQLite online backup failed: source database does not exist at "${resolvedSrc}"`);
  }

  fs.mkdirSync(path.dirname(resolvedDst), { recursive: true });

  const pythonBin = resolvePythonBinary(
    options.pythonBin,
    options.platform || process.platform,
    options.env || process.env
  );

  const backupScript = [
    'import sqlite3, pathlib, sys',
    'src_uri = pathlib.Path(sys.argv[1]).resolve().as_uri() + "?mode=ro"',
    'dst_path = str(pathlib.Path(sys.argv[2]).resolve())',
    'src = sqlite3.connect(src_uri, uri=True)',
    'dst = sqlite3.connect(dst_path)',
    'try:',
    '    src.backup(dst)',
    '    cur = dst.cursor()',
    '    cur.execute("PRAGMA integrity_check;")',
    '    res = cur.fetchall()',
    '    cur.close()',
    '    if not res or res[0][0] != "ok":',
    '        raise RuntimeError(f"Integrity check failed on backup database: {res}")',
    'finally:',
    '    dst.close()',
    '    src.close()',
  ].join('\n');

  try {
    execFileSync(pythonBin, ['-c', backupScript, resolvedSrc, resolvedDst], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,
      env: options.env || process.env,
    });
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString('utf-8').trim() : '';
    const detail = stderr ? `: ${stderr}` : (err.message ? `: ${err.message}` : '');
    throw new Error(`SQLite online backup failed from "${resolvedSrc}" to "${resolvedDst}" using "${pythonBin}"${detail}`);
  }

  if (!fs.existsSync(resolvedDst)) {
    throw new Error(`SQLite online backup failed: destination backup file was not created at "${resolvedDst}"`);
  }
}

export async function runMergeProcess(options = {}) {
  const targetLiveDb = path.resolve(options.customLiveDb || liveDbPath);
  const targetCandDb = path.resolve(options.customCandidateDb || candidateDbPath);
  const isDryRun = options.isDryRun ?? true;
  const isApply = options.isApply ?? false;
  const isApproved = options.isApproved ?? false;
  const expectedVersionOverride = options.expectedConfigVersion ?? null;
  const simulateConcurrentNoteEdit = options.simulateConcurrentNoteEdit ?? false;

  console.log('==================================================');
  console.log('LIVE MERGE SCRIPT: CANDIDATE -> LIVE (SELECTIVE)');
  console.log(`Live DB:      ${targetLiveDb}`);
  console.log(`Candidate DB: ${targetCandDb}`);
  console.log(`Mode:         ${isApply ? 'APPLY (Strict Guarded)' : 'DRY-RUN (Inspection Only)'}`);
  console.log('==================================================\n');

  if (!fs.existsSync(targetCandDb)) {
    throw new Error(`Candidate DB not found at: ${targetCandDb}`);
  }
  if (!fs.existsSync(targetLiveDb)) {
    throw new Error(`Live DB not found at: ${targetLiveDb}`);
  }

  const candDb = new DatabaseSync(targetCandDb, { readOnly: true });
  const liveDbReadOnly = new DatabaseSync(targetLiveDb, { readOnly: true });

  // 1. Preflight Integrity Check
  const liveCheck = liveDbReadOnly.prepare('PRAGMA integrity_check').all();
  if (liveCheck[0]?.integrity_check !== 'ok') {
    throw new Error(`Live DB integrity check failed: ${JSON.stringify(liveCheck)}`);
  }
  const candCheck = candDb.prepare('PRAGMA integrity_check').all();
  if (candCheck[0]?.integrity_check !== 'ok') {
    throw new Error(`Candidate DB integrity check failed: ${JSON.stringify(candCheck)}`);
  }

  // 2. Export changed captures from candidate to construct SourceBundle
  const candHeads = candDb.prepare("SELECT source_key, capture_id FROM business_source_heads WHERE project_id='qicui'").all();
  const activeHeadMap = new Map(candHeads.map(h => [h.source_key, h.capture_id]));

  const targetSourceKeys = ['weekly-q4', 'keywords', 'comments-register-2026-10', 'business-report'];
  const relevantKeys = candHeads.map(h => h.source_key).filter(k =>
    targetSourceKeys.includes(k) ||
    k.startsWith('platform_snapshot-2026-10-') ||
    k.startsWith('creator_snapshot-2026-10-') ||
    k.startsWith('budget_plan-2026-10-')
  );

  const bundleTables = [];
  let bundleDocument = null;
  for (const sk of relevantKeys) {
    const capId = activeHeadMap.get(sk);
    const capRow = candDb.prepare("SELECT payload_json FROM business_captures WHERE id=? AND project_id='qicui'").get(capId);
    if (capRow) {
      const parsed = JSON.parse(capRow.payload_json);
      if (parsed.content !== undefined) {
        bundleDocument = parsed;
      } else {
        bundleTables.push(parsed);
      }
    }
  }

  const bundleToIngest = {
    tables: bundleTables,
    ...(bundleDocument ? { document: bundleDocument } : {})
  };

  const candWeeklyTask = candDb.prepare("SELECT last_success_at, business_through, last_run_id FROM business_sync_tasks WHERE id='qicui:weekly-q4'").get();
  const candReportTask = candDb.prepare("SELECT last_success_at, business_through, last_run_id FROM business_sync_tasks WHERE id='qicui:business-report'").get();
  const candSyncJobs = candDb.prepare(
    "SELECT * FROM sync_jobs WHERE id IN (?, ?) AND project_id='qicui' AND status='success'"
  ).all(candWeeklyTask?.last_run_id || '', candReportTask?.last_run_id || '');

  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(exportPayloadPath, JSON.stringify({
    sourceKeys: relevantKeys,
    tablesCount: bundleTables.length,
    documentKey: bundleDocument?.key,
    weeklyTask: candWeeklyTask,
    reportTask: candReportTask,
    syncJobsCount: candSyncJobs.length,
  }, null, 2), 'utf8');
  console.log(`[Export] Payload exported to: ${exportPayloadPath}`);
  console.log(` - Tables in bundle to ingest: ${bundleTables.length}`);
  console.log(` - Document in bundle to ingest: ${bundleDocument ? bundleDocument.key : 'none'}\n`);

  // 3. Expected Live States & Diff Preparation
  console.log('=== PREPARED LIVE MERGE DIFF ===');
  const liveCfgRow = liveDbReadOnly.prepare("SELECT version, config_json FROM business_project_config WHERE project_id='qicui'").get();
  const liveCfg = JSON.parse(liveCfgRow.config_json);
  const liveKw = liveCfg.bindings.find(b => b.key === 'keywords');
  const liveComm = liveCfg.bindings.find(b => b.key === 'comments-register-2026-10');

  const targetKwUrl = 'https://yimeichuanbo.feishu.cn/wiki/SbeDwPXAIicEimkRxDVco5I6nse?sheet=154ce5';
  const targetCommUrl = 'https://yimeichuanbo.feishu.cn/wiki/PGZIwT0Y0iUoIBkAoJVcI9MAnKb';

  console.log('\n[1] business_project_config bindings (qicui):');
  console.log(` - Expected version: ${liveCfgRow.version}`);
  console.log(` - [keywords] URL:  "${liveKw?.url}" -> "${targetKwUrl}"`);
  console.log(` - [comments-register-2026-10] URL: "${liveComm?.url}" -> "${targetCommUrl}"`);

  const liveCommTask = liveDbReadOnly.prepare("SELECT id, state, next_run_at, spec_json FROM business_sync_tasks WHERE id='qicui:comments-register-2026-10'").get();
  const liveCommSpec = JSON.parse(liveCommTask.spec_json || '{}');
  const { range: _ignoredRange, ...liveCommSpecNoRange } = liveCommSpec;
  const updatedCommSpec = {
    ...liveCommSpecNoRange,
    sourceUrl: targetCommUrl,
  };

  const liveWeeklyTask = liveDbReadOnly.prepare("SELECT id, last_success_at, business_through, next_run_at FROM business_sync_tasks WHERE id='qicui:weekly-q4'").get();
  const liveReportTask = liveDbReadOnly.prepare("SELECT id, last_success_at, business_through, next_run_at FROM business_sync_tasks WHERE id='qicui:business-report'").get();

  // Preflight baseline digests for concurrency protection
  const baselineNoteArchives = liveDbReadOnly.prepare("SELECT note_id, data_json, updated_at FROM business_note_archives WHERE project_id='qicui' ORDER BY note_id").all();
  const baselineNoteArchivesDigest = computeRowsDigest(baselineNoteArchives);

  const baselineDeliveries = liveDbReadOnly.prepare("SELECT id, data_json FROM business_comment_deliveries WHERE project_id='qicui' AND source_key='comments-register-2026-10' ORDER BY id").all();
  const baselineDeliveriesDigest = computeRowsDigest(baselineDeliveries);

  const baselineTargetHeads = liveDbReadOnly.prepare("SELECT source_key, capture_id, captured_at FROM business_source_heads WHERE project_id='qicui' AND source_key IN ('keywords', 'comments-register-2026-10', 'weekly-q4', 'business-report') ORDER BY source_key").all();
  const baselineTargetHeadsDigest = computeRowsDigest(baselineTargetHeads);

  console.log('\n[2] business_sync_tasks:');
  console.log(` - [qicui:comments-register-2026-10]:`);
  console.log(`     state:       "${liveCommTask.state}" (PRESERVED paused)`);
  console.log(`     next_run_at: "${liveCommTask.next_run_at}" (PRESERVED, never overwritten with candidate 2099)`);
  console.log(`     sourceUrl:   "${liveCommSpec.sourceUrl}" -> "${targetCommUrl}"`);
  console.log(`     range:       "${liveCommSpec.range}" -> (DELETED, dynamic range from sheet)`);
  console.log(` - [qicui:weekly-q4]:`);
  console.log(`     last_success_at:  "${liveWeeklyTask.last_success_at}" -> "${candWeeklyTask.last_success_at}"`);
  console.log(`     business_through: "${liveWeeklyTask.business_through}" -> "${candWeeklyTask.business_through}"`);
  console.log(`     next_run_at:      "${liveWeeklyTask.next_run_at}" (PRESERVED)`);
  console.log(` - [qicui:business-report]:`);
  console.log(`     last_success_at:  "${liveReportTask.last_success_at}" -> "${candReportTask.last_success_at}"`);
  console.log(`     business_through: "${liveReportTask.business_through}" -> "${candReportTask.business_through}"`);
  console.log(`     next_run_at:      "${liveReportTask.next_run_at}" (PRESERVED)`);
  console.log(` - Other platform tasks: 0 modifications (untouched)`);

  const dsUpdates = [
    {
      id: 'src-meiling-node-RQffw002Aik9aNkW9PScJ05knre',
      name: '美菱冰箱kpi管理表',
      spreadsheet: 'https://yimeichuanbo.feishu.cn/wiki/RQffw002Aik9aNkW9PScJ05knre',
      sheet_id: '4SGaOf',
      mapping_json: JSON.stringify({
        obj_token: 'NclHsAryQhAk52tGECXcF2JTnwb',
        obj_type: 'sheet',
        wiki_token: 'RQffw002Aik9aNkW9PScJ05knre',
        sheet_id: '4SGaOf',
        detail: '内部真实维护源：美菱冰箱kpi管理表（原 HNDCwmdpkiw4DgkFSNycB3cbnSc 副本已停用）',
      }),
    },
    {
      id: 'src-meiling-node-MMPZwhQbMiVmIKkcyb9c7mDQnHp',
      name: '美菱冰箱618复盘数据',
      spreadsheet: 'https://yimeichuanbo.feishu.cn/wiki/E7LWwhPFhi8XNTkSXvoceiZfnJh',
      sheet_id: '4a19cf',
      mapping_json: JSON.stringify({
        obj_token: 'IRHvsTWqXhzMU8tgdD7ctnVqnYb',
        obj_type: 'sheet',
        wiki_token: 'E7LWwhPFhi8XNTkSXvoceiZfnJh',
        sheet_id: '4a19cf',
        detail: '内部真实维护源：618大促历史复盘数据（原 MMPZwhQbMiVmIKkcyb9c7mDQnHp 副本已停用）',
      }),
    },
    {
      id: 'src-meiling-node-DkdOwDEk0i9FTUkXlh1cTE0fnOd',
      name: '美菱冰箱双11日报表',
      spreadsheet: 'https://yimeichuanbo.feishu.cn/wiki/DMMpwdQShiyEpyk89jVcP6GInjg',
      sheet_id: 'smsJa2',
      mapping_json: JSON.stringify({
        obj_token: 'K63bsyzvNhXuWTtY4aLcF9kpnnd',
        obj_type: 'sheet',
        wiki_token: 'DMMpwdQShiyEpyk89jVcP6GInjg',
        sheet_id: 'smsJa2',
        detail: '内部真实维护源：双11投放日报与分日明细（原 DkdOwDEk0i9FTUkXlh1cTE0fnOd 副本已停用）',
      }),
    },
    {
      id: 'src-huang-tiane-cid-fs',
      name: '黄天鹅红猫CID 26年10月项目报表-fs',
      spreadsheet: 'https://yimeichuanbo.feishu.cn/wiki/DcFqwVVr8i6qgMkzWhhc4Zdnnqb',
      sheet_id: '',
      mapping_json: JSON.stringify({
        obj_token: 'ERxXsBh6ehwgfDtQwAYcaxlZnEc',
        wiki_token: 'DcFqwVVr8i6qgMkzWhhc4Zdnnqb',
        sheets_count: 20,
        role: '红猫CID与分日明细',
      }),
    },
    {
      id: 'src-huang-tiane-commerce-canonical',
      name: '黄天鹅商销日报表',
      spreadsheet: 'https://yimeichuanbo.feishu.cn/wiki/FqHUwqtu8iM1P7kD5IXcdr2Rn7c',
      sheet_id: '',
      mapping_json: JSON.stringify({
        obj_token: 'XvqasKtUFhKZI2tqlEEcC0qtnph',
        wiki_token: 'FqHUwqtu8iM1P7kD5IXcdr2Rn7c',
        sheets_count: 8,
        canonical: true,
        role: '商销日报主表',
      }),
    },
    {
      id: 'src-huang-tiane-commerce-alt',
      status: 'retired',
      is_paused: 1,
    },
  ];

  const baselineDsMap = new Map();
  console.log('\n[3] data_sources (5 canonical remaps + 1 retired):');
  for (const ds of dsUpdates) {
    const liveRow = liveDbReadOnly.prepare('SELECT id, name, spreadsheet, status, is_paused, sheet_id, mapping_json, updated_at FROM data_sources WHERE id=?').get(ds.id);
    if (liveRow) baselineDsMap.set(ds.id, liveRow);
    console.log(` - [${ds.id}]`);
    if (ds.name) console.log(`     name: "${liveRow?.name}" -> "${ds.name}"`);
    if (ds.spreadsheet) console.log(`     url:  "${liveRow?.spreadsheet}" -> "${ds.spreadsheet}"`);
    if (ds.status) console.log(`     status: "${liveRow?.status}" -> "${ds.status}" (is_paused=1)`);
  }

  console.log('\n[4] project_settings active sources:');
  for (const projId of ['meiling', 'huang-tiane']) {
    const row = liveDbReadOnly.prepare("SELECT value FROM project_settings WHERE project_id=? AND key='campaign_dashboard'").get(projId);
    if (row) {
      const snap = JSON.parse(row.value);
      if (projId === 'huang-tiane') {
        const beforeCount = snap.sources.length;
        snap.sources = snap.sources.filter(s => s.id !== 'src-huang-tiane-commerce-alt');
        console.log(` - huang-tiane: removed src-huang-tiane-commerce-alt (active count: ${beforeCount} -> ${snap.sources.length})`);
      }
      for (const s of snap.sources) {
        const match = dsUpdates.find(u => u.id === s.id);
        if (match && match.name) {
          s.name = match.name;
          s.url = match.spreadsheet;
        }
      }
      console.log(` - ${projId} active sources: ${snap.sources.map(s => s.name).join(', ')}`);
    }
  }

  console.log('\n==================================================');
  if (!isApply) {
    console.log('DRY-RUN COMPLETE. No live database writes were made.');
    console.log('To execute live merge upon user approval, run:');
    console.log('node scripts/merge-candidate-to-live-20261026.mjs --apply --approve');
    candDb.close();
    liveDbReadOnly.close();
    return { status: 'dry-run-complete', liveBackupPath: null };
  }

  if (!isApproved) {
    candDb.close();
    liveDbReadOnly.close();
    throw new Error('Safety guard: --apply requires explicit --approve flag from user authorization.');
  }

  const expectedVersionToCheck = expectedVersionOverride !== null ? expectedVersionOverride : liveCfgRow.version;
  candDb.close();
  liveDbReadOnly.close();

  // --- APPLY PHASE WITH STAGED VERIFICATION ---
  console.log('\n>>> EXECUTING STAGED VERIFICATION & ATOMIC MERGE <<<');
  const now = new Date().toISOString();
  const backupTimestamp = now.replace(/[:.]/g, '-');
  const liveBackupPath = path.join(backupDir, `live-backup-pre-merge-${backupTimestamp}.db`);
  const stageDbPath = path.join(os.tmpdir(), `stage-merge-${Date.now()}-${crypto.randomUUID()}.db`);

  // Step 1: Create consistent clone stageDB from live
  console.log(`Step 1: Creating staging clone (stageDB) from live baseline at:\n        ${stageDbPath}`);
  backupLiveDbWithApi(targetLiveDb, stageDbPath);

  // Step 2: Pre-run updates and store.ingestBusinessBundle on stageDB
  console.log('\nStep 2: Pre-running metadata updates & ingestBusinessBundle on stageDB...');
  const stageDb = new DatabaseSync(stageDbPath);
  try {
    const stageCfg = JSON.parse(liveCfgRow.config_json);
    const kwB = stageCfg.bindings.find(b => b.key === 'keywords');
    if (kwB) kwB.url = targetKwUrl;
    const commB = stageCfg.bindings.find(b => b.key === 'comments-register-2026-10');
    if (commB) commB.url = targetCommUrl;
    stageDb.prepare("UPDATE business_project_config SET config_json=?, version=version+1, updated_at=? WHERE project_id='qicui'")
      .run(JSON.stringify(stageCfg), now);
  } finally {
    stageDb.close();
  }

  // Run ingest on stageDB via Vite runner
  process.env.LOCAL_DB_PATH = stageDbPath;
  process.env.LOCAL_DB_NO_SEED = 'true';
  const stageVite = await createServer({
    root: appRoot,
    configFile: false,
    cacheDir: path.resolve(appRoot, 'node_modules/.vite/stage-merge-runner'),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    resolve: { alias: { '@': appRoot } }
  });

  let stageIngestReceipts = [];
  let stageCloseDb = null;
  try {
    const stageStore = await stageVite.ssrLoadModule('/lib/business-daily/store.ts');
    const stageDbMod = await stageVite.ssrLoadModule('/lib/db.ts');
    stageCloseDb = stageDbMod.closeDatabase;
    const result = await stageStore.ingestBusinessBundle('qicui', bundleToIngest);
    stageIngestReceipts = result.receipts || [];
    console.log(` - stageDB verification succeeded: ${stageIngestReceipts.length} receipts ingested`);
  } catch (stageErr) {
    if (typeof stageCloseDb === 'function') stageCloseDb();
    await stageVite.close();
    try { fs.unlinkSync(stageDbPath); } catch {}
    throw new Error(`stageDB 预验证失败，原库未受任何影响: ${stageErr instanceof Error ? stageErr.message : String(stageErr)}`);
  } finally {
    if (typeof stageCloseDb === 'function') stageCloseDb();
    await stageVite.close();
  }

  // Step 3: Extract verified delta from stageDB
  const stageDbVerified = new DatabaseSync(stageDbPath, { readOnly: true });
  const baselineLiveForCheck = new DatabaseSync(targetLiveDb, { readOnly: true });
  const baselineCaptureIds = new Set(
    baselineLiveForCheck.prepare("SELECT id FROM business_captures WHERE project_id='qicui'").all().map(r => r.id)
  );
  baselineLiveForCheck.close();
  const newCaptures = stageDbVerified.prepare("SELECT * FROM business_captures WHERE project_id='qicui'").all().filter(c => !baselineCaptureIds.has(c.id));
  // Filter newHeads strictly to relevantKeys (do not touch other project heads)
  const relevantKeysSet = new Set(relevantKeys);
  const newHeads = stageDbVerified.prepare("SELECT * FROM business_source_heads WHERE project_id='qicui'").all().filter(h => relevantKeysSet.has(h.source_key));
  const newDailyReports = stageDbVerified.prepare("SELECT * FROM business_daily_reports WHERE project_id='qicui' AND business_day >= '2026-10-19'").all();
  const newReceipts = stageDbVerified.prepare("SELECT * FROM business_sync_receipts WHERE project_id='qicui'").all();
  const newCommentDeliveries = stageDbVerified.prepare("SELECT * FROM business_comment_deliveries WHERE project_id='qicui' AND source_key='comments-register-2026-10'").all();
  const newNoteArchives = stageDbVerified.prepare("SELECT * FROM business_note_archives WHERE project_id='qicui'").all();
  const stageFinalCfg = stageDbVerified.prepare("SELECT config_json FROM business_project_config WHERE project_id='qicui'").get();
  stageDbVerified.close();
  try { fs.unlinkSync(stageDbPath); } catch {}
  console.log(` - Verified delta: ${newCaptures.length} new captures, ${newHeads.length} heads, ${newDailyReports.length} reports, ${newCommentDeliveries.length} comment deliveries, ${newNoteArchives.length} note archives`);

  // Step 4: Backup Live DB via SQLite backup API before touching live
  console.log(`\nStep 4: Creating SQLite consistent backup of live DB at:\n        ${liveBackupPath}`);
  backupLiveDbWithApi(targetLiveDb, liveBackupPath);
  console.log(' - Live DB backup created and verified.');

  if (simulateConcurrentNoteEdit) {
    const injectDb = new DatabaseSync(targetLiveDb);
    injectDb.prepare("INSERT INTO business_note_archives VALUES('qicui', 'note-user-edit-mid-stage', '{\"content\":\"user edited during stage\"}', '2026-10-26T04:00:00Z')").run();
    injectDb.close();
  }

  // Step 5: Acquire BEGIN IMMEDIATE on Live DB and apply verified delta in ONE atomic transaction
  console.log('\nStep 5: Applying verified delta to Live DB in ONE atomic transaction...');
  const liveDb = new DatabaseSync(targetLiveDb);
  liveDb.exec('BEGIN IMMEDIATE;');
  try {
    // C1: Optimistic concurrency validation inside transaction
    const currentCfgRow = liveDb.prepare("SELECT version, config_json FROM business_project_config WHERE project_id='qicui'").get();
    if (!currentCfgRow || currentCfgRow.version !== expectedVersionToCheck || currentCfgRow.config_json !== liveCfgRow.config_json) {
      throw new Error(`Concurrent config modification detected in live DB (expected version ${expectedVersionToCheck}, config changed)`);
    }

    const currentCommTask = liveDb.prepare("SELECT id, state, spec_json FROM business_sync_tasks WHERE id='qicui:comments-register-2026-10'").get();
    const currentCommNextRun = liveDb.prepare("SELECT next_run_at FROM business_sync_tasks WHERE id='qicui:comments-register-2026-10'").get();
    if (!currentCommTask || currentCommTask.state !== liveCommTask.state || currentCommTask.spec_json !== liveCommTask.spec_json || currentCommNextRun?.next_run_at !== liveCommTask.next_run_at) {
      throw new Error(`Concurrent task change detected for comments task (expected ${liveCommTask.state}, spec or schedule changed)`);
    }

    const currentWeeklyTask = liveDb.prepare("SELECT last_success_at, business_through, next_run_at FROM business_sync_tasks WHERE id='qicui:weekly-q4'").get();
    if (!currentWeeklyTask || currentWeeklyTask.last_success_at !== liveWeeklyTask?.last_success_at || currentWeeklyTask.business_through !== liveWeeklyTask?.business_through) {
      throw new Error('Concurrent task progress detected for weekly task in live DB; refusing to overwrite progress');
    }

    const currentReportTask = liveDb.prepare("SELECT last_success_at, business_through, next_run_at FROM business_sync_tasks WHERE id='qicui:business-report'").get();
    if (!currentReportTask || currentReportTask.last_success_at !== liveReportTask?.last_success_at || currentReportTask.business_through !== liveReportTask?.business_through) {
      throw new Error('Concurrent task progress detected for business report task in live DB; refusing to overwrite progress');
    }

    // Validate all 6 target data_sources in live DB haven't changed (exhaustive comparison)
    for (const ds of dsUpdates) {
      const currentDsRow = liveDb.prepare('SELECT id, name, spreadsheet, status, is_paused, sheet_id, mapping_json, updated_at FROM data_sources WHERE id=?').get(ds.id);
      const baselineDsRow = baselineDsMap.get(ds.id);
      if (ds.status === 'retired' && !baselineDsRow && !currentDsRow) {
        continue;
      }
      if (!currentDsRow || !baselineDsRow || JSON.stringify(currentDsRow) !== JSON.stringify(baselineDsRow)) {
        throw new Error(`Concurrent data source modification detected for ${ds.id}`);
      }
    }

    // Validate note archives haven't been updated concurrently by user/worker
    const currentNoteArchives = liveDb.prepare("SELECT note_id, data_json, updated_at FROM business_note_archives WHERE project_id='qicui' ORDER BY note_id").all();
    const currentNoteArchivesDigest = computeRowsDigest(currentNoteArchives);
    if (currentNoteArchivesDigest !== baselineNoteArchivesDigest) {
      throw new Error('Concurrent note archive modification detected in live DB (user fetched/reviewed content during staging)');
    }

    // Validate comment deliveries haven't been changed concurrently
    const currentDeliveries = liveDb.prepare("SELECT id, data_json FROM business_comment_deliveries WHERE project_id='qicui' AND source_key='comments-register-2026-10' ORDER BY id").all();
    const currentDeliveriesDigest = computeRowsDigest(currentDeliveries);
    if (currentDeliveriesDigest !== baselineDeliveriesDigest) {
      throw new Error('Concurrent comment deliveries modification detected in live DB');
    }

    // Validate source heads haven't changed concurrently
    const currentTargetHeads = liveDb.prepare("SELECT source_key, capture_id, captured_at FROM business_source_heads WHERE project_id='qicui' AND source_key IN ('keywords', 'comments-register-2026-10', 'weekly-q4', 'business-report') ORDER BY source_key").all();
    const currentTargetHeadsDigest = computeRowsDigest(currentTargetHeads);
    if (currentTargetHeadsDigest !== baselineTargetHeadsDigest) {
      throw new Error('Concurrent source head modification detected in live DB');
    }

    // C2: Apply verified business_project_config
    liveDb.prepare("UPDATE business_project_config SET config_json=?, version=version+1, updated_at=? WHERE project_id='qicui' AND version=?")
      .run(stageFinalCfg.config_json, now, currentCfgRow.version);

    // C3: Apply verified captures, heads, receipts, daily reports, and comment archives
    for (const cap of newCaptures) {
      liveDb.prepare('INSERT OR IGNORE INTO business_captures VALUES(?,?,?,?,?,?,?)')
        .run(cap.id, cap.project_id, cap.source_key, cap.source_version, cap.captured_at, cap.payload_json, cap.fingerprint);
    }
    for (const head of newHeads) {
      liveDb.prepare('INSERT INTO business_source_heads VALUES(?,?,?,?) ON CONFLICT(project_id,source_key) DO UPDATE SET capture_id=excluded.capture_id,captured_at=excluded.captured_at WHERE excluded.captured_at>=business_source_heads.captured_at')
        .run(head.project_id, head.source_key, head.capture_id, head.captured_at);
    }
    for (const rep of newDailyReports) {
      liveDb.prepare('INSERT OR IGNORE INTO business_daily_reports VALUES(?,?,?,?,?,?,?,?)')
        .run(rep.id, rep.project_id, rep.business_day, rep.status, rep.confirmed_by, rep.created_at, rep.fingerprint, rep.payload_json);
    }
    for (const rec of newReceipts) {
      liveDb.prepare('INSERT OR IGNORE INTO business_sync_receipts VALUES(?,?,?,?,?,?)')
        .run(rec.id, rec.project_id, rec.source_key, rec.capture_id, rec.state, rec.captured_at ?? now);
    }
    if (newCommentDeliveries.length > 0) {
      liveDb.prepare("DELETE FROM business_comment_deliveries WHERE project_id='qicui' AND source_key='comments-register-2026-10'").run();
      for (const cd of newCommentDeliveries) {
        liveDb.prepare('INSERT INTO business_comment_deliveries VALUES(?,?,?,?,?,?,?,?,?)')
          .run(cd.id, cd.project_id, cd.note_id, cd.source_key, cd.source_row, cd.capture_id, cd.status, cd.comment_day ?? null, cd.data_json);
      }
    }
    for (const na of newNoteArchives) {
      liveDb.prepare('INSERT INTO business_note_archives VALUES(?,?,?,?) ON CONFLICT(project_id,note_id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at')
        .run(na.project_id, na.note_id, na.data_json, na.updated_at);
    }

    // C4: Update tasks metadata (preserving next_run_at and paused state)
    for (const job of candSyncJobs) {
      liveDb.prepare('INSERT OR IGNORE INTO sync_jobs(id, project_id, source_id, status, rows_read, rows_imported, rows_failed, error_summary, started_at, finished_at, request_scope, requested_range) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(job.id, job.project_id, job.source_id, job.status, job.rows_read, job.rows_imported, job.rows_failed, job.error_summary, job.started_at, job.finished_at, job.request_scope ?? 'unknown', job.requested_range ?? '');
    }
    liveDb.prepare("UPDATE business_sync_tasks SET spec_json=?, updated_at=? WHERE id='qicui:comments-register-2026-10'")
      .run(JSON.stringify(updatedCommSpec), now);
    liveDb.prepare("UPDATE business_sync_tasks SET last_success_at=?, business_through=?, last_run_id=?, updated_at=? WHERE id='qicui:weekly-q4'")
      .run(candWeeklyTask.last_success_at, candWeeklyTask.business_through, candWeeklyTask.last_run_id, now);
    liveDb.prepare("UPDATE business_sync_tasks SET last_success_at=?, business_through=?, last_run_id=?, updated_at=? WHERE id='qicui:business-report'")
      .run(candReportTask.last_success_at, candReportTask.business_through, candReportTask.last_run_id, now);

    // C5: Update data_sources metadata
    for (const ds of dsUpdates) {
      if (ds.status === 'retired') {
        liveDb.prepare('UPDATE data_sources SET status=?, is_paused=?, updated_at=? WHERE id=?')
          .run(ds.status, ds.is_paused, now, ds.id);
      } else {
        liveDb.prepare('UPDATE data_sources SET name=?, spreadsheet=?, sheet_id=COALESCE(?,sheet_id), mapping_json=?, updated_at=? WHERE id=?')
          .run(ds.name, ds.spreadsheet, ds.sheet_id ?? null, ds.mapping_json, now, ds.id);
      }
    }

    // C6: Update project_settings campaign_dashboard
    for (const projId of ['meiling', 'huang-tiane']) {
      const row = liveDb.prepare("SELECT value FROM project_settings WHERE project_id=? AND key='campaign_dashboard'").get(projId);
      if (row) {
        const snap = JSON.parse(row.value);
        if (projId === 'huang-tiane') {
          snap.sources = snap.sources.filter(s => s.id !== 'src-huang-tiane-commerce-alt');
        }
        for (const s of snap.sources) {
          const match = dsUpdates.find(u => u.id === s.id);
          if (match && match.name) {
            s.name = match.name;
            s.url = match.spreadsheet;
          }
        }
        liveDb.prepare("UPDATE project_settings SET value=?, updated_at=? WHERE project_id=? AND key='campaign_dashboard'")
          .run(JSON.stringify(snap), now, projId);
      }
    }

    // Single atomic commit
    liveDb.exec('COMMIT;');
    liveDb.close();
    console.log('[SUCCESS] Single atomic transaction committed to Live DB.');
  } catch (err) {
    liveDb.exec('ROLLBACK;');
    liveDb.close();
    console.error('\n[ROLLBACK] Transaction rolled back cleanly due to error:', err);
    throw err;
  }

  console.log('\n==================================================');
  console.log('[COMPLETED] Staged verification & atomic merge to live DB complete!');
  console.log('==================================================');
  return { status: 'success', liveBackupPath };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseMergeCliArgs();
  runMergeProcess(args).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
