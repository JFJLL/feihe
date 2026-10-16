import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { attributeBrandAndLine } from '../lib/competitors/analyzer.ts';
import { getCompetitorConfig } from '../lib/competitors/db.ts';

const dbLocations = [
  path.resolve('.verification/business.db'),
  path.resolve('data/local.db'),
  path.resolve('.verification/competitor-validation.db'),
];

async function main() {
  const config = await getCompetitorConfig('qicui');
  const rules = config?.brandRules || [];

  console.log('=== 开始对现有本地入库样本执行基于 RAW 证据的品牌归属重新核验 ===');

  for (const dbPath of dbLocations) {
    try {
      const db = new DatabaseSync(dbPath);
      const notes = db.prepare('SELECT id, raw_note_id, title, content, tags_json, keyword_hit, brand_attributed, product_line FROM competitor_notes').all();
      if (!notes.length) continue;

      console.log(`\n检查数据库: ${dbPath} (共 ${notes.length} 条记录)`);
      let repairedCount = 0;
      let unknownCount = 0;

      for (const n of notes) {
        let tags = [];
        try { tags = JSON.parse(n.tags_json || '[]'); } catch {}
        const { brand: newBrand, productLine: newLine } = attributeBrandAndLine(
          n.title,
          n.content,
          tags,
          n.keyword_hit,
          rules
        );

        if (newBrand === 'unknown') unknownCount++;

        if (newBrand !== n.brand_attributed || newLine !== n.product_line) {
          repairedCount++;
          console.log(`  [修正] ID: ${n.raw_note_id.slice(0, 10)}... | 标题: "${n.title.slice(0, 20)}"`);
          console.log(`         原判定: [${n.brand_attributed} / ${n.product_line}] -> 新判定: [${newBrand} / ${newLine}]`);

          db.prepare('UPDATE competitor_notes SET brand_attributed = ?, product_line = ?, updated_at = ? WHERE id = ?').run(
            newBrand, newLine, new Date().toISOString(), n.id
          );
        }
      }

      console.log(`数据库 ${path.basename(dbPath)} 核验完成: 修复了 ${repairedCount} 条误判记录，现有真实未知 (unknown) 样本数: ${unknownCount} 条`);
    } catch (e) {
      // 如果表不存在或文件不存在则跳过
    }
  }
}

main().catch(err => {
  console.error('修复执行异常:', err);
  process.exit(1);
});
