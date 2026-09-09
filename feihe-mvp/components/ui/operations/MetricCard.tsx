import React from 'react';

export function MetricCard({
  label,
  value,
  unit,
  desc,
  tag,
  theme = 'blue',
  onClick,
  clickable = false,
  title,
}: {
  label: string;
  value: string | number;
  unit?: string;
  desc?: string;
  tag?: string;
  theme?: 'blue' | 'green' | 'yellow' | 'red' | 'teal' | 'purple' | 'indigo';
  onClick?: () => void;
  clickable?: boolean;
  title?: string;
}) {
  const tone = theme === 'yellow' ? 'amber' : theme === 'red' ? 'rose' : theme;
  return (
    <article
      title={title}
      className={`pastel-card pastel-${tone} reference-kpi ops-metric-card ops-metric-card-${theme}`}
      onClick={onClick}
      style={clickable || onClick ? { cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="stat-head ops-metric-card-head">
        <span className="ops-metric-card-label">{label}</span>
        {tag && <span className={`section-mini-tag tag-${tone}`}>{tag}</span>}
      </div>
      <div className="stat-value ops-metric-card-value-row">
        <span className="ops-metric-card-value">{value}</span>
        {unit && <small className="ops-metric-card-unit"> {unit}</small>}
      </div>
      {desc && <div className="reference-kpi-meta ops-metric-card-desc">{desc}</div>}
    </article>
  );
}
