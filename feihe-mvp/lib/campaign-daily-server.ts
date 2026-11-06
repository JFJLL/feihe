/**
 * Campaign Daily Datasets Server-Only Extractor
 *
 * Server-only module that loads campaign-daily-data.json and provides
 * project-isolated daily datasets strictly after authentication guards.
 */

import type { CampaignDailyDataset } from './campaign-types';
import dailyDataJson from './campaign-daily-data.json' with { type: 'json' };
import kailasDaily from '../projects/kailas/data/daily.json' with { type: 'json' };
import meilingDaily from '../projects/meiling/data/daily.json' with { type: 'json' };
import wipesDaily from '../projects/winner-wipes/data/daily.json' with { type: 'json' };
import huangDaily from '../projects/huang-tiane/data/daily.json' with { type: 'json' };

export type CampaignDailyDataStore = Record<string, CampaignDailyDataset[]>;

const staticDatasets: CampaignDailyDataStore = (dailyDataJson || {}) as unknown as CampaignDailyDataStore;
const projectDatasets: Record<string, CampaignDailyDataset[]> = {
  kailas: kailasDaily as any,
  meiling: meilingDaily as any,
  'winner-wipes': wipesDaily as any,
  'huang-tiane': huangDaily as any,
};

export function getCampaignDailyDatasetsByProject(
  projectId: string
): CampaignDailyDataset[] {
  if (!projectId) return [];
  if (projectDatasets[projectId]) return projectDatasets[projectId];
  const datasets = staticDatasets[projectId];
  return Array.isArray(datasets) ? datasets : [];
}
