#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const flags = {};
for (let i = 0; i < argv.length; i++) {
  const item = argv[i];
  if (item.startsWith('--')) {
    const key = item.slice(2);
    if (key === 'apply' || key === 'execute') {
      flags.apply = true;
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      flags[key] = argv[++i];
    } else {
      flags[key] = 'true';
    }
  }
}

const dbPath = path.resolve(flags.db || process.env.LOCAL_DB_PATH || path.resolve(appRoot, 'data/local.db'));
const isApply = Boolean(flags.apply);

console.log('=== ATOMIC ACTIVATION OF QICUI SYNC TASKS ===');
console.log(`Database: ${dbPath}`);
console.log(`Mode:     ${isApply ? 'APPLY (Writing changes to database)' : 'DRY-RUN (Simulation only; pass --apply to execute)'}\n`);

const db = new DatabaseSync(dbPath);

const ACTIVE_TASK_KEYS = [
  'weekly-q4',
  'business-report',
  'jzt-qicui',
  'juguang-f',
  'juguang-s',
  'adstar-qicui',
  'competitor-ipscg-ba7a885c-16b5-479d-a2a9-9cceb5908e9c',
];

const PAUSED_TASK_KEY = 'comments-register-2026-10';

const now = new Date();
const baseOffsetMinutes = 360; // 6 hours
const staggerMinutes = 20;

const auditLog = [];

db.exec('BEGIN IMMEDIATE;');
try {
  const allTasks = db.prepare(`SELECT id, source_key, name, state, next_run_at, interval_minutes, updated_at FROM business_sync_tasks WHERE project_id = 'qicui' ORDER BY id`).all();

  const updateStmt = db.prepare(`
    UPDATE business_sync_tasks
    SET state = 'active', next_run_at = ?, updated_at = ?
    WHERE id = ? AND project_id = 'qicui'
  `);

  let activatedIndex = 0;
  for (const t of allTasks) {
    const isTargetActive = ACTIVE_TASK_KEYS.includes(t.source_key);
    const isTargetPaused = t.source_key === PAUSED_TASK_KEY;

    if (isTargetActive) {
      const nextRunDate = new Date(now.getTime() + (baseOffsetMinutes + activatedIndex * staggerMinutes) * 60000);
      const nextRunIso = nextRunDate.toISOString();
      const updatedIso = now.toISOString();

      if (isApply) {
        updateStmt.run(nextRunIso, updatedIso, t.id);
      }

      auditLog.push({
        id: t.id,
        sourceKey: t.source_key,
        action: 'ACTIVATED',
        oldState: t.state,
        newState: 'active',
        oldNextRunAt: t.next_run_at,
        newNextRunAt: nextRunIso,
        staggerMinutesOffset: baseOffsetMinutes + activatedIndex * staggerMinutes,
      });
      activatedIndex++;
    } else if (isTargetPaused) {
      auditLog.push({
        id: t.id,
        sourceKey: t.source_key,
        action: 'KEPT_PAUSED',
        oldState: t.state,
        newState: 'paused',
        oldNextRunAt: t.next_run_at,
        newNextRunAt: t.next_run_at,
        staggerMinutesOffset: null,
      });
    }
  }

  if (isApply) {
    db.exec('COMMIT;');
  } else {
    db.exec('ROLLBACK;');
  }
} catch (err) {
  db.exec('ROLLBACK;');
  db.close();
  console.error('[ERROR] Task activation aborted and rolled back:', err);
  process.exit(1);
}
db.close();

console.log('=== ROLLBACK & SCHEDULING AUDIT LOG ===');
for (const item of auditLog) {
  const offsetStr = item.staggerMinutesOffset ? `(+${item.staggerMinutesOffset}m)` : '(intact)';
  console.log(`[${item.action}] ${item.id.padEnd(65)} state: ${item.oldState} -> ${item.newState} | next_run: ${item.newNextRunAt} ${offsetStr}`);
}
console.log(`\n${isApply ? 'Successfully applied' : '[DRY RUN] Simulated'}: ${auditLog.filter(a => a.action === 'ACTIVATED').length} tasks activated, ${auditLog.filter(a => a.action === 'KEPT_PAUSED').length} kept paused.`);
