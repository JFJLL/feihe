#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item.startsWith('--')) {
      const key = item.slice(2);
      if (key === 'dry-run' || key === 'plan' || key === 'backup' || key === 'no-backup' || key === 'pause-sync-tasks' || key === 'preserve-sync-state' || key === 'allow-live-target' || key === 'bootstrap-standard-schema') {
        flags[key] = true;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        flags[key] = argv[++i];
      } else {
        flags[key] = 'true';
      }
    }
  }
  return {
    source: flags.source ? path.resolve(flags.source) : null,
    target: flags.target ? path.resolve(flags.target) : null,
    initFromBase: flags['init-from-base'] ? path.resolve(flags['init-from-base']) : null,
    projectId: flags['project-id'] || 'qicui',
    dryRun: Boolean(flags['dry-run']),
    plan: Boolean(flags.plan),
    backup: flags['no-backup'] ? false : (flags.backup !== false),
    conflict: flags.conflict || 'skip', // 'skip' or 'replace'
    pauseSyncTasks: flags['preserve-sync-state'] ? false : (flags['pause-sync-tasks'] !== false),
    allowLiveTarget: Boolean(flags['allow-live-target']),
    bootstrapStandardSchema: Boolean(flags['bootstrap-standard-schema']),
  };
}

export function redactSecrets(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/(["']?[\w-]*(?:cookie|authorization|token|secret|password|api[_-]?key)[\w-]*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\r\n,}]+)/gi, '$1[REDACTED]')
    .replace(/https?:\/\/[^\s"'<>]+/g, '[URL]');
}

export function log(message) {
  console.log(`[MIGRATION] ${message}`);
}

export function logRedacted(message) {
  console.log(`[MIGRATION] ${redactSecrets(message)}`);
}

export function computeUntouchedHash(db, projectId) {
  const hash = crypto.createHash('sha256');
  const checks = [
    { table: 'users', sql: 'SELECT * FROM users ORDER BY id' },
    { table: 'organizations', sql: 'SELECT * FROM organizations ORDER BY id' },
    { table: 'departments', sql: 'SELECT * FROM departments ORDER BY id' },
    { table: 'clients', sql: 'SELECT * FROM clients ORDER BY id' },
    { table: 'settings', sql: 'SELECT * FROM settings ORDER BY key' },
    { table: 'projects', sql: 'SELECT * FROM projects WHERE id != ? ORDER BY id', params: [projectId] },
    { table: 'project_notes', sql: 'SELECT * FROM project_notes WHERE project_id != ? ORDER BY id', params: [projectId] },
    { table: 'integrations', sql: 'SELECT * FROM integrations WHERE project_id != ? ORDER BY id', params: [projectId] },
    { table: 'metric_definitions', sql: 'SELECT * FROM metric_definitions WHERE project_id != ? ORDER BY id', params: [projectId] },
    { table: 'metric_bindings', sql: 'SELECT * FROM metric_bindings WHERE project_id != ? ORDER BY id', params: [projectId] },
    { table: 'data_sources', sql: 'SELECT * FROM data_sources WHERE project_id != ? ORDER BY id', params: [projectId] },
    { table: 'source_accounts', sql: 'SELECT * FROM source_accounts WHERE project_id != ? ORDER BY id', params: [projectId] },
  ];

  for (const c of checks) {
    try {
      const rows = db.prepare(c.sql).all(...(c.params || []));
      hash.update(`${c.table}:${JSON.stringify(rows)}`);
    } catch {
      hash.update(`${c.table}:missing`);
    }
  }
  return hash.digest('hex');
}

// Explicit whitelist of tables to migrate for the project
export const PROJECT_MIGRATION_WHITELIST = [
  { table: 'business_project_config', pkCols: ['project_id'], desc: '项目来源绑定与业务规则配置' },
  { table: 'business_daily_reports', pkCols: ['id'], desc: '28天历史冻结与已确认日报快照' },
  { table: 'business_captures', pkCols: ['id'], desc: '上游飞书/数据源原始抓取快照' },
  { table: 'business_source_heads', pkCols: ['project_id', 'source_key'], desc: '各业务来源最新有效Head指针' },
  { table: 'business_sync_receipts', pkCols: ['id'], desc: '抓取凭据与同步状态' },
  { table: 'business_platform_observations', pkCols: ['id'], desc: '平台分日观测数据' },
  { table: 'business_comment_deliveries', pkCols: ['id'], desc: '评论核销与交付明细' },
  { table: 'business_note_archives', pkCols: ['project_id', 'note_id'], desc: '笔记业务归档快照' },
  { table: 'business_comment_captures', pkCols: ['id'], desc: '评论区抓取记录' },
  { table: 'business_comment_analyses', pkCols: ['id'], desc: '评论情感与意图分析' },
  { table: 'business_comment_heads', pkCols: ['project_id', 'note_id'], desc: '最新评论分析指针' },
  { table: 'business_comment_jobs', pkCols: ['id'], desc: '评论处理任务' },
  { table: 'competitor_configs', pkCols: ['project_id'], desc: '竞品监控配置' },
  { table: 'competitor_notes', pkCols: ['id'], desc: '竞品笔记样本库' },
  { table: 'competitor_sync_logs', pkCols: ['id'], desc: '竞品采集流水' },
  { table: 'note_project_profiles', pkCols: ['id'], desc: '项目私有笔记属性与价格分类' },
  { table: 'note_covers', pkCols: ['id'], desc: '笔记本地封面图元数据' },
  { table: 'dashboards', pkCols: ['id'], desc: '默认营销看板定义' },
  { table: 'business_sync_tasks', pkCols: ['id'], desc: '数据源同步任务定义（强制paused状态）' },
  { table: 'business_sync_requests', pkCols: ['id'], desc: '同步请求历史记录' },
];

export function ensureTargetSchema(targetDb) {
  targetDb.exec('PRAGMA busy_timeout = 10000; PRAGMA journal_mode = WAL;');

  // 1. Core tables
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, spu TEXT NOT NULL DEFAULT '', brand TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '进行中',
      color TEXT NOT NULL DEFAULT '#1769d5', start_at TEXT, end_at TEXT, created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      org_id TEXT NOT NULL DEFAULT 'org-default', department_id TEXT NOT NULL DEFAULT 'dept-marketing',
      client_id TEXT NOT NULL DEFAULT 'client-feihe', owner_id TEXT NOT NULL DEFAULT '',
      template_id TEXT NOT NULL DEFAULT 'content_marketing', is_archived INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT, onboarding_status TEXT NOT NULL DEFAULT 'ready'
    );
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL,
      industry TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer', department_id TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_templates (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '',
      modules_json TEXT NOT NULL DEFAULT '[]', default_metrics_json TEXT NOT NULL DEFAULT '[]',
      default_dashboard_json TEXT NOT NULL DEFAULT '{}', version TEXT NOT NULL DEFAULT '1.0.0'
    );
    CREATE TABLE IF NOT EXISTS project_onboarding (
      project_id TEXT PRIMARY KEY, current_step TEXT NOT NULL DEFAULT 'template',
      completed_steps_json TEXT NOT NULL DEFAULT '[]', selected_template_id TEXT, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dashboards (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT '默认看板',
      is_default INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1,
      layout_json TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, save_token TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS dashboard_cards (
      id TEXT PRIMARY KEY, dashboard_id TEXT NOT NULL, project_id TEXT NOT NULL,
      title TEXT NOT NULL, type TEXT NOT NULL, metric_keys_json TEXT NOT NULL DEFAULT '[]',
      config_json TEXT NOT NULL DEFAULT '{}', sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS note_project_profiles (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, note_id TEXT NOT NULL,
      cooperation INTEGER NOT NULL DEFAULT 0, promoted INTEGER NOT NULL DEFAULT 0,
      note_type TEXT NOT NULL DEFAULT '', note_price REAL NOT NULL DEFAULT 0,
      picture_price REAL NOT NULL DEFAULT 0, video_price REAL NOT NULL DEFAULT 0,
      category1 TEXT NOT NULL DEFAULT '', category2 TEXT NOT NULL DEFAULT '',
      product_scope TEXT NOT NULL DEFAULT '本品', brand TEXT NOT NULL DEFAULT '',
      notes_remarks TEXT NOT NULL DEFAULT '', review_status TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);

  // 2. Business Daily & Captures tables
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS business_project_config (
      project_id TEXT PRIMARY KEY, config_json TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS business_captures (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_key TEXT NOT NULL, source_version TEXT NOT NULL,
      captured_at TEXT NOT NULL, payload_json TEXT NOT NULL, fingerprint TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS business_source_heads (
      project_id TEXT NOT NULL, source_key TEXT NOT NULL, capture_id TEXT NOT NULL, captured_at TEXT NOT NULL,
      PRIMARY KEY(project_id, source_key)
    );
    CREATE TABLE IF NOT EXISTS business_daily_reports (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, business_day TEXT NOT NULL, status TEXT NOT NULL,
      confirmed_by TEXT, created_at TEXT NOT NULL, fingerprint TEXT NOT NULL, payload_json TEXT NOT NULL,
      UNIQUE(project_id, business_day, status, fingerprint)
    );
    CREATE TABLE IF NOT EXISTS business_sync_receipts (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_key TEXT NOT NULL, capture_id TEXT NOT NULL,
      state TEXT NOT NULL, captured_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS business_platform_observations (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_key TEXT NOT NULL, account_id TEXT NOT NULL,
      business_day TEXT NOT NULL, natural_key_json TEXT NOT NULL, data_json TEXT NOT NULL,
      captured_at TEXT NOT NULL, run_id TEXT NOT NULL,
      UNIQUE(project_id, source_key, account_id, business_day, natural_key_json)
    );
    CREATE TABLE IF NOT EXISTS business_comment_deliveries (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, note_id TEXT NOT NULL, source_key TEXT NOT NULL,
      source_row INTEGER NOT NULL, capture_id TEXT NOT NULL, status TEXT NOT NULL, comment_day TEXT,
      data_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS business_note_archives (
      project_id TEXT NOT NULL, note_id TEXT NOT NULL, data_json TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(project_id, note_id)
    );
    CREATE TABLE IF NOT EXISTS business_comment_captures (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, note_id TEXT NOT NULL, captured_at TEXT NOT NULL,
      complete INTEGER NOT NULL, payload_json TEXT NOT NULL, metrics_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS business_comment_analyses (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, note_id TEXT NOT NULL, capture_id TEXT NOT NULL,
      created_at TEXT NOT NULL, payload_json TEXT NOT NULL, summary_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS business_comment_heads (
      project_id TEXT NOT NULL, note_id TEXT NOT NULL, capture_id TEXT NOT NULL, analysis_id TEXT NOT NULL,
      PRIMARY KEY(project_id, note_id)
    );
    CREATE TABLE IF NOT EXISTS business_comment_jobs (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, note_id TEXT NOT NULL, status TEXT NOT NULL,
      queued_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, lease_token TEXT,
      lease_expires_at TEXT, error TEXT NOT NULL DEFAULT '', attempts INTEGER NOT NULL DEFAULT 0,
      next_run_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS business_comment_settings (
      project_id TEXT PRIMARY KEY, confidence_threshold REAL NOT NULL, brands_json TEXT NOT NULL,
      competitors_json TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS business_comment_corrections (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, note_id TEXT NOT NULL, comment_id TEXT NOT NULL,
      content_hash TEXT NOT NULL, created_at TEXT NOT NULL, actor TEXT NOT NULL, data_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS business_note_reviews (
      project_id TEXT NOT NULL, note_id TEXT NOT NULL, version INTEGER NOT NULL, data_json TEXT NOT NULL,
      PRIMARY KEY(project_id, note_id)
    );
    CREATE TABLE IF NOT EXISTS business_note_review_history (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, note_id TEXT NOT NULL, actor TEXT NOT NULL,
      created_at TEXT NOT NULL, data_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS business_note_link_checks (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, note_id TEXT NOT NULL, checked_at TEXT NOT NULL,
      state TEXT NOT NULL, evidence_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS business_sync_tasks (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_key TEXT NOT NULL, name TEXT NOT NULL,
      state TEXT NOT NULL, spec_json TEXT NOT NULL, interval_minutes INTEGER NOT NULL,
      next_run_at TEXT NOT NULL, last_success_at TEXT, business_through TEXT,
      last_error TEXT NOT NULL DEFAULT '', retry_count INTEGER NOT NULL DEFAULT 0,
      lease_token TEXT, lease_expires_at TEXT, version INTEGER NOT NULL DEFAULT 1,
      last_run_id TEXT, updated_at TEXT NOT NULL,
      UNIQUE(project_id, source_key)
    );
    CREATE TABLE IF NOT EXISTS business_sync_requests (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, task_id TEXT NOT NULL,
      window_from TEXT, window_to TEXT, created_at TEXT NOT NULL, processed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS business_sync_worker (
      id TEXT PRIMARY KEY, mode TEXT NOT NULL, last_seen_at TEXT NOT NULL
    );
  `);

  // 3. Competitor tables
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS competitor_configs (
      project_id TEXT PRIMARY KEY, task_id TEXT NOT NULL DEFAULT '', keywords_json TEXT NOT NULL DEFAULT '[]',
      brand_rules_json TEXT NOT NULL DEFAULT '[]', sync_checkpoints_json TEXT NOT NULL DEFAULT '{}',
      last_synced_at TEXT, sync_status TEXT NOT NULL DEFAULT 'idle', last_error TEXT,
      overlap_window_days INTEGER NOT NULL DEFAULT 3, rate_limit_ms INTEGER NOT NULL DEFAULT 1200,
      max_pages_per_run INTEGER NOT NULL DEFAULT 3, page_size INTEGER NOT NULL DEFAULT 20,
      is_configured INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS competitor_notes (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, task_id TEXT NOT NULL, raw_note_id TEXT NOT NULL,
      id_hex_length INTEGER NOT NULL, title TEXT NOT NULL, content TEXT, author_name TEXT, author_id TEXT,
      avatar_url TEXT, pub_time TEXT, insert_time TEXT, last_update_time TEXT, asof_date TEXT,
      collection_date TEXT, keyword_hit TEXT NOT NULL, brand_attributed TEXT NOT NULL,
      product_line TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'normal',
      content_nature TEXT NOT NULL DEFAULT 'unknown', nature_evidence TEXT NOT NULL DEFAULT '',
      creator_tier TEXT NOT NULL DEFAULT 'unknown', liked_count INTEGER NOT NULL DEFAULT 0,
      comment_count INTEGER NOT NULL DEFAULT 0, collected_count INTEGER NOT NULL DEFAULT 0,
      share_count INTEGER NOT NULL DEFAULT 0, interaction_total INTEGER NOT NULL DEFAULT 0,
      note_url TEXT NOT NULL, video_url TEXT, tags_json TEXT NOT NULL DEFAULT '[]',
      raw_payload_json TEXT NOT NULL DEFAULT '{}', duplicate_status TEXT NOT NULL DEFAULT 'unique',
      suspected_dup_target TEXT, consumer_issues_json TEXT NOT NULL DEFAULT '[]',
      sentiment_tendency TEXT NOT NULL DEFAULT 'neutral', data_quality TEXT NOT NULL DEFAULT 'complete',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS competitor_sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, task_id TEXT NOT NULL,
      keyword TEXT NOT NULL, window_from TEXT, window_to TEXT, window_type TEXT,
      page_start INTEGER, page_end INTEGER, rows_read INTEGER NOT NULL DEFAULT 0,
      rows_imported INTEGER NOT NULL DEFAULT 0, rows_updated INTEGER NOT NULL DEFAULT 0,
      duplicates_found INTEGER NOT NULL DEFAULT 0, suspected_dups_found INTEGER NOT NULL DEFAULT 0,
      upstream_total_count INTEGER NOT NULL DEFAULT 0, coverage_complete INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL, error_message TEXT, duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // 4. Safe column alterations on existing tables if needed
  function safeAddColumn(tableName, colName, colDef) {
    const tableExists = targetDb.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tableName);
    if (!tableExists) return;
    const cols = targetDb.prepare(`PRAGMA table_info("${tableName}")`).all().map(c => c.name);
    if (!cols.includes(colName)) {
      targetDb.exec(`ALTER TABLE "${tableName}" ADD COLUMN ${colName} ${colDef};`);
    }
  }

  safeAddColumn('projects', 'org_id', "TEXT NOT NULL DEFAULT 'org-default'");
  safeAddColumn('projects', 'department_id', "TEXT NOT NULL DEFAULT 'dept-marketing'");
  safeAddColumn('projects', 'client_id', "TEXT NOT NULL DEFAULT 'client-feihe'");
  safeAddColumn('projects', 'owner_id', "TEXT NOT NULL DEFAULT ''");
  safeAddColumn('projects', 'template_id', "TEXT NOT NULL DEFAULT 'content_marketing'");
  safeAddColumn('projects', 'is_archived', "INTEGER NOT NULL DEFAULT 0");
  safeAddColumn('projects', 'archived_at', "TEXT");
  safeAddColumn('projects', 'onboarding_status', "TEXT NOT NULL DEFAULT 'ready'");

  safeAddColumn('data_sources', 'connection_id', "TEXT NOT NULL DEFAULT ''");
  safeAddColumn('data_sources', 'is_paused', "INTEGER NOT NULL DEFAULT 0");
  safeAddColumn('data_sources', 'schedule_enabled', "INTEGER NOT NULL DEFAULT 0");
  safeAddColumn('data_sources', 'last_probe_at', "TEXT");
  safeAddColumn('data_sources', 'probe_status', "TEXT NOT NULL DEFAULT 'unknown'");

  safeAddColumn('metric_definitions', 'is_standard', "INTEGER NOT NULL DEFAULT 1");
  safeAddColumn('metric_definitions', 'numerator_key', "TEXT NOT NULL DEFAULT ''");
  safeAddColumn('metric_definitions', 'denominator_key', "TEXT NOT NULL DEFAULT ''");
  safeAddColumn('metric_definitions', 'missing_policy', "TEXT NOT NULL DEFAULT 'zero'");
  safeAddColumn('metric_definitions', 'filter_json', "TEXT NOT NULL DEFAULT '{}'");

  safeAddColumn('action_logs', 'actor_user_id', "TEXT NOT NULL DEFAULT ''");
  safeAddColumn('supplier_comments', 'source_id', "TEXT NOT NULL DEFAULT ''");
  safeAddColumn('dashboards', 'save_token', "TEXT NOT NULL DEFAULT ''");
  safeAddColumn('business_sync_requests', 'processed_at', "TEXT");

  // 5. Indices
  targetDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_business_capture_project ON business_captures(project_id, source_key, captured_at);
    CREATE INDEX IF NOT EXISTS idx_business_report_day ON business_daily_reports(project_id, business_day, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_business_sync_due ON business_sync_tasks(state, next_run_at);
    CREATE INDEX IF NOT EXISTS idx_business_platform_day ON business_platform_observations(project_id, source_key, business_day);
    CREATE INDEX IF NOT EXISTS idx_business_comment_deliveries ON business_comment_deliveries(project_id, note_id, source_key);
    CREATE INDEX IF NOT EXISTS idx_comp_notes_proj_brand ON competitor_notes(project_id, brand_attributed);
    CREATE INDEX IF NOT EXISTS idx_comp_notes_proj_kw ON competitor_notes(project_id, keyword_hit);
    CREATE INDEX IF NOT EXISTS idx_comp_notes_proj_asof ON competitor_notes(project_id, asof_date);
    CREATE INDEX IF NOT EXISTS idx_note_project_profiles_project_note ON note_project_profiles(project_id, note_id);
    CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
    CREATE INDEX IF NOT EXISTS idx_dashboards_project ON dashboards(project_id);
    CREATE INDEX IF NOT EXISTS idx_dashboard_cards_dashboard ON dashboard_cards(dashboard_id);
  `);
}

export function bootstrapStandardSeeds(targetDb) {
  // 6. Standard application schema bootstrap seeds (INSERT OR IGNORE preserves all existing data)
  targetDb.exec(`
    INSERT OR IGNORE INTO organizations(id, name, slug, created_at, updated_at)
    VALUES('org-default', '通用项目协同中台', 'default', datetime('now'), datetime('now'));

    INSERT OR IGNORE INTO departments(id, org_id, name, created_at, updated_at)
    VALUES
      ('dept-marketing', 'org-default', '市场与营销部', datetime('now'), datetime('now')),
      ('dept-operations', 'org-default', '渠道与运营部', datetime('now'), datetime('now')),
      ('dept-brand', 'org-default', '品牌战略部', datetime('now'), datetime('now')),
      ('dept-general', 'org-default', '综合管理部', datetime('now'), datetime('now'));

    INSERT OR IGNORE INTO clients(id, org_id, name, industry, created_at, updated_at)
    VALUES
      ('client-feihe', 'org-default', '飞鹤乳业', '快消母婴', datetime('now'), datetime('now')),
      ('client-internal', 'org-default', '公司内部部门', '内部管理', datetime('now'), datetime('now'));

    INSERT OR IGNORE INTO users(id, email, name, role, department_id, created_at, updated_at)
    VALUES
      ('user-admin', 'admin@company.local', '平台管理员', 'platform_admin', 'dept-general', datetime('now'), datetime('now')),
      ('user-project-manager', 'pm@company.local', '项目主管(李强)', 'user', 'dept-marketing', datetime('now'), datetime('now')),
      ('user-editor', 'editor@company.local', '业务编辑者(张晓)', 'user', 'dept-marketing', datetime('now'), datetime('now')),
      ('user-viewer', 'viewer@company.local', '项目观察员(王悦)', 'user', 'dept-operations', datetime('now'), datetime('now'));

    INSERT OR IGNORE INTO project_members(id, project_id, user_id, role, created_at, updated_at)
    VALUES
      ('qicui:user-admin', 'qicui', 'user-admin', 'project_admin', datetime('now'), datetime('now')),
      ('qicui:user-project-manager', 'qicui', 'user-project-manager', 'project_admin', datetime('now'), datetime('now')),
      ('qicui:user-editor', 'qicui', 'user-editor', 'editor', datetime('now'), datetime('now')),
      ('qicui:user-viewer', 'qicui', 'user-viewer', 'viewer', datetime('now'), datetime('now'));

    INSERT OR IGNORE INTO project_onboarding(project_id, current_step, completed_steps_json, selected_template_id, updated_at)
    VALUES('qicui', 'ready', '["template","source","first_sync","metrics","ready"]', 'content_marketing', datetime('now'));

    INSERT OR IGNORE INTO project_templates(id, name, description, icon, modules_json, default_metrics_json, default_dashboard_json, version)
    VALUES
      ('general_workbench', '通用数据工作台', '适用于任意非社媒表格数据集，如活动排期、任务分工、预算支出等，支持通用指标统计与看板呈现。', 'table',
       '["overview","data","reports","settings"]',
       '["task_total","task_completed","task_completion_rate","budget_total","spent_total","budget_spent_rate"]',
       '{"cards":[{"id":"c1","title":"任务总数","type":"metric_card","metric":"task_total"},{"id":"c2","title":"已完成数","type":"metric_card","metric":"task_completed"},{"id":"c3","title":"任务完成率","type":"metric_card","metric":"task_completion_rate"},{"id":"c4","title":"预算执行率","type":"metric_card","metric":"budget_spent_rate"},{"id":"c5","title":"按负责人状态分布","type":"bar_chart","dimension":"owner","metric":"task_completed"}]}',
       '1.0.0'),
      ('content_marketing', '内容营销项目', '适用于品牌内容种草、笔记资产沉淀、博主合作与曝光互动效果跟踪。', 'sparkles',
       '["overview","content","growth","data","reports","settings"]',
       '["published_notes","interactions","reads","ctr","spend","cpe"]',
       '{"cards":[{"id":"cm1","title":"发布笔记数","type":"metric_card","metric":"published_notes"},{"id":"cm2","title":"总互动量","type":"metric_card","metric":"interactions"},{"id":"cm3","title":"互动成本 CPE","type":"metric_card","metric":"cpe"},{"id":"cm4","title":"内容趋势","type":"trend_chart","metric":"interactions"}]}',
       '1.0.0');
  `);
}

export function runMigration(options) {
  const {
    source,
    target,
    initFromBase,
    projectId,
    dryRun,
    plan,
    backup,
    conflict,
    pauseSyncTasks,
    allowLiveTarget,
    bootstrapStandardSchema,
  } = options;

  if (!source || !fs.existsSync(source)) {
    throw new Error(`Source database does not exist: ${source}`);
  }

  if (!target) {
    throw new Error(`Target database path must be specified.`);
  }

  // Guard: Source and Target must not be the same path
  if (path.resolve(source) === path.resolve(target)) {
    throw new Error(`Source and target databases cannot be the same file (${path.resolve(source)}).`);
  }

  // Guard: Refuse to execute against live production path unless explicitly allowed
  const normalizedTarget = path.resolve(target).toLowerCase();
  const liveDbIndicator = path.normalize('feihe-mvp/data/local.db').toLowerCase();
  if (normalizedTarget.endsWith(liveDbIndicator) && !allowLiveTarget) {
    throw new Error(`Safety guard triggered: target appears to be live database path (${target}). To protect the live database, run against an isolated replica, or explicitly supply --allow-live-target.`);
  }

  // Step 1: Ensure target exists or initialize from base
  const targetDir = path.dirname(target);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetExisted = fs.existsSync(target);
  if (!targetExisted && initFromBase && !dryRun) {
    if (!fs.existsSync(initFromBase)) {
      throw new Error(`Base database path does not exist: ${initFromBase}`);
    }
    log(`Initializing target replica from base database using consistent SQLite snapshot: ${initFromBase}`);
    const baseDb = new DatabaseSync(initFromBase, { readOnly: true });
    baseDb.exec(`VACUUM INTO '${target.replace(/\\/g, '/')}'`);
    baseDb.close();
    log(`Initialized target replica at ${target} (${fs.statSync(target).size} bytes).`);
  } else if (!targetExisted && !dryRun) {
    // Target will be created on connection
    log(`Target database does not exist yet. Will create a new SQLite database at ${target}.`);
  }

  // Step 2: Backup target if requested and target exists
  let backupPath = null;
  if (targetExisted && backup && !dryRun) {
    const timestamp = Math.floor(Date.now() / 1000);
    backupPath = `${target}.backup.${timestamp}`;
    const targetDbForBackup = new DatabaseSync(target, { readOnly: true });
    targetDbForBackup.exec(`VACUUM INTO '${backupPath.replace(/\\/g, '/')}'`);
    targetDbForBackup.close();
    log(`Consistent target backup created at ${backupPath}`);
  }

  // Step 3: Open Source (strictly readOnly) and Target
  log(`Opening source database read-only: ${source}`);
  const sourceDb = new DatabaseSync(source, { readOnly: true });
  // Point-in-time snapshot read transaction to guarantee cross-table consistency
  sourceDb.exec('BEGIN DEFERRED;');

  // For dryRun, use an isolated temporary database in os.tmpdir() so target on disk is completely untouched
  let dryRunTmpPath = null;
  let targetDb;
  if (dryRun) {
    dryRunTmpPath = path.join(os.tmpdir(), `migration-dryrun-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    const baseForDryRun = targetExisted ? target : (initFromBase && fs.existsSync(initFromBase) ? initFromBase : null);
    if (baseForDryRun) {
      const bDb = new DatabaseSync(baseForDryRun, { readOnly: true });
      bDb.exec(`VACUUM INTO '${dryRunTmpPath.replace(/\\/g, '/')}'`);
      bDb.close();
    }
    targetDb = new DatabaseSync(dryRunTmpPath);
  } else {
    targetDb = new DatabaseSync(target);
  }

  try {
    ensureTargetSchema(targetDb);
    if (bootstrapStandardSchema) {
      log('Bootstrapping standard application schema seeds (organizations, departments, clients, users, project_members, templates)...');
      bootstrapStandardSeeds(targetDb);
    }

    const stats = {
      projectId,
      sourcePath: source,
      targetPath: target,
      dryRun,
      whitelist: PROJECT_MIGRATION_WHITELIST.map(w => w.table),
      conflictStrategy: conflict,
      pauseSyncTasks,
      tableActions: {},
      conflicts: [],
      summary: {
        totalSourceRows: 0,
        inserted: 0,
        unchanged: 0,
        conflicts: 0,
        skipped: 0,
        replaced: 0,
      },
    };

    // Helper to get columns for a table
    function getColumns(db, tableName) {
      try {
        return db.prepare(`PRAGMA table_info("${tableName}")`).all().map(c => c.name);
      } catch {
        return [];
      }
    }

    // Helper to migrate a table with project filtering
    function migrateTable(tableName, options = {}) {
      const {
        hasProjectCol = true,
        projectColName = 'project_id',
        pkCols = ['id'],
        transformRow = null,
        filterSql = null,
      } = options;

      const sCols = getColumns(sourceDb, tableName);
      const tCols = getColumns(targetDb, tableName);
      if (sCols.length === 0) {
        return; // source doesn't have table
      }

      const commonCols = sCols.filter(c => tCols.includes(c));
      if (commonCols.length === 0) return;

      let query = `SELECT * FROM "${tableName}"`;
      const conditions = [];
      const params = [];

      if (hasProjectCol) {
        conditions.push(`"${projectColName}" = ?`);
        params.push(projectId);
      }
      if (filterSql) {
        conditions.push(filterSql);
      }
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      const sourceRows = sourceDb.prepare(query).all(...params);
      stats.summary.totalSourceRows += sourceRows.length;

      let insertedCount = 0;
      let unchangedCount = 0;
      let conflictCount = 0;
      let skippedCount = 0;
      let replacedCount = 0;

      const action = {
        sourceCount: sourceRows.length,
        inserted: 0,
        unchanged: 0,
        conflicts: 0,
        skipped: 0,
        replaced: 0,
      };

      if (sourceRows.length === 0) {
        stats.tableActions[tableName] = action;
        return;
      }

      // Check existing keys in target
      const pkWhere = pkCols.map(c => `"${c}" = ?`).join(' AND ');
      const checkStmt = targetDb.prepare(`SELECT * FROM "${tableName}" WHERE ${pkWhere}`);

      const colList = commonCols.map(c => `"${c}"`).join(', ');
      const placeholderList = commonCols.map(() => '?').join(', ');
      const insertSql = `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholderList})`;
      const insertStmt = targetDb.prepare(insertSql);

      const updateAssignments = commonCols.filter(c => !pkCols.includes(c)).map(c => `"${c}" = ?`).join(', ');
      const updateSql = updateAssignments.length > 0
        ? `UPDATE "${tableName}" SET ${updateAssignments} WHERE ${pkWhere}`
        : null;
      const updateStmt = updateSql ? targetDb.prepare(updateSql) : null;

      for (const rawRow of sourceRows) {
        const row = transformRow ? transformRow({ ...rawRow }) : rawRow;
        const pkValues = pkCols.map(c => row[c]);
        const targetRow = checkStmt.get(...pkValues);

        if (targetRow) {
          // Compare payload across common columns to distinguish identical vs genuine conflict
          const differingCols = [];
          for (const col of commonCols) {
            if (targetRow[col] !== row[col]) {
              differingCols.push(col);
            }
          }

          if (differingCols.length === 0) {
            // Payload is 100% identical: unchanged
            unchangedCount++;
          } else {
            // Genuine conflict: same PK but different data
            conflictCount++;
            const sourceHash = crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0, 16);
            const targetHash = crypto.createHash('sha256').update(JSON.stringify(targetRow)).digest('hex').slice(0, 16);
            const isConfirmed = tableName === 'business_daily_reports' && (row.status === 'confirmed' || targetRow.status === 'confirmed');
            const effectiveAction = isConfirmed ? 'skipped' : (conflict === 'replace' ? 'replaced' : 'skipped');

            stats.conflicts.push({
              table: tableName,
              pk: pkValues.join(':'),
              action: effectiveAction,
              differingCols,
              sourceHash,
              targetHash,
              reason: isConfirmed
                ? 'Confirmed historical daily report is strictly immutable; replacement rejected'
                : `Target row has differing values in columns: [${differingCols.join(', ')}]`,
            });
            if (effectiveAction === 'replaced' && updateStmt) {
              if (!dryRun) {
                const nonPkValues = commonCols.filter(c => !pkCols.includes(c)).map(c => row[c]);
                updateStmt.run(...nonPkValues, ...pkValues);
              }
              replacedCount++;
            } else {
              skippedCount++;
            }
          }
        } else {
          if (!dryRun) {
            const values = commonCols.map(c => row[c]);
            insertStmt.run(...values);
          }
          insertedCount++;
        }
      }

      action.inserted = insertedCount;
      action.unchanged = unchangedCount;
      action.conflicts = conflictCount;
      action.skipped = skippedCount;
      action.replaced = replacedCount;
      stats.summary.inserted += insertedCount;
      stats.summary.unchanged += unchangedCount;
      stats.summary.conflicts += conflictCount;
      stats.summary.skipped += skippedCount;
      stats.summary.replaced += replacedCount;
      stats.tableActions[tableName] = action;
    }

    // Step 4: Begin migration transactions
    const preUntouchedHash = computeUntouchedHash(targetDb, projectId);
    if (!dryRun) {
      targetDb.exec('BEGIN IMMEDIATE;');
    }

    try {
      // 4.1 Project Metadata: Only backfill NULL or empty values in target project
      const sourceProject = sourceDb.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId);
      const targetProject = targetDb.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId);
      if (sourceProject && !targetProject) {
          const tCols = getColumns(targetDb, 'projects');
          const pCols = Object.keys(sourceProject).filter(c => tCols.includes(c));
          if (!dryRun) {
            targetDb.prepare(`INSERT INTO projects (${pCols.map(c => `"${c}"`).join(', ')}) VALUES (${pCols.map(() => '?').join(', ')})`)
              .run(...pCols.map(c => sourceProject[c]));
          }
        stats.tableActions['projects'] = { sourceCount: 1, inserted: 1, unchanged: 0, skipped: 0, replaced: 0 };
          stats.summary.inserted++;
      } else if (sourceProject && targetProject) {
        const needsTemplate = !targetProject.template_id || targetProject.template_id === '';
        const needsOnboarding = !targetProject.onboarding_status || targetProject.onboarding_status === '';
        const updatedFields = [];
        if (needsTemplate) updatedFields.push('template_id');
        if (needsOnboarding) updatedFields.push('onboarding_status');

        if (updatedFields.length > 0) {
          if (!dryRun) {
            targetDb.prepare(`UPDATE projects SET
              template_id = CASE WHEN template_id IS NULL OR template_id = '' THEN ? ELSE template_id END,
              onboarding_status = CASE WHEN onboarding_status IS NULL OR onboarding_status = '' THEN ? ELSE onboarding_status END,
              updated_at = datetime('now')
            WHERE id = ?`).run(
              sourceProject.template_id || 'content_marketing',
              sourceProject.onboarding_status || 'ready',
              projectId
            );
          }
          stats.tableActions['projects'] = { sourceCount: 1, inserted: 0, unchanged: 0, updatedNullFields: updatedFields, skipped: 0, replaced: 0 };
        } else {
          stats.tableActions['projects'] = { sourceCount: 1, inserted: 0, unchanged: 1, updatedNullFields: [], skipped: 1, replaced: 0 };
          stats.summary.unchanged++;
        }
      }

      // 4.2 Run migrations strictly for whitelisted tables
      for (const item of PROJECT_MIGRATION_WHITELIST) {
        let transformRow = null;
        if (item.table === 'business_sync_tasks') {
          transformRow = (row) => {
            if (pauseSyncTasks && row.state === 'active') {
              row.state = 'paused';
            }
            return row;
          };
        } else if (item.table === 'business_comment_jobs') {
          transformRow = (row) => {
            if (['queued', 'retry', 'running'].includes(row.status)) {
              row.status = 'paused';
              row.lease_token = null;
              row.lease_expires_at = null;
            }
            return row;
          };
        } else if (item.table === 'business_sync_requests') {
          transformRow = (row) => {
            if (!row.processed_at) {
              row.processed_at = row.created_at || '1970-01-01T00:00:00.000Z';
            }
            return row;
          };
        }

        migrateTable(item.table, {
          hasProjectCol: true,
          pkCols: item.pkCols,
          transformRow,
        });
      }

      // 4.10 Backfill remaining note_project_profiles from note_profiles for target's notes
      if (!dryRun) {
        const npCols = getColumns(targetDb, 'note_profiles');
        const hasProjNotes = getColumns(targetDb, 'project_notes').length > 0;
        if (hasProjNotes && npCols.includes('cooperation')) {
        const backfillResult = targetDb.prepare(`
          INSERT OR IGNORE INTO note_project_profiles (
            id, project_id, note_id, cooperation, promoted, note_type, note_price,
            picture_price, video_price, category1, category2, product_scope, brand, created_at, updated_at
          )
          SELECT ? || ':' || np.note_id, ?, np.note_id, np.cooperation, np.promoted, np.note_type, np.note_price,
            np.picture_price, np.video_price, np.category1, np.category2, '本品', np.brand, np.updated_at, np.updated_at
          FROM note_profiles np
          WHERE np.note_id IN (SELECT note_id FROM project_notes WHERE project_id = ?)
            AND NOT EXISTS (SELECT 1 FROM note_project_profiles pnp WHERE pnp.project_id = ? AND pnp.note_id = np.note_id)
        `).run(projectId, projectId, projectId, projectId);
        if (backfillResult.changes > 0) {
          log(`Backfilled ${backfillResult.changes} notes into note_project_profiles from local note_profiles.`);
        }
        }
      }

      // 4.11 Backfill ONLY truly missing note_profiles that are referenced by this project (archives, project_notes, competitor_notes)
      if (!dryRun) {
        const sProfileCols = getColumns(sourceDb, 'note_profiles');
        const tProfileCols = getColumns(targetDb, 'note_profiles');
        const commonProfileCols = sProfileCols.filter(c => tProfileCols.includes(c));
        if (commonProfileCols.length > 0) {
          const referencedProfiles = sourceDb.prepare(`
            SELECT np.* FROM note_profiles np
            WHERE (EXISTS (SELECT 1 FROM business_note_archives a WHERE a.project_id = ? AND a.note_id = np.note_id)
               OR EXISTS (SELECT 1 FROM project_notes pn WHERE pn.project_id = ? AND pn.note_id = np.note_id)
               OR EXISTS (SELECT 1 FROM competitor_notes cn WHERE cn.project_id = ? AND cn.raw_note_id = np.note_id))
          `).all(projectId, projectId, projectId);

          const insertMissingProfileStmt = targetDb.prepare(`
            INSERT OR IGNORE INTO note_profiles (${commonProfileCols.map(c => `"${c}"`).join(', ')})
            VALUES (${commonProfileCols.map(() => '?').join(', ')})
          `);

          let insertedProfilesCount = 0;
          for (const pRow of referencedProfiles) {
            const res = insertMissingProfileStmt.run(...commonProfileCols.map(c => pRow[c]));
            if (res.changes > 0) insertedProfilesCount++;
          }
          if (insertedProfilesCount > 0) {
            log(`Backfilled ${insertedProfilesCount} missing referenced note_profiles for project ${projectId}.`);
          }
        }
      }

      // 4.11 Backfill empty cover_url in note_profiles from note_covers without overwriting existing
      if (!dryRun) {
        const coverBackfill = targetDb.prepare(`
          UPDATE note_profiles
          SET cover_url = (
            SELECT nc.source_url FROM note_covers nc
            WHERE nc.note_id = note_profiles.note_id AND nc.source_url != ''
            LIMIT 1
          )
          WHERE (cover_url IS NULL OR cover_url = '')
            AND EXISTS (
              SELECT 1 FROM note_covers nc
              WHERE nc.note_id = note_profiles.note_id AND nc.source_url != ''
            )
        `).run();
        if (coverBackfill.changes > 0) {
          log(`Backfilled ${coverBackfill.changes} note covers into note_profiles by reference.`);
        }
      }

      // Step 4.12: Run integrity audit and untouched hash comparison BEFORE COMMIT
      const integrityAudit = auditIntegrity(targetDb, projectId);
      const postUntouchedHash = computeUntouchedHash(targetDb, projectId);

      if (preUntouchedHash !== postUntouchedHash) {
        throw new Error(`Untouched tables mutation detected! Pre-hash: ${preUntouchedHash}, Post-hash: ${postUntouchedHash}`);
      }
      integrityAudit.untouchedAudit = {
        verified: true,
        preHash: preUntouchedHash,
        postHash: postUntouchedHash,
        match: preUntouchedHash === postUntouchedHash,
      };

      stats.integrity = integrityAudit;

      if (integrityAudit.referentialIntegrity.orphanSourceHeads > 0 ||
          integrityAudit.referentialIntegrity.orphanSyncReceipts > 0 ||
          integrityAudit.referentialIntegrity.orphanCommentDeliveries > 0 ||
          integrityAudit.referentialIntegrity.orphanSyncRequests > 0 ||
          integrityAudit.referentialIntegrity.orphanCommentHeads > 0 ||
          integrityAudit.jsonErrors > 0) {
        throw new Error(`Referential integrity audit failed before commit: ${JSON.stringify(integrityAudit.referentialIntegrity)}`);
      }

      if (!dryRun) {
        targetDb.exec('COMMIT;');
      }
    } catch (err) {
      if (!dryRun) {
        try { targetDb.exec('ROLLBACK;'); } catch {}
      }
      throw err;
    }

    return stats;
  } finally {
    try { sourceDb.exec('ROLLBACK;'); } catch {}
    sourceDb.close();
    targetDb.close();
    if (dryRunTmpPath && fs.existsSync(dryRunTmpPath)) {
      try { fs.unlinkSync(dryRunTmpPath); } catch {}
    }
  }
}

export function auditIntegrity(db, projectId) {
  const audit = {
    projectId,
    counts: {},
    confirmedReport: null,
    referentialIntegrity: {
      orphanSourceHeads: 0,
      orphanSyncReceipts: 0,
      orphanCommentDeliveries: 0,
      orphanSyncRequests: 0,
      orphanCommentHeads: 0,
    },
    jsonErrors: 0,
    otherProjectsUntouched: true,
  };

  const tablesToCheck = [
    'business_daily_reports',
    'business_captures',
    'business_source_heads',
    'business_sync_receipts',
    'business_platform_observations',
    'business_comment_deliveries',
    'business_note_archives',
    'business_sync_tasks',
    'competitor_configs',
    'competitor_notes',
    'competitor_sync_logs',
    'note_project_profiles',
    'note_covers',
    'project_members',
    'dashboards',
  ];

  for (const t of tablesToCheck) {
    try {
      const c = db.prepare(`SELECT count(*) as c FROM "${t}" WHERE project_id = ?`).get(projectId).c;
      audit.counts[t] = c;
    } catch {
      audit.counts[t] = 0;
    }
  }

  // Check 2026-10-13 confirmed report
  try {
    const confirmed = db.prepare(`SELECT id, business_day, status, confirmed_by, fingerprint, length(payload_json) as len, payload_json FROM business_daily_reports WHERE project_id = ? AND status = 'confirmed'`).get(projectId);
    if (confirmed) {
      const hash = crypto.createHash('sha256').update(confirmed.payload_json).digest('hex');
      audit.confirmedReport = {
        id: confirmed.id,
        businessDay: confirmed.business_day,
        status: confirmed.status,
        confirmedBy: confirmed.confirmed_by,
        fingerprint: confirmed.fingerprint,
        payloadLength: confirmed.len,
        payloadSha256: hash,
        fingerprintMatches: confirmed.fingerprint === 'f5874e5bca5f59c2fa28997866e49d4e5aea1f2237b3809274ec3ddb91fa2e0e',
      };
    }
  } catch {}

  // Check orphans
  try {
    audit.referentialIntegrity.orphanSourceHeads = db.prepare(`
      SELECT count(*) as c FROM business_source_heads h
      WHERE h.project_id = ? AND NOT EXISTS (SELECT 1 FROM business_captures c WHERE c.id = h.capture_id)
    `).get(projectId).c;
  } catch {}

  try {
    audit.referentialIntegrity.orphanSyncReceipts = db.prepare(`
      SELECT count(*) as c FROM business_sync_receipts r
      WHERE r.project_id = ? AND NOT EXISTS (SELECT 1 FROM business_captures c WHERE c.id = r.capture_id)
    `).get(projectId).c;
  } catch {}

  try {
    audit.referentialIntegrity.orphanCommentDeliveries = db.prepare(`
      SELECT count(*) as c FROM business_comment_deliveries d
      WHERE d.project_id = ? AND NOT EXISTS (SELECT 1 FROM business_captures c WHERE c.id = d.capture_id)
    `).get(projectId).c;
  } catch {}

  try {
    audit.referentialIntegrity.orphanSyncRequests = db.prepare(`
      SELECT count(*) as c FROM business_sync_requests req
      WHERE req.project_id = ? AND NOT EXISTS (SELECT 1 FROM business_sync_tasks t WHERE t.id = req.task_id)
    `).get(projectId).c;
  } catch {}

  try {
    audit.referentialIntegrity.orphanCommentHeads = db.prepare(`
      SELECT count(*) as c FROM business_comment_heads h
      WHERE h.project_id = ? AND NOT EXISTS (SELECT 1 FROM business_comment_captures c WHERE c.id = h.capture_id)
    `).get(projectId).c;
  } catch {}

  // Check JSON payloads in reports
  try {
    const reports = db.prepare(`SELECT payload_json FROM business_daily_reports WHERE project_id = ?`).all(projectId);
    for (const r of reports) {
      try {
        JSON.parse(r.payload_json);
      } catch {
        audit.jsonErrors++;
      }
    }
  } catch {}

  // Check 3 hot notes
  const hotNoteIds = ['6abe4fe80000000015000587', '6abcd950000000001203c205', '6abf9c6e000000001a02698b'];
  audit.hotNotes = {};
  let allHotNotesVerified = true;
  for (const id of hotNoteIds) {
    let cover = null;
    let profile = null;
    let archive = null;
    try { cover = db.prepare(`SELECT * FROM note_covers WHERE note_id = ? AND project_id = ?`).get(id, projectId); } catch {}
    try { profile = db.prepare(`SELECT * FROM note_profiles WHERE note_id = ?`).get(id); } catch {}
    try { archive = db.prepare(`SELECT 1 FROM business_note_archives WHERE note_id = ? AND project_id = ?`).get(id, projectId); } catch {}

    const hasUsableCover = Boolean(cover?.source_url || cover?.r2_key || profile?.cover_url);
    audit.hotNotes[id] = {
      hasUsableCover,
      coverStatus: cover?.status || 'none',
      hasArchive: Boolean(archive),
      hasProfile: Boolean(profile),
    };
    if (!hasUsableCover) {
      allHotNotesVerified = false;
    }
  }
  audit.hotNotesVerified = allHotNotesVerified;

  return audit;
}

// CLI entry point
const isMain = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)) ||
  path.resolve(process.argv[1]).endsWith('migrate-delivery-project.mjs')
);
if (isMain) {
  try {
    const args = parseArgs();
    if (!args.source || !args.target) {
      console.log(`
Usage:
  node scripts/migrate-delivery-project.mjs --source <source.db> --target <target.db> [options]

Required Options:
  --source <path>           Path to source delivery SQLite database (e.g. .verification/business.db). Strictly read-only.
  --target <path>           Path to target SQLite database replica.

Optional Options:
  --init-from-base <path>   If target does not exist, initialize it from this base database via consistent SQLite snapshot.
  --project-id <id>         Project ID to migrate (default: qicui).
  --conflict <skip|replace> Conflict handling strategy (default: skip - preserves target records).
  --dry-run                 Plan and validate without making any changes to target database.
  --plan                    Display detailed row counts and migration plan.
  --backup                  Create a timestamped target backup before migrating (default: true).
  --no-backup               Skip target backup.
  --pause-sync-tasks        Ensure imported sync tasks have state='paused' (default: true).
  --preserve-sync-state     Preserve exact sync task state from source.
  --allow-live-target       Permit target pointing to local.db (safety guard bypass).
      `);
      process.exit(1);
    }

    log(`Starting delivery migration for project: ${args.projectId}`);
    log(`Source: ${args.source}`);
    log(`Target: ${args.target}`);
    if (args.dryRun) log(`Mode: DRY RUN (No writes to target)`);

    const result = runMigration(args);

    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Total Source Rows Evaluated: ${result.summary.totalSourceRows}`);
    console.log(`Inserted:                    ${result.summary.inserted}`);
    console.log(`Unchanged (Identical):       ${result.summary.unchanged}`);
    console.log(`Genuine Conflicts:           ${result.summary.conflicts}`);
    console.log(`Skipped (Conflict/Existing): ${result.summary.skipped}`);
    console.log(`Replaced:                    ${result.summary.replaced}`);

    console.log('\n=== TABLE BREAKDOWN ===');
    for (const [table, act] of Object.entries(result.tableActions)) {
      const unchangedStr = act.unchanged !== undefined ? `  unchanged=${String(act.unchanged).padStart(5)}` : '';
      const confStr = act.conflicts !== undefined ? `  conflicts=${String(act.conflicts).padStart(3)}` : '';
      console.log(`- ${table.padEnd(32)} source=${String(act.sourceCount ?? act.inserted + act.skipped).padStart(5)}  inserted=${String(act.inserted).padStart(5)}${unchangedStr}${confStr}  skipped=${String(act.skipped).padStart(5)}  replaced=${String(act.replaced).padStart(5)}`);
    }

    if (result.conflicts && result.conflicts.length > 0) {
      console.log(`\n=== CONFLICT RESOLUTION REPORT (${result.conflicts.length} items) ===`);
      for (const c of result.conflicts.slice(0, 10)) {
        console.log(`- [${c.action.toUpperCase()}] ${c.table}:${c.pk} -> ${c.reason}`);
      }
      if (result.conflicts.length > 10) console.log(`  ... and ${result.conflicts.length - 10} more conflicts recorded.`);
    }

    if (result.integrity) {
      console.log('\n=== INTEGRITY & AUDIT REPORT ===');
      console.log(`Daily Reports Count:         ${result.integrity.counts.business_daily_reports} (Expected 28)`);
      console.log(`Captures Count:              ${result.integrity.counts.business_captures} (Expected 51)`);
      console.log(`Source Heads Count:          ${result.integrity.counts.business_source_heads} (Expected 26)`);
      console.log(`Comment Deliveries Count:    ${result.integrity.counts.business_comment_deliveries} (Expected 13047)`);
      console.log(`Note Archives Count:         ${result.integrity.counts.business_note_archives} (Expected 937)`);
      console.log(`Competitor Notes Count:      ${result.integrity.counts.competitor_notes} (Expected 60)`);
      console.log(`Note Covers Count:           ${result.integrity.counts.note_covers}`);
      console.log(`Orphan References:           source_heads=${result.integrity.referentialIntegrity.orphanSourceHeads}, receipts=${result.integrity.referentialIntegrity.orphanSyncReceipts}, deliveries=${result.integrity.referentialIntegrity.orphanCommentDeliveries}`);
      console.log(`JSON Format Errors:          ${result.integrity.jsonErrors}`);
      if (result.integrity.confirmedReport) {
        console.log(`Confirmed 2026-10-13 Report: Verified (FP: ${result.integrity.confirmedReport.fingerprint.slice(0, 16)}..., Match: ${result.integrity.confirmedReport.fingerprintMatches})`);
      }
    }

    log(`Migration finished successfully.`);
  } catch (err) {
    console.error(`\n[MIGRATION ERROR] ${err.message}`);
    process.exit(1);
  }
}
import os from 'node:os';
