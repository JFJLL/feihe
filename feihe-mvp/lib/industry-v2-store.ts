import { createHash, randomUUID } from 'node:crypto';
import { db, ensureSchema } from './db';
import { isCampaignProject } from './campaign-catalog';
import type { IndustryV2Config, IndustryQuery, IndustryDayCoverage, IndustryV2Note, IndustryV2FetchResult } from './industry-v2-types';

export const INDUSTRY_V2_DAILY_PAGE_BUDGET = 360;
export const INDUSTRY_V2_PAGES_PER_JOB = 3;
let schema: Promise<void> | undefined;
export function ensureIndustryV2Schema() {
  return schema ??= (async () => {
    await ensureSchema();
    const d = db();
    await d.batch([
      d.prepare(`CREATE TABLE IF NOT EXISTS industry_v2_configs(project_id TEXT PRIMARY KEY, category_keyword TEXT NOT NULL, competitors_json TEXT NOT NULL, history_days INTEGER NOT NULL, daily_enabled INTEGER NOT NULL, updated_at TEXT NOT NULL)`),
      d.prepare(`CREATE TABLE IF NOT EXISTS industry_v2_jobs(id TEXT PRIMARY KEY, project_id TEXT NOT NULL, scope_key TEXT NOT NULL, query_id TEXT NOT NULL, query_json TEXT NOT NULL, business_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, attempt_day TEXT NOT NULL DEFAULT '', lease_token TEXT, lease_until TEXT, not_before TEXT, notes_json TEXT NOT NULL DEFAULT '[]', pages INTEGER NOT NULL DEFAULT 0, reported_total INTEGER, error TEXT, updated_at TEXT NOT NULL, manual_requested INTEGER NOT NULL DEFAULT 0, UNIQUE(project_id,scope_key,query_id,business_date))`),
      d.prepare('CREATE INDEX IF NOT EXISTS idx_industry_v2_jobs_scope ON industry_v2_jobs(project_id,scope_key,business_date,status)'),
      d.prepare('CREATE TABLE IF NOT EXISTS industry_v2_leases(project_id TEXT PRIMARY KEY,token TEXT,until_at TEXT)'),
      d.prepare('CREATE TABLE IF NOT EXISTS industry_v2_budget(project_id TEXT NOT NULL,date_key TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project_id,date_key))'),
    ]);
    const columns = (await d.prepare('PRAGMA table_info(industry_v2_jobs)').all<{ name: string }>()).results;
    if (!columns.some(column => column.name === 'manual_requested')) {
      try { await d.prepare('ALTER TABLE industry_v2_jobs ADD COLUMN manual_requested INTEGER NOT NULL DEFAULT 0').run(); }
      catch (error) { if (!(await d.prepare('PRAGMA table_info(industry_v2_jobs)').all<{ name: string }>()).results.some(column => column.name === 'manual_requested')) throw error; }
    }
    if (!columns.some(column => column.name === 'successful')) {
      try { await d.prepare('ALTER TABLE industry_v2_jobs ADD COLUMN successful INTEGER NOT NULL DEFAULT 0').run(); }
      catch (error) { if (!(await d.prepare('PRAGMA table_info(industry_v2_jobs)').all<{ name: string }>()).results.some(column => column.name === 'successful')) throw error; }
      await d.prepare("UPDATE industry_v2_jobs SET successful=1 WHERE status IN ('complete','partial')").run();
    }
  })().catch(error => { schema = undefined; throw error; });
}

const defaults: Record<string, { category: string; competitors: string[] }> = {
  'huang-tiane': { category: '可生食鸡蛋', competitors: ['圣迪乐村鸡蛋', '兰皇鸡蛋'] },
  kailas: { category: '越野跑鞋', competitors: ['萨洛蒙越野跑鞋', 'HOKA越野跑鞋'] },
  meiling: { category: '冰箱', competitors: ['海尔冰箱', '容声冰箱'] },
  'winner-wipes': { category: '酒精湿巾', competitors: ['心相印酒精湿巾', '全棉时代酒精湿巾'] },
};
const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 24);
const normalized = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
export const shanghaiDay = (date = new Date()) => new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
export const shiftIndustryDay = (day: string, amount: number) => new Date(Date.parse(day + 'T00:00:00Z') + amount * 86400_000).toISOString().slice(0, 10);
export function industryWindow(config: IndustryV2Config, now = new Date()) {
  // Pugongying daily indexing can lag; mirror ct-magic's T-2 window and recheck recent dates.
  const to = shiftIndustryDay(shanghaiDay(now), -2);
  return { from: shiftIndustryDay(to, 1 - config.historyDays), to };
}
export function industryDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < 90; day = shiftIndustryDay(day, 1)) days.push(day);
  return days;
}

