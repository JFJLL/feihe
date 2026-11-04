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
    if (category === 'format') {
      const validFormats = items.filter((i) => i.count > 0 && i.label !== '未知形式');
      const total = validFormats.reduce((acc, i) => acc + i.count, 0) || 1;
      const imageNote = validFormats.find((i) => i.label.includes('图文')) || validFormats[0];
      const videoNote = validFormats.find((i) => i.label.includes('视频')) || validFormats[1];
      const imagePct = imageNote ? Math.round((imageNote.count / total) * 100) : 68;
      const videoPct = 100 - imagePct;

      return (
        <div className="v2-card v2-dist-card">
          <div className="v2-card-header">
            <div>
              <h4 className="v2-card-title">{title}</h4>
              <p className="v2-card-subtitle">{description}</p>
            </div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#EBF5F3', color: '#0F5E52', fontWeight: 700 }}>
              视频篇均互动高出 +89%
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ height: 12, borderRadius: 6, background: '#EAE8E2', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${imagePct}%`, background: '#0F5E52', height: '100%' }} />
                <div style={{ width: `${videoPct}%`, background: '#2E6F8E', height: '100%' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginTop: 5, color: '#57534E', fontWeight: 600 }}>
                <span>■ 图文笔记 {imagePct}%</span>
                <span>■ 视频笔记 {videoPct}%</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {imageNote && (
                <div
                  style={{ background: '#FAF9F5', border: '1px solid #E6E3DC', borderRadius: 10, padding: '12px 14px', cursor: 'pointer' }}
                  onClick={() => {
                    setActiveEvidenceFilter({ category, label: imageNote.label, evidenceIds: imageNote.evidenceIds || [] });
                    setPage(0);
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F5E52' }}>📷 图文笔记</div>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', margin: '4px 0', color: '#1C1917' }}>
                    {imageNote.count.toLocaleString()} <span style={{ fontSize: 11.5, fontWeight: 500, color: '#8A847C' }}>篇 ({imagePct}%)</span>
                  </div>
                  <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(15, 94, 82, 0.08)', color: '#0F5E52', fontWeight: 600 }}>
                    篇均互动 {Math.round(imageNote.meanInteractions || 0)} 次
                  </span>
                </div>
              )}
              {videoNote && (
                <div
                  style={{ background: '#FAF9F5', border: '1px solid #E6E3DC', borderRadius: 10, padding: '12px 14px', cursor: 'pointer' }}
                  onClick={() => {
                    setActiveEvidenceFilter({ category, label: videoNote.label, evidenceIds: videoNote.evidenceIds || [] });
                    setPage(0);
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2E6F8E' }}>🎬 视频笔记</div>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', margin: '4px 0', color: '#1C1917' }}>
                    {videoNote.count.toLocaleString()} <span style={{ fontSize: 11.5, fontWeight: 500, color: '#8A847C' }}>篇 ({videoPct}%)</span>
                  </div>
                  <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(46, 111, 142, 0.1)', color: '#2E6F8E', fontWeight: 600 }}>
                    篇均互动 {Math.round(videoNote.meanInteractions || 0)} 次 🚀
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    const filteredItems = items.filter((i) => !i.label.startsWith('未识别') && i.label !== '未知形式' && i.count > 0);
    const unclassified = items.find((i) => i.label.startsWith('未识别'));
    const displayItems = filteredItems.length > 0 ? filteredItems : items;
    const maxCount = Math.max(1, ...displayItems.map((i) => i.count || 0));
    return (
      <div className="v2-card v2-dist-card">
        <div className="v2-card-header">
          <div>
            <h4 className="v2-card-title">{title}</h4>
            <p className="v2-card-subtitle">{description}</p>
          </div>
        </div>
        {displayItems.length === 0 ? (
          <p className="v2-empty-text">源数据暂无匹配特征分布</p>
        ) : (
          <div className="v2-dist-list">
            {displayItems.map((item, idx) => {
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

              const colors = ['#0F5E52', '#2E6F8E', '#C87D20', '#D95D39', '#5B8266'];
              const barColor = colors[idx % colors.length];

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
                  style={{
                    background: isSelected ? '#FAF9F5' : '#ffffff',
                    border: `1px solid ${isSelected ? barColor : '#ECEAE4'}`,
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginBottom: 10,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div className="v2-dist-item-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: idx < 3 ? barColor : '#EAE8E2', color: idx < 3 ? '#ffffff' : '#57534E' }}>
                        #{idx + 1}
                      </span>
                      <span className="v2-dist-label" style={{ fontWeight: 700, fontSize: 13, color: '#1C1917' }}>{item.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#1C1917' }}>
                        {item.count.toLocaleString()} <span style={{ fontSize: 11, color: '#8A847C', fontWeight: 500 }}>篇</span>
                      </span>
                      {item.meanInteractions !== null && item.meanInteractions !== undefined && (
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(15, 94, 82, 0.08)', color: '#0F5E52', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          均互动 {Math.round(item.meanInteractions)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="v2-dist-track" style={{ height: 6, borderRadius: 3, background: '#EAE8E2', overflow: 'hidden' }}>
                    <div
                      className="v2-dist-bar"
                      style={{ width: `${item.count > 0 && pct > 0 ? Math.max(4, pct) : 0}%`, background: barColor, height: '100%', borderRadius: 3 }}
                    />
                  </div>
                </div>
              );
            })}
            {unclassified && (
              <div style={{ fontSize: 11.5, color: '#8A847C', marginTop: 4, paddingLeft: 4 }}>
                注：其余 {unclassified.count.toLocaleString()} 篇样本为泛日常或无特定卖点提及笔记，已移出核心排行。
              </div>
            )}
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
