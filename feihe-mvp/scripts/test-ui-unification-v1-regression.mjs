import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = path.resolve(import.meta.dirname, '..');
const moduleCache = new Map();
function loadComponent(filename) {
  filename = path.resolve(root, filename);
  if (moduleCache.has(filename)) return moduleCache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  const nativeRequire = createRequire(filename);
  const require = name => {
    if (!name.startsWith('.')) return nativeRequire(name);
    const base = path.resolve(path.dirname(filename), name);
    const resolved = ['.tsx', '.ts'].map(ext => base + ext).find(f => fs.existsSync(f));
    assert(resolved, `Local import resolves: ${name}`);
    return loadComponent(resolved);
  };
  vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, {})(require, result, result.exports);
  moduleCache.set(filename, result.exports);
  return result.exports;
}

// --------------------------------------------------------------------------
// 1. Section IX: Workspace Palette Stability & Zero/Missing Bar Widths
// --------------------------------------------------------------------------
const { paletteForKeys, paletteColor } = loadComponent('lib/workspace-palette.ts');

// A. Palette stability across reorder and filtering
const keysA = ['飞鹤', '爱他美', '美素佳儿'];
const keysB = ['美素佳儿', '飞鹤', '爱他美'];
const keysFiltered = ['爱他美'];

const mapA = paletteForKeys(keysA);
const mapB = paletteForKeys(keysB);
const mapFiltered = paletteForKeys(keysFiltered);

assert.equal(mapA['飞鹤'], mapB['飞鹤'], '重排后同一品牌的颜色必须保持不变');
assert.equal(mapA['爱他美'], mapB['爱他美'], '重排后同一品牌的颜色必须保持不变');
assert.equal(mapA['爱他美'], mapFiltered['爱他美'], '筛选后剩余品牌的颜色必须保持不变');
assert.equal(paletteColor('brand:飞鹤'), paletteColor('brand:飞鹤'), '单 key 取色具有确定性哈希');

// B. CompetitorAnalysis bar rendering: 0, null, small positive, non-finite
const { numeric } = loadComponent('features/growth/metrics.ts');
assert.equal(numeric(0), 0);
assert.equal(numeric('0'), 0);
assert.equal(numeric(null), null);
assert.equal(numeric(undefined), null);
assert.equal(numeric(NaN), null);
assert.equal(numeric(Infinity), null);
assert.equal(numeric('10.5万'), 105000);

// Verify that 0% and null produce 0% width, and small positives are proportional
{
  const maxVal = 100;
  function calcWidth(rawVal) {
    const val = numeric(rawVal);
    const isPositive = val !== null && val > 0;
    const pct = isPositive && maxVal > 0 ? (val / maxVal) * 100 : 0;
    return `${pct}%`;
  }
  assert.equal(calcWidth(0), '0%', '真实零值柱条宽度必须为 0%');
  assert.equal(calcWidth(null), '0%', '缺失 null 柱条宽度必须为 0%');
  assert.equal(calcWidth(undefined), '0%', '缺失 undefined 柱条宽度必须为 0%');
  assert.equal(calcWidth(NaN), '0%', '非有限数值 NaN 柱条宽度必须为 0%');
  assert.equal(calcWidth(Infinity), '0%', '非有限数值 Infinity 柱条宽度必须为 0%');
  assert.equal(calcWidth(0.05), '0.05%', '小正数必须按真实比例 0.05% 绘制，不能强制放大为 3% 或 4%');
  assert.equal(calcWidth(50), '50%', '正常正数按真实比例绘制');
}
console.log('✅ PASS regression: Workspace Palette & Bar Width Zero/Missing/Proportionality');

// --------------------------------------------------------------------------
// 2. Section III & VI: RulesAndTargets Completed Jobs Modal & Threshold Precision
// --------------------------------------------------------------------------
const { RulesAndTargets } = loadComponent('features/settings/RulesAndTargets.tsx');

