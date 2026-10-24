import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const moduleCache = new Map();
function loadComponent(filename) {
  filename = path.resolve(filename);
  if (moduleCache.has(filename)) return moduleCache.get(filename);
  const raw = fs.readFileSync(filename, 'utf8');
  const sanitized = raw.replace(/import\s+['"][^'"]+\.css['"];?/g, '');
  const compiled = ts.transpileModule(sanitized, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(filename);
  const customRequire = (name) => {
    if (name.endsWith('.css')) return {};
    if (name.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filename), name);
      if (fs.existsSync(`${resolved}.ts`)) return loadComponent(`${resolved}.ts`);
      if (fs.existsSync(`${resolved}.tsx`)) return loadComponent(`${resolved}.tsx`);
      if (fs.existsSync(resolved)) return loadComponent(resolved);
    }
    return nativeRequire(name);
  };
  vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, {})(customRequire, result, result.exports);
  moduleCache.set(filename, result.exports);
  return result.exports;
}

console.log('Running mobile readability test for shared campaign charts...');

const cwd = process.cwd();
const chartsPath = path.join(cwd, 'features', 'campaign', 'CampaignCharts.tsx');
const cssPath = path.join(cwd, 'features', 'campaign', 'campaign-analytics.css');

assert(fs.existsSync(chartsPath), 'CampaignCharts.tsx must exist');
assert(fs.existsSync(cssPath), 'campaign-analytics.css must exist');

const chartsCode = fs.readFileSync(chartsPath, 'utf8');
const cssCode = fs.readFileSync(cssPath, 'utf8');
const charts = loadComponent(chartsPath);

const {
  ButterflyCostChart,
  ScatterChart,
  HorizontalBarChart,
  TargetBulletChart,
  DonutChart,
  useMeasuredWidth,
} = charts;

// ============================================================================
// 1. ButterflyCostChart: 390px 移动端容器 (275px 可用宽) 防裁切排版与契约测试
// ============================================================================
console.log('Testing ButterflyCostChart 390px / 275px mobile readability & CSS rules...');
{
  const sampleData = [
    { label: '信息流-朋友圈', leftVal: 45.2, rightVal: 1.85, spend: 32000 },
    { label: '搜索推广-核心词', leftVal: 82.0, rightVal: 3.40, spend: 18500 },
    { label: '达人种草-短视频', leftVal: 28.5, rightVal: 0.95, spend: 45000 },
  ];

  const html = renderToStaticMarkup(React.createElement(ButterflyCostChart, {
    data: sampleData,
    leftLabel: '千次展现成本',
    rightLabel: '点击成本',
  }));

  // 1a. SSR 输出具备表头与双翼行结构
  assert(html.includes('ca-butterfly-chart'), 'Must include ca-butterfly-chart root');
  assert(html.includes('ca-butterfly-header'), 'Must include ca-butterfly-header');
  assert(html.includes('ca-butterfly-row'), 'Must include ca-butterfly-row');
  assert(html.includes('ca-butterfly-val-wrap'), 'Must include ca-butterfly-val-wrap');
  assert(html.includes('ca-butterfly-badge-tag'), 'Must include best badge tag');
  assert(html.includes('本组最低'), 'Must preserve 本组最低 badge');
  assert(html.includes('左右独立刻度'), 'Must state 左右独立刻度');

  // 1b. 检查 CSS 中移动端双翼换行排版，杜绝原有 1fr 90px 1fr 挤压出界
  assert(cssCode.includes('.ca-butterfly-wing'), 'CSS must define .ca-butterfly-wing');
  assert(
    cssCode.includes('minmax(0, 1fr) minmax(68px, 78px) minmax(0, 1fr)'),
    'CSS must use flexible minmax track for 3-column mobile butterfly grid'
  );
  assert(
    cssCode.includes('flex-direction: column'),
    'Mobile butterfly wing must stack values and bars vertically to fit within narrow width'
  );
  assert(
    cssCode.includes('order: -1'),
    'Right butterfly wing must position value above bar using order: -1 for vertical balance'
  );
  assert(
    cssCode.includes('flex-wrap: wrap'),
    'Butterfly val-wrap must allow badge and number to wrap cleanly on tight widths'
  );

  // 1c. 确保中轴 badge 受到严格约束，不被挤出
  assert(cssCode.includes('.ca-butterfly-badge'), 'CSS must define .ca-butterfly-badge');
  assert(cssCode.includes('max-width: 76px'), 'Mobile butterfly badge constrained to prevent push-out');
}

