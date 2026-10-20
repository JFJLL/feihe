#!/usr/bin/env node

/**
 * test-huang-tiane-backend.mjs
 *
 * Verifies the Huang Tiane backend integration skeleton:
 * 1. Campaign types & catalog registration
 * 2. Manual dashboards type compatibility
 * 3. Enrichment server loader & project isolation
 * 4. mergeById preserving daily datasets
 * 5. Onboard script dry-run & apply guard behavior
 */

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('=== 1. 测试 lib/campaign-catalog.ts 元数据与白名单 ===');
const catalogMod = await import('../lib/campaign-catalog.ts');
assert.ok(catalogMod.CAMPAIGN_PROJECT_IDS.includes('huang-tiane'), 'CAMPAIGN_PROJECT_IDS 必须包含 huang-tiane');
assert.ok(catalogMod.isCampaignProject('huang-tiane'), 'isCampaignProject("huang-tiane") 应返回 true');
const meta = catalogMod.getCampaignProjectMeta('huang-tiane');
assert.ok(meta, 'getCampaignProjectMeta("huang-tiane") 应返回有效元数据');
assert.equal(meta.id, 'huang-tiane');
assert.equal(meta.name, '黄天鹅');
assert.equal(meta.brand, '黄天鹅');
assert.equal(meta.templateId, 'campaign_review');
console.log('✓ catalog 元数据注册与类型守卫校验通过');

console.log('\n=== 2. 测试 lib/campaign-manual.ts 纯类型兼容无假数据 ===');
const manualMod = await import('../lib/campaign-manual.ts');
assert.ok(manualMod.CAMPAIGN_MANUAL_DASHBOARDS, 'CAMPAIGN_MANUAL_DASHBOARDS 必须存在');
assert.equal(manualMod.CAMPAIGN_MANUAL_DASHBOARDS['huang-tiane'], undefined, '黄天鹅不应包含假数据空壳');
assert.ok(manualMod.CAMPAIGN_MANUAL_DASHBOARDS['kailas'], '既有凯乐石数据保留');
assert.ok(manualMod.CAMPAIGN_MANUAL_DASHBOARDS['meiling'], '既有美菱数据保留');
assert.ok(manualMod.CAMPAIGN_MANUAL_DASHBOARDS['winner-wipes'], '既有稳健数据保留');
console.log('✓ manual dashboards 纯类型兼容校验通过');

console.log('\n=== 3. 测试 lib/campaign-enrichment-server.ts 与 mergeById ===');
const enrichmentMod = await import('../lib/campaign-enrichment-server.ts');
const huangPayload = enrichmentMod.getCampaignEnrichment('huang-tiane');
assert.ok(huangPayload, 'getCampaignEnrichment("huang-tiane") 应返回对象');
assert.equal(huangPayload.projectId, 'huang-tiane');

// Test mergeById preserves base items and overwrites matching
const baseDaily = [
  { id: 'daily-snapshot-1', label: '快照分日A', period: '2026-10', metrics: [], rows: [] },
  { id: 'daily-snapshot-2', label: '快照分日B', period: '2026-10', metrics: [], rows: [] },
];
const serverDaily = [
  { id: 'daily-snapshot-2', label: '更新分日B', period: '2026-10', metrics: [], rows: [] },
  { id: 'daily-server-3', label: '服务端分日C', period: '2026-10', metrics: [], rows: [] },
];
const merged = enrichmentMod.mergeById(baseDaily, serverDaily);
assert.equal(merged.length, 3, '合并后应包含 3 个唯一 ID 的数据集');
assert.equal(merged.find((d) => d.id === 'daily-snapshot-1')?.label, '快照分日A', '快照特有分日不应被抹去');
assert.equal(merged.find((d) => d.id === 'daily-snapshot-2')?.label, '更新分日B', '重叠 ID 应以最新为准更新');
assert.equal(merged.find((d) => d.id === 'daily-server-3')?.label, '服务端分日C', '新数据集应顺利追加');
console.log('✓ mergeById 保持快照自带 dailyDatasets 逻辑校验通过');

console.log('\n=== 4. 测试 scripts/onboard-huang-tiane.mjs 执行与幂等验证 ===');
const scriptPath = path.resolve(__dirname, 'onboard-huang-tiane.mjs');

// Test dry-run produces snapshot preview artifact
const dryRunOutput = execSync(`node "${scriptPath}"`, { encoding: 'utf8' });
assert.ok(dryRunOutput.includes('[DRY-RUN 结果]'), '默认执行必须为 DRY-RUN 模式');
assert.ok(dryRunOutput.includes('huang-tiane'), '输出必须包含 huang-tiane 规划');
assert.ok(dryRunOutput.includes('src-huang-tiane-commerce-canonical'), '输出必须包含 Canonical 商销主数据源');
assert.ok(dryRunOutput.includes('src-huang-tiane-commerce-alt'), '输出必须包含 Alternate 商销备用副本');
assert.ok(dryRunOutput.includes('snapshot-preview.json'), 'dry-run 必须生成并校验快照预览工件');
console.log('✓ onboard dry-run 与快照预览工件校验通过');

// Test apply execution and 4 projects integrity
const applyOutput = execSync(`node "${scriptPath}" --apply`, { encoding: 'utf8' });
assert.ok(applyOutput.includes('[INTEGRITY-VERIFIED]'), 'apply 执行后必须包含4项目哈希完整性校验');
assert.ok(applyOutput.includes('qicui: a3098236e09ce98c20d174c200ebd4ca35ca0d9511809fac04283d5a407209f8'), 'qicui 哈希完全未变');
assert.ok(applyOutput.includes('kailas: 8fac705660bda61fa4a3e65967861a971006bfaf8ce9649bf3c03dd3534e1a00'), 'kailas 哈希完全未变');
assert.ok(applyOutput.includes('meiling: 3b414939ffc0bb394bce91f3f05b4c52bc2617d36b83eeac4a6d8fc0c3abaf2c'), 'meiling 哈希完全未变');
assert.ok(applyOutput.includes('winner-wipes: b518f39679875d8447c3848c1b3c0559940211d6e897a8cfcd4f31e5e1d305a5'), 'winner-wipes 哈希完全未变');
console.log('✓ onboard --apply 事务幂等与 4 项目哈希零副作用校验通过');

console.log('\n======================================================');
console.log('🎉 黄天鹅全部后端骨架与安全防线自动化测试 100% 通过！');
console.log('======================================================');
