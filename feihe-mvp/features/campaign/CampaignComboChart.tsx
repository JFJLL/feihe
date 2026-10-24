'use client';

import React, { useState, useRef, useEffect } from 'react';
import './campaign-combo.css';

/**
 * CampaignComboChart Visual System Palette
 * Aligns with CampaignCharts:
 *   Deep Teal: #2c7168 (Primary metric / actuals / volume)
 *   Purple: #8273a3 (Auxiliary metric / conversion / secondary)
 *   Amber Gold: #b88a45 (Cost / budget / investment)
 *   Terracotta: #bd7964 (Anomaly / over-spend / gap)
 *   Slate: #8c9ba5 (Baseline / grid line / reference)
 */
export const CAMPAIGN_PALETTE = {
  primary: '#008573',
  purple: '#5b5bd6',
  gold: '#ffc53d',
  terracotta: '#e5484d',
  slate: '#8b8d98',
  warmBg: '#f9f9fb',
  panelBg: '#ffffff',
  textMain: '#1c2024',
  textMuted: '#60646c',
  textSubtle: '#8b8d98',
  border: '#d9d9e0',
  borderWarm: '#d9d9e0',
  gridLine: '#f0f0f3',
} as const;

export const DEFAULT_SERIES_COLORS = [
  CAMPAIGN_PALETTE.primary,
  CAMPAIGN_PALETTE.purple,
  CAMPAIGN_PALETTE.gold,
  CAMPAIGN_PALETTE.terracotta,
  '#12a594',
  '#5753c6',
  CAMPAIGN_PALETTE.slate,
];

// ============================================================================
// Public Types Contract
// ============================================================================

export type ComboSeries = {
  key: string;
  label: string;
  unit: string;
  axis: 'left' | 'right';
  kind: 'bar' | 'line' | 'point';
  color?: string;
};

export type CampaignComboChartProps = {
  rows: Record<string, unknown>[];
  series: ComboSeries[];
  xKey?: string; // default: 'date'
  title: string;
  height?: number; // default: 280
  xLabel?: string;
};

// ============================================================================
// Helper Functions
// ============================================================================

export function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && !isNaN(val);
}

export function fmtComboNum(val: unknown, maxDigits = 2): string {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (!Number.isFinite(num) || isNaN(num)) return '—';
  return num.toLocaleString('zh-CN', { maximumFractionDigits: maxDigits });
}

export function fmtXAxisTick(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();

  // 1. ISO Date: YYYY-MM-DD or YYYY/MM/DD -> MM-DD
  const isoMatch = str.match(/^\d{4}[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const mm = isoMatch[1].padStart(2, '0');
    const dd = isoMatch[2].padStart(2, '0');
    return `${mm}-${dd}`;
  }

  // 2. Short Date: MM-DD or MM/DD -> MM-DD
  const shortMatch = str.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (shortMatch) {
    const mm = shortMatch[1].padStart(2, '0');
    const dd = shortMatch[2].padStart(2, '0');
    return `${mm}-${dd}`;
  }

  // 3. Category strings: truncate cleanly if too long, preserve full name on hover
  if (str.length > 8) {
    return `${str.slice(0, 7)}…`;
  }

  return str;
}

export function fmtAxisTick(val: number, step?: number): string {
  if (!Number.isFinite(val) || isNaN(val)) return '0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';

  // 1. Large values: 亿 and 万 (strip trailing .0)
  if (abs >= 100000000) {
    const eVal = abs / 100000000;
    const str = `${sign}${eVal >= 100 ? Math.round(eVal) : eVal.toFixed(1)}亿`;
    return str.replace(/\.0亿$/, '亿');
  }
  if (abs >= 10000) {
    const wVal = abs / 10000;
    const str = `${sign}${wVal >= 100 ? Math.round(wVal) : wVal.toFixed(1)}万`;
    return str.replace(/\.0万$/, '万');
  }

  // 2. Integer or near-integer values: remove redundant .0 (e.g. 714 instead of 714.0)
  if (Math.abs(val - Math.round(val)) < 0.0001) {
    return Math.round(val).toString();
  }

  // 3. Small / decimal values: calculate decimals from tick step
  let decimals = 0;
  if (step && Number.isFinite(step) && step > 0) {
    if (step < 0.001) decimals = 4;
    else if (step < 0.01) decimals = 3;
    else if (step < 0.1) decimals = 2;
    else if (step < 1) decimals = 1;
    else decimals = 0;
  } else {
    if (abs < 0.01 && abs > 0) decimals = 3;
    else if (abs < 0.1 && abs > 0) decimals = 2;
    else if (abs < 1 && abs > 0) decimals = 1;
  }

  if (decimals === 0) {
    return Math.round(val).toString();
  }

  const str = val.toFixed(decimals);
  return str.replace(/\.0+$/, '').replace(/(\.[1-9]+)0+$/, '$1');
}

interface AxisScale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
  isZeroBased: boolean;
}

