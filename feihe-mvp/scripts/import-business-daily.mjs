import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
const args = Object.fromEntries(process.argv.slice(2).reduce((out, value, i, all) => value.startsWith('--') ? [...out, [value.slice(2), all[i + 1]]] : out, []));
if (!args.file || !args.project || !args.db) throw new Error('Usage: node scripts/import-business-daily.mjs --file <external bundle.json> --project <project id> --db <isolated .verification/file.db>');
const location = path.resolve(args.db);
if (!location.replaceAll('\\', '/').includes('/.verification/')) throw new Error('本地联调必须使用 .verification 内的独立数据库');
Object.assign(process.env, { LOCAL_DB_PATH: location, LOCAL_DB_NO_SEED: 'true', ENABLE_TEST_AUTH: '1', REQUIRE_PROD_AUTH: 'false', KEYSTONE_API_KEY: '' });
const server = await createServer({ configFile: false, cacheDir: 'node_modules/.vite/business-import', server: { middlewareMode: true, hmr: false }, appType: 'custom', resolve: { alias: { '@': path.resolve('.') } } });
try {
  const payload = JSON.parse(fs.readFileSync(args.file, 'utf8'));
  const store = await server.ssrLoadModule('/lib/business-daily/store.ts');
  const { db } = await server.ssrLoadModule('/lib/db.ts'); await store.ensureBusinessSchema();
  const configRow = await db().prepare('SELECT version FROM business_project_config WHERE project_id=?').bind(args.project).first();
  await store.configureBusiness(args.project, payload.config, configRow?.version || 0);
  const result = await store.ingestBusinessBundle(args.project, payload.bundle);
  console.log(JSON.stringify({ projectId: args.project, database: location, receipts: result.receipts }));
  for (const day of payload.checkDays || []) {
    const view = await store.latestDaily(args.project, day);
    console.log(JSON.stringify({ day, through: view.businessThrough, core: Object.fromEntries(Object.entries(view.core).map(([k, c]) => [k, { value: c.value, state: c.state }])), differences: view.differences.map(d => ({ key: d.key, details: d.details })), tables: view.tables.map(t => ({ title: t.title, count: t.rows.length })) }));
  }
} finally { await server.close(); }
