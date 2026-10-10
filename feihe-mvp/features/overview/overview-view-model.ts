type MetricRow = Record<string, string | number | null>;

export function finiteMetric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function sumMetric(rows: MetricRow[], key: string): number | null {
  const values = rows.map(row => finiteMetric(row[key])).filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

export function matchedBudget(rows: MetricRow[]) {
  const matched = rows.filter(row => finiteMetric(row.actual_spend) !== null && finiteMetric(row.plan_spend) !== null);
  return { spend: sumMetric(matched, 'actual_spend'), plan: sumMetric(matched, 'plan_spend'), count: matched.length };
}

export function getQuarterInfo(date: string) {
  const m = date && date.length >= 7 ? Number(date.slice(5, 7)) : 7;
  const year = date && date.length >= 4 ? date.slice(0, 4) : '2026';
  if (m >= 10) {
    return { name: 'Q4', start: `${year}-10-01`, end: `${year}-12-31`, totalDays: 92, startZh: '10月1日' };
  }
  if (m >= 7) {
    return { name: 'Q3', start: `${year}-07-01`, end: `${year}-09-30`, totalDays: 92, startZh: '7月1日' };
  }
  if (m >= 4) {
    return { name: 'Q2', start: `${year}-04-01`, end: `${year}-06-30`, totalDays: 91, startZh: '4月1日' };
  }
  return { name: 'Q1', start: `${year}-01-01`, end: `${year}-03-31`, totalDays: 90, startZh: '1月1日' };
}

export function overviewPeriod(source: MetricRow[], selected: string) {
  const rows = source.filter(row => String(row.date) >= '2026-07-01').sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const daily = rows.find(row => row.date === selected) || rows.at(-1);
  const date = String(daily?.date || '');
  const qInfo = getQuarterInfo(date);
  // quarterRows tracks from the quarter start up to the selected date
  const quarterRows = rows.filter(row => String(row.date) >= qInfo.start && String(row.date) <= date);
  const monthRows = quarterRows.filter(row => String(row.date).slice(0, 7) === date.slice(0, 7));
  const monthDay = date ? Number(date.slice(8)) : 0;
  const monthDays = date ? new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).getUTCDate() : 0;
  const quarterDay = date ? Math.max(1, Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${qInfo.start}T00:00:00Z`)) / 86400000) + 1) : 0;
  return { rows, daily, date, quarterRows, monthRows, monthDay, monthDays, quarterDay, quarterName: qInfo.name, quarterTotalDays: qInfo.totalDays, quarterStartZh: qInfo.startZh };
}
