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
    {status==='syncing'?<span className="sync-dots" aria-hidden="true"><i/><i/><i/></span>:<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{status==='success'?<path d="m5 12 4 4L19 6"/>:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/></>}</svg>}
    {status==='syncing'?'正在同步最新数据':status==='success'?'已核对 · 再次同步':status==='error'?'同步异常 · 重试':'同步最新数据'}
  </button>{message&&<p className={`sync-feedback sync-feedback-${status}`} role={status==='error'?'alert':'status'}>{message}</p>}</div>;
}
export function FeishuSources({data,projectId}:{data?:FeishuData;projectId:string}) {
  if(projectId!=='qicui')return null;
  return <details className="source-map"><summary>数据来源与更新明细 {data?.reports.some(r=>r.status==='error')&&<b className="source-error"> · 部分读取失败</b>}<span>{data?.checkedAt?`最近核对 ${cnTime(data.checkedAt)}`:'尚未在线核对 · 点击同步最新数据'}</span></summary>
    <p>投放日期以实际填写的数据为准；同步时间不等于数据日期。失败时保留上次成功数据。评论情感来自评论抓取与分类，不由投放表推算。</p>
    <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>文档 / 工作表</th><th>网站使用位置</th><th>数据日期 / 月份</th><th>读取行数</th><th>本次核对</th></tr></thead><tbody>{FEISHU_DOCUMENTS.flatMap(d=>d.sheets.map(s=>{
      const r=data?.reports.find(r=>r.sheetId===s.id);
      return <tr key={s.id}><td><small>{d.title}</small><br/><a href={`https://yimeichuanbo.feishu.cn/wiki/${d.wiki}?sheet=${s.id}`} target="_blank" rel="noreferrer">{r?.sheetName||s.name}</a><br/><code>{s.id}</code></td><td>{s.use}</td><td>{!r?'未核对':r.status==='error'?'读取失败':r.latestDate||'无日期字段'}</td><td>{r?.rows??'—'}</td><td>{!r?'未核对':r.status==='error'?<span className="source-error">{r.error}（已有数据可能过期）</span>:r.changed?'已同步 · 内容有变化':'已核对 · 内容无变化'}</td></tr>;
    }))}</tbody></table></div>
    <p>“各品线分工明细”（ldZDsR）是分工说明，不是月度指标源；其他未列出的工作表暂未接入。内容规划没有统一更新日期，按内容变化核对。</p>
  </details>;
}

export function PlanningLibrary({data}:{data?:FeishuData}) {
  const [query,setQuery]=useState('');
  const rows=(data?.planning||[]).filter(r=>Object.values(r).some(v=>v.includes(query)));
  return <section className="ops-section-card"><div className="ops-section-card-head"><div><span className="section-mini-tag tag-purple">内容规划</span><h3>人群切角与场景库</h3><p>来自飞书「内容切角们」「启萃场景库」，供选题参考。</p></div><input aria-label="搜索场景与人群" placeholder="搜索人群、场景、痛点" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <div className="planning-grid">{rows.map((r,i)=><article className="planning-item" key={i}><small>{r.audience||'人群未填写'} · {r.stage}</small><h4>{r.scene}</h4><p>{r.detail}</p><span>{r.format}</span></article>)}</div>{!rows.length&&<p>{data?.planning.length?'没有匹配的场景':'同步最新数据后显示规划内容。'}</p>}
  </section>;
}
