# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-board.spec.ts >> 明细分页 390px：实际同步改变总页数后重读同口径指标与明细
- Location: tests\browser\product-board.spec.ts:33:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('article', { name: '分页可核对', exact: true })
Expected substring: "2.0%"
Received string:    "分页可核对1.0%日期渠道咨询人数成交人数2026-10-01门店1002共 1 条符合条件记录 · 第 1 / 1 页明细上一页明细下一页来源: 仅四列业务表指标 v1 · 跟随最新 · 数据 v2成对口径 · 成对有效 31 行 · 分子有效 31/31（100.0%） · 分母有效 31/31（100.0%）项目周期：不限开始 ～ 不限结束 · Asia/Shanghai"
Timeout: 10000ms

Call log:
  - Expect "toContainText" getByRole('article', { name: '分页可核对', exact: true }) with timeout 10000ms
  - waiting for getByRole('article', { name: '分页可核对', exact: true })
    23 × locator resolved to <div role="article" aria-label="分页可核对" class="shared-metric-card shared-metric-wide">…</div>
       - unexpected value "分页可核对1.0%日期渠道咨询人数成交人数2026-10-01门店1002共 1 条符合条件记录 · 第 1 / 1 页明细上一页明细下一页来源: 仅四列业务表指标 v1 · 跟随最新 · 数据 v2成对口径 · 成对有效 31 行 · 分子有效 31/31（100.0%） · 分母有效 31/31（100.0%）项目周期：不限开始 ～ 不限结束 · Asia/Shanghai"

```

```yaml
- article "分页可核对":
  - text: 分页可核对 1.0%
  - table "分页可核对明细":
    - rowgroup:
      - row "日期 渠道 咨询人数 成交人数":
        - columnheader "日期"
        - columnheader "渠道"
        - columnheader "咨询人数"
        - columnheader "成交人数"
    - rowgroup:
      - row "2026-10-01 门店 100 2":
        - cell "2026-10-01"
        - cell "门店"
        - cell "100"
        - cell "2"
  - paragraph: 共 1 条符合条件记录 · 第 1 / 1 页
  - button "明细上一页" [disabled]
  - button "明细下一页" [disabled]
  - text: "来源: 仅四列业务表 指标 v1 · 跟随最新 · 数据 v2 成对口径 · 成对有效 31 行 · 分子有效 31/31（100.0%） · 分母有效 31/31（100.0%） 项目周期：不限开始 ～ 不限结束 · Asia/Shanghai"
