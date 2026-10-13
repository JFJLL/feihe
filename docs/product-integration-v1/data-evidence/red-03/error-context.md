# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-data.spec.ts >> 数据工作台 390px：四列原表经真实接入、明细、字段和同步记录贯通
- Location: tests\browser\product-data.spec.ts:15:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '数据工作台', exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: '数据工作台', exact: true }) with timeout 10000ms
  - waiting for getByRole('heading', { name: '数据工作台', exact: true })

```

```yaml
- complementary "项目主要导航":
  - link "返回项目中心":
    - /url: /
    - text: ← 项目中心
  - text: 项目工作台
  - combobox "切换项目":
    - text: 陌生部门数据工作台1791890976274
    - img
  - navigation "项目模块":
    - link "项目总览":
      - /url: /projects/1791890976274
    - link "数据管理":
      - /url: /projects/1791890976274/settings?tab=data-sources
    - link "项目设置":
      - /url: /projects/1791890976274/settings
- main:
  - heading "项目设置" [level=1]
  - text: 11 个识别词 · 0 条主线
  - paragraph: 集中管理当前项目的低频配置、目标规则、数据源与数据地图。
  - tablist "模块切换":
    - tab "项目资料"
    - tab "成员与权限"
    - tab "数据源" [selected]
    - tab "工具集成"
    - tab "数据地图"
  - tabpanel "数据源":
    - region "项目数据源同步概况":
      - article: 已配置数据源 0 个 当前项目手动登记的数据源，不含内置工作表
      - article: 有同步记录 0 个 尚无同步记录
      - article: 需处理的数据源 0 个 按最近错误记录统计；详情见下方数据源列表
      - article: 最近读取行数合计 — 行 各源最近一次读取量相加，未经跨表去重；无记录显示 —
    - article:
      - text: CONNECTED SOURCES
      - heading "陌生部门数据工作台1791890976274的数据源" [level=2]
      - paragraph: 支持飞书电子表格、多维表格与通用任务表接入；支持可视化字段映射与落库校验。
      - text: 共 0 个配置
      - button "＋ 接入飞书数据源"
      - text: ∅
      - heading "当前项目尚未配置数据源" [level=3]
      - paragraph: 点击上方「接入飞书数据源」开始绑定飞书表格或多维表格。
- button "打开智能助手": 智
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import type { APIRequestContext, Page } from '@playwright/test';
  3  | 
  4  | const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
  5  | const identity = { 'x-user-id': 'user-editor' };
  6  | async function create(request: APIRequestContext, name: string) {
  7  |   const response = await request.post('/api/projects', { headers: identity, data: { action: 'create', name: name + Date.now(), templateId: 'general_workbench' } });
  8  |   expect(response.status()).toBe(200); return (await response.json()).id as string;
  9  | }
  10 | async function choose(page: Page, label: string, option: string) {
  11 |   await page.getByRole('combobox', { name: label, exact: true }).click();
  12 |   await page.getByRole('option', { name: option, exact: true }).click();
  13 | }
  14 | for (const width of [1280, 390]) {
  15 |   test(`数据工作台 ${width}px：四列原表经真实接入、明细、字段和同步记录贯通`, async ({ page, request }, info) => {
  16 |     await page.setViewportSize({ width, height: 900 });
  17 |     await page.context().setExtraHTTPHeaders(identity);
  18 |     const projectId = await create(request, '陌生部门数据工作台'), token = 'ProductData-' + projectId;
  19 |     const raw = [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '门店', 100, 20], ['2026-10-02', '线上', 100, 10], ['2026-10-03', '门店', 50, 5]];
  20 |     expect((await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: raw } })).ok()).toBeTruthy();
  21 |     await page.goto('/projects/' + projectId + '/data');
