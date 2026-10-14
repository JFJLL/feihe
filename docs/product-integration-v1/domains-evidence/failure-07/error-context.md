# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-adapters.spec.ts >> 字段对应 1280px：不同名称的原表经选择器确认后驱动专属页，重复确认不增加对象
- Location: tests\browser\product-adapters.spec.ts:59:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('dialog')
Expected substring: "专属投放分析仍缺少"
Received string:    "确认适用的指标与看板✕原表：补修数据 · 1 条记录。以下推荐仅使用已有字段；不会安装任务、预算或固定目标。专属业务分析仍缺少：花费、曝光、点击。可先使用下面能够计算的内容，补齐字段后再确认业务页。确认字段对应日期对应字段业务发生日渠道对应字段未指定花费对应字段未指定曝光对应字段未指定点击对应字段未指定记录数量：1统计本项目原表记录行数，不要求任务、预算或负责人列。生成核心指标，并为主要指标添加日期趋势和渠道对比（有对应字段时）。指标只定义一次，各图表引用同一口径；团队看板仍需确认发布。取消创建指标并进入看板草稿"
Timeout: 10000ms

Call log:
  - Expect "toContainText" getByRole('dialog') with timeout 10000ms
  - waiting for getByRole('dialog')
    23 × locator resolved to <dialog open="" class="shared-dialog" aria-labelledby="_r_m_">…</dialog>
       - unexpected value "确认适用的指标与看板✕原表：补修数据 · 1 条记录。以下推荐仅使用已有字段；不会安装任务、预算或固定目标。专属业务分析仍缺少：花费、曝光、点击。可先使用下面能够计算的内容，补齐字段后再确认业务页。确认字段对应日期对应字段业务发生日渠道对应字段未指定花费对应字段未指定曝光对应字段未指定点击对应字段未指定记录数量：1统计本项目原表记录行数，不要求任务、预算或负责人列。生成核心指标，并为主要指标添加日期趋势和渠道对比（有对应字段时）。指标只定义一次，各图表引用同一口径；团队看板仍需确认发布。取消创建指标并进入看板草稿"

```

```yaml
- dialog "确认适用的指标与看板":
  - heading "确认适用的指标与看板" [level=3]
  - button "关闭弹窗": ✕
  - paragraph: 原表：补修数据 · 1 条记录。以下推荐仅使用已有字段；不会安装任务、预算或固定目标。
  - status: 专属业务分析仍缺少：花费、曝光、点击。可先使用下面能够计算的内容，补齐字段后再确认业务页。
  - group:
    - text: 确认字段对应 日期对应字段
    - combobox "日期对应字段":
      - text: 业务发生日
      - img
    - text: 渠道对应字段
    - combobox "渠道对应字段":
      - text: 未指定
      - img
    - text: 花费对应字段
    - combobox "花费对应字段":
      - text: 未指定
      - img
    - text: 曝光对应字段
    - combobox "曝光对应字段":
      - text: 未指定
      - img
    - text: 点击对应字段
    - combobox "点击对应字段":
      - text: 未指定
      - img
  - checkbox "推荐记录数量" [checked]
  - strong: 记录数量：1
  - text: 统计本项目原表记录行数，不要求任务、预算或负责人列。
  - paragraph: 生成核心指标，并为主要指标添加日期趋势和渠道对比（有对应字段时）。指标只定义一次，各图表引用同一口径；团队看板仍需确认发布。
  - button "取消"
  - button "创建指标并进入看板草稿"
