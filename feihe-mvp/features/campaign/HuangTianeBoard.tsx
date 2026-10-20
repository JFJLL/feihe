'use client';

import React, { useMemo, useState } from 'react';
import type { CampaignDashboard } from '../../lib/campaign-types';
import {
  ChartPanel,
  MetricStrip,
  BudgetComparisonChart,
  DonutChart,
  CAMPAIGN_PALETTE,
  type ChartDatum,
  type ComparisonDatum,
  type MetricStripItem,
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
        label: '品牌FS累计消耗',
        value: model.brandSpend !== null ? formatCurrency(model.brandSpend) : '—',
        hint: `统计周期：${model.brandPeriod}`,
        status: 'neutral',
      },
      {
        label: '红猫CID成交GMV',
        value: model.cidTotalGmv !== null ? formatCurrency(model.cidTotalGmv) : '—',
        hint: `消耗 ${formatCurrency(model.cidTotalSpend)} · ROI ${model.cidOverallRoi !== null ? model.cidOverallRoi.toFixed(2) : '—'}倍`,
        status: 'neutral',
      },
      {
        label: '达人执行完成度',
        value: `${model.creatorsPublished} / ${model.creatorsCount}`,
        hint: `已发布占比 ${model.creatorsPublishRate !== null ? formatPercent(model.creatorsPublishRate, 1) : '—'}`,
        status: 'neutral',
      },
      {
        label: 'KOS笔记发布总量',
        value: `${model.kosCount} 篇`,
        hint: '已登记发布明细',
        status: 'neutral',
      },
    ];
  }, [model]);

  const statusSummary = useMemo(() => {
    return model.creatorStatusBreakdown.map((s) => `${s.status} ${s.count} 篇`).join('、');
  }, [model.creatorStatusBreakdown]);

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

    const brandSeedingSeries: ComboSeries[] = [
      { key: 'seed_i', label: '种草I', unit: '人', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'seed_ti', label: '种草TI', unit: '人', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.purple },
      { key: 'cpi', label: 'CPI成本', unit: '元/人', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.gold },
      { key: 'cpti', label: 'CPTI成本', unit: '元/人', axis: 'right', kind: 'point', color: CAMPAIGN_PALETTE.terracotta },
    ];

    const brandClicksPlaysSeries: ComboSeries[] = [
      { key: 'clicks', label: '点击量', unit: '次', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'plays_5s', label: '5秒播放量', unit: '次', axis: 'left', kind: 'line', color: CAMPAIGN_PALETTE.purple },
      { key: 'ctr', label: '点击率', unit: '%', axis: 'right', kind: 'point', color: CAMPAIGN_PALETTE.gold },
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

    const contentDirectionSeries: ComboSeries[] = [
      { key: 'total', label: '计划总篇数', unit: '篇', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'published', label: '已发布篇数', unit: '篇', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.purple },
    ];

    return (
      <div className="ht-board" data-testid="huang-tiane-overview">
        <div className="ht-header">
          <div className="ht-header-left">
            <h2 className="ht-header-title">黄天鹅 · 战役全景与经营洞察</h2>
            <span className="ht-header-badge">多渠道核心数据</span>
          </div>
          <div className="ht-header-meta">
            品牌与CID周期：{model.brandPeriod} · 商销周期：{model.commercePeriod}
          </div>
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
          </ChartPanel>

          <ChartPanel
            title="达人执行三阶段进度"
            subtitle={`定档 ${model.creatorsCount} 位 · 发布 ${model.creatorsPublished} 篇 · 素材收集 ${model.creatorsAssetCollected} 篇`}
          >
            <div className="ht-tri-stage-card">
              <div className="ht-stage-row">
                <div className="ht-stage-header">
                  <span className="ht-stage-name">① 选号定档阶段</span>
                  <span className="ht-stage-counts">{model.creatorsCount} / {model.creatorsCount} (100.0%)</span>
                </div>
                <div className="ht-stage-track">
                  <div className="ht-stage-fill ht-stage-fill-1" style={{ width: '100%' }} />
                </div>
              </div>

              <div className="ht-stage-row">
                <div className="ht-stage-header">
                  <span className="ht-stage-name">② 笔记正式发布</span>
                  <span className="ht-stage-counts">{model.creatorsPublished} / {model.creatorsCount} ({formatPercent(model.creatorsPublishRate, 1)})</span>
                </div>
                <div className="ht-stage-track">
                  <div className="ht-stage-fill ht-stage-fill-2" style={{ width: `${model.creatorsPublishRate || 0}%` }} />
                </div>
              </div>

              <div className="ht-stage-row">
                <div className="ht-stage-header">
                  <span className="ht-stage-name">③ 授权素材回流登记</span>
                  <span className="ht-stage-counts">{model.creatorsAssetCollected} / {model.creatorsCount} ({formatPercent(model.creatorsAssetRate, 1)})</span>
                </div>
                <div className="ht-stage-track">
                  <div className="ht-stage-fill ht-stage-fill-3" style={{ width: `${model.creatorsAssetRate || 0}%` }} />
                </div>
              </div>
            </div>
            {statusSummary && (
              <div className="ht-notice" style={{ marginTop: 10 }}>
                *{statusSummary}
              </div>
            )}
          </ChartPanel>

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
            title="品牌FS 种草人群资产沉淀与成本"
            subtitle={
              model.brandSummary
                ? `种草I ${formatNum(parseNum(model.brandSummary.seed_i), 0)} 人 (CPI ${formatCurrency(parseNum(model.brandSummary.cpi))}) · 种草TI ${formatNum(parseNum(model.brandSummary.seed_ti), 0)} 人 (CPTI ${formatCurrency(parseNum(model.brandSummary.cpti))})`
                : undefined
            }
          >
            <CampaignComboChart
              rows={model.brandDaily}
              series={brandSeedingSeries}
              xKey="date"
              title="品牌FS种草I与种草TI走势"
              height={260}
            />
          </ChartPanel>

          <ChartPanel
            title="品牌FS 点击量与5秒播放量走势"
            subtitle={
              model.brandSummary
                ? `点击 ${formatNum(parseNum(model.brandSummary.clicks), 0)} 次 (CTR ${formatPercent(parseNum(model.brandSummary.ctr))} · CPC ${formatCurrency(parseNum(model.brandSummary.cpc))}) · 5秒播放 ${formatNum(parseNum(model.brandSummary.plays_5s), 0)} 次 (播放率 ${formatPercent(parseNum(model.brandSummary.ctr_5s))})`
                : undefined
            }
          >
            <CampaignComboChart
              rows={model.brandDaily}
              series={brandClicksPlaysSeries}
              xKey="date"
              title="品牌FS点击与5秒播放走势"
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

          <ChartPanel
            title="达人层级分布与含平台费报价"
            subtitle={`共 ${model.creatorsCount} 位达人，涵盖 ${model.creatorTierBreakdown.length} 个账号量级`}
          >
            <CampaignComboChart
              rows={model.creatorTierBreakdown as unknown as Record<string, unknown>[]}
              series={creatorTierSeries}
              xKey="tier"
              title="达人层级人数与费用"
              height={260}
            />
          </ChartPanel>

          <ChartPanel
            title="内容方向选题与发布进展"
            subtitle={`已登记 ${model.creatorDirectionBreakdown.length} 个内容方向，已发布 ${model.creatorsPublished} 篇`}
          >
            <CampaignComboChart
              rows={model.creatorDirectionBreakdown as unknown as Record<string, unknown>[]}
              series={contentDirectionSeries}
              xKey="direction"
              title="内容方向计划与发布"
              height={260}
            />
          </ChartPanel>
        </div>
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
