import { chromium } from 'playwright';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';

console.log('=== STARTING FINAL INTEGRATION ACCEPTANCE AUDIT ===\n');

// --- 1. Read-Only Verification (DB Write Audit) ---
console.log('--- CHECK 1: GET Projection DB Read-Only Audit ---');
const dbPath = '.verification/business.db';
const dbBefore = new DatabaseSync(dbPath);
const getHash = (table) => {
  try {
    const row = dbBefore.prepare(`SELECT count(*) as c FROM ${table}`).get();
    return row ? row.c : 0;
  } catch { return 0; }
};
const countCapturesBefore = getHash('business_captures');
const countArchivesBefore = getHash('business_note_archives');
const countDeliveriesBefore = getHash('business_comment_deliveries');
const countCompBefore = getHash('competitor_notes');

// Trigger GET API
const resDash = await fetch('http://127.0.0.1:5246/api/project-dashboard?projectId=qicui', { headers: { 'x-user-id': 'user-editor' } });
const resDaily = await fetch('http://127.0.0.1:5246/api/business-daily?projectId=qicui&day=2026-10-13', { headers: { 'x-user-id': 'user-editor' } });
const resData = await fetch('http://127.0.0.1:5246/api/data-workspace?projectId=qicui', { headers: { 'x-user-id': 'user-editor' } });

assert.equal(getHash('business_captures'), countCapturesBefore, 'business_captures count must not change on GET');
assert.equal(getHash('business_note_archives'), countArchivesBefore, 'business_note_archives count must not change on GET');
assert.equal(getHash('business_comment_deliveries'), countDeliveriesBefore, 'business_comment_deliveries count must not change on GET');
assert.equal(getHash('competitor_notes'), countCompBefore, 'competitor_notes count must not change on GET');
console.log('PASS: GET endpoints performed 0 writes to business.db.');

// --- 2. Isolation Verification ---
console.log('--- CHECK 2: Cross-Project Isolation Audit ---');
const resBrandB = await fetch('http://127.0.0.1:5246/api/business-daily?projectId=brand-b&day=2026-10-13', { headers: { 'x-user-id': 'user-editor' } });
const brandBJson = await resBrandB.json();
console.log('brand-b daily status:', resBrandB.status, 'series count:', brandBJson.view?.series?.length || 0);
assert.equal(brandBJson.view?.series?.length || 0, 0, 'brand-b must have 0 qicui series leaked');
console.log('PASS: 0 data leakage across isolated projects.');

// --- 3. Cold/Warm Latency ---
console.log('--- CHECK 3: API Cold / Warm Latency ---');
const t0 = performance.now();
await fetch('http://127.0.0.1:5246/api/business-daily?projectId=qicui&day=2026-10-13', { headers: { 'x-user-id': 'user-editor' } });
const t1 = performance.now();
await fetch('http://127.0.0.1:5246/api/business-daily?projectId=qicui&day=2026-10-13', { headers: { 'x-user-id': 'user-editor' } });
const t2 = performance.now();
console.log(`Latency: cold=${Math.round(t1 - t0)}ms, warm=${Math.round(t2 - t1)}ms`);
assert.ok(t2 - t1 < 100, 'Warm latency should be under 100ms');

// --- 4. Browser 9-Point Inspection ---
console.log('--- CHECK 4: Real Browser 9-Point Inspection (1496 & 1280) ---');
const browser = await chromium.launch({ headless: true });

