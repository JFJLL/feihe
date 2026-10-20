import type {
  CampaignProjectId,
  CampaignProjectMeta,
  CampaignTemplateId,
} from './campaign-types';

export const CAMPAIGN_TEMPLATE_ID: CampaignTemplateId = 'campaign_review';

export const CAMPAIGN_PROJECT_IDS: readonly CampaignProjectId[] = [
  'kailas',
  'meiling',
  'winner-wipes',
  'huang-tiane',
] as const;

export const CAMPAIGN_PROJECT_CATALOG: Record<CampaignProjectId, CampaignProjectMeta> = {
  kailas: {
    id: 'kailas',
    name: '凯乐石',
    brand: '凯乐石',
    subtitle: '预算与版位效率',
    description: '预算与版位效率',
    templateId: CAMPAIGN_TEMPLATE_ID,
    color: '#0284c7',
    category: '户外',
    defaultReportPeriod: '营销复盘周期',
  },
  meiling: {
    id: 'meiling',
    name: '美菱',
    brand: '美菱',
    subtitle: '双十一投放与内容执行',
    description: '双十一投放与内容执行',
    templateId: CAMPAIGN_TEMPLATE_ID,
    color: '#0d9488',
    category: '家电',
    defaultReportPeriod: '大促复盘周期',
  },
  'winner-wipes': {
    id: 'winner-wipes',
    name: '酒精湿巾',
    brand: '稳健',
    subtitle: '种草效果与KPI进度',
    description: '种草效果与KPI进度',
    templateId: CAMPAIGN_TEMPLATE_ID,
    color: '#16a34a',
    category: '快消',
    defaultReportPeriod: '营销复盘周期',
  },
  'huang-tiane': {
    id: 'huang-tiane',
    name: '黄天鹅',
    brand: '黄天鹅',
    subtitle: '可生食鸡蛋种草与电商引流',
    description: '可生食鸡蛋小红书种草、投流与商销引流复盘',
    templateId: CAMPAIGN_TEMPLATE_ID,
    color: '#d97706',
    category: '生鲜食品',
    defaultReportPeriod: '营销复盘周期',
  },
};

export const CAMPAIGN_PROJECT_LIST: readonly CampaignProjectMeta[] = [
  CAMPAIGN_PROJECT_CATALOG.kailas,
  CAMPAIGN_PROJECT_CATALOG.meiling,
  CAMPAIGN_PROJECT_CATALOG['winner-wipes'],
  CAMPAIGN_PROJECT_CATALOG['huang-tiane'],
];

export const CAMPAIGN_REVIEW_TEMPLATE = {
  id: CAMPAIGN_TEMPLATE_ID,
  name: '轻量营销看板',
  description: '专项营销复盘，整合数据源、核心指标卡、明细表格与优化行动项。',
} as const;

/**
 * Type guard to check if a given id is a valid CampaignProjectId.
 */
export function isCampaignProject(id: unknown): id is CampaignProjectId {
  return typeof id === 'string' && (CAMPAIGN_PROJECT_IDS as readonly string[]).includes(id);
}

/**
 * Returns metadata for a campaign project, or undefined if not recognized.
 */
export function getCampaignProjectMeta(id: string): CampaignProjectMeta | undefined {
  if (!isCampaignProject(id)) return undefined;
  return CAMPAIGN_PROJECT_CATALOG[id];
}
