import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1496, height: 900 } });
  await page.goto('http://127.0.0.1:5246/projects/qicui?tab=overview&day=2026-10-13');
  await page.waitForTimeout(1000);
  const state = await page.evaluate(() => {
    const dateInput = document.querySelector('input[aria-label="业务基准日"], input[aria-label="业务日期"]');
    const spendBarSelected = document.querySelector('.spend-bar-column.is-selected');
    const kpiBenchmark = document.querySelector('.bd-kpi-card-rich span');
    return {
      dateInputValue: dateInput ? dateInput.value : null,
      spendBarSelectedLabel: spendBarSelected ? spendBarSelected.getAttribute('aria-label') : null,
      kpiBenchmarkText: kpiBenchmark ? kpiBenchmark.textContent : null,
      url: window.location.href
    };
  });
  console.log('Page state at day=2026-10-13:', state);
  await browser.close();
}
run();
