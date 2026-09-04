import React from 'react';

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
  return (
    <section className={`ops-section-card ${className}`}>
      <div className="ops-section-card-head">
        <div className="ops-section-card-title-group">
          {eyebrow && <small style={{ color: '#0284c7' }}>{eyebrow}</small>}
          <h3>{title}</h3>
          {desc && <span className="ops-section-card-desc">{desc}</span>}
        </div>
        {extra && <div className="ops-section-card-extra">{extra}</div>}
      </div>
      {children}
    </section>
  );
}
