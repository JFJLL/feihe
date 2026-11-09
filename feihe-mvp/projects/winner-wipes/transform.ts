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
    {
      id: 'summary-kpis',
      title: '日常种草核心指标卡',
      description: '日常种草控盘与核心 KPI 进度',
      layout: 'paired-metrics',
      columns: 4,
      components: [
        {
          id: 'kpi-exposure',
          type: 'metric-card',
          title: '日常种草 · 曝光量 (KFS)',
          query: 'summary_kpis',
          field: 'wipes_online_daily_exposure',
          direction: 'higher',
          width: 'quarter',
        },
        {
          id: 'kpi-interactions',
          type: 'metric-card',
          title: '日常种草 · 互动量 (KFS)',
          query: 'summary_kpis',
          field: 'wipes_online_daily_interaction',
          direction: 'higher',
          width: 'quarter',
        },
        {
          id: 'kpi-cpm',
          type: 'metric-card',
          title: '日常种草 · CPM (FS)',
          query: 'summary_kpis',
          field: 'wipes_online_daily_cpm',
          direction: 'lower',
          width: 'quarter',
        },
        {
          id: 'kpi-cpuv',
          type: 'metric-card',
          title: '日常种草 · CPUV (FS)',
          query: 'summary_kpis',
          field: 'wipes_online_daily_cpuv',
          direction: 'lower',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'daily-trend-section',
      title: '全渠道分日趋势分析',
      description: '实际消耗与回流 UV 双轴走势',
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
    {
      id: 'breakdown-tables',
      title: '版位投放与关键词明细',
      layout: 'tabs',
      tabs: [
        {
          id: 'tab-placements',
          title: '当前版位明细',
          sections: [
            {
              id: 'sec-placements-table',
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
      components: [],
    },
  ];

  const cpuvKpi = (merged.kpis || []).find((k: any) => k.id?.includes('cpuv'));
  const cpuvVal = cpuvKpi?.value ? Number(cpuvKpi.value).toFixed(2) : '8.23';
  const analysisCards: AnalysisCardSpec[] = [
    {
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
    },
  ];

  return buildBoardPayloadFromCampaignDashboard(merged, manifest, sections, analysisCards);
}

export default transformProject;
