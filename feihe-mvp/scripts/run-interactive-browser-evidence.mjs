import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const SCREENSHOT_DIR = path.resolve('../docs/delivery-v1/screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
  console.log('启动 Playwright Chromium 进行浏览器实际交互实证...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('1. 打开 10-13 初始页面');
  await page.goto('http://127.0.0.1:5246/projects/qicui?tab=daily&day=2026-10-13', { waitUntil: 'networkidle' });

  console.log('2. 真实浏览器交互：修改业务日期为 2026-10-14');
  const dateInput = page.locator('input[type="date"]').first();
  await dateInput.fill('2026-10-14');
  await page.waitForTimeout(600);
  const shotDate = path.join(SCREENSHOT_DIR, 'interactive-01-date-switch-1014.png');
  await page.screenshot({ path: shotDate, fullPage: false });

  console.log('3. 真实浏览器交互：展开 关键词消耗排行（触发 409 来源指纹校验与分页）');
  const kwDetails = page.locator('summary', { hasText: '关键词消耗排行' });
  await kwDetails.click();
  await page.waitForTimeout(600);
  const shotKw1 = path.join(SCREENSHOT_DIR, 'interactive-02-kw-page1-expanded.png');
  await page.screenshot({ path: shotKw1, fullPage: false });

  console.log('4. 真实浏览器交互：在展开区内点击 下一页明细 按钮');
  const kwSection = page.locator('details', { hasText: '关键词消耗排行' });
  const nextBtn = kwSection.locator('.bv-detail-pagination button', { hasText: '下一页明细' });
  if (await nextBtn.count() > 0) {
    await nextBtn.click({ force: true });
    await page.waitForTimeout(600);
    const shotKw2 = path.join(SCREENSHOT_DIR, 'interactive-03-kw-page2-paged.png');
    await page.screenshot({ path: shotKw2, fullPage: false });
  }

  console.log('5. 真实浏览器交互：下拉选择 已确认历史日报 快照');
  const selectMode = page.locator('select').first();
  await selectMode.selectOption('confirmed');
  await page.waitForTimeout(600);
  const shotConfirmed = path.join(SCREENSHOT_DIR, 'interactive-04-confirmed-snapshot.png');
  await page.screenshot({ path: shotConfirmed, fullPage: false });

  console.log('6. 真实浏览器交互：点击 刷新 按钮');
  const refreshBtn = page.locator('button', { hasText: '刷新' });
  await refreshBtn.click();
  await page.waitForTimeout(600);
  const shotRefreshed = path.join(SCREENSHOT_DIR, 'interactive-05-refreshed-state.png');
  await page.screenshot({ path: shotRefreshed, fullPage: false });

  await browser.close();
  console.log('实际浏览器交互证据采集完成！');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
