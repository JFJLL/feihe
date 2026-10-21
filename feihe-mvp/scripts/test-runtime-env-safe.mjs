import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/runtime-env.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function load(config, env = {}) {
  const mod = { exports: {} };
  const fakeFs = { existsSync: () => config !== null, readFileSync: () => JSON.stringify(config) };
  const processMock = { versions: { node: '22.23.1' }, env, cwd: () => '/sandbox/app', getBuiltinModule: name => name === 'node:fs' ? fakeFs : path };
  vm.runInNewContext(`(function(module,exports,require,process){${code}\n})`)(mod, mod.exports, () => { throw Error('No worker bindings in Node test'); }, processMock);
  return mod.exports;
}
assert(!source.includes("'base64'"), 'Never keep encoded deployment credentials in source');
const empty = load(null);
assert.equal(empty.envVar('FEISHU_APP_SECRET'), '');
assert.equal(empty.envVar('KEYSTONE_API_KEY'), '');
assert.equal(empty.runtimeVars().FEISHU_APP_SECRET, undefined);
const configured = load({ feishu: { app_id: 'test-app', app_secret: 'test-config-secret' }, keystone: { api_key: 'test-ai-key' } });
assert.equal(configured.envVar('FEISHU_APP_ID'), 'test-app');
assert.equal(configured.envVar('FEISHU_APP_SECRET'), 'test-config-secret');
assert.equal(configured.runtimeVars().KEYSTONE_API_KEY, 'test-ai-key');
const override = load({ feishu: { app_secret: 'test-config' } }, { FEISHU_APP_SECRET: 'test-env' });
assert.equal(override.envVar('FEISHU_APP_SECRET'), 'test-env');
assert.equal(override.runtimeVars().FEISHU_APP_SECRET, 'test-env');
console.log('Runtime config: Node ESM fallback, env priority and missing-secret behavior passed.');
