'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StyledSelect } from '../../components/ui/StyledSelect';
import { api } from '../../lib/hooks/use-project-data';
import type { SourceRef } from '../../lib/business-daily/types';
import type { CommentJudgment, CommentQueue, ConversationCapture, NoteArchive, NoteReview, Sentiment } from '../../lib/comment-ops/types';
const number=(n:number|null|undefined)=>n===null || n===undefined ? '—':n.toLocaleString('zh-CN',{maximumFractionDigits:2});
const percent=(n:number|null|undefined)=>n===null || n===undefined ? '—':number(n*100)+'%';
const time=(v:string|null|undefined)=>v ? new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):'尚无记录';
const sentiments:Record<Sentiment,string>={positive:'正向体验',negative:'负向体验',question:'问询',neutral:'中性',mixed:'混合/对比',uncertain:'未确定'};
const reviewStates={unchecked:'未检查',needs_fix:'需整改',pending_review:'待复核',qualified:'检查样本合格'};
type Delivery={status:string;content:string;commentDay:string|null;operator:string;form:string;replyRelation:string;screenshot:unknown;owner:string;direction:string;progress:string;source:SourceRef;evidence:string};
type Detail={note:NoteArchive;analysisId:string|null;capture:ConversationCapture|null;metrics:{fetched:number;analyzed:number;coverage:number|null;roots:number}|null;judgments:CommentJudgment[];review:NoteReview;canWrite:boolean;deliveries:{items:Delivery[];total:number;offset:number;hasMore:boolean};attempts:{id:string;status:string;updated_at:string;error:string}[];history:{actor:string;created_at:string;data_json:string}[];corrections:{id:string;commentId:string;actor:string;at:string;reason:string;target:string;sentiment:Sentiment}[]};
export function NoteOperationsWorkspace({projectId}:{projectId:string}) {
  const params=useSearchParams();const [month,setMonth]=useState(()=>params.get('month') || new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()).slice(0,7)),[queue,setQueue]=useState(()=>params.get('queue') || 'active'),[noteId,setNoteId]=useState(()=>params.get('noteId') || ''),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0),[showSettings,setShowSettings]=useState(false);
  const key=JSON.stringify({projectId,month,queue,offset,revision});const [snapshot,setSnapshot]=useState<{key:string;data?:CommentQueue;error?:string}>({key:''});const current=snapshot.key===key ? snapshot:null;
  useEffect(()=>{let valid=true;const load=()=>api<CommentQueue>('/api/comment-ops?'+new URLSearchParams({projectId,month,queue,offset:String(offset),limit:'30'})).then(data=>{if(valid)setSnapshot({key,data});}).catch(e=>{if(valid)setSnapshot({key,error:e instanceof Error ? e.message:'巡查队列读取失败'});});void load();const interval=setInterval(load,30000);return()=>{valid=false;clearInterval(interval);};},[projectId,month,queue,offset,key]);
  useEffect(()=>{const p=new URLSearchParams(window.location.search);p.set('month',month);p.set('queue',queue);if(noteId)p.set('noteId',noteId);else p.delete('noteId');window.history.replaceState(null,'','?'+p);},[month,queue,noteId]);
  useEffect(()=>{const onBack=()=>{const p=new URLSearchParams(window.location.search);setNoteId(p.get('noteId') || '');setMonth(p.get('month') || new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()).slice(0,7));setQueue(p.get('queue') || 'active');setOffset(0);};window.addEventListener('popstate',onBack);return()=>window.removeEventListener('popstate',onBack);},[]);
  if(noteId)return <NoteDetail key={projectId+':'+noteId} projectId={projectId} noteId={noteId} onBack={()=>setNoteId('')} onRefresh={()=>setRevision(r=>r+1)} />;
  const data=current?.data;
  return <div className="business-daily note-operations" data-testid="note-operations"><div className="bd-toolbar"><div><h2>笔记评论巡查</h2><p className="bd-caption">围绕整篇笔记、对话和整改复核，查看当前检查样本与覆盖范围。</p></div><div className="bd-controls"><label>业务月份<input aria-label="巡查月份" type="month" value={month} onChange={e=>{setMonth(e.target.value);setOffset(0);}} /></label><button onClick={()=>setShowSettings(s=>!s)}>{showSettings ? '收起配置' : '巡查与品牌配置'}</button><button onClick={()=>setRevision(r=>r+1)}>刷新本地数据</button></div></div>
    {showSettings && <CommentSettingsDrawer projectId={projectId} onSaved={()=>setRevision(r=>r+1)} />}
    <div className="co-queue-tabs" role="tablist" aria-label="笔记巡查队列">{[['active','在投高消耗笔记','按当月累计消耗排序'],['new','当月新发笔记','按发布日期，历史投放独立'],['history','历史笔记档案','未明确发布日期的档案同时留存']].map(([id,title,desc])=><button key={id} role="tab" aria-selected={queue===id} className={queue===id ? 'active':''} onClick={()=>{setQueue(id);setOffset(0);}}><strong>{title}</strong><span>{desc}</span></button>)}</div>
    {current?.error && <div role="alert" className="bd-alerts"><p>{current.error}</p></div>}
    {!current ? <p>读取本项目本地巡查队列…</p>:data && <><div className="bd-kpis">{[['队列笔记',number(data.total)],['已检查样本',`${data.summary.checked} 篇`],['样本合格率',percent(data.summary.qualityRate)],['笔记检查覆盖率',percent(data.summary.checkedCoverage)]].map(([title,value])=><article key={title}><h4>{title}</h4><strong>{value}</strong></article>)}</div><p className="bd-caption">合格率＝当前分析版本已人工复核为合格的笔记 / 已检查笔记。尚未检查保持未知；逐篇评论覆盖率另列。</p><div className="bd-alerts"><p>{data.ranking}</p><p>{data.sourceStatus.deliveries}</p><p>{data.sourceStatus.comments}</p></div>
      <section className="bd-panel"><div className="bd-panel-head"><h3>{queue==='active' ? '本月在投巡查顺序':queue==='new' ? '本月新发档案':'历史档案'} · {data.total} 篇</h3><span className="bd-caption">第{offset+1}–{offset+data.items.length}条</span></div>{!data.items.length ? <p>本项目当前范围尚无笔记。请配置本项目自己的执行或投放来源。</p>:<div className="bd-scroll co-queue-table"><table><thead><tr>{['笔记与发布时间','月累计消耗','平台总数 / 已采集 / 已分析','交付登记','检查与整改','档案'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{data.items.map((n,index)=><tr key={n.id}><td><strong>{offset+index+1}. {n.title || n.author || '已存档笔记'}</strong><small>{n.author} · {n.tier || '层级未登记'} · {n.publishedDay || '发布日期未明确'}</small><small>{n.id}</small></td><td>{n.spendMonth===month ? number(n.monthlySpend.value):'—'} 元<small>{n.spendMonth===month ? n.monthlySpend.state==='observed' ? '源表月累计':'消耗缺失':'本月未取得消耗观测'}</small></td><td>{n.capture ? <>{number(n.capture.platformTotal)}（{n.capture.totalScope==='roots' ? '主评论':'统计口径待核验'}） / {n.capture.fetched} / {n.capture.analyzed}<small>{n.capture.complete ? '接口范围完整核对':'部分采集'} · {percent(n.capture.coverage)}覆盖</small><small>{time(n.capture.capturedAt)}</small></>:<span>尚未采集 / — / —</span>}{n.lastAttempt && <small className={n.lastAttempt.error ? 'co-error':''}>{n.lastAttempt.status} {n.lastAttempt.error}</small>}</td><td>{number(n.registeredDeliveries)} 条<small>源表登记，不代表平台可见</small></td><td>{reviewStates[n.review.state]}<small>{n.review.owner || n.sourceOwner || '负责人待确认'}{n.review.deadline ? ' · '+n.review.deadline:''}</small><small>巡查：{time(n.review.inspectedAt)}{n.review.stale ? ' · 数据更新需复核':''}</small></td><td><button onClick={()=>setNoteId(n.id)}>查看整篇笔记</button></td></tr>)}</tbody></table></div>}<div className="co-pagination"><button disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-30))}>上一页</button><button disabled={!data.hasMore} onClick={()=>setOffset(n=>n+30)}>下一页</button></div></section></>}
  </div>;
}
function NoteDetail({projectId,noteId,onBack,onRefresh}:{projectId:string;noteId:string;onBack:()=>void;onRefresh:()=>void}) {
  const [revision,setRevision]=useState(0),[deliveryOffset,setDeliveryOffset]=useState(0),[visibleRoots,setVisibleRoots]=useState(20),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const key=JSON.stringify({projectId,noteId,revision,deliveryOffset}),[snapshot,setSnapshot]=useState<{key:string;data?:Detail;error?:string}>({key:''});const detail=snapshot.key===key ? snapshot.data:undefined;
  useEffect(()=>{let valid=true;api<Detail>('/api/comment-ops?'+new URLSearchParams({projectId,noteId,deliveryOffset:String(deliveryOffset),deliveryLimit:'20'})).then(data=>{if(valid)setSnapshot({key,data});}).catch(e=>{if(valid)setSnapshot({key,error:e instanceof Error ? e.message:'档案读取失败'});});return()=>{valid=false;};},[projectId,noteId,deliveryOffset,key]);
  async function action(body:Record<string,unknown>){setBusy(true);setNotice('');try{await api('/api/comment-ops',{method:'POST',body:JSON.stringify({projectId,noteId,...body})});setNotice(body.action==='collect' ? '已交给独立后台采集，关闭网页后仍可执行。':'已保存。');setRevision(r=>r+1);onRefresh();return true;}catch(e){setNotice(e instanceof Error ? e.message:'操作失败');return false;}finally{setBusy(false);}}
  const stats=useMemo(()=>{const sentiment=new Map<string,number>(),themes=new Map<string,number>();for(const j of detail?.judgments || []){const label=j.target+' · '+sentiments[j.sentiment];sentiment.set(label,(sentiment.get(label) || 0)+1);for(const topic of j.topics)themes.set(topic,(themes.get(topic) || 0)+1);}return {sentiment:[...sentiment],themes:[...themes],pending:detail?.judgments.filter(j=>j.needsReview).length || 0};},[detail]);
  const roots=detail?.capture?.comments.filter(c=>c.depth===1) || [];
  return <div className="business-daily note-operations" data-testid="note-operation-detail"><div className="bd-toolbar"><button onClick={onBack}>← 返回巡查队列</button><button onClick={()=>setRevision(r=>r+1)}>刷新档案与后台结果</button></div>{notice && <p role="status">{notice}</p>}{snapshot.key===key && snapshot.error && <p role="alert">{snapshot.error}</p>}{!detail ? <p>读取本地笔记档案…</p>:<>
    <section className="bd-panel"><h2>{detail.note.title || detail.note.author || '已留存的笔记档案'}</h2><p>{detail.note.author} · {detail.note.tier || '层级未登记'} · 发布：{detail.note.publishedDay || '待确认'}</p><p className="bd-caption">稳定笔记ID：{noteId}</p><div className="co-link-row">{detail.note.links.slice(0,3).map((url,i)=><a key={url} href={url} target="_blank" rel="noreferrer">{i ? '备用原文入口':'保留的原文入口'} ↗</a>)}<span className="bd-caption">链接{detail.note.linkState==='unchecked' ? '未校验':detail.note.linkState} · {time(detail.note.linkCheckedAt)}</span>{detail.canWrite && <button disabled={busy} onClick={()=>action({action:'check_link'})}>校验原文入口</button>}</div><p className="bd-caption">原文入口失效时仍可读取本地档案；入口可用性以实际校验为准。</p><details><summary>已保存的笔记正文</summary><p className="co-text">{detail.note.content || '正文尚未采集。已保存的标题、作者、发布日期、投放与交付登记可继续查看。'}</p></details><details><summary>来源与保存时间</summary>{detail.note.sources.map((s,i)=><p className="bd-caption" key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.sourceKey} · 第{s.row || '—'}行 ↗</a> · {time(s.capturedAt)} · {s.version}</p>)}</details></section>
    <div className="bd-kpis">{[['月累计投放消耗',number(detail.note.monthlySpend.value)+' 元'],['平台报告总数',detail.capture ? number(detail.capture.platformTotal)+(detail.capture.totalScope==='roots' ? ' 主评论':'（口径未确定）'):'尚未采集'],['已抓取 / 已分析',detail.metrics ? `${detail.metrics.fetched} / ${detail.metrics.analyzed}`:'— / —'],['供应商交付登记',number(detail.note.registeredDeliveries)+' 条']].map(([title,value])=><article key={title}><h4>{title}</h4><strong>{value}</strong></article>)}</div>
    <div className="bd-alerts"><p>月消耗范围：{detail.note.spendMonth || '待明确'}。评论采集：{time(detail.capture?.capturedAt)}；人工巡查：{time(detail.review.inspectedAt)}。</p><p>采集覆盖：{percent(detail.metrics?.coverage)} · {detail.capture?.complete ? '主评论与已报告回复已核对':'完整覆盖尚未确认'}。平台前台可见与折叠仅采用明确观测证据，不能用交付量推算。</p>{detail.note.sourceAudit && <p>源表整改登记：{detail.note.sourceAudit} · {detail.note.sourceProblem || '具体问题未登记'}。本次巡查状态：{reviewStates[detail.review.state]}。</p>}{detail.capture?.issues.map((issue,i)=><p key={i}>{issue}</p>)}{detail.attempts[0] && <p>最近采集任务：{detail.attempts[0].status} · {time(detail.attempts[0].updated_at)} {detail.attempts[0].error}</p>}</div>
    <div className="bd-two-col"><section className="bd-panel"><h3>整篇笔记的对话概况</h3><p className="bd-caption">按评论提及对象分别判断；话题为多标签。规则依据强度不代表统计概率。</p>{!detail.judgments.length ? <p>尚无实际采集的评论样本，情绪与话题保持未知。</p>:<><div className="co-distributions">{stats.sentiment.map(([label,n])=><p key={label}><span>{label}</span><strong>{n}条</strong></p>)}</div><div className="co-topic-tags">{stats.themes.map(([label,n])=><span key={label}>{label} {n}</span>)}</div><p className="bd-caption">低置信度待人工复核：{stats.pending}条。每条的依据、对话和纠正记录在下方。</p></>}{detail.canWrite && <button disabled={busy} onClick={()=>action({action:'collect',requestId:crypto.randomUUID()})}>采集并分析当前评论</button>}</section><section className="bd-panel"><h3>整改负责人及复核</h3><ReviewForm key={detail.analysisId+':'+detail.review.version} projectId={projectId} noteId={noteId} review={detail.review} analysisId={detail.analysisId} canWrite={detail.canWrite} busy={busy} onSave={review=>action({action:'review',review})} /><p className="bd-caption">源表结论只作登记参考；没有检查样本，或低置信度评论未复核时，不能标为合格。</p></section></div>
    <section className="bd-panel"><h3>主评论与回复 · {detail.metrics?.fetched ?? '尚未采集'} 条</h3>{roots.slice(0,visibleRoots).map(root=><article key={root.id} className="co-thread">{[root,...(detail.capture?.comments.filter(c=>c.parentId===root.id) || [])].map(c=>{const j=detail.judgments.find(v=>v.commentId===c.id);return <div key={c.id} className={'co-comment '+(c.depth===2 ? 'co-reply':'')}><div><strong>{c.author || '作者未提供'}</strong><span>{c.depth===2 ? '回复主评论':'主评论'} · {c.createdAt || '发表时间未知'}</span></div><p>{c.content || '正文缺失'}</p><small>{c.evidence}</small>{j && <><p className={j.needsReview ? 'co-error':'bd-caption'}>{j.target} · {sentiments[j.sentiment]} · 依据强度 {percent(j.confidence)} · {j.corrected ? '已人工纠正':j.needsReview ? '待人工复核':'规则判断'}</p><details><summary>判断依据与人工纠正</summary><p className="co-text">{j.reasons.join('\n')}</p>{detail.canWrite && <CorrectionForm judgment={j} busy={busy} onSave={body=>action({action:'correct',commentId:c.id,analysisId:detail.analysisId,...body})} />}</details></>}</div>;})}</article>)}{!roots.length && <p>尚无实际采集评论；供应商话术登记在下方单独查看。</p>}{visibleRoots<roots.length && <button onClick={()=>setVisibleRoots(n=>n+20)}>展开更多主评论及其回复</button>}</section>
    <section className="bd-panel"><h3>供应商话术与交付登记 · {detail.deliveries.total} 条</h3><p className="bd-caption">登记不能证明平台可见。主评论A/B回复A等源表盖楼标记保留，不能冒充平台真实评论ID与回复关系。</p><div className="bd-scroll"><table><thead><tr><th>登记 / 计划</th><th>话术与执行方向</th><th>评论时间 / 上评</th><th>形式与盖楼</th><th>证据</th></tr></thead><tbody>{detail.deliveries.items.map((d,i)=><tr key={i}><td>{d.status==='registered' ? '时间/人员已登记':'计划或待确认'}</td><td>{d.content}<small>{d.direction}</small></td><td>{d.commentDay || '未登记'}<small>{d.operator || '上评人员未登记'}</small></td><td>{d.form}<small>{d.replyRelation}</small></td><td><a href={d.source.url} target="_blank" rel="noreferrer">第{d.source.row}行 ↗</a><small>{d.screenshot ? '源表有截图附件登记':'未登记截图'}</small><small>{d.progress || '执行进度未登记'}</small></td></tr>)}</tbody></table></div><div className="co-pagination"><button disabled={!deliveryOffset} onClick={()=>setDeliveryOffset(n=>Math.max(0,n-20))}>上一页登记</button><button disabled={!detail.deliveries.hasMore} onClick={()=>setDeliveryOffset(n=>n+20)}>下一页登记</button></div></section>
    <details className="bd-panel"><summary>巡查与纠正留痕</summary>{detail.history.map((h,i)=><p className="bd-caption" key={i}>{time(h.created_at)} · {h.actor} · {JSON.parse(h.data_json).reason}</p>)}{detail.corrections.map(c=><p className="bd-caption" key={c.id}>{time(c.at)} · {c.actor} · {c.target} / {sentiments[c.sentiment]}：{c.reason}</p>)}{!detail.history.length && !detail.corrections.length && <p>尚无人工巡查或纠正记录。</p>}</details>
  </>}</div>;
}
function ReviewForm({projectId,noteId,review,analysisId,canWrite,busy,onSave}:{projectId:string;noteId:string;review:NoteReview;analysisId:string|null;canWrite:boolean;busy:boolean;onSave:(value:NoteReview)=>Promise<boolean>}) {
  const draftKey='comment-review:'+projectId+':'+noteId;
  const [value,setValue]=useState<NoteReview>(()=>{try{const draft=JSON.parse(sessionStorage.getItem(draftKey) || 'null');if(draft && draft.version===review.version && draft.analysisId===analysisId)return draft;}catch{}return {...review,analysisId};});
  function edit(next:Partial<NoteReview>){const data={...value,...next};setValue(data);try{sessionStorage.setItem(draftKey,JSON.stringify(data));}catch{}}
  return <form className="co-review-form" onSubmit={async e=>{e.preventDefault();if(await onSave(value)){try{sessionStorage.removeItem(draftKey);}catch{}}}}><label>巡查状态<StyledSelect disabled={!canWrite || busy} value={value.state} onChange={e=>edit({state:e.target.value as NoteReview['state']})}>{Object.entries(reviewStates).map(([id,label])=><option key={id} value={id}>{label}</option>)}</StyledSelect></label><label>整改 / 复核负责人<input disabled={!canWrite || busy} value={value.owner} onChange={e=>edit({owner:e.target.value})} maxLength={200} /></label><label>截止日期<input disabled={!canWrite || busy} type="date" value={value.deadline || ''} onChange={e=>edit({deadline:e.target.value || null})} /></label><label>检查依据与具体问题<textarea disabled={!canWrite || busy} value={value.reason} onChange={e=>edit({reason:e.target.value})} minLength={5} maxLength={1500} rows={3} /></label>{canWrite && <button type="submit" disabled={busy || !value.owner || value.reason.trim().length<5}>保存巡查与整改记录</button>}{review.stale && <p className="co-error">分析或采集已更新，请按本次样本重新复核。</p>}</form>;
}
function CorrectionForm({judgment,busy,onSave}:{judgment:CommentJudgment;busy:boolean;onSave:(value:{target:string;sentiment:Sentiment;reason:string})=>Promise<boolean>}) {const [target,setTarget]=useState(judgment.target),[sentiment,setSentiment]=useState(judgment.sentiment),[reason,setReason]=useState('');return <form className="co-review-form" onSubmit={async e=>{e.preventDefault();if(await onSave({target,sentiment,reason}))setReason('');}}><label>评价对象<input value={target} disabled={busy} onChange={e=>setTarget(e.target.value)} maxLength={200}/></label><label>情绪<StyledSelect value={sentiment} disabled={busy} onChange={e=>setSentiment(e.target.value as Sentiment)}>{Object.entries(sentiments).map(([id,label])=><option key={id} value={id}>{label}</option>)}</StyledSelect></label><label>人工判断依据<textarea value={reason} disabled={busy} onChange={e=>setReason(e.target.value)} rows={2} minLength={5} maxLength={1000}/></label><button disabled={busy || !target || reason.trim().length<5}>保存人工纠正</button></form>;}

