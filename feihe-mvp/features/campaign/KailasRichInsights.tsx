'use client';

import React, { useMemo } from 'react';
import type { CampaignDashboard, CampaignTable } from '../../lib/campaign-types';
import {
  ChartPanel,
  MetricStrip,
  HorizontalBarChart,
  CAMPAIGN_PALETTE,
  type ChartDatum,
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

function fmtMoney(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return `¥${val.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
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

  // Table 1: Overall Budget Pacing
  const budgetTable = tablesMap.get('kailas-overall-budget-pacing');
  const budgetData = useMemo(() => {
    if (!budgetTable?.rows?.length) return null;
    let totalB = 0;
    let totalS = 0;
    let totalK = 0;
    let totalFS = 0;
    const rows: Array<{ name: string; budget: number | null; spend: number | null; pacing: number | null }> = [];
    for (const r of budgetTable.rows) {
      const b = parseNum(r.totalBudget);
      const s = parseNum(r.totalSpend);
      const k = parseNum(r.kSpend);
      const fs = parseNum(r.fsSpend);
      const p = parseNum(r.pacingPct) ?? (b && b > 0 && s !== null ? (s / b) * 100 : null);
      if (b !== null) totalB += b;
      if (s !== null) totalS += s;
      if (k !== null) totalK += k;
      if (fs !== null) totalFS += fs;
      rows.push({ name: String(r.projectName || ''), budget: b, spend: s, pacing: p });
    }
    return {
      totalBudget: totalB,
      totalSpend: totalS,
      totalKSpend: totalK,
      totalFSSpend: totalFS,
      overallPacing: totalB > 0 ? (totalS / totalB) * 100 : null,
      rows,
    };
  }, [budgetTable]);

  // Table 2: Monthly Creative Trend
  const monthlyTable = tablesMap.get('kailas-monthly-creative-trend');
  const monthlyData = useMemo(() => {
    if (!monthlyTable?.rows?.length) return null;
    const rows: Array<{ month: string; spend: number | null; cpc: number | null; imp: number | null; clicks: number | null }> = [];
    let sumSpend = 0;
    let sumImp = 0;
    let sumClicks = 0;
    for (const r of monthlyTable.rows) {
      const s = parseNum(r.spend);
      const im = parseNum(r.impressions);
      const clk = parseNum(r.clicks);
      const c = parseNum(r.cpc) ?? (clk && clk > 0 && s !== null ? s / clk : null);
      if (s !== null) sumSpend += s;
      if (im !== null) sumImp += im;
      if (clk !== null) sumClicks += clk;
      rows.push({ month: String(r.month || ''), spend: s, cpc: c, imp: im, clicks: clk });
    }
    return {
      rows,
      sumSpend,
      sumImp,
      sumClicks,
      avgCPC: sumClicks > 0 ? sumSpend / sumClicks : null,
    };
  }, [monthlyTable]);

  // Table 3: 119 Notes Pareto (Top 10 for Overview)
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

  // Table 4: Keyword Categories (Reads kailas-keyword-category-full with fallback to kailas-search-keywords-category)
  const kwTable = tablesMap.get('kailas-keyword-category-full') || tablesMap.get('kailas-search-keywords-category');
  const kwData = useMemo(() => {
    if (!kwTable?.rows?.length) return null;
    const rows = kwTable.rows.map(r => {
      // Fallback order: r.ctr ?? r.ctrPct. Never replace null with 0.
      const rawCtr = r.ctr !== undefined ? r.ctr : r.ctrPct;
      return {
        category: String(r.category || ''),
        spend: parseNum(r.spend),
        ctr: parseNum(rawCtr),
        cpc: parseNum(r.cpc),
      };
    });
    const totalSpend = rows.reduce((acc, cur) => acc + (cur.spend || 0), 0);
    // SSR validation assertion: ensure CTR values are not all zero or null
    const nonNullCtrs = rows.filter(r => r.ctr !== null && r.ctr > 0);
    return { rows, totalSpend, validCtrCount: nonNullCtrs.length };
  }, [kwTable]);

  // Table 5: Targeting Audience (Full names, top 10)
  const targetingTable = tablesMap.get('kailas-targeting-audience');
  const targetingData = useMemo(() => {
    if (!targetingTable?.rows?.length) return null;
    const rows = targetingTable.rows.slice(0, 10).map(r => {
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

  // Table 6: Candidate Pool Status
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

  // Table 7: KOL Tier Matrix
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

  // Table 8: Content Direction Summary
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
        meta: 'FS投流与返点消耗',
        status: 'default',
      },
      {
        label: '达人采买消耗',
        value: fmtMoney(budgetData.totalKSpend),
        meta: 'K侧达人合作采买',
        status: 'default',
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
        meta: '执行表合作登记70位（截至9/27已发布59篇）',
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
    <div className="kri-root">
      {/* ======================= SECTION: OVERVIEW (Balanced 2x2 Grid) ======================= */}
      {section === 'overview' && (
        <>
          {overviewMetrics.length > 0 && <MetricStrip items={overviewMetrics} />}

          <div className="kri-grid-2">
            {/* 1. 子项目全口径预算规划 vs 实际消耗 */}
            {budgetData && (
              <ChartPanel
                title="子项目全口径预算规划 vs 实际消耗"
                subtitle="拆解黑山Q3、EX330与跑山女孩子项目预算及执行进度"
              >
                <CampaignComboChart
                  title="子项目全口径预算规划 vs 实际消耗"
                  rows={budgetData.rows}
                  xKey="name"
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
                  height={260}
                />
              </ChartPanel>
            )}

            {/* 2. 7-10月投放消耗 vs 平均点击成本 */}
            {monthlyData && (
              <ChartPanel
                title="7-10月投放消耗 vs 平均点击成本 (CPC)"
                subtitle="基于7-10月全量投放日志真实回溯"
              >
                <CampaignComboChart
                  title="7-10月投放消耗 vs 平均点击成本 (CPC)"
                  rows={monthlyData.rows}
                  xKey="month"
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
                  height={260}
                />
              </ChartPanel>
            )}

            {/* 3. Top 10 笔记素材投流消耗与累计占比 (Pareto) */}
            {paretoData && (
              <ChartPanel
                title="Top 10 笔记素材投流消耗与累计占比 (Pareto)"
                subtitle="头部素材投流集中度与累计占比分布曲线"
              >
                <CampaignComboChart
                  title="Top 10 笔记素材投流消耗与累计占比 (Pareto)"
                  rows={paretoData.rows}
                  xKey="name"
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
                  height={260}
                />
              </ChartPanel>
            )}

            {/* 4. 合作达人层级采买费用 vs 合作人数 */}
            {tierData && (
              <ChartPanel
                title="合作达人层级采买费用 vs 合作人数"
                subtitle="70篇实际签约达人真实层级与采买结构"
              >
                <CampaignComboChart
                  title="合作达人层级采买费用 vs 合作人数"
                  rows={tierData.rows}
                  xKey="tier"
                  series={[
                    {
                      key: 'totalSpend',
                      label: '合作合计金额（含服务费）',
                      unit: '元',
                      axis: 'left',
                      kind: 'bar',
                      color: CAMPAIGN_PALETTE.purple,
                    },
                    {
                      key: 'count',
                      label: '合作达人人数',
                      unit: '位',
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

      {/* ======================= SECTION: ADS ======================= */}
      {section === 'ads' && (
        <>
          {adsMetrics.length > 0 && <MetricStrip items={adsMetrics} />}

          <div className="kri-grid-2">
            {/* Chart 5: Search Keyword Categories */}
            {kwData && (
              <ChartPanel
                title="搜索推广大类关键词投放效果多指标分析"
                subtitle="品牌词、品类词、穿搭词、竞品词等分类消耗与点击表现"
              >
                <CampaignComboChart
                  title="搜索推广大类关键词投放效果多指标分析"
                  rows={kwData.rows}
                  xKey="category"
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
                title="核心精准定向人群包消耗与点击成本对比"
                subtitle="核心产品包、出游穿搭、奢品、运动机能等定向效率表现"
              >
                <CampaignComboChart
                  title="核心精准定向人群包消耗与点击成本对比"
                  rows={targetingData.rows}
                  xKey="group"
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

          <div className="kri-grid-2">
            {/* Chart 7: Candidate Pool Status (Independent Stages) */}
            {poolData && (
              <ChartPanel
                title="初筛与复筛候选达人独立池状态分布"
                subtitle="初筛与复筛为独立评估池（非同母集单一漏斗），各池独立核实"
              >
                <HorizontalBarChart data={poolData.items} height={260} />
              </ChartPanel>
            )}

            {/* Chart 8: Content Direction Summary */}
            {directionData && (
              <ChartPanel
                title="内容方向合作篇数与采买费用对比"
                subtitle="时尚穿搭、跑山专业、街头采访等方向结构分布"
              >
                <CampaignComboChart
                  title="内容方向合作篇数与采买费用对比"
                  rows={directionData.rows}
                  xKey="direction"
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
