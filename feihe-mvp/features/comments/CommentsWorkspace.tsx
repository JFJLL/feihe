'use client';

import { useState } from 'react';
import type { Dashboard, Ops, KeyComment } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionTabs } from '../../components/ui/SectionTabs';
import { AcceptanceDelivery } from './AcceptanceDelivery';
import { SupplierVerification } from './SupplierVerification';
import { RiskTriage } from './RiskTriage';
import { api, num } from '../../lib/hooks/use-project-data';

export function CommentsWorkspace({
  projectId,
  dashboard,
  ops,
  initialTab = 'acceptance',
  onRefresh,
  toast,
}: {
  projectId: string;
  dashboard: Dashboard;
  ops: Ops;
  initialTab?: string;
  onRefresh: () => Promise<void>;
  toast: (msg: string) => void;
}) {
  const [tab, setTab] = useState(initialTab);
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
      toast('表格导入完成');
      setRunResult('导入 ' + result.imported + ' 条，跳过 ' + result.skipped + ' 条。');
      await onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '导入失败');
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
      }>('/api/supplier/verify', {
        method: 'POST',
        body: JSON.stringify({ projectId }),
      });
      toast('供应商外显核验完成');
      setRunResult(
        '原文一致 ' +
          result.summary.exact +
          '，有修改 ' +
          result.summary.modified +
          '，未外显 ' +
          result.summary.missing +
          '，失败笔记 ' +
          result.summary.failedNotes +
          '。'
      );
      await onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '核验失败');
    } finally {
      setLoading(false);
    }
  }

  async function resolveComment(item: KeyComment, method: string) {
    try {
      await api('/api/actions', {
        method: 'POST',
        body: JSON.stringify({ id: item.id, status: '已处理', method, projectId }),
      });
      toast('处置状态已更新');
      await onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败');
    }
  }

  async function removeComment(item: KeyComment) {
    if (!confirm('确认从关键评论清单移除此记录？')) return;
    try {
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({ action: 'comment_delete', projectId, id: item.id }),
      });
      toast('关键评论已移除');
      await onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '移除失败');
    }
  }

  const tabs: Array<[string, string, string]> = [
    ['acceptance', '交付验收', '主线交付、达标阈值与品牌提及'],
    ['supplier', '供应商核验', 'Excel 导入与隔天外显复核'],
    ['risk', '风险处置', '关键评论、回复与删除闭环'],
  ];

  return (
    <div className="stack">
      <PageHeader
        eyebrow="COMMENT OPERATIONS"
        title="评论运营"
        subtitle="交付验收、供应商核验与舆情处置统一在评论运营工作区完成。"
        badge={
          <span>
            {verifiedCount} 已确认外显 · {pendingRisk} 风险待办
          </span>
        }
      />

      <SectionTabs value={tab} onChange={setTab} items={tabs} />

      {tab === 'acceptance' && (
        <AcceptanceDelivery
          data={dashboard}
          acceptance={ops.settings.acceptance}
          projectId={projectId}
        />
      )}

      {tab === 'supplier' && (
        <SupplierVerification
          data={dashboard}
          ops={ops}
          uploadWorkbook={uploadWorkbook}
          verifySupplier={verifySupplier}
          loading={loading}
          runResult={runResult}
          projectId={projectId}
          onDone={onRefresh}
          toast={toast}
        />
      )}

      {tab === 'risk' && (
        <RiskTriage
          comments={dashboard.keyComments}
          resolveComment={resolveComment}
          removeComment={removeComment}
          projectId={projectId}
        />
      )}
    </div>
  );
}
