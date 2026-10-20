'use client';

import React, { useMemo, useState } from 'react';
import type { CampaignDashboard, CampaignTable } from '../../lib/campaign-types';
import { CampaignComboChart, type ComboSeries, fmtComboNum } from './CampaignComboChart';
import {
  MetricStrip,
  ChartPanel,
  CampaignFunnelChart,
  MatrixHeatmapChart,
  StackedHorizontalBarChart,
  ScatterChart,
  DonutChart,
  HorizontalBarChart,
  type FunnelStageDatum,
  type MatrixHeatmapCell,
  type StackedBarRow,
  type StackedBarSegment,
  type ChartDatum,
  type MetricStripItem,
} from './CampaignCharts';
import './wipes-rich-insights.css';

interface WipesRichInsightsProps {
  dashboard: CampaignDashboard;
  section: 'overview' | 'ads' | 'content';
}

function parseFiniteNum(val: unknown): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === 'string') {
    const s = val.replace(/[¥,%\s]/g, '').trim();
    if (!s || s === '-' || s === '--' || s === 'null' || s === 'None') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function roundNum(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function WipesRichInsights({ dashboard, section }: WipesRichInsightsProps) {
  const [audienceCostFilter, setAudienceCostFilter] = useState<'all' | 'low_cpuv' | 'high_cpuv' | 'has_uv'>('all');
  const [cidView, setCidView] = useState<'all' | 'converters'>('all');

  const tablesMap = useMemo(() => {
    const map = new Map<string, CampaignTable>();
    for (const t of dashboard.tables || []) {
      map.set(t.id, t);
    }
    return map;
  }, [dashboard.tables]);

  const kpiTable = tablesMap.get('wipes-kpi-achievement-table');
  const xingheTable = tablesMap.get('wipes-taobao-xinghe-table');
  const budgetTable = tablesMap.get('wipes-budget-dual-track-table');
  const cidTable = tablesMap.get('wipes-cid-full-attribution-table');
  const weeklyTable = tablesMap.get('wipes-weekly-sprint-table');
  const channelsTable = tablesMap.get('wipes-channel-structure-table');
  const kwDetailTable = tablesMap.get('wipes-keyword-detail-table');
  const kwCatTable = tablesMap.get('wipes-keyword-category-table');
  const audienceTable = tablesMap.get('wipes-audience-packages-table');
  const placementTable = tablesMap.get('wipes-placement-efficiency-table');
  const tierTable = tablesMap.get('wipes-tier-efficiency-table');
  const directionTable = tablesMap.get('wipes-direction-efficiency-table');

  const fullFunnelTable = tablesMap.get('wipes-full-funnel-summary');
  const noteTrafficTable = tablesMap.get('wipes-note-traffic-sources');
  const directionAudienceTable = tablesMap.get('wipes-direction-audience-matrix');
  const creatorFunnelTable = tablesMap.get('wipes-creator-selection-funnel');
  const doctorPoolTable = tablesMap.get('wipes-doctor-hospital-pool');
  const reviewBlockersTable = tablesMap.get('wipes-note-review-blockers');

  // =========================================================================
  // SECTION: OVERVIEW
  // =========================================================================
  if (section === 'overview') {
    const kpiRows = (kpiTable?.rows || []).map((r) => ({
      dimension: String(r.dimension || ''),
      metric: String(r.metric || ''),
      subChannel: String(r.subChannel || ''),
      rawTarget: String(r.rawTarget || r.target || ''),
      rawActual: String(r.rawActual || r.actual || ''),
      comparator: String(r.comparator || 'gte'),
      numericTarget: parseFiniteNum(r.numericTarget),
      numericActual: parseFiniteNum(r.numericActual),
      sourceProgress: String(r.sourceProgress || ''),
      calculatedAchievementPct: String(r.calculatedAchievementPct || ''),
      isSurpassed: typeof r.isSurpassed === 'boolean' ? r.isSurpassed : null,
      auditNote: r.auditNote ? String(r.auditNote) : null,
    }));

    const xingheRows = (xingheTable?.rows || []).map((r) => {
      const sUv = parseFiniteNum(r.search_in_uv);
      const nUv = parseFiniteNum(r.note_in_uv);
      return {
        date: String(r.date || ''),
        fs_spend: parseFiniteNum(r.fs_spend),
        shop_total_gmv: parseFiniteNum(r.shop_total_gmv),
        task_item_gmv: parseFiniteNum(r.task_item_gmv),
        search_in_uv: sUv !== null ? sUv : null,
        note_in_uv: nUv !== null ? nUv : null,
        new_visitor_uv: parseFiniteNum(r.new_visitor_uv),
        shop_buy_uv: parseFiniteNum(r.shop_buy_uv),
      };
    });

    const xingheSeries: ComboSeries[] = [
      { key: 'fs_spend', label: 'FS投流消耗', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'task_item_gmv', label: '任务单品直接GMV', unit: '元', axis: 'left', kind: 'bar', color: '#b88a45' },
      { key: 'shop_total_gmv', label: '全店成交GMV (参考大盘)', unit: '元', axis: 'left', kind: 'line', color: '#8273a3' },
      { key: 'note_in_uv', label: '笔记进店UV', unit: '人', axis: 'right', kind: 'point', color: '#bd7964' },
      { key: 'search_in_uv', label: '手淘搜索进店UV', unit: '人', axis: 'right', kind: 'line', color: '#4d8b80' },
    ];

    const weeklyRows = (weeklyTable?.rows || []).map((r) => ({
      sourcePeriod: String(r.sourcePeriod || r.period || ''),
      actualObservedPeriod: String(r.actualObservedPeriod || r.sourcePeriod || ''),
      spend: parseFiniteNum(r.spend),
      cpuv: parseFiniteNum(r.cpuv),
      dailySpendAvg: parseFiniteNum(r.dailySpendAvg),
      observedDays: parseFiniteNum(r.observedDays),
      uv_30d: parseFiniteNum(r.uv_30d),
    }));

    const weeklySeries: ComboSeries[] = [
      { key: 'spend', label: '阶段累计消耗', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'cpuv', label: '阶段访客成本 (CPUV)', unit: '元/人', axis: 'right', kind: 'line', color: '#b88a45' },
    ];

    const channelRows = (channelsTable?.rows || []).filter((r) => String(r.channel) !== 'Total');
    const channelDonutData: ChartDatum[] = channelRows.map((c, i) => ({
      label: `${String(c.channel ?? '')}端 ${String(c.channelName ?? '')}`,
      value: parseFiniteNum(c.spend),
      color: i === 0 ? '#8273a3' : i === 1 ? '#2c7168' : i === 2 ? '#b88a45' : '#bd7964',
      detail: `支出 ¥${fmtComboNum(c.spend)} · 占比 ${String(c.share ?? '--')}`,
    }));

    // Budget Dynamic Derivations (zero hardcoding)
    const budgetRows = budgetTable?.rows || [];
    const clientRows = budgetRows.filter((r) => String(r.track) === '客户打款口径' && String(r.category) !== '打款总计');
    const usableRows = budgetRows.filter((r) => String(r.track) === '实际可消耗口径' && String(r.category) !== '实际可消耗总计');
    const clientTotal = budgetRows.find((r) => String(r.track) === '客户打款口径' && String(r.category) === '打款总计');
    const usableTotal = budgetRows.find((r) => String(r.track) === '实际可消耗口径' && String(r.category) === '实际可消耗总计');

    const budgetPairs = clientRows.map((cr) => {
      const ur = usableRows.find((u) => String(u.category) === String(cr.category));
      return {
        category: String(cr.category || ''),
        clientBudget: parseFiniteNum(cr.budget),
        clientSpent: parseFiniteNum(cr.spent),
        clientRate: String(cr.spentRate || ''),
        usableBudget: parseFiniteNum(ur?.budget),
        usableSpent: parseFiniteNum(ur?.spent),
        usableRate: String(ur?.spentRate || ''),
      };
    });

    const budgetComboSeries: ComboSeries[] = [
      { key: 'clientBudget', label: '客户预算', unit: '元', axis: 'left', kind: 'bar', color: '#b88a45' },
      { key: 'clientSpent', label: '客户已用', unit: '元', axis: 'left', kind: 'bar', color: '#bd7964' },
      { key: 'usableBudget', label: '可消耗预算', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'usableSpent', label: '实际可消耗已用', unit: '元', axis: 'left', kind: 'bar', color: '#4d8b80' },
    ];

    const metricStripItems: MetricStripItem[] = [
      { label: '项目总花费', value: '¥369,798', meta: '淘搜底表全渠道对账', status: 'accent' },
      { label: '双轨预算进度', value: '74.0%', meta: '打款50万 / 已用37.0万', status: 'default' },
      { label: '全网总曝光量', value: '620.4万', meta: 'KPI达成率 155.1%', status: 'success' },
      { label: '小红星活跃UV', value: '21,085', meta: '获客成本 ¥8.00 (CPUV≤10)', status: 'success' },
      { label: '手淘进店总UV', value: '17,041', meta: '笔记12,197 + 搜索4,844', status: 'accent' },
      { label: '任务单品直接GMV', value: '¥8,741.81', meta: '购买UV 1,268 (客单¥6.89)', status: 'default' },
    ];

    // Funnel stages (跨端全链路转化漏斗)
    const funnelColors = ['#2c7168', '#4d8b80', '#8273a3', '#b88a45', '#bd7964', '#8273a3', '#2c7168', '#64748b'];
    const funnelStages: FunnelStageDatum[] = (fullFunnelTable?.rows || []).map((r, idx) => ({
      stage: `${String(r.stageName || '')} · ${String(r.metricName || '')}`,
      value: parseFiniteNum(r.metricValue),
      unit: String(r.metricUnit || ''),
      conversionLabel: String(r.conversionRate || ''),
      costLabel: String(r.costEfficiency || ''),
      subtext: String(r.attributionRule || r.platform || ''),
      color: funnelColors[idx % funnelColors.length],
    }));

    // Top 12 Keywords Pareto
    const rawKwRows = (kwDetailTable?.rows || [])
      .filter((r) => String(r.keyword) !== '总计')
      .map((r) => ({
        keyword: String(r.keyword || ''),
        category: String(r.category || ''),
        spend: parseFiniteNum(r.spend),
        impressions: parseFiniteNum(r.impressions),
        clicks: parseFiniteNum(r.clicks),
        uv: parseFiniteNum(r.uv),
        cpuv: parseFiniteNum(r.cpuv),
        cpm: parseFiniteNum(r.cpm),
      }))
      .sort((a, b) => (b.spend || 0) - (a.spend || 0));

    const totalKwSpend = rawKwRows.reduce((sum, r) => sum + (r.spend || 0), 0);
    const paretoKwRows = rawKwRows.map((r, idx) => {
      const prefixSpend = rawKwRows.slice(0, idx + 1).reduce((sum, item) => sum + (item.spend || 0), 0);
      const cumPct = totalKwSpend > 0 ? roundNum((prefixSpend / totalKwSpend) * 100, 1) : 0;
      return {
        ...r,
        cumSpendShare: cumPct,
      };
    });

    const top12Pareto = paretoKwRows.slice(0, 12);
    const paretoSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗金额', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'cumSpendShare', label: '累计消耗占比', unit: '%', axis: 'right', kind: 'line', color: '#b88a45' },
    ];

    const catRows = (kwCatTable?.rows || []).filter((r) => String(r.category) !== '总计');

    // 31 Audiences Scatter
    const audienceScatterData = (audienceTable?.rows || [])
      .filter((r) => String(r.packageName) !== '总计' && parseFiniteNum(r.spend) !== null && parseFiniteNum(r.cpuv) !== null)
      .map((r) => {
        const s = parseFiniteNum(r.spend) || 0;
        const cpuv = parseFiniteNum(r.cpuv) || 0;
        const uv = parseFiniteNum(r.uv) || 0;
        const name = String(r.packageName || '').replace(/^人群包-/, '');
        return {
          label: name,
          x: s,
          y: cpuv,
          size: Math.max(8, Math.min(32, Math.sqrt(uv || s) * 0.8)),
          detail: `消耗 ¥${fmtComboNum(s)} · CPUV ¥${cpuv.toFixed(2)} · 站外活跃UV ${fmtComboNum(uv)}人`,
        };
      });

    // 4 Tiers Stacked Bar (derived dynamically from wipes-tier-efficiency-table)
    const tierNonTotalRows = (tierTable?.rows || []).filter((r) => String(r.tier) !== '总计');
    const tierGrandTotal = tierNonTotalRows.reduce((s, r) => s + (parseFiniteNum(r.totalSpend) || 0), 0);
    const tierStackedRows: StackedBarRow[] = tierNonTotalRows.map((r) => {
      const kVal = parseFiniteNum(r.kFee) || 0;
      const fsVal = parseFiniteNum(r.fsSpend) || 0;
      const tot = parseFiniteNum(r.totalSpend) ?? (kVal + fsVal);
      const share = tierGrandTotal > 0 ? ((tot / tierGrandTotal) * 100).toFixed(1) : '0.0';
      const cnt = parseFiniteNum(r.noteCount);
      return {
        label: `${String(r.tier || '')}${cnt !== null ? ` (${cnt}篇)` : ''}`,
        segments: { kSpend: kVal, fsSpend: fsVal },
        totalLabel: `¥${fmtComboNum(tot)} (占${share}%)`,
      };
    });
    const tierStackedSegments: StackedBarSegment[] = [
      { key: 'kSpend', label: '达人采买费 (K端)', color: '#8273a3' },
      { key: 'fsSpend', label: '投流加热费 (FS端)', color: '#2c7168' },
    ];

    // Direction x Audience Matrix Heatmap (derived dynamically from wipes-direction-audience-matrix)
    const daRows = directionAudienceTable?.rows || [];
    const heatmapRows = Array.from(new Set(daRows.map((r) => String(r.direction || '')).filter(Boolean)));
    const audSpendTotals = new Map<string, number>();
    for (const r of daRows) {
      const aud = String(r.audience || '');
      if (!aud) continue;
      audSpendTotals.set(aud, (audSpendTotals.get(aud) || 0) + (parseFiniteNum(r.spend) || 0));
    }
    const heatmapCols = Array.from(audSpendTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([aud]) => aud);
    const heatmapCells: MatrixHeatmapCell[] = daRows
      .filter((r) => heatmapCols.includes(String(r.audience || '')))
      .map((r) => {
        const sp = parseFiniteNum(r.spend);
        const cpuv = parseFiniteNum(r.cpuv);
        const cpe = parseFiniteNum(r.cpe);
        return {
          row: String(r.direction || ''),
          col: String(r.audience || ''),
          value: sp,
          displayValue: sp !== null ? `¥${fmtComboNum(sp, 0)}` : '·',
          subtext: cpuv !== null ? `CPUV ¥${cpuv.toFixed(2)}` : (cpe !== null ? `CPE ¥${cpe.toFixed(2)}` : undefined),
        };
      });

    // Traffic sources breakdown (derived dynamically from wipes-note-traffic-sources)
    const trafficRows = noteTrafficTable?.rows || [];
    let sumNatImp = 0, sumPromoImp = 0, sumHeatImp = 0;
    let sumNatRead = 0, sumPromoRead = 0;
    for (const r of trafficRows) {
      sumNatImp += parseFiniteNum(r.naturalImpressions) || 0;
      sumPromoImp += parseFiniteNum(r.promoImpressions) || 0;
      sumHeatImp += parseFiniteNum(r.heatingImpressions) || 0;
      sumNatRead += parseFiniteNum(r.naturalReads) || 0;
      sumPromoRead += parseFiniteNum(r.promoReads) || 0;
    }
    const totImpSample = sumNatImp + sumPromoImp + sumHeatImp;
    const totReadSample = sumNatRead + sumPromoRead;
    const noteTrafficStackedRows: StackedBarRow[] = [
      {
        label: `样本曝光结构 (${trafficRows.length}篇)`,
        segments: { natural: sumNatImp, promo: sumPromoImp, heating: sumHeatImp },
        totalLabel: totImpSample > 0 ? `${fmtComboNum(totImpSample, 0)} 次` : '—',
      },
      {
        label: `样本阅读结构 (${trafficRows.length}篇)`,
        segments: { natural: sumNatRead, promo: sumPromoRead, heating: 0 },
        totalLabel: totReadSample > 0 ? `${fmtComboNum(totReadSample, 0)} 次` : '—',
      },
    ];
    const noteTrafficSegments: StackedBarSegment[] = [
      { key: 'natural', label: '自然流量 (蒲公英沉淀)', color: '#2c7168' },
      { key: 'promo', label: '商业推广 (聚光+信息流)', color: '#8273a3' },
      { key: 'heating', label: '加热流 (官方粉推)', color: '#b88a45' },
    ];

    // Creator funnel elimination reasons
    const eliminationBarData: ChartDatum[] = [
      { label: '广告感过强/口条念稿不自然', value: 42, color: '#bd7964', detail: '淘汰 42 位 (22.2%)' },
      { label: '受众画像不符(大童/男粉高/年龄过低)', value: 36, color: '#b88a45', detail: '淘汰 36 位 (19.0%)' },
      { label: '数据表现不佳(完播低/疑似刷量)', value: 33, color: '#8273a3', detail: '淘汰 33 位 (17.5%)' },
      { label: '内容调性不符(纯手工/纯宠物/不搭食物)', value: 28, color: '#4d8b80', detail: '淘汰 28 位 (14.8%)' },
      { label: '商务因素(报价虚高/性价比低/不降价)', value: 22, color: '#64748b', detail: '淘汰 22 位 (11.6%)' },
      { label: '档期冲突或已被竞品品牌排期占位', value: 16, color: '#94a3b8', detail: '淘汰 16 位 (8.5%)' },
      { label: '形式受限(不接受口播/无配音纯沉浸)', value: 12, color: '#cbd5e1', detail: '淘汰 12 位 (6.3%)' },
    ];

    // CID Clicks Data (derived dynamically from wipes-cid-full-attribution-table)
    const cidColors = ['#2c7168', '#8273a3', '#b88a45', '#bd7964', '#4d8b80', '#64748b', '#94a3b8', '#cbd5e1', '#4d8b80', '#8273a3'];
    const cidClicksData: ChartDatum[] = (cidTable?.rows || [])
      .filter((r) => String(r.creator) !== '总计')
      .map((r, idx) => {
        const clicks = parseFiniteNum(r.component_clicks);
        const sp = parseFiniteNum(r.spend);
        const ord = parseFiniteNum(r.orders_30d);
        const gmv = parseFiniteNum(r.gmv_30d);
        const roi = parseFiniteNum(r.roi_30d);
        const name = String(r.creator || '');
        const label = ord && ord > 0 ? `${name} (${ord}单 / GMV ¥${gmv} / ROI ${roi})` : name;
        return {
          label,
          value: clicks,
          color: cidColors[idx % cidColors.length],
          detail: `消耗 ¥${fmtComboNum(sp)} · 点击 ${fmtComboNum(clicks, 0)}次`,
        };
      });

    return (
      <div className="wipes-rich-container">
        <div className="wipes-rich-header">
          <div className="wipes-rich-header-title">
            <span className="wipes-rich-tag">全景深透看板</span>
            <span>稳健玉米消毒湿巾专项：全渠道投流、跨端漏斗与深层飞书底表透视</span>
          </div>
          <div className="wipes-rich-notice">
            *全店GMV包含自然流量与跨渠道成交，不作广告直接ROI；站外活跃UV为小红星30天后验归因
          </div>
        </div>

        {/* Global Key Metrics Strip */}
        <MetricStrip items={metricStripItems} />

        {/* =========================================================================
            第一层（重 · 双轨预算账本、全渠道花费与 11 项 KPI 达成矩阵）
           ========================================================================= */}
        <div className="wipes-layer-divider">
          <span className="wipes-layer-badge" style={{ background: '#2c7168' }}>第一层 · 重</span>
          <span className="wipes-layer-title">双轨预算账本、全渠道花费与 11 项 KPI 达成矩阵</span>
        </div>

        {/* Panel 1: KPI Goals vs Actuals Matrix */}
        <ChartPanel
          title="KPI目标与实绩全量达成矩阵"
          subtitle="源表最新底表核算（日常种草7项 + 医生专家4项），按成本越低越优、规模越高越优双向判定"
        >
          <div className="wipes-rich-grid-3">
            {kpiRows.map((kpi, idx) => {
              const statusBadge =
                kpi.isSurpassed === true
                  ? { text: '超额/达标', cls: 'surpassed' }
                  : kpi.isSurpassed === false
                  ? { text: '滞后/超支', cls: 'lagging' }
                  : { text: '待核验', cls: 'pending' };

              const achNum = parseFiniteNum(kpi.calculatedAchievementPct);
              const fillPct = achNum !== null ? Math.min(achNum, 100) : 0;
              return (
                <div key={idx} className="wipes-kpi-card">
                  <div className="wipes-kpi-head">
                    <span className="wipes-kpi-name">
                      [{kpi.dimension}] {kpi.metric}
                    </span>
                    <span className={`wipes-kpi-badge ${statusBadge.cls}`}>
                      {statusBadge.text}
                    </span>
                  </div>
                  <div className="wipes-kpi-values">
                    <div className="wipes-kpi-actual">实绩: {kpi.rawActual}</div>
                    <div className="wipes-kpi-target">目标: {kpi.rawTarget}</div>
                  </div>
                  <div className="wipes-kpi-progress-bar">
                    <div
                      className={`wipes-kpi-progress-fill ${statusBadge.cls}`}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                  <div className="wipes-kpi-footer">
                    <span>达成率: {kpi.calculatedAchievementPct || kpi.sourceProgress || '--'}</span>
                    <span>{kpi.subChannel ? `渠道: ${kpi.subChannel}` : ''}</span>
                  </div>
                  {kpi.auditNote && <div className="wipes-kpi-note">*{kpi.auditNote}</div>}
                </div>
              );
            })}
          </div>
        </ChartPanel>

        {/* Panel 2: Budget Dual-Track Visualization */}
        <ChartPanel
          title="预算双轨结构对比（打款账本 vs 可消耗账本）"
          subtitle="对比客户打款口径与实际可消耗口径下各费用类目的规划预算与实际支出"
        >
          <CampaignComboChart
            rows={budgetPairs}
            series={budgetComboSeries}
            xKey="category"
            title="各费用类目预算与支出对比（双账本独立核算）"
            height={280}
          />

          <div className="wipes-rich-grid-2" style={{ marginTop: '14px' }}>
            <div className="wipes-info-card">
              <div className="wipes-info-title">
                <span>客户打款账本进度</span>
              </div>
              <div className="wipes-info-stat">
                ¥{fmtComboNum(clientTotal?.spent)} / ¥{fmtComboNum(clientTotal?.budget)}
              </div>
              <div className="wipes-info-desc">
                <p><strong>• 累计消耗进度：</strong>{String(clientTotal?.spentRate ?? '--')}</p>
                <p><strong>• 剩余预算额度：</strong>¥{fmtComboNum(clientTotal?.remaining)}</p>
              </div>
            </div>

            <div className="wipes-info-card">
              <div className="wipes-info-title">
                <span>实际可消耗账本进度</span>
              </div>
              <div className="wipes-info-stat">
                ¥{fmtComboNum(usableTotal?.spent)} / ¥{fmtComboNum(usableTotal?.budget)}
              </div>
              <div className="wipes-info-desc">
                <p><strong>• 累计消耗进度：</strong>{String(usableTotal?.spentRate ?? '--')}</p>
                <p><strong>• 剩余预算额度：</strong>¥{fmtComboNum(usableTotal?.remaining)}</p>
              </div>
            </div>
          </div>

          <details style={{ marginTop: '12px', cursor: 'pointer', fontSize: '13px', color: '#475569' }}>
            <summary style={{ padding: '6px 0', fontWeight: 600 }}>查看费用类目双轨明细表</summary>
            <table className="wipes-summary-table" style={{ marginTop: '8px' }}>
              <thead>
                <tr>
                  <th>费用类目</th>
                  <th>打款预算</th>
                  <th>打款已用</th>
                  <th>打款进度</th>
                  <th>可消耗预算</th>
                  <th>可消耗已用</th>
                </tr>
              </thead>
              <tbody>
                {budgetPairs.map((p, i) => (
                  <tr key={i}>
                    <td>{p.category}</td>
                    <td>¥{fmtComboNum(p.clientBudget)}</td>
                    <td>¥{fmtComboNum(p.clientSpent)}</td>
                    <td>{p.clientRate}</td>
                    <td>¥{fmtComboNum(p.usableBudget)}</td>
                    <td>¥{fmtComboNum(p.usableSpent)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 'bold', background: '#f8fafc' }}>
                  <td>总计</td>
                  <td>¥{fmtComboNum(clientTotal?.budget)}</td>
                  <td>¥{fmtComboNum(clientTotal?.spent)}</td>
                  <td>{String(clientTotal?.spentRate ?? '--')}</td>
                  <td>¥{fmtComboNum(usableTotal?.budget)}</td>
                  <td>¥{fmtComboNum(usableTotal?.spent)}</td>
                </tr>
              </tbody>
            </table>
          </details>

          <div className="wipes-attribution-callout" style={{ marginTop: '12px' }}>
            <strong>账本说明：</strong>打款口径与可消耗口径为两套独立核算账本，不可跨账本累加。发布数据追踪截至10/12，投流数据按T-1更新。
          </div>
        </ChartPanel>

        {/* Panel 3: Channel Spend Structure */}
        <ChartPanel
          title="全渠道费用构成与份额分布（K/F/S/CID）"
          subtitle="淘搜底表全量36天对账（¥369,798.36），各渠道消耗与份额按源表记录动态呈现"
        >
          <div className="wipes-rich-grid-2">
            <DonutChart
              data={channelDonutData}
              unit="元"
              centerLabel="总支出 ¥369,798"
            />
            <div className="wipes-rich-grid-2">
              {channelRows.map((c, i) => (
                <div key={i} className="wipes-info-card">
                  <div className="wipes-info-title">
                    <span className="wipes-rich-tag" style={{ background: i === 0 ? '#8273a3' : i === 1 ? '#2c7168' : i === 2 ? '#b88a45' : '#bd7964' }}>
                      {String(c.channel ?? '')}端
                    </span>
                    <span>{String(c.channelName ?? '')}</span>
                  </div>
                  <div className="wipes-info-stat" style={{ fontSize: '20px' }}>¥{fmtComboNum(c.spend)}</div>
                  <div className="wipes-info-desc">
                    <p><strong>占比：</strong>{String(c.share ?? '--')}</p>
                    <p><strong>定位：</strong>{String(c.role ?? '--')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartPanel>

        {/* =========================================================================
            第二层（重 · 小红书种草→淘宝星河→CID 跨端全链路漏斗）
           ========================================================================= */}
        <div className="wipes-layer-divider">
          <span className="wipes-layer-badge" style={{ background: '#8273a3' }}>第二层 · 重</span>
          <span className="wipes-layer-title">小红书种草 → 淘宝星河 → CID 跨端全链路转化漏斗</span>
        </div>

        {/* Panel 4: Cross-Platform Full Funnel */}
        <ChartPanel
          title="跨端全链路转化漏斗（小红书曝光 → 阅读 → 互动 → 小红星活跃UV → 手淘进店 → 单品成交）"
          subtitle="打通小红书种草端、小红星30天后验归因与手淘星河电商进店及购买链路"
        >
          <CampaignFunnelChart stages={funnelStages} />

          <div className="wipes-funnel-stat-grid">
            <div className="wipes-info-card">
              <div className="wipes-info-title">曝光转阅读 CTR</div>
              <div className="wipes-info-stat" style={{ color: '#2c7168' }}>13.68%</div>
              <div className="wipes-info-desc">84.9万阅读/点击，高出快消湿巾品类均值 1.8倍</div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">深度互动成本 CPE</div>
              <div className="wipes-info-stat" style={{ color: '#8273a3' }}>¥5.95</div>
              <div className="wipes-info-desc">日常种草CPE 9.47元，医生专家CPE 5.26元</div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">外溢获客成本 CPUV</div>
              <div className="wipes-info-stat" style={{ color: '#b88a45' }}>¥8.00</div>
              <div className="wipes-info-desc">产生 21,085 站外活跃UV，优于≤10元考核线</div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">站外UV进店转化率</div>
              <div className="wipes-info-stat" style={{ color: '#bd7964' }}>57.85%</div>
              <div className="wipes-info-desc">12,197人直接进店，手淘搜索再回流 4,844人</div>
            </div>
          </div>

          <details className="wipes-details-box">
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#334155' }}>查看跨端全链路转化漏斗明细与归因口径表</summary>
            <table className="wipes-summary-table" style={{ marginTop: '8px' }}>
              <thead>
                <tr>
                  <th>链路阶段</th>
                  <th>端归属</th>
                  <th>核心指标</th>
                  <th>实绩数值</th>
                  <th>流转转化率</th>
                  <th>成本指标</th>
                  <th>归因口径说明</th>
                </tr>
              </thead>
              <tbody>
                {(fullFunnelTable?.rows || []).map((r, i) => (
                  <tr key={i}>
                    <td><strong>{String(r.stageName || '')}</strong></td>
                    <td>{String(r.platform || '')}</td>
                    <td>{String(r.metricName || '')}</td>
                    <td>{typeof r.metricValue === 'number' ? fmtComboNum(r.metricValue) : String(r.metricValue || '')} {String(r.metricUnit || '')}</td>
                    <td>{String(r.conversionRate || '')}</td>
                    <td>{String(r.costEfficiency || '')}</td>
                    <td style={{ fontSize: '11px', color: '#64748b' }}>{String(r.attributionRule || '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </ChartPanel>

        {/* Panel 5: Taobao Xinghe E-commerce Attribution */}
        <ChartPanel
          title={`淘宝星河：手淘搜索曝光进店与全店GMV走势（共 ${xingheRows.length} 天）`}
          subtitle="全店GMV为淘宝全店总成交额，任务单品GMV为玉米湿巾直接成交"
        >
          <CampaignComboChart
            rows={xingheRows}
            series={xingheSeries}
            xKey="date"
            title="淘宝星河投放消耗与进店GMV宏观走势"
            height={300}
          />
          <div className="wipes-attribution-callout" style={{ marginTop: '12px' }}>
            <strong>数据说明：</strong>全店成交GMV(累计¥74,489.30)包含自然搜索与多渠道转化，不作广告直接ROI。10/8起加大投流后，笔记进店UV（累计12,197人）与手淘搜索进店UV（累计4,844人）保持正向关联，全店新客占比稳定在50%~80%，任务单品直接成交GMV为¥8,741.81。
          </div>
        </ChartPanel>

        {/* Panel 6: CID Attribution */}
        <ChartPanel
          title="CID 跨端直投：10位博主淘系引流与成交追踪"
          subtitle="通过CID链路引导受众直接跳转手淘购买，累计消耗¥2,881.17，产生105次有效组件点击"
        >
          <div className="wipes-rich-grid-2">
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                10位CID达人手淘组件点击量排行
              </div>
              <HorizontalBarChart data={cidClicksData} unit="次" height={260} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="wipes-info-card">
                <div className="wipes-info-title">
                  <span className="wipes-rich-tag" style={{ background: '#2c7168' }}>唯一出单博主</span>
                  <span>宸妈妈 (素人KOC)</span>
                </div>
                <div className="wipes-info-stat" style={{ color: '#2c7168' }}>1单 · ¥25.55</div>
                <div className="wipes-info-desc">
                  <p><strong>• 消耗支出：</strong>¥632.74 (CID投流)</p>
                  <p><strong>• 组件点击：</strong>21次 (全案最高点击)</p>
                  <p><strong>• 30天直接ROI：</strong>0.0404</p>
                </div>
              </div>
              <div className="wipes-attribution-callout">
                <strong>CID分析：</strong>CID跨端直投目前处于轻量测试期（总预算2,881元占全案0.8%），受淘系多链路长周期归因影响，绝大多数用户在小红书被种草后倾向于返回手淘主动搜索品牌，故手淘搜索进店（4,844人）是更为显著的外溢承接渠道。
              </div>
            </div>
          </div>
        </ChartPanel>

        {/* =========================================================================
            第三层（中重 · 五阶段 Sprint 演进与搜索/人群定向引擎）
           ========================================================================= */}
        <div className="wipes-layer-divider">
          <span className="wipes-layer-badge" style={{ background: '#b88a45' }}>第三层 · 中重</span>
          <span className="wipes-layer-title">五阶段 Sprint 演进与搜索/人群定向引擎</span>
        </div>

        {/* Panel 7: Weekly Progression */}
        <ChartPanel
          title={`各阶段消耗与访客成本对比（共 ${weeklyRows.length} 期 Sprint 演进）`}
          subtitle="源表第5期行标为10/13-10/29规划窗口，实测加总截止10/19共7天（消耗¥76,964，日均¥10,995/天）"
        >
          <CampaignComboChart
            rows={weeklyRows}
            series={weeklySeries}
            xKey="sourcePeriod"
            title="各阶段消耗与CPUV走势"
            height={280}
          />
          <div className="wipes-rich-grid-3" style={{ marginTop: '14px' }}>
            <div className="wipes-info-card">
              <div className="wipes-info-title">W1~W3 早期投放阶段（9/16~10/5）</div>
              <div className="wipes-info-desc">
                CPUV从冷启动W1的¥28.17下降至W3的¥4.29（记录周期最低点），日均消耗保持在2.5k~4.1k，累计获取9,462站外活跃UV。
              </div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">W4 节后执行阶段（10/6~10/12）</div>
              <div className="wipes-info-desc">
                10/6~10/12达人集中发布，互动量达5,996次，CPE为¥5.75，阶段记录CPUV为¥45.13。
              </div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">W5 大促加速阶段（10/13~10/19）</div>
              <div className="wipes-info-desc">
                7天实际消耗¥76,964（日均¥10,995/天），CPUV处于¥14.40区间，单周对应站外活跃UV 5,345。
              </div>
            </div>
          </div>
        </ChartPanel>

        {/* Panel 8: Search Keyword Pareto Engine */}
        <ChartPanel
          title="搜索枢纽：四大搜索词类构成与 Top 12 关键词 Pareto 分析"
          subtitle="淘搜大盘52个关键词聚合，头部核心词承接大部分搜索回流"
        >
          <div className="wipes-rich-grid-4" style={{ marginBottom: '14px' }}>
            {catRows.map((cat, i) => (
              <div key={i} className="wipes-info-card">
                <div className="wipes-info-title">
                  <span className="wipes-rich-tag" style={{ background: i === 0 ? '#2c7168' : i === 1 ? '#8273a3' : i === 2 ? '#b88a45' : '#bd7964' }}>
                    {String(cat.category || '')}
                  </span>
                </div>
                <div className="wipes-info-stat" style={{ fontSize: '18px' }}>¥{fmtComboNum(cat.spend)}</div>
                <div className="wipes-info-desc">
                  <p><strong>• 点击量：</strong>{fmtComboNum(cat.clicks)}次</p>
                  <p><strong>• 均客CPUV：</strong>¥{fmtComboNum(cat.cpuv)}</p>
                </div>
              </div>
            ))}
          </div>

          <CampaignComboChart
            rows={top12Pareto}
            series={paretoSeries}
            xKey="keyword"
            title="Top 12 核心搜索词消耗与累计份额 Pareto 曲线"
            height={280}
          />
        </ChartPanel>

        {/* Panel 9: 31 Audience Packages Scatter */}
        <ChartPanel
          title="定向引擎：31个定向人群包消费与 CPUV 效率分布"
          subtitle="气泡大小对应站外活跃UV规模，X轴为投流消耗，Y轴为访客成本CPUV"
        >
          <ScatterChart
            data={audienceScatterData}
            xLabel="消耗金额 (元)"
            yLabel="访客成本 CPUV (元/人)"
          />
          <div className="wipes-attribution-callout" style={{ marginTop: '12px' }}>
            <strong>人群洞察：</strong>【全棉&稳健核心人群】在各大定向中表现最为优异，以¥10,028消耗带来CPUV仅¥4.40的极佳转化；【电商人群(湿纸巾)】与【环清-婴幼呵护党】在流感季场景下展现出极高互动转化率。
          </div>
        </ChartPanel>

        {/* =========================================================================
            第四层（中 · 达人层级 × 内容方向 × 人群矩阵与流量来源拆解）
           ========================================================================= */}
        <div className="wipes-layer-divider">
          <span className="wipes-layer-badge" style={{ background: '#bd7964' }}>第四层 · 中</span>
          <span className="wipes-layer-title">达人层级 × 内容方向 × 人群矩阵与流量来源拆解</span>
        </div>

        {/* Panel 10: Creator Tier Spending Breakdown */}
        <ChartPanel
          title="4大达人层级费用构成（K端达人费 vs FS投流加热费）"
          subtitle="专家(3篇) + 腰部(3篇) + 尾部(24篇) + KOC(86篇) 双轨费用堆叠结构"
        >
          <StackedHorizontalBarChart
            rows={tierStackedRows}
            segments={tierStackedSegments}
            unit="元"
          />
          <div className="wipes-rich-grid-4" style={{ marginTop: '14px' }}>
            <div className="wipes-info-card">
              <div className="wipes-info-title">医学专家 (3篇)</div>
              <div className="wipes-info-stat" style={{ fontSize: '18px' }}>¥76,000</div>
              <div className="wipes-info-desc">权威背书，CPE ¥5.26超额达成目标</div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">腰部KOL (3篇)</div>
              <div className="wipes-info-stat" style={{ fontSize: '18px' }}>¥54,840</div>
              <div className="wipes-info-desc">打造破圈标杆，贡献高赞藏爆文</div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">尾部KOL (24篇)</div>
              <div className="wipes-info-stat" style={{ fontSize: '18px' }}>¥137,508</div>
              <div className="wipes-info-desc">主力消耗中坚，投流加热重点倾斜</div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">素人KOC (86篇)</div>
              <div className="wipes-info-stat" style={{ fontSize: '18px' }}>¥75,334</div>
              <div className="wipes-info-desc">高性价比铺量，真实生活场景渗透</div>
            </div>
          </div>
        </ChartPanel>

        {/* Panel 11: Direction x Audience Heatmap */}
        <ChartPanel
          title="内容方向 × 精准定向人群 二维交叉效率热力矩阵"
          subtitle="提取自周报4S9Ojh及底表ntH2Mw，展示不同场景切角与人群包的消耗与CPUV表现"
        >
          <MatrixHeatmapChart
            rows={heatmapRows}
            cols={heatmapCols}
            cells={heatmapCells}
            unit="元"
            rowHeaderTitle="内容方向 \ 核心定向人群"
          />
        </ChartPanel>

        {/* Panel 12: Note Traffic Sources Structure */}
        <ChartPanel
          title="笔记流量来源拆解（自然流量 vs 商业推广流量 vs 加热流量）"
          subtitle="从蒲公英数据底表qub0Zh与发布汇总提取，全案自然曝光占比超70%，沉淀健康长尾搜索资产"
        >
          <StackedHorizontalBarChart
            rows={noteTrafficStackedRows}
            segments={noteTrafficSegments}
            normalize100={true}
          />
          <div className="wipes-rich-grid-2" style={{ marginTop: '14px' }}>
            <div className="wipes-info-card">
              <div className="wipes-info-title">自然流量来源分布（发现页 vs 搜索页）</div>
              <div className="wipes-info-desc">
                <p><strong>• 发现页推荐：</strong>占据自然曝光的 85%~98%，驱动笔记冷启动与泛母婴人群触达。</p>
                <p><strong>• 搜索页承接：</strong>占据自然曝光的 2%~15%，在流感季与餐具消毒高意向词下形成持续搜索回流。</p>
              </div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">爆文率与互动表现（互动量≥1000判定）</div>
              <div className="wipes-info-desc">
                <p><strong>• 爆文达成率：</strong>全案爆文率达 33.33%（目标 30%），超额达成KPI考核。</p>
                <p><strong>• 代表爆文：</strong>按快门的糖爸、大婉儿和小雅、汤圆很社会等产出超千赞藏互动笔记。</p>
              </div>
            </div>
          </div>
        </ChartPanel>

        {/* =========================================================================
            第五层（轻 · 达人选号漏斗、三甲医生授权池与卡审质检）
           ========================================================================= */}
        <div className="wipes-layer-divider">
          <span className="wipes-layer-badge" style={{ background: '#4d8b80' }}>第五层 · 轻</span>
          <span className="wipes-layer-title">达人选号淘汰漏斗、三甲医生授权池与卡审质检</span>
        </div>

        {/* Panel 13: Creator Selection Funnel */}
        <ChartPanel
          title="达人选号全流程淘汰漏斗与未合作原因分布"
          subtitle="提报初筛池baaf26 (370人) → 二核意愿vliKvB (131人) → 终选定档履约 (116人)"
        >
          <div className="wipes-rich-grid-4" style={{ marginBottom: '14px' }}>
            <div className="wipes-info-card">
              <div className="wipes-info-title">1. 初筛提报池</div>
              <div className="wipes-info-stat" style={{ fontSize: '20px' }}>370 位</div>
              <div className="wipes-info-desc">全网海选亲子母婴及健康博主</div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">2. 品牌初筛通过</div>
              <div className="wipes-info-stat" style={{ fontSize: '20px' }}>180 位</div>
              <div className="wipes-info-desc">初筛通过率 48.65% (淘汰190位)</div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">3. 二询意向达成</div>
              <div className="wipes-info-stat" style={{ fontSize: '20px' }}>131 位</div>
              <div className="wipes-info-desc">二询达成率 72.78% (锁定排期与脚本)</div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">4. 最终定档合作</div>
              <div className="wipes-info-stat" style={{ fontSize: '20px', color: '#2c7168' }}>116 篇</div>
              <div className="wipes-info-desc">全案留存率 31.35% (100%履约交付)</div>
            </div>
          </div>

          <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
            7大核心淘汰原因分布排行
          </div>
          <HorizontalBarChart data={eliminationBarData} unit="位" height={220} />

          <details className="wipes-details-box">
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#334155' }}>查看达人选号漏斗与履约明细表</summary>
            <table className="wipes-summary-table" style={{ marginTop: '8px' }}>
              <thead>
                <tr>
                  <th>筛选阶段</th>
                  <th>入围人数</th>
                  <th>阶段通过率</th>
                  <th>累计留存率</th>
                  <th>淘汰人数</th>
                  <th>核心淘汰原因或推进动作</th>
                </tr>
              </thead>
              <tbody>
                {(creatorFunnelTable?.rows || []).map((r, i) => (
                  <tr key={i}>
                    <td><strong>{String(r.stageName || '')}</strong></td>
                    <td>{typeof r.candidateCount === 'number' ? r.candidateCount : String(r.candidateCount || '')} 人</td>
                    <td>{String(r.stagePassRate || '')}</td>
                    <td>{String(r.cumRetentionRate || '')}</td>
                    <td>{typeof r.eliminatedCount === 'number' ? r.eliminatedCount : String(r.eliminatedCount || '')} 人</td>
                    <td style={{ fontSize: '11px', color: '#64748b' }}>{String(r.keyReasonOrAction || '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </ChartPanel>

        {/* Panel 14: Doctor Hospital Pool */}
        <ChartPanel
          title="三甲医院医生专家背书候选池与授权边界质检"
          subtitle="提取自在线表44AKMG，三甲综合与妇幼专科占比超90%，严格把控医疗合规红线"
        >
          <div className="wipes-rich-grid-3">
            <div className="wipes-info-card">
              <div className="wipes-info-title">三甲医院等级构成</div>
              <div className="wipes-info-stat" style={{ fontSize: '20px', color: '#2c7168' }}>三甲占比 95%</div>
              <div className="wipes-info-desc">三甲综合 55%（湘雅二院、暨大附一、浙立同德）+ 三甲妇幼儿童专科 40%（深圳儿童医院、罗湖妇幼）</div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">授权范围与期限管控</div>
              <div className="wipes-info-stat" style={{ fontSize: '20px', color: '#8273a3' }}>站内原生流 3个月</div>
              <div className="wipes-info-desc">100%严格限定小红书站内信息流投放，严禁二剪、严禁转出站外直发，全面规避肖像侵权风险</div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">定档履约成单率</div>
              <div className="wipes-info-stat" style={{ fontSize: '20px', color: '#b88a45' }}>3位 100% 履约</div>
              <div className="wipes-info-desc">硕士妈妈黄慧、刘慧教授说健康、沈主任有点忙，高质过审发布并贡献超万次互动</div>
            </div>
          </div>

          <details className="wipes-details-box">
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#334155' }}>查看医生专家候选池明细表（已脱敏）</summary>
            <table className="wipes-summary-table" style={{ marginTop: '8px' }}>
              <thead>
                <tr>
                  <th>专家昵称</th>
                  <th>所在医院及科室</th>
                  <th>医院级别</th>
                  <th>所属地域</th>
                  <th>报价金额</th>
                  <th>推进状态</th>
                  <th>素材使用授权边界</th>
                </tr>
              </thead>
              <tbody>
                {(doctorPoolTable?.rows || []).map((r, i) => (
                  <tr key={i}>
                    <td><strong>{String(r.doctorAlias || '')}</strong></td>
                    <td>{String(r.hospital || '')}</td>
                    <td><span className="wipes-rich-tag" style={{ background: '#2c7168' }}>{String(r.hospitalTier || '')}</span></td>
                    <td>{String(r.region || '')}</td>
                    <td>¥{fmtComboNum(r.quotePrice)}</td>
                    <td>{String(r.progressStatus || '')}</td>
                    <td style={{ fontSize: '11px', color: '#64748b' }}>{String(r.licenseTerms || '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </ChartPanel>

        {/* Panel 15: Review Blockers Quality Assurance */}
        <ChartPanel
          title="商业投放笔记卡审合规质检与过审响应跟踪"
          subtitle="提取自卡审跟踪底表yYmwWo，针对医药合规两大约束实现A级响应与100%过审"
        >
          <div className="wipes-rich-grid-2">
            <div className="wipes-info-card">
              <div className="wipes-info-title">
                <span className="wipes-rich-tag" style={{ background: '#bd7964' }}>典型卡审点 1</span>
                <span>疾病临床症状违规</span>
              </div>
              <div className="wipes-info-desc">
                <p><strong>• 涉审博主：</strong>汤圆很社会 (6aa7e3a6...)</p>
                <p><strong>• 驳回原因：</strong>文案提及具体病症，触发平台疾病/临床/负面症状规定。</p>
                <p><strong>• 整改措施：</strong>易美运营迅速协同博主调整为生活化清洁场景，当天完成修改并重新过审。</p>
              </div>
            </div>

            <div className="wipes-info-card">
              <div className="wipes-info-title">
                <span className="wipes-rich-tag" style={{ background: '#b88a45' }}>典型卡审点 2</span>
                <span>绝对化/未报备认证违规</span>
              </div>
              <div className="wipes-info-desc">
                <p><strong>• 涉审博主：</strong>养个小土豆 (6aabfe76...)</p>
                <p><strong>• 驳回原因：</strong>视频画面露出【医护级认证】标识，未提前走资质白名单审核。</p>
                <p><strong>• 整改措施：</strong>对画面特写进行打码弱化重新剪辑上传，次日顺利过审并正常投流。</p>
              </div>
            </div>
          </div>

          <details className="wipes-details-box">
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#334155' }}>查看卡审记录明细与201篇笔记流量底表</summary>
            <table className="wipes-summary-table" style={{ marginTop: '8px' }}>
              <thead>
                <tr>
                  <th>卡审时间</th>
                  <th>涉审达人</th>
                  <th>合规风险分类</th>
                  <th>平台驳回原因明细</th>
                  <th>整改处置措施</th>
                  <th>过审时间</th>
                  <th>优先级</th>
                  <th>整改响应时效</th>
                </tr>
              </thead>
              <tbody>
                {(reviewBlockersTable?.rows || []).map((r, i) => (
                  <tr key={i}>
                    <td>{String(r.blockerDate || '')}</td>
                    <td><strong>{String(r.creator || '')}</strong></td>
                    <td><span className="wipes-rich-tag" style={{ background: '#bd7964' }}>{String(r.riskCategory || '')}</span></td>
                    <td style={{ fontSize: '11px' }}>{String(r.blockerReason || '')}</td>
                    <td style={{ fontSize: '11px', color: '#2c7168' }}>{String(r.modifyProgress || '')}</td>
                    <td>{String(r.resolvedDate || '')}</td>
                    <td>{String(r.feedPriority || '')}</td>
                    <td><strong>{String(r.turnaroundHours || '')}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </ChartPanel>
      </div>
    );
  }

  // =========================================================================
  // SECTION: ADS (搜索与人群)
  // =========================================================================
  if (section === 'ads') {
    const rawKwRows = (kwDetailTable?.rows || [])
      .filter((r) => String(r.keyword) !== '总计')
      .map((r) => ({
        keyword: String(r.keyword || ''),
        category: String(r.category || ''),
        spend: parseFiniteNum(r.spend),
        impressions: parseFiniteNum(r.impressions),
        clicks: parseFiniteNum(r.clicks),
        uv: parseFiniteNum(r.uv),
        cpuv: parseFiniteNum(r.cpuv),
        cpm: parseFiniteNum(r.cpm),
      }))
      .sort((a, b) => (b.spend || 0) - (a.spend || 0));

    const totalKwSpend = rawKwRows.reduce((sum, r) => sum + (r.spend || 0), 0);
    const paretoKwRows = rawKwRows.map((r, idx) => {
      const prefixSpend = rawKwRows.slice(0, idx + 1).reduce((sum, item) => sum + (item.spend || 0), 0);
      const cumPct = totalKwSpend > 0 ? roundNum((prefixSpend / totalKwSpend) * 100, 1) : 0;
      return {
        ...r,
        cumSpendShare: cumPct,
      };
    });

    const top12Pareto = paretoKwRows.slice(0, 12);
    const paretoSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗金额', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'cumSpendShare', label: '累计消耗占比', unit: '%', axis: 'right', kind: 'line', color: '#b88a45' },
    ];

    const catRows = (kwCatTable?.rows || []).filter((r) => String(r.category) !== '总计');

    const audienceRows = (audienceTable?.rows || [])
      .filter((r) => String(r.packageName) !== '总计')
      .map((r) => ({
        ...r,
        packageName: String(r.packageName || ''),
        shortName: String(r.packageName || '').replace(/^人群包-/, ''),
        spend: parseFiniteNum(r.spend),
        uv: parseFiniteNum(r.uv),
        cpuv: parseFiniteNum(r.cpuv),
      }))
      .sort((a, b) => (b.spend || 0) - (a.spend || 0));

    const filteredAudiences = audienceCostFilter === 'all'
      ? audienceRows
      : audienceCostFilter === 'low_cpuv'
      ? audienceRows.filter((r) => r.cpuv !== null && r.cpuv <= 20)
      : audienceCostFilter === 'high_cpuv'
      ? audienceRows.filter((r) => r.cpuv !== null && r.cpuv > 20)
      : audienceRows.filter((r) => (r.uv || 0) > 0);

    const audienceSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗金额', unit: '元', axis: 'left', kind: 'bar', color: '#8273a3' },
      { key: 'cpuv', label: '访客成本 (CPUV)', unit: '元/人', axis: 'right', kind: 'point', color: '#bd7964' },
    ];

    const placementRows = (placementTable?.rows || []).filter((r) => String(r.placement) !== '总计');

    return (
      <div className="wipes-rich-container">
        <div className="wipes-rich-header">
          <div className="wipes-rich-header-title">
            <span className="wipes-rich-tag">搜索与人群</span>
            <span>搜索关键词Pareto贡献度、四大词类效率与定向人群透视</span>
          </div>
          <div className="wipes-rich-notice">
            *人群包与关键词UV为各对象30日独立归因，受众存在交叉，不可直接累加。
          </div>
        </div>

        {/* Chart 1: True Pareto Chart */}
        <ChartPanel
          title="核心搜索关键词消耗与累计贡献 Pareto 分析 (Top 12)"
          subtitle="按单词消耗降序排列。展示头部关键词对总搜索支出的累计贡献比例 (Pareto曲线)"
        >
          <CampaignComboChart
            rows={top12Pareto}
            series={paretoSeries}
            xKey="keyword"
            title="Top 12 核心关键词消耗与累计贡献"
            height={300}
          />
        </ChartPanel>

        {/* Chart 2: Keyword Categories Quadrant */}
        <ChartPanel
          title="四大搜索词类效果结构与指标对比"
          subtitle="对比品牌词、场景词、品类词与竞品词的曝光、点击、UV与成本效率"
        >
          <div className="wipes-rich-grid-4">
            {catRows.map((cat, i) => (
              <div key={i} className="wipes-info-card">
                <div className="wipes-info-title">
                  <span className="wipes-rich-tag" style={{ background: i === 0 ? '#2c7168' : i === 1 ? '#8273a3' : i === 2 ? '#b88a45' : '#bd7964' }}>
                    {String(cat.category ?? '')}
                  </span>
                </div>
                <div className="wipes-info-stat">¥{fmtComboNum(cat.spend)}</div>
                <div className="wipes-info-desc">
                  <p><strong>展现量：</strong>{fmtComboNum(cat.impressions)}</p>
                  <p><strong>归因UV：</strong>{fmtComboNum(cat.uv)} 人</p>
                  <p><strong>CPUV成本：</strong>¥{cat.cpuv ? String(cat.cpuv) : '--'}</p>
                  <p><strong>CPM成本：</strong>¥{cat.cpm ? String(cat.cpm) : '--'}</p>
                </div>
              </div>
            ))}
          </div>
        </ChartPanel>

        {/* Chart 3: Audience Packages Filterable Chart */}
        <ChartPanel
          title="31定向人群包消耗与成本分布"
          subtitle="支持按成本区间（CPUV ≤ 20元 vs CPUV > 20元）或是否产生转化进行筛选查看"
          actions={
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>筛选条件:</span>
              <button
                className={`btn btn-sm ${audienceCostFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAudienceCostFilter('all')}
              >
                全部(31)
              </button>
              <button
                className={`btn btn-sm ${audienceCostFilter === 'low_cpuv' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAudienceCostFilter('low_cpuv')}
              >
                CPUV ≤ 20元
              </button>
              <button
                className={`btn btn-sm ${audienceCostFilter === 'high_cpuv' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAudienceCostFilter('high_cpuv')}
              >
                {'CPUV > 20元'}
              </button>
              <button
                className={`btn btn-sm ${audienceCostFilter === 'has_uv' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAudienceCostFilter('has_uv')}
              >
                有归因UV
              </button>
            </div>
          }
        >
          <CampaignComboChart
            rows={filteredAudiences.slice(0, 10)}
            series={audienceSeries}
            xKey="shortName"
            title="人群包消耗与访客成本分布"
            height={280}
          />
        </ChartPanel>

        {/* Chart 4: Placement Comparison */}
        <ChartPanel
          title="广告投放版位（视频内流 vs 搜索推广 vs 信息流推广）对比"
          subtitle="视频内流转化效率最优(CPUV ¥4.83)，搜索推广曝光成本最低(CPM ¥42.83)，信息流定向精准"
        >
          <table className="wipes-summary-table">
            <thead>
              <tr>
                <th>版位类型</th>
                <th>消耗金额</th>
                <th>展现量</th>
                <th>点击量</th>
                <th>互动量</th>
                <th>归因活跃UV</th>
                <th>CPM (元)</th>
                <th>CTR (%)</th>
                <th>CPUV (元)</th>
              </tr>
            </thead>
            <tbody>
              {placementRows.map((p, i) => (
                <tr key={i}>
                  <td><strong>{String(p.placement ?? '')}</strong></td>
                  <td>¥{fmtComboNum(p.spend)}</td>
                  <td>{fmtComboNum(p.impressions)}</td>
                  <td>{fmtComboNum(p.clicks)}</td>
                  <td>{fmtComboNum(p.interactions)}</td>
                  <td>{fmtComboNum(p.uv)}</td>
                  <td>¥{String(p.cpm ?? '--')}</td>
                  <td>{String(p.ctr ?? '--')}%</td>
                  <td><span className="wipes-kpi-badge surpassed">¥{String(p.cpuv ?? '--')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartPanel>
      </div>
    );
  }

  // =========================================================================
  // SECTION: CONTENT (内容与达人)
  // =========================================================================
  if (section === 'content') {
    const cidRows = (cidTable?.rows || []).map((r) => ({
      creator: String(r.creator || ''),
      spend: parseFiniteNum(r.spend),
      component_clicks: parseFiniteNum(r.component_clicks),
      cost_per_component_click: parseFiniteNum(r.cost_per_component_click),
      orders_30d: parseFiniteNum(r.orders_30d),
      gmv_30d: parseFiniteNum(r.gmv_30d),
      roi_30d: parseFiniteNum(r.roi_30d),
    }));

    const filteredCid = cidView === 'converters'
      ? cidRows.filter((r) => (r.orders_30d || 0) > 0)
      : cidRows;

    const cidSeries: ComboSeries[] = [
      { key: 'spend', label: 'CID消耗', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'component_clicks', label: '组件点击量', unit: '次', axis: 'right', kind: 'bar', color: '#8273a3' },
    ];

    const tierChartRows = (tierTable?.rows || [])
      .filter((r) => String(r.tier) !== '总计')
      .map((r) => ({
        tier: String(r.tier || ''),
        kFee: parseFiniteNum(r.kFee),
        fsSpend: parseFiniteNum(r.fsSpend),
        totalSpend: parseFiniteNum(r.totalSpend),
        engagements: parseFiniteNum(r.engagements),
        cpe: parseFiniteNum(r.cpe),
        fsCpuv: parseFiniteNum(r.fsCpuv),
      }));

    const tierSeries: ComboSeries[] = [
      { key: 'kFee', label: 'K端达人费', unit: '元', axis: 'left', kind: 'bar', color: '#b88a45' },
      { key: 'fsSpend', label: 'FS投流费', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'engagements', label: '总互动量', unit: '次', axis: 'right', kind: 'line', color: '#8273a3' },
    ];

    const directionChartRows = (directionTable?.rows || [])
      .filter((r) => String(r.direction) !== '总计')
      .map((r) => ({
        direction: String(r.direction || ''),
        totalSpend: parseFiniteNum(r.totalSpend),
        fsUv: parseFiniteNum(r.fsUv),
        fsCpuv: parseFiniteNum(r.fsCpuv),
        cpe: parseFiniteNum(r.cpe),
      }));

    const directionSeries: ComboSeries[] = [
      { key: 'totalSpend', label: '总消耗金额', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'fsUv', label: 'FS站外活跃UV', unit: '人', axis: 'right', kind: 'bar', color: '#8273a3' },
    ];

    return (
      <div className="wipes-rich-container">
        <div className="wipes-rich-header">
          <div className="wipes-rich-header-title">
            <span className="wipes-rich-tag">内容与达人</span>
            <span>CID 10位达人跨端引流追踪、4层级达人结构与5大内容方向对比</span>
          </div>
          <div className="wipes-rich-notice">
            *CID计划于10/16~10/19启动试跑；116篇达人笔记于10/12全量发布完毕。
          </div>
        </div>

        {/* Chart 1: CID 10 Creators */}
        <ChartPanel
          title="CID组件跨端直连：10位创作者消耗、点击与转化跟踪"
          subtitle="10/16~10/19试跑4天。总消耗¥2,881.17，组件点击105次。当前宸妈妈达成1笔归因订单(GMV ¥25.55)"
          actions={
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`btn btn-sm ${cidView === 'all' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCidView('all')}
              >
                全部10位创作者
              </button>
              <button
                className={`btn btn-sm ${cidView === 'converters' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCidView('converters')}
              >
                有成交订单 (宸妈妈)
              </button>
            </div>
          }
        >
          <CampaignComboChart
            rows={filteredCid}
            series={cidSeries}
            xKey="creator"
            title="CID创作者引流与成本分布"
            height={280}
          />
          <div className="wipes-attribution-callout" style={{ marginTop: '12px' }}>
            <strong>数据说明：</strong>全站智投占消耗91.6%（¥2,638.40，97次点击），信息流推广占8.4%（¥242.77，8次点击且产出1笔成交）。柚柚&果果(23次点击)、宸妈妈(34次点击)、我是小雪呀(22次点击)组件点击量排名前三。
          </div>
        </ChartPanel>

        {/* Chart 2: Creator Tiers Visual Combo Chart */}
        <ChartPanel
          title="达人4大层级投放投入与互动产出对比"
          subtitle="涵盖专家(3篇)、腰部KOL(3篇)、尾部KOL(24篇)、素人KOC(86篇)。对比K端达人费与FS投流费结构"
        >
          <CampaignComboChart
            rows={tierChartRows}
            series={tierSeries}
            xKey="tier"
            title="达人层级投入与产出对比"
            height={280}
          />
        </ChartPanel>

        {/* Chart 3: Content Direction Visual Combo Chart */}
        <ChartPanel
          title="5大内容方向消耗与产出对比"
          subtitle="居家清洁(31篇)、流感换季(31篇)、户外清洁(27篇)、大促囤货(24篇)、专家背书(3篇)"
        >
          <CampaignComboChart
            rows={directionChartRows}
            series={directionSeries}
            xKey="direction"
            title="内容方向消耗、归因UV与CPUV对比"
            height={280}
          />
        </ChartPanel>
      </div>
    );
  }

  return null;
}
