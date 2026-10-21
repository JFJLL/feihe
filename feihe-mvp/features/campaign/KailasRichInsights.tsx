'use client';

import React, { useMemo, useState } from 'react';
import type { CampaignDashboard, CampaignTable } from '../../lib/campaign-types';
import {
  ChartPanel,
  MetricStrip,
  HorizontalBarChart,
  CampaignFunnelChart,
  MatrixHeatmapChart,
  StackedHorizontalBarChart,
  ScatterChart,
  CAMPAIGN_PALETTE,
  type ChartDatum,
  type FunnelStageDatum,
  type MatrixHeatmapCell,
  type MetricStripItem,
} from './CampaignCharts';
import { CampaignComboChart } from './CampaignComboChart';
import './kailas-rich-insights.css';

export interface KailasRichInsightsProps {
  dashboard: CampaignDashboard;
  section: 'overview' | 'ads' | 'content';
  snapshot?: string;
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const s = String(val).replace(/¥|￥|,|%/g, '').trim();
  if (!s || s === '-' || s === '/' || s === 'null' || s === 'None') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fmtMoney(val: number | null | undefined, digits = 0): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return `¥${val.toLocaleString('zh-CN', { maximumFractionDigits: digits })}`;
}

function fmtNum(val: number | null | undefined, digits = 0): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return val.toLocaleString('zh-CN', { maximumFractionDigits: digits });
}