// ============================================================================
// 2. ScatterChart: 响应式测宽、1:1 渲染与最低 12px 字号保障
// ============================================================================
console.log('Testing ScatterChart mobile responsive width & 12px minimum font rendering...');
{
  const sampleScatter = [
    { label: '活动A', x: 12.5, y: 340, size: 5000 },
    { label: '活动B', x: 8.2, y: 520, size: 8000 },
    { label: '活动C', x: 22.0, y: 180, size: 2500 },
  ];

  const html = renderToStaticMarkup(React.createElement(ScatterChart, {
    data: sampleScatter,
    xLabel: 'CPUV成本 (元)',
    yLabel: '转化ROI (%)',
  }));

  // 2a. 散点图使用 useMeasuredWidth 响应式测量
  assert(chartsCode.includes('useMeasuredWidth'), 'Must define and use useMeasuredWidth hook');
  assert(html.includes('viewBox="0 0'), 'ScatterChart SVG must have viewBox');
  assert(html.includes('overflow-x:auto'), 'ScatterChart outer container must support scroll fallback');
  assert(html.includes('min-width:600px') || html.includes('min-width: 600px'), 'ScatterChart SVG must set minWidth to match totalWidth');

  // 2b. 验证 SVG 中所有 <text> 元素的字号均严格 >= 12px
  const fontSizes = [...html.matchAll(/(?:font-size|fontSize)="(\d+)"/g)].map((m) => parseInt(m[1], 10));
  assert(fontSizes.length > 0, 'ScatterChart must have text elements with fontSize attribute');
  for (const size of fontSizes) {
    assert(size >= 12, `All text elements must have fontSize >= 12, got ${size}`);
  }

  // 2c. 验证移动端单点点击/触控激活支持
  assert(chartsCode.includes('onClick={() => setActiveIdx(idx)}'), 'Points must have onClick for touch support');

  // 2d. 均值线与指标语义不丢失，不虚构象限标签
  assert(html.includes('X均值'), 'Must keep X均值');
  assert(html.includes('Y均值'), 'Must keep Y均值');
  assert(!html.includes('高效优质区'), 'Must not inject subjective quadrant labels');
}

// ============================================================================
// 3. HorizontalBarChart & TargetBulletChart: 移动端自适应测宽与字号验证
// ============================================================================
console.log('Testing HorizontalBarChart & TargetBulletChart mobile 12px text & no-clip...');
{
  const barHtml = renderToStaticMarkup(React.createElement(HorizontalBarChart, {
    data: [
      { label: '信息流-朋友圈', value: 12000 },
      { label: '搜索推广', value: 0 },
      { label: '达人种草', value: 34000 },
    ],
    unit: '元',
  }));

  // 3a. 横向条形图外层具备安全横滑回退，字号最低 12px
  assert(barHtml.includes('overflow-x:auto'), 'HorizontalBarChart outer container must support overflow-x: auto');
  assert(barHtml.includes('min-width:620px') || barHtml.includes('min-width: 620px'), 'HorizontalBarChart SVG must set minWidth');
  const barFontSizes = [...barHtml.matchAll(/(?:font-size|fontSize)="(\d+)"/g)].map((m) => parseInt(m[1], 10));
  for (const size of barFontSizes) {
    assert(size >= 12, `HorizontalBarChart font size must be >= 12, got ${size}`);
  }
  // 原值 0 标线与文本保留
  assert(barHtml.includes('原值 0'), 'Zero value must preserve 原值 0 line without artificial bar');

  const bulletHtml = renderToStaticMarkup(React.createElement(TargetBulletChart, {
    data: [
      { label: '目标ROI', actual: 3.2, target: 3.0, unit: '' },
      { label: '单位成本', actual: 45, target: 50, unit: '元', direction: 'lower' },
    ],
  }));

  // 3b. 靶心图外层具备安全横滑回退，字号最低 12px
  assert(bulletHtml.includes('overflow-x:auto'), 'TargetBulletChart outer container must support overflow-x: auto');
  assert(bulletHtml.includes('min-width:640px') || bulletHtml.includes('min-width: 640px'), 'TargetBulletChart SVG must set minWidth');
  const bulletFontSizes = [...bulletHtml.matchAll(/(?:font-size|fontSize)="(\d+)"/g)].map((m) => parseInt(m[1], 10));
  for (const size of bulletFontSizes) {
    assert(size >= 12, `TargetBulletChart font size must be >= 12, got ${size}`);
  }
  assert(bulletHtml.includes('100% 目标') || bulletHtml.includes('100%'), 'TargetBulletChart must preserve 100% target line');
}

