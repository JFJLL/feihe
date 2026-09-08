'use client';

import { useState, useEffect } from 'react';
import type { Dashboard, Project, Ops, MapData } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { WorkspaceModuleTabs, type ModuleTab } from '../../components/ui/operations/WorkspaceModuleTabs';
import { ProjectProfile } from './ProjectProfile';
import { RulesAndTargets } from './RulesAndTargets';
import { SettingsDataSources } from './data-sources/SettingsDataSources';
import { SettingsIntegrations } from './integrations/SettingsIntegrations';
import { DataMap } from './data-map/DataMap';
import { useProjectTab } from '../../lib/hooks/useProjectTab';
import { useProject } from '../../components/project-shell/ProjectContext';
import { api } from '../../lib/hooks/use-project-data';

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
  onRefresh: () => Promise<void>;
}) {
  const [tab, setTab] = useProjectTab('profile', ['profile', 'rules', 'data-sources', 'integrations', 'data-map']);
  const { currentProject, workspace, refreshWorkspace, showToast } = useProject();

  // Per-project visited tabs set: lazy-mounts on first visit, preserves drafts thereafter.
  const [visitedByProject, setVisitedByProject] = useState<Record<string, Set<string>>>({});
  const visited = visitedByProject[projectId] ?? new Set([tab]);

  useEffect(() => {
    setVisitedByProject((prev) => {
      const current = prev[projectId];
      if (current && current.has(tab)) return prev;
      const next = new Set(current || []);
      next.add(tab);
      return { ...prev, [projectId]: next };
    });
  }, [projectId, tab]);

  const [map, setMap] = useState<MapData>(emptyMap);
  const [mapError, setMapError] = useState('');
  const [mapLoadedFor, setMapLoadedFor] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (tab === 'data-map') {
      api<MapData>('/api/data-map?projectId=' + encodeURIComponent(projectId))
        .then((m) => { if (!cancelled) { setMap(m); setMapError(''); setMapLoadedFor(projectId); } })
        .catch((e) => { if (!cancelled) setMapError(e instanceof Error ? e.message : '数据地图加载失败'); });
    }
    return () => { cancelled = true; };
  }, [tab, projectId, showToast]);

  const reloadMap = async () => {
    try {
      const m = await api<MapData>('/api/data-map?projectId=' + encodeURIComponent(projectId));
      setMap(m);
      setMapError('');
      setMapLoadedFor(projectId);
    } catch (e) {
      setMapError(e instanceof Error ? e.message : '数据地图加载失败');
    }
  };

  const handleProfileOrSourceUpdate = async () => {
    await refreshWorkspace();
    await onRefresh();
  };

  const tabs: ModuleTab[] = [
    { id: 'profile', title: '项目资料', desc: '品牌、SPU 与基本信息维护', icon: '📋' },
    { id: 'rules', title: '目标与规则', desc: '总盘目标、月季任务与审查词库', icon: '🎯' },
    { id: 'data-sources', title: '数据源', desc: '飞书多表溯源与交付源配置', icon: '📊' },
    { id: 'integrations', title: '工具集成', desc: 'RedTrend、飞书与外部接口', icon: '🔌' },
    { id: 'data-map', title: '数据地图', desc: '账户、接口与语义指标映射', icon: '🗺️' },
  ];

  return (
    <div className="stack ops-workspace reference-workspace settings-workspace" data-workspace-ui="v2">
      <PageHeader
        variant="light"
        title="项目设置"
        subtitle="集中管理当前项目的低频配置、目标规则、数据源与数据地图。"
        badge={
          <span>
            {ops.settings.rules.brands.length + ops.settings.rules.competitors.length} 个识别词 ·{' '}
            {dashboard.pipelines.length} 条主线
          </span>
        }
      />

      <WorkspaceModuleTabs tabs={tabs} activeTab={tab} onChange={setTab} variant="compact" />

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

      {visited.has('data-sources') && (
      <div
        id="workspace-tabpanel-data-sources"
        role="tabpanel"
        aria-labelledby="workspace-tab-data-sources"
        tabIndex={0}
        style={{ display: tab === 'data-sources' ? 'block' : 'none' }}
      >
        <SettingsDataSources
          key={projectId}
          projectId={projectId}
          workspace={workspace}
          onDone={handleProfileOrSourceUpdate}
          toast={showToast}
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
        {mapError ? (
          <ErrorState error={mapError} onRetry={reloadMap} />
        ) : mapLoadedFor !== projectId ? (
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
