/**
 * Campaign Live Sync Service
 *
 * Manages on-demand and background auto-sync from Feishu via sync-all-feishu-live.mjs.
 * Enforces single-instance concurrency lock and cooldown to prevent overlapping executions.
 * Provides disk-backed live reload functions to ensure fresh data without server restart.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { CampaignEnrichmentPayload } from './campaign-enrichment-server';
import type { CampaignDailyDataset } from './campaign-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..');

export interface SyncResult {
  ok: boolean;
  message: string;
  timestamp: string;
}

let activeSyncPromise: Promise<SyncResult> | null = null;
let lastSyncCompletedAt = 0;
const SYNC_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown between sync runs

/**
 * Triggers live Feishu synchronization.
 * Thread-safe: if a sync is already running, returns the ongoing promise.
 * If within cooldown and not forced, returns cached success immediately.
 */
export function triggerCampaignLiveSync(
  projectId?: string,
  force = false
): Promise<SyncResult> {
  if (activeSyncPromise) {
    console.log(`[campaign-live-sync] Sync already in progress; piggybacking on active run...`);
    return activeSyncPromise;
  }

  const now = Date.now();
  if (!force && now - lastSyncCompletedAt < SYNC_COOLDOWN_MS && lastSyncCompletedAt > 0) {
    const cachedTime = new Date(lastSyncCompletedAt).toISOString();
    return Promise.resolve({
      ok: true,
      message: '数据最近已同步（冷却期内），展示最新数据',
      timestamp: cachedTime,
    });
  }

  const scriptPath = path.resolve(APP_ROOT, 'scripts/sync-all-feishu-live.mjs');
  console.log(`[campaign-live-sync] Launching live sync script: ${scriptPath} (project: ${projectId || 'all'})...`);

  activeSyncPromise = new Promise<SyncResult>((resolve, reject) => {
    execFile(
      process.execPath,
      [scriptPath],
      {
        cwd: APP_ROOT,
        timeout: 180000,
        maxBuffer: 50 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const finishedTime = new Date().toISOString();
        activeSyncPromise = null;

        if (error) {
          console.error(`[campaign-live-sync] Sync script execution failed:`, error);
          if (stderr) console.error(`[campaign-live-sync] stderr:`, stderr);
          return resolve({
            ok: false,
            message: `飞书实时同步失败: ${error.message}`,
            timestamp: finishedTime,
          });
        }

        lastSyncCompletedAt = Date.now();
        console.log(`[campaign-live-sync] Sync script completed successfully at ${finishedTime}.`);
        resolve({
          ok: true,
          message: '已从飞书实时同步最新项目数据',
          timestamp: finishedTime,
        });
      }
    );
  });

  return activeSyncPromise;
}

/**
 * Checks if a snapshot is older than the max age threshold (default 30 mins).
 */
export function isSnapshotStale(updatedAt?: string | null, maxAgeMinutes = 30): boolean {
  if (!updatedAt) return true;
  const updatedTime = new Date(updatedAt).getTime();
  if (isNaN(updatedTime)) return true;
  const ageMs = Date.now() - updatedTime;
  return ageMs > maxAgeMinutes * 60 * 1000;
}

/**
 * Reads fresh campaign enrichment directly from disk to bypass in-memory static module caching.
 */
export function getFreshCampaignEnrichment(
  projectId: string
): CampaignEnrichmentPayload | null {
  if (!projectId || typeof projectId !== 'string') return null;
  const validProjects = new Set(['kailas', 'meiling', 'winner-wipes', 'huang-tiane']);
  if (!validProjects.has(projectId)) return null;

  const filePath = path.resolve(APP_ROOT, `lib/campaign-enrichment/${projectId}.json`);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const payload = JSON.parse(raw) as CampaignEnrichmentPayload;
    if (payload.projectId !== projectId) {
      console.warn(`[campaign-live-sync] Mismatched projectId in ${filePath}: expected ${projectId}, got ${payload.projectId}`);
      return null;
    }
    return payload;
  } catch (err) {
    console.error(`[campaign-live-sync] Error reading fresh enrichment for ${projectId}:`, err);
    return null;
  }
}

/**
 * Reads fresh campaign daily datasets directly from disk to bypass static import caching.
 */
export function getFreshCampaignDailyDatasets(projectId: string): CampaignDailyDataset[] {
  if (!projectId || typeof projectId !== 'string') return [];
  const filePath = path.resolve(APP_ROOT, 'lib/campaign-daily-data.json');
  if (!fs.existsSync(filePath)) return [];

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const store = JSON.parse(raw) as Record<string, CampaignDailyDataset[]>;
    const datasets = store[projectId];
    return Array.isArray(datasets) ? datasets : [];
  } catch (err) {
    console.error(`[campaign-live-sync] Error reading fresh daily data for ${projectId}:`, err);
    return [];
  }
}
