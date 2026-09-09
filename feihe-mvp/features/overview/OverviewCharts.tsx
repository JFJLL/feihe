'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { DailyRecord } from './overview-data';

// ======================== Mini Sparkline ========================
export function Sparkline({
  data,
  color = '#1e6091',
  height = 36,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(60, Math.floor(rect.width));
      const h = height;

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const min = Math.min(...data);
      const max = Math.max(...data);
      const range = max - min || 1;
      const padY = 5;
      const plotH = h - padY * 2;

      const points = data.map((val, idx) => ({
        x: (idx / (data.length - 1)) * w,
        y: h - padY - ((val - min) / range) * plotH,
      }));

      const tension = 0.35;
      const buildPath = () => {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i === 0 ? 0 : i - 1];
          const p1 = points[i];
          const p2 = points[i + 1];
          const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
          const cp1x = p1.x + (p2.x - p0.x) * tension;
          const cp1y = p1.y + (p2.y - p0.y) * tension;
          const cp2x = p2.x - (p3.x - p1.x) * tension;
          const cp2y = p2.y - (p3.y - p1.y) * tension;
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
      };

      // 渐变填充背景 (匹配参考 HTML 的 Chart.js 填充风格)
      buildPath();
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, color + '2e');
      grad.addColorStop(1, color + '03');
      ctx.fillStyle = grad;
      ctx.fill();

      // 正常均匀平滑曲线 (全段 2px 匀称实线，无粗细变形)
      buildPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    };

    render();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => render());
      ro.observe(canvas);
    }
    return () => { ro?.disconnect(); };
  }, [data, color, height]);

  if (!data || data.length < 2) {
    return <div style={{ height }} />;
  }

  return (
    <div className="sparkline" style={{ height, width: '100%', marginTop: 8 }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height, display: 'block' }}
      />
    </div>
  );
}

