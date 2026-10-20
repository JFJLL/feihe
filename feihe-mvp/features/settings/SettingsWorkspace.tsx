'use client';

import { useState, useEffect } from 'react';
import type { Dashboard, Project, Ops, MapData } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SettingsSubNav } from './SettingsSubNav';
import { ProjectProfile } from './ProjectProfile';
import { MemberManagement } from './members/MemberManagement';
import { RulesAndTargets } from './RulesAndTargets';
import { SettingsIntegrations } from './integrations/SettingsIntegrations';
import { DataMap } from './data-map/DataMap';
import { GeneralWorkbenchBoard } from '../overview/GeneralWorkbenchBoard';
import { CampaignSourcesPanel } from '../campaign/CampaignSourcesPanel';
import { useProjectTab } from '../../lib/hooks/useProjectTab';
import { useProject } from '../../components/project-shell/ProjectContext';
import { useCachedQuery } from '../../lib/hooks/use-cached-query';
import { invalidateQueryCache } from '../../lib/cache/query-cache';

const emptyMap: MapData = {
  accounts: [],
  endpoints: [],
  metrics: [],
  bindings: [],
  sources: [],
  integrations: [],
  runs: [],
  reports: [],
  assets: [],
  keystone: {
    configured: false,
    status: '检测中',
    models: [],
    textModels: [],
    imageModels: [],
    textModel: 'gpt-5.6-terra',
    imageModel: 'gpt-image-2',
    baseUrl: 'https://keystonehk.ai/v1',
  },
};

