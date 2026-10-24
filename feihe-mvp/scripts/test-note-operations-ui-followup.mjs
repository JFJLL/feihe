import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const rootDir = path.resolve(import.meta.dirname, '..');
const moduleCache = new Map();

function loadModule(filename) {
  const resolved = path.isAbsolute(filename) ? filename : path.resolve(rootDir, filename);
  if (moduleCache.has(resolved)) return moduleCache.get(resolved);
  const code = fs.readFileSync(resolved, 'utf8');
  const compiled = ts.transpileModule(code, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(resolved);
  const customRequire = (name) => {
    if (name.endsWith('.css')) return {};
    if (name === 'next/navigation') {
      return {
        useSearchParams: () => new URLSearchParams(''),
        useRouter: () => ({ push: () => {}, replace: () => {} }),
      };
    }
    if (name.startsWith('@/')) {
      const base = path.resolve(rootDir, name.slice(2));
      const candidates = [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, path.join(base, 'index.tsx')];
      for (const cand of candidates) {
        if (fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) {
          return loadModule(cand);
        }
      }
    }
    if (name.startsWith('.')) {
      const dir = path.dirname(resolved);
      const base = path.resolve(dir, name);
      const candidates = [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, path.join(base, 'index.tsx')];
      for (const cand of candidates) {
        if (fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) {
          return loadModule(cand);
        }
      }
    }
    return nativeRequire(name);
  };
  const fn = vm.runInThisContext(
    `(function(require, module, exports) { ${compiled}\n})`
  );
  fn(customRequire, result, result.exports);
  moduleCache.set(resolved, result.exports);
  return result.exports;
}

console.log('--- 1. 测试 CSS 规则 (<=640px 紧凑水平滚动与桌面三卡对齐) ---');
const cssPath = path.resolve(rootDir, 'styles/note-operations.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

// 桌面端必须保持三卡对齐
assert.ok(
  cssContent.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'),
  '桌面端应保留 repeat(3, minmax(0, 1fr)) 三卡对齐网格'
);

// 包含 <=640px 媒体查询
assert.ok(
  cssContent.includes('@media (max-width: 640px)'),
  '应包含 @media (max-width: 640px) 响应式断点'
);

// 移动端水平滚动与禁止逐字换行
assert.ok(
  cssContent.includes('overflow-x: auto'),
  '移动端应配置 overflow-x: auto 水平滚动'
);
assert.ok(
  cssContent.includes('white-space: nowrap'),
  '标签与按钮应设置 white-space: nowrap 防止逐字换行'
);

// 移动端隐藏冗余 tab 描述与徽标
assert.ok(
  cssContent.includes('.co-queue-tabs button > span'),
  '应有针对 .co-queue-tabs button > span 的规则'
);
assert.ok(
  cssContent.includes('.co-queue-active-badge'),
  '应有针对 .co-queue-active-badge 的规则'
);
assert.ok(
  cssContent.includes('var(--teal-3, #e0f8f3)'),
  '激活态背景应严格使用 Radix 色板变量 var(--teal-3, #e0f8f3)'
);
assert.ok(
  !cssContent.includes('#e6f7f5'),
  '不得包含非 Radix 规范的 #e6f7f5 颜色值'
);

console.log('✓ CSS 规则断言全部通过');

console.log('--- 2. 测试 cleanScopeHint 展示层中点归一 ---');
const noteOpsModule = loadModule('features/comments/NoteOperationsWorkspace.tsx');
const { cleanScopeHint, cleanMiddleDots, formatJobStatus, formatLinkState } = noteOpsModule;

assert.equal(typeof cleanScopeHint, 'function', 'cleanScopeHint 应为导出函数');
assert.equal(typeof cleanMiddleDots, 'function', 'cleanMiddleDots 应为导出函数');

const rawScope = '当月累计消耗排序 · 无日粒度笔记消耗，尚不能提供每日TOP100';
const cleaned = cleanScopeHint(rawScope);
assert.equal(
  cleaned,
  '当月累计消耗排序 无日粒度笔记消耗，尚不能提供每日TOP100',
  '应成功将中点归一为单空格'
);
assert.ok(!cleaned.includes('·'), '清理后文本不得残留中点');
assert.equal(rawScope, '当月累计消耗排序 · 无日粒度笔记消耗，尚不能提供每日TOP100', '不得改变原始数据源');

// 边界测试
assert.equal(cleanScopeHint(''), '');
assert.equal(cleanScopeHint(null), '');
assert.equal(cleanScopeHint(undefined), '');
assert.equal(cleanScopeHint('无中点普通文本'), '无中点普通文本');
assert.equal(cleanScopeHint('首尾 · 多 · 中点 · '), '首尾 多 中点');

console.log('✓ cleanScopeHint 辅助函数断言全部通过');

console.log('--- 3. 测试 formatJobStatus 采集状态中文映射 ---');
assert.equal(formatJobStatus('partial'), '部分采集');
assert.equal(formatJobStatus('queued'), '排队中');
assert.equal(formatJobStatus('running'), '采集中');
assert.equal(formatJobStatus('retry'), '待重试');
assert.equal(formatJobStatus('success'), '采集成功');
assert.equal(formatJobStatus('failed'), '采集失败');
assert.equal(formatJobStatus('custom_enum_val'), 'custom_enum_val', '未知枚举应保留合理默认值');
assert.equal(formatJobStatus(''), '未开始');
assert.equal(formatJobStatus(null), '未开始');

console.log('✓ formatJobStatus 业务文案映射通过');

console.log('--- 4. 测试 formatLinkState 原文链接状态中文映射 ---');
assert.equal(formatLinkState('unchecked'), '未校验');
assert.equal(formatLinkState('available'), '可用');
assert.equal(formatLinkState('unavailable'), '已失效');
assert.equal(formatLinkState('uncertain'), '待核验');
assert.equal(formatLinkState('unknown_link_state'), 'unknown_link_state', '未知链接状态应保留合理默认');
assert.equal(formatLinkState(''), '未校验');
assert.equal(formatLinkState(null), '未校验');

console.log('✓ formatLinkState 业务文案映射通过');

console.log('--- 5. 测试 NoteOperationsWorkspace 源码结构验证 ---');
const workspaceSrc = fs.readFileSync(
  path.resolve(rootDir, 'features/comments/NoteOperationsWorkspace.tsx'),
  'utf8'
);

assert.ok(
  workspaceSrc.includes('cleanScopeHint(data.ranking)'),
  '队列正文提示应使用 cleanScopeHint 渲染'
);
assert.ok(
  workspaceSrc.includes('formatJobStatus(detail.attempts[0].status)'),
  '详情页最近采集任务应映射中文状态'
);
assert.ok(
  workspaceSrc.includes('formatLinkState(detail.note.linkState)'),
  '详情页链接状态应映射中文文案'
);
assert.ok(
  workspaceSrc.includes('CustomDatePicker'),
  '日期选择器 CustomDatePicker 应保持不变'
);

console.log('✓ 组件展示层绑定断言全部通过');
console.log('\n========================================');
console.log('所有评论运营 UI 跟进回归测试全部通过 (5/5)');
console.log('========================================');
