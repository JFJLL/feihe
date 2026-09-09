/** Source numbering is retained in storage, but omitted from category labels. */
export function contentDirectionLabel(value: unknown, fallback = '未标注'): string {
  return String(value ?? '').trim().replace(/^\d+\s*[-－—]\s*/, '') || fallback;
}

export function aggregateTopics(rows: Array<{ name?: unknown; count?: unknown }>) {
  const counts = new Map<string, number>();
  let unclassified = 0;
  for (const row of rows) {
    const text = String(row.name ?? '').trim();
    const count = Number(row.count);
    if (!Number.isFinite(count) || count <= 0) continue;
    if (!text || ['其他', '未标注', '待补充'].includes(text)) { unclassified += count; continue; }
    counts.set(text, (counts.get(text) || 0) + count);
  }
  return { words: [...counts].map(([text, count]) => ({ text, count })).sort((a, b) => b.count - a.count), unclassified };
}

export function trimEmptyTrendEdges<T extends Record<string, unknown>>(rows: T[], keys: string[]): T[] {
  const valid = (row: T) => keys.some(key => typeof row[key] === 'number' && Number.isFinite(row[key]));
  const first = rows.findIndex(valid);
  if (first < 0) return [];
  let last = rows.length - 1;
  while (!valid(rows[last])) last--;
  return rows.slice(first, last + 1);
}

export function boxStatistics(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const quantile = (p: number) => {
    const index = (sorted.length - 1) * p;
    const lo = Math.floor(index), hi = Math.ceil(index);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
  };
  return { min: sorted[0], q1: quantile(.25), median: quantile(.5), q3: quantile(.75), max: sorted.at(-1)!, count: sorted.length };
}
