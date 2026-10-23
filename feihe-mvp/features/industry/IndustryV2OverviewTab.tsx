'use client';

import React from 'react';
import type { IndustryV2Report } from '../../lib/industry-v2-types';
import {
  formatMetricNumber,
  formatMetricPercent,
  KpiCard,
  QueryPillBadge,
  EmptyStateBox,
} from './IndustryV2Widgets';

export function IndustryV2OverviewTab({
  report,
  onSelectQuery,
}: {
  report: IndustryV2Report;
  onSelectQuery?: (queryId: string) => void;
}) {
  const { summary, comparison, trend, limitations } = report;

  const maxComparisonNotes = Math.max(1, ...comparison.map((c) => c.notes || 0));
  const validTrend = trend && trend.length > 0;
  const maxTrendNotes = validTrend
    ? Math.max(1, ...trend.map((t) => t.notes || 0))
    : 1;

  return (
    <div className="v2-tab-content">
      {/* Data source statement */}
      <div className="v2-source-banner">
        <span>📌 <strong>数据来源：</strong>小红书蒲公英笔记检索样本（受关键词及单日调用上限约束，各查询词独立采样，非全网无界爬虫）</span>
      </div>

      {/* 6 Key Performance Indicators */}
      <section className="v2-section" aria-label="核心指标总览">
        <div className="v2-kpi-grid">
          <KpiCard
            label="样本笔记总量"
            value={formatMetricNumber(summary.notes)}
            unit="篇"
            badge={
              summary.noteChange !== null && summary.noteChange !== undefined ? (
                <span
                  className={`v2-kpi-diff ${
                    summary.noteChange >= 0 ? 'v2-diff-up' : 'v2-diff-down'
                  }`}
                >
                  {summary.noteChange >= 0 ? `+${summary.noteChange}` : summary.noteChange}
                </span>
              ) : null
            }
            subtext={summary.changeReason || '统计周期内样本去重总数'}
          />

          <KpiCard
            label="覆盖创作博主"
            value={formatMetricNumber(summary.creators)}
            unit="位"
            subtext="去重发文创作者样本总数"
          />

          <KpiCard
            label="有效曝光量合计"
            value={formatMetricNumber(summary.impressions.value)}
            denominator={`覆盖 ${summary.impressions.known}/${summary.impressions.total} 篇`}
            subtext="仅对源数据已返回曝光量累计"
          />

          <KpiCard
            label="有效阅读量合计"
            value={formatMetricNumber(summary.reads.value)}
            denominator={`覆盖 ${summary.reads.known}/${summary.reads.total} 篇`}
            subtext="仅对源数据已返回阅读量累计"
          />

          <KpiCard
            label="有效互动量合计"
            value={formatMetricNumber(summary.interactions.value)}
            denominator={`覆盖 ${summary.interactions.known}/${summary.interactions.total} 篇`}
            subtext="平台返回互动总量（engageNum，缺项不补0）"
          />

          <KpiCard
            label="商业化标注率"
            value={formatMetricPercent(summary.commercialRate)}
            denominator={`已标 ${summary.commercialRate.known}/${summary.commercialRate.total} 篇`}
            subtext={`投流率: ${formatMetricPercent(summary.promotedRate)}（已标 ${summary.promotedRate.known}/${summary.promotedRate.total}）`}
          />
        </div>
      </section>

      {/* Independent Query Comparison (Unified single view, no duplicate cards+table) */}
      <section className="v2-section" aria-label="查询词独立对比">
        <div className="v2-card">
          <div className="v2-card-header">
            <div>
              <h3 className="v2-card-title">品类 · 本品 · 竞品独立查询采样对比</h3>
              <p className="v2-card-subtitle">
                ⚠️ 各查询词为独立采样，不可直接相加或折算为全网市场份额 / 真实大盘总额。
              </p>
            </div>
          </div>

          {comparison.length === 0 ? (
            <EmptyStateBox message="暂未配置查询词或尚无采样数据。" />
          ) : (
            <div className="v2-table-wrapper">
              <table className="v2-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 190 }}>查询词 / 标签</th>
                    <th style={{ minWidth: 170 }}>样本笔记数与相对分布</th>
                    <th style={{ textAlign: 'right' }}>覆盖博主数</th>
                    <th style={{ textAlign: 'right' }}>有效互动量</th>
                    <th style={{ textAlign: 'right' }}>有效曝光量</th>
                    <th style={{ textAlign: 'right' }}>商业化率</th>
                    <th style={{ textAlign: 'right' }}>投流率</th>
                    <th style={{ textAlign: 'center' }}>完整 / 计划天数</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((item) => {
                    const pct = maxComparisonNotes > 0 && item.notes > 0 ? Math.round((item.notes / maxComparisonNotes) * 100) : 0;
                    const isPartialDays = item.completeDays < item.expectedDays;
                    return (
                      <tr
                        key={item.query.id}
                        onClick={() => onSelectQuery?.(item.query.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectQuery?.(item.query.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        title={`点击筛选此查询词：${item.query.label}`}
                      >
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <QueryPillBadge kind={item.query.kind} label={item.query.label} />
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="v2-num" style={{ minWidth: 44, fontWeight: 600 }}>
                              {formatMetricNumber(item.notes)}
                            </span>
                            <div className="v2-comp-track" style={{ flex: 1, minWidth: 60, height: 10 }}>
                              <div
                                className={`v2-comp-fill v2-fill-${item.query.kind}`}
                                style={{ width: `${item.notes > 0 && pct > 0 ? Math.max(4, pct) : 0}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }} className="v2-num">
                          {formatMetricNumber(item.creators)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="v2-num">{formatMetricNumber(item.interactions.value)}</span>
                          <span className="v2-denom"> ({item.interactions.known}/{item.interactions.total})</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="v2-num">{formatMetricNumber(item.impressions.value)}</span>
                          <span className="v2-denom"> ({item.impressions.known}/{item.impressions.total})</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                            <span className="v2-num">{formatMetricPercent(item.commercialRate)}</span>
                            {item.commercialRate?.value !== null && item.commercialRate?.value !== undefined && item.commercialRate.value > 0 ? (
                              <div className="v2-rate-track">
                                <div
                                  className="v2-rate-fill v2-rate-comm"
                                  style={{ width: `${Math.min(100, Math.max(0, item.commercialRate.value * 100))}%` }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                            <span className="v2-num">{formatMetricPercent(item.promotedRate)}</span>
                            {item.promotedRate?.value !== null && item.promotedRate?.value !== undefined && item.promotedRate.value > 0 ? (
                              <div className="v2-rate-track">
                                <div
                                  className="v2-rate-fill v2-rate-promo"
                                  style={{ width: `${Math.min(100, Math.max(0, item.promotedRate.value * 100))}%` }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`v2-badge ${
                              isPartialDays ? 'v2-badge-partial' : 'v2-badge-complete'
                            }`}
                            title={
                              isPartialDays
                                ? `部分覆盖：已采完 ${item.completeDays}/${item.expectedDays} 天（可能因单日3页限制截断、日期缺失或脏行导致，非全量覆盖）`
                                : `检索任务已完成 ${item.completeDays}/${item.expectedDays} 天，仍为关键词样本而非全网总量`
                            }
                          >
                            {item.completeDays}/{item.expectedDays} 天
                          </span>
                          {report.coverage.rows.some(row => row.queryId === item.query.id && row.status === 'partial') && (
                            <small className="v2-denom">部分 {report.coverage.rows.filter(row => row.queryId === item.query.id && row.status === 'partial').length} 天</small>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Publishing Trend */}
      <section className="v2-section" aria-label="样本发布趋势">
        <div className="v2-card">
          <div className="v2-card-header">
            <div>
              <h3 className="v2-card-title">样本发布时间分布与分日趋势</h3>
              <p className="v2-card-subtitle">
                反映当前所选样本的发布时间分布。严格区分「缺采样」与「发布量为0」。
              </p>
            </div>
            <div className="v2-trend-legend">
              <span className="v2-legend-item">
                <i className="v2-legend-color v2-bg-teal" /> 自然/商业笔记
              </span>
              <span className="v2-legend-item">
                <i className="v2-legend-color v2-bg-amber" /> 商业笔记
              </span>
              <span className="v2-legend-item">
                <i className="v2-legend-color v2-bg-missing" /> 缺采样 (待补采)
              </span>
            </div>
          </div>

          {!validTrend ? (
            <EmptyStateBox message="暂无分日发布趋势数据。" />
          ) : (
            <div className="v2-trend-container">
              <div className="v2-trend-chart" role="img" aria-label="发布趋势柱状图">
                {trend.map((point, index) => {
                  const isMissing = point.notes === null;
                  const notesCount = point.notes ?? 0;
                  // When notesCount === 0, heightPct is strictly 0!
                  const heightPct = isMissing
                    ? 20
                    : notesCount > 0
                    ? Math.max(4, Math.round((notesCount / maxTrendNotes) * 100))
                    : 0;

                  return (
                    <div
                      key={point.date}
                      className={`v2-trend-col ${isMissing ? 'v2-trend-col-missing' : ''}`}
                      title={`${point.date}: ${
                        isMissing
                          ? '未采样/缺样本数据'
                          : `${notesCount} 篇笔记 (商业: ${point.commercial ?? 0}, 投流: ${point.promoted ?? 0}, 互动: ${point.interactions ?? 0})`
                      }`}
                    >
                      <div className="v2-trend-col-bar-wrap">
                        <span className="v2-trend-col-val">
                          {isMissing ? '缺' : notesCount}
                        </span>
                        <div
                          className={`v2-trend-col-bar ${
                            isMissing ? 'v2-bar-missing' : 'v2-bar-normal'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        >
                          {!isMissing && point.commercial && point.commercial > 0 ? (
                            <div
                              className="v2-trend-col-bar-comm"
                              style={{
                                height: `${Math.min(
                                  100,
                                  Math.round((point.commercial / Math.max(1, notesCount)) * 100)
                                )}%`,
                              }}
                            />
                          ) : null}
                        </div>
                      </div>
                      <span className="v2-trend-col-date">
                        {index % Math.max(1, Math.ceil(trend.length / 8)) === 0 ||
                        index === trend.length - 1
                          ? point.date.slice(5)
                          : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Limitations / Disclaimers */}
      {limitations && limitations.length > 0 && (
        <section className="v2-section" aria-label="统计边界与免责声明">
          <div className="v2-limitations-box">
            <h4 className="v2-limitations-title">📌 统计边界与数据免责说明</h4>
            <ul className="v2-limitations-list">
              {limitations.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
