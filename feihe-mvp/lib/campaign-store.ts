import { db } from './db';
import type { CampaignDashboard } from './campaign-types';

export const CAMPAIGN_DASHBOARD_SETTING_KEY = 'campaign_dashboard';

function validateDashboardShape(projectId: string, data: unknown): asserts data is CampaignDashboard {
  if (!data || typeof data !== 'object') {
    throw new Error(`Invalid campaign dashboard snapshot: payload is not an object for project ${projectId}`);
  }
  const d = data as Partial<CampaignDashboard>;
  if (d.projectId !== projectId) {
    throw new Error(
      `Snapshot projectId mismatch: expected "${projectId}", found "${d.projectId}"`
    );
  }
  if (!Array.isArray(d.sources)) {
    throw new Error(`Invalid campaign dashboard snapshot: "sources" must be an array for project ${projectId}`);
  }
  if (!Array.isArray(d.kpis)) {
    throw new Error(`Invalid campaign dashboard snapshot: "kpis" must be an array for project ${projectId}`);
  }
  if (!Array.isArray(d.tables)) {
    throw new Error(`Invalid campaign dashboard snapshot: "tables" must be an array for project ${projectId}`);
  }
  if (!d.actions || !Array.isArray(d.actions.items)) {
    throw new Error(`Invalid campaign dashboard snapshot: "actions.items" must be an array for project ${projectId}`);
  }
  if (!Array.isArray(d.warnings)) {
    throw new Error(`Invalid campaign dashboard snapshot: "warnings" must be an array for project ${projectId}`);
  }
}

/**
 * Reads campaign dashboard snapshot directly from project_settings.
 * Returns null if not found. Throws on corrupt JSON or invalid shape.
 */
export async function getCampaignDashboardSnapshot(
  projectId: string
): Promise<CampaignDashboard | null> {
  const d1 = db();
  const row = await d1
    .prepare(
      'SELECT value FROM project_settings WHERE project_id=? AND key=?'
    )
    .bind(projectId, CAMPAIGN_DASHBOARD_SETTING_KEY)
    .first<{ value: string }>();

  if (!row?.value) return null;

  const parsed = JSON.parse(row.value);
  validateDashboardShape(projectId, parsed);
  return parsed;
}

/**
 * Saves or updates campaign dashboard snapshot in project_settings.
 */
export async function saveCampaignDashboardSnapshot(
  projectId: string,
  dashboard: CampaignDashboard
): Promise<void> {
  validateDashboardShape(projectId, dashboard);

  const d1 = db();
  const now = new Date().toISOString();
  const id = `${projectId}:${CAMPAIGN_DASHBOARD_SETTING_KEY}`;
  const serialized = JSON.stringify(dashboard);

  await d1
    .prepare(
      `INSERT INTO project_settings (id, project_id, key, value, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
    )
    .bind(id, projectId, CAMPAIGN_DASHBOARD_SETTING_KEY, serialized, now)
    .run();
}