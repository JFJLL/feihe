/**
 * Huang Tiane (黄天鹅) Board Transformation Module
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
    .bind('huang-tiane')
    .first<{ value: string }>();

  let base = row?.value ? JSON.parse(row.value) : null;
  if (!base) {
    const huangMod = await import('../../lib/campaign-enrichment/huang-tiane.json', { with: { type: 'json' } });
    base = huangMod.default || huangMod;
  }

  // 1. If rawSources is not provided, check if .cache/raw-sources.json exists
  let effectiveSources = rawSources;
  if (!effectiveSources) {
    const cachePath = path.join(getProjectsDir(), 'huang-tiane', '.cache', 'raw-sources.json');
    if (fs.existsSync(cachePath)) {
      try {
        effectiveSources = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      } catch {
        // Ignore
      }
    }
  }

  const enrichment = getCampaignEnrichment('huang-tiane');
  const serverDaily = getCampaignDailyDatasetsByProject('huang-tiane') || [];

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
  const rawCommerce = rawObj?.['huang-commerce'] || rawObj?.['Dz6eHe'];
  const rawCid = rawObj?.['huang-cid'] || rawObj?.['Nm3Sev'];
  const rawBrand = rawObj?.['huang-brand'] || rawObj?.['huang-brand-part1'] || rawObj?.['637ef8'];

  if (rawCommerce || rawCid || rawBrand) {
    const {
      parseHuangCommerce,
      parseHuangCid,
      parseHuangBrandRaw,
      rebuildHuangSummaryTables,
    } = await import('../../lib/campaign-sync-parser.mjs');

    let commerceParsed: any = null;
    if (rawCommerce) {
      commerceParsed = parseHuangCommerce(rawCommerce);
      const hc = merged.dailyDatasets?.find((d: any) => d.id === 'huang-commerce-daily');
      if (hc && commerceParsed?.rows?.length) {
        hc.rows = commerceParsed.rows;
        hc.period = commerceParsed.period;
      }
    }

    let cidParsed: any = null;
    if (rawCid) {
      cidParsed = parseHuangCid(rawCid);
      const hcs = merged.dailyDatasets?.find((d: any) => d.id === 'huang-cid-standard-daily');
      if (hcs && cidParsed?.standard?.rows?.length) {
        hcs.rows = cidParsed.standard.rows;
        hcs.period = cidParsed.standard.period;
      }
      const hcsimple = merged.dailyDatasets?.find((d: any) => d.id === 'huang-cid-simple-daily');
      if (hcsimple && cidParsed?.simple?.rows?.length) {
        hcsimple.rows = cidParsed.simple.rows;
        hcsimple.period = cidParsed.simple.period;
      }
      const hctotal = merged.dailyDatasets?.find((d: any) => d.id === 'huang-cid-total-daily');
      if (hctotal && cidParsed?.total?.rows?.length) {
        hctotal.rows = cidParsed.total.rows;
        hctotal.period = cidParsed.total.period;
      }
    }

    let brandParsed: any = null;
    if (rawBrand) {
      const rawRows = Array.isArray(rawBrand)
        ? rawBrand
        : (rawBrand as any)?.sheets?.[0]?.data || [];
      if (rawRows.length > 0) {
        brandParsed = parseHuangBrandRaw(rawRows);
        const hb = merged.dailyDatasets?.find((d: any) => d.id === 'huang-brand-daily');
        if (hb && brandParsed?.rows?.length) {
          hb.rows = brandParsed.rows;
          hb.period = brandParsed.period;
        }
      }
    }

    if (brandParsed?.rows?.length && commerceParsed?.rows?.length) {
      const summaries = rebuildHuangSummaryTables(brandParsed.rows, commerceParsed.rows);
      if (merged.tables) {
        const tSummary = merged.tables.find((t: any) => t.id === 'huang-brand-summary');
        if (tSummary && summaries.brandSummary) {
          tSummary.period = brandParsed.period;
          tSummary.rows = [summaries.brandSummary];
        }
        const tBudget = merged.tables.find((t: any) => t.id === 'huang-brand-budget');
        if (tBudget && summaries.brandBudget) {
          tBudget.rows = [summaries.brandBudget];
        }
        const tCommerce = merged.tables.find((t: any) => t.id === 'huang-commerce-summary');
        if (tCommerce && summaries.commerceSummary) {
          tCommerce.period = commerceParsed.period;
          tCommerce.rows = [summaries.commerceSummary];
        }
      }
    }
  }

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
