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

export function overviewPeriod(source: MetricRow[], selected: string) {
  const rows = source.filter(row => String(row.date) >= '2026-07-01' && String(row.date) <= '2026-09-30').sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const daily = rows.find(row => row.date === selected) || rows.at(-1);
  const date = String(daily?.date || '');
  const quarterRows = rows.filter(row => String(row.date) <= date);
  const monthRows = quarterRows.filter(row => String(row.date).slice(0, 7) === date.slice(0, 7));
  const monthDay = date ? Number(date.slice(8)) : 0;
  const monthDays = date ? new Date(Date.UTC(2026, Number(date.slice(5, 7)), 0)).getUTCDate() : 0;
  // Calendar progress includes days without a row; data coverage is a separate metric.
  const quarterDay = date ? Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse('2026-07-01T00:00:00Z')) / 86400000) + 1 : 0;
  return { rows, daily, date, quarterRows, monthRows, monthDay, monthDays, quarterDay };
}
