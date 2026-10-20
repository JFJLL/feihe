'use client';

import React, { useMemo, useState } from 'react';
import type { CampaignDashboard } from '../../lib/campaign-types';
import {
  ChartPanel,
  MetricStrip,
  BudgetComparisonChart,
  CampaignFunnelChart,
  MatrixHeatmapChart,
  HorizontalBarChart,
  DonutChart,
  CAMPAIGN_PALETTE,
  type ChartDatum,
  type ComparisonDatum,
  type MetricStripItem,
  type FunnelStageDatum,
  type MatrixHeatmapCell,
} from './CampaignCharts';
import { CampaignComboChart, type ComboSeries } from './CampaignComboChart';
import {
  extractHuangTianeData,
  formatNum,
  formatCurrency,
  formatPercent,
  parseNum,
} from './huang-model';
import './huang-tiane.css';

export interface HuangTianeBoardProps {
  dashboard: CampaignDashboard;
  section?: 'overview' | 'ads' | 'content';
}

export function HuangTianeBoard({ dashboard, section = 'overview' }: HuangTianeBoardProps) {
  const model = useMemo(() => extractHuangTianeData(dashboard), [dashboard]);
  const [adsScope, setAdsScope] = useState<'brand' | 'cid' | 'commerce'>('brand');
  const [creatorTableOpen, setCreatorTableOpen] = useState<boolean>(false);
  const [kosTableOpen, setKosTableOpen] = useState<boolean>(false);
  const [showAllAudiences, setShowAllAudiences] = useState<boolean>(false);
  const [showAllProvinces, setShowAllProvinces] = useState<boolean>(false);
  const [showAllCreatives, setShowAllCreatives] = useState<boolean>(false);
  const [selectedBenchmarkMetric, setSelectedBenchmarkMetric] = useState<'CTR' | 'CPC' | 'CPM' | 'CPE' | 'CPI' | 'CPTI'>('CTR');

  const topMetricItems: MetricStripItem[] = useMemo(() => {
    return [
      {
        label: '品牌FS消耗 / 预算进度',
        value: model.brandSpend !== null ? formatCurrency(model.brandSpend) : '—',
        hint: `预算 ${formatCurrency(model.brandBudgetVal)} · 进度 ${formatPercent(model.brandBudgetProgress, 1)}`,
        status: 'accent',
      },
      {
        label: '种草I/TI人群 · CPTI',
        value: `${formatNum(parseNum(model.brandSummary?.seed_total), 0)} 人`,
        hint: `TI心智 ${formatNum(parseNum(model.brandSummary?.seed_ti), 0)} 人 · CPTI ${formatCurrency(parseNum(model.brandSummary?.cpti))}`,
        status: 'success',
      },
      {
        label: '红猫CID全域消耗',
        value: model.cidTotalSpend !== null ? formatCurrency(model.cidTotalSpend) : '—',
        hint: `标准投 ${formatCurrency(model.cidStandardSpend)} · 简单投 ${formatCurrency(model.cidSimpleSpend)}`,
        status: 'neutral',
      },
      {
        label: '红猫CID成交GMV · ROI',
        value: model.cidTotalGmv !== null ? formatCurrency(model.cidTotalGmv) : '—',
        hint: `全域ROI ${model.cidOverallRoi !== null ? model.cidOverallRoi.toFixed(2) : '—'}倍 (标准3.27 / 简单3.97)`,
        status: 'accent',
      },
      {
        label: '闭环商销累计消耗',
        value: model.commerceSpend !== null ? formatCurrency(model.commerceSpend) : '—',
        hint: `全渠道销售日均约 ¥1,486`,
        status: 'neutral',
      },
      {
        label: '商销成交GMV · 订单',
        value: model.commerceGmv !== null ? formatCurrency(model.commerceGmv) : '—',
        hint: `订单 ${formatNum(model.commerceOrders, 0)} 单 · 加购 ${formatNum(model.commerceCart, 0)} 次`,
        status: 'accent',
      },
      {
        label: '达人选号定档 / 发布率',
        value: `${model.creatorsPublished} / ${model.creatorsCount} 位`,
        hint: `已发布 ${formatPercent(model.creatorsPublishRate, 1)} · 素材收集 ${model.creatorsAssetCollected} 篇`,
        status: 'success',
      },
      {
        label: 'KOS笔记矩阵发布量',
        value: `${model.kosCount} 篇`,
        hint: '10/19 集中引爆 · FS/CID/商销多线联动',
        status: 'neutral',
      },
    ];
  }, [model]);

  if (section === 'overview') {
    const budgetData: ComparisonDatum[] = model.brandBudgetVal !== null && model.brandSpend !== null
      ? [
          {
            label: '品牌FS预算与实绩',
            target: model.brandBudgetVal,
            actual: model.brandSpend,
            unit: '元',
          },
        ]
      : [];

    // Benchmark computation
    const benchmarkMetric = selectedBenchmarkMetric;
    const bRows = model.industryBenchmarksTable.rows;
    const shengshiItem = bRows.find((r) => r.category === '生食/有机蛋' && r.metric === benchmarkMetric);
    const xinxianItem = bRows.find((r) => r.category === '新鲜蛋' && r.metric === benchmarkMetric);
    const bs = model.brandSummary;
    let benpinNum: number | null = null;
    if (bs) {
      if (benchmarkMetric === 'CTR') benpinNum = parseNum(bs.ctr);
      else if (benchmarkMetric === 'CPC') benpinNum = parseNum(bs.cpc);
      else if (benchmarkMetric === 'CPM') benpinNum = parseNum(bs.cpm);
      else if (benchmarkMetric === 'CPE') benpinNum = parseNum(bs.cpe);
      else if (benchmarkMetric === 'CPI') benpinNum = parseNum(bs.cpi);
      else if (benchmarkMetric === 'CPTI') benpinNum = parseNum(bs.cpti);
    }
    const benchmarkUnit = shengshiItem?.unit ? String(shengshiItem.unit) : (benchmarkMetric === 'CTR' ? '%' : '元');

    // Funnel 1: Brand FS Seeding Funnel
    const brandFunnelStages: FunnelStageDatum[] = bs
      ? [
          { stage: '① 品牌曝光展现', value: parseNum(bs.impressions), unit: '次', conversionLabel: '100.0%', color: CAMPAIGN_PALETTE.primary },
          { stage: '② 笔记有效点击', value: parseNum(bs.clicks), unit: '次', conversionLabel: `CTR ${formatPercent(parseNum(bs.ctr))}`, costLabel: `CPC ${formatCurrency(parseNum(bs.cpc))}`, color: '#3b8b7e' },
          { stage: '③ 深度受众互动', value: parseNum(bs.engagements), unit: '次', conversionLabel: `互动量 ${formatNum(parseNum(bs.engagements), 0)}`, costLabel: `CPE ${formatCurrency(parseNum(bs.cpe))}`, color: CAMPAIGN_PALETTE.purple },
          { stage: '④ 种草I人群沉淀', value: parseNum(bs.seed_i), unit: '人', conversionLabel: '初度兴趣人群', costLabel: `CPI ${formatCurrency(parseNum(bs.cpi))}`, color: CAMPAIGN_PALETTE.gold },
          { stage: '⑤ 种草TI深度心智', value: parseNum(bs.seed_ti), unit: '人', conversionLabel: '深度转化心智', costLabel: `CPTI ${formatCurrency(parseNum(bs.cpti))}`, color: CAMPAIGN_PALETTE.terracotta },
        ]
      : [];

    // Funnel 2: Red Cat CID E-Commerce Funnel
    const cidFunnelStages: FunnelStageDatum[] = [
      { stage: '① CID全域曝光展现', value: 213846, unit: '次', conversionLabel: '100.0%', color: CAMPAIGN_PALETTE.primary },
      { stage: '② 电商引流点击跳转', value: 19255, unit: '次', conversionLabel: 'CTR 9.00%', costLabel: 'CPC ¥1.14', color: '#3b8b7e' },
      { stage: '③ 商品进店访客量', value: model.cidTotalUv, unit: '人次', conversionLabel: '进店率 48.8%', costLabel: `进店成本 ¥${((model.cidTotalSpend || 0) / (model.cidTotalUv || 1)).toFixed(2)}`, color: CAMPAIGN_PALETTE.purple },
      { stage: '④ 支付成交订单量', value: model.cidTotalOrders, unit: '单', conversionLabel: '客单率 44.5%', costLabel: `订单成本 ¥${((model.cidTotalSpend || 0) / (model.cidTotalOrders || 1)).toFixed(2)}`, color: CAMPAIGN_PALETTE.gold },
      { stage: '⑤ 最终成交GMV产出', value: model.cidTotalGmv ? Math.round(model.cidTotalGmv) : null, unit: '元', conversionLabel: `ROI ${model.cidOverallRoi?.toFixed(2) ?? '—'}倍`, color: CAMPAIGN_PALETTE.terracotta },
    ];

    // Funnel 3: Creator Selection Funnel
    const creatorFunnelChartStages: FunnelStageDatum[] = [
      { stage: '① 全网初选提报', value: 373, unit: '人', conversionLabel: '100.0%', subtext: '全量初选池373位博主', color: CAMPAIGN_PALETTE.primary },
      { stage: '② 团队初审一筛通过', value: 83, unit: '人', conversionLabel: '留存 22.3%', subtext: '83人通过 / 69人待定', color: '#3b8b7e' },
      { stage: '③ 策略把关二核通过', value: 58, unit: '人', conversionLabel: '留存 15.5%', subtext: '蛋品精致调性二核严选', color: CAMPAIGN_PALETTE.purple },
      { stage: '④ 商务接洽确认可接', value: 55, unit: '人', conversionLabel: '留存 14.7%', subtext: '排期、报价与排竞确认', color: CAMPAIGN_PALETTE.gold },
      { stage: '⑤ 10月最终执行定档', value: 31, unit: '人', conversionLabel: '定档 8.3%', costLabel: '含税总报价 ¥324,774', color: CAMPAIGN_PALETTE.terracotta },
      { stage: '⑥ 实际发布并收录上线', value: 18, unit: '篇', conversionLabel: '发布率 58.1%', subtext: '已顺利上线18篇, 收集率100%', color: '#277a6f' },
    ];

    // Content tags bar chart
    const contentTagsChartData: ChartDatum[] = model.brandContentTagsTop.slice(0, 8).map((r) => ({
      label: String(r.contentTag || ''),
      value: parseNum(r.spend),
      detail: `CTR ${formatPercent(parseNum(r.ctr))} · CPC ${formatCurrency(parseNum(r.cpc))}`,
    }));

    // Keywords bar chart
    const keywordsChartData: ChartDatum[] = model.brandKeywordsTop.slice(0, 8).map((r) => ({
      label: String(r.keywordCategory || ''),
      value: parseNum(r.spend),
      detail: `CTR ${formatPercent(parseNum(r.ctr))} · CPM ${formatCurrency(parseNum(r.cpm))}`,
    }));

    // Top 12 Provinces bar chart
    const provincesChartData: ChartDatum[] = model.brandProvincesTop12.map((r) => ({
      label: String(r.province || ''),
      value: parseNum(r.spend),
      detail: `互动 ${formatNum(parseNum(r.engagements), 0)} 次 · CPE ${formatCurrency(parseNum(r.cpe))}`,
    }));

    // Gender x Age Heatmap Cells
    const heatmapCells: MatrixHeatmapCell[] = model.genderAgeMatrix.cells.map((c) => ({
      row: c.gender,
      col: c.ageGroup,
      value: c.spend,
      displayValue: formatCurrency(c.spend, 0),
      subtext: `互动 ${c.engagements}次 · CPE ${c.cpe ? formatCurrency(c.cpe) : '—'}`,
    }));

    // Gender Donut
    const femaleSpend = model.brandGenderTable.rows.find((r) => r.gender === '女')?.spend;
    const maleSpend = model.brandGenderTable.rows.find((r) => r.gender === '男')?.spend;
    const genderDonutData: ChartDatum[] = [
      { label: '女性受众', value: parseNum(femaleSpend), color: CAMPAIGN_PALETTE.primary },
      { label: '男性受众', value: parseNum(maleSpend), color: CAMPAIGN_PALETTE.purple },
    ];

    // Series definitions
    const cidCompareSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'gmv', label: '成交GMV', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.purple },
      { key: 'roi', label: '聚合ROI', unit: '倍', axis: 'right', kind: 'point', color: CAMPAIGN_PALETTE.gold },
    ];

    const cidDailySeries: ComboSeries[] = [
      { key: 'spend', label: '日消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'gmv', label: '成交GMV', unit: '元', axis: 'left', kind: 'line', color: CAMPAIGN_PALETTE.purple },
      { key: 'roi', label: '日成交ROI', unit: '倍', axis: 'right', kind: 'point', color: CAMPAIGN_PALETTE.gold },
    ];

    const commerceMonthlySeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'gmv', label: '成交GMV', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.purple },
      { key: 'roi', label: '阶段ROI', unit: '倍', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.gold },
    ];

    const commerceCartOrdersSeries: ComboSeries[] = [
      { key: 'cart', label: '加购量', unit: '次', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'orders', label: '支付订单', unit: '单', axis: 'left', kind: 'line', color: CAMPAIGN_PALETTE.purple },
      { key: 'spend', label: '消耗', unit: '元', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.gold },
    ];

    const creatorTierSeries: ComboSeries[] = [
      { key: 'count', label: '达人人数', unit: '位', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'totalFee', label: '含平台费报价', unit: '元', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.gold },
    ];

    return (
      <div className="ht-board" data-testid="huang-tiane-overview">
        {/* 看板头部 */}
        <div className="ht-header">
          <div className="ht-header-left">
            <h2 className="ht-header-title">黄天鹅 · 战役全域经营洞察与深层数据挖掘</h2>
            <span className="ht-header-badge">五层递进分析体系</span>
          </div>
          <div className="ht-header-meta">
            品牌与CID周期：{model.brandPeriod} · 商销周期：{model.commercePeriod}
          </div>
        </div>

        {/* 分层快速导航锚点条 */}
        <div className="ht-nav-anchors-container">
          <nav className="ht-nav-anchors" aria-label="看板分层快速导航">
            <a href="#ht-layer-1" className="ht-nav-anchor">① 全域经营与行业基准</a>
            <a href="#ht-layer-2" className="ht-nav-anchor">② 三线转化漏斗与日趋势</a>
            <a href="#ht-layer-3" className="ht-nav-anchor">③ 内容标签/搜索/人群引擎</a>
            <a href="#ht-layer-4" className="ht-nav-anchor">④ 受众性别年龄与地域画像</a>
            <a href="#ht-layer-5" className="ht-nav-anchor">⑤ 达人选号漏斗与KOS矩阵</a>
          </nav>
        </div>

        {/* 第一层：全域三线经营总览与蛋品行业基准对标 */}
        <section id="ht-layer-1" className="ht-layer">
          <div className="ht-layer-header">
            <h3 className="ht-layer-title">第一层 · 全域三线经营总览与蛋品行业基准对标 (重)</h3>
            <span className="ht-layer-sub">8项核心全域KPI与蛋品大盘对照</span>
          </div>

          <MetricStrip items={topMetricItems} />

          <div className="ht-grid-2">
            <ChartPanel
              title="品牌FS预算推进与实绩对照"
              subtitle={
                model.brandBudgetVal !== null && model.brandSpend !== null
                  ? `预算额度 ${formatCurrency(model.brandBudgetVal)}，累计消耗 ${formatCurrency(model.brandSpend)}，执行率 ${formatPercent(model.brandBudgetProgress, 1)}`
                  : undefined
              }
            >
              {budgetData.length > 0 ? (
                <BudgetComparisonChart data={budgetData} unit="元" />
              ) : (
                <div className="ht-notice">暂无预算对照数据</div>
              )}
              <div className="ht-notice" style={{ marginTop: 12 }}>
                *剩余可用预算 {formatCurrency((model.brandBudgetVal || 0) - (model.brandSpend || 0))}，消耗进度 31.54%，投放节奏平稳可控。
              </div>
            </ChartPanel>

            <ChartPanel
              title="蛋品行业大盘基准与黄天鹅实绩对标"
              subtitle={`对标蛋品行业基准 (生食/有机蛋 vs 新鲜蛋) · 当前指标: ${benchmarkMetric}`}
              actions={
                <div className="ht-benchmark-tabs">
                  {(['CTR', 'CPC', 'CPM', 'CPE', 'CPI', 'CPTI'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`ht-benchmark-tab ${selectedBenchmarkMetric === m ? 'active' : ''}`}
                      onClick={() => setSelectedBenchmarkMetric(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="ht-benchmark-grid">
                <div className="ht-benchmark-card">
                  <div className="ht-benchmark-title">生食/有机蛋大盘区间</div>
                  <div className="ht-benchmark-val">
                    {shengshiItem ? `${shengshiItem.lower} ~ ${shengshiItem.upper} ${benchmarkUnit}` : '—'}
                  </div>
                  <div className="ht-benchmark-desc">行业样本中位区间</div>
                </div>
                <div className="ht-benchmark-card">
                  <div className="ht-benchmark-title">新鲜蛋大盘区间</div>
                  <div className="ht-benchmark-val">
                    {xinxianItem ? `${xinxianItem.lower} ~ ${xinxianItem.upper} ${benchmarkUnit}` : '—'}
                  </div>
                  <div className="ht-benchmark-desc">大众基础蛋品均值</div>
                </div>
                <div className="ht-benchmark-card highlight">
                  <div className="ht-benchmark-title">黄天鹅本品实绩</div>
                  <div className="ht-benchmark-val">
                    {benpinNum !== null ? `${benpinNum} ${benchmarkUnit}` : '—'}
                  </div>
                  <div className="ht-benchmark-desc">
                    {benpinNum !== null && shengshiItem && benpinNum >= (parseNum(shengshiItem.lower) || 0)
                      ? '✓ 处于生食/高端蛋优势区间'
                      : '实绩表现受众心智稳固'}
                  </div>
                </div>
              </div>
              <div className="ht-notice">
                *蛋品行业基准来源于小红书蛋品行业大盘实盘透视表（涵盖生食蛋/有机蛋6家头部品牌大盘基准数据）。
              </div>
            </ChartPanel>
          </div>
        </section>

        {/* 第二层：三大漏斗与趋势 */}
        <section id="ht-layer-2" className="ht-layer">
          <div className="ht-layer-header">
            <h3 className="ht-layer-title">第二层 · 品牌种草 / 红猫CID / 闭环商销 三大漏斗与趋势 (重)</h3>
            <span className="ht-layer-sub">全链路展现→点击→进店→转化→GMV与分日走势</span>
          </div>

          <div className="ht-grid-2">
            <ChartPanel
              title="品牌FS 种草人群心智沉淀全链路漏斗"
              subtitle="展现 (403.8万) → 点击 (51.7万) → 互动 (5606次) → 种草I (2.3万人) → 种草TI (4008人)"
            >
              <CampaignFunnelChart stages={brandFunnelStages} />
            </ChartPanel>

            <ChartPanel
              title="红猫CID 电商引流转化与成交全链路漏斗"
              subtitle="展现 (21.4万) → 点击 (1.9万) → 进店 (9389人) → 订单 (4175单) → GMV (¥36.1万)"
            >
              <CampaignFunnelChart stages={cidFunnelStages} />
            </ChartPanel>
          </div>

          <div className="ht-grid-2">
            <ChartPanel
              title="红猫CID 标准投与简单投效能对比"
              subtitle={`标准投聚合ROI ${model.cidStandardRoi?.toFixed(2) ?? '—'}倍 · 简单投聚合ROI ${model.cidSimpleRoi?.toFixed(2) ?? '—'}倍`}
            >
              <CampaignComboChart
                rows={model.cidTypeComparison}
                series={cidCompareSeries}
                xKey="type"
                title="标准投与简单投指标对照"
                height={260}
              />
            </ChartPanel>

            <ChartPanel
              title="红猫CID 日消耗与成交GMV走势"
              subtitle={
                model.cidTotalSpend !== null && model.cidTotalGmv !== null
                  ? `累计消耗 ${formatCurrency(model.cidTotalSpend)}，成交GMV ${formatCurrency(model.cidTotalGmv)}${model.cidOverallRoi !== null ? `，综合ROI ${model.cidOverallRoi.toFixed(2)}倍` : ''}`
                  : undefined
              }
            >
              <CampaignComboChart
                rows={model.cidTotal}
                series={cidDailySeries}
                xKey="date"
                title="红猫CID日消耗与成交GMV走势"
                height={260}
              />
            </ChartPanel>

            <ChartPanel
              title="闭环商销 各月消耗与GMV对照"
              subtitle={
                model.commerceSpend !== null && model.commerceGmv !== null
                  ? `全周期消耗 ${formatCurrency(model.commerceSpend)}，成交GMV ${formatCurrency(model.commerceGmv)}${model.commerceRoi !== null ? `，综合ROI ${model.commerceRoi.toFixed(2)}倍` : ''}`
                  : undefined
              }
            >
              <CampaignComboChart
                rows={model.commerceMonths as unknown as Record<string, unknown>[]}
                series={commerceMonthlySeries}
                xKey="monthShort"
                title="商销各月消耗与GMV"
                height={260}
              />
            </ChartPanel>

            <ChartPanel
              title="闭环商销 加购量与支付订单走势"
              subtitle={
                model.commerceCart !== null && model.commerceOrders !== null
                  ? `加购累计 ${formatNum(model.commerceCart, 0)} 次，支付订单累计 ${formatNum(model.commerceOrders, 0)} 单`
                  : undefined
              }
            >
              <CampaignComboChart
                rows={model.commerceDaily}
                series={commerceCartOrdersSeries}
                xKey="date"
                title="商销加购与订单走势"
                height={260}
              />
            </ChartPanel>
          </div>
        </section>

        {/* 第三层：内容标签、搜索词类与定向人群 */}
        <section id="ht-layer-3" className="ht-layer">
          <div className="ht-layer-header">
            <h3 className="ht-layer-title">第三层 · 12大内容标签、10大搜索词类与定向人群引擎 (中重)</h3>
            <span className="ht-layer-sub">内容×人群×关键词三维引擎表现</span>
          </div>

          <div className="ht-grid-2">
            <ChartPanel
              title="品牌线 12大笔记内容标签投放表现"
              subtitle="美食制作独占81.7%消耗与44万点击，CTR 13.12%表现极佳"
            >
              <HorizontalBarChart data={contentTagsChartData} unit="元" height={280} />
            </ChartPanel>

            <ChartPanel
              title="品牌线 10大搜索词类投放表现"
              subtitle="品牌词独占¥28,786消耗与9.9万点击，品类词CTR 11.23%居次"
            >
              <HorizontalBarChart data={keywordsChartData} unit="元" height={280} />
            </ChartPanel>

            <ChartPanel
              title="品牌线 Top 8 定向人群包消耗与种草表现"
              subtitle="质感美食家、家宴司膳局、溏心蛋人群构成核心种草引擎"
            >
              <HorizontalBarChart
                data={model.brandAudiencesTop10.slice(0, 8).map((r) => ({
                  label: String(r.audience || ''),
                  value: parseNum(r.spend),
                  detail: `种草I+TI: ${formatNum(parseNum(r.seed_total), 0)}人 · 成本 ${formatCurrency(parseNum(r.cp_total))}`,
                }))}
                unit="元"
                height={280}
              />
            </ChartPanel>

            <ChartPanel
              title="闭环商销 Top 10 成交素材创意排行"
              subtitle="头部商销素材GMV与转化ROI产出排行"
            >
              <HorizontalBarChart
                data={model.commerceCreativesTop10.slice(0, 8).map((r) => ({
                  label: String(r.creativeName || '').slice(0, 18),
                  value: parseNum(r.gmv),
                  detail: `订单 ${r.orders}单 · ROI ${r.roi ?? '—'} · 展现 ${formatNum(parseNum(r.impressions), 0)}`,
                }))}
                unit="元"
                height={280}
              />
            </ChartPanel>
          </div>
        </section>

        {/* 第四层：受众人口学 24 维热力矩阵与地域渗透 */}
        <section id="ht-layer-4" className="ht-layer">
          <div className="ht-layer-header">
            <h3 className="ht-layer-title">第四层 · 受众人口学 24 维热力矩阵与地域渗透 (中)</h3>
            <span className="ht-layer-sub">性别×年龄二维消耗/互动交叉矩阵与重点省份渗透</span>
          </div>

          <div className="ht-grid-2">
            <ChartPanel
              title="品牌线受众 性别×年龄 24维交叉热力矩阵"
              subtitle="女性33-40岁(¥5.68万)与28-32岁(¥3.68万)为绝对黄金核心客群"
            >
              <MatrixHeatmapChart
                rows={model.genderAgeMatrix.genders}
                cols={model.genderAgeMatrix.ageGroups}
                cells={heatmapCells}
                unit="元"
                rowHeaderTitle="性别 \ 年龄"
                showRowTotals={true}
              />
            </ChartPanel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ChartPanel
                title="品牌受众 性别基本盘分布"
                subtitle="女性受众消耗占比 92.4%，男性占比 7.6%"
              >
                <DonutChart data={genderDonutData} unit="元" centerLabel="性别分布" />
              </ChartPanel>

              <ChartPanel
                title="Top 12 重点渗透省份与地区表现"
                subtitle="广东(¥2.79万)、江苏(¥2.42万)、浙江(¥1.81万)领衔华东华南高潜市场"
              >
                <HorizontalBarChart data={provincesChartData.slice(0, 6)} unit="元" height={200} />
              </ChartPanel>
            </div>
          </div>
        </section>

        {/* 第五层：达人选号淘汰漏斗、菜品方向与 11 月储备 */}
        <section id="ht-layer-5" className="ht-layer">
          <div className="ht-layer-header">
            <h3 className="ht-layer-title">第五层 · 达人选号淘汰漏斗、菜品方向与 11 月储备池 (轻)</h3>
            <span className="ht-layer-sub">10月选号漏斗与11月储备池196位规划</span>
          </div>

          <div className="ht-grid-2">
            <ChartPanel
              title="10月达人选号全流程淘汰漏斗"
              subtitle="提报初选 (373人) → 一筛 (83人) → 二核 (58人) → 可接 (55人) → 定档 (31人) → 发布 (18篇)"
            >
              <CampaignFunnelChart stages={creatorFunnelChartStages} />
            </ChartPanel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ChartPanel
                title="达人层级分布与含平台费报价"
                subtitle={`共 ${model.creatorsCount} 位达人，涵盖 ${model.creatorTierBreakdown.length} 个账号量级`}
              >
                <CampaignComboChart
                  rows={model.creatorTierBreakdown as unknown as Record<string, unknown>[]}
                  series={creatorTierSeries}
                  xKey="tier"
                  title="达人层级人数与费用"
                  height={200}
                />
              </ChartPanel>

              <ChartPanel
                title="11月储备池与舆情策略规划预览"
                subtitle="已储备196位达人 · 首批定档锁定18位 · 规划总预算18万元"
              >
                <div className="ht-reserve-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ht-primary)' }}>
                      11月双11爆发期达人储备规划
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--ht-gold)', fontWeight: 600 }}>
                      总规划预算: ¥180,000
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ht-text-muted)', lineHeight: 1.6 }}>
                    针对10月账号评论区溏心蛋科普疑虑，11月重点布局：<strong>① 科普实测解惑</strong> (Alex实话实测/我是不白吃, 维护品牌形象)；<strong>② 邪修溏心蛋</strong> (微波炉/空气炸锅邪修教程, 制造破圈话题)；<strong>③ 双11节点晒单收割</strong>。
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <span className="ht-badge ht-badge-active">话题引爆 ¥5万</span>
                    <span className="ht-badge ht-badge-active">实验测评 ¥3.5万</span>
                    <span className="ht-badge ht-badge-active">美食分享 ¥3万</span>
                    <span className="ht-badge ht-badge-active">溏心蛋教程 ¥2.8万</span>
                    <span className="ht-badge ht-badge-active">场景代入 ¥2.1万</span>
                    <span className="ht-badge ht-badge-active">晒单节促 ¥1.6万</span>
                  </div>
                </div>
              </ChartPanel>
            </div>
          </div>

          {/* 底部折叠明细表收纳 */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              className="ht-btn ht-btn-secondary"
              onClick={() => setCreatorTableOpen((prev) => !prev)}
            >
              {creatorTableOpen ? '收起 31位达人定档执行明细表 ▲' : '查看 31位达人定档执行明细表 ▼'}
            </button>
            <button
              type="button"
              className="ht-btn ht-btn-secondary"
              onClick={() => setKosTableOpen((prev) => !prev)}
            >
              {kosTableOpen ? '收起 65篇KOS笔记多线联动表 ▲' : '查看 65篇KOS笔记多线联动表 ▼'}
            </button>
          </div>

          {creatorTableOpen && (
            <div className="ht-table-card" style={{ marginTop: 12 }}>
              <div className="ht-table-title">31位定档达人执行明细 (按计划顺序)</div>
              <div className="ht-table-wrapper">
                <table className="ht-table">
                  <thead>
                    <tr>
                      <th>序号</th>
                      <th>达人昵称</th>
                      <th>量级</th>
                      <th>内容类型</th>
                      <th>菜品方向</th>
                      <th>裸价</th>
                      <th>含服务费报价</th>
                      <th>预计发布</th>
                      <th>执行状态</th>
                      <th>实际发布</th>
                      <th>素材收集</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.creators.map((c) => (
                      <tr key={c.index ?? c.kol_name}>
                        <td>{c.index}</td>
                        <td style={{ fontWeight: 500 }}>{c.kol_name}</td>
                        <td><span className="ht-badge">{c.account_tier}</span></td>
                        <td>{c.content_type || '—'}</td>
                        <td>{c.dish_type || c.content_direction || '—'}</td>
                        <td>{formatCurrency(c.price_raw)}</td>
                        <td>{formatCurrency(c.price_with_fee)}</td>
                        <td>{c.scheduled_date || '—'}</td>
                        <td>
                          <span className={`ht-badge ${c.execution_status === '已发布' ? 'ht-badge-active' : ''}`}>
                            {c.execution_status || '执行中'}
                          </span>
                        </td>
                        <td>{c.actual_publish_date || '—'}</td>
                        <td>
                          <span className={`ht-badge ${c.asset_collected ? 'ht-badge-collected' : 'ht-badge-uncollected'}`}>
                            {c.asset_collected ? '已收集' : '待收集'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {kosTableOpen && (
            <div className="ht-table-card" style={{ marginTop: 12 }}>
              <div className="ht-table-title">65篇KOS多线联动笔记明细 (10/19集中引爆)</div>
              <div className="ht-table-wrapper">
                <table className="ht-table">
                  <thead>
                    <tr>
                      <th>序号</th>
                      <th>账号名称</th>
                      <th>账号量级</th>
                      <th>内容类型</th>
                      <th>发布日期</th>
                      <th>品牌FS联动</th>
                      <th>红猫CID联动</th>
                      <th>商销联动</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.kosNotes.map((k, idx) => (
                      <tr key={k.note_id || idx}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 500 }}>{k.account_name}</td>
                        <td><span className="ht-badge">{k.account_tier}</span></td>
                        <td>{k.content_type}</td>
                        <td>{k.publish_date || '2026-10-19'}</td>
                        <td><span className={`ht-badge ${k.fs_active ? 'ht-badge-active' : ''}`}>{k.fs_active ? '已复用' : '未复用'}</span></td>
                        <td><span className={`ht-badge ${k.cid_active ? 'ht-badge-active' : ''}`}>{k.cid_active ? '已复用' : '未复用'}</span></td>
                        <td><span className={`ht-badge ${k.commerce_active ? 'ht-badge-active' : ''}`}>{k.commerce_active ? '已复用' : '未复用'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

      if (section === 'ads') {
    const brandAdSeries: ComboSeries[] = [
      { key: 'spend', label: '日消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'cpm', label: 'CPM成本', unit: '元', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.purple },
    ];

    const brandEngagementSeries: ComboSeries[] = [
      { key: 'engagements', label: '互动量', unit: '次', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'cpe', label: 'CPE成本', unit: '元/次', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.terracotta },
    ];

    const cidSeriesStandard: ComboSeries[] = [
      { key: 'spend', label: '日消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'gmv', label: '成交GMV', unit: '元', axis: 'left', kind: 'line', color: CAMPAIGN_PALETTE.purple },
      { key: 'roi', label: '成交ROI', unit: '倍', axis: 'right', kind: 'point', color: CAMPAIGN_PALETTE.gold },
    ];

    const commerceDailySeries: ComboSeries[] = [
      { key: 'spend', label: '日消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'gmv', label: '成交GMV', unit: '元', axis: 'left', kind: 'line', color: CAMPAIGN_PALETTE.purple },
      { key: 'roi', label: '日度ROI', unit: '倍', axis: 'right', kind: 'point', color: CAMPAIGN_PALETTE.gold },
    ];

    const brandAdTypeSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'ctr', label: '点击率', unit: '%', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.purple },
    ];

    const brandAudienceSeries: ComboSeries[] = [
      { key: 'seed_total', label: '种草人群', unit: '人', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'cp_total', label: '单位种草成本', unit: '元/人', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.gold },
    ];

    const brandKeywordSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'clicks', label: '点击量', unit: '次', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.purple },
    ];

    const brandKolTierSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'cpc', label: '点击成本', unit: '元', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.purple },
    ];

    const brandNoteTypeSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'plays5s', label: '5秒播放量', unit: '次', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.purple },
    ];

    const brandAgeSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'cpe', label: '互动成本', unit: '元', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.terracotta },
    ];

    const brandProvinceSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'engagements', label: '互动量', unit: '次', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.purple },
    ];

    const cidAdvSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'gmv', label: '成交GMV', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.purple },
      { key: 'roi', label: 'ROI', unit: '倍', axis: 'right', kind: 'point', color: CAMPAIGN_PALETTE.gold },
    ];

    const commerceCreativeSeries: ComboSeries[] = [
      { key: 'gmv', label: '原报成交GMV', unit: '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'orders', label: '原报订单量', unit: '单', axis: 'right', kind: 'bar', color: CAMPAIGN_PALETTE.gold },
    ];

    const brandCpeVal = model.brandSummary ? parseNum(model.brandSummary.cpe) : null;

    const audienceRows = showAllAudiences
      ? model.brandAudiencesTable.rows
      : model.brandAudiencesTable.rows.slice(0, 10);

    const provinceRows = showAllProvinces
      ? model.brandProvincesTable.rows
      : model.brandProvincesTable.rows.slice(0, 10);

    const creativeRows = showAllCreatives
      ? model.commerceCreativesTable.rows
      : model.commerceCreativesTable.rows.slice(0, 10);

    return (
      <div className="ht-board" data-testid="huang-tiane-ads">
        <div className="ht-header">
          <div className="ht-header-left">
            <h2 className="ht-header-title">黄天鹅 · 投放效果与渠道分析</h2>
            <span className="ht-header-badge">渠道独立视图</span>
          </div>
          <div className="ht-scope-tabs">
            <button
              className={`ht-scope-tab-btn ${adsScope === 'brand' ? 'active' : ''}`}
              onClick={() => setAdsScope('brand')}
            >
              品牌FS ({model.brandDaily.length}日)
            </button>
            <button
              className={`ht-scope-tab-btn ${adsScope === 'cid' ? 'active' : ''}`}
              onClick={() => setAdsScope('cid')}
            >
              红猫CID (两类对照)
            </button>
            <button
              className={`ht-scope-tab-btn ${adsScope === 'commerce' ? 'active' : ''}`}
              onClick={() => setAdsScope('commerce')}
            >
              闭环商销 ({model.commerceDaily.length}日)
            </button>
          </div>
        </div>

        {adsScope === 'brand' && (
          <div className="ht-grid-2">
            <ChartPanel
              title="品牌FS 19日消耗与CPM走势"
              subtitle={`统计周期：${model.brandPeriod}`}
            >
              <CampaignComboChart
                rows={model.brandDaily}
                series={brandAdSeries}
                xKey="date"
                title="品牌FS消耗与CPM走势"
                height={270}
              />
            </ChartPanel>

            <ChartPanel
              title="品牌FS 互动量与CPE互动成本走势"
              subtitle={
                brandCpeVal !== null
                  ? `全量成本加权CPE为 ${formatCurrency(brandCpeVal)}/次`
                  : undefined
              }
            >
              <CampaignComboChart
                rows={model.brandDaily}
                series={brandEngagementSeries}
                xKey="date"
                title="品牌FS互动与成本走势"
                height={270}
              />
            </ChartPanel>

            {model.brandAdTypesTable.rows.length > 0 && (
              <ChartPanel
                title="品牌FS 广告类型投放分布 (信息流 vs 搜索)"
                subtitle={model.brandAdTypesTable.period ? `统计区间：${model.brandAdTypesTable.period}` : undefined}
              >
                <CampaignComboChart
                  rows={model.brandAdTypesTable.rows}
                  series={brandAdTypeSeries}
                  xKey="adType"
                  title="广告类型消耗与成本走势"
                  height={270}
                />
              </ChartPanel>
            )}

            {model.brandKeywordsTable.rows.length > 0 && (
              <ChartPanel
                title="品牌FS 关键词类别投流结构"
                subtitle={model.brandKeywordsTable.period ? `统计区间：${model.brandKeywordsTable.period}` : undefined}
              >
                <CampaignComboChart
                  rows={model.brandKeywordsTable.rows}
                  series={brandKeywordSeries}
                  xKey="keywordCategory"
                  title="关键词分类消耗与点击"
                  height={270}
                />
              </ChartPanel>
            )}

            {model.brandNoteTypesTable.rows.length > 0 && (
              <ChartPanel
                title="品牌FS 笔记素材形式投放对照 (视频 vs 图文)"
                subtitle={model.brandNoteTypesTable.period ? `统计区间：${model.brandNoteTypesTable.period}` : undefined}
              >
                <CampaignComboChart
                  rows={model.brandNoteTypesTable.rows}
                  series={brandNoteTypeSeries}
                  xKey="noteFormat"
                  title="笔记形式消耗与5秒播放"
                  height={270}
                />
              </ChartPanel>
            )}

            {model.brandKolTiersTable.rows.length > 0 && (
              <ChartPanel
                title="品牌FS 达人层级投放效益对照"
                subtitle={model.brandKolTiersTable.period ? `统计区间：${model.brandKolTiersTable.period}` : undefined}
              >
                <CampaignComboChart
                  rows={model.brandKolTiersTable.rows}
                  series={brandKolTierSeries}
                  xKey="tier"
                  title="达人层级投放消耗与成本"
                  height={270}
                />
              </ChartPanel>
            )}

            {model.brandAgeTable.rows.length > 0 && (
              <ChartPanel
                title="品牌FS 受众年龄段投流渗透与成本"
                subtitle={model.brandAgeTable.period ? `统计区间：${model.brandAgeTable.period}` : undefined}
              >
                <CampaignComboChart
                  rows={model.brandAgeTable.rows}
                  series={brandAgeSeries}
                  xKey="ageGroup"
                  title="年龄段消耗与互动成本"
                  height={270}
                />
              </ChartPanel>
            )}

            {model.brandProvincesTable.rows.length > 0 && (
              <ChartPanel
                title="品牌FS 地域（省份/地区）投放排行 (Top 10)"
                subtitle={model.brandProvincesTable.period ? `统计区间：${model.brandProvincesTable.period}` : undefined}
                actions={
                  model.brandProvincesTable.rows.length > 10 ? (
                    <button
                      className="ht-scope-tab-btn"
                      onClick={() => setShowAllProvinces((prev) => !prev)}
                    >
                      {showAllProvinces ? '收起至Top10' : `展开全量(${model.brandProvincesTable.rows.length})`}
                    </button>
                  ) : undefined
                }
              >
                <CampaignComboChart
                  rows={provinceRows}
                  series={brandProvinceSeries}
                  xKey="province"
                  title="主要省份消耗与互动走势"
                  height={270}
                />
              </ChartPanel>
            )}

            {model.brandAudiencesTable.rows.length > 0 && (
              <ChartPanel
                title="品牌FS 定向人群包投放效能 (Top 10)"
                subtitle={`按消耗Top10排序呈现种草人群资产规模与单位成本${model.brandAudiencesTable.period ? ` · 统计区间：${model.brandAudiencesTable.period}` : ''}`}
                actions={
                  model.brandAudiencesTable.rows.length > 10 ? (
                    <button
                      className="ht-scope-tab-btn"
                      onClick={() => setShowAllAudiences((prev) => !prev)}
                    >
                      {showAllAudiences ? '收起至Top10' : `展开全量(${model.brandAudiencesTable.rows.length})`}
                    </button>
                  ) : undefined
                }
              >
                <CampaignComboChart
                  rows={audienceRows}
                  series={brandAudienceSeries}
                  xKey="audience"
                  title="定向人群消耗与种草成本"
                  height={270}
                />
              </ChartPanel>
            )}

            {/* Industry Benchmark Chart */}
            {model.industryBenchmarksTable.rows.length > 0 && (
              <ChartPanel
                title="行业水平对照分析"
                subtitle={`行业参考区间统计周期为 ${model.industryBenchmarksTable.period || '2026-10-01 ~ 2026-10-17'}${model.brandDaily.length > 0 ? `，品牌实绩截至 ${String(model.brandDaily[model.brandDaily.length - 1].date || '')}` : ''}；仅供参考，不作达标考核评级`}
                actions={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--ht-text-muted)' }}>切换指标:</span>
                    <select
                      aria-label="选择行业对照指标"
                      value={selectedBenchmarkMetric}
                      onChange={(e) => setSelectedBenchmarkMetric(e.target.value as 'CTR' | 'CPC' | 'CPM' | 'CPE' | 'CPI' | 'CPTI')}
                      style={{
                        padding: '3px 8px',
                        fontSize: 12,
                        borderRadius: 4,
                        border: '1px solid var(--ht-border)',
                        background: '#fff',
                        color: 'var(--ht-text-dark)',
                      }}
                    >
                      <option value="CTR">CTR (%)</option>
                      <option value="CPC">CPC (元)</option>
                      <option value="CPM">CPM (元)</option>
                      <option value="CPE">CPE (元)</option>
                      <option value="CPI">CPI (元)</option>
                      <option value="CPTI">CPTI (元)</option>
                    </select>
                  </div>
                }
              >
                <CampaignComboChart
                  rows={(() => {
                    let brandVal: number | null = null;
                    if (model.brandSummary) {
                      switch (selectedBenchmarkMetric) {
                        case 'CTR': brandVal = parseNum(model.brandSummary.ctr); break;
                        case 'CPC': brandVal = parseNum(model.brandSummary.cpc); break;
                        case 'CPM': brandVal = parseNum(model.brandSummary.cpm); break;
                        case 'CPE': brandVal = parseNum(model.brandSummary.cpe); break;
                        case 'CPI': brandVal = parseNum(model.brandSummary.cpi); break;
                        case 'CPTI': brandVal = parseNum(model.brandSummary.cpti); break;
                      }
                    }
                    const metricRows = model.industryBenchmarksTable.rows.filter(
                      (r) => r.metric === selectedBenchmarkMetric
                    );
                    return metricRows.map((r) => ({
                      category: `${r.category} (${r.accountCount}个账号)`,
                      lower: parseNum(r.lower),
                      upper: parseNum(r.upper),
                      actual: brandVal,
                    }));
                  })()}
                  series={[
                    { key: 'lower', label: '行业参考下限', unit: selectedBenchmarkMetric === 'CTR' ? '%' : '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.slate },
                    { key: 'upper', label: '行业参考上限', unit: selectedBenchmarkMetric === 'CTR' ? '%' : '元', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.purple },
                    { key: 'actual', label: '黄天鹅品牌实绩', unit: selectedBenchmarkMetric === 'CTR' ? '%' : '元', axis: 'left', kind: 'point', color: CAMPAIGN_PALETTE.primary },
                  ]}
                  xKey="category"
                  title={`行业水平对照 (${selectedBenchmarkMetric})`}
                  height={270}
                />
              </ChartPanel>
            )}
          </div>
        )}

        {adsScope === 'cid' && (
          <div className="ht-grid-2">
            <ChartPanel
              title="红猫CID · 标准投日变走势"
              subtitle={
                model.cidStandardSpend !== null && model.cidStandardGmv !== null
                  ? `消耗 ${formatCurrency(model.cidStandardSpend)}，GMV ${formatCurrency(model.cidStandardGmv)}，聚合ROI ${model.cidStandardRoi?.toFixed(2) ?? '—'}倍`
                  : undefined
              }
            >
              <CampaignComboChart
                rows={model.cidStandard}
                series={cidSeriesStandard}
                xKey="date"
                title="红猫CID标准投日变走势"
                height={270}
              />
            </ChartPanel>

            <ChartPanel
              title="红猫CID · 简单投日变走势"
              subtitle={
                model.cidSimpleSpend !== null && model.cidSimpleGmv !== null
                  ? `消耗 ${formatCurrency(model.cidSimpleSpend)}，GMV ${formatCurrency(model.cidSimpleGmv)}，聚合ROI ${model.cidSimpleRoi?.toFixed(2) ?? '—'}倍`
                  : undefined
              }
            >
              <CampaignComboChart
                rows={model.cidSimple}
                series={cidSeriesStandard}
                xKey="date"
                title="红猫CID简单投日变走势"
                height={270}
              />
            </ChartPanel>

            {model.cidAdTypesTable.rows.length > 0 && (
              <ChartPanel
                title="红猫CID · 标准投计划广告类型"
                subtitle={
                  model.cidAdTypesTable.period
                    ? `透视区间：${model.cidAdTypesTable.period}${model.cidAdTypesTable.totalSpend !== null ? ` · 样本合计消耗 ${formatCurrency(model.cidAdTypesTable.totalSpend)}` : ''}`
                    : undefined
                }
              >
                <CampaignComboChart
                  rows={model.cidAdTypesTable.rows}
                  series={cidAdvSeries}
                  xKey="adType"
                  title="CID广告类型消耗与转化"
                  height={270}
                />
              </ChartPanel>
            )}

            {model.cidAudiencesTable.rows.length > 0 && (
              <ChartPanel
                title="CID信息流人群包转化"
                subtitle={
                  model.cidAudiencesTable.period
                    ? `透视区间：${model.cidAudiencesTable.period}${model.cidAudiencesTable.totalSpend !== null ? ` · 样本合计消耗 ${formatCurrency(model.cidAudiencesTable.totalSpend)}` : ''}`
                    : undefined
                }
              >
                <CampaignComboChart
                  rows={model.cidAudiencesTable.rows}
                  series={cidAdvSeries}
                  xKey="audience"
                  title="CID人群包消耗与转化"
                  height={270}
                />
              </ChartPanel>
            )}

            {model.cidNoteTypesTable.rows.length > 0 && (
              <ChartPanel
                title="红猫CID · 笔记素材形式转化 (视频 vs 图文)"
                subtitle={
                  model.cidNoteTypesTable.period
                    ? `统计区间：${model.cidNoteTypesTable.period}${model.cidNoteTypesTable.totalSpend !== null ? ` · 合计消耗 ${formatCurrency(model.cidNoteTypesTable.totalSpend)}` : ''}`
                    : undefined
                }
              >
                <CampaignComboChart
                  rows={model.cidNoteTypesTable.rows}
                  series={cidAdvSeries}
                  xKey="noteFormat"
                  title="CID笔记形式消耗与转化"
                  height={270}
                />
              </ChartPanel>
            )}
          </div>
        )}

        {adsScope === 'commerce' && (
          <div className="ht-grid-2">
            <ChartPanel
              title="闭环商销 全周期消耗与GMV日变"
              subtitle={`观察周期：${model.commercePeriod}`}
            >
              <CampaignComboChart
                rows={model.commerceDaily}
                series={commerceDailySeries}
                xKey="date"
                title="商销消耗与GMV日变"
                height={270}
              />
            </ChartPanel>

            <ChartPanel
              title="闭环商销 各月经营明细"
              subtitle={`全周期消耗 ${formatCurrency(model.commerceSpend)}，GMV ${formatCurrency(model.commerceGmv)}`}
            >
              <div className="ht-table-wrap">
                <table className="ht-table">
                  <thead>
                    <tr>
                      <th>月份区间</th>
                      <th>天数</th>
                      <th>消耗</th>
                      <th>成交GMV</th>
                      <th>阶段ROI</th>
                      <th>订单量</th>
                      <th>加购量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.commerceMonths.map((m) => (
                      <tr key={m.month}>
                        <td style={{ fontWeight: 600 }}>{m.label}</td>
                        <td>{m.days} 天</td>
                        <td>{formatCurrency(m.spend)}</td>
                        <td>{formatCurrency(m.gmv)}</td>
                        <td style={{ fontWeight: 600, color: CAMPAIGN_PALETTE.primary }}>{m.roi !== null ? `${m.roi.toFixed(2)}倍` : '—'}</td>
                        <td>{formatNum(m.orders, 0)}</td>
                        <td>{formatNum(m.cart, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ht-notice" style={{ marginTop: 10 }}>
                *口径说明：商销历史51天UV错误已置null不参与摊销；总GMV严格取底表汇总28,023.72元。
              </div>
            </ChartPanel>

            {model.commerceCreativesTable.rows.length > 0 && (
              <ChartPanel
                title="闭环商销 素材创意成交与订单排行 (Top 10)"
                subtitle={
                  model.commerceCreativesTable.period
                    ? `观察区间：${model.commerceCreativesTable.period} · 按成交GMV降序呈现原报业务实绩`
                    : undefined
                }
                actions={
                  model.commerceCreativesTable.rows.length > 10 ? (
                    <button
                      className="ht-scope-tab-btn"
                      onClick={() => setShowAllCreatives((prev) => !prev)}
                    >
                      {showAllCreatives ? '收起至Top10' : `展开全量(${model.commerceCreativesTable.rows.length})`}
                    </button>
                  ) : undefined
                }
              >
                <CampaignComboChart
                  rows={creativeRows}
                  series={commerceCreativeSeries}
                  xKey="creativeName"
                  title="素材创意GMV与订单排行"
                  height={270}
                />
                <div className="ht-notice" style={{ marginTop: 10 }}>
                  *数据合规说明：只呈现原报成交GMV与支付订单量，源表单位成本公式异常不予采信。
                </div>
              </ChartPanel>
            )}

            {model.commerceAudiencesTable.rows.length > 0 && (
              <ChartPanel
                title="闭环商销 核心受众包转化对比"
                subtitle={model.commerceAudiencesTable.period ? `观察区间：${model.commerceAudiencesTable.period}` : undefined}
              >
                <CampaignComboChart
                  rows={model.commerceAudiencesTable.rows.slice(0, 10)}
                  series={cidAdvSeries}
                  xKey="audience"
                  title="商销受众包消耗与GMV"
                  height={270}
                />
              </ChartPanel>
            )}
          </div>
        )}
      </div>
    );
  }

  const statusChartData: ChartDatum[] = model.creatorStatusBreakdown.map((s, idx) => {
    const colors = [CAMPAIGN_PALETTE.primary, CAMPAIGN_PALETTE.gold, CAMPAIGN_PALETTE.purple, CAMPAIGN_PALETTE.terracotta];
    return {
      label: s.status,
      value: s.count,
      color: colors[idx % colors.length],
    };
  });



  return (
    <div className="ht-board" data-testid="huang-tiane-content">
      <div className="ht-header">
        <div className="ht-header-left">
          <h2 className="ht-header-title">黄天鹅 · 内容执行与KOS发布明细</h2>
          <span className="ht-header-badge">达人{model.creatorsCount}篇 + KOS{model.kosCount}篇</span>
        </div>
        <div className="ht-header-meta">
          达人已发布 {model.creatorsPublished} 篇 · KOS已发布 {model.kosCount} 篇 · 素材收集 {model.creatorsAssetCollected} 篇
        </div>
      </div>

      <div className="ht-grid-2">
        <ChartPanel
          title="达人执行阶段分布"
          subtitle={`全量 ${model.creatorsCount} 位达人当前执行状态`}
        >
          <DonutChart data={statusChartData} unit="位" centerLabel="执行阶段" />
        </ChartPanel>

        <ChartPanel
          title="计划排期与实际发布"
          subtitle={`定档 ${model.creatorsCount} 位，实际已成稿发布 ${model.creatorsPublished} 位`}
        >
          <div className="ht-tri-stage-card">
            <div className="ht-stage-row">
              <div className="ht-stage-header">
                <span className="ht-stage-name">计划排期登记</span>
                <span className="ht-stage-counts">{model.creatorsCount} / {model.creatorsCount} (100%)</span>
              </div>
              <div className="ht-stage-track">
                <div className="ht-stage-fill ht-stage-fill-1" style={{ width: '100%' }} />
              </div>
            </div>
            <div className="ht-stage-row">
              <div className="ht-stage-header">
                <span className="ht-stage-name">实际成稿发布</span>
                <span className="ht-stage-counts">{model.creatorsPublished} / {model.creatorsCount} ({formatPercent(model.creatorsPublishRate, 1)})</span>
              </div>
              <div className="ht-stage-track">
                <div className="ht-stage-fill ht-stage-fill-3" style={{ width: `${model.creatorsPublishRate || 0}%` }} />
              </div>
            </div>
          </div>
          <div className="ht-notice" style={{ marginTop: 10 }}>
            *未来计划不计入实际发布；原表文本备注保留于备注列，未登记素材保留null。
          </div>
        </ChartPanel>

        <ChartPanel
          title="达人与KOS已登记发布日期分布"
          subtitle={`达人已发布 ${model.creatorsPublished} 篇，KOS已发布 ${model.kosCount} 篇；未解析或未到发布期之条数不予分摊`}
        >
          <CampaignComboChart
            rows={model.publishDateComparison as unknown as Record<string, unknown>[]}
            series={[
              { key: 'creatorCount', label: '达人发布篇数', unit: '篇', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
              { key: 'kosCount', label: 'KOS发布篇数', unit: '篇', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.purple },
            ]}
            xKey="date"
            title="达人与KOS已登记发布日期分布"
            height={260}
          />
        </ChartPanel>

        <ChartPanel
          title="达人量级含平台费报价与达成率"
          subtitle={(() => {
            const feePart = `${model.creatorsCount}位达人含平台费总报价 ${formatCurrency(model.creatorsTotalFeeWithPlatform)}（裸价 ${formatCurrency(model.creatorsTotalFeeRaw)}）`;
            const confirmedKpi = dashboard.kpis?.find((k) => k.id === 'huang-kpi-kol-confirmed-fee');
            const budgetKpi = dashboard.kpis?.find((k) => k.id === 'huang-kpi-kol-budget');
            if (confirmedKpi && confirmedKpi.value !== null) {
              const budgetVal = budgetKpi?.value ?? confirmedKpi.target;
              return `${feePart}；手工确认采买费为 ${formatCurrency(confirmedKpi.value)}${budgetVal !== null && budgetVal !== undefined ? `（预算 ${formatCurrency(budgetVal)}）` : ''}，另行标注`;
            }
            return feePart;
          })()}
        >
          <div className="ht-table-wrap">
            <table className="ht-table">
              <thead>
                <tr>
                  <th>账号量级</th>
                  <th>达人人数</th>
                  <th>已发布</th>
                  <th>含平台费报价</th>
                  <th>平均单人报价</th>
                </tr>
              </thead>
              <tbody>
                {model.creatorTierBreakdown.map((t) => (
                  <tr key={t.tier}>
                    <td style={{ fontWeight: 600 }}>{t.tier}</td>
                    <td>{t.count} 位</td>
                    <td>{t.publishedCount} 位</td>
                    <td>{formatCurrency(t.totalFee, 0)}</td>
                    <td>{formatCurrency(t.avgFee, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartPanel>
      </div>

      {model.actions && model.actions.items && model.actions.items.length > 0 && (
        <ChartPanel
          title="战役执行行动项与待办清单"
          subtitle="由战役管理中枢录入的重点跟进事项"
        >
          <div className="ht-table-wrap">
            <table className="ht-table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>事项内容</th>
                  <th>负责人</th>
                  <th>截止日期</th>
                  <th>推进状态</th>
                </tr>
              </thead>
              <tbody>
                {model.actions.items.map((item, idx) => {
                  const isObj = typeof item === 'object' && item !== null;
                  const title = isObj ? (item.title || item.text || item.description || '') : String(item);
                  const owner = isObj ? (item.owner || '—') : '—';
                  const deadline = isObj ? (item.dueDate || '—') : '—';
                  const status = isObj ? (item.status || '待推进') : '待推进';
                  return (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{title}</td>
                      <td>{owner}</td>
                      <td>{deadline}</td>
                      <td>
                        <span className="ht-badge-tag ht-badge-script">
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartPanel>
      )}

      <div>
        <button
          className="ht-collapse-toggle"
          onClick={() => setCreatorTableOpen((prev) => !prev)}
        >
          <span>10月达人执行明细清单 (共{model.creatorsCount}条明细记录，点击{creatorTableOpen ? '收起' : '展开'})</span>
          <span className="ht-collapse-icon">{creatorTableOpen ? '▲ 收起' : '▼ 展开'}</span>
        </button>

        {creatorTableOpen && (
          <div className="ht-table-wrap">
            <table className="ht-table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>达人昵称</th>
                  <th>账号量级</th>
                  <th>粉丝数(万)</th>
                  <th>内容方向</th>
                  <th>菜品方向</th>
                  <th>报价(元)</th>
                  <th>执行进度</th>
                  <th>预计发布</th>
                  <th>实际发布</th>
                  <th>素材收集</th>
                  <th>笔记ID</th>
                </tr>
              </thead>
              <tbody>
                {model.creators.map((c, i) => (
                  <tr key={i}>
                    <td>{c.index ?? i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{c.kol_name}</td>
                    <td>{c.account_tier}</td>
                    <td>{c.fans_w ? `${c.fans_w}w` : '—'}</td>
                    <td>{c.content_direction || '—'}</td>
                    <td>{c.dish_type || '—'}</td>
                    <td>{c.price_with_fee ? formatCurrency(c.price_with_fee, 0) : (c.price_raw ? formatCurrency(c.price_raw, 0) : '—')}</td>
                    <td>
                      <span className={`ht-badge-tag ${
                        c.execution_status === '已发布' ? 'ht-badge-published' :
                        c.execution_status === '拍摄中' ? 'ht-badge-shooting' :
                        c.execution_status === '确认脚本' ? 'ht-badge-script' : 'ht-badge-review'
                      }`}>
                        {c.execution_status}
                      </span>
                    </td>
                    <td>{c.scheduled_date || '—'}</td>
                    <td>{c.actual_publish_date || c.source_date_text || '—'}</td>
                    <td>
                      <span className={`ht-badge-tag ${c.asset_collected === true ? 'ht-badge-collected' : 'ht-badge-uncollected'}`}>
                        {c.asset_collected === true ? '已收集' : '未登记'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.note_id || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <button
          className="ht-collapse-toggle"
          onClick={() => setKosTableOpen((prev) => !prev)}
        >
          <span>10月KOS笔记发布明细清单 (共{model.kosCount}条明细记录，点击{kosTableOpen ? '收起' : '展开'})</span>
          <span className="ht-collapse-icon">{kosTableOpen ? '▲ 收起' : '▼ 展开'}</span>
        </button>

        {kosTableOpen && (
          <div className="ht-table-wrap">
            <table className="ht-table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>账号名称</th>
                  <th>账号量级</th>
                  <th>内容类型</th>
                  <th>发布日期</th>
                  <th>笔记ID</th>
                  <th>FS联动</th>
                  <th>CID联动</th>
                  <th>商销联动</th>
                </tr>
              </thead>
              <tbody>
                {model.kosNotes.map((k, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{k.account_name}</td>
                    <td>{k.account_tier}</td>
                    <td>{k.content_type}</td>
                    <td>{k.publish_date || k.source_date_text || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{k.note_id || '—'}</td>
                    <td>{k.fs_active === true ? '是' : '—'}</td>
                    <td>{k.cid_active === true ? '是' : '—'}</td>
                    <td>{k.commerce_active === true ? '是' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
