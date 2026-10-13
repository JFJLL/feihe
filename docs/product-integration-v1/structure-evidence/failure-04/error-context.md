# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product-structure.spec.ts >> 复用百分口径 1280px：新来源1.5%与2.5%平均2.0%，发布刷新保持分数协议
- Location: tests\browser\product-structure.spec.ts:57:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('table', { name: '业务数据明细', exact: true })
Expected substring: "0.5%"
Received string:    "完成率金额0.005100.01520"
Timeout: 10000ms

Call log:
  - Expect "toContainText" getByRole('table', { name: '业务数据明细', exact: true }) with timeout 10000ms
  - waiting for getByRole('table', { name: '业务数据明细', exact: true })
    23 × locator resolved to <table aria-label="业务数据明细">…</table>
       - unexpected value "完成率金额0.005100.01520"

```

```yaml
- table "业务数据明细":
  - rowgroup:
    - row "完成率 金额":
      - columnheader "完成率"
      - columnheader "金额"
  - rowgroup:
    - row "0.005 10":
      - cell "0.005"
      - cell "10"
    - row "0.015 20":
      - cell "0.015"
      - cell "20"
```

# Test source

```ts
  1  | import { expect, type Page, type APIRequestContext } from '@playwright/test';
  2  | 
  3  | export const projectIdentity = { 'x-user-id': 'user-editor' };
  4  | export async function dismissProjectNotifications(page: Page) {
  5  |   const close = page.getByRole('button', { name: '关闭通知', exact: true });
  6  |   while (await close.count()) await close.first().click();
  7  | }
  8  | export async function connectProjectTable(page: Page, request: APIRequestContext, templateId: string, rows: unknown[][]) {
  9  |   await page.context().setExtraHTTPHeaders(projectIdentity);
  10 |   const created = await request.post('/api/projects', { headers: projectIdentity, data: { action: 'create', name: '独立部门报告' + Date.now(), templateId } });
  11 |   expect(created.status()).toBe(200); const projectId = (await created.json()).id;
  12 |   return connectExistingProjectTable(page, request, projectId, rows);
  13 | }
  14 | export async function connectExistingProjectTable(page: Page, request: APIRequestContext, projectId: string, rows: unknown[][]) {
  15 |   await page.context().setExtraHTTPHeaders(projectIdentity);
  16 |   const token = 'Report-' + projectId, vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
  17 |   expect((await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows } })).status()).toBe(200);
  18 |   await page.goto('/projects/' + projectId + '/data');
  19 |   await page.getByRole('button', { name: /接入飞书数据源/ }).click();
  20 |   await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill('https://fixture.feishu.cn/sheets/' + token);
  21 |   await page.getByRole('button', { name: '智能检测工作表 ↗' }).click();
  22 |   await expect(page.getByRole('combobox', { name: '目标工作表', exact: true })).toContainText('补修数据');
  23 |   const synced = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  24 |   await page.getByRole('button', { name: '✓ 保存并首次同步', exact: true }).click(); expect((await synced).status()).toBe(200);
  25 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  26 |   await page.getByRole('tab', { name: '数据集', exact: true }).click();
> 27 |   await expect(page.getByRole('table', { name: '业务数据明细', exact: true })).toContainText(String(rows[1][0]));
     |                                                                          ^ Error: expect(locator).toContainText(expected) failed
  28 |   return { projectId, token };
  29 | }
  30 | export async function publishRecommendedBoard(page: Page) {
  31 |   await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click();
  32 |   await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click();
  33 |   const saved = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  34 |   await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await saved).status()).toBe(200);
  35 |   await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toHaveCount(0);
  36 |   await dismissProjectNotifications(page);
  37 | }
  38 | export const consultationRows = [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '门店', 100, 20], ['2026-10-02', '线上', 200, 10]];
  39 | 
```