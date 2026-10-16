'use client';

import React from 'react';
import { useProject } from '../../components/project-shell/ProjectContext';

export type SettingsTabId =
  | 'profile'
  | 'members'
  | 'rules'
  | 'board'
  | 'data'
  | 'metrics'
  | 'reports'
  | 'integrations'
  | 'data-map';

export function SettingsSubNav({ activeTab }: { activeTab?: string }) {
  const { projectId, currentProject, navigateTo, activeSection } = useProject();
  const isGeneral = currentProject?.templateId === 'general_workbench';

  const tabs: { id: SettingsTabId; title: string; href: string; icon: string }[] = [
    {
      id: 'profile',
      title: '项目资料',
      href: `/projects/${encodeURIComponent(projectId)}/settings?tab=profile`,
      icon: '📋',
    },
    {
      id: 'members',
      title: '成员与权限',
      href: `/projects/${encodeURIComponent(projectId)}/settings?tab=members`,
      icon: '👥',
    },
    ...(isGeneral
      ? []
      : [
          {
            id: 'rules' as SettingsTabId,
            title: '目标与规则',
            href: `/projects/${encodeURIComponent(projectId)}/settings?tab=rules`,
            icon: '🎯',
          },
        ]),
        {
      id: 'board',
      title: '团队看板',
      href: `/projects/${encodeURIComponent(projectId)}/settings?tab=board`,
      icon: '📌',
    },
    {
      id: 'data',
      title: '数据管理',
      href: `/projects/${encodeURIComponent(projectId)}/data`,
      icon: '📊',
    },
    {
      id: 'metrics',
      title: '项目指标',
      href: `/projects/${encodeURIComponent(projectId)}/metrics`,
      icon: '📐',
    },
    {
      id: 'reports',
      title: '项目报告',
      href: `/projects/${encodeURIComponent(projectId)}/reports`,
      icon: '📑',
    },
    {
      id: 'integrations',
      title: '工具集成',
      href: `/projects/${encodeURIComponent(projectId)}/settings?tab=integrations`,
      icon: '🔌',
    },
    {
      id: 'data-map',
      title: '数据地图',
      href: `/projects/${encodeURIComponent(projectId)}/settings?tab=data-map`,
      icon: '🗺️',
    },
  ];

  // Derive active tab from prop or activeSection
  const currentActive =
    activeTab ||
    (activeSection === 'data'
      ? 'data'
      : activeSection === 'metrics'
      ? 'metrics'
      : activeSection === 'reports'
      ? 'reports'
      : 'profile');

  return (
    <nav className="settings-secondary-nav" aria-label="项目设置二级导航" role="tablist">
      <div className="settings-subnav-track">
        {tabs.map((t) => {
          const isActive = currentActive === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`settings-subnav-item${isActive ? ' active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                if (!isActive) {
                  navigateTo(t.href);
                }
              }}
            >
              <span className="settings-subnav-icon" aria-hidden="true">{t.icon}</span>
              <span className="settings-subnav-label">{t.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
