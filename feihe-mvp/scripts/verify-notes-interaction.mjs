import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert';

async function run() {
  console.log('--- Starting Notes Interaction & Detail Verification ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const outDir = path.resolve('output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 1. Visit competitor page
  console.log('1. Navigating to competitor monitor...');
  await page.goto('http://127.0.0.1:5246/projects/qicui/growth?tab=competitor', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.competitor-monitor', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Check brand table has 3 brands
  const brandTable = page.locator('table.comp-table').first();
  await brandTable.waitFor({ state: 'visible', timeout: 5000 });
  const brandTableRows = brandTable.locator('tbody tr');
  const rowCount = await brandTableRows.count();
  console.log(`Brand table rows: ${rowCount}`);
  assert.ok(rowCount >= 3, 'Must have at least 3 brands in brand table');

  // Verify text of brands
  const tableText = await brandTable.innerText();
  assert.ok(tableText.includes('待识别品牌'), 'Must show 待识别品牌');
  assert.ok(tableText.includes('合生元'), 'Must show 合生元');
  assert.ok(tableText.includes('金领冠'), 'Must show 金领冠');

  // 2. Click "合生元" in brand table
  console.log('2. Clicking 合生元 in brand table...');
  const hsyBtn = page.locator('button:has-text("合生元")').first();
  await hsyBtn.click();

  // Wait for filter to apply
  await page.waitForTimeout(1000);
  const filterTag = page.locator('text=已筛选: 合生元');
  await filterTag.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Brand filter applied: 合生元');

  // Check evidence list subtitle or pagination
  const evidenceSub = await page.locator('small:has-text("显示真实发布时间")').innerText();
  console.log('Evidence subtitle:', evidenceSub);
  assert.ok(evidenceSub.includes('16 篇'), 'Evidence list total must be 16 for 合生元');

  // Verify brand table STILL shows all brands (did not collapse)
  const rowsAfterFilter = await brandTableRows.count();
  console.log(`Brand table rows after filter: ${rowsAfterFilter}`);
  assert.strictEqual(rowsAfterFilter, 3, 'Brand table must keep all 3 brands after filter');

  const shot1 = path.join(outDir, 'notes-verify-01-brand-filter-heshengyuan.png');
  await page.screenshot({ path: shot1, fullPage: false });
  console.log('Screenshot 1 saved:', shot1);

  // 3. Test Risk Card sample note click
  console.log('3. Testing Risk Card representative note click...');
  const riskDetailBtn = page.locator('.comp-issue-card button:has-text("详情 →")').first();
  const sampleNoteTitle = await riskDetailBtn.evaluate(el => {
    const parent = el.closest('.comp-issue-excerpt');
    return parent ? parent.querySelector('button')?.innerText || '' : '';
  });
  console.log('Clicking risk sample note:', sampleNoteTitle);
  await riskDetailBtn.click();

  // Wait for drawer to appear
  await page.waitForSelector('.drawer', { state: 'visible', timeout: 5000 });
  const drawerTitle = await page.locator('.drawer h2').innerText();
  console.log('Drawer opened with title:', drawerTitle);
  assert.ok(drawerTitle.length > 0, 'Drawer title must not be empty');

  // Check drawer content shows honest content and valid links
  const drawerContent = await page.locator('.drawer').innerText();
  assert.ok(drawerContent.includes('NOTE DETAIL'), 'Drawer must be NOTE DETAIL');

  const shot2 = path.join(outDir, 'notes-verify-02-risk-sample-drawer.png');
  await page.screenshot({ path: shot2, fullPage: false });
  console.log('Screenshot 2 saved:', shot2);

  // 4. Test closing drawer with Escape key and verifying filter retention
  console.log('4. Pressing Escape to close drawer...');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.drawer', { state: 'hidden', timeout: 5000 });
  console.log('Drawer closed via Escape key.');

  // Verify filter is STILL retained
  const filterTagAfterEsc = await page.locator('text=已筛选: 合生元').isVisible();
  assert.ok(filterTagAfterEsc, 'Brand filter must be retained after closing drawer');
  console.log('Verified: Brand filter is retained after closing drawer.');

  // 5. Click an evidence note title
  console.log('5. Clicking evidence note title in filtered table...');
  const evidenceTable = page.locator('table.comp-table').nth(1);
  const firstNoteBtn = evidenceTable.locator('tbody tr button').first();
  const noteTitle = await firstNoteBtn.innerText();
  console.log('Clicking note in evidence table:', noteTitle);
  await firstNoteBtn.click();

  await page.waitForSelector('.drawer', { state: 'visible', timeout: 5000 });
  const shot3 = path.join(outDir, 'notes-verify-03-competitor-note-drawer.png');
  await page.screenshot({ path: shot3, fullPage: false });
  console.log('Screenshot 3 saved:', shot3);

  // Close drawer with close button
  console.log('Closing drawer via close button...');
  await page.locator('.drawer-close').click();
  await page.waitForSelector('.drawer', { state: 'hidden', timeout: 5000 });

  // 6. Test switching filter to "待识别品牌"
  console.log('6. Switching brand filter to 待识别品牌...');
  const unknownBtn = page.locator('button:has-text("待识别品牌")').first();
  await unknownBtn.click();
  await page.waitForTimeout(1000);
  const unknownSub = await page.locator('small:has-text("显示真实发布时间")').innerText();
  console.log('Unknown evidence subtitle:', unknownSub);
  assert.ok(unknownSub.includes('26 篇'), 'Evidence list total must be 26 for 待识别品牌');

  const shot4 = path.join(outDir, 'notes-verify-04-brand-filter-unknown.png');
  await page.screenshot({ path: shot4, fullPage: false });
  console.log('Screenshot 4 saved:', shot4);

  // 7. Test 本品 note detail on /projects/qicui/content
  console.log('7. Navigating to /projects/qicui/content for 本品 note verification...');
  await page.goto('http://127.0.0.1:5246/projects/qicui/content', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const ownedNoteBtn = page.locator('button:has-text("查看笔记明细 →")').first();
  const ownedCount = await ownedNoteBtn.count();
  console.log(`Found ${ownedCount} owned note detail buttons`);
  assert.ok(ownedCount > 0, 'Must have owned note detail button');

  console.log('Clicking 本品 note element...');
  await ownedNoteBtn.click();
  await page.waitForSelector('.drawer', { state: 'visible', timeout: 8000 });
  const ownedDrawerTitle = await page.locator('.drawer h2').innerText();
  console.log('本品 Drawer opened with title:', ownedDrawerTitle);
  assert.ok(ownedDrawerTitle.length > 0, 'Owned note drawer must have title');

  // Verify content fallback wording
  const ownedDrawerText = await page.locator('.drawer').innerText();
  console.log('Drawer text preview:\n', ownedDrawerText.slice(0, 300));
  assert.ok(ownedDrawerText.includes('NOTE DETAIL'), 'Must open NOTE DETAIL drawer');
  assert.ok(ownedDrawerText.includes('源数据未提供') || ownedDrawerText.includes('笔记正文与切角'), 'Must show honest content or fallback');

  const shot5 = path.join(outDir, 'notes-verify-05-owned-note-drawer.png');
  await page.screenshot({ path: shot5, fullPage: false });
  console.log('Screenshot 5 saved:', shot5);

  // Close drawer
  await page.locator('.drawer-close').click();
  await page.waitForSelector('.drawer', { state: 'hidden', timeout: 5000 });

  // 8. Test Radar note detail on /projects/qicui/growth?tab=radar
  console.log('8. Navigating to /projects/qicui/growth?tab=radar for Radar note verification...');
  await page.goto('http://127.0.0.1:5246/projects/qicui/growth?tab=radar', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const radarBtn = page.locator('button:has-text("查看笔记明细 →")').first();
  if (await radarBtn.count() > 0) {
    await radarBtn.click();
    await page.waitForSelector('.drawer', { state: 'visible', timeout: 8000 });
    const radarTitle = await page.locator('.drawer h2').innerText();
    console.log('Radar Drawer opened with title:', radarTitle);
    const shot6 = path.join(outDir, 'notes-verify-06-radar-note-drawer.png');
    await page.screenshot({ path: shot6, fullPage: false });
    console.log('Screenshot 6 saved:', shot6);
  }

  await browser.close();
  console.log('--- All verifications completed successfully ---');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
