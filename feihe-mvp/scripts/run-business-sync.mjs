import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { readBusinessSource } from './business-source-reader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

export function parseCliArgs(argv = process.argv.slice(2)) {
  const allowedFlags = new Set([
    'db', 'project', 'task', 'task-id', 'interval', 'limit',
    'automation-root', 'scheduled', 'list-due', 'dry-run', 'watch', 'help'
  ]);
  const valueFlags = new Set([
    'db', 'project', 'task', 'task-id', 'interval', 'limit', 'automation-root'
  ]);
  const booleanFlags = new Set([
    'list-due', 'dry-run', 'watch', 'help'
  ]);

  const parsed = {
    flags: new Set(),
    options: {},
  };

  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith('--')) {
      throw new Error(`无效命令行参数: "${item}"。所有选项必须以 "--" 开头。`);
    }

    let key = item.slice(2);
    let val = null;
    const eqIdx = key.indexOf('=');
    if (eqIdx !== -1) {
      val = key.slice(eqIdx + 1);
      key = key.slice(0, eqIdx);
    }

    if (!allowedFlags.has(key)) {
      throw new Error(`未知命令行参数: "--${key}"。可用参数: ${Array.from(allowedFlags).map(f => '--' + f).join(', ')}`);
    }

    if (booleanFlags.has(key)) {
      if (val !== null && val !== 'true' && val !== 'false') {
        throw new Error(`布尔参数 "--${key}" 不能赋非布尔值: "${val}"`);
      }
      if (val === 'false') {
        parsed.flags.delete(key);
      } else {
        parsed.flags.add(key);
      }
    } else if (key === 'scheduled') {
      if (val === null) {
        if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
          val = argv[++i];
        } else {
          val = 'true';
        }
      }
      parsed.options[key] = val === 'true';
    } else if (valueFlags.has(key)) {
      if (val === null) {
        if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
          val = argv[++i];
        } else {
          throw new Error(`参数 "--${key}" 缺少值。`);
        }
      }
      if (typeof val !== 'string' || val.trim() === '') {
        throw new Error(`参数 "--${key}" 不能传入空值。`);
      }
      parsed.options[key] = val.trim();
    }
  }

  if (parsed.options.task && !parsed.options['task-id']) {
    parsed.options['task-id'] = parsed.options.task;
  }
  if (parsed.options.interval) {
    const intVal = parseInt(parsed.options.interval, 10);
    if (!Number.isSafeInteger(intVal) || intVal <= 0) {
      throw new Error(`参数 "--interval" 必须是正整数秒数 (收到: "${parsed.options.interval}")`);
    }
    parsed.options.interval = intVal;
  }
  if (parsed.options.limit) {
    const limVal = parseInt(parsed.options.limit, 10);
    if (!Number.isSafeInteger(limVal) || limVal <= 0) {
      throw new Error(`参数 "--limit" 必须是正整数 (收到: "${parsed.options.limit}")`);
    }
    parsed.options.limit = limVal;
  }

  return parsed;
}

