#!/usr/bin/env node
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const allowed = new Set(['--watch', '--dry-run', '--force', '--project', '--limit', '--cycles']);
const options = {};
for (let index = 0; index < args.length; index++) {
  const [flag, inline] = args[index].split('=');
  if (!allowed.has(flag)) throw Error('Unknown worker option: ' + flag);
  if (['--watch', '--dry-run', '--force'].includes(flag)) options[flag] = true;
  else { const value = inline ?? args[++index]; if (!value || value.startsWith('--')) throw Error('Missing value for ' + flag); options[flag] = value; }
}
const limit = Number(options['--limit'] || 12), cycles = Number(options['--cycles'] || 1);
if (!Number.isInteger(limit) || limit < 1 || limit > 40 || !Number.isInteger(cycles) || cycles < 1 || cycles > 40) throw Error('limit must be 1..40, cycles 1..40');
process.env.LOCAL_DB_NO_SEED = 'true';
const vite = await createServer({ root, configFile: false, cacheDir: path.join(root, 'node_modules/.vite/industry-worker-v2'), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', resolve: { alias: { '@': root } } });
let stopped = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopped = true; });
try {
  const { CAMPAIGN_PROJECT_IDS } = await vite.ssrLoadModule('/lib/campaign-catalog.ts');
  const { runNextIndustryV2Job } = await vite.ssrLoadModule('/lib/industry-v2-service.ts');
  const { getIndustryV2Config, industryWindow } = await vite.ssrLoadModule('/lib/industry-v2-store.ts');
  if (options['--project'] && !CAMPAIGN_PROJECT_IDS.includes(options['--project'])) throw Error('Unsupported project');
  const projects = options['--project'] ? [options['--project']] : [...CAMPAIGN_PROJECT_IDS];
  console.log('[Industry V2] Shanghai daily ledger; max 3 pages/query/day attempt; 360 pages/project/calendar day including retries.');
  if (options['--dry-run']) {
    for (const project of projects) {
      const config = await getIndustryV2Config(project);
      console.log(JSON.stringify({ project, config, window: config ? industryWindow(config) : null }));
    }
  } else {
    let count = 0, cursor = 0;
    do {
      let active = false;
      for (let i = 0; i < limit && !stopped; i++) {
        const project = projects[cursor++ % projects.length];
        try {
          const result = await runNextIndustryV2Job(project, { force: Boolean(options['--force']) });
          if (!['idle', 'disabled'].includes(result.status)) { active = true; console.log(JSON.stringify(result)); }
        } catch { console.error('[Industry V2] Project job failed safely: ' + project); }
      }
      count++;
      if (!options['--watch'] && count >= cycles) break;
      // Single sequential loop: no interval overlap when an upstream request is slow.
      const seconds = active ? 15 : 60;
      for (let i = 0; i < seconds && !stopped; i++) await new Promise(resolve => setTimeout(resolve, 1000));
    } while (!stopped);
  }
} finally { await vite.close(); }
