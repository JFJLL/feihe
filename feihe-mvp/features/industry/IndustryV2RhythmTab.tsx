'use client';

import React, { useState, useMemo } from 'react';
import type { IndustryV2Report } from '../../lib/industry-v2-types';
import {
  formatMetricNumber,
  formatMetricPercent,
  PaginationBar,
  SafeExternalLink,
  EmptyStateBox,
  KpiCard,
} from './IndustryV2Widgets';

export function IndustryV2RhythmTab({
  report,
}: {
  report: IndustryV2Report;
}) {
  const { traffic, notes } = report;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);

  const maxWeekdayCount = Math.max(1, ...(traffic.weekday || []).map((w) => w.count || 0));

  // Sort notes by publishedDate desc for rhythm view
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      const dateA = a.publishedDate || a.publishedAt || '';
      const dateB = b.publishedDate || b.publishedAt || '';
      return dateB.localeCompare(dateA);
    });
  }, [notes]);

  const totalPages = Math.max(1, Math.ceil(sortedNotes.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedNotes = sortedNotes.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  return (
    <div className="v2-tab-content">
      {/* Conversion & Traffic Rates (Only conversion rates, no duplicate text cards) */}
      <section className="v2-section" aria-label="投放互动与转化效率">
        <div className="v2-grid-2">
          <KpiCard
            label="样本预估阅读率"
            value={formatMetricPercent(traffic.readingRate)}
            denominator={`成对有效样本: ${traffic.readingRate.known}/${traffic.readingRate.total} 篇`}
            subtext="阅读量与曝光量两者皆有的成对样本计算 (reads / impressions)"
          />
          <KpiCard
            label="样本预估互动率"
            value={formatMetricPercent(traffic.interactionRate)}
            denominator={`成对有效样本: ${traffic.interactionRate.known}/${traffic.interactionRate.total} 篇`}
            subtext="互动量与阅读量两者皆有的成对样本计算 (interactions / reads)"
          />
        </div>
      </section>

      {/* Aggregated Weekday Rhythm and Traffic breakdown */}
      <section className="v2-section" aria-label="发文周期与流量结构">
        <div className="v2-grid-2">
          {/* Weekday Distribution Chart */}
          <div className="v2-card">
            <div className="v2-card-header">
              <div>
                <h4 className="v2-card-title">星期发文分布 (投放发布节奏)</h4>
                <p className="v2-card-subtitle">
                  样本发布时间的周几聚集规律与互动表现。
                </p>
              </div>
            </div>

            {!traffic.weekday || traffic.weekday.length === 0 ? (
              <p className="v2-empty-text">源数据缺少星期分布记录</p>
            ) : (
              <div className="v2-dist-list">
                {traffic.weekday.map((item) => {
                  const pct = maxWeekdayCount > 0 && item.count > 0 ? Math.round((item.count / maxWeekdayCount) * 100) : 0;
                  return (
                    <div key={item.label} className="v2-dist-item static">
                      <div className="v2-dist-item-head">
                        <span className="v2-dist-label">{item.label}</span>
                        <span className="v2-dist-count">
                          {item.count} 篇
                          {item.meanInteractions !== null && item.meanInteractions !== undefined && (
                            <small> · 篇均互动 {Math.round(item.meanInteractions)}</small>
                          )}
                        </span>
                      </div>
                      <div className="v2-dist-track">
                        <div
                          className="v2-dist-bar v2-bg-teal"
                          style={{ width: `${item.count > 0 && pct > 0 ? Math.max(3, pct) : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Commercial & Promoted Breakdown */}
          <div className="v2-card">
            <div className="v2-card-header">
              <div>
                <h4 className="v2-card-title">流量属性与商业特征分布</h4>
                <p className="v2-card-subtitle">
                  商业合作单与商业投流渗透情况。
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h5 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#475569' }}>
                  商业笔记 vs 自然笔记
                </h5>
                <div className="v2-dist-list">
                  {traffic.commercialVsNatural.map((item) => {
                    const maxComm = Math.max(1, ...traffic.commercialVsNatural.map((x) => x.count));
                    const commPct = maxComm > 0 && item.count > 0 ? Math.round((item.count / maxComm) * 100) : 0;
                    return (
                      <div key={item.label} className="v2-dist-item static">
                        <div className="v2-dist-item-head">
                          <span className="v2-dist-label">{item.label}</span>
                          <span className="v2-dist-count">
                            {item.count} 篇
                            {item.interactions !== null && item.interactions !== undefined && (
                              <small> · 总互动 {formatMetricNumber(item.interactions)}</small>
                            )}
                          </span>
                        </div>
                        <div className="v2-dist-track">
                          <div
                            className="v2-dist-bar v2-bg-amber"
                            style={{ width: `${item.count > 0 && commPct > 0 ? Math.max(3, commPct) : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h5 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#475569' }}>
                  投流笔记 vs 自然流
                </h5>
                <div className="v2-dist-list">
                  {traffic.promotedVsOrganic.map((item) => {
                    const maxPromo = Math.max(1, ...traffic.promotedVsOrganic.map((x) => x.count));
                    const promoPct = maxPromo > 0 && item.count > 0 ? Math.round((item.count / maxPromo) * 100) : 0;
                    return (
                      <div key={item.label} className="v2-dist-item static">
                        <div className="v2-dist-item-head">
                          <span className="v2-dist-label">{item.label}</span>
                          <span className="v2-dist-count">
                            {item.count} 篇
                            {item.interactions !== null && item.interactions !== undefined && (
                              <small> · 总互动 {formatMetricNumber(item.interactions)}</small>
                            )}
                          </span>
                        </div>
                        <div className="v2-dist-track">
                          <div
                            className="v2-dist-bar v2-bg-teal"
                            style={{ width: `${item.count > 0 && promoPct > 0 ? Math.max(3, promoPct) : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rhythm Notes Table */}
      <section className="v2-section" aria-label="时序发布笔记列表">
        <div className="v2-card">
          <div className="v2-card-header">
            <div>
              <h3 className="v2-card-title">样本发文时间序列表 (共 {sortedNotes.length} 篇)</h3>
              <p className="v2-card-subtitle">
                按发布时间倒序排列，支持点击标题安全访问笔记原文。
              </p>
            </div>
          </div>

          {sortedNotes.length === 0 ? (
            <EmptyStateBox message="暂无发文笔记数据。" />
          ) : (
            <>
              <div className="v2-table-wrapper">
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 260 }}>笔记标题</th>
                      <th>品牌</th>
                      <th>创作者</th>
                      <th style={{ textAlign: 'right' }}>互动量</th>
                      <th style={{ textAlign: 'right' }}>曝光量</th>
                      <th>商业/投流属性</th>
                      <th>发布时间</th>
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
                          <span className="v2-creator-name">{note.creatorName || '匿名/未知'}</span>
                        </td>
                        <td style={{ textAlign: 'right' }} className="v2-num">
                          {formatMetricNumber(note.interactions)}
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
                        <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.8rem' }}>
                          {note.publishedDate || (note.publishedAt ? note.publishedAt.slice(0, 10) : '-')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationBar
                total={sortedNotes.length}
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
