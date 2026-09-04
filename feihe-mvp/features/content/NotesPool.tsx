'use client';

import { useState } from 'react';
import Link from '../../components/ui/AppLink';
import type { Dashboard } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
import { compact } from '../../lib/hooks/use-project-data';

export function NotesPool({
  data,
  noteIds,
  setNoteIds,
  keywords,
  setKeywords,
  from,
  to,
  runFetch,
  runSearch,
  uploadWorkbook,
  loading,
  runResult,
  openNote,
}: {
  data: Dashboard;
  noteIds: string;
  setNoteIds: (v: string) => void;
  keywords: string;
  setKeywords: (v: string) => void;
  from: string;
  to: string;
  runFetch: (ids?: string) => void;
  runSearch: () => void;
  uploadWorkbook: (f: File | undefined, k: 'owned' | 'supplier') => void;
  loading: boolean;
  runResult: string;
  openNote: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  const rows = data.notes.filter(
    (n) =>
      (!query || (n.title + n.author + n.id).toLowerCase().includes(query.toLowerCase())) &&
      (!status || n.status === status)
  );

  const toggle = (id: string) =>
    setSelected((old) => (old.includes(id) ? old.filter((x) => x !== id) : [...old, id]));

  return (
    <div className="stack">
      <section className="tool-grid">
        <article className="panel task-card">
          <PanelHead eyebrow="COMMENT FETCH" title="按 ID 抓取全量评论" />
          <label>笔记 ID 或链接（每行一个）</label>
          <textarea
            value={noteIds}
            onChange={(e) => setNoteIds(e.target.value)}
            rows={3}
            placeholder="粘贴小红书笔记 ID 或链接"
          />
          <p>自动抓取全部主评论和全部楼中楼，按项目规则保存指标快照与关键评论。</p>
          <button
            className="primary wide"
            disabled={loading || !noteIds.trim()}
            onClick={() => runFetch()}
          >
            开始抓取并分析
          </button>
        </article>

        <article className="panel task-card">
          <PanelHead eyebrow="NOTE DISCOVERY" title="关键词扫描笔记" />
          <label>本品 / 竞品关键词</label>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="如：启萃,飞鹤奶粉"
          />
          <p>
            {from} 至 {to} · 最多 5 页/关键词 · 自动去重归类
          </p>
          <button className="primary wide" disabled={loading} onClick={runSearch}>
            扫描并入库
          </button>
        </article>

        <article className="panel task-card import-card">
          <PanelHead eyebrow="OWNED NOTES" title="导入自有笔记表" />
          <p>与关键词扫描结果比对，自动识别自有 / UGC / 竞品来源。</p>
          <label className="upload">
            选择 Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => uploadWorkbook(e.target.files?.[0], 'owned')}
            />
          </label>
        </article>
      </section>

      {runResult && <pre className="result-box">{runResult}</pre>}

      <section className="panel">
        <PanelHead
          eyebrow="NOTE ASSETS"
          title="笔记台账与分类"
          extra={
            <Link
              className="text-link"
              href={'/api/export?type=notes&projectId=' + (data.projectId ?? 'qicui')}
            >
              导出笔记台账 ↗
            </Link>
          }
        />
        <div className="filterbar">
          <input
            placeholder="搜索标题 / 博主 / ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部验收状态</option>
            <option>符合且能汇报</option>
            <option>符合基础要求</option>
            <option>不够30条需补充</option>
            <option>待抓取</option>
          </select>
          <button
            disabled={!selected.length || loading}
            onClick={() => runFetch(selected.join('\n'))}
          >
            批量抓取已选 {selected.length > 0 ? selected.length + ' 篇' : ''}
          </button>
        </div>

        <div className="data-table notes-table">
          <div className="tr th">
            <span>选择 / 笔记</span>
            <span>来源</span>
            <span>评论</span>
            <span>正向</span>
            <span>负向/问询</span>
            <span>状态</span>
            <span>操作</span>
          </div>
          {rows.length ? (
            rows.map((n) => (
              <div className="tr" key={n.id}>
                <span>
                  <input
                    type="checkbox"
                    checked={selected.includes(n.id)}
                    onChange={() => toggle(n.id)}
                  />
                  <strong>{n.title || n.id}</strong>
                  <small>
                    {n.author || '未知作者'} · {n.productScope || '本品'} · {n.category1 || '未分类'}
                  </small>
                </span>
                <span>{n.sourceType || '关键词扫描'}</span>
                <span>{compact(n.commentTotal)}</span>
                <span>{compact(n.positiveCount)}</span>
                <span className={(n.negativeCount || 0) > 0 ? 'risk-text' : ''}>
                  {compact((n.negativeCount || 0) + (n.questionCount || 0))}
                </span>
                <span>
                  <i
                    className={
                      'pill ' +
                      (n.status === '符合且能汇报'
                        ? 'green-pill'
                        : n.status === '符合基础要求'
                        ? 'blue-pill'
                        : 'gray-pill')
                    }
                  >
                    {n.status || '待抓取'}
                  </i>
                </span>
                <span className="row-actions">
                  <button onClick={() => openNote(n.id)}>明细</button>
                  <button onClick={() => runFetch(n.id)}>抓取</button>
                </span>
              </div>
            ))
          ) : (
            <EmptyState title="暂无笔记数据" text="可通过上方输入笔记 ID 或运行关键词扫描添加入库。" />
          )}
        </div>
      </section>
    </div>
  );
}