```

# Test source

```ts
  1   | import { test, expect } from './evidence';
  2   | import type { Page, APIRequestContext } from '@playwright/test';
  3   | 
  4   | const identity = { 'x-user-id': 'user-editor' };
  5   | const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
  6   | async function choose(page: Page, label: string, option: string) {
  7   |   await page.getByRole('combobox', { name: label, exact: true }).click();
  8   |   await page.getByRole('option', { name: option, exact: true }).click();
  9   | }
  10  | async function fixture(request: APIRequestContext) {
  11  |   const created = await request.post('/api/projects', { headers: identity, data: { action: 'create', name: '共同周期与五类呈现' + Date.now(), templateId: 'general_workbench' } });
  12  |   expect(created.status()).toBe(200); const projectId = (await created.json()).id;
  13  |   const token = 'BoardViews-' + projectId;
  14  |   await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [
  15  |     ['日期', '渠道', '咨询人数', '成交人数'],
  16  |     ['2026-10-01 12:00:00', '门店', 100, 20],
  17  |     ['2026-10-01 23:59:59', '线上', 100, 10],
  18  |     ['2026-10-02 00:00:00', '门店', 100, 50],
  19  |     ['', '门店', 100, 90],
  20  |   ] } });
  21  |   const source = await request.post('/api/projects', { headers: identity, data: { action: 'save_source', projectId, name: '仅四列业务表', type: 'feishu_sheet', kind: 'general', spreadsheet: 'https://fixture.feishu.cn/sheets/' + token, sheetId: 'sheetA', mappingJson: '[]' } });
  22  |   expect(source.status()).toBe(200);
  23  |   expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId: (await source.json()).id } })).status()).toBe(200);
  24  |   const state = await (await request.get('/api/datasets?projectId=' + projectId, { headers: identity })).json();
  25  |   const dataset = state.datasets[0]; expect(dataset.columns.find((c: { key: string }) => c.key === '日期').type).toBe('date');
  26  |   const config = { datasetId: dataset.id, aggregation: 'ratio', numField: '成交人数', denField: '咨询人数', dateField: '日期', missingPolicy: 'skip', ratioBasis: 'paired', format: 'percent', unit: '%' };
  27  |   const saved = await request.post('/api/metric-definitions', { headers: identity, data: { action: 'save', projectId, name: '成交率', config } });
  28  |   expect(saved.status()).toBe(200);
  29  |   return { projectId, metricId: (await saved.json()).id, config, sourceId: (await source.json()).id, token };
  30  | }
  31  | 
  32  | for (const width of [1280, 390]) {
  33  |   test(`明细分页 ${width}px：实际同步改变总页数后重读同口径指标与明细`, async ({ page, request }, info) => {
  34  |     await page.setViewportSize({ width, height: 900 }); await page.context().setExtraHTTPHeaders(identity);
  35  |     const { projectId, metricId, sourceId, token } = await fixture(request);
  36  |     const header = ['日期', '渠道', '咨询人数', '成交人数'];
  37  |     await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [header, ...Array.from({ length: 31 }, () => ['2026-10-01', '门店', 100, 1])] } });
  38  |     expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId } })).status()).toBe(200);
  39  |     expect((await request.post('/api/dashboards', { headers: identity, data: { projectId, cards: [{ title: '分页可核对', type: 'detail_table', config: { metricId } }] } })).status()).toBe(200);
  40  |     await page.goto('/projects/' + projectId);
  41  |     const article = page.getByRole('article', { name: '分页可核对', exact: true });
  42  |     await expect(article).toContainText('1.0%'); await expect(article).toContainText('共 31 条符合条件记录 · 第 1 / 3 页');
  43  |     await article.getByRole('button', { name: '明细下一页', exact: true }).click();
  44  |     await expect(article).toContainText('第 2 / 3 页'); await expect(article.getByRole('table').getByRole('row')).toHaveCount(16);
  45  |     await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [header, ['2026-10-01', '门店', 100, 2]] } });
  46  |     expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId } })).status()).toBe(200);
  47  |     await article.getByRole('button', { name: '明细下一页', exact: true }).click();
  48  |     await expect(article).toContainText('共 1 条符合条件记录 · 第 1 / 1 页');
