import { test, expect } from './evidence';
import { focusedProject, focusedSource, firstSync, newFocusedCard, chooseFocused, focusedPreview } from './focused-helpers';

test('补修反例：百分字段普通平均0.5%与1.5%显示1.0%', async ({ page, request }) => {
  const projectId = await focusedProject(request);
  await focusedSource(page, projectId, 'FocusedPercentDoc');
  await firstSync(page);
  await newFocusedCard(page, projectId, '小百分比平均');
  await chooseFocused(page, '指标计算方式', '数值平均 (Average)');
  await chooseFocused(page, '目标计算字段', '均值百分比');
  await page.getByLabel('单位 (选填)', { exact: true }).fill('%');
  await expect(focusedPreview(page).locator('span').first()).toHaveText('1.0%');
});

test('补修反例：配置保存200后首次同步500，重试复用同一来源', async ({ page, request }, info) => {
  const projectId = await focusedProject(request);
  await focusedSource(page, projectId, 'FocusedRatioDoc');
  let injected = false;
  await page.route('**/api/feishu/sync', route => {
    if (route.request().method() === 'POST' && !injected) {
      injected = true;
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"首次同步失败反例"}' });
    }
    return route.continue();
  });
  const saved = page.waitForResponse(r => r.url().endsWith('/api/projects') && r.request().postDataJSON()?.action === 'save_source');
  const failed = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '✓ 保存并首次同步' }).click();
  const first = await saved;
  expect(first.status()).toBe(200);
  const originalId = (await first.json()).id;
  expect((await failed).status()).toBe(500);
  await page.screenshot({ path: info.outputPath('saved-but-sync-failed.png'), fullPage: true });
  const modal = page.getByRole('dialog');
  const retry = modal.getByRole('button', { name: '重试同步', exact: true });
  const success = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  if (await retry.count()) await retry.click();
  else await modal.getByRole('button', { name: '✓ 保存并首次同步' }).click();
  const successful = await success;
  expect(successful.status()).toBe(200);
  expect(successful.request().postDataJSON().sourceId).toBe(originalId);
  const workspace = await (await request.get('/api/projects')).json();
  const sources = workspace.sources.filter((s: { projectId: string }) => s.projectId === projectId);
  expect(sources).toHaveLength(1);
  expect(sources[0].id).toBe(originalId);
});

test('补修反例：互补缺失数据默认无可计算比率和成对样本', async ({ page, request }) => {
  const projectId = await focusedProject(request);
  await focusedSource(page, projectId, 'FocusedRatioDoc');
  await firstSync(page);
  await newFocusedCard(page, projectId, '互补缺失转化率');
  await chooseFocused(page, '指标计算方式', '比率转化 (分子 / 分母 加权比率)');
  await chooseFocused(page, '分子字段', '成交');
  await chooseFocused(page, '分母字段', '咨询');
  await expect(focusedPreview(page).locator('span').first()).toHaveText('—');
  await expect(focusedPreview(page)).toContainText('成对有效');
  await expect(focusedPreview(page)).toContainText('0');
});
