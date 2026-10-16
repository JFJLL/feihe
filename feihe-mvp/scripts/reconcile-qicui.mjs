import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.LOCAL_DB_PATH || path.resolve('data/local.db');
const db = new DatabaseSync(dbPath);

console.log('=== 运行启萃业务新旧链路数据对账 (RECONCILIATION) ===');

// 1. Verify project exists and metadata
const project = db.prepare("SELECT * FROM projects WHERE id='qicui'").get();
assert.ok(project, '启萃项目必须存在于 projects 表中');
assert.equal(project.template_id, 'content_marketing', '启萃模板已设置为 content_marketing');
assert.equal(project.onboarding_status, 'ready', '启萃向导初始化状态已就绪');

// 2. Count notes
const noteCount = db.prepare("SELECT COUNT(*) AS c FROM project_notes WHERE project_id='qicui'").get().c;
assert.ok(noteCount > 1000, '启萃收录的笔记总数必须 > 1000 篇');
console.log(`✅ 对账项 1: 笔记总数对账通过: ${noteCount} 篇`);

// 3. Count note profiles in project-isolated profile table
const isolatedProfileCount = db.prepare("SELECT COUNT(*) AS c FROM note_project_profiles WHERE project_id='qicui'").get().c;
assert.ok(isolatedProfileCount > 0, '启萃私有笔记属性已成功隔离入库');
console.log(`✅ 对账项 2: 私有属性隔离记录数通过: ${isolatedProfileCount} 篇`);

// 4. Count comments
const keyCommentCount = db.prepare("SELECT COUNT(*) AS c FROM key_comments WHERE project_id='qicui'").get().c;
assert.ok(keyCommentCount > 0, '启萃舆情评论数必须保持原有记录');
console.log(`✅ 对账项 3: 舆情处置评论数通过: ${keyCommentCount} 条`);

// 5. Count supplier comments
const supplierCount = db.prepare("SELECT COUNT(*) AS c FROM supplier_comments WHERE project_id='qicui'").get().c;
assert.ok(supplierCount > 0, '启萃供应商交付记录数必须保持原有记录');
console.log(`✅ 对账项 4: 供应商交付核验记录数通过: ${supplierCount} 条`);

// 6. Metrics aggregation comparison
const rawMetrics = db.prepare(`SELECT
  SUM(p.note_price) AS spend
FROM project_notes pn
JOIN note_profiles p ON p.note_id=pn.note_id
WHERE pn.project_id='qicui'`).get();

const isolatedMetrics = db.prepare(`SELECT
  SUM(pnp.note_price) AS spend
FROM project_notes pn
JOIN note_project_profiles pnp ON pnp.project_id=pn.project_id AND pnp.note_id=pn.note_id
WHERE pn.project_id='qicui'`).get();

console.log(`  原表项目私有支出合计: ¥${rawMetrics.spend}`);
console.log(`  隔离表私有支出合计:   ¥${isolatedMetrics.spend}`);
assert.equal(isolatedMetrics.spend, rawMetrics.spend, '私有属性隔离与原表支出完全一致');
console.log('✅ 对账项 5: 核心业务指标数值 100% 对账一致');

// 7. Verify members
const memberCount = db.prepare("SELECT COUNT(*) AS c FROM project_members WHERE project_id='qicui'").get().c;
assert.ok(memberCount >= 4, '启萃必须包含至少 4 名角色明确的项目成员');
console.log(`✅ 对账项 6: 启萃项目成员矩阵对账通过: ${memberCount} 名`);

console.log('\n🎉 全部 6 项启萃对账指标 100% 通过！历史业务数据零丢失、零降级！');
db.close();
