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

const { IndustryV2OverviewTab } = loadComponent('features/industry/IndustryV2OverviewTab.tsx');
const { IndustryV2ContentTab } = loadComponent('features/industry/IndustryV2ContentTab.tsx');
const {
  QueryPillBadge,
  cleanQueryLabel,
} = loadComponent('features/industry/IndustryV2Widgets.tsx');

console.log('--- 开始精确回归测试：Industry 页面收尾修复项 (test-industry-browser-followup) ---');

const baseMockReport = {
  version: 2,
  config: {
    projectId: 'feihe-qicui',
    brand: '飞鹤',
    spu: '启萃',
    categoryKeyword: '婴幼儿奶粉',
    competitorKeywords: ['星飞帆', '卓睿'],
    lookbackDays: 30,
    dailyEnabled: true,
  },
  from: '2026-09-24',
  to: '2026-10-23',
  generatedAt: '2026-10-24T02:00:00.000Z',
  latestCollectedAt: '2026-10-23T16:00:00.000Z',
  coverage: {
    expected: 120,
    complete: 110,
    partial: 6,
    failed: 2,
    running: 2,
    pending: 0,
    rows: [
      { queryId: 'q-own', date: '2026-10-20', status: 'complete', count: 40, durationMs: 500, error: null },
      { queryId: 'q-comp1', date: '2026-10-20', status: 'partial', count: 60, durationMs: 1200, error: '单日3页截断' },
    ],
  },
  summary: {
    notes: 480,
    creators: 320,
    impressions: { value: 1200000, known: 450, total: 480 },
    reads: { value: 340000, known: 420, total: 480 },
    interactions: { value: 89000, known: 460, total: 480 },
    commercialRate: { value: 0.35, known: 400, total: 480 },
    promotedRate: { value: 0.12, known: 350, total: 480 },
    noteChange: 45,
    changeReason: '较上周期新增 45 篇',
  },
  comparison: [
    {
      query: { id: 'q-own', kind: 'own', label: '本品 · 启萃', keyword: '启萃' },
      notes: 180,
      creators: 120,
      interactions: { value: 35000, known: 180, total: 180 },
      impressions: { value: 450000, known: 175, total: 180 },
      commercialRate: { value: 0.4, known: 160, total: 180 },
      promotedRate: { value: 0.15, known: 150, total: 180 },
      completeDays: 28,
      expectedDays: 30,
    },
    {
      query: { id: 'q-cat', kind: 'category', label: '品类 · 婴幼儿奶粉', keyword: '婴幼儿奶粉' },
      notes: 300,
      creators: 200,
      interactions: { value: 54000, known: 280, total: 300 },
      impressions: { value: 750000, known: 275, total: 300 },
      commercialRate: { value: 0.3, known: 240, total: 300 },
      promotedRate: { value: 0.1, known: 200, total: 300 },
      completeDays: 30,
      expectedDays: 30,
    },
  ],
  trend: [
    { date: '2026-10-21', notes: 25, commercial: 10, promoted: 4, interactions: 4500, complete: true },
    { date: '2026-10-22', notes: null, commercial: null, promoted: null, interactions: null, complete: false },
    { date: '2026-10-23', notes: 30, commercial: 12, promoted: 5, interactions: 6000, complete: true },
  ],
  content: {
    scenes: [{ label: '断奶转奶', count: 120, meanInteractions: 820, evidenceIds: ['n1'] }],
    sellingPoints: [{ label: '好吸收不上火', count: 140, meanInteractions: 750, evidenceIds: ['n1'] }],
    formats: [
      { label: '图文', count: 320, meanInteractions: 600, evidenceIds: ['n1'] },
      { label: '视频', count: 160, meanInteractions: 1100, evidenceIds: ['n2'] },
    ],
    titlePatterns: [{ label: '经验合集', count: 85, meanInteractions: 950, evidenceIds: ['n1'] }],
    topNotes: [
      {
        noteId: 'n1',
        title: '断奶期换口粮实操经验！宝宝肚肚舒服',
        url: 'https://www.xiaohongshu.com/discovery/item/n1',
        brand: '启萃',
        creatorName: '米宝妈妈',
        format: 'image',
        interactions: 3500,
        impressions: 45000,
        commercial: false,
        promoted: false,
        publishedDate: '2026-10-20',
      },
      {
        noteId: 'n2',
        title: '新手爸妈必备冲奶指南 沉浸式开罐体验',
        url: 'https://www.xiaohongshu.com/discovery/item/n2',
        brand: '启萃',
        creatorName: '豆包爸爸',
        format: 'video',
        interactions: 5200,
        impressions: 62000,
        commercial: true,
        promoted: true,
        publishedDate: '2026-10-21',
      },
      {
        noteId: 'n3',
        title: '未知形式测试样本笔记',
        url: 'https://www.xiaohongshu.com/discovery/item/n3',
        brand: '飞鹤',
        creatorName: '匿名创作者',
        format: 'unknown',
        interactions: 1200,
        impressions: 15000,
        commercial: false,
        promoted: false,
        publishedDate: '2026-10-22',
      },
    ],
  },
  notes: [],
  creators: { tiers: [], top: [], repeatCreators: 15, unknownCreators: 8 },
  traffic: { weekday: [], commercialVsNatural: [], promotedVsOrganic: [], readingRate: { value: 0.28, known: 420, total: 480 }, interactionRate: { value: 0.074, known: 420, total: 480 } },
  actions: [],
  limitations: [
    '本报告样本来自有限检索接口，仅代表有限样本，不构成全网总体普查。',
    '各查询词为独立采样，不可直接相加或折算为全网市场份额。',
    '单日单查询词受最多 3 页预算限制，发生截断已标记为 partial。',
    '抓取时刻的累计总互动，反映的是抓取时点的存量互动，而非发布当天的新增增量。',
    '未返回曝光量（impressions 为 null）的笔记不计入曝光总量与阅读率分母。',
    '商业化与投流标注基于接口外显字段与规则启发式推断，非平台后台确权结算账单。',
    '达人层级划分基于采样博主粉丝量快照，不反映历史动态跃迁。',
    '达人标称报价为公开发布的采买基准参考价，不代表实际采买折扣或合同履约价。',
    '自然与商业互动对比受算法分发与投流周期影响，不作为唯一因果判定依据。',
    '行动建议为规则引擎自动化识别结果，须结合品牌实际预算与投放节奏综合决策。',
  ],
};

