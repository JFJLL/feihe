import { db } from '../db';
import { businessConfig, DailyError, ensureBusinessSchema } from '../business-daily/store';
import { calendarDay } from '../business-daily/adapter';
import type { SourceRole } from '../business-daily/types';

export type SyncSpec = {
  type: 'feishu_table' | 'feishu_document' | 'automation_platform' | 'competitor_ipscg'; sourceKey: string; sourceUrl: string;
  role?: SourceRole; sheetId?: string; range?: string; reportDay?: string; periodFrom?: string; periodTo?: string; year?: number; scopeLabel?: string;
  accountId?: string; platform?: 'juguang' | 'jzt' | 'taobao' | 'keyword' | 'lingxi'; entityIds?: string[]; dimension?: string;
  refreshDays?: number; attributionDelayDays?: number; primary?: boolean;
  taskId?: string; keywords?: string[]; from?: string; to?: string; maxPages?: number; pageSize?: number;
  overlapWindowDays?: number; rateLimitMs?: number; checkpoint?: any;
};
export type SyncTask = { id: string; project_id: string; source_key: string; name: string; state: string; spec_json: string; interval_minutes: number; next_run_at: string; last_success_at: string | null; business_through: string | null; last_error: string; retry_count: number; lease_token: string | null; lease_expires_at: string | null; version: number; last_run_id: string | null };
let ready: Promise<void> | null = null;
export async function ensureSyncSchema() {
  await ensureBusinessSchema();
  if (!ready) ready = db().batch([
    db().prepare(`CREATE TABLE IF NOT EXISTS business_sync_tasks(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,source_key TEXT NOT NULL,name TEXT NOT NULL,state TEXT NOT NULL,spec_json TEXT NOT NULL,interval_minutes INTEGER NOT NULL,next_run_at TEXT NOT NULL,last_success_at TEXT,business_through TEXT,last_error TEXT NOT NULL DEFAULT '',retry_count INTEGER NOT NULL DEFAULT 0,lease_token TEXT,lease_expires_at TEXT,version INTEGER NOT NULL DEFAULT 1,last_run_id TEXT,updated_at TEXT NOT NULL,UNIQUE(project_id,source_key))`),
    db().prepare(`CREATE INDEX IF NOT EXISTS idx_business_sync_due ON business_sync_tasks(state,next_run_at)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_sync_worker(id TEXT PRIMARY KEY,mode TEXT NOT NULL,last_seen_at TEXT NOT NULL)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_sync_requests(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,task_id TEXT NOT NULL,window_from TEXT,window_to TEXT,created_at TEXT NOT NULL,processed_at TEXT)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_platform_observations(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,source_key TEXT NOT NULL,account_id TEXT NOT NULL,business_day TEXT NOT NULL,natural_key_json TEXT NOT NULL,data_json TEXT NOT NULL,captured_at TEXT NOT NULL,run_id TEXT NOT NULL,UNIQUE(project_id,source_key,account_id,business_day,natural_key_json))`),
    db().prepare(`CREATE INDEX IF NOT EXISTS idx_business_platform_day ON business_platform_observations(project_id,source_key,business_day)`),
  ]).then(() => undefined).catch(error => { ready = null; throw error; });
  await ready;
  const columns = await db().prepare('PRAGMA table_info(business_sync_requests)').all<{ name: string }>();
  if (!columns.results.some(c => c.name === 'processed_at')) await db().prepare('ALTER TABLE business_sync_requests ADD COLUMN processed_at TEXT').run();
}
export function safeSyncError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/(["']?[\w-]*(?:cookie|authorization|token|secret|password|api[_-]?key)[\w-]*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\r\n,}]+)/gi, '$1[redacted]').replace(/https?:\/\/\S+/g, '[上游地址]').slice(0, 500);
}
export async function validateSyncSpec(projectId: string, spec: SyncSpec) {
  const allowed = new Set(['type','sourceKey','sourceUrl','role','sheetId','range','reportDay','periodFrom','periodTo','year','scopeLabel','accountId','platform','entityIds','dimension','refreshDays','attributionDelayDays','primary','taskId','keywords','from','to','maxPages','pageSize','overlapWindowDays','rateLimitMs','checkpoint']);
  if (Object.keys(spec).some(k => !allowed.has(k))) throw new DailyError('任务包含不支持的字段；凭据不能写入任务配置');
  const config = await businessConfig(projectId);
  const binding = config?.bindings.find(b => b.key === spec.sourceKey && b.url === spec.sourceUrl);
  if (!binding && (spec as any).type !== 'competitor_ipscg') throw new DailyError('任务来源必须明确绑定到本项目', 403);
  if (!['feishu_table','feishu_document','automation_platform','competitor_ipscg'].includes(spec.type)) throw new DailyError('任务类型无效');
  if (spec.type === 'feishu_document') {
    if (binding && binding.role !== 'document' || !Number.isInteger(spec.year) || spec.year! < 2000 || spec.year! > 2100) throw new DailyError('日报文档及业务年份未配置');
  }
  if (spec.type === 'feishu_table') {
    if (!binding || binding.role !== spec.role || !/^[a-zA-Z0-9_-]{1,100}$/.test(spec.sheetId || '')) throw new DailyError('工作表与用途未配置');
    if (spec.range && !/^[A-Z]+[1-9]\d*:[A-Z]+[1-9]\d*$/.test(spec.range)) throw new DailyError('读取范围无效');
  }
  if (spec.type === 'automation_platform') {
    const account = await db().prepare('SELECT external_id,metadata_json FROM source_accounts WHERE id=? AND project_id=?').bind(spec.accountId || '', projectId).first<{ external_id: string; metadata_json: string }>();
    if (!account || !/^[a-zA-Z0-9_-]{1,128}$/.test(account.external_id)) throw new DailyError('平台任务缺少本项目指定账号', 400);
    const meta = JSON.parse(account.metadata_json || '{}');
    if (!['juguang','jzt','taobao','keyword','lingxi'].includes(spec.platform || '') || meta.platform !== spec.platform) throw new DailyError('平台与指定账号不一致');
    if (['keyword','lingxi'].includes(spec.platform!)) throw new DailyError('该平台指标接口尚未验证，继续使用底表来源');
    const role = spec.platform === 'juguang' ? 'platform_ads' : 'platform_commerce';
    const host = spec.platform === 'juguang' ? 'ad.xiaohongshu.com' : spec.platform === 'jzt' ? 'jzt.jd.com' : 'adstar.alimama.com';
    if (!binding || binding.role !== role || new URL(spec.sourceUrl).hostname !== host) throw new DailyError('请选择当前平台独立的数据来源绑定');
    if (!spec.entityIds?.length && !['keyword','lingxi'].includes(spec.platform!)) throw new DailyError('项目任务、内容或计划ID必填');
    if (spec.entityIds?.some(id => !/^[a-zA-Z0-9_-]{1,128}$/.test(id))) throw new DailyError('平台实体ID无效');
    if (spec.primary) throw new DailyError('平台归因范围须先与底表核验，当前采集作为核对来源');
  }
  if (spec.refreshDays !== undefined && (!Number.isInteger(spec.refreshDays) || spec.refreshDays < 1 || spec.refreshDays > 90)) throw new DailyError('近期回刷范围须为1至90日');
  if (spec.scopeLabel !== undefined && (typeof spec.scopeLabel !== 'string' || spec.scopeLabel.length > 200)) throw new DailyError('统计区间说明无效（须为不超过200字的文本）');
    if ((spec as any).type === 'competitor_ipscg') {
    if (!spec.taskId || typeof spec.taskId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(spec.taskId)) throw new DailyError('竞品任务ID无效或未配置');
    if (!Array.isArray(spec.keywords) || !spec.keywords.length || spec.keywords.some(k => typeof k !== 'string' || !k.trim())) throw new DailyError('竞品监控必须配置非空关键词列表');
    if (spec.from && !calendarDay(spec.from)) throw new DailyError('竞品起始日期格式无效');
    if (spec.to && !calendarDay(spec.to)) throw new DailyError('竞品截止日期格式无效');
    if (spec.from && spec.to && spec.from > spec.to) throw new DailyError('竞品日期范围无效');
    if (spec.maxPages !== undefined && (!Number.isInteger(spec.maxPages) || spec.maxPages < 1 || spec.maxPages > 1000)) throw new DailyError('最大页数预算无效（须为1-1000）');
    if (spec.pageSize !== undefined && (!Number.isInteger(spec.pageSize) || spec.pageSize < 1 || spec.pageSize > 200)) throw new DailyError('每页条数无效（须为1-200）');
    if (spec.overlapWindowDays !== undefined && (!Number.isInteger(spec.overlapWindowDays) || spec.overlapWindowDays < 0 || spec.overlapWindowDays > 30)) throw new DailyError('重叠回刷天数无效（须为0-30）');
    if (spec.rateLimitMs !== undefined && (!Number.isInteger(spec.rateLimitMs) || spec.rateLimitMs < 100 || spec.rateLimitMs > 60000)) throw new DailyError('限速间隔无效（须为100-60000毫秒）');
  }
if (spec.attributionDelayDays !== undefined && (!Number.isInteger(spec.attributionDelayDays) || spec.attributionDelayDays < 0 || spec.attributionDelayDays > 30)) throw new DailyError('归因延迟范围须为0至30日');
  // Credentials are resolved only by the server-side provider. Specs never contain them.
  if (Object.keys(spec).some(k => /cookie|secret|token|password|headers|credential/i.test(k))) throw new DailyError('凭据不能写入任务配置');
}
export async function saveSyncTask(projectId: string, name: string, spec: SyncSpec, intervalMinutes = 360, expectedVersion = 0) {
  await ensureSyncSchema(); await validateSyncSpec(projectId, spec);
  if (!name.trim() || name.length > 200 || !Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 44640) throw new DailyError('任务名称或执行间隔无效');
  const id = `${projectId}:${spec.sourceKey}`;
  const previous = await db().prepare('SELECT * FROM business_sync_tasks WHERE id=? AND project_id=?').bind(id, projectId).first<SyncTask>();
  if ((previous?.version || 0) !== expectedVersion) throw new DailyError('任务配置已变化，请刷新后重试', 409);
  if (previous?.lease_token && Date.parse(previous.lease_expires_at || '') > Date.now()) throw new DailyError('任务执行中，请完成后再修改配置', 409);
  const now = new Date().toISOString();
  if (previous) await db().prepare('UPDATE business_sync_tasks SET name=?,spec_json=?,interval_minutes=?,version=version+1,updated_at=? WHERE id=? AND project_id=? AND version=?').bind(name, JSON.stringify(spec), intervalMinutes, now, id, projectId, expectedVersion).run();
  else await db().prepare(`INSERT OR IGNORE INTO business_sync_tasks(id,project_id,source_key,name,state,spec_json,interval_minutes,next_run_at,updated_at) VALUES(?,?,?,?,'active',?,?,?,?)`).bind(id, projectId, spec.sourceKey, name, JSON.stringify(spec), intervalMinutes, now, now).run();
  const applied = await db().prepare('SELECT version,name,spec_json,interval_minutes FROM business_sync_tasks WHERE id=? AND project_id=?').bind(id, projectId).first<{ version: number; name: string; spec_json: string; interval_minutes: number }>();
  if (applied?.version !== expectedVersion + 1 || applied.name !== name || applied.spec_json !== JSON.stringify(spec) || applied.interval_minutes !== intervalMinutes) throw new DailyError('任务配置并发变化，请刷新后重试', 409);
  return { id, version: expectedVersion + 1 };
}
export async function syncStatus(projectId: string, offset = 0, limit = 30) {
  await ensureSyncSchema();
  const tasks = await db().prepare(`SELECT id,source_key,name,state,interval_minutes,next_run_at,last_success_at,business_through,last_error,retry_count,lease_expires_at,version,last_run_id FROM business_sync_tasks WHERE project_id=? ORDER BY name`).bind(projectId).all();
  const runs = await db().prepare('SELECT * FROM sync_jobs WHERE project_id=? AND source_id IN (SELECT source_key FROM business_sync_tasks WHERE project_id=?) ORDER BY started_at DESC,id DESC LIMIT ? OFFSET ?').bind(projectId, projectId, limit, offset).all();
  const count = await db().prepare('SELECT COUNT(*) AS n FROM sync_jobs WHERE project_id=? AND source_id IN (SELECT source_key FROM business_sync_tasks WHERE project_id=?)').bind(projectId, projectId).first<{ n: number }>();
  const heartbeat = await db().prepare("SELECT mode,last_seen_at FROM business_sync_worker WHERE id='local'").first<{ mode: string; last_seen_at: string }>();
  const online = heartbeat?.mode === 'scheduled' && Date.now() - Date.parse(heartbeat.last_seen_at) < 90000;
    const observations = await db().prepare('SELECT source_key,account_id,business_day,data_json,captured_at,run_id FROM business_platform_observations WHERE project_id=? ORDER BY business_day DESC,captured_at DESC LIMIT 50').bind(projectId).all<{ source_key: string; account_id: string; business_day: string; data_json: string; captured_at: string; run_id: string }>();
  const boundAccounts = await db().prepare('SELECT id,external_id,name,metadata_json FROM source_accounts WHERE project_id=? ORDER BY name').bind(projectId).all<{ id: string; external_id: string; name: string; metadata_json: string }>();
  return { tasks: tasks.results, runs: runs.results, totalRuns: count?.n || 0, offset, hasMore: offset + runs.results.length < (count?.n || 0), worker: { online, lastSeenAt: heartbeat?.last_seen_at || null }, observations: observations.results, accounts: boundAccounts.results, runtime: '独立本地后台；尚未部署生产定时任务' };
}
export async function workerHeartbeat(mode: 'once' | 'scheduled') { await ensureSyncSchema(); await db().prepare("INSERT INTO business_sync_worker VALUES('local',?,?) ON CONFLICT(id) DO UPDATE SET mode=excluded.mode,last_seen_at=excluded.last_seen_at").bind(mode, new Date().toISOString()).run(); }
export async function taskAction(projectId: string, taskId: string, action: 'pause' | 'resume' | 'queue', requestId: string, windowFrom?: string, windowTo?: string) {
  await ensureSyncSchema();
  const task = await db().prepare('SELECT * FROM business_sync_tasks WHERE project_id=? AND id=?').bind(projectId, taskId).first<SyncTask>();
  if (!task) throw new DailyError('本项目任务不存在', 404);
  const now = new Date().toISOString();
  if (action === 'pause') { await db().prepare("UPDATE business_sync_tasks SET state='paused',lease_token=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND project_id=?").bind(now, taskId, projectId).run(); return { state: 'paused' }; }
  if (action === 'resume') { if (task.state === 'active') return { state: 'active' }; await db().prepare("UPDATE business_sync_tasks SET state='active',next_run_at=?,last_error='',retry_count=0,updated_at=? WHERE id=? AND project_id=?").bind(now, now, taskId, projectId).run(); return { state: 'active' }; }
  if (action !== 'queue' || !/^[a-zA-Z0-9:_-]{8,128}$/.test(requestId)) throw new DailyError('同步请求无效');
  if (task.state === 'paused') throw new DailyError('任务已暂停，请先恢复', 409);
  if (task.lease_token && Date.parse(task.lease_expires_at || '') > Date.now()) throw new DailyError('任务正在执行，请等待当前结果', 409);
  if ((windowFrom || windowTo) && (!windowFrom || !windowTo || calendarDay(windowFrom) !== windowFrom || calendarDay(windowTo) !== windowTo || windowFrom > windowTo || (Date.parse(windowTo) - Date.parse(windowFrom)) / 86400000 > 89)) throw new DailyError('补跑区间无效（最大90天）');
  const id = `${projectId}:${requestId}`;
  const prior = await db().prepare('SELECT task_id FROM business_sync_requests WHERE id=?').bind(id).first<{ task_id: string }>();
  if (prior) { if (prior.task_id !== taskId) throw new DailyError('请求ID已用于其他任务', 409); return { state: 'queued', duplicate: true }; }
  await db().batch([
    db().prepare('INSERT INTO business_sync_requests(id,project_id,task_id,window_from,window_to,created_at) VALUES(?,?,?,?,?,?)').bind(id, projectId, taskId, windowFrom || null, windowTo || null, now),
    db().prepare("UPDATE business_sync_tasks SET state='active',next_run_at=?,last_error='',retry_count=0,lease_token=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND project_id=?").bind(now, now, taskId, projectId),
  ]);
  return { state: 'queued', duplicate: false };
}
export async function dueTasks(now = new Date().toISOString(), limit = 5): Promise<SyncTask[]> {
  await ensureSyncSchema();
  return (await db().prepare("SELECT * FROM business_sync_tasks WHERE state='active' AND next_run_at<=? AND (lease_expires_at IS NULL OR lease_expires_at<=?) ORDER BY next_run_at LIMIT ?").bind(now, now, limit).all<SyncTask>()).results;
}
export async function claimTask(task: SyncTask, now = new Date().toISOString()) {
  const token = crypto.randomUUID(), expires = new Date(Date.parse(now) + 15 * 60000).toISOString();
  await db().prepare("UPDATE business_sync_tasks SET lease_token=?,lease_expires_at=?,updated_at=? WHERE id=? AND project_id=? AND state='active' AND next_run_at<=? AND (lease_expires_at IS NULL OR lease_expires_at<=?)").bind(token, expires, now, task.id, task.project_id, now, now).run();
  const current = await db().prepare('SELECT lease_token FROM business_sync_tasks WHERE id=? AND project_id=?').bind(task.id, task.project_id).first<{ lease_token: string }>();
  if (current?.lease_token !== token) return null;
  const runId = crypto.randomUUID();
  await db().batch([
    db().prepare("UPDATE sync_jobs SET status='interrupted',error_summary='执行进程中断；租约过期后恢复',finished_at=? WHERE project_id=? AND source_id=? AND status='running'").bind(now, task.project_id, task.source_key),
    db().prepare("INSERT INTO sync_jobs(id,project_id,source_id,status,started_at) VALUES(?,?,?,'running',?)").bind(runId, task.project_id, task.source_key, now),
    db().prepare('UPDATE business_sync_tasks SET last_run_id=? WHERE id=? AND lease_token=?').bind(runId, task.id, token),
  ]);
  const request = await db().prepare('SELECT id,window_from,window_to FROM business_sync_requests WHERE task_id=? AND project_id=? AND processed_at IS NULL ORDER BY CASE WHEN window_from IS NULL THEN 1 ELSE 0 END,created_at,id LIMIT 1').bind(task.id, task.project_id).first<{ id: string; window_from: string | null; window_to: string | null }>();
  return { token, runId, request };
}
export async function ownsClaim(task: SyncTask, token: string) {
  return Boolean(await db().prepare("SELECT id FROM business_sync_tasks WHERE id=? AND project_id=? AND lease_token=? AND state='active' AND lease_expires_at>?").bind(task.id, task.project_id, token, new Date().toISOString()).first());
}
export async function finishTask(task: SyncTask, claim: { token: string; runId: string; request?: { id: string } | null }, outcome: { rows: number; through?: string; error?: unknown }, now = new Date().toISOString()) {
  if (!await ownsClaim(task, claim.token)) { await db().prepare("UPDATE sync_jobs SET status='discarded',error_summary='任务暂停或配置变化，结果未发布',finished_at=? WHERE id=? AND project_id=?").bind(now, claim.runId, task.project_id).run(); return; }
  const failed = outcome.error !== undefined, retries = failed ? task.retry_count + 1 : 0;
  const delayMinutes = failed ? Math.min(60, 2 ** Math.min(6, retries)) : task.interval_minutes;
  const error = failed ? safeSyncError(outcome.error) : '';
  await db().batch([
    db().prepare('UPDATE sync_jobs SET status=?,rows_read=?,rows_imported=?,rows_failed=?,error_summary=?,finished_at=? WHERE id=? AND project_id=?').bind(failed ? 'failed' : 'success', outcome.rows, failed ? 0 : outcome.rows, failed ? outcome.rows : 0, error, now, claim.runId, task.project_id),
    ...(!failed && claim.request ? [db().prepare('UPDATE business_sync_requests SET processed_at=? WHERE project_id=? AND task_id=? AND created_at<=(SELECT created_at FROM business_sync_requests WHERE id=?) AND window_from IS (SELECT window_from FROM business_sync_requests WHERE id=?) AND window_to IS (SELECT window_to FROM business_sync_requests WHERE id=?)').bind(now,task.project_id,task.id,claim.request.id,claim.request.id,claim.request.id)] : []),
    db().prepare(`UPDATE business_sync_tasks SET next_run_at=CASE WHEN ?=0 AND EXISTS(SELECT 1 FROM business_sync_requests WHERE task_id=? AND project_id=? AND processed_at IS NULL) THEN ? ELSE ? END,last_success_at=CASE WHEN ? THEN last_success_at ELSE ? END,business_through=CASE WHEN business_through IS NULL THEN ? ELSE MAX(business_through,COALESCE(?,business_through)) END,last_error=?,retry_count=?,lease_token=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND project_id=? AND lease_token=?`).bind(failed ? 1 : 0, task.id, task.project_id, now, new Date(Date.parse(now) + delayMinutes * 60000).toISOString(), failed ? 1 : 0, now, failed ? null : outcome.through || null, failed ? null : outcome.through || null, error, retries, now, task.id, task.project_id, claim.token),
  ]);
}

export async function queueCompetitorSyncTask(projectId: string, options: {
  taskId: string;
  keywords: string[];
  from?: string;
  to?: string;
  windowType?: 'pubTime' | 'insertTime' | 'all';
  maxPagesPerRun?: number;
  pageSize?: number;
  overlapWindowDays?: number;
  rateLimitMs?: number;
  requestId?: string;
}) {
  await ensureSyncSchema();
  if (!projectId || !options.taskId || !Array.isArray(options.keywords) || !options.keywords.length) {
    throw new DailyError('项目ID、竞品taskId及关键词必填');
  }
  const sourceKey = 'competitor-ipscg-' + options.taskId;
  const spec: SyncSpec = {
    type: 'competitor_ipscg',
    sourceKey,
    sourceUrl: 'http://xhs.yq.ipscg.com/grab?taskId=' + options.taskId,
    taskId: options.taskId,
    keywords: options.keywords,
    from: options.from,
    to: options.to,
    maxPages: options.maxPagesPerRun || 2,
    pageSize: options.pageSize || 20,
    overlapWindowDays: options.overlapWindowDays || 7,
    rateLimitMs: options.rateLimitMs || 1200
  };
  const taskName = '竞品监控采集 (' + options.taskId.slice(0, 8) + ')';
  const taskId = projectId + ':' + sourceKey;
  const now = new Date().toISOString();
  await db().prepare(`INSERT INTO business_sync_tasks(id,project_id,source_key,name,state,spec_json,interval_minutes,next_run_at,updated_at)
    VALUES(?,?,?,?,'active',?,?,?,?)    ON CONFLICT(project_id,source_key) DO UPDATE SET spec_json=excluded.spec_json,state='active',next_run_at=excluded.next_run_at,updated_at=excluded.updated_at`)
    .bind(taskId, projectId, sourceKey, taskName, JSON.stringify(spec), 360, now, now).run();
  const reqId = options.requestId || ('req-comp-' + Date.now());
  const actionRes = await taskAction(projectId, taskId, 'queue', reqId, options.from, options.to);
  return { taskId, requestId: reqId, actionRes };
}