> 22 |     await expect(page.getByRole('heading', { name: '数据工作台', exact: true })).toBeVisible();
     |                                                                             ^ Error: expect(locator).toBeVisible() failed
  23 |     await expect(page.getByRole('link', { name: '数据管理', exact: true })).toHaveAttribute('aria-current', 'page');
  24 |     await page.getByRole('button', { name: /接入飞书数据源/ }).click();
  25 |     await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill('https://fixture.feishu.cn/sheets/' + token);
  26 |     await page.getByRole('button', { name: '智能检测工作表 ↗' }).click();
  27 |     await expect(page.getByRole('combobox', { name: '目标工作表', exact: true })).toContainText('补修数据');
  28 |     const sync = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  29 |     await page.getByRole('button', { name: '✓ 保存并首次同步', exact: true }).click();
  30 |     expect((await sync).status()).toBe(200);
  31 |     await expect(page.getByRole('dialog')).toHaveCount(0);
  32 |     await page.getByRole('tab', { name: '数据集', exact: true }).click();
  33 |     await expect(page.getByRole('heading', { name: '数据集明细', exact: true })).toBeVisible();
  34 |     const table = page.getByRole('table', { name: '业务数据明细', exact: true });
  35 |     await expect(table.getByRole('columnheader')).toHaveText(['日期', '渠道', '咨询人数', '成交人数']);
  36 |     await expect(table.getByRole('row')).toHaveCount(4);
  37 |     await expect(table.getByRole('cell', { name: '20', exact: true })).toBeVisible();
  38 |     await page.getByRole('button', { name: '字段与质量检查', exact: true }).click();
  39 |     await expect(page.getByRole('table', { name: '字段质量', exact: true })).toContainText('咨询人数');
  40 |     await expect(page.getByText('已检查完整数据集 3 行', { exact: true })).toBeVisible();
  41 |     await expect(page.getByText('自动同步未启用；当前需手动同步', { exact: true })).toBeVisible();
  42 |     await page.screenshot({ path: info.outputPath('data-fields-and-rows.png') });
  43 |     await page.getByRole('tab', { name: '同步记录', exact: true }).click();
  44 |     await expect(page.getByRole('table', { name: '来源同步记录', exact: true })).toContainText('成功');
  45 |     await expect(page.getByRole('table', { name: '来源同步记录', exact: true })).toContainText('3');
  46 |     await page.reload();
  47 |     await expect(page.getByRole('tab', { name: '同步记录', exact: true })).toHaveAttribute('aria-selected', 'true');
  48 |     expect(page.url()).toContain('/data?tab=runs');
  49 |     const state = await (await request.get('/api/data-workspace?projectId=' + projectId, { headers: identity })).json();
  50 |     expect(state.sources).toHaveLength(1); expect(state.datasets).toHaveLength(1);
  51 |     expect(state.datasets[0].columns.map((c: { key: string }) => c.key)).toEqual(raw[0]);
  52 |     expect(state.runs[0]).toMatchObject({ status: 'success', rowsRead: 3, rowsImported: 3 });
  53 |     expect(state.sources[0].datasetIds).toEqual([state.datasets[0].id]);
  54 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  55 |   });
  56 |   test(`数据工作台 ${width}px：只读明细、分页搜索、项目隔离和来源权限`, async ({ page, request }) => {
  57 |     await page.setViewportSize({ width, height: 900 });
  58 |     const projectId = await create(request, '只读数据明细'), token = 'DataPage-' + projectId;
  59 |     const rows = [['日期', '渠道', '咨询人数', '成交人数'], ...Array.from({ length: 31 }, (_, i) => ['2026-10-01', '渠道' + (i + 1), 100 + i, i + 1])];
  60 |     await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows } });
  61 |     const saved = await request.post('/api/projects', { headers: identity, data: { action: 'save_source', projectId, name: '明细来源', spreadsheet: 'https://fixture.feishu.cn/sheets/' + token, sheetId: 'sheetA', kind: 'general', type: 'feishu_sheet' } });
  62 |     const sourceId = (await saved.json()).id; expect(sourceId).toBeTruthy();
  63 |     expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId } })).status()).toBe(200);
  64 |     expect((await request.post('/api/projects', { headers: identity, data: { action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' } })).status()).toBe(200);
  65 |     await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' });
  66 |     await page.goto('/projects/' + projectId + '/data?tab=datasets');
  67 |     await expect(page.getByRole('heading', { name: '数据集明细', exact: true })).toBeVisible();
  68 |     await expect(page.getByRole('table', { name: '业务数据明细', exact: true }).getByRole('row')).toHaveCount(16);
  69 |     await page.getByRole('button', { name: '下一页', exact: true }).click();
  70 |     await expect(page.getByRole('table', { name: '业务数据明细', exact: true })).toContainText('渠道16');
  71 |     await page.getByRole('textbox', { name: '搜索数据明细', exact: true }).fill('渠道31');
  72 |     await expect(page.getByRole('table', { name: '业务数据明细', exact: true }).getByRole('row')).toHaveCount(2);
  73 |     await expect(page.getByRole('table', { name: '业务数据明细', exact: true })).toContainText('130');
  74 |     await page.getByRole('tab', { name: '数据源', exact: true }).click();
  75 |     await expect(page.getByRole('table', { name: '来源与使用关系', exact: true })).toContainText('明细来源');
  76 |     await expect(page.getByRole('button', { name: /接入飞书数据源|立即同步|编辑\/映射/ })).toHaveCount(0);
  77 |     expect((await request.get('/api/data-workspace?projectId=' + projectId, { headers: { 'x-user-id': 'user-no-access' } })).status()).toBe(403);
  78 |     expect((await request.post('/api/feishu/sync', { headers: { 'x-user-id': 'user-viewer' }, data: { projectId, sourceId } })).status()).toBe(403);
  79 |     await choose(page, '数据源视图', '全部来源');
  80 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  81 |   });
  82 | }
  83 | 
```