export async function getIndustryV2Config(projectId: string): Promise<IndustryV2Config | null> {
  await ensureIndustryV2Schema();
  if (!isCampaignProject(projectId)) return null;
  const p = await db().prepare('SELECT spu,brand,is_archived FROM projects WHERE id=?').bind(projectId).first<{ spu: string; brand: string; is_archived: number }>();
  if (!p || p.is_archived) return null;
  const row = await db().prepare('SELECT * FROM industry_v2_configs WHERE project_id=?').bind(projectId).first<{ category_keyword: string; competitors_json: string; history_days: number; daily_enabled: number }>();
  const recommended = defaults[projectId];
  const categoryKeyword = row?.category_keyword ?? recommended.category;
  const competitorKeywords: string[] = row ? JSON.parse(row.competitors_json) : recommended.competitors;
  const spu = p.spu.trim(), brand = p.brand.trim();
  const makeQuery = (kind: IndustryQuery['kind'], keyword: string): IndustryQuery => ({ id: hash(kind + ':' + normalized(keyword)), kind, keyword, label: kind === 'own' ? '本品 · ' + keyword : kind === 'category' ? '品类 · ' + keyword : keyword });
  const queries = spu ? [makeQuery('own', spu), makeQuery('category', categoryKeyword), ...competitorKeywords.map(word => makeQuery('competitor', word))] : [];
  let dailyEnabled = row ? Boolean(row.daily_enabled) : true;
  if (!row) {
    try { const legacy = await db().prepare('SELECT daily_sync_enabled FROM industry_project_configs WHERE project_id=?').bind(projectId).first<{ daily_sync_enabled: number }>(); if (legacy) dailyEnabled = Boolean(legacy.daily_sync_enabled); } catch { /* No legacy installation. */ }
  }
  return { projectId, spu, brand, categoryKeyword, competitorKeywords, historyDays: row?.history_days ?? 30, dailyEnabled, queries, scopeKey: hash(JSON.stringify([projectId, spu, brand, queries.map(q => [q.kind, normalized(q.keyword)]).sort()])) };
}

export class IndustryConfigError extends Error {}
export async function saveIndustryV2Config(projectId: string, input: Record<string, unknown>) {
  const old = await getIndustryV2Config(projectId);
  if (!old) throw new IndustryConfigError('项目不存在或已归档');
  const category = input.categoryKeyword ?? old.categoryKeyword;
  const competitors = input.competitorKeywords ?? old.competitorKeywords;
  const historyDays = input.historyDays ?? old.historyDays;
  const daily = input.dailyEnabled ?? old.dailyEnabled;
  if (typeof category !== 'string' || !category.trim() || category.trim().length > 60) throw new IndustryConfigError('品类检索词需为 1–60 个字符');
  if (!Array.isArray(competitors) || competitors.length > 5 || competitors.some(v => typeof v !== 'string' || !v.trim() || v.trim().length > 60)) throw new IndustryConfigError('最多设置 5 个竞品检索词，每个为 1–60 个字符');
  if (![7, 14, 30, 90].includes(Number(historyDays)) || typeof historyDays !== 'number') throw new IndustryConfigError('历史范围仅支持 7、14、30、90 天');
  if (typeof daily !== 'boolean') throw new IndustryConfigError('自动更新开关必须为布尔值');
  const keywords = [old.spu, category, ...competitors].filter(Boolean).map(normalized);
  if (new Set(keywords).size !== keywords.length) throw new IndustryConfigError('品类、本品、竞品检索词不可重复');
  await db().prepare(`INSERT INTO industry_v2_configs VALUES(?,?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET category_keyword=excluded.category_keyword,competitors_json=excluded.competitors_json,history_days=excluded.history_days,daily_enabled=excluded.daily_enabled,updated_at=excluded.updated_at`)
    .bind(projectId, category.trim(), JSON.stringify(competitors.map(x => x.trim())), historyDays, daily ? 1 : 0, new Date().toISOString()).run();
  return (await getIndustryV2Config(projectId))!;
}

