import os

code = """'use client';

import React, { useMemo } from 'react';
import type { CampaignDashboard, CampaignTable } from '../../lib/campaign-types';
import {
  ChartPanel,
  MetricStrip,
  HorizontalBarChart,
  DonutChart,
  CAMPAIGN_PALETTE,
  type ChartDatum,
  type MetricStripItem,
} from './CampaignCharts';
import { CampaignComboChart, type ComboSeries } from './CampaignComboChart';
import './meiling-rich-insights.css';

export interface MeilingRichInsightsProps {
  dashboard: CampaignDashboard;
  section: 'overview' | 'ads' | 'content';
  snapshot?: string;
}

export function parseNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const s = String(val).replace(/¥|,|%/g, '').trim();
  if (!s || s === '-' || s === '/' || s === 'null') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function formatNum(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return val.toLocaleString('zh-CN', { maximumFractionDigits: digits });
}

export function formatMoneyWan(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return (val / 10000).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '万';
}

export function MeilingRichInsights({ dashboard, section, snapshot }: MeilingRichInsightsProps) {
  const isHistory618 = snapshot === 'history-618';

  const tablesMap = useMemo(() => {
    const map = new Map<string, CampaignTable>();
    for (const t of dashboard.tables || []) {
      map.set(t.id, t);
    }
    return map;
  }, [dashboard.tables]);

  // Tables lookup
  const accountTable = tablesMap.get('meiling-enrich-account-budget-pacing');
  const modelPlanTable = tablesMap.get('meiling-enrich-double11-model-planning');
  const platformKpiTable = tablesMap.get('meiling-enrich-double11-platform-kpi-summary');
  const sampleMachineTable = tablesMap.get('meiling-enrich-sample-machine-progress');
  const keywordsTable = tablesMap.get('meiling-enrich-search-keywords-classification');
  const comparableDailyTable = tablesMap.get('meiling-enrich-channel-daily-comparable');
  const materialParetoTable = tablesMap.get('meiling-enrich-material-pareto-efficiency');
  const review618Table = tablesMap.get('meiling-enrich-618-procurement-roi-review');
  const kolTierTable = tablesMap.get('meiling-enrich-kol-tier-budget-stage');

  // A. Model Planning Dynamic Calculations
  const { modelPlanSeriesRows, modelPlanMetrics, modelPlanTotals } = useMemo(() => {
    const rows = modelPlanTable?.rows || [];
    const seriesAgg = new Map<string, { budget_wan: number; posts_plan: number; screen_prog: number; pub_prog: number; spend: number }>();
    
    let totalB = 0;
    let totalP = 0;
    let totalS = 0;
    let totalPub = 0;
    let totalSp = 0;

    for (const r of rows) {
      const ser = String(r.series || '').trim();
      const isTotal = ser.includes('合计') || String(r.model || '').includes('合计');
      const b = parseNum(r.budget_wan);
      const p = parseNum(r.posts_plan);
      const s = parseNum(r.screen_prog);
      const pub = parseNum(r.pub_prog);
      const sp = parseNum(r.spend);

      if (isTotal) {
        if (b !== null) totalB = b;
        if (p !== null) totalP = p;
        if (s !== null) totalS = s;
        if (pub !== null) totalPub = pub;
        if (sp !== null) totalSp = sp;
        continue;
      }

      if (!ser) continue;
      if (!seriesAgg.has(ser)) {
        seriesAgg.set(ser, { budget_wan: 0, posts_plan: 0, screen_prog: 0, pub_prog: 0, spend: 0 });
      }
      const cur = seriesAgg.get(ser)!;
      if (b !== null) cur.budget_wan += b;
      if (p !== null) cur.posts_plan += p;
      if (s !== null) cur.screen_prog += s;
      if (pub !== null) cur.pub_prog += pub;
      if (sp !== null) cur.spend += sp;
    }

    const comboRows = Array.from(seriesAgg.entries()).map(([k, v]) => ({
      series: k,
      budget_wan: v.budget_wan,
      posts_plan: v.posts_plan,
      screen_prog: v.screen_prog,
      spend: v.spend,
    }));

    const screenRate = totalP > 0 ? ((totalS / totalP) * 100).toFixed(1) : '—';
    const metrics: MetricStripItem[] = [
      { label: '双11原规划预算', value: totalB > 0 ? totalB.toFixed(2) : '—', unit: '万元', note: '9/28规划版(K+FS)' },
      { label: '规划合作篇数', value: totalP > 0 ? totalP : '—', unit: '篇', note: '规划内容总量' },
      { label: '初步筛选篇数', value: totalS > 0 ? totalS : '—', unit: '篇', note: `完成率 ${screenRate}%` },
      { label: '测试发布篇数', value: totalPub, unit: '篇', note: '前置投流验证' },
      { label: '测试投流消耗', value: totalSp > 0 ? (totalSp / 10000).toFixed(2) : '—', unit: '万元', note: '已发生测试花费' },
    ];

    return {
      modelPlanSeriesRows: comboRows,
      modelPlanMetrics: metrics,
      modelPlanTotals: { totalB, totalP, totalS, totalPub, totalSp },
    };
  }, [modelPlanTable]);

  const modelPlanComboSeries: ComboSeries[] = [
    { key: 'budget_wan', label: '规划预算', kind: 'bar', axis: 'left', color: CAMPAIGN_PALETTE.primary, unit: '万元' },
    { key: 'posts_plan', label: '规划篇数', kind: 'line', axis: 'right', color: CAMPAIGN_PALETTE.purple, unit: '篇' },
    { key: 'screen_prog', label: '初筛篇数', kind: 'line', axis: 'right', color: CAMPAIGN_PALETTE.gold, unit: '篇' },
  ];

  // B. Account Pacing Dual Bar Calculations
  const { accountComboRows, accountTotals } = useMemo(() => {
    const rows = accountTable?.rows || [];
    let sumPlan = 0;
    let sumReq = 0;
    const comboRows = [];
    for (const r of rows) {
      const rawName = String(r.account || '');
      const shortName = rawName.replace('美菱-26年双11-', '').replace('（易美）', '').replace('（易美星伴）', '');
      const bPlan = parseNum(r.budget_planned);
      const bReq = parseNum(r.actual_required_spend);
      if (bPlan !== null) sumPlan += bPlan;
      if (bReq !== null) sumReq += bReq;

      comboRows.push({
        account: shortName,
        budget_planned: bPlan,
        actual_required_spend: bReq,
      });
    }

    const gap = sumPlan - sumReq;
    return {
      accountComboRows: comboRows,
      accountTotals: { sumPlan, sumReq, gap, count: rows.length },
    };
  }, [accountTable]);

  const accountComboSeries: ComboSeries[] = [
    { key: 'budget_planned', label: '规划打款', kind: 'bar', axis: 'left', color: CAMPAIGN_PALETTE.primary, unit: '元' },
    { key: 'actual_required_spend', label: '实际应消耗', kind: 'bar', axis: 'left', color: CAMPAIGN_PALETTE.terracotta, unit: '元' },
  ];

  // C. Comparable Daily Dynamic Calculations
  const { comparableRows, comparableMetrics, comparableTotals } = useMemo(() => {
    const rows = comparableDailyTable?.rows || [];
    let sumTm = 0;
    let sumJd = 0;
    const cRows = [];
    for (const r of rows) {
      const d = String(r.date || '').replace('2026-', '');
      const tm = parseNum(r.tm_spend);
      const jd = parseNum(r.jd_spend);
      const ratio = parseNum(r.spend_ratio_jd_vs_tm);
      if (tm !== null) sumTm += tm;
      if (jd !== null) sumJd += jd;
      cRows.push({
        date: d,
        tm_spend: tm,
        jd_spend: jd,
        ratio: ratio,
      });
    }

    const overallRatio = sumTm > 0 ? (sumJd / sumTm).toFixed(2) : '—';
    const metrics: MetricStripItem[] = [
      { label: '可比统计天数', value: rows.length, unit: '天', note: '同周期重叠运营' },
      { label: '天猫自采可比消耗', value: formatMoneyWan(sumTm), unit: '', note: rows.length > 0 ? `日均 ${formatNum(sumTm / rows.length, 0)}元` : '' },
      { label: '京东自采可比消耗', value: formatMoneyWan(sumJd), unit: '', note: rows.length > 0 ? `日均 ${formatNum(sumJd / rows.length, 0)}元` : '' },
      { label: '京东/天猫消耗比', value: overallRatio, unit: 'x', note: '双平台可比总消耗比值' },
    ];

    const startDate = rows.length > 0 ? String(rows[0].date || '') : '';
    const endDate = rows.length > 0 ? String(rows[rows.length - 1].date || '') : '';

    return {
      comparableRows: cRows,
      comparableMetrics: metrics,
      comparableTotals: { sumTm, sumJd, overallRatio, startDate, endDate, days: rows.length },
    };
  }, [comparableDailyTable]);

  const comparableComboSeries: ComboSeries[] = [
    { key: 'tm_spend', label: '天猫自采消耗', kind: 'bar', axis: 'left', color: CAMPAIGN_PALETTE.purple, unit: '元' },
    { key: 'jd_spend', label: '京东自采消耗', kind: 'bar', axis: 'left', color: CAMPAIGN_PALETTE.primary, unit: '元' },
    { key: 'ratio', label: '京东/天猫消耗比', kind: 'line', axis: 'right', color: CAMPAIGN_PALETTE.gold, unit: 'x' },
  ];

  // D. True Material Pareto Dynamic Calculations
  const { materialParetoRows, materialMetrics, materialTotals } = useMemo(() => {
    const rows = materialParetoTable?.rows || [];
    let totalSpend = 0;
    for (const r of rows) {
      totalSpend += parseNum(r.spend) || 0;
    }

    let cumSpend = 0;
    const paretoRows = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rawName = String(r.material_name || `素材-${r.note_id || i}`);
      const shortName = rawName.length > 10 ? rawName.slice(0, 10) + '...' : rawName;
      const sp = parseNum(r.spend) || 0;
      cumSpend += sp;
      const cumRatio = totalSpend > 0 ? Math.round((cumSpend / totalSpend) * 1000) / 10 : 0;
      paretoRows.push({
        name: shortName,
        spend: sp,
        cum_ratio: cumRatio,
      });
    }

    const top3Spend = rows.slice(0, 3).reduce((s, r) => s + (parseNum(r.spend) || 0), 0);
    const top3Share = totalSpend > 0 ? ((top3Spend / totalSpend) * 100).toFixed(1) : '—';

    const metrics: MetricStripItem[] = [
      { label: '商业素材总数', value: rows.length, unit: '篇', note: '全量去重商业笔记' },
      { label: '素材累计总消耗', value: formatMoneyWan(totalSpend), unit: '', note: '全量商业笔记投放' },
      { label: 'Top3素材消耗集中度', value: top3Share, unit: '%', note: `前3篇消耗 ${formatMoneyWan(top3Spend)}` },
    ];

    return {
      materialParetoRows: paretoRows,
      materialMetrics: metrics,
      materialTotals: { totalSpend, top3Spend, top3Share, count: rows.length },
    };
  }, [materialParetoTable]);

  const materialParetoComboSeries: ComboSeries[] = [
    { key: 'spend', label: '素材消耗', kind: 'bar', axis: 'left', color: CAMPAIGN_PALETTE.primary, unit: '元' },
    { key: 'cum_ratio', label: '累计消耗占比', kind: 'line', axis: 'right', color: CAMPAIGN_PALETTE.gold, unit: '%' },
  ];

  // E. 618 Settled Review Dynamic Calculations
  const { review618Rows, review618Metrics } = useMemo(() => {
    const rows = review618Table?.rows || [];
    const channelRows = rows.filter((r) => !String(r.procurement_mode || '').includes('合计'));
    const totalRow = rows.find((r) => String(r.procurement_mode || '').includes('合计'));

    const comboRows = channelRows.map((r) => ({
      channel: String(r.channel || ''),
      k_spend: parseNum(r.k_spend),
      fs_spend: parseNum(r.fs_spend),
      fs_roi: parseNum(r.fs_roi),
      overall_roi: parseNum(r.overall_roi),
    }));

    const tSpend = totalRow ? parseNum(totalRow.total_spend) : 0;
    const tGmv = totalRow ? parseNum(totalRow.gmv) : 0;
    const fsRoi = totalRow ? parseNum(totalRow.fs_roi) : null;
    const allRoi = totalRow ? parseNum(totalRow.overall_roi) : null;

    const metrics: MetricStripItem[] = [
      { label: '618全案总花费', value: formatMoneyWan(tSpend), unit: '', note: 'KOL采买 + 投流' },
      { label: '618实现GMV', value: formatMoneyWan(tGmv), unit: '', note: '全渠道回传' },
      { label: '纯信息流投流ROI', value: fsRoi !== null ? fsRoi.toFixed(2) : '—', unit: '', note: 'GMV / 投流花费' },
      { label: '全案综合ROI(K+FS)', value: allRoi !== null ? allRoi.toFixed(2) : '—', unit: '', note: 'GMV / (K+FS总费用)' },
    ];

    return {
      review618Rows: comboRows,
      review618Metrics: metrics,
    };
  }, [review618Table]);

  const review618ComboSeries: ComboSeries[] = [
    { key: 'k_spend', label: '达人KOL费用', kind: 'bar', axis: 'left', color: CAMPAIGN_PALETTE.purple, unit: '元' },
    { key: 'fs_spend', label: '信息流投流费用', kind: 'bar', axis: 'left', color: CAMPAIGN_PALETTE.primary, unit: '元' },
    { key: 'fs_roi', label: '纯FS ROI', kind: 'line', axis: 'right', color: CAMPAIGN_PALETTE.gold, unit: '' },
    { key: 'overall_roi', label: '全案ROI', kind: 'line', axis: 'right', color: CAMPAIGN_PALETTE.terracotta, unit: '' },
  ];

  // F. Keywords Distribution Dynamic Calculations
  const { keywordsDonutData, keywordsMetrics, keywordsTotals } = useMemo(() => {
    const rows = keywordsTable?.rows || [];
    const catMap = new Map<string, number>();
    let total = 0;
    for (const r of rows) {
      const c = String(r.category || '未分类');
      const cnt = parseNum(r.count) || 0;
      catMap.set(c, (catMap.get(c) || 0) + cnt);
      total += cnt;
    }

    const colors = [CAMPAIGN_PALETTE.primary, CAMPAIGN_PALETTE.purple, CAMPAIGN_PALETTE.gold, CAMPAIGN_PALETTE.terracotta, CAMPAIGN_PALETTE.slate];
    let idx = 0;
    const donutData: ChartDatum[] = Array.from(catMap.entries()).map(([k, v]) => ({
      label: k,
      value: v,
      color: colors[idx++ % colors.length],
      detail: `${v} 条有效词 (${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%)`,
    }));

    const competeCount = catMap.get('竞品词') || 0;
    const catCount = catMap.get('品类词') || 0;
    const brandCount = catMap.get('品牌词') || 0;

    const metrics: MetricStripItem[] = [
      { label: '有效搜索词配置', value: total, unit: '条', note: '扣除空网格后实际词数' },
      { label: '竞品截流词', value: competeCount, unit: '条', note: total > 0 ? `占比 ${((competeCount / total) * 100).toFixed(1)}%` : '' },
      { label: '品类心智词', value: catCount, unit: '条', note: total > 0 ? `占比 ${((catCount / total) * 100).toFixed(1)}%` : '' },
      { label: '品牌本品词', value: brandCount, unit: '条', note: total > 0 ? `占比 ${((brandCount / total) * 100).toFixed(1)}%` : '' },
    ];

    return {
      keywordsDonutData: donutData,
      keywordsMetrics: metrics,
      keywordsTotals: { total, competeCount, catCount, brandCount },
    };
  }, [keywordsTable]);

  // G. Sample Machine Distribution Dynamic Calculations
  const { sampleMachineBarData, sampleMachineTotals } = useMemo(() => {
    const rows = sampleMachineTable?.rows || [];
    const colors = [CAMPAIGN_PALETTE.primary, CAMPAIGN_PALETTE.purple, CAMPAIGN_PALETTE.gold, CAMPAIGN_PALETTE.slate, '#4d8b80', '#9c6f84'];
    const totalMachines = rows.reduce((s, r) => s + (parseNum(r.count) || 0), 0);

    const barData: ChartDatum[] = rows.map((r, i) => {
      const cnt = parseNum(r.count) || 0;
      const ratio = totalMachines > 0 ? ((cnt / totalMachines) * 100).toFixed(1) : '0';
      return {
        label: String(r.model || '未注明型号'),
        value: cnt,
        color: colors[i % colors.length],
        detail: `${cnt} 台 (${ratio}%)`,
      };
    });

    const topModel = rows.length > 0 ? String(rows[0].model || '—') : '—';
    const topModelCount = rows.length > 0 ? parseNum(rows[0].count) || 0 : 0;

    return {
      sampleMachineBarData: barData,
      sampleMachineTotals: { totalMachines, topModel, topModelCount, count: rows.length },
    };
  }, [sampleMachineTable]);

  // --------------------------------------------------------------------------
  // RENDER SECTIONS
  // --------------------------------------------------------------------------

  // Mode A: History 618 snapshot mode (ONLY real 618 analytics, NO Double 11 data)
  if (isHistory618) {
    return (
      <div className="mri-root">
        <section className="mri-group">
          <div className="mri-group-header">
            <div className="mri-group-title-wrap">
              <span className="mri-group-badge mgmt">618历史复盘</span>
              <h3 className="mri-group-title">2026年618大促全案采买结构与ROI复盘</h3>
            </div>
            <p className="mri-group-desc">
              已结案数据（2026.05.20 ~ 2026.06.20），严格与双11隔离
            </p>
          </div>

          <MetricStrip items={review618Metrics} />

          <div className="mri-grid-single">
            <ChartPanel
              title="618采买模式费用分布与ROI对比（独立已结案）"
              subtitle={`统计周期：${review618Table?.period || '618已结案复盘'}`}
            >
              <CampaignComboChart
                title="618复盘采买模式费用与ROI对比图"
                rows={review618Rows}
                series={review618ComboSeries}
                xKey="channel"
                height={280}
              />
              <div className="mri-card-caption">
                <strong>口径说明：</strong>618已结案复盘，全案总花费含达人KOL采买与信息流投流花费；全案ROI为总GMV/总费用，纯FS ROI为总GMV/信息流费用。
              </div>
              <details className="mri-details-toggle">
                <summary className="mri-details-summary">查看明细</summary>
                <div className="mri-table-wrapper">
                  <table className="mri-audit-table">
                    <thead>
                      <tr>
                        <th>渠道</th>
                        <th>采买模式</th>
                        <th>达人KOL费用</th>
                        <th>信息流FS费用</th>
                        <th>总花费(K+FS)</th>
                        <th>实现GMV</th>
                        <th>纯FS ROI</th>
                        <th>全案ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {review618Table?.rows.map((r, i) => (
                        <tr key={i}>
                          <td><strong>{String(r.channel || '—')}</strong></td>
                          <td>{String(r.procurement_mode || '—')}</td>
                          <td>{formatNum(parseNum(r.k_spend))}</td>
                          <td>{formatNum(parseNum(r.fs_spend))}</td>
                          <td>{formatNum(parseNum(r.total_spend))}</td>
                          <td>{formatNum(parseNum(r.gmv))}</td>
                          <td>{formatNum(parseNum(r.fs_roi))}</td>
                          <td>{formatNum(parseNum(r.overall_roi))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </ChartPanel>
          </div>
        </section>
      </div>
    );
  }

  // Mode B: Default / Double 11 snapshot mode
  return (
    <div className="mri-root">
      {/* ==================================================================== */}
      {/* 1. OVERVIEW (经营 / 效率 / 内容 三层业务架构)                       */}
      {/* ==================================================================== */}
      {section === 'overview' && (
        <>
          {/* 经营层 */}
          <section className="mri-group">
            <div className="mri-group-header">
              <div className="mri-group-title-wrap">
                <span className="mri-group-badge mgmt">经营管理</span>
                <h3 className="mri-group-title">经营预算与大促规划达成</h3>
              </div>
              <p className="mri-group-desc">
                双11大促规划系列拆解与渠道账户打款应消耗对照
              </p>
            </div>

            <MetricStrip items={modelPlanMetrics} />

            <div className="mri-grid">
              <ChartPanel
                title="双11产品系列预算规划与初筛进度"
                subtitle={`统计周期：${modelPlanTable?.period || '原规划表，截止未注明'}`}
              >
                <CampaignComboChart
                  title="双11产品系列预算规划与初筛进度图"
                  rows={modelPlanSeriesRows}
                  series={modelPlanComboSeries}
                  xKey="series"
                  height={260}
                />
                <div className="mri-card-caption">
                  <strong>口径说明：</strong>数据派生自9/28初始规划表。规划预算为KOL+FS综合预算，表中实际为测试投流消耗；规划篇数共{modelPlanTotals.totalP}篇，初筛{modelPlanTotals.totalS}篇，已发{modelPlanTotals.totalPub}篇。二者为标明口径对照，不叫全案预算完成率。
                </div>
                <details className="mri-details-toggle">
                  <summary className="mri-details-summary">查看明细</summary>
                  <div className="mri-table-wrapper">
                    <table className="mri-audit-table">
                      <thead>
                        <tr>
                          <th>系列</th>
                          <th>型号</th>
                          <th>规划预算(万)</th>
                          <th>规划篇数</th>
                          <th>初步筛选</th>
                          <th>已发篇数</th>
                          <th>投流消耗(元)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modelPlanTable?.rows.map((r, i) => (
                          <tr key={i}>
                            <td>{String(r.series || '—')}</td>
                            <td>{String(r.model || '—')}</td>
                            <td>{formatNum(parseNum(r.budget_wan))}</td>
                            <td>{String(r.posts_plan ?? '—')}</td>
                            <td>{String(r.screen_prog ?? '—')}</td>
                            <td>{String(r.pub_prog ?? '—')}</td>
                            <td>{formatNum(parseNum(r.spend))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </ChartPanel>

              <ChartPanel
                title="渠道投放账户规划打款与实际应消耗"
                subtitle={`统计周期：${accountTable?.period || '打款与应消耗对照'}`}
              >
                <CampaignComboChart
                  title="渠道投放账户打款与实际应消耗对照图"
                  rows={accountComboRows}
                  series={accountComboSeries}
                  xKey="account"
                  height={260}
                />
                <div className="mri-card-caption">
                  <strong>核对记录：</strong>来源双11打款对照表，固定5列映射。规划打款合计{formatMoneyWan(accountTotals.sumPlan)}，实际应消耗需求合计{formatMoneyWan(accountTotals.sumReq)}。
                </div>
                <details className="mri-details-toggle">
                  <summary className="mri-details-summary">查看明细</summary>
                  <div className="mri-table-wrapper">
                    <table className="mri-audit-table">
                      <thead>
                        <tr>
                          <th>投放账户</th>
                          <th>规划打款(元)</th>
                          <th>实际打款(元)</th>
                          <th>实际应消耗(元)</th>
                          <th>还差&应挪(元)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountTable?.rows.map((r, i) => (
                          <tr key={i}>
                            <td>{String(r.account || '—')}</td>
                            <td>{formatNum(parseNum(r.budget_planned))}</td>
                            <td>{formatNum(parseNum(r.actual_paid))}</td>
                            <td>{formatNum(parseNum(r.actual_required_spend))}</td>
                            <td>{formatNum(parseNum(r.variance))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </ChartPanel>
            </div>
          </section>

          {/* 效率层 */}
          <section className="mri-group">
            <div className="mri-group-header">
              <div className="mri-group-title-wrap">
                <span className="mri-group-badge eff">投放效率</span>
                <h3 className="mri-group-title">渠道表现与消耗集中度诊断</h3>
              </div>
              <p className="mri-group-desc">
                双平台同周期可比分日对照与全量商业笔记 Pareto 消耗集中度
              </p>
            </div>

            <MetricStrip items={comparableMetrics} />

            <div className="mri-grid">
              <ChartPanel
                title="双平台同周期可比分日消耗对照"
                subtitle={`统计周期：${comparableTotals.startDate} ~ ${comparableTotals.endDate}（重叠可比${comparableTotals.days}天）`}
              >
                <CampaignComboChart
                  title="双平台同周期分日消耗对比图"
                  rows={comparableRows}
                  series={comparableComboSeries}
                  xKey="date"
                  height={250}
                />
                <div className="mri-card-caption">
                  <strong>对比说明：</strong>仅取双平台共同投放的{comparableTotals.days}个可比日期（{comparableTotals.startDate} ~ {comparableTotals.endDate}）并排展示。两平台在可比期内总消耗分别为天猫{formatMoneyWan(comparableTotals.sumTm)}与京东{formatMoneyWan(comparableTotals.sumJd)}，消耗比值为{comparableTotals.overallRatio}x。
                </div>
              </ChartPanel>

              <ChartPanel
                title="全量商业笔记素材消耗Pareto与集中度"
                subtitle={`统计周期：${materialParetoTable?.period || '全量去重商业素材'}（已展示全量 ${materialTotals.count} 篇）`}
              >
                <CampaignComboChart
                  title="商业笔记素材消耗Pareto图"
                  rows={materialParetoRows}
                  series={materialParetoComboSeries}
                  xKey="name"
                  height={250}
                />
                <div className="mri-card-caption">
                  <strong>消耗集中度：</strong>展示全量{materialTotals.count}篇商业素材的Pareto放量分布。Top 3素材累计消耗占全量{materialTotals.top3Share}%。
                </div>
              </ChartPanel>
            </div>

            {/* 历史复盘参考（双11模式下清晰折叠隔离，不混淆） */}
            <details className="mri-details-toggle">
              <summary className="mri-details-summary">查看历史大促参考：2026年618复盘采买形式结构与ROI（独立已结案）</summary>
              <div style={{ marginTop: '12px' }}>
                <ChartPanel
                  title="2026年618复盘采买形式结构与ROI对照（独立已结案）"
                  subtitle={`统计周期：${review618Table?.period || '618已结案复盘'}`}
                >
                  <CampaignComboChart
                    title="618复盘采买模式费用与ROI对比图"
                    rows={review618Rows}
                    series={review618ComboSeries}
                    xKey="channel"
                    height={260}
                  />
                  <div className="mri-card-caption">
                    <strong>周期隔离：</strong>618已结案复盘，严格与双11隔离。全案ROI分母含达人裸价+折后投流，纯FS ROI分母仅为信息流投流花费。
                  </div>
                </ChartPanel>
              </div>
            </details>
          </section>

          {/* 内容层 */}
          <section className="mri-group">
            <div className="mri-group-header">
              <div className="mri-group-title-wrap">
                <span className="mri-group-badge content">内容资产</span>
                <h3 className="mri-group-title">关键词策略与大促样机流转</h3>
              </div>
              <p className="mri-group-desc">
                搜索词库配置结构与双11试用样机流转进度（彻底脱敏）
              </p>
            </div>

            <MetricStrip items={keywordsMetrics} />

            <div className="mri-grid">
              <ChartPanel
                title="投放搜索词库配置结构"
                subtitle={`数据源：搜索词配置（有效${keywordsTotals.total}条非空关键词配置）`}
              >
                <DonutChart data={keywordsDonutData} unit="条" centerLabel="有效词库" />
                <div className="mri-card-caption">
                  <strong>配置说明：</strong>词库配置共{keywordsTotals.total}条（含618大促词与日常词库），为系统投放词库配置，非已投放广告绩效。竞品截流词占比为{keywordsTotals.total > 0 ? ((keywordsTotals.competeCount / keywordsTotals.total) * 100).toFixed(1) : 0}%。
                </div>
              </ChartPanel>

              <ChartPanel
                title="双11试用样机产品型号分布"
                subtitle={`数据源：双11样机流转记录（全量${sampleMachineTotals.totalMachines}台）`}
              >
                <HorizontalBarChart data={sampleMachineBarData} unit="台" />
                <div className="mri-card-caption">
                  <strong>隐私脱敏：</strong>彻底脱敏达人昵称与电话地址，仅按型号与流转进度聚合。主力流转型号为{sampleMachineTotals.topModel}（{sampleMachineTotals.topModelCount}台）。
                </div>
                <details className="mri-details-toggle">
                  <summary className="mri-details-summary">查看明细</summary>
                  <div className="mri-table-wrapper">
                    <table className="mri-audit-table">
                      <thead>
                        <tr>
                          <th>样机流转状态</th>
                          <th>台数</th>
                          <th>退货流转状态</th>
                          <th>台数</th>
                          <th>内饰确认状态</th>
                          <th>台数</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><span className="mri-tag core">已下单</span></td>
                          <td>61</td>
                          <td><span className="mri-tag neutral">未退货</span></td>
                          <td>55</td>
                          <td><span className="mri-tag core">内饰已确认</span></td>
                          <td>62</td>
                        </tr>
                        <tr>
                          <td><span className="mri-tag steady">已收加急制图</span></td>
                          <td>15</td>
                          <td><span className="mri-tag warning">已提退货</span></td>
                          <td>15</td>
                          <td><span className="mri-tag warning">未确认</span></td>
                          <td>16</td>
                        </tr>
                        <tr>
                          <td><span className="mri-tag warning">没收到/异常</span></td>
                          <td>8</td>
                          <td><span className="mri-tag steady">已通知退货</span></td>
                          <td>14</td>
                          <td><span className="mri-tag neutral">达人自带/待定</span></td>
                          <td>6</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </details>
              </ChartPanel>
            </div>
          </section>
        </>
      )}

      {/* ==================================================================== */}
      {/* 2. ADS SECTION (投放与渠道深度指标)                                  */}
      {/* ==================================================================== */}
      {section === 'ads' && (
        <div className="mri-grid">
          <ChartPanel
            title="双11平台级目标规划与回传GMV源数"
            subtitle={`统计周期：${platformKpiTable?.period || '原规划表，截止未注明'}`}
          >
            <div className="mri-table-wrapper">
              <table className="mri-audit-table">
                <thead>
                  <tr>
                    <th>渠道平台</th>
                    <th>规划预算(万)</th>
                    <th>规划篇数</th>
                    <th>达人初筛</th>
                    <th>发布篇数</th>
                    <th>投流消耗(元)</th>
                    <th>进店量(UV)</th>
                    <th>回传GMV(元)</th>
                  </tr>
                </thead>
                <tbody>
                  {platformKpiTable?.rows.map((r, i) => (
                    <tr key={i}>
                      <td><strong>{String(r.platform || '—')}</strong></td>
                      <td>{formatNum(parseNum(r.budget_wan))}</td>
                      <td>{String(r.posts_plan ?? '—')}</td>
                      <td>{String(r.screen_prog ?? '—')}</td>
                      <td>{String(r.pub_prog ?? '—')}</td>
                      <td>{formatNum(parseNum(r.spend))}</td>
                      <td>{formatNum(parseNum(r.store_uv), 0)}</td>
                      <td>{formatNum(parseNum(r.gmv))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mri-card-caption">
              <strong>数据说明：</strong>经核对，源表中进店量与GMV无单元格合并亦无SUM公式，属于单点填报静态源值，无法确证归因范围；遵循严格审计规范仅展示源值，不推算单品或渠道ROI。
            </div>
          </ChartPanel>

          <ChartPanel
            title="渠道投放账户规划打款与实际应消耗"
            subtitle={`统计周期：${accountTable?.period || '打款与应消耗对照'}`}
          >
            <CampaignComboChart
              title="渠道投放账户规划打款与实际应消耗对比图"
              rows={accountComboRows}
              series={accountComboSeries}
              xKey="account"
              height={260}
            />
            <div className="mri-card-caption">
              <strong>核对记录：</strong>来源双11打款对照表，固定5列映射。规划打款合计{formatMoneyWan(accountTotals.sumPlan)}，实际应消耗需求合计{formatMoneyWan(accountTotals.sumReq)}。
            </div>
          </ChartPanel>

          <ChartPanel
            title="双平台同周期可比分日消耗对照"
            subtitle={`统计周期：${comparableTotals.startDate} ~ ${comparableTotals.endDate}（重叠可比${comparableTotals.days}天）`}
          >
            <CampaignComboChart
              title="双平台同周期分日消耗对比图"
              rows={comparableRows}
              series={comparableComboSeries}
              xKey="date"
              height={250}
            />
            <div className="mri-card-caption">
              <strong>对比说明：</strong>仅取双平台共同投放的{comparableTotals.days}个可比日期并排展示，两平台在可比期内总消耗分别为天猫{formatMoneyWan(comparableTotals.sumTm)}与京东{formatMoneyWan(comparableTotals.sumJd)}。
            </div>
          </ChartPanel>

          <ChartPanel
            title="2026年618复盘采买形式结构与ROI对照（独立已结案）"
            subtitle={`统计周期：${review618Table?.period || '618已结案复盘'}`}
          >
            <CampaignComboChart
              title="618复盘采买模式费用与ROI对比图"
              rows={review618Rows}
              series={review618ComboSeries}
              xKey="channel"
              height={260}
            />
            <div className="mri-card-caption">
              <strong>分母口径：</strong>全案ROI分母含达人裸价+折后投流，纯FS ROI分母仅为信息流投流花费。严禁与双11进行中规划混画。
            </div>
          </ChartPanel>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. CONTENT SECTION (内容、素材与达人深度指标)                        */}
      {/* ==================================================================== */}
      {section === 'content' && (
        <div className="mri-grid">
          <MetricStrip items={materialMetrics} />

          <ChartPanel
            title="全量商业笔记素材消耗Pareto与集中度"
            subtitle={`统计周期：${materialParetoTable?.period || '全量去重商业素材'}（已展示全量 ${materialTotals.count} 篇）`}
          >
            <CampaignComboChart
              title="商业笔记素材消耗Pareto图"
              rows={materialParetoRows}
              series={materialParetoComboSeries}
              xKey="name"
              height={250}
            />
            <div className="mri-card-caption">
              <strong>消耗集中度：</strong>展示全量{materialTotals.count}篇商业素材的Pareto放量分布。Top 3素材累计消耗占全量{materialTotals.top3Share}%。
            </div>
          </ChartPanel>

          <ChartPanel
            title="投放搜索词库配置结构"
            subtitle={`数据源：搜索词配置（有效${keywordsTotals.total}条非空关键词配置）`}
          >
            <DonutChart data={keywordsDonutData} unit="条" centerLabel="有效词库" />
            <div className="mri-card-caption">
              <strong>配置说明：</strong>词库配置共{keywordsTotals.total}条（含618大促词与日常词库），为系统投放词库配置，非已投放广告绩效。
            </div>
          </ChartPanel>

          <ChartPanel
            title="双11试用样机产品型号分布"
            subtitle={`数据源：双11样机流转记录（全量${sampleMachineTotals.totalMachines}台）`}
          >
            <HorizontalBarChart data={sampleMachineBarData} unit="台" />
            <div className="mri-card-caption">
              <strong>隐私脱敏：</strong>彻底脱敏达人昵称与电话地址，仅按型号与流转进度聚合。
            </div>
          </ChartPanel>

          <ChartPanel
            title="双11二核确认达人量级与审核进度交叉透视"
            subtitle={`数据源：二核达人名单（${kolTierTable?.rows.length || 0}条交叉透视记录）`}
          >
            <div className="mri-table-wrapper">
              <table className="mri-audit-table">
                <thead>
                  <tr>
                    <th>达人量级</th>
                    <th>执行阶段</th>
                    <th>达人数(位)</th>
                    <th>均结算价(元)</th>
                    <th>总结算价(元)</th>
                    <th>视频占比</th>
                  </tr>
                </thead>
                <tbody>
                  {kolTierTable?.rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td>{String(r.tier || '—')}</td>
                      <td>{String(r.stage || '—')}</td>
                      <td>{String(r.kol_count ?? '—')}</td>
                      <td>{formatNum(parseNum(r.avg_settlement_price))}</td>
                      <td>{formatNum(parseNum(r.total_settlement_price))}</td>
                      <td>{String(r.video_ratio ?? '—')}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mri-card-caption">
              <strong>达人矩阵：</strong>二核确认达人在各量级与各执行阶段下的数量、结算价格均值与视频形式占比。
            </div>
          </ChartPanel>
        </div>
      )}
    </div>
  );
}
"""

with open("feihe-mvp/features/campaign/MeilingRichInsights.tsx", "w", encoding="utf-8") as f:
    f.write(code)

print("Updated MeilingRichInsights.tsx with snapshot support and business copy successfully!")
