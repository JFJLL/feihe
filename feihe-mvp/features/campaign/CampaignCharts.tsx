'use client';

import React, { useState, useId, useEffect, useRef, useCallback } from 'react';
import './campaign-analytics.css';

/**
 * 营销分析图表统一调色板
 * 暖白底色 #f6f5f2, 主深青 #2c7168, 辅助紫 #8273a3, 赭金 #b88a45, 陶土 #bd7964, 计划灰 #8c9ba5
 */
export const CAMPAIGN_PALETTE = {
  primary: '#12a594',    // 主深青 (Radix teal-9)
  purple: '#5b5bd6',     // 辅助紫 (Radix iris-9)
  gold: '#ab6400',       // 赭金 (Radix amber-11, 增强12px可读性)
  terracotta: '#e5484d', // 陶土 (Radix red-9)
  slate: '#8b8d98',      // 计划灰 (Radix slate-9)
  warmBg: '#f9f9fb',     // 暖白底色 (Radix slate-2)
  panelBg: '#ffffff',    // 卡片白
  textMain: '#1c2024',   // 深灰主文字 (Radix slate-12)
  textMuted: '#60646c',  // 次级辅助文字 (Radix slate-11)
  textSubtle: '#8b8d98', // 弱化占位文字 (Radix slate-9)
  border: '#d9d9e0',     // 结构边框 (Radix slate-6)
  borderWarm: '#d9d9e0', // 暖色微边框 (Radix slate-6)
  gridLine: '#e8e8ec',   // 坐标网格线 (Radix slate-4)
} as const;

export const DEFAULT_SERIES_COLORS = [
  CAMPAIGN_PALETTE.primary,
  CAMPAIGN_PALETTE.purple,
  CAMPAIGN_PALETTE.gold,
  CAMPAIGN_PALETTE.terracotta,
  '#0090ff',
  '#29a383',
  CAMPAIGN_PALETTE.slate,
];

/**
 * 测量容器实际像素宽度，驱动 SVG 与复杂排版 1:1 响应式渲染，
 * 确保移动端（如 390px 视口，容器约 275px）字号不被按比例等比缩放至 12px 以下。
 * 采用稳定 callback ref 模式：节点挂载/换节点时自动 attach 测宽与监听，节点卸载或空态时自动 disconnect。
 * SSR 阶段返回 defaultWidth，保障服务端渲染与快照测试一致。
 */
export function useMeasuredWidth(defaultWidth = 600) {
  const [containerWidth, setContainerWidth] = useState<number>(defaultWidth);
  const roRef = useRef<ResizeObserver | null>(null);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }

    if (!node) return;

    const measure = () => {
      if (typeof node.getBoundingClientRect === 'function') {
        const rect = node.getBoundingClientRect();
        const w = rect && typeof rect.width === 'number' ? rect.width : 0;
        if (w > 0) setContainerWidth(Math.round(w));
      }
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect ? entry.contentRect.width : 0;
          if (w > 0) setContainerWidth(Math.round(w));
        }
      });
      ro.observe(node);
      roRef.current = ro;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (roRef.current) {
        roRef.current.disconnect();
        roRef.current = null;
      }
    };
  }, []);

  return { containerRef, containerWidth };
}

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

// ============================================================================
// 1. MetricStrip 紧凑指标条 (首屏 4 简洁指标，移动端 390 紧凑 2 列，防止大数溢出)
// ============================================================================

export interface MetricStripItem {
  label: string;
  value?: string | number | null;
  unit?: string;
  note?: string;
  meta?: string;
  hint?: string;
  badge?: string;
  category?: 'brand' | 'cid' | 'commerce' | 'creators';
  status?: 'default' | 'accent' | 'warning' | 'danger' | 'success' | 'neutral';
  sparkline?: (number | null)[];
}

