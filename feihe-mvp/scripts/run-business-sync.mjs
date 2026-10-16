import { createServer } from 'vite';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readBusinessSource } from './business-source-reader.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((out, v, i, all) => v.startsWith('--') ? [...out,[v.slice(2),all[i+1]]] : out, []));
const location = path.resolve(args.db || '.verification/business.db');
if (!location.replaceAll('\\','/').includes('/.verification/')) throw new Error('本轮worker只允许隔离开发库');
Object.assign(process.env,{LOCAL_DB_PATH:location,LOCAL_DB_NO_SEED:'true',ENABLE_TEST_AUTH:'1',REQUIRE_PROD_AUTH:'false'});
const server = await createServer({configFile:false,cacheDir:'node_modules/.vite/business-worker',server:{middlewareMode:true,hmr:false},appType:'custom',resolve:{alias:{'@':path.resolve('.')}}});
async function platformRead(spec, task, account, window) {
  const bridge = path.resolve('scripts/automation-read-bridge.py');
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.FEIHE_PYTHON || 'python',[bridge],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('平台只读取数超时'));},12*60000);
    child.stdout.on('data',chunk=>{output+=chunk.toString('utf8');if(output.length>24000000){child.kill();reject(new Error('平台响应超出本批限制'));}});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',()=>{clearTimeout(timer);try{const result=JSON.parse(output);if(!result.ok)reject(new Error(result.message));else resolve(result);}catch{reject(new Error('平台桥接响应无效'));}});
    child.stdin.end(JSON.stringify({automationRoot:args['automation-root'],platform:spec.platform,account:{externalId:account.external_id},entityIds:spec.entityIds,dimension:spec.dimension,refreshDays:spec.refreshDays || 7,attributionDelayDays:spec.attributionDelayDays || 0,from:window?.window_from,to:window?.window_to}));
  });
}
try {
  const sync=await server.ssrLoadModule('/lib/business-sync/store.ts');
  const daily=await server.ssrLoadModule('/lib/business-daily/store.ts');
  const {db}=await server.ssrLoadModule('/lib/db.ts');
  const adapter=await server.ssrLoadModule('/lib/business-daily/adapter.ts');
  await sync.workerHeartbeat(args.scheduled === 'true' ? 'scheduled' : 'once');
  for(const task of await sync.dueTasks()) {
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
} finally {await server.close();}
