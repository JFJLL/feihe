import React from 'react';

import { sectionLabels } from '../section-labels';

export function DashboardSection({
  eyebrow,
  title,
  desc,
  extra,
  children,
  className = '',
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [label, tone] = sectionLabels[eyebrow || ''] || [eyebrow, 'blue'];
  return (
    <section className={`pastel-card reference-section section-${tone} ops-section-card ${className}`}>
      <div className="card-header-row ops-section-card-head">
        <div className="header-left ops-section-card-title-group">
          {label && <span className={`section-mini-tag tag-${tone}`}>{label}</span>}
          <h3>{title}</h3>
          {desc && <span className="ops-section-card-desc">{desc}</span>}
        </div>
        {extra && <div className="ops-section-card-extra">{extra}</div>}
      </div>
      {children}
    </section>
  );
}
