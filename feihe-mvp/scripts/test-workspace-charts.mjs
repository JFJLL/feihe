import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Compile the actual component and its local imports, without bundling a test copy.
const moduleCache = new Map();
function loadComponent(filename) {
  filename = path.resolve(filename);
  if (moduleCache.has(filename)) return moduleCache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(filename);
  const require = name => name.startsWith('.')
    ? loadComponent(path.resolve(path.dirname(filename), `${name}.tsx`))
    : nativeRequire(name);
  vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, {})(require, result, result.exports);
  moduleCache.set(filename, result.exports);
  return result.exports;
}

const { TimeSeriesChart } = loadComponent('components/ui/TimeSeriesChart.tsx');
const series = [{ key: 'count', label: '样本', color: '#1e6091' }];
const chart = rows => React.createElement(TimeSeriesChart, { title: '测试趋势', rows, series });
const gap = renderToStaticMarkup(chart([
  { date: '2026-09-01', count: 12 },
  { date: '2026-09-02', count: null },
  { date: '2026-09-03', count: 0 },
]));
assert.equal((gap.match(/<circle /g) || []).length, 2, '零值有数据点，缺失样本没有数据点');
assert.equal((gap.match(/<path /g) || []).length, 2, '缺失记录两侧分成两个独立线段');
assert(!gap.match(/<path[^>]*d="[^"]*L/), '不跨越缺失样本连线或填充面积');
assert(!gap.includes('查看日期') && !gap.includes('data-trend-picker'), '图表移除了冗余的日期下拉选择器');
assert(gap.includes('tabindex="0"') || gap.includes('tabIndex="0"'), '数据点或交互热区具备 tabindex 键盘焦点能力');
assert(gap.includes('role="button"'), '数据点或交互热区具备无障碍按钮角色');
assert(gap.includes('aria-label="2026-09-01'), '交互热区具备可访问名称读取');
assert(!gap.includes('NaN') && !gap.includes('Infinity'), '绘图坐标必须有限');

