'use client';

import { useState } from 'react';
import type { Note, NoteDetail } from '../../lib/types/project';
import { cnTime, pct } from '../../lib/hooks/use-project-data';

export function DetailDrawer({
  detail,
  close,
  saveNote,
  removeNote,
}: {
  detail: NoteDetail;
  close: () => void;
  saveNote: (note: Note) => void;
  removeNote: (note: Note) => void;
}) {
  const n = detail.note;
  const [draft, setDraft] = useState(n);

  return (
    <div className="drawer-backdrop" onMouseDown={close}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={close}>
          ×
        </button>
        <small>NOTE DETAIL</small>
        <h2>{n?.title || n?.id || '笔记明细'}</h2>
        <p className="drawer-meta">
          {n?.author || '未知博主'} · {n?.status || '待抓取'} · 最近抓取{' '}
          {cnTime(n?.lastFetchedAt)}
        </p>

        <section className="mini-kpis">
          <article>
            <p>评论</p>
            <strong>{n?.commentTotal || 0}</strong>
            <span className="up">全量主评+楼中楼</span>
          </article>
          <article>
            <p>正向</p>
            <strong>{n?.positiveCount || 0}</strong>
            <span className="up">
              {n?.commentTotal ? pct((n.positiveCount || 0) / n.commentTotal) : '—'}
            </span>
          </article>
          <article>
            <p>负向/问询</p>
            <strong>{(n?.negativeCount || 0) + (n?.questionCount || 0)}</strong>
            <span className="danger">需要重点复查</span>
          </article>
        </section>

        {draft && (
          <section className="note-editor">
            <label>
              标题
              <input
                value={draft.title || ''}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label>
              博主
              <input
                value={draft.author || ''}
                onChange={(e) => setDraft({ ...draft, author: e.target.value })}
              />
            </label>
            <label>
              产品范围
              <select
                value={draft.productScope || '本品'}
                onChange={(e) => setDraft({ ...draft, productScope: e.target.value })}
              >
                <option>本品</option>
                <option>竞品</option>
                <option>其他</option>
              </select>
            </label>
            <label>
              验收状态
              <select
                value={draft.status || '待抓取'}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              >
                <option>待抓取</option>
                <option>符合基础要求</option>
                <option>符合且能汇报</option>
                <option>不够30条需补充</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button className="primary" onClick={() => saveNote(draft)}>
                保存笔记
              </button>
              <button className="danger-link" onClick={() => removeNote(draft)}>
                移出项目
              </button>
            </div>
          </section>
        )}

        <h3>指标快照</h3>
        <div className="snapshot-list">
          {detail.snapshots.length ? (
            detail.snapshots.map((x) => (
              <div key={x.capturedAt}>
                <time>{cnTime(x.capturedAt)}</time>
                <span>主评 {x.l1Count}</span>
                <span>楼中楼 {x.l2Count}</span>
                <b>合计 {x.totalCount}</b>
              </div>
            ))
          ) : (
            <div className="empty">暂无历史快照</div>
          )}
        </div>

        <h3>关键评论</h3>
        <div className="drawer-comments">
          {detail.comments.length ? (
            detail.comments.map((x) => (
              <article key={x.id}>
                <span>
                  {x.sentiment} · {x.category}
                </span>
                <p>{x.content}</p>
                <small>
                  {x.action} · {x.treatmentStatus}
                </small>
              </article>
            ))
          ) : (
            <div className="empty">暂无需处置的关键评论</div>
          )}
        </div>
      </aside>
    </div>
  );
}
