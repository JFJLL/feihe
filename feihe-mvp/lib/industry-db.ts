import { db } from './db';
import type {
  IndustryProjectConfig,
  IndustrySnapshot,
  IndustryNoteItem,
  IndustryTaskRecord,
  IndustryProviderType,
  IndustrySyncStatus,
} from './industry-types';

let schemaInitialized = false;

/**
 * Idempotently initializes dedicated industry tables without touching db.ts or schema.ts.
 */
export async function ensureIndustrySchema(): Promise<void> {
  if (schemaInitialized) return;
  const d = db();
  await d.batch([
    d.prepare(`CREATE TABLE IF NOT EXISTS industry_project_configs (
      project_id TEXT PRIMARY KEY,
      spu TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      brand TEXT NOT NULL DEFAULT '',
      keywords_json TEXT NOT NULL DEFAULT '[]',
      competitor_brands_json TEXT NOT NULL DEFAULT '[]',
      provider TEXT NOT NULL DEFAULT 'pgy',
      daily_sync_enabled INTEGER NOT NULL DEFAULT 1,
      last_synced_at TEXT,
      last_status TEXT NOT NULL DEFAULT 'idle',
      last_error TEXT,
      updated_at TEXT NOT NULL
    )`),
    d.prepare(`CREATE TABLE IF NOT EXISTS industry_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      task_type TEXT NOT NULL DEFAULT 'daily_monitor',
      date_key TEXT NOT NULL,
      spu TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      provider TEXT NOT NULL DEFAULT 'pgy',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      error_message TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    )`),
    d.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_industry_tasks_unique
      ON industry_tasks(project_id, date_key, spu)`),
    d.prepare(`CREATE TABLE IF NOT EXISTS industry_snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      spu TEXT NOT NULL,
      date_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ready',
      invalidation_reason TEXT,
      provenance_json TEXT NOT NULL DEFAULT '{}',
      summary_json TEXT NOT NULL DEFAULT '{}',
      search_topics_json TEXT NOT NULL DEFAULT '[]',
      competitor_comparison_json TEXT NOT NULL DEFAULT '[]',
      recent_notes_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    d.prepare(`CREATE INDEX IF NOT EXISTS idx_industry_snapshots_lookup
      ON industry_snapshots(project_id, status, created_at DESC)`),
    d.prepare(`CREATE TABLE IF NOT EXISTS industry_notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      spu TEXT NOT NULL,
      note_id TEXT NOT NULL,
      title TEXT NOT NULL,
      blogger_name TEXT,
      cover_url TEXT,
      note_url TEXT NOT NULL,
      pub_time TEXT,
      liked_count INTEGER,
      comment_count INTEGER,
      collected_count INTEGER,
      brand TEXT NOT NULL DEFAULT '未识别品牌',
      is_our_brand INTEGER NOT NULL DEFAULT 0,
      nature TEXT NOT NULL DEFAULT 'unknown',
      source_provider TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    )`),
    d.prepare(`CREATE INDEX IF NOT EXISTS idx_industry_notes_project
      ON industry_notes(project_id, spu, fetched_at DESC)`),
  ]);
  schemaInitialized = true;
}

export async function getIndustryConfig(projectId: string): Promise<IndustryProjectConfig | null> {
  await ensureIndustrySchema();
  const d = db();
  const row = await d
    .prepare('SELECT * FROM industry_project_configs WHERE project_id = ?')
    .bind(projectId)
    .first<Record<string, unknown>>();
  if (!row) return null;

  let keywords: string[] = [];
  let competitorBrands: string[] = [];
  try { keywords = JSON.parse(String(row.keywords_json || '[]')); } catch {}
  try { competitorBrands = JSON.parse(String(row.competitor_brands_json || '[]')); } catch {}

  return {
    projectId: String(row.project_id || projectId),
    spu: String(row.spu || ''),
    category: String(row.category || ''),
    brand: String(row.brand || ''),
    keywords,
    competitorBrands,
    provider: (row.provider === 'ipscg' ? 'ipscg' : 'pgy') as IndustryProviderType,
    dailySyncEnabled: Boolean(row.daily_sync_enabled),
    lastSyncedAt: (row.last_synced_at as string) || null,
    lastStatus: (row.last_status as IndustrySyncStatus) || 'idle',
    lastError: (row.last_error as string) || null,
    updatedAt: String(row.updated_at || ''),
  };
}

