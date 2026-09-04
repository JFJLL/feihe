'use client';

import { useState, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import type { Dashboard } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionTabs } from '../../components/ui/SectionTabs';
import { NotesPool } from './NotesPool';
import { PublicationLinkage } from './PublicationLinkage';
import { ContentPerformance } from './ContentPerformance';
import { useProjectTab } from '../../lib/hooks/useProjectTab';
import { useNoteDetail } from '../../lib/hooks/useNoteDetail';
import { useProject } from '../../components/project-shell/ProjectContext';
import { api } from '../../lib/hooks/use-project-data';

export function ContentWorkspace({
  projectId,
  dashboard,
  onRefresh,
  from,
  to,
  source,
}: {
  projectId: string;
  dashboard: Dashboard;
  onRefresh: () => Promise<void>;
  from: string;
  to: string;
  source: string;
}) {
  const [tab, setTab] = useProjectTab('pool', ['pool', 'linkage', 'performance']);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { showToast } = useProject();
  const { openNote, renderDrawer } = useNoteDetail({
    projectId,
    onRefresh,
    toast: showToast,
  });

  const [noteIds, setNoteIds] = useState('');
  const [keywords, setKeywords] = useState('启萃,飞鹤奶粉');
  const [loading, setLoading] = useState(false);
  const [runResult, setRunResult] = useState('');

  const updateFilters = useCallback(
    (nextFrom: string, nextTo: string, nextSource: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (nextFrom) p.set('from', nextFrom);
      else p.delete('from');
      if (nextTo) p.set('to', nextTo);
      else p.delete('to');
      if (nextSource) p.set('source', nextSource);
      else p.delete('source');
      window.location.assign(pathname + '?' + p.toString());
    },
    [searchParams, pathname]
  );

  async function runFetch(ids = noteIds) {
    setLoading(true);
    setRunResult('');
    try {
      const result = await api<{ results: Array<Record<string, unknown>> }>(
        '/api/comments/fetch',
        {
          method: 'POST',
          body: JSON.stringify({ noteIds: ids, projectId }),
        }
      );
      showToast('全量评论抓取与增量比对完成', 'success');
      setRunResult(
        result.results
          .map((x) =>
            x.ok
              ? x.noteId +
                '：主评论 ' +
                x.fetchedL1 +
                '，楼中楼 ' +
                x.fetchedL2 +
                '，合计 ' +
                x.total +
                '，' +
                x.status
              : x.noteId + '：失败 · ' + x.error
          )
          .join('\n')
      );
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '抓取失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function runSearch() {
    setLoading(true);
    setRunResult('');
    try {
      const result = await api<{ count: number }>('/api/notes/search', {
        method: 'POST',
        body: JSON.stringify({ keywords, startDate: from, endDate: to, maxPages: 5, projectId }),
      });
      showToast('关键词扫描完成', 'success');
      setRunResult('已扫描并入库 ' + result.count + ' 篇笔记，可在内容池中筛选并批量抓取。');
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '扫描失败', 'error');
    } finally {
      setLoading(false);
    }
  }

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
      showToast('表格导入完成', 'success');
      setRunResult('导入 ' + result.imported + ' 条，跳过 ' + result.skipped + ' 条。');
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '导入失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  const tabs: Array<[string, string, string]> = [
    ['pool', '内容池', '添加、搜索、批量抓取与台账'],
    ['linkage', '发布与反馈', '发布覆盖与自然讨论缺口'],
    ['performance', '内容表现', '内容形式、达人层级与效率'],
  ];

  return (
    <div className="stack">
      <PageHeader
        eyebrow="CONTENT MANAGEMENT"
        title="内容管理"
        subtitle="把内容资产、发布进度和自然反馈放在一起管理。"
        badge={<span>{dashboard.metrics.noteCount} 篇笔记资产</span>}
      >
        <div className="range-actions">
          <label>
            从
            <input
              type="date"
              value={from}
              onChange={(e) => updateFilters(e.target.value, to, source)}
            />
          </label>
          <label>
            至
            <input
              type="date"
              value={to}
              onChange={(e) => updateFilters(from, e.target.value, source)}
            />
          </label>
          <select
            value={source}
            onChange={(e) => updateFilters(from, to, e.target.value)}
          >
            <option value="">全部来源</option>
            <option value="owned">自有笔记</option>
            <option value="keyword_scan">关键词扫描</option>
          </select>
        </div>
      </PageHeader>

      <SectionTabs value={tab} onChange={setTab} items={tabs} />

      {tab === 'pool' && (
        <NotesPool
          data={dashboard}
          noteIds={noteIds}
          setNoteIds={setNoteIds}
          keywords={keywords}
          setKeywords={setKeywords}
          from={from}
          to={to}
          runFetch={runFetch}
          runSearch={runSearch}
          uploadWorkbook={uploadWorkbook}
          loading={loading}
          runResult={runResult}
          openNote={openNote}
        />
      )}

      {tab === 'linkage' && (
        <PublicationLinkage data={dashboard} openNote={openNote} />
      )}

      {tab === 'performance' && (
        <ContentPerformance data={dashboard} openNote={openNote} />
      )}

      {renderDrawer()}
    </div>
  );
}
