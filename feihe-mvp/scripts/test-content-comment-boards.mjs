import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = path.resolve(import.meta.dirname, '..');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(filename);
  const require = name => {
    if (!name.startsWith('.')) return nativeRequire(name);
    const base = path.resolve(path.dirname(filename), name);
    const resolved = ['.tsx', '.ts'].map(ext => base + ext).find(file => fs.existsSync(file));
    assert(resolved, `Local import resolves: ${name}`);
    return load(resolved);
  };
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, {})(require, result, result.exports);
  cache.set(filename, result.exports);
  return result.exports;
}
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const { emptyNotesSummary, sourceLabel } = load('features/content/content-view-model.ts');
const { NoteSummaryBoard } = load('features/content/NoteSummaryBoard.tsx');
const { CollectionSnapshotBoard } = load('features/comments/CollectionSnapshotBoard.tsx');
const { CommentEfficiencyBoard } = load('features/comments/CommentEfficiencyBoard.tsx');
const { ContentAnalyticsBoard } = load('features/content/ContentAnalyticsBoard.tsx');
const { ContentPerformance } = load('features/content/ContentPerformance.tsx');

assert.equal(sourceLabel('owned'), '自有发布');
assert.equal(sourceLabel('keyword_scan'), '关键词扫描');
assert.equal(sourceLabel('新增来源'), '新增来源');
const empty = render(NoteSummaryBoard, { mode: 'registry', summary: emptyNotesSummary, loading: false });
assert.match(empty, /暂无笔记资产/);
assert.doesNotMatch(empty, /NaN|Infinity|100%/);
const partial = render(NoteSummaryBoard, { mode: 'registry', loading: false,
  summary: { ...emptyNotesSummary, total: 4, basicProfileCount: 1, missingBasicProfileCount: 3 } });
assert.match(partial, /25\.0%/);
assert.match(partial, /75\.0%/);
const unknown = render(NoteSummaryBoard, { mode: 'collection', loading: false,
  summary: { ...emptyNotesSummary, total: 4, fetchedCount: 1, unfetchedCount: 2 } });
assert.match(unknown, /1 篇状态未归类/);
assert.match(render(NoteSummaryBoard, { mode: 'registry', summary: emptyNotesSummary, loading: false, error: '请求失败' }), /看板暂不可用/);
const snapshots = render(CollectionSnapshotBoard, { loading: false, items: [
  { latestSnapshotTime: '2026-09-08', commentDelta: 3 },
  { latestSnapshotTime: '2026-09-08', commentDelta: -2 },
  { latestSnapshotTime: '2026-09-08', commentDelta: 0 },
  { latestSnapshotTime: '2026-09-08', commentDelta: null },
] });
assert.equal((snapshots.match(/25\.0%/g) || []).length, 4, 'Zero change is comparable; missing history is a separate bucket');

// Execute the real summary expressions against an isolated in-memory database.
// One pending row may match multiple actions, while handledCount counts rows.
const route = fs.readFileSync(path.join(root, 'app/api/actions/workbench/route.ts'), 'utf8');
const sql = route.match(/d1\.prepare\(`\s*(SELECT[\s\S]*?FROM key_comments[\s\S]*?)`\)/)?.[1];
assert(sql, 'Find the actual key-comment summary query');
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE key_comments (project_id TEXT, action TEXT, treatment_status TEXT, disappeared_at TEXT)');
const insert = db.prepare('INSERT INTO key_comments VALUES (?, ?, ?, NULL)');
insert.run('test', '回复后删除', '待处理');
insert.run('test', '回复', '已处理');
const counts = db.prepare(sql).get('test');
assert.equal(counts.replyPending, 1);
assert.equal(counts.deletePending, 1);
assert.equal(counts.handledCount, 1);
const actions = render(CommentEfficiencyBoard, { summary: { ...counts, totalPending: 2 }, onSelectAction() {} });
assert.equal((actions.match(/50\.0%/g) || []).length, 2);
assert.match(actions, /暂不计算闭环率/);
assert.equal((actions.match(/class="subtle-btn"/g) || []).length, 4);
assert.doesNotMatch(actions, /33\.3%|66\.7%/);
db.close();
const sources = render(ContentAnalyticsBoard, { analytics: {
  sourceDistribution: [{ name: 'owned', count: 1 }, { name: 'keyword_scan', count: 1 }],
  dataQuality: {}, creatorLevels: [], formats: [],
} });
assert.match(sources, /自有发布/);
assert.match(sources, /关键词扫描/);
assert.doesNotMatch(sources, /keyword_scan|NaN|Infinity/);

// ContentPerformance balanced boards & metrics verification
const perfHtml = render(ContentPerformance, {
  data: {
    metrics: {
      noteCount: 1419,
      exposure: 201392472,
      readCount: 35883074,
      interactionCount: 1240691,
      likeCount: 762933,
      favoriteCount: 344467,
      shareCount: 38282,
      commentTotal: 343,
      creatorCost: 5230389,
      actions: { replyPending: 58, deletePending: 43 },
    },
    analytics: {
      dataQuality: { total: 1419, metricCount: 1371 },
      categories: [{ name: '母婴育儿', count: 1047, interactions: 998401, reads: 20700662 }],
      topics: [{ name: '购买/产品问询', count: 58 }],
      statusDistribution: [{ name: '待抓取', count: 820 }],
      creatorLevels: [{ name: '素人', count: 414, avgRead: 11693, avgInteraction: 361, avgCpe: 2.18 }],
      locations: [{ name: '广东', count: 9 }, { name: '待补充', count: 1359 }],
      sourceDistribution: [{ name: 'commercial', count: 1346 }],
      scopeDistribution: [{ name: '本品', count: 1419 }],
      formats: [{ name: '图文', count: 1280, interactions: 730099 }],
      topNotes: [],
    },
    pipelines: [{ id: 'viral', name: '素人评论大爆文', deliveredCount: 128, targetCount: 200, spent: 15360, budget: 24000 }],
  },
  openNote() {},
});
assert.match(perfHtml, /一级内容方向互动贡献/);
assert.match(perfHtml, /核心互动类型构成拆解/);
assert.match(perfHtml, /投放需求管线交付进度/);
assert.match(perfHtml, /品牌声量与千次投放成效/);
assert.match(perfHtml, /评论预警处置与闭环进度/);
assert.doesNotMatch(perfHtml, /NaN|Infinity/);

console.log('PASS subpage boards: empty/error states, coverage gaps, snapshot deltas, Chinese labels, actual SQL action overlap and consistent denominator, styled filter buttons. Fixtures stay in memory.');
