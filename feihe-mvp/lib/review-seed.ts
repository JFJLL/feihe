import seedDates from '../data/qicui/supplier-seed.json';
import { classifyNotes, type AcceptanceCriteria, type ReviewResult, type SeedNote } from './comment-review';
import { db, type MiniDb } from './db';
type SeedEntry = { sheets: Array<{ name: string; kind: string; rows: number; notes: number }>; notes: SeedNote[] };
const cache = seedDates as unknown as { dates: Record<string, SeedEntry> };
const qicuiSeedMemo = new Map<string, ReviewResult>();
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
async function getProjectAcceptance(d1: MiniDb, project: string): Promise<AcceptanceCriteria> {
  const defaultVal: AcceptanceCriteria = { reportCount: 200, baseCount: 30, brandTopRate: 0.4, freshnessHours: 24 };
  try {
    const row = await d1.prepare('SELECT value FROM project_settings WHERE project_id=? AND key=?').bind(project, 'acceptance').first<{ value: string }>();
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      return {
        reportCount: Math.max(1, Number(parsed.reportCount || 200)),
        baseCount: Math.max(1, Number(parsed.baseCount || 30)),
        brandTopRate: Math.min(1, Math.max(0, Number(parsed.brandTopRate ?? 0.4))),
        freshnessHours: Math.max(1, Number(parsed.freshnessHours || 24)),
      };
    }
  } catch {}
  return defaultVal;
}

export async function reviewByDate(project: string, dateKey: string): Promise<ReviewResult | null> {
  if (!project) throw new Error('project is required for reviewByDate');
  const d1 = db();
  const acceptance = await getProjectAcceptance(d1, project);

  if (project === 'qicui' && cache.dates && cache.dates[dateKey]) {
    const memoKey = dateKey + ':' + JSON.stringify(acceptance);
    const memoized = qicuiSeedMemo.get(memoKey);
    if (memoized) {
      return JSON.parse(JSON.stringify(memoized));
    }
    const keys = Object.keys(cache.dates).filter((k) => k <= dateKey).sort();
    if (!keys.length) return null;
    const sheets = keys.flatMap((k) => cache.dates[k].sheets);
    const notes = mergeNotes(keys.map((k) => cache.dates[k].notes));
    const result = classifyNotes(dateKey, notes, acceptance);
    result.sheets = sheets;
    qicuiSeedMemo.set(memoKey, result);
    return result;
  }

  const rows = await d1.prepare(
    'SELECT note_id, note_url, creator, planned_content, matched_content, comment_format, visibility FROM supplier_comments WHERE project_id=?'
  ).bind(project).all<{
    note_id: string; note_url: string; creator: string; planned_content: string; matched_content?: string; comment_format: string; visibility: string;
  }>().catch(() => ({ results: [] }));

  if (!rows.results || rows.results.length === 0) {
    return null;
  }

  // Non-qicui projects must have real verified records or matched_content
  const verifiedRows = rows.results.filter((r) =>
    r.visibility === '当前外显-原文一致' || r.visibility === '当前外显-有修改' || Boolean(r.matched_content)
  );
  if (verifiedRows.length === 0) {
    return null;
  }

  const noteMap = new Map<string, SeedNote>();
  for (const r of verifiedRows) {
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
      n.samples.push({ t: r.matched_content || r.planned_content, f: fmt, r: '执行评论', b: '', p: '' });
    }
  }
  const notesList = [...noteMap.values()];
  const result = classifyNotes(dateKey, notesList, acceptance);
  result.sheets = [{ name: '供应商执行数据', kind: 'supplier', rows: verifiedRows.length, notes: notesList.length }];
  return result;
}
export async function availableReviewDates(project: string): Promise<string[]> {
  if (!project) return [];
  const d1 = db();
  const rows = await d1.prepare('SELECT DISTINCT date_key FROM note_review_batches WHERE project_id=? ORDER BY date_key').bind(project).all<{ date_key: string }>().catch(() => ({ results: [] }));
  const dates = new Set((rows.results || []).map((r) => r.date_key));
  if (project === 'qicui') {
    for (const k of Object.keys(cache.dates)) dates.add(k);
  }
  return [...dates].sort();
}
