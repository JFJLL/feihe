import { expect, type Page, type APIRequestContext } from '@playwright/test';

export const projectIdentity = { 'x-user-id': 'user-editor' };
export async function dismissProjectNotifications(page: Page) {
  const close = page.getByRole('button', { name: '关闭通知', exact: true });
  while (await close.count()) await close.first().click();
}
export async function connectProjectTable(page: Page, request: APIRequestContext, templateId: string, rows: unknown[][]) {
  await page.context().setExtraHTTPHeaders(projectIdentity);
  const created = await request.post('/api/projects', { headers: projectIdentity, data: { action: 'create', name: '独立部门报告' + Date.now(), templateId } });
  expect(created.status()).toBe(200); const projectId = (await created.json()).id;
  const token = 'Report-' + projectId, vendor = process.env.FEIHE_TEST_VENDOR_ORIGIN || 'http://127.0.0.1:5217';
  expect((await request.post(vendor + '/__fixture/focused-rows', { data: { documentToken: token, rows } })).status()).toBe(200);
  await page.goto('/projects/' + projectId + '/data');
  await page.getByRole('button', { name: /接入飞书数据源/ }).click();
  await page.getByRole('textbox', { name: '飞书表格链接', exact: true }).fill('https://fixture.feishu.cn/sheets/' + token);
  await page.getByRole('button', { name: '智能检测工作表 ↗' }).click();
  await expect(page.getByRole('combobox', { name: '目标工作表', exact: true })).toContainText('补修数据');
  const synced = page.waitForResponse(r => r.url().endsWith('/api/feishu/sync') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '✓ 保存并首次同步', exact: true }).click(); expect((await synced).status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: '数据集', exact: true }).click();
  await expect(page.getByRole('table', { name: '业务数据明细', exact: true })).toContainText(String(rows[1][0]));
  return { projectId, token };
}
export async function publishRecommendedBoard(page: Page) {
  await page.getByRole('button', { name: '推荐指标与看板', exact: true }).click();
  await page.getByRole('button', { name: '创建指标并进入看板草稿', exact: true }).click();
  const saved = page.waitForResponse(r => r.url().endsWith('/api/dashboards') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '✓ 保存并发布看板', exact: true }).click(); expect((await saved).status()).toBe(200);
  await expect(page.getByRole('button', { name: '✓ 保存并发布看板', exact: true })).toHaveCount(0);
  await dismissProjectNotifications(page);
}
export const consultationRows = [['日期', '渠道', '咨询人数', '成交人数'], ['2026-10-01', '门店', 100, 20], ['2026-10-02', '线上', 200, 10]];
