'use client';

import { useState, useEffect } from 'react';
import type { Dashboard, Project, Ops, MapData } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionTabs } from '../../components/ui/SectionTabs';
import { VoiceIntelligence } from './VoiceIntelligence';
import { CompetitorAnalysis } from './CompetitorAnalysis';
import { ContentAnalysis } from './ContentAnalysis';
import { DynamicReports } from './DynamicReports';
import { AgentStudio } from './ai-report/AgentStudio';
import { useProjectTab } from '../../lib/hooks/useProjectTab';
import { useNoteDetail } from '../../lib/hooks/useNoteDetail';
import { useProject } from '../../components/project-shell/ProjectContext';
import { api, pct } from '../../lib/hooks/use-project-data';

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

export function InsightsWorkspace({
  projectId,
  project,
  dashboard,
  ops,
  onRefresh,
}: {
  projectId: string;
  project: Project | null;
  dashboard: Dashboard;
  ops: Ops;
  onRefresh: () => Promise<void>;
}) {
  const [tab, setTab] = useProjectTab('voice', ['voice', 'competitor', 'content', 'report', 'ai']);
  const { showToast } = useProject();
  const { openNote, renderDrawer } = useNoteDetail({
    projectId,
    onRefresh,
    toast: showToast,
  });

  const [map, setMap] = useState<MapData>(emptyMap);

  useEffect(() => {
    if (tab === 'ai') {
      api<MapData>('/api/data-map?projectId=' + encodeURIComponent(projectId))
        .then((m) => setMap(m))
        .catch((e) => showToast(e instanceof Error ? e.message : '数据地图加载失败', 'error'));
    }
  }, [tab, projectId, showToast]);

  const reloadMap = async () => {
    try {
      const m = await api<MapData>('/api/data-map?projectId=' + encodeURIComponent(projectId));
      setMap(m);
    } catch {
      // ignore
    }
  };

  const tabs: Array<[string, string, string]> = [
    ['voice', '口碑分析', '情绪构成、动态话题与风险闭环'],
    ['competitor', '竞品分析', '声量格局与内容策略横向对比'],
    ['content', '内容分析', '内容效率、达人与投放拆解'],
    ['report', '复盘报告', '动态经营复盘、行动清单与导出'],
    ['ai', '✨ AI 生成报告', '自然语言 Query Plan 与 HTML 报告'],
  ];

  return (
    <div className="stack">
      <PageHeader
        eyebrow="INSIGHTS & REPORTS"
        title="分析报告"
        subtitle="把口碑、竞品、内容表现与 AI 生成报告集中在一处沉淀结论。"
        badge={<span>{pct(dashboard.metrics.positiveRate)} 正向口碑</span>}
      />

      <SectionTabs value={tab} onChange={setTab} items={tabs} />

      {tab === 'voice' && (
        <VoiceIntelligence data={dashboard} projectId={projectId} />
      )}

      {tab === 'competitor' && <CompetitorAnalysis data={dashboard} />}

      {tab === 'content' && (
        <ContentAnalysis data={dashboard} openNote={openNote} />
      )}

      {tab === 'report' && (
        <DynamicReports
          data={dashboard}
          project={project}
          ops={ops}
          projectId={projectId}
          onDone={onRefresh}
          toast={showToast}
        />
      )}

      {tab === 'ai' && (
        <AgentStudio
          projectId={projectId}
          map={map}
          reload={reloadMap}
          toast={showToast}
        />
      )}

      {renderDrawer()}
    </div>
  );
}
