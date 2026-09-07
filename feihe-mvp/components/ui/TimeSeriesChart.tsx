'use client';
import { useState } from 'react';
import { EmptyState } from './EmptyState';

type Row = { date: string; [key: string]: string | number | null };
export function TimeSeriesChart({ rows, series, title, unit = '条' }: { rows: Row[]; series: { key: string; label: string; color: string }[]; title: string; unit?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const data = [...rows].filter(r=>r.date).sort((a,b)=>a.date.localeCompare(b.date));
  if (!data.length) return <EmptyState title="暂无可绘制的数据" text="同步或抓取真实数据后显示；缺失记录不会补成零。" />;
  const current = data.find(r=>r.date===selected) || data[data.length-1];
  const w=760,h=240,left=64,right=20,top=20,bottom=40;
  const rawMax = Math.max(1,...data.flatMap(r=>series.map(s=>typeof r[s.key]==='number'?Number(r[s.key]):0)));
  const max = unit==='条' ? Math.ceil(rawMax / 4) * 4 : rawMax;
  const x=(i:number)=>data.length===1?w/2:left+i*(w-left-right)/(data.length-1);
  const y=(v:number)=>h-bottom-v/max*(h-top-bottom);
  const fmt=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:2}):'未提供';
  return <div className="data-trend">
    <div className="data-trend-readout" aria-live="polite"><strong>{current.date}</strong>{series.map(s=><span key={s.key}><i style={{background:s.color}} />{s.label} <b>{fmt(current[s.key])}</b>{typeof current[s.key]==='number'?` ${unit}`:''}</span>)}</div>
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title}>
      <title>{title}，{data.length} 个日期。下方可选择日期查看数值。</title>
      {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={left} x2={w-right} y1={y(max*t)} y2={y(max*t)} stroke="#e2e8f0"/><text x={left-8} y={y(max*t)+4} textAnchor="end" fill="#64748b" fontSize="11">{fmt(max*t)}</text></g>)}
      {series.map(s=>{
        let path='',previous=false;
        data.forEach((r,i)=>{const v=r[s.key];if(typeof v!=='number'||!Number.isFinite(v)){previous=false;return;}path+=`${previous?'L':'M'}${x(i)},${y(v)} `;previous=true;});
        return <g key={s.key}><path d={path} fill="none" stroke={s.color} strokeWidth="2.5" />{data.map((r,i)=>typeof r[s.key]==='number'?<circle key={r.date} cx={x(i)} cy={y(Number(r[s.key]))} r={r.date===current.date?5:3} fill={s.color}><title>{r.date} {s.label} {fmt(r[s.key])}{unit}</title></circle>:null)}</g>;
      })}
      {data.map((r,i)=><rect key={r.date} x={x(i)-Math.max(8,(w-left-right)/data.length/2)} y={top} width={Math.max(16,(w-left-right)/data.length)} height={h-top-bottom} fill="transparent" onMouseEnter={()=>setSelected(r.date)} onClick={()=>setSelected(r.date)} />)}
      <text x={left} y={h-12} fill="#64748b" fontSize="12">{data[0].date}</text><text x={w-right} y={h-12} textAnchor="end" fill="#64748b" fontSize="12">{data.length>1?data.at(-1)?.date:''}</text>
    </svg>
    <label className="data-trend-picker">查看日期 <select value={current.date} onChange={e=>setSelected(e.target.value)}>{data.map(r=><option key={r.date}>{r.date}</option>)}</select><span>{data.length===1?'当前只有一个日期，显示真实数据点':`${data.length} 个观测日期 · 悬停或选择日期查看`}</span></label>
  </div>;
}
