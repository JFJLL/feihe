import type { ReportSpec } from './report-agent';
import type { ClassifiedNote, ReviewResult } from './comment-review';
import type { MiniDb } from './db';

export function normalizeNoteIdentity(link: string): string {
  const trimmed = (link || '').trim();
  const m = trimmed.match(/(?:notes|explore)\/([a-zA-Z0-9_-]{16,32})/i) || trimmed.match(/([a-f0-9]{24})/i);
  if (m) return m[1].toLowerCase();
  let hash = 5381;
  for (let i = 0; i < trimmed.length; i++) {
    hash = ((hash << 5) + hash) + trimmed.charCodeAt(i);
    hash |= 0;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const clean = trimmed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  return `h_${hex}_${clean || 'empty'}`;
}

export function makeItemKey(project: string, link: string, source: string, action: string): string {
  const identity = normalizeNoteIdentity(link);
  return `${project}:${identity}:${source}:${action}`;
}

export function shortLink(link: string): string {
  const m = link.match(/notes\/([a-z0-9]{6,})/i) || link.match(/([a-f0-9]{10,})/i);
  return m ? m[1].slice(0, 16) : link.slice(0, 24);
}
function toRow(n: ClassifiedNote): Record<string, string | number> {
  return {
    博主: n.blogger || '未知博主',
    笔记: shortLink(n.link),
    正向评论: n.positive,
    评论总数: n.total,
    产品提及率: Math.round(n.mentionRate * 100) + '%',
    执行表数: n.sheets.length,
    链接: n.link,
  };
}
export function reviewSections(result: ReviewResult): ReportSpec['sections'] {
  const sections: ReportSpec['sections'] = [];
  sections.push({
    id: 'review_reportable', eyebrow: 'REPORTABLE', title: '可汇报笔记（200条正向 + 前三屏提及40%）',
    kind: 'table', description: result.dateKey + ' 累计判定 ' + result.noteCount + ' 篇，可汇报 ' + result.counts.reportable + ' 篇，仅符合项进入汇报。',
    data: result.reportable.slice(0, 50).map(toRow),
  });
  sections.push({
    id: 'review_basic', eyebrow: 'BASELINE', title: '达基础线笔记（正向30条以上）',
    kind: 'table', description: '累计正向30条以上共 ' + result.counts.basic + ' 篇，可正常结算与沉淀（仅展示前50）。',
    data: result.basic.slice(0, 50).map(toRow),
  });
  return sections;
}
export function buildReviewInsight(result: ReviewResult): string[] {
  const lines: string[] = [];
  lines.push('结论：' + result.dateKey + '累计' + result.noteCount + '篇中，可汇报' + result.counts.reportable + '篇、达基础线' + result.counts.basic + '篇；其余' + result.counts.needSupplement + '篇正向不足30条需补量。');
  const quick = [...result.needSupplement].sort((a, b) => a.supplementNeed - b.supplementNeed).filter((n) => n.supplementNeed <= 10).slice(0, 3);
  if (quick.length) lines.push('补量优先（还差10条以内）：' + quick.map((n) => (n.blogger || '未知博主') + '（正向' + n.positive + '条，还差' + n.supplementNeed + '条）').join('；') + '。');
  const weak = [...result.basic, ...result.reportable].filter((n) => n.mentionRate < 0.4).sort((a, b) => b.positive - a.positive).slice(0, 3);
  if (weak.length) lines.push('提及率短板：' + weak.map((n) => (n.blogger || '未知博主') + '（正向' + n.positive + '条，提及率' + Math.round(n.mentionRate * 100) + '%）').join('；') + '，建议补产品盖楼话术顶上前三屏。');
  if (result.needReply.length) { const t = result.needReply.slice(0, 2); lines.push('待回复' + result.counts.needReply + '篇，如' + t.map((n) => (n.blogger || '未知博主') + '"' + (n.replyHits[0] || '').slice(0, 24) + '..."').join('；') + '，需达人24小时内回。'); }
  if (result.needDelete.length) { const t = result.needDelete.slice(0, 2); lines.push('待删除' + result.counts.needDelete + '篇，如' + t.map((n) => (n.blogger || '未知博主') + '（' + (n.deleteHits[0] || '').slice(0, 20) + '...）').join('；') + '，已入处置队列。'); }
  return lines;
}
export function reviewSummary(result: ReviewResult): string[] {
  return [
    result.dateKey + ' 共覆盖 ' + result.noteCount + ' 篇笔记、' + result.rowCount + ' 条执行评论。',
    '可汇报 ' + result.counts.reportable + ' 篇（200条正向且产品提及40%+），达基础线 ' + result.counts.basic + ' 篇（正向30条+）。',
    '待补充 ' + result.counts.needSupplement + ' 篇（不足30条），需回复 ' + result.counts.needReply + ' 篇，需删除处置 ' + result.counts.needDelete + ' 篇（已存处置队列，不进入汇报）。',
  ];
}
export async function persistReviewBatch(d1: MiniDb, project: string, result: ReviewResult): Promise<string> {
  await ensureReviewTables(d1);
  const canonicalBatchId = 'batch:' + project + ':' + result.dateKey;
  const now = new Date().toISOString();
  await d1.prepare('INSERT INTO note_review_batches(id,project_id,date_key,counts_json,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET counts_json=excluded.counts_json,created_at=excluded.created_at')
    .bind(canonicalBatchId, project, result.dateKey, JSON.stringify(result.counts), now).run();
  const items: Array<{ n: ClassifiedNote; action: string; reason: string }> = [];
  for (const n of result.needReply) items.push({ n, action: 'needReply', reason: n.replyHits[0] || '用户问询待达人回复' });
  for (const n of result.needDelete) items.push({ n, action: 'needDelete', reason: n.deleteHits[0] || '命中删除口径' });
  for (const n of result.needSupplement) items.push({ n, action: 'needSupplement', reason: '正向' + n.positive + '条，还差' + n.supplementNeed + '条' });

  const activeKeys = new Set<string>();
  const upsertStmts = [];

  for (const it of items) {
    const itemKey = makeItemKey(project, it.n.link, 'supplier_review', it.action);
    activeKeys.add(itemKey);

    upsertStmts.push(d1.prepare(`
      INSERT INTO review_action_items(
        batch_id, project_id, date_key, link, blogger, action, reason, sample_json, status, created_at, item_key, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '待处理', ?, ?, 1)
      ON CONFLICT(project_id, item_key) DO UPDATE SET
        batch_id = excluded.batch_id,
        date_key = excluded.date_key,
        link = excluded.link,
        blogger = excluded.blogger,
        reason = excluded.reason,
        sample_json = excluded.sample_json,
        active = 1,
        status = CASE WHEN review_action_items.status = '已处理' THEN '已处理' WHEN review_action_items.status = '已失效' THEN '待处理' ELSE review_action_items.status END,
        obsolete_at = NULL,
        obsolete_reason = NULL
    `).bind(
      canonicalBatchId, project, result.dateKey, it.n.link, it.n.blogger, it.action,
      it.reason, JSON.stringify(it.n.samples.slice(0, 2)), now, itemKey
    ));
  }

  if (upsertStmts.length > 0) {
    await d1.batch(upsertStmts);
  }

  // Obsolete handling: Pending items of same project and source that are no longer hit
  const existingPending = await d1.prepare(
    "SELECT id, item_key FROM review_action_items WHERE project_id=? AND status='待处理' AND item_key LIKE ?"
  ).bind(project, `${project}:%:supplier_review:%`).all<{ id: number; item_key: string }>();

  const obsoleteIds = [];
  for (const row of existingPending.results || []) {
    if (row.item_key && !activeKeys.has(row.item_key)) {
      obsoleteIds.push(row.id);
    }
  }
  if (obsoleteIds.length > 0) {
    for (let i = 0; i < obsoleteIds.length; i += 80) {
      const slice = obsoleteIds.slice(i, i + 80);
      const placeholders = slice.map(() => '?').join(',');
      await d1.prepare(
        `UPDATE review_action_items SET active=0, status='已失效', obsolete_at=?, obsolete_reason='规则重算后不再满足判定待办' WHERE id IN (${placeholders})`
      ).bind(now, ...slice).run();
    }
  }

  return canonicalBatchId;
}

let migrationDone = false;

export async function runReviewMigration(d1: MiniDb): Promise<void> {
  await d1.prepare('CREATE TABLE IF NOT EXISTS note_review_batches(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,date_key TEXT NOT NULL,counts_json TEXT NOT NULL DEFAULT "{}",created_at TEXT NOT NULL)').run();
  await d1.prepare('CREATE TABLE IF NOT EXISTS review_action_items(id INTEGER PRIMARY KEY AUTOINCREMENT,batch_id TEXT NOT NULL,project_id TEXT NOT NULL,date_key TEXT NOT NULL,link TEXT NOT NULL DEFAULT "",blogger TEXT NOT NULL DEFAULT "",action TEXT NOT NULL,reason TEXT NOT NULL DEFAULT "",sample_json TEXT NOT NULL DEFAULT "[]",status TEXT NOT NULL DEFAULT "待处理",created_at TEXT NOT NULL,item_key TEXT,active INTEGER NOT NULL DEFAULT 1,obsolete_at TEXT,obsolete_reason TEXT,handled_at TEXT,treatment_method TEXT)').run();

  const cols = await d1.prepare('PRAGMA table_info(review_action_items)').all<{ name: string }>();
  const colNames = new Set((cols.results || []).map((c) => c.name));
  if (!colNames.has('item_key')) await d1.prepare('ALTER TABLE review_action_items ADD COLUMN item_key TEXT').run().catch(() => undefined);
  if (!colNames.has('active')) await d1.prepare('ALTER TABLE review_action_items ADD COLUMN active INTEGER NOT NULL DEFAULT 1').run().catch(() => undefined);
  if (!colNames.has('obsolete_at')) await d1.prepare('ALTER TABLE review_action_items ADD COLUMN obsolete_at TEXT').run().catch(() => undefined);
  if (!colNames.has('obsolete_reason')) await d1.prepare('ALTER TABLE review_action_items ADD COLUMN obsolete_reason TEXT').run().catch(() => undefined);
  if (!colNames.has('handled_at')) await d1.prepare('ALTER TABLE review_action_items ADD COLUMN handled_at TEXT').run().catch(() => undefined);
  if (!colNames.has('treatment_method')) await d1.prepare('ALTER TABLE review_action_items ADD COLUMN treatment_method TEXT').run().catch(() => undefined);

  // Step 1: Canonical batch migration
  const allBatches = await d1.prepare('SELECT id, project_id, date_key, counts_json, created_at FROM note_review_batches ORDER BY created_at DESC').all<{
    id: string; project_id: string; date_key: string; counts_json: string; created_at: string;
  }>();
  const batchGroups = new Map<string, Array<typeof allBatches.results[0]>>();
  for (const b of allBatches.results || []) {
    const key = b.project_id + ':' + b.date_key;
    if (!batchGroups.has(key)) batchGroups.set(key, []);
    batchGroups.get(key)!.push(b);
  }

  for (const [key, group] of batchGroups.entries()) {
    const [proj, dateKey] = key.split(':');
    const canonicalId = 'batch:' + proj + ':' + dateKey;
    // Pick winner: prefer one whose id is already canonical, else the newest
    const winner = group.find((b) => b.id === canonicalId) || group[0];
    // Upsert canonical batch
    await d1.prepare('INSERT OR REPLACE INTO note_review_batches(id, project_id, date_key, counts_json, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(canonicalId, proj, dateKey, winner.counts_json, winner.created_at).run();
    // Repoint all duplicate batch items to canonical
    for (const b of group) {
      if (b.id !== canonicalId) {
        await d1.prepare('UPDATE review_action_items SET batch_id=? WHERE batch_id=?').bind(canonicalId, b.id).run();
        await d1.prepare('DELETE FROM note_review_batches WHERE id=?').bind(b.id).run();
      }
    }
    // Verify canonical batch exists
    const check = await d1.prepare('SELECT id FROM note_review_batches WHERE id=?').bind(canonicalId).first();
    if (!check) throw new Error(`Canonical batch migration failed for ${canonicalId}`);
  }

  // Step 2: Deduplicate items and truly backfill item_key in SQLite
  const allItems = await d1.prepare('SELECT id, batch_id, project_id, date_key, link, action, status, item_key FROM review_action_items ORDER BY id ASC').all<{
    id: number; batch_id: string; project_id: string; date_key: string; link: string; action: string; status: string; item_key?: string;
  }>();

  const itemGroups = new Map<string, Array<typeof allItems.results[0] & { computedKey: string }>>();
  for (const it of allItems.results || []) {
    const computedKey = it.item_key && it.item_key.includes(':') && !it.item_key.includes(':undefined:')
      ? it.item_key
      : makeItemKey(it.project_id, it.link, 'supplier_review', it.action);
    const groupKey = it.project_id + '::' + computedKey;
    if (!itemGroups.has(groupKey)) itemGroups.set(groupKey, []);
    itemGroups.get(groupKey)!.push({ ...it, computedKey });
  }

  for (const [, group] of itemGroups.entries()) {
    const targetKey = group[0].computedKey;
    // Winner preserves '已处理', else latest id
    const winner = group.find((g) => g.status === '已处理') || group[group.length - 1];
    // Truly write item_key to DB for the winner
    await d1.prepare('UPDATE review_action_items SET item_key=?, active=1 WHERE id=?').bind(targetKey, winner.id).run();
    // Delete other duplicate items
    for (const other of group) {
      if (other.id !== winner.id) {
        await d1.prepare('DELETE FROM review_action_items WHERE id=?').bind(other.id).run();
      }
    }
  }

  // Verify no NULL item_keys remain
  const nullKeys = await d1.prepare("SELECT COUNT(*) AS count FROM review_action_items WHERE item_key IS NULL OR item_key = ''").first<{ count: number }>();
  if (Number(nullKeys?.count || 0) > 0) {
    const remainingNulls = await d1.prepare("SELECT id, project_id, link, action FROM review_action_items WHERE item_key IS NULL OR item_key = ''").all<{
      id: number; project_id: string; link: string; action: string;
    }>();
    for (const r of remainingNulls.results || []) {
      const ik = makeItemKey(r.project_id, r.link, 'supplier_review', r.action);
      await d1.prepare('UPDATE review_action_items SET item_key=? WHERE id=?').bind(ik, r.id).run();
    }
  }

  // Step 3: Create unique indexes (must NOT catch silently, must throw on error)
  await d1.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_note_review_batches_key ON note_review_batches(project_id, date_key)').run();
  await d1.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_review_action_items_key ON review_action_items(project_id, item_key)').run();
  await d1.prepare('CREATE INDEX IF NOT EXISTS idx_review_action_items_status ON review_action_items(project_id, status)').run().catch(() => undefined);
  await d1.prepare('CREATE INDEX IF NOT EXISTS idx_review_action_items_active ON review_action_items(project_id, active)').run().catch(() => undefined);
  await d1.prepare('CREATE INDEX IF NOT EXISTS idx_review_action_items_date ON review_action_items(project_id, date_key)').run().catch(() => undefined);

  migrationDone = true;
}

export async function ensureReviewTables(d1: MiniDb): Promise<void> {
  if (migrationDone) return;
  await runReviewMigration(d1);
}
