import { chromium } from 'playwright';
import assert from 'node:assert';

async function test() {
  console.log('Testing GeneralWorkbenchBoard in Settings tab...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1496, height: 900 } });

  // 1. Visit /projects/qicui/settings?tab=board
  await page.goto('http://127.0.0.1:5246/projects/qicui/settings?tab=board');
  await page.waitForTimeout(1000);

  const subNavActive = await page.locator('.settings-subnav-item.active').innerText();
  console.log('Active subnav in ?tab=board:', subNavActive.trim());
  assert.ok(subNavActive.includes('团队看板'), 'Active subnav should be 团队看板');

  // Verify GeneralWorkbenchBoard is rendered
  const boardEl = page.locator('#workspace-tabpanel-board');
  const isVisible = await boardEl.isVisible();
  console.log('Board panel visible:', isVisible);
  assert.ok(isVisible, 'Board panel must be visible');

  // Check action buttons in GeneralWorkbenchBoard
  const buttons = await boardEl.locator('button').allInnerTexts();
  console.log('Board panel buttons:', buttons.map(b => b.trim()));

  // 2. Click between tabs
  const profileTab = page.locator('.settings-subnav-item', { hasText: '项目资料' });
  await profileTab.click();
  await page.waitForTimeout(500);
  assert.ok(page.url().includes('tab=profile'), 'URL should have tab=profile');

  const boardTab = page.locator('.settings-subnav-item', { hasText: '团队看板' });
  await boardTab.click();
  await page.waitForTimeout(500);
  assert.ok(page.url().includes('tab=board'), 'URL should have tab=board');

  await browser.close();
  console.log('GeneralWorkbenchBoard in Settings verified successfully!');
}
test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
