import React from 'react';

export function MetricCard({
  label,
  value,
  unit,
  desc,
  tag,
  theme = 'blue',
}: {
  label: string;
  value: string | number;
  unit?: string;
  desc?: string;
  tag?: string;
  theme?: 'blue' | 'green' | 'yellow' | 'red' | 'teal' | 'purple' | 'indigo';
}) {
  const tone = theme === 'yellow' ? 'amber' : theme === 'red' ? 'rose' : theme;
  return (
    <article className={`pastel-card pastel-${tone} reference-kpi ops-metric-card ops-metric-card-${theme}`}>
      <div className="stat-head ops-metric-card-head">
        <span className="ops-metric-card-label">{label}</span>
        {tag && <span className={`section-mini-tag tag-${tone}`}>{tag}</span>}
      </div>
      <div className="stat-value ops-metric-card-value-row">
        <span>{value}</span>
        {unit && <small> {unit}</small>}
      </div>
      {desc && <div className="reference-kpi-meta ops-metric-card-desc">{desc}</div>}
    </article>
  );
}