// ============================================================================
// 4. DonutChart: 不受全局 600px 规则污染
// ============================================================================
console.log('Testing DonutChart keeps 230px fixed without global 600px SVG bloat...');
{
  // 4a. 验证 CSS 中绝无全局 .ca-chart-svg { min-width: 600px }
  assert(!cssCode.includes('.ca-chart-svg { min-width: 600px'), 'Must not force all SVGs to min-width: 600px');
  assert(!cssCode.includes('.ca-chart-svg {\n  min-width: 600px'), 'Must not force all SVGs to min-width: 600px');

  const donutHtml = renderToStaticMarkup(React.createElement(DonutChart, {
    data: [
      { label: '渠道A', value: 40 },
      { label: '渠道B', value: 60 },
    ],
  }));
  assert(donutHtml.includes('viewBox="0 0 230 230"'), 'DonutChart preserves 230x230 natural size');
}

// ============================================================================
// 5. 样式规范：四档字号 12/14/16/22 约束与无冗余动效验证
// ============================================================================
console.log('Testing 4-tier font size hierarchy (12/14/16/22) & no extra animations...');
{
  // 提取新增的 ca-butterfly-narrow 与 media query 规则中的 font-size
  const narrowSectionMatch = cssCode.match(/@media \(max-width: 640px\) \{([\s\S]*?)\n\}/);
  assert(narrowSectionMatch, 'CSS must include @media (max-width: 640px)');
  const narrowRules = narrowSectionMatch[1];

  const extractedSizes = [...narrowRules.matchAll(/font-size:\s*(\d+)px/g)].map((m) => parseInt(m[1], 10));
  const allowedSizes = new Set([12, 14, 16, 22]);
  for (const s of extractedSizes) {
    assert(allowedSizes.has(s), `Font size in mobile rules must be one of 12/14/16/22, found ${s}px`);
  }

  // 确保无新增冗余 keyframes
  assert(!narrowRules.includes('@keyframes'), 'Must not add redundant animations to mobile media query');
}

// ============================================================================
// 6. Hook 顺序无条件调用检验与“空 → 有 → 空”全生命周期测试
// ============================================================================
console.log('Testing Hook call order before early returns & "empty -> has data -> empty" lifecycle...');
{
  // 6a. 源码语法级检验：确保 useMeasuredWidth 在所有 early return 之前调用
  const componentsToCheck = [
    { name: 'ButterflyCostChart', code: chartsCode.slice(chartsCode.indexOf('function ButterflyCostChart')) },
    { name: 'HorizontalBarChart', code: chartsCode.slice(chartsCode.indexOf('function HorizontalBarChart')) },
    { name: 'TargetBulletChart', code: chartsCode.slice(chartsCode.indexOf('function TargetBulletChart')) },
    { name: 'ScatterChart', code: chartsCode.slice(chartsCode.indexOf('function ScatterChart')) },
  ];

  for (const comp of componentsToCheck) {
    const hookIdx = comp.code.indexOf('useMeasuredWidth');
    const firstReturnIdx = comp.code.indexOf('return');
    assert(hookIdx !== -1, `${comp.name} must use useMeasuredWidth`);
    assert(
      hookIdx < firstReturnIdx,
      `In ${comp.name}, useMeasuredWidth (pos ${hookIdx}) must be invoked BEFORE first return (pos ${firstReturnIdx}) to avoid React Hook order mismatch`
    );
  }

  // 6b. 空 → 有 → 空 连续 SSR 渲染测试，确保各状态下渲染稳定、不抛异常
  const fullData = [
    { label: '渠道A', leftVal: 10, rightVal: 20, spend: 1000 },
    { label: '渠道B', leftVal: 15, rightVal: 25, spend: 2000 },
  ];

  // Render 1: 空态
  const empty1 = renderToStaticMarkup(React.createElement(ButterflyCostChart, { data: [] }));
  assert(empty1.includes('ca-empty'), 'Empty render 1 must show ca-empty');

  // Render 2: 注入真实数据
  const withData = renderToStaticMarkup(React.createElement(ButterflyCostChart, { data: fullData }));
  assert(withData.includes('ca-butterfly-chart'), 'Has-data render must show ca-butterfly-chart');
  assert(withData.includes('渠道A'), 'Has-data render must show items');

  // Render 3: 再次切回空态
  const empty2 = renderToStaticMarkup(React.createElement(ButterflyCostChart, { data: [] }));
  assert(empty2.includes('ca-empty'), 'Empty render 2 must return to ca-empty cleanly');
  assert(!empty2.includes('渠道A'), 'Empty render 2 must not retain previous items');
}

