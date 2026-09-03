import { promises as fs } from 'fs';
import path from 'path';
import { classifyNotes, type ReviewResult, type SeedNote } from './comment-review';
let cache: Record<string, { sheets: Array<{ name: string; kind: string; rows: number; notes: number }>; notes: SeedNote[] }> | null = null;
async function loadSeed() {
  if (cache) return cache;
  const p = path.join(process.cwd(), 'data', 'qicui', 'supplier-seed.json');
  const raw = await fs.readFile(p, 'utf-8');
  const parsed = JSON.parse(raw) as { dates: Record<string, { sheets: Array<{ name: string; kind: string; rows: number; notes: number }>; notes: SeedNote[] }> };
  cache = parsed.dates;
  return cache;
}
export async function reviewByDate(dateKey: string): Promise<ReviewResult | null> {
  const seed = await loadSeed();
  const entry = seed[dateKey];
  if (!entry) return null;
  const result = classifyNotes(dateKey, entry.notes);
  result.sheets = entry.sheets;
  return result;
}
export async function availableReviewDates(): Promise<string[]> {
  const seed = await loadSeed();
  return Object.keys(seed).sort();
}
