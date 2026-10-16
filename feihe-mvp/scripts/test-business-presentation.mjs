import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const SCREENSHOT_DIR = path.resolve('../docs/delivery-v1/screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function run() {
  console.log('启动 Playwright Chromium 独立浏览器会话...');
  const browser = await chromium.launch({ headless: true });

  const testCases = [
    { name: '10-13_1440', url: 'http://127.0.0.1:5246/projects/qicui?tab=daily&day=2026-10-13', width: 1440, height: 900 },
    { name: '10-13_1280', url: 'http://127.0.0.1:5246/projects/qicui?tab=daily&day=2026-10-13', width: 1280, height: 800 },
    { name: '10-14_1440', url: 'http://127.0.0.1:5246/projects/qicui?tab=daily&day=2026-10-14', width: 1440, height: 900 },
    { name: '10-14_1280', url: 'http://127.0.0.1:5246/projects/qicui?tab=daily&day=2026-10-14', width: 1280, height: 800 },
    { name: 'cross_month_09-30_1440', url: 'http://127.0.0.1:5246/projects/qicui?tab=daily&day=2026-09-30', width: 1440, height: 900 },
    { name: 'cross_month_11-01_1440', url: 'http://127.0.0.1:5246/projects/qicui?tab=daily&day=2026-11-01', width: 1440, height: 900 },
    { name: 'isolated_empty_project_1440', url: 'http://127.0.0.1:5246/projects/business-isolated-2?tab=daily&day=2026-10-14', width: 1440, height: 900 },
    { name: 'ads_tab_placeholder_1440', url: 'http://127.0.0.1:5246/projects/qicui?tab=ads', width: 1440, height: 900 }
  ];

  const results = [];

  for (const tc of testCases) {
    const page = await browser.newPage({ viewport: { width: tc.width, height: tc.height } });
    console.log(`正在验收: ${tc.name} (${tc.url})...`);
    await page.goto(tc.url, { waitUntil: 'networkidle' });

    const title = await page.title();
    const hasError = await page.locator('[role="alert"]').count();
    const isBusinessDaily = await page.locator('.business-daily').count();
    const isEmpty = await page.locator('.empty-state, [data-testid="empty-state"]').count();

    const shotPath = path.join(SCREENSHOT_DIR, `${tc.name}-view.png`);
    await page.screenshot({ path: shotPath, fullPage: true });

    const info = await page.evaluate(() => {
      const daily = document.querySelector('.business-daily');
      if (!daily) {
        return { isDaily: false, emptyText: document.querySelector('.ops-workspace, .empty-state')?.innerText?.slice(0, 150) };
      }
      return {
        isDaily: true,
        caption: document.querySelector('.bd-caption')?.innerText,
        kpiCount: document.querySelectorAll('.bd-kpis article').length,
        actionCount: document.querySelectorAll('.bv-today article').length,
        wordCards: document.querySelectorAll('.bv-word-cards article').length,
        topRanks: document.querySelectorAll('.bv-ranks').length,
        costCharts: document.querySelectorAll('.bv-cost-chart svg').length,
        creatorLevels: document.querySelectorAll('.bv-level').length,
        statusStrips: document.querySelectorAll('.bv-status-strip').length,
        seoKeywords: document.querySelectorAll('.bv-seo-keywords article').length,
        noteRows: document.querySelectorAll('.bv-notes-table tbody tr').length,
        detailsCount: document.querySelectorAll('.business-daily details').length
      };
    });

    results.push({ ...tc, screenshot: shotPath, title, hasError, isBusinessDaily, isEmpty, info });
    await page.close();
  }

  console.log('测试折叠展开与明细分页交互...');
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:5246/projects/qicui?tab=daily&day=2026-10-13', { waitUntil: 'networkidle' });

  const detailsList = await page.locator('.business-daily details summary').all();
  console.log(`页面总共有 ${detailsList.length} 个折叠区`);
  for (let i = 0; i < Math.min(3, detailsList.length); i++) {
    await detailsList[i].click();
  }
  await page.waitForTimeout(500);
  const interactiveShot = path.join(SCREENSHOT_DIR, '10-13_details_expanded.png');
  await page.screenshot({ path: interactiveShot, fullPage: false });
  results.push({ name: 'details_expanded', screenshot: interactiveShot, detailsCount: detailsList.length });

  await page.close();
  await browser.close();

  console.log('所有真实浏览器验收完毕，写入结果报告...');
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'results.json'), JSON.stringify(results, null, 2));
}

run().catch(err => {
  console.error('验收执行失败:', err);
  process.exit(1);
});
