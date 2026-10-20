/**
 * Campaign Daily Datasets Server-Only Extractor
 *
 * Server-only module that loads campaign-daily-data.json and provides
 * project-isolated daily datasets strictly after authentication guards.
 */

import type { CampaignDailyDataset } from './campaign-types';
import dailyDataJson from './campaign-daily-data.json' with { type: 'json' };

export type CampaignDailyDataStore = Record<string, CampaignDailyDataset[]>;

const staticDatasets: CampaignDailyDataStore = (dailyDataJson || {}) as unknown as CampaignDailyDataStore;

export function getCampaignDailyDatasetsByProject(
  projectId: string
): CampaignDailyDataset[] {
  if (!projectId) return [];
  const datasets = staticDatasets[projectId];
  return Array.isArray(datasets) ? datasets : [];
}
