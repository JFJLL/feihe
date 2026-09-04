import React, { useState, useEffect, useCallback } from 'react';
import Link from '../../components/ui/AppLink';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { StatusBadge } from '../../components/ui/operations/StatusBadge';
import { WorkspaceToolbar } from '../../components/ui/operations/WorkspaceToolbar';
import { DataTableShell } from '../../components/ui/operations/DataTableShell';
import { EmptyState } from '../../components/ui/EmptyState';
import { api, compact, cnTime, pct } from '../../lib/hooks/use-project-data';
import type { NoteListItem, NotesListResponse } from './content-view-model';

export function ContentRegistry({
  projectId,
  openNote,
  uploadWorkbook,
  runSearch,
  loading: globalLoading,
  onRefresh,
  toast,
}: {
  projectId: string;
  openNote: (id: string) => void;
  uploadWorkbook: (file: File | undefined, kind: 'owned' | 'supplier') => void;
  runSearch: (keywords: string, from: string, to: string) => Promise<void>;
  loading: boolean;
  onRefresh: () => Promise<void>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
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

  // Filter states
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [scope, setScope] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [from] = useState('');
  const [to] = useState('');
  const [sort, setSort] = useState('');
  const [order] = useState('desc');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // External sample scan inputs
  const [keywords, setKeywords] = useState('启萃,飞鹤奶粉');
  const [scanFrom, setScanFrom] = useState('2026-07-01');
  const [scanTo, setScanTo] = useState('2026-08-30');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState('');

  // Excel file upload input
  const [uploadFileName, setUploadFileName] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        projectId,
        view: 'registry',
        page: String(page),
        pageSize: '20',
      });
      if (query) p.set('query', query);
      if (source) p.set('source', source);
      if (scope) p.set('scope', scope);
      if (status) p.set('status', status);
      if (category) p.set('category', category);
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      if (sort) {
        p.set('sort', sort);
        p.set('order', order);
      }

      const res = await api<NotesListResponse>('/api/notes/list?' + p.toString());
      setItems(res.items || []);
      setTotal(res.total || 0);
      if (res.summary) setSummary(res.summary);
    } catch (e) {
      toast(e instanceof Error ? e.message : '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, page, query, source, scope, status, category, from, to, sort, order, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  async function handleScan() {
    setScanning(true);
    setScanResult('');
    try {
      await runSearch(keywords, scanFrom, scanTo);
      setScanResult('外部内容样本扫描入库已触发完成');
      await loadData();
    } catch (e) {
      setScanResult(e instanceof Error ? e.message : '扫描失败');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="stack animate-fade-in">
      {/* 4 大真实经营 KPI */}
      <section className="ops-metric-grid">
        <MetricCard
          theme="blue"
          label="全部内容资产"
          value={summary.total.toLocaleString()}
          unit="篇"
          desc="项目库中已建档管理的完整内容台账"
          tag="资产总盘"
        />
        <MetricCard
          theme="green"
          label="自有 / 商业内容"
          value={summary.ownedCount.toLocaleString()}
          unit="篇"
          desc={summary.total ? `占总盘 ${pct(summary.ownedCount / summary.total)} · 自有投放与达人合作` : '—'}
          tag="重点运营"
        />
        <MetricCard
          theme="purple"
          label="外部扫描样本"
          value={summary.scanCount.toLocaleString()}
          unit="篇"
          desc={summary.total ? `占总盘 ${pct(summary.scanCount / summary.total)} · 关键词自然讨论池` : '—'}
          tag="自然沉淀"
        />
        <MetricCard
          theme={summary.missingProfileCount > 0 ? 'yellow' : 'teal'}
          label="待补基础资料"
          value={summary.missingProfileCount.toLocaleString()}
          unit="篇"
          desc={`基础信息完整度 ${summary.total ? pct(summary.completeCount / summary.total) : '—'}`}
          tag="数据质量"
        />
      </section>

      {/* 入库操作区 */}
      <DashboardSection
        eyebrow="INGESTION WORKSPACE"
        title="内容入库与数据同步"
        desc="支持自有发布内容批量导入与外部自然样本扫描入库。"
        extra={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              className="primary"
              style={{ fontSize: '13px', padding: '6px 14px' }}
              onClick={() => { loadData(); onRefresh(); }}
              disabled={loading}
            >
              {loading ? '刷新中…' : '刷新台账'}
            </button>
            <Link
              className="btn-link"
              style={{ fontSize: '13px' }}
              href={'/api/export?type=notes&projectId=' + encodeURIComponent(projectId)}
            >
              导出内容台账 ↗
            </Link>
          </div>
        }
      >
        <div className="ops-action-grid">
          {/* A. 导入自有内容 */}
          <article className="ops-action-card ops-action-card-blue">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📥</span>
              <div>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>导入自有发布内容</strong>
                <div style={{ fontSize: '12px', color: '#64748b' }}>支持 .xlsx / .xls 格式，自动识别笔记 ID、达人与产品范围</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <label className="upload" style={{ margin: 0, cursor: 'pointer' }}>
                选择 Excel 文件
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadFileName(file.name);
                      uploadWorkbook(file, 'owned');
                    }
                  }}
                />
              </label>
              {uploadFileName && (
                <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: 500 }}>
                  已选：{uploadFileName}
                </span>
              )}
              {globalLoading && <span style={{ fontSize: '12px', color: '#64748b' }}>上传导入中…</span>}
            </div>
          </article>

          {/* B. 外部样本扫描 */}
          <article className="ops-action-card ops-action-card-purple">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🔍</span>
              <div>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>关键词扫描外部样本</strong>
                <div style={{ fontSize: '12px', color: '#64748b' }}>作为辅助入库方式，补充自然讨论样本</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <input
                style={{ flex: 1, minWidth: '180px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="关键词用逗号分隔"
              />
              <input
                type="date"
                style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
                value={scanFrom}
                onChange={(e) => setScanFrom(e.target.value)}
              />
              <span style={{ fontSize: '12px', color: '#64748b' }}>至</span>
              <input
                type="date"
                style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
                value={scanTo}
                onChange={(e) => setScanTo(e.target.value)}
              />
              <button
                type="button"
                className="primary"
                style={{ fontSize: '12.5px', padding: '6px 12px', background: '#6d28d9', borderColor: '#5b21b6' }}
                disabled={scanning || !keywords.trim()}
                onClick={handleScan}
              >
                {scanning ? '扫描中…' : '扫描外部样本'}
              </button>
            </div>
            {scanResult && <div style={{ fontSize: '12px', color: '#6d28d9' }}>{scanResult}</div>}
          </article>
        </div>
      </DashboardSection>

      {/* 第三部分：筛选与内容台账 */}
      <DashboardSection
        eyebrow="NOTE REGISTRY"
        title="内容资产明细台账"
        desc="集中管理单篇内容元数据与最新评论监测摘要，评论采集与运营请前往评论运营。"
      >
        <WorkspaceToolbar>
          <input
            type="text"
            placeholder="搜索标题 / 博主 / 笔记ID"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            style={{ width: '220px' }}
          />
          <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
            <option value="">全部来源</option>
            <option value="owned">自有发布</option>
            <option value="commercial">商业合作</option>
            <option value="keyword_scan">关键词扫描</option>
          </select>
          <select value={scope} onChange={(e) => { setScope(e.target.value); setPage(1); }}>
            <option value="">全部范围</option>
            <option value="本品">本品</option>
            <option value="竞品">竞品</option>
            <option value="其他">其他</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">全部验收状态</option>
            <option value="符合且能汇报">符合且能汇报</option>
            <option value="符合基础要求">符合基础要求</option>
            <option value="不够30条需补充">不够30条需补充</option>
            <option value="待抓取">待抓取</option>
          </select>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="">全部内容方向</option>
            <option value="母婴育儿">母婴育儿</option>
            <option value="奶粉测评">奶粉测评</option>
            <option value="成分科普">成分科普</option>
            <option value="日常分享">日常分享</option>
          </select>
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            <option value="">默认排序（更新时间）</option>
            <option value="reads">按阅读量排序</option>
            <option value="interactions">按互动量排序</option>
            <option value="comments">按评论总数排序</option>
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
                <th>来源 / 范围</th>
                <th>内容方向</th>
                <th>发布时间</th>
                <th>阅读 / 互动</th>
                <th>评论监测摘要</th>
                <th>验收状态</th>
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
                          {note.title || '未命名笔记'}
                        </span>
                        <span className="ops-table-note-sub">
                          {note.author || '未知博主'} · <small style={{ fontFamily: 'monospace' }}>{note.id.slice(0, 10)}…</small>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <StatusBadge
                        status={note.sourceType === 'owned' ? '自有发布' : note.sourceType === 'commercial' ? '商业合作' : '外部扫描'}
                      />
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>{note.productScope || '本品'}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', color: '#334155' }}>
                      {note.category1 || note.noteType || '待补充'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {note.publishedAt ? note.publishedAt.slice(0, 10) : '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '12.5px' }}>
                      <div>阅读：<strong>{compact(note.readCount)}</strong></div>
                      <div style={{ color: '#64748b' }}>互动：{compact(note.interactionCount)}</div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '12px' }}>
                      <div>总评：<strong>{note.commentTotal}</strong></div>
                      <div style={{ color: '#64748b' }}>
                        {note.isFetched ? `已抓取 · ${cnTime(note.lastFetchedAt).slice(5)}` : '待抓取'}
                      </div>
                    </div>
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
                        查看详情
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
                      <Link
                        href={`/projects/${encodeURIComponent(projectId)}/comments?tab=collection&noteId=${encodeURIComponent(note.id)}`}
                        className="text-link"
                        style={{ color: '#0284c7' }}
                      >
                        前往评论监测 →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && !loading && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="未找到匹配的内容笔记" text="请调整搜索关键词或来源筛选条件重试。" />
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