function renderMiniSparklineSvg(
  points: (number | null)[],
  width = 96,
  height = 20,
  strokeColor = '#12a594',
  gradId?: string,
) {
  const valid = points.filter((p): p is number => p !== null && Number.isFinite(p));
  if (valid.length < 2) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max === min ? 1 : max - min;
  const step = width / (points.length - 1);
  const pad = 2;
  const innerH = height - pad * 2;

  let d = '';
  let firstX = 0;
  let lastX = 0;
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
      firstX = x;
      inLine = true;
    } else {
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    lastX = x;
  });

  if (!d) return null;

  const areaD = `${d} L ${lastX.toFixed(1)} ${height} L ${firstX.toFixed(1)} ${height} Z`;
  const resolvedGradId = gradId || `ca-spark-grad-${strokeColor.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div style={{ width: '100%', height: `${height}px`, marginTop: '4px', opacity: 0.9 }} aria-hidden="true">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={resolvedGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${resolvedGradId})`} />
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
  const baseId = useId();
  if (!items || items.length === 0) return null;

  return (
    <div className="ca-metric-strip bd-kpi-grid-rich" role="region" aria-label="核心指标统计概览"
      style={{ '--metric-columns': items.length <= 5 ? items.length : items.length === 6 ? 3 : 4 } as React.CSSProperties}>
      {items.map((it, idx) => {
        const isMissing = it.value === null || it.value === undefined;
        let formatted = '—';
        if (!isMissing) {
          formatted = typeof it.value === 'number' ? fmtNum(it.value) : String(it.value);
        }
        const subText = it.note || it.meta || it.hint;
        const statusColor =
          it.status === 'danger'
            ? CAMPAIGN_PALETTE.terracotta
            : it.status === 'warning'
            ? CAMPAIGN_PALETTE.gold
            : it.status === 'accent' || it.status === 'success'
            ? CAMPAIGN_PALETTE.primary
            : undefined;

        // Micro progress detection: either metric value itself has % or note specifies progress
        let progressPct: number | null = null;
        if (typeof it.value === 'number' && it.unit === '%' && it.value >= 0 && Number.isFinite(it.value)) {
          progressPct = Math.min(100, Math.max(0, it.value));
        } else if (
          typeof it.value === 'string' &&
          it.value.trim().endsWith('%') &&
          /(?:进度|达成|完成率)/.test(it.label)
        ) {
          const valNum = parseFloat(it.value);
          if (Number.isFinite(valNum) && valNum >= 0) progressPct = Math.min(100, valNum);
        } else if (subText) {
          const m = subText.match(/(?:进度|达成|完成率?|执行)\s*([\d.]+)%/);
          if (m) {
            const p = parseFloat(m[1]);
            if (Number.isFinite(p) && p >= 0) progressPct = Math.min(100, p);
          }
        }

        const renderNoteContent = (text: string) => {
          if (!/(?:较前|环比|同比|较上)/.test(text)) return text;
          const m = text.match(/(?<![\d/.])([+-]\s*\d[\d,]*(?:\.\d+)?%?)/);
          if (!m) return text;
          const diff = m[1];
          const isUp = diff.startsWith('+');
          const parts = text.split(diff);
          return (
            <>
              {parts[0]}
              <span className={`ca-trend-pill ${isUp ? 'ca-trend-up' : 'ca-trend-down'}`}>
                {diff}
              </span>
              {parts.slice(1).join(diff)}
            </>
          );
        };

        const badgeBackground = it.category
          ? 'var(--metric-category-badge-bg)'
          : statusColor
          ? `${statusColor}18`
          : '#f0f0f3';

        const badgeTextColor = it.category
          ? 'var(--metric-category-ink)'
          : statusColor || CAMPAIGN_PALETTE.textMuted;

        const sparklineStroke = it.category
          ? 'var(--metric-category-ink)'
          : CAMPAIGN_PALETTE.primary;
        const sparklineGradId = `ca-spark-grad-${baseId.replace(/[^a-zA-Z0-9_-]/g, '')}-${idx}`;

        const progressBarBackground = it.category
          ? 'var(--metric-category-ink)'
          : statusColor || (progressPct !== null && progressPct >= 100 ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.gold);

        return (
          <article
            key={idx}
            className="ca-metric-item bd-kpi-card-rich"
            data-category={it.category}
          >
            <div className="bd-kpi-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <span className="ca-metric-label" title={it.label}>{it.label}</span>
              {it.badge && (
                <span
                  className="ca-metric-badge"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 999,
                    background: badgeBackground,
                    color: badgeTextColor,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {it.badge}
                </span>
              )}
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
            {it.sparkline && renderMiniSparklineSvg(it.sparkline, 96, 20, sparklineStroke, sparklineGradId)}
            {progressPct !== null && (
              <div className="ca-metric-progress-track" title={`达成进度 ${progressPct.toFixed(1)}%`}>
                <div
                  className="ca-metric-progress-bar"
                  style={{
                    width: `${Math.min(100, Math.max(0, progressPct))}%`,
                    background: progressBarBackground,
                  }}
                />
              </div>
            )}
            {subText && <p className="ca-metric-note bd-kpi-sub" title={subText}>{renderNoteContent(subText)}</p>}
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
  const { containerRef, containerWidth } = useMeasuredWidth(620);

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
  const isNarrow = containerWidth < 420;
  const leftPad = isNarrow ? Math.max(72, Math.min(96, Math.round(containerWidth * 0.28))) : 130;
  const rightPad = isNarrow ? 56 : 80;
  const topPad = 16;
  const bottomPad = 26;
  const totalWidth = Math.max(260, containerWidth);

  // 动态确保每行至少 34px，height 较小（如 190 配 9 行）依 rowcount 自适应扩展，彻底杜绝底部截切
  const minNeededHeight = data.length * 36 + topPad + bottomPad;
  const totalHeight = Math.max(height || minNeededHeight, minNeededHeight);
  const rowHeight = (totalHeight - topPad - bottomPad) / Math.max(1, data.length);
  const barPlotWidth = totalWidth - leftPad - rightPad;

  const current = activeIdx !== null && activeIdx < data.length ? data[activeIdx] : null;
  const tickRatios = isNarrow ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {/* 固定高度 Readout，未悬停保持占位，绝不推挤 SVG 造成页面跳动 */}
      <div className="ca-chart-readout" aria-live="polite">
        {current ? (
          <>
            <span>当前聚焦:</span>
            <strong>{current.label}</strong>
            <span>
              {current.value !== null ? `${fmtNum(current.value)} ${unit}` : '实际未录入'}
            </span>
            {current.detail && <span style={{ color: '#60646c' }}>({current.detail})</span>}
          </>
        ) : (
          <span className="ca-chart-readout-empty" aria-hidden="true" />
        )}
      </div>

      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="ca-chart-svg"
        style={{ minWidth: `${totalWidth}px`, width: '100%' }}
        role="graphics-document"
        aria-label={`横向对比图，共 ${data.length} 项`}
        onMouseLeave={() => setActiveIdx(null)}
      >
        <title>{`横向对比图，共 ${data.length} 项。悬停或键盘聚焦查看数值。`}</title>
        {tickRatios.map((ratio) => {
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
                fontSize="12"
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
          // 0 实际不画正宽度，真实比例不放大
          const barWidth = hasVal && item.value! > 0 && maxVal > 0 ? (item.value! / maxVal) * barPlotWidth : 0;
          const color = item.color || DEFAULT_SERIES_COLORS[idx % DEFAULT_SERIES_COLORS.length];

          return (
            <g
              key={item.id || item.label || idx}
              tabIndex={0}
              role="button"
              onClick={() => setActiveIdx(idx)}
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
                {item.label.length > (isNarrow ? 6 : 11) ? `${item.label.slice(0, isNarrow ? 6 : 11)}…` : item.label}
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
                      fontSize="12"
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
                      fontSize="12"
                    >
                      {fmtNum(item.value)}
                      {unit && <tspan fill={CAMPAIGN_PALETTE.textMuted} fontSize="12"> {unit}</tspan>}
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
                    stroke="#d9d9e0"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={leftPad + 8}
                    y={y + 18}
                    fill={CAMPAIGN_PALETTE.textSubtle}
                    fontSize="12"
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
// 8. CampaignFunnelChart 全链路转化漏斗与节点成本效率图
// ============================================================================

export interface FunnelStageDatum {
  stage: string;
  value: number | null;
  unit?: string;
  conversionLabel?: string;
  costLabel?: string;
  subtext?: string;
  color?: string;
}

export function CampaignFunnelChart({
  stages,
}: {
  stages: FunnelStageDatum[];
}) {
  if (!stages || stages.length === 0) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">暂无转化漏斗数据</div>
      </div>
    );
  }

  const validValues = stages
    .map((s) => s.value)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  const maxLog = validValues.length > 0 ? Math.max(...validValues.map((v) => Math.log10(v + 1))) : 1;

  return (
    <div className="ca-funnel-list" role="list" aria-label="指标节点明细">
      {stages.map((st, idx) => {
        const val = typeof st.value === 'number' && Number.isFinite(st.value) ? st.value : null;
        // 使用对数平滑宽度，避免曝光(百万级)与订单(百/千级)同屏时末端退化为不可见细线
        const ratio = val !== null && val > 0 && maxLog > 0 ? Math.log10(val + 1) / maxLog : 0;
        const barColor = st.color || DEFAULT_SERIES_COLORS[idx % DEFAULT_SERIES_COLORS.length];
        return (
          <div
            key={st.stage || idx}
            role="listitem"
            className="ca-funnel-row"
            style={{
              padding: '8px 12px',
              background: '#f9f9fb',
              border: `0.5px solid ${CAMPAIGN_PALETTE.borderWarm}`,
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: `${barColor}1f`,
                    color: barColor,
                  }}
                >
                  {idx + 1}
                </span>
                <strong style={{ fontSize: 12, color: CAMPAIGN_PALETTE.textMain }}>{st.stage}</strong>
              </div>
              {st.subtext && (
                <span style={{ fontSize: 12, color: CAMPAIGN_PALETTE.textMuted, paddingLeft: 24 }}>{st.subtext}</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  width: '100%',
                  height: 16,
                  background: '#f0f0f3',
                  borderRadius: 999,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: val !== null ? `${(ratio * 100).toFixed(1)}%` : '0%',
                    height: '100%',
                    background: barColor,
                    borderRadius: 999,
                    transition: 'width 0.25s ease',
                  }}
                />
              </div>
              {st.conversionLabel && (
                <span style={{ fontSize: 12, color: CAMPAIGN_PALETTE.textMuted }}>
                  {st.conversionLabel}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: CAMPAIGN_PALETTE.textMain }}>
                {val !== null ? fmtNum(val, val >= 100 ? 0 : 2) : '—'}
                {st.unit && <small style={{ fontSize: 12, fontWeight: 500, color: CAMPAIGN_PALETTE.textMuted, marginLeft: 3 }}>{st.unit}</small>}
              </div>
              {st.costLabel && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '1px 7px',
                    borderRadius: 999,
                    background: `${barColor}15`,
                    color: barColor,
                  }}
                >
                  {st.costLabel}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <small className="ca-scale-note">条长为对数刻度；不同单位的节点独立查看，不代表逐级转化率。</small>
    </div>
  );
}

// ============================================================================
// 9. MatrixHeatmapChart 二维交叉热力矩阵图 (产品×阶段 / 平台×阶段 / 性别×年龄 / 量级×方向)
// ============================================================================

export interface MatrixHeatmapCell {
  row: string;
  col: string;
  value: number | null;
  displayValue?: string;
  subtext?: string;
}

export function MatrixHeatmapChart({
  rows,
  cols,
  cells,
  unit = '',
  rowHeaderTitle = '维度',
  showRowTotals = true,
}: {
  rows: string[];
  cols: string[];
  cells: MatrixHeatmapCell[];
  unit?: string;
  rowHeaderTitle?: string;
  showRowTotals?: boolean;
}) {
  if (!rows.length || !cols.length) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">暂无交叉矩阵数据</div>
      </div>
    );
  }

  const cellMap = new Map<string, MatrixHeatmapCell>();
  let maxVal = 0;
  for (const c of cells) {
    cellMap.set(`${c.row}__${c.col}`, c);
    if (typeof c.value === 'number' && Number.isFinite(c.value) && c.value > maxVal) {
      maxVal = c.value;
    }
  }

  return (
    <div className="ca-table-wrap ca-matrix-wrap" style={{ overflowX: 'auto' }}>
      <table className="ca-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 8px', background: '#f9f9fb', borderRadius: 4 }}>{rowHeaderTitle}</th>
            {cols.map((col) => (
              <th key={col} style={{ textAlign: 'center', padding: '6px 8px', background: '#f9f9fb', borderRadius: 4, whiteSpace: 'nowrap' }}>
                {col}
              </th>
            ))}
            {showRowTotals && (
              <th style={{ textAlign: 'right', padding: '6px 8px', background: '#f0f0f3', borderRadius: 4, whiteSpace: 'nowrap' }}>
                行合计
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rowValues = cols.map(c => cellMap.get(`${r}__${c}`)?.value);
            const complete = rowValues.every(v => typeof v === 'number' && Number.isFinite(v));
            const rowSum = complete ? (rowValues as number[]).reduce((sum, value) => sum + value, 0) : null;
            return (
              <tr key={r}>
                <td style={{ fontWeight: 600, padding: '6px 8px', color: CAMPAIGN_PALETTE.textMain, background: '#f9f9fb', whiteSpace: 'nowrap' }}>
                  {r}
                </td>
                {cols.map((c) => {
                  const cell = cellMap.get(`${r}__${c}`);
                  const val = cell && typeof cell.value === 'number' && Number.isFinite(cell.value) ? cell.value : null;
                  const intensity = val !== null && val > 0 && maxVal > 0 ? Math.min(1, Math.max(0.08, val / maxVal)) : 0;
                  const bg =
                    intensity > 0
                      ? `rgba(44, 113, 104, ${(0.08 + intensity * 0.72).toFixed(2)})`
                      : '#f9f9fb';
                  const fg = intensity > 0.55 ? '#ffffff' : CAMPAIGN_PALETTE.textMain;
                  return (
                    <td
                      key={c}
                      title={cell?.subtext || `${r} × ${c}: ${val !== null ? fmtNum(val) + unit : '—'}`}
                      style={{
                        textAlign: 'center',
                        padding: '6px 8px',
                        borderRadius: 5,
                        background: bg,
                        color: fg,
                        fontWeight: val && val > 0 ? 600 : 400,
                      }}
                    >
                      <div>{val === null ? '—' : cell?.displayValue ?? `${fmtNum(val)}${unit}`}</div>
                      {cell?.subtext && (
                        <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 400 }}>{cell.subtext}</div>
                      )}
                    </td>
                  );
                })}
                {showRowTotals && (
                  <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, background: '#f9f9fb', borderRadius: 4, whiteSpace: 'nowrap' }}>
                    {rowSum !== null ? `${fmtNum(rowSum)}${unit}` : '—'}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// 10. StackedHorizontalBarChart 堆叠/分组结构条形图 (K+FS构成 / 自然+推广+加热流量 / 阶段状态结构)
// ============================================================================

export interface StackedBarSegment {
  key: string;
  label: string;
  color: string;
}

export interface StackedBarRow {
  label: string;
  totalLabel?: string;
  segments: Record<string, number | null>;
  meta?: string;
}

export function StackedHorizontalBarChart({
  rows,
  segments,
  unit = '',
  normalize100 = false,
}: {
  rows: StackedBarRow[];
  segments: StackedBarSegment[];
  unit?: string;
  normalize100?: boolean;
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">暂无构成对比数据</div>
      </div>
    );
  }

  const rowTotals = rows.map((r) =>
    segments.reduce((acc, s) => {
      const v = r.segments[s.key];
      return acc + (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
    }, 0)
  );
  const maxTotal = Math.max(1, ...rowTotals);

  return (
    <div className="ca-stacked-chart">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: CAMPAIGN_PALETTE.textMuted }}>
        {segments.map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="ca-stacked-rows">
        {rows.map((r, i) => {
          const total = rowTotals[i];
          const complete = segments.length > 0 && segments.every(s => {
            const value = r.segments[s.key];
            return typeof value === 'number' && Number.isFinite(value) && value >= 0;
          });
          const denom = normalize100 ? (total || 1) : maxTotal;
          return (
            <div
              key={r.label || i}
              className="ca-stacked-row"
            >
              <div style={{ fontWeight: 600, color: CAMPAIGN_PALETTE.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>
                {r.label}
              </div>
              <div className="ca-stacked-track" style={{ display: 'flex', height: 18, background: '#f0f0f3', borderRadius: 6, overflow: 'hidden' }}>
                {segments.map((s) => {
                  const v = r.segments[s.key];
                  const num = typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
                  const pct = normalize100 && !complete ? 0 : (num / denom) * 100;
                  if (pct <= 0) return null;
                  const sharePct = total > 0 ? ((num / total) * 100).toFixed(1) : '0.0';
                  return (
                    <div
                      key={s.key}
                      title={`${r.label} / ${s.label}: ${fmtNum(num)}${unit}${complete ? ` (${sharePct}%)` : '（部分数据）'}`}
                      style={{
                        width: `${pct.toFixed(2)}%`,
                        background: s.color,
                        height: '100%',
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: CAMPAIGN_PALETTE.textMain, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {r.totalLabel || (complete ? `${fmtNum(total)}${unit}` : '— (数据不完整)')}
                {r.meta && <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: CAMPAIGN_PALETTE.textMuted }}>{r.meta}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <small className="ca-scale-note">左右独立刻度</small>
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
              fontSize="12"
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
              fontSize="12"
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexShrink: 0 }}>
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

export function BudgetComparisonChart({ data, unit = '元' }: {
  data: ComparisonDatum[];
  unit?: string;
}) {
  if (!data?.length) return <div className="ca-empty">暂无预算对比数据</div>;
  const finite = (value: number | null): value is number => typeof value === 'number' && Number.isFinite(value);
  const maxValue = Math.max(1, ...data.flatMap(row => [row.actual, row.target].filter(finite))) * 1.08;
  return (
    <div className="ca-budget-chart" role="group" aria-label={`预算对比图，共 ${data.length} 项`}>
      <div className="ca-chart-legend">
        <span className="ca-chart-legend-item"><span className="ca-chart-swatch" style={{ background: CAMPAIGN_PALETTE.primary }} />实际消耗</span>
        <span className="ca-chart-legend-item"><span className="ca-chart-swatch" style={{ background: CAMPAIGN_PALETTE.terracotta }} />超支消耗</span>
        <span className="ca-chart-legend-item">虚线：100% 预算目标</span>
      </div>
      <div className="ca-budget-rows">
        {data.map((row, index) => {
          const actual = finite(row.actual) ? row.actual : null;
          const target = finite(row.target) && row.target >= 0 ? row.target : null;
          const overrun = actual !== null && target !== null && actual > target;
          const color = overrun ? CAMPAIGN_PALETTE.terracotta : CAMPAIGN_PALETTE.primary;
          const width = actual !== null ? Math.max(0, actual) / maxValue * 100 : 0;
            const ratioStr = actual !== null && target !== null && target > 0 ? ((actual / target) * 100).toFixed(1) : null;
          return (
            <div key={`${row.label}-${index}`} className="ca-budget-row">
              <div className="ca-budget-row-heading">
                <strong>{row.label}</strong>
                  <span style={{ color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {actual === null ? '未录入' : `${fmtNum(actual)} ${unit}`}
                    {ratioStr && (
                      <span className={`ca-budget-pct-pill ${overrun ? 'ca-budget-pct-overrun' : 'ca-budget-pct-normal'}`}>
                        {ratioStr}%
                      </span>
                    )}
                    {overrun && <b>↑超支</b>}
                  </span>
              </div>
              <div className="ca-budget-track" role="img" aria-label={`${row.label}：实际 ${actual === null ? '未录入' : fmtNum(actual)}，预算 ${target === null ? '未录入' : fmtNum(target)}`}>
                {target !== null && <span className="ca-budget-target-fill" style={{ width: `${target / maxValue * 100}%` }} />}
                <span className="ca-budget-actual" data-value={actual ?? 'missing'} style={{ width: `${width}%`, background: color }} />
                {target !== null && <span className="ca-budget-target-mark" style={{ left: `${target / maxValue * 100}%` }} />}
              </div>
              <div className="ca-budget-row-detail">
                <span>{target === null ? '预算未录入' : `预算 ${fmtNum(target)} ${unit}`}</span>
                <span>{actual === null || target === null ? '暂不可判断预算执行' : overrun ? `超支 ${fmtNum(actual - target)} ${unit}` : `结余 ${fmtNum(target - actual)} ${unit}`}</span>
              </div>
            </div>
          );
        })}
      </div>
      <small className="ca-scale-note">按同一金额刻度对比，虚线标记各项预算上限。</small>
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
  const { containerRef, containerWidth } = useMeasuredWidth(640);

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

  const isNarrow = containerWidth < 460;
  const leftPad = isNarrow ? Math.max(76, Math.min(100, Math.round(containerWidth * 0.3))) : 140;
  const rightPad = isNarrow ? 56 : 90;
  const topPad = 28;
  const bottomPad = 26;
  const rowHeight = 46;
  const totalWidth = Math.max(260, containerWidth);
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
  const ticks = isNarrow
    ? [0, 100].filter((v) => v <= maxRatioVal)
    : [0, 50, 100, 150].filter((v) => v <= maxRatioVal);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
          <span className="ca-chart-swatch-line" style={{ background: '#1c2024' }} />
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
            <span style={{ color: '#60646c' }}>({currentEval.directionNote})</span>
          </>
        ) : (
          <span className="ca-chart-readout-empty" aria-hidden="true" />
        )}
      </div>

      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="ca-chart-svg"
        style={{ minWidth: `${totalWidth}px`, width: '100%' }}
        role="graphics-document"
        aria-label={`目标靶心图，共 ${data.length} 项指标`}
        onMouseLeave={() => setActiveIdx(null)}
      >
        <title>{`归一化目标靶心图，100% 为目标达成线，多指标统一归一化刻度。`}</title>
        {ticks.map((pctVal) => {
          const xPos = leftPad + (pctVal / maxRatioVal) * plotWidth;
          const isTarget100 = pctVal === 100;
          return (
            <g key={pctVal}>
              <line
                x1={xPos}
                x2={xPos}
                y1={topPad}
                y2={totalHeight - bottomPad}
                stroke={isTarget100 ? '#8b8d98' : CAMPAIGN_PALETTE.gridLine}
                strokeWidth={isTarget100 ? 1.5 : 1}
                strokeDasharray={isTarget100 ? '4 2' : '3 3'}
              />
              <text
                x={xPos}
                y={totalHeight - 8}
                textAnchor="middle"
                fill={isTarget100 ? CAMPAIGN_PALETTE.textMain : CAMPAIGN_PALETTE.textMuted}
                fontWeight={isTarget100 ? '700' : '400'}
                fontSize="12"
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

          // 0 实际不画正宽度，真实比例不放大
          const barWidth = hasRatio && ev.ratio! > 0 && maxRatioVal > 0 ? (ev.ratio! / maxRatioVal) * plotWidth : 0;

          return (
            <g
              key={item.label || idx}
              tabIndex={0}
              role="button"
              onClick={() => setActiveIdx(idx)}
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
                {item.label.length > (isNarrow ? 6 : 10) ? `${item.label.slice(0, isNarrow ? 6 : 10)}…` : item.label}
                <title>{item.label}</title>
              </text>
              <text
                x={leftPad - 12}
                y={y + 28}
                textAnchor="end"
                fill={CAMPAIGN_PALETTE.textMuted}
                fontSize="12"
              >
                {ev.directionNote}
              </text>

              <rect
                x={leftPad}
                y={y + 8}
                width={plotWidth}
                height={14}
                rx={3}
                fill="#f9f9fb"
                stroke="#e8e8ec"
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
                      fontSize="12"
                    >
                      0%
                      <tspan fill={CAMPAIGN_PALETTE.textMuted} fontSize="12" fontWeight="400">
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
                      fontSize="12"
                    >
                      {ev.ratio!.toFixed(0)}%
                      <tspan fill={CAMPAIGN_PALETTE.textMuted} fontSize="12" fontWeight="400">
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
                  fontSize="12"
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
                stroke="#1c2024"
                strokeWidth="2.5"
              />
              <circle cx={targetX100} cy={y + 4} r={1.5} fill="#1c2024" />
              <circle cx={targetX100} cy={y + 26} r={1.5} fill="#1c2024" />
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
  const { containerRef, containerWidth } = useMeasuredWidth(600);

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

  const isNarrow = containerWidth < 420;
  const leftPad = isNarrow ? 48 : 60;
  const rightPad = isNarrow ? 18 : 28;
  const topPad = 24;
  const bottomPad = isNarrow ? 38 : 42;
  const totalWidth = Math.max(260, containerWidth);
  const totalHeight = isNarrow ? 260 : 280;
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
  const xTicks = isNarrow ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
  const yTicks = [0, 0.33, 0.66, 1];

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div className="ca-chart-readout" aria-live="polite">
        {current ? (
          <>
            <strong>{current.detail || current.label}</strong>
            <span>{xLabel}: {fmtNum(current.x)}</span>
            <span>{yLabel}: {fmtNum(current.y)}</span>
            {current.size !== null && <span>规模: {fmtNum(current.size)}</span>}
          </>
        ) : (
          <span className="ca-chart-readout-empty" aria-hidden="true" />
        )}
      </div>

      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="ca-chart-svg"
        style={{ minWidth: `${totalWidth}px`, width: '100%' }}
        role="graphics-document"
        aria-label={`散点相关图，${validPoints.length} 个观测样本`}
        onMouseLeave={() => setActiveIdx(null)}
      >
        <title>{`散点相关图: 横轴 ${xLabel}，纵轴 ${yLabel}`}</title>
        {xTicks.map((t) => {
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
                fontSize="12"
              >
                {fmtNum(val, 1)}
              </text>
            </g>
          );
        })}

        {yTicks.map((t) => {
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
                fontSize="12"
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
          stroke="#d9d9e0"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <line
          x1={leftPad}
          x2={totalWidth - rightPad}
          y1={scaleY(avgY)}
          y2={scaleY(avgY)}
          stroke="#d9d9e0"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <text
          x={scaleX(avgX) + 4}
          y={topPad + (isNarrow ? 16 : 28)}
          fill={CAMPAIGN_PALETTE.textSubtle}
          fontSize="12"
        >
          X均值 {fmtNum(avgX, 2)}
        </text>
        <text
          x={totalWidth - rightPad - 4}
          y={scaleY(avgY) - 4}
          textAnchor="end"
          fill={CAMPAIGN_PALETTE.textSubtle}
          fontSize="12"
        >
          Y均值 {fmtNum(avgY, 2)}
        </text>

        <text
          x={totalWidth / 2}
          y={totalHeight - 6}
          textAnchor="middle"
          fill={CAMPAIGN_PALETTE.textMain}
          fontWeight="600"
          fontSize="12"
        >
          {xLabel} →
        </text>
        <text
          x={leftPad - 8}
          y={topPad - 8}
          textAnchor="start"
          fill={CAMPAIGN_PALETTE.textMain}
          fontWeight="600"
          fontSize="12"
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
              onClick={() => setActiveIdx(idx)}
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
              {(validPoints.length <= (isNarrow ? 6 : 15) || isSelected) && (
                <text
                  x={px}
                  y={py - r - 3}
                  textAnchor="middle"
                  fill={isSelected ? CAMPAIGN_PALETTE.primary : CAMPAIGN_PALETTE.textMuted}
                  fontSize="12"
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

// ============================================================================
// 8. DualArenaChart (双阵营对比卡: 100% 对比比例条 + 多指标对比行)
// ============================================================================

export interface DualArenaMetricRow {
  label: string;
  leftValue: number | null;
  rightValue: number | null;
  unit?: string;
  higherIsBetter?: boolean; // true: 大值优(如CTR/ROI), false: 小值优(如CPC/CPM/CPE)
}

export interface DualArenaChartProps {
  leftTitle: string;
  rightTitle: string;
  leftPrimary: number | null;
  rightPrimary: number | null;
  primaryLabel?: string;
  primaryUnit?: string;
  metrics: DualArenaMetricRow[];
  leftColor?: string;
  rightColor?: string;
}

export function DualArenaChart({
  leftTitle,
  rightTitle,
  leftPrimary,
  rightPrimary,
  primaryLabel = '消耗金额',
  primaryUnit = '元',
  metrics = [],
  leftColor = CAMPAIGN_PALETTE.primary,
  rightColor = CAMPAIGN_PALETTE.purple,
}: DualArenaChartProps) {
  const isFiniteNonNeg = (v: number | null | undefined): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const hasLeftPrimary = isFiniteNonNeg(leftPrimary);
  const hasRightPrimary = isFiniteNonNeg(rightPrimary);
  const canCompare = hasLeftPrimary && hasRightPrimary && leftPrimary + rightPrimary > 0;
  const totalPrimary = canCompare ? leftPrimary + rightPrimary : 0;
  const leftPct = canCompare ? (leftPrimary / totalPrimary) * 100 : null;
  const rightPct = canCompare ? (rightPrimary / totalPrimary) * 100 : null;

  return (
    <div className="ca-dual-arena">
      {/* 顶部对比比例卡 */}
      <div className="ca-arena-header">
        <div className="ca-arena-side-info ca-arena-side-info-left">
          <div className="ca-arena-title-tag">
            {leftTitle}
          </div>
          <div className="ca-arena-primary-num" style={{ color: leftColor }}>
            {fmtNum(leftPrimary)}
            <span className="ca-arena-primary-unit">{primaryUnit}</span>
          </div>
          <div className="ca-arena-primary-sub">
            {primaryLabel} <strong>{leftPct !== null ? `${leftPct.toFixed(1)}%` : '—'}</strong>
          </div>
        </div>

        <div className="ca-arena-vs-badge">VS</div>

        <div className="ca-arena-side-info ca-arena-side-info-right">
          <div className="ca-arena-title-tag">
            {rightTitle}
          </div>
          <div className="ca-arena-primary-num" style={{ color: rightColor }}>
            {fmtNum(rightPrimary)}
            <span className="ca-arena-primary-unit">{primaryUnit}</span>
          </div>
          <div className="ca-arena-primary-sub">
            {primaryLabel} <strong>{rightPct !== null ? `${rightPct.toFixed(1)}%` : '—'}</strong>
          </div>
        </div>
      </div>

      {/* 100% 对比进度条 */}
      {canCompare && leftPct !== null && rightPct !== null ? (
        <div className="ca-arena-track" role="progressbar" aria-label={`${leftTitle} vs ${rightTitle} 对比比例`}>
          <div
            className="ca-arena-track-bar ca-arena-track-left"
            style={{ width: `${leftPct}%`, backgroundColor: leftColor }}
          >
            <span className="ca-arena-track-pct">{leftPct.toFixed(1)}%</span>
          </div>
          <div className="ca-arena-track-divider" />
          <div
            className="ca-arena-track-bar ca-arena-track-right"
            style={{ width: `${rightPct}%`, backgroundColor: rightColor }}
          >
            <span className="ca-arena-track-pct">{rightPct.toFixed(1)}%</span>
          </div>
        </div>
      ) : (
        <div
          className="ca-arena-empty-track"
          style={{
            textAlign: 'center',
            padding: '8px 12px',
            color: CAMPAIGN_PALETTE.textMuted,
            fontSize: 12,
            border: `0.5px dashed ${CAMPAIGN_PALETTE.border}`,
            borderRadius: 6,
            margin: '8px 0',
          }}
        >
          暂无可比较消耗
        </div>
      )}

      {/* 下方多指标对比行 */}
      <div className="ca-arena-metrics">
        {metrics.map((row, idx) => {
          const hasLeft = typeof row.leftValue === 'number' && Number.isFinite(row.leftValue);
          const hasRight = typeof row.rightValue === 'number' && Number.isFinite(row.rightValue);
          const hasDirection = typeof row.higherIsBetter === 'boolean';

          let leftWins = false;
          let rightWins = false;
          if (hasDirection && hasLeft && hasRight && row.leftValue !== row.rightValue) {
            if (row.higherIsBetter) {
              leftWins = row.leftValue! > row.rightValue!;
              rightWins = row.rightValue! > row.leftValue!;
            } else {
              leftWins = row.leftValue! < row.rightValue!;
              rightWins = row.rightValue! < row.leftValue!;
            }
          }

          // 真实比例，零0%，小正值不放大，缺值—，负值/非有限不进正向消耗构成
          const leftValid = hasLeft && row.leftValue! >= 0 ? row.leftValue! : 0;
          const rightValid = hasRight && row.rightValue! >= 0 ? row.rightValue! : 0;
          const maxVal = Math.max(leftValid, rightValid) || 1;
          const leftBarPct = hasLeft && row.leftValue! > 0 ? Math.min(100, (row.leftValue! / maxVal) * 100) : 0;
          const rightBarPct = hasRight && row.rightValue! > 0 ? Math.min(100, (row.rightValue! / maxVal) * 100) : 0;

          return (
            <div key={row.label || idx} className="ca-arena-row" tabIndex={0}>
              {/* 左翼 */}
              <div className="ca-arena-cell ca-arena-cell-left">
                {leftWins && <span className="ca-arena-badge-win">优势</span>}
                <span className={`ca-arena-val ${leftWins ? 'ca-arena-val-win' : ''}`}>
                  {hasLeft ? `${fmtNum(row.leftValue)} ${row.unit || ''}`.trim() : '—'}
                </span>
                <div className="ca-arena-bar-track ca-arena-track-reverse">
                  {hasLeft ? (
                    <div
                      className="ca-arena-bar-fill"
                      style={{ width: `${leftBarPct}%`, backgroundColor: leftColor }}
                    />
                  ) : (
                    <span className="ca-arena-na">—</span>
                  )}
                </div>
              </div>

              {/* 中轴指标名称 */}
              <div className="ca-arena-label-col">
                <span className="ca-arena-metric-label">{row.label}</span>
                <span className="ca-arena-metric-dir">{hasDirection ? (row.higherIsBetter ? '高优' : '低优') : '数值对比'}</span>
              </div>

              {/* 右翼 */}
              <div className="ca-arena-cell ca-arena-cell-right">
                <div className="ca-arena-bar-track">
                  {hasRight ? (
                    <div
                      className="ca-arena-bar-fill"
                      style={{ width: `${rightBarPct}%`, backgroundColor: rightColor }}
                    />
                  ) : (
                    <span className="ca-arena-na">—</span>
                  )}
                </div>
                <span className={`ca-arena-val ${rightWins ? 'ca-arena-val-win' : ''}`}>
                  {hasRight ? `${fmtNum(row.rightValue)} ${row.unit || ''}`.trim() : '—'}
                </span>
                {rightWins && <span className="ca-arena-badge-win">优势</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 9. ButterflyCostChart (单位成本双翼蝴蝶图: 中轴对称 + 双向成本对比)
// ============================================================================

export interface ButterflyDatum {
  label: string;
  leftVal: number | null;
  rightVal: number | null;
  spend?: number | null;
}

export interface ButterflyCostChartProps {
  data: ButterflyDatum[];
  leftLabel: string;
  rightLabel: string;
  leftUnit?: string;
  rightUnit?: string;
  leftColor?: string;
  rightColor?: string;
}

export function ButterflyCostChart({
  data,
  leftLabel,
  rightLabel,
  leftUnit = '元',
  rightUnit = '元',
  leftColor = CAMPAIGN_PALETTE.primary,
  rightColor = CAMPAIGN_PALETTE.purple,
}: ButterflyCostChartProps) {
  const { containerRef, containerWidth } = useMeasuredWidth(600);
  const isNarrow = containerWidth < 440;

  if (!data || data.length === 0) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">暂无可对比的成本数据</div>
        <div className="ca-empty-hint">录入单位成本后呈现双翼中轴对称对比</div>
      </div>
    );
  }

  const validLeft = data.filter(
    (d): d is ButterflyDatum & { leftVal: number } =>
      typeof d.leftVal === 'number' && Number.isFinite(d.leftVal) && d.leftVal > 0
  );
  const validRight = data.filter(
    (d): d is ButterflyDatum & { rightVal: number } =>
      typeof d.rightVal === 'number' && Number.isFinite(d.rightVal) && d.rightVal > 0
  );
  const maxLeft = validLeft.length ? Math.max(...validLeft.map((d) => d.leftVal)) : 1;
  const maxRight = validRight.length ? Math.max(...validRight.map((d) => d.rightVal)) : 1;
  const minLeft = validLeft.length ? Math.min(...validLeft.map((d) => d.leftVal)) : null;
  const minRight = validRight.length ? Math.min(...validRight.map((d) => d.rightVal)) : null;

  return (
    <div ref={containerRef} className={`ca-butterfly-chart ${isNarrow ? 'ca-butterfly-narrow' : ''}`}>
      {/* 表头三栏 */}
      <div className="ca-butterfly-header">
        <div className="ca-butterfly-header-col ca-butterfly-header-left" style={{ color: leftColor }}>
          <span>◀ {leftLabel}</span>
          <span className="ca-butterfly-header-unit">({leftUnit})</span>
        </div>
        <div className="ca-butterfly-header-col ca-butterfly-header-center">
          <span>投放版位 / 任务组</span>
          <span className="ca-butterfly-header-sub"> (左右独立刻度)</span>
        </div>
        <div className="ca-butterfly-header-col ca-butterfly-header-right" style={{ color: rightColor }}>
          <span>{rightLabel} ▶</span>
          <span className="ca-butterfly-header-unit">({rightUnit})</span>
        </div>
      </div>

      {/* 每一行对称双翼条 */}
      <div className="ca-butterfly-rows">
        {data.map((item, idx) => {
          const hasLeft = typeof item.leftVal === 'number' && Number.isFinite(item.leftVal);
          const hasRight = typeof item.rightVal === 'number' && Number.isFinite(item.rightVal);
          const leftBarPct = hasLeft && item.leftVal! > 0 && maxLeft > 0 ? Math.min(100, (item.leftVal! / maxLeft) * 100) : 0;
          const rightBarPct = hasRight && item.rightVal! > 0 && maxRight > 0 ? Math.min(100, (item.rightVal! / maxRight) * 100) : 0;
          const isBestLeft = minLeft !== null && item.leftVal === minLeft;
          const isBestRight = minRight !== null && item.rightVal === minRight;

          return (
            <div
              key={item.label || idx}
              className="ca-butterfly-row"
              tabIndex={0}
              role="row"
              aria-label={`${item.label}: ${leftLabel}=${fmtNum(item.leftVal)} ${leftUnit}, ${rightLabel}=${fmtNum(item.rightVal)} ${rightUnit}`}
            >
              {/* 左翼条 (向左延伸) */}
              <div className="ca-butterfly-wing ca-butterfly-wing-left">
                <div className="ca-butterfly-val-wrap ca-butterfly-val-left">
                  {isBestLeft && <span className="ca-butterfly-badge-tag ca-badge-left">本组最低</span>}
                  <span className={`ca-butterfly-val ${isBestLeft ? 'ca-butterfly-val-best' : ''}`}>
                    {fmtNum(item.leftVal)}
                    {hasLeft && <span className="ca-butterfly-unit"> {leftUnit}</span>}
                  </span>
                </div>
                <div className="ca-butterfly-bar-container ca-bar-container-left">
                  {hasLeft ? (
                    <div
                      className="ca-butterfly-bar ca-bar-left"
                      style={{
                        width: `${leftBarPct}%`,
                        backgroundColor: leftColor,
                      }}
                    />
                  ) : (
                    <span className="ca-butterfly-na">—</span>
                  )}
                </div>
              </div>

              {/* 中轴版位胶囊徽标 */}
              <div className="ca-butterfly-center-col">
                <div className="ca-butterfly-badge" title={item.label}>
                  <span className="ca-butterfly-badge-text">{item.label}</span>
                  {typeof item.spend === 'number' && item.spend > 0 && (
                    <span className="ca-butterfly-badge-sub">¥{fmtNum(item.spend, 0)}</span>
                  )}
                </div>
              </div>

              {/* 右翼条 (向右延伸) */}
              <div className="ca-butterfly-wing ca-butterfly-wing-right">
                <div className="ca-butterfly-bar-container ca-bar-container-right">
                  {hasRight ? (
                    <div
                      className="ca-butterfly-bar ca-bar-right"
                      style={{
                        width: `${rightBarPct}%`,
                        backgroundColor: rightColor,
                      }}
                    />
                  ) : (
                    <span className="ca-butterfly-na">—</span>
                  )}
                </div>
                <div className="ca-butterfly-val-wrap ca-butterfly-val-right">
                  <span className={`ca-butterfly-val ${isBestRight ? 'ca-butterfly-val-best' : ''}`}>
                    {fmtNum(item.rightVal)}
                    {hasRight && <span className="ca-butterfly-unit"> {rightUnit}</span>}
                  </span>
                  {isBestRight && <span className="ca-butterfly-badge-tag ca-badge-right">本组最低</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 10. PlacementScorecardChart (多维版位效能表现对比矩阵 + 100% 消耗构成色带)
// ============================================================================

export interface ScorecardRow {
  name: string;
  spend: number | null;
  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  cpe?: number | null;
  cpuv?: number | null;
  roi?: number | null;
  gmv?: number | null;
}

export interface PlacementScorecardChartProps {
  rows: ScorecardRow[];
  mode?: 'placement' | 'four-lines';
}

export function PlacementScorecardChart({
  rows = [],
  mode = 'placement',
}: PlacementScorecardChartProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">暂无表现对比矩阵数据</div>
        <div className="ca-empty-hint">录入版位或任务组数据后自动生成多维表现对比卡</div>
      </div>
    );
  }

  const isFiniteNonNeg = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0;

  const totalCount = rows.length;
  const validSpendRows = rows.filter((r) => isFiniteNonNeg(r.spend));
  const validCount = validSpendRows.length;
  const allMissing = validCount === 0;
  const isComplete = validCount === totalCount;
  const knownSpendTotal = validSpendRows.reduce((a, b) => a + (b.spend as number), 0);

  // 份额仅完整有效非负样本且 total > 0 时算；全0分母为0不显示假份额
  const canComputeShare = isComplete && knownSpendTotal > 0;

  const totalSpendDisplay = allMissing
    ? '总额 —'
    : !isComplete
    ? `已知消耗 ¥${fmtNum(knownSpendTotal)} (覆盖 ${validCount}/${totalCount})`
    : `总额 ¥${fmtNum(knownSpendTotal)}`;

  const findBest = (vals: (number | null | undefined)[], higherBetter: boolean) => {
    const valid = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (!valid.length) return null;
    return higherBetter ? Math.max(...valid) : Math.min(...valid);
  };

  const bestCtr = findBest(rows.map((r) => r.ctr), true);
  const bestCpc = findBest(rows.map((r) => r.cpc), false);
  const bestCpm = findBest(rows.map((r) => r.cpm), false);
  const bestCpe = findBest(rows.map((r) => r.cpe), false);
  const bestCpuv = findBest(rows.map((r) => r.cpuv), false);
  const bestGmv = findBest(rows.map((r) => r.gmv), true);
  const bestRoi = findBest(rows.map((r) => r.roi), true);

  const colors = DEFAULT_SERIES_COLORS;

  return (
    <div className="ca-scorecard-wrap">
      {/* 顶部 100% 消耗构成 Segmented 分段色带 */}
      <div className="ca-scorecard-header-bar">
        <div className="ca-scorecard-bar-title">
          <span>消耗构成分布</span>
          <span className="ca-scorecard-total-spend">{totalSpendDisplay}</span>
        </div>
        <div className="ca-scorecard-segments" role="progressbar" aria-label="消耗构成比例">
          {canComputeShare &&
            rows.map((r, i) => {
              const spend = r.spend as number;
              const pct = (spend / knownSpendTotal) * 100;
              const color = colors[i % colors.length];
              if (pct <= 0) return null;
              return (
                <div
                  key={r.name || i}
                  className="ca-scorecard-seg-item"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                  title={`${r.name}: ¥${fmtNum(spend)} (${pct.toFixed(1)}%)`}
                />
              );
            })}
        </div>
        <div className="ca-scorecard-legend">
          {rows.map((r, i) => {
            const hasSpend = isFiniteNonNeg(r.spend);
            let pctStr = '—';
            if (canComputeShare && hasSpend) {
              const pct = ((r.spend as number) / knownSpendTotal) * 100;
              pctStr = `${pct.toFixed(1)}%`;
            }
            const color = colors[i % colors.length];
            return (
              <span key={r.name || i} className="ca-scorecard-legend-item">
                <span className="ca-scorecard-dot" style={{ backgroundColor: color }} />
                <strong>{r.name}</strong>
                <span>{hasSpend ? `¥${fmtNum(r.spend)}` : '—'}</span>
                <span className="ca-scorecard-pct">({pctStr})</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* 主体多维指标热力表现对比矩阵表 */}
      <div className="ca-table-wrap ca-scorecard-table-wrap">
        <table className="ca-scorecard-table" role="table">
          <thead>
            <tr>
              <th className="ca-scorecard-th ca-th-name">{mode === 'four-lines' ? '任务组 / 渠道' : '投放版位'}</th>
              <th className="ca-scorecard-th">消耗份额</th>
              <th className="ca-scorecard-th">点击率 (CTR)</th>
              {mode === 'four-lines' ? (
                <>
                  <th className="ca-scorecard-th">点击成本 (CPC)</th>
                  <th className="ca-scorecard-th">访客成本 (CPUV)</th>
                  <th className="ca-scorecard-th">归因产出 (GMV)</th>
                  <th className="ca-scorecard-th">综合投资比 (ROI)</th>
                </>
              ) : (
                <>
                  <th className="ca-scorecard-th">曝光成本 (CPM)</th>
                  <th className="ca-scorecard-th">点击成本 (CPC)</th>
                  <th className="ca-scorecard-th">互动成本 (CPE)</th>
                  <th className="ca-scorecard-th">访客成本 (CPUV)</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const hasSpend = isFiniteNonNeg(r.spend);
              const spendPct = canComputeShare && hasSpend ? ((r.spend as number) / knownSpendTotal) * 100 : 0;
              const spendPctStr = canComputeShare && hasSpend ? `${spendPct.toFixed(1)}%` : '—';
              const isBestCtr = bestCtr !== null && r.ctr === bestCtr;
              const isBestCpc = bestCpc !== null && r.cpc === bestCpc;
              const isBestCpm = bestCpm !== null && r.cpm === bestCpm;
              const isBestCpe = bestCpe !== null && r.cpe === bestCpe;
              const isBestCpuv = bestCpuv !== null && r.cpuv === bestCpuv;
              const isBestGmv = bestGmv !== null && r.gmv === bestGmv;
              const isBestRoi = bestRoi !== null && r.roi === bestRoi;

              return (
                <tr key={r.name || idx} className="ca-scorecard-tr">
                  <td className="ca-scorecard-td ca-td-name">
                    <span className="ca-scorecard-name-badge">{r.name}</span>
                  </td>
                  <td className="ca-scorecard-td">
                    <div className="ca-scorecard-bar-cell">
                      <div className="ca-scorecard-mini-bar">
                        {canComputeShare && hasSpend && spendPct > 0 && (
                          <div
                            className="ca-scorecard-mini-fill"
                            style={{
                              width: `${Math.min(100, spendPct)}%`,
                              backgroundColor: colors[idx % colors.length],
                            }}
                          />
                        )}
                      </div>
                      <span className="ca-scorecard-cell-val">{spendPctStr}</span>
                    </div>
                  </td>
                  <td className={`ca-scorecard-td ${isBestCtr ? 'ca-scorecard-cell-best' : ''}`}>
                    <span className="ca-scorecard-cell-val">
                      {typeof r.ctr === 'number' && Number.isFinite(r.ctr) ? `${fmtNum(r.ctr, 2)}%` : '—'}
                    </span>
                    {isBestCtr && <span className="ca-scorecard-tag-best">最高</span>}
                  </td>
                  {mode === 'four-lines' ? (
                    <>
                      <td className={`ca-scorecard-td ${isBestCpc ? 'ca-scorecard-cell-best' : ''}`}>
                        <span className="ca-scorecard-cell-val">
                          {typeof r.cpc === 'number' && Number.isFinite(r.cpc) ? `¥${fmtNum(r.cpc, 2)}` : '—'}
                        </span>
                        {isBestCpc && <span className="ca-scorecard-tag-best">最低</span>}
                      </td>
                      <td className={`ca-scorecard-td ${isBestCpuv ? 'ca-scorecard-cell-best' : ''}`}>
                        <span className="ca-scorecard-cell-val">
                          {typeof r.cpuv === 'number' && Number.isFinite(r.cpuv) ? `¥${fmtNum(r.cpuv, 2)}` : '—'}
                        </span>
                        {isBestCpuv && <span className="ca-scorecard-tag-best">最低</span>}
                      </td>
                      <td className={`ca-scorecard-td ${isBestGmv ? 'ca-scorecard-cell-best' : ''}`}>
                        <span className="ca-scorecard-cell-val">
                          {typeof r.gmv === 'number' && Number.isFinite(r.gmv) ? `¥${fmtNum(r.gmv, 2)}` : '—'}
                        </span>
                        {isBestGmv && <span className="ca-scorecard-tag-best">最高</span>}
                      </td>
                      <td className={`ca-scorecard-td ${isBestRoi ? 'ca-scorecard-cell-best' : ''}`}>
                        <span className="ca-scorecard-cell-val">
                          {typeof r.roi === 'number' && Number.isFinite(r.roi) ? `${fmtNum(r.roi, 2)}倍` : '—'}
                        </span>
                        {isBestRoi && <span className="ca-scorecard-tag-best">最高</span>}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={`ca-scorecard-td ${isBestCpm ? 'ca-scorecard-cell-best' : ''}`}>
                        <span className="ca-scorecard-cell-val">
                          {typeof r.cpm === 'number' && Number.isFinite(r.cpm) ? `¥${fmtNum(r.cpm, 2)}` : '—'}
                        </span>
                        {isBestCpm && <span className="ca-scorecard-tag-best">最低</span>}
                      </td>
                      <td className={`ca-scorecard-td ${isBestCpc ? 'ca-scorecard-cell-best' : ''}`}>
                        <span className="ca-scorecard-cell-val">
                          {typeof r.cpc === 'number' && Number.isFinite(r.cpc) ? `¥${fmtNum(r.cpc, 2)}` : '—'}
                        </span>
                        {isBestCpc && <span className="ca-scorecard-tag-best">最低</span>}
                      </td>
                      <td className={`ca-scorecard-td ${isBestCpe ? 'ca-scorecard-cell-best' : ''}`}>
                        <span className="ca-scorecard-cell-val">
                          {typeof r.cpe === 'number' && Number.isFinite(r.cpe) ? `¥${fmtNum(r.cpe, 2)}` : '—'}
                        </span>
                        {isBestCpe && <span className="ca-scorecard-tag-best">最低</span>}
                      </td>
                      <td className={`ca-scorecard-td ${isBestCpuv ? 'ca-scorecard-cell-best' : ''}`}>
                        <span className="ca-scorecard-cell-val">
                          {typeof r.cpuv === 'number' && Number.isFinite(r.cpuv) ? `¥${fmtNum(r.cpuv, 2)}` : '—'}
                        </span>
                        {isBestCpuv && <span className="ca-scorecard-tag-best">最低</span>}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 11. LollipopRankChart (棒棒糖排行榜 + 辅助指标胶囊)
// ============================================================================

export interface LollipopDatum {
  label: string;
  value: number | null;
  secondaryLabel?: string;
  secondaryValue?: string;
  badge?: string;
  color?: string;
}

export interface LollipopRankChartProps {
  data: LollipopDatum[];
  unit?: string;
  maxItems?: number;
}

export function LollipopRankChart({
  data = [],
  unit = '',
  maxItems = 10,
}: LollipopRankChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="ca-empty">
        <div className="ca-empty-title">暂无排行榜数据</div>
        <div className="ca-empty-hint">录入指标项后自动按序呈现棒棒糖排行榜</div>
      </div>
    );
  }

  const items = data.slice(0, maxItems);
  const validVals = items
    .map((d) => d.value)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  const maxVal = validVals.length ? Math.max(...validVals) : 1;

  const rankBadgeColors = [
    CAMPAIGN_PALETTE.gold, // Top 1: 金
    CAMPAIGN_PALETTE.purple, // Top 2: 紫
    CAMPAIGN_PALETTE.primary, // Top 3: 青
  ];

  return (
    <div className="ca-lollipop-chart">
      {items.map((item, idx) => {
        const hasVal = typeof item.value === 'number' && Number.isFinite(item.value);
        const pct = hasVal && item.value! > 0 && maxVal > 0 ? Math.min(100, (item.value! / maxVal) * 100) : 0;
        const rankNum = idx + 1;
        const rankStr = rankNum < 10 ? `0${rankNum}` : `${rankNum}`;
        const rankColor = rankNum <= 3 ? rankBadgeColors[rankNum - 1] : CAMPAIGN_PALETTE.slate;
        const itemColor = item.color || (rankNum <= 3 ? rankBadgeColors[rankNum - 1] : CAMPAIGN_PALETTE.primary);

        return (
          <div
            key={item.label || idx}
            className="ca-lollipop-row"
            tabIndex={0}
            role="row"
            aria-label={`排名 ${rankNum}: ${item.label}, 数值: ${hasVal ? `${fmtNum(item.value)} ${unit}` : '未录入'}`}
          >
            {/* 序号徽章 */}
            <div
              className={`ca-lollipop-rank ${rankNum <= 3 ? 'ca-lollipop-rank-top' : ''}`}
              style={{ backgroundColor: rankColor }}
            >
              {rankStr}
            </div>

            {/* 项目名称 */}
            <div className="ca-lollipop-label" title={item.label}>
              <span>{item.label}</span>
              {item.badge && <span className="ca-lollipop-badge">{item.badge}</span>}
            </div>

            {/* 棒棒糖导引杆与发光圆头 */}
            <div className="ca-lollipop-track">
              <div
                className="ca-lollipop-stem"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, rgba(226, 232, 240, 0.4) 0%, ${itemColor} 100%)`,
                }}
              />
              <div
                className="ca-lollipop-dot"
                style={{
                  left: `${pct}%`,
                  backgroundColor: itemColor,
                  boxShadow: `0 0 0 3px rgba(255, 255, 255, 0.9), 0 0 6px ${typeof itemColor === 'string' && itemColor.startsWith('var(') ? `color-mix(in srgb, ${itemColor} 40%, transparent)` : `${itemColor}66`}`,
                }}
              />
            </div>

            {/* 右侧数值与辅助效率胶囊 */}
            <div className="ca-lollipop-readout">
              <span className="ca-lollipop-val">
                {hasVal ? (
                  <>
                    <strong>{fmtNum(item.value)}</strong>
                    {unit && <span className="ca-lollipop-unit"> {unit}</span>}
                  </>
                ) : (
                  <span className="ca-lollipop-na">—</span>
                )}
              </span>
              {item.secondaryValue && (
                <span className="ca-lollipop-secondary" title={item.secondaryLabel}>
                  {item.secondaryValue}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
