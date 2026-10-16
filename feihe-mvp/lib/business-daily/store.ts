import { db, ensureSchema } from '../db';
import { buildDailyView, documentDays, publicNoteLink } from './adapter';
import type { DailyView, SectionMetadata, SourceBundle, SourceRole, SourceTable } from './types';
import { refreshCommentArchives } from '../comment-ops/store';
import { buildBusinessHighlights } from './highlights';

type Binding = { key: string; role: SourceRole | 'document'; url: string };
export type BusinessConfig = { bindings: Binding[]; alertThresholdPoints?: number; brands?: string[]; competitorWords?: string[]; businessTimeZone?: string };
let ready: Promise<void> | null = null;
const blockedSources = /MovYbZbxyaSNdssY1AacZ6WPnDe|LyHGbW1xUa03gZsdxSOcrJasnjg/;
export class DailyError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function ensureBusinessSchema() {
  await ensureSchema();
  if (!ready) ready = db().batch([
    db().prepare(`CREATE TABLE IF NOT EXISTS business_project_config(project_id TEXT PRIMARY KEY, config_json TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_captures(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,source_key TEXT NOT NULL,source_version TEXT NOT NULL,captured_at TEXT NOT NULL,payload_json TEXT NOT NULL,fingerprint TEXT NOT NULL)`),
    db().prepare(`CREATE INDEX IF NOT EXISTS idx_business_capture_project ON business_captures(project_id,source_key,captured_at)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_source_heads(project_id TEXT NOT NULL,source_key TEXT NOT NULL,capture_id TEXT NOT NULL,captured_at TEXT NOT NULL,PRIMARY KEY(project_id,source_key))`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_daily_reports(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,business_day TEXT NOT NULL,status TEXT NOT NULL,confirmed_by TEXT,created_at TEXT NOT NULL,fingerprint TEXT NOT NULL,payload_json TEXT NOT NULL,UNIQUE(project_id,business_day,status,fingerprint))`),
    db().prepare(`CREATE INDEX IF NOT EXISTS idx_business_report_day ON business_daily_reports(project_id,business_day,status,created_at)`),
    db().prepare(`CREATE TABLE IF NOT EXISTS business_sync_receipts(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,source_key TEXT NOT NULL,capture_id TEXT NOT NULL,state TEXT NOT NULL,captured_at TEXT NOT NULL)`),
  ]).then(() => undefined).catch(error => { ready = null; throw error; });
  await ready;
}
export async function fingerprint(value: unknown) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(buffer), x => x.toString(16).padStart(2, '0')).join('');
}
export async function configureBusiness(projectId: string, config: BusinessConfig, expectedVersion = 0) {
  await ensureBusinessSchema();
  if (!(await db().prepare('SELECT id FROM projects WHERE id=?').bind(projectId).first())) throw new DailyError('项目不存在', 404);
  if (!Array.isArray(config.bindings) || new Set(config.bindings.map(b => b.key)).size !== config.bindings.length) throw new DailyError('来源绑定重复或无效');
  for (const b of config.bindings) {
    if (!/^[a-zA-Z0-9_.:-]{1,160}$/.test(b.key) || !['weekly','budget_plan','platform_snapshot','creator_snapshot','keywords','keyword_notes','rectification','execution','seo_acceptance','seo_plan','platform_ads','platform_commerce','comment_register','comment_statistics','comment_plan','document'].includes(b.role) || blockedSources.test(b.url)) throw new DailyError('来源不在本轮允许范围');
    try { const u = new URL(b.url); if (!['http:','https:'].includes(u.protocol) || u.username || u.password) throw new Error(); } catch { throw new DailyError('来源地址无效'); }
  }
  if (config.alertThresholdPoints !== undefined && (!Number.isFinite(config.alertThresholdPoints) || config.alertThresholdPoints < 0 || config.alertThresholdPoints > 100)) throw new DailyError('预警阈值必须是0至100个百分点');
  const previous = await db().prepare('SELECT version FROM business_project_config WHERE project_id=?').bind(projectId).first<{ version: number }>();
  if ((previous?.version || 0) !== expectedVersion) throw new DailyError('项目来源配置已变化，请刷新后重试', 409);
  if (previous) await db().prepare('UPDATE business_project_config SET config_json=?,version=version+1,updated_at=? WHERE project_id=? AND version=?').bind(JSON.stringify(config), new Date().toISOString(), projectId, expectedVersion).run();
  else await db().prepare('INSERT OR IGNORE INTO business_project_config VALUES(?,?,1,?)').bind(projectId, JSON.stringify(config), new Date().toISOString()).run();
  const applied = await db().prepare('SELECT version,config_json FROM business_project_config WHERE project_id=?').bind(projectId).first<{ version: number; config_json: string }>();
  if (applied?.version !== expectedVersion + 1 || applied.config_json !== JSON.stringify(config)) throw new DailyError('来源配置并发变化，请刷新后重试', 409);
  return { version: expectedVersion + 1 };
}
export async function businessConfig(projectId: string): Promise<BusinessConfig | null> {
  await ensureBusinessSchema();
  const row = await db().prepare('SELECT config_json, version FROM business_project_config WHERE project_id=?').bind(projectId).first<{ config_json: string; version: number }>();
  return row ? { ...JSON.parse(row.config_json), version: row.version } : null;
}
export async function currentBundle(projectId: string, dailyOnly = false): Promise<SourceBundle> {
  await ensureBusinessSchema();
  const config = await businessConfig(projectId);
  const keys=config?.bindings.filter(b=>!dailyOnly || !['comment_register','comment_statistics','comment_plan','platform_ads','platform_commerce'].includes(b.role)).map(b=>b.key) || [];
  const rows = keys.length ? await db().prepare(`SELECT c.id,c.payload_json FROM business_source_heads h JOIN business_captures c ON c.id=h.capture_id AND c.project_id=h.project_id WHERE h.project_id=? AND h.source_key IN (${keys.map(()=>'?').join(',')}) ORDER BY h.source_key`).bind(projectId,...keys).all<{ id: string; payload_json: string }>():{results:[]};
  const bundle: SourceBundle = { tables: [] };
  for (const row of rows.results) {
    const p = { ...JSON.parse(row.payload_json), captureId: row.id };
    // Removing a binding also removes it from current calculations, while immutable reports survive.
    if (!config?.bindings.some(b => b.key === p.key && b.url === p.url)) continue;
    if (p.content !== undefined) bundle.document = p; else bundle.tables.push(p);
  }
  return bundle;
}
export async function ingestBusinessBundle(projectId: string, bundle: SourceBundle) {
  await ensureBusinessSchema();
  let config = await businessConfig(projectId);
  if (!config) throw new DailyError('请先配置本项目自己的来源绑定');

  const allowedDynamicRoles = new Set(['budget_plan', 'creator_snapshot', 'platform_snapshot']);
  const documentUrls = new Set(config.bindings.filter(b => b.role === 'document').map(b => b.url));
  let configNeedsUpdate = false;
  const mergedBindings = [...config.bindings];
  for (const table of bundle.tables) {
    if (allowedDynamicRoles.has(table.role) && documentUrls.has(table.url) && !blockedSources.test(table.url)) {
      if (/^(?:budget_plan|creator_snapshot|platform_snapshot)-\d{4}-\d{2}-\d{2}$/.test(table.key)) {
        if (!mergedBindings.some(b => b.key === table.key)) {
          mergedBindings.push({ key: table.key, role: table.role as any, url: table.url });
          configNeedsUpdate = true;
        }
      }
    }
  }
  if (configNeedsUpdate) {
    const row = await db().prepare('SELECT version, config_json FROM business_project_config WHERE project_id=?').bind(projectId).first<{ version: number; config_json: string }>();
    if (row) {
      const currentConf = JSON.parse(row.config_json);
      currentConf.bindings = mergedBindings;
      await configureBusiness(projectId, currentConf, row.version);
      config = (await businessConfig(projectId)) || config;
    }
  }
  const inputs = [...bundle.tables, ...(bundle.document ? [bundle.document] : [])];
  const statements = []; const receipts = [];
  for (const input of inputs) {
    const role = 'content' in input ? 'document' : input.role;
    if (!config.bindings.some(b => b.key === input.key && b.role === role && b.url === input.url) || blockedSources.test(input.url)) throw new DailyError('来源未绑定到当前项目：' + input.key, 403);
    if (!input.version || !Number.isFinite(Date.parse(input.capturedAt))) throw new DailyError('来源版本与采集时间必填');
    if ('rows' in input && (!input.complete || !Array.isArray(input.rows) || input.rows.length > 100000)) throw new DailyError('来源读取不完整或超出本批上限');
    if ('content' in input && blockedSources.test(input.content)) {
      // References to excluded Base resources are never traversed or imported.
      input.content = input.content.replace(/<cite\b[^>]*(?:MovYbZbxyaSNdssY1AacZ6WPnDe|LyHGbW1xUa03gZsdxSOcrJasnjg)[^>]*>[\s\S]*?<\/cite>/g, '');
    }
    const { capturedAt: _captureTime, ...content } = input; void _captureTime;
    const hash = await fingerprint(content), id = `${projectId}:${input.key}:${hash}`;
    const prior = await db().prepare('SELECT captured_at,capture_id FROM business_source_heads WHERE project_id=? AND source_key=?').bind(projectId, input.key).first<{ captured_at: string; capture_id: string }>();
    const state = prior && Date.parse(prior.captured_at) > Date.parse(input.capturedAt) ? 'late_retained' : prior?.capture_id === id ? 'unchanged' : 'updated';
    statements.push(db().prepare('INSERT OR IGNORE INTO business_captures VALUES(?,?,?,?,?,?,?)').bind(id, projectId, input.key, input.version, input.capturedAt, JSON.stringify(input), hash));
    if (state !== 'late_retained') statements.push(db().prepare(`INSERT INTO business_source_heads VALUES(?,?,?,?) ON CONFLICT(project_id,source_key) DO UPDATE SET capture_id=excluded.capture_id,captured_at=excluded.captured_at WHERE excluded.captured_at>=business_source_heads.captured_at`).bind(projectId, input.key, id, new Date(input.capturedAt).toISOString()));
    statements.push(db().prepare('INSERT INTO business_sync_receipts VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), projectId, input.key, id, state, input.capturedAt));
    receipts.push({ key: input.key, state });
  }
  // Validate parsers before advancing source heads. A bad source never clears the last successful values.
  const combined = await currentBundle(projectId);
  for (const table of bundle.tables) { const i = combined.tables.findIndex(s => s.key === table.key); if (i < 0) combined.tables.push(table); else combined.tables[i] = table; }
  if (bundle.document) combined.document = bundle.document;
  const days = [...documentDays(combined.document).keys()];
  if (days.length) buildDailyView(projectId, combined, days.sort().at(-1)!, { threshold: config.alertThresholdPoints });
  await db().batch(statements);
  await refreshCommentArchives(projectId);
  // Source-authored reports are archived separately from current bottom tables and explicit confirmations.
  for (const day of documentDays(bundle.document).keys()) {
    const current = await latestDaily(projectId, day);
    const view = { ...current, mode: 'source_snapshot' as const };
    const hash = await fingerprint({ ...view, capturedAt: null, fingerprint: undefined });
    await db().prepare('INSERT OR IGNORE INTO business_daily_reports VALUES(?,?,?,\'source_snapshot\',NULL,?,?,?)').bind(`${projectId}:${day}:source:${hash}`, projectId, day, new Date().toISOString(), hash, JSON.stringify(view)).run();
  }
  return { receipts };
}
const dailyViews=new Map<string,DailyView>();
export async function latestDaily(projectId: string, day: string, from?: string, to?: string): Promise<DailyView> {
  await ensureBusinessSchema();
  const config = await businessConfig(projectId), keys=config?.bindings.filter(b=>!['comment_register','comment_statistics','comment_plan','platform_ads','platform_commerce'].includes(b.role)).map(b=>b.key) || [];
  const configVersion=await db().prepare('SELECT version FROM business_project_config WHERE project_id=?').bind(projectId).first<{version:number}>();
  const heads=keys.length ? await db().prepare(`SELECT source_key,capture_id,captured_at FROM business_source_heads WHERE project_id=? AND source_key IN (${keys.map(()=>'?').join(',')}) ORDER BY source_key`).bind(projectId,...keys).all():{results:[]};
  const key=JSON.stringify({projectId,day,from,to,configVersion:configVersion?.version,heads:heads.results});
  const cached=dailyViews.get(key);if(cached)return cached;
  const bundle = await currentBundle(projectId,true);
  const view = buildDailyView(projectId, bundle, day, { from, to, threshold: config?.alertThresholdPoints });
  view.fingerprint = await fingerprint(view);
  dailyViews.set(key,view);if(dailyViews.size>24)dailyViews.delete(dailyViews.keys().next().value!);
  return view;
}
export function dailySummary(view: DailyView): DailyView {
  const shortTables = new Set(['板块负责人','日 / 周 / 月费用对账','达人储备及发布进度','当前执行底表 · 当月产出','核心占位词关键词表现','星盟月累计 · 电商与聚光分别核对']);
  const highlights = buildBusinessHighlights(view);
  const sectionMetadata: Record<string, SectionMetadata> = {
    search: {
      key: 'search',
      title: '搜索分析',
      sourceBusinessDay: highlights.search.sourceBusinessDay || null,
      capturedAt: highlights.search.capturedAt || null,
      isHistoricalSnapshot: Boolean(highlights.search.isHistoricalSnapshot),
      status: highlights.search.status || 'current',
      reason: highlights.search.reason
    },
    feed: {
      key: 'feed',
      title: '信息流分析',
      sourceBusinessDay: highlights.feed.sourceBusinessDay || null,
      capturedAt: highlights.feed.capturedAt || null,
      isHistoricalSnapshot: Boolean(highlights.feed.isHistoricalSnapshot),
      status: highlights.feed.status || 'current',
      reason: highlights.feed.reason
    },
    creators: {
      key: 'creators',
      title: '达人储备与执行',
      sourceBusinessDay: highlights.creators.snapshotBusinessDay || null,
      capturedAt: highlights.creators.snapshotCapturedAt || null,
      isHistoricalSnapshot: Boolean(highlights.creators.isHistoricalSnapshot),
      status: highlights.creators.status || 'current',
      reason: highlights.creators.reason
    },
    maintenance: {
      key: 'maintenance',
      title: '月执行与商业笔记',
      sourceBusinessDay: highlights.maintenance.sourceBusinessDay || null,
      capturedAt: highlights.maintenance.capturedAt || null,
      isHistoricalSnapshot: Boolean(highlights.maintenance.isHistoricalSnapshot),
      status: highlights.maintenance.status || 'current',
      reason: highlights.maintenance.reason
    },
    rectification: {
      key: 'rectification',
      title: '整改全盘',
      sourceBusinessDay: highlights.rectification.sourceBusinessDay || null,
      capturedAt: highlights.rectification.capturedAt || null,
      isHistoricalSnapshot: Boolean(highlights.rectification.isHistoricalSnapshot),
      status: highlights.rectification.status || 'current',
      reason: highlights.rectification.reason
    },
    seo: {
      key: 'seo',
      title: 'SEO关键词验收',
      sourceBusinessDay: highlights.seo.sourceBusinessDay || null,
      capturedAt: highlights.seo.snapshotCapturedAt || null,
      isHistoricalSnapshot: Boolean(highlights.seo.isHistoricalSnapshot),
      status: highlights.seo.status || 'current',
      reason: highlights.seo.reason
    },
    expenses: {
      key: 'expenses',
      title: '投放费用实绩',
      sourceBusinessDay: view.core.adSpend.state === 'observed' ? view.day : (view.latestCompleteDay || view.businessThrough),
      capturedAt: view.core.adSpend.source?.capturedAt || null,
      isHistoricalSnapshot: view.core.adSpend.state !== 'observed',
      status: view.core.adSpend.state === 'observed' ? 'current' : 'pending',
      reason: view.core.adSpend.state !== 'observed' ? (view.core.adSpend.reason || '费用原始输入尚未登记；公式默认零不视为观测') : undefined
    }
  };
  return {
    ...view,
    isSummary: true,
    highlights,
    sectionMetadata,
    noteCount: view.notes.length,
    notes: view.notes.slice(0, 10),
    tables: view.tables.map(t => ({
      ...t,
      totalRows: t.rows.length,
      pageOffset: 0,
      rows: shortTables.has(t.title) ? t.rows : []
    }))
  };
}
export function dailyDetail(view:DailyView,part:string,title:string,offset:number,limit:number,expectedFingerprint:string) {
  if(!Number.isSafeInteger(offset) || offset<0 || !Number.isInteger(limit) || limit<1 || limit>100)throw new DailyError('明细分页参数无效');
  if(!expectedFingerprint || expectedFingerprint!==view.fingerprint)throw new DailyError('来源版本已变化，请刷新日报后再展开明细',409);
  if(part==='notes')return {rows:view.notes.slice(offset,offset+limit),total:view.notes.length,offset,limit,hasMore:offset+limit<view.notes.length,fingerprint:view.fingerprint};
  if(part!=='table')throw new DailyError('明细类型无效');
  const table=view.tables.find(t=>t.title===title);if(!table)throw new DailyError('该日报中没有这张明细表',404);
  return {table:{...table,rows:table.rows.slice(offset,offset+limit),totalRows:table.rows.length,pageOffset:offset},total:table.rows.length,offset,limit,hasMore:offset+limit<table.rows.length,fingerprint:view.fingerprint};
}
export async function readDaily(projectId: string, day: string, mode = 'latest', from?: string, to?: string) {
  await ensureBusinessSchema();
  if (!['latest','source_snapshot','confirmed'].includes(mode)) throw new DailyError('日报视图无效');
  if (mode === 'latest') return latestDaily(projectId, day, from, to);
  const row = await db().prepare(`SELECT * FROM business_daily_reports WHERE project_id=? AND business_day=? AND status=? ORDER BY created_at DESC,id DESC LIMIT 1`).bind(projectId, day, mode).first<{ payload_json: string; id: string; fingerprint: string; confirmed_by: string | null }>();
  if (!row) throw new DailyError(mode === 'confirmed' ? '该日尚无已确认日报' : '该日尚无来源日报快照', 404);
  return { ...JSON.parse(row.payload_json), snapshotId: row.id, fingerprint: row.fingerprint, confirmedBy: row.confirmed_by } as DailyView;
}
export async function confirmDaily(projectId: string, day: string, expectedFingerprint: string, userId: string) {
  const view = await latestDaily(projectId, day);
  if (!expectedFingerprint || expectedFingerprint !== view.fingerprint) throw new DailyError('业务数据已变化，请刷新核对后确认', 409);
  const frozen = { ...view, mode: 'confirmed' as const, confirmedBy: userId };
  const id = `${projectId}:${day}:confirmed:${view.fingerprint}`;
  await db().batch([
    db().prepare(`INSERT OR IGNORE INTO business_daily_reports VALUES(?,?,?,'confirmed',?,?,?,?)`).bind(id, projectId, day, userId, new Date().toISOString(), view.fingerprint!, JSON.stringify(frozen)),
    db().prepare('INSERT INTO action_logs(project_id,actor_user_id,action,target_type,target_id,detail,created_at) VALUES(?,?,?,?,?,?,?)').bind(projectId, userId, '确认业务日报', 'daily_report', id, JSON.stringify({ day, fingerprint: view.fingerprint, schemaVersion: view.schemaVersion }), new Date().toISOString()),
  ]);
  return { snapshotId: id };
}
export async function sourceRows(projectId: string, key: string, offset = 0, limit = 50, captureId?: string) {
  await ensureBusinessSchema();
  const row=captureId ? await db().prepare('SELECT payload_json FROM business_captures WHERE project_id=? AND source_key=? AND id=?').bind(projectId,key,captureId).first<{payload_json:string}>():await db().prepare('SELECT c.payload_json FROM business_source_heads h JOIN business_captures c ON c.id=h.capture_id AND c.project_id=h.project_id WHERE h.project_id=? AND h.source_key=?').bind(projectId,key).first<{payload_json:string}>();
  const config=await businessConfig(projectId),table=row && (captureId || config?.bindings.some(b=>b.key===key)) ? JSON.parse(row.payload_json) as SourceTable:undefined;
  if (table && !Array.isArray(table.rows)) throw new DailyError('该来源不是表格', 400);
  if (!table) throw new DailyError('本项目来源不存在', 404);
  const rows = table.rows.slice(offset, offset + limit).map(r => r.map(v => /^https?:/.test(String(v || '')) ? publicNoteLink(v) : v));
  const header = table.role === 'rectification' ? table.rows[1] : table.rows[0];
  let parent = '';
  const columns = (header || []).map((v, i) => { if (v !== null && v !== undefined && String(v).trim()) parent = String(v); const child = ['weekly','platform_snapshot'].includes(table.role) ? table.rows[1]?.[i] : null; return [String(v || parent || '列' + (i + 1)), child ? String(child) : ''].filter(Boolean).join(' / '); });
  const { rows: _rows, ...meta } = table; void _rows;
  return { source: meta, columns, total: table.rows.length, offset, limit, hasMore: offset + rows.length < table.rows.length, rows };
}
