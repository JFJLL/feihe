'use client';

import { useState } from 'react';
import type { Dashboard, Note, NoteDetail } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionTabs } from '../../components/ui/SectionTabs';
import { NotesPool } from './NotesPool';
import { PublicationLinkage } from './PublicationLinkage';
import { ContentPerformance } from './ContentPerformance';
import { DetailDrawer } from './DetailDrawer';
import { api } from '../../lib/hooks/use-project-data';

export function ContentWorkspace({
  projectId,
  dashboard,
  initialTab = 'pool',
  onRefresh,
  toast,
  from,
  to,
  setFrom,
  setTo,
  source,
  setSource,
}: {
  projectId: string;
  dashboard: Dashboard;
  initialTab?: string;
  onRefresh: () => Promise<void>;
  toast: (msg: string) => void;
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  source: string;
  setSource: (v: string) => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [noteIds, setNoteIds] = useState('');
  const [keywords, setKeywords] = useState('启萃,飞鹤奶粉');
  const [loading, setLoading] = useState(false);
  const [runResult, setRunResult] = useState('');
  const [detail, setDetail] = useState<NoteDetail | null>(null);

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
      toast('全量评论抓取与增量比对完成');
      setRunResult(
        result.results
          .map((x) =>
            x.ok
              ? x.noteId + '：主评论 ' + x.fetchedL1 + '，楼中楼 ' + x.fetchedL2 + '，合计 ' + x.total + '，' + x.status
              : x.noteId + '：失败 · ' + x.error
          )
          .join('\n')
      );
      await onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '抓取失败');
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
      toast('关键词扫描完成');
      setRunResult('已扫描并入库 ' + result.count + ' 篇笔记，可在内容池中筛选并批量抓取。');
      await onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '扫描失败');
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
      toast('表格导入完成');
      setRunResult('导入 ' + result.imported + ' 条，跳过 ' + result.skipped + ' 条。');
      await onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '导入失败');
    } finally {
      setLoading(false);
    }
  }

  async function openNote(id: string) {
    try {
      const data = await api<NoteDetail>(
        '/api/notes/detail?id=' + encodeURIComponent(id) + '&projectId=' + encodeURIComponent(projectId)
      );
      setDetail(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : '明细加载失败');
    }
  }

  async function saveNote(note: Note) {
    try {
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({
          action: 'note_update',
          projectId,
          ...(note as unknown as Record<string, unknown>),
        }),
      });
      toast('笔记资料已更新');
      setDetail(null);
      await onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败');
    }
  }

  async function removeNote(note: Note) {
    if (!confirm('确认将此笔记及当前项目内的评论快照移出项目？')) return;
    try {
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({ action: 'note_delete', projectId, id: note.id }),
      });
      toast('笔记已移出当前项目');
      setDetail(null);
      await onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败');
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
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            至
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
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

      {detail && (
        <DetailDrawer
          key={detail.note?.id || 'detail'}
          detail={detail}
          close={() => setDetail(null)}
          saveNote={saveNote}
          removeNote={removeNote}
        />
      )}
    </div>
  );
}
