/**
 * Kailas (凯乐石) Board Transformation Module
 */

import fs from 'node:fs';
import path from 'node:path';
import type { BoardPayload, SectionSpec, AnalysisCardSpec } from '../../lib/core/types';
import { manifest } from './manifest';
import { db, ensureSchema } from '../../lib/db';
import { mergeById, buildBoardPayloadFromCampaignDashboard } from '../../lib/core/transform-kit';
import { getProjectsDir } from '../../lib/core/registry';
import baseline from './data/baseline';
import enrichment from './data/enrichment.json' with { type: 'json' };
import serverDaily from './data/daily.json' with { type: 'json' };
import { applyKailasSnapshot } from './parsers';

export async function transformProject(rawSources?: unknown): Promise<BoardPayload> {
  await ensureSchema();
  const d1 = db();
  const row = await d1
    .prepare("SELECT value FROM project_settings WHERE project_id=? AND key='campaign_dashboard'")
    .bind('kailas')
    .first<{ value: string }>();

  let base = row?.value ? JSON.parse(row.value) : null;
  if (!base) {
    base = baseline;
  }

  // 1. If rawSources is not provided, check if .cache/raw-sources.json exists
  let effectiveSources = rawSources;
  if (!effectiveSources) {
    const cachePath = path.join(getProjectsDir(), 'kailas', '.cache', 'raw-sources.json');
    if (fs.existsSync(cachePath)) {
      try {
        effectiveSources = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      } catch {
        // Ignore
      }
    }
  }

  // 2. Protect DB latest snapshot: enrichment and serverDaily serve as fallback base,
  // while the latest DB base snapshot overrides matching items by ID.
  const merged: any = {
    ...enrichment,
    ...base,
    sources: mergeById(enrichment?.sources || [], base.sources || []),
    tables: mergeById(enrichment?.tables || [], base.tables || []),
    kpis: mergeById((enrichment as any)?.kpis || [], base.kpis || []),
    dailyDatasets: mergeById(serverDaily as any || [], base.dailyDatasets || []),
  };

  // Parse fresh raw sources if provided
  const rawObj = (effectiveSources && typeof effectiveSources === 'object') ? (effectiveSources as Record<string, unknown>) : null;
  const rawOnline = rawObj?.['kailas-online-budget'] || rawObj?.['kailas-sheets'] || rawObj?.['ZpT73Q'];
  if (rawOnline) {
    const updated = applyKailasSnapshot(merged, rawOnline);
    Object.assign(merged, updated);
  }

  const sections: SectionSpec[] = [
    // 01. overview: FUGA跑鞋 Q3 预算控盘核心指标
    {
      id: 'kailas-budget-hero',
      tab: 'overview',
      title: 'FUGA 跑鞋 Q3 预算控盘核心指标',
      hint: '预算执行进度、累计总消耗、预算剩余与规划总盘',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'kpi-budget-progress',
          type: 'metric-card',
          title: '预算执行进度',
          query: 'summary_kpis',
          field: 'kailas_budget_progress',
          width: 'quarter',
        },
        {
          id: 'kpi-budget-spent',
          type: 'metric-card',
          title: '累计总消耗',
          query: 'summary_kpis',
          field: 'kailas_spend_total',
          width: 'quarter',
        },
        {
          id: 'kpi-budget-remaining',
          type: 'metric-card',
          title: '预算剩余',
          query: 'summary_kpis',
          field: 'kailas_budget_remaining',
          width: 'quarter',
        },
        {
          id: 'kpi-budget-total',
          type: 'metric-card',
          title: '规划总预算',
          query: 'summary_kpis',
          field: 'kailas_budget_total',
          width: 'quarter',
        },
      ],
    },
    // 02. overview: 各预算线执行进度与版位结构
    {
      id: 'kailas-lines-bento-sec',
      tab: 'overview',
      title: '各预算线执行进度与版位结构',
      hint: '左侧预算线达成子弹图，右侧FS版位消耗结构玫瑰图',
      layout: 'bento-split',
      columns: 2,
      components: [
        {
          id: 'comp-budget-bullet',
          type: 'target-bullet',
          title: '各预算线规划 vs 实际消耗达成条',
          query: 'kailas-budget-lines',
          categoryField: 'line',
          field: 'spend',
          width: 'half',
        },
        {
          id: 'comp-placements-rose',
          type: 'donut-rose',
          title: 'FS各版位消耗结构玫瑰图',
          query: 'kailas-fs-placements',
          categoryField: 'placement',
          field: 'spend',
          width: 'half',
        },
      ],
    },
    // 03. overview: 分日消耗与转化效率双轴脉冲
    {
      id: 'kailas-flow-radar-sec',
      tab: 'overview',
      title: '分日消耗与转化效率双轴脉冲',
      hint: '分日双轴趋势走势与版位综合效率雷达',
      layout: 'bento-split',
      columns: 2,
      components: [
        {
          id: 'comp-flow-combo',
          type: 'line-bar-combo',
          title: '分日投流消耗 (元) 与外溢 UV',
          query: 'daily_flow',
          xField: 'date',
          yField: 'spend',
          y2Field: 'uv',
          width: 'half',
        },
        {
          id: 'comp-placements-radar',
          type: 'capability-radar',
          title: '版位综合效率雷达图',
          query: 'kailas-fs-placements',
          categoryField: 'placement',
          width: 'half',
        },
      ],
    },
    // 04. overview: 预算线与版位核算明细
    {
      id: 'kailas-budget-tables-sec',
      tab: 'overview',
      title: '预算线与版位核算明细',
      hint: 'Tab 切换查看各预算线执行表与版位明细',
      layout: 'tabs',
      tabs: [
        {
          id: 'tab-budget-lines',
          title: '预算线明细',
          sections: [
            {
              id: 'sec-budget-lines',
              layout: 'stack',
              components: [
                {
                  id: 'comp-budget-lines-table',
                  type: 'data-table',
                  query: 'kailas-budget-lines',
                  width: 'full',
                },
              ],
            },
          ],
        },
        {
          id: 'tab-placements',
          title: '版位效率明细',
          sections: [
            {
              id: 'sec-placements',
              layout: 'stack',
              components: [
                {
                  id: 'comp-placements-table',
                  type: 'data-table',
                  query: 'kailas-fs-placements',
                  width: 'full',
                },
              ],
            },
          ],
        },
      ],
    },

    // 05. ads: 搜索流 vs 信息流版位 CPM/CPUV 寻优
    {
      id: 'kailas-ads-kpis-sec',
      tab: 'ads',
      title: '版位效率寻优核心指标',
      hint: '版位曝光、消耗、CPM 与进店 CPUV',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'kpi-ads-spend',
          type: 'metric-card',
          title: '累计投放总消耗',
          query: 'summary_kpis',
          field: 'kailas_spend_total',
          width: 'quarter',
        },
        {
          id: 'kpi-ads-budget',
          type: 'metric-card',
          title: '今日可用预算',
          query: 'summary_kpis',
          field: 'kailas_today_budget',
          width: 'quarter',
        },
        {
          id: 'kpi-ads-progress',
          type: 'metric-card',
          title: '预算执行进度',
          query: 'summary_kpis',
          field: 'kailas_budget_progress',
          width: 'quarter',
        },
        {
          id: 'kpi-ads-search-idx',
          type: 'metric-card',
          title: 'Q3 搜索心智指数',
          query: 'summary_kpis',
          field: 'kailas_q3_search_index',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'kailas-ads-target-bullet-sec',
      tab: 'ads',
      title: '版位消耗与目标成本对标',
      hint: '搜索与信息流版位预算达成对比',
      layout: 'stack',
      components: [
        {
          id: 'comp-ads-target-bullet',
          type: 'target-bullet',
          title: 'FS 各版位消耗对标',
          query: 'kailas-fs-placements',
          categoryField: 'placement',
          field: 'spend',
          width: 'full',
        },
      ],
    },
    {
      id: 'kailas-ads-cpm-strip-sec',
      tab: 'ads',
      title: '版位 CPM / CPUV 横评指标条',
      hint: '全版位千次曝光成本与进店成本横评',
      layout: 'stack',
      components: [
        {
          id: 'comp-ads-cpm-strip',
          type: 'placement-efficiency-strip',
          title: 'FS 版位 CPM / CPUV 横评条',
          query: 'kailas-fs-placements',
          width: 'full',
        },
      ],
    },
    {
      id: 'kailas-ads-placements-table-sec',
      tab: 'ads',
      title: 'FS 版位全量核算底表',
      hint: '曝光量、点击率、CPC、CPM、进店 UV 与 CPUV 完整数据',
      layout: 'stack',
      components: [
        {
          id: 'tbl-ads-placements',
          type: 'data-table',
          query: 'kailas-fs-placements',
          width: 'full',
        },
      ],
    },

    // 06. content: 户外达人矩阵与爆文表现
    {
      id: 'kailas-content-kpis-sec',
      tab: 'content',
      title: '户外达人种草执行指标',
      hint: '达人预算投入、笔记发布与爆文沉淀',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'kpi-content-spend',
          type: 'metric-card',
          title: '达人累计投入',
          query: 'summary_kpis',
          field: 'kailas_spend_total',
          width: 'quarter',
        },
        {
          id: 'kpi-content-progress',
          type: 'metric-card',
          title: '执行达成率',
          query: 'summary_kpis',
          field: 'kailas_budget_progress',
          width: 'quarter',
        },
        {
          id: 'kpi-content-budget',
          type: 'metric-card',
          title: '规划总预算',
          query: 'summary_kpis',
          field: 'kailas_budget_total',
          width: 'quarter',
        },
        {
          id: 'kpi-content-remaining',
          type: 'metric-card',
          title: '剩余预算',
          query: 'summary_kpis',
          field: 'kailas_budget_remaining',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'kailas-content-scatter-sec',
      tab: 'content',
      title: '达人投入产出象限分布',
      hint: '散点图透视达人消耗 (元) 与点击量 (次) 效益分布',
      layout: 'stack',
      components: [
        {
          id: 'comp-content-scatter',
          type: 'effect-scatter',
          title: '达人投入 vs 产生点击象限图',
          query: 'kailas-notes-performance-scatter',
          xField: 'spend',
          yField: 'clicks',
          categoryField: 'kolName',
          width: 'full',
        },
      ],
    },
    {
      id: 'kailas-content-notes-table-sec',
      tab: 'content',
      title: '达人笔记表现全量明细表',
      hint: '达人名称、笔记ID、曝光量、点击量、互动量、进店UV与CPUV',
      layout: 'stack',
      components: [
        {
          id: 'tbl-content-notes',
          type: 'data-table',
          query: 'kailas-notes-performance-scatter',
          width: 'full',
        },
      ],
    },
  ];

  const budgetKpi = (merged.kpis || []).find((k: any) => k.id === 'kailas-budget-total');
  const spendKpi = (merged.kpis || []).find((k: any) => k.id === 'kailas-spend-total');
  const remainingKpi = (merged.kpis || []).find((k: any) => k.id === 'kailas-budget-remaining');
  const progressKpi = (merged.kpis || []).find((k: any) => k.id === 'kailas-budget-progress');

  const budgetNum = typeof budgetKpi?.value === 'number' && Number.isFinite(budgetKpi.value) ? budgetKpi.value : null;
  const spendNum = typeof spendKpi?.value === 'number' && Number.isFinite(spendKpi.value) ? spendKpi.value : null;

  const analysisCards: AnalysisCardSpec[] = [];
  if (budgetNum !== null && spendNum !== null) {
    const totalBudget = budgetNum;
    const totalSpend = spendNum;
    const overspend = typeof remainingKpi?.value === 'number' && Number.isFinite(remainingKpi.value)
      ? -remainingKpi.value
      : totalSpend - totalBudget;
    const progressPct = typeof progressKpi?.value === 'number' && Number.isFinite(progressKpi.value)
      ? progressKpi.value
      : (totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0);

    analysisCards.push({
      id: 'insight-kailas-overbudget',
      targetQueryIds: ['summary_kpis', 'kailas-budget-lines'],
      type: overspend > 0 ? 'warning' : 'insight',
      title: overspend > 0 ? '预算执行超标预警' : '预算执行进度正常',
      summary: overspend > 0
        ? `累计总消耗达 ¥${totalSpend.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}，执行进度达 ${progressPct.toFixed(2)}%，已超支 ¥${overspend.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}。`
        : `累计总消耗达 ¥${totalSpend.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}，预算控制在规划范围内（达成率 ${progressPct.toFixed(2)}%）。`,
      recommendations: [
        '核验 Q3 增补预算审批流是否已入账',
        '建议对非核心版位实行预算封顶限流',
      ],
      severity: overspend > 0 ? 'warning' : 'success',
    });
  } else {
    analysisCards.push({
      id: 'insight-kailas-overbudget',
      targetQueryIds: ['summary_kpis'],
      type: 'insight',
      title: '预算规划待同步',
      summary: '当前尚未观测到有效的预算总额或消耗数据，待数据接入后生成执行进度结论。',
      severity: 'info',
    });
  }

  return buildBoardPayloadFromCampaignDashboard(merged, manifest, sections, analysisCards);
}

export default transformProject;
