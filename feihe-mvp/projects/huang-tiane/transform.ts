/**
 * Huang Tiane (黄天鹅) Board Transformation Module
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
import {
  parseHuangCommerce,
  parseHuangCid,
  parseHuangBrandRaw,
  rebuildHuangSummaryTables,
} from './parsers';

export async function transformProject(rawSources?: unknown): Promise<BoardPayload> {
  await ensureSchema();
  const d1 = db();
  const row = await d1
    .prepare("SELECT value FROM project_settings WHERE project_id=? AND key='campaign_dashboard'")
    .bind('huang-tiane')
    .first<{ value: string }>();

  let base = row?.value ? JSON.parse(row.value) : null;
  if (!base) {
    base = baseline;
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
  const rawCommerce = rawObj?.['huang-commerce'] || rawObj?.['Dz6eHe'];
  const rawCid = rawObj?.['huang-cid'] || rawObj?.['Nm3Sev'];
  const rawBrand = rawObj?.['huang-brand'] || rawObj?.['huang-brand-part1'] || rawObj?.['637ef8'];

  if (rawCommerce || rawCid || rawBrand) {
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
    // 01. overview: 全域三线核心预算与入账
    {
      id: 'huang-kpis-sec',
      tab: 'overview',
      title: '全域三线核心预算与入账',
      hint: '商销今日预算、达人规划预算、达人已确认费用与裸价报价',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
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
    // 02. overview: 三线独立核算对比与分日引流趋势
    {
      id: 'huang-bento-sec',
      tab: 'overview',
      title: '三线独立核算对比与分日引流趋势',
      hint: '左侧品牌/商销/CID双轴走势，右侧预算构成玫瑰图',
      layout: 'bento-split',
      columns: 2,
      components: [
        {
          id: 'comp-flow-combo',
          type: 'line-bar-combo',
          title: '品牌与商销分日消耗 (元) 与转化 GMV (元)',
          query: 'daily_flow',
          xField: 'date',
          yField: 'spend',
          y2Field: 'gmv',
          width: 'half',
        },
        {
          id: 'comp-ad-rose',
          type: 'donut-rose',
          title: '三线预算与消耗结构',
          query: 'huang-cid-ad-types',
          categoryField: 'adCategory',
          field: 'spend',
          width: 'half',
        },
      ],
    },
    // 03. overview: 品牌投放与商销引流汇总底表
    {
      id: 'brand-commerce-tables',
      tab: 'overview',
      title: '品牌投放与电商引流明细',
      hint: '切换查看品牌总表、品牌预算执行表与商销引流明细',
      layout: 'tabs',
      tabs: [
        {
          id: 'tab-brand',
          title: '品牌投放汇总',
          sections: [
            {
              id: 'sec-brand-table',
              layout: 'stack',
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
          id: 'tab-brand-budget',
          title: '品牌预算执行',
          sections: [
            {
              id: 'sec-brand-budget-table',
              layout: 'stack',
              components: [
                {
                  id: 'comp-brand-budget-table',
                  type: 'data-table',
                  query: 'huang-brand-budget',
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
              layout: 'stack',
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
    },

    // 04. ads: 聚焦千川/聚光商销引流与淘宝/京东 CID 外溢 ROI
    {
      id: 'huang-ads-kpi-sec',
      tab: 'ads',
      title: '商销千川与 CID 引流核心指标',
      hint: '千川商销、淘宝/京东 CID 引流核心表现',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'kpi-ads-commerce-budget',
          type: 'metric-card',
          title: '商销今日预算',
          query: 'summary_kpis',
          field: 'huang_kpi_commerce_today_budget',
          width: 'quarter',
        },
        {
          id: 'kpi-ads-kol-budget',
          type: 'metric-card',
          title: '达人规划预算',
          query: 'summary_kpis',
          field: 'huang_kpi_kol_budget',
          width: 'quarter',
        },
        {
          id: 'kpi-ads-kol-fee',
          type: 'metric-card',
          title: '达人已确认费用',
          query: 'summary_kpis',
          field: 'huang_kpi_kol_confirmed_fee',
          width: 'quarter',
        },
        {
          id: 'kpi-ads-kol-quoted',
          type: 'metric-card',
          title: '执行表裸价报价',
          query: 'summary_kpis',
          field: 'huang_kpi_kol_quoted_raw',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'huang-ads-trend-sec',
      tab: 'ads',
      title: 'CID 引流与商销转化分日走势',
      hint: '双轴走势联动千川商销消耗与 CID 引流 GMV',
      layout: 'stack',
      components: [
        {
          id: 'comp-ads-flow',
          type: 'line-bar-combo',
          title: '商销引流分日消耗 vs 产出 GMV',
          query: 'daily_flow',
          xField: 'date',
          yField: 'spend',
          y2Field: 'gmv',
          width: 'full',
        },
      ],
    },
    {
      id: 'huang-ads-tables-sec',
      tab: 'ads',
      title: 'CID 与商销各广告类型明细',
      hint: '千川商销、淘宝/京东 CID 版位明细',
      layout: 'tabs',
      tabs: [
        {
          id: 'tab-ad-types',
          title: '广告类型转化明细',
          sections: [
            {
              id: 'sub-ad-types',
              layout: 'stack',
              components: [
                {
                  id: 'tbl-ad-types',
                  type: 'data-table',
                  query: 'huang-cid-ad-types',
                  width: 'full',
                },
              ],
            },
          ],
        },
        {
          id: 'tab-cid-breakdown',
          title: 'CID 版位拆解',
          sections: [
            {
              id: 'sub-cid-breakdown',
              layout: 'stack',
              components: [
                {
                  id: 'tbl-cid-breakdown',
                  type: 'data-table',
                  query: 'huang-cid-placement-breakdown',
                  width: 'full',
                },
              ],
            },
          ],
        },
        {
          id: 'tab-commerce-creatives',
          title: '商销素材明细',
          sections: [
            {
              id: 'sub-commerce-creatives',
              layout: 'stack',
              components: [
                {
                  id: 'tbl-commerce-creatives',
                  type: 'data-table',
                  query: 'huang-commerce-creatives',
                  width: 'full',
                },
              ],
            },
          ],
        },
      ],
    },

    // 05. content: 聚焦品牌 FS 种草流水与 KOL 梯队执行
    {
      id: 'huang-content-kpis-sec',
      tab: 'content',
      title: '品牌 FS 种草流水概览',
      hint: '达人规划预算、已确认费用与报价执行',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'kpi-content-kol-budget',
          type: 'metric-card',
          title: '达人规划预算',
          query: 'summary_kpis',
          field: 'huang_kpi_kol_budget',
          width: 'quarter',
        },
        {
          id: 'kpi-content-kol-fee',
          type: 'metric-card',
          title: '达人已确认费用',
          query: 'summary_kpis',
          field: 'huang_kpi_kol_confirmed_fee',
          width: 'quarter',
        },
        {
          id: 'kpi-content-kol-raw',
          type: 'metric-card',
          title: '执行表裸价报价',
          query: 'summary_kpis',
          field: 'huang_kpi_kol_quoted_raw',
          width: 'quarter',
        },
        {
          id: 'kpi-content-comm-budget',
          type: 'metric-card',
          title: '商销今日预算',
          query: 'summary_kpis',
          field: 'huang_kpi_commerce_today_budget',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'huang-content-rose-sec',
      tab: 'content',
      title: 'KOL 达人梯队预算分布',
      hint: '头部、腰部、初级达人规划费用结构',
      layout: 'stack',
      components: [
        {
          id: 'comp-kol-tier-rose',
          type: 'donut-rose',
          title: '各梯队达人规划费用结构',
          query: 'huang-brand-kol-tiers',
          categoryField: 'tier',
          field: 'spend',
          width: 'full',
        },
      ],
    },
    {
      id: 'huang-content-notes-sec',
      tab: 'content',
      title: '种草笔记执行全量明细表',
      hint: '达人名称、量级、粉丝数、方向、裸价与执行状态',
      layout: 'stack',
      components: [
        {
          id: 'tbl-creator-execution',
          type: 'data-table',
          query: 'huang-creator-execution',
          width: 'full',
        },
      ],
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
