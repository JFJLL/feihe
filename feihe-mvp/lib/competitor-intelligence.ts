// 竞品情报台全维度数据模型与基准数据（源自飞鹤竞品月报数据收集表 J8bnw5Mx4inxbukp2HYcgjMznJg 与飞鹤8月搜索底表）

export type CompetitorBrand = {
  id: string;
  name: string;
  short: string;
  color: string;
  self: boolean;
  agency: string;
};

export type CompetitorPerformance = {
  brand: string;
  month: string;
  spend: number;
  notes: number;
  viral: number;
  exposure: number;
  reads: number;
  interactions: number;
  reported: {
    viralRate: number;
    ctr: number;
    engagementRate: number;
  };
  source: string;
};

export type CompetitorCreatorMix = {
  brand: string;
  month: string;
  star: number;
  known: number;
  head: number;
  waist: number;
  junior: number;
  amateur: number;
  source?: string;
};

export type CompetitorFormatMix = {
  brand: string;
  month: string;
  image: number;
  video: number;
};

export type CompetitorContentMix = {
  brand: string;
  month: string;
  tag: string;
  count: number;
};

export type CompetitorProductStrategy = {
  brand: string;
  line: string;
  audience: string;
  proposition: string;
  scenarios: string;
  evidence: string;
};

export type CompetitorAction = {
  brand: string;
  month: string;
  type: string;
  title: string;
  detail: string;
};

export type CompetitorSearchFlow = {
  keyword: string;
  brand: string | null;
  level: string;
  upstream: string[];
  downstream: string[];
};

export type CompetitorIntelligenceData = {
  updatedAt: string;
  snapshotMonth: string;
  months: string[];
  brands: CompetitorBrand[];
  performance: CompetitorPerformance[];
  creatorMix: CompetitorCreatorMix[];
  formatMix: CompetitorFormatMix[];
  tagNames: string[];
  contentMix: CompetitorContentMix[];
  productStrategies: CompetitorProductStrategy[];
  actions: CompetitorAction[];
  searchFlow: CompetitorSearchFlow[];
};

import defaultCompetitorData from './competitor_intelligence.json';
import fs from 'node:fs';
import path from 'node:path';

let cachedData: CompetitorIntelligenceData | null = null;

export function getCompetitorIntelligence(): CompetitorIntelligenceData {
  if (cachedData) return cachedData;
  try {
    const candidates = [
      path.resolve(process.cwd(), 'data', 'competitor_intelligence.json'),
      path.resolve(process.cwd(), 'feihe-mvp', 'data', 'competitor_intelligence.json'),
      path.resolve(process.cwd(), '..', '.codex_work', 'competitor_data.json'),
      path.resolve(process.cwd(), '.codex_work', 'competitor_data.json'),
    ];
    const target = candidates.find(p => fs.existsSync(p));
    if (target) {
      const raw = JSON.parse(fs.readFileSync(target, 'utf8'));
      cachedData = {
        updatedAt: raw.meta?.updatedAt || '2026-09-04 19:59',
        snapshotMonth: raw.meta?.snapshotMonth || '2026-08',
        months: raw.meta?.months || ['2026-06', '2026-07', '2026-08'],
        brands: raw.brands || [],
        performance: raw.performance || [],
        creatorMix: raw.creatorMix || [],
        formatMix: raw.formatMix || [],
        tagNames: raw.tagNames || [],
        contentMix: raw.contentMix || [],
        productStrategies: raw.productStrategies || [],
        actions: raw.actions || [],
        searchFlow: raw.searchFlow?.keywords || [],
      };
      return cachedData;
    }
  } catch (err) {
    console.error('Failed to load competitor_data.json:', err);
  }
  const fallback = defaultCompetitorData;
  return {
    updatedAt: fallback.meta?.updatedAt || '2026-09-04 19:59',
    snapshotMonth: fallback.meta?.snapshotMonth || '2026-08',
    months: fallback.meta?.months || ['2026-06', '2026-07', '2026-08'],
    brands: fallback.brands || [],
    performance: fallback.performance || [],
    creatorMix: fallback.creatorMix || [],
    formatMix: fallback.formatMix || [],
    tagNames: fallback.tagNames || [],
    contentMix: fallback.contentMix || [],
    productStrategies: fallback.productStrategies || [],
    actions: fallback.actions || [],
    searchFlow: fallback.searchFlow?.keywords || [],
  };
}
