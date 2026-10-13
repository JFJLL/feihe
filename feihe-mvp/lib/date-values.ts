// Parse calendar values independently of the execution host's timezone.
export const DEFAULT_PROJECT_TIME_ZONE = 'Asia/Shanghai';

function zonedParts(time: number, timeZone: string): number[] {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(time);
  return ['year', 'month', 'day', 'hour', 'minute', 'second'].map(k => Number(parts.find(p => p.type === k)?.value));
}

export function parseProjectDate(value: unknown, timeZone = DEFAULT_PROJECT_TIME_ZONE): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) && Number.isFinite(new Date(value).getTime()) ? value : null; // Feishu epoch milliseconds
  const input = String(value).trim();
  const match = input.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/);
  if (!match) return null;
  const fields = [Number(match[1]), Number(match[2]), Number(match[3] || 1), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0)];
  const [year, month, day, hour, minute, second] = fields;
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, Number((match[7] || '').padEnd(3, '0')));
  const check = new Date(utc);
  if (year < 100 || month < 1 || month > 12 || day < 1 || check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null;
  if (match[8]) {
    const suffix = match[8];
    if (suffix === 'Z') return utc;
    const offset = suffix.slice(1).replace(':', '');
    const h = Number(offset.slice(0, 2)), m = Number(offset.slice(2));
    if (h > 23 || m > 59) return null;
    return utc - (suffix[0] === '+' ? 1 : -1) * (h * 60 + m) * 60000;
  }
  try {
    let instant = utc;
    for (let i = 0; i < 3; i++) {
      const p = zonedParts(instant, timeZone);
      const localAsUtc = Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5], new Date(instant).getUTCMilliseconds());
      instant += utc - localAsUtc;
    }
    return zonedParts(instant, timeZone).every((v, i) => v === fields[i]) ? instant : null;
  } catch { return null; }
}

export function endDayExclusive(day: string, timeZone = DEFAULT_PROJECT_TIME_ZONE): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || parseProjectDate(day, timeZone) === null) return null;
  const [y, m, d] = day.split('-').map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return parseProjectDate(nextDay, timeZone);
}