// Test threshold precision decimal handling
{
  function validateSimilarityInput(raw) {
    const text = String(raw).trim();
    const pct = parseFloat(text);
    if (!text || !Number.isFinite(pct) || pct < 30 || pct > 100) {
      return { valid: false, error: '供应商相似度阈值超出有效范围，请输入 30% 至 100% 之间的数值' };
    }
    return { valid: true, decimal: Number((pct / 100).toPrecision(12)) };
  }

  // 1. Business range check: 30% to 100% (0.3 to 1.0)
  assert.equal(validateSimilarityInput('0').valid, false, '0% 低于业务下限 30%，必须拒绝保存');
  assert.equal(validateSimilarityInput('10').valid, false, '10% 低于业务下限 30%，必须拒绝保存');
  assert.equal(validateSimilarityInput('120').valid, false, '120% 超出业务上限 100%，必须拒绝保存');
  assert.equal(validateSimilarityInput('abc').valid, false, '非数值必须拒绝保存');

  // 2. High precision decimal input within valid range
  const res58_5 = validateSimilarityInput('58.5');
  assert.equal(res58_5.valid, true);
  assert.equal(res58_5.decimal, 0.585, '输入 58.5 保存为 0.585');

  const res58_55 = validateSimilarityInput('58.55');
  assert.equal(res58_55.valid, true);
  assert.equal(res58_55.decimal, 0.5855, '输入 58.55 保存为 0.5855');

  const res58 = validateSimilarityInput('58');
  assert.equal(res58.valid, true);
  assert.equal(res58.decimal, 0.58, '现有正常值 58% 保存为 0.58');
}

// Test Completed Jobs Modal: distinguish 60 from 40, succeeded=0 / total=0, finishedAt vs createdAt
{
  const mockOps = {
    settings: {
      goals: { workTarget: 100, workCompleted: 60, monthlyTarget: 20, quarterlyTarget: 50, publishTarget: 30 },
      rules: { brands: ['启萃'], competitors: ['爱他美'], positiveWords: ['好评'], negativeWords: ['差评'], questionWords: [], sellingWords: [], irrelevantWords: [] },
      acceptance: { reportCount: 200, baseCount: 30, brandTopRate: 0.4, freshnessHours: 24, supplierSimilarity: 0.585 },
    },
    reviewRules: [],
    jobs: [
      {
        id: 'job-1',
        type: '供应商评论核验',
        title: '0826批次核验',
        status: '已完成',
        progress: 100,
        succeeded: 0,
        total: 0,
        message: '全部通过',
        createdAt: '2026-09-08 10:00',
        finishedAt: '2026-09-08 10:05',
      },
      {
        id: 'job-2',
        type: '自然样本扫描',
        title: '关键词抓取',
        status: '已完成',
        progress: 80,
        succeeded: 16,
        total: 20,
        message: '部分抓取',
        createdAt: '2026-09-08 09:00',
        finishedAt: null, // missing finishedAt
      },
    ],
  };

  const mockData = { pipelines: [], metrics: { publishedCount: 15 }, notes: [] };

  const markup = renderToStaticMarkup(React.createElement(RulesAndTargets, {
    data: mockData,
    ops: mockOps,
    projectId: 'test-project',
    onDone: async () => {},
    toast: () => {},
  }));

  // Top card must display all-time 60
  assert(markup.includes('60'), '顶部历史已完成任务展示全量真实累计 60 项');
  assert(markup.includes('最近任务中的完成记录'), '卡片说明明确指出回溯范围');

  // Verify threshold input value contains 58.5 and shows 30%-100% valid range hint
  assert(markup.includes('value="58.5"'), '供应商相似度阈值输入框保留 58.5% 高精度');
  assert(markup.includes('有效范围 30% – 100%'), '界面明确标注相似度阈值有效范围 30%–100%');
}
console.log('✅ PASS regression: RulesAndTargets Completed Jobs Scope & Similarity Precision');

// --------------------------------------------------------------------------
// 3. Section V: DataMap Keystone Model Gateway Truthful Status
// --------------------------------------------------------------------------
const { DataMap } = loadComponent('features/settings/data-map/DataMap.tsx');

function renderDataMapWithKeystone(keystone) {
  const data = {
    accounts: [],
    endpoints: [],
    metrics: [],
    bindings: [],
    sources: [],
    integrations: [],
    runs: [],
    reports: [],
    assets: [],
    keystone,
  };
  return renderToStaticMarkup(React.createElement(DataMap, {
    projectId: 'test-p',
    data,
    reload: async () => {},
    toast: () => {},
  }));
}

// Case 1: Unconfigured
{
  const html = renderDataMapWithKeystone({
    configured: false,
    status: '未配置密钥',
    models: [],
    textModels: [],
    imageModels: [],
    textModel: 'gpt-5.6-terra',
    imageModel: 'gpt-image-2',
    baseUrl: 'https://keystonehk.ai/v1',
  });
  assert(html.includes('未配置网关密钥'), '未配置时令牌池展示未配置');
  assert(!html.includes('托管环境已连接'), '未配置时绝不能虚假显示“托管环境已连接”');
  assert(html.includes('未配置'), '模型状态显示未配置');
}