export async function enqueueIndustryV2(config: IndustryV2Config, now = new Date(), manual = false) {
  await ensureIndustryV2Schema();
  if (!config.spu) throw new IndustryConfigError('请先填写项目 SPU');
  const { from, to } = industryWindow(config, now);
  const d = db(), stamp = now.toISOString();
  // Bounded multi-row statements avoid both per-row commits and shared async transactions.
  const inserts: unknown[][] = [];
  for (const date of industryDays(from, to).reverse()) for (const query of config.queries) {
    const id = hash([config.projectId, config.scopeKey, query.id, date].join(':'));
    inserts.push([id, config.projectId, config.scopeKey, query.id, JSON.stringify(query), date, stamp]);
  }
  for (let offset = 0; offset < inserts.length; offset += 50) {
    const chunk = inserts.slice(offset, offset + 50);
    await d.prepare('INSERT OR IGNORE INTO industry_v2_jobs(id,project_id,scope_key,query_id,query_json,business_date,updated_at) VALUES ' + chunk.map(() => '(?,?,?,?,?,?,?)').join(','))
      .bind(...chunk.flat()).run();
  }
  if (config.dailyEnabled || manual) await d.prepare("UPDATE industry_v2_jobs SET status='pending' WHERE project_id=? AND scope_key=? AND business_date BETWEEN ? AND ? AND status IN ('complete','partial') AND attempt_day<?")
    .bind(config.projectId, config.scopeKey, shiftIndustryDay(to, -2), to, shanghaiDay(now)).run();
  if (manual) await d.prepare("UPDATE industry_v2_jobs SET manual_requested=1 WHERE project_id=? AND scope_key=? AND business_date BETWEEN ? AND ? AND status IN ('pending','failed')").bind(config.projectId, config.scopeKey, from, to).run();
  return { from, to, expected: config.queries.length * config.historyDays };
}

