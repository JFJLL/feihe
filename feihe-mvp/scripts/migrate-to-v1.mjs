import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.LOCAL_DB_PATH || path.resolve('data/local.db');
if (!fs.existsSync(dbPath)) {
  console.log('Database not found at', dbPath);
  process.exit(0);
}

// Backup if needed
const timestamp = Math.floor(Date.now() / 1000);
const backupPath = `${dbPath}.backup.${timestamp}`;
fs.copyFileSync(dbPath, backupPath);
console.log(`[MIGRATION] Database backup created at ${backupPath}`);

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL;');

// 1. Ensure Qicui project metadata
db.prepare(`UPDATE projects SET
  org_id = 'org-default',
  department_id = 'dept-marketing',
  client_id = 'client-feihe',
  template_id = 'content_marketing',
  onboarding_status = 'ready',
  updated_at = datetime('now')
WHERE id = 'qicui'`).run();

// 2. Ensure Qicui members
const now = new Date().toISOString();
const members = [
  ['qicui:user-admin', 'qicui', 'user-admin', 'project_admin'],
  ['qicui:user-project-manager', 'qicui', 'user-project-manager', 'project_admin'],
  ['qicui:user-editor', 'qicui', 'user-editor', 'editor'],
  ['qicui:user-viewer', 'qicui', 'user-viewer', 'viewer'],
];
for (const [id, pid, uid, role] of members) {
  db.prepare(`INSERT OR IGNORE INTO project_members(id, project_id, user_id, role, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)`).run(id, pid, uid, role, now, now);
}

// 3. Backfill note_project_profiles from note_profiles for qicui
const backfilled = db.prepare(`INSERT OR IGNORE INTO note_project_profiles(
  id, project_id, note_id, cooperation, promoted, note_type, note_price,
  picture_price, video_price, category1, category2, product_scope, brand, created_at, updated_at
)
SELECT 'qicui:' || note_id, 'qicui', note_id, cooperation, promoted, note_type, note_price,
  picture_price, video_price, category1, category2, '本品', brand, updated_at, updated_at
FROM note_profiles WHERE note_id IN (SELECT note_id FROM project_notes WHERE project_id='qicui')`).run();

console.log(`[MIGRATION] Backfilled ${backfilled.changes} notes into note_project_profiles for Qicui`);

// 4. Ensure Qicui default dashboard
db.prepare(`INSERT OR IGNORE INTO dashboards(id, project_id, name, is_default, version, status, created_at, updated_at)
VALUES('dash-qicui-default', 'qicui', '启萃默认营销看板', 1, 1, 'published', datetime('now'), datetime('now'))`).run();

const noteCount = db.prepare("SELECT COUNT(*) AS c FROM project_notes WHERE project_id='qicui'").get().c;
const commentCount = db.prepare("SELECT COUNT(*) AS c FROM key_comments WHERE project_id='qicui'").get().c;
const supplierCount = db.prepare("SELECT COUNT(*) AS c FROM supplier_comments WHERE project_id='qicui'").get().c;

console.log(`[MIGRATION] Migration completed successfully.`);
console.log(`[MIGRATION] Qicui stats: ${noteCount} notes, ${commentCount} key comments, ${supplierCount} supplier records.`);
db.close();
