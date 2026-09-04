import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { StatusBadge } from '../../components/ui/operations/StatusBadge';
import { ResultNotice } from '../../components/ui/operations/ResultNotice';
import { WorkspaceToolbar } from '../../components/ui/operations/WorkspaceToolbar';
import { DataTableShell } from '../../components/ui/operations/DataTableShell';
import { EmptyState } from '../../components/ui/EmptyState';
import { api, cnTime } from '../../lib/hooks/use-project-data';
import type { NoteListItem, NotesListResponse } from '../content/content-view-model';

export function CommentCollection({
  projectId,
  openNote,
  onRefresh,
  toast,
}: {
  projectId: string;
  openNote: (id: string) => void;
  onRefresh: () => Promise<void>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const searchParams = useSearchParams();
  const prefilledNoteId = searchParams.get('noteId') || '';

  const [noteInput, setNoteInput] = useState(prefilledNoteId);
  const [items, setItems] = useState<NoteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<NotesListResponse['summary']>({
    total: 0,
    ownedCount: 0,
    scanCount: 0,
    completeCount: 0,
    missingProfileCount: 0,
    reportableCount: 0,
    baseCount: 0,
    supplementCount: 0,
    fetchedCount: 0,
    unfetchedCount: 0,
    totalComments: 0,
    totalReads: 0,
    totalInteractions: 0,
  });

  const [query, setQuery] = useState('');
  const [monitored, setMonitored] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (prefilledNoteId && !noteInput) {
      const timer = setTimeout(() => {
        setNoteInput(prefilledNoteId);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [prefilledNoteId, noteInput]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        projectId,
        view: 'collection',
        page: String(page),
        pageSize: '20',
      });
      if (query) p.set('query', query);
      if (monitored) p.set('monitored', monitored);
      const res = await api<NotesListResponse>('/api/notes/list?' + p.toString());
      setItems(res.items || []);
      setTotal(res.total || 0);
      if (res.summary) setSummary(res.summary);
    } catch (e) {
      toast(e instanceof Error ? e.message : '加载采集监测列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, page, query, monitored, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  async function executeFetch(ids: string[]) {
    if (!ids.length) return;
    setFetching(true);
    setFetchResult(null);
    try {
      const res = await api<{
        ok: boolean;
        results: Array<{ ok: boolean; noteId: string; fetchedL1?: number; fetchedL2?: number; total?: number; status?: string; error?: string }>;
      }>('/api/comments/fetch', {
        method: 'POST',
        body: JSON.stringify({ noteIds: ids, projectId }),
      });

      const succeeded = (res.results || []).filter((r) => r.ok).length;
      const failed = (res.results || []).length - succeeded;
      const details = (res.results || [])
        .map((r) => r.ok ? `[成功] ${r.noteId}：主评 ${r.fetchedL1}，楼中楼 ${r.fetchedL2}，总量 ${r.total}` : `[失败] ${r.noteId}：${r.error}`)
        .join('\n');

      setFetchResult({
        type: failed === 0 ? 'success' : 'error',
        text: `本次抓取完成：成功 ${succeeded} 篇，失败 ${failed} 篇。\n${details}`,
      });
      toast(`评论抓取完成 (成功 ${succeeded} / 失败 ${failed})`, succeeded > 0 ? 'success' : 'error');
      setSelectedIds([]);
      await loadData();
      await onRefresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '抓取失败';
      setFetchResult({ type: 'error', text: msg });
      toast(msg, 'error');
    } finally {
      setFetching(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAllOnPage() {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((it) => it.id));
    }
  }

  return (
    <div className="stack animate-fade-in">
      {/* 顶部 KPI */}
      <section className="ops-metric-grid">
        <MetricCard
          theme="teal"
          label="已抓取笔记"
          value={summary.fetchedCount.toLocaleString()}
          unit="篇"
          desc="已建立评论快照，持续追踪主楼增量"
          tag="已建档快照"
        />
        <MetricCard
          theme={summary.unfetchedCount > 0 ? 'yellow' : 'green'}
          label="未抓取笔记"
          value={summary.unfetchedCount.toLocaleString()}
          unit="篇"
          desc="入库后尚未执行首轮评论采集"
          tag="待采集"
        />
        <MetricCard
          theme="blue"
          label="当前评论总量"
          value={summary.totalComments.toLocaleString()}
          unit="条"
          desc="快照累计抓取主评与楼中楼总和"
          tag="评论总盘"
        />
        <MetricCard
          theme="purple"
          label="监测资产覆盖率"
          value={summary.total ? `${Math.round((summary.fetchedCount / summary.total) * 1000) / 10}%` : '—'}
          desc={`总资产 ${summary.total} 篇 · 已纳管采集`}
          tag="覆盖比例"
        />
      </section>

      {/* 醒目的青色采集操作卡 */}
      <DashboardSection
        eyebrow="COMMENT INGESTION"
        title="手动采集与增量比对"
        desc="输入小红书笔记 ID 或链接，每行一个；系统将按规则抓取全量主评论与楼中楼，自动增量比对并计算验收状态。"
      >
        <div className="ops-action-card ops-action-card-teal" style={{ padding: '20px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '6px', display: 'block' }}>
            小红书笔记 ID 或完整链接（支持粘贴多行，单次上限 20 篇）
          </label>
          <textarea
            rows={3}
            placeholder="粘贴小红书笔记链接或 24 位十六进制 ID，例如：\n6a01be210000000035033cb8\nhttps://www.xiaohongshu.com/explore/6a01be210000000035033cb8"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #99f6e4',
              background: '#ffffff',
              fontSize: '13px',
              fontFamily: 'monospace',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#0f766e' }}>
              💡 提示：从内容台账点击“前往评论监测”可自动预填 ID。确认后点击开始抓取。
            </span>
            <button
              type="button"
              className="primary"
              disabled={fetching || !noteInput.trim()}
              onClick={() => {
                const lines = noteInput.split(/[\n,，]+/).map((s) => s.trim()).filter(Boolean);
                executeFetch(lines);
              }}
              style={{ background: '#0d9488', borderColor: '#0f766e', minWidth: '130px' }}
            >
              {fetching ? '正在采集比对…' : '开始抓取评论'}
            </button>
          </div>
          {fetchResult && (
            <ResultNotice type={fetchResult.type} className="mt-2">
              {fetchResult.text}
            </ResultNotice>
          )}
        </div>
      </DashboardSection>

      {/* 采集监测列表 */}
      <DashboardSection
        eyebrow="MONITORING LIST"
        title="评论快照与监测明细"
        desc="监控所有笔记的评论总量、增量变化与验收状态，支持单篇重新采集与批量并发抓取。"
      >
        <WorkspaceToolbar
          extra={
            selectedIds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#e0f2fe', padding: '4px 12px', borderRadius: '8px' }}>
                <span style={{ fontSize: '12.5px', color: '#0369a1', fontWeight: 600 }}>
                  已勾选 {selectedIds.length} 篇
                </span>
                <button
                  type="button"
                  className="primary"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  disabled={fetching}
                  onClick={() => executeFetch(selectedIds)}
                >
                  {fetching ? '抓取中…' : '批量重新抓取'}
                </button>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#64748b' }}
                  onClick={() => setSelectedIds([])}
                >
                  取消
                </button>
              </div>
            )
          }
        >
          <input
            type="text"
            placeholder="搜索笔记 / 博主 / ID"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            style={{ width: '220px' }}
          />
          <select value={monitored} onChange={(e) => { setMonitored(e.target.value); setPage(1); }}>
            <option value="">全部监测状态</option>
            <option value="1">已抓取快照</option>
            <option value="0">未抓取</option>
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
                <th style={{ width: '36px' }}>
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.length === items.length}
                    onChange={selectAllOnPage}
                  />
                </th>
                <th>笔记信息</th>
                <th>来源</th>
                <th>最近抓取时间</th>
                <th>主评论</th>
                <th>楼中楼</th>
                <th>评论总数</th>
                <th>较上次变化</th>
                <th>验收状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((note) => {
                const isSelected = selectedIds.includes(note.id);
                return (
                  <tr key={note.id} style={{ background: isSelected ? '#f0f9ff' : undefined }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(note.id)}
                      />
                    </td>
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
                            {note.title || '未命名笔记'}
                          </span>
                          <span className="ops-table-note-sub">
                            {note.author || '未知博主'} · <small style={{ fontFamily: 'monospace' }}>{note.id.slice(0, 10)}…</small>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={note.sourceType === 'owned' ? '自有发布' : note.sourceType === 'commercial' ? '商业合作' : '外部扫描'} />
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: '#475569' }}>
                        {note.lastFetchedAt ? cnTime(note.lastFetchedAt) : '尚未抓取'}
                      </span>
                    </td>
                    <td>
                      <strong>{note.latestL1Count ?? (note.isFetched ? '—' : '0')}</strong>
                    </td>
                    <td>
                      <strong>{note.latestL2Count ?? (note.isFetched ? '—' : '0')}</strong>
                    </td>
                    <td>
                      <strong>{note.commentTotal}</strong>
                    </td>
                    <td>
                      {note.commentDelta > 0 ? (
                        <span style={{ color: '#15803d', fontWeight: 600 }}>+{note.commentDelta}</span>
                      ) : note.commentDelta < 0 ? (
                        <span style={{ color: '#b91c1c', fontWeight: 600 }}>{note.commentDelta}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>持平</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={note.status || '待抓取'} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="text-link"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          onClick={() => openNote(note.id)}
                        >
                          评论详情
                        </button>
                        <button
                          type="button"
                          className="text-link"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#0d9488' }}
                          disabled={fetching}
                          onClick={() => executeFetch([note.id])}
                        >
                          重新采集
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
                );
              })}
              {!items.length && !loading && (
                <tr>
                  <td colSpan={10}>
                    <EmptyState title="未找到监测笔记" text="输入笔记链接开始采集，或在内容管理中导入自有笔记。" />
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
