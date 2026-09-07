import assert from 'node:assert/strict';

class MockElement {
  constructor() {
    this.listeners = {};
    this.dataset = {};
    this.src = '';
    this.onload = null;
    this.onerror = null;
  }
  addEventListener(ev, fn) {
    this.listeners[ev] = this.listeners[ev] || [];
    this.listeners[ev].push(fn);
  }
  trigger(ev) {
    if (this['on' + ev]) this['on' + ev]();
    for (const fn of (this.listeners[ev] || [])) fn();
  }
  remove() {
    if (this.parent) {
      const idx = this.parent.children.indexOf(this);
      if (idx !== -1) this.parent.children.splice(idx, 1);
    }
  }
}

let elements = [];

function setupMockDom() {
  elements = [];
  delete globalThis.window;
  delete globalThis.document;

  globalThis.window = {};
  globalThis.document = {
    querySelector(sel) {
      return elements.find(el => el.dataset.xlsxLoader === 'true') || null;
    },
    createElement(tag) {
      const el = new MockElement();
      el.tagName = tag;
      return el;
    },
    head: {
      children: elements,
      appendChild(el) {
        el.parent = this;
        elements.push(el);
        return el;
      }
    }
  };
}

const validXLSX = {
  read(buf) { return { SheetNames: ['Sheet1'], Sheets: {} }; },
  utils: {
    sheet_to_json(sheet, opts) { return []; }
  }
};

async function runTests() {
  console.log('=== RUNNING FULL XLSX LOADER SUITE ===');

  // Test H: SSR 调用
  console.log('Test H: SSR environment (window/document undefined)');
  delete globalThis.window;
  delete globalThis.document;
  const { loadXLSX, isValidXLSX } = await import('../lib/xlsx-loader.ts');
  await assert.rejects(async () => {
    await loadXLSX();
  }, /XLSX 只能在客户端环境中加载/);
  console.log('PASS: Test H (SSR calls cleanly reject without uncaught exceptions)');

  // Test A: 并发成功
  console.log('Test A: Concurrent calls share loading process and insert only 1 script');
  setupMockDom();
  const pA1 = loadXLSX();
  const pA2 = loadXLSX();
  const pA3 = loadXLSX();
  assert.equal(elements.length, 1, 'Only 1 script element inserted for 3 concurrent calls');
  const scriptA = elements[0];
  window.XLSX = validXLSX;
  scriptA.trigger('load');
  const [resA1, resA2, resA3] = await Promise.all([pA1, pA2, pA3]);
  assert.equal(resA1, validXLSX);
  assert.equal(resA2, validXLSX);
  assert.equal(resA3, validXLSX);
  console.log('PASS: Test A (Concurrent calls share single loading promise)');

  // Test B: 成功后重复调用
  console.log('Test B: Repeated call after success directly reuses valid object');
  const elementsBeforeB = elements.length;
  const resB = await loadXLSX();
  assert.equal(resB, validXLSX);
  assert.equal(elements.length, elementsBeforeB, 'No new script inserted');
  console.log('PASS: Test B (Repeated call directly reuses existing valid object)');

  // Test C: 网络错误后重试
  console.log('Test C: Network error cleans up script and permits retry');
  setupMockDom();
  const pC1 = loadXLSX();
  assert.equal(elements.length, 1);
  const scriptC1 = elements[0];
  scriptC1.trigger('error');
  await assert.rejects(pC1, /Excel 解析库加载失败/);
  assert.equal(elements.length, 0, 'Failed script node removed from DOM');

  // Retry after error
  const pC2 = loadXLSX();
  assert.equal(elements.length, 1, 'New script node created on retry');
  const scriptC2 = elements[0];
  assert.notEqual(scriptC1, scriptC2, 'New script is a fresh element');
  window.XLSX = validXLSX;
  scriptC2.trigger('load');
  const resC2 = await pC2;
  assert.equal(resC2, validXLSX);
  console.log('PASS: Test C (Network error cleans up and retry succeeds)');

  // Test D: load 已触发但没有导出 XLSX
  console.log('Test D: Script loads but window.XLSX is missing');
  setupMockDom();
  const pD1 = loadXLSX();
  assert.equal(elements.length, 1);
  const scriptD1 = elements[0];
  scriptD1.trigger('load');
  await assert.rejects(pD1, /Excel 解析库加载完成但未导出有效的 XLSX 对象/);
  assert.equal(elements.length, 0, 'Failed script node removed from DOM');

  // Retry creates a fresh script and succeeds when XLSX is exported
  const pD2 = loadXLSX();
  assert.equal(elements.length, 1, 'Fresh script inserted');
  const scriptD2 = elements[0];
  assert.notEqual(scriptD1, scriptD2);
  window.XLSX = validXLSX;
  scriptD2.trigger('load');
  const resD2 = await pD2;
  assert.equal(resD2, validXLSX);
  console.log('PASS: Test D (Missing XLSX rejects, removes node, and retry succeeds without hanging)');

  // Test E: XLSX={} 或缺少必要方法
  console.log('Test E: window.XLSX={} or incomplete object rejected and recoverable');
  setupMockDom();
  window.XLSX = {};
  const pE1 = loadXLSX();
  const scriptE1 = elements[0];
  scriptE1.trigger('load');
  await assert.rejects(pE1, /Excel 解析库加载完成但未导出有效的 XLSX 对象/);
  assert.equal(elements.length, 0);

  // Partial object with only read
  window.XLSX = { read() {} };
  const pE2 = loadXLSX();
  const scriptE2 = elements[0];
  scriptE2.trigger('load');
  await assert.rejects(pE2, /Excel 解析库加载完成但未导出有效的 XLSX 对象/);

  // Valid recovery
  window.XLSX = validXLSX;
  const pE3 = loadXLSX();
  assert.equal(await pE3, validXLSX);
  console.log('PASS: Test E (Invalid or incomplete XLSX object rejected and recovery works)');

  // Test F: 没有 load/error 到达超时
  console.log('Test F: Timeout triggers error, cleans up node, and allows retry');
  setupMockDom();
  const pF1 = loadXLSX(50); // 50ms test timeout
  assert.equal(elements.length, 1);
  await assert.rejects(pF1, /Excel 解析库加载超时/);
  assert.equal(elements.length, 0, 'Timed out script node removed from DOM');

  // Retry after timeout succeeds
  const pF2 = loadXLSX(50);
  assert.equal(elements.length, 1);
  window.XLSX = validXLSX;
  elements[0].trigger('load');
  assert.equal(await pF2, validXLSX);
  console.log('PASS: Test F (Timeout cleans up state and permits subsequent retry)');

  // Test G: 旧任务超时后再收到迟到事件，不得破坏新任务
  console.log('Test G: Late load/error event on timed-out task does not affect new task');
  setupMockDom();
  const pG1 = loadXLSX(30);
  const scriptG1 = elements[0];
  await assert.rejects(pG1, /Excel 解析库加载超时/);

  // Start new task
  const pG2 = loadXLSX(1000);
  const scriptG2 = elements[0];
  assert.notEqual(scriptG1, scriptG2);

  // Late error and late load on old scriptG1
  scriptG1.trigger('error');
  scriptG1.trigger('load');

  // New task should proceed undisturbed
  window.XLSX = validXLSX;
  scriptG2.trigger('load');
  assert.equal(await pG2, validXLSX);
  console.log('PASS: Test G (Late events on expired task do not disturb new task)');

  console.log('\nALL 8 REGRESSION TESTS PASSED (A through H)!');
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
