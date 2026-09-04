import type { ReportSpec } from './report-agent';
import type { ClassifiedNote, ReviewResult } from './comment-review';
import type { MiniDb } from './db';
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
  const batchId = 'batch:' + project + ':' + result.dateKey;
  const now = new Date().toISOString();
  await d1.prepare('INSERT INTO note_review_batches(id,project_id,date_key,counts_json,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET counts_json=excluded.counts_json,created_at=excluded.created_at')
    .bind(batchId, project, result.dateKey, JSON.stringify(result.counts), now).run();
  const items: Array<{ n: ClassifiedNote; action: string; reason: string }> = [];
  for (const n of result.needReply) items.push({ n, action: 'needReply', reason: n.replyHits[0] || '用户问询待达人回复' });
  for (const n of result.needDelete) items.push({ n, action: 'needDelete', reason: n.deleteHits[0] || '命中删除口径' });
  for (const n of result.needSupplement) items.push({ n, action: 'needSupplement', reason: '正向' + n.positive + '条，还差' + n.supplementNeed + '条' });
  for (const it of items) {
    const itemKey = result.dateKey + ':' + shortLink(it.n.link) + ':' + it.action;
    const existing = await d1.prepare('SELECT id, status FROM review_action_items WHERE project_id=? AND item_key=?').bind(project, itemKey).first<{ id: number; status: string }>();
    if (existing) {
      await d1.prepare('UPDATE review_action_items SET batch_id=?, link=?, blogger=?, reason=?, sample_json=? WHERE id=?')
        .bind(batchId, it.n.link, it.n.blogger, it.reason, JSON.stringify(it.n.samples.slice(0, 2)), existing.id).run();
    } else {
      await d1.prepare('INSERT INTO review_action_items(batch_id,project_id,date_key,link,blogger,action,reason,sample_json,status,created_at,item_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
        .bind(batchId, project, result.dateKey, it.n.link, it.n.blogger, it.action, it.reason, JSON.stringify(it.n.samples.slice(0, 2)), '待处理', now, itemKey).run();
    }
  }
  return batchId;
}

export async function ensureReviewTables(d1: MiniDb): Promise<void> {
  await d1.prepare('CREATE TABLE IF NOT EXISTS note_review_batches(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,date_key TEXT NOT NULL,counts_json TEXT NOT NULL DEFAULT "{}",created_at TEXT NOT NULL)').run();
  await d1.prepare('CREATE TABLE IF NOT EXISTS review_action_items(id INTEGER PRIMARY KEY AUTOINCREMENT,batch_id TEXT NOT NULL,project_id TEXT NOT NULL,date_key TEXT NOT NULL,link TEXT NOT NULL DEFAULT "",blogger TEXT NOT NULL DEFAULT "",action TEXT NOT NULL,reason TEXT NOT NULL DEFAULT "",sample_json TEXT NOT NULL DEFAULT "[]",status TEXT NOT NULL DEFAULT "待处理",created_at TEXT NOT NULL)').run();

  const cols = await d1.prepare('PRAGMA table_info(review_action_items)').all<{ name: string }>();
  const hasItemKey = (cols.results || []).some((c) => c.name === 'item_key');
  if (!hasItemKey) {
    await d1.prepare('ALTER TABLE review_action_items ADD COLUMN item_key TEXT').run().catch(() => undefined);
  }

  const allBatches = await d1.prepare('SELECT id, project_id, date_key, counts_json, created_at FROM note_review_batches ORDER BY created_at DESC').all<{
    id: string; project_id: string; date_key: string; counts_json: string; created_at: string;
  }>();
  const seenBatches = new Map<string, string>();
  for (const b of allBatches.results || []) {
    const key = b.project_id + ':' + b.date_key;
    const canonicalId = 'batch:' + b.project_id + ':' + b.date_key;
    if (!seenBatches.has(key)) {
      seenBatches.set(key, b.id);
      if (b.id !== canonicalId) {
        await d1.prepare('INSERT OR REPLACE INTO note_review_batches(id, project_id, date_key, counts_json, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(canonicalId, b.project_id, b.date_key, b.counts_json, b.created_at).run();
        await d1.prepare('UPDATE review_action_items SET batch_id=? WHERE batch_id=?').bind(canonicalId, b.id).run();
        await d1.prepare('DELETE FROM note_review_batches WHERE id=?').bind(b.id).run();
      }
    } else {
      await d1.prepare('DELETE FROM note_review_batches WHERE id=?').bind(b.id).run();
    }
  }

  const allItems = await d1.prepare('SELECT id, batch_id, project_id, date_key, link, action, status, item_key FROM review_action_items ORDER BY id ASC').all<{
    id: number; batch_id: string; project_id: string; date_key: string; link: string; action: string; status: string; item_key?: string;
  }>();
  const itemGroups = new Map<string, Array<typeof allItems.results[0]>>();
  for (const it of allItems.results || []) {
    const ik = it.item_key || (it.date_key + ':' + shortLink(it.link) + ':' + it.action);
    const groupKey = it.project_id + ':' + ik;
    if (!itemGroups.has(groupKey)) {
      itemGroups.set(groupKey, []);
    }
    itemGroups.get(groupKey)!.push({ ...it, item_key: ik });
  }

  for (const [, group] of itemGroups.entries()) {
    const targetItemKey = group[0].item_key!;
    const winner = group.find((g) => g.status === '已处理') || group[0];
    if (winner.item_key !== targetItemKey || !winner.item_key) {
      await d1.prepare('UPDATE review_action_items SET item_key=? WHERE id=?').bind(targetItemKey, winner.id).run();
    }
    for (const other of group) {
      if (other.id !== winner.id) {
        await d1.prepare('DELETE FROM review_action_items WHERE id=?').bind(other.id).run();
      }
    }
  }

  await d1.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_review_action_items_key ON review_action_items(project_id, item_key)').run().catch(() => undefined);
  await d1.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_note_review_batches_key ON note_review_batches(project_id, date_key)').run().catch(() => undefined);
  await d1.prepare('CREATE INDEX IF NOT EXISTS idx_review_action_items_status ON review_action_items(project_id, status)').run().catch(() => undefined);
  await d1.prepare('CREATE INDEX IF NOT EXISTS idx_review_action_items_date ON review_action_items(project_id, date_key)').run().catch(() => undefined);
}
