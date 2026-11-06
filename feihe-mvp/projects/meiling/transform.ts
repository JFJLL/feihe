/**
 * Meiling (美菱) Board Transformation Module
 */

import fs from 'node:fs';
import path from 'node:path';
import type { BoardPayload, SectionSpec, AnalysisCardSpec } from '../../lib/core/types';
import { manifest } from './manifest';
import { db, ensureSchema } from '../../lib/db';
import { getCampaignEnrichment, mergeById } from '../../lib/campaign-enrichment-server';
import { getCampaignDailyDatasetsByProject } from '../../lib/campaign-daily-server';
import { buildBoardPayloadFromCampaignDashboard } from '../../lib/core/transform-kit';
import { getProjectsDir } from '../../lib/core/registry';

export async function transformProject(rawSources?: unknown): Promise<BoardPayload> {
  await ensureSchema();
  const d1 = db();
  const row = await d1
    .prepare("SELECT value FROM project_settings WHERE project_id=? AND key='campaign_dashboard'")
    .bind('meiling')
    .first<{ value: string }>();

  let base = row?.value ? JSON.parse(row.value) : null;
  if (!base) {
    const { MEILING_MANUAL_DASHBOARD } = await import('../../lib/campaign-manual');
    base = MEILING_MANUAL_DASHBOARD;
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

  const enrichment = getCampaignEnrichment('meiling');
  const serverDaily = getCampaignDailyDatasetsByProject('meiling') || [];

  // 2. Protect DB latest snapshot: enrichment and serverDaily serve as fallback base,
  // while the latest DB base snapshot overrides matching items by ID.
  const merged: any = {
    ...enrichment,
    ...base,
    sources: mergeById(enrichment?.sources || [], base.sources || []),
    tables: mergeById(enrichment?.tables || [], base.tables || []),
    kpis: mergeById((enrichment as any)?.kpis || [], base.kpis || []),
    dailyDatasets: mergeById(serverDaily, base.dailyDatasets || []),
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
    const { parseMeilingPivot } = await import('../../lib/campaign-sync-parser.mjs');
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
    {
      id: 'summary-kpis',
      title: '双十一核心指标组',
      description: '执行合作与ROI关键成效',
      layout: 'paired-metrics',
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
    {
      id: 'four-lines-section',
      title: '四线独立归因明细',
      description: '全域大促四线对比',
      layout: 'stack',
      components: [
        {
          id: 'comp-four-lines-table',
          type: 'data-table',
          query: 'meiling-four-lines',
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