function computeAxisScale(values: number[], hasBar: boolean): AxisScale {
  if (values.length === 0) {
    return {
      min: 0,
      max: 10,
      step: 2.5,
      ticks: [0, 2.5, 5, 7.5, 10],
      isZeroBased: true,
    };
  }

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    if (min === 0) {
      min = 0;
      max = 10;
    } else if (min > 0) {
      min = hasBar ? 0 : Math.max(0, min * 0.8);
      max = max * 1.25;
    } else {
      min = min * 1.25;
      max = 0;
    }
  } else {
    if (hasBar) {
      if (min > 0) min = 0;
      if (max < 0) max = 0;
    } else {
      if (min >= 0) min = 0;
    }

    const span = max - min || 1;
    max = max + span * 0.08;
    if (min < 0) {
      min = min - span * 0.08;
    }
  }

  const step = (max - min) / 4 || 1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => min + r * (max - min));

  return {
    min,
    max,
    step,
    ticks,
    isZeroBased: min <= 0 && max >= 0,
  };
}

type Point = { x: number; y: number; val: number; rowIndex: number };

function buildPath(points: Point[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function getLineSegments(pts: (Point | null)[]): Point[][] {
  const segments: Point[][] = [];
  let cur: Point[] = [];
  for (const pt of pts) {
    if (pt) {
      cur.push(pt);
    } else if (cur.length) {
      segments.push(cur);
      cur = [];
    }
  }
  if (cur.length) segments.push(cur);
  return segments;
}

// ============================================================================
// Main Component: CampaignComboChart
// ============================================================================

export function CampaignComboChart({
  rows,
  series,
  xKey = 'date',
  title,
  height = 280,
  xLabel,
}: CampaignComboChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(640);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => new Set());

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (series.length - next.size > 1) {
        next.add(key);
      }
      return next;
    });
  };

  // Measure actual container width via ResizeObserver so SVG text is 1:1 crisp
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setContainerWidth(Math.round(w));
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) setContainerWidth(Math.round(w));
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  const validRows = Array.isArray(rows)
    ? rows.filter((r) => r && r[xKey] !== undefined && r[xKey] !== null)
    : [];

  const styledSeries = (series || []).map((s, idx) => ({
    ...s,
    color: s.color || DEFAULT_SERIES_COLORS[idx % DEFAULT_SERIES_COLORS.length],
  }));

  // Check all numeric values across all series
  const allNumericValues = validRows
    .flatMap((r) => styledSeries.map((s) => r[s.key]))
    .filter(isFiniteNumber);

  // Empty state handling: when rows empty, series empty, or all values are null
  if (validRows.length === 0 || styledSeries.length === 0 || allNumericValues.length === 0) {
    return (
      <div className="ca-combo-wrap" ref={containerRef} data-testid="campaign-combo-chart">
        <div className="ca-combo-empty">
          <div className="ca-combo-empty-title">暂无可绘制的多指标组合数据</div>
          <div className="ca-combo-empty-hint">全部指标记录均为缺失或空值，录入真实业务数据后将自动呈现</div>
        </div>
      </div>
    );
  }

  const leftSeries = styledSeries.filter((s) => s.axis === 'left');
  const rightSeries = styledSeries.filter((s) => s.axis === 'right');

  const leftUnit = leftSeries[0]?.unit || '';
  const rightUnit = rightSeries[0]?.unit || '';
  const hasRightAxis = rightSeries.length > 0;

  const hasLeftBar = leftSeries.some((s) => s.kind === 'bar');
  const hasRightBar = rightSeries.some((s) => s.kind === 'bar');

  const leftValues = validRows
    .flatMap((r) => leftSeries.map((s) => r[s.key]))
    .filter(isFiniteNumber);

  const rightValues = validRows
    .flatMap((r) => rightSeries.map((s) => r[s.key]))
    .filter(isFiniteNumber);

  const leftScale = computeAxisScale(leftValues, hasLeftBar);
  const rightScale = hasRightAxis
    ? computeAxisScale(rightValues, hasRightBar)
    : leftScale;

  // Geometry: 1:1 coordinate space matching containerWidth
  const totalWidth = Math.max(280, containerWidth);
  const totalHeight = Math.max(200, height);
  const leftPad = 56;
  const rightPad = hasRightAxis ? 56 : 18;
  const topPad = 26;
  const bottomPad = 36;
  const plotWidth = Math.max(10, totalWidth - leftPad - rightPad);
  const plotHeight = Math.max(10, totalHeight - topPad - bottomPad);

  const getY = (axis: 'left' | 'right', val: number) => {
    const scale = axis === 'right' ? rightScale : leftScale;
    const span = scale.max - scale.min;
    if (span === 0) return topPad + plotHeight / 2;
    const ratio = (val - scale.min) / span;
    return topPad + plotHeight - ratio * plotHeight;
  };

  const rowCount = validRows.length;
  const bandWidth = rowCount === 1 ? Math.min(plotWidth * 0.45, 120) : plotWidth / rowCount;

  const getCenterX = (i: number) => {
    if (rowCount === 1) return leftPad + plotWidth / 2;
    return leftPad + (i + 0.5) * bandWidth;
  };

  const getBandLeft = (i: number) => {
    if (rowCount === 1) return leftPad + plotWidth / 2 - bandWidth / 2;
    return leftPad + i * bandWidth;
  };

  // Grouped bars: strictly bounded by bandWidth to prevent cross-band overlapping
  const barSeriesList = styledSeries.filter((s) => s.kind === 'bar' && !hiddenSeries.has(s.key));
  const barCount = barSeriesList.length;
  const maxClusterW = Math.min(bandWidth * 0.82, 64);
  const barGap = barCount > 1 ? Math.min(1.5, (maxClusterW * 0.1) / (barCount - 1)) : 0;
  const singleBarW = barCount > 0
    ? Math.max(0.5, (maxClusterW - (barCount - 1) * barGap) / barCount)
    : 0;
  const clusterW = barCount * singleBarW + Math.max(0, barCount - 1) * barGap;

  // Active index: defaults to latest row; stable layout without jump
  const activeIndex = hoverIndex !== null
    ? hoverIndex
    : selectedIndex !== null
    ? selectedIndex
    : validRows.length - 1;

  const activeRow = validRows[activeIndex] || validRows[validRows.length - 1];

  // Check if dates to optimize label spacing and prevent overlap
  const isDateLike = validRows.some((r) => {
    const v = String(r[xKey] || '');
    return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(v) || /^\d{1,2}[-/]\d{1,2}$/.test(v);
  });

  const tickSpacingRequired = isDateLike ? 46 : 64;
  const maxPossibleTicks = Math.max(2, Math.floor(plotWidth / tickSpacingRequired));

  // Determine which ticks are visible, guaranteeing no collision on end ticks
  const visibleTickIndices = (() => {
    const set = new Set<number>();
    if (rowCount <= 0) return set;
    set.add(0);
    if (rowCount === 1) return set;
    set.add(rowCount - 1);

    if (rowCount <= maxPossibleTicks) {
      for (let i = 0; i < rowCount; i++) set.add(i);
      return set;
    }

    const stepSize = Math.max(2, Math.ceil((rowCount - 1) / (maxPossibleTicks - 1)));
    const minEndGap = stepSize;

    for (let i = stepSize; i < rowCount - 1; i += stepSize) {
      if ((rowCount - 1 - i) >= minEndGap) {
        set.add(i);
      }
    }
    return set;
  })();

  return (
    <div className="ca-combo-wrap" ref={containerRef} data-testid="campaign-combo-chart">
      {/* Readout: Always renders same series column layout for current/latest date */}
      <div className="ca-combo-readout" data-testid="combo-readout" aria-live="polite">
        <div className="ca-combo-readout-main">
          <span className="ca-combo-readout-date">{String(activeRow[xKey])}</span>
          {styledSeries.map((s) => {
            const val = activeRow[s.key];
            const isNum = isFiniteNumber(val);
            const isMuted = hiddenSeries.has(s.key);
            return (
              <span key={s.key} className="ca-combo-readout-item">
                <span
                  className="ca-combo-swatch-bar"
                  style={{ background: s.color, width: 8, height: 8 }}
                />
                <span className="ca-combo-readout-label">{s.label}:</span>
                {isNum ? (
                  <span className="ca-combo-readout-val">
                    {fmtComboNum(val)} <span className="ca-combo-readout-unit">{s.unit}</span>
                  </span>
                ) : (
                  <span className="ca-combo-readout-null">未录入</span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* SVG Canvas (viewBox matches containerWidth for 1:1 crisp text) */}
      <div className="ca-combo-svg-wrap">
        <svg
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="ca-combo-svg"
          role="graphics-document"
          data-chart-role="combo-chart"
          aria-label={title}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <title>{title}</title>
          <desc>
            {`多指标组合图，共 ${rowCount} 项数据${xLabel ? `，横轴：${xLabel}` : ""}。左轴[${leftUnit || "数值"}]，${hasRightAxis ? `右轴[${rightUnit || "数值"}]` : "无右轴"}。`}
          </desc>
          <defs>
            {styledSeries.map((s) => (
              <linearGradient key={`grad-${s.key}`} id={`cc-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="1" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.85" />
              </linearGradient>
            ))}
          </defs>

          {/* Horizontal Gridlines */}
          {leftScale.ticks.map((tickVal, idx) => {
            const y = getY('left', tickVal);
            return (
              <g key={`grid-${idx}`}>
                <line
                  x1={leftPad}
                  x2={totalWidth - rightPad}
                  y1={y}
                  y2={y}
                  stroke={CAMPAIGN_PALETTE.gridLine}
                  strokeDasharray="3 3"
                />
              </g>
            );
          })}

          {/* Baseline Zero Line */}
          {leftScale.isZeroBased && (
            <line
              x1={leftPad}
              x2={totalWidth - rightPad}
              y1={getY('left', 0)}
              y2={getY('left', 0)}
              stroke="#cdced6"
              strokeWidth="1.2"
            />
          )}

          {/* Left Y-Axis Label and Ticks */}
          <g data-axis="left">
            <text
              x={leftPad}
              y={topPad - 10}
              textAnchor="start"
              fill={CAMPAIGN_PALETTE.textMuted}
              fontSize="12"
              fontWeight="600"
            >
              {leftUnit ? `${leftUnit} (左轴)` : '左轴'}
            </text>
            {leftScale.ticks.map((tickVal, idx) => {
              const y = getY('left', tickVal);
              return (
                <text
                  key={`left-tick-${idx}`}
                  x={leftPad - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill={CAMPAIGN_PALETTE.textMuted}
                  fontSize="12"
                  data-axis-tick="left"
                >
                  {fmtAxisTick(tickVal, leftScale.step)}
                </text>
              );
            })}
          </g>

          {/* Right Y-Axis Label and Ticks */}
          {hasRightAxis && (
            <g data-axis="right">
              <text
                x={totalWidth - rightPad}
                y={topPad - 10}
                textAnchor="end"
                fill={CAMPAIGN_PALETTE.textMuted}
                fontSize="12"
                fontWeight="600"
              >
                {rightUnit ? `${rightUnit} (右轴)` : '右轴'}
              </text>
              {rightScale.ticks.map((tickVal, idx) => {
                const y = getY('right', tickVal);
                return (
                  <text
                    key={`right-tick-${idx}`}
                    x={totalWidth - rightPad + 8}
                    y={y + 3.5}
                    textAnchor="start"
                    fill={CAMPAIGN_PALETTE.textMuted}
                    fontSize="12"
                    data-axis-tick="right"
                  >
                    {fmtAxisTick(tickVal, rightScale.step)}
                  </text>
                );
              })}
            </g>
          )}

          {/* 1. Grouped Bars (Proportional height, zero baseline indicator) */}
          {validRows.map((row, rowIdx) => {
            const cx = getCenterX(rowIdx);
            const clusterStart = cx - clusterW / 2;

            return barSeriesList.map((s, bIdx) => {
              const val = row[s.key];
              const bx = clusterStart + bIdx * (singleBarW + barGap);
              const y0 = getY(s.axis, 0);

              if (val === null || val === undefined || !isFiniteNumber(val)) {
                return null;
              }

              if (val === 0) {
                return (
                  <line
                    key={`bar-zero-${s.key}-${rowIdx}`}
                    x1={bx}
                    x2={bx + singleBarW}
                    y1={y0}
                    y2={y0}
                    stroke={s.color}
                    strokeWidth={Math.min(2.5, Math.max(1, singleBarW))}
                    strokeLinecap="round"
                    data-metric-type="bar"
                    data-series-key={s.key}
                    data-axis={s.axis}
                    data-row-index={rowIdx}
                    data-row-key={String(row[xKey])}
                    data-value="0"
                    data-is-zero="true"
                  />
                );
              }

              if (val > 0) {
                const by = getY(s.axis, val);
                const bh = y0 - by; // Direct proportional height!
                return (
                  <rect
                    key={`bar-${s.key}-${rowIdx}`}
                    x={bx}
                    y={by}
                    width={singleBarW}
                    height={bh}
                    fill={`url(#cc-grad-${s.key})`}
                    rx={Math.min(2, singleBarW / 2)}
                    opacity={activeIndex === rowIdx ? 1 : 0.85}
                    data-metric-type="bar"
                    data-series-key={s.key}
                    data-axis={s.axis}
                    data-row-index={rowIdx}
                    data-row-key={String(row[xKey])}
                    data-value={String(val)}
                    data-is-zero="false"
                  />
                );
              }

              // val < 0
              const by = y0;
              const bh = getY(s.axis, val) - y0; // Direct proportional height!
              return (
                <rect
                  key={`bar-neg-${s.key}-${rowIdx}`}
                  x={bx}
                  y={by}
                  width={singleBarW}
                  height={bh}
                  fill={s.color}
                  rx={Math.min(2, singleBarW / 2)}
                  opacity={activeIndex === rowIdx ? 1 : 0.85}
                  data-metric-type="bar"
                  data-series-key={s.key}
                  data-axis={s.axis}
                  data-row-index={rowIdx}
                  data-row-key={String(row[xKey])}
                  data-value={String(val)}
                  data-is-zero="false"
                />
              );
            });
          })}

          {/* 2. Line Series (Lines break at null/missing, points drawn at observed samples) */}
          {styledSeries
            .filter((s) => s.kind === 'line' && !hiddenSeries.has(s.key))
            .map((s) => {
              const pts: (Point | null)[] = validRows.map((r, i) => {
                const val = r[s.key];
                if (isFiniteNumber(val)) {
                  return { x: getCenterX(i), y: getY(s.axis, val), val, rowIndex: i };
                }
                return null;
              });

              const segments = getLineSegments(pts);

              return (
                <g key={`line-group-${s.key}`} data-series-key={s.key} data-axis={s.axis}>
                  {segments.map((seg, sIdx) => {
                    if (seg.length > 1) {
                      return (
                        <path
                          key={`seg-${sIdx}`}
                          d={buildPath(seg)}
                          fill="none"
                          stroke={s.color}
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          data-metric-type="line"
                          data-series-key={s.key}
                          data-axis={s.axis}
                        />
                      );
                    }
                    return null;
                  })}

                  {/* Individual data points along the line */}
                  {pts.map((pt, pIdx) => {
                    if (!pt) return null;
                    const isActive = activeIndex === pt.rowIndex;
                    return (
                      <circle
                        key={`line-pt-${pIdx}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={isActive ? 4.5 : 3}
                        fill={s.color}
                        stroke="#ffffff"
                        strokeWidth={isActive ? 2 : 1.2}
                        data-metric-type="line-point"
                        data-series-key={s.key}
                        data-axis={s.axis}
                        data-row-index={pt.rowIndex}
                        data-value={String(pt.val)}
                      >
                        <title>{`${validRows[pt.rowIndex][xKey]} ${s.label}: ${fmtComboNum(pt.val)} ${s.unit}`}</title>
                      </circle>
                    );
                  })}
                </g>
              );
            })}

          {/* 3. Point Series (Discrete points for category costs, avoiding false continuous trend) */}
          {styledSeries
            .filter((s) => s.kind === 'point' && !hiddenSeries.has(s.key))
            .map((s) => (
              <g key={`point-group-${s.key}`} data-series-key={s.key} data-axis={s.axis}>
                {validRows.map((r, i) => {
                  const val = r[s.key];
                  if (!isFiniteNumber(val)) return null;
                  const cx = getCenterX(i);
                  const cy = getY(s.axis, val);
                  const isActive = activeIndex === i;

                  return (
                    <circle
                      key={`pt-${i}`}
                      cx={cx}
                      cy={cy}
                      r={isActive ? 5.5 : 4}
                      fill="#ffffff"
                      stroke={s.color}
                      strokeWidth="2.2"
                      data-metric-type="point"
                      data-series-key={s.key}
                      data-axis={s.axis}
                      data-row-index={i}
                      data-row-key={String(r[xKey])}
                      data-value={String(val)}
                    >
                      <title>{`${r[xKey]} ${s.label}: ${fmtComboNum(val)} ${s.unit}`}</title>
                    </circle>
                  );
                })}
              </g>
            ))}

          {/* Active Hover Crosshair Line */}
          {activeIndex !== null && activeIndex < validRows.length && (
            <g pointerEvents="none">
              <rect
                className="cc-hover-band ca-combo-hover-band"
                x={getBandLeft(activeIndex)}
                y={topPad}
                width={bandWidth}
                height={plotHeight}
                fill="rgba(0, 133, 115, 0.06)"
                rx={3}
              />
              <line
                className="cc-crosshair"
                x1={getCenterX(activeIndex)}
                x2={getCenterX(activeIndex)}
                y1={topPad}
                y2={totalHeight - bottomPad}
                stroke="#60646c"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
            </g>
          )}

          {/* 4. Interactive Hit Bands (For keyboard focus & hover without layout jumps) */}
          {validRows.map((row, i) => {
            const bandX = getBandLeft(i);
            const isSelected = activeIndex === i;
            const rowName = String(row[xKey]);
            const readoutSummary = `${rowName} ${styledSeries
              .map((s) => {
                const v = row[s.key];
                return `${s.label}: ${isFiniteNumber(v) ? `${fmtComboNum(v)} ${s.unit}` : '未录入'}`;
              })
              .join('，')}`;

            return (
              <rect
                key={`hit-${i}`}
                x={bandX}
                y={topPad}
                width={bandWidth}
                height={plotHeight}
                fill={isSelected ? 'rgba(0, 133, 115, 0.06)' : 'transparent'}
                tabIndex={0}
                role="button"
                aria-label={readoutSummary}
                data-metric-type="hit-band"
                data-row-index={i}
                data-row-key={rowName}
                onMouseEnter={() => setHoverIndex(i)}
                onFocus={() => setHoverIndex(i)}
                onBlur={() => setHoverIndex(null)}
                onClick={() => setSelectedIndex(i)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = Math.min(rowCount - 1, i + 1);
                    setHoverIndex(next);
                    setSelectedIndex(next);
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = Math.max(0, i - 1);
                    setHoverIndex(prev);
                    setSelectedIndex(prev);
                  } else if (e.key === 'Home') {
                    e.preventDefault();
                    setHoverIndex(0);
                    setSelectedIndex(0);
                  } else if (e.key === 'End') {
                    e.preventDefault();
                    setHoverIndex(rowCount - 1);
                    setSelectedIndex(rowCount - 1);
                  }
                }}
                style={{ cursor: 'pointer', outline: 'none' }}
              />
            );
          })}

          {/* 5. X-Axis Ticks & Date/Category Formatting */}
          <g data-axis="x">
            {validRows.map((row, i) => {
              if (!visibleTickIndices.has(i)) return null;

              const rawLabel = String(row[xKey] ?? '');
              let displayLabel = fmtXAxisTick(rawLabel);
              const isDateVal = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(rawLabel) || /^\d{1,2}[-/]\d{1,2}$/.test(rawLabel);
              // When crowded (more than 4 categories), shorten Chinese labels to 5 chars to prevent tick collision
              if (!isDateVal && rowCount > 4 && displayLabel.length > 5) {
                displayLabel = `${displayLabel.slice(0, 5)}…`;
              }
              const cx = getCenterX(i);
              const isFirst = i === 0;
              const isLast = i === rowCount - 1;
              const anchor = rowCount > 3
                ? (isFirst ? 'start' : isLast ? 'end' : 'middle')
                : 'middle';
              const tx = rowCount > 3
                ? (isFirst ? Math.max(leftPad, cx - 4) : isLast ? Math.min(totalWidth - rightPad, cx + 4) : cx)
                : cx;

              return (
                <text
                  key={`xtick-${i}`}
                  x={tx}
                  y={totalHeight - bottomPad + 16}
                  textAnchor={anchor}
                  fill={activeIndex === i ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.textMuted}
                  fontWeight={activeIndex === i ? '600' : '400'}
                  fontSize="12"
                  data-axis-tick="x"
                >
                  {displayLabel}
                  <title>{rawLabel}</title>
                </text>
              );
            })}
          </g>
        </svg>

        {/* Frosted Glass Floating Tooltip */}
        {hoverIndex !== null && validRows[hoverIndex] && (
          <div
            className="cc-glass-tooltip"
            style={{
              left: `${Math.min(Math.max(80, getCenterX(hoverIndex)), totalWidth - 90)}px`,
              top: `${topPad + 8}px`,
              transform: 'translate(-50%, 0)',
            }}
          >
            <div className="cc-tooltip-date">{String(validRows[hoverIndex][xKey])}</div>
            <div className="cc-tooltip-items">
              {styledSeries
                .filter((s) => !hiddenSeries.has(s.key))
                .map((s) => {
                  const val = validRows[hoverIndex][s.key];
                  const isNum = isFiniteNumber(val);
                  return (
                    <div key={s.key} className="cc-tooltip-row">
                      <span className="cc-tooltip-dot" style={{ backgroundColor: s.color }} />
                      <span className="cc-tooltip-label">{s.label}:</span>
                      <span className="cc-tooltip-val">
                        {isNum ? `${fmtComboNum(val)} ${s.unit}` : '未录入'}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Legend with mark shape and unit */}
      <div className="ca-combo-legend" data-testid="combo-legend">
        {styledSeries.map((s) => {
          const isMuted = hiddenSeries.has(s.key);
          return (
          <div
            key={s.key}
            className={`ca-combo-legend-item cc-legend-item ${isMuted ? 'is-muted' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={!isMuted}
            title={isMuted ? `点击显示 ${s.label}` : `点击隐藏 ${s.label}`}
            onClick={() => toggleSeries(s.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSeries(s.key);
              }
            }}
          >
            {s.kind === 'bar' && (
              <span
                className="ca-combo-swatch-bar"
                style={{ background: s.color }}
                aria-hidden="true"
              />
            )}
            {s.kind === 'line' && (
              <span className="ca-combo-swatch-line" aria-hidden="true">
                <span
                  className="ca-combo-swatch-line-bar"
                  style={{ background: s.color }}
                />
                <span
                  className="ca-combo-swatch-line-dot"
                  style={{ background: s.color }}
                />
              </span>
            )}
            {s.kind === 'point' && (
              <span
                className="ca-combo-swatch-point"
                style={{ borderColor: s.color }}
                aria-hidden="true"
              />
            )}
            <span className="ca-combo-legend-label">{s.label}</span>
            <span className="ca-combo-legend-unit">({s.unit})</span>
            <span className="ca-combo-legend-axis">
              {s.axis === 'right' ? '右轴' : '左轴'}
            </span>
          </div>
        );})}
      </div>
    </div>
  );
}
