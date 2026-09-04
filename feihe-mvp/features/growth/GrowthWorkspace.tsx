'use client';

import type { Dashboard, Ops, GrowthSettings } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { WorkspaceModuleTabs, type ModuleTab } from '../../components/ui/operations/WorkspaceModuleTabs';
import { CompetitorAnalysis } from './CompetitorAnalysis';
import { KeywordRadar } from './KeywordRadar';
import { InspirationLibrary } from './InspirationLibrary';
import { useProjectTab } from '../../lib/hooks/useProjectTab';
import { useNoteDetail } from '../../lib/hooks/useNoteDetail';
import { useProject } from '../../components/project-shell/ProjectContext';
import { api } from '../../lib/hooks/use-project-data';

export function GrowthWorkspace({
  projectId,
  dashboard,
  ops,
  onRefresh,
}: {
  projectId: string;
  dashboard: Dashboard;
  ops: Ops;
  onRefresh: () => Promise<void>;
}) {
  const [tab, setTab] = useProjectTab('competitor', ['competitor', 'radar', 'inspiration'], {
    growth: 'competitor',
  });
  const { showToast } = useProject();
  const { openNote, renderDrawer } = useNoteDetail({
    projectId,
    onRefresh,
    toast: showToast,
  });

  const growth = ops.settings.growth;

  async function saveGrowth(next: GrowthSettings, message: string) {
    try {
      await api('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ projectId, growth: next }),
      });
      showToast(message, 'success');
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败', 'error');
    }
  }

  const tabs: ModuleTab[] = [
    { id: 'competitor', title: '竞品分析', desc: '声量格局与内容策略横向对比', badge: dashboard.analytics.brands?.length || 0, icon: '⚔️' },
    { id: 'radar', title: '机会雷达', desc: '关键词与高热笔记（支持灵犀大盘）', badge: growth.watchKeywords?.length || 0, icon: '🛰️' },
    { id: 'inspiration', title: '灵感选题', desc: '高热样本沉淀与选题流转', badge: dashboard.notes?.length || 0, icon: '💡' },
  ];

  return (
    <div className="ops-workspace">
      <PageHeader
        eyebrow="COMPETITOR ANALYSIS"
        title="竞品分析"
        subtitle="声量格局与内容策略横向对比，结合机会雷达挖掘行业高热信号。"
        badge={<span>{dashboard.analytics.brands?.length || 0} 家重点监测品牌</span>}
      >
        <section className="source-coverage" style={{ margin: 0 }}>
          <span className="connected">
            <i />
            项目内容库<strong>已接入</strong>
          </span>
          <span className="connected">
            <i />
            灵犀行业洞察<strong>直连</strong>
          </span>
          <span>
            <i />
            聚光投放<strong>待授权</strong>
          </span>
        </section>
      </PageHeader>

      <WorkspaceModuleTabs tabs={tabs} activeTab={tab} onChange={setTab} />

      {tab === 'competitor' && (
        <CompetitorAnalysis data={dashboard} onSwitchTab={setTab} />
      )}

      {tab === 'radar' && (
        <KeywordRadar
          data={dashboard}
          growth={growth}
          rules={ops.settings.rules}
          save={saveGrowth}
          openNote={openNote}
          projectId={projectId}
          toast={showToast}
        />
      )}

      {tab === 'inspiration' && (
        <InspirationLibrary
          data={dashboard}
          growth={growth}
          save={saveGrowth}
          openNote={openNote}
        />
      )}

      {renderDrawer()}
    </div>
  );
}
