export type PercentScale = 'fraction' | 'percentage_points';

export function percentagePointsToFraction(value: number) {
  const [significand, exponent] = value.toExponential().split('e');
  return Number(`${significand}e${Number(exponent) - 2}`);
}

// Tagged percent text is converted to a fraction once. Bare numbers retain their unit.
export function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/^[￥¥]\s*/, '').replace(/%$/, '').trim();
  const plain = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  const grouped = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?(?:e[+-]?\d+)?$/i;
  if (!plain.test(text) && !grouped.test(text)) return null;
  const number = Number(text.replaceAll(',', ''));
  return Number.isFinite(number) ? (/%$/.test(value.trim()) ? percentagePointsToFraction(number) : number) : null;
}
