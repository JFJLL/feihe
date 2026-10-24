'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Note } from '../../lib/types/project';
import { NoteThumbnail } from '../ui/NoteThumbnail';
import { NoteCover } from '../ui/NoteCover';
import { contentDirectionLabel } from '../../lib/dashboard-display';
import { compact, num } from '../../lib/hooks/use-project-data';

export type CategoryNotesModalProps = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  tag?: string;
  notes: Note[];
  maxCount?: number;
  projectId?: string;
  onClose: () => void;
};

export function CategoryNotesModal({
  isOpen,
  title,
  subtitle,
  tag = '分类笔记',
  notes = [],
  maxCount = 50,
  projectId,
  onClose,
}: CategoryNotesModalProps) {
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<'interactions' | 'reads' | 'comments'>('interactions');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [extraComments, setExtraComments] = useState<Array<{
    id: string;
    content: string;
    author: string;
    sentiment: string;
    category: string;
    action: string;
    treatmentStatus?: string;
  }>>([]);
  const [extraContent, setExtraContent] = useState<string>('');

  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset on open: if single note, open directly to detail view
  useEffect(() => {
    if (isOpen) {
      setKeyword('');
      setSelectedNote(notes.length === 1 ? notes[0] : null);
      setExtraComments([]);
      setExtraContent('');
      const timer = setTimeout(() => searchInputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, notes]);

  // Handle escape & back navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (selectedNote && notes.length > 1) {
          setSelectedNote(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedNote, notes, onClose]);

  // When a note is selected, asynchronously load comments and full content if projectId is provided
  useEffect(() => {
    if (!selectedNote || !projectId) {
      setExtraComments([]);
      setExtraContent('');
      return;
    }
    let active = true;
    setDetailLoading(true);
    fetch(`/api/notes/detail?id=${encodeURIComponent(selectedNote.id)}&projectId=${encodeURIComponent(projectId)}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ comments?: any[]; note?: { content?: string } }>) : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.comments)) {
          setExtraComments(data.comments);
        }
        if (data.note?.content) {
          setExtraContent(data.note.content);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedNote, projectId]);

  // Filter & sort notes
  const sortedAndFilteredNotes = useMemo(() => {
    let list = [...notes].sort((a, b) => {
      if (sortBy === 'reads') return num(b.readCount) - num(a.readCount);
      if (sortBy === 'comments') return num(b.commentTotal) - num(a.commentTotal);
      // default interactions
      const bInt = num(b.interactionCount);
      const aInt = num(a.interactionCount);
      if (bInt !== aInt) return bInt - aInt;
      return num(b.readCount) - num(a.readCount);
    });

    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase();
      list = list.filter((n) =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.author && n.author.toLowerCase().includes(q)) ||
        (n.category1 && n.category1.toLowerCase().includes(q)) ||
        (n.creatorLevel && n.creatorLevel.toLowerCase().includes(q)) ||
        (n.brand && n.brand.toLowerCase().includes(q))
      );
    }

    return list.slice(0, maxCount);
  }, [notes, keyword, sortBy, maxCount]);

  // Stats
  const stats = useMemo(() => {
    const totalReads = notes.reduce((sum, n) => sum + num(n.readCount), 0);
    const totalInteractions = notes.reduce((sum, n) => sum + num(n.interactionCount), 0);
    const totalComments = notes.reduce((sum, n) => sum + num(n.commentTotal), 0);
    return {
      totalReads,
      totalInteractions,
      totalComments,
    };
  }, [notes]);

  if (!isOpen) return null;

  return (
    <div
      className="category-notes-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-notes-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="category-notes-modal" ref={modalRef}>
        {selectedNote ? (
          /* ==================== VIEW 2: NOTE ANALYTICS DETAIL (READ-ONLY) ==================== */
          <div className="category-notes-detail-view">
            {/* Detail Navigation Header */}
            <div className="category-notes-header category-notes-detail-header">
              <div className="category-notes-detail-nav">
                <div className="category-notes-breadcrumb">
                  <span>{title}</span>
                  <span className="breadcrumb-sep">/</span>
                  <strong style={{ color: '#1c2024' }}>单篇笔记画像</strong>
                </div>
              </div>
              <button
                type="button"
                className="category-notes-close-btn"
                onClick={onClose}
                aria-label="关闭弹窗"
                title="关闭 (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Detail Body */}
            <div className="category-notes-detail-body">
              {/* Hero Section */}
              <div className="note-detail-hero">
                <div className="note-detail-cover-box">
                  <NoteCover
                    src={selectedNote.coverUrl}
                    noteId={selectedNote.id}
                    projectId={projectId || 'qicui'}
                    title={selectedNote.title}
                    author={selectedNote.author}
                    category={selectedNote.category1}
                    url={selectedNote.url}
                    className="note-detail-cover-img"
                    aspectRatio="3:4"
                    eager
                  />
                </div>
                <div className="note-detail-hero-info">
                  <div className="note-detail-chips">
                    {selectedNote.category1 && (
                      <span className="note-chip chip-purple">
                        切角：{contentDirectionLabel(selectedNote.category1)}
                      </span>
                    )}
                    {selectedNote.creatorLevel && (
                      <span className="note-chip chip-blue">达人：{selectedNote.creatorLevel}</span>
                    )}
                    {selectedNote.brand && (
                      <span className="note-chip chip-teal">品牌：{selectedNote.brand}</span>
                    )}
                    {selectedNote.noteType && (
                      <span className="note-chip chip-gray">形式：{selectedNote.noteType}</span>
                    )}
                    {selectedNote.productScope && (
                      <span className="note-chip chip-gray">范围：{selectedNote.productScope}</span>
                    )}
                  </div>

                  <h2 className="note-detail-title">{selectedNote.title || '无标题笔记'}</h2>

                  <div className="note-detail-author-row">
                    <span className="note-detail-author-name">
                      👤 <strong>{selectedNote.author || '未知博主'}</strong>
                    </span>
                    {selectedNote.publishedAt && (
                      <span className="note-detail-date">
                        📅 发布于 {selectedNote.publishedAt.slice(0, 10)}
                      </span>
                    )}
                    {selectedNote.url && (
                      <a
                        href={selectedNote.url}
                        target="_blank"
                        rel="noreferrer"
                        className="note-detail-xhs-btn"
                      >
                        在小红书查看原笔记 ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="note-detail-kpi-grid">
                <div className="note-kpi-card card-blue">
                  <span className="kpi-label">累计阅读量</span>
                  <div className="kpi-num">{compact(selectedNote.readCount)}</div>
                  <span className="kpi-desc">
                    {num(selectedNote.readCount) > 0 ? `${num(selectedNote.readCount).toLocaleString()} 次` : '0 次'}
                  </span>
                </div>
                <div className="note-kpi-card card-purple">
                  <span className="kpi-label">累计互动量</span>
                  <div className="kpi-num" style={{ color: '#5753c6' }}>
                    {compact(selectedNote.interactionCount)}
                  </div>
                  <span className="kpi-desc">
                    点赞 {compact(selectedNote.likeCount)} / 收藏 {compact(selectedNote.favoriteCount)} / 分享 {compact(selectedNote.shareCount)}
                  </span>
                </div>
                <div className="note-kpi-card card-teal">
                  <span className="kpi-label">评论快照总数</span>
                  <div className="kpi-num" style={{ color: '#008573' }}>
                    {compact(selectedNote.commentTotal)}
                  </div>
                  <span className="kpi-desc">
                    正向 {selectedNote.positiveCount ?? 0} / 负向 {selectedNote.negativeCount ?? 0} / 问询 {selectedNote.questionCount ?? 0}
                  </span>
                </div>
                <div className="note-kpi-card card-amber">
                  <span className="kpi-label">达人采买报价</span>
                  <div className="kpi-num" style={{ color: '#ab6400' }}>
                    {num(selectedNote.notePrice) > 0 ? `¥${num(selectedNote.notePrice).toLocaleString()}` : '—'}
                  </div>
                  <span className="kpi-desc">
                    {num(selectedNote.cpe) > 0 ? `估算 CPE: ¥${num(selectedNote.cpe).toFixed(1)}` : '基于填报报价'}
                  </span>
                </div>
              </div>

              {/* Note Content Snippet */}
              {(extraContent || selectedNote.content) && (
                <div className="note-detail-section">
                  <h3 className="note-section-title">📝 笔记文案摘要</h3>
                  <div className="note-content-box">
                    <p>{extraContent || selectedNote.content}</p>
                  </div>
                </div>
              )}

              {/* Key Comments */}
              <div className="note-detail-section">
                <div className="note-section-head-row">
                  <h3 className="note-section-title">💬 抓取关键评论</h3>
                  {detailLoading && <span className="note-loading-tag">正在刷新快照…</span>}
                  <span className="note-comments-count">
                    已收录 {extraComments.length} 条评论
                  </span>
                </div>

                {extraComments.length === 0 ? (
                  <div className="note-comments-empty">
                    {detailLoading ? '正在读取该笔记评论快照…' : '该笔记暂无采集到的关键处置评论。'}
                  </div>
                ) : (
                  <div className="note-comments-list">
                    {extraComments.slice(0, 30).map((cmt, idx) => (
                      <div key={cmt.id || idx} className="note-comment-item">
                        <div className="comment-item-head">
                          <span className="comment-author">{cmt.author || '小红书用户'}</span>
                          <div className="comment-tags">
                            <span
                              className={`comment-sentiment-badge ${
                                cmt.sentiment === '正向' ? 'sentiment-pos' : cmt.sentiment === '负向' ? 'sentiment-neg' : 'sentiment-neutral'
                              }`}
                            >
                              {cmt.sentiment || '中立'}
                            </span>
                            {cmt.category && <span className="comment-category-badge">{cmt.category}</span>}
                            {cmt.action && cmt.action !== '保留观察' && (
                              <span className="comment-action-badge">{cmt.action}</span>
                            )}
                          </div>
                        </div>
                        <p className="comment-content-text">{cmt.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Detail Footer */}
            <div className="category-notes-footer">
              <div className="category-notes-footer-hint">
                💡 当前为只读数据洞察视图；点击右下角「{notes.length === 1 ? '关闭' : '返回列表'}」即可退出。
              </div>
              <button
                type="button"
                className="category-notes-close-action"
                onClick={() => {
                  if (notes.length === 1) {
                    onClose();
                  } else {
                    setSelectedNote(null);
                  }
                }}
              >
                {notes.length === 1 ? '关闭' : '返回列表'}
              </button>
            </div>
          </div>
        ) : (
          /* ==================== VIEW 1: CATEGORY NOTES LIST ==================== */
          <>
            {/* Header */}
            <div className="category-notes-header">
              <div className="category-notes-header-main">
                <div className="category-notes-header-tags">
                  <span className="category-notes-tag">{tag}</span>
                  <span className="category-notes-count-badge">
                    样本总计 {notes.length} 篇 / 当前展示前 {Math.min(notes.length, maxCount)} 篇
                  </span>
                </div>
                <h2 id="category-notes-modal-title" className="category-notes-title">
                  {title}
                </h2>
                {subtitle && <p className="category-notes-subtitle">{subtitle}</p>}
              </div>

              <button
                type="button"
                className="category-notes-close-btn"
                onClick={onClose}
                aria-label="关闭弹窗"
                title="关闭 (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Stats Strip & Search Bar */}
            <div className="category-notes-toolbar">
              <div className="category-notes-stats">
                <div className="category-notes-stat-pill stat-blue">
                  <span className="stat-label">分类样本数</span>
                  <strong className="stat-value">{notes.length.toLocaleString()} 篇</strong>
                </div>
                <div className="category-notes-stat-pill stat-green">
                  <span className="stat-label">累计阅读量</span>
                  <strong className="stat-value">{compact(stats.totalReads)}</strong>
                </div>
                <div className="category-notes-stat-pill stat-purple">
                  <span className="stat-label">累计互动量</span>
                  <strong className="stat-value" style={{ color: '#5753c6' }}>
                    {compact(stats.totalInteractions)}
                  </strong>
                </div>
                <div className="category-notes-stat-pill stat-teal">
                  <span className="stat-label">累计评论数</span>
                  <strong className="stat-value">{compact(stats.totalComments)}</strong>
                </div>
              </div>

              <div className="category-notes-search-and-sort">
                <div className="category-notes-sort-group">
                  <button
                    type="button"
                    className={`category-sort-btn ${sortBy === 'interactions' ? 'active' : ''}`}
                    onClick={() => setSortBy('interactions')}
                  >
                    互动最多 ↓
                  </button>
                  <button
                    type="button"
                    className={`category-sort-btn ${sortBy === 'reads' ? 'active' : ''}`}
                    onClick={() => setSortBy('reads')}
                  >
                    阅读最高 ↓
                  </button>
                  <button
                    type="button"
                    className={`category-sort-btn ${sortBy === 'comments' ? 'active' : ''}`}
                    onClick={() => setSortBy('comments')}
                  >
                    评论最多 ↓
                  </button>
                </div>

                <div className="category-notes-search-wrap">
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="category-notes-search-input"
                    placeholder="搜索标题、达人、切角关键词…"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    aria-label="搜索当前弹窗笔记"
                  />
                  {keyword && (
                    <button
                      type="button"
                      className="category-notes-search-clear"
                      onClick={() => setKeyword('')}
                      aria-label="清除搜索词"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Notes Table */}
            <div className="category-notes-body">
              {sortedAndFilteredNotes.length === 0 ? (
                <div className="category-notes-empty">
                  <p>未找到匹配的笔记</p>
                  {keyword && <small>可尝试清除搜索关键词重新查看</small>}
                </div>
              ) : (
                <div className="category-notes-table-wrap">
                  <table className="category-notes-table">
                    <thead>
                      <tr>
                        <th style={{ width: 44, textAlign: 'center' }}>#</th>
                        <th style={{ width: 68 }}>封面</th>
                        <th>笔记标题 / 达人</th>
                        <th style={{ width: 140 }}>切角 / 场景</th>
                        <th style={{ width: 95, textAlign: 'right' }}>阅读量</th>
                        <th style={{ width: 95, textAlign: 'right' }}>互动量</th>
                        <th style={{ width: 85, textAlign: 'right' }}>评论数</th>
                        <th style={{ width: 110, textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAndFilteredNotes.map((note, index) => {
                        const reads = num(note.readCount);
                        const interactions = num(note.interactionCount);
                        const comments = num(note.commentTotal);
                        const isHot = interactions >= 1000 || reads >= 10000;

                        return (
                          <tr
                            key={note.id || index}
                            className="category-notes-row"
                            onClick={() => setSelectedNote(note)}
                            title="点击查看该笔记画像明细"
                          >
                            <td style={{ textAlign: 'center' }}>
                              <span className={`rank-badge ${index < 3 ? 'rank-' + (index + 1) : 'rank-normal'}`}>${index + 1}</span>
                            </td>
                            <td>
                              <div className="note-cover-thumb-wrap">
                                <NoteCover
                                  src={note.coverUrl}
                                  noteId={note.id}
                                  projectId={projectId || 'qicui'}
                                  title={note.title}
                                  author={note.author}
                                  category={note.category1}
                                  url={note.url}
                                  className="ops-table-note-cover"
                                  aspectRatio="3:4"
                                />
                              </div>
                            </td>
                            <td>
                              <div className="note-cell-content">
                                <div className="note-title-line">
                                  <span className="note-title-text" title={note.title || '无标题'}>
                                    {note.title || '无标题'}
                                  </span>
                                  {isHot && <span className="hot-tag">高热</span>}
                                </div>
                                <div className="note-meta-line">
                                  <span className="note-author">{note.author || '未知作者'}</span>
                                  {note.creatorLevel && (
                                    <span className="note-level-badge">{note.creatorLevel}</span>
                                  )}
                                  {note.brand && <span className="note-brand-badge">{note.brand}</span>}
                                  {note.noteType && <span className="note-type-badge">{note.noteType}</span>}
                                  {note.publishedAt && (
                                    <span className="note-date">{note.publishedAt.slice(0, 10)}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="note-category-tag">
                                {contentDirectionLabel(note.category1 || '未分类')}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              {compact(reads)}
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              <strong style={{ color: '#0d74ce' }}>{compact(interactions)}</strong>
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--slate-11, #60646c)' }}>
                              {compact(comments)}
                            </td>
                            <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="category-note-detail-btn"
                                  onClick={() => setSelectedNote(note)}
                                  title="查看单篇笔记完整画像与评论"
                                >
                                  详情 →
                                </button>
                                {note.url && (
                                  <a
                                    href={note.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="category-note-link-btn"
                                    title="在小红书打开原笔记"
                                  >
                                    ↗
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="category-notes-footer">
              <div className="category-notes-footer-hint">
                💡 支持在列表中点击任意行直接查看该笔记的深度数据画像与评论快照；已按当前规则降序排列。
              </div>
              <button type="button" className="category-notes-close-action" onClick={onClose}>
                关闭
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function useCategoryNotesModal({
  projectId,
}: {
  projectId?: string;
} = {}) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    tag?: string;
    notes: Note[];
    maxCount?: number;
  }>({
    isOpen: false,
    title: '',
    subtitle: '',
    tag: '分类笔记',
    notes: [],
    maxCount: 50,
  });

  const openCategoryNotes = (options: {
    title: string;
    subtitle?: string;
    tag?: string;
    notes: Note[];
    maxCount?: number;
  }) => {
    setModalState({
      isOpen: true,
      title: options.title,
      subtitle: options.subtitle,
      tag: options.tag || '分类笔记',
      notes: options.notes || [],
      maxCount: options.maxCount || 50,
    });
  };

  const closeCategoryNotes = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const renderCategoryNotesModal = () => (
    <CategoryNotesModal
      isOpen={modalState.isOpen}
      title={modalState.title}
      subtitle={modalState.subtitle}
      tag={modalState.tag}
      notes={modalState.notes}
      maxCount={modalState.maxCount}
      projectId={projectId}
      onClose={closeCategoryNotes}
    />
  );

  return {
    modalState,
    openCategoryNotes,
    closeCategoryNotes,
    renderCategoryNotesModal,
  };
}