import seedDates from '../data/qicui/supplier-seed.json';
import { classifyNotes, type ReviewResult, type SeedNote } from './comment-review';
import { db } from './db';
type SeedEntry = { sheets: Array<{ name: string; kind: string; rows: number; notes: number }>; notes: SeedNote[] };
const cache = seedDates as unknown as { dates: Record<string, SeedEntry> };
function mergeNotes(lists: SeedNote[][]): SeedNote[] {
  const merged = new Map<string, SeedNote>();
  for (const list of lists) {
    for (const n of list) {
      const m = merged.get(n.link);
      if (!m) {
        merged.set(n.link, { ...n, sheets: [...n.sheets], samples: [...n.samples].slice(0, 4), forms: { ...n.forms } });
      } else {
        m.count += n.count;
        for (const s of n.sheets) if (!m.sheets.includes(s)) m.sheets.push(s);
        for (const k of Object.keys(n.forms)) m.forms[k] = (m.forms[k] || 0) + n.forms[k];
        m.samples = [...m.samples, ...n.samples].slice(0, 4);
      }
    }
  }
  return [...merged.values()];
}
export async function reviewByDate(dateKey: string, project = 'qicui'): Promise<ReviewResult | null> {
  if (project === 'qicui' && cache.dates && cache.dates[dateKey]) {
    const keys = Object.keys(cache.dates).filter((k) => k <= dateKey).sort();
    if (!keys.length) return null;
    const sheets = keys.flatMap((k) => cache.dates[k].sheets);
    const notes = mergeNotes(keys.map((k) => cache.dates[k].notes));
    const result = classifyNotes(dateKey, notes);
    result.sheets = sheets;
    return result;
  }

  const d1 = db();
  const rows = await d1.prepare(
    'SELECT note_id, note_url, creator, planned_content, comment_format, visibility FROM supplier_comments WHERE project_id=?'
  ).bind(project).all<{
    note_id: string; note_url: string; creator: string; planned_content: string; comment_format: string; visibility: string;
  }>().catch(() => ({ results: [] }));

  if (!rows.results || rows.results.length === 0) {
    return null;
  }

  const noteMap = new Map<string, SeedNote>();
  for (const r of rows.results) {
    const key = r.note_url || r.note_id;
    let n = noteMap.get(key);
    if (!n) {
      n = {
        link: r.note_url || ('https://www.xiaohongshu.com/explore/' + r.note_id),
        blogger: r.creator || '供应商达人',
        sheets: ['供应商执行数据'],
        count: 0,
        forms: {},
        samples: [],
      };
      noteMap.set(key, n);
    }
    n.count += 1;
    const fmt = r.comment_format || '纯文案';
    n.forms[fmt] = (n.forms[fmt] || 0) + 1;
    if (n.samples.length < 10) {
      n.samples.push({ t: r.planned_content, f: fmt, r: '执行评论', b: '', p: '' });
    }
  }
  const notesList = [...noteMap.values()];
  const result = classifyNotes(dateKey, notesList);
  result.sheets = [{ name: '供应商执行数据', kind: 'supplier', rows: rows.results.length, notes: notesList.length }];
  return result;
}
export async function availableReviewDates(project = 'qicui'): Promise<string[]> {
  const d1 = db();
  const rows = await d1.prepare('SELECT DISTINCT date_key FROM note_review_batches WHERE project_id=? ORDER BY date_key').bind(project).all<{ date_key: string }>().catch(() => ({ results: [] }));
  const dates = new Set((rows.results || []).map((r) => r.date_key));
  if (project === 'qicui') {
    for (const k of Object.keys(cache.dates)) dates.add(k);
  }
  return [...dates].sort();
}