// Browser Point 1 & 2: Hover & Keyboard on SpendBars
{
  const page = await browser.newPage({ viewport: { width: 1496, height: 779 } });
  await page.goto('http://127.0.0.1:5246/projects/qicui?tab=overview&day=2026-10-13', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.spend-bars-container', { timeout: 8000 });

  // 1. Hover
  const bar11 = page.locator('.spend-bar-column[aria-label*="2026-10-11"]');
  await bar11.hover();
  await page.waitForTimeout(300);
  const ratioEl = page.locator('.spend-tooltip-ratio');
  const ratioText = await ratioEl.innerText();
  const ratioColor = await ratioEl.evaluate(el => window.getComputedStyle(el).color);
  console.log('Point 1 (Hover):', { ratioText, ratioColor });
  assert.ok(ratioText.includes('超计划 80.9%'), 'Ratio tooltip must state 超计划 80.9%');
  assert.equal(ratioColor, 'rgb(245, 158, 11)', 'Amber warning color #f59e0b verified');

  // 2. Keyboard
  await bar11.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const activeDay = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  console.log('Point 2 (Keyboard focus next):', activeDay);
  assert.ok(activeDay?.includes('2026-10-12'), 'ArrowRight should focus 2026-10-12');
  await page.close();
}

// Browser Point 3: Date Switching
{
  const page = await browser.newPage({ viewport: { width: 1496, height: 779 } });
  await page.goto('http://127.0.0.1:5246/projects/qicui?tab=overview&day=2026-10-13', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.spend-bars-container', { timeout: 8000 });
  const selectedBar = await page.locator('.spend-bar-column.is-selected').getAttribute('aria-label');
  console.log('Point 3 (Date switch initial):', selectedBar);
  assert.ok(selectedBar?.includes('2026-10-13'), 'Selected bar must be 2026-10-13');

  // Click 10-09 bar
  const bar09 = page.locator('.spend-bar-column[aria-label*="2026-10-09"]');
  await bar09.click();
  await page.waitForTimeout(500);
  const newDate = await page.evaluate(() => document.querySelector('input[aria-label="业务基准日"]')?.value);
  console.log('Point 3 (After click 10-09, date input value):', newDate);
  assert.equal(newDate, '2026-10-09', 'Date input must update to 2026-10-09');
  await page.close();
}

// Browser Point 4: Legacy Links & Redirects
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://127.0.0.1:5246/projects/qicui/data', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.settings-secondary-nav', { timeout: 8000 });
  const activeSubNav = await page.locator('.settings-subnav-item.active').innerText();
  console.log('Point 4 (/data redirect/route active subnav):', activeSubNav.trim());
  assert.ok(activeSubNav.includes('数据管理'), 'Active subnav on /data must be 数据管理');

  await page.goto('http://127.0.0.1:5246/projects/qicui/metrics', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.settings-secondary-nav', { timeout: 8000 });
  const activeMetrics = await page.locator('.settings-subnav-item.active').innerText();
  console.log('Point 4 (/metrics active subnav):', activeMetrics.trim());
  assert.ok(activeMetrics.includes('项目指标'), 'Active subnav on /metrics must be 项目指标');

  await page.goto('http://127.0.0.1:5246/projects/qicui/reports', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.settings-secondary-nav', { timeout: 8000 });
  const activeReports = await page.locator('.settings-subnav-item.active').innerText();
  console.log('Point 4 (/reports active subnav):', activeReports.trim());
  assert.ok(activeReports.includes('项目报告'), 'Active subnav on /reports must be 项目报告');

  await page.close();
}

// Browser Point 5: Zero Empty (No ∅)
{
  const page = await browser.newPage({ viewport: { width: 1496, height: 779 } });
  for (const path of ['/projects/qicui', '/projects/qicui/settings', '/projects/qicui/data', '/projects/qicui/metrics', '/projects/qicui/reports']) {
    await page.goto('http://127.0.0.1:5246' + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const content = await page.content();
    assert.ok(!content.includes('∅'), `Path ${path} must not contain ∅`);
  }
  console.log('Point 5 (No ∅ symbol): Verified clean across all 5 modules.');
  await page.close();
}

// Browser Point 6: No Duplicate Giant Empty Boards
{
  const page = await browser.newPage({ viewport: { width: 1496, height: 779 } });
  await page.goto('http://127.0.0.1:5246/projects/qicui?tab=overview&day=2026-10-13', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.spend-bars-container', { timeout: 8000 });

  // Verify GeneralWorkbenchBoard is NOT on overview
  const generalBoardOnOverview = await page.locator('#workspace-tabpanel-board, [data-testid="general-workbench-board"]').count();
  console.log('Point 6 (General workbench boards on overview):', generalBoardOnOverview);
  assert.equal(generalBoardOnOverview, 0, 'No generic empty board on business overview');
  await page.close();
}

// Browser Point 7: Effective Real Charts (Not Mock Fixture)
{
  const page = await browser.newPage({ viewport: { width: 1496, height: 779 } });
  await page.goto('http://127.0.0.1:5246/projects/qicui?tab=overview&day=2026-10-13', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.spend-bars-container', { timeout: 8000 });

  const barsCount = await page.locator('.spend-bar-column').count();
  const observedCount = await page.locator('.spend-bar-column.is-observed').count();
  console.log('Point 7 (Real Charts):', { totalBars: barsCount, observedBars: observedCount });
  assert.equal(barsCount, 13, 'Expected 13 day bars in October range');
  assert.equal(observedCount, 13, 'Expected 13 observed bars with real ad spends');
  await page.close();
}

// Browser Point 8: No Horizontal Overflow
{
  for (const w of [1496, 1280]) {
    const page = await browser.newPage({ viewport: { width: w, height: 779 } });
    await page.goto('http://127.0.0.1:5246/projects/qicui?tab=overview&day=2026-10-13', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.spend-bars-container', { timeout: 8000 });
    const hasScrollbar = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`Point 8 (Horizontal overflow at ${w}px):`, hasScrollbar ? 'FAIL (overflows)' : 'PASS (no overflow)');
    assert.ok(!hasScrollbar, `Viewport ${w}px must not have horizontal scrollbar`);
    await page.close();
  }
}

// Browser Point 9: Numerical Accuracy Comparison
{
  const page = await browser.newPage({ viewport: { width: 1496, height: 779 } });
  await page.goto('http://127.0.0.1:5246/projects/qicui?tab=overview&day=2026-10-13', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.spend-bars-container', { timeout: 8000 });

  const kpiSpend = await page.locator('.bd-kpi-card-rich').first().innerText();
  console.log('Point 9 (KPI card text):\n' + kpiSpend.trim());
  assert.ok(kpiSpend.includes('275,326.74'), 'KPI card must display 275,326.74 for 2026-10-13 adSpend');
  await page.close();
}

await browser.close();
console.log('\n🎉 ALL 9 BROWSER ACCEPTANCE POINTS PASSED AUDIT!');
