'use client';
import { useState } from 'react';
import { FEISHU_DOCUMENTS, type FeishuData } from '../../lib/feishu-model';
import { cnTime } from '../../lib/hooks/use-project-data';
import type { FeishuSyncResult } from '../../lib/feishu-sync';

export function SyncButton({ projectId, onRefresh }: { projectId: string; onRefresh: (opts?: {fresh?:boolean})=>Promise<void> }) {
  const [status,setStatus]=useState<'idle'|'syncing'|'success'|'error'>('idle');
  const [message,setMessage]=useState('');
  async function sync() {
    setStatus('syncing');setMessage('正在逐表核对数据，完成后显示变更结果。');
    try {
      // Partial failures still contain useful per-sheet reports; refresh those before showing the error.
      const response=await fetch('/api/feishu/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId,all:true})});
      const result=await response.json() as FeishuSyncResult & {error?:string};
      if(!response.ok)throw new Error(result.error||result.message||'同步失败');
      await onRefresh({fresh:true});
      setStatus(result.ok?'success':'error');setMessage(result.message);
    } catch(e){setStatus('error');setMessage(e instanceof Error?e.message:'同步失败，请重试');}
  }
  return <div className="sync-control"><button type="button" className={`sync-button sync-${status}`} onClick={sync} disabled={status==='syncing'} aria-busy={status==='syncing'}>
    {status==='syncing'?<span className="sync-spinner" aria-hidden="true" />:<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{status==='success'?<path d="m5 12 4 4L19 6"/>:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/></>}</svg>}
    {status==='syncing'?'正在同步最新数据':status==='success'?'已核对 · 再次同步':status==='error'?'同步异常 · 重试':'同步最新数据'}
  </button>{message&&<div className={`sync-feedback sync-feedback-${status}`} role={status==='error'?'alert':'status'}>
    <div className="sync-feedback-arrow" />
    <div className="sync-feedback-content">
      {status==='syncing'&&<span className="sync-feedback-dot" />}
      <span>{message}</span>
    </div>
  </div>}</div>;
}
export function FeishuSources({data,projectId}:{data?:FeishuData;projectId:string}) {
  if(projectId!=='qicui')return null;
  return <details className="source-map"><summary>数据来源与多工作表溯源明细 {data?.reports.some(r=>r.status==='error')&&<b className="source-error"> · 部分读取失败</b>}<span>{data?.checkedAt?`最近核对 ${cnTime(data.checkedAt)}`:'尚未在线核对 · 点击同步最新数据'}</span></summary>
    <div style={{ margin: '8px 0 12px', fontSize: '12.5px', color: '#475569', lineHeight: 1.6 }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }} />
        <strong style={{ color: '#0f172a' }}>飞书多文档·多Sheet溯源机制：</strong>
        <span>当前项目数据分别接入飞书4大专项文档及14张子工作表，每条数据支持追溯至文档名、Sheet名称、唯一Sheet ID及行范围。</span>
      </div>
      <div style={{ fontSize: '12px', color: '#64748b' }}>
        投放日期以源表实际填写的日期行为准；同步时间不等于数据日期。蒲公英内容源按发布日期自动筛选近90天。失败时保留上次成功数据。评论情感来自评论抓取与分类，不由投放表推算。
      </div>
    </div>
    <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>所属飞书文档</th><th>源工作表 (Sheet Name & ID)</th><th>对应网站系统位置与模块</th><th>读取范围 / 字段口径</th><th>数据日期 / 月份</th><th>读取有效行数</th><th>本次核对状态</th></tr></thead><tbody>{FEISHU_DOCUMENTS.flatMap(d=>d.sheets.map(s=>{
      const r=data?.reports.find(r=>r.sheetId===s.id);
      return <tr key={s.id}>
        <td>
          <strong style={{ color: '#0f172a', fontSize: '12.5px' }}>{d.title}</strong>
          <br/>
          <small style={{ color: '#64748b' }}>Wiki: <code>{d.wiki}</code></small>
        </td>
        <td>
          <a href={`https://yimeichuanbo.feishu.cn/wiki/${d.wiki}?sheet=${s.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: '#0284c7' }}>
            {r?.sheetName||s.name} ↗
          </a>
          <br/>
          <small style={{ color: '#475569' }}>Sheet ID: <code>{s.id}</code></small>
        </td>
        <td>
          <span style={{ fontSize: '12px', color: '#1e293b' }}>{s.use}</span>
        </td>
        <td>
          <code style={{ fontSize: '11.5px', color: '#475569' }}>A1:{s.end}</code>
          <br/>
          <small style={{ color: '#64748b' }}>类型: {s.kind}</small>
        </td>
        <td>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>
            {!r ? '未核对' : r.status === 'error' ? '读取失败' : r.latestDate || '全周期/无日期'}
          </span>
        </td>
        <td>
          <strong>{r?.rows ?? '—'}</strong>
        </td>
        <td>
          {!r ? (
            <span style={{ color: '#94a3b8' }}>未核对</span>
          ) : r.status === 'error' ? (
            <span className="source-error">{r.error}（保留旧版本）</span>
          ) : r.changed ? (
            <span style={{ color: '#15803d', fontWeight: 600 }}>✓ 已同步 · 内容有更新</span>
          ) : (
            <span style={{ color: '#64748b' }}>✓ 已核对 · 内容无变化</span>
          )}
        </td>
      </tr>;
    }))}</tbody></table></div>
    <p style={{ marginTop: '10px', fontSize: '12px', color: '#64748b' }}>溯源说明：“各品线分工明细”（ldZDsR）是协作分工说明，不是月度指标源；其他未列出的工作表暂未接入。内容规划无固定日期列，系统自动计算内容哈希指纹进行无损比对溯源。</p>
  </details>;
}

export function PlanningLibrary({data}:{data?:FeishuData}) {
  const [query,setQuery]=useState('');
  const rows=(data?.planning||[]).filter(r=>Object.values(r).some(v=>v.includes(query)));
  return <section className="ops-section-card"><div className="ops-section-card-head"><div><span className="section-mini-tag tag-purple">内容规划</span><h3>人群切角与场景库</h3><p>来自飞书「内容切角们」「启萃场景库」，供选题参考。</p></div><input aria-label="搜索场景与人群" placeholder="搜索人群、场景、痛点" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <div className="planning-grid">{rows.map((r,i)=><article className="planning-item" key={i}><small>{r.audience||'人群未填写'} · {r.stage}</small><h4>{r.scene}</h4><p>{r.detail}</p><span>{r.format}</span></article>)}</div>{!rows.length&&<p>{data?.planning.length?'没有匹配的场景':'同步最新数据后显示规划内容。'}</p>}
  </section>;
}
