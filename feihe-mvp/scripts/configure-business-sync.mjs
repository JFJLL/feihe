import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const args=Object.fromEntries(process.argv.slice(2).reduce((out,v,i,all)=>v.startsWith('--')?[...out,[v.slice(2),all[i+1]]]:out,[]));
const location=path.resolve(args.db || '.verification/business.db');if(!location.replaceAll('\\','/').includes('/.verification/'))throw new Error('只允许隔离开发库');
if(!args.file || !args.project)throw new Error('--file and --project required');
Object.assign(process.env,{LOCAL_DB_PATH:location,LOCAL_DB_NO_SEED:'true',ENABLE_TEST_AUTH:'1',REQUIRE_PROD_AUTH:'false'});
const vite=await createServer({configFile:false,cacheDir:'node_modules/.vite/business-sync-config',server:{middlewareMode:true,hmr:false},appType:'custom',resolve:{alias:{'@':path.resolve('.')}}});
try {
  const sync=await vite.ssrLoadModule('/lib/business-sync/store.ts');const {db}=await vite.ssrLoadModule('/lib/db.ts');await sync.ensureSyncSchema();
  const tasks=JSON.parse(fs.readFileSync(args.file,'utf8'));
  for(const t of tasks){const prior=await db().prepare('SELECT version FROM business_sync_tasks WHERE project_id=? AND source_key=?').bind(args.project,t.spec.sourceKey).first();const result=await sync.saveSyncTask(args.project,t.name,t.spec,t.intervalMinutes || 360,prior?.version || 0);process.stdout.write(JSON.stringify({taskId:result.id,configured:true})+'\n');}
}finally{await vite.close();}
