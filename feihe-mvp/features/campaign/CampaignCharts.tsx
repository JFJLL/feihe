'use client';

import React, { useState, useId } from 'react';
import './campaign-analytics.css';

/**
 * 营销分析图表统一调色板
 * 暖白底色 #f6f5f2, 主深青 #2c7168, 辅助紫 #8273a3, 赭金 #b88a45, 陶土 #bd7964, 计划灰 #8c9ba5
 */
export const CAMPAIGN_PALETTE = {
  primary: '#2c7168',    // 主深青 (实际消耗 / 核心达标)
  purple: '#8273a3',     // 辅助紫 (结算 / 搜索侧 / 快照参考)
  gold: '#b88a45',       // 赭金 (项目投入 / 达人采买 / 预警)
  terracotta: '#bd7964', // 陶土 (超支异常 / 缺陷整改 / 高于控制目标)
  slate: '#8c9ba5',      // 计划灰 (基准线 / 目标标线)
  warmBg: '#f6f5f2',     // 暖白底色
  panelBg: '#ffffff',    // 卡片白
  textMain: '#1f2937',   // 深灰主文字
  textMuted: '#64748b',  // 次级辅助文字
  textSubtle: '#94a3b8', // 弱化占位文字
  border: '#e2e8f0',     // 结构边框
  borderWarm: '#e6e3dc', // 暖色微边框
  gridLine: '#edf2f7',   // 坐标网格线
} as const;

export const DEFAULT_SERIES_COLORS = [
  CAMPAIGN_PALETTE.primary,
  CAMPAIGN_PALETTE.purple,
  CAMPAIGN_PALETTE.gold,
  CAMPAIGN_PALETTE.terracotta,
  '#4d8b80',
  '#9c6f84',
  CAMPAIGN_PALETTE.slate,
];

// ============================================================================
// 导出类型契约
// ============================================================================

export type ChartDatum = {
  id?: string;
  label: string;
  value: number | null;
  color?: string;
  detail?: string;
};

export type ComparisonDatum = {
  label: string;
  actual: number | null;
  target: number | null;
  unit?: string;
  direction?: 'lower' | 'higher' | 'neutral';
  comparison?: 'lt' | 'lte' | 'gt' | 'gte';
};

// ============================================================================
// 通用格式化工具 (缺值严格保持 —, 绝不虚假补零)
// ============================================================================

function fmtNum(val: number | null | undefined, maxDigits = 2): string {
  if (val === null || val === undefined || isNaN(val) || !Number.isFinite(val)) {
    return '—';
  }
  return val.toLocaleString('zh-CN', { maximumFractionDigits: maxDigits });
}

function fmtPct(val: number | null | undefined, maxDigits = 1): string {
  if (val === null || val === undefined || isNaN(val) || !Number.isFinite(val)) {
    return '—';
  }
  return `${val.toLocaleString('zh-CN', { maximumFractionDigits: maxDigits })}%`;
}

// ============================================================================
// 1. MetricStrip 紧凑指标条 (首屏 4 简洁指标，移动端 390 紧凑 2 列，防止大数溢出)
// ============================================================================

export interface MetricStripItem {
  label: string;
  value?: string | number | null;
  unit?: string;
  note?: string;
  sparkline?: (number | null)[];
}

