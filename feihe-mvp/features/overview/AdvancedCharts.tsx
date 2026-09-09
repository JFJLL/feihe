'use client';

import React, { useState, useRef, useEffect } from 'react';

// ======================== Scatter Chart (内容方向效果矩阵) ========================
export function EffectScatterChart({
  points,
  xLabel = '阅读量',
  yLabel = '互动量',
  height = 320,
}: {
  points: Array<{ x: number; y: number; size: number; color: string; label: string; id?: string }>;
  xLabel?: string;
  yLabel?: string;
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const w = 680;
  const padL = 60, padR = 20, padT = 20, padB = 44;
  const plotW = w - padL - padR;
  const plotH = height - padT - padB;

  if (!points.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>暂无散点数据</div>;

  const xMax = Math.max(...points.map(p => p.x), 1) * 1.1;
  const yMax = Math.max(...points.map(p => p.y), 1) * 1.1;
  const sizeMax = Math.max(...points.map(p => p.size), 1);

  const getX = (v: number) => padL + (v / xMax) * plotW;
  const getY = (v: number) => padT + plotH - (v / yMax) * plotH;
  const getR = (s: number) => 4 + (s / sizeMax) * 14;

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map(t => xMax * t);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => yMax * t);
  const fmt = (v: number) => v >= 10000 ? (v / 10000).toFixed(1) + 'w' : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v).toString();

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} onMouseLeave={() => setHoverIdx(null)}>
        {yTicks.map((v, i) => (
          <g key={`y${i}`}>
            <line x1={padL} y1={getY(v)} x2={w - padR} y2={getY(v)} stroke="#e2e8f0" strokeDasharray="3 3" />
            <text x={padL - 8} y={getY(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{fmt(v)}</text>
          </g>
        ))}
        {xTicks.map((v, i) => (
          <g key={`x${i}`}>
            <line x1={getX(v)} y1={padT} x2={getX(v)} y2={padT + plotH} stroke="#f1f5f9" />
            <text x={getX(v)} y={height - 12} textAnchor="middle" fontSize="10" fill="#94a3b8">{fmt(v)}</text>
          </g>
        ))}
        <line x1={padL} y1={padT + plotH} x2={w - padR} y2={padT + plotH} stroke="#cbd5e1" />
        <text x={w / 2} y={height - 1} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight={600}>{xLabel}</text>
        <text x={14} y={padT + plotH / 2} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight={600} transform={`rotate(-90, 14, ${padT + plotH / 2})`}>{yLabel}</text>
        {points.map((p, i) => (
          <circle
            key={p.id || i}
            cx={getX(p.x)}
            cy={getY(p.y)}
            r={getR(p.size)}
            fill={p.color}
            fillOpacity={hoverIdx === null || hoverIdx === i ? 0.65 : 0.25}
            stroke={p.color}
            strokeWidth={hoverIdx === i ? 2.5 : 1}
            style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}
        {points.map((_, i) => (
          <rect key={`hit${i}`} x={getX(points[i].x) - 20} y={getY(points[i].y) - 20} width={40} height={40} fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
        ))}
      </svg>
      {hovered && (
        <div style={{ position: 'absolute', left: `${Math.min(85, Math.max(5, (getX(hovered.x) / w) * 100))}%`, top: 20, transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.94)', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 11.5, pointerEvents: 'none', zIndex: 10, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
          <div style={{ fontWeight: 700, marginBottom: 3, color: hovered.color }}>{hovered.label}</div>
          <div>{xLabel}：{fmt(hovered.x)}</div>
          <div>{yLabel}：{fmt(hovered.y)}</div>
          <div>评论数：{hovered.size}</div>
        </div>
      )}
    </div>
  );
}

// ======================== Histogram Chart (笔记效果分布) ========================
export function DistributionHistogram({
  bins,
  color = '#1e6091',
  height = 240,
  unit = '篇',
}: {
  bins: Array<{ label: string; count: number }>;
  color?: string;
  height?: number;
  unit?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (!bins.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>暂无分布数据</div>;

  const w = 680;
  const padL = 50, padR = 20, padT = 20, padB = 40;
  const plotW = w - padL - padR;
  const plotH = height - padT - padB;
  const max = Math.max(...bins.map(b => b.count), 1);
  const barW = plotW / bins.length * 0.75;
  const gap = plotW / bins.length * 0.25;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} onMouseLeave={() => setHoverIdx(null)}>
        <defs>
          <linearGradient id="hist-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.85} />
            <stop offset="100%" stopColor={color} stopOpacity={0.35} />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={padT + plotH - t * plotH} x2={w - padR} y2={padT + plotH - t * plotH} stroke="#e2e8f0" strokeDasharray="3 3" />
            <text x={padL - 8} y={padT + plotH - t * plotH + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(max * t)}</text>
          </g>
        ))}
        {bins.map((b, i) => {
          const h = (b.count / max) * plotH;
          const x = padL + i * (barW + gap) + gap / 2;
          const y = padT + plotH - h;
          const isHovered = hoverIdx === i;
          return (
            <g key={i} onMouseEnter={() => setHoverIdx(i)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width={barW} height={h} fill="url(#hist-grad)" rx={3} style={{ transition: 'all 0.2s ease', opacity: hoverIdx === null || isHovered ? 1 : 0.5 }} />
              {isHovered && <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight={700} fill="#0f172a">{b.count} {unit}</text>}
              <text x={x + barW / 2} y={height - 14} textAnchor="middle" fontSize="9.5" fill="#64748b">{b.label}</text>
            </g>
          );
        })}
        <line x1={padL} y1={padT + plotH} x2={w - padR} y2={padT + plotH} stroke="#cbd5e1" />
      </svg>
    </div>
  );
}

// ======================== Radar Chart (效率指标雷达图) ========================
export function EfficiencyRadarChart({
  metrics,
  height = 300,
}: {
  metrics: Array<{ label: string; value: number; max: number; color?: string }>;
  height?: number;
}) {
  if (!metrics.length || metrics.length < 3) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>雷达图至少需要3个指标</div>;

  const size = Math.min(340, height);
  const center = size / 2;
  const radius = size / 2 - 40;
  const n = metrics.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, r: number) => ({ x: center + r * Math.cos(angle(i)), y: center + r * Math.sin(angle(i)) });

  const rings = [0.25, 0.5, 0.75, 1];
  const dataPoints = metrics.map((m, i) => point(i, Math.min(1, m.value / m.max) * radius));
  const path = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        {rings.map((r, i) => (
          <polygon
            key={i}
            points={metrics.map((_, j) => { const p = point(j, r * radius); return `${p.x},${p.y}`; }).join(' ')}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        ))}
        {metrics.map((_, i) => {
          const p = point(i, radius);
          return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth={1} />;
        })}
        <path d={path} fill="#3b82f6" fillOpacity={0.2} stroke="#3b82f6" strokeWidth={2} />
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="#3b82f6" stroke="#fff" strokeWidth={1.5} />
        ))}
        {metrics.map((m, i) => {
          const p = point(i, radius + 22);
          return (
            <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight={600} fill="#334155">
              {m.label}
            </text>
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 8px', background: '#f8fafc', borderRadius: 6 }}>
            <span style={{ color: '#475569', fontWeight: 500 }}>{m.label}</span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{m.value.toFixed(m.value < 10 ? 2 : 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================== Funnel Chart (转化漏斗图) ========================
export function ConversionFunnelChart({
  stages,
  height = 320,
}: {
  stages: Array<{ label: string; value: number; color?: string; desc?: string }>;
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (!stages.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>暂无漏斗数据</div>;

  const max = stages[0].value || 1;
  const colors = ['#1e40af', '#0d9488', '#7c3aed', '#f59e0b', '#dc2626', '#475569'];
  const stageH = Math.min(52, (height - 20) / stages.length);
  const totalDrop = stages.length > 1 ? ((stages[0].value - stages[stages.length - 1].value) / stages[0].value * 100).toFixed(1) : '0';

  return (
    <div style={{ width: '100%' }}>
      {/* 顶部汇总条 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '10px 16px', background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)', borderRadius: 10, border: '1px solid #e0e7ff' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.5px' }}>全链路转化</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginTop: 2 }}>{stages[0].value.toLocaleString()} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>to {stages[stages.length - 1].value.toLocaleString()}</span></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>整体流失率</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', marginTop: 2 }}>{totalDrop}%</div>
        </div>
      </div>

      {/* 漏斗主体 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {stages.map((s, i) => {
          const pct = Math.max(8, (s.value / max) * 100);
          const convRate = i > 0 && stages[i - 1].value > 0 ? (s.value / stages[i - 1].value * 100).toFixed(1) : null;
          const dropRate = i > 0 && stages[i - 1].value > 0 ? ((stages[i - 1].value - s.value) / stages[i - 1].value * 100).toFixed(1) : null;
          const color = s.color || colors[i % colors.length];
          const isHovered = hoverIdx === i;
          return (
            <div key={i} style={{ position: 'relative' }} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
              {/* 阶段序号 */}
              <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, zIndex: 2, boxShadow: `0 2px 8px ${color}40` }}>
                {i + 1}
              </div>
              {/* 漏斗条 */}
              <div style={{ marginLeft: 38, position: 'relative', height: stageH, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', transition: 'all 0.25s ease', transform: isHovered ? 'scale(1.01)' : 'scale(1)', boxShadow: isHovered ? `0 4px 16px ${color}30` : '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color} 0%, ${color}dd 100%)`, borderRadius: 8, transition: 'width 0.5s ease' }} />
                {/* 文字内容 */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '0 16px 0 14px' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: pct > 35 ? '#fff' : '#1e293b', textShadow: pct > 35 ? '0 1px 2px rgba(0,0,0,0.2)' : 'none', whiteSpace: 'nowrap' }}>{s.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {convRate && (
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: pct > 50 ? '#fff' : '#059669', background: pct > 50 ? 'rgba(255,255,255,0.2)' : '#d1fae5', padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                        转化 {convRate}%
                      </span>
                    )}
                    {dropRate && Number(dropRate) > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: pct > 55 ? '#fecaca' : '#dc2626', whiteSpace: 'nowrap' }}>-{dropRate}%</span>
                    )}
                    <span style={{ fontSize: 16, fontWeight: 800, color: pct > 30 ? '#fff' : '#0f172a', textShadow: pct > 30 ? '0 1px 2px rgba(0,0,0,0.2)' : 'none', fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'right' }}>{s.value.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              {/* 连接箭头 */}
              {i < stages.length - 1 && (
                <div style={{ marginLeft: 52, height: 14, display: 'flex', alignItems: 'center', color: '#cbd5e1' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ======================== Heatmap Chart (矩阵热力图) ========================
export function MatrixHeatmap({
  rows,
  cols,
  data,
  colorScale = ['#eff6ff', '#3b82f6', '#1e3a8a'],
  height = 300,
}: {
  rows: string[];
  cols: string[];
  data: number[][];
  colorScale?: [string, string, string];
  height?: number;
}) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  if (!rows.length || !cols.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>暂无热力图数据</div>;

  const max = Math.max(...data.flat(), 1);
  const cellW = 560 / cols.length;
  const cellH = (height - 50) / rows.length;
  const w = cellW * cols.length + 80;
  const h = cellH * rows.length + 40;

  const getColor = (v: number) => {
    const t = v / max;
    if (t < 0.5) {
      const ratio = t / 0.5;
      return interpolateColor(colorScale[0], colorScale[1], ratio);
    }
    const ratio = (t - 0.5) / 0.5;
    return interpolateColor(colorScale[1], colorScale[2], ratio);
  };

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <svg width={w} height={h} style={{ minWidth: w }} onMouseLeave={() => setHover(null)}>
        {cols.map((c, i) => (
          <text key={`c${i}`} x={80 + i * cellW + cellW / 2} y={16} textAnchor="middle" fontSize="10.5" fontWeight={600} fill="#475569">{c}</text>
        ))}
        {rows.map((r, i) => (
          <text key={`r${i}`} x={72} y={36 + i * cellH + cellH / 2} textAnchor="end" dominantBaseline="middle" fontSize="10.5" fontWeight={600} fill="#475569">{r}</text>
        ))}
        {rows.map((r, i) =>
          cols.map((c, j) => {
            const v = data[i]?.[j] || 0;
            const isHovered = hover?.r === i && hover?.c === j;
            return (
              <g key={`${i}-${j}`} onMouseEnter={() => setHover({ r: i, c: j })} style={{ cursor: 'pointer' }}>
                <rect
                  x={80 + j * cellW + 1}
                  y={28 + i * cellH + 1}
                  width={cellW - 2}
                  height={cellH - 2}
                  fill={getColor(v)}
                  rx={3}
                  stroke={isHovered ? '#0f172a' : 'transparent'}
                  strokeWidth={isHovered ? 2 : 0}
                />
                <text x={80 + j * cellW + cellW / 2} y={28 + i * cellH + cellH / 2} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight={700} fill={v / max > 0.5 ? '#fff' : '#1e293b'}>
                  {v > 0 ? v : ''}
                </text>
              </g>
            );
          })
        )}
      </svg>
      {hover && (
        <div style={{ marginTop: 4, fontSize: 11.5, color: '#64748b' }}>
          {rows[hover.r]} × {cols[hover.c]}：<strong style={{ color: '#0f172a' }}>{data[hover.r]?.[hover.c] || 0}</strong>
        </div>
      )}
    </div>
  );
}

function interpolateColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t), g = Math.round(g1 + (g2 - g1) * t), b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ======================== Box Plot Chart (箱线图) ========================
export function BoxPlotChart({
  groups,
  height = 260,
  unit = '',
}: {
  groups: Array<{ label: string; values: number[]; color?: string }>;
  height?: number;
  unit?: string;
}) {
  if (!groups.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>暂无箱线图数据</div>;

  const w = 680;
  const padL = 50, padR = 20, padT = 20, padB = 40;
  const plotW = w - padL - padR;
  const plotH = height - padT - padB;

  const allVals = groups.flatMap(g => g.values);
  const min = Math.min(...allVals, 0);
  const max = Math.max(...allVals, 1);
  const range = max - min || 1;
  const getY = (v: number) => padT + plotH - ((v - min) / range) * plotH;
  const groupW = plotW / groups.length;
  const boxW = Math.min(40, groupW * 0.5);

  const stats = groups.map(g => {
    const sorted = [...g.values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)] || sorted[0];
    const median = sorted[Math.floor(sorted.length * 0.5)] || sorted[0];
    const q3 = sorted[Math.floor(sorted.length * 0.75)] || sorted[sorted.length - 1];
    return { min: sorted[0], q1, median, q3, max: sorted[sorted.length - 1] };
  });

  const colors = ['#1e6091', '#0d9488', '#7c3aed', '#f59e0b', '#dc2626'];

  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const v = min + range * t;
        const y = getY(v);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{v >= 10000 ? (v / 10000).toFixed(1) + 'w' : Math.round(v)}</text>
          </g>
        );
      })}
      {groups.map((g, i) => {
        const s = stats[i];
        const cx = padL + i * groupW + groupW / 2;
        const color = g.color || colors[i % colors.length];
        return (
          <g key={i}>
            <line x1={cx} y1={getY(s.min)} x2={cx} y2={getY(s.max)} stroke={color} strokeWidth={1.5} />
            <line x1={cx - boxW / 3} y1={getY(s.min)} x2={cx + boxW / 3} y2={getY(s.min)} stroke={color} strokeWidth={1.5} />
            <line x1={cx - boxW / 3} y1={getY(s.max)} x2={cx + boxW / 3} y2={getY(s.max)} stroke={color} strokeWidth={1.5} />
            <rect x={cx - boxW / 2} y={getY(s.q3)} width={boxW} height={getY(s.q1) - getY(s.q3)} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.5} rx={2} />
            <line x1={cx - boxW / 2} y1={getY(s.median)} x2={cx + boxW / 2} y2={getY(s.median)} stroke={color} strokeWidth={2.5} />
            <text x={cx} y={height - 14} textAnchor="middle" fontSize="10.5" fontWeight={600} fill="#475569">{g.label}</text>
            <text x={cx} y={height - 2} textAnchor="middle" fontSize="9" fill="#94a3b8">n={g.values.length}</text>
          </g>
        );
      })}
      <line x1={padL} y1={padT + plotH} x2={w - padR} y2={padT + plotH} stroke="#cbd5e1" />
    </svg>
  );
}

// ======================== Word Cloud (词云) ========================
export function WordCloudChart({
  words,
  height = 240,
}: {
  words: Array<{ text: string; count: number; sentiment?: 'positive' | 'negative' | 'neutral' }>;
  height?: number;
}) {
  if (!words.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>暂无词云数据</div>;

  const max = Math.max(...words.map(w => w.count), 1);
  const colors = { positive: '#16a34a', negative: '#dc2626', neutral: '#64748b' };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center', justifyContent: 'center', padding: '16px', minHeight: height }}>
      {words.slice(0, 40).map((w, i) => {
        const size = 12 + (w.count / max) * 28;
        const color = w.sentiment ? colors[w.sentiment] : '#334155';
        const opacity = 0.5 + (w.count / max) * 0.5;
        return (
          <span
            key={i}
            style={{
              fontSize: size,
              fontWeight: w.count / max > 0.5 ? 700 : 500,
              color,
              opacity,
              cursor: 'default',
              transition: 'transform 0.2s ease',
              lineHeight: 1.4,
            }}
            title={`${w.text}：${w.count} 次`}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}

// ======================== Tree Map (树状图) ========================
export function TreeMapChart({
  items,
  height = 280,
}: {
  items: Array<{ label: string; value: number; subItems?: Array<{ label: string; value: number }>; color?: string }>;
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (!items.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>暂无树状图数据</div>;

  const w = 680;
  const total = items.reduce((s, it) => s + it.value, 0) || 1;
  const colors = ['#1e6091', '#0d9488', '#7c3aed', '#f59e0b', '#dc2626', '#0891b2', '#65a30d', '#db2777'];

  // Simple horizontal split layout
  let x = 0;
  const rects = items.map((it, i) => {
    const width = (it.value / total) * w;
    const rect = { ...it, x, width, color: it.color || colors[i % colors.length] };
    x += width;
    return rect;
  });

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} onMouseLeave={() => setHoverIdx(null)}>
        {rects.map((r, i) => {
          const isHovered = hoverIdx === i;
          return (
            <g key={i} onMouseEnter={() => setHoverIdx(i)} style={{ cursor: 'pointer' }}>
              <rect
                x={r.x + 1}
                y={1}
                width={r.width - 2}
                height={height - 2}
                fill={r.color}
                fillOpacity={isHovered ? 0.9 : 0.7}
                rx={4}
                style={{ transition: 'all 0.2s ease' }}
              />
              {r.width > 80 && (
                <>
                  <text x={r.x + r.width / 2} y={height / 2 - 8} textAnchor="middle" fontSize="13" fontWeight={700} fill="#fff">{r.label}</text>
                  <text x={r.x + r.width / 2} y={height / 2 + 12} textAnchor="middle" fontSize="11" fill="#fff" fillOpacity={0.9}>{r.value} · {(r.value / total * 100).toFixed(1)}%</text>
                </>
              )}
              {r.width > 120 && r.subItems && r.subItems.length > 0 && (
                <text x={r.x + r.width / 2} y={height / 2 + 28} textAnchor="middle" fontSize="9.5" fill="#fff" fillOpacity={0.75}>{r.subItems.map(s => s.label).join(' · ')}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hoverIdx !== null && rects[hoverIdx] && (
        <div style={{ position: 'absolute', bottom: -24, left: rects[hoverIdx].x + rects[hoverIdx].width / 2, transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.92)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 11, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {rects[hoverIdx].label}：{rects[hoverIdx].value} ({(rects[hoverIdx].value / total * 100).toFixed(1)}%)
        </div>
      )}
    </div>
  );
}
