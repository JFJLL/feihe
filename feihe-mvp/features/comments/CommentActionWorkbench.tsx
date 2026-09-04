import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from '../../components/ui/AppLink';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { StatusBadge } from '../../components/ui/operations/StatusBadge';
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
  const [sourceFilter, setSourceFilter] = useState<'all' | 'key-comment' | 'review-batch'>('all');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Key comments state
  const [keyComments, setKeyComments] = useState<ActionWorkbenchItem[]>([]);
  const [keySummary, setKeySummary] = useState({ total: 0, replyPending: 0, deletePending: 0, supplementPending: 0, handledCount: 0 });

  // Review batch state
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [reviewItems, setReviewItems] = useState<ActionWorkbenchItem[]>([]);
  const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({});

  // Load available review dates on mount
  useEffect(() => {
    api<{ ok: boolean; dates: string[] }>('/api/review?projectId=' + encodeURIComponent(projectId))
      .then((r) => {
        const ds = r.dates || [];
        setAvailableDates(ds);
        if (ds.length > 0) {
          setSelectedDate(ds[ds.length - 1]);
        }
      })
      .catch(() => undefined);
  }, [projectId]);

  // Load key comments
  const loadKeyComments = useCallback(async () => {
    try {
      const p = new URLSearchParams({
        projectId,
        pageSize: '100',
      });
      if (query) p.set('query', query);
      const res = await api<{
        ok: boolean;
        items: Array<{
          id: string;
          noteId: string;
          content: string;
          author: string;
          sentiment: string;
          category: string;
          action: string;
          treatmentStatus: string;
          lastSeenAt: string;
          noteTitle?: string;
          noteUrl?: string;
        }>;
        summary: { total: number; replyPending: number; deletePending: number; supplementPending: number; handledCount: number };
      }>('/api/actions?' + p.toString());

      const items: ActionWorkbenchItem[] = (res.items || []).map((c) => {
        let act: ActionWorkbenchItem['action'] = 'observe';
        if (c.action.includes('回复')) act = 'reply';
        else if (c.action.includes('删')) act = 'delete';
        else if (c.action.includes('补')) act = 'supplement';

        return {
          id: `kc-${c.id}`,
          rawId: c.id,
          source: 'key-comment',
          itemType: 'comment',
          action: act,
          status: c.treatmentStatus === '已处理' ? 'handled' : 'pending',
          noteId: c.noteId,
          author: c.author,
          content: c.content,
          sentiment: c.sentiment,
          category: c.category,
          title: c.noteTitle,
          link: c.noteUrl,
          reason: `${c.sentiment} · ${c.category} · ${c.action}`,
        };
      });
      setKeyComments(items);
      if (res.summary) setKeySummary(res.summary);
    } catch (e) {
      console.warn('loadKeyComments error:', e);
    }
  }, [projectId, query]);

  // Load review batch items
  const loadReviewBatch = useCallback(async (dateKey: string) => {
    if (!dateKey) return;
    try {
      const res = await api<{
        ok: boolean;
        counts: Record<string, number>;
        items: Array<{
          id: number;
          link: string;
          blogger: string;
          action: string;
          reason: string;
          sample: string[];
          status: string;
        }>;
      }>(
        '/api/review?projectId=' + encodeURIComponent(projectId) + '&date=' + encodeURIComponent(dateKey) + '&items=1'
      );
      setReviewCounts(res.counts || {});
      const items: ActionWorkbenchItem[] = (res.items || []).map((r) => {
        let act: ActionWorkbenchItem['action'] = 'observe';
        if (r.action.includes('回复')) act = 'reply';
        else if (r.action.includes('删')) act = 'delete';
        else if (r.action.includes('补')) act = 'supplement';

        return {
          id: `rb-${r.id}`,
          rawId: r.id,
          source: 'review-batch',
          itemType: 'note',
          action: act,
          status: r.status === '已处理' ? 'handled' : 'pending',
          author: r.blogger,
          content: (r.sample || []).join('；') || '判定需处理笔记',
          reason: r.reason,
          link: r.link,
          batchDate: dateKey,
        };
      });
      setReviewItems(items);
    } catch (e) {
      console.warn('loadReviewBatch error:', e);
    }
  }, [projectId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadKeyComments(),
      selectedDate ? loadReviewBatch(selectedDate) : Promise.resolve(),
    ]);
    setLoading(false);
  }, [loadKeyComments, loadReviewBatch, selectedDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAll();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAll]);

  // Unified items computation
  const unifiedItems = useMemo(() => {
    let list: ActionWorkbenchItem[] = [];
    if (sourceFilter === 'all') {
      list = [...keyComments, ...reviewItems];
    } else if (sourceFilter === 'key-comment') {
      list = [...keyComments];
    } else {
      list = [...reviewItems];
    }

    return list.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (actionFilter && item.action !== actionFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const match =
          (item.content || '').toLowerCase().includes(q) ||
          (item.author || '').toLowerCase().includes(q) ||
          (item.noteId || '').toLowerCase().includes(q) ||
          (item.reason || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [sourceFilter, keyComments, reviewItems, statusFilter, actionFilter, query]);

  // Top KPIs
  const totalPending =
    keySummary.replyPending + keySummary.deletePending + keySummary.supplementPending +
    Number(reviewCounts.needReply || 0) + Number(reviewCounts.needDelete || 0) + Number(reviewCounts.needSupplement || 0);
  const replyPending = keySummary.replyPending + Number(reviewCounts.needReply || 0);
  const deletePending = keySummary.deletePending + Number(reviewCounts.needDelete || 0);
  const supplementPending = keySummary.supplementPending + Number(reviewCounts.needSupplement || 0);

  // Action handlers
  async function handleResolve(item: ActionWorkbenchItem, method: string) {
    try {
      if (item.source === 'key-comment') {
        await api('/api/actions', {
          method: 'POST',
          body: JSON.stringify({ id: item.rawId, status: '已处理', method, projectId }),
        });
        setKeyComments((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, status: 'handled' } : x))
        );
      } else {
        await api('/api/review', {
          method: 'POST',
          body: JSON.stringify({ id: item.rawId, action: 'resolve', projectId }),
        });
        setReviewItems((prev) =>
          prev.map((x) => (x.id === item.id ? { ...x, status: 'handled' } : x))
        );
      }
      toast(`已标记${method}`, 'success');
      await onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    }
  }

  async function handleRemove(item: ActionWorkbenchItem) {
    if (!confirm('确认从清单中移除此待办记录？此操作将物理删除记录。')) return;
    try {
      if (item.source === 'key-comment') {
        await api('/api/resources', {
          method: 'POST',
          body: JSON.stringify({ action: 'comment_delete', projectId, id: item.rawId }),
        });
        setKeyComments((prev) => prev.filter((x) => x.id !== item.id));
        toast('记录已移除', 'success');
        await onRefresh();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '移除失败', 'error');
    }
  }

  const pagedItems = unifiedItems.slice((page - 1) * 20, page * 20);

  return (
    <div className="stack animate-fade-in">
      {/* 顶部 KPI：待办任务数 */}
      <section className="ops-metric-grid">
        <MetricCard
          theme="indigo"
          label="全部待办任务"
          value={totalPending}
          unit="项"
          desc="整合关键评论舆情与规则判定队列待办"
          tag="待办总盘"
        />
        <MetricCard
          theme="blue"
          label="需达人回复"
          value={replyPending}
          unit="项"
          desc="正向问询或轻负面，需引导官方/达人回复"
          tag="舆情承接"
        />
        <MetricCard
          theme="red"
          label="需删除违规"
          value={deletePending}
          unit="项"
          desc="严重负面、竞品拉踩或违规广告评论"
          tag="风险处置"
        />
        <MetricCard
          theme="yellow"
          label="需补充笔记"
          value={supplementPending}
          unit="篇"
          desc="评论达标数或品牌提及不足需追加"
          tag="交付缺口"
        />
      </section>

      {/* 统一处置工作台列表 */}
      <DashboardSection
        eyebrow="ACTION WORKBENCH"
        title="舆情风险与规则判定统一处置台"
        desc="整合自实时检出的关键评论与各批次审核规则判定，支持一键闭环回复、删除与补充。"
        extra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="primary"
              style={{ fontSize: '13px', padding: '6px 14px' }}
              onClick={loadAll}
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
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            style={{ width: '240px' }}
          />
          <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value as 'all' | 'key-comment' | 'review-batch'); setPage(1); }}>
            <option value="all">全部来源（关键评论 + 判定批次）</option>
            <option value="key-comment">仅关键评论</option>
            <option value="review-batch">仅规则判定批次</option>
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="pending">待处理任务</option>
            <option value="handled">已处理归档</option>
            <option value="">全部处理状态</option>
          </select>
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
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
                loadReviewBatch(e.target.value);
              }}
              style={{ borderColor: '#c7d2fe' }}
            >
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  批次：{d}
                </option>
              ))}
            </select>
          )}
        </WorkspaceToolbar>

        <DataTableShell
          page={page}
          pageSize={20}
          total={unifiedItems.length}
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
              {pagedItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <StatusBadge
                        status={item.source === 'key-comment' ? '关键评论' : `判定批次 ${item.batchDate || ''}`}
                        theme={item.source === 'key-comment' ? 'blue' : 'purple'}
                      />
                      <strong style={{ fontSize: '13px', color: item.action === 'delete' ? '#b91c1c' : item.action === 'reply' ? '#0369a1' : '#334155' }}>
                        {item.action === 'reply' ? '需回复' : item.action === 'delete' ? '需删除' : item.action === 'supplement' ? '需补充' : '保留观察'}
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
              {!pagedItems.length && !loading && (
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
