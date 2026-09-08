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
console.log('PASS workspace charts: gaps, zero, empty, single date, invalid numbers, keyboard selector, unique gradients');
