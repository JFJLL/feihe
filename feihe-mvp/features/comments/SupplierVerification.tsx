import React, { useState, useEffect, useCallback } from 'react';
import Link from '../../components/ui/AppLink';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { StatusBadge } from '../../components/ui/operations/StatusBadge';
import { ProgressBar } from '../../components/ui/operations/ProgressBar';
import { ResultNotice } from '../../components/ui/operations/ResultNotice';
import { WorkspaceToolbar } from '../../components/ui/operations/WorkspaceToolbar';
import { DataTableShell } from '../../components/ui/operations/DataTableShell';
import { EmptyState } from '../../components/ui/EmptyState';
import { api, cnTime } from '../../lib/hooks/use-project-data';
import type { Dashboard, Ops } from '../../lib/types/project';
import type { SupplierCommentItem } from './comment-view-model';

export function SupplierVerification({
  projectId,
  ops,
  uploadWorkbook,
  verifySupplier,
  loading: actionLoading,
  runResult,
  onDone,
  toast,
}: {
  projectId: string;
  dashboard: Dashboard;
  ops: Ops;
  uploadWorkbook: (f: File | undefined, k: 'owned' | 'supplier') => void;
  verifySupplier: () => void;
  loading: boolean;
  runResult: string;
  projectId: string;
  onDone: () => Promise<void>;
  toast: (v: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [items, setItems] = useState<SupplierCommentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    total: 0,
    exactCount: 0,
    modifiedCount: 0,
    missingCount: 0,
    pendingCount: 0,
  });

  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');

  const loadSupplierList = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        projectId,
        page: String(page),
        pageSize: '20',
      });
      if (visibilityFilter) p.set('visibility', visibilityFilter);
      if (query) p.set('query', query);
      const res = await api<{
        ok: boolean;
        items: SupplierCommentItem[];
        total: number;
        summary: { total: number; exactCount: number; modifiedCount: number; missingCount: number; pendingCount: number };
      }>('/api/supplier/list?' + p.toString());

      setItems(res.items || []);
      setTotal(res.total || 0);
      if (res.summary) setSummary(res.summary);
    } catch (e) {
      toast(e instanceof Error ? e.message : '加载供应商评论明细失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, page, visibilityFilter, query, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSupplierList();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSupplierList]);

  async function handleDelete(id: number) {
    if (!confirm('确认删除此条供应商评论记录？')) return;
    try {
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({ action: 'supplier_delete', projectId, id }),
      });
      toast('记录已删除', 'success');
      await loadSupplierList();
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    }
  }

  const visibleCount = summary.exactCount + summary.modifiedCount;
  const visibleRate = summary.total > 0 ? Math.round((visibleCount / summary.total) * 1000) / 10 : 0;

  return (
    <div className="stack animate-fade-in">
      {/* A. 供应商核验摘要 4 张 KPI */}
      <section className="ops-metric-grid">
        <MetricCard
          theme="green"
          label="原文一致外显"
          value={summary.exactCount.toLocaleString()}
          unit="条"
          desc="实际抓取与计划内容文本高度一致"
          tag="完全合规"
        />
        <MetricCard
          theme="blue"
          label="有修改但外显"
          value={summary.modifiedCount.toLocaleString()}
          unit="条"
          desc="达人或水军做过自然改写后成功外显"
          tag="改写通过"
        />
        <MetricCard
          theme="red"
          label="当前未外显"
          value={summary.missingCount.toLocaleString()}
          unit="条"
          desc="未在小红书前台检索到，需供应商补发"
          tag="需补发"
        />
        <MetricCard
          theme="yellow"
          label="待核验评论"
          value={summary.pendingCount.toLocaleString()}
          unit="条"
          desc="新导入或等待下一轮全量评论核验比对"
          tag="待比对"
        />
      </section>

      {/* B. 核验操作区 */}
      <DashboardSection
        eyebrow="SUPPLIER QA ACTIONS"
        title="隔天外显复核操作"
        desc="导入供应商执行 Excel 交付表，自动按笔记抓取全量评论并完成字符与相似度模糊比对。"
      >
        <div className="ops-action-card ops-action-card-purple" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <label className="upload" style={{ margin: 0, cursor: 'pointer' }}>
                导入交付 Excel 表
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadFileName(file.name);
                      uploadWorkbook(file, 'supplier');
                    }
                  }}
                />
              </label>
              {uploadFileName && (
                <span style={{ fontSize: '12.5px', color: '#6d28d9', fontWeight: 600 }}>
                  已选：{uploadFileName}
                </span>
              )}
              <span style={{ fontSize: '13px', color: '#475569' }}>
                待检池：<strong>{summary.total}</strong> 条（待核验 <strong>{summary.pendingCount}</strong> 条）
              </span>
            </div>

            <button
              type="button"
              className="primary"
              disabled={actionLoading || summary.total === 0}
              onClick={async () => {
                await verifySupplier();
                await loadSupplierList();
              }}
              style={{ background: '#7c3aed', borderColor: '#6d28d9', minWidth: '140px' }}
            >
              {actionLoading ? '核验比对中…' : '核验全部待检评论'}
            </button>
          </div>

          {runResult && (
            <ResultNotice type="info" className="mt-2">
              {runResult}
            </ResultNotice>
          )}
        </div>
      </DashboardSection>

      {/* C. 外显率与审核共性 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        <DashboardSection
          eyebrow="VISIBILITY RATE"
          title="整体外显达成率"
          desc="实际成功外显条数（原文一致 + 有修改外显）占总交付条数的比例。"
        >
          <div style={{ padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>
                {summary.total > 0 ? `${visibleRate}%` : '—'}
              </span>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                已外显 <strong>{visibleCount}</strong> / 总交付 <strong>{summary.total}</strong> 条
              </span>
            </div>
            <ProgressBar value={visibleCount} max={summary.total || 100} theme="green" />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '16px', textAlign: 'center' }}>
              <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11.5px', color: '#15803d' }}>原文一致</div>
                <strong style={{ fontSize: '15px', color: '#166534' }}>{summary.exactCount}</strong>
              </div>
              <div style={{ background: '#f0f9ff', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11.5px', color: '#0369a1' }}>改写外显</div>
                <strong style={{ fontSize: '15px', color: '#075985' }}>{summary.modifiedCount}</strong>
              </div>
              <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11.5px', color: '#b91c1c' }}>未外显</div>
                <strong style={{ fontSize: '15px', color: '#991b1b' }}>{summary.missingCount}</strong>
              </div>
            </div>
          </div>
        </DashboardSection>

        <DashboardSection
          eyebrow="PASSING INSIGHTS"
          title="审核通过共性特征"
          desc="分析已外显话术在句长、细节词与断句上的表达特征。"
        >
          <div style={{ display: 'grid', gap: '10px' }}>
            {ops.supplierFeatures && ops.supplierFeatures.length > 0 ? (
              ops.supplierFeatures.map((x) => (
                <div
                  key={x.visibility}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <StatusBadge status={x.visibility.replace('当前外显-', '')} />
                  <span style={{ fontSize: '12.5px', color: '#475569' }}>
                    均长 <strong>{x.avgLength}</strong> 字 · 细节词率 <strong>{x.detailRate}%</strong> · 自然断句 <strong>{x.commaRate}%</strong>
                  </span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '12.5px', color: '#64748b', padding: '12px 0' }}>
                暂无足量外显特征统计样本。
              </div>
            )}
          </div>
        </DashboardSection>
      </div>

      {/* D. 供应商评论明细（真实服务端分页，不限制120条） */}
      <DashboardSection
        eyebrow="SUPPLIER AUDIT DETAIL"
        title="供应商交付与外显核验明细"
        desc="全量分页查看供应商交付的笔记计划评论、实际匹配外显文本及复核时间戳。"
        extra={
          <Link
            className="btn-link"
            style={{ fontSize: '13px' }}
            href={'/api/export?type=supplier&projectId=' + encodeURIComponent(projectId)}
          >
            导出核验清单 ↗
          </Link>
        }
      >
        <WorkspaceToolbar>
          <input
            type="text"
            placeholder="搜索笔记ID / 达人 / 计划评论内容"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            style={{ width: '240px' }}
          />
          <select value={visibilityFilter} onChange={(e) => { setVisibilityFilter(e.target.value); setPage(1); }}>
            <option value="">全部核验状态</option>
            <option value="待核验">待核验</option>
            <option value="当前外显-原文一致">当前外显-原文一致</option>
            <option value="当前外显-有修改">当前外显-有修改</option>
            <option value="当前未外显">当前未外显</option>
          </select>
        </WorkspaceToolbar>

        <DataTableShell
          page={page}
          pageSize={20}
          total={total}
          onPageChange={(p) => setPage(p)}
          loading={loading}
        >
          <table className="ops-table">
            <thead>
              <tr>
                <th>笔记与达人</th>
                <th>计划发布评论内容</th>
                <th>前台实际外显匹配</th>
                <th>核验状态</th>
                <th>核验时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <a
                        href={row.noteUrl || `https://www.xiaohongshu.com/explore/${row.noteId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link"
                        style={{ fontWeight: 600 }}
                      >
                        {row.noteId.slice(0, 14)}… ↗
                      </a>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{row.creator || '未知达人'}</span>
                    </div>
                  </td>
                  <td style={{ maxWidth: '300px' }}>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#0f172a' }}>
                      {row.plannedContent}
                    </p>
                  </td>
                  <td style={{ maxWidth: '300px' }}>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: row.matchedContent ? '#15803d' : '#94a3b8' }}>
                      {row.matchedContent || '—'}
                    </p>
                  </td>
                  <td>
                    <StatusBadge status={row.visibility} />
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {row.verifiedAt ? cnTime(row.verifiedAt) : '未核验'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="danger-link"
                      style={{ fontSize: '12px', padding: 0 }}
                      onClick={() => handleDelete(row.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && !loading && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="暂无匹配的供应商评论" text="导入供应商交付表格后开始外显比对。" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DataTableShell>
      </DashboardSection>
    </div>
  );
}
