'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Note } from '../../lib/types/project';
import { NoteThumbnail } from '../ui/NoteThumbnail';
import { contentDirectionLabel } from '../../lib/dashboard-display';
import { compact, num } from '../../lib/hooks/use-project-data';

export type CategoryNotesModalProps = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  tag?: string;
  notes: Note[];
  maxCount?: number;
  onClose: () => void;
  onOpenNote?: (id: string) => void;
};

export function CategoryNotesModal({
  isOpen,
  title,
  subtitle,
  tag = '分类笔记',
  notes = [],
  maxCount = 50,
  onClose,
  onOpenNote,
}: CategoryNotesModalProps) {
  const [keyword, setKeyword] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setKeyword('');
      const timer = setTimeout(() => searchInputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sortedAndFilteredNotes = useMemo(() => {
    let list = [...notes].sort((a, b) => {
      const bInt = num(b.interactionCount);
      const aInt = num(a.interactionCount);
      if (bInt !== aInt) return bInt - aInt;
      return num(b.readCount) - num(a.readCount);
    });

    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase();
      list = list.filter(n =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.author && n.author.toLowerCase().includes(q)) ||
        (n.category1 && n.category1.toLowerCase().includes(q)) ||
        (n.creatorLevel && n.creatorLevel.toLowerCase().includes(q))
      );
    }

    return list.slice(0, maxCount);
  }, [notes, keyword, maxCount]);

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
        {/* Header */}
        <div className="category-notes-header">
          <div className="category-notes-header-main">
            <div className="category-notes-header-tags">
              <span className="category-notes-tag">{tag}</span>
              <span className="category-notes-count-badge">
                样本总计 {notes.length} 篇 · 当前展示前 {Math.min(notes.length, maxCount)} 篇
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
            <div className="category-notes-stat-pill">
              <span className="stat-label">分类样本数</span>
              <strong className="stat-value">{notes.length.toLocaleString()} 篇</strong>
            </div>
            <div className="category-notes-stat-pill">
              <span className="stat-label">累计阅读量</span>
              <strong className="stat-value">{compact(stats.totalReads)}</strong>
            </div>
            <div className="category-notes-stat-pill">
              <span className="stat-label">累计互动量</span>
              <strong className="stat-value" style={{ color: '#0284c7' }}>
                {compact(stats.totalInteractions)}
              </strong>
            </div>
            <div className="category-notes-stat-pill">
              <span className="stat-label">累计评论数</span>
              <strong className="stat-value">{compact(stats.totalComments)}</strong>
            </div>
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
                    <th style={{ width: 72 }}>封面</th>
                    <th>笔记标题 / 达人</th>
                    <th style={{ width: 130 }}>切角 / 场景</th>
                    <th style={{ width: 90, textAlign: 'right' }}>阅读量</th>
                    <th style={{ width: 90, textAlign: 'right' }}>互动量</th>
                    <th style={{ width: 80, textAlign: 'right' }}>评论数</th>
                    <th style={{ width: 100, textAlign: 'center' }}>操作</th>
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
                        onClick={() => onOpenNote && onOpenNote(note.id)}
                      >
                        <td style={{ textAlign: 'center', color: index < 3 ? '#ea580c' : '#94a3b8', fontWeight: index < 3 ? 700 : 500 }}>
                          {index + 1}
                        </td>
                        <td>
                          <div style={{ width: 48, height: 48, borderRadius: 6, overflow: 'hidden' }}>
                            <NoteThumbnail
                              src={note.coverUrl}
                              title={note.title}
                              author={note.author}
                              category={note.category1}
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
                          <strong style={{ color: '#0284c7' }}>{compact(interactions)}</strong>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>
                          {compact(comments)}
                        </td>
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                            {onOpenNote && (
                              <button
                                type="button"
                                className="category-note-detail-btn"
                                onClick={() => onOpenNote(note.id)}
                              >
                                详情
                              </button>
                            )}
                            {note.url && (
                              <a
                                href={note.url}
                                target="_blank"
                                rel="noreferrer"
                                className="category-note-link-btn"
                                title="打开小红书原笔记"
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
            💡 支持在列表中直接点击任意行查看单篇笔记完整画像与评论；按互动量降序排列展示前 {Math.min(notes.length, maxCount)} 篇。
          </div>
          <button type="button" className="category-notes-close-action" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export function useCategoryNotesModal({
  onOpenNote,
}: {
  onOpenNote?: (id: string) => void;
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
      onClose={closeCategoryNotes}
      onOpenNote={onOpenNote}
    />
  );

  return {
    modalState,
    openCategoryNotes,
    closeCategoryNotes,
    renderCategoryNotesModal,
  };
}