import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/download/pic-vec/feihe/feihe-mvp/node_modules/@playwright/test');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1580, height: 1050 } });

  console.log('[1/7] Capturing check_settings.png...');
  await page.goto('http://127.0.0.1:5173/projects/kailas/settings', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=界面外观与浅色色板', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/liuhao_PC/AppData/Local/Temp/check_settings.png' });
  console.log('Saved check_settings.png');

  console.log('[2/7] Capturing check_metrics_exit.png...');
  await page.goto('http://127.0.0.1:5173/projects/kailas/metrics', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=返回项目设置', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/liuhao_PC/AppData/Local/Temp/check_metrics_exit.png' });
  console.log('Saved check_metrics_exit.png');

  console.log('[3/7] Capturing check_kailas_top.png...');
  await page.goto('http://127.0.0.1:5173/projects/kailas', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'C:/Users/liuhao_PC/AppData/Local/Temp/check_kailas_top.png' });
  console.log('Saved check_kailas_top.png');

  console.log('[4/7] Capturing check_qicui_funnel.png...');
  await page.goto('http://127.0.0.1:5173/projects/qicui?tab=overview&day=2026-10-16', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=小红星 / 淘宝星河', { timeout: 15000 });
  await page.locator('text=小红星 / 淘宝星河').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -60));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/liuhao_PC/AppData/Local/Temp/check_qicui_funnel.png' });
  console.log('Saved check_qicui_funnel.png');

  console.log('[5/7] Capturing check_qicui_bench.png...');
  await page.locator('text=信息流人群定向与竞品人群渗透').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -60));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/liuhao_PC/AppData/Local/Temp/check_qicui_bench.png' });
  console.log('Saved check_qicui_bench.png');

  console.log('[6/7] Capturing check_qicui_content_scatter.png...');
  await page.goto('http://127.0.0.1:5173/projects/qicui/content', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=人群切角与场景库', { timeout: 15000 });
  await page.locator('text=达人层级效率矩阵').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -40));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/liuhao_PC/AppData/Local/Temp/check_qicui_content_scatter.png' });
  console.log('Saved check_qicui_content_scatter.png');

  console.log('[7/7] Capturing check_qicui_comments.png...');
  await page.goto('http://127.0.0.1:5173/projects/qicui/comments', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'C:/Users/liuhao_PC/AppData/Local/Temp/check_qicui_comments.png' });
  console.log('Saved check_qicui_comments.png');

  await browser.close();
  console.log('ALL_DONE');
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
