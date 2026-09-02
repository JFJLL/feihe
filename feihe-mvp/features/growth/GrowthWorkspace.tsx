'use client';

import type { Dashboard, Ops, GrowthSettings } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionTabs } from '../../components/ui/SectionTabs';
import { KeywordRadar } from './KeywordRadar';
import { InspirationLibrary } from './InspirationLibrary';
import { SeedEngine } from './SeedEngine';
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
  const [tab, setTab] = useProjectTab('radar', ['radar', 'inspiration', 'seed']);
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

  const tabs: Array<[string, string, string]> = [
    ['radar', '机会雷达', '关键词与高热笔记（支持灵犀大盘）'],
    ['inspiration', '灵感选题', '高热样本沉淀与选题流转'],
    ['seed', '种子池', '种子筛选与投流候选验证'],
  ];

  return (
    <div className="stack">
      <PageHeader
        eyebrow="GROWTH OPPORTUNITY"
        title="增长机会"
        subtitle="发现当前项目值得跟进的关键词、内容和行业信号。"
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

      <SectionTabs value={tab} onChange={setTab} items={tabs} />

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

      {tab === 'seed' && (
        <SeedEngine
          data={dashboard}
          growth={growth}
          save={saveGrowth}
          openNote={openNote}
          projectId={projectId}
        />
      )}

      {renderDrawer()}
    </div>
  );
}