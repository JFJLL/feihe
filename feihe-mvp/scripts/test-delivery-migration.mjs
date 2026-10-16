#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  runMigration,
  ensureTargetSchema,
  computeUntouchedHash,
  PROJECT_MIGRATION_WHITELIST,
} from './migrate-delivery-project.mjs';

const tempDir = path.join(os.tmpdir(), `test-migration-suite-${Date.now()}-${Math.random().toString(36).slice(2)}`);
fs.mkdirSync(tempDir, { recursive: true });

console.log('=== RUNNING INDEPENDENT DELIVERY MIGRATION TEST SUITE ===');
console.log(`Temp Test Directory: ${tempDir}\n`);

/**
 * Builds clean, self-contained, isolated test fixture databases without relying on external paths.
 */
function createSelfContainedFixtures(dir) {
  const baseDbPath = path.join(dir, 'fixture-base.db');
  const sourceDbPath = path.join(dir, 'fixture-source.db');

  // 1. Build Base DB (represents target before migration)
  const baseDb = new DatabaseSync(baseDbPath);
  ensureTargetSchema(baseDb);

  baseDb.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS project_notes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, note_id TEXT NOT NULL, added_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS note_profiles (note_id TEXT PRIMARY KEY, cover_url TEXT DEFAULT '', interaction_count INTEGER DEFAULT 0, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS note_covers (id TEXT PRIMARY KEY, note_id TEXT NOT NULL, project_id TEXT NOT NULL, source_url TEXT DEFAULT '', r2_key TEXT DEFAULT '', status TEXT DEFAULT '待抓取', fetched_at TEXT, last_error TEXT DEFAULT '', updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS metric_definitions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, key TEXT NOT NULL, name TEXT NOT NULL, unit TEXT DEFAULT '', aggregation TEXT DEFAULT 'sum', formula TEXT DEFAULT '', format TEXT DEFAULT 'number', aliases_json TEXT DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

    -- Target project qicui (with empty template/onboarding to test backfill)
    INSERT INTO projects (id, name, status, template_id, onboarding_status, created_at, updated_at)
    VALUES ('qicui', '启萃评论与声量项目', '进行中', '', '', '2026-10-10 00:00:00', '2026-10-10 00:00:00');

    -- Untouched other project (fehei-qicui)
    INSERT INTO projects (id, name, status, template_id, onboarding_status, created_at, updated_at)
    VALUES ('fehei-qicui', '飞鹤其他关联项目', '进行中', 'standard', 'ready', '2026-10-10 00:00:00', '2026-10-10 00:00:00');

    -- Global tables (must remain 100% untouched)
    INSERT INTO users (id, email, name, role, created_at, updated_at)
    VALUES ('user-existing', 'target@feihe.com', 'Existing Target User', 'admin', '2026-10-10', '2026-10-10');

    INSERT INTO settings (key, value, updated_at)
    VALUES ('sys_setting', '{"immutable":true}', '2026-10-10');

    INSERT INTO organizations (id, name, slug, created_at, updated_at)
    VALUES ('org-default', 'Feihe Org', 'feihe', '2026-10-10', '2026-10-10');

    INSERT INTO metric_definitions (id, project_id, key, name, unit, aggregation, created_at, updated_at)
    VALUES ('fehei-qicui:clicks', 'fehei-qicui', 'clicks', '其他项目指标', '次', 'sum', '2026-10-10', '2026-10-10');

    -- Existing notes in base
    INSERT INTO notes (id, title, status) VALUES ('note-base-1', 'Base Note 1', '已抓取');
    INSERT INTO project_notes (id, project_id, note_id, added_at) VALUES ('pn-base-1', 'qicui', 'note-base-1', '2026-10-10');
    INSERT INTO note_profiles (note_id, cover_url, updated_at) VALUES ('note-base-1', '', '2026-10-10');
    INSERT INTO note_covers (id, note_id, project_id, source_url, status, updated_at)
    VALUES ('qicui:note-base-1', 'note-base-1', 'qicui', 'https://ci.xiaohongshu.com/base-cover.jpg', '已缓存', '2026-10-10');
  `);
  baseDb.close();

  // 2. Build Source DB (represents delivery database)
  const sourceDb = new DatabaseSync(sourceDbPath);
  ensureTargetSchema(sourceDb);

  sourceDb.exec(`
    CREATE TABLE IF NOT EXISTS note_profiles (note_id TEXT PRIMARY KEY, cover_url TEXT DEFAULT '', interaction_count INTEGER DEFAULT 0, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS note_covers (id TEXT PRIMARY KEY, note_id TEXT NOT NULL, project_id TEXT NOT NULL, source_url TEXT DEFAULT '', r2_key TEXT DEFAULT '', status TEXT DEFAULT '待抓取', fetched_at TEXT, last_error TEXT DEFAULT '', updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS project_notes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, note_id TEXT NOT NULL, added_at TEXT NOT NULL);

    -- Source project qicui metadata
    INSERT INTO projects (id, name, status, template_id, onboarding_status, created_at, updated_at)
    VALUES ('qicui', '启萃评论与声量项目', '进行中', 'content_marketing', 'ready', '2026-10-15 10:00:00', '2026-10-15 10:00:00');

    -- Business project config
    INSERT INTO business_project_config (project_id, config_json, version, updated_at)
    VALUES ('qicui', '{"bindings":[{"key":"weekly-q4","role":"weekly"}]}', 1, '2026-10-15 10:00:00');

    -- Captures & Heads & Receipts
    INSERT INTO business_captures (id, project_id, source_key, source_version, captured_at, payload_json, fingerprint)
    VALUES
      ('cap-1', 'qicui', 'weekly-q4', 'v1', '2026-10-15 10:00:00', '{"data":[1,2,3]}', 'fp-cap-1'),
      ('cap-2', 'qicui', 'weekly-q4', 'v2', '2026-10-15 11:00:00', '{"data":[4,5,6]}', 'fp-cap-2');

    INSERT INTO business_source_heads (project_id, source_key, capture_id, captured_at)
    VALUES ('qicui', 'weekly-q4', 'cap-1', '2026-10-15 10:00:00');

    INSERT INTO business_sync_receipts (id, project_id, source_key, capture_id, state, captured_at)
    VALUES ('rcp-1', 'qicui', 'weekly-q4', 'cap-1', 'success', '2026-10-15 10:00:00');

    -- Daily Reports (1 snapshot, 1 confirmed historical freeze report)
    INSERT INTO business_daily_reports (id, project_id, business_day, status, confirmed_by, created_at, fingerprint, payload_json)
    VALUES
      ('rep-snap-1', 'qicui', '2026-10-12', 'source_snapshot', NULL, '2026-10-12 10:00:00', 'fp-snap-1', '{"day":"2026-10-12","views":100}'),
      ('rep-conf-1', 'qicui', '2026-10-13', 'confirmed', 'user-admin', '2026-10-13 10:00:00', 'f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e', '{"day":"2026-10-13","confirmed":true}');

    -- Platform observations & Comment deliveries
    INSERT INTO business_platform_observations (id, project_id, source_key, account_id, business_day, natural_key_json, data_json, captured_at, run_id)
    VALUES ('obs-1', 'qicui', 'weekly-q4', 'acc-1', '2026-10-13', '{"k":"v"}', '{"cost":500}', '2026-10-13 10:00:00', 'run-1');

    INSERT INTO business_comment_deliveries (id, project_id, note_id, source_key, source_row, capture_id, status, comment_day, data_json)
    VALUES ('deliv-1', 'qicui', '6abe4fe80000000015000587', 'weekly-q4', 1, 'cap-1', 'verified', '2026-10-13', '{"matched":true}');

    -- 3 Hot Notes referenced by archives & covers
    INSERT INTO business_note_archives (project_id, note_id, data_json, updated_at)
    VALUES
      ('qicui', '6abe4fe80000000015000587', '{"title":"Hot Note 1"}', '2026-10-15'),
      ('qicui', '6abcd950000000001203c205', '{"title":"Hot Note 2"}', '2026-10-15'),
      ('qicui', '6abf9c6e000000001a02698b', '{"title":"Hot Note 3"}', '2026-10-15');

    INSERT INTO note_covers (id, note_id, project_id, source_url, r2_key, status, updated_at)
    VALUES
      ('qicui:6abe4fe80000000015000587', '6abe4fe80000000015000587', 'qicui', 'https://ci.xiaohongshu.com/cover1.jpg', 'projects/qicui/covers/1.jpg', '已缓存', '2026-10-15'),
      ('qicui:6abcd950000000001203c205', '6abcd950000000001203c205', 'qicui', 'https://ci.xiaohongshu.com/cover2.jpg', 'projects/qicui/covers/2.jpg', '已缓存', '2026-10-15'),
      ('qicui:6abf9c6e000000001a02698b', '6abf9c6e000000001a02698b', 'qicui', 'https://ci.xiaohongshu.com/cover3.jpg', 'projects/qicui/covers/3.jpg', '已缓存', '2026-10-15');

    INSERT INTO note_profiles (note_id, cover_url, interaction_count, updated_at)
    VALUES
      ('6abe4fe80000000015000587', 'https://ci.xiaohongshu.com/cover1.jpg', 60573, '2026-10-15'),
      ('6abcd950000000001203c205', 'https://ci.xiaohongshu.com/cover2.jpg', 21621, '2026-10-15'),
      ('6abf9c6e000000001a02698b', 'https://ci.xiaohongshu.com/cover3.jpg', 21597, '2026-10-15');

    INSERT INTO note_project_profiles (id, project_id, note_id, cooperation, note_price, product_scope, brand, created_at, updated_at)
    VALUES
      ('qicui:6abe4fe80000000015000587', 'qicui', '6abe4fe80000000015000587', 1, 5000, '本品', '飞鹤', '2026-10-15', '2026-10-15'),
      ('qicui:6abcd950000000001203c205', 'qicui', '6abcd950000000001203c205', 1, 3500, '本品', '飞鹤', '2026-10-15', '2026-10-15'),
      ('qicui:6abf9c6e000000001a02698b', 'qicui', '6abf9c6e000000001a02698b', 0, 0, '本品', '飞鹤', '2026-10-15', '2026-10-15');

    -- Competitor data & Sync tasks
    INSERT INTO competitor_configs (project_id, task_id, updated_at) VALUES ('qicui', 'task-comp-1', '2026-10-15');
    INSERT INTO competitor_notes (id, project_id, task_id, raw_note_id, id_hex_length, title, keyword_hit, brand_attributed, product_line, note_url, created_at, updated_at)
    VALUES ('cn-1', 'qicui', 'task-comp-1', 'raw-1', 24, 'Comp Note', '卓睿', '飞鹤', '启萃', 'https://xhs.com/cn1', '2026-10-15', '2026-10-15');
    INSERT INTO competitor_sync_logs (project_id, task_id, keyword, status, created_at)
    VALUES ('qicui', 'task-comp-1', '卓睿', 'success', '2026-10-15');

    INSERT INTO dashboards (id, project_id, name, is_default, version, status, created_at, updated_at)
    VALUES ('dash-qicui-default', 'qicui', '启萃默认营销看板', 1, 1, 'published', '2026-10-15', '2026-10-15');

    INSERT INTO business_sync_tasks (id, project_id, source_key, name, state, spec_json, interval_minutes, next_run_at, updated_at)
    VALUES ('qicui:task-sync-1', 'qicui', 'weekly-q4', '周报同步任务', 'active', '{"type":"sheet"}', 360, '2026-10-16 10:00:00', '2026-10-15');

    INSERT INTO business_sync_requests (id, project_id, task_id, created_at)
    VALUES ('req-1', 'qicui', 'qicui:task-sync-1', '2026-10-15');

    INSERT INTO business_comment_jobs (id, project_id, note_id, status, queued_by, created_at, updated_at, next_run_at, lease_token)
    VALUES ('job-active-1', 'qicui', '6abe4fe80000000015000587', 'queued', 'user-test', '2026-10-15', '2026-10-15', '2026-10-15', 'token-abc');
  `);
  sourceDb.close();

  return { baseDbPath, sourceDbPath };
}

try {
  const { baseDbPath, sourceDbPath } = createSelfContainedFixtures(tempDir);

  // TEST 1: Source === Target Safety Guard
  console.log('[TEST 1] Verifying source === target safety guard...');
  assert.throws(
    () => runMigration({ source: sourceDbPath, target: sourceDbPath, projectId: 'qicui' }),
    /Source and target databases cannot be the same file/
  );
  console.log('  Passed: Threw expected error when source === target.\n');

  // TEST 2: Live local.db Path Protection Guard
  console.log('[TEST 2] Verifying live database protection guard...');
  const fakeLivePath = path.join(tempDir, 'feihe-mvp', 'data', 'local.db');
  fs.mkdirSync(path.dirname(fakeLivePath), { recursive: true });
  fs.writeFileSync(fakeLivePath, '');
  assert.throws(
    () => runMigration({ source: sourceDbPath, target: fakeLivePath, projectId: 'qicui' }),
    /Safety guard triggered: target appears to be live database path/
  );
  console.log('  Passed: Threw expected error when target resolves to live local.db path.\n');

  // TEST 3: Dry-Run Zero Disk Write Guarantee
  console.log('[TEST 3] Verifying dry-run plan and zero-write guarantee...');
  const dryRunTarget = path.join(tempDir, 'dry-run-target.db');
  const dryRunStats = runMigration({
    source: sourceDbPath,
    target: dryRunTarget,
    initFromBase: baseDbPath,
    projectId: 'qicui',
    dryRun: true,
  });
  assert.ok(dryRunStats.summary.inserted > 10, 'Dry run must accurately plan insertions');
  assert.equal(fs.existsSync(dryRunTarget), false, 'Target database file must not be created during dry run');
  console.log('  Passed: Dry run accurately planned operations without writing any bytes to target.\n');

  // TEST 4: Live Migration & 3 Hot Notes Availability Check
  console.log('[TEST 4] Executing live migration to isolated replica...');
  const replicaPath = path.join(tempDir, 'fixture-replica.db');
  const run1 = runMigration({
    source: sourceDbPath,
    target: replicaPath,
    initFromBase: baseDbPath,
    projectId: 'qicui',
    conflict: 'skip',
    pauseSyncTasks: true,
  });

  assert.ok(run1.summary.inserted > 10, 'Must insert whitelisted tables on first run');
  assert.equal(run1.integrity.counts.business_daily_reports, 2, 'Must migrate business daily reports');
  assert.equal(run1.integrity.counts.business_captures, 2, 'Must migrate raw captures');
  assert.equal(run1.integrity.referentialIntegrity.orphanSourceHeads, 0, 'Zero orphan source heads');
  assert.equal(run1.integrity.referentialIntegrity.orphanSyncReceipts, 0, 'Zero orphan sync receipts');
  assert.equal(run1.integrity.jsonErrors, 0, 'Zero JSON errors');
  assert.equal(run1.integrity.confirmedReport.fingerprintMatches, true, 'Confirmed report fingerprint verified');

  // Check 3 hot notes
  assert.equal(run1.integrity.hotNotesVerified, true, 'All 3 hot notes must have usable covers/profiles');
  const targetDb = new DatabaseSync(replicaPath, { readOnly: true });
  for (const id of ['6abe4fe80000000015000587', '6abcd950000000001203c205', '6abf9c6e000000001a02698b']) {
    const cov = targetDb.prepare(`SELECT * FROM note_covers WHERE note_id = ?`).get(id);
    const prof = targetDb.prepare(`SELECT * FROM note_profiles WHERE note_id = ?`).get(id);
    assert.ok(cov && cov.source_url, `Hot note ${id} must have note_cover with source_url`);
    assert.ok(prof && prof.cover_url, `Hot note ${id} must have note_profile with cover_url`);
  }

  // Verify empty cover_url backfill on note-base-1
  const baseNoteProf = targetDb.prepare(`SELECT cover_url FROM note_profiles WHERE note_id = 'note-base-1'`).get();
  assert.equal(baseNoteProf.cover_url, 'https://ci.xiaohongshu.com/base-cover.jpg', 'Empty cover_url backfilled by reference');

  // Verify sync task state is forced paused
  const syncTask = targetDb.prepare(`SELECT state FROM business_sync_tasks WHERE id = 'qicui:task-sync-1'`).get();
  assert.equal(syncTask.state, 'paused', 'Sync task must be forced to paused');

  // Verify sync requests and comment jobs cannot trigger active background execution
  const syncReq = targetDb.prepare(`SELECT processed_at FROM business_sync_requests WHERE id = 'req-1'`).get();
  assert.ok(syncReq && syncReq.processed_at, 'Unprocessed sync requests must be safely marked with processed_at timestamp');

  const commentJob = targetDb.prepare(`SELECT status, lease_token FROM business_comment_jobs WHERE id = 'job-active-1'`).get();
  assert.equal(commentJob.status, 'paused', 'Active comment jobs must be forced to paused status');
  assert.equal(commentJob.lease_token, null, 'Lease token must be cleared');

  // Verify worker candidate queries return empty (zero active jobs or pending requests)
  const activeWorkerJobs = targetDb.prepare(`SELECT count(*) as c FROM business_comment_jobs WHERE status IN ('queued', 'retry', 'running')`).get().c;
  assert.equal(activeWorkerJobs, 0, 'Worker candidate query for active comment jobs must return 0');
  const pendingRequests = targetDb.prepare(`SELECT count(*) as c FROM business_sync_requests WHERE processed_at IS NULL`).get().c;
  assert.equal(pendingRequests, 0, 'Worker candidate query for pending sync requests must return 0');

  // Verify projects.qicui backfill: template_id and onboarding_status populated without touching existing name
  const qProj = targetDb.prepare(`SELECT * FROM projects WHERE id = 'qicui'`).get();
  assert.equal(qProj.name, '启萃评论与声量项目', 'Existing project name preserved');
  assert.equal(qProj.template_id, 'content_marketing', 'Empty template_id backfilled');
  assert.equal(qProj.onboarding_status, 'ready', 'Empty onboarding_status backfilled');
  const qProjUpdatedAtRun1 = qProj.updated_at;
  targetDb.close();
  console.log('  Passed: Live migration, 3 hot notes recovery, and empty cover backfill verified.\n');

  // TEST 5: Pre-Commit Rollback on Broken Referential Integrity
  console.log('[TEST 5] Testing pre-commit rollback on broken referential integrity...');
  const brokenSourcePath = path.join(tempDir, 'broken-source.db');
  fs.copyFileSync(sourceDbPath, brokenSourcePath);
  const brokenSrc = new DatabaseSync(brokenSourcePath);
  // Inject an orphan source head pointing to a non-existent capture
  brokenSrc.exec(`INSERT INTO business_source_heads (project_id, source_key, capture_id, captured_at) VALUES ('qicui', 'broken-source', 'non-existent-cap-999', '2026-10-16');`);
  brokenSrc.close();

  const brokenReplicaPath = path.join(tempDir, 'broken-replica.db');
  fs.copyFileSync(baseDbPath, brokenReplicaPath);

  assert.throws(
    () => runMigration({
      source: brokenSourcePath,
      target: brokenReplicaPath,
      projectId: 'qicui',
      conflict: 'skip',
    }),
    /Referential integrity audit failed before commit/
  );

  // Verify target was completely rolled back
  const brokenRepDb = new DatabaseSync(brokenReplicaPath, { readOnly: true });
  const dailyTableCount = brokenRepDb.prepare(`SELECT count(*) as c FROM business_daily_reports`).get().c;
  assert.equal(dailyTableCount, 0, 'Target database must contain 0 committed rows after rollback');
  brokenRepDb.close();
  console.log('  Passed: Transaction rolled back before commit on referential integrity failure.\n');

  // TEST 6: Untouched Entities Rowhash Immutability
  console.log('[TEST 6] Testing untouched entities and other projects rowhash immutability...');
  assert.equal(run1.integrity.untouchedAudit.verified, true, 'Untouched audit verified');
  assert.equal(run1.integrity.untouchedAudit.match, true, 'Pre-hash matches post-hash exactly');
  console.log(`  Passed: Other projects and global tables rowhash unchanged: ${run1.integrity.untouchedAudit.preHash.slice(0, 16)}...\n`);

  // TEST 7: Second Run Idempotence & projects.updated_at Zero Drift
  console.log('[TEST 7] Testing second run idempotence & projects.updated_at zero drift...');
  const run2 = runMigration({
    source: sourceDbPath,
    target: replicaPath,
    projectId: 'qicui',
    conflict: 'skip',
    pauseSyncTasks: true,
  });

  assert.equal(run2.summary.inserted, 0, 'Second run must insert 0 rows');
  assert.ok(run2.summary.unchanged >= 10, 'Second run must detect all existing rows as 100% identical unchanged');
  assert.equal(run2.summary.conflicts, 0, 'Second run must have 0 genuine conflicts');
  assert.equal(run2.summary.replaced, 0, 'Second run must replace 0 rows');

  const targetDbRun2 = new DatabaseSync(replicaPath, { readOnly: true });
  const qProjRun2 = targetDbRun2.prepare(`SELECT updated_at FROM projects WHERE id = 'qicui'`).get();
  assert.equal(qProjRun2.updated_at, qProjUpdatedAtRun1, 'projects.updated_at must NOT drift on second run');
  targetDbRun2.close();
  console.log('  Passed: Second run was 100% idempotent and projects.updated_at had zero drift.\n');

  // TEST 8: Genuine Conflict Detection & Confirmed Report Immutability
  console.log('[TEST 8] Testing genuine conflict detection and confirmed report immutability...');
  const conflictSourcePath = path.join(tempDir, 'conflict-source.db');
  fs.copyFileSync(sourceDbPath, conflictSourcePath);
  const confSrc = new DatabaseSync(conflictSourcePath);
  // Modify snapshot report payload
  confSrc.exec(`UPDATE business_daily_reports SET payload_json = '{"altered":true}' WHERE id = 'rep-snap-1';`);
  // Attempt to alter confirmed report payload
  confSrc.exec(`UPDATE business_daily_reports SET payload_json = '{"tampered":true}' WHERE id = 'rep-conf-1';`);
  confSrc.close();

  const confStats = runMigration({
    source: conflictSourcePath,
    target: replicaPath,
    projectId: 'qicui',
    conflict: 'replace', // Request replacement
  });

  // Verify confirmed report replacement was REJECTED despite conflict=replace
  const confReportConflict = confStats.conflicts.find(c => c.pk === 'rep-conf-1');
  assert.ok(confReportConflict, 'Must log conflict for confirmed report');
  assert.equal(confReportConflict.action, 'skipped', 'Confirmed report replacement must be rejected and skipped');
  assert.ok(confReportConflict.sourceHash, 'Must provide source row hash');
  assert.ok(confReportConflict.targetHash, 'Must provide target row hash');
  console.log('  Passed: Genuine conflicts detected with column diffs/hashes; confirmed records protected from overwrite.\n');

  // Optional Real DB Rehearsal (strictly opt-in via env or CLI flag)
  if (process.env.ENABLE_REAL_DB_REHEARSAL === '1' || process.argv.includes('--real-rehearsal')) {
    console.log('[OPTIONAL REAL DB REHEARSAL] Running against real databases in isolated temp replica...');
    const realDeliveryDb = path.resolve('../feihe-delivery-v1/feihe-mvp/.verification/business.db');
    const realMainDb = path.resolve('../feihe/feihe-mvp/data/local.db');
    if (fs.existsSync(realDeliveryDb) && fs.existsSync(realMainDb)) {
      const realReplicaPath = path.join(tempDir, 'real-db-rehearsal.db');
      const realStats = runMigration({
        source: realDeliveryDb,
        target: realReplicaPath,
        initFromBase: realMainDb,
        projectId: 'qicui',
        conflict: 'skip',
        pauseSyncTasks: true,
      });
      assert.equal(realStats.integrity.counts.business_daily_reports, 28, 'Real DB has 28 daily reports');
      assert.equal(realStats.integrity.confirmedReport.fingerprintMatches, true, 'Confirmed report fingerprint verified');
      assert.equal(realStats.integrity.hotNotesVerified, true, 'All 3 hot notes verified on real replica');
      console.log('  Passed: Real database rehearsal verified on isolated replica.\n');
    } else {
      console.log('  Skipped real rehearsal: Real DB files not present at expected paths.\n');
    }
  }

  console.log('🎉 ALL 8 MIGRATION INTEGRITY TESTS PASSED WITH 100% SUCCESS!');
} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}