function CommentSettingsDrawer({projectId,onSaved}:{projectId:string;onSaved:()=>void}) {
  const [data,setData]=useState<{confidenceThreshold:number;brands:string[];competitors:string[]}|null>(null);
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState('');
  const [brandsText,setBrandsText]=useState('');
  const [compText,setCompText]=useState('');
  const [threshold,setThreshold]=useState(0.75);

  useEffect(()=>{
    api<{settings:{confidenceThreshold:number;brands:string[];competitors:string[]}}>('/api/comment-ops?projectId='+encodeURIComponent(projectId)+'&action=settings')
      .then(res=>{
        setData(res.settings);
        setThreshold(res.settings.confidenceThreshold);
        setBrandsText(res.settings.brands.join('、'));
        setCompText(res.settings.competitors.join('、'));
      })
      .catch(e=>setMsg(e instanceof Error ? e.message : '配置加载失败'));
  },[projectId]);

  async function handleSave(e:React.FormEvent){
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const brands=brandsText.split(/[、,，\s]+/).map(s=>s.trim()).filter(Boolean);
      const competitors=compText.split(/[、,，\s]+/).map(s=>s.trim()).filter(Boolean);
      await api('/api/comment-ops',{
        method:'POST',
        body:JSON.stringify({
          projectId,
          action:'save_settings',
          confidenceThreshold:Number(threshold),
          brands,
          competitors
        })
      });
      setMsg('项目巡查与品牌配置已保存');
      onSaved();
    } catch(err) {
      setMsg(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bd-panel co-settings-drawer">
      <div className="bd-panel-head">
        <h3>项目配置（品牌、竞品与巡查置信阈值）</h3>
        <span className="bd-caption">配置独立归属于本项目（{projectId}），非开发者SQL维护，不继承或污染其他项目</span>
      </div>
      {msg && <p className={msg.includes('失败') ? 'co-error' : 'bd-caption'}>{msg}</p>}
      {!data ? <p>正在读取项目配置…</p> : (
        <form className="co-review-form" onSubmit={handleSave}>
          <label>
            本品/关注品牌（顿号或逗号分隔）
            <input value={brandsText} onChange={e=>setBrandsText(e.target.value)} placeholder="如：启萃、飞鹤" />
          </label>
          <label>
            竞品词列表（顿号或逗号分隔）
            <input value={compText} onChange={e=>setCompText(e.target.value)} placeholder="如：爱他美、合生元" />
          </label>
          <label>
            人工复核置信度阈值（低于此值进入复核，建议 0.75）
            <input type="number" step="0.05" min="0.1" max="1.0" value={threshold} onChange={e=>setThreshold(parseFloat(e.target.value)||0.75)} />
          </label>
          <div style={{gridColumn:'1/-1',marginTop:'8px'}}>
            <button type="submit" disabled={saving}>{saving ? '保存中…' : '保存项目配置'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
