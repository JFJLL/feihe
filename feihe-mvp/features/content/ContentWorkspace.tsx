'use client';

import { useState } from 'react';
import type { Dashboard, Ops } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { WorkspaceModuleTabs, type ModuleTab } from '../../components/ui/operations/WorkspaceModuleTabs';
import { ContentRegistry } from './ContentRegistry';
import { PublishingManagement } from './PublishingManagement';
import { ContentMonitoring } from './ContentMonitoring';
import { useProjectTab } from '../../lib/hooks/useProjectTab';
import { useNoteDetail } from '../../lib/hooks/useNoteDetail';
import { useProject } from '../../components/project-shell/ProjectContext';
import { api } from '../../lib/hooks/use-project-data';

export function ContentWorkspace({
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
  const [tab, setTab] = useProjectTab('registry', ['registry', 'publishing', 'monitoring'], {
    pool: 'registry',
    linkage: 'publishing',
    performance: 'monitoring',
  });
  const { showToast } = useProject();
  const { openNote, renderDrawer } = useNoteDetail({
    projectId,
    onRefresh,
    toast: showToast,
    context: 'content',
    defaultTab: tab === 'publishing' || tab === 'monitoring' ? 'performance' : 'basic',
  });

  const [loading, setLoading] = useState(false);

  async function runSearch(keywords: string, fromDate: string, toDate: string) {
    setLoading(true);
    try {
      const result = await api<{ count: number }>('/api/notes/search', {
        method: 'POST',
        body: JSON.stringify({ keywords, startDate: fromDate, endDate: toDate, maxPages: 5, projectId }),
      });
      showToast('外部样本扫描完成，已入库 ' + result.count + ' 篇笔记', 'success');
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '扫描失败', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function uploadWorkbook(file: File | undefined, kind: 'owned' | 'supplier') {
    if (!file) return;
    setLoading(true);
    try {
      if (!window.XLSX) throw new Error('Excel 解析组件尚未加载');
      const book = window.XLSX.read(await file.arrayBuffer());
      const rows = window.XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' });
      const result = await api<{ imported: number; skipped: number }>('/api/import', {
        method: 'POST',
        body: JSON.stringify({ kind, rows, projectId }),
      });
      showToast('表格导入完成，导入 ' + result.imported + ' 条，跳过 ' + result.skipped + ' 条', 'success');
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  const tabs: ModuleTab[] = [
    { id: 'registry', title: '内容台账', desc: '内容资产总盘、自有导入与单篇明细', badge: dashboard.metrics.noteCount || 0, icon: '📑' },
    { id: 'publishing', title: '发布管理', desc: '自有发布进度、发布目标与覆盖反馈', badge: dashboard.metrics.publishedCount || 0, icon: '🚀' },
    { id: 'monitoring', title: '内容监测', desc: '单篇表现指标、数据质量与完整度', badge: dashboard.metrics.noteCount || 0, icon: '📊' },
  ];

  return (
    <div className="ops-workspace">
      <PageHeader
        eyebrow="CONTENT OPERATIONS"
        title="内容管理"
        subtitle="集中管理内容资产、发布情况和单篇表现，评论采集与处置统一进入评论运营。"
        badge={<span>{dashboard.metrics.noteCount} 篇笔记资产</span>}
      />

      <WorkspaceModuleTabs tabs={tabs} activeTab={tab} onChange={setTab} />

      {tab === 'registry' && (
        <ContentRegistry
          projectId={projectId}
          openNote={openNote}
          uploadWorkbook={uploadWorkbook}
          runSearch={runSearch}
          loading={loading}
          onRefresh={onRefresh}
          toast={showToast}
        />
      )}

      {tab === 'publishing' && (
        <PublishingManagement
          projectId={projectId}
          dashboard={dashboard}
          ops={ops}
          openNote={openNote}
          toast={showToast}
        />
      )}

      {tab === 'monitoring' && (
        <ContentMonitoring
          projectId={projectId}
          openNote={openNote}
          toast={showToast}
        />
      )}

      {renderDrawer()}
    </div>
  );
}
