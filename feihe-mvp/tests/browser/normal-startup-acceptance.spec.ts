import { test, expect } from '@playwright/test';

test.describe('Normal 5173 Startup Real Acceptance', () => {
  test.use({
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 900 },
  });

  test('01: project center loads trusted user-editor and qicui card', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle('社媒增长中台');
    const body = page.locator('body');
    await expect(body).toContainText('业务编辑者(张晓)');
    await expect(body).toContainText('启萃评论与声量项目');
  });

  test('02: qicui overview displays 10-15 latest real metrics with 10-14 cutoff', async ({ page }) => {
    await page.goto('/projects/qicui?day=2026-10-15', { waitUntil: 'networkidle' });
    const body = page.locator('body');
    await expect(body).toContainText('平台广告消耗');
    await expect(body).toContainText('2026-10-14');
  });

  test('03: qicui overview displays 10-13 confirmed historical report values', async ({ page }) => {
    await page.goto('/projects/qicui?day=2026-10-13&mode=confirmed', { waitUntil: 'networkidle' });
    const body = page.locator('body');
    await expect(body).toContainText('275,326.74');
    await expect(body).toContainText('36,344');
    await expect(body).toContainText('326,140.74');
  });

  test('04: content workspace displays notes and opens detail drawer', async ({ page }) => {
    await page.goto('/projects/qicui/content?tab=analysis', { waitUntil: 'networkidle' });
    const detailBtn = page.locator('button:has-text("查看笔记明细 →"), button:has-text("查看详情")').first();
    await expect(detailBtn).toBeVisible();
    await detailBtn.click();
    const drawer = page.locator('.note-detail-drawer, .drawer-header, [role="dialog"]').first();
    await expect(drawer).toBeVisible();
  });

  test('05: reports workspace and settings workspace navigate properly', async ({ page }) => {
    await page.goto('/projects/qicui/reports', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText('报告');

    await page.goto('/projects/qicui/settings', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText('项目资料');
  });

  test('06: floating agent AI entrance is present', async ({ page }) => {
    await page.goto('/projects/qicui', { waitUntil: 'networkidle' });
    const agentBtn = page.locator('.floating-agent-btn');
    await expect(agentBtn).toBeVisible();
  });
});
