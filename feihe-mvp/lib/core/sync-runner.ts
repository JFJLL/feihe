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
import { getProjectsDir, discoverProjectIds, loadProjectSources, buildProjectBoard, getProjectManifest } from './registry';
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
  sourceReports?: Record<string, { status: 'live_success' | 'cached' | 'failed'; error?: string }>;
}

const syncLocks = new Map<string, Promise<SyncRunResult>>();

/**
 * Runs lark-cli to pull Feishu Sheets or Bitable data.
 */
export function fetchFeishuSource(config: ProjectSourceConfig): { ok: boolean; data?: unknown; error?: string } {
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
    if (config.range) {
      args.push('--range', config.range);
    }
    args.push('--no-header');
  } else if (config.type === 'feishu_bitable' && (config.baseToken || config.appToken) && config.tableId) {
    args = [
      'base', '+record-list',
      '--base-token', (config.baseToken || config.appToken)!,
      '--table-id', config.tableId,
      '--as', 'user',
      '--format', 'json',
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
    return { ok: false, error: '缺少有效的飞书配置参数' };
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
    return { ok: true, data: parsed?.data || parsed };
  } catch (errRtk) {
    try {
      const out = execFileSync(bin, args, {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 90000,
        shell: isWin,
        maxBuffer: 50 * 1024 * 1024,
      });
      const parsed = JSON.parse(out);
      return { ok: true, data: parsed?.data || parsed };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: errMsg };
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
    const sourceReports: Record<string, { status: 'live_success' | 'cached' | 'failed'; error?: string }> = {};
    const syncWarnings: string[] = [];

    if (fs.existsSync(rawSourcesCachePath)) {
      try {
        rawSources = JSON.parse(fs.readFileSync(rawSourcesCachePath, 'utf8'));
      } catch {
        rawSources = {};
      }
    }

    const hasCachedSources = Object.keys(rawSources).length > 0;
    const shouldFetchRemote = Boolean(options.force) || !hasCachedSources;

    // Only fetch remote when force is true or cache is empty
    if (sourcesConfig?.sources) {
      let fetchedAny = false;
      for (const src of sourcesConfig.sources) {
        if (src.type === 'feishu_sheet' || src.type === 'feishu_bitable') {
          if (shouldFetchRemote) {
            const res = fetchFeishuSource(src);
            if (res.ok && res.data) {
              rawSources[src.id] = res.data;
              sourceReports[src.id] = { status: 'live_success' };
              fetchedAny = true;
            } else {
              sourceReports[src.id] = {
                status: rawSources[src.id] ? 'cached' : 'failed',
                error: res.error,
              };
              syncWarnings.push(`外部数据源 [${src.name || src.id}] 实时拉取失败 (${res.error || '未返回有效数据'})，已降级沿用本地缓存`);
            }
          } else {
            sourceReports[src.id] = { status: 'cached' };
          }
        } else if (src.filePath) {
          const resolvedPath = path.isAbsolute(src.filePath)
            ? src.filePath
            : path.resolve(process.cwd(), src.filePath);
          if (fs.existsSync(resolvedPath)) {
            try {
              rawSources[src.id] = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
              sourceReports[src.id] = { status: 'live_success' };
              fetchedAny = true;
            } catch {
              // Ignore
            }
          }
        }
      }
      if (shouldFetchRemote || fetchedAny) {
        fs.writeFileSync(rawSourcesCachePath, JSON.stringify(rawSources, null, 2), 'utf8');
      }
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
        sourceReports,
      };
    }

    if (!payload) {
      return {
        ok: false,
        projectId,
        timestamp,
        message: `未能生成 BoardPayload`,
        healthPassed: false,
        sourceReports,
      };
    }

    payload.updatedAt = timestamp;
    if (syncWarnings.length > 0) {
      payload.warnings = [...(payload.warnings || []), ...syncWarnings];
    }

    // 3. Run Board Health Verification
    const health = validateBoardHealth(payload);
    const healthOutput = formatHealthReport(health);
    console.log(healthOutput);

    // Critical Gate: If health check fails, NEVER overwrite active snapshot!
    if (!health.ok) {
      const d1 = db();
      await d1
        .prepare(
          `INSERT INTO project_settings (id, project_id, key, value, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
        )
        .bind(
          `${projectId}:campaign_dashboard_health_error`,
          projectId,
          'campaign_dashboard_health_error',
          JSON.stringify({
            timestamp,
            errors: health.errors,
            warnings: health.warnings,
          }),
          timestamp
        )
        .run();

      return {
        ok: false,
        projectId,
        timestamp,
        message: `构建健康检查未通过 (${health.errors.length} 项致命错误)，已阻止写入生产有效快照`,
        healthPassed: false,
        healthSummary: health.summary,
        errors: health.errors.map(e => e.message),
        warnings: [...health.warnings.map(w => w.message), ...syncWarnings],
        sourceReports,
      };
    }

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

    // 5. Automatically register project in projects table with manifest metadata
    const manifest = getProjectManifest(projectId);
    const projName = manifest?.name || payload.name || projectId;
    const projSpu = manifest?.spu || payload.spu || '';
    const projBrand = manifest?.brand || payload.brand || '';
    const projCategory = manifest?.category || payload.category || '';
    const projDesc = manifest?.description || `战役复盘与数据分析项目 (${projectId})`;
    const projColor = manifest?.color || '#1769d5';
    const projTemplateId = manifest?.templateId || 'campaign_review';

    await d1
      .prepare(
        `INSERT INTO projects (
          id, name, spu, brand, category, description, status, color,
          org_id, department_id, owner_id, owner_name, template_id,
          is_archived, onboarding_status, created_by, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, '进行中', ?,
          'org-default', 'dept-general', 'user-admin', '系统管理员', ?,
          0, 'ready', 'user-admin', ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name,
          spu=excluded.spu,
          brand=excluded.brand,
          category=excluded.category,
          color=excluded.color,
          updated_at=excluded.updated_at`
      )
      .bind(
        projectId,
        projName,
        projSpu,
        projBrand,
        projCategory,
        projDesc,
        projColor,
        projTemplateId,
        timestamp,
        timestamp
      )
      .run();

    // 6. Ensure onboarding status is marked ready
    await d1
      .prepare(
        `INSERT INTO project_onboarding (project_id, current_step, completed_steps_json, selected_template_id, updated_at)
         VALUES (?, 'ready', '["template","source","first_sync","metrics","ready"]', ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET current_step='ready', updated_at=excluded.updated_at`
      )
      .bind(projectId, projTemplateId, timestamp)
      .run();

    return {
      ok: true,
      projectId,
      timestamp,
      message: `项目 ${projectId} 同步并入库成功`,
      healthPassed: health.ok,
      healthSummary: health.summary,
      errors: health.errors.map(e => e.message),
      warnings: [...health.warnings.map(w => w.message), ...syncWarnings],
      sourceReports,
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