> 49  |     await expect(article).toContainText('2.0%'); await expect(article).toContainText('数据 v3');
      |                           ^ Error: expect(locator).toContainText(expected) failed
  50  |     await expect(article.getByRole('table').getByRole('row')).toHaveCount(2);
  51  |     await article.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('detail-page-corrected-after-sync.png') });
  52  |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  53  |   });
  54  |   test(`小百分比目标 ${width}px：比例存储的平均与趋势不重复转换，明确目标保存刷新回填`, async ({ page, request }, info) => {
  55  |     await page.setViewportSize({ width, height: 900 }); await page.context().setExtraHTTPHeaders(identity);
  56  |     const created = await request.post('/api/projects', { headers: identity, data: { action: 'create', name: '比例目标' + Date.now(), templateId: 'general_workbench' } }); const projectId = (await created.json()).id;
  57  |     const token = 'FractionGoal-' + projectId;
  58  |     await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [['日期', '完成率'], ['2026-10-01', '0.5%'], ['2026-10-01', '1.5%']] } });
  59  |     const source = await request.post('/api/projects', { headers: identity, data: { action: 'save_source', projectId, name: '小百分比来源', type: 'feishu_sheet', kind: 'general', spreadsheet: 'https://fixture.feishu.cn/sheets/' + token, sheetId: 'sheetA', mappingJson: '[]' } });
  60  |     expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId: (await source.json()).id } })).status()).toBe(200);
  61  |     const datasets = await (await request.get('/api/datasets?projectId=' + projectId, { headers: identity })).json();
  62  |     const definition = await request.post('/api/metric-definitions', { headers: identity, data: { projectId, action: 'save', name: '平均完成率', config: { datasetId: datasets.datasets[0].id, aggregation: 'avg', field: '完成率', dateField: '日期', format: 'percent', unit: '%', percentScale: 'fraction', missingPolicy: 'skip' } } }); const metricId = (await definition.json()).id;
  63  |     expect(definition.status()).toBe(200);
  64  |     await page.goto('/projects/' + projectId); await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  65  |     await addCard(page, '平均完成趋势', '时间趋势', async () => { await expect(page.getByRole('dialog')).toContainText('2026-10-01：1.0%'); });
  66  |     await addCard(page, '小比例目标', '目标进度', async () => { await page.getByLabel('目标数值', { exact: true }).fill('2'); await expect(page.getByRole('dialog')).toContainText('预览：1.0%'); });
  67  |     await publish(page); await page.reload();
  68  |     const goal = page.getByRole('article', { name: '小比例目标', exact: true });
  69  |     await expect(goal).toContainText('目标：2.0% · 达成 50.0%');
  70  |     await expect(page.getByRole('article', { name: '平均完成趋势', exact: true })).toContainText('1.0%');
  71  |     await goal.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('fraction-target-published.png') });
  72  |     const stored = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: identity })).json();
  73  |     expect(JSON.parse(stored.cards[1].configJson)).toMatchObject({ metricId, target: 0.02 });
  74  |     const rows = await (await request.get('/api/datasets?projectId=' + projectId + '&id=' + datasets.datasets[0].id + '&all=true', { headers: identity })).json();
  75  |     expect(rows.dataset.rows.map((row: { 完成率: number }) => row.完成率)).toEqual([0.005, 0.015]);
  76  |     await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click(); await goal.getByTitle('编辑卡片', { exact: true }).click();
  77  |     await expect(page.getByLabel('目标数值', { exact: true })).toHaveValue('2');
  78  |     await page.getByRole('button', { name: '取消', exact: true }).click(); await page.getByRole('button', { name: '取消编辑', exact: true }).click();
  79  |   });
  80  | }
  81  | 
  82  | test('共享看板反例：同一指标能通过真实控件选择时间趋势', async ({ page, request }, info) => {
  83  |   await page.context().setExtraHTTPHeaders(identity); const { projectId } = await fixture(request);
  84  |   await page.goto('/projects/' + projectId); await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  85  |   await page.getByRole('button', { name: '＋ 添加卡片', exact: true }).click();
  86  |   await page.getByRole('combobox', { name: '展示呈现形式', exact: true }).click();
  87  |   await page.screenshot({ path: info.outputPath('trend-option.png') });
  88  |   await page.getByRole('option', { name: '时间趋势', exact: true }).click();
  89  |   await expect(page.getByRole('dialog')).toContainText('按项目时区');
  90  | });
  91  | test('共享看板反例：项目周期是真实日期控件且包含完整结束日', async ({ page, request }, info) => {
  92  |   await page.context().setExtraHTTPHeaders(identity); const { projectId, metricId } = await fixture(request);
  93  |   expect((await request.post('/api/dashboards', { headers: identity, data: { projectId, cards: [{ title: '团队成交率', type: 'metric_card', config: { metricId } }] } })).status()).toBe(200);
  94  |   await page.goto('/projects/' + projectId);
  95  |   await expect(page.getByRole('article', { name: '团队成交率', exact: true })).toContainText('42.5%');
  96  |   await page.screenshot({ path: info.outputPath('missing-project-period.png') });
  97  |   await page.getByLabel('项目开始日期', { exact: true }).fill('2026-10-01');
  98  |   await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-01');
  99  |   await expect(page.getByRole('article', { name: '团队成交率', exact: true })).toContainText('15.0%');
  100 |   await expect(page.getByRole('article', { name: '团队成交率', exact: true })).toContainText('成对有效 2 行');
  101 | });
  102 | 
  103 | async function addCard(page: Page, title: string, presentation: string, extra?: () => Promise<void>) {
  104 |   await page.getByRole('button', { name: '＋ 添加卡片', exact: true }).click();
  105 |   await page.getByRole('textbox', { name: '卡片标题', exact: true }).fill(title);
  106 |   await choose(page, '展示呈现形式', presentation);
  107 |   if (extra) await extra();
  108 |   await expect(page.getByRole('button', { name: '加入草稿', exact: true })).toBeEnabled();
  109 |   await page.getByRole('button', { name: '加入草稿', exact: true }).click();
  110 | }
  111 | async function publish(page: Page) {
  112 |   const response = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  113 |   await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click();
  114 |   expect((await response).status()).toBe(200);
  115 | }
  116 | for (const width of [1280, 390]) {
  117 |   test(`共享五类呈现 ${width}px：页面选用同ID、完整周期、明确目标，发布刷新及定义更新一致`, async ({ page, request }, info) => {
  118 |     await page.setViewportSize({ width, height: 900 }); await page.context().setExtraHTTPHeaders(identity);
  119 |     const { projectId, metricId } = await fixture(request);
  120 |     await page.goto('/projects/' + projectId);
  121 |     await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  122 |     await page.getByLabel('项目开始日期', { exact: true }).fill('2026-10-01');
  123 |     await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-01');
  124 |     await addCard(page, '同口径单值', '单值指标');
  125 |     await addCard(page, '同口径趋势', '时间趋势', async () => { await expect(page.getByRole('dialog')).toContainText('2026-10-01：15.0%'); });
  126 |     await addCard(page, '同口径渠道', '分组对比', async () => { await choose(page, '分组字段', '渠道'); });
  127 |     await addCard(page, '同口径明细', '明细表');
  128 |     await addCard(page, '本项目目标', '目标进度', async () => {
  129 |       await expect(page.getByLabel('目标数值', { exact: true })).toHaveValue('');
  130 |       await expect(page.getByRole('button', { name: '加入草稿', exact: true })).toBeDisabled();
  131 |       await page.getByLabel('目标数值', { exact: true }).fill('20');
  132 |       await expect(page.getByRole('dialog').getByRole('status')).toContainText('预览：15.0%');
  133 |       await page.getByRole('combobox', { name: '卡片日期范围', exact: true }).click();
  134 |       await page.screenshot({ path: info.outputPath('five-presentations-picker-open.png') });
  135 |       await page.keyboard.press('Escape');
  136 |       await expect(page.getByRole('combobox', { name: '卡片日期范围', exact: true })).toBeFocused();
  137 |       await page.getByRole('button', { name: '加入草稿', exact: true }).focus();
  138 |       await page.keyboard.press('Tab'); await expect(page.getByRole('dialog')).toBeVisible();
  139 |     });
  140 |     await expect(page.getByRole('article', { name: '本项目目标', exact: true })).toContainText('目标：20.0% · 达成 75.0%');
  141 |     const trend = page.getByRole('article', { name: '同口径趋势', exact: true });
  142 |     await trend.getByText('查看每日数值与样本', { exact: true }).click();
  143 |     await expect(trend.getByRole('table', { name: '同口径趋势每日结果', exact: true })).toContainText('15.0%');
  144 |     await publish(page); await page.reload();
  145 |     for (const title of ['同口径单值', '同口径趋势', '同口径渠道', '同口径明细', '本项目目标']) {
  146 |       await expect(page.getByRole('article', { name: title, exact: true })).toContainText('15.0%');
  147 |       await expect(page.getByRole('article', { name: title, exact: true })).toContainText('指标 v1');
  148 |     }
  149 |     const detail = page.getByRole('article', { name: '同口径明细', exact: true });
```