// ============================================================
// [Followup Test 1] OverviewTab Section inline margin 与 macro-card 重复样式消除
// ============================================================
console.log('[Followup Test 1] OverviewTab inline margin 与 macro-card 重复样式消除');
const overviewHtml1 = renderToStaticMarkup(React.createElement(IndustryV2OverviewTab, { report: baseMockReport }));

// Verify section does NOT have inline marginBottom
assert.ok(
  !overviewHtml1.includes('style="margin-bottom:28px"') &&
  !overviewHtml1.includes('style="margin-bottom: 28px"') &&
  !overviewHtml1.includes('marginBottom'),
  'OverviewTab section 不得带有 inline marginBottom，避免与父容器 v2-tab-content gap:28px 叠加产生 56px 间隙'
);

// Verify macro-card does NOT have duplicate inline styles (background, border, padding, etc.)
assert.ok(
  !overviewHtml1.includes('style="background:#ffffff') &&
  !overviewHtml1.includes('style="background: #ffffff') &&
  !overviewHtml1.includes('style="background: rgb(255, 255, 255)'),
  'v2-macro-card 不应带有内联背景/边框/内边距等重复样式，应完全由 CSS 单点控制'
);

// Verify CSS rules exist in features/industry/industry.css
const cssSource = fs.readFileSync(path.resolve(rootDir, 'features/industry/industry.css'), 'utf8');
assert.ok(cssSource.includes('.v2-tab-content {\n  display: flex;\n  flex-direction: column;\n  gap: 28px;'), 'CSS 必须定义 .v2-tab-content 容器 flex 间距');
assert.ok(cssSource.includes('.v2-macro-card {'), 'CSS 必须集中单点定义 .v2-macro-card 样式');

// ============================================================
// [Followup Test 2] KPI 卡数值行水平对齐，badge移入metadata，统一缺值状态与可访问 disclosure
// ============================================================
console.log('[Followup Test 2] KPI 卡行布局统一、badge置于metadata、缺值统一状态与可访问 disclosure');

