/**
 * Campaign Enrichment Server Helper
 *
 * Strictly server-side module for loading project-isolated campaign enrichment
 * snapshots from lib/campaign-enrichment/{kailas,meiling,winner-wipes}.json.
 *
 * Guarantees:
 * 1. Whitelist-only project matching: verifies requested projectId === payload.projectId.
 * 2. Strict project isolation: never leaks payload data across projects.
 * 3. Pure read-only snapshot merge: never modifies the DB.
 * 4. Safe dataset merging: same ID overwrites base entity; missing incoming keeps base.
 * 5. Server-only: enrichment JSONs stay on the server and never enter the client bundle.
 */

import type {
  CampaignDashboard,
  CampaignSource,
  CampaignTable,
  CampaignDailyDataset,
} from "./campaign-types";

import kailasPayload from "./campaign-enrichment/kailas.json" with { type: "json" };
import meilingPayload from "./campaign-enrichment/meiling.json" with { type: "json" };
import winnerWipesPayload from "./campaign-enrichment/winner-wipes.json" with { type: "json" };
import huangTianePayload from "./campaign-enrichment/huang-tiane.json" with { type: "json" };

export interface CampaignEnrichmentPayload {
  projectId: string;
  extractedAt?: string;
  sources?: CampaignSource[];
  tables?: CampaignTable[];
  dailyDatasets?: CampaignDailyDataset[];
}

const ENRICHMENT_STORE: Record<string, CampaignEnrichmentPayload> = {
  kailas: kailasPayload as unknown as CampaignEnrichmentPayload,
  meiling: meilingPayload as unknown as CampaignEnrichmentPayload,
  "winner-wipes": winnerWipesPayload as unknown as CampaignEnrichmentPayload,
  "huang-tiane": huangTianePayload as unknown as CampaignEnrichmentPayload,
};

/**
 * Retrieves the enrichment payload for a specific projectId.
 * Strictly verifies whitelist and ensures payload.projectId matches requested projectId.
 */
export function getCampaignEnrichment(projectId: string): CampaignEnrichmentPayload | null {
  if (!projectId || typeof projectId !== "string") return null;

  const payload = ENRICHMENT_STORE[projectId];
  if (!payload) return null;

  // Strict isolation check: payload.projectId must match requested projectId
  if (payload.projectId !== projectId) {
    console.error(
      `[campaign-enrichment] Mismatched projectId: expected "${projectId}", got "${payload.projectId}"`
    );
    return null;
  }

  return payload;
}

/**
 * Pure helper to merge arrays of entities with unique "id"s.
 * Incoming items with matching "id" overwrite base items.
 * Base order is preserved with updates applied; new incoming items are appended.
 */
export function mergeById<T extends { id: string }>(base: T[] = [], incoming: T[] = []): T[] {
  const map = new Map<string, T>();
  for (const item of base) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  for (const item of incoming) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

/**
 * Merges enriched tables, sources, and dailyDatasets into the base dashboard.
 * - Same ID overwrites existing entity
 * - Missing/null incoming dataset keeps existing base dataset
 * - Pure function: creates a new read-only snapshot, does NOT mutate or write to DB.
 */
export function mergeCampaignEnrichment(
  dashboard: CampaignDashboard,
  enrichment: CampaignEnrichmentPayload | null
): CampaignDashboard {
  // Strict guard: requires valid enrichment with matching non-empty projectId
  if (!enrichment || !enrichment.projectId || enrichment.projectId !== dashboard.projectId) {
    if (enrichment && enrichment.projectId && enrichment.projectId !== dashboard.projectId) {
      console.warn(
        `[campaign-enrichment] Refusing to merge enrichment for "${enrichment.projectId}" into dashboard for "${dashboard.projectId}"`
      );
    }
    return dashboard;
  }

  // 1. Merge sources (same ID overwrites)
  const mergedSources =
    enrichment.sources && enrichment.sources.length > 0
      ? mergeById(dashboard.sources || [], enrichment.sources)
      : dashboard.sources || [];

  // 2. Merge tables (same ID overwrites)
  const mergedTables =
    enrichment.tables && enrichment.tables.length > 0
      ? mergeById(dashboard.tables || [], enrichment.tables)
      : dashboard.tables || [];

  // 3. Merge dailyDatasets:
  // If incoming has datasets, merge with existing; if incoming has none, preserve old!
  let mergedDailyDatasets = dashboard.dailyDatasets;
  if (enrichment.dailyDatasets && enrichment.dailyDatasets.length > 0) {
    mergedDailyDatasets = mergeById(
      dashboard.dailyDatasets || [],
      enrichment.dailyDatasets
    );
  }

  return {
    ...dashboard,
    sources: mergedSources,
    tables: mergedTables,
    dailyDatasets: mergedDailyDatasets,
  };
}
