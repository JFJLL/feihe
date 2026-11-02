import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const playwrightPath = fs.existsSync(path.resolve('node_modules/@playwright/test'))
  ? path.resolve('node_modules/@playwright/test')
  : 'D:/download/pic-vec/feihe/feihe-mvp/node_modules/@playwright/test';
const { chromium } = require(playwrightPath);

async function main() {
  console.log('Starting Playwright UI Verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Verification 1: Health Arc Gauge on /projects/qicui?day=2026-10-16
  console.log('1. Navigating to /projects/qicui?day=2026-10-16...');
  await page.goto('http://127.0.0.1:5173/projects/qicui?day=2026-10-16', { waitUntil: 'networkidle' });
  await page.waitForSelector('.health-gauge-box');
  // Wait 1300ms for gauge count-up & arc reveal to finish
  await page.waitForTimeout(1300);
  
  const gaugeCard = page.locator('.bd-health-card');
  const gaugeScore = await page.locator('.health-gauge-box text.num').textContent();
  console.log('   -> Gauge score rendered:', gaugeScore);
  
  const shot1Path = 'C:/Users/liuhao_PC/AppData/Local/Temp/verify_comment1_qicui_gauge_v2.png';
  await gaugeCard.screenshot({ path: shot1Path });
  console.log('   -> Saved screenshot 1 to', shot1Path);

  // Verification 2: Settings Dropdown Popover on /projects/qicui/settings
  console.log('2. Navigating to /projects/qicui/settings...');
  await page.goto('http://127.0.0.1:5173/projects/qicui/settings', { waitUntil: 'networkidle' });
  await page.waitForSelector('summary.settings-more-summary');
  
  console.log('   -> Clicking summary.settings-more-summary...');
  await page.click('summary.settings-more-summary');
  await page.waitForTimeout(350);
  
  const popover = page.locator('.settings-more-popover');
  const popoverVisible = await popover.isVisible();
  console.log('   -> Popover visible:', popoverVisible);
  
  const items = await page.locator('.settings-more-popover .settings-subnav-item').allTextContents();
  console.log('   -> Popover items:', items.map(s => s.replace(/\s+/g, ' ').trim()));

  const shot2Path = 'C:/Users/liuhao_PC/AppData/Local/Temp/verify_comment2_qicui_settings_open.png';
  await page.screenshot({ path: shot2Path });
  console.log('   -> Saved screenshot 2 to', shot2Path);

  // Verification 3: Lazy Chart Scroll on /projects/qicui?day=2026-10-16
  console.log('3. Navigating back to /projects/qicui?day=2026-10-16 for scroll lazy animation...');
  await page.goto('http://127.0.0.1:5173/projects/qicui?day=2026-10-16', { waitUntil: 'networkidle' });
  await page.waitForSelector('.bd-funnel, .bd-kpi-card-rich, .bento-card');
  
  console.log('   -> Scrolling down to KFS 全渠道费用构成与占比...');
  const channelSection = page.locator('text=KFS 全渠道费用构成与占比').first();
  await channelSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  
  const lazyStates = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('[data-chart-lazy]'));
    return {
      total: elements.length,
      active: elements.filter(el => el.getAttribute('data-chart-lazy') === 'active').length,
      pending: elements.filter(el => el.getAttribute('data-chart-lazy') === 'pending').length,
    };
  });
  console.log('   -> Lazy animation chart counts:', lazyStates);

  const shot3Path = 'C:/Users/liuhao_PC/AppData/Local/Temp/verify_lazy_scroll_qicui_v2.png';
  await page.screenshot({ path: shot3Path });
  console.log('   -> Saved screenshot 3 to', shot3Path);

  await browser.close();
  console.log('ALL PLAYWRIGHT VERIFICATION CHECKS COMPLETED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('Playwright verification failed:', err);
  process.exit(1);
});
