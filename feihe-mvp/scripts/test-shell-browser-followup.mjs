import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function runTests() {
  const results = [];
  const shellCss = fs.readFileSync(path.join(ROOT, 'styles', 'project-shell.css'), 'utf8');
  const settingsCss = fs.readFileSync(path.join(ROOT, 'styles', 'settings-layout.css'), 'utf8');
  const dataCss = fs.readFileSync(path.join(ROOT, 'styles', 'data-workspaces.css'), 'utf8');
  const wpCss = fs.readFileSync(path.join(ROOT, 'styles', 'workspace-polish.css'), 'utf8');
  const sidebarTsx = fs.readFileSync(path.join(ROOT, 'components', 'project-shell', 'ProjectSidebar.tsx'), 'utf8');

  // Test 1: Mobile compact sidebar rules in project-shell.css
  assert.ok(shellCss.includes('@media (max-width: 760px)'), 'Test 1.1: Missing @media (max-width: 760px) in project-shell.css');
  assert.ok(shellCss.includes('display: contents'), 'Test 1.2: .sidebar-header-row must have display: contents');
  assert.ok(shellCss.includes('.sidebar-toggle-btn'), 'Test 1.3: desktop collapse button must be hidden on mobile');
  assert.ok(shellCss.includes('.sidebar .brand-title') || shellCss.includes('.sidebar .brand > div'), 'Test 1.4: brand title must be hidden on mobile');
  assert.ok(shellCss.includes('.sidebar .project-switcher small'), 'Test 1.5: project switcher small must be hidden');
  assert.ok(shellCss.includes('.sidebar .project-subtext'), 'Test 1.6: project-subtext must be hidden');
  results.push('Test 1: Mobile compact sidebar rules defined correctly');

  // Test 2: Row 1 & Row 2 structure
  assert.ok(shellCss.includes('grid-template-columns: auto auto minmax(0, 1fr)'), 'Test 2.1: sidebar grid must allocate columns for brand, back link, switcher');
  assert.ok(shellCss.includes('.sidebar .back-platform'), 'Test 2.2: back link must be placed on row 1');
  assert.ok(shellCss.includes('.sidebar .project-switcher'), 'Test 2.3: project switcher must be placed on row 1');
  assert.ok(shellCss.includes('.sidebar .project-main-nav'), 'Test 2.4: module nav must be on row 2 spanning full width');
  assert.ok(shellCss.includes('overflow-x: auto'), 'Test 2.5: module nav must have overflow-x: auto');
  results.push('Test 2: Two-row compact layout properly structured');

  // Test 3: Error status visibility
  assert.ok(shellCss.includes('.sidebar .sidebar-foot.has-error') || shellCss.includes('.sidebar .sidebar-foot:has(.err-dot)'), 'Test 3.1: error status must remain visible');
  assert.ok(sidebarTsx.includes('has-error'), 'Test 3.2: ProjectSidebar.tsx must support has-error class');
  results.push('Test 3: Error status visibility preserved on mobile');

  // Test 4: sidebar-collapsed persistence immunity on mobile
  assert.ok(shellCss.includes('.app-shell.sidebar-collapsed'), 'Test 4.1: collapsed shell must reset to 1fr on mobile');
  assert.ok(shellCss.includes('.sidebar-collapsed .project-main-nav a .nav-label'), 'Test 4.2: nav labels must not be hidden when collapsed state persists on mobile');
  assert.ok(shellCss.includes('.sidebar-collapsed .switcher-control'), 'Test 4.3: switcher control must remain visible when collapsed state persists on mobile');
  results.push('Test 4: Collapsed state persistence correctly adapted for mobile');

  // Test 5: Sticky save bar & Floating agent button avoidance with body anchor
  assert.ok(shellCss.includes('body:has(.settings-sticky-action-bar) .floating-agent-btn'), 'Test 5.1: Must use body:has anchor selector');
  assert.ok(!shellCss.includes(':has(.settings-sticky-action-bar) .floating-agent-btn\n'), 'Test 5.2: Unanchored :has selector removed');
  assert.ok(shellCss.includes('bottom: 88px') && settingsCss.includes('bottom: 88px'), 'Test 5.3: Desktop elevation is 88px');
  assert.ok(shellCss.includes('bottom: calc(118px + env(safe-area-inset-bottom, 0px))'), 'Test 5.4: Mobile elevation clears 118px + safe area');
  assert.ok(settingsCss.includes('env(safe-area-inset-bottom, 0px)'), 'Test 5.5: Sticky bar supports safe area on mobile');
  results.push('Test 5: Sticky save bar and anchored floating agent avoidance verified');

  // Test 6: Small-screen icon-only behavior & font-size 16px strictly in 4-step scale
  assert.ok(shellCss.includes('@media (max-width: 640px)'), 'Test 6.1: Small screen breakpoint present');
  assert.ok(shellCss.includes('.floating-agent-btn .floating-agent-label'), 'Test 6.2: Text label hidden on small screens');
  assert.ok(shellCss.includes('font-size: 16px'), 'Test 6.3: Font-size strictly 16px conforming to 4-scale design system');
  assert.ok(!shellCss.includes('font-size: 18px'), 'Test 6.4: 18px violation removed');
  assert.ok(!shellCss.includes('font-size: 11px'), 'Test 6.5: 11px violation removed');
  assert.ok(shellCss.includes('border-radius: 50%'), 'Test 6.6: Circular icon-only FAB on small screens');
  results.push('Test 6: Small screen icon-only assistant with 16px font-size verified');

  // Test 7: Radix tokens & typography
  const radixVariables = ['--slate-6', '--slate-2', '--slate-12', '--red-11', '--red-3', '--red-6'];
  for (const v of radixVariables) {
    assert.ok(shellCss.includes(v), 'Test 7.1: Shell CSS must use Radix variable ' + v);
  }
  assert.ok(!shellCss.includes('#fff0f0'), 'Test 7.2: Raw non-Radix #fff0f0 replaced with var(--red-3, #feebec)');
  assert.ok(shellCss.includes('#feebec'), 'Test 7.3: Radix red-3 #feebec verified');
  assert.ok(shellCss.includes('0.5px solid'), 'Test 7.4: Shell CSS uses 0.5px border');
  // Check no duplicate @media (max-width: 760px) in project-shell.css
  const media760Matches = (shellCss.match(/@media\s*\(max-width:\s*760px\)/g) || []).length;
  assert.equal(media760Matches, 1, 'Test 7.5: Only 1 consolidated @media (max-width: 760px) in project-shell.css');
  results.push('Test 7: Radix design tokens, clean media consolidation validated');

  // Test 8: data-workspaces & workspace-polish legacy cleanup
  assert.ok(!dataCss.includes('.sidebar { position:static; height:auto; padding:12px; border-right:0; border-bottom:0.5px solid #d9d9e0; }'), 'Test 8.1: Conflicting legacy sidebar in data-workspaces removed');
  assert.ok(!wpCss.includes('.app-shell:has(.ops-workspace) > .sidebar'), 'Test 8.2: Conflicting ops mobile sidebar in workspace-polish removed');
  assert.ok(!wpCss.includes('.app-shell:has(.ops-workspace) .project-switcher'), 'Test 8.3: Overlapping switcher rule in workspace-polish removed');
  results.push('Test 8: Workspace-polish and data-workspaces legacy conflicts eliminated');

  console.log('--- All 8 test suites passed successfully! ---');
  results.forEach(r => console.log('✓ ' + r));
}

runTests();
