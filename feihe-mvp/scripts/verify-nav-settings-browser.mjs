import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { chromium } from 'playwright';

const SCREENSHOT_DIR = path.resolve('../docs/delivery-v1/screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
  console.log('🚀 Starting Navigation, Settings SubNav & EmptyState verification on http://127.0.0.1:5246...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { 'x-user-id': 'user-editor' },
  });
  const page = await context.newPage();

  // 1. Visit /projects/qicui/settings at desktop 1280px
  console.log('--- Test 1: /projects/qicui/settings (1280px) ---');
  await page.goto('http://127.0.0.1:5246/projects/qicui/settings', { waitUntil: 'networkidle' });

  // Verify sidebar does NOT list data, metrics, reports
  const navLinks = await page.locator('.project-main-nav a').allTextContents();
  console.log('Main nav items:', navLinks.map(t => t.trim().replace(/\s+/g, ' ')));
  assert.ok(!navLinks.some(t => t.includes('数据管理')), 'Sidebar must not contain 数据管理');
  assert.ok(!navLinks.some(t => t.includes('指标')), 'Sidebar must not contain 指标');
  assert.ok(!navLinks.some(t => t.includes('报告')), 'Sidebar must not contain 报告');
  assert.ok(navLinks.some(t => t.includes('项目总览')), 'Sidebar must contain 项目总览');
  assert.ok(navLinks.some(t => t.includes('项目设置')), 'Sidebar must contain 项目设置');

  // Verify settings is active
  const activeSidebarLink = await page.locator('.project-main-nav a.active').textContent();
  console.log('Active sidebar item:', activeSidebarLink.trim().replace(/\s+/g, ' '));
  assert.ok(activeSidebarLink.includes('项目设置'), 'Sidebar active link must be 项目设置');

  // Verify secondary navigation tabs exist
  const subNavTabs = await page.locator('.settings-subnav-item').allTextContents();
  console.log('Settings secondary tabs:', subNavTabs.map(t => t.trim()));
  assert.ok(subNavTabs.some(t => t.includes('项目资料')), 'SubNav must contain 项目资料');
  assert.ok(subNavTabs.some(t => t.includes('数据管理')), 'SubNav must contain 数据管理');
  assert.ok(subNavTabs.some(t => t.includes('项目指标')), 'SubNav must contain 项目指标');
  assert.ok(subNavTabs.some(t => t.includes('项目报告')), 'SubNav must contain 项目报告');

  // Check active subnav item is profile
  const activeSubNav = await page.locator('.settings-subnav-item.active').textContent();
  console.log('Active subnav item:', activeSubNav.trim());
  assert.ok(activeSubNav.includes('项目资料'), 'Active subnav item must be 项目资料');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-settings-profile-1280.png'), fullPage: false });

  // 2. Test narrow desktop (900px viewport) - tabs must not overflow
  console.log('--- Test 2: Narrow desktop (900px) overflow check ---');
  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForTimeout(300);

  const subNavTrack = page.locator('.settings-subnav-track');
  const overflowState = await subNavTrack.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    overflows: el.scrollWidth > el.clientWidth + 2
  }));
  console.log('Narrow desktop tabs dimensions:', overflowState);
  assert.ok(!overflowState.overflows, 'Settings secondary tabs must not overflow on narrow desktop');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-settings-narrow-desktop-900.png'), fullPage: false });

  // Reset viewport
  await page.setViewportSize({ width: 1280, height: 900 });

  // 3. Navigate to Data Management (/projects/qicui/data)
  console.log('--- Test 3: Navigate to /projects/qicui/data ---');
  await page.locator('.settings-subnav-item', { hasText: '数据管理' }).click();
  await page.waitForTimeout(600);
  console.log('Current URL after clicking 数据管理:', page.url());
  assert.ok(page.url().includes('/projects/qicui/data'), 'URL must be /projects/qicui/data');

  // Verify sidebar STILL highlights 项目设置
  const activeSidebarInData = await page.locator('.project-main-nav a.active').textContent();
  console.log('Active sidebar item in data:', activeSidebarInData.trim().replace(/\s+/g, ' '));
  assert.ok(activeSidebarInData.includes('项目设置'), 'Sidebar active link in /data must be 项目设置');

  // Verify SubNav highlights 数据管理
  const activeSubNavInData = await page.locator('.settings-subnav-item.active').textContent();
  console.log('Active subnav item in data:', activeSubNavInData.trim());
  assert.ok(activeSubNavInData.includes('数据管理'), 'Active subnav item in /data must be 数据管理');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-data-workspace.png'), fullPage: false });

  // 4. Navigate to Metrics (/projects/qicui/metrics)
  console.log('--- Test 4: Navigate to /projects/qicui/metrics ---');
  await page.locator('.settings-subnav-item', { hasText: '项目指标' }).click();
  await page.waitForTimeout(600);
  console.log('Current URL after clicking 项目指标:', page.url());
  assert.ok(page.url().includes('/projects/qicui/metrics'), 'URL must be /projects/qicui/metrics');

  const activeSidebarInMetrics = await page.locator('.project-main-nav a.active').textContent();
  console.log('Active sidebar item in metrics:', activeSidebarInMetrics.trim().replace(/\s+/g, ' '));
  assert.ok(activeSidebarInMetrics.includes('项目设置'), 'Sidebar active link in /metrics must be 项目设置');

  const activeSubNavInMetrics = await page.locator('.settings-subnav-item.active').textContent();
  console.log('Active subnav item in metrics:', activeSubNavInMetrics.trim());
  assert.ok(activeSubNavInMetrics.includes('项目指标'), 'Active subnav item in /metrics must be 项目指标');

  // Verify no ∅ character on metrics page
  const pageContentMetrics = await page.content();
  assert.ok(!pageContentMetrics.includes('∅'), 'Page must NOT contain ∅');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-metrics-workspace.png'), fullPage: false });

  // 5. Navigate to Reports (/projects/qicui/reports)
  console.log('--- Test 5: Navigate to /projects/qicui/reports ---');
  await page.locator('.settings-subnav-item', { hasText: '项目报告' }).click();
  await page.waitForTimeout(600);
  console.log('Current URL after clicking 项目报告:', page.url());
  assert.ok(page.url().includes('/projects/qicui/reports'), 'URL must be /projects/qicui/reports');

  const activeSidebarInReports = await page.locator('.project-main-nav a.active').textContent();
  console.log('Active sidebar item in reports:', activeSidebarInReports.trim().replace(/\s+/g, ' '));
  assert.ok(activeSidebarInReports.includes('项目设置'), 'Sidebar active link in /reports must be 项目设置');

  const activeSubNavInReports = await page.locator('.settings-subnav-item.active').textContent();
  console.log('Active subnav item in reports:', activeSubNavInReports.trim());
  assert.ok(activeSubNavInReports.includes('项目报告'), 'Active subnav item in /reports must be 项目报告');

  // Verify no ∅ character on reports page
  const pageContentReports = await page.content();
  assert.ok(!pageContentReports.includes('∅'), 'Page must NOT contain ∅');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-reports-workspace.png'), fullPage: false });

  // 6. Test Viewer access (no manage_settings permission)
  console.log('--- Test 6: Viewer access to /projects/qicui/reports ---');
  const viewerContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { 'x-user-id': 'user-viewer' },
  });
  const viewerPage = await viewerContext.newPage();
  const res = await viewerPage.goto('http://127.0.0.1:5246/projects/qicui/reports', { waitUntil: 'networkidle' });
  assert.equal(res.status(), 200, 'Viewer must receive HTTP 200 on /reports');
  const reportHeading = await viewerPage.locator('h1').textContent();
  console.log('Viewer reports heading:', reportHeading);
  assert.ok(reportHeading.includes('项目报告'), 'Viewer must see 项目报告 page');
  await viewerContext.close();

  await browser.close();
  console.log('🎉 ALL 6 BROWSER ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
