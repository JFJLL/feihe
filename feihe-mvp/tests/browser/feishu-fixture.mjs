// Only the external Feishu service is simulated. Local APIs, SQL and calculations run normally.
export const sheetA = [['任务', '金额'], ['a', '10'], ['b', '20']];
export const sheetB = [['编号', '金额', '分组', '已确认', '业务日', '订单', '访问'],
  ['1', '10', '同组', '是', '2026-10-01T12:00:00+08:00', '0', '100'],
  ['2', '', '同组', '否', '2026-10-02T00:00:00+08:00', '10', '100'],
  ['3', '20', '另组', '是', '2026-10-01', '20', '100']];

const pageFixtures = new Map();
const focusedFixtures = new Map();
function focusedRows(documentToken) {
  if (focusedFixtures.has(documentToken)) return focusedFixtures.get(documentToken);
  if (documentToken === 'FocusedPercentDoc') return [
    ['档位', '比例文本', '均值百分比', '直接比例', '直接百分点'],
    ['零值', '0%', '0.5%', 0.005, 0.5],
    ['半个百分点', '0.5%', '1.5%', 0.015, 1.5],
    ['一个百分点', '1%', '', '', ''], ['一点一个百分点', '1.1%', '', '', ''],
    ['百分之百', '100%', '', '', ''], ['百分之一百五十', '150%', '', '', ''],
  ];
  if (documentToken === 'FocusedRatioDoc') return [['分组', '成交', '咨询'], ['互补', '10', ''], ['互补', '', '100']];
  if (documentToken === 'FocusedLateRequiredDoc') return [['任务', '金额'], ...Array.from({ length: 12 }, (_, i) => ['任务' + (i + 1), i === 11 ? '' : String(i + 1)])];
}

export async function handleFeishuFixture(input) {
    const url = new URL(typeof input === 'string' ? input : input instanceof Request ? input.url : input.href);

    const ok = data => Response.json({ code: 0, data });
    if (url.pathname.includes('/auth/')) return Response.json({ code: 0, tenant_access_token: 'fixture-tenant' });
    if (url.pathname.includes('/wiki/')) return ok({ node: { obj_type: 'sheet', obj_token: 'FixtureDoc' } });
    if (url.pathname.endsWith('/sheets/query')) {
      if (url.pathname.includes('SlowDoc')) await new Promise(resolve => setTimeout(resolve, 1200));
      const documentToken = url.pathname.split('/spreadsheets/')[1]?.split('/')[0];
      const pageCount = pageFixtures.get(documentToken);
      const focused = focusedRows(documentToken);
      if (focused) return ok({ sheets: [{ sheet_id: 'sheetA', title: '补修数据', grid_properties: { row_count: focused.length, column_count: focused[0].length } }] });
      return ok({ sheets: [
        { sheet_id: 'sheetA', title: '结构A', grid_properties: { row_count: pageCount !== undefined ? pageCount + 1 : 3, column_count: 2 } },
        { sheet_id: 'sheetB', title: '结构B', grid_properties: { row_count: 4, column_count: 7 } },
        { sheet_id: 'sheetBig', title: '完整5050行', grid_properties: { row_count: 5051, column_count: 2 } },
      ] });
    }
    if (url.pathname.includes('/values/')) {
      const range = decodeURIComponent(url.pathname.split('/values/')[1]);
      const sheetId = range.split('!')[0];
      const bounds = range.match(/![A-Z]+(\d+):[A-Z]+(\d+)/);
      const documentToken = url.pathname.split('/spreadsheets/')[1]?.split('/')[0];
      const pageCount = pageFixtures.get(documentToken);
      const all = focusedRows(documentToken) || (pageCount !== undefined && sheetId === 'sheetA' ? [['任务', '金额'], ...Array.from({ length: pageCount }, (_, i) => [pageCount === 1 ? '更新后唯一任务' : '分页任务' + (i + 1), pageCount === 1 ? '100' : String(i + 1)])] : sheetId === 'sheetB' ? sheetB : sheetId === 'sheetBig' ? [['编号', '金额'], ...Array.from({ length: 5050 }, (_, i) => [String(i + 1), '1'])] : sheetA);
      return ok({ valueRange: { values: bounds ? all.slice(Number(bounds[1]) - 1, Number(bounds[2])) : all } });
    }
    if (url.pathname.endsWith('/tables')) return ok({ items: [{ table_id: 'table1', name: '多维表' }], has_more: false });
    if (url.pathname.endsWith('/fields')) return ok({ items: ['id', 'numerator', 'denominator'].map((name, i) => ({ field_id: 'field' + i, field_name: name, type: 2 })), has_more: false });
    if (url.pathname.includes('/records')) {
      if (url.pathname.includes('IncompleteDoc')) return ok({ items: [{ fields: { amount: 999 } }], has_more: true });
      const token = url.searchParams.get('page_token');
      const size = Number(url.searchParams.get('page_size') || 100);
      const start = Number(token || 0), total = 501;
      return ok({ items: Array.from({ length: Math.min(size, total - start) }, (_, i) => ({ fields: { id: start + i + 1, numerator: start + i === 500 ? 100 : 0, denominator: start + i === 500 ? 100 : 1 } })), has_more: start + size < total, page_token: start + size < total ? String(start + size) : undefined });
    }
    throw new Error('Unimplemented external fixture: ' + url.pathname);
}

export async function startFeishuFixture() {
  process.env.FEISHU_APP_ID = 'fixture-app';
  process.env.FEISHU_APP_SECRET = 'fixture-secret';
  process.env.KEYSTONE_API_KEY = 'fixture-disabled';
  const { createServer } = await import('node:http');
  const fixtureServer = createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url === '/__fixture/focused-rows') {
        let body = ''; for await (const chunk of req) body += chunk;
        const data = JSON.parse(body); focusedFixtures.set(String(data.documentToken), data.rows);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return;
      }
      if (req.method === 'POST' && req.url === '/__fixture/page-sheet') {
        let body = ''; for await (const chunk of req) body += chunk;
        const data = JSON.parse(body);
        pageFixtures.set(String(data.documentToken), Number(data.rowCount));
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return;
      }
      const response = await handleFeishuFixture('http://127.0.0.1:5187' + req.url);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch (error) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 502, msg: error.message }));
    }
  });
  await new Promise((resolve, reject) => {
    fixtureServer.once('error', reject);
    fixtureServer.listen(Number(new URL(process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5187').port), '127.0.0.1', resolve);
  });
  return fixtureServer;
}
