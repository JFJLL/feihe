import type { ReportSpec } from './report-agent';
import type { ClassifiedNote, ReviewResult } from './comment-review';
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
export async function persistReviewBatch(d1: any, project: string, result: ReviewResult): Promise<string> {
  const batchId = crypto.randomUUID();
  const now = new Date().toISOString();
  await d1.prepare('INSERT INTO note_review_batches(id,project_id,date_key,counts_json,created_at) VALUES(?,?,?,?,?)')
    .bind(batchId, project, result.dateKey, JSON.stringify(result.counts), now).run();
  const items: Array<{ n: ClassifiedNote; action: string; reason: string }> = [];
  for (const n of result.needReply) items.push({ n, action: 'needReply', reason: n.replyHits[0] || '用户问询待达人回复' });
  for (const n of result.needDelete) items.push({ n, action: 'needDelete', reason: n.deleteHits[0] || '命中删除口径' });
  for (const n of result.needSupplement) items.push({ n, action: 'needSupplement', reason: '正向' + n.positive + '条，还差' + n.supplementNeed + '条' });
  for (const it of items.slice(0, 300)) {
    await d1.prepare('INSERT INTO review_action_items(batch_id,project_id,date_key,link,blogger,action,reason,sample_json,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .bind(batchId, project, result.dateKey, it.n.link, it.n.blogger, it.action, it.reason, JSON.stringify(it.n.samples.slice(0, 2)), '待处理', now).run();
  }
  return batchId;
}

export async function ensureReviewTables(d1: any): Promise<void> {
  await d1.prepare('CREATE TABLE IF NOT EXISTS note_review_batches(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,date_key TEXT NOT NULL,counts_json TEXT NOT NULL DEFAULT "{}",created_at TEXT NOT NULL)').run();
  await d1.prepare('CREATE TABLE IF NOT EXISTS review_action_items(id INTEGER PRIMARY KEY AUTOINCREMENT,batch_id TEXT NOT NULL,project_id TEXT NOT NULL,date_key TEXT NOT NULL,link TEXT NOT NULL DEFAULT "",blogger TEXT NOT NULL DEFAULT "",action TEXT NOT NULL,reason TEXT NOT NULL DEFAULT "",sample_json TEXT NOT NULL DEFAULT "[]",status TEXT NOT NULL DEFAULT "待处理",created_at TEXT NOT NULL)').run();
}
