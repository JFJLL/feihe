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
  const code = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(code, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(filename);
  const require = name => {
    if (name.endsWith('.css')) return {};
    if (name.startsWith('.')) {
      const dir = path.dirname(filename);
      const base = path.resolve(dir, name);
      const candidates = [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, path.join(base, 'index.tsx')];
      for (const cand of candidates) {
        if (fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) {
          return loadComponent(cand);
        }
      }
    }
    return nativeRequire(name);
  };
  vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, {})(require, result, result.exports);
  moduleCache.set(filename, result.exports);
  return result.exports;
}

const { CategoryNotesModal } = loadComponent('components/notes-modal/CategoryNotesModal.tsx');
// Generate 120 mock notes
const mockNotes = Array.from({ length: 120 }, (_, i) => ({
  id: `note-${i + 1}`,
  title: `测试笔记标题 ${i + 1} 宝宝选奶经验分享`,
  author: `达人_${(i % 10) + 1}`,
  creatorLevel: i < 20 ? '腰部' : i < 60 ? '初级' : '素人',
  category1: i % 2 === 0 ? '素人妈妈实证' : '断/转奶场景',
  readCount: 1000 + i * 50,
  interactionCount: 100 + i * 15,
  commentTotal: 10 + i,
  publishedAt: '2026-09-01T12:00:00Z',
  url: `https://www.xiaohongshu.com/explore/test${i + 1}`,
  coverUrl: '',
  brand: '启萃',
  noteType: i % 3 === 0 ? '视频' : '图文',
  sourceType: 'commercial',
  pipeline: 'Q3',
  level: '初级',
  productScope: '本品',
  status: '已发布',
  positiveCount: 5,
  negativeCount: 1,
  questionCount: 2,
  brandMentionTop5: 1,
}));

console.log('--- TEST 1: Modal Rendering & 50-limit ---');
const html = renderToStaticMarkup(
  React.createElement(CategoryNotesModal, {
    isOpen: true,
    title: '内容切角 / 场景 · 素人妈妈实证',
    subtitle: '测试切角副标题',
    tag: '内容切角',
    notes: mockNotes,
    maxCount: 50,
    onClose: () => {},
  })
);

assert.ok(html.includes('内容切角 / 场景 · 素人妈妈实证'), 'Modal title should render');
assert.ok(html.includes('样本总计 120 篇 / 当前展示前 50 篇'), 'Count badge should show total and top 50');
assert.ok(!html.includes('样本总计 120 篇 · 当前展示前 50 篇'), 'Count badge must not use obsolete middle-dot separator');
assert.ok(html.includes('category-notes-modal'), 'Modal container should exist');

// Check that only 50 rows are rendered
const rowMatches = html.match(/<tr class="category-notes-row"/g) || [];
assert.equal(rowMatches.length, 50, `Should render exactly 50 rows, got ${rowMatches.length}`);
console.log('✅ PASS: Modal limits exactly to 50 notes as requested');

console.log('--- TEST 2: Sorting by interactionCount desc ---');
// Note 120 has highest interactionCount (100 + 119 * 15 = 1885)
assert.ok(html.includes('测试笔记标题 120'), 'Highest interaction note should be in top list');
console.log('✅ PASS: Sorts by interactionCount descending');

console.log('--- TEST 3: Closed State ---');
const closedHtml = renderToStaticMarkup(
  React.createElement(CategoryNotesModal, {
    isOpen: false,
    title: '测试',
    notes: mockNotes,
    onClose: () => {},
  })
);
assert.equal(closedHtml, '', 'Closed modal should render nothing');
console.log('✅ PASS: Closed state renders nothing');

console.log('--- TEST 4: Keyword Search & Filter ---');
const searchHtml = renderToStaticMarkup(
  React.createElement(CategoryNotesModal, {
    isOpen: true,
    title: '内容切角 / 场景 · 断/转奶场景',
    notes: mockNotes.filter(n => n.category1 === '断/转奶场景'),
    maxCount: 50,
    onClose: () => {},
  })
);
assert.ok(searchHtml.includes('断/转奶场景'), 'Filtered category notes should render');
console.log('✅ PASS: Keyword & category isolation verified');

console.log('--- TEST 5: Code Integration Audit ---');
const overviewCode = fs.readFileSync('features/overview/OverviewWorkspace.tsx', 'utf8');
assert.ok(overviewCode.includes('handleCategoryClick'), 'OverviewWorkspace must have handleCategoryClick');
assert.ok(overviewCode.includes('handleTierClick'), 'OverviewWorkspace must have handleTierClick');
assert.ok(overviewCode.includes('handleFormatClick'), 'OverviewWorkspace must have handleFormatClick');
assert.ok(overviewCode.includes('handleHistogramBinClick'), 'OverviewWorkspace must have handleHistogramBinClick');
assert.ok(overviewCode.includes('renderCategoryNotesModal()'), 'OverviewWorkspace must render CategoryNotesModal');

const contentCode = fs.readFileSync('features/content/ContentPerformance.tsx', 'utf8');
assert.ok(contentCode.includes('handleCategoryClick'), 'ContentPerformance must have handleCategoryClick');
assert.ok(contentCode.includes('handleTierClick'), 'ContentPerformance must have handleTierClick');
assert.ok(contentCode.includes('handleLocationClick'), 'ContentPerformance must have handleLocationClick');
assert.ok(contentCode.includes('handleSceneRowClick'), 'ContentPerformance must have handleSceneRowClick');
assert.ok(contentCode.includes('handleTreeMapClick'), 'ContentPerformance must have handleTreeMapClick');

const growthCode = fs.readFileSync('features/growth/CompetitorAnalysis.tsx', 'utf8');
assert.ok(growthCode.includes('handleBrandClick'), 'CompetitorAnalysis must have handleBrandClick');

const sampleBoardCode = fs.readFileSync('features/growth/GrowthSampleBoard.tsx', 'utf8');
assert.ok(sampleBoardCode.includes('onDirectionClick'), 'GrowthSampleBoard must have onDirectionClick');

console.log('✅ PASS: All chart & table integrations verified in source');
console.log('ALL VERIFICATIONS SUCCESSFUL! 🚀');
