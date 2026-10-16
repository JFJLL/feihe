import { db, type MiniDb } from '../db';
import type { CompetitorConfig, CompetitorNote, KeywordSyncCheckpoint } from './types';

export const AUTHORIZED_QICUI_TASK_ID = 'ba7a885c-16b5-479d-a2a9-9cceb5908e9c';

export async function ensureCompetitorsSchema(): Promise<void> {
  const d = db();
  await d.batch([
    d.prepare(
      'CREATE TABLE IF NOT EXISTS competitor_configs (' +
      '  project_id TEXT PRIMARY KEY,' +
      '  task_id TEXT NOT NULL DEFAULT \'\',' +
      '  keywords_json TEXT NOT NULL DEFAULT \'[]\',' +
      '  brand_rules_json TEXT NOT NULL DEFAULT \'[]\',' +
      '  sync_checkpoints_json TEXT NOT NULL DEFAULT \'{}\',' +
      '  last_synced_at TEXT,' +
      '  sync_status TEXT NOT NULL DEFAULT \'idle\',' +
      '  last_error TEXT,' +
      '  overlap_window_days INTEGER NOT NULL DEFAULT 3,' +
      '  rate_limit_ms INTEGER NOT NULL DEFAULT 1200,' +
      '  max_pages_per_run INTEGER NOT NULL DEFAULT 3,' +
      '  page_size INTEGER NOT NULL DEFAULT 20,' +
      '  is_configured INTEGER NOT NULL DEFAULT 0,' +
      '  updated_at TEXT NOT NULL' +
      ')'
    ),
    d.prepare(
      'CREATE TABLE IF NOT EXISTS competitor_notes (' +
      '  id TEXT PRIMARY KEY,' +
      '  project_id TEXT NOT NULL,' +
      '  task_id TEXT NOT NULL,' +
      '  raw_note_id TEXT NOT NULL,' +
      '  id_hex_length INTEGER NOT NULL,' +
      '  title TEXT NOT NULL,' +
      '  content TEXT,' +
      '  author_name TEXT,' +
      '  author_id TEXT,' +
      '  avatar_url TEXT,' +
      '  pub_time TEXT,' +
      '  insert_time TEXT,' +
      '  last_update_time TEXT,' +
      '  asof_date TEXT,' +
      '  collection_date TEXT,' +
      '  keyword_hit TEXT NOT NULL,' +
      '  brand_attributed TEXT NOT NULL,' +
      '  product_line TEXT NOT NULL,' +
      '  content_type TEXT NOT NULL DEFAULT \'normal\',' +
      '  content_nature TEXT NOT NULL DEFAULT \'unknown\',' +
      '  nature_evidence TEXT NOT NULL DEFAULT \'\',' +
      '  creator_tier TEXT NOT NULL DEFAULT \'unknown\',' +
      '  liked_count INTEGER NOT NULL DEFAULT 0,' +
      '  comment_count INTEGER NOT NULL DEFAULT 0,' +
      '  collected_count INTEGER NOT NULL DEFAULT 0,' +
      '  share_count INTEGER NOT NULL DEFAULT 0,' +
      '  interaction_total INTEGER NOT NULL DEFAULT 0,' +
      '  note_url TEXT NOT NULL,' +
      '  video_url TEXT,' +
      '  tags_json TEXT NOT NULL DEFAULT \'[]\',' +
      '  raw_payload_json TEXT NOT NULL DEFAULT \'{}\',' +
      '  duplicate_status TEXT NOT NULL DEFAULT \'unique\',' +
      '  suspected_dup_target TEXT,' +
      '  consumer_issues_json TEXT NOT NULL DEFAULT \'[]\',' +
      '  sentiment_tendency TEXT NOT NULL DEFAULT \'neutral\',' +
      '  data_quality TEXT NOT NULL DEFAULT \'complete\',' +
      '  created_at TEXT NOT NULL,' +
      '  updated_at TEXT NOT NULL' +
      ')'
    ),
    d.prepare(
      'CREATE TABLE IF NOT EXISTS competitor_sync_logs (' +
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,' +
      '  project_id TEXT NOT NULL,' +
      '  task_id TEXT NOT NULL,' +
      '  keyword TEXT NOT NULL,' +
      '  window_from TEXT,' +
      '  window_to TEXT,' +
      '  window_type TEXT,' +
      '  page_start INTEGER,' +
      '  page_end INTEGER,' +
      '  rows_read INTEGER NOT NULL DEFAULT 0,' +
      '  rows_imported INTEGER NOT NULL DEFAULT 0,' +
      '  rows_updated INTEGER NOT NULL DEFAULT 0,' +
      '  duplicates_found INTEGER NOT NULL DEFAULT 0,' +
      '  suspected_dups_found INTEGER NOT NULL DEFAULT 0,' +
      '  upstream_total_count INTEGER NOT NULL DEFAULT 0,' +
      '  coverage_complete INTEGER NOT NULL DEFAULT 0,' +
      '  status TEXT NOT NULL,' +
      '  error_message TEXT,' +
      '  duration_ms INTEGER NOT NULL DEFAULT 0,' +
      '  created_at TEXT NOT NULL' +
      ')'
    ),
    d.prepare('CREATE INDEX IF NOT EXISTS idx_comp_notes_proj_brand ON competitor_notes(project_id, brand_attributed)'),
    d.prepare('CREATE INDEX IF NOT EXISTS idx_comp_notes_proj_kw ON competitor_notes(project_id, keyword_hit)'),
    d.prepare('CREATE INDEX IF NOT EXISTS idx_comp_notes_proj_asof ON competitor_notes(project_id, asof_date)'),
    d.prepare('CREATE INDEX IF NOT EXISTS idx_comp_notes_proj_raw_id ON competitor_notes(project_id, raw_note_id)'),
    d.prepare(
      'CREATE TABLE IF NOT EXISTS business_sync_tasks (' +
      '  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_key TEXT NOT NULL,' +
      '  name TEXT NOT NULL, state TEXT NOT NULL, spec_json TEXT NOT NULL,' +
      '  interval_minutes INTEGER NOT NULL, next_run_at TEXT NOT NULL,' +
      '  last_success_at TEXT, business_through TEXT, last_error TEXT NOT NULL DEFAULT \'\',' +
      '  retry_count INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_expires_at TEXT,' +
      '  version INTEGER NOT NULL DEFAULT 1, last_run_id TEXT, updated_at TEXT NOT NULL,' +
      '  UNIQUE(project_id, source_key)' +
      ')'
    ),
    d.prepare(
      'CREATE TABLE IF NOT EXISTS business_sync_requests (' +
      '  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, task_id TEXT NOT NULL,' +
      '  window_from TEXT, window_to TEXT, created_at TEXT NOT NULL, processed_at TEXT' +
      ')'
    ),
    d.prepare(
      'CREATE TABLE IF NOT EXISTS sync_jobs (' +
      '  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_id TEXT NOT NULL,' +
      '  status TEXT NOT NULL DEFAULT \'pending\', rows_read INTEGER NOT NULL DEFAULT 0,' +
      '  rows_imported INTEGER NOT NULL DEFAULT 0, rows_failed INTEGER NOT NULL DEFAULT 0,' +
      '  error_summary TEXT NOT NULL DEFAULT \'\', started_at TEXT NOT NULL, finished_at TEXT' +
      ')'
    ),
  ]);

  const defaultRules = [
    {
      brand: '合生元',
      aliases: ['合生元', 'Biostime', 'biostime'],
      productLines: [
        { line: '派星', keywords: ['派星', '贝塔星', '阿尔法星'] },
        { line: '可贝思', keywords: ['可贝思', '羊奶'] },
        { line: '益生菌', keywords: ['益生菌', '白金版'] }
      ]
    },
    {
      brand: '金领冠',
      aliases: ['金领冠', '伊利金领冠'],
      productLines: [
        { line: '珍护', keywords: ['珍护', '珍护菁装'] },
        { line: '塞纳牧', keywords: ['塞纳牧', '有机'] },
        { line: '睿护', keywords: ['睿护'] }
      ]
    },
    {
      brand: '飞鹤',
      aliases: ['飞鹤', 'Feihe'],
      productLines: [
        { line: '启萃', keywords: ['启萃', '精粹'] },
        { line: '星飞帆', keywords: ['星飞帆', '卓睿', '卓舒'] },
        { line: '臻稚', keywords: ['臻稚', '有机'] }
      ]
    },
    {
      brand: '爱他美',
      aliases: ['爱他美', 'Aptamil'],
      productLines: [
        { line: '卓萃', keywords: ['卓萃', '白金'] },
        { line: '领萃', keywords: ['领萃'] }
      ]
    }
  ];

  const now = new Date().toISOString();
  await d.prepare(
    'INSERT OR IGNORE INTO competitor_configs (' +
    '  project_id, task_id, keywords_json, brand_rules_json, sync_checkpoints_json,' +
    '  last_synced_at, sync_status, overlap_window_days, rate_limit_ms, max_pages_per_run,' +
    '  page_size, is_configured, updated_at' +
    ') VALUES (' +
    '  ?, ?, ?, ?, \'{}\', NULL, \'idle\', 3, 1200, 3, 20, 1, ?' +
    ')'
  ).bind(
    'qicui',
    AUTHORIZED_QICUI_TASK_ID,
    JSON.stringify(['合生元', '金领冠']),
    JSON.stringify(defaultRules),
    now
  ).run();
}

