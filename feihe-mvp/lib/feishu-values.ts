export function normalizeBitableValue(val: unknown): unknown {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(normalizeBitableValue).filter(v => v !== '').join(', ');
  const obj = val as Record<string, unknown>;
  for (const key of ['text', 'name', 'label', 'link', 'value']) if (obj[key] !== undefined) return normalizeBitableValue(obj[key]);
  return JSON.stringify(obj);
}
export function normalizeBitableFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, normalizeBitableValue(value)]));
}
export function spreadsheetColumn(index: number) {
  let result = '';
  while (index > 0) { index--; result = String.fromCharCode(65 + index % 26) + result; index = Math.floor(index / 26); }
  return result || 'A';
}
