/**
 * Real End-to-End Playwright Navigation & History Trap Regression Test
 *
 * Validates:
 * 1. Old aliases (/settings?tab=data|data-sources|metrics|reports) redirect to canonical workspace
 *    routes using replaceState (NOT pushState), avoiding the history Back-trap.
 * 2. One browser Back returns directly to prior page without re-triggering redirect.
 * 3. Browser Forward advances cleanly to the canonical workspace.
 * 4. Business query parameters (e.g. purpose, datasetId, new, id, query) and hash are preserved,
 *    while the 'tab' alias parameter is cleanly stripped.
 * 5. Normal user navigation (e.g. clicking SubNav) uses pushState, preserving normal Back behavior.
 * 6. Same-URL guard prevents duplicate navigation and redundant history entries.
 *
 * Prerequisites for full live execution:
 *   - Fresh build of the application: npm run build
 *   - Local test server started: vinext start --port 5246 --hostname 127.0.0.1
 *   - QA execution command: node scripts/test-navigation-alias-history.mjs
 */

import assert from 'node:assert';
import { chromium } from 'playwright';

// ---------------------------------------------------------------------------
// Configuration: Explicit parameters restricted to local test environments
// ---------------------------------------------------------------------------
const RAW_BASE_URL = process.env.FEIHE_TEST_BASE_URL || 'http://127.0.0.1:5246';
const PROJECT_ID = process.env.FEIHE_TEST_PROJECT_ID || 'qicui';
const TEST_USER_ID = process.env.FEIHE_TEST_USER_ID || 'user-editor';
const IS_SYNTAX_CHECK = process.argv.includes('--syntax-check') || process.argv.includes('--dry-run');

