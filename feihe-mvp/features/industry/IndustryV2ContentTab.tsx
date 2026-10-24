'use client';

import React, { useState, useMemo } from 'react';
import type { IndustryV2Report, IndustryV2Distribution, IndustryV2Note } from '../../lib/industry-v2-types';
import {
  formatMetricNumber,
  PaginationBar,
  SafeExternalLink,
  EmptyStateBox,
  cleanQueryLabel,
} from './IndustryV2Widgets';

export function IndustryV2ContentTab({
  report,
}: {
  report: IndustryV2Report;
}) {
  const { content, notes } = report;
  const [activeEvidenceFilter, setActiveEvidenceFilter] = useState<{
    category: string;
    label: string;
    evidenceIds: string[];
  } | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);

  // Notes map for quick evidence lookup
  const notesMap = useMemo(() => {
    const map = new Map<string, IndustryV2Note>();
    for (const n of notes) {
      map.set(n.noteId, n);
    }
    return map;
  }, [notes]);

  // Filtered or top notes list - strictly returns empty array on empty evidence, never falls back to topNotes
  const displayedNotes = useMemo(() => {
    if (activeEvidenceFilter) {
      const ids = activeEvidenceFilter.evidenceIds || [];
      if (ids.length === 0) return [];
      const filtered: IndustryV2Note[] = [];
      for (const id of ids) {
        const found = notesMap.get(id);
        if (found) filtered.push(found);
      }
      return filtered;
    }
    return content.topNotes || [];
  }, [activeEvidenceFilter, notesMap, content.topNotes]);

  const totalPages = Math.max(1, Math.ceil(displayedNotes.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedNotes = displayedNotes.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  // Distribution Card Helper
  const renderDistributionCard = (
    title: string,
    category: string,
    items: IndustryV2Distribution[],
    description: string
  ) => {
    const maxCount = Math.max(1, ...items.map((i) => i.count || 0));
    return (
      <div className="v2-card v2-dist-card">
        <div className="v2-card-header">
          <div>
            <h4 className="v2-card-title">{title}</h4>
            <p className="v2-card-subtitle">{description}</p>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="v2-empty-text">源数据暂无匹配特征分布</p>
        ) : (
          <div className="v2-dist-list">
            {items.map((item) => {
              const pct = maxCount > 0 && item.count > 0 ? Math.round((item.count / maxCount) * 100) : 0;
              const isSelected =
                activeEvidenceFilter?.category === category &&
                activeEvidenceFilter?.label === item.label;

              const toggleFilter = () => {
                if (isSelected) {
                  setActiveEvidenceFilter(null);
                } else {
                  setActiveEvidenceFilter({
                    category,
                    label: item.label,
                    evidenceIds: item.evidenceIds || [],
                  });
                  setPage(0);
                }
              };

              return (
                <div
                  key={item.label}
                  className={`v2-dist-item ${isSelected ? 'selected' : ''}`}
                  onClick={toggleFilter}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleFilter();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title={`点击筛选关联证据笔记（共 ${item.evidenceIds?.length || 0} 篇支撑样本）`}
                >
                  <div className="v2-dist-item-head">
                    <span className="v2-dist-label">{item.label}</span>
                    <span className="v2-dist-count">
                      {item.count} 篇
                      {item.meanInteractions !== null && item.meanInteractions !== undefined && (
                        <small> (均互动 {Math.round(item.meanInteractions)})</small>
                      )}
                    </span>
                  </div>
                  <div className="v2-dist-track">
                    <div
                      className="v2-dist-bar"
                      style={{ width: `${item.count > 0 && pct > 0 ? Math.max(3, pct) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="v2-tab-content">
      {/* Aggregated Distributions Grid */}
      <section className="v2-section" aria-label="内容特征聚合分布">
        <div className="v2-grid-2">
          {renderDistributionCard(
            '主要讨论场景分布',
            'scene',
            content.scenes,
            '依据行业规则库匹配的核心使用场景（多切角规则可重合，非唯一分类）'
          )}
          {renderDistributionCard(
            '核心卖点与功效诉求',
            'sellingPoint',
            content.sellingPoints,
            '依据行业规则库匹配的产品卖点与功效诉求（多卖点规则可重合，非唯一分类）'
          )}
          {renderDistributionCard(
            '笔记内容展现形式',
            'format',
            content.formats,
            '样本图文与视频形式分布及互动表现对比'
          )}
          {renderDistributionCard(
            '高频标题模式与文风',
            'titlePattern',
            content.titlePatterns,
            '基于标题语法与文风特征规则识别的高频标题模式'
          )}
        </div>
      </section>

      {/* Notes Table */}
      <section className="v2-section" aria-label="内容笔记明细">
        <div className="v2-card">
          <div className="v2-card-header">
            <div>
              <h3 className="v2-card-title">
                {activeEvidenceFilter
                  ? `关联证据笔记明细 「${cleanQueryLabel(activeEvidenceFilter.label)}」(${displayedNotes.length} 篇)`
                  : `高热度样本笔记明细 (共 ${displayedNotes.length} 条)`}
              </h3>
              <p className="v2-card-subtitle">
                点击标题在新标签页查看原文
              </p>
            </div>
            {activeEvidenceFilter && (
              <button
                type="button"
                className="v2-btn v2-btn-sm"
                onClick={() => {
                  setActiveEvidenceFilter(null);
                  setPage(0);
                }}
              >
                清除特征筛选
              </button>
            )}
          </div>

          {displayedNotes.length === 0 ? (
            <EmptyStateBox
              title="未匹配到证据笔记"
              message={
                activeEvidenceFilter
                  ? `特征「${activeEvidenceFilter.label}」在当前 500 条展示样本中无关联笔记明细。`
                  : '暂无可展示的笔记明细。'
              }
              action={
                activeEvidenceFilter ? (
                  <button
                    type="button"
                    className="v2-btn v2-btn-sm v2-btn-secondary"
                    onClick={() => {
                      setActiveEvidenceFilter(null);
                      setPage(0);
                    }}
                  >
                    返回全部笔记
                  </button>
                ) : null
              }
            />
          ) : (
            <>
              <div className="v2-table-wrapper">
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 260 }}>笔记标题 / 来源</th>
                      <th>品牌归因</th>
                      <th>创作者</th>
                      <th>形式</th>
                      <th style={{ textAlign: 'right' }}>有效互动量</th>
                      <th style={{ textAlign: 'right' }}>曝光量</th>
                      <th>商业属性</th>
                      <th>发布日期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedNotes.map((note) => (
                      <tr key={note.noteId}>
                        <td>
                          <SafeExternalLink
                            href={note.url}
                            className="v2-link-title"
                            title={`在新标签打开：${note.title}`}
                          >
                            {note.title || '（无标题笔记）'} ↗
                          </SafeExternalLink>
                        </td>
                        <td>
                          <span className="v2-brand-badge">{note.brand || '未归因'}</span>
                        </td>
                        <td>
                          <span className="v2-creator-name" title={note.creatorName || ''}>
                            {note.creatorName || '匿名/未知'}
                          </span>
                        </td>
                        <td>
                          <span className="v2-format-tag">
                            {note.format === 'video'
                              ? '🎬 视频'
                              : note.format === 'image'
                              ? '🖼️ 图文'
                              : '未知'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }} className="v2-num">
                          <span className="v2-num">{formatMetricNumber(note.interactions)}</span>
                        </td>
                        <td style={{ textAlign: 'right' }} className="v2-num">
                          {formatMetricNumber(note.impressions)}
                        </td>
                        <td>
                          <div className="v2-nature-tags">
                            {note.commercial === true && (
                              <span className="v2-tag-comm">商单</span>
                            )}
                            {note.commercial === false && (
                              <span className="v2-tag-nat">自然</span>
                            )}
                            {note.promoted === true && (
                              <span className="v2-tag-promo">投流</span>
                            )}
                          </div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: '#60646c', fontSize: 14 }}>
                          {note.publishedDate || (note.publishedAt ? note.publishedAt.slice(0, 10) : '-')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationBar
                total={displayedNotes.length}
                page={currentPage}
                pageSize={pageSize}
                onPageChange={(p) => setPage(p)}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(0);
                }}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
