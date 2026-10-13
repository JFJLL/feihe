# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: focused-red.spec.ts >> 补修反例：互补缺失数据默认无可计算比率和成对样本
- Location: tests\browser\focused-red.spec.ts:48:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  getByText('🔍 全量指标实时试算预览：').locator('..').locator('span').first()
Expected: "—"
Received: "10.0%"
Timeout:  10000ms

Call log:
  - Expect "toHaveText" getByText('🔍 全量指标实时试算预览：').locator('..').locator('span').first() with timeout 10000ms
  - waiting for getByText('🔍 全量指标实时试算预览：').locator('..').locator('span').first()
    23 × locator resolved to <span>10.0%</span>
       - unexpected value "10.0%"

```

```yaml
- text: 10.0%
```

# Test source

```ts
  1  | import { test, expect } from './evidence';
  2  | import { focusedProject, focusedSource, firstSync, newFocusedCard, chooseFocused, focusedPreview } from './focused-helpers';
  3  | 
  4  | test('补修反例：百分字段普通平均0.5%与1.5%显示1.0%', async ({ page, request }) => {
  5  |   const projectId = await focusedProject(request);
  6  |   await focusedSource(page, projectId, 'FocusedPercentDoc');
  7  |   await firstSync(page);
  8  |   await newFocusedCard(page, projectId, '小百分比平均');
  9  |   await chooseFocused(page, '指标计算方式', '数值平均 (Average)');
  10 |   await chooseFocused(page, '目标计算字段', '均值百分比');
  11 |   await page.getByLabel('单位 (选填)', { exact: true }).fill('%');
  12 |   await expect(focusedPreview(page).locator('span').first()).toHaveText('1.0%');
  13 | });
  14 | 
  15 | test('补修反例：配置保存200后首次同步500，重试复用同一来源', async ({ page, request }, info) => {
  16 |   const projectId = await focusedProject(request);
  17 |   await focusedSource(page, projectId, 'FocusedRatioDoc');
  18 |   let injected = false;
  19 |   await page.route('**/api/feishu/sync', route => {
  20 |     if (route.request().method() === 'POST' && !injected) {
  21 |       injected = true;
  22 |       return route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"首次同步失败反例"}' });
  23 |     }
  24 |     return route.continue();
  25 |   });
  26 |   const saved = page.waitForResponse(r => r.url().endsWith('/api/projects') && r.request().postDataJSON()?.action === 'save_source');
  27 |   const failed = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  28 |   await page.getByRole('button', { name: '✓ 保存并首次同步' }).click();
  29 |   const first = await saved;
  30 |   expect(first.status()).toBe(200);
  31 |   const originalId = (await first.json()).id;
  32 |   expect((await failed).status()).toBe(500);
  33 |   await page.screenshot({ path: info.outputPath('saved-but-sync-failed.png'), fullPage: true });
  34 |   const modal = page.getByRole('dialog');
  35 |   const retry = modal.getByRole('button', { name: '重试同步', exact: true });
  36 |   const success = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  37 |   if (await retry.count()) await retry.click();
  38 |   else await modal.getByRole('button', { name: '✓ 保存并首次同步' }).click();
  39 |   const successful = await success;
  40 |   expect(successful.status()).toBe(200);
  41 |   expect(successful.request().postDataJSON().sourceId).toBe(originalId);
  42 |   const workspace = await (await request.get('/api/projects')).json();
  43 |   const sources = workspace.sources.filter((s: { projectId: string }) => s.projectId === projectId);
  44 |   expect(sources).toHaveLength(1);
  45 |   expect(sources[0].id).toBe(originalId);
  46 | });
  47 | 
  48 | test('补修反例：互补缺失数据默认无可计算比率和成对样本', async ({ page, request }) => {
  49 |   const projectId = await focusedProject(request);
  50 |   await focusedSource(page, projectId, 'FocusedRatioDoc');
  51 |   await firstSync(page);
  52 |   await newFocusedCard(page, projectId, '互补缺失转化率');
  53 |   await chooseFocused(page, '指标计算方式', '比率转化 (分子 / 分母 加权比率)');
  54 |   await chooseFocused(page, '分子字段', '成交');
  55 |   await chooseFocused(page, '分母字段', '咨询');
> 56 |   await expect(focusedPreview(page).locator('span').first()).toHaveText('—');
     |                                                              ^ Error: expect(locator).toHaveText(expected) failed
  57 |   await expect(focusedPreview(page)).toContainText('成对有效');
  58 |   await expect(focusedPreview(page)).toContainText('0');
  59 | });
  60 | 
```