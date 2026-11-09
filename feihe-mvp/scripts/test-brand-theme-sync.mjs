import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { deriveThemeFromBrandColor } from '../lib/core/themes.ts';

const EXPECTED_COLORS = {
  'qicui': '#0f5e52',
  'kailas': '#b4573f',
  'meiling': '#b8322f',
  'winner-wipes': '#0f5f78',
  'huang-tiane': '#b8860b',
};

test('1. 5 个现有项目的 SPU 颜色配置与清单完全校准', () => {
  for (const [pid, expectedHex] of Object.entries(EXPECTED_COLORS)) {
    const manifestPath = path.resolve(`projects/${pid}/manifest.json`);
    assert.ok(fs.existsSync(manifestPath), `Manifest exists for ${pid}`);
    const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(json.color.toLowerCase(), expectedHex.toLowerCase(), `${pid} manifest.json color matches`);

    const tsPath = path.resolve(`projects/${pid}/manifest.ts`);
    assert.ok(fs.existsSync(tsPath), `Manifest.ts exists for ${pid}`);
    const tsContent = fs.readFileSync(tsPath, 'utf8');
    assert.ok(
      tsContent.toLowerCase().includes(expectedHex.toLowerCase()),
      `${pid} manifest.ts includes color ${expectedHex}`
    );
  }
});

test('2. deriveThemeFromBrandColor 能基于各 SPU 颜色动态推导 BeaconTheme 与 CSS 变量', () => {
  for (const [pid, expectedHex] of Object.entries(EXPECTED_COLORS)) {
    const theme = deriveThemeFromBrandColor(expectedHex);
    assert.ok(theme.chrome.accent, `Theme has accent color for ${pid}`);
    assert.ok(theme.cssVariables['--dtc-theme-accent'], `Theme has --dtc-theme-accent for ${pid}`);
    assert.ok(theme.chartPalette.length >= 5, `Theme has at least 5 harmonic chart palette colors for ${pid}`);
  }
});

test('3. ProjectShell 源码包含 SPU 品牌色动态注入与 document.documentElement 同步', () => {
  const shellCode = fs.readFileSync(path.resolve('components/project-shell/ProjectShell.tsx'), 'utf8');
  assert.ok(shellCode.includes('deriveThemeFromBrandColor'), 'ProjectShell 导入并使用 deriveThemeFromBrandColor');
  assert.ok(shellCode.includes("data-project-color={brandColor}"), 'app-shell 挂载 data-project-color 属性');
  assert.ok(shellCode.includes("style={projectThemeStyle}"), 'app-shell 注入 projectThemeStyle 样式');
  assert.ok(shellCode.includes("document.documentElement.style.setProperty('--brand-primary'"), '全局同步 --brand-primary');
});

test('4. ProjectSwitcher 源码包含品牌色左侧标条动态适配', () => {
  const switcherCode = fs.readFileSync(path.resolve('components/project-shell/ProjectSwitcher.tsx'), 'utf8');
  assert.ok(switcherCode.includes('borderLeft'), 'ProjectSwitcher 具有 borderLeft 强调色标');
});

test('5. ProjectCenter 源码卡片具有 SPU 品牌色条、标签与进入按钮样式', () => {
  const centerCode = fs.readFileSync(path.resolve('features/project-center/ProjectCenter.tsx'), 'utf8');
  assert.ok(centerCode.includes("borderTop: '3px solid ' + (p.color"), '卡片具有 SPU 品牌色顶部色带');
  assert.ok(centerCode.includes("template-pill"), '具有 template-pill 标签');
  assert.ok(centerCode.includes("background: p.color"), '进入工作区按钮适配项目色');
});

test('6. CampaignWorkspace 源码挂载动态主题与品牌色 ContextBar', () => {
  const wsCode = fs.readFileSync(path.resolve('features/campaign/CampaignWorkspace.tsx'), 'utf8');
  assert.ok(wsCode.includes('deriveThemeFromBrandColor'), 'CampaignWorkspace 导入 deriveThemeFromBrandColor');
  assert.ok(wsCode.includes('style={activeThemeStyle}'), '挂载 activeThemeStyle 到 workspace root');
  assert.ok(wsCode.includes('project-context-bar'), '包含 project-context-bar');
  assert.ok(wsCode.includes('borderLeft'), 'ContextBar 具有动态 borderLeft 品牌色');
});
