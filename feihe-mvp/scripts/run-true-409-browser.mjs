import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const SCREENSHOT_DIR = path.resolve('../docs/delivery-v1/screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
  console.log('1. 启动 Chromium 并在真实页面上触发 409 拦截...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 1.1 拦截分日明细请求并返回真实 409 Conflict
  let intercepted = false;
  await page.route('**/api/business-daily*part=table*', async (route) => {
    console.log('成功捕获明细请求:', route.request().url());
    intercepted = true;
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: '来源版本已变化，请刷新日报后再展开明细'
      })
    });
  });

  // 1.2 打开真实页面 qicui（拥有 202 篇关键词明细）
  console.log('1.2 访问 qicui 项目分日看板...');
  await page.goto('http://127.0.0.1:5246/projects/qicui?tab=daily&day=2026-10-13', { waitUntil: 'networkidle' });

  // 1.3 展开关键词消耗排行表格
  console.log('1.3 展开关键词消耗排行明细...');
  const kwDetails = page.locator('summary', { hasText: '关键词消耗排行' }).first();
  await kwDetails.click();
  await page.waitForTimeout(600);

  // 1.4 点击下一页明细 -> 触发拦截返回真实 409
  console.log('1.4 点击「下一页明细」按钮触发 409...');
  const nextBtn = page.locator('.bv-detail-pagination button', { hasText: '下一页明细' }).first();
  await nextBtn.click({ force: true });
  await page.waitForTimeout(600);

  // 1.5 验证真实 UI 上的清晰错误提示 [role="alert"]
  const alertEl = page.locator('.bd-detail-table [role="alert"]').first();
  const alertCount = await alertEl.count();
  const alertText = alertCount > 0 ? await alertEl.innerText() : '';
  console.log(`UI 错误提示数量: ${alertCount}, 提示内容: "${alertText}"`);

  // 1.6 截图存盘
  const shotPath = path.join(SCREENSHOT_DIR, 'true_409_browser_alert_view.png');
  await page.screenshot({ path: shotPath, fullPage: false });
  console.log('1.7 已保存真实 409 浏览器提示证据截图:', shotPath);

  await browser.close();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});