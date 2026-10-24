'use client';

import React, { useMemo, useState } from 'react';
import type { CampaignDashboard } from '../../lib/campaign-types';
import { CustomSelect } from '../../components/ui/CustomSelect';
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
  formatWan,
  formatCurrency,
  formatPercent,
  parseNum,
} from './huang-model';
import './huang-tiane.css';
import { HuangAudienceInsights } from './HuangAudienceInsights';

/* ==========================================================================
   Subcomponents: Enterprise BI v5 Diverse Visualizations
   ========================================================================== */

interface ArenaMetricRow {
  label: string;
  valA: number | null;
  valB: number | null;
  formatA?: string;
  formatB?: string;
  unit?: string;
  betterWhen?: 'higher' | 'lower';
}

interface DualArenaCardProps {
  title: string;
  subtitle?: string;
  sideA: {
    name: string;
    spend: number | null;
    spendRatio?: number | null;
  };
  sideB: {
    name: string;
    spend: number | null;
    spendRatio?: number | null;
  };
  rows: ArenaMetricRow[];
}

function DualArenaCard({ title, subtitle, sideA, sideB, rows }: DualArenaCardProps) {
  const isFiniteNonNeg = (v: number | null | undefined): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0;

  const hasSpendA = isFiniteNonNeg(sideA.spend);
  const hasSpendB = isFiniteNonNeg(sideB.spend);

  const hasRatioParamA = typeof sideA.spendRatio === 'number' && Number.isFinite(sideA.spendRatio);
  const hasRatioParamB = typeof sideB.spendRatio === 'number' && Number.isFinite(sideB.spendRatio);
  const hasAnyRatioParam = sideA.spendRatio !== undefined || sideB.spendRatio !== undefined;

  let ratioA: number | null = null;
  let ratioB: number | null = null;
  let canDrawTrack = false;
  let fallbackMessage = '暂无可比较消耗';

  if (hasAnyRatioParam) {
    // 保留来源原数字
    ratioA = hasRatioParamA ? sideA.spendRatio! : null;
    ratioB = hasRatioParamB ? sideB.spendRatio! : null;

    // 仅两者 [0,100] 且合计约 100 (允许四舍五入 0.1 误差) 才画双份额条
    const isValidRangeA = hasRatioParamA && sideA.spendRatio! >= 0 && sideA.spendRatio! <= 100;
    const isValidRangeB = hasRatioParamB && sideB.spendRatio! >= 0 && sideB.spendRatio! <= 100;
    const sumRatios = (hasRatioParamA ? sideA.spendRatio! : 0) + (hasRatioParamB ? sideB.spendRatio! : 0);
    const isSumNear100 = Math.abs(sumRatios - 100) <= 0.15;

    if (isValidRangeA && isValidRangeB && isSumNear100) {
      canDrawTrack = true;
    } else {
      canDrawTrack = false;
      fallbackMessage = '份额口径需核对';
    }
  } else if (hasSpendA && hasSpendB && (sideA.spend! + sideB.spend! > 0)) {
    const totSpend = sideA.spend! + sideB.spend!;
    ratioA = (sideA.spend! / totSpend) * 100;
    ratioB = (sideB.spend! / totSpend) * 100;
    canDrawTrack = true;
  }

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <div className="ht-dual-arena">
        <div className="ht-arena-header">
          <div className="ht-arena-side left">
            <span className="ht-arena-dot left" />
            <span className="ht-arena-name">{sideA.name}</span>
            <span className="ht-arena-spend">{hasSpendA ? formatCurrency(sideA.spend) : '—'}</span>
            <span className="ht-arena-ratio-tag left">{ratioA !== null ? `${ratioA.toFixed(1)}%` : '—'}</span>
          </div>
          <div className="ht-arena-vs">VS</div>
          <div className="ht-arena-side right">
            <span className="ht-arena-ratio-tag right">{ratioB !== null ? `${ratioB.toFixed(1)}%` : '—'}</span>
            <span className="ht-arena-spend">{hasSpendB ? formatCurrency(sideB.spend) : '—'}</span>
            <span className="ht-arena-name">{sideB.name}</span>
            <span className="ht-arena-dot right" />
          </div>
        </div>

        {canDrawTrack && ratioA !== null && ratioB !== null ? (
        <div className="ht-arena-track" role="progressbar" aria-valuenow={ratioA} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="ht-arena-bar left"
            style={{ width: `${ratioA}%` }}
            title={`${sideA.name}: ${ratioA.toFixed(1)}%`}
          />
          <div className="ht-arena-divider" />
          <div
            className="ht-arena-bar right"
            style={{ width: `${ratioB}%` }}
            title={`${sideB.name}: ${ratioB.toFixed(1)}%`}
          />
        </div>
        ) : (
          <div className="ht-arena-empty">{fallbackMessage}</div>
        )}

        <div className="ht-arena-rows">
          {rows.map((row, idx) => {
            const vA = row.valA;
            const vB = row.valB;
            const hasAVal = vA !== null && Number.isFinite(vA);
            const hasBVal = vB !== null && Number.isFinite(vB);
            let isABetter = false;
            let isBBetter = false;
            if (hasAVal && hasBVal && vA !== vB && row.betterWhen) {
              if (row.betterWhen === 'higher') {
                isABetter = vA! > vB!;
                isBBetter = vB! > vA!;
              } else if (row.betterWhen === 'lower') {
                isABetter = vA! < vB!;
                isBBetter = vB! < vA!;
              }
            }

            const valA = hasAVal && vA! >= 0 ? vA! : 0;
            const valB = hasBVal && vB! >= 0 ? vB! : 0;
            const sumVal = valA + valB;
            const barA = sumVal > 0 && valA > 0 ? (valA / sumVal) * 100 : 0;
            const barB = sumVal > 0 && valB > 0 ? (valB / sumVal) * 100 : 0;

            return (
              <div key={idx} className="ht-arena-row">
                <div className={`ht-arena-cell left ${isABetter ? 'winner' : ''}`}>
                  {isABetter && <span className="ht-advantage-badge">优势</span>}
                  <span className="ht-arena-val">{row.formatA ?? (hasAVal ? formatNum(vA!, 1) : '—')}</span>
                  <div className="ht-arena-micro-track left">
                    <div
                      className="ht-arena-micro-fill left"
                      style={{ width: `${Math.min(100, barA)}%` }}
                    />
                  </div>
                </div>

                <div className="ht-arena-mid-label">
                  <span>{row.label}</span>
                </div>

                <div className={`ht-arena-cell right ${isBBetter ? 'winner' : ''}`}>
                  <div className="ht-arena-micro-track right">
                    <div
                      className="ht-arena-micro-fill right"
                      style={{ width: `${Math.min(100, barB)}%` }}
                    />
                  </div>
                  <span className="ht-arena-val">{row.formatB ?? (hasBVal ? formatNum(vB!, 1) : '—')}</span>
                  {isBBetter && <span className="ht-advantage-badge">优势</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ChartPanel>
  );
}

interface LollipopRow {
  rank: number;
  label: string;
  spend: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
}

interface LollipopListProps {
  title: string;
  subtitle?: string;
  rows: LollipopRow[];
  maxSpend?: number;
}

function LollipopList({ title, subtitle, rows, maxSpend }: LollipopListProps) {
  const computedMaxSpend =
    maxSpend ||
    Math.max(
      ...rows.map((r) => r.spend || 0),
      1
    );

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <div className="ht-lollipop-list">
        {rows.map((row) => {
          const ratio = row.spend && row.spend > 0 ? Math.min(100, (row.spend / computedMaxSpend) * 100) : 0;
          const isTop3 = row.rank <= 3;
          return (
            <div key={row.rank} className="ht-lollipop-item">
              <span className={`ht-lollipop-rank ${isTop3 ? 'top' : ''}`}>
                {String(row.rank).padStart(2, '0')}
              </span>
              <span className="ht-lollipop-name" title={row.label}>
                {row.label}
              </span>

              <div className="ht-lollipop-bar-wrap">
                <div className="ht-lollipop-track">
                  <div className="ht-lollipop-fill" style={{ width: `${ratio}%` }}>
                    <span className="ht-lollipop-head" />
                  </div>
                </div>
              </div>

              <div className="ht-lollipop-metrics">
                <span className="ht-lollipop-spend">
                  {row.spend !== null ? formatCurrency(row.spend) : '—'}
                </span>
                <span className="ht-lollipop-capsule clicks">
                  {row.clicks !== null ? `${formatNum(row.clicks, 0)} 点击` : '—'}
                </span>
                <span className="ht-lollipop-capsule ctr">
                  {row.ctr !== null ? `CTR ${formatPercent(row.ctr, 2)}` : '—'}
                </span>
                <span className="ht-lollipop-capsule cpc">
                  {row.cpc !== null ? `CPC ${formatCurrency(row.cpc)}` : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </ChartPanel>
  );
}

interface ButterflyRow {
  label: string;
  spend: number | null;
  middleInfo?: string;
  costVal: number | null;
  costLabel: string;
  costUnit?: string;
  subCostVal?: number | null;
  subCostLabel?: string;
}

interface ButterflyCardProps {
  title: string;
  subtitle?: string;
  rows: ButterflyRow[];
  maxSpend?: number;
}

function ButterflyCard({ title, subtitle, rows, maxSpend }: ButterflyCardProps) {
  const computedMaxSpend =
    maxSpend ||
    Math.max(
      ...rows.map((r) => r.spend || 0),
      1
    );

  return (
    <ChartPanel title={title} subtitle={subtitle}>
      <div className="ht-butterfly-card">
        <div className="ht-butterfly-header">
          <span className="col-left">投放规模与消耗</span>
          <span className="col-mid">转化基础</span>
          <span className="col-right">单位成本对比</span>
        </div>

        <div className="ht-butterfly-body">
          {rows.map((r, idx) => {
            const barWidth = r.spend !== null && Number.isFinite(r.spend) && r.spend > 0 ? Math.min(100, (r.spend / computedMaxSpend) * 100) : 0;
            const cost = r.costVal;

            return (
              <div key={idx} className="ht-butterfly-row">
                <div className="ht-butterfly-left">
                  <span className="ht-butterfly-row-label" title={r.label}>
                    {r.label}
                  </span>
                  <div className="ht-butterfly-bar-container">
                    <div className="ht-butterfly-bar" style={{ width: `${barWidth}%` }} />
                    <span className="ht-butterfly-spend-val">
                      {r.spend !== null ? formatCurrency(r.spend) : '—'}
                    </span>
                  </div>
                </div>

                <div className="ht-butterfly-mid">
                  <span>{r.middleInfo || '—'}</span>
                </div>

                <div className="ht-butterfly-right">
                  <div className="ht-butterfly-cost-badge neutral">
                    <span className="cost-name">{r.costLabel}</span>
                    <span className="cost-num">
                      {cost !== null ? (r.costUnit === '%' ? formatPercent(cost, 2) : formatCurrency(cost)) : '—'}
                    </span>
                  </div>
                  {r.subCostVal !== null && r.subCostVal !== undefined && (
                    <span className="ht-butterfly-subcost">
                      {r.subCostLabel}: {formatCurrency(r.subCostVal)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ChartPanel>
  );
}

interface RegionRankGridProps {
  title: string;
  subtitle?: string;
  provinces: Record<string, unknown>[];
  totalSpend: number | null;
  expanded: boolean;
  onToggleExpand: () => void;
}

function RegionRankGrid({
  title,
  subtitle,
  provinces,
  expanded,
  onToggleExpand,
}: RegionRankGridProps) {
  const top10 = provinces.slice(0, 10);
  const maxSpend = top10.length > 0 ? (parseNum(top10[0].spend) || 1) : 1;

  return (
    <ChartPanel
      title={title}
      subtitle={subtitle}
      actions={
        provinces.length > 10 ? (
          <button type="button" className="ht-scope-tab-btn" onClick={onToggleExpand}>
            {expanded ? '收起至Top10' : `展开全量(${provinces.length})`}
          </button>
        ) : undefined
      }
    >
      <div className="ht-region-container">
        <div className="ht-region-rank-grid">
          {top10.map((p, idx) => {
            const rank = idx + 1;
            const provName = String(p.province || '—');
            const spend = parseNum(p.spend);
            const ratio = spend && spend > 0 ? Math.min(100, (spend / maxSpend) * 100) : 0;
            const engagements = parseNum(p.engagements);
            const cpe = parseNum(p.cpe);
            const ctr = parseNum(p.ctr);

            return (
              <div key={provName} className="ht-region-card">
                <div className="ht-region-card-top">
                  <div className="ht-region-info">
                    <span
                      className={`ht-region-badge ${
                        rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'neutral'
                      }`}
                    >
                      {String(rank).padStart(2, '0')}
                    </span>
                    <span className="ht-region-name">{provName}</span>
                  </div>
                  <span className="ht-region-spend">{spend !== null ? formatCurrency(spend) : '—'}</span>
                </div>

                <div className="ht-region-bar-track">
                  <div
                    className={`ht-region-bar-fill ${rank <= 3 ? 'top' : ''}`}
                    style={{ width: `${ratio}%` }}
                  />
                </div>

                <div className="ht-region-card-bottom">
                  <span className="ht-region-tag eng">
                    {engagements !== null ? `${formatNum(engagements, 0)} 互动` : '—'}
                  </span>
                  <span className="ht-region-tag cpe">
                    {cpe !== null ? `CPE ${formatCurrency(cpe)}` : '—'}
                  </span>
                  <span className="ht-region-tag ctr">
                    {ctr !== null ? `CTR ${formatPercent(ctr, 2)}` : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {expanded && (
          <div className="ht-table-wrap" style={{ marginTop: 14 }}>
            <table className="ht-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>省份 / 地区</th>
                  <th>消耗金额</th>
                  <th>展现量</th>
                  <th>点击量</th>
                  <th>点击率 CTR</th>
                  <th>点击成本 CPC</th>
                  <th>千次展现 CPM</th>
                  <th>互动量</th>
                  <th>互动成本 CPE</th>
                </tr>
              </thead>
              <tbody>
                {provinces.map((p, i) => (
                  <tr key={String(p.province || i)}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{String(p.province || '—')}</td>
                    <td>{formatCurrency(parseNum(p.spend))}</td>
                    <td>{formatNum(parseNum(p.impressions), 0)}</td>
                    <td>{formatNum(parseNum(p.clicks), 0)}</td>
                    <td>{formatPercent(parseNum(p.ctr), 2)}</td>
                    <td>{formatCurrency(parseNum(p.cpc))}</td>
                    <td>{formatCurrency(parseNum(p.cpm))}</td>
                    <td>{formatNum(parseNum(p.engagements), 0)}</td>
                    <td>{formatCurrency(parseNum(p.cpe))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ChartPanel>
  );
}

export interface HuangTianeBoardProps {
  dashboard: CampaignDashboard;
  section?: 'overview' | 'ads' | 'content';
}

export function HuangTianeBoard({ dashboard, section = 'overview' }: HuangTianeBoardProps) {
  const model = useMemo(() => extractHuangTianeData(dashboard), [dashboard]);
  const [adsScope, setAdsScope] = useState<'brand' | 'cid' | 'commerce'>('brand');
  const [focusedChapter, setFocusedChapter] = useState<string | null>(null);
  const [creatorTableOpen, setCreatorTableOpen] = useState<boolean>(false);
  const [kosTableOpen, setKosTableOpen] = useState<boolean>(false);
  const [showAllAudiences, setShowAllAudiences] = useState<boolean>(false);
  const [showAllProvinces, setShowAllProvinces] = useState<boolean>(false);
  const [showAllCreatives, setShowAllCreatives] = useState<boolean>(false);
  const [selectedBenchmarkMetric, setSelectedBenchmarkMetric] = useState<'CTR' | 'CPC' | 'CPM' | 'CPE' | 'CPI' | 'CPTI'>('CTR');

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (typeof document !== 'undefined') {
      const el = document.getElementById(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const topMetricItems: MetricStripItem[] = useMemo(() => {
    return [
      {
        label: '品牌FS消耗 / 预算进度',
        value: model.brandSpend !== null ? formatCurrency(model.brandSpend) : '—',
        hint: `预算 ${formatCurrency(model.brandBudgetVal)} / 进度 ${formatPercent(model.brandBudgetProgress, 1)}`,
        badge: '品牌FS种草线',
        status: 'accent',
      },
      {
        label: '种草I/TI人群 / CPTI',
        value: `${formatNum(parseNum(model.brandSummary?.seed_total), 0)} 人`,
        hint: `TI心智 ${formatNum(parseNum(model.brandSummary?.seed_ti), 0)} 人 / CPTI ${formatCurrency(parseNum(model.brandSummary?.cpti))}`,
        badge: '品牌FS种草线',
        status: 'success',
      },
      {
        label: '红猫CID全域消耗',
        value: model.cidTotalSpend !== null ? formatCurrency(model.cidTotalSpend) : '—',
        hint: `标准投 ${formatCurrency(model.cidStandardSpend)} / 简单投 ${formatCurrency(model.cidSimpleSpend)}`,
        badge: '红猫CID引流线',
        status: 'accent',
      },
      {
        label: '红猫CID成交GMV / ROI',
        value: model.cidTotalGmv !== null ? formatCurrency(model.cidTotalGmv) : '—',
        hint: `标准投 ROI ${model.cidStandardRoi?.toFixed(2) ?? '—'} / 简单投 ROI ${model.cidSimpleRoi?.toFixed(2) ?? '—'}`,
        badge: '红猫CID引流线',
        status: 'accent',
      },
      {
        label: '闭环商销累计消耗',
        value: model.commerceSpend !== null ? formatCurrency(model.commerceSpend) : '—',
        hint: `统计周期：${model.commercePeriod}`,
        badge: '闭环商销成交线',
        status: 'warning',
      },
      {
        label: '商销成交GMV / 订单',
        value: model.commerceGmv !== null ? formatCurrency(model.commerceGmv) : '—',
        hint: `订单 ${formatNum(model.commerceOrders, 0)} 单 / 加购 ${formatNum(model.commerceCart, 0)} 次`,
        badge: '闭环商销成交线',
        status: 'accent',
      },
      {
        label: '达人选号定档 / 发布率',
        value: `${model.creatorsPublished} / ${model.creatorsCount} 位`,
        hint: `已发布 ${formatPercent(model.creatorsPublishRate, 1)} / 素材收集 ${model.creatorsAssetCollected} 篇`,
        badge: '达人与KOS矩阵',
        status: 'success',
      },
      {
        label: 'KOS笔记矩阵发布量',
        value: `${model.kosCount} 篇`,
        hint: '以KOS执行表登记为准，不推定已投流或已成交',
        badge: '达人与KOS矩阵',
        status: 'default',
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

    // Funnel 1: Brand FS Seeding Funnel (Fact-derived from bs)
    const brandFunnelStages: FunnelStageDatum[] = bs
      ? [
          { stage: '① 品牌曝光展现', value: parseNum(bs.impressions), unit: '次', conversionLabel: '100.0%', color: CAMPAIGN_PALETTE.primary },
          { stage: '② 笔记有效点击', value: parseNum(bs.clicks), unit: '次', conversionLabel: `CTR ${formatPercent(parseNum(bs.ctr))}`, costLabel: `CPC ${formatCurrency(parseNum(bs.cpc))}`, color: '#0d9b8a' },
          { stage: '③ 5秒有效播放', value: parseNum(bs.plays_5s ?? bs.plays5s), unit: '次', conversionLabel: `播放率 ${formatPercent(parseNum(bs.ctr_5s ?? bs.ctr5s))}`, costLabel: `5s成本 ${formatCurrency(parseNum(bs.cpc_5s ?? bs.cpc5s))}`, color: CAMPAIGN_PALETTE.slate },
          { stage: '④ 深度受众互动', value: parseNum(bs.engagements), unit: '次', conversionLabel: `互动量 ${formatNum(parseNum(bs.engagements), 0)}`, costLabel: `CPE ${formatCurrency(parseNum(bs.cpe))}`, color: CAMPAIGN_PALETTE.purple },
          { stage: '⑤ 核心种草人群资产', value: parseNum(bs.seed_total), unit: '人', conversionLabel: `I ${formatWan(parseNum(bs.seed_i))} + TI ${formatWan(parseNum(bs.seed_ti))}`, costLabel: `单位成本 ${formatCurrency(parseNum(bs.cp_total))}`, color: CAMPAIGN_PALETTE.terracotta },
        ]
      : [];

    // Funnel 2: Red Cat CID E-Commerce Funnel (Strict facts: Shop UV -> Orders -> GMV, no fabricated impressions/clicks)
    const cidCpuv = (model.cidTotalSpend !== null && model.cidTotalUv !== null && model.cidTotalUv > 0)
      ? (model.cidTotalSpend / model.cidTotalUv).toFixed(2)
      : '—';
    const cidOrderRate = (model.cidTotalOrders !== null && model.cidTotalUv !== null && model.cidTotalUv > 0)
      ? ((model.cidTotalOrders / model.cidTotalUv) * 100).toFixed(1) + '%'
      : '—';
    const cidCostPerOrder = (model.cidTotalSpend !== null && model.cidTotalOrders !== null && model.cidTotalOrders > 0)
      ? (model.cidTotalSpend / model.cidTotalOrders).toFixed(2)
      : '—';
    const cidAov = (model.cidTotalGmv !== null && model.cidTotalOrders !== null && model.cidTotalOrders > 0)
      ? (model.cidTotalGmv / model.cidTotalOrders).toFixed(2)
      : '—';

    const cidFunnelStages: FunnelStageDatum[] = [
      { stage: '① 淘系店铺进店UV', value: model.cidTotalUv, unit: '人', conversionLabel: '全域引流受众', costLabel: `CPUV ¥${cidCpuv}/人`, color: CAMPAIGN_PALETTE.primary },
      { stage: '② 支付转化成交订单', value: model.cidTotalOrders, unit: '单', conversionLabel: `进店订单率 ${cidOrderRate}`, costLabel: `单均成本 ¥${cidCostPerOrder}`, color: CAMPAIGN_PALETTE.purple },
      { stage: '③ 全域成交金额GMV', value: model.cidTotalGmv !== null ? Math.round(model.cidTotalGmv) : null, unit: '元', conversionLabel: `ROI ${model.cidOverallRoi?.toFixed(2) ?? '—'}倍`, costLabel: `客单价 ¥${cidAov}`, color: CAMPAIGN_PALETTE.terracotta },
    ];

    // Funnel 3: Creator Selection Funnel (Dynamically mapped from model.creatorFunnelStages)
    const creatorColors = [CAMPAIGN_PALETTE.primary, '#0090ff', CAMPAIGN_PALETTE.purple, CAMPAIGN_PALETTE.gold, CAMPAIGN_PALETTE.terracotta, '#29a383'];
    const creatorFunnelChartStages: FunnelStageDatum[] = model.creatorFunnelStages.map((st, idx) => ({
      stage: st.name,
      value: st.value,
      unit: idx >= 5 ? '篇' : '人',
      conversionLabel: st.rate !== null ? `${st.rate}%` : '—',
      subtext: st.note,
      color: creatorColors[idx % creatorColors.length],
    }));

    // Content tags bar chart
    const contentTagsChartData: ChartDatum[] = model.brandContentTagsTop.slice(0, 8).map((r) => ({
      label: String(r.contentTag || ''),
      value: parseNum(r.spend),
      detail: `CTR ${formatPercent(parseNum(r.ctr))} / CPC ${formatCurrency(parseNum(r.cpc))}`,
    }));

    // Keywords bar chart
    const keywordsChartData: ChartDatum[] = model.brandKeywordsTop.slice(0, 8).map((r) => ({
      label: String(r.keywordCategory || ''),
      value: parseNum(r.spend),
      detail: `CTR ${formatPercent(parseNum(r.ctr))} / CPM ${formatCurrency(parseNum(r.cpm))}`,
    }));

    // Top 12 Provinces bar chart
    const provincesChartData: ChartDatum[] = model.brandProvincesTop12.map((r) => ({
      label: String(r.province || ''),
      value: parseNum(r.spend),
      detail: `互动 ${formatNum(parseNum(r.engagements), 0)} 次 / CPE ${formatCurrency(parseNum(r.cpe))}`,
    }));

    // Gender x Age Heatmap Cells
    const heatmapCells: MatrixHeatmapCell[] = model.genderAgeMatrix.cells.map((c) => ({
      row: c.ageGroup,
      col: c.gender,
      value: c.spend,
      displayValue: formatCurrency(c.spend, 0),
      subtext: `互动 ${formatNum(c.engagements, 0)}次 / CPE ${formatCurrency(c.cpe)}`,
    }));

    // Gender Donut
    const genderDonutData: ChartDatum[] = model.brandGenderTable.rows
      .filter(row => row.gender && !/合计|总计|汇总/.test(String(row.gender)))
      .map(row => ({ label: `${String(row.gender)}受众`, value: parseNum(row.spend) }));

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
        {/* 吸顶章节导航与周期控制台 (一体化指挥舱) */}
        <div className="ht-header ht-section-jumpbar ht-command-bar" role="navigation" aria-label="黄天鹅全域章节导航与周期控制台">
          <div className="ht-command-bar-left">
            <div className="ht-command-bar-brand">
            <h2 className="ht-header-title">黄天鹅 战役全域经营洞察</h2>
              <span className="ht-header-badge">全域经营与受众洞察</span>
            </div>
            <span className="ht-jumpbar-label">📊 章节导航</span>
            <div className="ht-jumpbar-links">
              {([
                { id: 'ht-sec-top-kpi', num: '01', label: '全域总览' },
                { id: 'ht-sec-content-audience', num: '02', label: '内容与人群' },
                { id: 'ht-sec-funnels', num: '03', label: '三线转化漏斗' },
                { id: 'ht-sec-tags-keywords', num: '04', label: '标签与词包' },
                { id: 'ht-sec-audiences-keywords', num: '05', label: '热力与达人矩阵' },
              ] as const).map((chap) => {
                const isFocused = focusedChapter === chap.num;
                return (
                  <a
                    key={chap.id}
                    href={`#${chap.id}`}
                    className={`ht-jump-pill ${isFocused ? 'active' : ''}`}
                    onClick={(e) => {
                      handleAnchorClick(e, chap.id);
                      setFocusedChapter((prev) => (prev === chap.num ? null : chap.num));
                    }}
                  >
                    <span className="ht-jump-num">{chap.num}</span>
                    <span>{chap.label}</span>
                  </a>
                );
              })}
              {focusedChapter && (
                <button
                  type="button"
                  className="ht-jump-reset-btn"
                  onClick={() => setFocusedChapter(null)}
                  title="重置章节高亮"
                >
                  全部展开
                </button>
              )}
            </div>
          </div>
          <div className="ht-header-meta">
            <span className="ht-period-pill">品牌/CID {model.brandPeriod}</span>
            <span className="ht-period-pill">商销 {model.commercePeriod}</span>
          </div>
        </div>

        {/* 第一层：全域三线经营总览与蛋品行业基准对标 */}
        <section id="ht-sec-top-kpi" className={`ht-layer ${focusedChapter === '01' ? 'ht-layer-focused' : ''}`}>
          <div className="ht-layer-header">
            <div className="ht-layer-header-left">
              <span className="ht-chapter-num">01</span>
              <h3 className="ht-layer-title">全域三线经营总览与蛋品行业基准对标</h3>
            </div>
            <span className="ht-layer-sub">8项核心全域KPI与蛋品大盘对照</span>
          </div>

          <MetricStrip items={topMetricItems} />

          <div id="ht-sec-budget-benchmarks" className="ht-grid-2">
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
                剩余预算 {formatCurrency(model.brandBudgetVal !== null && model.brandSpend !== null ? model.brandBudgetVal - model.brandSpend : null)} / 消耗进度 {formatPercent(model.brandBudgetProgress, 1)}。是否需要调速还需结合剩余排期判断。
              </div>
            </ChartPanel>

            <ChartPanel
              title="蛋品行业大盘基准与黄天鹅实绩对标"
              subtitle={`对标蛋品行业基准 (生食/有机蛋 vs 新鲜蛋) / 当前指标: ${benchmarkMetric}`}
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
              <div className="ht-benchmark-container">
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
                      {benchmarkMetric === 'CTR' ? '点击率：数值越高越好' : '单位成本：数值越低越好'}
                    </div>
                  </div>
                </div>

                <details className="ht-secondary-details">
                  <summary>展开六项行业指标对照</summary>
                <div className="ht-benchmark-table-wrap">
                  <table className="ht-benchmark-table">
                    <thead>
                      <tr>
                        <th>核心指标</th>
                        <th>生食/有机蛋区间</th>
                        <th>新鲜蛋大盘均值</th>
                        <th>黄天鹅本品实绩</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['CTR', 'CPC', 'CPM', 'CPE', 'CPI', 'CPTI'] as const).map((m) => {
                        const sRow = bRows.find((r) => r.category === '生食/有机蛋' && r.metric === m);
                        const xRow = bRows.find((r) => r.category === '新鲜蛋' && r.metric === m);
                        const u = m === 'CTR' ? '%' : '元';
                        let v: number | null = null;
                        if (bs) {
                          if (m === 'CTR') v = parseNum(bs.ctr);
                          else if (m === 'CPC') v = parseNum(bs.cpc);
                          else if (m === 'CPM') v = parseNum(bs.cpm);
                          else if (m === 'CPE') v = parseNum(bs.cpe);
                          else if (m === 'CPI') v = parseNum(bs.cpi);
                          else if (m === 'CPTI') v = parseNum(bs.cpti);
                        }
                        return (
                          <tr key={m} className={selectedBenchmarkMetric === m ? 'active-row' : ''}>
                            <td style={{ fontWeight: 600 }}>{m}</td>
                            <td>{sRow ? `${sRow.lower} ~ ${sRow.upper} ${u}` : '—'}</td>
                            <td>{xRow ? `${xRow.lower} ~ ${xRow.upper} ${u}` : '—'}</td>
                            <td className="benpin-val">{v !== null ? `${v} ${u}` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </details>
                <div className="ht-notice">
                  *蛋品行业基准来源于小红书蛋品行业大盘实盘透视表（涵盖生食蛋/有机蛋6家头部品牌大盘基准数据）。
                </div>
              </div>
            </ChartPanel>
          </div>
        </section>

        <HuangAudienceInsights model={model} />

        {/* 第三章：三条业务线转化漏斗与趋势 */}
        <section id="ht-sec-funnels" className={`ht-layer ${focusedChapter === '03' ? 'ht-layer-focused' : ''}`}>
          <div className="ht-layer-header">
            <div className="ht-layer-header-left">
              <span className="ht-chapter-num">03</span>
              <h3 className="ht-layer-title">三条业务线 关键节点与趋势</h3>
            </div>
            <span className="ht-layer-sub">三线独立核算，不跨平台拼接转化链路</span>
          </div>

          <div className="ht-grid-2">
            <ChartPanel
              title="品牌FS 种草人群心智沉淀全链路漏斗"
              subtitle={
                bs
                  ? `展现 (${formatWan(parseNum(bs.impressions))}) → 点击 (${formatWan(parseNum(bs.clicks))}) → 5s播放 (${formatWan(parseNum(bs.plays_5s ?? bs.plays5s))}) → 互动 (${formatNum(parseNum(bs.engagements), 0)}次) → 核心资产 (${formatWan(parseNum(bs.seed_total))})`
                  : undefined
              }
            >
              <CampaignFunnelChart stages={brandFunnelStages} />
            </ChartPanel>

            <ChartPanel
              title="红猫CID 电商引流转化与成交全链路漏斗"
              subtitle={`进店UV (${formatNum(model.cidTotalUv, 0)}人) → 支付订单 (${formatNum(model.cidTotalOrders, 0)}单) → 成交GMV (${formatCurrency(model.cidTotalGmv)}) / 全域实绩ROI ${model.cidOverallRoi !== null ? model.cidOverallRoi.toFixed(2) : '—'}倍`}
            >
              <CampaignFunnelChart stages={cidFunnelStages} />
              <div className="ht-notice" style={{ marginTop: 10 }}>
                原表未提供两种投放合计的曝光与点击量，分别展示进店、订单和成交金额，不补造上游节点。
              </div>
            </ChartPanel>
          </div>

          <div className="ht-grid-2">
            <ChartPanel
              title="红猫CID 标准投与简单投效能对比"
              subtitle={`标准投聚合ROI ${model.cidStandardRoi?.toFixed(2) ?? '—'}倍 / 简单投聚合ROI ${model.cidSimpleRoi?.toFixed(2) ?? '—'}倍`}
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

        {/* 第四章：内容标签、搜索词与素材表现 */}
        <details id="ht-sec-tags-keywords" open className={`ht-layer ht-secondary-details ht-layer-details ${focusedChapter === '04' ? 'ht-layer-focused' : ''}`}>
          <summary className="ht-layer-header ht-summary-header">
            <div className="ht-layer-header-left">
              <span className="ht-chapter-num">04</span>
              <h3 className="ht-layer-title">内容标签、搜索词与素材表现</h3>
            </div>
            <span className="ht-layer-sub">12大笔记标签、10大搜索词类与商销Top素材 / 点击折叠</span>
          </summary>
          <div className="ht-grid-2">
            <ChartPanel
              title="品牌线 12大笔记内容标签投放表现"
              subtitle="按内容标签消耗排序；点击率与成本用于辅助判断"
            >
              <HorizontalBarChart data={contentTagsChartData} unit="元" height={280} />
            </ChartPanel>

            <ChartPanel
              title="品牌线 10大搜索词类投放表现"
              subtitle="按搜索词类消耗排序；各词类独立统计"
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
                  detail: `种草I+TI: ${formatNum(parseNum(r.seed_total), 0)}人 / 成本 ${formatCurrency(parseNum(r.cp_total))}`,
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
                  detail: `订单 ${r.orders}单 / ROI ${r.roi ?? '—'} / 展现 ${formatNum(parseNum(r.impressions), 0)}`,
                }))}
                unit="元"
                height={280}
              />
            </ChartPanel>
          </div>
        </details>

        {/* 第五章：受众人口学 24 维热力矩阵与达人/KOS明细 */}
        <section id="ht-sec-audiences-keywords" className={`ht-layer ${focusedChapter === '05' ? 'ht-layer-focused' : ''}`}>
          <div className="ht-layer-header">
            <div className="ht-layer-header-left">
              <span className="ht-chapter-num">05</span>
              <h3 className="ht-layer-title">受众人口学 24 维热力矩阵与达人/KOS明细</h3>
            </div>
            <span className="ht-layer-sub">性别×年龄二维消耗交叉矩阵 / 达人选号与KOS矩阵全貌</span>
          </div>

          <div className="ht-grid-2">
            <ChartPanel
              className="ht-audience-matrix"
              title="年龄 × 性别 / 受众消耗分布"
              subtitle="年龄纵向排列、性别横向对比；颜色表示消耗，不代表购买偏好"
            >
              <MatrixHeatmapChart
                rows={model.genderAgeMatrix.ageGroups}
                cols={model.genderAgeMatrix.genders}
                cells={heatmapCells}
                unit="元"
                rowHeaderTitle="年龄 / 性别"
                showRowTotals={false}
              />
            </ChartPanel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ChartPanel
                title="品牌受众 性别基本盘分布"
                subtitle="按性别投放消耗构成；不是去重人数占比"
              >
                <DonutChart data={genderDonutData} unit="元" centerLabel="性别分布" />
              </ChartPanel>

              <ChartPanel
                title="重点投放省份 (消耗前六)"
                subtitle="按省份消耗排序，地域曝光不等于目标人群渗透"
              >
                <HorizontalBarChart data={provincesChartData.slice(0, 6)} unit="元" height={200} />
              </ChartPanel>
            </div>
          </div>
        </section>

        {/* 达人选号淘汰漏斗、菜品方向与 11 月储备 */}
        <details id="ht-sec-creators-detail" open className="ht-layer ht-secondary-details ht-layer-details">
          <summary className="ht-layer-header ht-summary-header">
            <div className="ht-layer-header-left">
              <span className="ht-chapter-num">05-附</span>
              <h3 className="ht-layer-title">达人执行、内容方向与KOS明细</h3>
            </div>
            <span className="ht-layer-sub">31位达人选号漏斗与65篇KOS发布底表 / 点击折叠</span>
          </summary>
          <div className="ht-grid-2">
            <ChartPanel
              title="10月达人选号全流程淘汰漏斗"
              subtitle="以选号表及执行表为准；阶段人数与发布篇数分开查看"
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
                title="定档达人 内容方向与食谱场景"
                subtitle="基于达人执行底表真实统计 / 场景代入与溏心蛋教程为两大主力方向"
              >
                <div className="ht-table-wrap">
                  <table className="ht-table">
                    <thead>
                      <tr>
                        <th>食谱方向 / 场景</th>
                        <th>计划定档</th>
                        <th>已发布上线</th>
                        <th>上线率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.creatorDirectionBreakdown.slice(0, 6).map((d) => (
                        <tr key={d.direction}>
                          <td style={{ fontWeight: 600 }}>{d.direction}</td>
                          <td>{d.total} 位</td>
                          <td>{d.published} 篇</td>
                          <td>{d.total > 0 ? ((d.published / d.total) * 100).toFixed(1) + '%' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
        </details>
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

    const brandAudienceSeries: ComboSeries[] = [
      { key: 'seed_total', label: '种草人群', unit: '人', axis: 'left', kind: 'bar', color: CAMPAIGN_PALETTE.primary },
      { key: 'cp_total', label: '单位种草成本', unit: '元/人', axis: 'right', kind: 'line', color: CAMPAIGN_PALETTE.gold },
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

    const creativeRows = showAllCreatives
      ? model.commerceCreativesTable.rows
      : model.commerceCreativesTable.rows.slice(0, 10);

    // 1. Current Ads Metric Strip Items
    const currentAdsMetricItems: MetricStripItem[] = [
      ...(adsScope === 'brand'
        ? [
            {
              label: '品牌FS总消耗 / 预算进度',
              value: model.brandSpend !== null ? formatCurrency(model.brandSpend) : '—',
              hint: `预算 ${formatCurrency(model.brandBudgetVal)} / 进度 ${formatPercent(model.brandBudgetProgress, 1)}`,
              badge: '品牌FS种草线',
              status: 'accent' as const,
            },
            {
              label: '品牌FS总展现量 / CPM',
              value: `${formatNum(model.brandDaily.reduce((acc, r) => acc + (parseNum(r.impressions) || 0), 0) || parseNum(model.brandSummary?.impressions), 0)} 次`,
              hint: `千次展现成本 CPM ${formatCurrency(parseNum(model.brandSummary?.cpm))}`,
              badge: '曝光与渗透',
              status: 'default' as const,
            },
            {
              label: '加权点击率与成本 (CTR / CPC)',
              value: `CTR ${formatPercent(parseNum(model.brandSummary?.ctr))} / CPC ${formatCurrency(parseNum(model.brandSummary?.cpc))}`,
              hint: `累计产生点击 ${formatNum(model.brandDaily.reduce((acc, r) => acc + (parseNum(r.clicks) || 0), 0) || parseNum(model.brandSummary?.clicks), 0)} 次`,
              badge: '点击效能',
              status: 'success' as const,
            },
            {
              label: '种草人群资产规模 (I + TI)',
              value: `${formatNum(parseNum(model.brandSummary?.seed_total), 0)} 人`,
              hint: `TI心智 ${formatNum(parseNum(model.brandSummary?.seed_ti), 0)} 人 / CPTI ${formatCurrency(parseNum(model.brandSummary?.cpti))}`,
              badge: '5A人群资产',
              status: 'success' as const,
            },
          ]
        : adsScope === 'cid'
        ? [
            {
              label: '红猫CID全域投流消耗',
              value: model.cidTotalSpend !== null ? formatCurrency(model.cidTotalSpend) : '—',
              hint: `标准投 ${formatCurrency(model.cidStandardSpend)} / 简单投 ${formatCurrency(model.cidSimpleSpend)}`,
              badge: '红猫引流线',
              status: 'accent' as const,
            },
            {
              label: '进店总访客 / CPUV成本',
              value: `${formatNum(model.cidTotalUv, 0)} UV`,
              hint: `综合访客成本 CPUV ${formatCurrency(model.cidTotalSpend && model.cidTotalUv ? model.cidTotalSpend / model.cidTotalUv : null)}`,
              badge: '进店引流',
              status: 'default' as const,
            },
            {
              label: '全域成交订单与GMV',
              value: `${formatNum(model.cidTotalOrders, 0)} 单 / ${formatCurrency(model.cidTotalGmv)}`,
              hint: `标准投 ${formatCurrency(model.cidStandardGmv)} / 简单投 ${formatCurrency(model.cidSimpleGmv)}`,
              badge: '成交规模',
              status: 'success' as const,
            },
            {
              label: '聚合引流成交 ROI',
              value: `${model.cidOverallRoi?.toFixed(2) ?? '—'} 倍`,
              hint: `标准投 ROI ${model.cidStandardRoi?.toFixed(2) ?? '—'} / 简单投 ROI ${model.cidSimpleRoi?.toFixed(2) ?? '—'}`,
              badge: '投资回报',
              status: 'success' as const,
            },
          ]
        : [
            {
              label: '闭环商销累计消耗',
              value: model.commerceSpend !== null ? formatCurrency(model.commerceSpend) : '—',
              hint: `观察周期：${model.commercePeriod}`,
              badge: '闭环商销',
              status: 'accent' as const,
            },
            {
              label: '商销全周期成交GMV',
              value: model.commerceGmv !== null ? formatCurrency(model.commerceGmv) : '—',
              hint: '底表对账汇总GMV ¥28,023.72',
              badge: '闭环成交',
              status: 'success' as const,
            },
            {
              label: '商销整体成交 ROI',
              value: model.commerceRoi !== null ? `${model.commerceRoi.toFixed(2)} 倍` : '—',
              hint: '带货转化回报水平',
              badge: '经营效能',
              status: 'warning' as const,
            },
            {
              label: '成交支付订单 / 加购量',
              value: `${formatNum(model.commerceOrders, 0)} 单`,
              hint: `商品加购量 ${formatNum(model.commerceCart, 0)} 次`,
              badge: '转化规模',
              status: 'default' as const,
            },
          ]),
    ];

    // 2. Data Mappings for New Visuals
    // 2a. Brand Ad Types Arena
    const adTypeRows = model.brandAdTypesTable.rows;
    const feedRow = adTypeRows.find((r) => String(r.adType || '').includes('信息流')) || adTypeRows[0] || {};
    const searchRow = adTypeRows.find((r) => String(r.adType || '').includes('搜索')) || adTypeRows[1] || {};
    const feedSpend = parseNum(feedRow.spend);
    const searchSpend = parseNum(searchRow.spend);
    const feedRatio = parseNum(feedRow.spendRatio);
    const searchRatio = parseNum(searchRow.spendRatio);

    const brandAdTypeArenaRows: ArenaMetricRow[] = [
      {
        label: '展现量 (曝光规模)',
        valA: parseNum(feedRow.impressions),
        valB: parseNum(searchRow.impressions),
        formatA: `${formatNum(parseNum(feedRow.impressions), 0)} 次`,
        formatB: `${formatNum(parseNum(searchRow.impressions), 0)} 次`,
      },
      {
        label: '点击量 (总引流)',
        valA: parseNum(feedRow.clicks),
        valB: parseNum(searchRow.clicks),
        formatA: `${formatNum(parseNum(feedRow.clicks), 0)} 次`,
        formatB: `${formatNum(parseNum(searchRow.clicks), 0)} 次`,
      },
      {
        label: '点击率 CTR',
        valA: parseNum(feedRow.ctr),
        valB: parseNum(searchRow.ctr),
        formatA: formatPercent(parseNum(feedRow.ctr), 2),
        formatB: formatPercent(parseNum(searchRow.ctr), 2),
        betterWhen: 'higher',
      },
      {
        label: '点击成本 CPC',
        valA: parseNum(feedRow.cpc),
        valB: parseNum(searchRow.cpc),
        formatA: formatCurrency(parseNum(feedRow.cpc)),
        formatB: formatCurrency(parseNum(searchRow.cpc)),
        betterWhen: 'lower',
      },
      {
        label: '千次展现 CPM',
        valA: parseNum(feedRow.cpm),
        valB: parseNum(searchRow.cpm),
        formatA: formatCurrency(parseNum(feedRow.cpm)),
        formatB: formatCurrency(parseNum(searchRow.cpm)),
        betterWhen: 'lower',
      },
      {
        label: '互动成本 CPE',
        valA: parseNum(feedRow.cpe),
        valB: parseNum(searchRow.cpe),
        formatA: formatCurrency(parseNum(feedRow.cpe)),
        formatB: formatCurrency(parseNum(searchRow.cpe)),
        betterWhen: 'lower',
      },
      {
        label: '种草人群资产 (I+TI)',
        valA: parseNum(feedRow.seed_total),
        valB: parseNum(searchRow.seed_total),
        formatA: `${formatNum(parseNum(feedRow.seed_total), 0)} 人`,
        formatB: `${formatNum(parseNum(searchRow.seed_total), 0)} 人`,
      },
    ];

    // 2b. Brand Note Types Arena
    const noteTypeRows = model.brandNoteTypesTable.rows;
    const videoRow = noteTypeRows.find((r) => String(r.noteFormat || '').includes('视频')) || noteTypeRows[0] || {};
    const imgRow = noteTypeRows.find((r) => String(r.noteFormat || '').includes('图文')) || noteTypeRows[1] || {};
    const videoSpend = parseNum(videoRow.spend);
    const imgSpend = parseNum(imgRow.spend);
    const videoRatio = parseNum(videoRow.spendRatio);
    const imgRatio = parseNum(imgRow.spendRatio);

    const brandNoteTypeArenaRows: ArenaMetricRow[] = [
      {
        label: '展现量 (曝光规模)',
        valA: parseNum(videoRow.impressions),
        valB: parseNum(imgRow.impressions),
        formatA: `${formatNum(parseNum(videoRow.impressions), 0)} 次`,
        formatB: `${formatNum(parseNum(imgRow.impressions), 0)} 次`,
      },
      {
        label: '点击量 (总引流)',
        valA: parseNum(videoRow.clicks),
        valB: parseNum(imgRow.clicks),
        formatA: `${formatNum(parseNum(videoRow.clicks), 0)} 次`,
        formatB: `${formatNum(parseNum(imgRow.clicks), 0)} 次`,
      },
      {
        label: '点击率 CTR',
        valA: parseNum(videoRow.ctr),
        valB: parseNum(imgRow.ctr),
        formatA: formatPercent(parseNum(videoRow.ctr), 2),
        formatB: formatPercent(parseNum(imgRow.ctr), 2),
        betterWhen: 'higher',
      },
      {
        label: '点击成本 CPC',
        valA: parseNum(videoRow.cpc),
        valB: parseNum(imgRow.cpc),
        formatA: formatCurrency(parseNum(videoRow.cpc)),
        formatB: formatCurrency(parseNum(imgRow.cpc)),
        betterWhen: 'lower',
      },
      {
        label: '千次展现 CPM',
        valA: parseNum(videoRow.cpm),
        valB: parseNum(imgRow.cpm),
        formatA: formatCurrency(parseNum(videoRow.cpm)),
        formatB: formatCurrency(parseNum(imgRow.cpm)),
        betterWhen: 'lower',
      },
      {
        label: '5秒有效播放量',
        valA: parseNum(videoRow.plays5s),
        valB: parseNum(imgRow.plays5s),
        formatA: `${formatNum(parseNum(videoRow.plays5s), 0)} 次`,
        formatB: imgRow.plays5s ? `${formatNum(parseNum(imgRow.plays5s), 0)} 次` : '非视频形式',
      },
    ];

    // 2c. Brand Keywords Lollipop
    const brandKeywordLollipopRows: LollipopRow[] = [...model.brandKeywordsTable.rows]
      .sort((a, b) => (parseNum(b.spend) || 0) - (parseNum(a.spend) || 0))
      .map((r, i) => ({
        rank: i + 1,
        label: String(r.keywordCategory || '未分类'),
        spend: parseNum(r.spend),
        clicks: parseNum(r.clicks),
        ctr: parseNum(r.ctr),
        cpc: parseNum(r.cpc),
      }));

    // 2d. Brand KOL Tiers Butterfly
    const brandKolTierButterflyRows: ButterflyRow[] = [...model.brandKolTiersTable.rows]
      .sort((a, b) => (parseNum(b.spend) || 0) - (parseNum(a.spend) || 0))
      .map((r) => {
        const clicks = parseNum(r.clicks);
        const impr = parseNum(r.impressions);
        return {
          label: String(r.tier || '未知量级'),
          spend: parseNum(r.spend),
          middleInfo: `${clicks !== null ? formatWan(clicks) : '—'}点击 / ${impr !== null ? formatWan(impr) : '—'}曝光`,
          costVal: parseNum(r.cpc),
          costLabel: 'CPC',
          subCostVal: parseNum(r.cpm),
          subCostLabel: 'CPM',
        };
      });

    // 2e. Brand Age Butterfly
    const brandAgeButterflyRows: ButterflyRow[] = [...model.brandAgeTable.rows]
      .sort((a, b) => (parseNum(b.spend) || 0) - (parseNum(a.spend) || 0))
      .map((r) => {
        const eng = parseNum(r.engagements);
        const ctr = parseNum(r.ctr);
        return {
          label: `${String(r.ageGroup || '未知')}岁`,
          spend: parseNum(r.spend),
          middleInfo: `${eng !== null ? formatNum(eng, 0) : '—'}次互动 / CTR ${formatPercent(ctr, 2)}`,
          costVal: parseNum(r.cpe),
          costLabel: 'CPE',
          subCostVal: parseNum(r.cpc),
          subCostLabel: 'CPC',
        };
      });

    // 2f. CID Arena
    const hasCidStandard = typeof model.cidStandardSpend === 'number' && Number.isFinite(model.cidStandardSpend) && model.cidStandardSpend >= 0;
    const hasCidSimple = typeof model.cidSimpleSpend === 'number' && Number.isFinite(model.cidSimpleSpend) && model.cidSimpleSpend >= 0;
    const cidTotSpend = hasCidStandard && hasCidSimple && (model.cidStandardSpend! + model.cidSimpleSpend!) > 0
      ? model.cidStandardSpend! + model.cidSimpleSpend!
      : null;
    const cidStandardRatio = cidTotSpend !== null ? (model.cidStandardSpend! / cidTotSpend) * 100 : null;
    const cidSimpleRatio = cidStandardRatio !== null ? 100 - cidStandardRatio : null;
    const cidStandardCpuv = model.cidStandardSpend && model.cidStandardUv ? model.cidStandardSpend / model.cidStandardUv : null;
    const cidSimpleCpuv = model.cidSimpleSpend && model.cidSimpleUv ? model.cidSimpleSpend / model.cidSimpleUv : null;

    const cidArenaRows: ArenaMetricRow[] = [
      {
        label: '消耗金额 (预算占比)',
        valA: model.cidStandardSpend,
        valB: model.cidSimpleSpend,
        formatA: formatCurrency(model.cidStandardSpend),
        formatB: formatCurrency(model.cidSimpleSpend),
      },
      {
        label: '进店访客 UV',
        valA: model.cidStandardUv,
        valB: model.cidSimpleUv,
        formatA: `${formatNum(model.cidStandardUv, 0)} UV`,
        formatB: `${formatNum(model.cidSimpleUv, 0)} UV`,
      },
      {
        label: '访客成本 CPUV',
        valA: cidStandardCpuv,
        valB: cidSimpleCpuv,
        formatA: formatCurrency(cidStandardCpuv),
        formatB: formatCurrency(cidSimpleCpuv),
        betterWhen: 'lower',
      },
      {
        label: '成交支付订单量',
        valA: model.cidStandardOrders,
        valB: model.cidSimpleOrders,
        formatA: `${formatNum(model.cidStandardOrders, 0)} 单`,
        formatB: `${formatNum(model.cidSimpleOrders, 0)} 单`,
      },
      {
        label: '成交金额 GMV',
        valA: model.cidStandardGmv,
        valB: model.cidSimpleGmv,
        formatA: formatCurrency(model.cidStandardGmv),
        formatB: formatCurrency(model.cidSimpleGmv),
      },
      {
        label: '聚合成交 ROI',
        valA: model.cidStandardRoi,
        valB: model.cidSimpleRoi,
        formatA: `${model.cidStandardRoi?.toFixed(2) ?? '—'} 倍`,
        formatB: `${model.cidSimpleRoi?.toFixed(2) ?? '—'} 倍`,
        betterWhen: 'higher',
      },
    ];

    // 2g. CID Note Types Arena
    const cidNoteRows = model.cidNoteTypesTable.rows;
    const cidVideoRow = cidNoteRows.find((r) => String(r.noteFormat || '').includes('视频')) || cidNoteRows[0] || {};
    const cidImgRow = cidNoteRows.find((r) => String(r.noteFormat || '').includes('图文')) || cidNoteRows[1] || {};
    const cidVideoSpend = parseNum(cidVideoRow.spend);
    const cidImgSpend = parseNum(cidImgRow.spend);
    const cidVideoRatio = parseNum(cidVideoRow.spendRatio);
    const cidImgRatio = parseNum(cidImgRow.spendRatio);

    const cidNoteArenaRows: ArenaMetricRow[] = [
      {
        label: '消耗金额 (元)',
        valA: cidVideoSpend,
        valB: cidImgSpend,
        formatA: formatCurrency(cidVideoSpend),
        formatB: formatCurrency(cidImgSpend),
      },
      {
        label: '进店访客 UV',
        valA: parseNum(cidVideoRow.uv),
        valB: parseNum(cidImgRow.uv),
        formatA: `${formatNum(parseNum(cidVideoRow.uv), 0)} UV`,
        formatB: `${formatNum(parseNum(cidImgRow.uv), 0)} UV`,
      },
      {
        label: '成交订单量',
        valA: parseNum(cidVideoRow.orders),
        valB: parseNum(cidImgRow.orders),
        formatA: `${formatNum(parseNum(cidVideoRow.orders), 0)} 单`,
        formatB: `${formatNum(parseNum(cidImgRow.orders), 0)} 单`,
      },
      {
        label: '成交金额 GMV',
        valA: parseNum(cidVideoRow.gmv),
        valB: parseNum(cidImgRow.gmv),
        formatA: formatCurrency(parseNum(cidVideoRow.gmv)),
        formatB: formatCurrency(parseNum(cidImgRow.gmv)),
      },
      {
        label: '成交转化 ROI',
        valA: parseNum(cidVideoRow.roi),
        valB: parseNum(cidImgRow.roi),
        formatA: `${parseNum(cidVideoRow.roi)?.toFixed(2) ?? '—'} 倍`,
        formatB: `${parseNum(cidImgRow.roi)?.toFixed(2) ?? '—'} 倍`,
        betterWhen: 'higher',
      },
    ];

    return (
      <div className="ht-board" data-testid="huang-tiane-ads">
        <div className="ht-header ht-section-jumpbar ht-command-bar" role="navigation" aria-label="投放渠道控制台">
          <div className="ht-command-bar-left">
            <div className="ht-command-bar-brand">
            <h2 className="ht-header-title">黄天鹅 投放效果与渠道分析</h2>
              <span className="ht-header-badge">渠道独立视图</span>
            </div>
            <span className="ht-jumpbar-label">📊 渠道导航</span>
            <div className="ht-scope-tabs" role="tablist" aria-label="渠道切换">
              <button
                type="button"
                role="tab"
                aria-selected={adsScope === 'brand'}
                className={`ht-scope-tab-btn ${adsScope === 'brand' ? 'active' : ''}`}
                onClick={() => setAdsScope('brand')}
              >
                🎯 品牌FS ({model.brandDaily.length}日)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={adsScope === 'cid'}
                className={`ht-scope-tab-btn ${adsScope === 'cid' ? 'active' : ''}`}
                onClick={() => setAdsScope('cid')}
              >
                🛒 红猫CID (两类对照)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={adsScope === 'commerce'}
                className={`ht-scope-tab-btn ${adsScope === 'commerce' ? 'active' : ''}`}
                onClick={() => setAdsScope('commerce')}
              >
                📦 闭环商销 ({model.commerceDaily.length}日)
              </button>
            </div>
            <div className="ht-jumpbar-links">
              <a href="#ht-sec-ads-channels" className="ht-jump-pill" onClick={(e) => handleAnchorClick(e, 'ht-sec-ads-channels')}>📊 渠道走势</a>
              <a href="#ht-sec-ads-audiences" className="ht-jump-pill" onClick={(e) => handleAnchorClick(e, 'ht-sec-ads-audiences')}>👥 人群地域</a>
              <a href="#ht-sec-ads-benchmarks" className="ht-jump-pill" onClick={(e) => handleAnchorClick(e, 'ht-sec-ads-benchmarks')}>⚖️ 行业基准</a>
            </div>
          </div>
          <div className="ht-header-meta">
            <span className="ht-period-pill">品牌与CID：{model.brandPeriod}</span>
            <span className="ht-period-pill">商销：{model.commercePeriod}</span>
          </div>
        </div>

        <div className="ht-layer">
          <MetricStrip items={currentAdsMetricItems} />
        </div>

        {adsScope === 'brand' && (
          <div id="ht-sec-ads-channels" className="ht-layer">
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
              <DualArenaCard
                title="品牌FS 广告类型投放分布 (信息流 vs 搜索)"
                subtitle={model.brandAdTypesTable.period ? `统计区间：${model.brandAdTypesTable.period}` : undefined}
                sideA={{ name: String(feedRow.adType || '信息流'), spend: feedSpend, spendRatio: feedRatio ?? undefined }}
                sideB={{ name: String(searchRow.adType || '搜索'), spend: searchSpend, spendRatio: searchRatio ?? undefined }}
                rows={brandAdTypeArenaRows}
              />
            )}

            {model.brandNoteTypesTable.rows.length > 0 && (
              <DualArenaCard
                title="品牌FS 笔记素材形式投放对照 (视频 vs 图文)"
                subtitle={model.brandNoteTypesTable.period ? `统计区间：${model.brandNoteTypesTable.period}` : undefined}
                sideA={{ name: String(videoRow.noteFormat || '视频'), spend: videoSpend, spendRatio: videoRatio ?? undefined }}
                sideB={{ name: String(imgRow.noteFormat || '图文'), spend: imgSpend, spendRatio: imgRatio ?? undefined }}
                rows={brandNoteTypeArenaRows}
              />
            )}

            {model.brandKeywordsTable.rows.length > 0 && (
              <LollipopList
                title="品牌FS 关键词类别投流结构与效能"
                subtitle={model.brandKeywordsTable.period ? `统计区间：${model.brandKeywordsTable.period} / 按消耗降序呈现词类份额矩阵` : undefined}
                rows={brandKeywordLollipopRows}
              />
            )}

            {model.brandKolTiersTable.rows.length > 0 && (
              <ButterflyCard
                title="品牌FS 达人层级投放效益对照"
                subtitle={model.brandKolTiersTable.period ? `统计区间：${model.brandKolTiersTable.period} / 各量级消耗规模与CPC/CPM成本评级` : undefined}
                rows={brandKolTierButterflyRows}
              />
            )}

            {model.brandAgeTable.rows.length > 0 && (
              <ButterflyCard
                title="品牌FS 受众年龄段投流渗透与成本"
                subtitle={model.brandAgeTable.period ? `统计区间：${model.brandAgeTable.period} / 各年龄段消耗规模与互动成本CPE评定` : undefined}
                rows={brandAgeButterflyRows}
              />
            )}

            {model.brandProvincesTable.rows.length > 0 && (
              <RegionRankGrid
                title="品牌FS 地域（省份/地区）投放排行 (Top 10)"
                subtitle={model.brandProvincesTable.period ? `统计区间：${model.brandProvincesTable.period} / 双列热力榜单` : undefined}
                provinces={model.brandProvincesTable.rows}
                totalSpend={model.brandProvincesTable.totalSpend}
                expanded={showAllProvinces}
                onToggleExpand={() => setShowAllProvinces((prev) => !prev)}
              />
            )}

            {model.brandAudiencesTable.rows.length > 0 && (
              <ChartPanel
                title="品牌FS 定向人群包投放效能 (Top 10)"
                subtitle={`按消耗Top10排序呈现种草人群资产规模与单位成本${model.brandAudiencesTable.period ? ` / 统计区间：${model.brandAudiencesTable.period}` : ''}`}
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
                    <CustomSelect
                      ariaLabel="选择行业对照指标"
                      value={selectedBenchmarkMetric}
                      onChange={(val) => setSelectedBenchmarkMetric(val as 'CTR' | 'CPC' | 'CPM' | 'CPE' | 'CPI' | 'CPTI')}
                      options={[
                        { value: 'CTR', label: 'CTR (%)' },
                        { value: 'CPC', label: 'CPC (元)' },
                        { value: 'CPM', label: 'CPM (元)' },
                        { value: 'CPE', label: 'CPE (元)' },
                        { value: 'CPI', label: 'CPI (元)' },
                        { value: 'CPTI', label: 'CPTI (元)' },
                      ]}
                    />
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
          </div>
        )}

        {adsScope === 'cid' && (
          <div className="ht-layer">
            <div className="ht-grid-2">
            <DualArenaCard
              title="红猫CID 标准投与简单投效能对比"
              subtitle="全域聚合投放19日对照 / 标准投58.2% vs 简单投41.8%全面效能PK"
              sideA={{ name: '标准投', spend: model.cidStandardSpend, spendRatio: cidStandardRatio }}
              sideB={{ name: '简单投', spend: model.cidSimpleSpend, spendRatio: cidSimpleRatio }}
              rows={cidArenaRows}
            />

            <ChartPanel
              title="红猫CID 全域日消耗与成交GMV走势"
              subtitle={
                model.cidTotalSpend !== null && model.cidTotalGmv !== null
                  ? `全域消耗 ${formatCurrency(model.cidTotalSpend)}，成交GMV ${formatCurrency(model.cidTotalGmv)}，聚合ROI ${model.cidOverallRoi?.toFixed(2) ?? '—'}倍`
                  : undefined
              }
            >
              <CampaignComboChart
                rows={model.cidTotal}
                series={cidSeriesStandard}
                xKey="date"
                title="红猫CID全域日度走势"
                height={270}
              />
            </ChartPanel>

            {model.cidNoteTypesTable.rows.length > 0 && (
              <DualArenaCard
                title="红猫CID 笔记素材形式转化 (视频 vs 图文)"
                subtitle={
                  model.cidNoteTypesTable.period
                    ? `统计区间：${model.cidNoteTypesTable.period}${model.cidNoteTypesTable.totalSpend !== null ? ` / 合计消耗 ${formatCurrency(model.cidNoteTypesTable.totalSpend)}` : ''}`
                    : undefined
                }
                sideA={{ name: String(cidVideoRow.noteFormat || '视频'), spend: cidVideoSpend, spendRatio: cidVideoRatio ?? undefined }}
                sideB={{ name: String(cidImgRow.noteFormat || '图文'), spend: cidImgSpend, spendRatio: cidImgRatio ?? undefined }}
                rows={cidNoteArenaRows}
              />
            )}

            {model.cidAdTypesTable.rows.length > 0 && (
              <ChartPanel
                title="红猫CID 标准投计划广告类型"
                subtitle={
                  model.cidAdTypesTable.period
                    ? `透视区间：${model.cidAdTypesTable.period}${model.cidAdTypesTable.totalSpend !== null ? ` / 样本合计消耗 ${formatCurrency(model.cidAdTypesTable.totalSpend)}` : ''}`
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
                    ? `透视区间：${model.cidAudiencesTable.period}${model.cidAudiencesTable.totalSpend !== null ? ` / 样本合计消耗 ${formatCurrency(model.cidAudiencesTable.totalSpend)}` : ''}`
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
            </div>
          </div>
        )}

        {adsScope === 'commerce' && (
          <div className="ht-layer">
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
                    ? `观察区间：${model.commerceCreativesTable.period} / 按成交GMV降序呈现原报业务实绩`
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



  const contentMetricItems: MetricStripItem[] = [
    {
      label: '定档合作达人总数',
      value: `${model.creatorsCount} 位`,
      hint: '全量合作达人储备',
      badge: '达人矩阵',
      status: 'default',
    },
    {
      label: '达人已发布上线',
      value: `${model.creatorsPublished} 篇 / ${formatPercent(model.creatorsPublishRate, 1)}`,
      hint: `已收集素材 ${model.creatorsAssetCollected} 篇`,
      badge: '履约进度',
      status: 'success',
    },
    {
      label: 'KOS矩阵发布量',
      value: `${model.kosCount} 篇`,
      hint: '全部登记于 2026-10-19 发布',
      badge: 'KOS蓄水',
      status: 'accent',
    },
    {
      label: '含平台费总报价',
      value: formatCurrency(model.creatorsTotalFeeWithPlatform, 0),
      hint: `达人裸价 ${formatCurrency(model.creatorsTotalFeeRaw, 0)}`,
      badge: '采买规模',
      status: 'warning',
    },
  ];

  const maxTierFee = Math.max(...model.creatorTierBreakdown.map((t) => t.totalFee || 0), 1);

  return (
    <div className="ht-board" data-testid="huang-tiane-content">
      <div className="ht-header ht-section-jumpbar ht-command-bar" role="navigation" aria-label="内容执行控制台">
        <div className="ht-command-bar-left">
          <div className="ht-command-bar-brand">
            <h2 className="ht-header-title">黄天鹅 内容执行与KOS明细</h2>
            <span className="ht-header-badge">达人{model.creatorsCount}篇 + KOS{model.kosCount}篇</span>
          </div>
          <span className="ht-jumpbar-label">📊 章节导航</span>
          <div className="ht-jumpbar-links">
            <a href="#ht-sec-content-status" className="ht-jump-pill" onClick={(e) => handleAnchorClick(e, 'ht-sec-content-status')}>🎯 执行阶段</a>
            <a href="#ht-sec-content-funnel" className="ht-jump-pill" onClick={(e) => handleAnchorClick(e, 'ht-sec-content-funnel')}>📅 排期与发布</a>
            <a href="#ht-sec-content-pricing" className="ht-jump-pill" onClick={(e) => handleAnchorClick(e, 'ht-sec-content-pricing')}>💰 采买报价</a>
          </div>
        </div>
        <div className="ht-header-meta">
          <span className="ht-period-pill">达人已发 {model.creatorsPublished} 篇</span>
          <span className="ht-period-pill">KOS已发 {model.kosCount} 篇</span>
          <span className="ht-period-pill">素材已收 {model.creatorsAssetCollected} 篇</span>
        </div>
      </div>

      <div className="ht-layer">
        <MetricStrip items={contentMetricItems} />
      </div>

      <div id="ht-sec-content-status" className="ht-layer">
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
                {model.creatorTierBreakdown.map((t) => {
                  const pubRate = t.count > 0 ? (t.publishedCount / t.count) * 100 : 0;
                    const feeRatio = t.totalFee ? (t.totalFee / maxTierFee) * 100 : 0;
                  return (
                    <tr key={t.tier}>
                      <td style={{ fontWeight: 600 }}>{t.tier}</td>
                      <td>{t.count} 位</td>
                      <td>
                        <div className="ht-inline-bar-cell">
                          <span>{t.publishedCount} / {t.count} 位 ({pubRate.toFixed(0)}%)</span>
                          <div className="ht-inline-bar-track">
                            <div
                              className="ht-inline-bar-fill success"
                              style={{ width: `${pubRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="ht-inline-bar-cell">
                          <span>{formatCurrency(t.totalFee, 0)}</span>
                          <div className="ht-inline-bar-track">
                            <div
                              className="ht-inline-bar-fill primary"
                              style={{ width: `${feeRatio}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>{formatCurrency(t.avgFee, 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartPanel>
        </div>
      </div>

      {model.actions && model.actions.items && model.actions.items.length > 0 && (
        <div className="ht-layer">
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
        </div>
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
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.note_id || '—'}</td>
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
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{k.note_id || '—'}</td>
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