export function SettingsWorkspace({
  projectId,
  dashboard,
  ops,
  onRefresh,
}: {
  projectId: string;
  project?: Project | null;
  dashboard: Dashboard;
  ops: Ops;
  onRefresh: (opts?: { fresh?: boolean; throwOnError?: boolean }) => Promise<void>;
}) {
  const { currentProject, refreshWorkspace, showToast, navigateTo } = useProject();
  const isCampaignReview = currentProject?.templateId === 'campaign_review';

  const [tab] = useProjectTab('profile', [
    'profile',
    'members',
    'rules',
    'board',
    'data-sources',
    'integrations',
    'data-map',
    'data',
    'metrics',
    'reports',
  ]);

  // If someone visits /projects/[id]/settings?tab=data, metrics, reports, or data-sources, route seamlessly
  useEffect(() => {
    let subpath = '';
    if (tab === 'data-sources') {
      if (isCampaignReview) {
        return; // Campaign review projects stay on settings?tab=data-sources
      }
      subpath = 'data';
    } else if (tab === 'data') {
      subpath = 'data';
    } else if (tab === 'metrics') {
      subpath = 'metrics';
    } else if (tab === 'reports') {
      subpath = 'reports';
    }
    if (!subpath) return;

    let search = '';
    let hash = '';
    if (typeof window !== 'undefined') {
      if (window.location.search) {
        const params = new URLSearchParams(window.location.search);
        params.delete('tab');
        const qs = params.toString();
        if (qs) {
          search = `?${qs}`;
        }
      }
      hash = window.location.hash || '';
    }
    const target = `/projects/${encodeURIComponent(projectId)}/${subpath}${search}${hash}`;
    navigateTo(target, { replace: true });
  }, [tab, projectId, navigateTo, isCampaignReview]);

  // Per-project visited tabs set: lazy-mounts on first visit, preserves drafts thereafter.
  const [visitedByProject, setVisitedByProject] = useState<Record<string, Set<string>>>(() => ({
    [projectId]: new Set([tab]),
  }));
  const visited = new Set([...(visitedByProject[projectId] ?? []), tab]);

  if (!visitedByProject[projectId]?.has(tab)) {
    setVisitedByProject((prev) => {
      const current = prev[projectId];
      if (current && current.has(tab)) return prev;
      const next = new Set(current || ['profile']);
      next.add(tab);
      return { ...prev, [projectId]: next };
    });
  }

  const {
    data: mapData,
    loading: mapLoading,
    error: mapError,
    refresh: refreshMap,
  } = useCachedQuery<MapData>({
    url: '/api/data-map',
    projectId,
    params: { projectId },
    enabled: tab === 'data-map' || visited.has('data-map'),
    staleTime: 60 * 1000,
    ttl: 15 * 60 * 1000,
  });
  const map = mapData || emptyMap;

  const reloadMap = async () => {
    invalidateQueryCache({ projectId, endpoint: '/api/data-map' });
    await refreshMap({ fresh: true });
  };

  const handleProfileOrSourceUpdate = async () => {
    invalidateQueryCache({ projectId, endpoint: '/api/projects' });
    invalidateQueryCache({ projectId, endpoint: '/api/data-workspace' });
    invalidateQueryCache({ projectId, endpoint: '/api/campaign-dashboard' });
    await refreshWorkspace();
    await onRefresh({ fresh: true });
  };

  const ruleWordCount = (ops?.settings?.rules?.brands?.length || 0) + (ops?.settings?.rules?.competitors?.length || 0);

  return (
    <div className="stack ops-workspace reference-workspace settings-workspace" data-workspace-ui="v2">
      <PageHeader
        variant="light"
        title="项目设置"
        subtitle={
          isCampaignReview
            ? "集中管理当前项目的资料、目标规则、成员权限、数据来源与工具集成。"
            : "集中管理当前项目的资料、目标规则、成员权限、工具与数据地图。"
        }
        badge={
          isCampaignReview ? (
            <span>战役复盘资料与数据管理</span>
          ) : (
            <span>
              {ruleWordCount} 个识别词 ·{' '}
              {dashboard.pipelines?.length || 0} 条主线
            </span>
          )
        }
      />

      <SettingsSubNav activeTab={tab} />

      {visited.has('profile') && (
        <div
          id="workspace-tabpanel-profile"
          role="tabpanel"
          aria-labelledby="workspace-tab-profile"
          tabIndex={0}
          style={{ display: tab === 'profile' ? 'block' : 'none' }}
        >
          <ProjectProfile
            key={projectId}
            project={currentProject}
            projectId={projectId}
            onDone={handleProfileOrSourceUpdate}
            toast={showToast}
          />
        </div>
      )}

      {visited.has('members') && (
        <div
          id="workspace-tabpanel-members"
          role="tabpanel"
          aria-labelledby="workspace-tab-members"
          tabIndex={0}
          style={{ display: tab === 'members' ? 'block' : 'none' }}
        >
          <MemberManagement
            key={projectId}
            projectId={projectId}
            onDone={handleProfileOrSourceUpdate}
            toast={showToast}
          />
        </div>
      )}

      {visited.has('data-sources') && isCampaignReview && (
        <div
          id="workspace-tabpanel-data-sources"
          role="tabpanel"
          aria-labelledby="workspace-tab-data-sources"
          tabIndex={0}
          style={{ display: tab === 'data-sources' ? 'block' : 'none' }}
        >
          <CampaignSourcesPanel
            key={projectId}
            projectId={projectId}
            onDone={handleProfileOrSourceUpdate}
          />
        </div>
      )}

      {visited.has('rules') && (
        <div
          id="workspace-tabpanel-rules"
          role="tabpanel"
          aria-labelledby="workspace-tab-rules"
          tabIndex={0}
          style={{ display: tab === 'rules' ? 'block' : 'none' }}
        >
          <RulesAndTargets
            key={projectId}
            data={dashboard}
            ops={ops}
            projectId={projectId}
            onDone={onRefresh}
            toast={showToast}
          />
        </div>
      )}

      {visited.has('board') && (
        <div
          id="workspace-tabpanel-board"
          role="tabpanel"
          aria-labelledby="workspace-tab-board"
          tabIndex={0}
          style={{ display: tab === 'board' ? 'block' : 'none' }}
        >
          <GeneralWorkbenchBoard
            key={projectId}
            projectId={projectId}
            project={currentProject || undefined}
          />
        </div>
      )}

      {visited.has('integrations') && (
        <div
          id="workspace-tabpanel-integrations"
          role="tabpanel"
          aria-labelledby="workspace-tab-integrations"
          tabIndex={0}
          style={{ display: tab === 'integrations' ? 'block' : 'none' }}
        >
          <SettingsIntegrations
            key={projectId}
            projectId={projectId}
            toast={showToast}
          />
        </div>
      )}

      {visited.has('data-map') && (
        <div
          id="workspace-tabpanel-data-map"
          role="tabpanel"
          aria-labelledby="workspace-tab-data-map"
          tabIndex={0}
          style={{ display: tab === 'data-map' ? 'block' : 'none' }}
        >
          {mapError && !mapData ? (
            <ErrorState error={mapError} onRetry={reloadMap} />
          ) : mapLoading && !mapData ? (
            <LoadingState text="正在加载当前项目的数据地图…" />
          ) : (
            <DataMap
              key={projectId}
              projectId={projectId}
              data={map}
              reload={reloadMap}
              toast={showToast}
            />
          )}
        </div>
      )}
    </div>
  );
}