// ======================== Spend Trend (30 Days) ========================
export function SpendTrendChart({
  records,
  height = 240,
}: {
  records: DailyRecord[];
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!records.length) return <div style={{ height }}>暂无趋势数据</div>;

  const w = 640;
  const padL = 50;
  const padR = 20;
  const padT = 24;
  const padB = 30;
  const plotW = w - padL - padR;
  const plotH = height - padT - padB;

  const allVals = records.flatMap((r) => [r.plan_spend, r.actual_spend]);
  const minVal = Math.min(...allVals) * 0.95;
  const maxVal = Math.max(...allVals) * 1.05;
  const range = maxVal - minVal || 1;

  const getX = (idx: number) => padL + (idx / (records.length - 1)) * plotW;
  const getY = (val: number) => padT + plotH - ((val - minVal) / range) * plotH;

  const makePath = (key: 'plan_spend' | 'actual_spend') => {
    return records.reduce((acc, r, i) => {
      const x = getX(i);
      const y = getY(r[key]);
      if (i === 0) return `M ${x} ${y}`;
      const prevX = getX(i - 1);
      const prevY = getY(records[i - 1][key]);
      const cx = (prevX + x) / 2;
      return `${acc} C ${cx} ${prevY}, ${cx} ${y}, ${x} ${y}`;
    }, '');
  };

  const planPath = makePath('plan_spend');
  const actualPath = makePath('actual_spend');
  const actualArea = `${actualPath} L ${getX(records.length - 1)} ${padT + plotH} L ${getX(0)} ${padT + plotH} Z`;

  // Y axis ticks (3 ticks)
  const yTicks = [
    minVal + range * 0.1,
    minVal + range * 0.5,
    minVal + range * 0.9,
  ];

  // X axis tick labels (show ~5-6 dates)
  const step = Math.ceil(records.length / 6);
  const xIndices = records
    .map((_, i) => i)
    .filter((i) => i % step === 0 || i === records.length - 1);

  const hovered = hoverIdx !== null ? records[hoverIdx] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, marginBottom: 8, justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 2, background: '#0284c7', display: 'inline-block' }} />
          <span style={{ color: '#0369a1', fontWeight: 600 }}>实际消耗</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 2, borderTop: '2px dashed #94a3b8', display: 'inline-block' }} />
          <span style={{ color: '#64748b' }}>计划消耗</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${w} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="spend-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284c7" stopOpacity={0.24} />
            <stop offset="100%" stopColor="#0284c7" stopOpacity={0.01} />
          </linearGradient>
        </defs>

        {/* Grid lines & Y ticks */}
        {yTicks.map((val, idx) => {
          const y = getY(val);
          return (
            <g key={idx}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                ¥{Math.round(val / 1000)}k
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={padL} y1={padT + plotH} x2={w - padR} y2={padT + plotH} stroke="#cbd5e1" />

        {/* Areas and paths */}
        <path d={actualArea} fill="url(#spend-grad)" />
        <path d={planPath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 4" />
        <path d={actualPath} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />

        {/* X Ticks */}
        {xIndices.map((i) => {
          const x = getX(i);
          const label = records[i].date.slice(5);
          return (
            <text key={i} x={x} y={height - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {label}
            </text>
          );
        })}

        {/* Hover elements */}
        {hoverIdx !== null && (
          <g>
            <line
              x1={getX(hoverIdx)}
              y1={padT}
              x2={getX(hoverIdx)}
              y2={padT + plotH}
              stroke="#0284c7"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle
              cx={getX(hoverIdx)}
              cy={getY(records[hoverIdx].actual_spend)}
              r="4.5"
              fill="#0284c7"
              stroke="#fff"
              strokeWidth="2"
            />
            <circle
              cx={getX(hoverIdx)}
              cy={getY(records[hoverIdx].plan_spend)}
              r="3.5"
              fill="#94a3b8"
              stroke="#fff"
              strokeWidth="1.5"
            />
          </g>
        )}

        {/* Interactive capture rects */}
        {records.map((_, i) => {
          const x = getX(i) - (plotW / (records.length - 1)) / 2;
          const rectW = plotW / (records.length - 1);
          return (
            <rect
              key={i}
              x={x}
              y={padT}
              width={rectW}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          );
        })}
      </svg>

      {/* Floating tooltip */}
      {hovered && hoverIdx !== null && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max(10, (getX(hoverIdx) / w) * 100), 85) + '%',
            top: 20,
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.92)',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 11,
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{hovered.date}</div>
          <div style={{ color: '#38bdf8' }}>实际：¥{hovered.actual_spend.toLocaleString()}</div>
          <div style={{ color: '#cbd5e1' }}>计划：¥{hovered.plan_spend.toLocaleString()} (达成 {hovered.achieve_pct}%)</div>
        </div>
      )}
    </div>
  );
}

// ======================== CTR Trend Comparison (30 Days) ========================
export function CtrTrendChart({
  records,
  height = 240,
}: {
  records: DailyRecord[];
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!records.length) return <div style={{ height }}>暂无 CTR 数据</div>;

  const w = 640;
  const padL = 46;
  const padR = 20;
  const padT = 24;
  const padB = 30;
  const plotW = w - padL - padR;
  const plotH = height - padT - padB;

  const allVals = records.flatMap((r) => [r.feed_ctr, r.search_ctr, 6]);
  const minVal = Math.max(0, Math.min(...allVals) - 0.5);
  const maxVal = Math.max(...allVals) + 0.8;
  const range = maxVal - minVal || 1;

  const getX = (idx: number) => padL + (idx / (records.length - 1)) * plotW;
  const getY = (val: number) => padT + plotH - ((val - minVal) / range) * plotH;

  const makePath = (key: 'feed_ctr' | 'search_ctr') => {
    return records.reduce((acc, r, i) => {
      const x = getX(i);
      const y = getY(r[key]);
      if (i === 0) return `M ${x} ${y}`;
      const prevX = getX(i - 1);
      const prevY = getY(records[i - 1][key]);
      const cx = (prevX + x) / 2;
      return `${acc} C ${cx} ${prevY}, ${cx} ${y}, ${x} ${y}`;
    }, '');
  };

  const feedPath = makePath('feed_ctr');
  const searchPath = makePath('search_ctr');
  const kpiY = getY(6);

  const step = Math.ceil(records.length / 6);
  const xIndices = records
    .map((_, i) => i)
    .filter((i) => i % step === 0 || i === records.length - 1);

  const hovered = hoverIdx !== null ? records[hoverIdx] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, marginBottom: 8, justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 2, background: '#16a34a', display: 'inline-block' }} />
          <span style={{ color: '#15803d', fontWeight: 600 }}>信息流 CTR</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 2, background: '#dc2626', display: 'inline-block' }} />
          <span style={{ color: '#b91c1c', fontWeight: 600 }}>搜索 CTR</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 2, borderTop: '2px dashed #94a3b8', display: 'inline-block' }} />
          <span style={{ color: '#64748b' }}>KPI基准 (6%)</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${w} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* KPI Benchmark line */}
        <line x1={padL} y1={kpiY} x2={w - padR} y2={kpiY} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth="1.2" />
        <text x={w - padR + 4} y={kpiY + 3} fontSize="9" fill="#64748b" textAnchor="start">
          KPI 6%
        </text>

        {/* Y ticks */}
        {[minVal + range * 0.2, minVal + range * 0.6, minVal + range * 0.9].map((val, idx) => {
          const y = getY(val);
          return (
            <g key={idx}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {val.toFixed(1)}%
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={padL} y1={padT + plotH} x2={w - padR} y2={padT + plotH} stroke="#cbd5e1" />

        {/* Curves */}
        <path d={feedPath} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
        <path d={searchPath} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />

        {/* X Ticks */}
        {xIndices.map((i) => {
          const x = getX(i);
          const label = records[i].date.slice(5);
          return (
            <text key={i} x={x} y={height - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {label}
            </text>
          );
        })}

        {/* Hover indicator */}
        {hoverIdx !== null && (
          <g>
            <line
              x1={getX(hoverIdx)}
              y1={padT}
              x2={getX(hoverIdx)}
              y2={padT + plotH}
              stroke="#64748b"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle
              cx={getX(hoverIdx)}
              cy={getY(records[hoverIdx].feed_ctr)}
              r="4.5"
              fill="#16a34a"
              stroke="#fff"
              strokeWidth="2"
            />
            <circle
              cx={getX(hoverIdx)}
              cy={getY(records[hoverIdx].search_ctr)}
              r="4.5"
              fill="#dc2626"
              stroke="#fff"
              strokeWidth="2"
            />
          </g>
        )}

        {/* Interactive capture rects */}
        {records.map((_, i) => {
          const x = getX(i) - (plotW / (records.length - 1)) / 2;
          const rectW = plotW / (records.length - 1);
          return (
            <rect
              key={i}
              x={x}
              y={padT}
              width={rectW}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          );
        })}
      </svg>

      {/* Floating tooltip */}
      {hovered && hoverIdx !== null && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max(10, (getX(hoverIdx) / w) * 100), 85) + '%',
            top: 20,
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.92)',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 11,
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{hovered.date}</div>
          <div style={{ color: '#4ade80' }}>信息流 CTR: {hovered.feed_ctr}% (超标)</div>
          <div style={{ color: '#f87171' }}>搜索 CTR: {hovered.search_ctr}% {hovered.search_ctr < 7 ? '(需优化)' : ''}</div>
        </div>
      )}
    </div>
  );
}

