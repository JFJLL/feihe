'use client';

import React, { type ReactNode } from 'react';
import type { Project } from '../../lib/types/project';
import type { DashboardPreset } from './dashboard-template';

export interface DashboardFrameProps {
  preset: DashboardPreset;
  project?: Project;
  subtitle?: string;
  actions?: ReactNode;
  tabsSlot?: ReactNode;
  children: ReactNode;
}

export function DashboardFrame({
  preset,
  project,
  subtitle,
  actions,
  tabsSlot,
  children,
}: DashboardFrameProps) {
  const effectiveSubtitle = subtitle || (
    project?.departmentName
      ? `${project.departmentName} ${preset.defaultSubtitle}`
      : preset.defaultSubtitle
  );
  const displaySubtitle = effectiveSubtitle ? effectiveSubtitle.replace(/\s*·\s*/g, ' / ') : '';

  const displayStatus = project?.status === 'in_progress' || project?.status === 'active'
    ? '进行中'
    : project?.status;

  return (
    <div
      className={`dashboard-template dashboard-template-${preset.kind} theme-${preset.themeTag}${tabsSlot ? ' has-tabs' : ''}`}
      data-preset={preset.kind}
      data-project-template={project?.templateId || 'general_workbench'}
      data-has-tabs={Boolean(tabsSlot)}
    >
      <header className="dashboard-template-header ui-page-header">
        <div className="dashboard-template-header-main ui-page-header-main">
          <div className="dashboard-template-title-row ui-page-header-title-row">
            <h1 className="dashboard-template-title ui-page-header-title">{project?.name || '项目总观'}</h1>
            <div className="dashboard-template-badges">
              {displayStatus && (
                <span className="dashboard-template-badge dashboard-template-status-badge ui-page-header-badge">
                  <i className="status-dot" aria-hidden="true" />
                  {displayStatus}
                </span>
              )}
            </div>
            {displaySubtitle && (
              <span className="dashboard-template-subtitle dashboard-template-subtitle-inline ui-page-header-subtitle" title={displaySubtitle}>{displaySubtitle}</span>
            )}
          </div>
        </div>
        <div className="dashboard-template-header-controls">
          {tabsSlot && <div className="dashboard-template-nav">{tabsSlot}</div>}
          {actions && <div className="dashboard-template-actions ui-page-header-actions">{actions}</div>}
        </div>
      </header>

      <div className="dashboard-template-body">
        {children}
      </div>
    </div>
  );
}
