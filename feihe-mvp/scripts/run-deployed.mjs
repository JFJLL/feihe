import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'site';
if (!['site', 'industry'].includes(mode)) throw new Error('Expected site or industry');
const configFile = process.env.FEIHE_DEPLOY_ENV_FILE || path.join(root, 'runtime/site-env.json');
const privateEnv = JSON.parse(fs.readFileSync(configFile, 'utf8'));
if (!privateEnv || typeof privateEnv !== 'object' || Array.isArray(privateEnv) || Object.values(privateEnv).some(v => typeof v !== 'string')) {
  throw new Error('Deployment environment must be a string-valued object');
}
if (process.platform !== 'win32' && (fs.statSync(configFile).mode & 0o077)) throw new Error('Deployment environment must have mode 0600');
const env = { ...process.env, ...privateEnv, NODE_ENV: 'production' };
const args = mode === 'site'
  ? [path.join(root, 'node_modules/vinext/dist/cli.js'), 'start', '--port', '5013', '--hostname', '127.0.0.1']
  : [path.join(root, 'scripts/run-industry-monitor.mjs'), '--watch'];
const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('error', () => { console.error('Deployment child failed to start'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
