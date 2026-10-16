import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCompetitorSync } from '../lib/competitors/worker.ts';
import { getCompetitorConfig } from '../lib/competitors/db.ts';
import { claimTask, finishTask, dueTasks } from '../lib/business-sync/store.ts';
import { db } from '../lib/db.ts';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    projectId: 'qicui',
    keywords: [],
    maxPagesPerRun: 3,
    pageSize: 20,
    from: undefined,
    to: undefined,
    windowType: 'pubTime',
    rateLimitMs: 1200,
  };

  for (const arg of args) {
    if (arg.startsWith('--project=')) options.projectId = arg.split('=')[1];
    else if (arg.startsWith('--keyword=')) options.keywords.push(arg.split('=')[1]);
    else if (arg.startsWith('--max-pages=')) options.maxPagesPerRun = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--page-size=')) options.pageSize = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--from=')) options.from = arg.split('=')[1];
    else if (arg.startsWith('--to=')) options.to = arg.split('=')[1];
    else if (arg.startsWith('--window-type=')) options.windowType = arg.split('=')[1];
    else if (arg.startsWith('--rate-limit=')) options.rateLimitMs = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--db=')) process.env.LOCAL_DB_PATH = arg.split('=')[1];
  }
  if (!process.env.LOCAL_DB_PATH) {
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    process.env.LOCAL_DB_PATH = path.join(rootDir, 'data', 'local.db');
  }
  return options;
}

async function main() {
  const opts = parseArgs();
  console.log('[CompetitorSyncRunner] 启动执行器 (项目: ' + opts.projectId + ')');
  console.log('[CompetitorSyncRunner] 数据库路径: ' + process.env.LOCAL_DB_PATH);

  const config = await getCompetitorConfig(opts.projectId);
  if (!config?.isConfigured) {
    console.error('[CompetitorSyncRunner 错误] 项目 [' + opts.projectId + '] 尚未配置绑定 taskId，拒绝执行。');
    process.exit(1);
  }

  // 1. 扫描官方持久化队列中的到期/排队竞品任务并 Claim Lease
  const activeTasks = await dueTasks();
  const compTask = activeTasks.find(t => t.project_id === opts.projectId && t.source_key.startsWith('competitor-ipscg'));

  if (compTask) {
    const claim = await claimTask(compTask);
    if (claim) {
      console.log('[CompetitorSyncRunner] 成功 Claim 持久任务租约！Token: ' + claim.token + ', RunId: ' + claim.runId);
      let spec = {};
      try { spec = JSON.parse(compTask.spec_json || '{}'); } catch {}
      if (claim.request) {
        console.log('[CompetitorSyncRunner] 发现持久排队请求 ID: ' + claim.request.id + ', 窗口: [' + (claim.request.window_from || '默认') + ' ~ ' + (claim.request.window_to || '默认') + ']');
      }

      try {
        const result = await runCompetitorSync(opts.projectId, {
          taskId: spec.taskId || config.taskId,
          keywords: (spec.keywords && spec.keywords.length) ? spec.keywords : config.keywords,
          from: claim.request?.window_from || spec.from || opts.from,
          to: claim.request?.window_to || spec.to || opts.to,
          windowType: spec.windowType || opts.windowType,
          maxPagesPerRun: spec.maxPages || opts.maxPagesPerRun,
          pageSize: spec.pageSize || opts.pageSize,
          rateLimitMs: spec.rateLimitMs || opts.rateLimitMs,
        });

        await finishTask(compTask, claim, {
          rows: result.rowsImported,
          error: result.error || undefined,
        });

        console.log('[CompetitorSyncRunner] 持久任务执行成功并释放租约 (RunId: ' + claim.runId + ')');
        console.log('读取记录: ' + result.rowsRead + ', 新入库: ' + result.rowsImported + ', 成功: ' + result.success);
        return;
      } catch (err) {
        await finishTask(compTask, claim, {
          rows: 0,
          error: err,
        });
        console.error('[CompetitorSyncRunner 调度异常]', err);
        process.exit(1);
      }
    }
  }

  // 2. 无排队任务时，执行直接单次增量同步
  console.log('[CompetitorSyncRunner] 当前无持久排队请求，执行直接单次增量同步...');
  const targetKeywords = opts.keywords.length ? opts.keywords : config.keywords;
  console.log('[CompetitorSyncRunner] 绑定 TaskID: ' + config.taskId + ', 同步词: ' + targetKeywords.join(', '));

  const result = await runCompetitorSync(opts.projectId, {
    keywords: targetKeywords,
    maxPagesPerRun: opts.maxPagesPerRun,
    pageSize: opts.pageSize,
    from: opts.from,
    to: opts.to,
    windowType: opts.windowType,
    rateLimitMs: opts.rateLimitMs,
  });

  console.log('\n=== 同步执行结果 ===');
  console.log('成功状态: ' + (result.success ? '✓ 成功' : '✗ 失败'));
  console.log('耗时: ' + result.durationMs + 'ms');
  console.log('抓取页数: ' + result.pagesFetched);
  console.log('读取记录数: ' + result.rowsRead);
  console.log('新入库数: ' + result.rowsImported);
  console.log('重复命中数: ' + result.duplicatesDetected);
  console.log('疑似重复标记数: ' + result.suspectedDuplicates);
  console.log('水位是否推进: ' + (result.watermarkAdvanced ? '是' : '否'));
  console.log('全量覆盖完成: ' + (result.coverageComplete ? '是' : '否 (采样中)'));

  console.log('\n=== 独立 Checkpoints ===');
  for (const [key, cp] of Object.entries(result.checkpoints)) {
    console.log('- [' + key + ']: 当前页 ' + cp.pageCursor + ', 累计入库 ' + cp.rowsImported + ', 完整: ' + (cp.coverageComplete ? '✓' : '采样中'));
  }
}

main().catch(err => {
  console.error('[CompetitorSyncRunner 异常]', err);
  process.exit(1);
});
