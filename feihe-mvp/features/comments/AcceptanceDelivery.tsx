import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from '../../components/ui/AppLink';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { StatusBadge } from '../../components/ui/operations/StatusBadge';
import { ProgressBar } from '../../components/ui/operations/ProgressBar';
import { WorkspaceToolbar } from '../../components/ui/operations/WorkspaceToolbar';
import { DataTableShell } from '../../components/ui/operations/DataTableShell';
import { EmptyState } from '../../components/ui/EmptyState';
import { api, cnTime, pct } from '../../lib/hooks/use-project-data';
import type { Dashboard, Acceptance } from '../../lib/types/project';
import { emptyNotesSummary, type NoteListItem, type NotesListResponse } from '../content/content-view-model';

export function AcceptanceDelivery({
  projectId,
  dashboard,
  acceptance,
  openNote,
  toast,
}: {
  projectId: string;
  dashboard: Dashboard;
  acceptance: Acceptance;
  openNote: (id: string) => void;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [items, setItems] = useState<NoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<NotesListResponse['summary']>(emptyNotesSummary);

  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('query') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(Math.max(1, parseInt(searchParams.get('page') || '1', 10)));
  const [loading, setLoading] = useState(false);

  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const syncToUrl = useCallback((nextState: { query: string; status: string; page: number }) => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (nextState.query) p.set('query', nextState.query); else p.delete('query');
      if (nextState.status) p.set('status', nextState.status); else p.delete('status');
      if (nextState.page > 1) p.set('page', String(nextState.page)); else p.delete('page');
      window.history.replaceState(null, '', window.location.pathname + (p.toString() ? '?' + p.toString() : ''));
    } catch {}
  }, []);

  useEffect(() => {
    syncToUrl({ query: debouncedQuery, status: statusFilter, page });
  }, [debouncedQuery, statusFilter, page, syncToUrl]);

  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      setQuery(p.get('query') || '');
      setDebouncedQuery(p.get('query') || '');
      setStatusFilter(p.get('status') || '');
      setPage(Math.max(1, parseInt(p.get('page') || '1', 10)));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadAcceptanceNotes = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        projectId,
        view: 'acceptance',
        page: String(page),
        pageSize: '20',
      });
      if (debouncedQuery) p.set('query', debouncedQuery);
      if (statusFilter) p.set('status', statusFilter);
      const res = await api<NotesListResponse>('/api/notes/list?' + p.toString());
      setItems(res.items || []);
      setTotal(res.total || 0);
      if (res.summary) setSummary(res.summary);
    } catch (e) {
      toast(e instanceof Error ? e.message : '加载验收明细失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, page, debouncedQuery, statusFilter, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAcceptanceNotes();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAcceptanceNotes]);

  const reportReq = acceptance.reportCount || 200;
  const baseReq = acceptance.baseCount || 30;
  const brandReqRate = acceptance.brandTopRate || 0.4;

  return (
    <div className="stack animate-fade-in">
      {/* 顶部真实经营 KPI */}
      <section className="ops-metric-grid">
        <MetricCard
          theme="green"
          label="符合且能汇报"
          value={summary.reportableCount.toLocaleString()}
          unit="篇"
          desc={`≥${reportReq}条评论 且 前5提及率≥${pct(brandReqRate)}`}
          tag="最高档交付"
        />
        <MetricCard
          theme="blue"
          label="符合基础要求"
          value={summary.baseCount.toLocaleString()}
          unit="篇"
          desc={`有效评论达到 ${baseReq} 条考核基线`}
          tag="基础达标"
        />
        <MetricCard
          theme="yellow"
          label="需补充笔记"
          value={summary.supplementCount.toLocaleString()}
          unit="篇"
          desc={`不足 ${baseReq} 条，进入供应商/达人补量`}
          tag="补量缺口"
        />
        <MetricCard
          theme="red"
          label="需达人回复"
          value={Number(dashboard.metrics.actions.replyPending || 0)}
          unit="条"
          desc="高价值问询或轻负面，24小时内承接"
          tag="回复待办"
        />
      </section>

      {/* 真实验收规则展示卡 */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px' }}>📋</span>
          <div>
            <strong style={{ fontSize: '13.5px', color: '#166534' }}>当前项目验收判定规则配置</strong>
            <div style={{ fontSize: '12px', color: '#15803d', marginTop: '2px' }}>
              可汇报线：≥ <strong>{reportReq}</strong> 条 · 基础达标线：≥ <strong>{baseReq}</strong> 条 · 前5主评品牌提及率阈值：≥ <strong>{pct(brandReqRate)}</strong> · 新鲜度：{acceptance.freshnessHours || 24}小时
            </div>
          </div>
        </div>
        <Link
          href={`/projects/${encodeURIComponent(projectId)}/settings?tab=rules`}
          className="btn-link"
          style={{ fontSize: '12.5px', color: '#15803d' }}
        >
          修改项目规则配置 →
        </Link>
      </div>

      {/* 主线交付与进度卡片 */}
      <DashboardSection
        eyebrow="PIPELINE DELIVERY"
        title="主线交付进度与费用消耗"
        desc="每条执行主线的评论交付完成率与预算消耗率实时进度。"
        extra={
          <Link
            className="btn-link"
            style={{ fontSize: '13px' }}
            href={'/api/export?type=jobs&projectId=' + encodeURIComponent(projectId)}
          >
            导出交付记录 ↗
          </Link>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {dashboard.pipelines.map((p) => {
            const commentRate = p.targetCount > 0 ? Math.round((p.deliveredCount / p.targetCount) * 1000) / 10 : 0;
            const budgetRate = p.budget > 0 ? Math.round((p.spent / p.budget) * 1000) / 10 : 0;
            const isOverBudget = p.budget > 0 && p.spent > p.budget;
            const overBudgetAmount = isOverBudget ? p.spent - p.budget : 0;
            const overBudgetRate = isOverBudget ? Math.round(((p.spent - p.budget) / p.budget) * 1000) / 10 : 0;
            const remaining = Math.max(0, p.targetCount - p.deliveredCount);
            const isComplete = p.deliveredCount >= p.targetCount && p.targetCount > 0;
            const themeColor = isComplete ? 'green' : commentRate < 50 ? 'yellow' : 'blue';

            return (
              <article
                key={p.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '18px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '15px', color: '#0f172a' }}>{p.name}</strong>
                  <StatusBadge status={isComplete ? '已完成' : '执行中'} theme={isComplete ? 'green' : 'blue'} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                    <span>交付条数：<strong>{p.deliveredCount}</strong> / {p.targetCount || '—'} 条</span>
                    <span>完成率：{commentRate}%</span>
                  </div>
                  <ProgressBar value={p.deliveredCount} max={p.targetCount || p.deliveredCount || 100} theme={themeColor} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: isOverBudget ? '#dc2626' : '#64748b', marginBottom: '4px' }}>
                    <span>预算消耗：¥<strong>{p.spent.toLocaleString()}</strong> / ¥{p.budget.toLocaleString()}</span>
                    <span>{isOverBudget ? `超支 ${budgetRate}% (+¥${overBudgetAmount.toLocaleString()} / +${overBudgetRate}%)` : `消耗率：${budgetRate}%`}</span>
                  </div>
                  <ProgressBar value={p.spent} max={p.budget || p.spent || 100} theme={isOverBudget ? 'red' : 'teal'} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                  <span>剩余交付：<strong>{remaining}</strong> 条</span>
                  <span>结余预算：¥{Math.max(0, p.budget - p.spent).toLocaleString()}</span>
                </div>
              </article>
            );
          })}
        </div>
      </DashboardSection>

      {/* 交付验收明细列表 */}
      <DashboardSection
        eyebrow="ACCEPTANCE DETAIL"
        title="笔记交付验收与缺口明细"
        desc="展示每篇笔记评论总量、正负向分布、前排品牌提及率及距离下一档达标缺口。"
      >
        <WorkspaceToolbar>
          <input
            type="text"
            placeholder="搜索笔记 / 博主"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            style={{ width: '220px' }}
          />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">全部验收状态</option>
            <option value="符合且能汇报">符合且能汇报</option>
            <option value="符合基础要求">符合基础要求</option>
            <option value={`不够${baseReq}条需补充`}>不够{baseReq}条需补充</option>
            <option value="需补充">需补充</option>
            <option value="待抓取">待抓取</option>
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
                <th>笔记信息</th>
                <th>评论总数</th>
                <th>正向评论</th>
                <th>负向 / 问询</th>
                <th>前5品牌提及率</th>
                <th>验收结果</th>
                <th>距离下一档缺口</th>
                <th>最近抓取</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((note) => {
                const totalC = note.commentTotal || 0;
                let gapText = '—';
                if (totalC < baseReq) {
                  gapText = `距基础达标差 ${baseReq - totalC} 条`;
                } else if (totalC < reportReq) {
                  const mentionOk = (note.brandMentionTop5 || 0) >= brandReqRate;
                  gapText = `距可汇报差 ${reportReq - totalC} 条${mentionOk ? '' : ' · 品牌提及未达标'}`;
                } else {
                  const mentionOk = (note.brandMentionTop5 || 0) >= brandReqRate;
                  gapText = mentionOk ? '已全面达标' : '总数达标 · 需补品牌提及';
                }

                return (
                  <tr key={note.id}>
                    <td>
                      <div className="ops-table-note-cell">
                      {note.coverUrl ? (
                        <img
                          src={note.coverUrl}
                          alt=""
                          className="ops-table-note-cover"
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            if (!e.currentTarget.dataset.retried) {
                              e.currentTarget.dataset.retried = '1';
                              e.currentTarget.src = '/api/note-covers?projectId=' + encodeURIComponent(projectId) + '&noteId=' + encodeURIComponent(note.id);
                            } else {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m3 15 5-5c.9-.9 2.1-.9 3 0l7 7"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>';
                            }
                          }}
                        />
                        ) : (
                          <div className="ops-table-note-cover">
                            {(note.author || '笔').slice(0, 1)}
                          </div>
                        )}
                        <div className="ops-table-note-info">
                          <span className="ops-table-note-title" title={note.title || note.id}>
                            {note.title || '未命名笔记'}
                          </span>
                          <span className="ops-table-note-sub">
                            {note.author || '未知博主'} · <small style={{ fontFamily: 'monospace' }}>{note.id.slice(0, 10)}…</small>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td><strong>{note.commentTotal}</strong></td>
                    <td>
                      <span style={{ color: '#15803d', fontWeight: 600 }}>
                        {note.positiveCount || 0}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: (note.negativeCount || 0) + (note.questionCount || 0) > 0 ? '#b91c1c' : '#64748b' }}>
                        {(note.negativeCount || 0) + (note.questionCount || 0)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: (note.brandMentionTop5 || 0) >= brandReqRate ? '#15803d' : '#b45309' }}>
                        {pct(note.brandMentionTop5 || 0)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={note.status || '待抓取'} />
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: gapText.includes('已') ? '#15803d' : '#b45309', fontWeight: 500 }}>
                        {gapText}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {note.lastFetchedAt ? cnTime(note.lastFetchedAt).slice(5) : '待抓取'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="text-link"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onClick={() => openNote(note.id)}
                      >
                        验收明细 →
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!items.length && !loading && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState title="未找到验收笔记" text="请先进行评论采集获取真实数据。" />
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
