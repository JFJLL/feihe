import { expect, type APIRequestContext, type Page } from '@playwright/test';

export async function focusedProject(request: APIRequestContext, label = '三项补修') {
  const created = await request.post('/api/projects', { data: { action: 'create', id: 'focused-' + Date.now(), name: label, templateId: 'general_workbench' } });
  expect(created.ok()).toBeTruthy();
  return (await created.json()).id as string;
}
export async function chooseFocused(page: Page, name: string, option: string | RegExp) {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click();
}
export async function focusedSource(page: Page, projectId: string, documentToken: string) {
  const mounted = page.waitForResponse(r => r.url().includes('/api/feishu/sync?projectId=' + projectId));
  await page.goto(`/projects/${projectId}/settings?tab=data-sources`);
  await mounted;
  await page.getByRole('button', { name: /接入飞书数据源/ }).click();
  await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill('https://fixture.feishu.cn/sheets/' + documentToken);
  await page.getByRole('button', { name: '智能检测工作表 ↗' }).click();
  await expect(page.getByRole('combobox', { name: '目标工作表' })).toContainText('补修数据');
}
export async function firstSync(page: Page) {
  const done = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '✓ 保存并首次同步' }).click();
  expect((await done).status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
export async function newFocusedCard(page: Page, projectId: string, title: string) {
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: '⚙ 自定义看板卡片', exact: true }).click();
  await page.getByRole('button', { name: '＋ 添加卡片', exact: true }).first().click();
  await page.getByRole('button', { name: '高级：独立卡片', exact: true }).click();
  await page.getByLabel('卡片标题', { exact: true }).fill(title);
}
export function focusedPreview(page: Page) {
  return page.getByText('🔍 全量指标实时试算预览：').locator('..');
}
