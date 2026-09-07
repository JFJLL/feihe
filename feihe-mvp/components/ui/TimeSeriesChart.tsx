'use client';
import { useState } from 'react';
import { EmptyState } from './EmptyState';

type Row = { date: string; [key: string]: string | number | null };

function buildSmoothPath(pts: { x: number; y: number }[], tension = 0.25): string {
  if (!pts.length) return '';
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;

  let path = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
}

export function TimeSeriesChart({ rows, series, title, unit = '条' }: { rows: Row[]; series: { key: string; label: string; color: string }[]; title: string; unit?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const data = [...rows].filter(r=>r.date).sort((a,b)=>a.date.localeCompare(b.date));
  if (!data.length) return <EmptyState title="暂无可绘制的数据" text="同步或抓取真实数据后显示；缺失记录不会补成零。" />;
  const activeIndex = hoverIdx !== null ? hoverIdx : Math.max(0, data.findIndex(r=>r.date===(selected || data[data.length-1].date)));
  const current = data[activeIndex] || data[data.length-1];
  const w=760,h=240,left=64,right=20,top=20,bottom=40;
  const rawMax = Math.max(1,...data.flatMap(r=>series.map(s=>typeof r[s.key]==='number'?Number(r[s.key]):0)));
  const max = unit==='条' ? Math.ceil(rawMax / 4) * 4 : rawMax;
  const x=(i:number)=>data.length===1?w/2:left+i*(w-left-right)/(data.length-1);
  const y=(v:number)=>h-bottom-v/max*(h-top-bottom);
  const fmt=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:2}):'未提供';
  const gradId = 'grad-' + (series[0]?.key || 'default') + '-' + Math.round(max % 1000);

  return <div className="data-trend">
    <div className="data-trend-readout" aria-live="polite">
      <strong>{current.date}</strong>
      {series.map(s=><span key={s.key}><i style={{background:s.color}} />{s.label} <b>{fmt(current[s.key])}</b>{typeof current[s.key]==='number'?` ${unit}`:''}</span>)}
    </div>
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title} onMouseLeave={() => setHoverIdx(null)} style={{ overflow: 'visible' }}>
      <title>{title}，{data.length} 个日期。下方可选择日期查看数值。</title>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={series[0]?.color || '#1e6091'} stopOpacity="0.22" />
          <stop offset="100%" stopColor={series[0]?.color || '#1e6091'} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={left} x2={w-right} y1={y(max*t)} y2={y(max*t)} stroke="#e2e8f0"/><text x={left-8} y={y(max*t)+4} textAnchor="end" fill="#64748b" fontSize="11">{fmt(max*t)}</text></g>)}
      {/* 渐变面积填充 (主要指标) */}
      {(() => {
        if (!series[0]) return null;
        const s0 = series[0];
        const pts = data.map((r, i) => {
          const v = r[s0.key];
          return typeof v === 'number' && Number.isFinite(v) ? { x: x(i), y: y(v) } : null;
        }).filter((p): p is { x: number; y: number } => p !== null);
        if (pts.length < 2) return null;
        const linePath = buildSmoothPath(pts);
        const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${h - bottom} L ${pts[0].x} ${h - bottom} Z`;
        return <path d={areaPath} fill={`url(#${gradId})`} />;
      })()}
      {/* 平滑趋势曲线 */}
      {series.map(s=>{
        const pts = data.map((r, i) => {
          const v = r[s.key];
          return typeof v === 'number' && Number.isFinite(v) ? { x: x(i), y: y(v) } : null;
        }).filter((p): p is { x: number; y: number } => p !== null);
        if (!pts.length) return null;
        const smoothD = buildSmoothPath(pts);
        return <g key={s.key}>
          <path d={smoothD} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((r,i)=>{
            const val = r[s.key];
            if (typeof val !== 'number' || !Number.isFinite(val)) return null;
            const isActive = r.date === current.date;
            return <circle key={r.date} cx={x(i)} cy={y(val)} r={isActive ? 5.5 : 3.5} fill={s.color} stroke="#ffffff" strokeWidth={isActive ? 2 : 1}><title>{r.date} {s.label} {fmt(val)}{unit}</title></circle>;
          })}
        </g>;
      })}
      {/* 悬停竖向对齐虚线 */}
      <line x1={x(activeIndex)} y1={top} x2={x(activeIndex)} y2={h-bottom} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" pointerEvents="none" />
      {/* 交互热区 */}
      {data.map((r,i)=><rect key={r.date} x={x(i)-Math.max(8,(w-left-right)/data.length/2)} y={top} width={Math.max(16,(w-left-right)/data.length)} height={h-top-bottom} fill="transparent" onMouseEnter={()=>{ setHoverIdx(i); setSelected(r.date); }} onClick={()=>setSelected(r.date)} />)}
      <text x={left} y={h-12} fill="#64748b" fontSize="12">{data[0].date}</text><text x={w-right} y={h-12} textAnchor="end" fill="#64748b" fontSize="12">{data.length>1?data.at(-1)?.date:''}</text>
    </svg>
    {/* 浮动交互提示框 */}
    {hoverIdx !== null && (
      <div className="data-trend-tooltip" style={{ left: `${Math.min(84, Math.max(16, (x(activeIndex) / w) * 100))}%` }}>
        <div className="data-trend-tooltip-date">{current.date}</div>
        {series.map(s => (
          <div key={s.key} className="data-trend-tooltip-row">
            <i style={{ background: s.color }} />
            <span>{s.label}:</span>
            <strong>{fmt(current[s.key])}{typeof current[s.key] === 'number' ? ` ${unit}` : ''}</strong>
          </div>
        ))}
      </div>
    )}
    <label className="data-trend-picker">
      查看日期 <select value={current.date} onChange={e=>{ setSelected(e.target.value); setHoverIdx(null); }}>
        {[...data].reverse().map(r=><option key={r.date} value={r.date}>{r.date}{r.date===data.at(-1)?.date?' (最新)':''}</option>)}
      </select>
      <span>{data.length===1?'当前只有一个日期，显示真实数据点':`${data.length} 个观测日期 · 悬停曲线或切换日期交互`}</span>
    </label>
  </div>;
}
