'use client';

import React, { useState } from 'react';
import type { DailyRecord } from './overview-data';

// ======================== Mini Sparkline ========================
export function Sparkline({
  data,
  color = '#0284c7',
  height = 36,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return <div style={{ height }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const paddingY = 4;
  const h = height - paddingY * 2;
  const w = 120;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * w;
    const y = height - paddingY - ((val - min) / range) * h;
    return { x, y };
  });

  const pathD = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const last = points[points.length - 1];
  const gradId = 'spark-grad-' + color.replace('#', '') + '-' + Math.round(data[0] * 10);

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      style={{ width: '100%', height, overflow: 'visible', display: 'block' }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="3" fill={color} stroke="#ffffff" strokeWidth="1.5" />
    </svg>
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

// ======================== Tier Doughnut Chart ========================
export function TierDoughnutChart({
  items,
  total = 194,
}: {
  items: Array<{ label: string; count: number; pct: number; color: string }>;
  total?: number;
}) {
  const size = 160;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const slices = items.map((item, idx) => {
    const ratio = item.count / total;
    const prevSum = items.slice(0, idx).reduce((sum, it) => sum + it.count / total, 0);
    const strokeDasharray = `${ratio * circumference} ${circumference}`;
    const strokeDashoffset = -prevSum * circumference;
    return { ...item, strokeDasharray, strokeDashoffset };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {slices.map((s, idx) => (
            <circle
              key={idx}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={s.strokeDasharray}
              strokeDashoffset={s.strokeDashoffset}
              transform={`rotate(-90 ${center} ${center})`}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          ))}
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
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{total}</span>
          <span style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>总篇数</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 160 }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
              <span style={{ color: '#334155', fontWeight: 500 }}>{item.label}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <b style={{ color: '#0f172a' }}>{item.count}篇</b>
              <span style={{ color: '#94a3b8', fontSize: 11 }}>({item.pct}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================== Horizontal Bar List ========================
export function HorizontalBarList({
  items,
}: {
  items: Array<{ label: string; amount: number; pct: number; color: string; bg?: string; subText?: string }>;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((it, idx) => (
        <div key={idx}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>{it.label}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: '#64748b' }}>{it.subText || `¥${it.amount}万`}</span>
              <strong style={{ color: it.color }}>{it.pct}%</strong>
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
                width: `${it.pct}%`,
                height: '100%',
                background: it.color,
                borderRadius: 5,
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}



