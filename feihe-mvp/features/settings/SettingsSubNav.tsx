'use client';

import React, { useRef, useEffect } from 'react';
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

export function SettingsSubNav({
  activeTab,
  style,
  mode = 'all',
}: {
  activeTab?: string;
  style?: React.CSSProperties;
  mode?: 'all' | 'primary' | 'aux';
}) {
  const { projectId, currentProject, activeSection } = useProject();
  const isGeneral = currentProject?.templateId === 'general_workbench';
  const isCampaign = currentProject?.templateId === 'campaign_review';
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleClickOutside = (e: MouseEvent) => {
      if (detailsRef.current && detailsRef.current.open && !detailsRef.current.contains(e.target as Node)) {
        detailsRef.current.open = false;
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Streamlined 4 core tabs (profile includes members)
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
  ];

  // Secondary / advanced items inside compact popover menu
  const auxTabs: { id: SettingsTabId; title: string; href: string; hint: string }[] = [
    {
      id: 'data-map',
      title: '数据地图',
      href: `/projects/${encodeURIComponent(projectId)}/settings?tab=data-map`,
      hint: '内嵌视图',
    },
    {
      id: 'board',
      title: '团队看板',
      href: `/projects/${encodeURIComponent(projectId)}/settings?tab=board`,
      hint: '内嵌视图',
    },
    {
      id: 'metrics',
      title: '项目指标',
      href: `/projects/${encodeURIComponent(projectId)}/metrics`,
      hint: '独立页 ↗',
    },
    {
      id: 'reports',
      title: '项目报告',
      href: `/projects/${encodeURIComponent(projectId)}/reports`,
      hint: '独立页 ↗',
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

  if (mode === 'aux') {
    return null;
  }

  const activeAuxTab = auxTabs.find((t) => t.id === currentActive);

  const trackContent = (
    <div
      className="settings-secondary-nav settings-subnav-primary settings-subnav-track settings-subnav-unified"
      style={style}
    >
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
  );

  if (mode === 'primary') {
    return trackContent;
  }

  return (
    <nav
      className="settings-secondary-nav settings-nav-wrapper settings-subnav-unified-nav"
      style={{ margin: 0, ...style }}
      aria-label="项目设置导航"
    >
      {trackContent}
    </nav>
  );
}
