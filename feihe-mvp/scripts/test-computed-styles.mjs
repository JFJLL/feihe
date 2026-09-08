import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = process.env.TEST_PORT || '5013';
const CDP_PORT = process.env.CDP_PORT || '9333';
const URL = `http://127.0.0.1:${PORT}/projects/qicui/content?tab=registry`;
const tmpDir = path.join(os.tmpdir(), 'chrome-test-profile-' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

const chromeProc = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${tmpDir}`,
  '--window-size=1440,900',
  'about:blank',
], { stdio: 'ignore' });

let ws = null;
let pageWs = null;
try {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) break;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }

  const versionRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
  const versionData = await versionRes.json();
  const wsUrl = versionData.webSocketDebuggerUrl;

  ws = new WebSocket(wsUrl);
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
  pageWs = new WebSocket(`ws://127.0.0.1:${CDP_PORT}/devtools/page/${target.targetId}`);
  await new Promise(r => pageWs.addEventListener('open', r));

  pageWs.addEventListener('message', (event) => {
    const d = JSON.parse(event.data);
    if (d.method === 'Runtime.consoleAPICalled') {
      console.log('BROWSER CONSOLE:', ...d.params.args.map(a => a.value || a.description));
    } else if (d.method === 'Runtime.exceptionThrown') {
      console.error('BROWSER ERROR:', d.params.exceptionDetails);
    }
  });

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
  await pageSend('Runtime.enable');
  await pageSend('Network.enable');

  pageWs.addEventListener('message', (event) => {
    const d = JSON.parse(event.data);
  });

  await new Promise(r => setTimeout(r, 2500));

  // Evaluate computed styles in the real page DOM after waiting for data rows
  const evalRes = await pageSend('Runtime.evaluate', {
    awaitPromise: true,
    expression: `(async () => {
      for (let i = 0; i < 40; i++) {
        if (document.querySelector('td.num')) break;
        await new Promise(r => setTimeout(r, 100));
      }

      const selects = Array.from(document.querySelectorAll('select'));
      const select = selects.find(s => s.offsetParent !== null) || selects[0];
      const selectStyle = select ? window.getComputedStyle(select) : null;
      const numTh = document.querySelector('th.num');
      const numThStyle = numTh ? window.getComputedStyle(numTh) : null;
      const v2Root = document.querySelector('[data-workspace-ui="v2"]');
      const tables = Array.from(document.querySelectorAll('table'));
      const registryTable = tables.find(t => t.querySelector('th.num')) || tables[1] || tables[0];
      const numTd = registryTable ? registryTable.querySelector('td.num') : document.querySelector('td.num');
      const numTdStyle = numTd ? window.getComputedStyle(numTd) : null;

      return {
        tablesCount: tables.length,
        tableHeaders: tables.map(t => Array.from(t.querySelectorAll('th')).map(th => th.textContent)),
        table2Body: tables[1] ? tables[1].querySelector('tbody')?.outerHTML.slice(0, 300) : 'NO TABLE 2',
        html: select?.outerHTML.slice(0, 100),
        parent: select?.parentElement?.className,
        rootHasV2: Boolean(v2Root),
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
  assert.ok(styles.rootHasV2, '目标页面必须具备 v2 工作区属性 [data-workspace-ui="v2"]');
  assert(styles.select, '页面存在原生 select 元素');
  assert(styles.select.backgroundImage.includes('svg'), '原生 select 必须保留自定义下拉箭头 svg 背景');
  assert(parseInt(styles.select.paddingRight, 10) >= 30, '原生 select 右侧必须保留 >= 30px 的留白以容纳箭头');
  assert.equal(styles.select.appearance, 'none', '原生 select 必须为 appearance: none');

  assert(styles.numTh, '页面存在 th.num 表头');
  assert.equal(styles.numTh.textAlign, 'right', '表格数值表头必须真实右对齐');
  assert(styles.numTd, '页面必须渲染出真实的数值单元格 td.num');
  assert.equal(styles.numTd.textAlign, 'right', '表格数值单元格必须真实右对齐');

  // Check disabled & readonly inputs and textarea computed styles inside real v2 workspace
  const formEval = await pageSend('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('[data-workspace-ui="v2"]');
      const textarea = document.createElement('textarea');
      const disabledInput = document.createElement('input');
      disabledInput.disabled = true;
      const readonlyInput = document.createElement('input');
      readonlyInput.readOnly = true;

      root.appendChild(textarea);
      root.appendChild(disabledInput);
      root.appendChild(readonlyInput);

      const taStyle = window.getComputedStyle(textarea);
      const disStyle = window.getComputedStyle(disabledInput);
      const roStyle = window.getComputedStyle(readonlyInput);

      const res = {
        textareaMinHeight: parseInt(taStyle.minHeight, 10),
        disabledBg: disStyle.backgroundColor,
        disabledCursor: disStyle.cursor,
        readonlyBg: roStyle.backgroundColor,
        readonlyCursor: roStyle.cursor,
      };
      textarea.remove();
      disabledInput.remove();
      readonlyInput.remove();
      return res;
    })()`,
    returnByValue: true,
  });

  const formStyles = formEval.result.value;
  assert(formStyles.textareaMinHeight >= 72, 'textarea 最小高度必须达到 72px');
  assert.equal(formStyles.disabledBg, 'rgb(248, 250, 252)', 'disabled 控件底色必须严格为浅灰底色 rgb(248, 250, 252)');
  assert.equal(formStyles.readonlyBg, 'rgb(248, 250, 252)', 'readonly 控件底色必须严格为浅灰底色 rgb(248, 250, 252)');
  assert.equal(formStyles.disabledCursor, 'not-allowed', 'disabled 控件鼠标手势必须为 not-allowed');
  assert.equal(formStyles.readonlyCursor, 'not-allowed', 'readonly 控件鼠标手势必须为 not-allowed');

  console.log('PASS computed styles (Chromium CDP): native select appearance/arrow/padding, th.num/td.num right alignment, textarea 72px, disabled/readonly soft gray bg & cursor');
} finally {
  try { pageWs?.close(); } catch {}
  try { ws?.close(); } catch {}
  chromeProc.kill();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}
