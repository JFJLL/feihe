#!/usr/bin/env node

/**
 * test-metric-categories.mjs
 *
 * Verifies:
 * 1. MetricStripItem.category ('brand' | 'cid' | 'commerce' | 'creators') rendering:
 *    - article data-category={it.category}
 *    - badge className="ca-metric-badge"
 *    - badge style uses var(--metric-category-badge-bg) & var(--metric-category-ink)
 *    - sparkline and progressbar use var(--metric-category-ink) without falling back to amber gold (<100%)
 * 2. Backward compatibility:
 *    - Uncategorized items do not emit data-category
 *    - danger status emits terracotta palette
 *    - warning status emits gold palette
 *    - accent/success emits primary palette
 *    - Missing (null/undefined) vs zero (0) semantics preserved
 *    - Progress bar width calculation unchanged
 * 3. HuangTianeBoard integration:
 *    - Overview top 8 metrics: 1-2 brand, 3-4 cid, 5-6 commerce, 7-8 creators
 *    - Arbitrary warning/success/accent statuses removed (commerce spend not marked warning)
 *    - Ads section 4 metrics assigned category matching scope
 *    - Content section 4 metrics assigned creators category
 *    - Header cleanups (removed duplicated subtitles and fixed "/ 点击折叠")
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

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
  const customRequire = name => {
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

console.log('=== 1. MetricStrip SSR 单元测试：分类样式与 CSS 变量契约 ===');
const charts = loadComponent(path.join(REPO_ROOT, 'features/campaign/CampaignCharts.tsx'));
const { MetricStrip, CAMPAIGN_PALETTE } = charts;

// 1.1 分类属性与 CSS 变量绑定
{
  const categories = ['brand', 'cid', 'commerce', 'creators'];
  for (const cat of categories) {
    const html = renderToStaticMarkup(React.createElement(MetricStrip, {
      items: [
        {
          label: `${cat} 指标`,
          value: 12345,
          badge: `${cat} 标签`,
          category: cat,
          sparkline: [10, 20, 15, 30],
          note: '进度 64.2%',
        },
      ],
    }));

    assert.ok(html.includes(`data-category="${cat}"`), `article 必须包含 data-category="${cat}"`);
    assert.ok(html.includes('ca-metric-badge'), 'badge 元素必须包含 ca-metric-badge 类名');
    assert.ok(
      html.includes('var(--metric-category-badge-bg)'),
      '带 category 时 badge background 必须绑定 var(--metric-category-badge-bg)'
    );
    assert.ok(
      html.includes('var(--metric-category-ink)'),
      '带 category 时 badge color 必须绑定 var(--metric-category-ink)'
    );
    assert.ok(
      html.includes('stroke="var(--metric-category-ink)"'),
      '带 category 时 sparkline stroke 必须使用 var(--metric-category-ink)'
    );
    assert.ok(
      html.includes('background:var(--metric-category-ink)'),
      '带 category 时 progressbar background 必须使用 var(--metric-category-ink)'
    );
    // 确认即使 progress < 100% 也没有被错误 fallback 到 gold / amber 警告色
    assert.ok(
      !html.includes(CAMPAIGN_PALETTE.gold),
      '带 category 的进度条即使 <100% 也严禁使用 gold/amber 警告色'
    );
  }
  console.log('  -> brand / cid / commerce / creators 4类 category 与 CSS 变量契约通过');
}

// 1.2 多分类 Sparkline SSR 渐变 ID 唯一性与引用匹配验证
{
  const multiCategoryHtml = renderToStaticMarkup(React.createElement(MetricStrip, {
    items: [
      { label: '品牌消耗趋势', value: 100, category: 'brand', sparkline: [10, 20, 15, 35] },
      { label: 'CID引流趋势', value: 200, category: 'cid', sparkline: [5, 12, 18, 25] },
      { label: '商销成交趋势', value: 300, category: 'commerce', sparkline: [8, 14, 22, 30] },
      { label: '达人发布趋势', value: 400, category: 'creators', sparkline: [2, 6, 12, 18] },
    ],
  }));

  const gradIdMatches = [...multiCategoryHtml.matchAll(/<linearGradient id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(gradIdMatches.length, 4, '4个带 sparkline 的卡片必须各自生成 1 个 linearGradient');

  // 验证所有 ID 唯一，杜绝 CID/commerce 复用首个 brand 渐变
  const uniqueIds = new Set(gradIdMatches);
  assert.equal(uniqueIds.size, 4, '4个分类卡片的 gradient ID 必须全部唯一，不可重复');

  // 验证每个 gradient ID 都有匹配的 url(#id) 引用
  for (const id of gradIdMatches) {
    assert.ok(
      multiCategoryHtml.includes(`fill="url(#${id})"`),
      `渐变 ID ${id} 必须在当前卡片的 path fill 中被精确引用`
    );
  }
  console.log('  -> 多分类 sparkline SSR gradient ID 唯一性与 url(#id) 引用匹配测试通过');
}

console.log('=== 2. MetricStrip 兼容性测试：无 category 场景与 danger/warning 保留 ===');
{
  // 2.1 无 category 且带 danger status: 必须使用 terracotta
  const dangerHtml = renderToStaticMarkup(React.createElement(MetricStrip, {
    items: [
      {
        label: '超支异常指标',
        value: '135%',
        badge: '超支预警',
        status: 'danger',
        note: '执行进度 135%',
      },
    ],
  }));
  assert.ok(!dangerHtml.includes('data-category='), '无 category 时 article 不得输出 data-category');
  assert.ok(dangerHtml.includes('ca-metric-badge'), '无 category 时 badge 仍应包含 ca-metric-badge 类名');
  assert.ok(dangerHtml.includes(CAMPAIGN_PALETTE.terracotta), 'status="danger" 必须保持 terracotta 警示色');

  // 2.1b 无 category 的 sparkline 必须永远使用 primary 色 (#12a594)，不得受 danger 污染
  const uncategorizedSparklineHtml = renderToStaticMarkup(React.createElement(MetricStrip, {
    items: [
      {
        label: '无分类预警带曲线',
        value: 100,
        status: 'danger',
        sparkline: [10, 20, 15, 30],
      },
      {
        label: '无分类警告带曲线',
        value: 200,
        status: 'warning',
        sparkline: [10, 20, 15, 30],
      },
    ],
  }));
  const strokes = [...uncategorizedSparklineHtml.matchAll(/stroke="([^"]+)"/g)].map(m => m[1]);
  assert.ok(strokes.length >= 2, '必须渲染 sparkline stroke');
  for (const s of strokes) {
    assert.equal(s, CAMPAIGN_PALETTE.primary, '无 category 的 sparkline stroke 必须保持 primary 颜色，不受 status 影响');
  }

  // 2.2 无 category 且带 warning status: 必须使用 gold
  const warningHtml = renderToStaticMarkup(React.createElement(MetricStrip, {
    items: [
      {
        label: '偏低预警指标',
        value: '45%',
        badge: '进度落后',
        status: 'warning',
        note: '执行进度 45%',
      },
    ],
  }));
  assert.ok(warningHtml.includes(CAMPAIGN_PALETTE.gold), 'status="warning" 必须保持 gold 警告色');

  // 2.3 无 category 且无 status: progress < 100% 使用旧 fallback (gold)
  const fallbackHtml = renderToStaticMarkup(React.createElement(MetricStrip, {
    items: [
      {
        label: '普通进度指标',
        value: '50%',
        badge: '进行中',
      },
    ],
  }));
  assert.ok(fallbackHtml.includes(CAMPAIGN_PALETTE.gold), '无 category 且无 status 的未达标进度保持原 gold 逻辑');

  // 2.4 无 category 且无 status: progress >= 100% 使用旧 primary
  const completedHtml = renderToStaticMarkup(React.createElement(MetricStrip, {
    items: [
      {
        label: '已完成进度',
        value: '100%',
        badge: '已达标',
      },
    ],
  }));
  assert.ok(completedHtml.includes(CAMPAIGN_PALETTE.primary), '无 category 且已完成进度使用 primary');
  console.log('  -> 无 category 场景及 danger / warning / fallback 兼容性通过');
}

console.log('=== 3. 数值与进度计算不变性验证 (金额/percent/progress/zero/null 语义) ===');
{
  const testHtml = renderToStaticMarkup(React.createElement(MetricStrip, {
    items: [
      { label: '数字带千分位', value: 1250000, category: 'brand' },
      { label: '金额字符串', value: '¥28,023.72', category: 'commerce' },
      { label: '真实0值', value: 0, unit: '元', category: 'cid' },
      { label: '缺失空值', value: null, category: 'creators' },
      { label: '进度条80%', value: 80, unit: '%', category: 'brand' },
    ],
  }));

  assert.ok(testHtml.includes('1,250,000'), '千分位数值格式化不变');
  assert.ok(testHtml.includes('¥28,023.72'), '金额字符串不变');
  assert.ok(testHtml.includes('>0<') && testHtml.includes('>元<'), '真实0值保留且不被当作缺失');
  assert.ok(testHtml.includes('>—<'), '缺失 null 值正确展示破折号 —');
  assert.ok(!testHtml.includes('>null<'), '不得出现 >null< 展示值');
  assert.ok(testHtml.includes('width:80%') || testHtml.includes('width: 80%'), '80% 进度计算宽度完全一致');
  console.log('  -> 金额 / percent / progress / zero / null 语义验证通过');
}

console.log('=== 4. HuangTianeBoard 真实组件 SSR 检验 ===');
const huangMod = loadComponent(path.join(REPO_ROOT, 'features/campaign/HuangTianeBoard.tsx'));
const { HuangTianeBoard } = huangMod;

const mockDashboard = {
  projectId: 'huang-tiane',
  name: '黄天鹅战役复盘',
  reportPeriod: '2026-10-01 ~ 2026-10-19',
  updatedAt: new Date().toISOString(),
  sources: [],
  tables: [
    {
      id: 'huang-brand-kol-tiers',
      name: 'brandKolTiers',
      rows: [
        { tier: '头部KOL', spend: '50000', clicks: '12000', impressions: '150000', cpc: '0.40', cpm: '33.3' },
        { tier: '腰部KOL', spend: '30000', clicks: '8000', impressions: '100000', cpc: '0.38', cpm: '30.0' },
      ],
    },
    {
      id: 'huang-brand-ad-types',
      name: 'brandAdTypes',
      rows: [
        { adType: '信息流', spend: '70000', impressions: '200000', clicks: '15000', ctr: '7.5', cpc: '0.45', cpm: '35', cpe: '1.2' },
        { adType: '搜索', spend: '30000', impressions: '80000', clicks: '6000', ctr: '7.5', cpc: '0.50', cpm: '37.5', cpe: '1.5' },
      ],
    },
    {
      id: 'huang-brand-provinces',
      name: 'brandRegions',
      rows: [
        { province: '北京', spend: '50000', engagements: '3000', cpe: '16.6', ctr: '4.2' },
      ],
    },
  ],
  kpis: [],
  actions: { title: '战役重点', items: [] },
  warnings: [],
  dailyDatasets: [
    {
      id: 'huang-cid-standard-daily',
      name: 'cidStandardDaily',
      rows: [{ spend: '120000', gmv: '240000', orders: '3000', uv: '18000' }],
    },
    {
      id: 'huang-cid-simple-daily',
      name: 'cidSimpleDaily',
      rows: [{ spend: '80000', gmv: '120000', orders: '1500', uv: '10000' }],
    },
  ],
};

// 4.1 Overview 8大指标分类与顺序断言
{
  const overviewHtml = renderToStaticMarkup(React.createElement(HuangTianeBoard, {
    dashboard: mockDashboard,
    section: 'overview',
  }));

  // 提取 top-kpi 区域内 article 的 data-category 顺序
  const kpiSectionMatch = overviewHtml.match(/<section id="ht-sec-top-kpi"[\s\S]*?<\/section>/);
  assert.ok(kpiSectionMatch, '必须找到 ht-sec-top-kpi 区域');
  const kpiSectionHtml = kpiSectionMatch[0];

  const categoryMatches = [...kpiSectionHtml.matchAll(/data-category="([^"]+)"/g)].map(m => m[1]);
  assert.equal(categoryMatches.length, 8, 'Overview topMetricItems 必须精确渲染 8 项指标');
  assert.deepEqual(
    categoryMatches,
    ['brand', 'brand', 'cid', 'cid', 'commerce', 'commerce', 'creators', 'creators'],
    '8项指标分类必须依次为：前2 brand，3-4 cid，5-6 commerce，7-8 creators'
  );

  // 商销支出（第5项）不得包含 warning 警告色
  const commerceSpendItemMatch = kpiSectionHtml.match(/<article[^>]*data-category="commerce"[^>]*>[\s\S]*?闭环商销累计消耗[\s\S]*?<\/article>/);
  assert.ok(commerceSpendItemMatch, '必须找到闭环商销累计消耗卡片');
  assert.ok(
    !commerceSpendItemMatch[0].includes(CAMPAIGN_PALETTE.gold),
    '闭环商销累计消耗不得无依据标 warning / gold 警告色'
  );
  console.log('  -> Overview 8大指标前2brand、3-4cid、5-6commerce、7-8creators 及无虚假warning验证通过');
}

// 4.2 Ads 4大指标分类按渠道同类断言
{
  const adsBrandHtml = renderToStaticMarkup(React.createElement(HuangTianeBoard, {
    dashboard: mockDashboard,
    section: 'ads',
  }));
  const brandAdsCategories = [...adsBrandHtml.matchAll(/<article[^>]*data-category="([^"]+)"/g)].map(m => m[1]).slice(0, 4);
  assert.equal(brandAdsCategories.length, 4, 'Ads 模块头部应有 4 个指标');
  assert.deepEqual(brandAdsCategories, ['brand', 'brand', 'brand', 'brand'], 'Brand ads 4大指标必须全为 brand 分类');
  console.log('  -> Ads 渠道指标同类分类通过');
}

// 4.3 Content 4大指标分类为 creators 断言
{
  const contentHtml = renderToStaticMarkup(React.createElement(HuangTianeBoard, {
    dashboard: mockDashboard,
    section: 'content',
  }));
  const contentCategories = [...contentHtml.matchAll(/<article[^>]*data-category="([^"]+)"/g)].map(m => m[1]).slice(0, 4);
  assert.equal(contentCategories.length, 4, 'Content 模块头部应有 4 个指标');
  assert.deepEqual(contentCategories, ['creators', 'creators', 'creators', 'creators'], 'Content 4大指标必须全为 creators 分类');
  console.log('  -> Content 4大指标 creators 分类通过');
}

console.log('=== 5. Header 文案清理与真实统计边界保留断言 ===');
{
  const overviewHtml = renderToStaticMarkup(React.createElement(HuangTianeBoard, {
    dashboard: mockDashboard,
    section: 'overview',
  }));

  // 5.1 删除了第 755 行重复的副标 span
  assert.ok(
    !overviewHtml.includes('8项核心全域KPI与蛋品大盘对照'),
    'Overview 第一层副标“8项核心全域KPI与蛋品大盘对照”已成功删除'
  );

  // 5.2 删除了第 1036 行重复的副标 span
  assert.ok(
    !overviewHtml.includes('性别×年龄二维消耗交叉矩阵 / 达人选号与KOS矩阵全貌'),
    '受众人口学副标“性别×年龄二维消耗交叉矩阵 / 达人选号与KOS矩阵全貌”已成功删除'
  );

  // 5.3 两个 details header 移除了“/ 点击折叠”固定文案，但保留了条目数量
  assert.ok(
    !overviewHtml.includes('/ 点击折叠'),
    '所有 details summary 头部已移除固定“/ 点击折叠”文案'
  );
  assert.ok(
    overviewHtml.includes('12大笔记标签、10大搜索词类与商销Top素材'),
    '第4章 summary 保留了条目数量说明'
  );
  assert.ok(
    overviewHtml.includes('31位达人选号漏斗与65篇KOS发布底表'),
    '第5章附 summary 保留了条目数量说明'
  );

  // 5.4 真实统计边界与三线独立核算文案依然保留
  assert.ok(overviewHtml.includes('以KOS执行表登记为准，不推定已投流或已成交'), '保留KOS统计边界说明');
  assert.ok(overviewHtml.includes('全域三线经营总览与蛋品行业基准对标'), '保留主章节标题');
  console.log('  -> Header 4处文案清理与真实统计边界保留验证全部通过');
}

console.log('\n[PASS] 所有指标分类显示、兼容性与文案清理断言全部通过！');