export async function getCompetitorConfig(projectId: string): Promise<CompetitorConfig | null> {
  await ensureCompetitorsSchema();
  const d = db();
  const row = await d.prepare('SELECT * FROM competitor_configs WHERE project_id = ?').bind(projectId).first<any>();
  if (!row) {
    return {
      projectId,
      taskId: '',
      keywords: [],
      brandRules: [],
      syncCheckpoints: {},
      lastSyncedAt: null,
      syncStatus: 'idle',
      lastError: null,
      overlapWindowDays: 3,
      rateLimitMs: 1200,
      maxPagesPerRun: 3,
      pageSize: 20,
      isConfigured: false,
      updatedAt: new Date().toISOString(),
    };
  }
  let keywords = [];
  let brandRules = [];
  let syncCheckpoints = {};
  try { keywords = JSON.parse(row.keywords_json || '[]'); } catch {}
  try { brandRules = JSON.parse(row.brand_rules_json || '[]'); } catch {}
  try { syncCheckpoints = JSON.parse(row.sync_checkpoints_json || '{}'); } catch {}
  return {
    projectId: row.project_id,
    taskId: row.task_id || '',
    keywords,
    brandRules,
    syncCheckpoints,
    lastSyncedAt: row.last_synced_at,
    syncStatus: (row.sync_status || 'idle') as any,
    lastError: row.last_error,
    overlapWindowDays: Number(row.overlap_window_days || 3),
    rateLimitMs: Number(row.rate_limit_ms || 1200),
    maxPagesPerRun: Number(row.max_pages_per_run || 3),
    pageSize: Number(row.page_size || 20),
    isConfigured: Boolean(row.is_configured && row.task_id),
    updatedAt: row.updated_at,
  };
}

