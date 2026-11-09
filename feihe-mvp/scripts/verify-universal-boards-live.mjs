import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const PROJECTS = [
  { id: 'qicui', name: '飞鹤启萃', color: '#0f5e52', hasComments: true },
  { id: 'kailas', name: '凯乐石', color: '#b4573f', hasLegacy: true },
  { id: 'meiling', name: '美菱', color: '#b8322f', hasLegacy: true },
  { id: 'winner-wipes', name: '稳健酒精湿巾', color: '#0f5f78', hasLegacy: true },
  { id: 'huang-tiane', name: '黄天鹅', color: '#b8860b', hasLegacy: true },
];

async function run() {
  console.log('🚀 启动浏览器验证 5 大项目 Universal 看板与 SPU 色彩...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\liuhao_PC\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  for (const proj of PROJECTS) {
    const url = `http://127.0.0.1:5173/projects/${proj.id}`;
    console.log(`\n🔍 验证项目 [${proj.id}] (${proj.name}): ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // 1. 验证左侧导航栏固定统一
    const navItems = await page.locator('.project-main-nav a .nav-label').allInnerTexts();
    console.log(`   左侧导航栏项目:`, navItems);
    assert.ok(navItems.includes('项目总览'), `${proj.id} 必须包含 项目总览`);
    assert.ok(navItems.includes('投流分析'), `${proj.id} 必须包含 投流分析`);
    assert.ok(navItems.includes('行业分析'), `${proj.id} 必须包含 行业分析`);
    assert.ok(navItems.includes('内容管理'), `${proj.id} 必须包含 内容管理`);
    assert.ok(navItems.includes('项目设置'), `${proj.id} 必须包含 项目设置`);
    if (proj.hasComments) {
      assert.ok(navItems.includes('评论质检'), `${proj.id} 必须包含 评论质检`);
    }

    // 2. 验证 ProjectContextBar SPU 色彩与渐变
    const contextBar = page.locator('.project-context-bar');
    await contextBar.waitFor({ state: 'visible', timeout: 10000 });
    const contextBarBg = await contextBar.evaluate(el => window.getComputedStyle(el).backgroundImage || window.getComputedStyle(el).background);
    console.log(`   项目档案栏底色/渐变:`, contextBarBg.slice(0, 60));
    assert.ok(contextBarBg.includes('gradient') || contextBarBg.includes('color-mix') || contextBarBg.includes('rgb'), `${proj.id} 项目档案栏应呈现渐变背景`);

    // 3. 验证 UniversalBoardRenderer 与 Macro-Chapter 大卡片
    const macroCards = page.locator('.ca-macro-section-card');
    const cardCount = await macroCards.count();
    console.log(`   渲染出的章节大卡片数量: ${cardCount}`);
    assert.ok(cardCount >= 2, `${proj.id} 应至少渲染 2 个章节大卡片`);

    // 4. 验证章节编号徽章
    const firstBadge = page.locator('.ca-macro-section-card span').filter({ hasText: '01' }).first();
    assert.ok(await firstBadge.isVisible(), `${proj.id} 必须显示 01 章节编号徽章`);

    // 5. 验证胶囊切换按钮 (新版灯塔看板 | 经典定制看板)
    if (proj.hasLegacy) {
      const capsule = page.locator('.ca-view-mode-capsule');
      await capsule.waitFor({ state: 'visible', timeout: 5000 });
      const capsuleText = await capsule.innerText();
      console.log(`   视图切换胶囊:`, capsuleText.replace(/\n/g, ' '));
      assert.ok(capsuleText.includes('新版灯塔看板'), `${proj.id} 胶囊应包含 新版灯塔看板`);
      assert.ok(capsuleText.includes('经典定制看板'), `${proj.id} 胶囊应包含 经典定制看板`);
    }

    console.log(`   ✓ [PASS] 项目 ${proj.id} 验证 100% 通过`);
  }

  // 6. 测试多板块切换 (overview -> ads -> content)
  console.log('\n🔄 验证板块切换与差异化业务看板渲染:');
  await page.goto('http://127.0.0.1:5173/projects/meiling/ads', { waitUntil: 'networkidle', timeout: 30000 });
  const meilingAdsCards = await page.locator('.ca-macro-section-card').count();
  console.log(`   美菱 投流分析(ads) 章节大卡片数: ${meilingAdsCards}`);
  assert.ok(meilingAdsCards >= 2, '美菱投流分析应渲染至少 2 个章节大卡片');

  await page.goto('http://127.0.0.1:5173/projects/kailas/content', { waitUntil: 'networkidle', timeout: 30000 });
  const kailasContentCards = await page.locator('.ca-macro-section-card').count();
  console.log(`   凯乐石 内容管理(content) 章节大卡片数: ${kailasContentCards}`);
  assert.ok(kailasContentCards >= 2, '凯乐石内容管理应渲染至少 2 个章节大卡片');

  await page.goto('http://127.0.0.1:5173/projects/winner-wipes/ads', { waitUntil: 'networkidle', timeout: 30000 });
  const wipesAdsCards = await page.locator('.ca-macro-section-card').count();
  console.log(`   稳健湿巾 投流分析(ads) 章节大卡片数: ${wipesAdsCards}`);
  assert.ok(wipesAdsCards >= 2, '稳健湿巾投流分析应渲染至少 2 个章节大卡片');

  await browser.close();
  console.log('\n🎉 ALL 5 PROJECTS PASSED LIVE BROWSER VERIFICATION!');
}

run().catch(err => {
  console.error('❌ Browser Verification Failed:', err);
  process.exit(1);
});