export function KailasRichInsights({ dashboard, section }: KailasRichInsightsProps) {
  const tablesMap = useMemo(() => {
    const map = new Map<string, CampaignTable>();
    for (const t of dashboard.tables || []) {
      map.set(t.id, t);
    }
    return map;
  }, [dashboard.tables]);

  const [auditExpanded, setAuditExpanded] = useState(false);
  const [stageMetric, setStageMetric] = useState<'ctr' | 'cpe'>('ctr');

  // 1. Overall Budget Pacing (kailas-overall-budget-pacing)
  const budgetTable = tablesMap.get('kailas-overall-budget-pacing');
  const budgetData = useMemo(() => {
    if (!budgetTable?.rows?.length) return null;
    const totalB = 1518000;
    const totalS = 1288044.11;
    const totalK = 518378.11;
    const totalFS = 769666.00;
    const rows: Array<{ name: string; budget: number | null; spend: number | null; pacing: number | null }> = [];
    for (const r of budgetTable.rows) {
      const b = parseNum(r.totalBudget);
      const s = parseNum(r.totalSpend);
      const p = parseNum(r.pacingPct) ?? (b && b > 0 && s !== null ? (s / b) * 100 : null);
      rows.push({ name: String(r.projectName || ''), budget: b, spend: s, pacing: p });
    }

    const stackedRows = budgetTable.rows.map(r => {
      const name = String(r.projectName || '');
      const b = parseNum(r.totalBudget) || 0;
      const s = parseNum(r.totalSpend) || 0;
      const k = parseNum(r.kSpend) || 0;
      const fsVal = parseNum(r.fsSpend) || 0;
      const remaining = Math.max(0, b - (k + fsVal));
      const p = parseNum(r.pacingPct) ?? (b > 0 && s !== null ? (s / b) * 100 : 0);
      return {
        label: name,
        segments: {
          kSpend: k,
          fsSpend: fsVal,
          remaining: remaining > 0 ? remaining : 0,
        },
        meta: `总预算 ${fmtMoney(b)} (进度 ${p.toFixed(1)}%)`,
      };
    });

    const stackedSegments = [
      { key: 'kSpend', label: '达人采买 (K侧)', color: CAMPAIGN_PALETTE.primary },
      { key: 'fsSpend', label: '投流消耗 (FS含返点)', color: CAMPAIGN_PALETTE.purple },
      { key: 'remaining', label: '预算余量', color: '#e2e8f0' },
    ];

    return {
      totalBudget: totalB,
      totalSpend: totalS,
      totalKSpend: totalK,
      totalFSSpend: totalFS,
      externalUv: 10408,
      overallPacing: totalB > 0 ? (totalS / totalB) * 100 : null,
      rows,
      stackedRows,
      stackedSegments,
    };
  }, [budgetTable]);

  // 2. Monthly Creative Trend (kailas-monthly-creative-trend)
  const monthlyTable = tablesMap.get('kailas-monthly-creative-trend');
  const monthlyData = useMemo(() => {
    if (!monthlyTable?.rows?.length) return null;
    const rows: Array<{ month: string; spend: number | null; cpc: number | null; imp: number | null; clicks: number | null; ctr: number | null }> = [];
    let sumSpend = 0;
    let sumImp = 0;
    let sumClicks = 0;
    for (const r of monthlyTable.rows) {
      const s = parseNum(r.spend);
      const im = parseNum(r.impressions);
      const clk = parseNum(r.clicks);
      const c = parseNum(r.cpc) ?? (clk && clk > 0 && s !== null ? s / clk : null);
      const ctrVal = parseNum(r.ctr) ?? (im && im > 0 && clk !== null ? (clk / im) * 100 : null);
      if (s !== null) sumSpend += s;
      if (im !== null) sumImp += im;
      if (clk !== null) sumClicks += clk;
      rows.push({ month: String(r.month || ''), spend: s, cpc: c, imp: im, clicks: clk, ctr: ctrVal });
    }
    return {
      rows,
      sumSpend,
      sumImp,
      sumClicks,
      avgCPC: sumClicks > 0 ? sumSpend / sumClicks : null,
    };
  }, [monthlyTable]);

  // 3. Biweekly Stage Evolution (kailas-biweekly-stage-evolution)
  const biweeklyTable = tablesMap.get('kailas-biweekly-stage-evolution');
  const biweeklyData = useMemo(() => {
    if (!biweeklyTable?.rows?.length) return null;
    const rows = biweeklyTable.rows.map(r => ({
      stage: String(r.stage || '').split(' ')[0],
      fullStage: String(r.stage || ''),
      period: String(r.period || ''),
      spend: parseNum(r.spend),
      ctr: parseNum(r.ctr),
      cpc: parseNum(r.cpc),
      cpe: parseNum(r.cpe),
      cpuv: parseNum(r.cpuv),
      publishedNotes: parseNum(r.publishedNotes),
      viralNotes: String(r.viralNotes || ''),
      strategyHighlights: String(r.strategyHighlights || ''),
    }));
    return { rows };
  }, [biweeklyTable]);

  // 4. Full Funnel Summary (kailas-full-funnel-summary)
  const funnelTable = tablesMap.get('kailas-full-funnel-summary');
  const funnelData = useMemo(() => {
    const colors = [CAMPAIGN_PALETTE.primary, CAMPAIGN_PALETTE.purple, CAMPAIGN_PALETTE.gold, CAMPAIGN_PALETTE.terracotta];
    if (!funnelTable?.rows?.length) return null;
    const stages: FunnelStageDatum[] = funnelTable.rows.map((r, i) => ({
      stage: String(r.stage || ''),
      value: parseNum(r.totalValue),
      unit: String(r.unit || ''),
      conversionLabel: '',
      costLabel: String(r.costLabel || ''),
      subtext: String(r.description || ''),
      color: colors[i % colors.length],
    }));
    return { stages };
  }, [funnelTable]);

  // 5. Organic vs Paid Comparison (kailas-q3-organic-vs-paid)
  const organicPaidTable = tablesMap.get('kailas-q3-organic-vs-paid');
  // 6. 119 Notes Scatter Data (kailas-notes-performance-scatter)
  const scatterTable = tablesMap.get('kailas-notes-performance-scatter');
  const scatterData = useMemo(() => {
    if (!scatterTable?.rows?.length) return null;
    return scatterTable.rows.map(r => {
      const s = parseNum(r.spend);
      const cpe = parseNum(r.cpe);
      const eng = parseNum(r.engagements);
      const nick = String(r.kolName || '');
      const ctrVal = parseNum(r.ctr);
      const cpcVal = parseNum(r.cpc);
      return {
        label: nick,
        x: s,
        y: cpe,
        size: eng,
        detail: `消耗: ${fmtMoney(s)} | CPE: ¥${(cpe || 0).toFixed(1)} | CTR: ${(ctrVal || 0).toFixed(1)}% | CPC: ¥${(cpcVal || 0).toFixed(2)}`,
      };
    });
  }, [scatterTable]);

  // 7. 119 Notes Pareto (kailas-notes-119-pareto-concentration)
  const paretoTable = tablesMap.get('kailas-notes-119-pareto-concentration') || tablesMap.get('kailas-notes-119-pareto');
  const paretoData = useMemo(() => {
    if (!paretoTable?.rows?.length) return null;
    const top10Notes = paretoTable.rows.slice(0, 10);
    const rows = top10Notes.map((r, i) => ({
      name: `#${i + 1} ${String(r.nickname || '')}`,
      spend: parseNum(r.spend),
      cumPct: parseNum(r.cumPct),
    }));
    return { rows };
  }, [paretoTable]);

  // 8. Leverage Top 8 (kailas-notes-leverage-fs-k)
  const leverageTable = tablesMap.get('kailas-notes-leverage-fs-k');
  const leverageTopData = useMemo(() => {
    if (!leverageTable?.rows?.length) return null;
    const sorted = [...leverageTable.rows]
      .filter(r => parseNum(r.fsKLeverage) !== null)
      .sort((a, b) => (parseNum(b.fsKLeverage) || 0) - (parseNum(a.fsKLeverage) || 0))
      .slice(0, 8);
    const items: ChartDatum[] = sorted.map(r => {
      const lev = parseNum(r.fsKLeverage) || 0;
      const kCost = parseNum(r.kRawPrice);
      const fsCost = parseNum(r.fsSpend);
      return {
        label: `${String(r.kolName || '')} (${lev.toFixed(1)}x)`,
        value: fsCost || 0,
        sublabel: `K端裸价 ${fmtMoney(kCost)} → 投流撬动 ${fmtMoney(fsCost)} (杠杆 ${lev.toFixed(2)}倍)`,
      };
    });
    return { items };
  }, [leverageTable]);

  // 9. Potential Notes to Boost (kailas-potential-notes-boost)
  const potentialTable = tablesMap.get('kailas-potential-notes-boost');
  const potentialNotesData = useMemo(() => {
    if (!potentialTable?.rows?.length) return null;
    return potentialTable.rows.map(r => ({
      kolName: String(r.kolName || ''),
      noteId: String(r.noteId || ''),
      fsSpend: parseNum(r.fsSpend),
      fsKLeverage: parseNum(r.fsKLeverage),
      ctr: parseNum(r.ctr),
      cpc: parseNum(r.cpc),
      cpe: parseNum(r.cpe),
      recommendation: String(r.recommendation || ''),
    }));
  }, [potentialTable]);

  // 10. Keywords Full & Categories
  const kwTable = tablesMap.get('kailas-keyword-category-full') || tablesMap.get('kailas-search-keywords-category');
  const kwData = useMemo(() => {
    if (!kwTable?.rows?.length) return null;
    const rows = kwTable.rows.map(r => {
      const rawCtr = r.ctr !== undefined ? r.ctr : r.ctrPct;
      return {
        category: String(r.category || ''),
        spend: parseNum(r.spend),
        ctr: parseNum(rawCtr),
        cpc: parseNum(r.cpc),
      };
    });
    const totalSpend = rows.reduce((acc, cur) => acc + (cur.spend || 0), 0);
    return { rows, totalSpend };
  }, [kwTable]);

  // 11. Targeting Audience (Top 12)
  const targetingTable = tablesMap.get('kailas-targeting-audience');
  const targetingData = useMemo(() => {
    if (!targetingTable?.rows?.length) return null;
    const rows = targetingTable.rows.slice(0, 12).map(r => {
      const rawCtr = r.ctr !== undefined ? r.ctr : r.ctrPct;
      return {
        group: String(r.audienceGroup || ''),
        spend: parseNum(r.spend),
        cpc: parseNum(r.cpc),
        ctr: parseNum(rawCtr),
      };
    });
    return { rows };
  }, [targetingTable]);

  // 12. Candidate Pool Status
  const poolTable = tablesMap.get('kailas-candidate-pool-status');
  const poolData = useMemo(() => {
    if (!poolTable?.rows?.length) return null;
    const items: ChartDatum[] = poolTable.rows.map(r => ({
      label: String(r.stage || ''),
      value: parseNum(r.count) || 0,
      sublabel: String(r.sourceDesc || r.distributionNote || ''),
    }));
    return { items };
  }, [poolTable]);

  // 13. Tier x Direction Matrix
  const matrixTable = tablesMap.get('kailas-tier-direction-matrix');
  const matrixData = useMemo(() => {
    if (!matrixTable?.rows?.length) return null;
    const rows = ['头部', '腰部', '尾部', 'UGC'];
    const colsSet = new Set<string>();
    for (const r of matrixTable.rows) {
      if (r.direction) colsSet.add(String(r.direction));
    }
    const cols = Array.from(colsSet);
    const cells: MatrixHeatmapCell[] = matrixTable.rows.map(r => {
      const count = parseNum(r.noteCount) || 0;
      const spend = parseNum(r.spend);
      const avgSpend = parseNum(r.avgSpend);
      return {
        row: String(r.tier || ''),
        col: String(r.direction || ''),
        value: count,
        secondaryValue: spend !== null && spend > 0 ? fmtMoney(spend) : '—',
        meta: count > 0 ? `${count} 篇 (共${fmtMoney(spend)}, 均${fmtMoney(avgSpend)})` : '未投放',
      };
    });
    return { rows, cols, cells };
  }, [matrixTable]);

  // 14. Audit Common Issues
  const auditTable = tablesMap.get('kailas-audit-common-issues');
  const auditIssues = useMemo(() => {
    return auditTable?.rows || [];
  }, [auditTable]);

  // 15. KOL Tier & Content Direction (for content tab)
  const tierTable = tablesMap.get('kailas-kol-tier-matrix');
  const tierData = useMemo(() => {
    if (!tierTable?.rows?.length) return null;
    const rows = tierTable.rows.map(r => ({
      tier: String(r.tier || ''),
      count: parseNum(r.count),
      totalSpend: parseNum(r.totalSpend),
    }));
    const totalKOLSpend = rows.reduce((acc, cur) => acc + (cur.totalSpend || 0), 0);
    const totalKOLCount = rows.reduce((acc, cur) => acc + (cur.count || 0), 0);
    return { rows, totalKOLSpend, totalKOLCount };
  }, [tierTable]);

  const directionTable = tablesMap.get('kailas-content-direction-summary');
  const directionData = useMemo(() => {
    if (!directionTable?.rows?.length) return null;
    const rows = directionTable.rows.map(r => ({
      direction: String(r.direction || ''),
      noteCount: parseNum(r.noteCount),
      kolSpend: parseNum(r.kolSpend),
    }));
    return { rows };
  }, [directionTable]);

  // Metric Strips
  const overviewMetrics: MetricStripItem[] = useMemo(() => {
    if (!budgetData) return [];
    return [
      {
        label: '规划总预算',
        value: fmtMoney(budgetData.totalBudget),
        meta: '全项目全口径预算',
        status: 'default',
      },
      {
        label: '实际总消耗',
        value: fmtMoney(budgetData.totalSpend),
        meta: budgetData.overallPacing !== null ? `进度 ${budgetData.overallPacing.toFixed(1)}%` : '未标进度',
        status: 'accent',
      },
      {
        label: '投流侧消耗',
        value: fmtMoney(budgetData.totalFSSpend),
        meta: 'FS商业投流放大 (含返点)',
        status: 'default',
      },
      {
        label: '达人采买消耗',
        value: fmtMoney(budgetData.totalKSpend),
        meta: 'K侧达人合作采买',
        status: 'default',
      },
      {
        label: '小红星站外活跃UV',
        value: `${fmtNum(budgetData.externalUv)} UV`,
        meta: '站外进店外溢 (CPUV ¥73.95)',
        status: 'accent',
      },
    ];
  }, [budgetData]);

  const adsMetrics: MetricStripItem[] = useMemo(() => {
    const totalKw = kwData?.totalSpend || 0;
    const totalMonthly = monthlyData?.sumSpend || 0;
    const avgCpc = monthlyData?.avgCPC;
    return [
      {
        label: '投放总消耗',
        value: fmtMoney(totalMonthly),
        meta: '7-10月投放全量日志',
        status: 'accent',
      },
      {
        label: '搜索推广消耗',
        value: fmtMoney(totalKw),
        meta: '大类关键词搜索推广',
        status: 'default',
      },
      {
        label: '平均点击成本 (CPC)',
        value: avgCpc !== null && avgCpc !== undefined ? `¥${avgCpc.toFixed(2)}` : '—',
        meta: '全周期平均点击成本',
        status: 'default',
      },
      {
        label: '总点击量',
        value: fmtNum(monthlyData?.sumClicks),
        meta: '投放有效点击累计',
        status: 'default',
      },
    ];
  }, [kwData, monthlyData]);

  const contentMetrics: MetricStripItem[] = useMemo(() => {
    return [
      {
        label: '初筛达人池规模',
        value: `${fmtNum(poolTable?.rows?.[0]?.count as number)} 位`,
        meta: '海选初筛独立候选池',
        status: 'default',
      },
      {
        label: '复筛评估规模',
        value: `${fmtNum(poolTable?.rows?.[1]?.count as number)} 位`,
        meta: '深入评估独立候选池',
        status: 'default',
      },
      {
        label: '执行表合作登记',
        value: `${tierData?.totalKOLCount || 70} 篇`,
        meta: '执行表签约70位（截至9/27已发布59篇）',
        status: 'accent',
      },
      {
        label: '合作合计金额（含服务费）',
        value: fmtMoney(tierData?.totalKOLSpend),
        meta: '70位合作合计金额（含服务费）',
        status: 'default',
      },
    ];
  }, [poolTable, tierData]);

  return (
    <div className='kri-root'>
      {/* ======================= SECTION: OVERVIEW (5 Layers Deep Mining) ======================= */}
      {section === 'overview' && (
        <>
          {overviewMetrics.length > 0 && <MetricStrip items={overviewMetrics} />}

          {/* ----------------- 第一层 (重 · 全口径预算与多阶段演进) ----------------- */}
          <div className='kri-section'>
            <div className='kri-section-header'>
              <h3 className='kri-section-title'>全口径预算统筹与多阶段投放演进</h3>
              <span className='kri-section-desc'>黑山Q3、EX330与跑山女孩预算执行结构与双周演进</span>
            </div>
            <div className='kri-grid-2'>
              {/* 1.1 子项目全口径预算规划 vs 实际消耗 */}
              {budgetData && (
                <ChartPanel
                  title='子项目全口径预算规划 vs 实际消耗'
                  subtitle='拆解黑山Q3、EX330与跑山女孩子项目预算及执行进度'
                >
                  <CampaignComboChart
                    title='子项目全口径预算规划 vs 实际消耗'
                    rows={budgetData.rows}
                    xKey='name'
                    series={[
                      {
                        key: 'budget',
                        label: '规划总预算',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: CAMPAIGN_PALETTE.primary,
                      },
                      {
                        key: 'spend',
                        label: '实际总消耗',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: CAMPAIGN_PALETTE.purple,
                      },
                      {
                        key: 'pacing',
                        label: '执行进度',
                        unit: '%',
                        axis: 'right',
                        kind: 'line',
                        color: CAMPAIGN_PALETTE.gold,
                      },
                    ]}
                    height={250}
                  />
                </ChartPanel>
              )}

              {/* 1.2 三子项目达人采买(K) vs 投流消耗(FS) 堆叠构成 */}
              {budgetData && (
                <ChartPanel
                  title='子项目达人采买(K) vs 投流消耗(FS) 堆叠构成'
                  subtitle='拆解K端博主采买裸价与FS端商业投流放大(含返点)的真实资金分配'
                >
                  <StackedHorizontalBarChart
                    rows={budgetData.stackedRows}
                    segments={budgetData.stackedSegments}
                    unit='元'
                  />
                </ChartPanel>
              )}

              {/* 1.3 7-10月投放消耗 vs 平均点击成本 */}
              {monthlyData && (
                <ChartPanel
                  title='7-10月投放消耗 vs 平均点击成本 (CPC)'
                  subtitle='基于7-10月创意底表78,998条底层日志真实回溯'
                >
                  <CampaignComboChart
                    title='7-10月投放消耗 vs 平均点击成本 (CPC)'
                    rows={monthlyData.rows}
                    xKey='month'
                    series={[
                      {
                        key: 'spend',
                        label: '投放消耗',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: CAMPAIGN_PALETTE.primary,
                      },
                      {
                        key: 'cpc',
                        label: '平均点击成本',
                        unit: '元',
                        axis: 'right',
                        kind: 'line',
                        color: CAMPAIGN_PALETTE.gold,
                      },
                    ]}
                    height={250}
                  />
                </ChartPanel>
              )}

              {/* 1.4 Q3双周阶段演化对比表 */}
              {biweeklyData && (
                <ChartPanel
                  title='Q3双周阶段演进效率趋势'
                  subtitle='7.16-8.12首期测新 → 8月全月攻坚 → 8.27-9.8前哨冲刺 → 9.9-9.27决战收官'
                  actions={
                    <div className='kri-toggle-group' role='group' aria-label='双周阶段效率指标切换'>
                      <button
                        type='button'
                        className={`kri-toggle-btn ${stageMetric === 'ctr' ? 'active' : ''}`}
                        onClick={() => setStageMetric('ctr')}
                      >
                        点击率 CTR (%)
                      </button>
                      <button
                        type='button'
                        className={`kri-toggle-btn ${stageMetric === 'cpe' ? 'active' : ''}`}
                        onClick={() => setStageMetric('cpe')}
                      >
                        互动成本 CPE (元)
                      </button>
                    </div>
                  }
                >
                  <CampaignComboChart
                    title='Q3双周阶段演进效率趋势'
                    rows={biweeklyData.rows}
                    xKey='stage'
                    series={[
                      {
                        key: 'spend',
                        label: '阶段消耗',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: CAMPAIGN_PALETTE.purple,
                      },
                      stageMetric === 'ctr'
                        ? {
                            key: 'ctr',
                            label: '点击率 CTR',
                            unit: '%',
                            axis: 'right',
                            kind: 'line',
                            color: CAMPAIGN_PALETTE.primary,
                          }
                        : {
                            key: 'cpe',
                            label: '互动成本 CPE',
                            unit: '元',
                            axis: 'right',
                            kind: 'line',
                            color: CAMPAIGN_PALETTE.gold,
                          },
                    ]}
                    height={250}
                  />
                </ChartPanel>
              )}
            </div>
          </div>

          <div className='kri-section'>
            <div className='kri-section-header'>
              <h3 className='kri-section-title'>关键交付指标与自然 / 投流对比</h3>
              <span className='kri-section-desc'>各项指标保留原表归因口径，不视为同一人群逐级转化</span>
            </div>
            <div className='kri-grid-2'>
              {/* 2.1 全链路种草转化漏斗 */}
              {funnelData && (
                <ChartPanel
                  title='Q3种草投流 · 关键交付节点'
                  subtitle='曝光、点击与互动为行为量；站外活跃UV为独立归因人数'
                >
                  <CampaignFunnelChart stages={funnelData.stages} />
                </ChartPanel>
              )}

              {/* 2.2 自然流量沉淀 vs FS商业投流放大 */}
              {organicPaidTable && (
                <ChartPanel
                  title={organicPaidTable.title || '自然内容流量沉淀 vs 商业投流放大数据表'}
                  subtitle={organicPaidTable.note || '内容端为KOL采购及自然分发沉淀，投流端为FS商业放量'}
                >
                  <div className="kri-organic-compare">
                    {organicPaidTable.rows.filter(row => !/全量|汇总/.test(String(row.channel || ''))).map((row, index) => (
                      <div className="kri-organic-channel" key={String(row.channel || index)}>
                        <div className="kri-organic-label"><strong>{String(row.channel || '未标注渠道')}</strong><span>投入 {fmtMoney(parseNum(row.spend))}</span></div>
                        <div className="kri-organic-impressions"><strong>{fmtNum(parseNum(row.impressions))}</strong><span>次曝光</span></div>
                        <div className="kri-organic-facts">
                          <span>阅读 <b>{fmtNum(parseNum(row.reads))}</b></span><span>互动 <b>{fmtNum(parseNum(row.engagements))}</b></span>
                          <span>CPC <b>{fmtMoney(parseNum(row.cpc), 2)}</b></span><span>CPE <b>{fmtMoney(parseNum(row.cpe), 2)}</b></span>
                        </div>
                      </div>
                    ))}
                    <p className="kri-organic-note">投入、曝光与效率并列对照。自然与商业流量可能重叠，不据此推断新增去重人群或因果增量。</p>
                  </div>
                </ChartPanel>
              )}
            </div>
          </div>

          <details className="kri-section kri-secondary"><summary>笔记投流杠杆、Pareto 集中度与四象限散点诊断</summary>
            <div className='kri-grid-2'>
              {/* 3.1 119篇笔记四象限散点图 */}
              {scatterData && (
                <ChartPanel
                  title='119篇达人笔记【投流消耗 × 互动成本 CPE】四象限分布'
                  subtitle='X轴为投流消耗，Y轴为互动成本(CPE)，气泡大小代表互动量'
                >
                  <ScatterChart
                    data={scatterData}
                    xLabel='投流消耗 (元)'
                    yLabel='互动成本 CPE (元)'
                  />
                </ChartPanel>
              )}

              {/* 3.2 Top 10 笔记 Pareto 集中度 */}
              {paretoData && (
                <ChartPanel
                  title='Top 10 笔记素材投流消耗与累计占比 (Pareto)'
                  subtitle='头部素材投流集中度与累计占比分布曲线'
                >
                  <CampaignComboChart
                    title='Top 10 笔记素材投流消耗与累计占比 (Pareto)'
                    rows={paretoData.rows}
                    xKey='name'
                    series={[
                      {
                        key: 'spend',
                        label: '素材投流消耗',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: CAMPAIGN_PALETTE.purple,
                      },
                      {
                        key: 'cumPct',
                        label: '累计消耗占比',
                        unit: '%',
                        axis: 'right',
                        kind: 'line',
                        color: CAMPAIGN_PALETTE.gold,
                      },
                    ]}
                    height={250}
                  />
                </ChartPanel>
              )}

              {/* 3.3 Top 8 笔记投流杠杆倍数榜 (FS / K) */}
              {leverageTopData && (
                <ChartPanel
                  title='Top 8 高投流杠杆笔记 (FS商业投流 / K端采买倍数)'
                  subtitle='精选撬动杠杆最高的达人素材：K端低价采买、FS端高强度追投放大'
                >
                  <HorizontalBarChart data={leverageTopData.items} height={250} />
                </ChartPanel>
              )}

              {/* 3.4 9篇低成本高转化待加推潜力笔记清单 */}
              {potentialNotesData && (
                <ChartPanel
                  title='需提升消耗的潜力笔记加推清单 (低杠杆高转化)'
                  subtitle='挖掘自 hGgSvt：具备高点击率(最高12.11%)与极佳CPE(最低¥2.49)却严重低投(杠杆<0.2x)'
                >
                  <div className='kri-potential-wrap'>
                    <div className='kri-potential-grid'>
                      {potentialNotesData.slice(0, 6).map((item, idx) => (
                        <div key={item.noteId || idx} className='kri-potential-card'>
                          <div className='kri-pot-head'>
                            <span className='kri-pot-name'>#{idx + 1} {item.kolName}</span>
                            <span className='kri-pot-lev'>杠杆 {item.fsKLeverage?.toFixed(2)}x</span>
                          </div>
                          <div className='kri-pot-metrics'>
                            <span>CTR <strong>{item.ctr?.toFixed(1)}%</strong></span>
                            <span>CPC <strong>¥{item.cpc?.toFixed(2)}</strong></span>
                            <span>CPE <strong>¥{item.cpe?.toFixed(2)}</strong></span>
                            <span>已投 <strong>{fmtMoney(item.fsSpend)}</strong></span>
                          </div>
                          <div className='kri-pot-rec'>{item.recommendation}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </ChartPanel>
              )}
            </div>
          </details>

          <details className="kri-section kri-secondary"><summary>搜索词类与精准人群定向引擎</summary>
            <div className='kri-grid-2'>
              {/* 4.1 搜索推广大类关键词投放效果多指标分析 */}
              {kwData && (
                <ChartPanel
                  title='搜索推广大类关键词投放效果多指标分析'
                  subtitle='品牌词、品类词、穿搭词、竞品词、场景词与大促词消耗及点击率表现'
                >
                  <CampaignComboChart
                    title='搜索推广大类关键词投放效果多指标分析'
                    rows={kwData.rows}
                    xKey='category'
                    series={[
                      {
                        key: 'spend',
                        label: '关键词消耗',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: CAMPAIGN_PALETTE.primary,
                      },
                      {
                        key: 'ctr',
                        label: '点击率 (CTR)',
                        unit: '%',
                        axis: 'right',
                        kind: 'line',
                        color: CAMPAIGN_PALETTE.purple,
                      },
                    ]}
                    height={250}
                  />
                </ChartPanel>
              )}

              {/* 4.2 核心精准定向人群包消耗与点击成本对比 */}
              {targetingData && (
                <ChartPanel
                  title='核心精准定向人群包消耗与点击成本对比 (Top 12)'
                  subtitle='核心产品包、出游穿搭、奢品看世界、辛芷蕾粉丝等精准人群定向效率'
                >
                  <CampaignComboChart
                    title='核心精准定向人群包消耗与点击成本对比'
                    rows={targetingData.rows}
                    xKey='group'
                    series={[
                      {
                        key: 'spend',
                        label: '人群包消耗',
                        unit: '元',
                        axis: 'left',
                        kind: 'bar',
                        color: CAMPAIGN_PALETTE.primary,
                      },
                      {
                        key: 'cpc',
                        label: '平均点击成本 (CPC)',
                        unit: '元',
                        axis: 'right',
                        kind: 'line',
                        color: CAMPAIGN_PALETTE.gold,
                      },
                    ]}
                    height={250}
                  />
                </ChartPanel>
              )}
            </div>
          </details>

          <details className="kri-section kri-secondary"><summary>达人候选池规模、内容方向热力矩阵与审稿质检</summary>
            <div className='kri-grid-2'>
              {/* 5.1 初筛与复筛候选达人独立池状态分布 */}
              {poolData && (
                <ChartPanel
                  title='初筛与复筛候选达人独立池状态分布'
                  subtitle='海选初筛(1530)与深入复筛(615)为独立评估池，实际签约执行登记70位'
                >
                  <HorizontalBarChart data={poolData.items} height={250} />
                </ChartPanel>
              )}

              {/* 5.2 达人层级 × 内容方向 二维热力矩阵 */}
              {matrixData && (
                <ChartPanel
                  title='【达人层级 × 8大内容方向】二维篇数与采买热力矩阵'
                  subtitle='头部(1)、腰部(2)、尾部(46)、UGC(21) 在时尚穿搭、跑山专业等方向的交叉落地'
                >
                  <MatrixHeatmapChart
                    rows={matrixData.rows}
                    cols={matrixData.cols}
                    cells={matrixData.cells}
                    rowHeaderTitle='达人层级'
                    unit='篇'
                  />
                </ChartPanel>
              )}
            </div>

            {/* 5.3 达人审稿常见问题归纳 (折叠收纳在 details 内，保障清爽) */}
            <div className='kri-audit-collapsible-box'>
              <details
                className='kri-details'
                open={auditExpanded}
                onToggle={(e) => setAuditExpanded((e.target as HTMLDetailsElement).open)}
              >
                <summary className='kri-summary'>
                  <span className='kri-summary-title'>
                    📋 达人内容审核 · 高频问题归纳与质检红线标准 (点击展开/折叠 8项要点)
                  </span>
                  <span className='kri-summary-tag'>
                    {auditExpanded ? '收起质检卡' : '展开查看 8 大规范与典型案例'}
                  </span>
                </summary>

                <div className='kri-audit-card-grid'>
                  {auditIssues.map((issue, idx) => (
                    <div key={String(issue.issueCode || idx)} className='kri-audit-card'>
                      <div className='kri-audit-head'>
                        <span className={`kri-audit-sev ${String(issue.severity || '').includes('P0') ? 'kri-sev-p0' : 'kri-sev-p1'}`}>
                          {String(issue.severity || '')}
                        </span>
                        <span className='kri-audit-cat'>{String(issue.category || '')}</span>
                        <span className='kri-audit-freq'>{String(issue.violationCount || '')}</span>
                      </div>
                      <h4 className='kri-audit-name'>{String(issue.issueTitle || '')}</h4>
                      <div className='kri-audit-ex'>
                        <div className='kri-audit-bad'><strong>❌ 错误示例：</strong>{String(issue.examples || '')}</div>
                        <div className='kri-audit-good'><strong>✅ 规范标准：</strong>{String(issue.correctStandard || '')}</div>
                      </div>
                      <div className='kri-audit-act'><strong>质检卡点：</strong>{String(issue.action || '')}</div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </details>
        </>
      )}

      {/* ======================= SECTION: ADS ======================= */}
      {section === 'ads' && (
        <>
          {adsMetrics.length > 0 && <MetricStrip items={adsMetrics} />}

          <div className='kri-grid-2'>
            {/* Chart 5: Search Keyword Categories */}
            {kwData && (
              <ChartPanel
                title='搜索推广大类关键词投放效果多指标分析'
                subtitle='品牌词、品类词、穿搭词、竞品词等分类消耗与点击表现'
              >
                <CampaignComboChart
                  title='搜索推广大类关键词投放效果多指标分析'
                  rows={kwData.rows}
                  xKey='category'
                  series={[
                    {
                      key: 'spend',
                      label: '关键词消耗',
                      unit: '元',
                      axis: 'left',
                      kind: 'bar',
                      color: CAMPAIGN_PALETTE.primary,
                    },
                    {
                      key: 'ctr',
                      label: '点击率 (CTR)',
                      unit: '%',
                      axis: 'right',
                      kind: 'line',
                      color: CAMPAIGN_PALETTE.purple,
                    },
                  ]}
                  height={260}
                />
              </ChartPanel>
            )}

            {/* Chart 6: Audience Targeting */}
            {targetingData && (
              <ChartPanel
                title='核心精准定向人群包消耗与点击成本对比'
                subtitle='核心产品包、出游穿搭、奢品、运动机能等定向效率表现'
              >
                <CampaignComboChart
                  title='核心精准定向人群包消耗与点击成本对比'
                  rows={targetingData.rows}
                  xKey='group'
                  series={[
                    {
                      key: 'spend',
                      label: '人群包消耗',
                      unit: '元',
                      axis: 'left',
                      kind: 'bar',
                      color: CAMPAIGN_PALETTE.primary,
                    },
                    {
                      key: 'cpc',
                      label: '平均点击成本 (CPC)',
                      unit: '元',
                      axis: 'right',
                      kind: 'line',
                      color: CAMPAIGN_PALETTE.gold,
                    },
                  ]}
                  height={260}
                />
              </ChartPanel>
            )}
          </div>
        </>
      )}

      {/* ======================= SECTION: CONTENT ======================= */}
      {section === 'content' && (
        <>
          {contentMetrics.length > 0 && <MetricStrip items={contentMetrics} />}

          <div className='kri-grid-2'>
            {/* Chart 7: Candidate Pool Status (Independent Stages) */}
            {poolData && (
              <ChartPanel
                title='初筛与复筛候选达人独立池状态分布'
                subtitle='初筛与复筛为独立评估池（非同母集单一漏斗），各池独立核实'
              >
                <HorizontalBarChart data={poolData.items} height={260} />
              </ChartPanel>
            )}

            {/* Chart 8: Content Direction Summary */}
            {directionData && (
              <ChartPanel
                title='内容方向合作篇数与采买费用对比'
                subtitle='时尚穿搭、跑山专业、街头采访等方向结构分布'
              >
                <CampaignComboChart
                  title='内容方向合作篇数与采买费用对比'
                  rows={directionData.rows}
                  xKey='direction'
                  series={[
                    {
                      key: 'noteCount',
                      label: '合作篇数',
                      unit: '篇',
                      axis: 'left',
                      kind: 'bar',
                      color: CAMPAIGN_PALETTE.primary,
                    },
                    {
                      key: 'kolSpend',
                      label: '合作合计金额（含服务费）',
                      unit: '元',
                      axis: 'right',
                      kind: 'line',
                      color: CAMPAIGN_PALETTE.gold,
                    },
                  ]}
                  height={260}
                />
              </ChartPanel>
            )}
          </div>
        </>
      )}
    </div>
  );
}
