'use client';

import { useState, useEffect } from 'react';
import type { Dashboard, Project, Ops, Workspace, MapData } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionTabs } from '../../components/ui/SectionTabs';
import { ProjectProfile } from './ProjectProfile';
import { RulesAndTargets } from './RulesAndTargets';
import { SettingsDataSources } from './data-sources/SettingsDataSources';
import { SettingsIntegrations } from './integrations/SettingsIntegrations';
import { DataMap } from './data-map/DataMap';
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
  project,
  dashboard,
  ops,
  workspace,
  initialTab = 'profile',
  onRefresh,
  toast,
}: {
  projectId: string;
  project: Project;
  dashboard: Dashboard;
  ops: Ops;
  workspace: Workspace | null;
  initialTab?: string;
  onRefresh: () => Promise<void>;
  toast: (msg: string) => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [map, setMap] = useState<MapData>(emptyMap);

  useEffect(() => {
    if (tab === 'data-map') {
      api<MapData>('/api/data-map?projectId=' + encodeURIComponent(projectId))
        .then((m) => setMap(m))
        .catch((e) => toast(e instanceof Error ? e.message : '数据地图加载失败'));
    }
  }, [tab, projectId, toast]);

  const reloadMap = async () => {
    try {
      const m = await api<MapData>('/api/data-map?projectId=' + encodeURIComponent(projectId));
      setMap(m);
    } catch {
      // ignore
    }
  };

  const tabs: Array<[string, string, string]> = [
    ['profile', '项目资料', '品牌、SPU 与基本信息维护'],
    ['rules', '目标与规则', '总盘目标、验收阈值与审查词库'],
    ['data-sources', '数据源', '飞书发布表与供应商交付表'],
    ['integrations', '工具集成', 'RedTrend、飞书与外部接口'],
    ['data-map', '数据地图', '账户、接口与语义指标映射'],
  ];

  return (
    <div className="stack">
      <PageHeader
        eyebrow="PROJECT SETTINGS"
        title="项目设置"
        subtitle="集中管理当前项目的低频配置、目标规则、数据源与数据地图。"
        badge={
          <span>
            {ops.settings.rules.brands.length + ops.settings.rules.competitors.length} 个识别词 ·{' '}
            {dashboard.pipelines.length} 条主线
          </span>
        }
      />

      <SectionTabs value={tab} onChange={setTab} items={tabs} />

      {tab === 'profile' && (
        <ProjectProfile
          project={project}
          projectId={projectId}
          onDone={onRefresh}
          toast={toast}
        />
      )}

      {tab === 'rules' && (
        <RulesAndTargets
          data={dashboard}
          ops={ops}
          projectId={projectId}
          onDone={onRefresh}
          toast={toast}
        />
      )}

      {tab === 'data-sources' && (
        <SettingsDataSources
          projectId={projectId}
          workspace={workspace}
          onDone={onRefresh}
          toast={toast}
        />
      )}

      {tab === 'integrations' && (
        <SettingsIntegrations projectId={projectId} toast={toast} />
      )}

      {tab === 'data-map' && (
        <DataMap
          projectId={projectId}
          data={map}
          reload={reloadMap}
          toast={toast}
        />
      )}
    </div>
  );
}