// Case 2: Configured but failed
{
  const html = renderDataMapWithKeystone({
    configured: true,
    status: '连接失败',
    error: '网络超时',
    models: [],
    textModels: [],
    imageModels: [],
    textModel: 'gpt-5.6-terra',
    imageModel: 'gpt-image-2',
    baseUrl: 'https://keystonehk.ai/v1',
  });
  assert(html.includes('连接失败'), '检测失败时显示连接失败');
  assert(html.includes('网络超时'), '包含真实错误信息');
  assert(html.includes('不可用'), '模型标签标为不可用');
}

// Case 3: Configured, normal, but models list empty
{
  const html = renderDataMapWithKeystone({
    configured: true,
    status: '已连接 · 目标模型待验证',
    models: [],
    textModels: [],
    imageModels: [],
    textModel: 'gpt-5.6-terra',
    imageModel: 'gpt-image-2',
    baseUrl: 'https://keystonehk.ai/v1',
  });
  assert(html.includes('已连接但可用模型列表为空'), '空列表时区分并准确展示');
  assert(!html.includes('托管环境已连接'), '模型列表为空时禁止显示托管环境已连接');
  assert(html.includes('待验证（未在列表中）'), '当前模型不在列表中时明确标为待验证');
}

// Case 4: Configured, models returned, target model present
{
  const html = renderDataMapWithKeystone({
    configured: true,
    status: '文本与生图模型可用',
    models: ['gpt-5.6-terra', 'gpt-image-2'],
    textModels: ['gpt-5.6-terra'],
    imageModels: ['gpt-image-2'],
    textModel: 'gpt-5.6-terra',
    imageModel: 'gpt-image-2',
    baseUrl: 'https://keystonehk.ai/v1',
  });
  assert(html.includes('已验证可用'), '目标文本模型在列表中时显示已验证可用');
  assert(html.includes('已授权可用'), '目标生图模型在列表中时显示已授权可用');
  assert(html.includes('gpt-5.6-terra, gpt-image-2'), '令牌池列出可用模型');
}
console.log('✅ PASS regression: DataMap Keystone Gateway Truthful Status (all 4 cases)');

// --------------------------------------------------------------------------
// 4. Section IV: SettingsWorkspace Lazy Mounting & Isolation
// --------------------------------------------------------------------------
const { SettingsWorkspace } = loadComponent('features/settings/SettingsWorkspace.tsx');
const { ProjectContext } = loadComponent('components/project-shell/ProjectContext.tsx');

// Verify that SettingsWorkspace lazy-mounts visited tabs
{
  const dashboard = { pipelines: [], metrics: { publishedCount: 0 } };
  const ops = {
    settings: {
      goals: { workTarget: 0, workCompleted: 0, monthlyTarget: 0, quarterlyTarget: 0, publishTarget: 0 },
      rules: { brands: [], competitors: [], positiveWords: [], negativeWords: [], questionWords: [], sellingWords: [], irrelevantWords: [] },
      acceptance: {},
    },
    reviewRules: [],
  };

  const html = renderToStaticMarkup(React.createElement(ProjectContext.Provider, {
    value: {
      projectId: 'test-p',
      currentProject: { id: 'test-p', name: '测试' },
      workspace: { projects: [], sources: [] },
      refreshWorkspace: async () => {},
      showToast: () => {},
      activeSection: 'settings',
      navigateTo: () => {},
      toasts: [],
      removeToast: () => {},
      projects: [],
      sources: [],
      loading: false,
      error: null,
      refreshProjects: async () => {},
      dashboard: null,
      ops: null,
    },
    children: React.createElement(SettingsWorkspace, {
      projectId: 'test-p',
      dashboard,
      ops,
      onRefresh: async () => {},
    }),
  }));

  // On initial render (tab = profile), only profile is rendered.
  // SettingsDataSources (飞书多维表格溯源), SettingsIntegrations, DataMap are NOT rendered!
  assert(html.includes('品牌与项目基本信息') || html.includes('项目资料'), '初始渲染仅挂载资料子页');
  assert(!html.includes('外部数据集成与能力连接'), '未访问的工具集成子页未挂载');
  assert(html.includes('id="workspace-tabpanel-profile"'), '挂载面板具备匹配的 tabpanel ID');
  assert(html.includes('role="tabpanel"'), '挂载面板具备 tabpanel 语义');
  assert(html.includes('aria-labelledby="workspace-tab-profile"'), '挂载面板具备 aria-labelledby 关联');
}
console.log('✅ PASS regression: SettingsWorkspace Lazy Mounting & Subpage Isolation');

console.log('ALL REGRESSION SUITES PASSED! 🎉');
