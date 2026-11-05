const path = process.getBuiltinModule('node:path');
const root = path.resolve(__dirname, '..');
const interpreter = process.env.XHS_NODE_BINARY || path.join(root, 'runtime/node');
const canonicalDbPath = process.env.LOCAL_DB_PATH
  || (root.includes('.releases') ? path.resolve(root.split('.releases')[0], 'feihe-mvp/data/local.db') : path.join(root, 'data/local.db'));

module.exports = { apps: [
  {
    name: 'feihe-local',
    cwd: root,
    script: 'scripts/run-deployed.mjs',
    args: 'site',
    interpreter,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    kill_timeout: 10000,
    restart_delay: 2000,
    env: {
      LOCAL_DB_PATH: canonicalDbPath,
    },
  },
  {
    name: 'xhs-industry-monitor',
    cwd: root,
    script: 'scripts/run-deployed.mjs',
    args: 'industry',
    interpreter,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    kill_timeout: 10000,
    restart_delay: 10000,
    env: {
      LOCAL_DB_PATH: canonicalDbPath,
    },
  },
] };