import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve('styles/business-daily.css');
const tsxPath = path.resolve('features/overview/BusinessDailyBoard.tsx');

test('business-daily responsive layout & high specificity for mobile viewport', () => {
  const css = fs.readFileSync(cssPath, 'utf8');

  // 1. Selector specificity beats dashboard-template.css:525
  assert.ok(
    css.includes('.business-daily .bd-kpi-grid-rich'),
    'Must use scoped selector .business-daily .bd-kpi-grid-rich to beat dashboard-template.css'
  );

  // 2. Responsive 2-cols at <= 640px and 1-col at <= 360px
  assert.match(
    css,
    /@media\s*\(max-width:\s*640px\)[\s\S]*?\.business-daily\s+\.bd-kpi-grid-rich[\s\S]*?repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    'At <= 640px, KPI grid must adapt to 2 columns'
  );
  assert.match(
    css,
    /@media\s*\(max-width:\s*360px\)[\s\S]*?\.business-daily\s+\.bd-kpi-grid-rich[\s\S]*?grid-template-columns:\s*1fr/,
    'At <= 360px, KPI grid must drop to 1 column to avoid crushing amounts'
  );

  // 3. Localized scroll containment prevents page-level viewport expansion
  assert.ok(
    css.includes('.business-daily .bd-scroll'),
    'Scrollable tables must be scoped under .business-daily'
  );
  assert.match(
    css,
    /\.business-daily\s+\.bd-scroll\s*\{[^}]*overflow-x:\s*auto/,
    '.bd-scroll must have overflow-x: auto for localized horizontal scrolling'
  );

  // 4. No spinning animation or gratuitous micro transitions in toolbar
  assert.ok(!css.includes('@keyframes bd-spin'), 'Keyframes bd-spin must be removed');
  assert.ok(!css.includes('.bd-reload-icon.is-spinning'), 'Spinning class must be removed');
  assert.ok(!css.includes('transition: all 150ms ease-out'), 'Gratuitous 150ms transitions in toolbar must be removed');

  // 5. Mobile insight card and keywords ranking containment (preventing 599px stretch)
  assert.match(
    css,
    /\.business-daily\s+\.bd-insight-lead-wrap\s*\{[^}]*min-width:\s*0/,
    '.bd-insight-lead-wrap must reset min-width to 0 on mobile'
  );
  assert.match(
    css,
    /\.business-daily\s+\.bd-keywords-top-container\s+\.bv-ranks\s*\{[^}]*grid-template-columns:\s*1fr/,
    '.bd-keywords-top-container .bv-ranks must collapse to 1 column on mobile'
  );
  assert.match(
    css,
    /\.business-daily\s+\.bd-aspect-details-grid\s*\{[^}]*grid-template-columns:\s*1fr/,
    '.bd-aspect-details-grid must collapse to 1 column on mobile'
  );

  // 6. Baseline benchmark area must stack vertically with font 12 to prevent 535px horizontal blowout
  assert.match(
    css,
    /\.business-daily\s+\.bd-kpi-bench[\s\S]*?\{[^}]*flex-direction:\s*column/,
    '.bd-kpi-bench must stack label and amount vertically'
  );
  assert.match(
    css,
    /\.business-daily\s+\.bd-kpi-bench\s+strong[\s\S]*?\{[^}]*font-size:\s*12px/,
    '.bd-kpi-bench strong must be constrained to 12px font size'
  );

  // 7. Word cards must collapse to 1 column at <= 360px to prevent 330px blowout on 320px screens
  assert.match(
    css,
    /@media\s*\(max-width:\s*360px\)[\s\S]*?\.business-daily\s+\.bv-word-cards[\s\S]*?grid-template-columns:\s*1fr/,
    '.bv-word-cards must collapse to 1 column at <= 360px'
  );
});

test('BusinessDailyBoard UI structure and date contract integrity', () => {
  const tsx = fs.readFileSync(tsxPath, 'utf8');

  // 1. Loading text + disabled without spinning class
  assert.ok(
    tsx.includes("{busy || queryLoading ? '加载中…' : '重新加载'}"),
    'Reload button must display static loading text when busy or loading'
  );
  assert.ok(
    !tsx.includes('is-spinning'),
    'JSX must not attach is-spinning class to reload SVG'
  );
  assert.ok(
    tsx.includes('disabled={busy || queryLoading}'),
    'Reload button must disable on busy || queryLoading'
  );

  // 2. Clean 2-layer white card + independent planar nav
  assert.ok(tsx.includes('bd-cockpit-primary-row'), 'Must have primary row');
  assert.ok(tsx.includes('bd-cockpit-meta-row'), 'Must have lightweight meta row');
  assert.ok(tsx.includes('bd-planar-nav'), 'Planar nav must exist outside the toolbar card');
  assert.ok(!tsx.includes('bd-section-nav-label'), 'Redundant 快速定位 label must be removed');
  assert.ok(!tsx.includes('⚡'), 'Lightning icon must be removed');

  // 3. Day resolution contract: strict ISO date validation and dynamic latest fallback
  assert.ok(tsx.includes('isValidIsoDate'), 'Must import and use isValidIsoDate');
  assert.ok(!tsx.includes("'2026-10-15'"), 'Hardcoded 2026-10-15 must be removed');
  assert.match(
    tsx,
    /latestDate=\{[\s\S]*?view\?\.defaultDay[\s\S]*?view\?\.latestReportDay/,
    'DayNavigator latestDate must look up defaultDay or latestReportDay to allow jumping from historical day'
  );

  // 4. Insight lead wrap inline minWidth must be 0 to avoid mobile blowout
  assert.ok(
    !tsx.includes('minWidth: 260'),
    'Inline minWidth: 260 must be removed from BusinessDailyBoard.tsx'
  );

  // 5. Keyword titles must remove （底表累计） and dynamic keywordScope must be wired
  assert.ok(
    !tsx.includes('高消耗关键词排行（底表累计）'),
    'Title must not contain hardcoded （底表累计）'
  );
  assert.ok(
    tsx.includes('keywordScope'),
    'Must compute and use keywordScope from tables or highlights'
  );
});
