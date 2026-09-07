'use client';
import { useState } from 'react';
import Link from '../../components/ui/AppLink';
import type { Dashboard, Ops, Project } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { WorkspaceModuleTabs } from '../../components/ui/operations/WorkspaceModuleTabs';
import { EmptyState } from '../../components/ui/EmptyState';
import { SyncButton, FeishuSources } from '../../components/ui/FeishuSources';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { api, num, pct } from '../../lib/hooks/use-project-data';

const amount=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:2}):'—';
export function OverviewWorkspace({ projectId, project, dashboard, ops, onRefresh=async()=>{} }: {
  projectId:string;project?:Project;dashboard:Dashboard;ops:Ops;loading?:boolean;onRefresh?:(opts?:{fresh?:boolean})=>Promise<void>;
}) {
  const [tab,setTab]=useState('overview');
  const [selected,setSelected]=useState('');
  const [prompt,setPrompt]=useState('根据当前项目真实数据，复盘内容表现与评论风险，并列出下一步行动');
  const [busy,setBusy]=useState(false),[report,setReport]=useState(''),[error,setError]=useState('');
  const rows=(dashboard.feishu?.daily||[]).filter(r=>String(r.date)>='2026-07-01'&&String(r.date)<='2026-09-30');
  const daily=rows.find(r=>r.date===selected)||rows.at(-1);
  const date=String(daily?.date||'');
  const period=rows.filter(r=>String(r.date)<=date);
  const total=period.reduce((sum,r)=>sum+num(r.actual_spend),0);
  const month=period.filter(r=>String(r.date).slice(0,7)===date.slice(0,7));
  const sum=(items:typeof rows,k:string)=>items.reduce((a,r)=>a+num(r[k]),0);
  const m=dashboard.metrics;
  const chartRows=period.slice(-30).map(r=>({...r,date:String(r.date)}));
  const pending=num(m.actions?.replyPending)+num(m.actions?.deletePending);
  async function generate() {
    setBusy(true);setError('');setReport('');
    try{const result=await api<{reportId:string}>('/api/agent',{method:'POST',body:JSON.stringify({projectId,prompt})});setReport(result.reportId);await onRefresh({fresh:true});}
    catch(e){setError(e instanceof Error?e.message:'生成失败');}finally{setBusy(false);}
  }
  return <div className="ops-workspace overview-colorful-page">
    <PageHeader eyebrow="FEIHE DASHBOARD" title={project?.name||'项目总览'} subtitle="2026年 Q3 · 内容增长、投放表现与评论运营">
      <div className="workspace-header-actions"><span className="overview-quarter-pill">投放数据截至 {date||'待同步'}</span><SyncButton projectId={projectId} onRefresh={onRefresh}/><Link className="btn-link" href={`/projects/${encodeURIComponent(projectId)}/settings?tab=rules`}>项目配置与目标 →</Link></div>
    </PageHeader>
    <FeishuSources data={dashboard.feishu} projectId={projectId}/>
    <WorkspaceModuleTabs tabs={[{id:'overview',title:'总览 · Q3累计全盘',desc:'预算节奏、内容表现与评论风险',icon:'📊'},{id:'daily',title:'分日 · 日报监控看板',desc:'真实日度指标、消耗与CTR趋势',icon:'📅'}]} activeTab={tab} onChange={setTab}/>
    {!daily?<EmptyState title="尚未同步在线投放数据" text="点击「同步最新数据」读取已填写的实际数据。历史内置演示数据不会作为真实指标展示。"/>:<>
      {tab==='daily'&&<div className="pastel-card pastel-blue daily-filter"><label>数据日期 <select aria-label="数据日期" value={date} onChange={e=>setSelected(e.target.value)}>{rows.map(r=><option key={String(r.date)}>{String(r.date)}</option>)}</select></label><button className="btn-link" onClick={()=>setSelected('')}>回到最新日期</button><span>只显示已填实际投放的日期；缺失值显示 —</span></div>}
      {tab==='overview'?<>
        <DashboardSection title="今日数据与运营健康度" eyebrow="PROJECT HEALTH" desc={`基准日期 ${date} · 按真实指标判断，未设置综合评分模型。`}>
          <div className="ops-metric-grid"><MetricCard theme="blue" label="实际投放消耗" value={amount(daily.actual_spend)} unit="元" desc={`F+S预算 ${amount(daily.plan_spend)} 元；聚光全量消耗 ${amount(daily.ads_spend)} 元（范围不同）`}/><MetricCard theme="green" label="信息流 CTR" value={amount(daily.feed_ctr)} unit="%" desc="聚光全量信息流与视频流：点击合计 / 展现合计"/><MetricCard theme="teal" label="搜索 CTR" value={amount(daily.search_ctr)} unit="%" desc="聚光全量搜索：点击合计 / 展现合计"/><MetricCard theme={pending?'yellow':'green'} label="待处置风险评论" value={pending} unit="条" desc={`待回复 ${num(m.actions?.replyPending)} · 待删除 ${num(m.actions?.deletePending)}`}/></div>
        </DashboardSection>
        <DashboardSection title="预算消耗节奏与投流结构" eyebrow="SPEND & CHANNELS" desc={`截至 ${date}，累计覆盖 ${period.length} 个有数据的日期。`}>
          <div className="ops-metric-grid"><MetricCard theme="yellow" label="当月实际消耗" value={amount(sum(month,'actual_spend'))} unit="元" desc={`${date.slice(0,7)} · ${month.length} 个日期`}/><MetricCard theme="blue" label="Q3累计实际消耗" value={amount(total)} unit="元" desc="按实际日度消耗相加"/><MetricCard theme="teal" label="累计信息流消耗" value={amount(sum(period,'feed_spend'))} unit="元"/><MetricCard theme="purple" label="累计搜索消耗" value={amount(sum(period,'search_spend'))} unit="元"/></div>
        </DashboardSection>
      </>:<section className="ops-metric-grid">{[
        ['实际消耗','actual_spend','元'],['信息流消耗','feed_spend','元'],['搜索消耗','search_spend','元'],['信息流 CTR','feed_ctr','%'],['搜索 CTR','search_ctr','%'],['小红盟 CPUV','xhm_cpuv','元'],['小红星 CPUV','xhx_cpuv','元'],['当天发布笔记','notes_today','篇'],
      ].map(([label,key,unit],i)=><MetricCard key={key} theme={(['blue','green','teal','purple'] as const)[i%4]} label={label} value={amount(daily[key])} unit={unit} desc={date}/>)}</section>}
      <div className="workspace-two-col"><DashboardSection title="近30个观测日 · 投放消耗" desc="来源：周投放底表F+S实际消耗；该日期缺失时采用聚光日表。"><TimeSeriesChart rows={chartRows} title="投放消耗趋势" unit="元" series={[{key:'actual_spend',label:'总消耗',color:'#0284c7'},{key:'search_spend',label:'搜索',color:'#8b5cf6'}]}/></DashboardSection><DashboardSection title="近30个观测日 · CTR" desc="聚光全量样本的点击/展现加权计算；与周投放表范围不同。"><TimeSeriesChart rows={chartRows} title="CTR趋势" unit="%" series={[{key:'feed_ctr',label:'信息流',color:'#0284c7'},{key:'search_ctr',label:'搜索',color:'#10b981'}]}/></DashboardSection></div>
    </>}
    {tab==='overview'&&<>
      <DashboardSection title="内容资产与消费者反馈" eyebrow="CONTENT & VOICE" desc="内容来自项目笔记库；情感指标来自实际抓取评论，与投放日期独立。">
        <div className="ops-metric-grid"><MetricCard theme="purple" label="笔记资产" value={m.noteCount} unit="篇"/><MetricCard theme="blue" label="已收录评论" value={m.commentTotal} unit="条"/><MetricCard theme="green" label="正向口碑率" value={m.commentTotal?pct(m.positiveRate):'—'}/><MetricCard theme="yellow" label="负向风险评论" value={m.negativeCount} unit="条"/></div>
        <div className="workspace-two-col section-spaced">{[['达人层级',dashboard.analytics.creatorLevels],['内容场景',dashboard.analytics.categories]].map(([title,items])=><div key={String(title)} className="planning-item"><h4>{String(title)}</h4>{(items as typeof dashboard.analytics.categories).slice(0,8).map((r,i)=><div className="summary-row" key={i}><span>{String(r.name||'未标注')}</span><strong>{num(r.count)} 篇</strong></div>)}</div>)}</div>
        <div className="workspace-header-actions section-spaced"><Link className="btn-link" href={`/projects/${projectId}/content`}>查看内容管理 →</Link><Link className="btn-link" href={`/projects/${projectId}/comments`}>查看评论运营 →</Link></div>
      </DashboardSection>
      <DashboardSection title="行动与复盘" eyebrow="NEXT ACTIONS" desc="基于待处置事项安排工作，处理状态在运营工作台维护。"><div className="summary-row"><span>风险评论待闭环</span><strong>{pending} 条</strong></div><div className="summary-row"><span>供应商待核验</span><strong>{num(m.supplier?.pendingCount)} 条</strong></div><div className="summary-row"><span>已生成报告</span><strong>{ops.reports.length} 份</strong></div></DashboardSection>
    </>}
    <DashboardSection title="智能复盘" desc="描述要复盘的问题，生成当前项目报告。"><div className="report-prompt"><textarea aria-label="复盘需求" value={prompt} onChange={e=>setPrompt(e.target.value)}/><button className="sync-button" disabled={busy||!prompt.trim()} onClick={generate}>{busy?'正在生成报告…':'生成复盘报告'}</button></div>{error&&<p role="alert">{error}</p>}{report&&<Link className="btn-link" href={`/api/report-html?id=${encodeURIComponent(report)}&projectId=${encodeURIComponent(projectId)}`} target="_blank">打开生成的报告 →</Link>}</DashboardSection>
  </div>;
}
