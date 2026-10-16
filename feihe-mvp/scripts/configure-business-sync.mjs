import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const options = {};
for (let i = 0; i < argv.length; i++) {
  const item = argv[i];
  if (!item.startsWith('--')) continue;
  let key = item.slice(2);
  let val = null;
  const eqIdx = key.indexOf('=');
  if (eqIdx !== -1) {
    val = key.slice(eqIdx + 1);
    key = key.slice(0, eqIdx);
  } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
    val = argv[++i];
  }
  options[key] = val || '';
}

const location = path.resolve(options.db || process.env.LOCAL_DB_PATH || path.resolve(appRoot, 'data/local.db'));
if (!options.file || !options.project) throw new Error('--file and --project required');
process.env.LOCAL_DB_PATH = location;
process.env.LOCAL_DB_NO_SEED = 'true';
const vite = await createServer({
  root: appRoot,
  configFile: false,
  cacheDir: path.resolve(appRoot, 'node_modules/.vite/business-sync-config'),
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  resolve: { alias: { '@': appRoot } }
});
try {
  const sync=await vite.ssrLoadModule('/lib/business-sync/store.ts');const {db}=await vite.ssrLoadModule('/lib/db.ts');await sync.ensureSyncSchema();
  const tasks=JSON.parse(fs.readFileSync(options.file,'utf8'));
  for(const t of tasks){const prior=await db().prepare('SELECT version FROM business_sync_tasks WHERE project_id=? AND source_key=?').bind(options.project,t.spec.sourceKey).first();const result=await sync.saveSyncTask(options.project,t.name,t.spec,t.intervalMinutes || 360,prior?.version || 0);process.stdout.write(JSON.stringify({taskId:result.id,configured:true})+'\n');}
}finally{await vite.close();}
