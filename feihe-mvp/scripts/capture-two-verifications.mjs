import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/download/pic-vec/feihe/feihe-mvp/node_modules/@playwright/test');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1580, height: 1100 } });
  const page = await context.newPage();

  console.log('[1/2] Capturing check_qicui_cost_bullet.png...');
  await page.goto('http://127.0.0.1:5173/projects/qicui?tab=overview&day=2026-10-16', { waitUntil: 'networkidle' });
  await page.waitForSelector('#view-overview-ad', { timeout: 15000 });
  await page.locator('#view-overview-ad').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -20));
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'C:/Users/liuhao_PC/AppData/Local/Temp/check_qicui_cost_bullet.png' });
  console.log('Saved check_qicui_cost_bullet.png');

  console.log('[2/2] Capturing check_qicui_planning_grid.png...');
  await page.goto('http://127.0.0.1:5173/projects/qicui/content', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=人群切角与场景库', { timeout: 15000 });
  await page.locator('text=人群切角与场景库').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -30));
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'C:/Users/liuhao_PC/AppData/Local/Temp/check_qicui_planning_grid.png' });
  console.log('Saved check_qicui_planning_grid.png');

  await browser.close();
}

main().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
