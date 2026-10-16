'use client';

import { useState, useRef, type KeyboardEvent } from 'react';
import type { DailyView } from '../../lib/business-daily/types';
import { DASHBOARD_PALETTE } from './BusinessVisuals';

const formatNum = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });

const compactSpend = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1) + 'w';
  return Math.round(n).toLocaleString('zh-CN');
};

export function SpendBars({
  view,
  selectedDay,
  onSelectDay,
}: {
  view: DailyView;
  selectedDay?: string;
  onSelectDay?: (day: string) => void;
}) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const barRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const activeDate = hoveredDate || focusedDate;
  const series = view.series || [];

  const observedSpends = series
    .map(p => p.adSpend.value)
    .filter((v): v is number => v !== null && v >= 0);

  const rawMax = Math.max(...observedSpends, 100000);
  const step = rawMax > 500000 ? 150000 : rawMax > 200000 ? 100000 : 50000;
  const scaleMax = Math.ceil((rawMax * 1.1) / step) * step;
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((scaleMax / tickCount) * i));

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number) => {
    let nextIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = Math.min(series.length - 1, index + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = Math.max(0, index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = series.length - 1;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onSelectDay) onSelectDay(series[index].date);
      return;
    }

    if (nextIndex >= 0 && nextIndex !== index) {
      const nextDate = series[nextIndex].date;
      setFocusedDate(nextDate);
      const el = barRefs.current.get(nextDate);
      el?.focus();
    }
  };

  return (
    <div className="spend-bars-container" role="region" aria-label="每日平台广告消耗（元）图表">
      <div className="spend-bars-header">
        <div className="spend-bars-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h4>每日平台广告消耗（元）</h4>
            <span className="spend-bars-unit-chip">单位：元</span>
          </div>
          <small>
            每日信息流 (F) + 搜索 (S) 实际消耗 · 截至 {view.businessThrough || '待采集'} · 缺失或未填报不计为0
          </small>
        </div>
        <div className="spend-bars-legend">
          <span className="spend-legend-item">
            <i className="spend-legend-dot observed" style={{ background: DASHBOARD_PALETTE.actual }} />
            <span>已观测消耗</span>
          </span>
          <span className="spend-legend-item">
            <i className="spend-legend-dot missing" style={{ background: DASHBOARD_PALETTE.plan }} />
            <span>未采集 / 缺失</span>
          </span>
        </div>
      </div>

      <div className="spend-chart-wrapper">
        {/* Y Axis */}
        <div className="spend-y-axis" aria-hidden="true">
          {ticks.slice().reverse().map(tick => (
            <span key={tick} className="spend-y-tick">
              {tick >= 10000 ? (tick / 10000) + 'w' : tick}
            </span>
          ))}
        </div>

        {/* Plot Area */}
        <div className="spend-plot-area">
          {/* Horizontal Grid lines */}
          {ticks.slice(1).map(tick => {
            const bottomPct = (tick / scaleMax) * 100;
            return (
              <div
                key={tick}
                className="spend-grid-line"
                style={{ bottom: bottomPct + '%' }}
                aria-hidden="true"
              />
            );
          })}

          {/* Bars */}
          <div className="spend-bars-track">
            {series.map((p, idx) => {
              const hasSpend = p.adSpend.value !== null && p.adSpend.value >= 0;
              const spendVal = p.adSpend.value;
              const barHeightPct = hasSpend && spendVal !== null ? Math.min(100, Math.max(4, (spendVal / scaleMax) * 100)) : 0;
              const isSelected = selectedDay === p.date;
              const isActive = activeDate === p.date;

              const label = p.date + ' 广告消耗：' + (hasSpend ? formatNum(spendVal) + '元' : '未采集/缺失') + (p.plan.value ? '，当日计划：' + formatNum(p.plan.value) + '元' : '');

              return (
                <div
                  key={p.date}
                  ref={el => {
                    if (el) barRefs.current.set(p.date, el);
                    else barRefs.current.delete(p.date);
                  }}
                  className={'spend-bar-column ' + (hasSpend ? 'is-observed' : 'is-missing') + (isSelected ? ' is-selected' : '') + (isActive ? ' is-active' : '')}
                  tabIndex={0}
                  role="button"
                  aria-label={label}
                  aria-pressed={isSelected}
                  onMouseEnter={() => setHoveredDate(p.date)}
                  onMouseLeave={() => setHoveredDate(null)}
                  onFocus={() => setFocusedDate(p.date)}
                  onBlur={() => setFocusedDate(null)}
                  onClick={() => onSelectDay?.(p.date)}
                  onKeyDown={e => handleKeyDown(e, idx)}
                >
                  {/* Floating tooltip anchored to active bar */}
                  {isActive && (
                    <div className="spend-tooltip" role="tooltip">
                      <div className="spend-tooltip-title">
                        <strong>{p.date}</strong>
                        {p.week ? <span className="spend-tooltip-week">{p.week}</span> : null}
                      </div>
                      <div className="spend-tooltip-body">
                        <div className="spend-tooltip-row primary">
                          <span>平台广告消耗：</span>
                          <strong>{hasSpend ? formatNum(spendVal) + ' 元' : (p.adSpend.state === 'not_collected' ? '未采集' : '缺失')}</strong>
                        </div>
                        <div className="spend-tooltip-sub">
                          <div className="spend-tooltip-row">
                            <span>信息流 (F)：</span>
                            <span>{p.feed.value !== null ? formatNum(p.feed.value) + ' 元' : '—'}</span>
                          </div>
                          <div className="spend-tooltip-row">
                            <span>搜索 (S)：</span>
                            <span>{p.search.value !== null ? formatNum(p.search.value) + ' 元' : '—'}</span>
                          </div>
                        </div>
                        {p.plan.value !== null && (
                          <div className="spend-tooltip-row plan">
                            <span>当日计划：</span>
                            <span>{formatNum(p.plan.value)} 元</span>
                            {hasSpend && spendVal !== null && (() => {
                              const ratio = (spendVal / p.plan.value) * 100;
                              const isOver = ratio > 100;
                              const diff = ratio - 100;
                              return (
                                <span className={'spend-tooltip-ratio ' + (isOver ? 'is-over' : 'is-normal')}>
                                  (预算消耗比 {ratio.toFixed(1)}%{isOver ? ` · 超计划 ${diff.toFixed(1)}%` : ''})
                                </span>
                              );
                            })()}
                          </div>
                        )}
                        <div className="spend-tooltip-state">
                          状态：{p.adSpend.state === 'observed' ? '已观测入账' : (p.adSpend.reason || '数据缺失/待同步')}
                        </div>
                      </div>
                      <div className="spend-tooltip-arrow" aria-hidden="true" />
                    </div>
                  )}

                  {/* Value above bar */}
                  <div className="spend-bar-val-badge">
                    {hasSpend ? compactSpend(spendVal) : <span className="spend-missing-chip">—</span>}
                  </div>

                  {/* The bar graphic */}
                  <div className="spend-bar-body-wrapper">
                    {hasSpend ? (
                      <div
                        className="spend-bar-body observed"
                        style={{ height: barHeightPct + '%', background: DASHBOARD_PALETTE.actual }}
                      />
                    ) : (
                      <div className="spend-bar-body missing" title="未采集或缺失，不作为0计算">
                        <span className="spend-missing-mark">无数据</span>
                      </div>
                    )}
                  </div>

                  {/* Date label at bottom */}
                  <span className="spend-bar-date-label">
                    {p.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="spend-bars-footer">
        <span>* 鼠标悬浮或使用键盘 Tab / 方向键聚焦任意日期查看真实消耗明细与预算消耗比；未采集日保留标记，不折算为0。</span>
      </div>
    </div>
  );
}
