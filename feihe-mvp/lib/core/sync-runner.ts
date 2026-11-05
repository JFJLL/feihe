/**
 * Universal Sync Runner
 *
 * Unified orchestration for project data synchronization.
 * Supersedes external script execution by pulling configured sources,
 * invoking transformProject, validating BoardHealth, and writing
 * the resulting BoardPayload to project_settings in the database.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { db, ensureSchema } from '../db';
import { getProjectsDir, discoverProjectIds, loadProjectSources, buildProjectBoard } from './registry';
import { validateBoardHealth, formatHealthReport } from './board-health';
import type { BoardPayload, ProjectSourceConfig } from './types';

export interface SyncRunResult {
  ok: boolean;
  projectId: string;
  timestamp: string;
  message: string;
  healthPassed: boolean;
  healthSummary?: string;
  errors?: string[];
  warnings?: string[];
}

const syncLocks = new Map<string, Promise<SyncRunResult>>();

/**
 * Runs lark-cli to pull Feishu Sheets or Bitable data.
 */
export function fetchFeishuSource(config: ProjectSourceConfig): unknown {
  const isWin = process.platform === 'win32';
  const bin = isWin ? 'lark-cli.cmd' : 'lark-cli';

  let args: string[] = [];
  if (config.type === 'feishu_sheet' && config.spreadsheetToken && config.sheetId) {
    args = [
      'sheets', '+table-get',
      '--as', 'user',
      '--format', 'json',
      '--spreadsheet-token', config.spreadsheetToken,
      '--sheet-id', config.sheetId,
    ];
  } else if (config.type === 'feishu_bitable' && config.appToken && config.tableId) {
    args = [
      'bitable', '+record-list',
      '--as', 'user',
      '--format', 'json',
      '--app-token', config.appToken,
      '--table-id', config.tableId,
    ];
  } else {
    return null;
  }

  try {
    const out = execFileSync('rtk', ['lark-cli', ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 90000,
      shell: isWin,
      maxBuffer: 50 * 1024 * 1024,
    });
    const parsed = JSON.parse(out);
    return parsed?.data || parsed;
  } catch {
    try {
      const out = execFileSync(bin, args, {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 90000,
        shell: isWin,
        maxBuffer: 50 * 1024 * 1024,
      });
      const parsed = JSON.parse(out);
      return parsed?.data || parsed;
    } catch (e) {
      return null;
    }
  }
}

/**
 * Executes the pull and transform pipeline for a single project.
 */
export async function runProjectSync(projectId: string, options: { force?: boolean } = {}): Promise<SyncRunResult> {
  if (syncLocks.has(projectId)) {
    return syncLocks.get(projectId)!;
  }

  const task = (async (): Promise<SyncRunResult> => {
    await ensureSchema();
    const timestamp = new Date().toISOString();
    const projDir = path.join(getProjectsDir(), projectId);
    const cacheDir = path.join(projDir, '.cache');

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // 1. Load project sources
    const sourcesConfig = await loadProjectSources(projectId);
    const rawSourcesCachePath = path.join(cacheDir, 'raw-sources.json');
    let rawSources: Record<string, unknown> = {};

    if (fs.existsSync(rawSourcesCachePath) && !options.force) {
      try {
        rawSources = JSON.parse(fs.readFileSync(rawSourcesCachePath, 'utf8'));
      } catch {
        rawSources = {};
      }
    }

    // If force or cache empty, fetch external sources
    if (sourcesConfig?.sources) {
      for (const src of sourcesConfig.sources) {
        if (src.type === 'feishu_sheet' || src.type === 'feishu_bitable') {
          const fetched = fetchFeishuSource(src);
          if (fetched) {
            rawSources[src.id] = fetched;
          }
        } else if (src.filePath && fs.existsSync(src.filePath)) {
          try {
            rawSources[src.id] = JSON.parse(fs.readFileSync(src.filePath, 'utf8'));
          } catch {
            // Ignore
          }
        }
      }
      fs.writeFileSync(rawSourcesCachePath, JSON.stringify(rawSources, null, 2), 'utf8');
    }

    // 2. Build BoardPayload via transformProject
    let payload: BoardPayload | null = null;
    try {
      payload = await buildProjectBoard(projectId, rawSources);
    } catch (err) {
      return {
        ok: false,
        projectId,
        timestamp,
        message: `转换失败: ${err instanceof Error ? err.message : String(err)}`,
        healthPassed: false,
        errors: [err instanceof Error ? err.message : String(err)],
      };
    }

    if (!payload) {
      return {
        ok: false,
        projectId,
        timestamp,
        message: `未能生成 BoardPayload`,
        healthPassed: false,
      };
    }

    payload.updatedAt = timestamp;

    // 3. Run Board Health Verification
    const health = validateBoardHealth(payload);
    const healthOutput = formatHealthReport(health);
    console.log(healthOutput);

    // 4. Save to Database project_settings
    const d1 = db();
    const id = `${projectId}:campaign_dashboard`;
    const serialized = JSON.stringify(payload);

    await d1
      .prepare(
        `INSERT INTO project_settings (id, project_id, key, value, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
      )
      .bind(id, projectId, 'campaign_dashboard', serialized, timestamp)
      .run();

    await d1
      .prepare(`UPDATE projects SET updated_at=? WHERE id=?`)
      .bind(timestamp, projectId)
      .run();

    return {
      ok: true,
      projectId,
      timestamp,
      message: `项目 ${projectId} 同步并入库成功`,
      healthPassed: health.ok,
      healthSummary: health.summary,
      errors: health.errors.map(e => e.message),
      warnings: health.warnings.map(w => w.message),
    };
  })();

  syncLocks.set(projectId, task);
  try {
    return await task;
  } finally {
    syncLocks.delete(projectId);
  }
}

/**
 * Runs sync across all registered projects.
 */
export async function runAllProjectsSync(force = false): Promise<Record<string, SyncRunResult>> {
  const ids = discoverProjectIds();
  const results: Record<string, SyncRunResult> = {};
  for (const id of ids) {
    results[id] = await runProjectSync(id, { force });
  }
  return results;
}
