/**
 * Kailas (凯乐石) Board Transformation Module
 */

import type { BoardPayload, SectionSpec, AnalysisCardSpec } from '../../lib/core/types';
import { manifest } from './manifest';
import { db, ensureSchema } from '../../lib/db';
import { getCampaignEnrichment, mergeCampaignEnrichment, mergeById } from '../../lib/campaign-enrichment-server';
import { getCampaignDailyDatasetsByProject } from '../../lib/campaign-daily-server';
import { buildBoardPayloadFromCampaignDashboard } from '../../lib/core/transform-kit';

export async function transformProject(rawSources?: unknown): Promise<BoardPayload> {
  await ensureSchema();
  const d1 = db();
  const row = await d1
    .prepare("SELECT value FROM project_settings WHERE project_id=? AND key='campaign_dashboard'")
    .bind('kailas')
    .first<{ value: string }>();

  let base = row?.value ? JSON.parse(row.value) : null;
  if (!base) {
    const { KAILAS_MANUAL_DASHBOARD } = await import('../../lib/campaign-manual');
    base = KAILAS_MANUAL_DASHBOARD;
  }

  const enrichment = getCampaignEnrichment('kailas');
  const merged = mergeCampaignEnrichment(base, enrichment);
  const serverDaily = getCampaignDailyDatasetsByProject('kailas') || [];
  merged.dailyDatasets = mergeById(serverDaily, merged.dailyDatasets || []);

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