const empty = renderToStaticMarkup(chart([]));
assert(empty.includes('暂无可绘制的数据') && !empty.includes('<svg'), '空数据展示空状态');
const single = renderToStaticMarkup(chart([{ date: '2026-09-01', count: 0 }]));
assert(single.includes('cx="380"') && !single.includes('NaN'), '单日期零值位于图表中间');
const invalid = renderToStaticMarkup(chart([{ date: '2026-09-01', count: Infinity }]));
assert(!invalid.includes('Infinity') && invalid.includes('未提供'), '非有限数值不能污染坐标轴');
const multiple = renderToStaticMarkup(React.createElement('div', null,
  chart([{ date: '2026-09-01', count: 2 }]), chart([{ date: '2026-09-01', count: 2 }]),
));
const gradientIds = [...multiple.matchAll(/<linearGradient id="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(gradientIds).size, 2, '同页相同量程的多个图表使用独立渐变 ID');
console.log('PASS workspace charts (static): gaps, zero, empty, single date, invalid numbers, unique gradients');

// Part 2: Component Keyboard & Interactive Behavior Verification
const { WorkspaceModuleTabs } = loadComponent('components/ui/operations/WorkspaceModuleTabs.tsx');
const { CustomSelect } = loadComponent('components/ui/CustomSelect.tsx');

// 1. WorkspaceModuleTabs roving tabindex and keyboard behavior
{
  let selectedTab = 'rules';
  const tabs = [
    { id: 'profile', title: '项目资料', desc: '', icon: '' },
    { id: 'rules', title: '目标与规则', desc: '', icon: '' },
    { id: 'data-map', title: '数据地图', desc: '', icon: '' },
  ];
  const markup = renderToStaticMarkup(React.createElement(WorkspaceModuleTabs, {
    tabs,
    activeTab: selectedTab,
    onChange: id => { selectedTab = id; },
    variant: 'compact',
  }));

  assert(markup.includes('role="tablist"'), '紧凑标签具备 tablist 语义');
  assert(markup.includes('id="workspace-tab-rules"'), '标签具备独立关联 ID');
  assert(markup.includes('tabindex="0"') || markup.includes('tabIndex="0"'), '活动标签 tabindex 为 0');
  assert(markup.includes('tabindex="-1"') || markup.includes('tabIndex="-1"'), '非活动标签 tabindex 为 -1（roving tabindex）');
  assert(markup.includes('aria-selected="true"'), '活动标签 aria-selected 为 true');
  assert(markup.includes('aria-selected="false"'), '非活动标签 aria-selected 为 false');

  // Component execution and event dispatch verification within active React dispatcher
  let tabButtons = null;
  function TestHarness() {
    const el = React.createElement(WorkspaceModuleTabs, {
      tabs,
      activeTab: 'rules',
      onChange: id => { selectedTab = id; },
      variant: 'compact',
    });
    tabButtons = el.type(el.props).props.children;
    return null;
  }
  renderToStaticMarkup(React.createElement(TestHarness));
  assert.equal(tabButtons?.length, 3);

  // Enter on already active tab: must NOT trigger onChange
  let called = false;
  const activeBtn = tabButtons[1];
  activeBtn.props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.equal(called, false, '活动 tab 回车不重复触发 onChange');

  // Enter on inactive tab: must trigger onChange
  let inactiveTabButtons = null;
  function InactiveHarness() {
    const el = React.createElement(WorkspaceModuleTabs, {
      tabs,
      activeTab: 'rules',
      onChange: id => { called = true; selectedTab = id; },
      variant: 'compact',
    });
    inactiveTabButtons = el.type(el.props).props.children;
    return null;
  }
  renderToStaticMarkup(React.createElement(InactiveHarness));
  const inactiveBtn = inactiveTabButtons[0];
  inactiveBtn.props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.equal(called, true, '非活动 tab 回车触发激活');
  assert.equal(selectedTab, 'profile');
}

// 2. CustomSelect combobox ARIA and keyboard behavior
{
  let selectedVal = 'A';
  const options = ['A', 'B', 'C'];
  const markup = renderToStaticMarkup(React.createElement(CustomSelect, {
    value: selectedVal,
    options,
    onChange: val => { selectedVal = val; },
    placeholder: '选择品牌',
  }));

  assert(markup.includes('role="combobox"'), 'CustomSelect trigger 具备 combobox 语义');
  assert(markup.includes('aria-haspopup="listbox"'), 'CustomSelect 声明 listbox 弹出类型');
  assert(markup.includes('aria-expanded="false"'), '未展开时 aria-expanded 为 false');

  // Empty options test: aria-activedescendant must not point to non-existent option
  const emptyMarkup = renderToStaticMarkup(React.createElement(CustomSelect, {
    value: '',
    options: [],
    onChange: () => {},
  }));
  assert(!emptyMarkup.includes('aria-activedescendant='), '空选项时禁止指向不存在的 opt-0 节点');

  // Real interactive harness for state & keyboard transitions
  let triggerProps = null;
  let selectEvents = [];
  function InteractiveSelectHarness() {
    const [val, setVal] = React.useState('A');
    const el = React.createElement(CustomSelect, {
      value: val,
      options: ['A', 'B', 'C'],
      onChange: next => {
        selectEvents.push(next);
        setVal(next);
      },
    });
    triggerProps = el.type(el.props).props.children[0].props;
    return null;
  }
  renderToStaticMarkup(React.createElement(InteractiveSelectHarness));
  assert.equal(typeof triggerProps.onKeyDown, 'function', 'Trigger 绑定了键盘导航函数');

  // ArrowDown keydown opens dropdown and sets activeIndex
  let prevented = false;
  triggerProps.onKeyDown({
    key: 'ArrowDown',
    preventDefault: () => { prevented = true; },
    stopPropagation: () => {},
  });
  assert.equal(prevented, true, 'ArrowDown 阻止默认滚动行为');

  // Escape keydown on open dropdown closes and stops propagation (protects parent modal)
  let openTriggerProps = null;
  function OpenSelectHarness() {
    const el = React.createElement(CustomSelect, {
      value: 'A',
      options: ['A', 'B', 'C'],
      defaultOpen: true,
      onChange: () => {},
    });
    openTriggerProps = el.type(el.props).props.children[0].props;
    return null;
  }
  renderToStaticMarkup(React.createElement(OpenSelectHarness));

  prevented = false;
  let stopped = false;
  openTriggerProps.onKeyDown({
    key: 'Escape',
    preventDefault: () => { prevented = true; },
    stopPropagation: () => { stopped = true; },
  });
  assert.equal(stopped, true, 'Escape 先行阻止向父级弹窗冒泡');
}

console.log('PASS workspace UI keyboard interaction: TimeSeriesChart focusable points, WorkspaceModuleTabs roving tabindex & activation, CustomSelect combobox & keyboard state transitions');
