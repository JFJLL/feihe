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
import type { BoardPayload, ProjectSourceConfig, SourceSyncState, SyncMetadata } from './types';

export interface SyncRunResult {
  ok: boolean;
  projectId: string;
  timestamp: string;
  message: string;
  healthPassed: boolean;
  healthSummary?: string;
  errors?: string[];
  warnings?: string[];
  sourceReports?: Record<string, SourceSyncState>;
  syncMetadata?: SyncMetadata;
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

function extractDataThrough(payload: BoardPayload): string | null {
  const dates: string[] = [];
  if (payload.datasets) {
    for (const ds of Object.values(payload.datasets)) {
      const dateCol = ds.columns?.find(c => c.type === 'date' || c.role === 'TIMESTAMP' || c.key.toLowerCase().includes('date'));
      if (dateCol && Array.isArray(ds.rows)) {
        for (const row of ds.rows) {
          const val = row[dateCol.key];
          if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
            dates.push(val.slice(0, 10));
          }
        }
      }
    }
  }
  if (dates.length > 0) {
    dates.sort();
    return dates[dates.length - 1];
  }
  if (payload.reportPeriod && /^\d{4}-\d{2}-\d{2}/.test(payload.reportPeriod)) {
    return payload.reportPeriod.slice(0, 10);
  }
  const m = payload.reportPeriod?.match(/\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}/g);
  if (m && m.length > 0) {
    const last = m[m.length - 1].replace(/[年月]/g, '-').replace(/日/g, '');
    return last;
  }
  return null;
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
    const rawSourcesMetaPath = path.join(cacheDir, 'raw-sources-meta.json');
    let validRawSources: Record<string, unknown> = {};
    let validMeta: Record<string, SourceSyncState> = {};
    const syncWarnings: string[] = [];

    if (fs.existsSync(rawSourcesCachePath)) {
      try {
        validRawSources = JSON.parse(fs.readFileSync(rawSourcesCachePath, 'utf8'));
      } catch {
        validRawSources = {};
      }
    }
    if (fs.existsSync(rawSourcesMetaPath)) {
      try {
        validMeta = JSON.parse(fs.readFileSync(rawSourcesMetaPath, 'utf8'));
      } catch {
        validMeta = {};
      }
    }

    // Candidate cache for isolation: promote only when build and health checks pass
    const candidateRawSources: Record<string, unknown> = { ...validRawSources };
    const candidateMeta: Record<string, SourceSyncState> = { ...validMeta };

    let externalAttemptCount = 0;
    let externalSuccessCount = 0;
    let criticalFailure: { sourceId: string; error: string } | null = null;

    if (sourcesConfig?.sources) {
      for (const src of sourcesConfig.sources) {
        const existingMeta = candidateMeta[src.id] || {
          status: 'cached',
          lastAttemptAt: '',
          lastSuccessAt: null,
          critical: src.critical,
        };
        const hasCache = validRawSources[src.id] !== undefined;
        const intervalMs = (src.refreshIntervalMinutes ?? 60) * 60 * 1000;
        const isExpired = !existingMeta.lastSuccessAt || (Date.now() - new Date(existingMeta.lastSuccessAt).getTime() > intervalMs);
        const shouldFetchThis = Boolean(options.force) || !hasCache || isExpired;

        if (src.type === 'feishu_sheet' || src.type === 'feishu_bitable') {
          externalAttemptCount++;
          if (shouldFetchThis) {
            candidateMeta[src.id] = {
              ...existingMeta,
              lastAttemptAt: timestamp,
              critical: src.critical,
            };
            const res = fetchFeishuSource(src);
            if (res.ok && res.data) {
              candidateRawSources[src.id] = res.data;
              candidateMeta[src.id] = {
                status: 'live_success',
                lastAttemptAt: timestamp,
                lastSuccessAt: timestamp,
                critical: src.critical,
              };
              externalSuccessCount++;
            } else {
              const errText = res.error || '拉取未返回有效数据';
              if (hasCache) {
                candidateMeta[src.id] = {
                  status: 'cached',
                  lastAttemptAt: timestamp,
                  lastSuccessAt: existingMeta.lastSuccessAt,
                  error: errText,
                  critical: src.critical,
                };
                if (src.critical) {
                  criticalFailure = { sourceId: src.id, error: errText };
                } else {
                  syncWarnings.push(`外部数据源 [${src.name || src.id}] 实时刷新失败 (${errText})，保留旧缓存（已标记过期）`);
                }
              } else {
                candidateMeta[src.id] = {
                  status: 'failed',
                  lastAttemptAt: timestamp,
                  lastSuccessAt: null,
                  error: errText,
                  critical: src.critical,
                };
                if (src.critical || !hasCache) {
                  criticalFailure = { sourceId: src.id, error: errText };
                }
              }
            }
          } else {
            candidateMeta[src.id] = {
              ...existingMeta,
              status: 'cached',
              critical: src.critical,
            };
          }
        } else if (src.filePath) {
          const resolvedPath = path.isAbsolute(src.filePath)
            ? src.filePath
            : path.resolve(process.cwd(), src.filePath);
          if (fs.existsSync(resolvedPath)) {
            try {
              candidateRawSources[src.id] = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
              candidateMeta[src.id] = {
                status: 'live_success',
                lastAttemptAt: timestamp,
                lastSuccessAt: timestamp,
                critical: src.critical,
              };
            } catch {
              // Ignore
            }
          }
        }
      }
    }

    // Abort if a critical source failed or all external sources failed without cache
    if (criticalFailure) {
      return {
        ok: false,
        projectId,
        timestamp,
        message: `关键数据源 [${criticalFailure.sourceId}] 拉取失败: ${criticalFailure.error}，保留原有效快照与原有效缓存`,
        healthPassed: false,
        errors: [`关键数据源 [${criticalFailure.sourceId}] 失败: ${criticalFailure.error}`],
        warnings: syncWarnings,
        sourceReports: candidateMeta,
      };
    }

    if (externalAttemptCount > 0 && externalSuccessCount === 0 && Object.keys(validRawSources).length === 0) {
      return {
        ok: false,
        projectId,
        timestamp,
        message: `所有远程数据源均拉取失败，且无可用的本地缓存`,
        healthPassed: false,
        errors: ['所有远程数据源同步失败'],
        sourceReports: candidateMeta,
      };
    }

    // 2. Build BoardPayload via transformProject
    let payload: BoardPayload | null = null;
    try {
      payload = await buildProjectBoard(projectId, candidateRawSources);
    } catch (err) {
      return {
        ok: false,
        projectId,
        timestamp,
        message: `转换失败: ${err instanceof Error ? err.message : String(err)}`,
        healthPassed: false,
        errors: [err instanceof Error ? err.message : String(err)],
        sourceReports: candidateMeta,
      };
    }

    if (!payload) {
      return {
        ok: false,
        projectId,
        timestamp,
        message: `未能生成 BoardPayload`,
        healthPassed: false,
        sourceReports: candidateMeta,
      };
    }

    const dataThrough = extractDataThrough(payload);
    payload.updatedAt = timestamp;
    payload.dataThrough = dataThrough;
    payload.syncMetadata = {
      lastAttemptAt: timestamp,
      lastSuccessAt: timestamp,
      publishedAt: timestamp,
      dataThrough,
      sources: candidateMeta,
    };
    if (syncWarnings.length > 0) {
      payload.warnings = [...(payload.warnings || []), ...syncWarnings];
    }

    // 3. Run Board Health Verification
    const health = validateBoardHealth(payload);
    const healthOutput = formatHealthReport(health);
    console.log(healthOutput);

    // Critical Gate: If health check fails, NEVER overwrite active snapshot or active cache!
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
        sourceReports: candidateMeta,
      };
    }

    // 3.5 Promote candidate cache to active valid cache only after health check passes
    fs.writeFileSync(rawSourcesCachePath, JSON.stringify(candidateRawSources, null, 2), 'utf8');
    fs.writeFileSync(rawSourcesMetaPath, JSON.stringify(candidateMeta, null, 2), 'utf8');

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
      sourceReports: candidateMeta,
      syncMetadata: payload.syncMetadata,
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
