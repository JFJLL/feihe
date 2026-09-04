import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from '../../components/ui/AppLink';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { StatusBadge } from '../../components/ui/operations/StatusBadge';
import { WorkspaceToolbar } from '../../components/ui/operations/WorkspaceToolbar';
import { DataTableShell } from '../../components/ui/operations/DataTableShell';
import { EmptyState } from '../../components/ui/EmptyState';
import { api, compact, cnTime, pct } from '../../lib/hooks/use-project-data';
import { emptyNotesSummary, type NoteListItem, type NotesListResponse } from './content-view-model';

export function ContentMonitoring({
  projectId,
  openNote,
  toast,
}: {
  projectId: string;
  openNote: (id: string) => void;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<NoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<NotesListResponse['summary']>(emptyNotesSummary);

  const [query, setQuery] = useState(searchParams.get('query') || '');
  const [source, setSource] = useState(searchParams.get('source') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [hasMetrics, setHasMetrics] = useState(searchParams.get('hasMetrics') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'reads');
  const [order, setOrder] = useState(searchParams.get('order') || 'desc');
  const [page, setPage] = useState(Math.max(1, parseInt(searchParams.get('page') || '1', 10)));
  const [loading, setLoading] = useState(false);

  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const syncToUrl = useCallback((nextState: { query: string; source: string; category: string; sort: string; order: string; page: number }) => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (nextState.query) p.set('query', nextState.query); else p.delete('query');
      if (nextState.source) p.set('source', nextState.source); else p.delete('source');
      if (nextState.category) p.set('category', nextState.category); else p.delete('category');
      if (hasMetrics) p.set('hasMetrics', hasMetrics); else p.delete('hasMetrics');
      if (nextState.sort && nextState.sort !== 'reads') p.set('sort', nextState.sort); else p.delete('sort');
      if (nextState.order && nextState.order !== 'desc') p.set('order', nextState.order); else p.delete('order');
      if (nextState.page > 1) p.set('page', String(nextState.page)); else p.delete('page');
      window.history.replaceState(null, '', window.location.pathname + (p.toString() ? '?' + p.toString() : ''));
    } catch {}
  }, []);

  useEffect(() => {
    syncToUrl({ query: debouncedQuery, source, category, sort, order, page });
  }, [debouncedQuery, source, category, sort, order, page, syncToUrl]);

  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      setQuery(p.get('query') || '');
      setDebouncedQuery(p.get('query') || '');
      setSource(p.get('source') || '');
      setCategory(p.get('category') || '');
      setHasMetrics(p.get('hasMetrics') || '');
      setSort(p.get('sort') || 'reads');
      setOrder(p.get('order') || 'desc');
      setPage(Math.max(1, parseInt(p.get('page') || '1', 10)));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadMonitoringNotes = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        projectId,
        view: 'monitoring',
        page: String(page),
        pageSize: '20',
        sort,
        order,
      });
      if (debouncedQuery) p.set('query', debouncedQuery);
      if (source) p.set('source', source);
      if (category) p.set('category', category);
      if (hasMetrics) p.set('hasMetrics', hasMetrics);
      const res = await api<NotesListResponse>('/api/notes/list?' + p.toString());
      setItems(res.items || []);
      setTotal(res.total || 0);
      if (res.summary) setSummary(res.summary);
    } catch (e) {
      toast(e instanceof Error ? e.message : '加载内容监测数据失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, page, debouncedQuery, source, category, hasMetrics, sort, order, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadMonitoringNotes();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadMonitoringNotes]);

  const coverRate = summary.total ? Math.round((summary.coverCount / summary.total) * 1000) / 10 : 0;
  const categoryRate = summary.total ? Math.round((summary.categoryCount / summary.total) * 1000) / 10 : 0;
  const perfRate = summary.total ? Math.round((summary.performanceMetricCount / summary.total) * 1000) / 10 : 0;
  const linkRate = summary.total ? Math.round((summary.linkCount / summary.total) * 1000) / 10 : 0;

  return (
    <div className="stack animate-fade-in">
      {/* 顶部真实 KPI */}
      <section className="ops-metric-grid">
        <MetricCard
          theme="blue"
          label="双指标完整表现样本"
          value={summary.performanceMetricCount.toLocaleString()}
          unit="篇"
          desc={`占总盘 ${perfRate}% · 阅读与互动均已沉淀`}
          tag="完整指标"
        />
        <MetricCard
          theme="teal"
          label="总阅读量"
          value={compact(summary.totalReads)}
          unit="次"
          desc="监测样本累计阅读曝光"
          tag="累计阅读"
        />
        <MetricCard
          theme="green"
          label="总互动量"
          value={compact(summary.totalInteractions)}
          unit="次"
          desc="赞藏评等真实互动总额"
          tag="互动沉淀"
        />
        <MetricCard
          theme={summary.missingProfileCount > 0 ? 'yellow' : 'teal'}
          label="缺少表现数据"
          value={summary.missingProfileCount.toLocaleString()}
          unit="篇"
          desc="待通过数据同步或爬虫补齐表现指标"
          tag="数据缺口"
        />
      </section>

      {/* 数据质量主题卡 */}
      <DashboardSection
        eyebrow="DATA INTEGRITY"
        title="内容表现数据质量分布"
        desc="监控各关键指标的入库完整率，确保分析结论具备真实数据支撑。"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>封面图覆盖率</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>{coverRate}%</div>
            <div style={{ fontSize: '11.5px', color: '#15803d' }}>已入库 {summary.coverCount} / {summary.total} 篇</div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>内容方向归类率</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>{categoryRate}%</div>
            <div style={{ fontSize: '11.5px', color: '#0369a1' }}>已完成分类 {summary.categoryCount} / {summary.total} 篇</div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>阅读 / 互动完整率</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>{perfRate}%</div>
            <div style={{ fontSize: '11.5px', color: '#0f766e' }}>指标有效 {summary.performanceMetricCount} / {summary.total} 篇</div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>原文链接有效率</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>{linkRate}%</div>
            <div style={{ fontSize: '11.5px', color: '#6366f1' }}>有效原文 {summary.linkCount} / {summary.total} 篇</div>
          </div>
        </div>
      </DashboardSection>

      {/* 单篇内容表现监测列表 */}
      <DashboardSection
        eyebrow="NOTE PERFORMANCE"
        title="单篇内容表现与监测"
        desc="查看单篇真实阅读、互动、互动率、CPE成本及最近抓取时间，空值明确显示“待同步”。"
      >
        <WorkspaceToolbar>
          <input
            type="text"
            placeholder="搜索单篇笔记 / 博主"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            style={{ width: '220px' }}
          />
          <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
            <option value="">全部来源</option>
            <option value="owned">自有发布</option>
            <option value="commercial">商业合作</option>
            <option value="keyword_scan">外部扫描</option>
          </select>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="">全部内容方向</option>
            <option value="母婴育儿">母婴育儿</option>
            <option value="奶粉测评">奶粉测评</option>
            <option value="成分科普">成分科普</option>
            <option value="日常分享">日常分享</option>
          </select>
          <select value={hasMetrics} onChange={(e) => { setHasMetrics(e.target.value); setPage(1); }}>
            <option value="">全部数据完整度</option>
            <option value="1">指标完整（具备阅读与互动）</option>
            <option value="0">指标缺失（缺少阅读或互动）</option>
          </select>
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            <option value="reads">按阅读量排序</option>
            <option value="interactions">按互动量排序</option>
            <option value="comments">按评论总数排序</option>
            <option value="cpe">按 CPE 互动成本排序</option>
            <option value="publishedAt">按发布时间排序</option>
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
                <th>博主 / 方向</th>
                <th>阅读量</th>
                <th>互动量</th>
                <th>互动率</th>
                <th>评论总数</th>
                <th>CPE</th>
                <th>数据完整度</th>
                <th>最近抓取时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((note) => {
                const hasReads = note.readCount !== undefined && note.readCount !== null && note.readCount > 0;
                const hasInteractions = note.interactionCount !== undefined && note.interactionCount !== null;
                const engagementRate = (hasReads && hasInteractions) ? pct(Number(note.interactionCount) / Number(note.readCount)) : '待同步';
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
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m3 15 5-5c.9-.9 2.1-.9 3 0l7 7"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>';
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
                            <small style={{ fontFamily: 'monospace' }}>{note.id.slice(0, 12)}…</small>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{note.author || '未知博主'}</span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{note.category1 || note.noteType || '待归类'}</span>
                      </div>
                    </td>
                    <td>
                      <strong>{hasReads ? compact(note.readCount) : '待同步'}</strong>
                    </td>
                    <td>
                      <strong>{hasInteractions && Number(note.interactionCount) > 0 ? compact(note.interactionCount) : '待同步'}</strong>
                    </td>
                    <td>
                      <span style={{ color: hasReads ? '#0f172a' : '#64748b' }}>{engagementRate}</span>
                    </td>
                    <td>
                      <strong>{note.commentTotal}</strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: note.cpe != null ? '#0f172a' : '#94a3b8' }}>
                        {note.cpe != null ? '￥' + Number(note.cpe).toFixed(2) : '—'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge
                        status={note.isProfileComplete ? '完整' : '待补充'}
                        theme={note.isProfileComplete ? 'green' : 'yellow'}
                      />
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
                        明细 →
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!items.length && !loading && (
                <tr>
                  <td colSpan={10}>
                    <EmptyState title="暂无监测数据" text="同步笔记表现指标后呈现单篇表现。" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DataTableShell>

        {/* 底部次级跳转入口 */}
        <div style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>需要查看聚合分析分布与宏观排行？</strong>
            <div style={{ fontSize: '12px', color: '#64748b' }}>包含内容形式分布、达人层级效率矩阵与全盘内容分析报表。</div>
          </div>
          <Link
            href={`/projects/${encodeURIComponent(projectId)}/insights?tab=content`}
            className="btn-link"
            style={{ fontSize: '13px', fontWeight: 600 }}
          >
            进入分析报告查看完整内容分析 →
          </Link>
        </div>
      </DashboardSection>
    </div>
  );
}
