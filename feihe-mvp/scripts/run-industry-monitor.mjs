#!/usr/bin/env node
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const isWatch = args.includes('--watch');
const isDryRun = args.includes('--dry-run');
const force = args.includes('--force');
const projectArg = args.find(a => a.startsWith('--project='))?.split('=')[1] || (args.includes('--project') ? args[args.indexOf('--project') + 1] : undefined);

// Initialize Vite in custom middlewareMode to load project TS modules directly without build artifacts
const vite = await createServer({
  root: appRoot,
  configFile: false,
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
  cacheDir: path.resolve(appRoot, 'node_modules/.vite/industry-worker'),
  resolve: { alias: { '@': appRoot } },
});

const { runIndustrySync, getShanghaiDateKey, resolveProjectIndustryMeta } = await vite.ssrLoadModule('/lib/industry-service.ts');
const { CAMPAIGN_PROJECT_IDS } = await vite.ssrLoadModule('/lib/campaign-catalog.ts');
const { ensureSchema } = await vite.ssrLoadModule('/lib/db.ts');
const { ensureIndustrySchema, getIndustryConfig } = await vite.ssrLoadModule('/lib/industry-db.ts');

// Strict project validation: Only the 4 campaign projects are supported
if (projectArg && !CAMPAIGN_PROJECT_IDS.includes(projectArg)) {
  console.error(`[IndustryMonitor] 非法项目 "${projectArg}"。仅支持 4 个营销复盘项目: [${CAMPAIGN_PROJECT_IDS.join(', ')}]`);
  await vite.close();
  process.exit(1);
}

const projectsToRun = projectArg ? [projectArg] : Array.from(CAMPAIGN_PROJECT_IDS);

console.log(`[IndustryMonitor] 启动行业分析每日调度器 (模式: ${isWatch ? '常驻 --watch' : '单次执行'}, dryRun: ${isDryRun})`);
console.log(`[IndustryMonitor] 覆盖项目: [${projectsToRun.join(', ')}]，每次最多 2 页，每日最多 3 次尝试，成功后当天不重复采集`);

async function runDailyCycle() {
  // Initialize base and industry schema before reading metadata to prevent silent skip on empty DB
  await ensureSchema();
  await ensureIndustrySchema();

  const dateKey = getShanghaiDateKey();
  console.log(`\n[IndustryMonitor] 检查/执行调度周期 (上海日期: ${dateKey})`);
  let hasError = false;

  for (const pid of projectsToRun) {
    try {
      const meta = await resolveProjectIndustryMeta(pid);
      if (!meta.spu) {
        console.warn(`[IndustryMonitor][${pid}] 项目资料中尚未配置 SPU，跳过自动抓取 (状态: missing_spu)`);
        continue;
      }

      const config = await getIndustryConfig(pid);
      if (config && !config.dailySyncEnabled && !force) {
        console.log(`[IndustryMonitor][${pid}] dailySyncEnabled=false，已配置禁用每日自动采集，跳过`);
        continue;
      }

      if (isDryRun) {
        console.log(`[IndustryMonitor][${pid}][DRY-RUN] SPU: "${meta.spu}", 品牌: "${meta.brand}", 检查通过`);
        continue;
      }

      const res = await runIndustrySync({
        projectId: pid,
        dateKey,
        force,
      });

      if (res.skipped) {
        console.log(`[IndustryMonitor][${pid}] 今日任务已完成或正在执行，跳过重复请求`);
      } else if (res.ok) {
        console.log(`[IndustryMonitor][${pid}] 同步成功 (SPU: ${meta.spu}, 状态: ${res.status})`);
      } else {
        console.error(`[IndustryMonitor][${pid}] 同步未成功: ${res.error || res.status} (保留历史快照)`);
        hasError = true;
      }
    } catch (err) {
      console.error(`[IndustryMonitor][${pid}] 任务异常:`, err instanceof Error ? err.message : String(err));
      hasError = true;
    }
  }

  return !hasError;
}

// Execute immediately on startup
const initialSuccess = await runDailyCycle();

if (!isWatch) {
  await vite.close();
  process.exit(initialSuccess ? 0 : 1);
} else {
  console.log(`[IndustryMonitor] 已就绪并进入常驻监听，每 60 秒检查跨日调度...`);
  let lastCheckedDate = getShanghaiDateKey();

  setInterval(async () => {
    const currentDate = getShanghaiDateKey();
    if (currentDate !== lastCheckedDate) {
      lastCheckedDate = currentDate;
      console.log(`[IndustryMonitor] 检测到跨日变更 -> 新日期 ${currentDate}，触发新一轮调度`);
      await runDailyCycle();
    }
  }, 60 * 1000);
}
