/**
 * Huang Tiane (黄天鹅) Board Transformation Module
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
    .bind('huang-tiane')
    .first<{ value: string }>();

  let base = row?.value ? JSON.parse(row.value) : null;
  if (!base) {
    const huangMod = await import('../../lib/campaign-enrichment/huang-tiane.json', { with: { type: 'json' } });
    base = huangMod.default || huangMod;
  }

  const enrichment = getCampaignEnrichment('huang-tiane');
  const merged = mergeCampaignEnrichment(base, enrichment);
  const serverDaily = getCampaignDailyDatasetsByProject('huang-tiane') || [];
  merged.dailyDatasets = mergeById(serverDaily, merged.dailyDatasets || []);

  const sections: SectionSpec[] = [
    {
      id: 'summary-kpis',
      title: '黄天鹅核心预算与入账',
      description: '全域三线核算指标',
      layout: 'paired-metrics',
      columns: 4,
      components: [
        {
          id: 'kpi-commerce-budget',
          type: 'metric-card',
          title: '商销今日预算',
          query: 'summary_kpis',
          field: 'huang_kpi_commerce_today_budget',
          width: 'quarter',
        },
        {
          id: 'kpi-creator-budget',
          type: 'metric-card',
          title: '达人规划预算',
          query: 'summary_kpis',
          field: 'huang_kpi_kol_budget',
          width: 'quarter',
        },
        {
          id: 'kpi-confirmed-cost',
          type: 'metric-card',
          title: '达人已确认费用',
          query: 'summary_kpis',
          field: 'huang_kpi_kol_confirmed_fee',
          width: 'quarter',
        },
        {
          id: 'kpi-raw-quote',
          type: 'metric-card',
          title: '执行表裸价报价',
          query: 'summary_kpis',
          field: 'huang_kpi_kol_quoted_raw',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'brand-commerce-tables',
      title: '品牌投放与电商引流明细',
      layout: 'tabs',
      tabs: [
        {
          id: 'tab-brand',
          title: '品牌投放汇总',
          sections: [
            {
              id: 'sec-brand-table',
              components: [
                {
                  id: 'comp-brand-table',
                  type: 'data-table',
                  query: 'huang-brand-summary',
                  width: 'full',
                },
              ],
            },
          ],
        },
        {
          id: 'tab-commerce',
          title: '商销引流明细',
          sections: [
            {
              id: 'sec-commerce-table',
              components: [
                {
                  id: 'comp-commerce-table',
                  type: 'data-table',
                  query: 'huang-commerce-summary',
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
      id: 'insight-huang-cid-roi',
      targetQueryIds: ['summary_kpis', 'huang-commerce-summary'],
      type: 'insight',
      title: '黄天鹅CID电商引流转化高效',
      summary: '小红书种草引流淘宝与京东的外溢回流转化稳定，CID综合引流ROI达到1.56，GMV破49.8万元。',
      recommendations: [
        '建议继续锁定高转化蛋品美食KOL梯队',
        '加强宝妈及健身人群包的定向引流投放',
      ],
      severity: 'success',
    },
  ];

  return buildBoardPayloadFromCampaignDashboard(merged, manifest, sections, analysisCards);
}

export default transformProject;
