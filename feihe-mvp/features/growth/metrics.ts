/** Keep missing observations distinct from measured zero. */
export function numeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim().replace(/,/g, '');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)万?$/.test(text)) return null;
  const result = Number(text.replace(/万$/, '')) * (text.endsWith('万') ? 10000 : 1);
  return Number.isFinite(result) ? result : null;
}
export function ratio(numerator: unknown, denominator: unknown): number | null {
  const n = numeric(numerator), d = numeric(denominator);
  return n !== null && d !== null && d > 0 ? n / d : null;
}
export function display(value: unknown): string {
  const n = numeric(value);
  return n === null ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}
export function compactMetric(value: unknown): string {
  const n = numeric(value);
  return n === null ? '—' : new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
export function percent(value: unknown): string {
  const n = numeric(value);
  return n === null ? '—' : `${(n * 100).toFixed(1)}%`;
}
/** Do not present partial observations as a complete total. */
export function completeSum(values: unknown[]): number | null {
  const numbers = values.map(numeric);
  return !numbers.length || numbers.some(n => n === null) ? null : numbers.reduce<number>((sum, n) => sum + n!, 0);
}
export function change(current: unknown, previous: unknown): number | null {
  const c = numeric(current), p = numeric(previous);
  return c !== null && p !== null && p > 0 ? (c - p) / p : null;
}

export function previousMonth(month: string): string | null {
  const dated = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (dated) {
    const year = Number(dated[1]), number = Number(dated[2]);
    if (number === 1) return year > 0 ? `${String(year - 1).padStart(4, '0')}-12` : null;
    return `${dated[1]}-${String(number - 1).padStart(2, '0')}`;
  }
  const undated = /^(0[1-9]|1[0-2])月$/.exec(month);
  if (!undated || Number(undated[1]) === 1) return null;
  return `${String(Number(undated[1]) - 1).padStart(2, '0')}月`;
}
