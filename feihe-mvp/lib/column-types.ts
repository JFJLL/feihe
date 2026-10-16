import { parseNumericValue } from './numeric-values';
import { parseProjectDate } from './date-values';

export function inferColumnType(values: unknown[]): 'text' | 'number' | 'date' | 'boolean' | 'category' {
  const present = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (!present.length) return 'text';
  if (present.every(v => typeof v === 'boolean' || /^(true|false|是|否|yes|no)$/i.test(String(v).trim()))) return 'boolean';
  if (present.every(v => parseNumericValue(v) !== null)) return 'number';
  if (present.every(v => typeof v === 'string' && parseProjectDate(v) !== null)) return 'date';
  return 'text';
}