function renderMiniSparklineSvg(points: (number | null)[], width = 96, height = 20, strokeColor = '#2c7168') {
  const valid = points.filter((p): p is number => p !== null && Number.isFinite(p));
  if (valid.length < 2) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max === min ? 1 : max - min;
  const step = width / (points.length - 1);
  const pad = 2;
  const innerH = height - pad * 2;

  let d = '';
  let inLine = false;

  points.forEach((val, i) => {
    if (val === null || !Number.isFinite(val)) {
      inLine = false;
      return;
    }
    const x = i * step;
    const y = pad + innerH - ((val - min) / range) * innerH;
    if (!inLine) {
      d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      inLine = true;
    } else {
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  });

  if (!d) return null;

  return (
    <div style={{ width: '100%', height: `${height}px`, marginTop: '4px', opacity: 0.85 }} aria-hidden="true">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
        preserveAspectRatio="none"
      >
        <path
          d={d}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function MetricStrip({
  items,
}: {
  items: Array<MetricStripItem>;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="ca-metric-strip bd-kpi-grid-rich" role="region" aria-label="核心指标统计概览">
      {items.map((it, idx) => {
        const isMissing = it.value === null || it.value === undefined;
        let formatted = '—';
        if (!isMissing) {
          formatted = typeof it.value === 'number' ? fmtNum(it.value) : String(it.value);
        }
        return (
          <article key={idx} className="ca-metric-item bd-kpi-card-rich">
            <div className="bd-kpi-head">
              <span className="ca-metric-label" title={it.label}>{it.label}</span>
            </div>
            <div className="ca-metric-value-row bd-kpi-val">
              <span
                className={`ca-metric-value ${isMissing ? 'ca-metric-missing' : ''}`}
                title={formatted}
              >
                {formatted}
              </span>
              {it.unit && <small className="ca-metric-unit">{it.unit}</small>}
            </div>
            {it.sparkline && renderMiniSparklineSvg(it.sparkline, 96, 20, CAMPAIGN_PALETTE.primary)}
            {it.note && <p className="ca-metric-note bd-kpi-sub" title={it.note}>{it.note}</p>}
          </article>
        );
      })}
    </div>
  );
}

// ============================================================================
// 2. ChartPanel 统一容器 (带标题/副标/操作区/卡片外壳)
// ============================================================================

export function ChartPanel({
  title,
  subtitle,
  children,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const panelId = useId();

  return (
    <section
      className={`ca-panel bd-panel ${className || ''}`.trim()}
      data-section="spend"
      aria-labelledby={panelId}
    >
      <div className="ca-panel-header bd-panel-head">
        <div className="ca-panel-heading">
          <h3 id={panelId} className="ca-panel-title">{title}</h3>
          {subtitle && <p className="ca-panel-subtitle bd-caption">{subtitle}</p>}
        </div>
        {actions && <div className="ca-panel-actions">{actions}</div>}
      </div>
      <div className="ca-panel-body">
        {children}
      </div>
    </section>
  );
}

// ============================================================================
// 3. HorizontalBarChart 横向条形图 (自适应最小行高, 0值不虚假画长, 固定高度Readout防跳动)
// ============================================================================

export function HorizontalBarChart({
  data,
  unit = '',
  height,
}: {
  data: ChartDatum[];
  unit?: string;
  height?: number;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">暂无可绘制的条形数据</div>
        <div className="ca-empty-hint">真实数据登记后自动呈现对比</div>
      </div>
    );
  }

  const validValues = data
    .map((d) => d.value)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  if (validValues.length === 0) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">全部条形数据项均未录入数值</div>
        <div className="ca-empty-hint">缺失记录保持空态，不作推算补零</div>
      </div>
    );
  }

  const maxVal = Math.max(1, ...validValues);
  const topPad = 16;
  const bottomPad = 26;
  const leftPad = 130;
  const rightPad = 80;
  const totalWidth = 620;

  // 动态确保每行至少 34px，height 较小（如 190 配 9 行）依 rowcount 自适应扩展，彻底杜绝底部截切
  const minNeededHeight = data.length * 36 + topPad + bottomPad;
  const totalHeight = Math.max(height || minNeededHeight, minNeededHeight);
  const rowHeight = (totalHeight - topPad - bottomPad) / Math.max(1, data.length);
  const barPlotWidth = totalWidth - leftPad - rightPad;

  const current = activeIdx !== null && activeIdx < data.length ? data[activeIdx] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* 固定高度 Readout，未悬停保持占位，绝不推挤 SVG 造成页面跳动 */}
      <div className="ca-chart-readout" aria-live="polite">
        {current ? (
          <>
            <span>当前聚焦:</span>
            <strong>{current.label}</strong>
            <span>
              {current.value !== null ? `${fmtNum(current.value)} ${unit}` : '实际未录入'}
            </span>
            {current.detail && <span style={{ color: '#64748b' }}>({current.detail})</span>}
          </>
        ) : (
          <span className="ca-chart-readout-empty">
            悬停条形或使用方向键聚焦查看准确数值
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="ca-chart-svg"
        role="graphics-document"
        aria-label={`横向对比图，共 ${data.length} 项`}
        onMouseLeave={() => setActiveIdx(null)}
      >
        <title>{`横向对比图，共 ${data.length} 项。悬停或键盘聚焦查看数值。`}</title>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const xPos = leftPad + ratio * barPlotWidth;
          const tickVal = maxVal * ratio;
          return (
            <g key={ratio}>
              <line
                x1={xPos}
                x2={xPos}
                y1={topPad}
                y2={totalHeight - bottomPad}
                stroke={CAMPAIGN_PALETTE.gridLine}
                strokeDasharray="3 3"
              />
              <text
                x={xPos}
                y={totalHeight - 8}
                textAnchor="middle"
                fill={CAMPAIGN_PALETTE.textMuted}
                fontSize="10"
              >
                {fmtNum(tickVal, 0)}
              </text>
            </g>
          );
        })}

        {data.map((item, idx) => {
          const y = topPad + idx * rowHeight;
          const isSelected = activeIdx === idx;
          const hasVal = typeof item.value === 'number' && Number.isFinite(item.value);
          const isZero = hasVal && item.value === 0;
          // 0 实际不画正宽度，正数才计算宽度
          const barWidth = hasVal && !isZero ? Math.max(3, (item.value! / maxVal) * barPlotWidth) : 0;
          const color = item.color || DEFAULT_SERIES_COLORS[idx % DEFAULT_SERIES_COLORS.length];

          return (
            <g
              key={item.id || item.label || idx}
              tabIndex={0}
              role="button"
              aria-label={`${item.label}: ${hasVal ? (isZero ? '原值 0' : `${fmtNum(item.value)} ${unit}`) : '未录入'}`}
              onMouseEnter={() => setActiveIdx(idx)}
              onFocus={() => setActiveIdx(idx)}
              onBlur={() => setActiveIdx(null)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIdx(Math.min(data.length - 1, idx + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIdx(Math.max(0, idx - 1));
                }
              }}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              <rect
                x={0}
                y={y}
                width={totalWidth}
                height={rowHeight - 4}
                fill={isSelected ? 'rgba(44, 113, 104, 0.05)' : 'transparent'}
                rx={4}
              />

              <text
                x={leftPad - 10}
                y={y + 19}
                textAnchor="end"
                fill={isSelected ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.textMain}
                fontWeight={isSelected ? '600' : '400'}
                fontSize="12"
              >
                {item.label.length > 11 ? `${item.label.slice(0, 11)}…` : item.label}
                <title>{item.label}</title>
              </text>

              {hasVal ? (
                isZero ? (
                  <>
                    {/* 0 实际: 明确原值 0 标线与文本，不画虚假填充条 */}
                    <line
                      x1={leftPad}
                      x2={leftPad}
                      y1={y + 5}
                      y2={y + 21}
                      stroke={CAMPAIGN_PALETTE.slate}
                      strokeWidth="2.5"
                    />
                    <text
                      x={leftPad + 8}
                      y={y + 18}
                      textAnchor="start"
                      fill={CAMPAIGN_PALETTE.textMuted}
                      fontSize="11"
                    >
                      0 {unit}
                    </text>
                  </>
                ) : (
                  <>
                    <rect
                      x={leftPad}
                      y={y + 5}
                      width={barWidth}
                      height={18}
                      rx={3}
                      fill={color}
                      opacity={isSelected ? 1 : 0.88}
                    />
                    <text
                      x={Math.min(totalWidth - 36, leftPad + barWidth + 8)}
                      y={y + 19}
                      textAnchor="start"
                      fill={isSelected ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.textMain}
                      fontWeight="600"
                      fontSize="11.5"
                    >
                      {fmtNum(item.value)}
                      {unit && <tspan fill={CAMPAIGN_PALETTE.textMuted} fontSize="10"> {unit}</tspan>}
                    </text>
                  </>
                )
              ) : (
                <>
                  <rect
                    x={leftPad}
                    y={y + 7}
                    width={60}
                    height={14}
                    rx={3}
                    fill="none"
                    stroke="#cbd5e1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={leftPad + 8}
                    y={y + 18}
                    fill={CAMPAIGN_PALETTE.textSubtle}
                    fontSize="10.5"
                  >
                    未录入
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================================
// 4. DonutChart 环形分布图 (原生 SVG 路径, 中心联动, 缺值与零值不失真)
// ============================================================================

export function DonutChart({
  data,
  unit = '',
  centerLabel,
}: {
  data: ChartDatum[];
  unit?: string;
  centerLabel?: string;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">暂无可绘制的环形分布数据</div>
        <div className="ca-empty-hint">真实构成录入后自动呈现各部分占比</div>
      </div>
    );
  }

  const validSlices = data.filter(
    (d): d is ChartDatum & { value: number } =>
      typeof d.value === 'number' && Number.isFinite(d.value) && d.value > 0
  );

  const total = validSlices.reduce((sum, d) => sum + d.value, 0);

  if (total <= 0) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">暂无正向数值用于构成计算</div>
        <div className="ca-empty-hint">缺失或非正数记录不强制补零绘制</div>
      </div>
    );
  }

  const cx = 115;
  const cy = 115;
  const rOuter = 88;
  const rInner = 56;

  // 计算各扇区前缀起止角度 (严格不可变 reduce 预计算，满足 React Compiler 规范)
  const sliceAngles = validSlices.reduce<Array<{ startAngle: number; endAngle: number; angleSpan: number }>>(
    (acc, slice) => {
      const span = (slice.value / total) * Math.PI * 2;
      const prevEnd = acc.length > 0 ? acc[acc.length - 1].endAngle : -Math.PI / 2;
      return [...acc, { startAngle: prevEnd, endAngle: prevEnd + span, angleSpan: span }];
    },
    []
  );

  const slicePaths = validSlices.map((slice, idx) => {
    const { startAngle, endAngle, angleSpan } = sliceAngles[idx];

    const isHovered = activeIdx === idx;
    const outer = isHovered ? rOuter + 4 : rOuter;
    const inner = isHovered ? rInner - 2 : rInner;

    const x1 = cx + outer * Math.cos(startAngle);
    const y1 = cy + outer * Math.sin(startAngle);
    const x2 = cx + outer * Math.cos(endAngle);
    const y2 = cy + outer * Math.sin(endAngle);

    const x3 = cx + inner * Math.cos(endAngle);
    const y3 = cy + inner * Math.sin(endAngle);
    const x4 = cx + inner * Math.cos(startAngle);
    const y4 = cy + inner * Math.sin(startAngle);

    const largeArc = angleSpan > Math.PI ? 1 : 0;
    const pathData = `M ${x1} ${y1} A ${outer} ${outer} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    const color = slice.color || DEFAULT_SERIES_COLORS[idx % DEFAULT_SERIES_COLORS.length];

    return {
      ...slice,
      pathData,
      color,
      percent: (slice.value / total) * 100,
    };
  });

  const activeSlice = activeIdx !== null && activeIdx < slicePaths.length ? slicePaths[activeIdx] : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', minHeight: 230 }}>
      <div style={{ position: 'relative', width: 230, height: 230, flexShrink: 0 }}>
        <svg
          viewBox="0 0 230 230"
          className="ca-chart-svg"
          role="graphics-document"
          aria-label={`环形分布图，总额 ${fmtNum(total)} ${unit}`}
          onMouseLeave={() => setActiveIdx(null)}
        >
          <title>{`环形分布图，总额 ${fmtNum(total)} ${unit}`}</title>
          {slicePaths.map((slice, idx) => (
            <path
              key={slice.id || slice.label || idx}
              d={slice.pathData}
              fill={slice.color}
              stroke="#ffffff"
              strokeWidth="1.8"
              tabIndex={0}
              role="button"
              aria-label={`${slice.label}: ${fmtNum(slice.value)} ${unit} (${slice.percent.toFixed(1)}%)`}
              onMouseEnter={() => setActiveIdx(idx)}
              onFocus={() => setActiveIdx(idx)}
              onBlur={() => setActiveIdx(null)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIdx((idx + 1) % slicePaths.length);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIdx((idx - 1 + slicePaths.length) % slicePaths.length);
                }
              }}
              style={{
                cursor: 'pointer',
                outline: 'none',
                opacity: activeIdx === null || activeIdx === idx ? 1 : 0.65,
                transition: 'opacity 0.15s ease, transform 0.15s ease',
              }}
            />
          ))}

          <g pointerEvents="none">
            <text
              x={cx}
              y={cy - 12}
              textAnchor="middle"
              fill={CAMPAIGN_PALETTE.textMuted}
              fontSize="11.5"
            >
              {activeSlice ? (activeSlice.label.length > 8 ? `${activeSlice.label.slice(0, 8)}…` : activeSlice.label) : (centerLabel || '总计')}
            </text>
            <text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              fill={CAMPAIGN_PALETTE.textMain}
              fontWeight="700"
              fontSize="16"
            >
              {activeSlice ? fmtNum(activeSlice.value) : fmtNum(total)}
            </text>
            <text
              x={cx}
              y={cy + 26}
              textAnchor="middle"
              fill={activeSlice ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.textMuted}
              fontWeight="600"
              fontSize="10.5"
            >
              {activeSlice ? `${activeSlice.percent.toFixed(1)}%` : unit}
            </text>
          </g>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((item, idx) => {
          const sliceIdx = slicePaths.findIndex((s) => s.label === item.label);
          const hasSlice = sliceIdx >= 0;
          const slice = hasSlice ? slicePaths[sliceIdx] : null;
          const isSelected = hasSlice && activeIdx === sliceIdx;
          const color = item.color || (hasSlice ? slice!.color : CAMPAIGN_PALETTE.slate);
          const isZero = item.value === 0;

          return (
            <div
              key={item.id || item.label || idx}
              tabIndex={0}
              role="button"
              className="ca-chart-legend-item"
              onMouseEnter={() => hasSlice && setActiveIdx(sliceIdx)}
              onFocus={() => hasSlice && setActiveIdx(sliceIdx)}
              onBlur={() => setActiveIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                borderRadius: 4,
                background: isSelected ? 'rgba(44, 113, 104, 0.08)' : 'transparent',
                outline: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span className="ca-chart-swatch" style={{ background: color }} />
                <span
                  style={{
                    fontSize: 12,
                    color: isSelected ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.textMain,
                    fontWeight: isSelected ? 600 : 400,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 120,
                  }}
                  title={item.label}
                >
                  {item.label}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, flexShrink: 0 }}>
                {slice ? (
                  <>
                    <strong style={{ color: CAMPAIGN_PALETTE.textMain }}>{fmtNum(slice.value)}</strong>
                    <span style={{ color: CAMPAIGN_PALETTE.textMuted }}>{slice.percent.toFixed(1)}%</span>
                  </>
                ) : isZero ? (
                  <span style={{ color: CAMPAIGN_PALETTE.textMuted }}>原值 0</span>
                ) : (
                  <span style={{ color: CAMPAIGN_PALETTE.textSubtle }}>未录入</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 5. BudgetComparisonChart 预算与实际对比 (固定值列防裁切, 超出不截断, 0值不虚假画长)
// ============================================================================

export function BudgetComparisonChart({
  data,
  unit = '元',
}: {
  data: ComparisonDatum[];
  unit?: string;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">暂无预算对比数据</div>
        <div className="ca-empty-hint">预算与实际消耗登记后自动呈现对比</div>
      </div>
    );
  }

  // 最大值基准：考虑实际超支，预留 8% 空间，条形全部在 plotWidth 内，不向右裁切
  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [
      typeof d.actual === 'number' && Number.isFinite(d.actual) ? d.actual : 0,
      typeof d.target === 'number' && Number.isFinite(d.target) ? d.target : 0,
    ])
  ) * 1.08;

  const leftPad = 120;
  const rightPad = 140; // 预留固定数值与状态列，超支长注放入固定 Readout，彻底消除右边界裁切
  const topPad = 32;
  const bottomPad = 24;
  const rowHeight = 48;
  const totalWidth = 660;

  const minNeededHeight = data.length * rowHeight + topPad + bottomPad;
  const totalHeight = Math.max(160, minNeededHeight);
  const plotWidth = totalWidth - leftPad - rightPad;

  const current = activeIdx !== null && activeIdx < data.length ? data[activeIdx] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div className="ca-chart-legend" style={{ marginBottom: 10 }}>
        <span className="ca-chart-legend-item">
          <span className="ca-chart-swatch" style={{ background: CAMPAIGN_PALETTE.primary }} />
          预算内实际消耗
        </span>
        <span className="ca-chart-legend-item">
          <span className="ca-chart-swatch" style={{ background: CAMPAIGN_PALETTE.terracotta }} />
          超支消耗 (&gt;100% 预算)
        </span>
        <span className="ca-chart-legend-item">
          <span className="ca-chart-swatch-line" style={{ background: CAMPAIGN_PALETTE.slate }} />
          预算控制线 (100% 目标)
        </span>
      </div>

      {/* 固定高度 Readout，未悬停保持占位，绝不推挤 SVG */}
      <div className="ca-chart-readout" aria-live="polite">
        {current ? (
          <>
            <strong>{current.label}</strong>
            <span>实际: {fmtNum(current.actual)} {unit}</span>
            <span>预算: {fmtNum(current.target)} {unit}</span>
            {current.actual !== null && current.target !== null && current.target > 0 && (
              <span
                style={{
                  color: current.actual > current.target ? CAMPAIGN_PALETTE.terracotta : CAMPAIGN_PALETTE.primary,
                  fontWeight: 600,
                }}
              >
                {current.actual > current.target
                  ? `超支 +${fmtNum(current.actual - current.target)} (+${fmtPct((current.actual / current.target) * 100 - 100)})`
                  : `预算占用 ${fmtPct((current.actual / current.target) * 100)} (结余 ${fmtNum(current.target - current.actual)})`}
              </span>
            )}
          </>
        ) : (
          <span className="ca-chart-readout-empty">
            悬停预算条或使用方向键聚焦查看详细超支与结余核算
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="ca-chart-svg"
        role="graphics-document"
        aria-label={`预算对比图，共 ${data.length} 项`}
        onMouseLeave={() => setActiveIdx(null)}
      >
        <title>{`预算对比图，共 ${data.length} 项。超支条形完整越界呈现。`}</title>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const xPos = leftPad + ratio * plotWidth;
          const tickVal = maxVal * ratio;
          return (
            <g key={ratio}>
              <line
                x1={xPos}
                x2={xPos}
                y1={topPad}
                y2={totalHeight - bottomPad}
                stroke={CAMPAIGN_PALETTE.gridLine}
                strokeDasharray="3 3"
              />
              <text
                x={xPos}
                y={topPad - 8}
                textAnchor="middle"
                fill={CAMPAIGN_PALETTE.textMuted}
                fontSize="10"
              >
                {fmtNum(tickVal, 0)}
              </text>
            </g>
          );
        })}

        {data.map((item, idx) => {
          const y = topPad + idx * rowHeight;
          const isSelected = activeIdx === idx;
          const hasActual = typeof item.actual === 'number' && Number.isFinite(item.actual);
          const hasTarget = typeof item.target === 'number' && Number.isFinite(item.target) && item.target > 0;
          const isZero = hasActual && item.actual === 0;

          const targetX = hasTarget ? leftPad + (item.target! / maxVal) * plotWidth : null;
          // 0 实际不画正宽度
          const actualWidth = hasActual && !isZero ? Math.max(3, (item.actual! / maxVal) * plotWidth) : 0;
          const isOverrun = hasActual && hasTarget && item.actual! > item.target!;
          const barColor = isOverrun ? CAMPAIGN_PALETTE.terracotta : CAMPAIGN_PALETTE.primary;

          return (
            <g
              key={item.label || idx}
              tabIndex={0}
              role="button"
              aria-label={`${item.label} 实际 ${fmtNum(item.actual)}${unit}，预算 ${fmtNum(item.target)}${unit}`}
              onMouseEnter={() => setActiveIdx(idx)}
              onFocus={() => setActiveIdx(idx)}
              onBlur={() => setActiveIdx(null)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIdx(Math.min(data.length - 1, idx + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIdx(Math.max(0, idx - 1));
                }
              }}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              <rect
                x={0}
                y={y}
                width={totalWidth}
                height={rowHeight - 6}
                fill={isSelected ? 'rgba(44, 113, 104, 0.05)' : 'transparent'}
                rx={4}
              />

              {/* 左侧渠道名称 */}
              <text
                x={leftPad - 12}
                y={y + 19}
                textAnchor="end"
                fill={isSelected ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.textMain}
                fontWeight={isSelected ? '600' : '400'}
                fontSize="12"
              >
                {item.label.length > 10 ? `${item.label.slice(0, 10)}…` : item.label}
                <title>{item.label}</title>
              </text>

              {/* 预算底轨 (浅灰槽) */}
              {targetX !== null && (
                <rect
                  x={leftPad}
                  y={y + 6}
                  width={targetX - leftPad}
                  height={18}
                  rx={3}
                  fill="#f1f5f9"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
              )}

              {/* 实际消耗条 (超支时越过目标线，绝不截断；0实际画零刻度) */}
              {hasActual ? (
                isZero ? (
                  <line
                    x1={leftPad}
                    x2={leftPad}
                    y1={y + 5}
                    y2={y + 25}
                    stroke={CAMPAIGN_PALETTE.slate}
                    strokeWidth="2.5"
                  />
                ) : (
                  <rect
                    x={leftPad}
                    y={y + 8}
                    width={actualWidth}
                    height={14}
                    rx={2.5}
                    fill={barColor}
                    opacity={isSelected ? 1 : 0.9}
                  />
                )
              ) : (
                <rect
                  x={leftPad}
                  y={y + 8}
                  width={60}
                  height={14}
                  rx={2.5}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeDasharray="3 3"
                />
              )}

              {/* 目标控制坚线标尺 */}
              {targetX !== null && (
                <g>
                  <line
                    x1={targetX}
                    x2={targetX}
                    y1={y + 3}
                    y2={y + 27}
                    stroke={CAMPAIGN_PALETTE.textMain}
                    strokeWidth="2"
                    strokeDasharray="3 2"
                  />
                </g>
              )}

              {/* 右侧固定数值列 (右对齐，彻底消除超支注在末尾裁切的问题) */}
              <g>
                <text
                  x={totalWidth - 14}
                  y={y + 17}
                  textAnchor="end"
                  fill={isOverrun ? CAMPAIGN_PALETTE.terracotta : hasActual ? CAMPAIGN_PALETTE.textMain : CAMPAIGN_PALETTE.textSubtle}
                  fontWeight="600"
                  fontSize="12"
                >
                  {hasActual ? `${fmtNum(item.actual)}` : '未录入'}
                  {isOverrun && (
                    <tspan fill={CAMPAIGN_PALETTE.terracotta} fontWeight="700" fontSize="10.5">
                      {' ↑超支'}
                    </tspan>
                  )}
                </text>
                <text
                  x={totalWidth - 14}
                  y={y + 31}
                  textAnchor="end"
                  fill={CAMPAIGN_PALETTE.textMuted}
                  fontSize="10.5"
                >
                  {hasTarget ? `预算 ${fmtNum(item.target)}` : '无预算目标'}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================================
// 6. TargetBulletChart 目标靶心图 (严格 direct actual vs target 比较, 0值不虚画, 成本不叫归一化达成)
// ============================================================================

interface BulletEvaluation {
  hasActual: boolean;
  hasTarget: boolean;
  ratio: number | null;
  isAchieved: boolean | null;
  statusLabel: string;
  statusType: 'success' | 'warning' | 'neutral' | 'pending';
  barColor: string;
  directionNote: string;
  readoutRatioDesc: string;
}

function evaluateBulletDatum(item: ComparisonDatum): BulletEvaluation {
  const hasTarget = typeof item.target === 'number' && Number.isFinite(item.target) && item.target > 0;
  const hasActual = typeof item.actual === 'number' && Number.isFinite(item.actual);

  if (!hasTarget) {
    return {
      hasActual,
      hasTarget: false,
      ratio: null,
      isAchieved: null,
      statusLabel: '目标待补充',
      statusType: 'pending',
      barColor: CAMPAIGN_PALETTE.slate,
      directionNote: '目标未设定',
      readoutRatioDesc: '目标待补充',
    };
  }

  const target = item.target!;

  if (!hasActual) {
    return {
      hasActual: false,
      hasTarget: true,
      ratio: null,
      isAchieved: null,
      statusLabel: '实际待录入',
      statusType: 'pending',
      barColor: CAMPAIGN_PALETTE.slate,
      directionNote: item.direction === 'lower' ? '成本越低越好' : item.direction === 'higher' ? '越大越好' : '基准观察',
      readoutRatioDesc: '实际待登记',
    };
  }

  const actual = item.actual!;
  const ratio = (actual / target) * 100;

  // 1. 中性基准优先：不判定达标状态，不计入达标数量
  if (item.direction === 'neutral') {
    return {
      hasActual: true,
      hasTarget: true,
      ratio,
      isAchieved: null,
      statusLabel: '基准参考',
      statusType: 'neutral',
      barColor: CAMPAIGN_PALETTE.purple,
      directionNote: '基准观察',
      readoutRatioDesc: `实际/基准: ${fmtNum(actual)} / ${fmtNum(target)} (${ratio.toFixed(1)}%)`,
    };
  }

  // 2. 成本类 / 下限控制：严格 direct actual vs target 比较，不用 rounded ratio 判定
  const isLower =
    item.comparison === 'lt' ||
    item.comparison === 'lte' ||
    (!item.comparison && item.direction === 'lower');

  if (isLower) {
    let isAchieved: boolean;
    let statusLabel: string;
    let statusType: 'success' | 'warning';

    if (item.comparison === 'lt') {
      if (actual < target) {
        isAchieved = true;
        statusLabel = '成本达标';
        statusType = 'success';
      } else if (actual === target) {
        // 严格 lt 相等未达标，严谨标注为“未达到成本目标”，非高于
        isAchieved = false;
        statusLabel = '未达到成本目标';
        statusType = 'warning';
      } else {
        isAchieved = false;
        statusLabel = '高于控制目标';
        statusType = 'warning';
      }
    } else {
      // lte 或默认 lower
      if (actual <= target) {
        isAchieved = true;
        statusLabel = '成本达标';
        statusType = 'success';
      } else {
        isAchieved = false;
        statusLabel = '高于控制目标';
        statusType = 'warning';
      }
    }

    const barColor = isAchieved ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.terracotta;

    return {
      hasActual: true,
      hasTarget: true,
      ratio,
      isAchieved,
      statusLabel,
      statusType,
      barColor,
      directionNote: '成本越低越好',
      // 严禁将成本叫“归一化达成”
      readoutRatioDesc: `实际/目标: ${fmtNum(actual)} / ${fmtNum(target)} (控制比例 ${ratio.toFixed(1)}%)`,
    };
  }

  // 3. 规模转化类 / 上限争取：严格 direct actual vs target 比较
  let isAchieved: boolean;
  if (item.comparison === 'gt') {
    isAchieved = actual > target;
  } else {
    isAchieved = actual >= target;
  }

  const statusLabel = isAchieved ? '达成目标' : '未达目标';
  const statusType: 'success' | 'warning' = isAchieved ? 'success' : 'warning';
  const barColor = isAchieved ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.gold;

  return {
    hasActual: true,
    hasTarget: true,
    ratio,
    isAchieved,
    statusLabel,
    statusType,
    barColor,
    directionNote: '越大越好',
    readoutRatioDesc: `实际/目标: ${fmtNum(actual)} / ${fmtNum(target)} (达成率 ${ratio.toFixed(1)}%)`,
  };
}

export function TargetBulletChart({
  data,
}: {
  data: ComparisonDatum[];
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">暂无目标考核数据</div>
        <div className="ca-empty-hint">设定目标与录入实际后呈现归一化达成进度</div>
      </div>
    );
  }

  const evaluations = data.map(evaluateBulletDatum);

  const validRatios = evaluations
    .map((e) => e.ratio)
    .filter((r): r is number => typeof r === 'number' && Number.isFinite(r));

  const maxRatioVal = Math.max(120, ...validRatios) * 1.12;

  const leftPad = 140;
  const rightPad = 90;
  const topPad = 28;
  const bottomPad = 26;
  const rowHeight = 46;
  const totalWidth = 640;
  const minNeededHeight = data.length * rowHeight + topPad + bottomPad;
  const totalHeight = Math.max(160, minNeededHeight);
  const plotWidth = totalWidth - leftPad - rightPad;

  const targetX100 = leftPad + (100 / maxRatioVal) * plotWidth;
  const current = activeIdx !== null && activeIdx < data.length ? data[activeIdx] : null;
  const currentEval = activeIdx !== null && activeIdx < evaluations.length ? evaluations[activeIdx] : null;

  // 按数据包含的 direction/comparison 仅显示适用的图例项，精炼清晰
  const hasLower = data.some(
    (d) => d.direction === 'lower' || d.comparison === 'lt' || d.comparison === 'lte'
  );
  const hasHigher = data.some(
    (d) =>
      d.direction === 'higher' ||
      d.comparison === 'gt' ||
      d.comparison === 'gte' ||
      (!d.direction && !d.comparison)
  );
  const hasNeutral = data.some((d) => d.direction === 'neutral');

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div className="ca-chart-legend" style={{ marginBottom: 10 }}>
        {hasHigher && (
          <>
            <span className="ca-chart-legend-item">
              <span className="ca-chart-swatch" style={{ background: CAMPAIGN_PALETTE.primary }} />
              达成目标
            </span>
            <span className="ca-chart-legend-item">
              <span className="ca-chart-swatch" style={{ background: CAMPAIGN_PALETTE.gold }} />
              未达目标
            </span>
          </>
        )}
        {hasLower && (
          <>
            <span className="ca-chart-legend-item">
              <span className="ca-chart-swatch" style={{ background: CAMPAIGN_PALETTE.primary }} />
              成本达标
            </span>
            <span className="ca-chart-legend-item">
              <span className="ca-chart-swatch" style={{ background: CAMPAIGN_PALETTE.terracotta }} />
              未达成本目标
            </span>
          </>
        )}
        {hasNeutral && (
          <span className="ca-chart-legend-item">
            <span className="ca-chart-swatch" style={{ background: CAMPAIGN_PALETTE.purple }} />
            基准参考
          </span>
        )}
        <span className="ca-chart-legend-item">
          <span className="ca-chart-swatch-line" style={{ background: '#0f172a' }} />
          100% 目标线
        </span>
      </div>

      {/* 固定高度 Readout，未悬停保持占位，绝不推挤 SVG */}
      <div className="ca-chart-readout" aria-live="polite">
        {current && currentEval ? (
          <>
            <strong>{current.label}</strong>
            <span>{currentEval.readoutRatioDesc}</span>
            <span style={{ color: currentEval.barColor, fontWeight: 700 }}>
              [{currentEval.statusLabel}]
            </span>
            <span style={{ color: '#64748b' }}>({currentEval.directionNote})</span>
          </>
        ) : (
          <span className="ca-chart-readout-empty">
            悬停指标或使用方向键聚焦查看各项评估方向与达标判定
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="ca-chart-svg"
        role="graphics-document"
        aria-label={`目标靶心图，共 ${data.length} 项指标`}
        onMouseLeave={() => setActiveIdx(null)}
      >
        <title>{`归一化目标靶心图，100% 为目标达成线，多指标统一归一化刻度。`}</title>
        {[0, 50, 100, 150].filter((v) => v <= maxRatioVal).map((pctVal) => {
          const xPos = leftPad + (pctVal / maxRatioVal) * plotWidth;
          const isTarget100 = pctVal === 100;
          return (
            <g key={pctVal}>
              <line
                x1={xPos}
                x2={xPos}
                y1={topPad}
                y2={totalHeight - bottomPad}
                stroke={isTarget100 ? '#94a3b8' : CAMPAIGN_PALETTE.gridLine}
                strokeWidth={isTarget100 ? 1.5 : 1}
                strokeDasharray={isTarget100 ? '4 2' : '3 3'}
              />
              <text
                x={xPos}
                y={totalHeight - 8}
                textAnchor="middle"
                fill={isTarget100 ? CAMPAIGN_PALETTE.textMain : CAMPAIGN_PALETTE.textMuted}
                fontWeight={isTarget100 ? '700' : '400'}
                fontSize="10"
              >
                {pctVal}%{isTarget100 ? ' 目标' : ''}
              </text>
            </g>
          );
        })}

        {data.map((item, idx) => {
          const y = topPad + idx * rowHeight;
          const isSelected = activeIdx === idx;
          const ev = evaluations[idx];
          const hasRatio = ev.ratio !== null;
          const isZero = ev.hasActual && item.actual === 0;

          // 0 实际不画正宽度
          const barWidth = hasRatio && !isZero ? Math.max(3, (ev.ratio! / maxRatioVal) * plotWidth) : 0;

          return (
            <g
              key={item.label || idx}
              tabIndex={0}
              role="button"
              aria-label={`${item.label}: 实际 ${fmtNum(item.actual)}${item.unit || ''}，目标 ${fmtNum(item.target)}${item.unit || ''} [${ev.statusLabel}]`}
              onMouseEnter={() => setActiveIdx(idx)}
              onFocus={() => setActiveIdx(idx)}
              onBlur={() => setActiveIdx(null)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIdx(Math.min(data.length - 1, idx + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIdx(Math.max(0, idx - 1));
                }
              }}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              <rect
                x={0}
                y={y}
                width={totalWidth}
                height={rowHeight - 6}
                fill={isSelected ? 'rgba(44, 113, 104, 0.05)' : 'transparent'}
                rx={4}
              />

              <text
                x={leftPad - 12}
                y={y + 16}
                textAnchor="end"
                fill={isSelected ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.textMain}
                fontWeight={isSelected ? '600' : '500'}
                fontSize="12"
              >
                {item.label.length > 10 ? `${item.label.slice(0, 10)}…` : item.label}
                <title>{item.label}</title>
              </text>
              <text
                x={leftPad - 12}
                y={y + 28}
                textAnchor="end"
                fill={CAMPAIGN_PALETTE.textMuted}
                fontSize="10"
              >
                {ev.directionNote}
              </text>

              <rect
                x={leftPad}
                y={y + 8}
                width={plotWidth}
                height={14}
                rx={3}
                fill="#f8fafc"
                stroke="#e2e8f0"
              />

              {hasRatio ? (
                isZero ? (
                  <>
                    <line
                      x1={leftPad}
                      x2={leftPad}
                      y1={y + 6}
                      y2={y + 24}
                      stroke={CAMPAIGN_PALETTE.slate}
                      strokeWidth="2.5"
                    />
                    <text
                      x={leftPad + 8}
                      y={y + 20}
                      textAnchor="start"
                      fill={ev.barColor}
                      fontWeight="700"
                      fontSize="11"
                    >
                      0%
                      <tspan fill={CAMPAIGN_PALETTE.textMuted} fontSize="10" fontWeight="400">
                        {` (${ev.statusLabel})`}
                      </tspan>
                    </text>
                  </>
                ) : (
                  <>
                    <rect
                      x={leftPad}
                      y={y + 9}
                      width={barWidth}
                      height={12}
                      rx={2.5}
                      fill={ev.barColor}
                      opacity={isSelected ? 1 : 0.88}
                    />
                    <text
                      x={leftPad + barWidth + 8}
                      y={y + 20}
                      textAnchor="start"
                      fill={ev.barColor}
                      fontWeight="700"
                      fontSize="11.5"
                    >
                      {ev.ratio!.toFixed(0)}%
                      <tspan fill={CAMPAIGN_PALETTE.textMuted} fontSize="10" fontWeight="400">
                        {` (${ev.statusLabel})`}
                      </tspan>
                    </text>
                  </>
                )
              ) : (
                <text
                  x={leftPad + 10}
                  y={y + 19}
                  fill={CAMPAIGN_PALETTE.textSubtle}
                  fontSize="10.5"
                >
                  {item.target === null ? '目标未设定' : '实际值待登记'}
                </text>
              )}

              {/* 100% 关键目标线 (加粗黑线) */}
              <line
                x1={targetX100}
                x2={targetX100}
                y1={y + 4}
                y2={y + 26}
                stroke="#0f172a"
                strokeWidth="2.5"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================================
// 7. ScatterChart 散点分布图 (象限/规模/交互 tooltip, 真实坐标, 固定Readout)
// ============================================================================

export function ScatterChart({
  data,
  xLabel,
  yLabel,
}: {
  data: Array<{ label: string; x: number | null; y: number | null; size: number | null; detail?: string }>;
  xLabel: string;
  yLabel: string;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">暂无可绘制的散点坐标数据</div>
        <div className="ca-empty-hint">待提取多维指标相关性后自动呈现分布</div>
      </div>
    );
  }

  const validPoints = data.filter(
    (d): d is { label: string; x: number; y: number; size: number | null; detail?: string } =>
      typeof d.x === 'number' && Number.isFinite(d.x) && typeof d.y === 'number' && Number.isFinite(d.y)
  );

  if (validPoints.length === 0) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">缺乏成对的有效 X/Y 观测值</div>
        <div className="ca-empty-hint">缺失坐标不强制补零绘制</div>
      </div>
    );
  }

  const xVals = validPoints.map((p) => p.x);
  const yVals = validPoints.map((p) => p.y);

  const minXRaw = Math.min(...xVals);
  const maxXRaw = Math.max(...xVals);
  const minYRaw = Math.min(...yVals);
  const maxYRaw = Math.max(...yVals);

  const padX = maxXRaw === minXRaw ? Math.max(1, maxXRaw * 0.1) : (maxXRaw - minXRaw) * 0.12;
  const padY = maxYRaw === minYRaw ? Math.max(1, maxYRaw * 0.1) : (maxYRaw - minYRaw) * 0.12;

  const minX = Math.max(0, minXRaw - padX);
  const maxX = maxXRaw + padX;
  const minY = Math.max(0, minYRaw - padY);
  const maxY = maxYRaw + padY;

  const leftPad = 60;
  const rightPad = 28;
  const topPad = 24;
  const bottomPad = 42;
  const totalWidth = 600;
  const totalHeight = 280;
  const plotW = totalWidth - leftPad - rightPad;
  const plotH = totalHeight - topPad - bottomPad;

  const scaleX = (v: number) => leftPad + ((v - minX) / (maxX - minX || 1)) * plotW;
  const scaleY = (v: number) => totalHeight - bottomPad - ((v - minY) / (maxY - minY || 1)) * plotH;

  const sizes = validPoints.map((p) => p.size).filter((s): s is number => typeof s === 'number' && s > 0);
  const minSize = sizes.length ? Math.min(...sizes) : 1;
  const maxSize = sizes.length ? Math.max(...sizes) : 1;
  const getRadius = (s: number | null) => {
    if (s === null || minSize === maxSize) return 7;
    return 5 + ((s - minSize) / (maxSize - minSize)) * 11;
  };

  const avgX = xVals.reduce((a, b) => a + b, 0) / xVals.length;
  const avgY = yVals.reduce((a, b) => a + b, 0) / yVals.length;

  const current = activeIdx !== null && activeIdx < validPoints.length ? validPoints[activeIdx] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div className="ca-chart-readout" aria-live="polite">
        {current ? (
          <>
            <strong>{current.detail || current.label}</strong>
            <span>{xLabel}: {fmtNum(current.x)}</span>
            <span>{yLabel}: {fmtNum(current.y)}</span>
            {current.size !== null && <span>规模: {fmtNum(current.size)}</span>}
          </>
        ) : (
          <span className="ca-chart-readout-empty">
            悬停散点或使用左右键聚焦查看多维坐标准确数值
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="ca-chart-svg"
        role="graphics-document"
        aria-label={`散点相关图，${validPoints.length} 个观测样本`}
        onMouseLeave={() => setActiveIdx(null)}
      >
        <title>{`散点相关图: 横轴 ${xLabel}，纵轴 ${yLabel}`}</title>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const val = minX + t * (maxX - minX);
          const xPos = scaleX(val);
          return (
            <g key={`x-${t}`}>
              <line
                x1={xPos}
                x2={xPos}
                y1={topPad}
                y2={totalHeight - bottomPad}
                stroke={CAMPAIGN_PALETTE.gridLine}
                strokeDasharray="3 3"
              />
              <text
                x={xPos}
                y={totalHeight - bottomPad + 16}
                textAnchor="middle"
                fill={CAMPAIGN_PALETTE.textMuted}
                fontSize="10"
              >
                {fmtNum(val, 1)}
              </text>
            </g>
          );
        })}

        {[0, 0.33, 0.66, 1].map((t) => {
          const val = minY + t * (maxY - minY);
          const yPos = scaleY(val);
          return (
            <g key={`y-${t}`}>
              <line
                x1={leftPad}
                x2={totalWidth - rightPad}
                y1={yPos}
                y2={yPos}
                stroke={CAMPAIGN_PALETTE.gridLine}
                strokeDasharray="3 3"
              />
              <text
                x={leftPad - 8}
                y={yPos + 3.5}
                textAnchor="end"
                fill={CAMPAIGN_PALETTE.textMuted}
                fontSize="10"
              >
                {fmtNum(val, 1)}
              </text>
            </g>
          );
        })}

        <line
          x1={scaleX(avgX)}
          x2={scaleX(avgX)}
          y1={topPad}
          y2={totalHeight - bottomPad}
          stroke="#cbd5e1"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <line
          x1={leftPad}
          x2={totalWidth - rightPad}
          y1={scaleY(avgY)}
          y2={scaleY(avgY)}
          stroke="#cbd5e1"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />

        <text
          x={totalWidth / 2}
          y={totalHeight - 6}
          textAnchor="middle"
          fill={CAMPAIGN_PALETTE.textMain}
          fontWeight="600"
          fontSize="11"
        >
          {xLabel} →
        </text>
        <text
          x={leftPad - 8}
          y={topPad - 8}
          textAnchor="start"
          fill={CAMPAIGN_PALETTE.textMain}
          fontWeight="600"
          fontSize="11"
        >
          ↑ {yLabel}
        </text>

        {validPoints.map((pt, idx) => {
          const px = scaleX(pt.x);
          const py = scaleY(pt.y);
          const isSelected = activeIdx === idx;
          const r = getRadius(pt.size);

          return (
            <g
              key={pt.label || idx}
              tabIndex={0}
              role="button"
              aria-label={`${pt.label}: ${xLabel}=${fmtNum(pt.x)}, ${yLabel}=${fmtNum(pt.y)}`}
              onMouseEnter={() => setActiveIdx(idx)}
              onFocus={() => setActiveIdx(idx)}
              onBlur={() => setActiveIdx(null)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIdx((idx + 1) % validPoints.length);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIdx((idx - 1 + validPoints.length) % validPoints.length);
                }
              }}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              {isSelected && (
                <circle
                  cx={px}
                  cy={py}
                  r={r + 6}
                  fill="rgba(44, 113, 104, 0.18)"
                  stroke={CAMPAIGN_PALETTE.primary}
                  strokeWidth="1.5"
                />
              )}
              <circle
                cx={px}
                cy={py}
                r={isSelected ? r + 1 : r}
                fill={isSelected ? CAMPAIGN_PALETTE.gold : 'rgba(44, 113, 104, 0.8)'}
                stroke="#ffffff"
                strokeWidth="1.5"
              >
                <title>{`${pt.detail || pt.label}\n${xLabel}: ${fmtNum(pt.x)}\n${yLabel}: ${fmtNum(pt.y)}`}</title>
              </circle>
              {(validPoints.length <= 15 || isSelected) && (
                <text
                  x={px}
                  y={py - r - 3}
                  textAnchor="middle"
                  fill={isSelected ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.textMuted}
                  fontSize={isSelected ? '11' : '9.5'}
                  fontWeight={isSelected ? '600' : '400'}
                  pointerEvents="none"
                >
                  {pt.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
