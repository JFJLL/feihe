/**
 * Campaign Daily Datasets Contract and Selector (Client-Safe)
 *
 * Dedicated to daily time-series metrics extraction and formatting across
 * campaign review projects (kailas, meiling, winner-wipes, qicui).
 * Strictly reads from dashboard.dailyDatasets without bundling any raw dataset JSON into client code.
 */

import type {
  CampaignDashboard,
  CampaignDailyDataset,
  CampaignDailyMetric,
  CampaignDailyRow,
} from './campaign-types';

export type {
  CampaignDailyDataset,
  CampaignDailyMetric,
  CampaignDailyRow,
};

/**
 * Returns available daily time-series datasets for a given campaign dashboard.
 * If no daily data exists or dashboard is null/undefined, returns an empty array
 * so the frontend can render an honest empty state without throwing.
 */
export function getCampaignDailyDatasets(
  dashboard?: CampaignDashboard | null
): CampaignDailyDataset[] {
  return dashboard?.dailyDatasets ?? [];
}
