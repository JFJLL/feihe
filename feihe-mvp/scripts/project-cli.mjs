#!/usr/bin/env node

/**
 * project-cli.mjs
 *
 * Universal CLI for project lifecycle management:
 * - pnpm project:pull <projectId>  : Pull raw sources & generate .cache/auto-blueprint.md
 * - pnpm project:build <projectId> : Run transform, validate BoardHealth, and write to DB
 * - pnpm project:health <projectId>: Run dashboard health checks
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const command = args[0];
const projectId = args[1];

if (!command || !projectId) {
  console.log(`
用法:
  node scripts/project-cli.mjs pull <projectId>   # 拉取源数据并自动生成 auto-blueprint.md 蓝图
  node scripts/project-cli.mjs build <projectId>  # 执行 transform、健康检查并入库
  node scripts/project-cli.mjs health <projectId> # 对当前看板配置执行体检
`);
  process.exit(1);
}

const projDir = path.resolve(ROOT_DIR, 'projects', projectId);
if (!fs.existsSync(projDir)) {
  console.error(`[project-cli] 错误: 项目目录不存在: ${projDir}`);
  process.exit(1);
}

const cacheDir = path.resolve(projDir, '.cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

async function main() {
  // Setup Vite SSR loader for TypeScript imports
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true },
    appType: 'custom',
    resolve: { alias: { '@': ROOT_DIR } },
  });

  try {
    if (command === 'pull') {
      console.log(`[project-cli] 正在拉取项目 "${projectId}" 的原始数据...`);
      const { loadProjectSources } = await vite.ssrLoadModule('/lib/core/registry.ts');
      const { fetchFeishuSource } = await vite.ssrLoadModule('/lib/core/sync-runner.ts');

      const sourcesConfig = await loadProjectSources(projectId);
      const rawCachePath = path.resolve(cacheDir, 'raw-sources.json');
      let rawSources = {};
      if (fs.existsSync(rawCachePath)) {
        try {
          rawSources = JSON.parse(fs.readFileSync(rawCachePath, 'utf8'));
        } catch {
          rawSources = {};
        }
      }

      if (sourcesConfig?.sources) {
        for (const src of sourcesConfig.sources) {
          console.log(`- 正在读取数据源 [${src.id}] (${src.name})...`);
          if (src.type === 'feishu_sheet' || src.type === 'feishu_bitable') {
            const res = fetchFeishuSource(src);
            if (res.ok && res.data) {
              rawSources[src.id] = res.data;
              console.log(`  ✓ 成功拉取飞书源: ${src.id}`);
            } else {
              console.log(`  ⚠ 无法在线拉取或未安装 lark-cli (${res.error || '未返回有效数据'})，复用已有缓存`);
            }
          } else if (src.filePath && fs.existsSync(path.resolve(ROOT_DIR, src.filePath))) {
            try {
              rawSources[src.id] = JSON.parse(fs.readFileSync(path.resolve(ROOT_DIR, src.filePath), 'utf8'));
              console.log(`  ✓ 成功读取本地源: ${src.filePath}`);
            } catch {
              // Skip
            }
          }
        }
      }

      fs.writeFileSync(rawCachePath, JSON.stringify(rawSources, null, 2), 'utf8');
      console.log(`✓ 原始数据已写入缓存: ${rawCachePath}`);

      // Generate auto-blueprint.md
      console.log(`\n[project-cli] 正在扫描子表结构，自动推断指标口径与推荐看板蓝图...`);
      const blueprintMd = generateAutoBlueprint(projectId, rawSources);
      const blueprintPath = path.resolve(cacheDir, 'auto-blueprint.md');
      fs.writeFileSync(blueprintPath, blueprintMd, 'utf8');
      console.log(`✓ 推荐蓝图已自动生成: ${blueprintPath}`);
      console.log(`\n--- 蓝图摘要预览 ---\n${blueprintMd.slice(0, 1000)}...\n`);
    } else if (command === 'build') {
      console.log(`[project-cli] 正在编译并验证项目 "${projectId}"...`);
      const { runProjectSync } = await vite.ssrLoadModule('/lib/core/sync-runner.ts');
      const res = await runProjectSync(projectId, { force: false });

      if (!res.ok || !res.healthPassed) {
        console.error(`\n❌ [BUILD FAILED] 项目 ${projectId} 构建未通过健康检查:`);
        if (res.errors?.length) {
          for (const err of res.errors) console.error(`  - ${err}`);
        }
        process.exit(1);
      } else {
        console.log(`\n🎉 [BUILD SUCCESS] ${res.message}`);
        if (res.warnings?.length) {
          console.log(`\n优化建议 (Warnings):`);
          for (const w of res.warnings) console.log(`  - ${w}`);
        }
      }
    } else if (command === 'health') {
      console.log(`[project-cli] 正在对项目 "${projectId}" 运行健康审计...`);
      const { buildProjectBoard } = await vite.ssrLoadModule('/lib/core/registry.ts');
      const { validateBoardHealth, formatHealthReport } = await vite.ssrLoadModule('/lib/core/board-health.ts');

      const rawCachePath = path.resolve(cacheDir, 'raw-sources.json');
      let rawSources = {};
      if (fs.existsSync(rawCachePath)) {
        try { rawSources = JSON.parse(fs.readFileSync(rawCachePath, 'utf8')); } catch { rawSources = {}; }
      }
      const payload = await buildProjectBoard(projectId, rawSources);
      const report = validateBoardHealth(payload);
      console.log(formatHealthReport(report));
      if (!report.ok) process.exit(1);
    } else {
      console.error(`未知命令: ${command}`);
      process.exit(1);
    }
  } finally {
    await vite.close();
  }
}

function generateAutoBlueprint(pid, rawSources) {
  const lines = [
    `# 【${pid}】项目源表画像与 AI 推荐看板蓝图 (Auto-Blueprint)`,
    `> 生成时间: ${new Date().toISOString()}`,
    `> 该文件由 pnpm project:pull 自动扫描生成，用于指导 transform.ts 的声明式看板装配。`,
    '',
    '## 1. 探测到的源数据表与字段角色推断',
  ];

  const tableKeys = Object.keys(rawSources);
  if (tableKeys.length === 0) {
    lines.push('- 暂无已缓存的子表数据，请确认 sources.ts 配置并在有网络或本地文件时重试。');
  }

  const recommendedSections = [];

  for (const tKey of tableKeys) {
    const raw = rawSources[tKey];
    lines.push(`\n### 数据表: \`${tKey}\``);

    let rowCount = 0;
    let sampleCols = [];
    if (Array.isArray(raw)) {
      rowCount = raw.length;
      if (raw[0] && typeof raw[0] === 'object') sampleCols = Object.keys(raw[0]);
    } else if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.rows)) {
        rowCount = raw.rows.length;
        if (raw.rows[0]) sampleCols = Object.keys(raw.rows[0]);
      } else if (Array.isArray(raw.items)) {
        rowCount = raw.items.length;
        if (raw.items[0]) sampleCols = Object.keys(raw.items[0]);
      } else {
        sampleCols = Object.keys(raw);
      }
    }

    lines.push(`- 记录行数: ${rowCount} 行`);
    lines.push(`- 探测字段列 (${sampleCols.length} 个):`);

    let hasDate = false;
    let hasSpend = false;
    let hasUv = false;
    let hasNotes = false;

    for (const col of sampleCols.slice(0, 15)) {
      const lower = col.toLowerCase();
      let role = 'DIMENSION (分类维度)';
      if (lower.includes('date') || lower.includes('day') || lower.includes('时间') || lower.includes('日期')) {
        role = 'TIMESTAMP (时间序列)';
        hasDate = true;
      } else if (lower.includes('rate') || lower.includes('ctr') || lower.includes('cpm') || lower.includes('roi') || lower.includes('率') || lower.includes('比')) {
        role = 'RATIO (比率/成本度量)';
      } else if (lower.includes('spend') || lower.includes('cost') || lower.includes('金额') || lower.includes('消耗') || lower.includes('预算')) {
        role = 'METRIC (货币金额)';
        hasSpend = true;
      } else if (lower.includes('count') || lower.includes('uv') || lower.includes('曝光') || lower.includes('互动') || lower.includes('量')) {
        role = 'METRIC (计数量)';
        if (lower.includes('uv')) hasUv = true;
      } else if (lower.includes('note') || lower.includes('title') || lower.includes('达人') || lower.includes('笔记')) {
        hasNotes = true;
      }
      lines.push(`  - \`${col}\`: **${role}**`);
    }

    // Infer recommended sections
    if (hasDate && (hasSpend || hasUv)) {
      recommendedSections.push({
        title: `分日流水与全域趋势 (${tKey})`,
        comp: 'line-bar-combo / time-series',
        reason: '检测到时间戳与规模度量，推荐生成双轴分日消耗与转化趋势图',
      });
    }
    if (hasSpend) {
      recommendedSections.push({
        title: `核心指标总览卡 (KPI Summary)`,
        comp: 'paired-metrics (metric-card)',
        reason: '检测到预算与消耗指标，推荐提炼核心金额与达成率 KPI 卡片',
      });
    }
    if (hasNotes) {
      recommendedSections.push({
        title: `达人笔记表现与爆文矩阵`,
        comp: 'data-table + effect-scatter',
        reason: '检测到达人与内容明细，推荐生成 TOP 内容榜单与投入产出象限散点图',
      });
    }
  }

  lines.push('\n## 2. 推荐装配的看板模块清单 (Recommended Sections)');
  if (recommendedSections.length > 0) {
    recommendedSections.forEach((s, idx) => {
      lines.push(`${idx + 1}. **${s.title}**`);
      lines.push(`   - 推荐组件: \`${s.comp}\``);
      lines.push(`   - 推荐理由: ${s.reason}`);
    });
  } else {
    lines.push('1. **总览核心 KPI 组**: 提取汇总数值并生成成对指标卡');
    lines.push('2. **明细数据表格**: 展示核心数据表前 50 行记录');
  }

  lines.push('\n## 3. 下一步行动指南');
  lines.push('1. 根据上述推荐清单，在 `projects/<id>/transform.ts` 中编写 `transformProject(rawSources): BoardPayload`。');
  lines.push('2. 确保所有百分比、比率、单位换算 100% 在 `transform.ts` 中预先计算。');
  lines.push('3. 运行 `pnpm project:build <id>` 通过自检并入库。');

  return lines.join('\n');
}

main().catch((err) => {
  console.error('[project-cli] 未捕获异常:', err);
  process.exit(1);
});
