import type { KpiWeeklyRow } from '../../lib/feishu-model';

export function kpiScopes(rows: KpiWeeklyRow[]) {
  const groups = new Map<string, { key: string; label: string; rows: KpiWeeklyRow[] }>();
  for (const row of rows) {
    if (!row.period || !row.project || !row.subItem) continue;
    const parts = [row.phase, row.period, row.agency, row.project, row.subItem];
    const key = JSON.stringify(parts);
    const group = groups.get(key) || { key, label: parts.filter(Boolean).join(' · '), rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN', { numeric: true }));
}

export function compareKpi(rows: KpiWeeklyRow[]) {
  const targets = rows.filter(r => r.dimension === 'KPI');
  const actuals = rows.filter(r => r.dimension === '实际');
  const ambiguous = targets.length > 1 || actuals.length > 1;
  return { ambiguous, target: targets.length === 1 ? targets[0] : null, actual: actuals.length === 1 ? actuals[0] : null };
}
