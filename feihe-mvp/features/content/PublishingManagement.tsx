import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import type { NoteListItem, NotesListResponse } from './content-view-model';
import { isOwnedNote, noteDirection } from '../growth/KeywordRadar';

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
  const [items, setItems] = useState<NoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('publishedAt');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const publishTarget = ops.settings.goals?.publishTarget || 0;
  const publishedCount = dashboard.metrics.publishedCount || total || 0;
  const hasPublishTarget = publishTarget > 0;
  const achievePct = hasPublishTarget ? Math.min(100, Math.round((publishedCount / publishTarget) * 1000) / 10) : 0;
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
      if (query) p.set('query', query);
      const res = await api<NotesListResponse>('/api/notes/list?' + p.toString());
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      toast(e instanceof Error ? e.message : '加载发布明细失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, page, query, sort, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPublishingNotes();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPublishingNotes]);

  // 次级区域：自有发布与自然内容方向覆盖反馈分析
  const { feedbackRows, opportunitiesCount, naturalTotalInteractions } = useMemo(() => {
    const directions = new Map<string, { owned: number; natural: number; interactions: number; comments: number }>();
    let naturalInteractionsSum = 0;
    (dashboard.notes || []).forEach((note) => {
      const key = noteDirection(note);
      const row = directions.get(key) || { owned: 0, natural: 0, interactions: 0, comments: 0 };
      if (isOwnedNote(note)) {
        row.owned += 1;
      } else {
        row.natural += 1;
        naturalInteractionsSum += Number(note.interactionCount || 0);
      }
      row.interactions += Number(note.interactionCount || 0);
      row.comments += Number(note.commentTotal || 0);
      directions.set(key, row);
    });
    const rows = [...directions.entries()].sort((a, b) => b[1].natural - a[1].natural);
    const opps = rows.filter(([, row]) => row.natural > row.owned).length;
    return { feedbackRows: rows, opportunitiesCount: opps, naturalTotalInteractions: naturalInteractionsSum };
  }, [dashboard.notes]);

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
          value={(dashboard.metrics.commercialCount || total).toLocaleString()}
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
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
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
                {feedbackRows.map(([direction, row]) => (
                  <tr key={direction}>
                    <td><strong>{direction}</strong></td>
                    <td>{row.owned} 篇</td>
                    <td>{row.natural} 篇</td>
                    <td>{compact(row.interactions)}</td>
                    <td>{compact(row.comments)}</td>
                    <td>
                      <StatusBadge
                        status={row.natural > row.owned ? '自然热度高·缺口待补' : '覆盖充足'}
                        theme={row.natural > row.owned ? 'yellow' : 'green'}
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