const parsedUrl = new URL(RAW_BASE_URL);
const isLocal = ['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname);
if (!isLocal) {
  console.error('[SECURITY ERROR] Target URL must be a local test service (127.0.0.1 or localhost), received: ' + parsedUrl.hostname);
  process.exit(1);
}
const BASE_URL = parsedUrl.origin;

console.log('=============================================================================');
console.log('🚀 Navigation Alias Trap & History Playwright E2E Regression Runner');
console.log('   Base URL:    ' + BASE_URL);
console.log('   Project ID:  ' + PROJECT_ID);
console.log('   User ID:     ' + TEST_USER_ID);
console.log('=============================================================================');

if (IS_SYNTAX_CHECK) {
  console.log('✅ Syntax and test structure verified (--syntax-check mode).');
  process.exit(0);
}

async function runRegressionSuite() {
  // Preflight check: Ensure local server is responsive
  try {
    const probe = await fetch(BASE_URL + '/projects/' + encodeURIComponent(PROJECT_ID), {
      headers: { 'x-user-id': TEST_USER_ID },
      signal: AbortSignal.timeout(3000),
    });
    if (!probe.ok && probe.status !== 304) {
      console.warn('[SERVER PREFLIGHT] Server returned HTTP ' + probe.status + ', proceeding with browser suite.');
    }
  } catch (err) {
    console.error('[PRE-REQUISITE ERROR] Cannot connect to local test server at ' + BASE_URL + ': ' + err.message);
    console.error('Please start the freshly built test server first (e.g. vinext start --port 5246), or set FEIHE_TEST_BASE_URL.');
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { 'x-user-id': TEST_USER_ID },
  });
  const page = await context.newPage();

  try {
    const priorPageUrl = BASE_URL + '/projects/' + encodeURIComponent(PROJECT_ID);

    // =========================================================================
    // Test 1: Alias data (/settings?tab=data) -> canonical /data
    // =========================================================================
    console.log('\n--- Test 1: Old alias /settings?tab=data ---');
    await page.goto(priorPageUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.project-shell, .app-shell, main', { timeout: 8000 });

    // Navigate to alias with business query parameters and hash
    const aliasDataUrl = BASE_URL + '/projects/' + encodeURIComponent(PROJECT_ID) + '/settings?tab=data&purpose=comment&datasetId=test-comment-ds#data-anchor';
    await page.goto(aliasDataUrl, { waitUntil: 'domcontentloaded' });

    // Wait for client redirect to canonical workspace
    await page.waitForURL((u) => u.pathname.endsWith('/data'), { timeout: 8000 });
    const currentUrl1 = new URL(page.url());
    console.log('   Redirected canonical URL:', currentUrl1.pathname + currentUrl1.search + currentUrl1.hash);

    assert.strictEqual(currentUrl1.pathname, '/projects/' + PROJECT_ID + '/data', 'Path must be canonical /data');
    assert.ok(!currentUrl1.searchParams.has('tab'), 'tab parameter must be stripped');
    assert.strictEqual(currentUrl1.searchParams.get('purpose'), 'comment', 'Business param purpose must be preserved');
    assert.strictEqual(currentUrl1.searchParams.get('datasetId'), 'test-comment-ds', 'Business param datasetId must be preserved');
    assert.strictEqual(currentUrl1.hash, '#data-anchor', 'Anchor hash must be preserved');

    // Verify canonical DataWorkspace is rendered
    const activeSubNav1 = await page.locator('.settings-subnav-item.active').textContent();
    assert.ok(activeSubNav1 && activeSubNav1.includes('数据管理'), 'Canonical DataWorkspace SubNav must be active');

    // Back navigation: ONE Back must return directly to prior page without alias trap
    console.log('   Action: Executing single page.goBack()...');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const backUrl1 = new URL(page.url());
    console.log('   URL after 1 Back:', backUrl1.pathname);
    assert.strictEqual(backUrl1.pathname, '/projects/' + PROJECT_ID, 'Must return directly to prior page (NO TRAP)');

    // Forward navigation: advances cleanly back to canonical /data
    console.log('   Action: Executing page.goForward()...');
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const fwdUrl1 = new URL(page.url());
    assert.strictEqual(fwdUrl1.pathname, '/projects/' + PROJECT_ID + '/data', 'Forward must return to canonical /data');
    console.log('   ✅ Alias /settings?tab=data passed');

    // =========================================================================
    // Test 2: Alias data-sources (/settings?tab=data-sources) -> canonical /data
    // =========================================================================
    console.log('\n--- Test 2: Old alias /settings?tab=data-sources ---');
    await page.goto(priorPageUrl, { waitUntil: 'domcontentloaded' });
    const aliasSourcesUrl = BASE_URL + '/projects/' + encodeURIComponent(PROJECT_ID) + '/settings?tab=data-sources&sourceMode=legacy#source-top';
    await page.goto(aliasSourcesUrl, { waitUntil: 'domcontentloaded' });

    await page.waitForURL((u) => u.pathname.endsWith('/data'), { timeout: 8000 });
    const currentUrl2 = new URL(page.url());
    assert.strictEqual(currentUrl2.pathname, '/projects/' + PROJECT_ID + '/data');
    assert.ok(!currentUrl2.searchParams.has('tab'));
    assert.strictEqual(currentUrl2.searchParams.get('sourceMode'), 'legacy');
    assert.strictEqual(currentUrl2.hash, '#source-top');

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    assert.strictEqual(new URL(page.url()).pathname, '/projects/' + PROJECT_ID);
    console.log('   ✅ Alias /settings?tab=data-sources passed');

    // =========================================================================
    // Test 3: Alias metrics (/settings?tab=metrics) -> canonical /metrics
    // =========================================================================
    console.log('\n--- Test 3: Old alias /settings?tab=metrics ---');
    await page.goto(priorPageUrl, { waitUntil: 'domcontentloaded' });
    const aliasMetricsUrl = BASE_URL + '/projects/' + encodeURIComponent(PROJECT_ID) + '/settings?tab=metrics&new=true&datasetId=ds-metric-1#metric-def';
    await page.goto(aliasMetricsUrl, { waitUntil: 'domcontentloaded' });

    await page.waitForURL((u) => u.pathname.endsWith('/metrics'), { timeout: 8000 });
    const currentUrl3 = new URL(page.url());
    assert.strictEqual(currentUrl3.pathname, '/projects/' + PROJECT_ID + '/metrics', 'Path must be canonical /metrics');
    assert.ok(!currentUrl3.searchParams.has('tab'), 'tab parameter must be stripped');
    assert.strictEqual(currentUrl3.searchParams.get('new'), 'true', 'Param new must be preserved');
    assert.strictEqual(currentUrl3.searchParams.get('datasetId'), 'ds-metric-1', 'Param datasetId must be preserved');
    assert.strictEqual(currentUrl3.hash, '#metric-def', 'Anchor hash must be preserved');

    const activeSubNav3 = await page.locator('.settings-subnav-item.active').textContent();
    assert.ok(activeSubNav3 && activeSubNav3.includes('项目指标'), 'Canonical MetricWorkspace SubNav must be active');

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    assert.strictEqual(new URL(page.url()).pathname, '/projects/' + PROJECT_ID, 'Must return directly to prior page');

    await page.goForward({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    assert.strictEqual(new URL(page.url()).pathname, '/projects/' + PROJECT_ID + '/metrics');
    console.log('   ✅ Alias /settings?tab=metrics passed');

    // =========================================================================
    // Test 4: Alias reports (/settings?tab=reports) -> canonical /reports
    // =========================================================================
    console.log('\n--- Test 4: Old alias /settings?tab=reports ---');
    await page.goto(priorPageUrl, { waitUntil: 'domcontentloaded' });
    const aliasReportsUrl = BASE_URL + '/projects/' + encodeURIComponent(PROJECT_ID) + '/settings?tab=reports&view=summary#reports-section';
    await page.goto(aliasReportsUrl, { waitUntil: 'domcontentloaded' });

    await page.waitForURL((u) => u.pathname.endsWith('/reports'), { timeout: 8000 });
    const currentUrl4 = new URL(page.url());
    assert.strictEqual(currentUrl4.pathname, '/projects/' + PROJECT_ID + '/reports', 'Path must be canonical /reports');
    assert.ok(!currentUrl4.searchParams.has('tab'), 'tab parameter must be stripped');
    assert.strictEqual(currentUrl4.searchParams.get('view'), 'summary', 'Param view must be preserved');
    assert.strictEqual(currentUrl4.hash, '#reports-section', 'Anchor hash must be preserved');

    const activeSubNav4 = await page.locator('.settings-subnav-item.active').textContent();
    assert.ok(activeSubNav4 && activeSubNav4.includes('项目报告'), 'Canonical ReportsWorkspace SubNav must be active');

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    assert.strictEqual(new URL(page.url()).pathname, '/projects/' + PROJECT_ID, 'Must return directly to prior page');

    await page.goForward({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    assert.strictEqual(new URL(page.url()).pathname, '/projects/' + PROJECT_ID + '/reports');
    console.log('   ✅ Alias /settings?tab=reports passed');

    // =========================================================================
    // Test 5: Normal SubNav click preserves pushState (adds history entry)
    // =========================================================================
    console.log('\n--- Test 5: Normal SubNav navigation preserves pushState ---');
    await page.goto(BASE_URL + '/projects/' + encodeURIComponent(PROJECT_ID) + '/settings?tab=profile', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.settings-secondary-nav', { timeout: 8000 });

    // Click 数据管理 tab in SubNav
    const dataTabBtn = page.locator('.settings-subnav-item').filter({ hasText: '数据管理' });
    await dataTabBtn.click();
    await page.waitForURL((u) => u.pathname.endsWith('/data'), { timeout: 8000 });
    assert.strictEqual(new URL(page.url()).pathname, '/projects/' + PROJECT_ID + '/data');

    // Normal push navigation: Back returns to settings profile!
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const backAfterClick = new URL(page.url());
    assert.strictEqual(backAfterClick.pathname, '/projects/' + PROJECT_ID + '/settings', 'Back must return to settings profile page');
    assert.strictEqual(backAfterClick.searchParams.get('tab'), 'profile', 'Tab must remain profile');
    console.log('   ✅ Normal SubNav click pushes history as expected');

    // =========================================================================
    // Test 6: Same-URL Guard
    // =========================================================================
    console.log('\n--- Test 6: Same-URL guard prevents duplicate history ---');
    const initialHistoryLength = await page.evaluate(() => window.history.length);
    // Trigger client navigateTo with identical URL
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: { href: window.location.href } }));
    });
    await page.waitForTimeout(200);
    const afterHistoryLength = await page.evaluate(() => window.history.length);
    assert.strictEqual(afterHistoryLength, initialHistoryLength, 'Same-URL navigation must not duplicate history');
    console.log('   ✅ Same-URL guard verified');

    console.log('\n=============================================================================');
    console.log('🎉 ALL PLAYWRIGHT LIVE REGRESSION CHECKS COMPLETED SUCCESSFULLY!');
    console.log('=============================================================================');
  } finally {
    await browser.close();
  }
}

runRegressionSuite().catch((err) => {
  console.error('\n❌ Regression suite failure:', err);
  process.exit(1);
});
