import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from '../../components/ui/AppLink';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { StatusBadge } from '../../components/ui/operations/StatusBadge';
import { ProgressBar } from '../../components/ui/operations/ProgressBar';
import { WorkspaceToolbar } from '../../components/ui/operations/WorkspaceToolbar';
import { DataTableShell } from '../../components/ui/operations/DataTableShell';
import { EmptyState } from '../../components/ui/EmptyState';
import { api, compact } from '../../lib/hooks/use-project-data';
import type { Dashboard, Ops } from '../../lib/types/project';
import { emptyNotesSummary, type NoteListItem, type NotesListResponse } from './content-view-model';
import { isOwnedNote, noteDirection } from '../../lib/business/note-utils';

export function PublishingManagement({
  projectId,
  dashboard,
  ops,
  openNote,
  toast,
}: {
  projectId: string;
  dashboard: Dashboard;
  ops: Ops;
  openNote: (id: string) => void;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<NoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState(searchParams.get('query') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'publishedAt');
  const [page, setPage] = useState(Math.max(1, parseInt(searchParams.get('page') || '1', 10)));
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<NotesListResponse['summary']>(emptyNotesSummary);
  const [coverageFeedback, setCoverageFeedback] = useState<Array<{ direction: string; owned: number; commercial: number; natural: number; interactions: number; comments: number }>>([]);

  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const syncToUrl = useCallback((nextState: { query: string; category: string; sort: string; page: number }) => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (nextState.query) p.set('query', nextState.query); else p.delete('query');
      if (nextState.category) p.set('category', nextState.category); else p.delete('category');
      if (nextState.sort && nextState.sort !== 'publishedAt') p.set('sort', nextState.sort); else p.delete('sort');
      if (nextState.page > 1) p.set('page', String(nextState.page)); else p.delete('page');
      window.history.replaceState(null, '', window.location.pathname + (p.toString() ? '?' + p.toString() : ''));
    } catch {}
  }, []);

  useEffect(() => {
    syncToUrl({ query: debouncedQuery, category, sort, page });
  }, [debouncedQuery, category, sort, page, syncToUrl]);

  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      setQuery(p.get('query') || '');
      setDebouncedQuery(p.get('query') || '');
      setCategory(p.get('category') || '');
      setSort(p.get('sort') || 'publishedAt');
      setPage(Math.max(1, parseInt(p.get('page') || '1', 10)));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const publishTarget = ops.settings.goals?.publishTarget || 0;
  const publishedCount = summary.operationalPublishedCount || summary.ownedPublishedCount;
  const commercialCount = summary.commercialCount;
  const hasPublishTarget = publishTarget > 0;
  const achievePct = hasPublishTarget ? Math.round((publishedCount / publishTarget) * 1000) / 10 : 0;
  const gap = hasPublishTarget ? Math.max(0, publishTarget - publishedCount) : 0;

  const loadPublishingNotes = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        projectId,
        view: 'publishing',
        page: String(page),
        pageSize: '20',
        sort,
        order: 'desc',
      });
      if (debouncedQuery) p.set('query', debouncedQuery);
      if (category) p.set('category', category);
      const res = await api<NotesListResponse>('/api/notes/list?' + p.toString());
      setItems(res.items || []);
      setTotal(res.total || 0);
      if (res.summary) setSummary(res.summary);
      if (res.coverageFeedback) setCoverageFeedback(res.coverageFeedback);
    } catch (e) {
      toast(e instanceof Error ? e.message : '加载发布明细失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, page, debouncedQuery, category, sort, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPublishingNotes();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPublishingNotes]);

  // 次级区域：全库服务端 SQL 聚合覆盖反馈分析（不截断 500 条）
  const { feedbackRows, opportunitiesCount, naturalTotalInteractions } = useMemo(() => {
    const rows = [...coverageFeedback].sort((a, b) => b.natural - a.natural);
    const opps = rows.filter((r) => r.natural > r.owned).length;
    const naturalSum = rows.reduce((sum, r) => sum + Number(r.interactions || 0), 0);
    return { feedbackRows: rows, opportunitiesCount: opps, naturalTotalInteractions: naturalSum };
  }, [coverageFeedback]);

  return (
    <div className="stack animate-fade-in">
      {/* 顶部真实 KPI */}
      <section className="ops-metric-grid">
        <MetricCard
          theme="blue"
          label="已发布内容"
          value={publishedCount.toLocaleString()}
          unit="篇"
          desc="自有发布与商业合作入库内容清单"
          tag="发布总量"
        />
        <MetricCard
          theme={hasPublishTarget && achievePct >= 100 ? 'green' : 'yellow'}
          label="发布目标完成度"
          value={hasPublishTarget ? `${achievePct}%` : '尚未配置发布目标'}
          desc={hasPublishTarget ? `目标 ${publishTarget} 篇 · 差额 ${gap} 篇` : '可在项目设置-目标中配置发布计划'}
          tag="目标节奏"
        />
        <MetricCard
          theme="teal"
          label="商业合作内容"
          value={commercialCount.toLocaleString()}
          unit="篇"
          desc="达人签约与商业投放执行中"
          tag="达人合作"
        />
        <MetricCard
          theme="indigo"
          label="方向缺口"
          value={opportunitiesCount}
          unit="个"
          desc={`自然互动 ${compact(naturalTotalInteractions)} · 自然讨论高但自有未覆盖`}
          tag="覆盖缺口"
        />
      </section>

      {/* 发布进度主题区域 */}
      <DashboardSection
        eyebrow="PUBLISHING PACING"
        title="发布进度与目标达成"
        desc="监控自有投放与商业合作的实际落地节奏，对比考核目标。"
      >
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <strong style={{ fontSize: '15px', color: '#0f172a' }}>全盘发布完成度</strong>
              <StatusBadge status={!hasPublishTarget ? '尚未配置目标' : achievePct >= 100 ? '已达标' : '推进中'} />
            </div>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              实际已发布 <strong>{publishedCount}</strong> 篇 / 目标 <strong>{hasPublishTarget ? publishTarget : '—'}</strong> 篇
            </span>
          </div>
          <ProgressBar value={publishedCount} max={publishTarget || publishedCount || 100} theme={achievePct >= 100 ? 'green' : 'blue'} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
            <span>{hasPublishTarget ? `已完成 ${achievePct}%` : '暂无约束目标'}</span>
            <span>{hasPublishTarget ? `还需发布 ${gap} 篇即可达成` : ''}</span>
          </div>
        </div>
      </DashboardSection>

      {/* 主流程：发布清单与表现 */}
      <DashboardSection
        eyebrow="RELEASE INVENTORY"
        title="自有发布清单与单篇表现"
        desc="自有笔记与达人商业发布的即时阅读、互动与评论沉淀。"
        extra={
          <Link
            className="btn-link"
            style={{ fontSize: '13px' }}
            href={'/api/export?type=notes&projectId=' + encodeURIComponent(projectId)}
          >
            导出清单 ↗
          </Link>
        }
      >
        <WorkspaceToolbar>
          <input
            type="text"
            placeholder="搜索发布笔记 / 博主"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            style={{ width: '240px' }}
          />
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            <option value="publishedAt">按发布时间倒序</option>
            <option value="reads">按阅读量排序</option>
            <option value="interactions">按互动量排序</option>
            <option value="comments">按评论总数排序</option>
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
                <th>发布时间</th>
                <th>达人 / 类型</th>
                <th>内容方向</th>
                <th>阅读量</th>
                <th>互动量</th>
                <th>评论总数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((note) => (
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
                          {note.title || '未命名发布笔记'}
                        </span>
                        <span className="ops-table-note-sub">
                          <small style={{ fontFamily: 'monospace' }}>{note.id.slice(0, 12)}…</small>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '12.5px', color: '#475569' }}>
                      {note.publishedAt ? note.publishedAt.slice(0, 10) : '待补充'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{note.author || '未知博主'}</span>
                      <StatusBadge status={note.sourceType === 'commercial' ? '商业合作' : '自有笔记'} />
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', color: '#334155' }}>
                      {note.category1 || note.noteType || '—'}
                    </span>
                  </td>
                  <td>
                    <strong>{note.readCount ? compact(note.readCount) : '待同步'}</strong>
                  </td>
                  <td>
                    <strong>{note.interactionCount ? compact(note.interactionCount) : '待同步'}</strong>
                  </td>
                  <td>
                    <strong>{note.commentTotal}</strong>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="text-link"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onClick={() => openNote(note.id)}
                      >
                        查看表现
                      </button>
                      {note.url && (
                        <a
                          href={note.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-link"
                          style={{ color: '#64748b' }}
                        >
                          原笔记 ↗
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && !loading && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="暂无自有发布内容" text="导入自有发布表格或在数据源中同步发布数据。" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DataTableShell>
      </DashboardSection>

      {/* 次级区域：发布覆盖反馈 */}
      <DashboardSection
        eyebrow="COVERAGE FEEDBACK"
        title="发布覆盖反馈（次级分析）"
        desc="将自有发布与外部自然讨论按方向对齐，发现高讨论但缺覆盖的方向。"
      >
        <div className="ops-data-shell">
          <div className="ops-table-container">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>内容方向</th>
                  <th>自有发布</th>
                  <th>自然样本</th>
                  <th>样本互动</th>
                  <th>样本评论</th>
                  <th>覆盖判断</th>
                </tr>
              </thead>
              <tbody>
                {feedbackRows.map((row) => (
                  <tr key={row.direction}>
                    <td><strong>{row.direction}</strong></td>
                    <td>{row.owned + row.commercial} 篇 <small style={{ color: '#64748b' }}>(自有 {row.owned} / 商业 {row.commercial})</small></td>
                    <td>{row.natural} 篇</td>
                    <td>{compact(row.interactions)}</td>
                    <td>{compact(row.comments)}</td>
                    <td>
                      <StatusBadge
                        status={row.natural > (row.owned + row.commercial) ? '自然热度高·缺口待补' : '覆盖充足'}
                        theme={row.natural > (row.owned + row.commercial) ? 'yellow' : 'green'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
}
