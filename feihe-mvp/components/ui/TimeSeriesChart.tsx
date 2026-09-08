'use client';
import { useId, useState } from 'react';
import { EmptyState } from './EmptyState';

type Row = { date: string; [key: string]: string | number | null };

type Point = { x: number; y: number };
function buildPath(points: Point[]) {
  return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x},${point.y}`).join(' ');
}
// Break at missing samples; connecting them implies observations we do not have.
function segments(points: (Point | null)[]) {
  const result: Point[][] = [];
  let current: Point[] = [];
  for (const point of points) {
    if (point) current.push(point);
    else if (current.length) { result.push(current); current = []; }
  }
  if (current.length) result.push(current);
  return result;
}

export function TimeSeriesChart({ rows, series, title, unit = '条' }: { rows: Row[]; series: { key: string; label: string; color: string }[]; title: string; unit?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const chartId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const data = [...rows].filter(r=>r.date).sort((a,b)=>a.date.localeCompare(b.date));
  if (!data.length) return <EmptyState title="暂无可绘制的数据" text="同步或抓取真实数据后显示；缺失记录不会补成零。" />;
  const selectedIndex = data.findIndex(r=>r.date===selected);
  const activeIndex = hoverIdx !== null && hoverIdx < data.length ? hoverIdx : selectedIndex >= 0 ? selectedIndex : data.length - 1;
  const current = data[activeIndex] || data[data.length-1];
  const w=760,h=240,left=64,right=20,top=20,bottom=40;
  const rawMax = Math.max(1,...data.flatMap(r=>series.map(s=>typeof r[s.key]==='number' && Number.isFinite(r[s.key]) ? Number(r[s.key]):0)));
  const max = unit==='条' ? Math.ceil(rawMax / 4) * 4 : rawMax;
  const x=(i:number)=>data.length===1?w/2:left+i*(w-left-right)/(data.length-1);
  const y=(v:number)=>h-bottom-v/max*(h-top-bottom);
  const fmt=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:2}):'未提供';
  const gradId = `trend-gradient-${chartId}`;

  return <div className="data-trend">
    <div className="data-trend-readout" aria-live="polite">
      <strong>{current.date}</strong>
      {series.map(s=><span key={s.key}><i style={{background:s.color}} />{s.label} <b>{fmt(current[s.key])}</b>{typeof current[s.key]==='number'?` ${unit}`:''}</span>)}
    </div>
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title} onMouseLeave={() => setHoverIdx(null)} style={{ overflow: 'visible' }}>
      <title>{`${title}，${data.length} 个日期。悬停或使用下方日期选择查看数值；缺失样本断开显示。`}</title>
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
        const runs = segments(data.map((r, i) => {
          const v = r[s0.key];
          return typeof v === 'number' && Number.isFinite(v) ? { x: x(i), y: y(v) } : null;
        }));
        return runs.filter(points => points.length > 1).map((points, index) => (
          <path key={index} d={`${buildPath(points)} L ${points.at(-1)!.x} ${h-bottom} L ${points[0].x} ${h-bottom} Z`} fill={`url(#${gradId})`} />
        ));
      })()}
      {/* Preserve observed extrema rather than overshooting them with smoothing. */}
      {series.map(s=>{
        const runs = segments(data.map((r, i) => {
          const v = r[s.key];
          return typeof v === 'number' && Number.isFinite(v) ? { x: x(i), y: y(v) } : null;
        }));
        if (!runs.length) return null;
        return <g key={s.key}>
          {runs.map((points, index) => <path key={index} d={buildPath(points)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
          {data.map((r,i)=>{
            const val = r[s.key];
            if (typeof val !== 'number' || !Number.isFinite(val)) return null;
            const isActive = r.date === current.date;
            return <circle key={r.date} cx={x(i)} cy={y(val)} r={isActive ? 5.5 : 3.5} fill={s.color} stroke="#ffffff" strokeWidth={isActive ? 2 : 1}><title>{`${r.date} ${s.label} ${fmt(val)}${unit}`}</title></circle>;
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
  </div>;
}
