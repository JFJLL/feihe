#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isDryRun = !isApply;

const dbFile = process.env.LOCAL_DB_PATH || path.join(ROOT_DIR, 'data', 'local.db');

console.log(`[Migration] Target DB: ${dbFile}`);
console.log(`[Migration] Mode: ${isApply ? 'APPLY (Writing changes)' : 'DRY RUN (Read only, pass --apply to commit)'}`);

if (!fs.existsSync(dbFile) && dbFile !== ':memory:') {
  console.error(`[Migration] Error: Database file not found at ${dbFile}`);
  process.exit(1);
}

const db = new DatabaseSync(dbFile, { readOnly: isDryRun && dbFile !== ':memory:' });

const TARGET_SPUS = {
  'huang-tiane': '黄天鹅可生食鸡蛋',
  'winner-wipes': '稳健玉米酒精湿巾',
  'qicui': '启萃',
  'kailas': '凯乐石fuga',
  'meiling': '美菱冰箱',
};

const STANDARD_DEPTS = [
  { id: 'dept-client-1', name: '客户一部' },
  { id: 'dept-client-2', name: '客户二部' },
  { id: 'dept-client-3', name: '客户三部' },
  { id: 'dept-client-4', name: '客户四部' },
  { id: 'dept-client-5', name: '客户五部' },
  { id: 'dept-client-6', name: '客户六部' },
  { id: 'dept-hongmo', name: '弘摩' },
];

console.log('\n--- 1. SPU Target Validation (Exactly 5 rows) ---');
const projectRows = db.prepare('SELECT id, name, spu, department_id FROM projects WHERE id IN (?, ?, ?, ?, ?)').all(
  'huang-tiane', 'winner-wipes', 'qicui', 'kailas', 'meiling'
);

const spuPlan = [];
const missingProjects = [];
for (const [id, targetSpu] of Object.entries(TARGET_SPUS)) {
  const existing = projectRows.find((p) => p.id === id);
  if (!existing) {
    missingProjects.push(id);
  }
  spuPlan.push({
    id,
    name: existing ? existing.name : '(not in DB yet)',
    currentSpu: existing ? existing.spu : 'N/A',
    targetSpu,
    action: existing
      ? existing.spu === targetSpu
        ? 'ALREADY_UP_TO_DATE'
        : 'WILL_UPDATE'
      : 'NOT_FOUND',
  });
}

console.table(spuPlan);

if (missingProjects.length > 0) {
  console.error(`\n[FAIL-CLOSED] 缺少目标项目，拒绝部分迁移并终止: ${missingProjects.join(', ')}`);
  if (isApply) {
    db.close();
    process.exit(1);
  }
}

console.log('\n--- 2. Standard 7 Departments Status ---');
const deptPlan = [];
for (const d of STANDARD_DEPTS) {
  const byId = db.prepare('SELECT id, org_id, name FROM departments WHERE id=?').get(d.id);
  const byName = db.prepare('SELECT id, org_id, name FROM departments WHERE name=?').get(d.name);

  if (byId && byId.org_id !== 'org-default') {
    throw new Error(`[FAIL-CLOSED] 部门 ID '${d.id}' 属于其他组织 '${byId.org_id}'，存在冲突，终止迁移`);
  }
  if (byName && byName.org_id !== 'org-default') {
    throw new Error(`[FAIL-CLOSED] 部门名称 '${d.name}' 属于其他组织 '${byName.org_id}'，存在冲突，终止迁移`);
  }
  if (byId && byName && byId.id !== byName.id) {
    throw new Error(`[FAIL-CLOSED] 部门冲突：ID=${byId.id}(${byId.name}) 与 Name=${byName.id}(${byName.name}) 不一致`);
  }

  deptPlan.push({
    id: d.id,
    name: d.name,
    status: byId || byName ? `EXISTS (${(byId || byName).id})` : 'WILL_INSERT',
  });
}
console.table(deptPlan);

if (isDryRun) {
  console.log('\n[DRY RUN] Verification complete. Exactly 5 SPU targets inspected.');
  console.log('[DRY RUN] Note: Existing project department_id values will NOT be modified.');
  console.log('[DRY RUN] Database was NOT modified. To commit these changes, run with --apply.');
  db.close();
  process.exit(0);
}

// Execute changes under --apply with strict transaction and fail-closed safety
console.log('\n[APPLY] Starting transaction (BEGIN IMMEDIATE)...');
db.exec('BEGIN IMMEDIATE;');
try {
  if (missingProjects.length > 0) {
    throw new Error(`[FAIL-CLOSED] 缺少目标项目，拒绝部分迁移并回滚: ${missingProjects.join(', ')}`);
  }

  const now = new Date().toISOString();

  // 1. Insert missing standard departments (verified against conflicts, no silent fake success)
  const insertDeptStmt = db.prepare(
    'INSERT INTO departments(id, org_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  );
  for (const d of STANDARD_DEPTS) {
    const existing = db.prepare('SELECT id FROM departments WHERE id=? OR (org_id=? AND name=?)').get(d.id, 'org-default', d.name);
    if (!existing) {
      insertDeptStmt.run(d.id, 'org-default', d.name, now, now);
      console.log(`[APPLY] Inserted standard department '${d.id}' (${d.name})`);
    }
  }

  // 2. Update the 5 SPUs idempotently (WHERE id=? AND spu<>?)
  const updateSpuStmt = db.prepare(
    'UPDATE projects SET spu=?, updated_at=? WHERE id=? AND spu<>?'
  );
  let updatedCount = 0;
  for (const [id, targetSpu] of Object.entries(TARGET_SPUS)) {
    const res = updateSpuStmt.run(targetSpu, now, id, targetSpu);
    if (res.changes > 0) {
      updatedCount += res.changes;
      console.log(`[APPLY] Updated project '${id}' SPU -> '${targetSpu}'`);
    } else {
      console.log(`[APPLY] Project '${id}' SPU already up to date ('${targetSpu}'), skipped updated_at bump`);
    }
  }

  db.exec('COMMIT;');
  console.log(`\n[APPLY] Transaction committed successfully! ${updatedCount} project SPU(s) updated.`);
  console.log('[APPLY] Legacy project department_id values were left untouched.');
} catch (err) {
  try {
    db.exec('ROLLBACK;');
    console.error('[APPLY] Transaction rolled back due to error.');
  } catch {}
  throw err;
} finally {
  db.close();
}
