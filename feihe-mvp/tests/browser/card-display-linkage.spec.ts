import { test, expect } from './evidence';
import type { APIRequestContext, Page } from '@playwright/test';
import { focusedProject, newFocusedCard, chooseFocused, focusedPreview } from './focused-helpers';

async function displayDataset(request: APIRequestContext, projectId: string, duplicates = false) {
  const values = duplicates ? [0.005, 0.005, 0.015, null] : [0.005, 0.015];
  const response = await request.post('/api/datasets', { data: {
    projectId, sourceId: 'card-display', name: '字段显示数据',
    columns: [{ key: 'completion', name: '完成率', type: 'number', numericUnit: 'percent', percentScale: 'fraction' }, { key: 'amount', name: '金额', type: 'number' }],
    rows: values.map((completion, i) => ({ completion, amount: (i + 1) * 10, amount2: (i + 1) * 100, status: '已完成', budget: 100, spent: 10, owner: '测试负责人' })),
  } });
  expect(response.status()).toBe(200);
  return (await response.json()).dataset;
}
async function value(page: Page, expected: string) {
  await expect(focusedPreview(page).locator('span').first()).toHaveText(expected);
}
async function publish(page: Page, request: APIRequestContext, projectId: string, title: string) {
  await page.getByRole('button', { name: '保存并加入看板', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toHaveCount(0);
  const cards = (await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards;
  return JSON.parse(cards.find((c: { title: string }) => c.title === title).configJson);
}
async function reopen(page: Page, title: string) {
  await page.reload();
  await expect(page.getByRole('article', { name: title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByRole('article', { name: title, exact: true }).getByTitle('编辑卡片', { exact: true }).click();
}
async function usable(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dialog = page.getByRole('dialog');
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  const save = dialog.getByRole('button', { name: '保存并加入看板' });
  await expect(save).toBeInViewport();
  await save.focus(); await page.keyboard.press('Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
}

for (const width of [1280, 390]) {
  test(`字段联动 A ${width}px：平均完成率切金额自动清理百分语义`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const projectId = await focusedProject(request, '字段联动');
    await displayDataset(request, projectId);
    await newFocusedCard(page, projectId, '字段切换平均');
    await chooseFocused(page, '指标计算方式', '数值平均 (Average)');
    await chooseFocused(page, '目标计算字段', '完成率');
    await value(page, '1.0%');
    const field = page.getByRole('combobox', { name: '目标计算字段', exact: true });
    await field.focus(); await field.press('ArrowDown'); await field.press('ArrowDown');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.screenshot({ path: info.outputPath('field-selector-keyboard.png') });
    await field.press('Enter');
    await expect(field).toBeFocused();
    await focusedPreview(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('percent-to-amount-preview.png') });
    await value(page, '15');
    await expect(page.getByRole('combobox', { name: '显示格式', exact: true })).toContainText('普通数值');
    await expect(page.getByLabel('单位 (选填)', { exact: true })).toHaveValue('');
    await chooseFocused(page, '目标计算字段', '完成率');
    await value(page, '1.0%');
    await chooseFocused(page, '目标计算字段', '金额'); await value(page, '15');
    await usable(page);
    const stored = await publish(page, request, projectId, '字段切换平均');
    expect(stored).toMatchObject({ field: 'amount', format: 'number', unit: '', displayOrigin: 'auto' });
    expect(stored.percentScale).toBeUndefined();
    await page.reload();
    await expect(page.getByRole('article', { name: '字段切换平均' }).getByText('15', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('ordinary-amount-published.png'), fullPage: true });
    await reopen(page, '字段切换平均');
    await value(page, '15');
    await chooseFocused(page, '目标计算字段', '完成率'); await value(page, '1.0%');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('article', { name: '字段切换平均' }).getByTitle('编辑卡片')).toBeFocused();
  });
  for (const aggregation of ['字段非空数', '唯一值计数 (去重计数)']) {
    test(`字段联动 B ${width}px：完成率${aggregation}显示计数2`, async ({ page, request }, info) => {
      await page.setViewportSize({ width, height: 844 });
      const projectId = await focusedProject(request, '计数联动');
      await displayDataset(request, projectId);
      await newFocusedCard(page, projectId, aggregation);
      await chooseFocused(page, '指标计算方式', aggregation);
      await chooseFocused(page, '目标计算字段', '完成率');
      await focusedPreview(page).scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('percent-field-count-preview.png') });
      await value(page, '2');
      await expect(page.getByRole('combobox', { name: '显示格式', exact: true })).toContainText('普通数值');
      await expect(page.getByLabel('单位 (选填)', { exact: true })).toHaveValue('');
      await page.getByRole('combobox', { name: '显示格式', exact: true }).click();
      await expect(page.getByRole('option', { name: '百分比', exact: true })).toHaveAttribute('aria-disabled', 'true');
      await expect(page.getByRole('option', { name: '金额', exact: true })).toHaveAttribute('aria-disabled', 'true');
      await page.keyboard.press('Escape');
      await usable(page);
      const stored = await publish(page, request, projectId, aggregation);
      expect(stored).toMatchObject({ format: 'number', unit: '', field: 'completion' }); expect(stored.percentScale).toBeUndefined();
      await reopen(page, aggregation); await value(page, '2');
    });
  }
  test(`聚合循环 ${width}px：重复百分值非空3、去重2，平均与计数来回切换发布`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const projectId = await focusedProject(request, '聚合循环');
    await displayDataset(request, projectId, true);
    await newFocusedCard(page, projectId, '重复百分值计数');
    await chooseFocused(page, '指标计算方式', '数值平均 (Average)'); await chooseFocused(page, '目标计算字段', '完成率'); await value(page, '0.8%');
    for (const [method, expected] of [['字段非空数', '3'], ['唯一值计数 (去重计数)', '2'], ['数值平均 (Average)', '0.8%'], ['字段非空数', '3'], ['唯一值计数 (去重计数)', '2']]) {
      await chooseFocused(page, '指标计算方式', method);
      await expect(page.getByRole('combobox', { name: '目标计算字段', exact: true })).toContainText('完成率');
      await value(page, expected);
    }
    await focusedPreview(page).scrollIntoViewIfNeeded(); await usable(page);
    await page.screenshot({ path: info.outputPath('duplicate-count-cycle.png') });
    const stored = await publish(page, request, projectId, '重复百分值计数');
    expect(stored).toMatchObject({ aggregation: 'distinct_count', format: 'number', unit: '' }); expect(stored.percentScale).toBeUndefined();
    await reopen(page, '重复百分值计数'); await value(page, '2');
    await chooseFocused(page, '指标计算方式', '字段非空数'); await value(page, '3');
    await chooseFocused(page, '指标计算方式', '数值平均 (Average)'); await value(page, '0.8%');
    const ds = (await (await request.get(`/api/datasets?projectId=${projectId}`)).json()).datasets[0];
    const data = (await (await request.get(`/api/datasets?projectId=${projectId}&id=${ds.id}&all=true`)).json()).dataset;
    expect(data.rows.map((r: { completion: number | null }) => r.completion)).toEqual([0.005, 0.005, 0.015, null]);
  });
  test(`手动偏好 ${width}px：金额与简写偏好保留，来源名字不触发货币单位`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const projectId = await focusedProject(request, '手动显示偏好'); await displayDataset(request, projectId);
    await newFocusedCard(page, projectId, '手动显示');
    await chooseFocused(page, '指标计算方式', '数值平均 (Average)'); await chooseFocused(page, '目标计算字段', '金额'); await value(page, '15');
    await chooseFocused(page, '显示格式', '金额'); await value(page, '¥15.00');
    await chooseFocused(page, '指标计算方式', '数值求和 (Sum)'); await value(page, '¥30.00');
    await chooseFocused(page, '目标计算字段', 'amount2'); await value(page, '¥300.00');
    await chooseFocused(page, '指标计算方式', '数值平均 (Average)'); await value(page, '¥150.00');
    await chooseFocused(page, '显示格式', '简写数值'); await chooseFocused(page, '目标计算字段', '金额'); await value(page, '15');
    await focusedPreview(page).scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('manual-compatible-preference.png') });
    const stored = await publish(page, request, projectId, '手动显示'); expect(stored).toMatchObject({ format: 'compact', unit: '', displayOrigin: 'manual' });
    await reopen(page, '手动显示'); await value(page, '15');
    await chooseFocused(page, '指标计算方式', '数值求和 (Sum)'); await value(page, '30');
    await chooseFocused(page, '指标计算方式', '字段非空数'); await value(page, '2');
    await expect(page.getByRole('combobox', { name: '显示格式', exact: true })).toContainText('简写数值');
  });
  test(`手动百分确认 ${width}px：变更未知单位字段时阻止静默继承与错误发布`, async ({ page, request }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const projectId = await focusedProject(request, '显式百分确认'); await displayDataset(request, projectId);
    await newFocusedCard(page, projectId, '手动单位确认');
    await chooseFocused(page, '指标计算方式', '数值平均 (Average)'); await chooseFocused(page, '目标计算字段', '完成率'); await value(page, '1.0%');
    await chooseFocused(page, '显示格式', '普通数值'); await value(page, '0.01');
    await chooseFocused(page, '显示格式', '百分比'); await value(page, '1.0%');
    await chooseFocused(page, '目标计算字段', '金额');
    await expect(page.getByRole('alert')).toContainText('请确认当前显示设置');
    await expect(page.getByRole('button', { name: '保存并加入看板' })).toBeDisabled();
    await expect(focusedPreview(page)).not.toContainText('1500.0%');
    await page.getByRole('alert').scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('manual-unit-confirmation.png') });
    await chooseFocused(page, '显示格式', '普通数值'); await value(page, '15');
    const stored = await publish(page, request, projectId, '手动单位确认'); expect(stored).toMatchObject({ format: 'number', unit: '', displayOrigin: 'manual', displayNeedsConfirmation: false });
  });
}
