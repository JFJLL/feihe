import { test, expect } from './evidence';

import { setup, selectDataset } from './helpers';
test('记录计数：普通三条任务的实时预览必须为3', async ({ page, request }) => {
  const { projectId } = await setup(request);
  await page.goto(`/projects/${projectId}`);
  await selectDataset(page, '任务数据A');
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByRole('button', { name: '＋ 添加卡片', exact: true }).first().click();
  await page.getByRole('button', { name: '高级：独立卡片', exact: true }).click();
  await page.getByRole('combobox').filter({ hasText: /比率转化|记录计数/ }).click();
  await page.getByRole('option', { name: /记录计数/ }).click();
  const preview = page.getByText('🔍 全量指标实时试算预览：').locator('..');
  await expect(preview).toContainText('[计算完成]');
  await expect(preview.locator('span').first()).toHaveText('3');
  await page.screenshot({ path: test.info().outputPath('count-preview.png') });
});

test('409：保存并切换失败后仍保留数据集A、草稿和编辑状态', async ({ page, request }) => {
  const { projectId, datasetA, dashboard } = await setup(request);
  await page.goto(`/projects/${projectId}`);
  await selectDataset(page, '任务数据A');
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByTitle('编辑卡片', { exact: true }).click();
  await page.getByLabel('卡片标题', { exact: true }).fill('409必须保留的草稿');
  await page.getByRole('button', { name: '保存并加入看板' }).click();
  // Advance the actual server by four versions, so localVersion+1 cannot pass.
  let confirmed = dashboard;
  for (let i = 0; i < 4; i++) {
    const update = await request.post('/api/dashboards', { data: { projectId, dashboardId: confirmed.dashboardId,
      version: confirmed.version, cards: [{ title: '服务端新版', type: 'metric_card', config: { metric: 'task_total', datasetId: datasetA.id } }] } });
    expect(update.ok()).toBeTruthy();
    confirmed = await update.json();
  }
  await selectDataset(page, '任务数据B');
  const failed = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  const rejected = await failed;
  expect(rejected.status()).toBe(409);
  expect((await rejected.json()).serverVersion).toBe(confirmed.version);
  await expect(page.getByRole('dialog', { name: /看板并发修改冲突/ })).toContainText('v' + confirmed.version);
  await expect(page.getByRole('combobox').filter({ hasText: /任务数据[AB]/ }).first()).toContainText('任务数据A');
  await expect(page.getByText('409必须保留的草稿', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '取消编辑', exact: true })).toBeVisible();
  const stored = await (await request.get(`/api/dashboards?projectId=${projectId}`)).json();
  expect(stored.cards[0].title).toBe('服务端新版');
});