// 2a: KPI top row contains only label; badge is in metadata
assert.ok(!overviewHtml1.match(/<div class="v2-kpi-top">[^<]*<span class="v2-kpi-diff/i), 'KPI top 必须仅保留 label，不得在顶部放置 badge 避免挤压换行');
assert.ok(overviewHtml1.includes('v2-kpi-badge-row'), 'badge 必须位于底部 metadata 区域以保持 6 卡数值同高');

// 2b: When noteChange is present (+45)
assert.ok(overviewHtml1.includes('+45'), '正常环比应渲染 +45 标签');
assert.ok(overviewHtml1.includes('title="较上周期新增 45 篇"'), '完整 changeReason 必须作为 accessible title 保持可查');
assert.ok(overviewHtml1.includes('说明') && overviewHtml1.includes('较上周期新增 45 篇'), '完整原因通过可访问 details/small disclosure 可查询，非仅 hover 可见');
assert.ok(overviewHtml1.includes('统计周期内样本去重总数'), '子说明文本统一保持简短，不被长段说明破坏行高');

// 2c: When noteChange is null with < 14 days reason -> 统一 '环比暂不可用'
const reportShortCycle = {
  ...baseMockReport,
  summary: {
    ...baseMockReport.summary,
    noteChange: null,
    changeReason: '监测周期仅 10 天（不足 14 天），无法计算近7天对比前7天的环比变化',
  },
};
const overviewHtmlShortCycle = renderToStaticMarkup(React.createElement(IndustryV2OverviewTab, { report: reportShortCycle }));
assert.ok(overviewHtmlShortCycle.includes('环比暂不可用'), '缺值统一为「环比暂不可用」，不得凭.includes(不足)武断推定周期<14');
assert.ok(!overviewHtmlShortCycle.includes('周期<14天') && !overviewHtmlShortCycle.includes('周期&lt;14天'), '不得输出臆断的「周期<14天」');
assert.ok(overviewHtmlShortCycle.includes('原因') && overviewHtmlShortCycle.includes('监测周期仅 10 天（不足 14 天）'), '完整原因通过可访问 details disclosure 在 DOM 中直接可查');
assert.ok(overviewHtmlShortCycle.includes('统计周期内样本去重总数'), '即使 noteChange 为空，主子说明仍统一展示');

// 2d: When noteChange is null with explicit incomplete coverage reason -> 统一 '采样不完整'
const reportIncomplete = {
  ...baseMockReport,
  summary: {
    ...baseMockReport.summary,
    noteChange: null,
    changeReason: '近 14 天存在采样未完整覆盖的日期（部分关键词未采集或采集失败），按口径不计算环比变化',
  },
};
const overviewHtmlIncomplete = renderToStaticMarkup(React.createElement(IndustryV2OverviewTab, { report: reportIncomplete }));
assert.ok(overviewHtmlIncomplete.includes('采样不完整'), '有明确采样未完整 reason 时统一为「采样不完整」');
assert.ok(overviewHtmlIncomplete.includes('原因') && overviewHtmlIncomplete.includes('近 14 天存在采样未完整覆盖的日期'), '采样不完整完整原因通过 details disclosure 可查');

// 2e: Verify CSS ensures top-down alignment (justify-content: flex-start, top min-height: 24px, subtext margin-top: auto)
assert.ok(/v2-kpi-card\s*\{[\s\S]*?justify-content:\s*flex-start;/.test(cssSource), 'KPI 卡必须使用 flex-start 避免因 space-between 导致数值 Y 坐标随 subtext 长度错位');
assert.ok(/v2-kpi-top\s*\{[\s\S]*?min-height:\s*24px;/.test(cssSource), 'KPI top 必须固定 min-height: 24px 保证第二行数值起点绝对一致');
assert.ok(/v2-kpi-subtext\s*\{[\s\S]*?margin-top:\s*auto;/.test(cssSource), 'KPI subtext 必须使用 margin-top: auto 沉底，吸收底部高度差');
assert.ok(cssSource.includes('.v2-diff-muted'), 'CSS 必须包含 .v2-diff-muted 样式以支持空环比状态');

// ============================================================
// [Followup Test 3] ContentTab 去除重复技术小字、副标题精简、未知 format 真实展示
// ============================================================
console.log('[Followup Test 3] ContentTab 重复小字清除、副标题精简与真实 format 分型 (video/image/unknown)');
const contentHtml = renderToStaticMarkup(React.createElement(IndustryV2ContentTab, { report: baseMockReport }));

// 3a: Remove duplicate technical string engageNum
assert.ok(!contentHtml.includes('平台互动 (engageNum'), '不得展示重复技术字样「平台互动 (engageNum: ... )」');
assert.ok(!contentHtml.includes('engageNum:'), '不得泄漏底层数据库字段名 engageNum');

// 3b: Subtitle simplified
assert.ok(contentHtml.includes('点击标题在新标签页查看原文'), '副标题应精简为必要说明');
assert.ok(!contentHtml.includes('真实源数据样本列表。点击标题安全在新标签页打开小红书原文。'), '冗长副标题文案应已移除');

// 3c: Format fidelity: video, image, unknown
assert.ok(contentHtml.includes('🎬 视频'), 'video 形式笔记必须展示为 🎬 视频');
assert.ok(contentHtml.includes('🖼️ 图文'), 'image 形式笔记必须展示为 🖼️ 图文');
assert.ok(contentHtml.includes('未知'), 'unknown 形式笔记必须展示为 未知，不得默认归为图文');

// Verify with a note having undefined format
const reportUndefinedFormat = {
  ...baseMockReport,
  content: {
    ...baseMockReport.content,
    topNotes: [
      {
        noteId: 'n_undef',
        title: '缺少形式字段的笔记',
        url: 'https://www.xiaohongshu.com/discovery/item/n_undef',
        brand: '飞鹤',
        creatorName: '匿名',
        format: undefined,
        interactions: 100,
        impressions: 1000,
        commercial: false,
        promoted: false,
        publishedDate: '2026-10-23',
      },
    ],
  },
};
const htmlUndef = renderToStaticMarkup(React.createElement(IndustryV2ContentTab, { report: reportUndefinedFormat }));
assert.ok(htmlUndef.includes('未知'), '缺少 format 字段时不得臆测为图文，必须展示为 未知');

// ============================================================
// [Followup Test 4] query.label 分隔中点清除 (UI与title清除，保持源数据不变)
// ============================================================
console.log('[Followup Test 4] query.label UI展示与 title 清除分隔中点 (不改变原始数据)');

// 4a: Helper cleanQueryLabel
assert.equal(cleanQueryLabel('本品 · 启萃'), '本品 启萃', '应清除中点分隔符');
assert.equal(cleanQueryLabel('品类 · 婴幼儿奶粉'), '品类 婴幼儿奶粉', '应清除品类中点分隔符');
assert.equal(cleanQueryLabel('竞品 · 飞鹤星飞帆'), '竞品 飞鹤星飞帆', '应清除竞品中点分隔符');
assert.equal(cleanQueryLabel('· 飞鹤'), '飞鹤', '应清除前置中点');
assert.equal(cleanQueryLabel('星飞帆'), '星飞帆', '无中点正常返回');
assert.equal(cleanQueryLabel(''), '');

// 4b: QueryPillBadge cleans middle dot in inner text & title
const pillOwnHtml = renderToStaticMarkup(React.createElement(QueryPillBadge, { kind: 'own', label: '本品 · 启萃' }));
assert.ok(!pillOwnHtml.includes('·'), 'QueryPillBadge 内部标签不应带有中点');
assert.ok(pillOwnHtml.includes('启萃'), 'QueryPillBadge 应提取纯净词「启萃」');
assert.ok(!pillOwnHtml.includes('title="本品 · 启萃"'), 'QueryPillBadge title 不应带有中点');

const pillCatHtml = renderToStaticMarkup(React.createElement(QueryPillBadge, { kind: 'category', label: '品类 · 婴幼儿奶粉' }));
assert.ok(!pillCatHtml.includes('·'), 'QueryPillBadge 品类药丸不应包含中点');
assert.ok(pillCatHtml.includes('婴幼儿奶粉'), 'QueryPillBadge 品类应展示「婴幼儿奶粉」');

// 4c: OverviewTab table row title cleans delimiter dot
assert.ok(overviewHtml1.includes('title="点击筛选此查询词：本品 启萃"'), '表格行 hover title 必须清除分隔中点');
assert.ok(!overviewHtml1.includes('title="点击筛选此查询词：本品 · 启萃"'), '表格行 hover title 不得保留原始中点');

// 4d: Ensure raw data is NOT mutated
assert.equal(baseMockReport.comparison[0].query.label, '本品 · 启萃', '组件渲染绝不能就地修改传入的 report.comparison 原始数据');

// ============================================================
// [Followup Test 5] Overview 末尾免责声明改为默认折叠的'统计口径' disclosure，非原生样式
// ============================================================
console.log('[Followup Test 5] Overview 末尾免责声明改为默认折叠的「统计口径」disclosure');

// 5a: Default collapsed details element
assert.ok(overviewHtml1.includes('<details class="v2-limitations-box">'), '必须使用 details/summary 结构');
assert.ok(!overviewHtml1.includes('<details class="v2-limitations-box" open=""'), '统计口径 disclosure 必须默认折叠（无 open 属性）');
assert.ok(overviewHtml1.includes('统计口径 (10)'), 'summary 应精简为「统计口径」加条数');
assert.ok(!overviewHtml1.includes('展开查看'), 'summary 必须去除「展开查看...」冗余文案');

// 5b: Preserves all 10 raw limitation items without modification
for (const item of baseMockReport.limitations) {
  assert.ok(overviewHtml1.includes(item), `必须完整保留原始限制口径语义: ${item.slice(0, 15)}...`);
}

// 5c: Custom CSS styles for details/summary (no browser default triangle marker, no extra motion)
assert.ok(cssSource.includes('.v2-limitations-summary::-webkit-details-marker {\n  display: none;\n}'), '必须隐藏浏览器原生 details 黑色实心三角图标');
assert.ok(cssSource.includes('.v2-limitations-summary::after {\n  content: "▼";'), '必须使用设计一致的自定义 ▼ 旋转箭头');
assert.ok(cssSource.includes('.v2-limitations-box[open] .v2-limitations-summary::after {\n  transform: rotate(180deg);'), '展开时箭头旋转 180 度');
assert.ok(cssSource.includes('.v2-limitations-summary {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;'), 'summary 必须使用 flex 两端对齐布局');

// ============================================================
// [Followup Test 6] 严格校验 4 档字体规范 (12/14/16/22px) 与移除非必要 transition / hover 阴影
// ============================================================
console.log('[Followup Test 6] 严格校验 4 档字体规范 (12/14/16/22px) 与无多余 motion / hover 阴影');

// Extract the limitations & kpi disclosure block from cssSource
const limitationsCssMatch = cssSource.match(/\/\* Limitations \/ 统计口径[\s\S]*?(?=\/\* Pagination)/);
assert.ok(limitationsCssMatch, '应能提取 limitations CSS 块');
const limitationsCss = limitationsCssMatch[0];

// 6a: No transition: all or hover box-shadow in limitations
assert.ok(!limitationsCss.includes('transition: all'), '禁止在 disclosure 中使用 transition: all');
assert.ok(!limitationsCss.includes('box-shadow'), '禁止在 limitations hover/open 中添加多余 hover 阴影');
assert.ok(!limitationsCss.includes('transition: background-color'), '禁止添加不必要的背景过渡动画');

// 6b: Strict 4-step font sizes: 12, 14, 16, 22
const fontSizes = [...limitationsCss.matchAll(/font-size:\s*([^;]+);/g)].map(m => m[1].trim());
const allowedFontSizes = new Set(['12px', '14px', '16px', '22px']);
for (const fs of fontSizes) {
  assert.ok(allowedFontSizes.has(fs), `新增/修改 CSS 字体大小 "${fs}" 必须严格处于 4 档规范 (12/14/16/22px)`);
}
assert.ok(!limitationsCss.includes('10px') && !limitationsCss.includes('13px'), '严禁包含 10px 或 13px 等越界字体');

// ============================================================
// [Followup Test 7] DataMap 网关展示收尾与 CSS 变量对比度审计
// ============================================================
console.log('[Followup Test 7] DataMap 模型网关展示收尾与 CSS 变量对比度审计');

// 7a: DataMap UI polish
const dataMapSrc = fs.readFileSync(path.resolve(rootDir, 'features/settings/data-map/DataMap.tsx'), 'utf8');
assert.ok(!dataMapSrc.includes('AI GATEWAY'), '装饰英文眉题 AI GATEWAY 必须已删除');
assert.ok(dataMapSrc.includes('<h3 style={{ margin: 0 }}>模型网关</h3>'), 'h3 必须简化为「模型网关」');
assert.ok(!dataMapSrc.includes('Keystone 模型网关配置与状态'), '原冗长 h3 标题不得保留');
assert.ok(dataMapSrc.includes("statusText.replace(/\\s*·\\s*/g, ' / ')"), 'statusText 输出时必须将分隔中点替换为斜杠');
assert.ok(dataMapSrc.includes('>服务地址</span>'), 'Base URL 必须改为「服务地址」');
assert.ok(!dataMapSrc.includes('>Base URL</span>'), '不得显示英文 Base URL');
assert.ok(dataMapSrc.includes('>可用模型</span>'), '可用模型令牌池必须简化为「可用模型」');
assert.ok(!dataMapSrc.includes('>可用模型令牌池</span>'), '不得保留「可用模型令牌池」冗余字样');

// 7b: CSS Contrast & Variable audit
assert.ok(cssSource.includes('--v2-text-dim: #60646c;'), '--v2-text-dim 必须提升为 #60646c (slate-11) 以满足 12px 文本对比度规范');
assert.ok(!cssSource.includes('--v2-bg-dim'), '不得引用未定义的 --v2-bg-dim 变量');
assert.ok(cssSource.includes('.v2-diff-muted { background: var(--slate-3, #f0f0f3)'), '.v2-diff-muted 必须使用定义合法的变量及 fallback');

console.log('✅ 所有 7 项精细回归测试全部顺利通过！收尾修复项与契约完全满足。');