// ======================== Tier Doughnut Chart (Interactive) ========================
export function TierDoughnutChart({
  items,
  total = 194,
}: {
  items: Array<{ label: string; count: number; pct: number; color: string }>;
  total?: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const size = 160;
  const baseStroke = 24;
  const center = size / 2;

  const validTotal = Math.max(1, total);
  const slices = items.map((item, idx) => {
    const ratio = item.count / validTotal;
    const prevSum = items.slice(0, idx).reduce((sum, it) => sum + it.count / validTotal, 0);
    const radius = (size - (hoveredIdx === idx ? 30 : baseStroke)) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = `${ratio * circumference} ${circumference}`;
    const strokeDashoffset = -prevSum * circumference;
    return { ...item, strokeDasharray, strokeDashoffset, radius };
  });

  const activeItem = hoveredIdx !== null ? items[hoveredIdx] : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          <circle
            cx={center}
            cy={center}
            r={(size - baseStroke) / 2}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={baseStroke}
          />
          {slices.map((s, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={s.radius}
                fill="none"
                stroke={s.color}
                strokeWidth={isHovered ? 30 : baseStroke}
                strokeDasharray={s.strokeDasharray}
                strokeDashoffset={s.strokeDashoffset}
                transform={`rotate(-90 ${center} ${center})`}
                style={{
                  cursor: 'pointer',
                  transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                  opacity: hoveredIdx === null || isHovered ? 1 : 0.6,
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            padding: '0 8px',
          }}
        >
          {activeItem ? (
            <>
              <span style={{ fontSize: 18, fontWeight: 800, color: activeItem.color, lineHeight: 1.1 }}>
                {activeItem.count}篇
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginTop: 3 }}>
                {activeItem.label}
              </span>
              <span style={{ fontSize: 10.5, color: '#64748b' }}>
                {typeof activeItem.pct === 'number' ? activeItem.pct.toFixed(1) : activeItem.pct}%
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{total}</span>
              <span style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>总篇数</span>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 160 }}>
        {items.map((item, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: 6,
                background: isHovered ? '#f0f9ff' : '#f8fafc',
                border: isHovered ? `1px solid ${item.color}` : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                <span style={{ color: isHovered ? '#0369a1' : '#334155', fontWeight: isHovered ? 700 : 500 }}>{item.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <b style={{ color: '#0f172a' }}>{item.count}篇</b>
                <span style={{ color: isHovered ? item.color : '#94a3b8', fontSize: 11, fontWeight: isHovered ? 600 : 400 }}>
                  ({typeof item.pct === 'number' ? item.pct.toFixed(1) : item.pct}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ======================== KFS Stacked Area Chart ========================
export function KfsStackedAreaChart({
  rows,
  height = 260,
}: {
  rows: Array<{ date: string; feed_spend: number | null; search_spend: number | null }>;
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const data = rows.filter(r => r.date && (r.feed_spend !== null || r.search_spend !== null));
  if (!data.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>暂无 KFS 分渠道消耗数据</div>;

  const w = 680;
  const padL = 56, padR = 20, padT = 28, padB = 36;
  const plotW = w - padL - padR;
  const plotH = height - padT - padB;

  const totals = data.map(r => (r.feed_spend || 0) + (r.search_spend || 0));
  const maxVal = Math.max(...totals) * 1.08 || 1;
  const getX = (i: number) => data.length === 1 ? w / 2 : padL + (i / (data.length - 1)) * plotW;
  const getY = (v: number) => padT + plotH - (v / maxVal) * plotH;

  // Build stacked area paths
  const feedPoints = data.map((r, i) => ({ x: getX(i), y: getY(r.feed_spend || 0) }));
  const searchTopPoints = data.map((r, i) => ({ x: getX(i), y: getY((r.feed_spend || 0) + (r.search_spend || 0)) }));
  const baseline = data.map((r, i) => ({ x: getX(i), y: padT + plotH }));

  const smoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : '';
    return pts.reduce((acc, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = pts[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
    }, '');
  };

  const feedArea = `${smoothPath(feedPoints)} L ${feedPoints.at(-1)!.x} ${padT + plotH} L ${feedPoints[0].x} ${padT + plotH} Z`;
  const reversedFeed = [...feedPoints].reverse();
  const searchArea = `${smoothPath(searchTopPoints)} L ${reversedFeed.map(p => `${p.x} ${p.y}`).join(' L ')} Z`;

  const step = Math.ceil(data.length / 7);
  const xIndices = data.map((_, i) => i).filter(i => i % step === 0 || i === data.length - 1);
  const yTicks = [0.25, 0.5, 0.75, 1].map(t => maxVal * t);

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 12, marginBottom: 6, justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 10, background: '#1e6091', borderRadius: 2, display: 'inline-block' }} />
          <span style={{ color: '#0c4a6e', fontWeight: 600 }}>信息流 F</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 10, background: '#7c3aed', borderRadius: 2, display: 'inline-block' }} />
          <span style={{ color: '#5b21b6', fontWeight: 600 }}>搜索 S</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} onMouseLeave={() => setHoverIdx(null)}>
        <defs>
          <linearGradient id="kfs-feed-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e6091" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#1e6091" stopOpacity={0.15} />
          </linearGradient>
          <linearGradient id="kfs-search-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.65} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        {yTicks.map((val, i) => {
          const y = getY(val);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">¥{(val / 10000).toFixed(1)}w</text>
            </g>
          );
        })}
        <line x1={padL} y1={padT + plotH} x2={w - padR} y2={padT + plotH} stroke="#cbd5e1" />
        <path d={feedArea} fill="url(#kfs-feed-grad)" />
        <path d={searchArea} fill="url(#kfs-search-grad)" />
        <path d={smoothPath(searchTopPoints)} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
        <path d={smoothPath(feedPoints)} fill="none" stroke="#1e6091" strokeWidth="2" strokeLinecap="round" />
        {xIndices.map(i => (
          <text key={i} x={getX(i)} y={height - 10} textAnchor="middle" fontSize="10" fill="#94a3b8">{data[i].date.slice(5)}</text>
        ))}
        {hoverIdx !== null && (
          <g>
            <line x1={getX(hoverIdx)} y1={padT} x2={getX(hoverIdx)} y2={padT + plotH} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={getX(hoverIdx)} cy={getY(hovered?.feed_spend || 0)} r="4" fill="#1e6091" stroke="#fff" strokeWidth="1.5" />
            <circle cx={getX(hoverIdx)} cy={getY((hovered?.feed_spend || 0) + (hovered?.search_spend || 0))} r="4" fill="#7c3aed" stroke="#fff" strokeWidth="1.5" />
          </g>
        )}
        {data.map((_, i) => (
          <rect key={i} x={getX(i) - plotW / data.length / 2} y={padT} width={Math.max(12, plotW / data.length)} height={plotH} fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
        ))}
      </svg>
      {hovered && hoverIdx !== null && (
        <div style={{ position: 'absolute', left: `${Math.min(82, Math.max(10, (getX(hoverIdx) / w) * 100))}%`, top: 28, transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.94)', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 11.5, pointerEvents: 'none', zIndex: 10, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{hovered.date}</div>
          <div style={{ color: '#93c5fd' }}>信息流 F：¥{(hovered.feed_spend || 0).toLocaleString()}</div>
          <div style={{ color: '#c4b5fd' }}>搜索 S：¥{(hovered.search_spend || 0).toLocaleString()}</div>
          <div style={{ color: '#e2e8f0', marginTop: 2, borderTop: '1px solid #334155', paddingTop: 3 }}>合计：¥{((hovered.feed_spend || 0) + (hovered.search_spend || 0)).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}

// ======================== Creator Tier Spend Distribution ========================
export function TierSpendDistribution({
  items,
}: {
  items: Array<{ label: string; spend: number; count: number; color: string }>;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const total = items.reduce((s, it) => s + it.spend, 0) || 1;
  const max = Math.max(...items.map(it => it.spend), 1);

  if (!items.length) return <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>暂无达人层级采买数据</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, idx) => {
        const isHovered = hoveredIdx === idx;
        const pct = (it.spend / total) * 100;
        const barW = (it.spend / max) * 100;
        return (
          <div key={it.label} onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}
            style={{ padding: '7px 10px', borderRadius: 8, background: isHovered ? '#f8fafc' : 'transparent', border: isHovered ? '1px solid #e2e8f0' : '1px solid transparent', cursor: 'pointer', transition: 'all 0.15s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5, alignItems: 'baseline' }}>
              <span style={{ fontWeight: isHovered ? 700 : 600, color: isHovered ? '#0f172a' : '#1e293b' }}>{it.label}</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{ color: '#64748b', fontSize: 11.5 }}>{it.count} 篇</span>
                <strong style={{ color: it.color, fontSize: 13 }}>¥{(it.spend / 10000).toFixed(1)}w</strong>
                <span style={{ color: isHovered ? it.color : '#94a3b8', fontSize: 11, fontWeight: isHovered ? 600 : 400, width: 38, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
              </div>
            </div>
            <div style={{ height: 9, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: `${Math.min(100, Math.max(2, barW))}%`, height: '100%', background: `linear-gradient(90deg, ${it.color}cc, ${it.color})`, borderRadius: 5, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        );
      })}
      <div style={{ textAlign: 'right', fontSize: 11, color: '#94a3b8', marginTop: 2 }}>采买总金额 ¥{(total / 10000).toFixed(1)}w · 基于笔记库已填报价</div>
    </div>
  );
}

// ======================== Horizontal Bar List (Interactive) ========================
export function HorizontalBarList({
  items,
}: {
  items: Array<{ label: string; amount: number; pct: number; color: string; bg?: string; subText?: string }>;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, idx) => {
        const isHovered = hoveredIdx === idx;
        const pctNum = typeof it.pct === 'number' ? it.pct : parseFloat(String(it.pct)) || 0;
        return (
          <div
            key={idx}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              padding: '6px 8px',
              borderRadius: 8,
              background: isHovered ? '#f8fafc' : 'transparent',
              border: isHovered ? '1px solid #e2e8f0' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ fontWeight: isHovered ? 700 : 600, color: isHovered ? '#0f172a' : '#1e293b' }}>
                {it.label}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontSize: 12 }}>{it.subText || `¥${it.amount}万`}</span>
                <strong style={{ color: it.color, fontSize: 13 }}>{pctNum.toFixed(1)}%</strong>
              </div>
            </div>
            <div
              style={{
                height: 10,
                background: '#f1f5f9',
                borderRadius: 5,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(2, pctNum))}%`,
                  height: '100%',
                  background: it.color,
                  borderRadius: 5,
                  transition: 'width 0.6s ease, transform 0.2s ease',
                  transform: isHovered ? 'scaleY(1.2)' : 'none',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}