export async function saveIndustryConfig(
  projectId: string,
  config: Partial<IndustryProjectConfig>
): Promise<IndustryProjectConfig> {
  await ensureIndustrySchema();
  const existing = await getIndustryConfig(projectId);
  const now = new Date().toISOString();
  const merged: IndustryProjectConfig = {
    projectId,
    spu: config.spu !== undefined ? config.spu : existing?.spu || '',
    category: config.category !== undefined ? config.category : existing?.category || '',
    brand: config.brand !== undefined ? config.brand : existing?.brand || '',
    keywords: config.keywords !== undefined ? config.keywords : existing?.keywords || [],
    competitorBrands: config.competitorBrands !== undefined ? config.competitorBrands : existing?.competitorBrands || [],
    provider: config.provider !== undefined ? config.provider : existing?.provider || 'pgy',
    dailySyncEnabled: config.dailySyncEnabled !== undefined ? config.dailySyncEnabled : existing?.dailySyncEnabled ?? true,
    lastSyncedAt: config.lastSyncedAt !== undefined ? config.lastSyncedAt : existing?.lastSyncedAt || null,
    lastStatus: config.lastStatus !== undefined ? config.lastStatus : existing?.lastStatus || 'idle',
    lastError: config.lastError !== undefined ? config.lastError : existing?.lastError || null,
    updatedAt: now,
  };

  const d = db();
  await d.prepare(`
    INSERT INTO industry_project_configs (
      project_id, spu, category, brand, keywords_json, competitor_brands_json,
      provider, daily_sync_enabled, last_synced_at, last_status, last_error, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      spu = excluded.spu,
      category = excluded.category,
      brand = excluded.brand,
      keywords_json = excluded.keywords_json,
      competitor_brands_json = excluded.competitor_brands_json,
      provider = excluded.provider,
      daily_sync_enabled = excluded.daily_sync_enabled,
      last_synced_at = excluded.last_synced_at,
      last_status = excluded.last_status,
      last_error = excluded.last_error,
      updated_at = excluded.updated_at
  `).bind(
    merged.projectId,
    merged.spu,
    merged.category,
    merged.brand,
    JSON.stringify(merged.keywords),
    JSON.stringify(merged.competitorBrands),
    merged.provider,
    merged.dailySyncEnabled ? 1 : 0,
    merged.lastSyncedAt || null,
    merged.lastStatus,
    merged.lastError || null,
    merged.updatedAt
  ).run();

  return merged;
}

