import type {
  CampaignProjectId,
  CampaignProjectMeta,
  CampaignTemplateId,
} from './campaign-types';
import { getAllProjectManifests, isProjectRegistered, getProjectManifest } from './core/registry';

export const CAMPAIGN_TEMPLATE_ID: CampaignTemplateId = 'campaign_review';

/**
 * Dynamically derived campaign project catalog from projects/<projectId>/manifest.ts
 */
export function getDynamicCampaignCatalog(): Record<string, CampaignProjectMeta> {
  const manifests = getAllProjectManifests();
  const catalog: Record<string, CampaignProjectMeta> = {};
  for (const [id, m] of Object.entries(manifests)) {
    if (id !== 'qicui') {
      catalog[id] = {
        id: id as CampaignProjectId,
        name: m.name,
        brand: m.brand,
        subtitle: m.subtitle || m.description || '',
        description: m.description || m.subtitle || '',
        templateId: CAMPAIGN_TEMPLATE_ID,
        color: m.color,
        category: m.category,
        defaultReportPeriod: m.defaultReportPeriod,
      };
    }
  }
  return catalog;
}

export const CAMPAIGN_PROJECT_CATALOG: Record<CampaignProjectId, CampaignProjectMeta> = new Proxy(
  {} as Record<CampaignProjectId, CampaignProjectMeta>,
  {
    get(_target, prop: string) {
      const catalog = getDynamicCampaignCatalog();
      return catalog[prop];
    },
    ownKeys() {
      return Object.keys(getDynamicCampaignCatalog());
    },
    getOwnPropertyDescriptor(_target, prop) {
      const catalog = getDynamicCampaignCatalog();
      if (prop in catalog) {
        return { configurable: true, enumerable: true, value: catalog[prop as string] };
      }
      return undefined;
    },
  }
);

export const CAMPAIGN_PROJECT_IDS: readonly CampaignProjectId[] = new Proxy([] as unknown as CampaignProjectId[], {
  get(_target, prop) {
    const ids = Object.keys(getDynamicCampaignCatalog()) as CampaignProjectId[];
    if (prop === 'length') return ids.length;
    if (prop === 'includes') return (item: unknown) => ids.includes(item as CampaignProjectId);
    if (typeof prop === 'string' && /^\d+$/.test(prop)) return ids[Number(prop)];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (ids as any)[prop];
  },
});

export const CAMPAIGN_PROJECT_LIST: readonly CampaignProjectMeta[] = new Proxy([] as unknown as CampaignProjectMeta[], {
  get(_target, prop) {
    const list = Object.values(getDynamicCampaignCatalog());
    if (prop === 'length') return list.length;
    if (typeof prop === 'string' && /^\d+$/.test(prop)) return list[Number(prop)];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (list as any)[prop];
  },
});

export const CAMPAIGN_REVIEW_TEMPLATE = {
  id: CAMPAIGN_TEMPLATE_ID,
  name: '轻量营销看板',
  description: '专项营销复盘，整合数据源、核心指标卡、明细表格与优化行动项。',
} as const;

/**
 * Type guard to check if a given id is a valid CampaignProjectId.
 */
export function isCampaignProject(id: unknown): id is CampaignProjectId {
  if (typeof id !== 'string' || !id || id === 'qicui') return false;
  return isProjectRegistered(id);
}

/**
 * Returns metadata for a campaign project, or undefined if not recognized.
 */
export function getCampaignProjectMeta(id: string): CampaignProjectMeta | undefined {
  if (!isCampaignProject(id)) return undefined;
  const m = getProjectManifest(id);
  if (!m) return undefined;
  return {
    id: id as CampaignProjectId,
    name: m.name,
    brand: m.brand,
    subtitle: m.subtitle || m.description || '',
    description: m.description || m.subtitle || '',
    templateId: CAMPAIGN_TEMPLATE_ID,
    color: m.color,
    category: m.category,
    defaultReportPeriod: m.defaultReportPeriod,
  };
}
