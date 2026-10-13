# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-adapters.spec.ts >> 投放断链反例：五列新来源真实入库后专属投放消耗显示本项目300
- Location: tests\browser\product-adapters.spec.ts:32:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('ad-performance-overview').locator('.ops-metric-card').filter({ hasText: '广告消耗' })
Expected substring: "300"
Received string:    "广告消耗— 元"
Timeout: 10000ms

Call log:
  - Expect "toContainText" getByTestId('ad-performance-overview').locator('.ops-metric-card').filter({ hasText: '广告消耗' }) with timeout 10000ms
  - waiting for getByTestId('ad-performance-overview').locator('.ops-metric-card').filter({ hasText: '广告消耗' })
    23 × locator resolved to <article class="pastel-card pastel-blue reference-kpi ops-metric-card ops-metric-card-blue">…</article>
       - unexpected value "广告消耗— 元"

```

```yaml
- article: 广告消耗 — 元
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import type { Page, APIRequestContext } from '@playwright/test';
  3  | const identity = { 'x-user-id': 'user-editor' };
  4  | const vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
  5  | async function connect(page: Page, request: APIRequestContext, templateId: string, rows: unknown[][]) {
  6  |   await page.context().setExtraHTTPHeaders(identity);
  7  |   const created = await request.post('/api/projects', { headers: identity, data: { action: 'create', name: '字段驱动接入' + Date.now(), templateId } });
  8  |   expect(created.status()).toBe(200); const projectId = (await created.json()).id;
  9  |   const token = 'Adapter-' + projectId;
  10 |   expect((await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows } })).status()).toBe(200);
  11 |   await page.goto('/projects/' + projectId + '/data');
  12 |   await page.getByRole('button', { name: /接入飞书数据源/ }).click();
  13 |   await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill('https://fixture.feishu.cn/sheets/' + token);
  14 |   await page.getByRole('button', { name: '智能检测工作表 ↗' }).click();
  15 |   await expect(page.getByRole('combobox', { name: '目标工作表', exact: true })).toContainText('补修数据');
  16 |   const synced = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  17 |   await page.getByRole('button', { name: '✓ 保存并首次同步', exact: true }).click(); expect((await synced).status()).toBe(200);
  18 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  19 |   await page.getByRole('tab', { name: '数据集', exact: true }).click();
  20 |   await expect(page.getByRole('table', { name: '业务数据明细', exact: true })).toContainText(String(rows[1][2]));
  21 |   return { projectId, token };
  22 | }
  23 | test('字段推荐反例：陌生四列表接入后可以经真实控件确认适用的指标和看板', async ({ page, request }, info) => {
  24 |   const { projectId } = await connect(page, request, 'general_workbench', [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '门店', 100, 20], ['2026-10-02', '线上', 200, 10]]);
  25 |   await page.screenshot({ path: info.outputPath('no-field-recommendation.png'), fullPage: true });
  26 |   await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click();
  27 |   await expect(page.getByRole('dialog')).toContainText('成交率');
  28 |   await expect(page.getByRole('dialog')).not.toContainText('预算执行率');
  29 |   await expect(page.getByRole('dialog')).not.toContainText('任务完成率');
  30 |   expect((await (await request.get('/api/datasets?projectId=' + projectId, { headers: identity })).json()).datasets[0].columns.map((c: { key: string }) => c.key)).toEqual(['日期', '渠道', '咨询人数', '成交人数']);
  31 | });
  32 | test('投放断链反例：五列新来源真实入库后专属投放消耗显示本项目300', async ({ page, request }, info) => {
  33 |   const { projectId } = await connect(page, request, 'ad_performance', [['日期', '渠道', '花费', '曝光', '点击'], ['2026-10-01', '新客户门店', 100, 1000, 10], ['2026-10-02', '新客户线上', 200, 3000, 60]]);
  34 |   await page.goto('/projects/' + projectId);
  35 |   const overview = page.getByTestId('ad-performance-overview');
  36 |   await expect(overview).toBeVisible(); await page.screenshot({ path: info.outputPath('imported-ad-dataset-disconnected.png'), fullPage: true });
> 37 |   await expect(overview.locator('.ops-metric-card').filter({ hasText: '广告消耗' })).toContainText('300');
     |                                                                                  ^ Error: expect(locator).toContainText(expected) failed
  38 | });
  39 | 
```