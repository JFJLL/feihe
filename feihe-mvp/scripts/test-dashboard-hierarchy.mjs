#!/usr/bin/env node

/**
 * test-dashboard-hierarchy.mjs
 *
 * Static & SSR contract verification for dashboard visual hierarchy polish:
 * 1. Centralized tokens & Radix canvas management
 * 2. Macro vs Micro visual hierarchy differences (card borders, radiuses, gap 40 vs 16/12, header 22 vs 16)
 * 3. KPI card baseline Y consistency (justify-start, min-height: 40px desktop, note margin-top: auto)
 * 4. Category-driven metric strip styling (not inferred from status, no nth-child, no side lines, slate12 numbers)
 * 5. Details collapsible integrity and mobile responsive safety (no height collapse, 4 font tiers 12/14/16/22)
 *
 * Note: Static / SSR assertion suite (not a headless browser test).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

console.log('=== 1. Token 集中管理与共享画布 (Tokens & Radix Canvas) ===');
{
  const dtCss = read('styles/dashboard-template.css');
  const caCss = read('features/campaign/campaign-analytics.css');

  // 1.1 --dt-section-gap 集中管理 (40px desktop, 28px mobile)
  assert.ok(dtCss.includes('--dt-section-gap: 40px'), 'dashboard-template.css 必须集中定义 --dt-section-gap: 40px');
  assert.ok(dtCss.includes('--dt-section-gap: 28px'), 'dashboard-template.css 移动端媒体查询必须定义 --dt-section-gap: 28px');

  // 1.2 外卡较明确边界 slate7 #cdced6
  assert.ok(dtCss.includes('--dt-section-border: #cdced6'), 'dashboard-template.css 必须集中定义 --dt-section-border: #cdced6 (slate7)');

  // 1.3 共享 dashboard canvas: Radix slate3 #f0f0f3, 保持 sidebar 白色 #ffffff
  assert.ok(dtCss.includes('--dt-bg-page: #f0f0f3'), 'dt-bg-page 必须为 Radix slate3 #f0f0f3');
  assert.ok(caCss.includes('--ca-palette-bg: var(--slate-3, #f0f0f3)'), 'ca-palette-bg 必须使用 slate-3 #f0f0f3 画布');
  assert.ok(dtCss.includes('background: #ffffff') && dtCss.includes('.sidebar'), 'sidebar 必须保持背景为纯白 #ffffff');

  console.log('  -> --dt-section-gap (40/28px), --dt-section-border (#cdced6), slate3 画布与纯白 sidebar 验证通过');
}

console.log('=== 2. 宏观与微观层级差异 (Macro vs Micro Visual Hierarchy) ===');
{
  const htCss = read('features/campaign/huang-tiane.css');
  const shellCss = read('features/campaign/campaign-shell.css');
  const overviewCss = read('features/campaign/CampaignOverviewPage.css');

  // 2.1 宏区块间距: ht-board 使用变量，通用 ca-page 相邻宏区块实测 gap 40px
  assert.ok(htCss.includes('gap: var(--dt-section-gap, 40px)'), 'ht-board 必须使用 --dt-section-gap 变量');
  assert.ok(htCss.includes('.ht-command-bar,\n.ht-section-jumpbar {\n  position: sticky;\n  top: 0;\n  z-index: 25;\n  background: rgba(255, 255, 255, 0.96);\n  backdrop-filter: blur(10px);\n  -webkit-backdrop-filter: blur(10px);\n  border:0.5px solid #d9d9e0;\n  border-radius: 10px;\n  padding: 6px 14px;\n  margin: 0;'), 'jumpbar 多余 mb10 必须移除，避免重复叠加');

  assert.ok(
    shellCss.includes('margin-top: calc(var(--dt-section-gap, 40px) - 12px)') ||
    overviewCss.includes('margin-top: calc(var(--dt-section-gap, 40px) - 12px)'),
    'ca-page 相邻宏区块间距必须通过 calc(var(--dt-section-gap, 40px) - 12px) 精确计算为 40px'
  );
  assert.ok(shellCss.includes('gap: 12px'), 'ca-page 控件间距必须保持紧凑 12px');

  // 2.2 外卡 0.5px slate7 边界、radius 12、白底，内部 ca-panel 改 slate1 #fcfcfd、slate4 #e8e8ec 轻边、radius 8 无 shadow
  assert.ok(
    overviewCss.includes('border:0.5px solid var(--dt-section-border, #cdced6)') ||
    overviewCss.includes('border: 0.5px solid var(--dt-section-border, #cdced6)'),
    'ca-section-macro-card 外卡必须为 0.5px slate7 边界'
  );
  assert.ok(overviewCss.includes('border-radius: 12px'), '外卡 radius 必须为 12px');
  assert.ok(overviewCss.includes('.ca-section-macro-card .ca-panel {\n  background: var(--slate-1, #fcfcfd)'), '内卡 ca-panel 必须为 slate-1 #fcfcfd 底色');
  assert.ok(overviewCss.includes('border: 0.5px solid var(--slate-4, #e8e8ec)'), '内卡 ca-panel 必须为 slate-4 #e8e8ec 轻边');
  assert.ok(overviewCss.includes('border-radius: 8px'), '内卡 ca-panel radius 必须为 8px');
  assert.ok(overviewCss.includes('box-shadow: none'), '内卡 ca-panel 不得带外层阴影');

  // 2.3 宏 header 全幅淡 slate2 标题带与同心圆角
  assert.ok(overviewCss.includes('background: var(--slate-2, #f9f9fb)'), '宏 header 必须为淡 slate2 #f9f9fb 标题带');
  assert.ok(overviewCss.includes('border-top-left-radius: 11.5px'), '宏 header 必须具备 11.5px 同心圆角');
  assert.ok(overviewCss.includes('margin-top: -24px !important'), '宏 header 必须使用 -24px negative margin-top 贴合顶边避免白帽');
  assert.ok(overviewCss.includes('width: auto !important'), '宏 header 必须使用 width: auto !important 充满卡宽');
  assert.ok(overviewCss.includes('padding: 18px 24px'), '宏 header 内 padding 必须为 18px 24px');
  assert.ok(overviewCss.includes('font-size: 22px'), '宏标题在桌面端必须为 22px 700 加粗');
  assert.ok(overviewCss.includes('.ca-panel-title {\n  font-size: 16px;'), '图表内卡标题必须保持 16px');
  assert.ok(!overviewCss.includes('.ca-section-macro-card {\n  background: #ffffff;\n  border:0.5px solid var(--dt-section-border, #cdced6);\n  border-radius: 12px;\n  padding: 24px;\n  box-shadow: 0 1px 2px rgba(28, 32, 36, 0.03);\n  margin-bottom: 0;\n  box-sizing: border-box;\n  overflow: hidden;'), 'macro card 不得使用 overflow: hidden 截断内部下拉与 tooltip');

  // 2.4 移动端 header fullbleed 保护：width auto 覆盖 mobile 100% 硬盖，右侧无 24px 缺口
  assert.ok(overviewCss.includes('width: auto !important;\n    padding: 12px 14px;'), '移动端 header 必须为 width auto 避免卡片右侧缺口');

  // 2.5 编号徽标 teal3 底 + teal11 字
  assert.ok(shellCss.includes('background: var(--teal-3, #e0f8f3) !important'), '宏 header 编号必须使用 teal-3 #e0f8f3 底色');
  assert.ok(shellCss.includes('color: var(--teal-11, #008573) !important'), '宏 header 编号必须使用 teal-11 #008573 文字');

  console.log('  -> 宏观 40px vs 微观 16/12px、外卡 slate7/12px vs 内卡 slate1/slate4/8px、全幅 slate2 标题带 (22px vs 16px) 验证通过');
}

console.log('=== 3. KPI 指标卡基线 Y 对齐验证 (Value Y Alignment) ===');
{
  const dtCss = read('styles/dashboard-template.css');
  const shellCss = read('features/campaign/campaign-shell.css');
  const caCss = read('features/campaign/campaign-analytics.css');

  // 3.1 容器改 justify-start (不再 space-between 导致数字 baseline 错位)
  assert.ok(
    dtCss.includes('justify-content: flex-start !important'),
    'bd-kpi-card-rich 必须为 justify-content: flex-start 避免数字 baseline 错位'
  );
  assert.ok(
    shellCss.includes('justify-content: flex-start'),
    'ca-metric-item 必须为 justify-content: flex-start'
  );
  assert.ok(
    caCss.includes('justify-content: flex-start'),
    'campaign-analytics ca-metric-item 必须为 justify-content: flex-start'
  );

  // 3.2 head 至少 40px 桌面完整两行不裁
  assert.ok(dtCss.includes('min-height: 40px'), 'bd-kpi-head 桌面必须具备 min-height: 40px 保证两行对齐');
  assert.ok(shellCss.includes('min-height: 40px'), 'shell ca-metric-item .bd-kpi-head 桌面必须具备 min-height: 40px');
  assert.ok(caCss.includes('min-height: 40px'), 'analytics ca-metric-item .bd-kpi-head 桌面必须具备 min-height: 40px');

  // 3.3 value 紧接 head，note margin-top: auto 沉底
  assert.ok(dtCss.includes('.bd-kpi-sub {\n  margin-top: auto !important;\n}'), 'bd-kpi-sub 必须 margin-top: auto 沉底');
  assert.ok(shellCss.includes('.ca-metric-note { margin-top: auto !important; }'), 'shell ca-metric-note 必须 margin-top: auto 沉底');
  assert.ok(caCss.includes('.ca-metric-note {\n  margin: 4px 0 0;\n  margin-top: auto !important;'), 'ca-metric-note 必须 margin-top: auto 沉底');

  // 3.4 移动端 min-height: auto 避免裁切
  assert.ok(dtCss.includes('.bd-kpi-head {\n    min-height: auto !important;'), '移动端 bd-kpi-head 必须重置为 min-height: auto');
  assert.ok(shellCss.includes('.bd-kpi-head {\n    min-height: auto !important;'), '移动端 shell head 必须重置为 min-height: auto');

  console.log('  -> KPI 指标卡 justify-start、桌面 min-height 40px、note 沉底与移动端自适应验证通过');
}

console.log('=== 4. 业务分类样式契约与状态隔离 (Category Colors & Status Isolation) ===');
{
  const dtCss = read('styles/dashboard-template.css');
  const caCss = read('features/campaign/campaign-analytics.css');

  // 4.1 四大业务分类色变量约定: --metric-category-badge-bg 与 --metric-category-ink
  const categories = [
    { name: 'brand', bg: '#f3fbf9', badgeBg: '#e0f8f3', ink: '#008573' },
    { name: 'cid', bg: '#f4faff', badgeBg: '#e6f4fe', ink: '#0d74ce' },
    { name: 'commerce', bg: '#f8f8ff', badgeBg: '#f0f1fe', ink: '#5753c6' },
    { name: 'creators', bg: '#fefbe9', badgeBg: '#fff7c2', ink: '#ab6400' },
  ];

  for (const cat of categories) {
    const selector = `.ca-metric-item[data-category="${cat.name}"]`;
    assert.ok(dtCss.includes(selector), `dashboard-template.css 必须包含分类选择器 ${selector}`);
    assert.ok(caCss.includes(selector), `campaign-analytics.css 必须包含分类选择器 ${selector}`);
    assert.ok(caCss.includes(`--metric-cat-bg: var(--${cat.name === 'brand' ? 'teal-2' : cat.name === 'cid' ? 'blue-2' : cat.name === 'commerce' ? 'iris-2' : 'amber-2'}, ${cat.bg})`), `${cat.name} 极淡 2 阶背景绑定`);
    assert.ok(caCss.includes(`--metric-category-badge-bg: var(--${cat.name === 'brand' ? 'teal-3' : cat.name === 'cid' ? 'blue-3' : cat.name === 'commerce' ? 'iris-3' : 'amber-3'}, ${cat.badgeBg})`), `${cat.name} 3 阶 badge 底色绑定`);
    assert.ok(caCss.includes(`--metric-category-ink: var(--${cat.name === 'brand' ? 'teal-11' : cat.name === 'cid' ? 'blue-11' : cat.name === 'commerce' ? 'iris-11' : 'amber-11'}, ${cat.ink})`), `${cat.name} 11 阶 ink 文字绑定`);
  }

  // 4.2 范围作用域保护：严格限定 .ca-metric-item[data-category]，不得覆盖未分类卡片的 inline status
  assert.ok(
    dtCss.includes('.ca-metric-item[data-category] .ca-metric-badge'),
    'badge 样式必须仅限定在 .ca-metric-item[data-category] 作用域内'
  );
  assert.ok(
    !dtCss.includes('article[data-category] {\n'),
    '不得使用全局裸 article[data-category] 污染其他非指标卡组件'
  );

  // 4.3 指标数值严格保持 slate-12 #1c2024，不加侧边彩线、不按 nth-child 上色
  assert.ok(dtCss.includes('.ca-metric-item[data-category] .bd-kpi-val,\n.ca-metric-item[data-category] .ca-metric-value {\n  color: var(--slate-12, #1c2024) !important;\n}'), '分类卡片数值严格保持 slate12');
  assert.ok(!caCss.includes('border-left: 2px solid') && !caCss.includes('border-left: 3px solid'), '不得给指标卡加侧边彩线假装层级');

  // 4.4 保留老模板非 MetricStrip 的 nth-child 兼容保护
  assert.ok(dtCss.includes('.bd-kpi-card-rich:not(.ca-metric-item):nth-child(1)'), '必须保留非 ca-metric-item 的老模板 nth-child 回退');

  console.log('  -> brand(teal)/cid(blue)/commerce(iris)/creators(amber) 变量、未分类 status 隔离保护与 slate12 数值验证通过');
}

console.log('=== 5. Details 折叠交互、Chevron 指示器与移动端完整性 ===');
{
  const htCss = read('features/campaign/huang-tiane.css');
  const overviewCss = read('features/campaign/CampaignOverviewPage.css');
  const dailyCss = read('features/campaign/CampaignDailyPage.css');

  // 5.1 details 桌面端特异性与避免负 margin 导致关闭时高度坍塌
  assert.ok(
    htCss.includes('padding: 18px 24px !important') &&
    htCss.includes('details.ht-layer > summary.ht-layer-header'),
    'details.ht-layer > summary 必须具备 padding: 18px 24px !important 覆盖旧 secondary-details 的 5px 0'
  );
  assert.ok(
    htCss.includes('.ht-secondary-details:not(.ht-layer)'),
    '旧 ht-secondary-details 规则必须排除 .ht-layer 避免样式污染'
  );
  assert.ok(
    htCss.includes('details.ht-layer:not([open]) {\n  padding: 0 !important;\n  padding-bottom: 0 !important;\n  gap: 0 !important;\n}'),
    '折叠后 ht-layer 必须消除 padding-bottom 与 gap，严禁残留 20px 白尾'
  );
  assert.ok(
    htCss.includes('max-width: 100% !important') && htCss.includes('box-sizing: border-box !important'),
    'summary 宽度必须严格受控于卡片边界，确保右侧箭头不出卡'
  );
  assert.ok(dailyCss.includes('.ca-daily-details-panel {\n  background: #ffffff;\n  border:0.5px solid var(--dt-section-border, #cdced6);\n  border-radius: 12px;\n  padding: 0;'), 'ca-daily-details-panel padding 设为 0');

  // 5.2 自定义 chevron 旋转与键盘焦点 (:focus-visible)
  assert.ok(overviewCss.includes('.ca-details-summary::after {\n  content: "▾";'), 'overview details 必须具备自定义 ▾ chevron');
  assert.ok(overviewCss.includes('.ca-details-collapse[open] > .ca-details-summary::after {\n  transform: rotate(180deg);'), 'overview details open 时 chevron 旋转 180deg');
  assert.ok(overviewCss.includes('.ca-details-summary:focus-visible {\n  outline: 2px solid var(--teal-11, #008573);'), 'overview details 必须保留 :focus-visible 键盘焦点');

  assert.ok(dailyCss.includes('.ca-daily-details-summary::after {\n  content: "▾";'), 'daily details 必须具备自定义 ▾ chevron');
  assert.ok(dailyCss.includes('.ca-daily-details-panel[open] > .ca-daily-details-summary::after {\n  transform: rotate(180deg);'), 'daily details open 时 chevron 旋转 180deg');
  assert.ok(dailyCss.includes('.ca-daily-details-summary:focus-visible {\n  outline: 2px solid var(--teal-11, #008573);'), 'daily details 必须保留 :focus-visible 键盘焦点');

  assert.ok(htCss.includes('.ht-summary-header::after {\n  content: "▾";'), 'huang tiane summary 必须具备自定义 ▾ chevron');
  assert.ok(htCss.includes('.ht-summary-header:focus-visible {\n  outline: 2px solid var(--teal-11, #008573);'), 'huang tiane summary 必须保留 :focus-visible 键盘焦点');

  // 5.3 移动端 4 档字号阶梯 (12/14/16/22)
  assert.ok(overviewCss.includes('.ca-section-macro-card .ca-chapter-title {\n    font-size: 16px !important;\n  }'), '移动端宏标题缩小为 16px，严守 12/14/16/22 阶梯');
  assert.ok(htCss.includes('.ht-layer-title {\n    white-space: normal !important;\n    overflow-wrap: anywhere !important;\n    flex: 1 !important;\n    min-width: 0 !important;\n    line-height: 1.35 !important;\n    font-size: 16px !important;\n  }'), 'ht 移动端宏标题缩小为 16px');

  console.log('  -> details 无高度坍塌、自定义 chevron 旋转与 :focus-visible、移动端 16px 保持 4 档字号验证通过');
}

console.log('\n[PASS] 所有视觉层级 (Tokens/宏微差异/KPI基线Y对齐/分类色契约/折叠完整性与桌面特异性) 静态契约断言全部通过！');