const { flags, options } = parseCliArgs();
const location = path.resolve(options.db || process.env.LOCAL_DB_PATH || path.resolve(appRoot, 'data/local.db'));
process.env.LOCAL_DB_PATH = location;
process.env.LOCAL_DB_NO_SEED = 'true';
const intervalSec = options.interval || 30;
const isWatch = flags.has('watch');
const server = await createServer({
  root: appRoot,
  configFile: false,
  cacheDir: path.resolve(appRoot, 'node_modules/.vite/business-worker'),
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  resolve: { alias: { '@': appRoot } }
});
async function platformRead(spec, task, account, window) {
  const bridge = path.resolve(appRoot, 'scripts/automation-read-bridge.py');
  const automationRoot = path.resolve(options['automation-root'] || process.env.AUTOMATION_ROOT || path.resolve(appRoot, '../../automation'));
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.FEIHE_PYTHON || 'python',[bridge],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('平台只读取数超时'));},12*60000);
    child.stdout.on('data',chunk=>{output+=chunk.toString('utf8');if(output.length>24000000){child.kill();reject(new Error('平台响应超出本批限制'));}});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',()=>{clearTimeout(timer);try{const result=JSON.parse(output);if(!result.ok)reject(new Error(result.message));else resolve(result);}catch{reject(new Error('平台桥接响应无效'));}});
    child.stdin.end(JSON.stringify({automationRoot,platform:spec.platform,account:{externalId:account.external_id},entityIds:spec.entityIds,dimension:spec.dimension,refreshDays:spec.refreshDays || 7,attributionDelayDays:spec.attributionDelayDays || 0,from:window?.window_from,to:window?.window_to}));
  });
}
try {
  const sync=await server.ssrLoadModule('/lib/business-sync/store.ts');
  const daily=await server.ssrLoadModule('/lib/business-daily/store.ts');
  const {db}=await server.ssrLoadModule('/lib/db.ts');
  const adapter=await server.ssrLoadModule('/lib/business-daily/adapter.ts');

  let isTicking = false;
  let isShuttingDown = false;
  let timer = null;

  async function executeTick() {
    if (isTicking || isShuttingDown) return;
    isTicking = true;
    try {
      if (options.project) {
        const pRow = await db().prepare('SELECT id FROM projects WHERE id=?').bind(options.project).first();
        if (!pRow) {
          throw new Error(`指定项目不存在: "${options.project}"`);
        }
      }
      if (options['task-id']) {
        const tRow = await db().prepare('SELECT id FROM business_sync_tasks WHERE id=?').bind(options['task-id']).first();
        if (!tRow) {
          throw new Error(`指定同步任务不存在: "${options['task-id']}"`);
        }
      }

      const due = await sync.dueTasks();
      let tasks = due;
      if (options.project) {
        tasks = tasks.filter(t => t.project_id === options.project);
      }
      if (options['task-id']) {
        tasks = tasks.filter(t => t.id === options['task-id']);
      }

      if (flags.has('list-due')) {
        console.log(`[BusinessWorker] 发现 ${tasks.length} 项到期排队任务 (目标库: ${location}):`);
        for (const t of tasks) {
          console.log(`- [${t.state}] ${t.id} (${t.name}) project=${t.project_id} next_run=${t.next_run_at}`);
        }
        process.exit(0);
      }

      if (flags.has('dry-run')) {
        console.log(`[BusinessWorker DRY-RUN] 评估 ${tasks.length} 项到期任务 (零外部请求/零写入):`);
        for (const t of tasks) {
          const spec = JSON.parse(t.spec_json || '{}');
          console.log(`- 校验任务: ${t.id} [类型: ${spec.type || 'business_source'}] sourceKey=${t.source_key}`);
          await sync.validateSyncSpec(t.project_id, spec);
        }
        console.log(`[BusinessWorker DRY-RUN] 所有待处理任务规范校验通过，预演完成。`);
        process.exit(0);
      }

      await sync.workerHeartbeat(options.scheduled === true || isWatch ? 'scheduled' : 'once');
      for(const task of tasks) {
        if (isShuttingDown) break;
        const claim=await sync.claimTask(task);if(!claim)continue;
        try {
      const project=await db().prepare('SELECT is_archived,status FROM projects WHERE id=?').bind(task.project_id).first();
      if(!project || project.is_archived || project.status==='已归档')throw new Error('项目已归档或不存在；未读取上游');
      const spec=JSON.parse(task.spec_json),config=await daily.businessConfig(task.project_id);
      await sync.validateSyncSpec(task.project_id,spec);
      if(spec.type!=='competitor_ipscg' && !config?.bindings.some(b=>b.key===spec.sourceKey && b.url===spec.sourceUrl))throw new Error('来源绑定已撤销；未读取上游');
            if(spec.type==='competitor_ipscg') {
        let compWorker;
        try { compWorker = await server.ssrLoadModule('/lib/competitors/worker.ts'); }
        catch (e) { throw new Error('竞品模块未就绪: ' + (e instanceof Error ? e.message : String(e))); }
        if (typeof compWorker?.runCompetitorSync !== 'function') throw new Error('竞品模块未导出 runCompetitorSync 函数');
        const syncOptions = {
          taskId: spec.taskId,
          keywords: spec.keywords,
          from: claim.request?.window_from || spec.from,
          to: claim.request?.window_to || spec.to,
          maxPagesPerRun: spec.maxPages,
          pageSize: spec.pageSize,
          overlapWindowDays: spec.overlapWindowDays,
          rateLimitMs: spec.rateLimitMs,
          checkpoint: spec.checkpoint
        };
        const result = await compWorker.runCompetitorSync(task.project_id, syncOptions);
        if (!await sync.ownsClaim(task, claim.token)) throw new Error('任务已暂停，结果未发布');
        if (!result.success) throw new Error('竞品同步执行失败: ' + (result.error || '未完成'));
        await sync.finishTask(task, claim, { rows: result.rowsImported ?? result.rowsRead ?? 0, through: result.coverageComplete ? (syncOptions.to || syncOptions.from || undefined) : undefined });
        process.stdout.write(JSON.stringify({ task: task.id, status: 'success', rows: result.rowsImported ?? result.rowsRead ?? 0, coverageComplete: Boolean(result.coverageComplete) }) + '\n');
      } else if(spec.type==='automation_platform') {
        const account=await db().prepare('SELECT external_id,metadata_json FROM source_accounts WHERE id=? AND project_id=?').bind(spec.accountId,task.project_id).first();
        if(!account || JSON.parse(account.metadata_json || '{}').platform!==spec.platform)throw new Error('项目账号绑定已撤销');
        const result=await platformRead(spec,task,account,claim.request);
        if(!await sync.ownsClaim(task,claim.token))throw new Error('任务已暂停，结果未发布');
        const statements=[];let through=null;
        for(const row of result.rows) {
          const day=adapter.calendarDay(row['日期'] || row['时间'] || row.date || row.time);
          if(!day)throw new Error('平台行缺少有效业务日期');
          const identity=row['创意ID'] || row.creativityId || row['内容ID'] || row.contentId || row['任务ID'] || row.taskId || row['订单ID'];
          if(identity===undefined || identity===null || identity==='')throw new Error('平台行缺少稳定实体ID');
          const natural=JSON.stringify([String(identity),row['投放位置'] || row.placement || '',row['关键词'] || row.keyword || '',row.targetDetail || '',row['归因范围'] || row['归因口径'] || '']);
          const id=await daily.fingerprint([task.project_id,task.source_key,spec.accountId,day,natural]);
          statements.push(db().prepare(`INSERT INTO business_platform_observations VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id,source_key,account_id,business_day,natural_key_json) DO UPDATE SET data_json=excluded.data_json,captured_at=excluded.captured_at,run_id=excluded.run_id WHERE excluded.captured_at>=business_platform_observations.captured_at`).bind(id,task.project_id,task.source_key,spec.accountId,day,natural,JSON.stringify(row),new Date().toISOString(),claim.runId));
          if(!through || day>through)through=day;
        }
        if(statements.length)await db().batch(statements);
        await sync.finishTask(task,claim,{rows:result.rows.length,through:through || undefined});
        process.stdout.write(JSON.stringify({task:task.id,status:'success',rows:result.rows.length,businessThrough:through})+'\n');
      } else {
        const result=await readBusinessSource(spec,task,config,claim.request);
        if(claim.request?.window_from && spec.role==='weekly') {
          const from=claim.request.window_from,to=claim.request.window_to;
          const dates=new Set(adapter.buildDailyView(task.project_id,result.bundle,to,{from,to}).series.map(p=>p.date));
          for(let day=from;day<=to;day=new Date(Date.parse(day)+86400000).toISOString().slice(0,10))if(!dates.has(day))throw new Error('周表没有指定补跑日期：'+day);
        }
        if(!await sync.ownsClaim(task,claim.token))throw new Error('任务已暂停，结果未发布');
        if(result.generatedBindings?.length){const current=await db().prepare('SELECT version,config_json FROM business_project_config WHERE project_id=?').bind(task.project_id).first();const fresh=JSON.parse(current.config_json);for(const b of result.generatedBindings){const old=fresh.bindings.find(x=>x.key===b.key);if(old&&(old.role!==b.role||old.url!==b.url))throw new Error('来源绑定并发冲突，未覆盖配置');if(!old)fresh.bindings.push(b);}await daily.configureBusiness(task.project_id,fresh,current.version);}
        await daily.ingestBusinessBundle(task.project_id,result.bundle);
        const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
        const view=await daily.latestDaily(task.project_id,day);
        await sync.finishTask(task,claim,{rows:result.rows,through:view.businessThrough || undefined});
        process.stdout.write(JSON.stringify({task:task.id,status:'success',rows:result.rows,businessThrough:view.businessThrough})+'\n');
      }
    } catch(error) {await sync.finishTask(task,claim,{rows:0,error});process.stdout.write(JSON.stringify({task:task.id,status:'failed',error:sync.safeSyncError(error)})+'\n');}
      }
    } finally {
      isTicking = false;
    }
  }

  if (isWatch) {
    console.log(`[BusinessWorker] 常驻轮询调度器已就绪 (间隔: ${intervalSec}秒, 数据库: ${location})`);
    const shutdown = async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      if (timer) clearInterval(timer);
      console.log('\n[BusinessWorker] 收到退出信号，正在安全停机...');
      const deadline = Date.now() + 5000;
      while (isTicking && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 100));
      }
      try { await server.close(); } catch {}
      console.log('[BusinessWorker] 停机完成。');
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.stdin.resume();
    process.stdin.on('data', d => {
      if (d.toString().includes('STOP')) shutdown();
    });
    process.stdin.on('end', shutdown);

    await executeTick();
    timer = setInterval(executeTick, intervalSec * 1000);
  } else {
    try {
      await executeTick();
    } finally {
      await server.close();
    }
  }
} finally {await server.close();}
