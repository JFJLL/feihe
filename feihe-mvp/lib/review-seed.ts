import seedDates from '../data/qicui/supplier-seed.json';
import { classifyNotes, type ReviewResult, type SeedNote } from './comment-review';
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
export async function reviewByDate(dateKey: string): Promise<ReviewResult | null> {
  const keys = Object.keys(cache.dates).filter((k) => k <= dateKey).sort();
  if (!keys.length) return null;
  const sheets = keys.flatMap((k) => cache.dates[k].sheets);
  const notes = mergeNotes(keys.map((k) => cache.dates[k].notes));
  const result = classifyNotes(dateKey, notes);
  result.sheets = sheets;
  return result;
}
export async function availableReviewDates(): Promise<string[]> {
  return Object.keys(cache.dates).sort();
}