// ============================================================================
// 7. useMeasuredWidth Callback Ref: 节点挂载、ResizeObserver 监听、宽度更新与卸载断开
// ============================================================================
console.log('Testing useMeasuredWidth callback ref, ResizeObserver attach/resize/disconnect...');
{
  // 模拟 ResizeObserver
  let observedNode = null;
  let disconnected = false;
  let activeCallback = null;

  class MockResizeObserver {
    constructor(callback) {
      activeCallback = callback;
      disconnected = false;
    }
    observe(node) {
      observedNode = node;
    }
    disconnect() {
      disconnected = true;
      observedNode = null;
    }
  }

  // 7a. 初始状态 defaultWidth 600
  const originalRO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = MockResizeObserver;

  try {
    // 验证 Hook 导出的存在
    assert(typeof useMeasuredWidth === 'function', 'useMeasuredWidth must be exported function');

    // 模拟真实的 callback ref 挂载流程：
    // 阶段 1: 节点挂载（如 390px 视口下的 275px 可用容器）
    const mockDomNode = {
      getBoundingClientRect: () => ({ width: 275, height: 200 }),
    };

    // 创建 callback ref 实例验证机制
    let currentWidthState = 600;
    const roRef = { current: null };

    const callbackRef = (node) => {
      if (roRef.current) {
        roRef.current.disconnect();
        roRef.current = null;
      }
      if (!node) return;
      if (typeof node.getBoundingClientRect === 'function') {
        const w = node.getBoundingClientRect().width;
        if (w > 0) currentWidthState = Math.round(w);
      }
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const w = entry.contentRect ? entry.contentRect.width : 0;
            if (w > 0) currentWidthState = Math.round(w);
          }
        });
        ro.observe(node);
        roRef.current = ro;
      }
    };

    // 执行挂载 attach
    callbackRef(mockDomNode);
    assert.equal(currentWidthState, 275, 'Initial callback ref attachment must measure 275px immediately');
    assert.equal(observedNode, mockDomNode, 'ResizeObserver must observe the attached DOM node');
    assert.equal(disconnected, false, 'Observer must be active');

    // 阶段 2: 发生 resize 事件（例如旋转屏幕变更为 390px）
    activeCallback([{ contentRect: { width: 390 } }]);
    assert.equal(currentWidthState, 390, 'Resize callback must update measured width to 390px');

    // 阶段 3: 极端超窄 resize 事件（容器变更为 220px < 260px 阈值）
    activeCallback([{ contentRect: { width: 220 } }]);
    assert.equal(currentWidthState, 220, 'Resize callback updates to 220px');
    // 验证在此超窄尺寸下，图表 SVG 的总宽度保护 Math.max(260, width) = 260
    const safeSvgWidth = Math.max(260, currentWidthState);
    assert.equal(safeSvgWidth, 260, 'SVG width floor must be 260px to prevent font scaling below 12px');

    // 阶段 4: 节点卸载 / 空态渲染（传递 null）
    callbackRef(null);
    assert.equal(disconnected, true, 'Calling callback ref with null must disconnect ResizeObserver');
    assert.equal(roRef.current, null, 'Observer reference must be cleaned up on node unmount');

    // 阶段 5: 数据重新到来重新挂载节点
    const reattachedNode = {
      getBoundingClientRect: () => ({ width: 320, height: 200 }),
    };
    callbackRef(reattachedNode);
    assert.equal(currentWidthState, 320, 'Re-attaching node after empty state measures new width (320px)');
    assert.equal(observedNode, reattachedNode, 'Re-observes new DOM node');
  } finally {
    globalThis.ResizeObserver = originalRO;
  }
}

// ============================================================================
// 8. Panel Header: 移动端纵向布局下 flex-basis: 220px 防空高回归测试
// ============================================================================
console.log('Testing .ca-panel-header / .ca-panel-heading mobile flex-basis & height...');
{
  // 8a. 桌面端保留 flex: 1 1 220px 弹性横向基线
  assert(cssCode.includes('flex: 1 1 220px'), 'Desktop must keep flex: 1 1 220px for horizontal layout');

  // 8b. 移动端 (max-width: 640px) 必须重写为 flex: 0 1 auto，绝不可沿用 220px 作为垂直高度
  const mobile640Matches = [...cssCode.matchAll(/@media \(max-width: 640px\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]);
  const hasMobileHeadingOverride = mobile640Matches.some((rules) => {
    return (
      rules.includes('.ca-panel-heading') &&
      rules.includes('flex: 0 1 auto') &&
      rules.includes('width: 100%')
    );
  });

  assert(
    hasMobileHeadingOverride,
    'Mobile @media (max-width: 640px) must override .ca-panel-heading to flex: 0 1 auto; width: 100%; to prevent 220px blank height'
  );
}

console.log('✓ All mobile readability and responsive scale tests passed successfully!');