export async function getLatestIndustrySnapshot(
  projectId: string,
  currentSpu?: string
): Promise<IndustrySnapshot | null> {
  // If currentSpu is missing/empty, do NOT expose old SPU snapshot
  if (!currentSpu || !currentSpu.trim()) {
    return null;
  }

  await ensureIndustrySchema();
  const d = db();
  const row = await d.prepare(`
    SELECT * FROM industry_snapshots
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(projectId).first<Record<string, unknown>>();

  if (!row) return null;

  let provenance: IndustrySnapshot['provenance'] = {} as unknown as IndustrySnapshot['provenance'];
  let summary: IndustrySnapshot['summary'] = {} as unknown as IndustrySnapshot['summary'];
  let searchTopics: IndustrySnapshot['searchTopics'] = [];
  let competitorComparison: IndustrySnapshot['competitorComparison'] = [];
  let recentNotes: IndustrySnapshot['recentNotes'] = [];

  try { provenance = JSON.parse(String(row.provenance_json || '{}')); } catch {}
  try { summary = JSON.parse(String(row.summary_json || '{}')); } catch {}
  try { searchTopics = JSON.parse(String(row.search_topics_json || '[]')); } catch {}
  try { competitorComparison = JSON.parse(String(row.competitor_comparison_json || '[]')); } catch {}
  try { recentNotes = JSON.parse(String(row.recent_notes_json || '[]')); } catch {}

  const snapshot: IndustrySnapshot = {
    id: String(row.id),
    projectId: String(row.project_id),
    spu: String(row.spu),
    dateKey: String(row.date_key),
    status: (row.status as IndustrySnapshot['status']) || 'ready',
    invalidationReason: (row.invalidation_reason as string) || null,
    provenance,
    summary,
    searchTopics,
    competitorComparison,
    recentNotes,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };

  // Dynamic SPU change check: If project's current SPU differs from the snapshot SPU, mark invalidated
  if (snapshot.spu && currentSpu.trim() !== snapshot.spu.trim()) {
    if (snapshot.status !== 'invalidated') {
      await invalidateIndustrySnapshot(
        projectId,
        snapshot.spu,
        currentSpu.trim(),
        `SPU 变更：由「${snapshot.spu}」切换为「${currentSpu.trim()}」，旧分析结果已废弃`
      );
      snapshot.status = 'invalidated';
      snapshot.invalidationReason = `SPU 变更：由「${snapshot.spu}」切换为「${currentSpu.trim()}」`;
      snapshot.provenance.invalidatedAt = new Date().toISOString();
      snapshot.provenance.previousSpu = snapshot.spu;
      snapshot.provenance.spu = currentSpu.trim();
    }
  }

  return snapshot;
}

export async function saveIndustrySnapshot(snapshot: IndustrySnapshot): Promise<void> {
  await ensureIndustrySchema();
  const d = db();
  await d.prepare(`
    INSERT INTO industry_snapshots (
      id, project_id, spu, date_key, status, invalidation_reason,
      provenance_json, summary_json, search_topics_json,
      competitor_comparison_json, recent_notes_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      spu = excluded.spu,
      status = excluded.status,
      invalidation_reason = excluded.invalidation_reason,
      provenance_json = excluded.provenance_json,
      summary_json = excluded.summary_json,
      search_topics_json = excluded.search_topics_json,
      competitor_comparison_json = excluded.competitor_comparison_json,
      recent_notes_json = excluded.recent_notes_json,
      updated_at = excluded.updated_at
  `).bind(
    snapshot.id,
    snapshot.projectId,
    snapshot.spu,
    snapshot.dateKey,
    snapshot.status,
    snapshot.invalidationReason || null,
    JSON.stringify(snapshot.provenance),
    JSON.stringify(snapshot.summary),
    JSON.stringify(snapshot.searchTopics),
    JSON.stringify(snapshot.competitorComparison),
    JSON.stringify(snapshot.recentNotes),
    snapshot.createdAt,
    snapshot.updatedAt
  ).run();
}

export async function invalidateIndustrySnapshot(
  projectId: string,
  oldSpu: string,
  newSpu: string,
  reason: string
): Promise<void> {
  await ensureIndustrySchema();
  const d = db();
  const now = new Date().toISOString();
  await d.prepare(`
    UPDATE industry_snapshots
    SET status = 'invalidated',
        invalidation_reason = ?,
        updated_at = ?
    WHERE project_id = ? AND status != 'invalidated'
  `).bind(
    `SPU 变更 (旧: ${oldSpu} -> 新: ${newSpu}): ${reason}`,
    now,
    projectId
  ).run();
}

export async function saveIndustryNotes(
  projectId: string,
  spu: string,
  notes: IndustryNoteItem[]
): Promise<void> {
  await ensureIndustrySchema();
  if (notes.length === 0) return;
  const d = db();
  const stmts = notes.map((n) =>
    d.prepare(`
      INSERT INTO industry_notes (
        id, project_id, spu, note_id, title, blogger_name, cover_url,
        note_url, pub_time, liked_count, comment_count, collected_count,
        brand, is_our_brand, nature, source_provider, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        spu = excluded.spu,
        title = excluded.title,
        blogger_name = excluded.blogger_name,
        cover_url = excluded.cover_url,
        note_url = excluded.note_url,
        pub_time = excluded.pub_time,
        liked_count = excluded.liked_count,
        comment_count = excluded.comment_count,
        collected_count = excluded.collected_count,
        brand = excluded.brand,
        is_our_brand = excluded.is_our_brand,
        nature = excluded.nature,
        fetched_at = excluded.fetched_at
    `).bind(
      n.id,
      projectId,
      spu,
      n.noteId,
      n.title,
      n.bloggerName ?? null,
      n.coverUrl ?? null,
      n.noteUrl,
      n.pubTime ?? null,
      n.likedCount ?? null,
      n.commentCount ?? null,
      n.collectedCount ?? null,
      n.brand || '未识别品牌',
      n.isOurBrand ? 1 : 0,
      n.nature || 'unknown',
      n.sourceProvider,
      n.fetchedAt
    )
  );
  await d.batch(stmts);
}

export async function getIndustryTaskForDate(
  projectId: string,
  dateKey: string,
  spu: string
): Promise<IndustryTaskRecord | null> {
  await ensureIndustrySchema();
  const d = db();
  const row = await d.prepare(`
    SELECT * FROM industry_tasks
    WHERE project_id = ? AND date_key = ? AND spu = ?
  `).bind(projectId, dateKey, spu).first<Record<string, unknown>>();

  if (!row) return null;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    taskType: (row.task_type as IndustryTaskRecord['taskType']) || 'daily_monitor',
    dateKey: String(row.date_key),
    spu: String(row.spu),
    status: (row.status as IndustryTaskRecord['status']) || 'pending',
    provider: (row.provider as IndustryProviderType) || 'pgy',
    attempts: Number(row.attempts || 0),
    maxAttempts: Number(row.max_attempts || 3),
    errorMessage: (row.error_message as string) || null,
    createdAt: String(row.created_at),
    startedAt: (row.started_at as string) || null,
    completedAt: (row.completed_at as string) || null,
  };
}

/**
 * Atomically claims task lease to prevent concurrent double execution:
 * 1. Inserts placeholder task if none exists (INSERT OR IGNORE).
 * 2. Conditionally transitions status to 'running' where status IN ('pending', 'failed') or stalled running (>15m).
 * Returns true if claimed successfully, false if already running or completed.
 */
export async function claimIndustryTaskAtomic(params: {
  taskId: string;
  projectId: string;
  dateKey: string;
  spu: string;
  provider: IndustryProviderType;
  maxAttempts?: number;
}): Promise<{ claimed: boolean; task?: IndustryTaskRecord; reason?: string }> {
  await ensureIndustrySchema();
  const d = db();
  const now = new Date().toISOString();
  const maxAttempts = params.maxAttempts || 3;

  // 1. Ensure task row exists
  await d.prepare(`
    INSERT OR IGNORE INTO industry_tasks (
      id, project_id, task_type, date_key, spu, status, provider,
      attempts, max_attempts, created_at
    ) VALUES (?, ?, 'daily_monitor', ?, ?, 'pending', ?, 0, ?, ?)
  `).bind(
    params.taskId,
    params.projectId,
    params.dateKey,
    params.spu,
    params.provider,
    maxAttempts,
    now
  ).run();

  // 2. Query current state to check completed or budget limit
  const current = await getIndustryTaskForDate(params.projectId, params.dateKey, params.spu);
  if (!current) {
    return { claimed: false, reason: '未能创建任务记录' };
  }

  if (current.status === 'completed') {
    return { claimed: false, task: current, reason: '今日任务已完成，跳过重复调度' };
  }

  if (current.attempts >= maxAttempts) {
    return { claimed: false, task: current, reason: '任务已达最大重试次数上限' };
  }

  // 15-minute lease threshold for stalled jobs
  const stalledTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  // 3. Conditional atomic transition
  const claimedRow = await d.prepare(`
    UPDATE industry_tasks
    SET status = 'running',
        attempts = attempts + 1,
        started_at = ?,
        error_message = NULL
    WHERE project_id = ? AND date_key = ? AND spu = ?
      AND (
        status IN ('pending', 'failed')
        OR (status = 'running' AND (started_at IS NULL OR started_at < ?))
      )
      AND attempts < max_attempts
    RETURNING id
  `).bind(
    now,
    params.projectId,
    params.dateKey,
    params.spu,
    stalledTime
  ).first<{ id: string }>();

  const updatedTask = await getIndustryTaskForDate(params.projectId, params.dateKey, params.spu);
  const claimed = Boolean(claimedRow);

  if (!claimed) {
    return {
      claimed: false,
      task: updatedTask || current,
      reason: updatedTask?.status === 'running' ? '任务正在执行中，锁定防止重复' : '任务无法获取执行锁',
    };
  }

  return { claimed: true, task: updatedTask || undefined };
}

export async function createIndustryTask(
  task: Omit<IndustryTaskRecord, 'attempts'> & { attempts?: number }
): Promise<IndustryTaskRecord> {
  await ensureIndustrySchema();
  const d = db();
  const record: IndustryTaskRecord = {
    ...task,
    attempts: task.attempts || 0,
  };
  await d.prepare(`
    INSERT INTO industry_tasks (
      id, project_id, task_type, date_key, spu, status, provider,
      attempts, max_attempts, error_message, created_at, started_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, date_key, spu) DO UPDATE SET
      status = excluded.status,
      provider = excluded.provider,
      attempts = excluded.attempts,
      error_message = excluded.error_message,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at
  `).bind(
    record.id,
    record.projectId,
    record.taskType,
    record.dateKey,
    record.spu,
    record.status,
    record.provider,
    record.attempts,
    record.maxAttempts,
    record.errorMessage || null,
    record.createdAt,
    record.startedAt || null,
    record.completedAt || null
  ).run();
  return record;
}

export async function updateIndustryTask(
  taskId: string,
  patch: Partial<IndustryTaskRecord>
): Promise<void> {
  await ensureIndustrySchema();
  const d = db();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (patch.status !== undefined) {
    updates.push('status = ?');
    values.push(patch.status);
  }
  if (patch.attempts !== undefined) {
    updates.push('attempts = ?');
    values.push(patch.attempts);
  }
  if (patch.errorMessage !== undefined) {
    updates.push('error_message = ?');
    values.push(patch.errorMessage);
  }
  if (patch.startedAt !== undefined) {
    updates.push('started_at = ?');
    values.push(patch.startedAt);
  }
  if (patch.completedAt !== undefined) {
    updates.push('completed_at = ?');
    values.push(patch.completedAt);
  }

  if (updates.length === 0) return;
  values.push(taskId);
  await d.prepare(`UPDATE industry_tasks SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
}

export async function listIndustryTasks(
  projectId: string,
  limit = 10
): Promise<IndustryTaskRecord[]> {
  await ensureIndustrySchema();
  const d = db();
  const rows = await d.prepare(`
    SELECT * FROM industry_tasks
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(projectId, limit).all<Record<string, unknown>>();
  return (rows.results || []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    projectId: String(r.project_id),
    taskType: (r.task_type as IndustryTaskRecord['taskType']) || 'daily_monitor',
    dateKey: String(r.date_key),
    spu: String(r.spu),
    status: (r.status as IndustryTaskRecord['status']) || 'pending',
    provider: (r.provider as IndustryProviderType) || 'pgy',
    attempts: Number(r.attempts || 0),
    maxAttempts: Number(r.max_attempts || 3),
    errorMessage: (r.error_message as string) || null,
    createdAt: String(r.created_at),
    startedAt: (r.started_at as string) || null,
    completedAt: (r.completed_at as string) || null,
  }));
}