```

# Test source

```ts
  1   | import { test, expect } from './evidence';
  2   | import type { Page, APIRequestContext } from '@playwright/test';
  3   | const identity = { 'x-user-id': 'user-editor' };
  4   | const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
  5   | async function dismissNotifications(page: Page) {
  6   |   const close = page.getByRole('button', { name: '关闭通知', exact: true });
  7   |   while (await close.count()) await close.first().click();
  8   | }
  9   | async function connect(page: Page, request: APIRequestContext, templateId: string, rows: unknown[][]) {
  10  |   await page.context().setExtraHTTPHeaders(identity);
  11  |   const created = await request.post('/api/projects', { headers: identity, data: { action: 'create', name: '字段驱动接入' + Date.now(), templateId } });
  12  |   expect(created.status()).toBe(200); const projectId = (await created.json()).id;
  13  |   const token = 'Adapter-' + projectId;
  14  |   expect((await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows } })).status()).toBe(200);
  15  |   await page.goto('/projects/' + projectId + '/data');
  16  |   await page.getByRole('button', { name: /接入飞书数据源/ }).click();
  17  |   await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill('https://fixture.feishu.cn/sheets/' + token);
  18  |   await page.getByRole('button', { name: '智能检测工作表 ↗' }).click();
  19  |   await expect(page.getByRole('combobox', { name: '目标工作表', exact: true })).toContainText('补修数据');
  20  |   const synced = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  21  |   await page.getByRole('button', { name: '✓ 保存并首次同步', exact: true }).click(); expect((await synced).status()).toBe(200);
  22  |   await expect(page.getByRole('dialog')).toHaveCount(0);
  23  |   await page.getByRole('tab', { name: '数据集', exact: true }).click();
  24  |   await expect(page.getByRole('table', { name: '业务数据明细', exact: true })).toContainText(String(rows[1][2]));
  25  |   return { projectId, token };
  26  | }
  27  | test('字段推荐反例：陌生四列表接入后可以经真实控件确认适用的指标和看板', async ({ page, request }, info) => {
  28  |   const { projectId } = await connect(page, request, 'general_workbench', [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '门店', 100, 20], ['2026-10-02', '线上', 200, 10]]);
  29  |   await page.screenshot({ path: info.outputPath('no-field-recommendation.png'), fullPage: true });
  30  |   await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click();
  31  |   await expect(page.getByRole('dialog')).toContainText('成交率');
  32  |   await expect(page.getByRole('dialog')).not.toContainText('预算执行率');
  33  |   await expect(page.getByRole('dialog')).not.toContainText('任务完成率');
  34  |   expect((await (await request.get('/api/datasets?projectId=' + projectId, { headers: identity })).json()).datasets[0].columns.map((c: { key: string }) => c.key)).toEqual(['日期', '渠道', '咨询人数', '成交人数']);
  35  | });
  36  | test('投放断链反例：五列新来源真实入库后专属投放消耗显示本项目300', async ({ page, request }, info) => {
  37  |   const { projectId } = await connect(page, request, 'ad_performance', [['日期', '渠道', '花费', '曝光', '点击'], ['2026-10-01', '新客户门店', 100, 1000, 10], ['2026-10-02', '新客户线上', 200, 3000, 60]]);
  38  |   await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click();
  39  |   await expect(page.getByRole('dialog')).toContainText('广告消耗：300');
  40  |   await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click();
  41  |   await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toBeVisible();
  42  |   const saved = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  43  |   await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await saved).status()).toBe(200);
  44  |   await page.goto('/projects/' + projectId);
  45  |   const overview = page.getByTestId('ad-performance-overview');
  46  |   await expect(overview.locator('.ops-metric-card').filter({ hasText: '广告消耗' })).toContainText('300');
  47  |   await page.screenshot({ path: info.outputPath('imported-ad-dataset-connected.png'), fullPage: true });
  48  |   await expect(overview.locator('.ops-metric-card').filter({ hasText: '广告消耗' })).toContainText('300');
  49  | });
  50  | async function confirmRecommendations(page: Page) {
  51  |   await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click();
  52  |   await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click();
  53  |   await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toBeVisible();
  54  |   const saved = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  55  |   await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await saved).status()).toBe(200);
  56  |   await dismissNotifications(page);
  57  | }
  58  | for (const width of [1280, 390]) {
  59  |   test(`字段对应 ${width}px：不同名称的原表经选择器确认后驱动专属页，重复确认不增加对象`, async ({ page, request }, info) => {
  60  |     await page.setViewportSize({ width, height: 900 });
  61  |     const { projectId } = await connect(page, request, 'ad_performance', [['业务发生日', '投放位置', '消耗金额', '展示次数', '访问点击'], ['2026-10-01', '独立位置', 125, 1000, 15]]);
  62  |     await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click();
> 63  |     await expect(page.getByRole('dialog')).toContainText('专属投放分析仍缺少');
      |                                            ^ Error: expect(locator).toContainText(expected) failed
  64  |     for (const [label, column] of [['渠道', '投放位置'], ['花费', '消耗金额'], ['曝光', '展示次数'], ['点击', '访问点击']]) {
  65  |       await page.getByRole('combobox', { name: label + '对应字段', exact: true }).click();
  66  |       await page.getByRole('option', { name: column, exact: true }).click();
  67  |     }
  68  |     await expect(page.getByRole('dialog')).toContainText('广告消耗：125');
  69  |     await page.getByText('确认字段对应', { exact: true }).click();
  70  |     const field = page.getByRole('combobox', { name: '花费对应字段', exact: true });
  71  |     await field.focus(); await field.press('ArrowDown');
  72  |     await expect(field).toHaveAttribute('aria-expanded', 'true');
  73  |     await page.screenshot({ path: info.outputPath('ad-field-correspondence-confirmed.png') });
  74  |     await field.press('Escape'); await expect(field).toBeFocused();
  75  |     const confirm = page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true });
  76  |     await confirm.focus(); await confirm.press('Enter');
  77  |     const saved = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  78  |     await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await saved).status()).toBe(200);
  79  |     await page.getByRole('link', { name: '投放分析', exact: true }).click();
  80  |     await expect(page.getByTestId('ad-performance-overview')).toContainText('125');
  81  |     await expect(page.getByTestId('ad-performance-overview')).toContainText('独立位置');
  82  |     const index = await (await request.get('/api/metric-definitions?projectId=' + projectId, { headers: identity })).json(); expect(index.metrics).toHaveLength(5);
  83  |     const source = (await (await request.get('/api/data-workspace?projectId=' + projectId, { headers: identity })).json()).datasets[0];
  84  |     const confirmed = await request.post('/api/metric-recommendations', { headers: identity, data: { projectId, datasetId: source.id, datasetVersion: source.version, selected: ['records', 'spend', 'impressions', 'clicks', 'ctr'], roles: { date: '业务发生日', channel: '投放位置', spend: '消耗金额', impressions: '展示次数', clicks: '访问点击' }, bindBusiness: true } }); expect(confirmed.status()).toBe(200);
  85  |     const again = await (await request.get('/api/metric-definitions?projectId=' + projectId, { headers: identity })).json(); expect(again.metrics).toHaveLength(5); expect(again.metrics.map((m: { id: string }) => m.id).sort()).toEqual(index.metrics.map((m: { id: string }) => m.id).sort());
  86  |     const board = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: identity })).json(); expect(board.cards).toHaveLength(7);
  87  |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  88  |   });
  89  |   test(`陌生部门推荐 ${width}px：四列原表→确认→六卡发布→刷新→同口径趋势与渠道`, async ({ page, request }, info) => {
  90  |     await page.setViewportSize({ width, height: 900 });
  91  |     const { projectId } = await connect(page, request, 'general_workbench', [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '门店', 100, 20], ['2026-10-02', '线上', 200, 10]]);
  92  |     await confirmRecommendations(page); await page.reload();
  93  |     await expect(page.getByRole('article', { name: '记录数量', exact: true })).toContainText('2');
  94  |     await expect(page.getByRole('article', { name: '咨询人数合计', exact: true })).toContainText('300');
  95  |     await expect(page.getByRole('article', { name: '成交率', exact: true })).toContainText('10.0%');
  96  |     const trend = page.getByRole('article', { name: '成交率趋势', exact: true });
  97  |     await trend.getByText('查看每日数值与样本', { exact: true }).click();
  98  |     await expect(trend.getByRole('table')).toContainText('20.0%'); await expect(trend.getByRole('table')).toContainText('5.0%');
  99  |     await expect(page.getByRole('article', { name: '成交率按渠道', exact: true })).toContainText('20.0%');
  100 |     await page.screenshot({ path: info.outputPath('field-recommended-board-published.png'), fullPage: true });
  101 |     const index = await (await request.get('/api/metric-definitions?projectId=' + projectId, { headers: identity })).json(); expect(index.metrics).toHaveLength(4);
  102 |     const board = await (await request.get('/api/dashboards?projectId=' + projectId, { headers: identity })).json(); expect(board.cards).toHaveLength(6);
  103 |     for (const card of board.cards) expect(JSON.parse(card.configJson).metricId).toBeTruthy();
  104 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  105 |   });
  106 |   test(`投放真实链路 ${width}px：确认自己的五列来源→专属页→同步更新→共享定义改版→只读与刷新`, async ({ page, request }, info) => {
  107 |     await page.setViewportSize({ width, height: 900 });
  108 |     const { projectId, token } = await connect(page, request, 'ad_performance', [['日期', '渠道', '花费', '曝光', '点击'], ['2026-10-01', '新客户门店', 100, 1000, 10], ['2026-10-02', '新客户线上', 200, 3000, 60]]);
  109 |     await confirmRecommendations(page);
  110 |     await page.getByRole('link', { name: '投放分析', exact: true }).click();
  111 |     await expect(page).toHaveURL(new RegExp('/projects/' + projectId + '/ads$'));
  112 |     await expect(page.getByRole('link', { name: '投放分析', exact: true })).toHaveAttribute('aria-current', 'page');
  113 |     const overview = page.getByTestId('ad-performance-overview'), cost = overview.locator('.ops-metric-card').filter({ hasText: '广告消耗' });
  114 |     await expect(cost).toContainText('300'); await expect(overview).toContainText('4,000'); await expect(overview).toContainText('70'); await expect(overview).toContainText('1.8%');
  115 |     await expect(overview).toContainText('授权飞书投放表'); await expect(overview.getByRole('table', { name: '投放渠道消耗', exact: true })).toContainText('新客户门店');
  116 |     await expect(cost).not.toContainText('¥'); await dismissNotifications(page); await page.screenshot({ path: info.outputPath('own-ad-source-real-results.png'), fullPage: true });
  117 |     const workspace = await (await request.get('/api/data-workspace?projectId=' + projectId, { headers: identity })).json(); const sourceId = workspace.sources[0].id;
  118 |     await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows: [['日期', '渠道', '花费', '曝光', '点击'], ['2026-10-01', '新客户门店', 500, 5000, 100], ['2026-10-02', '新客户线上', 100, 1000, 20]] } });
  119 |     expect((await request.post('/api/feishu/sync', { headers: identity, data: { projectId, sourceId } })).status()).toBe(200);
  120 |     await page.reload(); await expect(cost).toContainText('600'); await expect(overview).toContainText('数据 v2'); await expect(overview).toContainText('2.0%');
  121 |     await page.getByLabel('项目开始日期', { exact: true }).fill('2026-10-01'); await page.getByLabel('项目结束日期', { exact: true }).fill('2026-10-01');
  122 |     await expect(cost).toContainText('500');
  123 |     await page.goto('/projects/' + projectId + '/metrics');
  124 |     await page.getByRole('row').filter({ has: page.getByRole('cell', { name: '广告消耗', exact: true }) }).getByRole('button', { name: '编辑指标', exact: true }).click();
  125 |     await page.getByRole('combobox', { name: '指标计算方式', exact: true }).click(); await page.getByRole('option', { name: '数值平均 (Average)', exact: true }).click();
  126 |     await page.getByRole('button', { name: '保存指标', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  127 |     await page.goto('/projects/' + projectId + '/ads'); await expect(cost).toContainText('300'); await expect(cost).toContainText('指标 v2');
  128 |     await page.goto('/projects/' + projectId); await expect(page.getByRole('article', { name: '广告消耗', exact: true })).toContainText('300'); await expect(page.getByRole('article', { name: '广告消耗', exact: true })).toContainText('指标 v2');
  129 |     await request.post('/api/projects', { headers: identity, data: { action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' } });
  130 |     await page.context().setExtraHTTPHeaders({ 'x-user-id': 'user-viewer' }); await page.goto('/projects/' + projectId + '/ads'); await expect(cost).toContainText('300');
  131 |     await page.goto('/projects/' + projectId + '/data?tab=datasets'); await expect(page.getByRole('button', { name: '推荐指标与看板', exact: true })).toHaveCount(0);
  132 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  133 |   });
  134 | }
  135 | 
```