import { test, expect } from './evidence';
import { setup, selectDataset } from './helpers';
import type { Page } from '@playwright/test';

async function edit(page: Page, title: string) {
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByTitle('编辑卡片', { exact: true }).click();
  await page.getByLabel('卡片标题', { exact: true }).fill(title);
  await page.getByRole('button', { name: '保存并加入看板' }).click();
}

test('E 必要资源受阻、单人跳过、就绪，归档刷新授权恢复再编辑', async ({ page, request }) => {
  const created = await request.post('/api/projects', { data: { action: 'create', id: `ready-${Date.now()}`, name: '初始化恢复验收', templateId: 'general_workbench' } });
  expect(created.ok()).toBeTruthy();
  const projectId = (await created.json()).id;
  const before = (await (await request.get(`/api/projects?projectId=${projectId}`)).json()).project.onboardingStatus;
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole('button', { name: '完成初始化（发布项目）' })).toBeDisabled();
  const premature = await request.post('/api/projects', { data: { action: 'update_onboarding', projectId, onboardingStatus: 'ready', completedSteps: ['template', 'source', 'first_sync', 'metrics', 'skip:members'] } });
  expect(premature.status()).toBe(400);
  expect((await premature.json()).readiness.blockedSteps).toEqual(expect.arrayContaining(['source', 'first_sync', 'metrics']));
  await page.getByRole('button', { name: '稍后配置', exact: true }).click();
  expect((await (await request.get(`/api/projects?projectId=${projectId}`)).json()).project.onboardingStatus).toBe(before);

  // Provision actual resources through local APIs; the readiness check reads SQLite.
  const ds = await request.post('/api/datasets', { data: { projectId, sourceId: 'ready', name: '真实任务', rows: [{ task: '1' }, { task: '2' }] } });
  expect(ds.ok()).toBeTruthy();
  const datasetId = (await ds.json()).dataset.id;
  const cards = await request.post('/api/dashboards', { data: { projectId, cards: [{ title: '真实记录', type: 'metric_card', config: { aggregation: 'count', datasetId } }] } });
  expect(cards.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('button', { name: '完成初始化（发布项目）' })).toBeDisabled();
  await page.getByRole('button', { name: '单人跳过', exact: true }).click();
  await page.getByRole('button', { name: '完成初始化（发布项目）' }).click();
  await expect(page.getByRole('button', { name: '完成初始化（发布项目）' })).toHaveCount(0);
  const ready = (await (await request.get(`/api/projects?projectId=${projectId}`)).json());
  expect(ready.project.onboardingStatus).toBe('ready');
  expect(ready.readiness.ready).toBe(true);
  expect(ready.readiness.completedSteps).toContain('skip:members');
  await request.post('/api/projects', { data: { action: 'add_member', projectId, userId: 'user-viewer', role: 'viewer' } });

  await page.getByRole('link', { name: '返回项目中心' }).click();
  await page.getByRole('textbox', { name: '搜索项目', exact: true }).fill('初始化恢复验收');
  const article = page.locator('article').filter({ has: page.locator(`a[href="/projects/${projectId}"]`) });
  await article.getByRole('button', { name: '归档', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('归档');
  await page.getByRole('dialog').getByRole('button', { name: /确认/ }).click();
  await page.reload();
  await page.getByRole('textbox', { name: '搜索项目', exact: true }).fill('初始化恢复验收');
  await expect(article.getByRole('button', { name: '恢复', exact: true })).toBeVisible();
  const refused = await request.post('/api/projects', { headers: { 'x-user-id': 'user-viewer' }, data: { action: 'restore', projectId } });
  expect(refused.status()).toBe(403);
  const write = await request.post('/api/datasets', { data: { projectId, sourceId: 'ready', rows: [{ task: '覆盖' }] } });
  expect(write.status()).toBe(403);
  await article.getByRole('button', { name: '恢复', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /确认/ }).click();
  await article.locator(`a[href="/projects/${projectId}"]`).click();
  await edit(page, '恢复后的记录');
  await page.getByRole('button', { name: '✓ 保存并发布看板' }).click();
  await page.reload();
  await expect(page.getByText('恢复后的记录', { exact: true })).toBeVisible();
  expect((await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards[0].title).toBe('恢复后的记录');
});

test('离开模块、切换项目和浏览器后退均先保护草稿', async ({ page, request }) => {
  const { projectId } = await setup(request);
  const other = await setup(request);
  const otherName = '导航目的项目' + other.projectId;
  expect((await request.post('/api/projects', { data: { action: 'update', projectId: other.projectId, name: otherName } })).ok()).toBeTruthy();
  const settingsReady = page.waitForResponse(r => r.url().includes('/api/feishu/sync?projectId=' + projectId));
  await page.goto(`/projects/${projectId}/settings?tab=data-sources`);
  await settingsReady;
  await page.getByRole('link', { name: '项目总览', exact: true }).click();
  await edit(page, '导航保护草稿');
  await page.getByRole('link', { name: '项目设置', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('未保存');
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await page.evaluate(() => history.back());
  await expect(page.getByRole('dialog')).toContainText('未保存');
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await page.getByRole('combobox', { name: '切换项目' }).click();
  await page.getByRole('option', { name: new RegExp(otherName) }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${other.projectId}$`));
  expect((await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards[0].title).toBe('导航保护草稿');
});

async function visibleDialog(page: Page) {
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight
      && Math.abs(r.left - (innerWidth - r.width) / 2) <= 2
      && el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1;
  })).toBe(true);
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  return dialog;
}

test('F 390px键盘完成卡片、选择器、未保存和冲突弹窗', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { projectId, dashboard } = await setup(request);
  await page.goto(`/projects/${projectId}`);
  await selectDataset(page, '任务数据A');
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).focus();
  await page.keyboard.press('Enter');
  const add = page.getByRole('button', { name: '＋ 添加卡片', exact: true });
  await add.focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '高级：独立卡片', exact: true }).focus(); await page.keyboard.press('Enter');
  const modal = await visibleDialog(page);
  await modal.getByLabel('卡片标题', { exact: true }).fill('移动端计数');
  const aggregation = page.getByRole('combobox', { name: '指标计算方式' });
  await aggregation.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('390-card-select.png') });
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(add).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '高级：独立卡片', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.getByLabel('卡片标题', { exact: true }).fill('移动端计数');
  await expect(page.getByRole('button', { name: '保存并加入看板' })).toBeEnabled();
  await page.getByRole('button', { name: '保存并加入看板' }).focus(); await page.keyboard.press('Enter');
  await request.post('/api/dashboards', { data: { projectId, dashboardId: dashboard.dashboardId, version: dashboard.version, cards: [{ title: '外部版本', type: 'metric_card', config: { aggregation: 'count', datasetId: (await (await request.get(`/api/datasets?projectId=${projectId}`)).json()).datasets[0].id } }] } });
  await selectDataset(page, '任务数据B');
  await visibleDialog(page);
  await page.screenshot({ path: test.info().outputPath('390-unsaved.png') });
  await page.getByRole('button', { name: '保存修改', exact: true }).focus(); await page.keyboard.press('Enter');
  const conflict = page.getByRole('dialog', { name: '检测到看板并发修改冲突 (409)' });
  await expect(conflict).toBeVisible();
  await visibleDialog(page);
  await page.screenshot({ path: test.info().outputPath('390-conflict.png') });
  await conflict.getByRole('button', { name: '强制覆盖发布' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '当前业务数据集' })).toContainText('任务数据B');
  await page.reload();
  await expect(page.getByText('移动端计数', { exact: true })).toBeVisible();
  expect((await (await request.get(`/api/dashboards?projectId=${projectId}`)).json()).cards.some((c: { title: string }) => c.title === '移动端计数')).toBe(true);
});

test('F 390px键盘映射、真实写入与确认弹窗', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { projectId } = await setup(request);
  const mounted = page.waitForResponse(r => r.url().includes('/api/feishu/sync?projectId=' + projectId));
  await page.goto(`/projects/${projectId}/settings?tab=data-sources`);
  await mounted;
  await page.getByRole('button', { name: /接入飞书数据源/ }).focus(); await page.keyboard.press('Enter');
  await visibleDialog(page);
  await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill('https://fixture.feishu.cn/sheets/FixtureDoc');
  await page.getByRole('button', { name: '智能检测工作表 ↗' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: '目标工作表' })).toContainText('结构A');
  const sheet = page.getByRole('combobox', { name: '目标工作表' });
  await sheet.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(sheet).toContainText('结构B');
  await expect(page.getByRole('textbox', { name: '金额目标字段' })).toBeVisible();
  await page.getByRole('textbox', { name: '金额目标字段' }).fill('amount');
  await visibleDialog(page);
  await page.screenshot({ path: test.info().outputPath('390-mapping.png') });
  await expect(page.getByRole('button', { name: '✓ 保存并首次同步' })).toBeEnabled();
  await page.getByRole('button', { name: '✓ 保存并首次同步' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const datasets = (await (await request.get(`/api/datasets?projectId=${projectId}`)).json()).datasets;
  const mapped = datasets.find((d: { sourceId: string }) => !['a', 'b'].includes(d.sourceId));
  expect(mapped.rowCount).toBe(3);
  await page.getByRole('button', { name: '移除', exact: true }).focus(); await page.keyboard.press('Enter');
  const confirm = await visibleDialog(page);
  await page.screenshot({ path: test.info().outputPath('390-confirmation.png') });
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(page.getByRole('button', { name: '移除', exact: true })).toBeFocused();
});
