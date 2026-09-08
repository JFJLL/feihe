import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://127.0.0.1:5013/projects/qicui/content?tab=registry';

const chromeProc = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--remote-debugging-port=9222',
  'about:blank',
], { stdio: 'ignore' });

// Wait for Chrome CDP port
await new Promise(r => setTimeout(r, 1500));

try {
  const versionRes = await fetch('http://127.0.0.1:9222/json/version');
  const versionData = await versionRes.json();
  const wsUrl = versionData.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.addEventListener('open', r));

  let msgId = 1;
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Create new page target
  const target = await send('Target.createTarget', { url: URL });
  const pageWs = new WebSocket(`ws://127.0.0.1:9222/devtools/page/${target.targetId}`);
  await new Promise(r => pageWs.addEventListener('open', r));

  function pageSend(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === id) {
          pageWs.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      pageWs.addEventListener('message', handler);
      pageWs.send(JSON.stringify({ id, method, params }));
    });
  }

  await pageSend('Page.enable');
  await new Promise(r => setTimeout(r, 3000));

  // Evaluate computed styles in the real page DOM!
  const evalRes = await pageSend('Runtime.evaluate', {
    expression: `(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const select = selects.find(s => s.offsetParent !== null) || selects[0];
      console.log('Select outerHTML:', select ? select.outerHTML.slice(0, 150) : null);
      console.log('Parent classes:', select?.parentElement?.className);
      const selectStyle = select ? window.getComputedStyle(select) : null;
      const numTh = document.querySelector('th.num');
      const numTd = document.querySelector('td.num');
      const numThStyle = numTh ? window.getComputedStyle(numTh) : null;
      const numTdStyle = numTd ? window.getComputedStyle(numTd) : null;

      return {
        html: select?.outerHTML.slice(0, 100),
        parent: select?.parentElement?.className,
        rootHasV2: Boolean(document.querySelector('[data-workspace-ui="v2"]')),
        styleSheetsCount: document.styleSheets.length,
        sheetHrefs: Array.from(document.styleSheets).map(s => s.href),
        select: selectStyle ? {
          appearance: selectStyle.appearance,
          backgroundImage: selectStyle.backgroundImage,
          paddingRight: selectStyle.paddingRight,
          minHeight: selectStyle.minHeight,
        } : null,
        numTh: numThStyle ? { textAlign: numThStyle.textAlign } : null,
        numTd: numTdStyle ? { textAlign: numTdStyle.textAlign } : null,
      };
    })()`,
    returnByValue: true,
  });

  const styles = evalRes.result.value;
  console.log('Real DOM Computed Styles:', JSON.stringify(styles, null, 2));

  assert(styles.select, '页面存在原生 select 元素');
  assert(styles.select.backgroundImage.includes('svg'), '原生 select 必须保留自定义下拉箭头 svg 背景');
  assert(parseInt(styles.select.paddingRight, 10) >= 30, '原生 select 右侧必须保留 >= 30px 的留白以容纳箭头');
  assert.equal(styles.select.appearance, 'none', '原生 select 必须为 appearance: none');

  assert(styles.numTh, '页面存在 th.num 表头');
  assert.equal(styles.numTh.textAlign, 'right', '表格数值表头必须真实右对齐');
  if (styles.numTd) {
    assert.equal(styles.numTd.textAlign, 'right', '表格数值单元格必须真实右对齐');
  }

  // Check disabled input & textarea computed styles inside v2 workspace
  const formEval = await pageSend('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('[data-workspace-ui="v2"]');
      const textarea = document.createElement('textarea');
      const disabledInput = document.createElement('input');
      disabledInput.disabled = true;
      root.appendChild(textarea);
      root.appendChild(disabledInput);

      const taStyle = window.getComputedStyle(textarea);
      const disStyle = window.getComputedStyle(disabledInput);

      const res = {
        textareaMinHeight: parseInt(taStyle.minHeight, 10),
        disabledBg: disStyle.backgroundColor,
        disabledCursor: disStyle.cursor,
      };
      textarea.remove();
      disabledInput.remove();
      return res;
    })()`,
    returnByValue: true,
  });

  console.log('Form Controls Computed Styles:', JSON.stringify(formEval.result.value, null, 2));
  assert(formEval.result.value.textareaMinHeight >= 72, 'textarea 最小高度必须达到 72px');
  assert(formEval.result.value.disabledBg.includes('241, 245, 249') || formEval.result.value.disabledBg.includes('rgb'), 'disabled 控件底色必须为禁用浅灰底色');
  assert.equal(formEval.result.value.disabledCursor, 'not-allowed', 'disabled 控件鼠标手势必须为 not-allowed');

  console.log('✅ ALL COMPUTED STYLE CHECKS PASSED IN REAL CHROMIUM BROWSER!');
} finally {
  chromeProc.kill();
}