export interface IndustryV2Job { id: string; query: IndustryQuery; date: string; token: string; config: IndustryV2Config; reserved: number; budgetDay: string; }
export async function claimIndustryV2Job(config: IndustryV2Config, now = new Date()): Promise<IndustryV2Job | null> {
  const d = db(), token = randomUUID(), stamp = now.toISOString(), until = new Date(now.getTime() + 8 * 60_000).toISOString();
  const budgetDay = shanghaiDay(now), { from, to } = industryWindow(config, now);
  await d.prepare('INSERT OR IGNORE INTO industry_v2_leases(project_id) VALUES(?)').bind(config.projectId).run();
  const lock = await d.prepare('UPDATE industry_v2_leases SET token=?,until_at=? WHERE project_id=? AND (until_at IS NULL OR until_at<?) RETURNING project_id').bind(token, until, config.projectId, stamp).first();
  if (!lock) return null;
  try {
    const candidate = await d.prepare(`SELECT id,query_json,business_date FROM industry_v2_jobs WHERE project_id=? AND scope_key=? AND business_date BETWEEN ? AND ? AND (?=1 OR manual_requested=1) AND (attempt_day<>? OR attempts<3) AND (status='pending' OR (status='failed' AND (not_before IS NULL OR not_before<=?)) OR (status='running' AND lease_until<?)) ORDER BY business_date DESC,CASE json_extract(query_json,'$.kind') WHEN 'own' THEN 0 WHEN 'category' THEN 1 ELSE 2 END,id LIMIT 1`)
      .bind(config.projectId, config.scopeKey, from, to, config.dailyEnabled ? 1 : 0, budgetDay, stamp, stamp).first<{ id: string; query_json: string; business_date: string }>();
    if (!candidate) { await releaseIndustryV2Lease(config.projectId, token); return null; }
    await d.prepare('INSERT OR IGNORE INTO industry_v2_budget VALUES(?,?,0)').bind(config.projectId, budgetDay).run();
    const budget = await d.prepare('UPDATE industry_v2_budget SET used=used+? WHERE project_id=? AND date_key=? AND used+?<=? RETURNING used').bind(INDUSTRY_V2_PAGES_PER_JOB, config.projectId, budgetDay, INDUSTRY_V2_PAGES_PER_JOB, INDUSTRY_V2_DAILY_PAGE_BUDGET).first();
    if (!budget) { await releaseIndustryV2Lease(config.projectId, token); return null; }
    await d.prepare(`UPDATE industry_v2_jobs SET status='running',attempts=CASE WHEN attempt_day=? THEN attempts+1 ELSE 1 END,attempt_day=?,lease_token=?,lease_until=?,updated_at=? WHERE id=?`)
      .bind(budgetDay, budgetDay, token, until, stamp, candidate.id).run();
    return { id: candidate.id, query: JSON.parse(candidate.query_json), date: candidate.business_date, token, config, reserved: INDUSTRY_V2_PAGES_PER_JOB, budgetDay };
  } catch (error) { await releaseIndustryV2Lease(config.projectId, token); throw error; }
}
export async function releaseIndustryV2Lease(projectId: string, token: string) {
  await db().prepare('UPDATE industry_v2_leases SET token=NULL,until_at=NULL WHERE project_id=? AND token=?').bind(projectId, token).run();
}
export async function finishIndustryV2Job(job: IndustryV2Job, result: IndustryV2FetchResult, now = new Date()) {
  const current = await getIndustryV2Config(job.config.projectId);
  const validScope = current?.scopeKey === job.config.scopeKey && current.spu === job.config.spu;
  const status = !validScope || !result.ok ? 'failed' : result.truncated ? 'partial' : 'complete';
  const error = !validScope ? '项目检索配置已变化，本次结果不参与新配置分析' : result.error;
  const usable = validScope && result.ok;
  const saved = await db().prepare(`UPDATE industry_v2_jobs SET status=?,notes_json=CASE WHEN ?=1 THEN ? ELSE notes_json END,successful=CASE WHEN ?=1 THEN 1 ELSE successful END,pages=?,reported_total=CASE WHEN ?=1 THEN ? ELSE reported_total END,error=?,updated_at=?,not_before=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=? RETURNING id`)
    .bind(status, usable ? 1 : 0, JSON.stringify(result.notes), usable ? 1 : 0, result.pages, usable ? 1 : 0, result.reportedTotal, error, now.toISOString(), new Date(now.getTime() + 5 * 60_000).toISOString(), job.id, job.token).first();
  // Failed requests may have reached upstream even when no page was returned; keep their reservation.
  if (saved && result.ok && result.pages < job.reserved) {
    await db().prepare('UPDATE industry_v2_budget SET used=MAX(0,used-?) WHERE project_id=? AND date_key=?').bind(job.reserved - result.pages, job.config.projectId, job.budgetDay).run();
  }
  await releaseIndustryV2Lease(job.config.projectId, job.token);
  return Boolean(saved && validScope);
}

export async function readIndustryV2Data(config: IndustryV2Config, now = new Date()) {
  const { from, to } = industryWindow(config, now);
  const rows = (await db().prepare('SELECT query_id,business_date,status,notes_json,reported_total,pages,error,successful FROM industry_v2_jobs WHERE project_id=? AND scope_key=? AND business_date BETWEEN ? AND ? ORDER BY business_date,query_id').bind(config.projectId, config.scopeKey, from, to).all<{ query_id: string; business_date: string; status: IndustryDayCoverage['status']; notes_json: string; reported_total: number | null; pages: number; error: string | null; successful: number }>()).results;
  const map = new Map(rows.map(row => [row.query_id + ':' + row.business_date, row]));
  const coverage: IndustryDayCoverage[] = [], notes: IndustryV2Note[] = [];
  for (const date of industryDays(from, to)) for (const query of config.queries) {
    const row = map.get(query.id + ':' + date);
    const entries: IndustryV2Note[] = row?.successful ? JSON.parse(row.notes_json) : [];
    coverage.push({ queryId: query.id, date, status: row?.status ?? 'pending', fetched: entries.length, reportedTotal: row?.reported_total ?? null, pages: row?.pages ?? 0, error: row?.error ?? null });
    // A failed refresh retains the last successful observation; coverage remains failed/stale.
    if (row?.successful) notes.push(...entries.map(note => ({ ...note, queryIds: [query.id] })));
  }
  return { config, from, to, notes, coverage };
}
