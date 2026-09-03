import seedDates from '../data/qicui/supplier-seed.json';
import { classifyNotes, type ReviewResult, type SeedNote } from './comment-review';
type SeedEntry = { sheets: Array<{ name: string; kind: string; rows: number; notes: number }>; notes: SeedNote[] };
const cache = seedDates as unknown as { dates: Record<string, SeedEntry> };
export async function reviewByDate(dateKey: string): Promise<ReviewResult | null> {
  const entry = cache.dates[dateKey];
  if (!entry) return null;
  const result = classifyNotes(dateKey, entry.notes);
  result.sheets = entry.sheets;
  return result;
}
export async function availableReviewDates(): Promise<string[]> {
  return Object.keys(cache.dates).sort();
}
