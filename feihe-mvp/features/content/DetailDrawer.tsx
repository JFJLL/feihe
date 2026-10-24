'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Note, NoteDetail } from '../../lib/types/project';
import { cnTime, pct } from '../../lib/hooks/use-project-data';
import { NoteCover } from '../../components/ui/NoteCover';
import { StyledSelect } from '../../components/ui/StyledSelect';

function isValidHttpUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

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
  const { capabilities } = detail;
  const canEdit = capabilities ? capabilities.canEdit : false;
  const readonlyReason = capabilities?.readonlyReason || '来源快照，只读查看';
  const [draft, setDraft] = useState(n);

  const modalRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  // Body scroll lock & Focus trap
  useEffect(() => {
    triggerElementRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    modalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      triggerElementRef.current?.focus();
    };
  }, [close]);

  const handleBackdropMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      close();
    }
  }, [close]);

  return (
    <div className="note-detail-modal-backdrop" onMouseDown={handleBackdropMouseDown} role="dialog" aria-modal="true" aria-labelledby="content-note-title">
      <div
        ref={modalRef}
        tabIndex={-1}
        className="note-detail-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="note-detail-modal-header">
          <div className="note-detail-modal-header-info">
            <span className="note-detail-modal-eyebrow">
              NOTE DETAIL
              {!canEdit && (
                <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 500 }}>
                  / 🔒 {readonlyReason}
                </span>
              )}
            </span>
            <h2 id="content-note-title" className="note-detail-modal-title">
              {n?.title || n?.id || '笔记明细'}
            </h2>
            <p className="note-detail-modal-meta">
              <span>👤 {n?.author || '未知博主'}</span>
              <span>·</span>
              <span>🏷️ {n?.status || '已收录'}</span>
              {n?.lastFetchedAt && (
                <>
                  <span>·</span>
                  <span>最近抓取 {cnTime(n.lastFetchedAt)}</span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            className="note-detail-modal-close"
            onClick={close}
            aria-label="关闭弹窗"
            title="关闭 (Esc)"
          >
            ×
          </button>
        </header>

        {/* Hero Section */}
        <section className="note-detail-modal-hero">
          <div className="note-detail-modal-media">
            <NoteCover
              src={n?.coverUrl}
              noteId={n?.id}
              projectId="qicui"
              title={n?.title}
              author={n?.author}
              url={n?.url}
              aspectRatio="3:4"
              className="note-detail-cover-box"
              eager
            />
          </div>

          <div className="note-detail-modal-summary">
            <div className="note-detail-modal-tags">
              {n?.category1 && (
                <span className="note-detail-chip chip-primary">
                  切角：{n.category1}
                </span>
              )}
              {n?.creatorLevel && (
                <span className="note-detail-chip chip-purple">
                  达人：{n.creatorLevel}
                </span>
              )}
              {n?.brand && (
                <span className="note-detail-chip">
                  品牌：{n.brand}
                </span>
              )}
              {n?.productScope && (
                <span className="note-detail-chip">
                  范围：{n.productScope}
                </span>
              )}
            </div>

            <div className="note-detail-modal-content-box">
              <span className="label">正文摘要：</span>
              {n?.content ? (
                n.content
              ) : (
                <span style={{ color: '#60646c' }}>源数据未提供正文长文本</span>
              )}
            </div>

            {isValidHttpUrl(n?.url) ? (
              <a
                href={n?.url || ''}
                target="_blank"
                rel="noreferrer"
                className="text-link"
                style={{ fontSize: '12px', color: '#0d74ce', alignSelf: 'flex-start', fontWeight: 600 }}
              >
                在小红书查看原笔记 ↗
              </a>
            ) : n?.url ? (
              <span style={{ fontSize: '12px', color: '#60646c' }}>原笔记标识: {n.url}</span>
            ) : null}
          </div>
        </section>

        {/* Modal Scrollable Body */}
        <div className="note-detail-modal-body">
          <section className="mini-kpis" style={{ marginBottom: 16 }}>
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
              {!canEdit ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ background: '#f9f9fb', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', padding: '10px 12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 600 }}>标题</span>
                    <div style={{ fontSize: '14px', color: '#1c2024', fontWeight: 600, marginTop: '2px' }}>{draft.title || '未命名'}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ background: '#f9f9fb', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', padding: '10px 12px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 600 }}>博主</span>
                      <div style={{ fontSize: '14px', color: '#1c2024', marginTop: '2px' }}>{draft.author || '未知'}</div>
                    </div>
                    <div style={{ background: '#f9f9fb', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', padding: '10px 12px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 600 }}>产品范围</span>
                      <div style={{ fontSize: '14px', color: '#1c2024', marginTop: '2px' }}>{draft.productScope || '本品'}</div>
                    </div>
                  </div>
                  <div className="note-readonly-banner">
                    <span>🔒 {readonlyReason}</span>
                  </div>
                </div>
              ) : (
                <>
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
                    <StyledSelect
                      value={draft.productScope || '本品'}
                      onChange={(e) => setDraft({ ...draft, productScope: e.target.value })}
                      aria-label="产品范围"
                    >
                      <option>本品</option>
                      <option>竞品</option>
                      <option>其他</option>
                    </StyledSelect>
                  </label>
                  <label>
                    验收状态
                    <StyledSelect
                      value={draft.status || '待抓取'}
                      onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                      aria-label="验收状态"
                    >
                      <option>待抓取</option>
                      <option>符合基础要求</option>
                      <option>符合且能汇报</option>
                      <option>不够30条需补充</option>
                    </StyledSelect>
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button type="button" className="primary" onClick={() => saveNote(draft)}>
                      保存笔记
                    </button>
                    <button type="button" className="danger-link" onClick={() => removeNote(draft)}>
                      移出项目
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          <h3 style={{ fontSize: '14px', marginTop: 16, marginBottom: 8, fontWeight: 600 }}>指标快照</h3>
          <div className="snapshot-list">
            {detail.snapshots && detail.snapshots.length ? (
              detail.snapshots.map((x) => (
                <div key={x.capturedAt}>
                  <time>{cnTime(x.capturedAt)}</time>
                  <span>主评 {x.l1Count}</span>
                  <span>楼中楼 {x.l2Count}</span>
                  <b>合计 {x.totalCount}</b>
                </div>
              ))
            ) : (
              <div className="empty" style={{ padding: 12, textAlign: 'center', color: '#60646c', fontSize: '12px' }}>暂无历史快照</div>
            )}
          </div>

          <h3 style={{ fontSize: '14px', marginTop: 16, marginBottom: 8, fontWeight: 600 }}>关键评论</h3>
          <div className="drawer-comments">
            {detail.comments && detail.comments.length ? (
              detail.comments.map((x) => (
                <article key={x.id}>
                  <span>
                    {x.sentiment} / {x.category}
                  </span>
                  <p>{x.content}</p>
                  <small>
                    {x.action} / {x.treatmentStatus}
                  </small>
                </article>
              ))
            ) : (
              <div className="empty" style={{ padding: 12, textAlign: 'center', color: '#60646c', fontSize: '12px' }}>暂无需处置的关键评论</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
