#!/usr/bin/env node

/**
 * test-campaign-browser-followup.mjs
 *
 * Read-only regression test for campaign mobile responsiveness,
 * macro spacing (28px alignment), cockpit header layout, and
 * Huang Tiane UI notice copy.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

console.log('=== 1. 验证 features/campaign/HuangTianeBoard.tsx 结构与文案 ===');
const boardCode = fs.readFileSync(path.join(ROOT, 'features/campaign/HuangTianeBoard.tsx'), 'utf-8');

// 文案必须为“未登记素材显示为未提供”，严禁包含“保留null”
assert.ok(
  boardCode.includes('*未来计划不计入实际发布；原表文本备注保留于备注列，未登记素材显示为未提供。'),
  '文案必须为“未登记素材显示为未提供”'
);
assert.ok(
  !boardCode.includes('保留null'),
  '禁止在UI文本中暴露“保留null”技术词汇'
);

// 必须包含导航分行结构 .ht-jumpbar-nav-row 与 .ht-scope-tabs-row
assert.ok(boardCode.includes('ht-jumpbar-nav-row'), '必须包含 ht-jumpbar-nav-row 导航行结构');
assert.ok(boardCode.includes('ht-scope-tabs-row'), '必须包含 ht-scope-tabs-row 渠道切换行结构');

// 渠道与章节全量保留
assert.ok(boardCode.includes("adsScope === 'brand'"), '必须保留品牌FS渠道');
assert.ok(boardCode.includes("adsScope === 'cid'"), '必须保留红猫CID渠道');
assert.ok(boardCode.includes("adsScope === 'commerce'"), '必须保留闭环商销渠道');
console.log('  -> HuangTianeBoard.tsx 文案与分行结构验证通过');

console.log('=== 2. 验证 features/campaign/huang-tiane.css 响应式与间距规范 ===');
const htCss = fs.readFileSync(path.join(ROOT, 'features/campaign/huang-tiane.css'), 'utf-8');

// 消除 56px 叠加：.ht-layer 必须消除 margin-bottom
assert.ok(
  htCss.includes('.ht-board > .ht-layer') && htCss.includes('margin-bottom: 0'),
  '.ht-board > .ht-layer 必须显式重置 margin-bottom: 0 以消除与 gap: 28px 的 56px 间距叠加'
);

// 切换按钮水平可滚动且文字不逐字换行
assert.ok(
  htCss.includes('.ht-scope-tab-btn') && htCss.includes('white-space: nowrap'),
  '渠道切换按钮必须 white-space: nowrap 防止逐字换行'
);
assert.ok(
  !htCss.includes('.ht-scope-tabs { flex-wrap: wrap; }'),
  '小屏不得对 .ht-scope-tabs 施加 flex-wrap: wrap 挤压'
);

// Dual Arena 内部横向滚动保护与 12px 可读数字
assert.ok(
  htCss.includes('.ht-dual-arena') && htCss.includes('overflow-x: auto'),
  '.ht-dual-arena 必须具备 overflow-x: auto 显式横向滚动保护'
);

// Lollipop Ranking List 移动端换行布局与 12px 可读数字
assert.ok(
  htCss.includes('.ht-lollipop-list') && htCss.includes('overflow-x: auto'),
  '.ht-lollipop-list 必须具备 overflow-x: auto 显式滚动保护'
);

// KPI 卡片移动端标题与分类 badge 垂直排布，防止 150px 卡内抢宽导致 5 行逐字竖排
assert.ok(
  htCss.includes('.bd-kpi-head') && htCss.includes('flex-direction: column'),
  '.ht-board .bd-kpi-head 必须在移动端 flex-direction: column 垂直排布'
);

// 受众热力矩阵防撑开：620px 仅作用于内部 table，外卡与 wrapper 保持 min-width: 0 与 max-width: 100%
assert.ok(
  htCss.includes('.ht-audience-matrix') && htCss.includes('min-width: 0 !important'),
  '.ht-audience-matrix 外卡必须具备 min-width: 0 !important 防止 min-content 撑宽'
);
assert.ok(
  htCss.includes('.ht-grid-2') && htCss.includes('minmax(0, 1fr) !important'),
  '.ht-grid-2 在移动端必须采用 minmax(0, 1fr) 严防 min-content 撑宽兄弟卡片'
);
assert.ok(
  htCss.includes('.ht-audience-matrix .ca-matrix-wrap table') && htCss.includes('min-width: 620px !important'),
  '620px 最小宽度必须仅赋予内部 table 并由 table-wrap 实施内部横向滚动'
);

// 320px/360px 极窄视口防撑开：章节长标题与描述自然换行、保留文字不隐藏
assert.ok(
  htCss.includes('.ht-layer-title') && htCss.includes('overflow-wrap: anywhere !important') && htCss.includes('white-space: normal !important'),
  '.ht-layer-title 必须具备 overflow-wrap: anywhere 与 white-space: normal 允许自然折行'
);
assert.ok(
  htCss.includes('.ht-layer-sub') && htCss.includes('white-space: normal !important') && htCss.includes('flex: 1 1 100% !important'),
  '.ht-layer-sub 必须具备 white-space: normal 与 flex: 1 1 100% 独立占行折行'
);
assert.ok(
  htCss.includes('.ht-chapter-num') && htCss.includes('flex-shrink: 0 !important'),
  '.ht-chapter-num 章节徽章必须 flex-shrink: 0 不被挤压'
);
console.log('  -> huang-tiane.css 响应式、56px叠加消除与无损滚动验证通过');

console.log('=== 3. 验证 features/campaign/campaign-shell.css 共享响应式修复 ===');
const shellCss = fs.readFileSync(path.join(ROOT, 'features/campaign/campaign-shell.css'), 'utf-8');

// 所有战役的 ca-section-jumpbar 在移动端分行与横向滚动
assert.ok(
  shellCss.includes('.ca-section-jumpbar') && shellCss.includes('flex-direction: column'),
  '共享 ca-section-jumpbar 在移动端必须 flex-direction: column 分行'
);
assert.ok(
  shellCss.includes('.ca-jumpbar-links') && shellCss.includes('overflow-x: auto'),
  '共享 ca-jumpbar-links 在移动端必须具备 overflow-x: auto 保持横滑不撑开页面'
);

// 章节标题防 26px 压扁竖排（Wipes/Kailas 等共享）
assert.ok(
  shellCss.includes('.ca-chapter-header') && shellCss.includes('flex-direction: column'),
  '移动端 .ca-chapter-header 必须 flex-direction: column 防止周期占宽压扁标题'
);
assert.ok(
  shellCss.includes('.ca-chapter-heading') && shellCss.includes('min-width: 0'),
  '.ca-chapter-heading 必须具备 min-width: 0'
);

// 状态徽章 status nowrap
assert.ok(
  shellCss.includes('.dashboard-template-status-badge') && shellCss.includes('white-space: nowrap'),
  '项目状态徽章必须 white-space: nowrap !important 防止“进行中”逐字换行'
);

// KPI 间距一致性规范（16px）：.ca-metric-strip gap 与 flex-basis 严密对齐
assert.ok(
  shellCss.includes('.ca-metric-strip') && shellCss.includes('gap: 16px'),
  '.ca-metric-strip 必须采用标准 gap: 16px'
);
assert.ok(
  shellCss.includes('calc((100% - (var(--metric-columns, 4) - 1) * 16px) / var(--metric-columns, 4))'),
  '默认 4 列 flex-basis 必须同步扣减 16px gap'
);
assert.ok(
  shellCss.includes('calc((100% - 32px) / 3)'),
  '3 列 flex-basis 必须精确扣减 32px (2 * 16px)'
);
assert.ok(
  shellCss.includes('calc((100% - 16px) / 2)'),
  '2 列 flex-basis 必须精确扣减 16px (1 * 16px)'
);
console.log('  -> campaign-shell.css 共享分行、防竖排与状态保护验证通过');

console.log('=== 4. 验证 industry.css 与 note-operations.css 16px KPI gap 统一性 ===');
const indCss = fs.readFileSync(path.join(ROOT, 'features/industry/industry.css'), 'utf-8');
assert.ok(
  indCss.includes('.v2-kpi-grid') && indCss.includes('gap: 16px'),
  'industry.css .v2-kpi-grid 必须统一为 gap: 16px'
);

const noteCss = fs.readFileSync(path.join(ROOT, 'styles/note-operations.css'), 'utf-8');
assert.ok(
  noteCss.includes('.note-operations .bd-kpis') && noteCss.includes('gap: 16px'),
  'note-operations.css .note-operations .bd-kpis 必须统一为 gap: 16px'
);
console.log('  -> 行业与内容工作台 16px KPI gap 验证通过');

console.log('=== 5. 验证 styles/dashboard-template.css 驾驶舱主头部响应式 ===');
const dtCss = fs.readFileSync(path.join(ROOT, 'styles/dashboard-template.css'), 'utf-8');

// controls 另行，防止挤压 main 到 26px
assert.ok(
  dtCss.includes('.dashboard-template-header') && dtCss.includes('flex-direction: column'),
  '移动端 .dashboard-template-header 必须 flex-direction: column 拆解为标题行与控制行'
);
assert.ok(
  dtCss.includes('.dashboard-template-header-controls') && dtCss.includes('width: 100%'),
  '移动端控制区必须自成一行 width: 100%'
);
assert.ok(
  dtCss.includes('.dashboard-template-subtitle-inline') && dtCss.includes('display: none'),
  '移动端副标题必须适当省略以保障主标题与状态徽章同一行完整展示'
);
console.log('  -> dashboard-template.css 驾驶舱主头部响应式规则验证通过');

console.log('\n[PASS] 全部黄天鹅与共享移动端响应式回归断言成功通过！');
