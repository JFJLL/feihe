const path = process.getBuiltinModule('node:path');
const root = path.resolve(__dirname, '..');
const interpreter = process.env.XHS_NODE_BINARY || path.join(root, 'runtime/node');
module.exports = { apps: [
  { name: 'feihe-local', cwd: root, script: 'scripts/run-deployed.mjs', args: 'site', interpreter, instances: 1, exec_mode: 'fork', autorestart: true, kill_timeout: 10000, restart_delay: 2000 },
  { name: 'xhs-industry-monitor', cwd: root, script: 'scripts/run-deployed.mjs', args: 'industry', interpreter, instances: 1, exec_mode: 'fork', autorestart: true, kill_timeout: 10000, restart_delay: 10000 },
] };
