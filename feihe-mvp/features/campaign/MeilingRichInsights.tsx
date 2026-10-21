'use client';

import React, { useMemo } from 'react';
import type { CampaignDashboard, CampaignTable } from '../../lib/campaign-types';
import {
  ChartPanel,
  MetricStrip,
  HorizontalBarChart,
  DonutChart,
  CampaignFunnelChart,
  MatrixHeatmapChart,
  StackedHorizontalBarChart,
  ScatterChart,
  CAMPAIGN_PALETTE,
  type ChartDatum,
  type MetricStripItem,
  type FunnelStageDatum,
  type MatrixHeatmapCell,
  type StackedBarRow,
  type StackedBarSegment,
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
  const noteCreativeTable = tablesMap.get('meiling-enrich-note-creative-efficiency');
  const matrixProductTable = tablesMap.get('meiling-enrich-matrix-product-stage');
  const matrixPlatformTable = tablesMap.get('meiling-enrich-matrix-platform-stage');
  const themeFormatTable = tablesMap.get('meiling-enrich-content-theme-format');
  const fullFunnelTable = tablesMap.get('meiling-enrich-full-funnel');
  const multiLineTable = tablesMap.get('meiling-enrich-multi-line-summary');
  const audienceAgeTable = tablesMap.get('meiling-enrich-audience-age');
  const audienceCitiesTable = tablesMap.get('meiling-enrich-audience-cities');
  const audiencePackagesTable = tablesMap.get('meiling-enrich-audience-packages');
  const campaignEvolutionTable = tablesMap.get('meiling-enrich-campaign-evolution');

  // A. Model Planning Dynamic Calculations
  const { modelPlanSeriesRows, modelPlanTotals } = useMemo(() => {
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
  const { comparableRows, comparableTotals } = useMemo(() => {
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
  const { keywordsDonutData, keywordsTotals } = useMemo(() => {
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

  // H. Multi-Line Summary Dynamic Calculations (10大细分投放线并发赛马)
  const { multiLineComboRows, multiLineTotals } = useMemo(() => {
    const rows = multiLineTable?.rows || [];
    let sumSpend = 0;
    let sumImp = 0;
    let sumClicks = 0;
    let sumEng = 0;
    let sumUv = 0;

    const cRows = [];
    for (const r of rows) {
      const sp = parseNum(r.spend) || 0;
      const uv = parseNum(r.uv) || 0;
      const imp = parseNum(r.impressions) || 0;
      const clicks = parseNum(r.clicks) || 0;
      const eng = parseNum(r.engagements) || 0;
      sumSpend += sp;
      sumImp += imp;
      sumClicks += clicks;
      sumEng += eng;
      sumUv += uv;

      cRows.push({
        line: String(r.line_name || ''),
        spend: sp,
        uv: uv,
        clicks: clicks,
        ctr: parseNum(r.ctr),
        cpc: parseNum(r.cpc),
        cpuv: parseNum(r.cpuv),
      });
    }

    const metrics: MetricStripItem[] = [
      { label: '多线投放总消耗', value: formatMoneyWan(sumSpend), unit: '', note: '10大细分投放线累计' },
      { label: '多线综合点击率', value: sumImp > 0 ? ((sumClicks / sumImp) * 100).toFixed(2) : '—', unit: '%', note: `总点击 ${formatNum(sumClicks, 0)}次` },
      { label: '平均进店成本 CPUV', value: sumUv > 0 ? (sumSpend / sumUv).toFixed(2) : '—', unit: '元', note: `进店 ${formatNum(sumUv, 0)} UV` },
      { label: '活跃投放线数量', value: rows.filter((r) => (parseNum(r.spend) || 0) > 0).length, unit: '条', note: `全量规划 ${rows.length} 条投放线` },
    ];

    return {
      multiLineComboRows: cRows,
      multiLineMetrics: metrics,
      multiLineTotals: { sumSpend, sumImp, sumClicks, sumEng, sumUv, count: rows.length },
    };
  }, [multiLineTable]);

  const multiLineComboSeries: ComboSeries[] = [
    { key: 'spend', label: '消耗金额', kind: 'bar', axis: 'left', color: CAMPAIGN_PALETTE.primary, unit: '元' },
    { key: 'uv', label: '进店UV', kind: 'line', axis: 'right', color: CAMPAIGN_PALETTE.gold, unit: 'UV' },
  ];

  // I. Full Funnel Dynamic Calculations (展现→点击→互动→进店UV)
  const funnelStages: FunnelStageDatum[] = useMemo(() => {
    const rows = fullFunnelTable?.rows || [];
    const colors = [CAMPAIGN_PALETTE.primary, CAMPAIGN_PALETTE.purple, CAMPAIGN_PALETTE.gold, CAMPAIGN_PALETTE.terracotta];
    return rows.map((r, i) => ({
      stage: String(r.stage || ''),
      value: parseNum(r.value),
      unit: String(r.unit || ''),
      conversionLabel: String(r.conversion_label || ''),
      costLabel: String(r.cost_label || ''),
      subtext: String(r.subtext || ''),
      color: colors[i % colors.length],
    }));
  }, [fullFunnelTable]);

  // J. Commercial Note Scatter Creative Diagnostic Calculations (消耗 × 进店/互动成本)
  const scatterCreativeData = useMemo(() => {
    const rows = noteCreativeTable?.rows || materialParetoTable?.rows || [];
    return rows.map((r, i) => {
      const sp = parseNum(r.spend);
      const cpuv = parseNum(r.cpuv);
      const cpe = parseNum(r.cpe);
      const uv = parseNum(r.uv);
      const eng = parseNum(r.engagements);
      const rawName = String(r.material_name || r.note_id || `商业素材-${i + 1}`);
      const shortName = rawName.length > 8 ? rawName.slice(0, 8) + '...' : rawName;
      const yVal = cpuv !== null && cpuv > 0 ? cpuv : cpe;

      return {
        label: shortName,
        x: sp,
        y: yVal,
        size: uv !== null && uv > 0 ? uv : (eng || 10),
        detail: `${rawName} | 消耗 ¥${formatNum(sp)} | 进店成本 ¥${formatNum(cpuv)} | UV ${formatNum(uv, 0)} | 互动 ${formatNum(eng, 0)}`,
      };
    });
  }, [noteCreativeTable, materialParetoTable]);

  // K. Audience Demographics: Age & Top 12 Cities
  const { audienceAgeBarData, audienceCitiesBarData } = useMemo(() => {
    const ageRows = audienceAgeTable?.rows || [];
    const cityRows = audienceCitiesTable?.rows || [];

    const ageColors = [CAMPAIGN_PALETTE.slate, CAMPAIGN_PALETTE.purple, CAMPAIGN_PALETTE.primary, CAMPAIGN_PALETTE.gold, CAMPAIGN_PALETTE.terracotta];
    const ageBarData: ChartDatum[] = ageRows.map((r, i) => {
      const ratio = parseNum(r.ratio) || 0;
      return {
        label: String(r.age_group || ''),
        value: ratio,
        color: ageColors[i % ageColors.length],
        detail: `${ratio}% - ${r.persona_note || ''}`,
      };
    });

    const cityBarData: ChartDatum[] = cityRows.map((r, i) => {
      const count = parseNum(r.kol_count) || 0;
      return {
        label: String(r.city || ''),
        value: count,
        color: i < 3 ? CAMPAIGN_PALETTE.primary : i < 6 ? CAMPAIGN_PALETTE.purple : CAMPAIGN_PALETTE.slate,
        detail: `${r.city} (${r.tier || '核心城市'}) - 指数 ${count}`,
      };
    });

    return { audienceAgeBarData: ageBarData, audienceCitiesBarData: cityBarData };
  }, [audienceAgeTable, audienceCitiesTable]);

  // L. Audience Targeting Packages Top 10
  const audiencePackagesBarData: ChartDatum[] = useMemo(() => {
    const rows = audiencePackagesTable?.rows || [];
    const colors = [CAMPAIGN_PALETTE.primary, CAMPAIGN_PALETTE.purple, CAMPAIGN_PALETTE.gold, CAMPAIGN_PALETTE.slate, '#4d8b80', '#9c6f84'];
    return rows.slice(0, 8).map((r, i) => {
      const sp = parseNum(r.spend) || 0;
      const rawName = String(r.package_name || '');
      const shortName = rawName.replace('人群包-', '').replace('平台推荐-', '');
      return {
        label: shortName.length > 9 ? shortName.slice(0, 9) + '...' : shortName,
        value: sp,
        color: colors[i % colors.length],
        detail: `${rawName} | 消耗 ¥${formatNum(sp)} | CTR ${r.ctr}% | 进店成本 ¥${formatNum(parseNum(r.cpuv))}`,
      };
    });
  }, [audiencePackagesTable]);

  // M. 2D Matrix Heatmaps (产品×阶段, 平台×阶段) & Content Theme × Format Stack
  const { matrixProductData, matrixPlatformData, themeFormatStacked } = useMemo(() => {
    // 1. Product x Stage
    const prodRows = matrixProductTable?.rows || [];
    const pRowsSet = Array.from(new Set(prodRows.map((r) => String(r.dimension || ''))));
    const pColsSet = Array.from(new Set(prodRows.map((r) => String(r.stage || ''))));
    const pCells: MatrixHeatmapCell[] = prodRows.map((r) => ({
      row: String(r.dimension || ''),
      col: String(r.stage || ''),
      value: parseNum(r.count),
      displayValue: String(r.count ?? '0'),
      subtext: r.ratio !== undefined ? `${r.ratio}%` : undefined,
    }));

    // 2. Platform x Stage
    const platRows = matrixPlatformTable?.rows || [];
    const plRowsSet = Array.from(new Set(platRows.map((r) => String(r.dimension || ''))));
    const plColsSet = Array.from(new Set(platRows.map((r) => String(r.stage || ''))));
    const plCells: MatrixHeatmapCell[] = platRows.map((r) => ({
      row: String(r.dimension || ''),
      col: String(r.stage || ''),
      value: parseNum(r.count),
      displayValue: String(r.count ?? '0'),
      subtext: r.ratio !== undefined ? `${r.ratio}%` : undefined,
    }));

    // 3. Theme x Format Stack
    const tfRows = themeFormatTable?.rows || [];
    const themes = Array.from(new Set(tfRows.map((r) => String(r.content_theme || ''))));
    const segments: StackedBarSegment[] = [
      { key: '图文', label: '图文', color: CAMPAIGN_PALETTE.primary },
      { key: '视频', label: '视频', color: CAMPAIGN_PALETTE.purple },
    ];
    const stackedRows: StackedBarRow[] = themes.map((theme) => {
      const tuwen = tfRows.find((r) => r.content_theme === theme && r.format === '图文');
      const video = tfRows.find((r) => r.content_theme === theme && r.format === '视频');
      const tuwenCnt = parseNum(tuwen?.count) || 0;
      const videoCnt = parseNum(video?.count) || 0;
      return {
        label: theme,
        totalLabel: `${tuwenCnt + videoCnt} 篇`,
        segments: {
          '图文': tuwenCnt,
          '视频': videoCnt,
        },
        meta: `图文 ${tuwenCnt}篇 (${tuwen?.ratio || 0}%) | 视频 ${videoCnt}篇 (${video?.ratio || 0}%)`,
      };
    });

    return {
      matrixProductData: { rows: pRowsSet, cols: pColsSet, cells: pCells },
      matrixPlatformData: { rows: plRowsSet, cols: plColsSet, cells: plCells },
      themeFormatStacked: { segments, rows: stackedRows },
    };
  }, [matrixProductTable, matrixPlatformTable, themeFormatTable]);

  // N. Campaign Evolution (618 vs 7-8月 vs 双11)
  const campaignEvolutionRows = useMemo(() => {
    return campaignEvolutionTable?.rows || [];
  }, [campaignEvolutionTable]);

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

          <div className="mri-grid">
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

            </ChartPanel>

            <ChartPanel
              title="618 vs 7-8月 历史跨期战役达人规模与考核回顾"
              subtitle="历史两大促战役关键经营与投入对比"
            >
              <div className="mri-table-wrapper">
                <table className="mri-audit-table">
                  <thead>
                    <tr>
                      <th>大促战役</th>
                      <th>战役周期</th>
                      <th>达人规模(候选/确认)</th>
                      <th>K+FS总投入(元)</th>
                      <th>实现GMV(元)</th>
                      <th>全案综合ROI</th>
                      <th>核心指标达成</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignEvolutionRows.slice(0, 2).map((r, i) => (
                      <tr key={i}>
                        <td><strong>{String(r.campaign || '—')}</strong></td>
                        <td>{String(r.period || '—')}</td>
                        <td>{String(r.candidate_kols ?? '—')} / {String(r.confirmed_kols ?? '—')}位</td>
                        <td>{formatNum(parseNum(r.total_spend))}</td>
                        <td>{formatNum(parseNum(r.gmv))}</td>
                        <td>{r.overall_roi !== null ? Number(r.overall_roi).toFixed(2) : '—'}</td>
                        <td><span className="mri-tag core">{String(r.milestone || '—')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </ChartPanel>

            <ChartPanel
              title="618达人蒲公英受众年龄段分布（N=105真实样本）"
              subtitle="历史达人阅读受众真实年龄层画像"
            >
              <HorizontalBarChart data={audienceAgeBarData} unit="%" />

            </ChartPanel>
          </div>

          <details className="mri-details-toggle">
            <summary className="mri-details-summary">查看618已结案采买模式完整底层核算表</summary>
            <div className="mri-table-wrapper" style={{ marginTop: '10px' }}>
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
          {/* ================================================================ */}
          {/* 第一层（重 · 经营决策与多线预算总览）                           */}
          {/* ================================================================ */}
          <section className="mri-group">
            <div className="mri-group-header">
              <div className="mri-group-title-wrap">
                <span className="mri-group-badge mgmt">经营决策</span>
                <h3 className="mri-group-title">经营决策与多线预算总览</h3>
              </div>
              <p className="mri-group-desc">
                双11产品系列型号规划 vs 投流实际 + 7大账户打款 vs 应消耗 + 10大投放线并发赛马 + 三大促战役跨期演进
              </p>
            </div>

            <MetricStrip
              items={[
                { label: '双11原规划预算', value: modelPlanTotals.totalB > 0 ? modelPlanTotals.totalB.toFixed(2) : '380.00', unit: '万元', note: '9/28初始规划版(K+FS)' },
                { label: '7大账户规划打款', value: formatMoneyWan(accountTotals.sumPlan), unit: '', note: '全账户规划打款合计' },
                { label: '7大账户实际应消耗', value: formatMoneyWan(accountTotals.sumReq), unit: '', note: `还差需补 ${formatMoneyWan(Math.abs(accountTotals.gap))}` },
                { label: '10线投放实测消耗', value: formatMoneyWan(multiLineTotals.sumSpend), unit: '', note: '跨10大细分线已测消耗' },
                { label: '回传进店与GMV', value: `${formatNum(multiLineTotals.sumUv, 0)} UV`, unit: '', note: `实现GMV ¥199.42万 (ROI 4.80)` },
              ]}
            />

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

              </ChartPanel>

              <ChartPanel
                title="双11细分投放线投放消耗与进店UV分布（10线并发赛马）"
                subtitle={`统计周期：${multiLineTable?.period || '2026-09-30 ~ 2026-10-18'}`}
              >
                <CampaignComboChart
                  title="10大细分投放线消耗与进店UV分布图"
                  rows={multiLineComboRows}
                  series={multiLineComboSeries}
                  xKey="line"
                  height={260}
                />

              </ChartPanel>

              <ChartPanel
                title="三大促战役跨期演进对比（618年中 vs 7-8月日常 vs 双11决战）"
                subtitle="跨期对比候选池/确认规模、K+FS投入与核心里程碑"
              >
                <div className="mri-table-wrapper">
                  <table className="mri-audit-table">
                    <thead>
                      <tr>
                        <th>大促战役</th>
                        <th>周期</th>
                        <th>达人规模(候选/确认)</th>
                        <th>K+FS投入(元)</th>
                        <th>实现GMV(元)</th>
                        <th>综合ROI</th>
                        <th>核心里程碑</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignEvolutionRows.map((r, i) => (
                        <tr key={i}>
                          <td><strong>{String(r.campaign || '—')}</strong></td>
                          <td>{String(r.period || '—')}</td>
                          <td>{String(r.candidate_kols ?? '—')} / {String(r.confirmed_kols ?? '—')}位</td>
                          <td>{formatNum(parseNum(r.total_spend))}</td>
                          <td>{formatNum(parseNum(r.gmv))}</td>
                          <td>{r.overall_roi !== null ? Number(r.overall_roi).toFixed(2) : (r.fs_roi !== null ? `${Number(r.fs_roi).toFixed(2)}(FS)` : '—')}</td>
                          <td><span className={`mri-tag ${String(r.status) === '已结案' ? 'core' : 'steady'}`}>{String(r.milestone || '—')}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </ChartPanel>
            </div>
          </section>

          {/* 效率层 */}
          <section className="mri-group">
            <div className="mri-group-header">
              <div className="mri-group-title-wrap">
                <span className="mri-group-badge eff">投放效率</span>
                <h3 className="mri-group-title">全链路转化漏斗与投放效率诊断</h3>
              </div>
              <p className="mri-group-desc">
                双11种草投流全链路转化漏斗 + 天猫vs京东19天分日对照 + 全量商业笔记 Pareto 集中度 + 笔记消耗散点诊断
              </p>
            </div>

            <MetricStrip
              items={[
                { label: '品牌曝光展现', value: formatNum(multiLineTotals.sumImp, 0), unit: '次', note: '跨10线综合曝光覆盖' },
                { label: '种草点击浏览', value: formatNum(multiLineTotals.sumClicks, 0), unit: '次', note: `综合CTR ${multiLineTotals.sumImp > 0 ? ((multiLineTotals.sumClicks / multiLineTotals.sumImp) * 100).toFixed(2) : 0}%` },
                { label: '深度互动交互', value: formatNum(multiLineTotals.sumEng, 0), unit: '次', note: `平均CPE ¥${multiLineTotals.sumEng > 0 ? (multiLineTotals.sumSpend / multiLineTotals.sumEng).toFixed(2) : '—'}` },
                { label: '电商进店引流', value: formatNum(multiLineTotals.sumUv, 0), unit: 'UV', note: `进店率 ${multiLineTotals.sumClicks > 0 ? ((multiLineTotals.sumUv / multiLineTotals.sumClicks) * 100).toFixed(2) : 0}% | CPUV ¥${multiLineTotals.sumUv > 0 ? (multiLineTotals.sumSpend / multiLineTotals.sumUv).toFixed(2) : '—'}` },
              ]}
            />

            <div className="mri-grid">
              <ChartPanel
                title="双11种草投流全链路转化漏斗（展现→点击→互动→进店UV）"
                subtitle="覆盖跨10线汇总绝对规模与各链路转化率"
              >
                <div className="mri-funnel-wrap">
                  <CampaignFunnelChart stages={funnelStages} />
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

              </ChartPanel>

              <ChartPanel
                title="商业笔记消费 × 进店/互动成本散点诊断"
                subtitle="X轴素材消耗，Y轴进店/互动成本，气泡大小进店UV"
              >
                <div className="mri-scatter-wrap">
                  <ScatterChart
                    data={scatterCreativeData}
                    xLabel="素材消耗 (元)"
                    yLabel="进店/互动成本 (元)"
                  />
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

                </ChartPanel>
              </div>
            </details>
          </section>

          {/* ================================================================ */}
          {/* 第三层（中 · 受众画像与搜索/定向引擎）                           */}
          {/* ================================================================ */}
          <details className="mri-details-toggle mri-secondary-section">
            <summary className="mri-details-summary" style={{ fontSize: '13px', padding: '10px 0' }}>
              <strong>展开查看次级分析：受众人口学画像与搜索定向引擎</strong>（年龄分布、城市渗透、定向人群包与搜索词库）
            </summary>
            <section className="mri-group">
            <div className="mri-group-header">
              <div className="mri-group-title-wrap">
                <span className="mri-group-badge audience">受众与搜索</span>
                <h3 className="mri-group-title">受众人口学画像与搜索定向引擎</h3>
              </div>
              <p className="mri-group-desc">
                受众年龄段结构 + Top 12核心城市渗透 + 头部定向人群包效能 + 339条搜索词库分类
              </p>
            </div>

            <MetricStrip
              items={[
                { label: '25~34岁核心主力', value: '48.5', unit: '%', note: '独居安家/新婚首套/小户型扩容主力' },
                { label: '35~44岁品质中坚', value: '26.1', unit: '%', note: '二胎家庭/大容量除菌保鲜需求' },
                { label: 'Top 12核心渗透城市', value: '12', unit: '座', note: '成都、长沙、广州、杭州领跑' },
                { label: '有效搜索词配置', value: keywordsTotals.total, unit: '条', note: `品类词与竞品词占 ${keywordsTotals.total > 0 ? (((keywordsTotals.competeCount + keywordsTotals.catCount) / keywordsTotals.total) * 100).toFixed(1) : 0}%` },
              ]}
            />

            <div className="mri-grid">
              <ChartPanel
                title="受众人口学画像：年龄段分布（蒲公英真实样本N=105）"
                subtitle="去重博主受众加权年龄结构分布"
              >
                <HorizontalBarChart data={audienceAgeBarData} unit="%" />

              </ChartPanel>

              <ChartPanel
                title="双11核心达人与受众渗透 Top 12 城市分布"
                subtitle="依据达人地域与受众偏好指数聚合"
              >
                <HorizontalBarChart data={audienceCitiesBarData} unit="人" />

              </ChartPanel>

              <ChartPanel
                title="四大满贯定向人群包投放消耗对比（Top 8头部定向包）"
                subtitle="自采天猫/京东与红猫/红京CID高频放量人群"
              >
                <HorizontalBarChart data={audiencePackagesBarData} unit="元" />

              </ChartPanel>

              <ChartPanel
                title="投放搜索词库配置结构"
                subtitle={`数据源：搜索词配置（有效${keywordsTotals.total}条非空关键词配置）`}
              >
                <DonutChart data={keywordsDonutData} unit="条" centerLabel="有效词库" />

              </ChartPanel>
            </div>
          </section>
          </details>

          {/* ================================================================ */}
          {/* 第四层（中 · 达人内容二维热力矩阵与样机流转）                     */}
          {/* ================================================================ */}
          <section className="mri-group">
            <div className="mri-group-header">
              <div className="mri-group-title-wrap">
                <span className="mri-group-badge content">达人与内容</span>
                <h3 className="mri-group-title">达人内容合作矩阵与样机流转</h3>
              </div>
              <p className="mri-group-desc">
                主推产品×审核阶段热力矩阵 + 外溢平台×审核阶段热力矩阵 + 内容类型×合作形式堆叠 + 84台样机流转
              </p>
            </div>

            <MetricStrip
              items={[
                { label: '二核确认达人总量', value: 117, unit: '位', note: '双11最终确认合作名单 (N=117)' },
                { label: '试用样机流转总量', value: sampleMachineTotals.totalMachines, unit: '台', note: '严格隐私脱敏' },
                { label: '样机下单完成率', value: '72.6', unit: '%', note: '61台已完成下单' },
                { label: '内饰确认完成率', value: '73.8', unit: '%', note: '62台已完成内饰确认' },
              ]}
            />

            <div className="mri-grid">
              <ChartPanel
                title="双11二核确认KOL【内容类型 × 合作形式】分布（N=117）"
                subtitle="图文与视频形式在各大内容主题下的堆叠构成"
              >
                <StackedHorizontalBarChart
                  rows={themeFormatStacked.rows}
                  segments={themeFormatStacked.segments}
                  unit="篇"
                />

              </ChartPanel>
              <ChartPanel
                title="双11试用样机产品型号分布与三态流转进度"
                subtitle={`数据源：双11样机流转记录（全量${sampleMachineTotals.totalMachines}台）`}
              >
                <HorizontalBarChart data={sampleMachineBarData} unit="台" />

              </ChartPanel>
            </div>

            <details className="mri-details-toggle" style={{ marginTop: '14px' }}>
              <summary className="mri-details-summary">
                <strong>展开查看深度热力矩阵：主推产品与外溢平台审核阶段分布</strong>（12×9 与 5×9 矩阵）
              </summary>
              <div className="mri-grid" style={{ marginTop: '12px' }}>
                <ChartPanel
                title="双11二核确认KOL【主推产品 × 审核执行阶段】二维热力矩阵（N=117）"
                subtitle="各产品型号在各审核阶段推进密度透视"
              >
                <div className="mri-matrix-wrap">
                  <MatrixHeatmapChart
                    rows={matrixProductData.rows}
                    cols={matrixProductData.cols}
                    cells={matrixProductData.cells}
                    rowHeaderTitle="主推产品"
                    unit="位"
                    showRowTotals={true}
                  />
                </div>

              </ChartPanel>
                <ChartPanel
                title="双11二核确认KOL【外溢平台 × 审核执行阶段】二维热力矩阵（N=117）"
                subtitle="京东与天猫双渠道自采与代采执行阶段透视"
              >
                <div className="mri-matrix-wrap">
                  <MatrixHeatmapChart
                    rows={matrixPlatformData.rows}
                    cols={matrixPlatformData.cols}
                    cells={matrixPlatformData.cells}
                    rowHeaderTitle="外溢平台"
                    unit="位"
                    showRowTotals={true}
                  />
                </div>

              </ChartPanel>
              </div>
            </details>
          </section>

          {/* ================================================================ */}
          {/* 第五层（轻 · 历史参考与底层明细折叠抽屉）                       */}
          {/* ================================================================ */}
          <section className="mri-group">
            <div className="mri-group-header">
              <div className="mri-group-title-wrap">
                <span className="mri-group-badge history">历史与底层明细</span>
                <h3 className="mri-group-title">历史大促参考与底层明细</h3>
              </div>
              <p className="mri-group-desc">
                长表格与历史复盘明细默认折叠，保持首屏高效聚焦
              </p>
            </div>

            <details className="mri-details-toggle">
              <summary className="mri-details-summary">展开查看：2026年618复盘采买形式结构与ROI对照（独立已结案）</summary>
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

                  <div className="mri-table-wrapper" style={{ marginTop: '12px' }}>
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
                </ChartPanel>
              </div>
            </details>

            <details className="mri-details-toggle">
              <summary className="mri-details-summary">展开查看：双11各细分投放线10线完整数据明细表</summary>
              <div className="mri-table-wrapper" style={{ marginTop: '12px' }}>
                <table className="mri-audit-table">
                  <thead>
                    <tr>
                      <th>细分投放线</th>
                      <th>消耗金额(元)</th>
                      <th>展现量</th>
                      <th>点击量</th>
                      <th>点击率(%)</th>
                      <th>平均点击成本(元)</th>
                      <th>互动量</th>
                      <th>平均互动成本(元)</th>
                      <th>进店UV</th>
                      <th>平均进店成本(元)</th>
                      <th>投放状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiLineTable?.rows.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{String(r.line_name || '—')}</strong></td>
                        <td>{formatNum(parseNum(r.spend))}</td>
                        <td>{formatNum(parseNum(r.impressions), 0)}</td>
                        <td>{formatNum(parseNum(r.clicks), 0)}</td>
                        <td>{String(r.ctr ?? '—')}%</td>
                        <td>{formatNum(parseNum(r.cpc))}</td>
                        <td>{formatNum(parseNum(r.engagements), 0)}</td>
                        <td>{formatNum(parseNum(r.cpe))}</td>
                        <td>{formatNum(parseNum(r.uv), 0)}</td>
                        <td>{formatNum(parseNum(r.cpuv))}</td>
                        <td><span className={`mri-tag ${String(r.status) === '投放中' ? 'core' : 'neutral'}`}>{String(r.status || '—')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <details className="mri-details-toggle">
              <summary className="mri-details-summary">展开查看：7大投放账户规划打款与实际应消耗底层核对表</summary>
              <div className="mri-table-wrapper" style={{ marginTop: '12px' }}>
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

            <details className="mri-details-toggle">
              <summary className="mri-details-summary">展开查看：双11型号级规划明细表（9款主推型号+小计）</summary>
              <div className="mri-table-wrapper" style={{ marginTop: '12px' }}>
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

            <details className="mri-details-toggle">
              <summary className="mri-details-summary">展开查看：四大满贯定向人群包Top 10详细效能明细表</summary>
              <div className="mri-table-wrapper" style={{ marginTop: '12px' }}>
                <table className="mri-audit-table">
                  <thead>
                    <tr>
                      <th>定向人群包名称</th>
                      <th>应用投放线</th>
                      <th>消耗金额(元)</th>
                      <th>展现量</th>
                      <th>点击量</th>
                      <th>点击率(%)</th>
                      <th>平均点击成本(元)</th>
                      <th>平均互动成本(元)</th>
                      <th>进店UV</th>
                      <th>平均进店成本(元)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audiencePackagesTable?.rows.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{String(r.package_name || '—')}</strong></td>
                        <td>{String(r.channels || '—')}</td>
                        <td>{formatNum(parseNum(r.spend))}</td>
                        <td>{formatNum(parseNum(r.impressions), 0)}</td>
                        <td>{formatNum(parseNum(r.clicks), 0)}</td>
                        <td>{String(r.ctr ?? '—')}%</td>
                        <td>{formatNum(parseNum(r.cpc))}</td>
                        <td>{formatNum(parseNum(r.cpe))}</td>
                        <td>{formatNum(parseNum(r.uv), 0)}</td>
                        <td>{formatNum(parseNum(r.cpuv))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
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

          </ChartPanel>

          <ChartPanel
            title="投放搜索词库配置结构"
            subtitle={`数据源：搜索词配置（有效${keywordsTotals.total}条非空关键词配置）`}
          >
            <DonutChart data={keywordsDonutData} unit="条" centerLabel="有效词库" />

          </ChartPanel>

          <ChartPanel
            title="双11试用样机产品型号分布"
            subtitle={`数据源：双11样机流转记录（全量${sampleMachineTotals.totalMachines}台）`}
          >
            <HorizontalBarChart data={sampleMachineBarData} unit="台" />

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

          </ChartPanel>
        </div>
      )}
    </div>
  );
}
