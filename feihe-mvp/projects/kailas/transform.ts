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
    {
      id: 'summary-kpis',
      title: '预算规划与执行进度',
      description: '全域双轨投放总体达成状况',
      layout: 'paired-metrics',
      columns: 4,
      components: [
        {
          id: 'kpi-budget-total',
          type: 'metric-card',
          title: '规划总预算',
          query: 'summary_kpis',
          field: 'kailas_budget_total',
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
          id: 'kpi-budget-progress',
          type: 'metric-card',
          title: '预算执行进度',
          query: 'summary_kpis',
          field: 'kailas_budget_progress',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'budget-lines-section',
      title: '预算线拆解与版位投放',
      layout: 'tabs',
      tabs: [
        {
          id: 'tab-budget-lines',
          title: '预算线明细',
          sections: [
            {
              id: 'sec-budget-lines',
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
      components: [],
    },
  ];

  const analysisCards: AnalysisCardSpec[] = [
    {
      id: 'insight-kailas-overbudget',
      targetQueryIds: ['summary_kpis', 'kailas-budget-lines'],
      type: 'warning',
      title: '预算执行轻微超标预警',
      summary: '累计总消耗达到 906,818.64 元，执行进度达到 106.68%，已超支 56,818.64 元。',
      recommendations: [
        '核验 Q3 增补预算审批流是否已入账',
        '建议对非核心版位实行预算封顶限流',
      ],
      severity: 'warning',
    },
  ];

  return buildBoardPayloadFromCampaignDashboard(merged, manifest, sections, analysisCards);
}

export default transformProject;
