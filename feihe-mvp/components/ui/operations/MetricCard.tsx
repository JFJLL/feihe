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
  return (
    <article className={`ops-metric-card ops-metric-card-${theme}`}>
      <div className="ops-metric-card-head">
        <span className="ops-metric-card-label">{label}</span>
        {tag && <span className="ops-metric-card-tag">{tag}</span>}
      </div>
      <div className="ops-metric-card-value-row">
        <span className="ops-metric-card-value">{value}</span>
        {unit && <span className="ops-metric-card-unit">{unit}</span>}
      </div>
      {desc && <div className="ops-metric-card-desc">{desc}</div>}
    </article>
  );
}
