import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const rootDir = path.resolve(import.meta.dirname, '..');
const moduleCache = new Map();

function loadComponent(filename) {
  const resolved = path.isAbsolute(filename) ? filename : path.resolve(rootDir, filename);
  if (moduleCache.has(resolved)) return moduleCache.get(resolved);
  const code = fs.readFileSync(resolved, 'utf8');
  const compiled = ts.transpileModule(code, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(resolved);
  const customRequire = (name) => {
    if (name.endsWith('.css')) return {};
    if (name.startsWith('@/')) {
      const base = path.resolve(rootDir, name.slice(2));
      const candidates = [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, path.join(base, 'index.tsx')];
      for (const cand of candidates) {
        if (fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) {
          return loadComponent(cand);
        }
      }
    }
    if (name.startsWith('.')) {
      const dir = path.dirname(resolved);
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
  const fn = vm.runInThisContext(
    `(function(require, module, exports) { ${compiled}\n})`
  );
  fn(customRequire, result, result.exports);
  moduleCache.set(resolved, result.exports);
  return result.exports;
}

// Load components
const { IndustryV2OverviewTab } = loadComponent('features/industry/IndustryV2OverviewTab.tsx');
const { IndustryV2ContentTab } = loadComponent('features/industry/IndustryV2ContentTab.tsx');
const { IndustryV2CreatorsTab } = loadComponent('features/industry/IndustryV2CreatorsTab.tsx');
const { IndustryV2RhythmTab } = loadComponent('features/industry/IndustryV2RhythmTab.tsx');
const { IndustryV2ActionsTab } = loadComponent('features/industry/IndustryV2ActionsTab.tsx');
const { IndustryV2Header } = loadComponent('features/industry/IndustryV2Header.tsx');
const {
  isSafeHttpUrl,
  formatMetricNumber,
  formatMetricPercent,
  CoverageStatusBadge,
  KpiCard,
  EmptyStateBox,
} = loadComponent('features/industry/IndustryV2Widgets.tsx');

console.log('--- 开始测试 Industry V2 UI 组件契约与静态渲染 ---');

// 1. Test helper functions
console.log('[Test 1] 校验安全 URL 检查函数 isSafeHttpUrl');
assert.equal(isSafeHttpUrl('https://www.xiaohongshu.com/discovery/item/64abcd'), true);
assert.equal(isSafeHttpUrl('http://example.com/test'), true);
assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);
assert.equal(isSafeHttpUrl(''), false);
assert.equal(isSafeHttpUrl(null), false);
assert.equal(isSafeHttpUrl(undefined), false);

console.log('[Test 2] 校验指标格式化函数');
assert.equal(formatMetricNumber(1250000), '1,250,000');
assert.equal(formatMetricNumber(null), '-');
assert.equal(formatMetricPercent({ value: 0.352, known: 100, total: 100 }), '35.2%');
assert.equal(formatMetricPercent({ value: null, known: 0, total: 100 }), '-');

// Mock contract report
const mockReport = {
  version: 2,
  config: {
    projectId: 'feihe-qicui',
    spu: '启萃',
    brand: '飞鹤',
    scopeKey: 'qicui',
    categoryKeyword: '婴幼儿奶粉',
    competitorKeywords: ['星飞帆', '卓睿'],
    historyDays: 30,
    dailyEnabled: true,
    queries: [
      { id: 'q-own', kind: 'own', label: '启萃', keyword: '启萃' },
      { id: 'q-cat', kind: 'category', label: '婴幼儿奶粉', keyword: '婴幼儿奶粉' },
      { id: 'q-comp1', kind: 'competitor', label: '星飞帆', keyword: '星飞帆' },
      { id: 'q-comp2', kind: 'competitor', label: '卓睿', keyword: '卓睿' },
    ],
  },
  from: '2026-09-20',
  to: '2026-10-20',
  generatedAt: '2026-10-21T08:00:00Z',
  latestCollectedAt: '2026-10-21T06:30:00Z',
  coverage: {
    expected: 120,
    complete: 110,
    partial: 6,
    failed: 0,
    running: 4,
    pending: 0,
    rows: [
      { queryId: 'q-own', date: '2026-10-20', status: 'complete', fetched: 45, reportedTotal: 45, pages: 3, error: null },
      { queryId: 'q-cat', date: '2026-10-20', status: 'partial', fetched: 60, reportedTotal: 120, pages: 3, error: null },
    ],
  },
  summary: {
    notes: 480,
    creators: 320,
    impressions: { value: 1250000, known: 380, total: 480 },
    reads: { value: 450000, known: 320, total: 480 },
    interactions: { value: 68500, known: 450, total: 480 },
    commercialRate: { value: 0.35, known: 400, total: 480 },
    promotedRate: { value: 0.12, known: 350, total: 480 },
    noteChange: 45,
    changeReason: '较上周期新增 45 篇',
  },
  comparison: [
    {
      query: { id: 'q-own', kind: 'own', label: '启萃', keyword: '启萃' },
      notes: 120,
      creators: 85,
      interactions: { value: 24000, known: 110, total: 120 },
      impressions: { value: 400000, known: 100, total: 120 },
      commercialRate: { value: 0.4, known: 110, total: 120 },
      promotedRate: { value: 0.15, known: 100, total: 120 },
      completeDays: 28,
      expectedDays: 30,
    },
    {
      query: { id: 'q-comp1', kind: 'competitor', label: '星飞帆', keyword: '星飞帆' },
      notes: 160,
      creators: 110,
      interactions: { value: 31000, known: 150, total: 160 },
      impressions: { value: 520000, known: 140, total: 160 },
      commercialRate: { value: 0.32, known: 150, total: 160 },
      promotedRate: { value: 0.1, known: 130, total: 160 },
      completeDays: 29,
      expectedDays: 30,
    },
  ],
  trend: [
    { date: '2026-10-18', notes: 35, commercial: 12, promoted: 4, interactions: 4500, complete: true },
    { date: '2026-10-19', notes: 0, commercial: 0, promoted: 0, interactions: 0, complete: true },
    { date: '2026-10-20', notes: null, commercial: null, promoted: null, interactions: null, complete: false }, // Missing sample
  ],
  content: {
    scenes: [
      { label: '断奶转奶', count: 140, interactions: 28000, meanInteractions: 200, evidenceIds: ['n-1'] },
      { label: '夜间喂养', count: 85, interactions: 15000, meanInteractions: 176, evidenceIds: ['n-2'] },
    ],
    sellingPoints: [
      { label: '好吸收不上火', count: 180, interactions: 34000, meanInteractions: 188, evidenceIds: ['n-1'] },
    ],
    formats: [
      { label: '图文笔记', count: 320, interactions: 42000, meanInteractions: 131, evidenceIds: ['n-1'] },
      { label: '视频笔记', count: 160, interactions: 26500, meanInteractions: 165, evidenceIds: ['n-2'] },
    ],
    titlePatterns: [
      { label: '宝妈真实实测分享', count: 95, interactions: 19000, meanInteractions: 200, evidenceIds: ['n-1'] },
    ],
    topNotes: [
      {
        noteId: 'n-1',
        title: '断奶期换口粮实操经验！宝宝肚肚舒服',
        content: '断奶是很多宝妈的痛点，今天来分享一下宝宝断奶选口粮心得...',
        url: 'https://www.xiaohongshu.com/discovery/item/66000001',
        coverUrl: null,
        publishedAt: '2026-10-18T10:00:00Z',
        publishedDate: '2026-10-18',
        brand: '飞鹤',
        creatorId: 'c-101',
        creatorName: '米宝妈妈',
        fans: 85000,
        creatorRegion: '上海',
        creatorGender: '女',
        taxonomy1: '母婴',
        taxonomy2: '奶粉',
        format: 'image',
        commercial: true,
        promoted: false,
        impressions: 45000,
        reads: 18000,
        interactions: 3200,
        likes: 2100,
        comments: 650,
        collects: 450,
        quotedPrice: 15000,
        capturedAt: '2026-10-21T06:00:00Z',
        queryIds: ['q-own'],
      },
    ],
  },
  creators: {
    tiers: [
      { label: '头部达人 (>50万)', count: 12, interactions: 18000, meanInteractions: 1500, evidenceIds: [] },
      { label: '腰部达人 (10-50万)', count: 48, interactions: 24000, meanInteractions: 500, evidenceIds: [] },
      { label: '初级达人 (1-10万)', count: 160, interactions: 19500, meanInteractions: 121, evidenceIds: [] },
      { label: '素人创作者 (<1万)', count: 100, interactions: 7000, meanInteractions: 70, evidenceIds: [] },
    ],
    top: [
      {
        id: 'c-101',
        name: '米宝妈妈',
        fans: 85000,
        notes: 3,
        interactions: 5400,
        quotedPrice: 15000,
        queryIds: ['q-own'],
      },
      {
        id: 'c-102',
        name: '育儿小博士',
        fans: 320000,
        notes: 2,
        interactions: 4800,
        quotedPrice: null, // 未公开报价
        queryIds: ['q-comp1'],
      },
    ],
    repeatCreators: 42,
    unknownCreators: 8,
  },
  traffic: {
    weekday: [
      { label: '周一', count: 65, interactions: 9200, meanInteractions: 141, evidenceIds: [] },
      { label: '周二', count: 72, interactions: 10500, meanInteractions: 145, evidenceIds: [] },
      { label: '周三', count: 68, interactions: 9800, meanInteractions: 144, evidenceIds: [] },
      { label: '周四', count: 75, interactions: 11000, meanInteractions: 146, evidenceIds: [] },
      { label: '周五', count: 80, interactions: 12500, meanInteractions: 156, evidenceIds: [] },
      { label: '周六', count: 62, interactions: 8500, meanInteractions: 137, evidenceIds: [] },
      { label: '周日', count: 58, interactions: 7000, meanInteractions: 120, evidenceIds: [] },
    ],
    commercialVsNatural: [
      { label: '商业报备单', count: 168, interactions: 31000, meanInteractions: 184, evidenceIds: [] },
      { label: '自然发文', count: 312, interactions: 37500, meanInteractions: 120, evidenceIds: [] },
    ],
    promotedVsOrganic: [
      { label: '平台投流', count: 58, interactions: 14500, meanInteractions: 250, evidenceIds: [] },
      { label: '自然流量', count: 422, interactions: 54000, meanInteractions: 127, evidenceIds: [] },
    ],
    readingRate: { value: 0.36, known: 320, total: 480 },
    interactionRate: { value: 0.152, known: 320, total: 480 },
  },
  actions: [
    {
      id: 'act-1',
      priority: 'high',
      title: '加大断奶转奶场景投入，强化好吸收不上火卖点',
      finding: '样本中「断奶转奶」场景篇均互动达 200，明显高于大盘平均水平。',
      suggestion: '建议在 Q4 重点策划「断奶宝妈换粮」专题，联合腰部真实育儿博主打造实测背书。',
      basis: '基于 140 篇场景样本及 180 篇不上火卖点样本综合分析。',
      evidenceIds: ['n-1'],
    },
  ],
  notes: [
    {
      noteId: 'n-1',
      title: '断奶期换口粮实操经验！宝宝肚肚舒服',
      content: '断奶是很多宝妈的痛点，今天来分享一下宝宝断奶选口粮心得...',
      url: 'https://www.xiaohongshu.com/discovery/item/66000001',
      coverUrl: null,
      publishedAt: '2026-10-18T10:00:00Z',
      publishedDate: '2026-10-18',
      brand: '飞鹤',
      creatorId: 'c-101',
      creatorName: '米宝妈妈',
      fans: 85000,
      creatorRegion: '上海',
      creatorGender: '女',
      taxonomy1: '母婴',
      taxonomy2: '奶粉',
      format: 'image',
      commercial: true,
      promoted: false,
      impressions: 45000,
      reads: 18000,
      interactions: 3200,
      likes: 2100,
      comments: 650,
      collects: 450,
      quotedPrice: 15000,
      capturedAt: '2026-10-21T06:00:00Z',
      queryIds: ['q-own'],
    },
  ],
  limitations: [
    '本报告样本来自有限检索接口，仅代表有限样本，不构成全网总体普查。',
    '各查询词为独立采样，不可直接相加或折算为全网市场份额。',
    '单日单查询词受最多 3 页预算限制，发生截断已标记为 partial。',
  ],
};

// 3. Test static render of IndustryV2OverviewTab
console.log('[Test 3] 静态渲染 IndustryV2OverviewTab 并验证 6 KPIs 与独立采样提示');
const overviewHtml = renderToStaticMarkup(React.createElement(IndustryV2OverviewTab, { report: mockReport }));
assert.ok(overviewHtml.includes('样本笔记总量'), '应包含样本笔记总量');
assert.ok(overviewHtml.includes('480'), '应包含笔记数 480');
assert.ok(overviewHtml.includes('+45'), '应包含增量 +45');
assert.ok(overviewHtml.includes('覆盖创作博主'), '应包含覆盖创作博主');
assert.ok(overviewHtml.includes('320'), '应包含博主数 320');
assert.ok(overviewHtml.includes('有效曝光量合计'), '应包含有效曝光量合计');
assert.ok(overviewHtml.includes('有效阅读量合计'), '应包含有效阅读量合计');
assert.ok(overviewHtml.includes('有效互动量合计'), '应包含有效互动量合计');
assert.ok(overviewHtml.includes('未返回项不计入汇总'), '应明确未返回项不计入汇总');
assert.ok(overviewHtml.includes('商业化标注率'), '应包含商业化标注率');
assert.ok(overviewHtml.includes('独立采样'), '必须明确提示独立采样，不可折算市场份额');
assert.ok(overviewHtml.includes('缺'), '趋势图应识别未采样日期并标注缺');
assert.ok(overviewHtml.includes('数据来源：') && overviewHtml.includes('小红书蒲公英'), '总览顶部应明确数据来源');

// 4. Test static render of IndustryV2ContentTab
console.log('[Test 4] 静态渲染 IndustryV2ContentTab 并验证特征分布与安全外链');
const contentHtml = renderToStaticMarkup(React.createElement(IndustryV2ContentTab, { report: mockReport }));
assert.ok(contentHtml.includes('主要讨论场景分布'), '应包含场景分布卡片');
assert.ok(contentHtml.includes('核心卖点与功效诉求'), '应包含卖点分布卡片');
assert.ok(contentHtml.includes('依据行业规则库匹配'), '应使用通用规则匹配说明而非奶粉专属文案');
assert.ok(contentHtml.includes('断奶转奶'), '应包含场景特征标签');
assert.ok(contentHtml.includes('断奶期换口粮实操经验！宝宝肚肚舒服'), '应包含证据笔记标题');
assert.ok(contentHtml.includes('rel="noopener noreferrer"'), '外链必须包含 rel=noopener noreferrer');
assert.ok(contentHtml.includes('target="_blank"'), '外链必须在新标签页打开');

// 5. Test static render of IndustryV2CreatorsTab
console.log('[Test 5] 静态渲染 IndustryV2CreatorsTab 并验证达人层级与标称报价标注');
const creatorsHtml = renderToStaticMarkup(React.createElement(IndustryV2CreatorsTab, { report: mockReport }));
assert.ok(creatorsHtml.includes('达人层级的内容分布 (笔记篇数)'), '标题应明确达人层级内容分布篇数');
assert.ok(creatorsHtml.includes('缺少创作者标识的笔记'), '应明确缺少创作者标识的笔记指标');
assert.ok(creatorsHtml.includes('重点创作者互动榜单'), '应包含重点达人榜单');
assert.ok(creatorsHtml.includes('米宝妈妈'), '应展示创作者米宝妈妈');
assert.ok(creatorsHtml.includes('报价'), '报价字段必须明确标有报价字样，非实际采购成本');
assert.ok(creatorsHtml.includes('未公开报价'), '未提供报价时应显示未公开报价');

// 6. Test static render of IndustryV2RhythmTab
console.log('[Test 6] 静态渲染 IndustryV2RhythmTab 并验证发文节奏');
const rhythmHtml = renderToStaticMarkup(React.createElement(IndustryV2RhythmTab, { report: mockReport }));
assert.ok(rhythmHtml.includes('星期发文分布'), '应包含星期发文分布');
assert.ok(rhythmHtml.includes('商业笔记 vs 自然笔记'), '应包含商业 vs 自然对比');
assert.ok(rhythmHtml.includes('周五'), '应包含周五发文');
assert.ok(rhythmHtml.includes('成对有效样本'), '阅读率应明确成对有效样本');

// 7. Test static render of IndustryV2ActionsTab
console.log('[Test 7] 静态渲染 IndustryV2ActionsTab 并验证优先级与证据笔记关联');
const actionsHtml = renderToStaticMarkup(React.createElement(IndustryV2ActionsTab, { report: mockReport }));
assert.ok(actionsHtml.includes('高优先级建议'), '应展示高优先级数量');
assert.ok(actionsHtml.includes('加大断奶转奶场景投入'), '应展示建议标题');
assert.ok(actionsHtml.includes('现象发现与样本观察'), '应展示样本观察');
assert.ok(!actionsHtml.includes('现象发现与归因'), '严禁使用无因果模型的归因用词');
assert.ok(actionsHtml.includes('样本支撑笔记证据'), '应展示证据支撑笔记');
assert.ok(actionsHtml.includes('米宝妈妈'), '证据笔记应包含创作者信息');

// 8. Test static render of IndustryV2Header
console.log('[Test 8] 静态渲染 IndustryV2Header 并验证采集覆盖与查询词药丸');
const headerHtml = renderToStaticMarkup(
  React.createElement(IndustryV2Header, {
    projectName: '飞鹤启萃营销复盘',
    spu: '启萃',
    brand: '飞鹤',
    configV2: mockReport.config,
    report: mockReport,
    canWrite: true,
    syncing: false,
    activeTab: 'overview',
    selectedQueryId: 'all',
    onSelectTab: () => {},
    onSelectQuery: () => {},
    onOpenConfig: () => {},
    onTriggerEnqueue: async () => {},
  })
);
assert.ok(headerHtml.includes('行业洞察 飞鹤启萃营销复盘'), '应展示项目标题');
assert.ok(headerHtml.includes('SPU: 启萃'), '应展示 SPU 标');
assert.ok(headerHtml.includes('已采完: 110 词×日任务'), '应展示采完词×日任务数');
assert.ok(headerHtml.includes('部分覆盖: 6 词×日任务'), '应展示部分覆盖词×日任务数');
assert.ok(headerHtml.includes('最近真实抓取：'), 'Header应展示最近真实抓取时间');
assert.ok(headerHtml.includes('数据源：小红书蒲公英'), 'Header应展示数据源标');
assert.ok(headerHtml.includes('截止上海前天（T-2），避开平台收录延迟'), '应展示 T-2 避开平台收录延迟说明');
assert.ok(headerHtml.includes('总览看板'), '应包含总览 Tab');
assert.ok(headerHtml.includes('内容策略'), '应包含内容策略 Tab');
assert.ok(headerHtml.includes('达人策略'), '应包含达人策略 Tab');
assert.ok(headerHtml.includes('投放节奏'), '应包含投放节奏 Tab');
assert.ok(headerHtml.includes('机会行动'), '应包含机会行动 Tab');

// 9. Test pending button should NOT be disabled when running === 0
console.log('[Test 9] 验证 pending 状态不禁用手动补采按钮');
const pendingReport = {
  ...mockReport,
  coverage: {
    ...mockReport.coverage,
    running: 0,
    pending: 10,
  },
};
const pendingHeaderHtml = renderToStaticMarkup(
  React.createElement(IndustryV2Header, {
    projectName: '飞鹤启萃营销复盘',
    spu: '启萃',
    brand: '飞鹤',
    configV2: { ...mockReport.config, dailyEnabled: false },
    report: pendingReport,
    canWrite: true,
    syncing: false,
    activeTab: 'overview',
    selectedQueryId: 'all',
    onSelectTab: () => {},
    onSelectQuery: () => {},
    onOpenConfig: () => {},
    onTriggerEnqueue: async () => {},
  })
);
assert.ok(pendingHeaderHtml.includes('自动更新已暂停'), '应展示自动更新已暂停');
assert.ok(!pendingHeaderHtml.includes('disabled="" title="当前有任务等待调度'), 'pending状态且未running时不应被disabled');
assert.ok(pendingHeaderHtml.includes('⚡ 继续更新'), '文案应明确可手动调度补采');

// 10. Test Workspace race condition safeguards in source
console.log('[Test 10] 静态审计 IndustryWorkspace 竞态消除、Query隔离与卸载安全');
const workspaceSrc = fs.readFileSync(path.resolve(rootDir, 'features/industry/IndustryWorkspace.tsx'), 'utf8');
assert.ok(workspaceSrc.includes('startNewGeneration'), '应包含统一代际更新函数 startNewGeneration');
assert.ok(workspaceSrc.includes('abortControllerRef.current?.abort()'), '应主动中止陈旧并发请求');
assert.ok(workspaceSrc.includes("setSelectedQueryId('all')"), '保存配置后必须重置 selectedQueryId 为 all 避免400');
assert.ok(workspaceSrc.includes('const effectGen = generationRef.current;'), '轮询 effect 必须锁定挂载时刻的 generation');
assert.ok(workspaceSrc.includes('effectGen !== generationRef.current'), '代际变更时轮询必须即刻退出避免数据倒灌');

// 11. Test CSS grid breakpoints without auto-fit orphan cards
console.log('[Test 11] 静态审计 CSS 严格断点与孤卡消除');
const cssSrc = fs.readFileSync(path.resolve(rootDir, 'features/industry/industry.css'), 'utf8');
assert.ok(!cssSrc.includes('.v2-kpi-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit'), '禁止在 v2-kpi-grid 中使用 auto-fit 产生 5+1 孤卡');
assert.ok(cssSrc.includes('grid-template-columns: repeat(6, 1fr)'), '总览 6KPI 桌面端必须严格 6 列');
assert.ok(cssSrc.includes('grid-template-columns: repeat(3, 1fr)'), '次级断点必须严格 3 列');
assert.ok(cssSrc.includes('grid-template-columns: repeat(2, 1fr)'), '平板端必须严格 2 列');

console.log('✅ 所有 11 项测试均成功通过！Industry V2 UI 渲染、断点布局、契约与并发安全完全匹配。');