export async function saveCompetitorConfig(
  projectId: string,
  data: Partial<CompetitorConfig>
): Promise<CompetitorConfig> {
  await ensureCompetitorsSchema();
  const d = db();
  const existing = await getCompetitorConfig(projectId);
  const updated: CompetitorConfig = {
    ...existing!,
    ...data,
    projectId,
    updatedAt: new Date().toISOString(),
    isConfigured: Boolean((data.taskId !== undefined ? data.taskId : existing?.taskId) && (data.keywords || existing?.keywords || []).length > 0),
  };
  await d.prepare(
    'INSERT INTO competitor_configs (' +
    '  project_id, task_id, keywords_json, brand_rules_json, sync_checkpoints_json,' +
    '  last_synced_at, sync_status, last_error, overlap_window_days, rate_limit_ms,' +
    '  max_pages_per_run, page_size, is_configured, updated_at' +
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)' +
    ' ON CONFLICT(project_id) DO UPDATE SET' +
    '  task_id = excluded.task_id,' +
    '  keywords_json = excluded.keywords_json,' +
    '  brand_rules_json = excluded.brand_rules_json,' +
    '  sync_checkpoints_json = excluded.sync_checkpoints_json,' +
    '  last_synced_at = excluded.last_synced_at,' +
    '  sync_status = excluded.sync_status,' +
    '  last_error = excluded.last_error,' +
    '  overlap_window_days = excluded.overlap_window_days,' +
    '  rate_limit_ms = excluded.rate_limit_ms,' +
    '  max_pages_per_run = excluded.max_pages_per_run,' +
    '  page_size = excluded.page_size,' +
    '  is_configured = excluded.is_configured,' +
    '  updated_at = excluded.updated_at'
  ).bind(
    projectId,
    updated.taskId,
    JSON.stringify(updated.keywords),
    JSON.stringify(updated.brandRules),
    JSON.stringify(updated.syncCheckpoints),
    updated.lastSyncedAt || null,
    updated.syncStatus,
    updated.lastError || null,
    Number(updated.overlapWindowDays || 3),
    Number(updated.rateLimitMs || 1200),
    Number(updated.maxPagesPerRun || 3),
    Number(updated.pageSize || 20),
    updated.isConfigured ? 1 : 0,
    updated.updatedAt
  ).run();
  return updated;
}

export async function ensureCompetitorSyncTask(projectId: string, config: CompetitorConfig): Promise<void> {
  const d = db();
  const taskId = projectId + ':competitor_ipscg';
  const spec = {
    type: 'competitor_ipscg',
    projectId,
    taskId: config.taskId,
    keywords: config.keywords,
    overlapWindowDays: config.overlapWindowDays,
    rateLimitMs: config.rateLimitMs,
    maxPagesPerRun: config.maxPagesPerRun,
    pageSize: config.pageSize,
  };
  const now = new Date().toISOString();
  await d.prepare(
    'INSERT INTO business_sync_tasks (' +
    '  id, project_id, source_key, name, state, spec_json, interval_minutes, next_run_at, updated_at' +
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)' +
    ' ON CONFLICT(project_id, source_key) DO UPDATE SET' +
    '  name = excluded.name,' +
    '  spec_json = excluded.spec_json,' +
    '  interval_minutes = excluded.interval_minutes,' +
    '  updated_at = excluded.updated_at'
  ).bind(
    taskId, projectId, 'competitor_ipscg', '竞品监测定时与增量采集',
    config.isConfigured ? 'active' : 'paused',
    JSON.stringify(spec), 360, now, now
  ).run();
}

