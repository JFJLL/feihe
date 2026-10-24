'use client';

import React from 'react';
import { AppLink } from '../../components/ui/AppLink';
import { useProject } from '../../components/project-shell/ProjectContext';
import '../../styles/settings-layout.css';

export type SettingsTabId =
  | 'profile'
  | 'members'
  | 'rules'
  | 'board'
  | 'data-sources'
  | 'data'
  | 'metrics'
  | 'reports'
  | 'integrations'
  | 'data-map';

export function SettingsSubNav({ activeTab, style }: { activeTab?: string; style?: React.CSSProperties }) {
  const { projectId, currentProject, activeSection } = useProject();
  const isGeneral = currentProject?.templateId === 'general_workbench';
  const isCampaign = currentProject?.templateId === 'campaign_review';

  // Top-level 5 tabs (profile includes members)
  const topTabs: { id: SettingsTabId; title: string; href: string }[] = [
    {
      id: 'profile',
      title: '项目资料',
      href: `/projects/${encodeURIComponent(projectId)}/settings?tab=profile`,
    },
    ...(isGeneral
      ? []
      : [
          {
            id: 'rules' as SettingsTabId,
            title: '目标与规则',
            href: `/projects/${encodeURIComponent(projectId)}/settings?tab=rules`,
          },
        ]),
    ...(isCampaign
      ? [
          {
            id: 'data-sources' as SettingsTabId,
            title: '数据来源',
            href: `/projects/${encodeURIComponent(projectId)}/settings?tab=data-sources`,
          },
        ]
      : [
          {
            id: 'data' as SettingsTabId,
            title: '数据管理',
            href: `/projects/${encodeURIComponent(projectId)}/data`,
          },
        ]),
    {
      id: 'integrations',
      title: '工具集成',
      href: `/projects/${encodeURIComponent(projectId)}/settings?tab=integrations`,
    },
    {
      id: 'data-map',
      title: '数据地图',
      href: `/projects/${encodeURIComponent(projectId)}/settings?tab=data-map`,
    },
  ];

  // Always visible auxiliary navigation row
  const auxTabs: { id: SettingsTabId; title: string; href: string }[] = [
    {
      id: 'board',
      title: '团队看板',
      href: `/projects/${encodeURIComponent(projectId)}/settings?tab=board`,
    },
    {
      id: 'metrics',
      title: '项目指标',
      href: `/projects/${encodeURIComponent(projectId)}/metrics`,
    },
    {
      id: 'reports',
      title: '项目报告',
      href: `/projects/${encodeURIComponent(projectId)}/reports`,
    },
  ];

  const normalizedActive = activeTab === 'members' ? 'profile' : activeTab;
  const currentActive =
    normalizedActive ||
    (activeSection === 'data'
      ? isCampaign
        ? 'data-sources'
        : 'data'
      : activeSection === 'metrics'
      ? 'metrics'
      : activeSection === 'reports'
      ? 'reports'
      : 'profile');

  return (
    <nav className="settings-secondary-nav settings-nav-wrapper" style={{ margin: 0, ...style }} aria-label="项目设置导航">
      <div className="settings-subnav-track">
        {topTabs.map((t) => {
          const isActive = currentActive === t.id;
          return (
            <AppLink
              key={t.id}
              href={t.href}
              aria-current={isActive ? 'page' : undefined}
              className={`settings-subnav-item${isActive ? ' active' : ''}`}
            >
              <span className="settings-subnav-label">{t.title}</span>
            </AppLink>
          );
        })}
      </div>
      <div className="settings-aux-nav-track" aria-label="项目辅助导航">
        {auxTabs.map((t) => {
          const isActive = currentActive === t.id;
          return (
            <AppLink
              key={t.id}
              href={t.href}
              aria-current={isActive ? 'page' : undefined}
              className={`settings-aux-nav-link${isActive ? ' active' : ''}`}
            >
              <span>{t.title}</span>
            </AppLink>
          );
        })}
      </div>
    </nav>
  );
}
