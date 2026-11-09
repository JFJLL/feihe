/**
 * Winner Wipes (稳健酒精湿巾) Board Transformation Module
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
import { parseWipesDelivery, parseWipesTaosou } from './parsers';

export async function transformProject(rawSources?: unknown): Promise<BoardPayload> {
  await ensureSchema();
  const d1 = db();
  const row = await d1
    .prepare("SELECT value FROM project_settings WHERE project_id=? AND key='campaign_dashboard'")
    .bind('winner-wipes')
    .first<{ value: string }>();

  let base = row?.value ? JSON.parse(row.value) : null;
  if (!base) {
    base = baseline;
  }

  // 1. If rawSources is not provided, check if .cache/raw-sources.json exists
  let effectiveSources = rawSources;
  if (!effectiveSources) {
    const cachePath = path.join(getProjectsDir(), 'winner-wipes', '.cache', 'raw-sources.json');
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
  const rawDelivery = rawObj?.['wipes-delivery'] || rawObj?.['0QTVhE'];
  const rawTaosou = rawObj?.['wipes-taosou'] || rawObj?.['wY1HZO'];

  if (rawDelivery) {
    const parsedDelivery = parseWipesDelivery(rawDelivery);
    const parsedTaosou = rawTaosou ? parseWipesTaosou(rawTaosou) : null;

    const dDel = merged.dailyDatasets?.find((d: any) => d.id === 'wipes-daily-delivery');
    if (dDel && parsedDelivery?.rows?.length) {
      dDel.rows = parsedDelivery.rows;
      dDel.period = parsedDelivery.period;
    }
    const dTao = merged.dailyDatasets?.find((d: any) => d.id === 'wipes-daily-taosou');
    if (dTao && parsedTaosou?.rows?.length) {
      dTao.rows = parsedTaosou.rows;
      dTao.period = parsedTaosou.period;
    }
    const deliveryKpis = (parsedDelivery as any)?.kpis;
    if (Array.isArray(deliveryKpis) && deliveryKpis.length && merged.kpis) {
      for (const k of deliveryKpis) {
        const exist = merged.kpis.find((x: any) => x.id === k.id);
        if (exist) {
          exist.value = k.value;
          exist.target = k.target;
        } else {
          merged.kpis.push(k);
        }
      }
    }
  }

  const sections: SectionSpec[] = [
    // 01. overview: 日常种草控盘核心 KPI
    {
      id: 'wipes-overview-kpis',
      tab: 'overview',
      title: '日常种草控盘核心指标',
      hint: 'KFS 曝光量、互动量、FS CPM 与 FS CPUV',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'kpi-progress',
          type: 'metric-card',
          title: '日常种草 · 累计完成进度',
          query: 'summary_kpis',
          field: 'wipes_cum_progress',
          direction: 'higher',
          width: 'quarter',
        },
        {
          id: 'kpi-spend',
          type: 'metric-card',
          title: '日常种草 · 累计总消耗',
          query: 'summary_kpis',
          field: 'wipes_cum_spend',
          direction: 'higher',
          width: 'quarter',
        },
        {
          id: 'kpi-cpm',
          type: 'metric-card',
          title: '日常种草 · CPM (FS)',
          query: 'summary_kpis',
          field: 'wipes_cum_cpm',
          direction: 'lower',
          width: 'quarter',
        },
        {
          id: 'kpi-cpuv',
          type: 'metric-card',
          title: '日常种草 · CPUV (FS)',
          query: 'summary_kpis',
          field: 'wipes_cum_cpuv_t2',
          direction: 'lower',
          width: 'quarter',
        },
      ],
    },
    // 02. overview: 全渠道分日消耗与淘搜回流 UV 双轴联动
    {
      id: 'daily-trend-section',
      tab: 'overview',
      title: '全渠道分日趋势分析',
      hint: '实际消耗与回流 UV 双轴联动',
      layout: 'grid',
      columns: 2,
      components: [
        {
          id: 'trend-spend-uv',
          type: 'line-bar-combo',
          title: '分日消耗 (元) 与站外活跃 UV (人)',
          query: 'daily_flow',
          xField: 'date',
          yField: 'spend',
          y2Field: 'uv',
          width: 'half',
        },
        {
          id: 'trend-engagements-cpm',
          type: 'line-bar-combo',
          title: '分日互动量 (次) 与 CPM (元)',
          query: 'daily_flow',
          xField: 'date',
          yField: 'engagements',
          y2Field: 'cpm',
          width: 'half',
        },
      ],
    },
    // 03. overview: 版位消耗结构与目标对标
    {
      id: 'wipes-bento-sec',
      tab: 'overview',
      title: '版位消耗结构与目标对标',
      hint: '左侧版位消耗玫瑰图，右侧关键指标达成子弹图',
      layout: 'bento-split',
      columns: 2,
      components: [
        {
          id: 'comp-placements-rose',
          type: 'donut-rose',
          title: '分版位消耗占比玫瑰图',
          query: 'wipes-current-placements',
          categoryField: 'name',
          field: 'spend',
          width: 'half',
        },
        {
          id: 'comp-placements-bullet',
          type: 'target-bullet',
          title: '版位核心指标目标对比',
          query: 'wipes-current-placements',
          categoryField: 'name',
          field: 'spend',
          width: 'half',
        },
      ],
    },
    // 04. overview: 当前版位与 52 关键词投放明细
    {
      id: 'breakdown-tables',
      tab: 'overview',
      title: '版位投放与关键词明细',
      hint: '切换查看当前版位投放表现与52核心词明细',
      layout: 'tabs',
      tabs: [
        {
          id: 'tab-placements',
          title: '当前版位明细',
          sections: [
            {
              id: 'sec-placements-table',
              layout: 'stack',
              components: [
                {
                  id: 'comp-placements-table',
                  type: 'data-table',
                  query: 'wipes-current-placements',
                  width: 'full',
                },
              ],
            },
          ],
        },
        {
          id: 'tab-keywords',
          title: '关键词明细 (52词)',
          sections: [
            {
              id: 'sec-keywords-table',
              layout: 'stack',
              components: [
                {
                  id: 'comp-keywords-table',
                  type: 'data-table',
                  query: 'wipes-keyword-detail-table',
                  width: 'full',
                },
              ],
            },
          ],
        },
      ],
    },

    // 05. ads: 52 核心搜索词二八贡献度诊断
    {
      id: 'wipes-ads-kpi-sec',
      tab: 'ads',
      title: '投流寻优核心指标',
      hint: '累计投流消耗、新客成本、CTR 与进店成本',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'kpi-wipes-cum-spend',
          type: 'metric-card',
          title: '累计投流消耗',
          query: 'summary_kpis',
          field: 'wipes_cum_spend',
          width: 'quarter',
        },
        {
          id: 'kpi-wipes-cum-ctr',
          type: 'metric-card',
          title: '大盘点击率 CTR',
          query: 'summary_kpis',
          field: 'wipes_cum_ctr',
          width: 'quarter',
        },
        {
          id: 'kpi-wipes-cum-cpm',
          type: 'metric-card',
          title: '平均千次曝光成本 CPM',
          query: 'summary_kpis',
          field: 'wipes_cum_cpm',
          width: 'quarter',
        },
        {
          id: 'kpi-wipes-cum-cpuv',
          type: 'metric-card',
          title: '整体进店成本 CPUV',
          query: 'summary_kpis',
          field: 'wipes_cum_cpuv_t2',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'wipes-ads-pareto-sec',
      tab: 'ads',
      title: '52 核心搜索词二八贡献度诊断',
      hint: '帕累托图诊断头部词对总消耗与总点击的二八集中度',
      layout: 'stack',
      components: [
        {
          id: 'comp-keyword-pareto',
          type: 'pareto-chart',
          title: '52 核心搜索词消耗集中度分析',
          query: 'wipes-keyword-detail-table',
          categoryField: 'keyword',
          field: 'spend',
          width: 'full',
        },
      ],
    },
    {
      id: 'wipes-ads-strip-sec',
      tab: 'ads',
      title: '分版位 CPM / CPUV 效率横评条',
      hint: '搜索 vs 信息流等各版位千次曝光与进店成本横评',
      layout: 'stack',
      components: [
        {
          id: 'comp-wipes-cpm-strip',
          type: 'placement-efficiency-strip',
          title: '版位 CPM / CPUV 效率横评条',
          query: 'wipes-current-placements',
          width: 'full',
        },
      ],
    },
    {
      id: 'wipes-ads-table-sec',
      tab: 'ads',
      title: '52 核心搜索词筛选明细表',
      hint: '支持按词类筛选，查看展现、点击、CTR、CPC 与 CPUV',
      layout: 'stack',
      components: [
        {
          id: 'filter-keyword-category',
          type: 'select-filter',
          title: '关键词类别',
          query: 'wipes-keyword-detail-table',
          field: 'category',
        },
        {
          id: 'tbl-keyword-detail',
          type: 'data-table',
          query: 'wipes-keyword-detail-table',
          width: 'full',
        },
      ],
    },

    // 06. content: 日常种草达人执行与内容矩阵
    {
      id: 'wipes-content-kpis-sec',
      tab: 'content',
      title: '日常种草达人执行概览',
      hint: '达人执行曝光、互动量与千次成本',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'kpi-content-spend',
          type: 'metric-card',
          title: '日常种草达人投入',
          query: 'summary_kpis',
          field: 'wipes_cum_spend',
          width: 'quarter',
        },
        {
          id: 'kpi-content-progress',
          type: 'metric-card',
          title: '日常种草执行进度',
          query: 'summary_kpis',
          field: 'wipes_cum_progress',
          width: 'quarter',
        },
        {
          id: 'kpi-content-cpm',
          type: 'metric-card',
          title: 'FS CPM',
          query: 'summary_kpis',
          field: 'wipes_cum_cpm',
          width: 'quarter',
        },
        {
          id: 'kpi-content-cpuv',
          type: 'metric-card',
          title: 'FS CPUV',
          query: 'summary_kpis',
          field: 'wipes_cum_cpuv_t2',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'wipes-content-rose-sec',
      tab: 'content',
      title: '达人量级与互动表现分布',
      hint: '头部、腰部、初级达人消耗与互动结构',
      layout: 'stack',
      components: [
        {
          id: 'comp-tier-rose',
          type: 'donut-rose',
          title: '达人量级消耗占比',
          query: 'wipes-tier-efficiency-table',
          categoryField: 'tier',
          field: 'totalSpend',
          width: 'full',
        },
      ],
    },
    {
      id: 'wipes-content-table-sec',
      tab: 'content',
      title: '达人矩阵执行效率明细表',
      hint: '达人量级、发布数、互动成本与引流效率',
      layout: 'stack',
      components: [
        {
          id: 'tbl-tier-efficiency',
          type: 'data-table',
          query: 'wipes-tier-efficiency-table',
          width: 'full',
        },
      ],
    },
  ];

  const cpuvKpi = (merged.kpis || []).find((k: any) => k.id === 'wipes-cum-cpuv-t2' || k.id === 'wipes-daily-cpuv-t2');
  const cpuvNum = typeof cpuvKpi?.value === 'number' && Number.isFinite(cpuvKpi.value) ? cpuvKpi.value : null;

  const analysisCards: AnalysisCardSpec[] = [];
  if (cpuvNum !== null) {
    const cpuvVal = cpuvNum.toFixed(2);
    analysisCards.push({
      id: 'insight-wipes-cpuv',
      targetQueryIds: ['daily_flow', 'summary_kpis'],
      type: 'insight',
      title: 'CPUV与站外归因效率洞察',
      summary: `稳健酒精湿巾日常种草在站外UV归因上呈现稳步增长态势，小红星30日归因UV回填后全量CPUV当前测算为 ¥${cpuvVal}。`,
      recommendations: [
        '针对 10/25 当日 UV 异常归因缺失进行数据回溯',
        '建议加大高互动版位的投流倾斜',
      ],
      severity: 'success',
    });
  } else {
    analysisCards.push({
      id: 'insight-wipes-cpuv',
      targetQueryIds: ['summary_kpis'],
      type: 'insight',
      title: 'CPUV与站外归因效率待观测',
      summary: '稳健酒精湿巾当前尚未观测到有效的 CPUV 回填指标，待站外归因数据就绪后生成分析卡。',
      severity: 'info',
    });
  }

  return buildBoardPayloadFromCampaignDashboard(merged, manifest, sections, analysisCards);
}

export default transformProject;
