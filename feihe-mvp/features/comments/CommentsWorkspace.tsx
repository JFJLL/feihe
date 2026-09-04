'use client';

import { useState } from 'react';
import type { Dashboard, Ops } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { WorkspaceModuleTabs, type ModuleTab } from '../../components/ui/operations/WorkspaceModuleTabs';
import { VoiceIntelligence } from './VoiceIntelligence';
import { CommentCollection } from './CommentCollection';
import { CommentActionWorkbench } from './CommentActionWorkbench';
import { AcceptanceDelivery } from './AcceptanceDelivery';
import { SupplierVerification } from './SupplierVerification';
import { useProjectTab } from '../../lib/hooks/useProjectTab';
import { useNoteDetail } from '../../lib/hooks/useNoteDetail';
import { useProject } from '../../components/project-shell/ProjectContext';
import { api, num, pct } from '../../lib/hooks/use-project-data';

export function CommentsWorkspace({
  projectId,
  dashboard,
  ops,
  onRefresh,
}: {
  projectId: string;
  dashboard: Dashboard;
  ops: Ops;
  onRefresh: (opts?: { fresh?: boolean }) => Promise<void>;
}) {
  const [tab, setTab] = useProjectTab('actions', ['actions', 'collection', 'acceptance', 'supplier'], {
    insights: 'actions',
    sentiment: 'actions',
    voice: 'actions',
    risk: 'actions',
    review: 'actions',
  });
  const [subView, setSubView] = useState<'voice' | 'triage'>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const t = p.get('tab');
      if (t === 'actions' || t === 'risk' || t === 'review') return 'triage';
    }
    return 'voice';
  });
  const { showToast } = useProject();

  const { openNote, renderDrawer } = useNoteDetail({
    projectId,
    onRefresh,
    toast: showToast,
    context: tab === 'acceptance' ? 'acceptance' : 'comments',
    defaultTab: tab === 'acceptance' ? 'acceptance' : 'comments',
  });

  const [loading, setLoading] = useState(false);
  const [runResult, setRunResult] = useState('');

  const supplier = dashboard.metrics.supplier || {};
  const actions = dashboard.metrics.actions || {};
  const pendingRisk = num(actions.replyPending) + num(actions.deletePending);
  const verifiedCount = num(supplier.exactCount) + num(supplier.modifiedCount);

  async function uploadWorkbook(file: File | undefined, kind: 'owned' | 'supplier') {
    if (!file) return;
    setLoading(true);
    setRunResult('');
    try {
      if (!window.XLSX) throw new Error('Excel 解析组件尚未加载');
      const book = window.XLSX.read(await file.arrayBuffer());
      const rows = window.XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' });
      const result = await api<{ imported: number; skipped: number }>('/api/import', {
        method: 'POST',
        body: JSON.stringify({ kind, rows, projectId }),
      });
      showToast('表格导入完成，导入 ' + result.imported + ' 条，跳过 ' + result.skipped + ' 条', 'success');
      setRunResult('导入 ' + result.imported + ' 条，跳过 ' + result.skipped + ' 条。');
      await onRefresh({ fresh: true });
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function verifySupplier() {
    setLoading(true);
    setRunResult('');
    try {
      const result = await api<{
        summary: { exact: number; modified: number; missing: number; failedNotes: number };
        processed?: number;
        remaining?: number;
        failedNotes?: number;
      }>('/api/supplier/verify', {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      });
      const processed = result.processed ?? (result.summary.exact + result.summary.modified + result.summary.missing);
      const remaining = result.remaining ?? 0;
      showToast(`供应商评论核验完成，处理 ${processed} 条，剩余 ${remaining} 条`, 'success');
      setRunResult(
        `外显核验：原文一致 ${result.summary.exact}，有修改 ${result.summary.modified}，未外显 ${result.summary.missing}。本次共处理 ${processed} 条${remaining > 0 ? `，剩余待核验 ${remaining} 条` : ''}。`
      );
      await onRefresh({ fresh: true });
    } catch (err) {
      showToast(err instanceof Error ? err.message : '核验失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  const tabs: ModuleTab[] = [
    { id: 'actions', title: '口碑与处置', desc: '情绪构成、动态话题与规则闭环', badge: `${pct(dashboard.metrics.positiveRate)} · ${pendingRisk}待办`, icon: '💬' },
    { id: 'collection', title: '采集监测', desc: '按ID/链接抓取、批量采集与快照变动', badge: dashboard.metrics.commentTotal || 0, icon: '🛰️' },
    { id: 'acceptance', title: '交付验收', desc: '主线交付、可汇报线与品牌提及率', badge: dashboard.metrics.noteCount || 0, icon: '🎯' },
    { id: 'supplier', title: '供应商核验', desc: '交付Excel导入、隔天外显与共性分析', badge: verifiedCount || 0, icon: '🛡️' },
  ];

  return (
    <div className="ops-workspace">
      <PageHeader
        eyebrow="COMMENT OPERATIONS"
        title="评论运营"
        subtitle="口碑分析、评论采集、处置、验收与供应商核验"
        badge={
          <span>
            {verifiedCount} 已确认外显 · {pendingRisk} 风险待办
          </span>
        }
      />

      <WorkspaceModuleTabs tabs={tabs} activeTab={tab} onChange={setTab} />

      {tab === 'collection' && (
        <CommentCollection
          projectId={projectId}
          openNote={openNote}
          onRefresh={onRefresh}
          toast={showToast}
        />
      )}

      {tab === 'actions' && (
        <div className="stack animate-fade-in">
          <div style={{ display: 'flex', gap: '8px', padding: '4px', background: '#f1f5f9', borderRadius: '10px', width: 'fit-content' }}>
            <button
              type="button"
              onClick={() => setSubView('voice')}
              style={{
                border: 'none',
                background: subView === 'voice' ? '#ffffff' : 'transparent',
                color: subView === 'voice' ? '#0f172a' : '#64748b',
                fontWeight: subView === 'voice' ? 700 : 500,
                padding: '6px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: subView === 'voice' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>📊</span>
              <span>口碑大盘 (主看板)</span>
            </button>
            <button
              type="button"
              onClick={() => setSubView('triage')}
              style={{
                border: 'none',
                background: subView === 'triage' ? '#ffffff' : 'transparent',
                color: subView === 'triage' ? '#0f172a' : '#64748b',
                fontWeight: subView === 'triage' ? 700 : 500,
                padding: '6px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: subView === 'triage' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>⚡</span>
              <span>待办处置清单 ({pendingRisk})</span>
            </button>
          </div>

          {subView === 'voice' ? (
            <VoiceIntelligence
              data={dashboard}
              onSwitchTab={() => setSubView('triage')}
            />
          ) : (
            <CommentActionWorkbench
              projectId={projectId}
              onRefresh={onRefresh}
              toast={showToast}
            />
          )}
        </div>
      )}

      {tab === 'acceptance' && (
        <AcceptanceDelivery
          projectId={projectId}
          dashboard={dashboard}
          acceptance={ops.settings.acceptance}
          openNote={openNote}
          toast={showToast}
        />
      )}

      {tab === 'supplier' && (
        <SupplierVerification
          projectId={projectId}
          ops={ops}
          uploadWorkbook={uploadWorkbook}
          verifySupplier={verifySupplier}
          loading={loading}
          runResult={runResult}
          onDone={onRefresh}
          toast={showToast}
        />
      )}

      {renderDrawer()}
    </div>
  );
}