export async function enqueueCompetitorJob(
  projectId: string,
  options: { from?: string; to?: string; windowType?: string; maxPagesPerRun?: number } = {}
): Promise<{ jobId: string; taskId: string }> {
  const d = db();
  const config = await getCompetitorConfig(projectId);
  if (!config || !config.isConfigured || !config.taskId) {
    throw new Error('项目未绑定竞品监测任务，无法加入排队');
  }
  await ensureCompetitorSyncTask(projectId, config);

  const jobId = 'comp-job-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const syncTaskId = projectId + ':competitor_ipscg';
  const now = new Date().toISOString();

  await d.batch([
    d.prepare(
      'INSERT INTO business_sync_requests(id, project_id, task_id, window_from, window_to, created_at)' +
      ' VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      projectId + ':' + jobId,
      projectId,
      syncTaskId,
      options.from || null,
      options.to || null,
      now
    ),
    d.prepare(
      'INSERT INTO sync_jobs(id, project_id, source_id, status, started_at)' +
      ' VALUES (?, ?, ?, \'pending\', ?)'
    ).bind(
      jobId, projectId, 'competitor_ipscg', now
    ),
    d.prepare(
      'UPDATE business_sync_tasks SET state = \'active\', next_run_at = ?, last_error = \'\', updated_at = ?' +
      ' WHERE id = ? AND project_id = ?'
    ).bind(
      now, now, syncTaskId, projectId
    ),
  ]);

  return { jobId, taskId: syncTaskId };
}

export async function claimCompetitorJobLease(projectId: string) {
  const d = db();
  const syncTaskId = projectId + ':competitor_ipscg';
  const token = 'lease_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 15 * 60000).toISOString();

  await d.prepare(
    'UPDATE business_sync_tasks SET lease_token = ?, lease_expires_at = ?, updated_at = ?' +
    ' WHERE id = ? AND project_id = ? AND (lease_expires_at IS NULL OR lease_expires_at <= ?)'
  ).bind(token, expires, now, syncTaskId, projectId, now).run();

  const current = await d.prepare(
    'SELECT lease_token, spec_json FROM business_sync_tasks WHERE id = ? AND project_id = ?'
  ).bind(syncTaskId, projectId).first<{ lease_token: string; spec_json: string }>();

  if (current?.lease_token !== token) return null;

  const runId = 'comp-run-' + Date.now();
  const req = await d.prepare(
    'SELECT id, window_from, window_to FROM business_sync_requests' +
    ' WHERE task_id = ? AND project_id = ? AND processed_at IS NULL' +
    ' ORDER BY created_at ASC LIMIT 1'
  ).bind(syncTaskId, projectId).first<{ id: string; window_from: string | null; window_to: string | null }>();

  return { token, runId, request: req, spec: JSON.parse(current.spec_json || '{}') };
}

export async function finishCompetitorJobLease(
  projectId: string,
  claim: { token: string; runId: string; request?: { id: string } | null },
  result: { rowsRead: number; rowsImported: number; error?: string | null }
) {
  const d = db();
  const syncTaskId = projectId + ':competitor_ipscg';
  const now = new Date().toISOString();
  const failed = Boolean(result.error);

  await d.batch([
    d.prepare(
      'UPDATE business_sync_tasks SET' +
      '  lease_token = NULL, lease_expires_at = NULL,' +
      '  last_run_id = ?, last_success_at = ?, last_error = ?, updated_at = ?' +
      ' WHERE id = ? AND project_id = ?'
    ).bind(
      claim.runId, failed ? null : now, result.error || '', now, syncTaskId, projectId
    ),
    d.prepare(
      'INSERT INTO sync_jobs(id, project_id, source_id, status, rows_read, rows_imported, error_summary, started_at, finished_at)' +
      ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)' +
      ' ON CONFLICT(id) DO UPDATE SET' +
      '  status = excluded.status, rows_read = excluded.rows_read, rows_imported = excluded.rows_imported,' +
      '  error_summary = excluded.error_summary, finished_at = excluded.finished_at'
    ).bind(
      claim.runId, projectId, 'competitor_ipscg', failed ? 'failed' : 'success',
      result.rowsRead, result.rowsImported, result.error || '', now, now
    ),
    ...(claim.request?.id ? [
      d.prepare('UPDATE business_sync_requests SET processed_at = ? WHERE id = ?').bind(now, claim.request.id)
    ] : []),
  ]);
}
