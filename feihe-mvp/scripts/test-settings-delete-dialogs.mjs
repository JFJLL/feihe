import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';

const root = path.resolve(import.meta.dirname, '..');

console.log('=== Running Settings Delete Dialogs & Reload Failure Boundary Tests ===');

// Mock API and toast tracking
let apiCalls = [];
let mockApiHandler = async (url, opts) => ({ ok: true });
const mockApi = async (url, opts) => {
  const record = {
    url,
    opts,
    body: opts?.body ? JSON.parse(opts.body) : undefined,
  };
  apiCalls.push(record);
  return mockApiHandler(url, opts);
};

// Active dispatcher reference for mocked react
let activeDispatcher = null;
const mockReact = {
  ...React,
  useState: (init) => activeDispatcher.useState(init),
  useMemo: (fn) => activeDispatcher.useMemo(fn),
  useCallback: (fn) => activeDispatcher.useCallback(fn),
  useEffect: (fn) => activeDispatcher.useEffect(fn),
  useRef: (init) => activeDispatcher.useRef(init),
  useId: () => activeDispatcher.useId(),
};

const moduleCache = new Map();
function loadComponent(filename) {
  filename = path.resolve(root, filename);
  if (moduleCache.has(filename)) return moduleCache.get(filename);
  const raw = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(raw, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(filename);
  const customRequire = (name) => {
    if (name.endsWith('.css')) return {};
    if (name === 'react') return mockReact;
    if (name.includes('use-project-data')) {
      return {
        api: mockApi,
        shown: (v) => (v !== undefined && v !== null && v !== '' ? String(v) : '—'),
        cnTime: (v) => String(v || ''),
        size: (v) => String(v || 0) + ' B',
      };
    }
    if (name.startsWith('.')) {
      const base = path.resolve(path.dirname(filename), name);
      const resolved = ['.tsx', '.ts'].map((ext) => base + ext).find((f) => fs.existsSync(f));
      if (resolved) return loadComponent(resolved);
    }
    return nativeRequire(name);
  };

  const vmContext = {
    Error,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(
    `globalThis.Error = Error; (function(require, module, exports) { ${compiled}\n})`,
    vmContext
  )(customRequire, result, result.exports);
  moduleCache.set(filename, result.exports);
  return result.exports;
}

// Minimal React Hook Dispatcher Test Harness
function createHarness(Component, defaultProps) {
  let states = [];
  let stateIdx = 0;
  let effects = [];

  const dispatcher = {
    useState(initial) {
      const idx = stateIdx++;
      if (states.length <= idx) {
        states[idx] = typeof initial === 'function' ? initial() : initial;
      }
      const setState = (next) => {
        states[idx] = typeof next === 'function' ? next(states[idx]) : next;
      };
      return [states[idx], setState];
    },
    useMemo(fn) {
      return fn();
    },
    useCallback(fn) {
      return fn;
    },
    useEffect(fn) {
      effects.push(fn);
    },
    useRef(initial) {
      return { current: initial };
    },
    useId() {
      return ':test-id:';
    },
  };

  function render(props = defaultProps) {
    stateIdx = 0;
    activeDispatcher = dispatcher;
    try {
      return Component(props);
    } finally {
      activeDispatcher = null;
    }
  }

  return { render, getStates: () => states, runEffects: () => effects.forEach((fn) => fn()) };
}

function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;

  // Explicitly expand MapList if encountered; do NOT catch errors so component failures fail the test
  if (typeof node.type === 'function' && (node.type.name === 'MapList' || node.props?.data?.accounts)) {
    const rendered = node.type(node.props);
    const found = findElement(rendered, predicate);
    if (found) return found;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  }

  if (node.props) {
    if (node.props.children) {
      const found = findElement(node.props.children, predicate);
      if (found) return found;
    }
    if (node.props.footer) {
      const found = findElement(node.props.footer, predicate);
      if (found) return found;
    }
  }

  return null;
}

// ============================================================================
// Part 1: DataMap Tests
// ============================================================================
const { DataMap } = loadComponent('features/settings/data-map/DataMap.tsx');

async function runDataMapTests() {
  console.log('Testing DataMap handleConfirmDelete & dialog interaction boundaries:');
  const sampleData = {
    sources: [],
    integrations: [],
    accounts: [{ id: 'acc-1', name: '测试聚光主账户', externalId: 'ext-123', accountType: 'main' }],
    endpoints: [],
    metrics: [],
    bindings: [],
    assets: [],
    keystone: { configured: false, textModels: [], imageModels: [] },
  };

  // Case 1: Cancel sends 0 requests
  {
    apiCalls = [];
    let toasts = [];
    const harness = createHarness(DataMap, {
      projectId: 'p-dm',
      data: sampleData,
      reload: async () => {},
      toast: (msg, type) => toasts.push({ msg, type }),
    });

    // Switch to accounts tab to see the delete button
    let tree = harness.render();
    const accountsTabBtn = findElement(tree, (el) => el.type === 'button' && el.props?.children?.includes?.('账户'));
    assert(accountsTabBtn, 'Accounts tab button found');
    accountsTabBtn.props.onClick();

    // Re-render in accounts tab
    tree = harness.render();
    const deleteBtn = findElement(tree, (el) => el.type === 'button' && el.props?.children === '删除');
    assert(deleteBtn, 'Delete button found in accounts list');
    deleteBtn.props.onClick();

    // Now Dialog should be rendered
    tree = harness.render();
    const dialog = findElement(tree, (el) => el.type?.name === 'Dialog' || el.props?.title?.includes?.('测试聚光主账户'));
    assert(dialog, 'Delete Dialog is rendered with target account');

    // Click Cancel
    const cancelBtn = findElement(dialog.props.footer, (el) => el.type === 'button' && el.props?.children === '取消');
    assert(cancelBtn, 'Cancel button found in dialog footer');
    cancelBtn.props.onClick();

    // Assert zero API requests sent
    assert.equal(apiCalls.length, 0, '取消绝不发送网络请求');

    // Re-render: Dialog should be closed
    tree = harness.render();
    const closedDialog = findElement(tree, (el) => el.type?.name === 'Dialog' || el.props?.title?.includes?.('测试聚光主账户'));
    assert.equal(closedDialog, null, '点击取消后 Dialog 成功关闭');
    console.log('   ✓ Case 1 PASS: 取消 0 请求且成功关闭');
  }

  // Case 2: Confirm sends correct id and projectId
  {
    apiCalls = [];
    let toasts = [];
    const harness = createHarness(DataMap, {
      projectId: 'proj-feihe-target',
      data: sampleData,
      reload: async () => {},
      toast: (msg, type) => toasts.push({ msg, type }),
    });

    let tree = harness.render();
    const accountsTabBtn = findElement(tree, (el) => el.type === 'button' && el.props?.children?.includes?.('账户'));
    accountsTabBtn.props.onClick();

    tree = harness.render();
    const deleteBtn = findElement(tree, (el) => el.type === 'button' && el.props?.children === '删除');
    deleteBtn.props.onClick();

    tree = harness.render();
    const dialog = findElement(tree, (el) => el.props?.title?.includes?.('测试聚光主账户'));
    const confirmBtn = findElement(dialog.props.footer, (el) => el.type === 'button' && el.props?.children === '确认删除');

    await confirmBtn.props.onClick();

    assert.equal(apiCalls.length, 1, '确认删除触发 1 次 POST 请求');
    assert.equal(apiCalls[0].url, '/api/data-map');
    assert.equal(apiCalls[0].body.action, 'delete');
    assert.equal(apiCalls[0].body.projectId, 'proj-feihe-target');
    assert.equal(apiCalls[0].body.entity, 'account');
    assert.equal(apiCalls[0].body.id, 'acc-1');
    assert.equal(apiCalls[0].body.name, '测试聚光主账户');
    console.log('   ✓ Case 2 PASS: 确认发送正确 id 与 projectId');
  }

  // Case 3: Pending state prevents duplicate requests and prevents closing
  {
    apiCalls = [];
    let resolveApi;
    mockApiHandler = () => new Promise((res) => { resolveApi = res; });

    const harness = createHarness(DataMap, {
      projectId: 'p-dm',
      data: sampleData,
      reload: async () => {},
      toast: () => {},
    });

    let tree = harness.render();
    findElement(tree, (el) => el.type === 'button' && el.props?.children?.includes?.('账户')).props.onClick();
    tree = harness.render();
    findElement(tree, (el) => el.type === 'button' && el.props?.children === '删除').props.onClick();

    tree = harness.render();
    const dialog = findElement(tree, (el) => el.props?.title?.includes?.('测试聚光主账户'));
    const confirmBtn = findElement(dialog.props.footer, (el) => el.type === 'button' && el.props?.children === '确认删除');

    // Trigger delete (starts async request, keeps isDeleting = true)
    const promise = confirmBtn.props.onClick();

    // Re-render while deleting is active
    tree = harness.render();
    const pendingDialog = findElement(tree, (el) => el.props?.title?.includes?.('测试聚光主账户'));
    assert(pendingDialog, '正在删除时 Dialog 依然开启');

    const deletingConfirmBtn = findElement(pendingDialog.props.footer, (el) => el.type === 'button' && el.props?.children === '正在删除…');
    assert(deletingConfirmBtn, '按钮文案变为“正在删除…”');
    assert.equal(deletingConfirmBtn.props.disabled, true, '删除中按钮为 disabled');

    // Attempt duplicate confirm while pending
    await deletingConfirmBtn.props.onClick();
    assert.equal(apiCalls.length, 1, '删除中不可重复触发请求');

    // Attempt cancel while pending (busy protection)
    pendingDialog.props.onClose();
    tree = harness.render();
    assert(findElement(tree, (el) => el.props?.title?.includes?.('测试聚光主账户')), '删除中调用 onClose 具备忙状态保护，不关闭弹窗');

    // Resolve API
    resolveApi({ ok: true });
    await promise;

    // Restore default mock handler
    mockApiHandler = async () => ({ ok: true });
    console.log('   ✓ Case 3 PASS: pending 时防重复请求且阻止关闭');
  }

  // Case 4: Request failure retains pending selection and displays error
  {
    apiCalls = [];
    let toasts = [];
    mockApiHandler = async () => { throw new Error('数据库网络异常 (500)'); };

    const harness = createHarness(DataMap, {
      projectId: 'p-dm',
      data: sampleData,
      reload: async () => {},
      toast: (msg, type) => toasts.push({ msg, type }),
    });

    let tree = harness.render();
    findElement(tree, (el) => el.type === 'button' && el.props?.children?.includes?.('账户')).props.onClick();
    tree = harness.render();
    findElement(tree, (el) => el.type === 'button' && el.props?.children === '删除').props.onClick();

    tree = harness.render();
    const dialog = findElement(tree, (el) => el.props?.title?.includes?.('测试聚光主账户'));
    const confirmBtn = findElement(dialog.props.footer, (el) => el.type === 'button' && el.props?.children === '确认删除');

    await confirmBtn.props.onClick();

    // Error toast must be recorded
    assert(toasts.some((t) => t.type === 'error' && t.msg.includes('数据库网络异常')), '删除失败提示错误');

    // Dialog must STILL be open, retaining the user selection
    tree = harness.render();
    const retainedDialog = findElement(tree, (el) => el.props?.title?.includes?.('测试聚光主账户'));
    assert(retainedDialog, '失败绝不丢失待删项选择，允许用户重试');

    mockApiHandler = async () => ({ ok: true });
    console.log('   ✓ Case 4 PASS: 失败保留待删项与错误提示');
  }

  // Case 5: Success cleans up and closes dialog
  {
    apiCalls = [];
    let toasts = [];
    mockApiHandler = async () => ({ ok: true });

    const harness = createHarness(DataMap, {
      projectId: 'p-dm',
      data: sampleData,
      reload: async () => {},
      toast: (msg, type) => toasts.push({ msg, type }),
    });

    let tree = harness.render();
    findElement(tree, (el) => el.type === 'button' && el.props?.children?.includes?.('账户')).props.onClick();
    tree = harness.render();
    findElement(tree, (el) => el.type === 'button' && el.props?.children === '删除').props.onClick();

    tree = harness.render();
    const dialog = findElement(tree, (el) => el.props?.title?.includes?.('测试聚光主账户'));
    const confirmBtn = findElement(dialog.props.footer, (el) => el.type === 'button' && el.props?.children === '确认删除');

    await confirmBtn.props.onClick();

    assert(toasts.some((t) => t.type === 'success' && t.msg === '已删除'), '成功提示“已删除”');

    tree = harness.render();
    assert.equal(findElement(tree, (el) => el.props?.title?.includes?.('测试聚光主账户')), null, '成功后清理选择并关闭 Dialog');
    console.log('   ✓ Case 5 PASS: 成功清理并关闭 Dialog');
  }

  // Case 6: Reload failure boundary: does NOT falsely report delete failure
  {
    apiCalls = [];
    let toasts = [];
    mockApiHandler = async () => ({ ok: true });
    const faultyReload = async () => { throw new Error('拉取列表失败 (HTTP 502)'); };

    const harness = createHarness(DataMap, {
      projectId: 'p-dm',
      data: sampleData,
      reload: faultyReload,
      toast: (msg, type) => toasts.push({ msg, type }),
    });

    let tree = harness.render();
    findElement(tree, (el) => el.type === 'button' && el.props?.children?.includes?.('账户')).props.onClick();
    tree = harness.render();
    findElement(tree, (el) => el.type === 'button' && el.props?.children === '删除').props.onClick();

    tree = harness.render();
    const dialog = findElement(tree, (el) => el.props?.title?.includes?.('测试聚光主账户'));
    const confirmBtn = findElement(dialog.props.footer, (el) => el.type === 'button' && el.props?.children === '确认删除');

    await confirmBtn.props.onClick();

    // 1. Success toast must have fired
    assert(toasts.some((t) => t.type === 'success' && t.msg === '已删除'), '成功删除提示正常发出');

    // 2. Reload failure toast must be specific about refresh failure, NOT claiming deletion failed
    const reloadErrorToast = toasts.find((t) => t.type === 'error' && t.msg.includes('刷新列表失败'));
    assert(reloadErrorToast, '准确报告刷新列表失败：' + reloadErrorToast?.msg);
    assert(!toasts.some((t) => t.msg === '删除失败'), '绝不能谎报“删除失败”');

    // 3. Dialog MUST be closed (we do not allow re-deleting an already deleted item)
    tree = harness.render();
    assert.equal(findElement(tree, (el) => el.props?.title?.includes?.('测试聚光主账户')), null, '虽刷新失败，但删除已落库，Dialog 正常关闭防重删');
    console.log('   ✓ Case 6 PASS: 真实边界——成功删除后刷新失败不谎报删除失败且防重删');
  }
}

// ============================================================================
// Part 2: SettingsIntegrations Tests
// ============================================================================
const { SettingsIntegrations } = loadComponent('features/settings/integrations/SettingsIntegrations.tsx');

async function runIntegrationsTests() {
  console.log('\nTesting SettingsIntegrations delete dialog boundaries:');
  const sampleTools = {
    integrations: [
      { id: 'int-1', projectId: 'p-int', name: 'RedTrend 接口', provider: 'redtrend', enabled: true },
    ],
    credentialStatus: { redtrend: true, oss: false, feishu: false, keystone: false },
  };

  mockApiHandler = async (url) => {
    if (url === '/api/integrations') return sampleTools;
    return { ok: true };
  };

  // Case 1: Cancel sends 0 requests
  {
    apiCalls = [];
    let toasts = [];
    const harness = createHarness(SettingsIntegrations, {
      projectId: 'p-int',
      toast: (msg, type) => toasts.push({ msg, type }),
    });

    harness.render();
    harness.runEffects();
    await new Promise((r) => setTimeout(r, 20));
    let tree = harness.render();

    const deleteBtn = findElement(tree, (el) => el.type === 'button' && el.props?.children === '删除');
    assert(deleteBtn, 'Delete button found in integration card');
    deleteBtn.props.onClick();

    tree = harness.render();
    const dialog = findElement(tree, (el) => el.props?.title?.includes?.('RedTrend 接口'));
    assert(dialog, 'Delete Dialog rendered for integration');

    const cancelBtn = findElement(dialog.props.footer, (el) => el.type === 'button' && el.props?.children === '取消');
    cancelBtn.props.onClick();

    assert.equal(apiCalls.filter((c) => c.body?.action === 'delete').length, 0, '取消绝不发送删除请求');

    tree = harness.render();
    assert.equal(findElement(tree, (el) => el.props?.title?.includes?.('RedTrend 接口')), null, '取消后 Dialog 关闭');
    console.log('   ✓ Case 1 PASS: SettingsIntegrations 取消 0 请求');
  }

  // Case 2: Confirm sends correct id and projectId
  {
    apiCalls = [];
    let toasts = [];
    const harness = createHarness(SettingsIntegrations, {
      projectId: 'p-int',
      toast: (msg, type) => toasts.push({ msg, type }),
    });

    harness.render();
    harness.runEffects();
    await new Promise((r) => setTimeout(r, 20));
    let tree = harness.render();
    findElement(tree, (el) => el.type === 'button' && el.props?.children === '删除').props.onClick();

    tree = harness.render();
    const dialog = findElement(tree, (el) => el.props?.title?.includes?.('RedTrend 接口'));
    const confirmBtn = findElement(dialog.props.footer, (el) => el.type === 'button' && el.props?.children === '确认删除');

    await confirmBtn.props.onClick();

    const delCall = apiCalls.find((c) => c.body?.action === 'delete');
    assert(delCall, '触发删除请求');
    assert.equal(delCall.body.projectId, 'p-int');
    assert.equal(delCall.body.id, 'int-1');
    console.log('   ✓ Case 2 PASS: SettingsIntegrations 确认发送正确 id 与 projectId');
  }

  // Case 3: Reload failure boundary in SettingsIntegrations
  {
    apiCalls = [];
    let toasts = [];
    let callCount = 0;
    mockApiHandler = async (url, opts) => {
      if (opts?.body?.includes?.('"delete"')) {
        return { ok: true };
      }
      if (url === '/api/integrations') {
        callCount++;
        if (callCount > 1) {
          throw new Error('刷新接口列表失败 (500)');
        }
        return sampleTools;
      }
      return { ok: true };
    };

    const harness = createHarness(SettingsIntegrations, {
      projectId: 'p-int',
      toast: (msg, type) => toasts.push({ msg, type }),
    });

    harness.render();
    harness.runEffects();
    await new Promise((r) => setTimeout(r, 20));
    let tree = harness.render();
    findElement(tree, (el) => el.type === 'button' && el.props?.children === '删除').props.onClick();

    tree = harness.render();
    const dialog = findElement(tree, (el) => el.props?.title?.includes?.('RedTrend 接口'));
    const confirmBtn = findElement(dialog.props.footer, (el) => el.type === 'button' && el.props?.children === '确认删除');

    await confirmBtn.props.onClick();

    assert(toasts.some((t) => t.type === 'success' && t.msg === '工具集成已删除'), '删除成功提示正常发出');
    const reloadErr = toasts.find((t) => t.type === 'error' && t.msg.includes('刷新列表失败'));
    assert(reloadErr, '准确提示刷新列表失败：' + reloadErr?.msg);
    assert(!toasts.some((t) => t.msg === '删除失败'), '绝不谎报删除失败');

    tree = harness.render();
    assert.equal(findElement(tree, (el) => el.props?.title?.includes?.('RedTrend 接口')), null, '成功后 Dialog 关闭');
    console.log('   ✓ Case 3 PASS: SettingsIntegrations 刷新失败不谎报删除失败');
  }
}

async function main() {
  await runDataMapTests();
  await runIntegrationsTests();
  console.log('\nALL SETTINGS DELETE DIALOG & REAL BOUNDARY TESTS PASSED SUCCESSFULLY! 🎉\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
