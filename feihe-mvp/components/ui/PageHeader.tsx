import React from 'react';

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  /** 'banner' keeps the overview navy hero; 'light' is the compact workspace header. */
  variant?: 'banner' | 'light';
};

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  badge,
  children,
  variant = 'banner',
}: PageHeaderProps) {
  return (
    <section
      className={`ui-page-header${variant === 'light' ? ' ui-page-header-light' : ''}`}
      data-header-variant={variant}
    >
      <div className="ui-page-header-main">
        {eyebrow && variant === 'banner' && (
          <small className="ui-page-header-eyebrow">{eyebrow}</small>
        )}
        <div className="ui-page-header-title-row">
          <h1 className="ui-page-header-title">{title}</h1>
          {badge && <div className="ui-page-header-badge">{badge}</div>}
        </div>
        {subtitle && <p className="ui-page-header-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="ui-page-header-actions">{children}</div>}
    </section>
  );
}
