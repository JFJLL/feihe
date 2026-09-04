import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from '../../components/ui/AppLink';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { StatusBadge } from '../../components/ui/operations/StatusBadge';
import { ResultNotice } from '../../components/ui/operations/ResultNotice';
import { WorkspaceToolbar } from '../../components/ui/operations/WorkspaceToolbar';
import { DataTableShell } from '../../components/ui/operations/DataTableShell';
import { EmptyState } from '../../components/ui/EmptyState';
import { api } from '../../lib/hooks/use-project-data';
import type { ActionWorkbenchItem } from './comment-view-model';

export function CommentActionWorkbench({
  projectId,
  onRefresh,
  toast,
}: {
  projectId: string;
  onRefresh: () => Promise<void>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const searchParams = useSearchParams();

  // Initialize from URL search params
  const [sourceFilter, setSourceFilter] = useState<'all' | 'key-comment' | 'review-batch'>(
    (searchParams.get('source') as 'all' | 'key-comment' | 'review-batch') || 'all'
  );
  const [actionFilter, setActionFilter] = useState(searchParams.get('action') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'pending');
  const [sentimentFilter, setSentimentFilter] = useState(searchParams.get('sentiment') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [selectedDate, setSelectedDate] = useState<string>(searchParams.get('date') || '');
  const [query, setQuery] = useState(searchParams.get('query') || '');
  const [page, setPage] = useState(Math.max(1, parseInt(searchParams.get('page') || '1', 10)));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ActionWorkbenchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [summary, setSummary] = useState({
    totalPending: 0,
    replyPending: 0,
    deletePending: 0,
    supplementPending: 0,
    observePending: 0,
    handledCount: 0,
  });

  const reqSeqRef = useRef(0);

  // Sync state to URL with replaceState
  const syncToUrl = useCallback(
    (nextState: {
      query: string;
      source: string;
      status: string;
      action: string;
      sentiment: string;
      category: string;
      date: string;
      page: number;
    }) => {
      try {
        const p = new URLSearchParams(window.location.search);
        if (nextState.query) p.set('query', nextState.query); else p.delete('query');
        if (nextState.source && nextState.source !== 'all') p.set('source', nextState.source); else p.delete('source');
        if (nextState.status && nextState.status !== 'pending') p.set('status', nextState.status); else p.delete('status');
        if (nextState.action) p.set('action', nextState.action); else p.delete('action');
        if (nextState.sentiment) p.set('sentiment', nextState.sentiment); else p.delete('sentiment');
        if (nextState.category) p.set('category', nextState.category); else p.delete('category');
        if (nextState.date) p.set('date', nextState.date); else p.delete('date');
        if (nextState.page > 1) p.set('page', String(nextState.page)); else p.delete('page');
        window.history.replaceState(null, '', window.location.pathname + (p.toString() ? '?' + p.toString() : ''));
      } catch {}
    },
    []
  );

  // Debounce query and trigger search
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Sync state changes to URL
  useEffect(() => {
    syncToUrl({
      query: debouncedQuery,
      source: sourceFilter,
      status: statusFilter,
      action: actionFilter,
      sentiment: sentimentFilter,
      category: categoryFilter,
      date: selectedDate,
      page,
    });
  }, [debouncedQuery, sourceFilter, statusFilter, actionFilter, sentimentFilter, categoryFilter, selectedDate, page, syncToUrl]);

  // Handle browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      setQuery(p.get('query') || '');
      setDebouncedQuery(p.get('query') || '');
      setSourceFilter((p.get('source') as 'all' | 'key-comment' | 'review-batch') || 'all');
      setStatusFilter(p.get('status') || 'pending');
      setActionFilter(p.get('action') || '');
      setSentimentFilter(p.get('sentiment') || '');
      setCategoryFilter(p.get('category') || '');
      setSelectedDate(p.get('date') || '');
      setPage(Math.max(1, parseInt(p.get('page') || '1', 10)));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Server-side paginated data loader
  const loadWorkbenchData = useCallback(async () => {
    const seq = ++reqSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({
        projectId,
        page: String(page),
        pageSize: '20',
        source: sourceFilter,
        status: statusFilter || 'all',
      });
      if (actionFilter) p.set('action', actionFilter);
      if (sentimentFilter) p.set('sentiment', sentimentFilter);
      if (categoryFilter) p.set('category', categoryFilter);
      if (selectedDate) p.set('date', selectedDate);
      if (debouncedQuery) p.set('query', debouncedQuery);

      const res = await api<{
        ok: boolean;
        items: ActionWorkbenchItem[];
        total: number;
        page: number;
        pageSize: number;
        summary: {
          totalPending: number;
          replyPending: number;
          deletePending: number;
          supplementPending: number;
          observePending: number;
          handledCount: number;
        };
        availableDates: string[];
      }>('/api/actions/workbench?' + p.toString());

      if (seq !== reqSeqRef.current) return;

      setItems(res.items || []);
      setTotal(res.total || 0);
      if (res.summary) setSummary(res.summary);
      if (res.availableDates) {
        setAvailableDates(res.availableDates);
        if (!selectedDate && res.availableDates.length > 0 && sourceFilter === 'review-batch') {
          setSelectedDate(res.availableDates[res.availableDates.length - 1]);
        }
      }
    } catch (e) {
      if (seq !== reqSeqRef.current) return;
      const msg = e instanceof Error ? e.message : '加载待办任务失败';
      setError(msg);
      toast(msg, 'error');
    } finally {
      if (seq === reqSeqRef.current) {
        setLoading(false);
      }
    }
  }, [projectId, page, sourceFilter, statusFilter, actionFilter, sentimentFilter, categoryFilter, selectedDate, debouncedQuery, toast]);

  useEffect(() => {
    void loadWorkbenchData();
  }, [loadWorkbenchData]);

  // Action handlers with optimistic updates
  async function handleResolve(item: ActionWorkbenchItem, method: string) {
    try {
      await api('/api/actions/workbench', {
        method: 'POST',
        body: JSON.stringify({
          id: item.id,
          rawId: item.rawId,
          source: item.source,
          action: 'resolve',
          method,
          projectId,
        }),
      });

      // Optimistic update
      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, status: 'handled' } : x))
      );
      setSummary((prev) => ({
        ...prev,
        totalPending: Math.max(0, prev.totalPending - 1),
        replyPending: item.action === 'reply' ? Math.max(0, prev.replyPending - 1) : prev.replyPending,
        deletePending: item.action === 'delete' ? Math.max(0, prev.deletePending - 1) : prev.deletePending,
        supplementPending: item.action === 'supplement' ? Math.max(0, prev.supplementPending - 1) : prev.supplementPending,
        handledCount: prev.handledCount + 1,
      }));

      toast(`已标记${method}`, 'success');
      await onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    }
  }

  async function handleRemove(item: ActionWorkbenchItem) {
    if (!confirm('确认从清单中移除此待办记录？此操作将物理删除记录。')) return;
    try {
      await api('/api/actions/workbench', {
        method: 'POST',
        body: JSON.stringify({
          id: item.id,
          rawId: item.rawId,
          source: item.source,
          action: 'delete',
          projectId,
        }),
      });

      setItems((prev) => prev.filter((x) => x.id !== item.id));
      setTotal((prev) => Math.max(0, prev - 1));
      toast('记录已移除', 'success');
      await onRefresh();
      void loadWorkbenchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : '移除失败', 'error');
    }
  }

  return (
    <div className="stack animate-fade-in">
      {/* 顶部 KPI：待办任务数 */}
      <section className="ops-metric-grid">
        <MetricCard
          theme="indigo"
          label="全部待办任务"
          value={summary.totalPending}
          unit="项"
          desc="整合关键评论舆情与规则判定队列待办"
          tag="待办总盘"
        />
        <MetricCard
          theme="blue"
          label="需达人回复"
          value={summary.replyPending}
          unit="项"
          desc="正向问询或轻负面，需引导官方/达人回复"
          tag="舆情承接"
        />
        <MetricCard
          theme="red"
          label="需删除违规"
          value={summary.deletePending}
          unit="项"
          desc="严重负面、竞品拉踩或违规广告评论"
          tag="风险处置"
        />
        <MetricCard
          theme="yellow"
          label="需补充笔记"
          value={summary.supplementPending}
          unit="篇"
          desc="评论达标数或品牌提及不足需追加"
          tag="交付缺口"
        />
      </section>

      {/* 统一处置工作台列表 */}
      <DashboardSection
        eyebrow="ACTION WORKBENCH"
        title="舆情风险与规则判定统一处置台"
        desc="整合自实时检出的关键评论与各批次审核规则判定，支持真正的服务端全量检索与分页处置。"
        extra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="primary"
              style={{ fontSize: '13px', padding: '6px 14px' }}
              onClick={loadWorkbenchData}
              disabled={loading}
            >
              {loading ? '刷新中…' : '刷新待办'}
            </button>
            <Link
              className="btn-link"
              style={{ fontSize: '13px' }}
              href={'/api/export?type=comments&projectId=' + encodeURIComponent(projectId)}
            >
              导出关键评论 ↗
            </Link>
          </div>
        }
      >
        <WorkspaceToolbar>
          <input
            type="text"
            placeholder="搜索评论内容 / 博主 / 笔记ID / 原因"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            style={{ width: '240px' }}
          />
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value as 'all' | 'key-comment' | 'review-batch');
              setPage(1);
            }}
          >
            <option value="all">全部来源（关键评论 + 判定批次）</option>
            <option value="key-comment">仅关键评论</option>
            <option value="review-batch">仅规则判定批次</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="pending">待处理任务</option>
            <option value="handled">已处理归档</option>
            <option value="all">全部处理状态</option>
          </select>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">全部动作类型</option>
            <option value="reply">需回复</option>
            <option value="delete">需删除</option>
            <option value="supplement">需补充</option>
            <option value="observe">保留观察</option>
          </select>
          {availableDates.length > 0 && (
            <select
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(1);
              }}
              style={{ borderColor: '#c7d2fe' }}
            >
              <option value="">全部判定日期</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  批次：{d}
                </option>
              ))}
            </select>
          )}
        </WorkspaceToolbar>

        {error && (
          <div style={{ marginBottom: '14px' }}>
            <ResultNotice type="error">
              待办任务加载失败：{error}
              <button
                type="button"
                onClick={loadWorkbenchData}
                style={{ marginLeft: '12px', fontSize: '12px', padding: '2px 8px', cursor: 'pointer' }}
              >
                重新加载
              </button>
            </ResultNotice>
          </div>
        )}

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
                <th>来源 / 动作</th>
                <th>情绪 / 分类</th>
                <th>待处置内容 / 判定样本</th>
                <th>判定原因 / 规则</th>
                <th>博主 / 笔记链接</th>
                <th>状态</th>
                <th>操作按钮</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <StatusBadge
                        status={item.source === 'key-comment' ? '关键评论' : `判定批次 ${item.batchDate || ''}`}
                        theme={item.source === 'key-comment' ? 'blue' : 'purple'}
                      />
                      <strong
                        style={{
                          fontSize: '13px',
                          color:
                            item.action === 'delete'
                              ? '#b91c1c'
                              : item.action === 'reply'
                              ? '#0369a1'
                              : item.action === 'supplement'
                              ? '#d97706'
                              : '#334155',
                        }}
                      >
                        {item.action === 'reply'
                          ? '需回复'
                          : item.action === 'delete'
                          ? '需删除'
                          : item.action === 'supplement'
                          ? '需补充'
                          : '保留观察'}
                      </strong>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {item.sentiment && <StatusBadge status={item.sentiment} />}
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{item.category || '规则判定'}</span>
                    </div>
                  </td>
                  <td style={{ maxWidth: '320px' }}>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#0f172a' }}>
                      {item.content}
                    </p>
                  </td>
                  <td>
                    <span style={{ fontSize: '12.5px', color: '#475569' }}>{item.reason}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.author || '未知作者'}</span>
                      {item.link ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-link"
                          style={{ fontSize: '12px' }}
                        >
                          查看笔记 ↗
                        </a>
                      ) : (
                        item.noteId && <small style={{ color: '#94a3b8' }}>{item.noteId.slice(0, 10)}…</small>
                      )}
                    </div>
                  </td>
                  <td>
                    <StatusBadge
                      status={item.status === 'handled' ? '已处理' : '待处理'}
                      theme={item.status === 'handled' ? 'green' : 'yellow'}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {item.status !== 'handled' ? (
                        <>
                          {item.action === 'reply' && (
                            <button
                              type="button"
                              className="primary"
                              style={{ fontSize: '12px', padding: '4px 10px', background: '#0284c7' }}
                              onClick={() => handleResolve(item, '已回复')}
                            >
                              标记已回复
                            </button>
                          )}
                          {item.action === 'delete' && (
                            <button
                              type="button"
                              className="primary"
                              style={{ fontSize: '12px', padding: '4px 10px', background: '#dc2626', borderColor: '#b91c1c' }}
                              onClick={() => handleResolve(item, '已删除')}
                            >
                              标记已删除
                            </button>
                          )}
                          {item.action === 'supplement' && (
                            <button
                              type="button"
                              className="primary"
                              style={{ fontSize: '12px', padding: '4px 10px', background: '#d97706', borderColor: '#b45309' }}
                              onClick={() => handleResolve(item, '已补充')}
                            >
                              标记已补充
                            </button>
                          )}
                          {item.action === 'observe' && (
                            <button
                              type="button"
                              className="primary"
                              style={{ fontSize: '12px', padding: '4px 10px', background: '#475569' }}
                              onClick={() => handleResolve(item, '已确认观察')}
                            >
                              标记已处理
                            </button>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>✓ 已闭环</span>
                      )}

                      {item.source === 'key-comment' && (
                        <button
                          type="button"
                          className="danger-link"
                          style={{ fontSize: '12px', padding: 0 }}
                          onClick={() => handleRemove(item)}
                        >
                          移除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && !loading && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="暂无待办任务" text="当前筛选条件下没有待处置的评论或规则判定。" />
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
