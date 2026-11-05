/**
 * Meiling (美菱) Board Transformation Module
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
    .bind('meiling')
    .first<{ value: string }>();

  let base = row?.value ? JSON.parse(row.value) : null;
  if (!base) {
    const { MEILING_MANUAL_DASHBOARD } = await import('../../lib/campaign-manual');
    base = MEILING_MANUAL_DASHBOARD;
  }

  const enrichment = getCampaignEnrichment('meiling');
  const merged = mergeCampaignEnrichment(base, enrichment);
  const serverDaily = getCampaignDailyDatasetsByProject('meiling') || [];
  merged.dailyDatasets = mergeById(serverDaily, merged.dailyDatasets || []);

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
