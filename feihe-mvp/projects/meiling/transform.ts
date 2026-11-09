/**
 * Meiling (美菱) Board Transformation Module
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
import { parseMeilingPivot } from './parsers';

export async function transformProject(rawSources?: unknown): Promise<BoardPayload> {
  await ensureSchema();
  const d1 = db();
  const row = await d1
    .prepare("SELECT value FROM project_settings WHERE project_id=? AND key='campaign_dashboard'")
    .bind('meiling')
    .first<{ value: string }>();

  let base = row?.value ? JSON.parse(row.value) : null;
  if (!base) {
    base = baseline;
  }

  // 1. If rawSources is not provided, check if .cache/raw-sources.json exists
  let effectiveSources = rawSources;
  if (!effectiveSources) {
    const cachePath = path.join(getProjectsDir(), 'meiling', '.cache', 'raw-sources.json');
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
  const hasMeilingSheets = rawObj && (
    rawObj['meiling-daily-tm-seed'] || rawObj['iautvs'] ||
    rawObj['meiling-daily-jd-seed'] || rawObj['B5TBE7'] ||
    rawObj['meiling-daily-xingban-seed'] || rawObj['7gf6nq'] ||
    rawObj['meiling-daily-jd-toitou-seed'] || rawObj['TLLRoo'] ||
    rawObj['meiling-daily-cid-jd'] || rawObj['Trvrou']
  );

  if (hasMeilingSheets) {
    const sheetDefs = [
      { id: 'meiling-daily-tm-seed', keys: ['meiling-daily-tm-seed', 'iautvs'], isCid: false },
      { id: 'meiling-daily-jd-seed', keys: ['meiling-daily-jd-seed', 'B5TBE7'], isCid: false },
      { id: 'meiling-daily-xingban-seed', keys: ['meiling-daily-xingban-seed', '7gf6nq'], isCid: false },
      { id: 'meiling-daily-jd-toitou-seed', keys: ['meiling-daily-jd-toitou-seed', 'TLLRoo'], isCid: false },
      { id: 'meiling-daily-cid-jd', keys: ['meiling-daily-cid-jd', 'Trvrou'], isCid: true },
    ];
    for (const def of sheetDefs) {
      const raw = def.keys.map(k => rawObj[k]).find(Boolean);
      if (raw) {
        const parsed = parseMeilingPivot(raw, { isCid: def.isCid });
        const target = merged.dailyDatasets?.find((d: any) => d.id === def.id);
        if (target && parsed?.rows?.length) {
          target.rows = parsed.rows as any;
          target.period = parsed.period;
        }
      }
    }
  }

  const sections: SectionSpec[] = [
    // 01. overview: 双11大促核心战报
    {
      id: 'meiling-battle-report',
      tab: 'overview',
      title: '双11大促核心战报',
      hint: '确认合作达人、已发布笔记、双渠道ROI与全域总预算',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'kpi-confirmed-collab',
          type: 'metric-card',
          title: '确认合作达人数',
          query: 'summary_kpis',
          field: 'meiling_confirmed_total',
          width: 'quarter',
        },
        {
          id: 'kpi-published-notes',
          type: 'metric-card',
          title: '已发布笔记数',
          query: 'summary_kpis',
          field: 'meiling_published_count',
          width: 'quarter',
        },
        {
          id: 'kpi-roi-jd',
          type: 'metric-card',
          title: '自采京东 ROI',
          query: 'summary_kpis',
          field: 'meiling_roi_jd',
          width: 'quarter',
        },
        {
          id: 'kpi-roi-tm',
          type: 'metric-card',
          title: '自采天猫 ROI',
          query: 'summary_kpis',
          field: 'meiling_roi_tmall',
          width: 'quarter',
        },
      ],
    },
    // 02. overview: 四线独立归因赛马记分牌
    {
      id: 'meiling-four-lines-deck',
      tab: 'overview',
      title: '四线独立归因赛马记分牌',
      hint: '自采天猫、自采京东、代采星伴、京东对投四线综合对比',
      layout: 'stack',
      components: [
        {
          id: 'comp-four-lines-deck',
          type: 'multi-line-deck',
          title: '四条核心业务线赛马记分牌',
          query: 'meiling-four-lines',
          categoryField: 'name',
          width: 'full',
        },
      ],
    },
    // 03. overview: 四线分日种草与 CID 引流走势
    {
      id: 'meiling-daily-cid-trend',
      tab: 'overview',
      title: '四线分日种草与 CID 引流走势',
      hint: '左侧双轴分日走势，右侧四线消耗结构玫瑰图',
      layout: 'bento-split',
      columns: 2,
      components: [
        {
          id: 'comp-daily-combo',
          type: 'line-bar-combo',
          title: '分日投流消耗 (元) 与引流 UV',
          query: 'daily_flow',
          xField: 'date',
          yField: 'spend',
          y2Field: 'uv',
          width: 'half',
        },
        {
          id: 'comp-channel-rose',
          type: 'donut-rose',
          title: '四线消耗占比玫瑰图',
          query: 'meiling-four-lines',
          categoryField: 'name',
          field: 'fsSpend',
          width: 'half',
        },
      ],
    },
    // 04. overview: 四线归因全量核算底表
    {
      id: 'meiling-attribution-tables',
      tab: 'overview',
      title: '四线归因全量核算底表',
      hint: 'Tab 切换查看四线核心大盘与多渠道汇总明细',
      layout: 'tabs',
      tabs: [
        {
          id: 'tab-four-lines',
          title: '四线归因核算底表',
          sections: [
            {
              id: 'sec-four-lines-tbl',
              layout: 'stack',
              components: [
                {
                  id: 'tbl-four-lines',
                  type: 'data-table',
                  query: 'meiling-four-lines',
                  width: 'full',
                },
              ],
            },
          ],
        },
        {
          id: 'tab-multi-line-summary',
          title: '多渠道汇总对账表',
          sections: [
            {
              id: 'sec-multi-line-tbl',
              layout: 'stack',
              components: [
                {
                  id: 'tbl-multi-line',
                  type: 'data-table',
                  query: 'meiling-enrich-multi-line-summary',
                  width: 'full',
                },
              ],
            },
          ],
        },
      ],
    },

    // 05. ads: 渠道效率与成本达成
    {
      id: 'meiling-ads-kpis',
      tab: 'ads',
      title: '渠道效率与成本达成指标',
      hint: '天猫、京东、星伴、CID 核心投流达成',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'kpi-ads-roi-jd',
          type: 'metric-card',
          title: '自采京东 ROI',
          query: 'summary_kpis',
          field: 'meiling_roi_jd',
          width: 'quarter',
        },
        {
          id: 'kpi-ads-roi-tm',
          type: 'metric-card',
          title: '自采天猫 ROI',
          query: 'summary_kpis',
          field: 'meiling_roi_tmall',
          width: 'quarter',
        },
        {
          id: 'kpi-ads-confirmed',
          type: 'metric-card',
          title: '累计合作达人',
          query: 'summary_kpis',
          field: 'meiling_confirmed_total',
          width: 'quarter',
        },
        {
          id: 'kpi-ads-published',
          type: 'metric-card',
          title: '已发布笔记数',
          query: 'summary_kpis',
          field: 'meiling_published_count',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'meiling-ads-bullet-sec',
      tab: 'ads',
      title: '各渠道成本达成子弹图',
      hint: '子弹图对比规划预算与实际达成',
      layout: 'stack',
      components: [
        {
          id: 'comp-ads-bullet',
          type: 'target-bullet',
          title: '各渠道实际消耗与预算达成',
          query: 'meiling-enrich-channel-creative-efficiency',
          categoryField: 'channel',
          field: 'spend',
          width: 'full',
        },
      ],
    },
    {
      id: 'meiling-ads-tables-sec',
      tab: 'ads',
      title: '各渠道投流明细与可比分析',
      hint: '切换查看渠道创意效率与分日可比对账',
      layout: 'tabs',
      tabs: [
        {
          id: 'tab-channel-efficiency',
          title: '渠道创意效率明细',
          sections: [
            {
              id: 'sec-ch-eff',
              layout: 'stack',
              components: [
                {
                  id: 'tbl-ch-eff',
                  type: 'data-table',
                  query: 'meiling-enrich-channel-creative-efficiency',
                  width: 'full',
                },
              ],
            },
          ],
        },
        {
          id: 'tab-channel-comparable',
          title: '渠道分日可比分析',
          sections: [
            {
              id: 'sec-ch-comp',
              layout: 'stack',
              components: [
                {
                  id: 'tbl-ch-comp',
                  type: 'data-table',
                  query: 'meiling-enrich-channel-daily-comparable',
                  width: 'full',
                },
              ],
            },
          ],
        },
      ],
    },

    // 06. content: 双11 KOL 达人量级与审核进度
    {
      id: 'meiling-kol-kpis-sec',
      tab: 'content',
      title: '双11 KOL 达人量级与审核概览',
      hint: '达人采买、稿件审核与已发布进度',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'kpi-kol-confirmed',
          type: 'metric-card',
          title: '合作达人总数',
          query: 'summary_kpis',
          field: 'meiling_confirmed_total',
          width: 'quarter',
        },
        {
          id: 'kpi-kol-published',
          type: 'metric-card',
          title: '已发布笔记数',
          query: 'summary_kpis',
          field: 'meiling_published_count',
          width: 'quarter',
        },
        {
          id: 'kpi-kol-roi-jd',
          type: 'metric-card',
          title: '自采京东 ROI',
          query: 'summary_kpis',
          field: 'meiling_roi_jd',
          width: 'quarter',
        },
        {
          id: 'kpi-kol-roi-tm',
          type: 'metric-card',
          title: '自采天猫 ROI',
          query: 'summary_kpis',
          field: 'meiling_roi_tmall',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'meiling-kol-stack-sec',
      tab: 'content',
      title: '各量级审核阶段进度分布',
      hint: '各量级达人在初审、复审、终审与已发布阶段分布',
      layout: 'stack',
      components: [
        {
          id: 'comp-kol-stack',
          type: 'percent-stack',
          title: '各量级达人推进阶段 100% 堆叠分布',
          query: 'meiling-enrich-kol-tier-budget-stage',
          xField: 'tier',
          width: 'full',
        },
      ],
    },
    {
      id: 'meiling-kol-table-sec',
      tab: 'content',
      title: '双11达人进度明细表',
      hint: '各量级达人结算单价、采买费用与视频占比全量明细',
      layout: 'stack',
      components: [
        {
          id: 'tbl-kol-detail',
          type: 'data-table',
          query: 'meiling-enrich-kol-tier-budget-stage',
          width: 'full',
        },
      ],
    },
  ];

  const analysisCards: AnalysisCardSpec[] = [
    {
      id: 'insight-meiling-roi',
      targetQueryIds: ['summary_kpis', 'meiling-four-lines'],
      type: 'insight',
      title: '双11四线归因ROI稳健',
      summary: '美菱自采京东与天猫双渠道ROI均在2.0以上（京东2.02，天猫2.03），保持大促攻坚的高回报率。',
      recommendations: [
        '建议加强未发布达人催审进度',
        '对高效爆品机型加大CID引流放量',
      ],
      severity: 'success',
    },
  ];

  return buildBoardPayloadFromCampaignDashboard(merged, manifest, sections, analysisCards);
}

export default transformProject;
