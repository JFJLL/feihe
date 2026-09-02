'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Project = { id:string; name:string; spu:string; brand:string; category:string; description:string; status:string; color:string; startAt?:string; endAt?:string; updatedAt:string; noteCount:number; reportableCount:number };
type Source = { id:string; projectId:string; type:string; name:string; spreadsheet:string; sheetId:string; range:string; kind:string; syncFrequency:string; status:string; lastSyncedAt?:string; lastRowCount:number; mappingJson:string; lastError:string };
type Integration = { id:string; projectId:string; provider:string; name:string; baseUrl:string; enabled:number; configJson:string; status:string; lastTestedAt?:string; lastError:string };
type Workspace = { projects:Project[]; sources:Source[] };
type IntegrationData = { integrations:Integration[]; credentialStatus:{ redtrend:boolean; oss:boolean; feishu:boolean; keystone:boolean } };

const emptyProject = { name:'', spu:'', brand:'', category:'', description:'', status:'进行中', color:'#2563eb' };
const emptySource = { name:'实时发布进度表', type:'feishu_sheet', spreadsheet:'', sheetId:'', range:'A1:AZ5000', kind:'owned', syncFrequency:'manual', mappingJson:'{}' };
const redtrendConfig = JSON.stringify({ searchPath:'/api/solar/content_square/searchNote', detailPath:'/api/solar/note/{noteId}/detail?bizCode=', l1Path:'/api/solar/note/{noteId}/l1_comments', l2Path:'/api/solar/note/{noteId}/l2_comments' }, null, 2);
const emptyIntegration = { name:'RedTrend 内容与评论接口', provider:'redtrend', baseUrl:'', enabled:true, configJson:redtrendConfig };

async function api<T>(url:string, options?:RequestInit) {
  const response = await fetch(url, { ...options, headers:{ 'Content-Type':'application/json', ...(options?.headers || {}) } });
  const data = await response.json() as T & { ok?:boolean; error?:string };
  if (!response.ok || data.ok === false) throw new Error(data.error || '操作失败');
  return data;
}
const when = (value?:string) => value ? new Date(value).toLocaleString('zh-CN', { hour12:false }) : '尚未运行';

export default function PlatformClient({ initialView, userName, initialProjectId='qicui' }:{ initialView:'projects'|'sources'|'integrations'; userName:string; initialProjectId?:string }) {
  const [workspace, setWorkspace] = useState<Workspace>({ projects:[], sources:[] });
  const [tools, setTools] = useState<IntegrationData>({ integrations:[], credentialStatus:{ redtrend:false, oss:false, feishu:false, keystone:false } });
  const [projectId, setProjectId] = useState(initialProjectId);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [showProjectEditor, setShowProjectEditor] = useState(false);
  const [project, setProject] = useState<Record<string,unknown>>(emptyProject);
  const [source, setSource] = useState<Record<string,unknown>>(emptySource);
  const [integration, setIntegration] = useState<Record<string,unknown>>(emptyIntegration);

  const refresh = useCallback(async () => {
    const [nextWorkspace, nextTools] = await Promise.all([api<Workspace>('/api/projects'), api<IntegrationData>('/api/integrations')]);
    setWorkspace(nextWorkspace); setTools(nextTools);
    if (!nextWorkspace.projects.some((item) => item.id === projectId) && nextWorkspace.projects[0]) setProjectId(nextWorkspace.projects[0].id);
  }, [projectId]);

  useEffect(() => {
    const timer = setTimeout(() => refresh().catch((error) => setMessage(error instanceof Error ? error.message : '加载失败')), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  async function run(key:string, work:()=>Promise<unknown>, success:string) {
    setBusy(key);
    try { await work(); setMessage(success); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : '操作失败'); }
    finally { setBusy(''); }
  }
  function openProjectEditor(item?:Project) {
    setProject(item ? { ...item } : emptyProject); setShowProjectEditor(true); window.scrollTo({ top:0, behavior:'smooth' });
  }
  async function saveProject() {
    const action = project.id ? 'update' : 'create';
    await run('project', () => api('/api/projects', { method:'POST', body:JSON.stringify({ action, projectId:project.id, ...project }) }), action === 'create' ? '项目已创建' : '项目已更新');
    setProject(emptyProject); setShowProjectEditor(false);
  }
  async function removeProject(item:Project) {
    if (!confirm(`确认删除项目“${item.name}”？项目内规则、评论、任务和数据源会一并删除。`)) return;
    await run(item.id, () => api('/api/resources', { method:'POST', body:JSON.stringify({ action:'project_delete', projectId:item.id }) }), '项目已删除');
  }
  async function saveSource() { await run('source', () => api('/api/projects', { method:'POST', body:JSON.stringify({ action:'save_source', projectId, ...source }) }), '数据源已保存'); setSource(emptySource); }
  async function syncSource(item:Source) { await run(item.id, () => api('/api/feishu/sync', { method:'POST', body:JSON.stringify({ ...item, projectId:item.projectId, sourceId:item.id }) }), `${item.name} 同步完成`); }
  async function removeSource(item:Source) { if (!confirm(`移除数据源“${item.name}”？`)) return; await run(item.id, () => api('/api/projects', { method:'POST', body:JSON.stringify({ action:'remove_source', projectId:item.projectId, id:item.id }) }), '数据源已移除'); }
  async function saveIntegration() { await run('integration', () => api('/api/integrations', { method:'POST', body:JSON.stringify({ action:'save', projectId, ...integration }) }), '工具集成已保存'); setIntegration(emptyIntegration); }
  async function testIntegration(item:Integration) { await run(item.id, () => api('/api/integrations', { method:'POST', body:JSON.stringify({ action:'test', projectId:item.projectId, id:item.id }) }), `${item.name} 连接正常`); }
  async function removeIntegration(item:Integration) { if (!confirm(`删除集成“${item.name}”？`)) return; await run(item.id, () => api('/api/integrations', { method:'POST', body:JSON.stringify({ action:'delete', projectId:item.projectId, id:item.id }) }), '工具集成已删除'); }

  const projects = workspace.projects;
  const sources = workspace.sources.filter((item) => item.projectId === projectId);
  const integrations = tools.integrations.filter((item) => item.projectId === projectId);
  const current = projects.find((item) => item.id === projectId);

  return <div className="platform-shell">
    <header className="platform-top">
      <Link className="platform-brand" href="/"><b>智</b><span>社媒增长中台<small>CONTENT INTELLIGENCE OS</small></span></Link>
      <nav aria-label="平台导航"><Link className={initialView === 'projects' ? 'active' : ''} href="/">项目中心</Link>{initialView !== 'projects'&&<Link className="active" href={initialView==='sources'?`/data-sources?project=${projectId}`:`/integrations?project=${projectId}`}>{initialView==='sources'?'数据源配置':'工具集成配置'}</Link>}</nav>
      <div className="platform-user"><i>{userName.slice(0, 1).toUpperCase()}</i><span>{userName}<small>平台管理员</small></span></div>
    </header>

    <main className="platform-main">
      {message && <div className="platform-message"><span>{message}</span><button onClick={() => setMessage('')} aria-label="关闭提示">×</button></div>}

      {initialView === 'projects' && <>
        <section className="platform-heading"><div><small>PROJECT PORTFOLIO</small><h1>项目中心</h1><p>以品牌或 SPU 为单位组织数据、规则、评论执行与经营复盘。</p></div><div className="heading-actions"><span>{projects.length} 个项目 · {projects.filter((item) => item.status === '进行中').length} 个进行中</span><button className="primary" onClick={() => openProjectEditor()}>＋ 创建项目</button></div></section>

        {showProjectEditor && <section className="project-compose">
          <div className="compose-title"><div><small>{project.id ? 'EDIT PROJECT' : 'NEW PROJECT'}</small><h2>{project.id ? '编辑项目资料' : '创建品牌 / SPU 项目'}</h2><p>建立独立的数据边界、审查规则和业务看板。</p></div><button onClick={() => setShowProjectEditor(false)} aria-label="关闭编辑器">×</button></div>
          <div className="platform-form project-form-wide"><label>项目名称<input value={String(project.name || '')} onChange={(event) => setProject({ ...project, name:event.target.value })} /></label><label>SPU 名称<input value={String(project.spu || '')} onChange={(event) => setProject({ ...project, spu:event.target.value })} /></label><label>品牌<input value={String(project.brand || '')} onChange={(event) => setProject({ ...project, brand:event.target.value })} /></label><label>品类<input value={String(project.category || '')} onChange={(event) => setProject({ ...project, category:event.target.value })} /></label><label>项目状态<select value={String(project.status || '进行中')} onChange={(event) => setProject({ ...project, status:event.target.value })}><option>进行中</option><option>筹备中</option><option>已结束</option></select></label><label>识别色<input type="color" value={String(project.color || '#2563eb')} onChange={(event) => setProject({ ...project, color:event.target.value })} /></label><label className="full">项目说明<textarea value={String(project.description || '')} onChange={(event) => setProject({ ...project, description:event.target.value })} /></label></div>
          <div className="editor-actions"><button onClick={() => setShowProjectEditor(false)}>取消</button><button className="primary" disabled={busy === 'project' || !project.name || !project.spu} onClick={saveProject}>{project.id ? '保存修改' : '创建并初始化项目'}</button></div>
        </section>}

        <section className="portfolio-grid">{projects.map((item) => <article className="portfolio-card" key={item.id}>
          <div className="portfolio-accent" style={{ background:item.color }} />
          <div className="portfolio-card-head"><span className={`project-state ${item.status === '已结束' ? 'closed' : item.status === '筹备中' ? 'pending' : ''}`}><i />{item.status}</span><button onClick={() => openProjectEditor(item)}>编辑</button></div>
          <div className="project-identity"><b style={{ background:item.color }}>{(item.brand || item.name).slice(0, 1)}</b><div><h2>{item.name}</h2><p>{item.brand || '未配置品牌'} / {item.spu}</p></div></div>
          <p className="project-description">{item.description || `${item.category || '社媒项目'}的数据接入、评论审查与增长分析工作区。`}</p>
          <dl><div><dt>笔记资产</dt><dd>{item.noteCount}</dd></div><div><dt>可汇报</dt><dd>{item.reportableCount}</dd></div><div><dt>数据源</dt><dd>{workspace.sources.filter((sourceItem) => sourceItem.projectId === item.id).length}</dd></div></dl>
          <div className="portfolio-actions"><button className="enter-workspace" onClick={() => window.location.assign(`/projects/${item.id}/agent`)}>进入智能工作台 <span>→</span></button><button onClick={() => window.location.assign(`/projects/${item.id}`)}>执行看板</button>{item.id !== 'qicui' && <button className="danger-link" disabled={busy === item.id} onClick={() => removeProject(item)}>删除</button>}</div>
        </article>)}</section>
      </>}

      {initialView === 'sources' && <>
        <PlatformHeading eyebrow="DATA SOURCES" title="数据源" text="集中配置飞书发布进度表与供应商交付底表，并持续追踪同步状态。" />
        <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />
        <section className="platform-split">
          <article className="platform-panel side-form-panel"><div className="section-kicker">FEISHU SHEET</div><h2>{source.id ? '编辑数据源' : '新增数据源'}</h2><p className="section-copy">配置表格位置、同步策略与字段映射。</p><div className="platform-form"><label>名称<input value={String(source.name || '')} onChange={(event) => setSource({ ...source, name:event.target.value })} /></label><label>用途<select value={String(source.kind || 'owned')} onChange={(event) => setSource({ ...source, kind:event.target.value })}><option value="owned">发布进度 / 自有笔记</option><option value="supplier">供应商评论交付</option></select></label><label className="full">飞书表格链接或 Token<input value={String(source.spreadsheet || '')} onChange={(event) => setSource({ ...source, spreadsheet:event.target.value })} /></label><label>工作表 ID<input value={String(source.sheetId || '')} onChange={(event) => setSource({ ...source, sheetId:event.target.value })} /></label><label>读取范围<input value={String(source.range || '')} onChange={(event) => setSource({ ...source, range:event.target.value })} /></label><label>更新策略<select value={String(source.syncFrequency || 'manual')} onChange={(event) => setSource({ ...source, syncFrequency:event.target.value })}><option value="manual">手动</option><option value="hourly">每小时</option><option value="daily">每日</option></select></label><label className="full">字段映射 JSON<textarea value={String(source.mappingJson || '{}')} onChange={(event) => setSource({ ...source, mappingJson:event.target.value })} /></label></div><div className="editor-actions">{Boolean(source.id) && <button onClick={() => setSource(emptySource)}>取消编辑</button>}<button className="primary" disabled={busy === 'source' || !source.name} onClick={saveSource}>保存数据源</button></div></article>
          <article className="platform-panel"><div className="list-head"><div><div className="section-kicker">CONNECTED SOURCES</div><h2>{current?.name || '项目'}的数据源</h2><p>同步记录、数据量和错误信息统一留痕。</p></div><b>{sources.length}</b></div><div className="management-list">{sources.length ? sources.map((item) => <div key={item.id}><b>飞</b><span><strong>{item.name}</strong><small>{item.kind === 'owned' ? '发布进度' : '供应商交付'} · {item.sheetId || '未填写 Sheet ID'} · {item.range}</small><em>最近同步 {when(item.lastSyncedAt)} · {item.lastRowCount} 条{item.lastError ? ` · ${item.lastError}` : ''}</em></span><i className={item.status.includes('正常') ? 'ok' : 'warn'}>{item.status}</i><button onClick={() => setSource({ ...item })}>编辑</button><button disabled={busy === item.id || !item.spreadsheet || !item.sheetId} onClick={() => syncSource(item)}>同步</button><button className="danger-link" onClick={() => removeSource(item)}>删除</button></div>) : <Empty text="当前项目尚未配置数据源" />}</div></article>
        </section>
      </>}

      {initialView === 'integrations' && <>
        <PlatformHeading eyebrow="TOOL CONNECTIONS" title="工具集成" text="按项目管理 RedTrend、小红书评论、飞书与 OSS 等服务。" />
        <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />
        <section className="credential-strip"><span className={tools.credentialStatus.redtrend ? 'ok' : ''}><b>RT</b>RedTrend 地址<em>{tools.credentialStatus.redtrend ? '已配置' : '未配置'}</em></span><span className={tools.credentialStatus.oss ? 'ok' : ''}><b>OS</b>OSS Cookie 池<em>{tools.credentialStatus.oss ? '已配置' : '未配置'}</em></span><span className={tools.credentialStatus.feishu ? 'ok' : ''}><b>FS</b>飞书应用凭证<em>{tools.credentialStatus.feishu ? '已配置' : '未配置'}</em></span><span className={tools.credentialStatus.keystone ? 'ok' : ''}><b>AI</b>Keystone 网关<em>{tools.credentialStatus.keystone ? '已配置' : '待配置'}</em></span></section>
        <section className="platform-split">
          <article className="platform-panel side-form-panel"><div className="section-kicker">CONNECTION PROFILE</div><h2>{integration.id ? '编辑集成' : '新增工具集成'}</h2><p className="section-copy">敏感凭证由托管环境管理，不写入数据库。</p><div className="platform-form"><label>集成名称<input value={String(integration.name || '')} onChange={(event) => setIntegration({ ...integration, name:event.target.value })} /></label><label>提供方<select value={String(integration.provider || 'redtrend')} onChange={(event) => setIntegration({ ...integration, provider:event.target.value })}><option value="redtrend">RedTrend / 内容与评论</option><option value="feishu">飞书开放平台</option><option value="oss">阿里云 OSS</option><option value="custom_http">自定义 HTTP API</option></select></label><label className="full">Base URL<input value={String(integration.baseUrl || '')} onChange={(event) => setIntegration({ ...integration, baseUrl:event.target.value })} placeholder="https://..." /></label><label className="full">接口路径与参数 JSON<textarea rows={7} value={String(integration.configJson || '{}')} onChange={(event) => setIntegration({ ...integration, configJson:event.target.value })} /></label><label className="check"><input type="checkbox" checked={integration.enabled !== false} onChange={(event) => setIntegration({ ...integration, enabled:event.target.checked })} />启用此集成</label></div><div className="editor-actions">{Boolean(integration.id) && <button onClick={() => setIntegration(emptyIntegration)}>取消编辑</button>}<button className="primary" disabled={busy === 'integration' || !integration.name} onClick={saveIntegration}>保存集成</button></div></article>
          <article className="platform-panel"><div className="list-head"><div><div className="section-kicker">ACTIVE CONNECTIONS</div><h2>{current?.name || '项目'}的工具</h2><p>抓取任务会优先使用这里启用的接口配置。</p></div><b>{integrations.length}</b></div><div className="integration-list">{integrations.length ? integrations.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.provider} · {item.baseUrl || '使用环境默认地址'}</small><em>最近检测 {when(item.lastTestedAt)}{item.lastError ? ` · ${item.lastError}` : ''}</em></span><i className={item.status === '连接正常' ? 'ok' : 'warn'}>{item.status}</i><button onClick={() => setIntegration({ ...item, enabled:Boolean(item.enabled) })}>编辑</button><button disabled={busy === item.id} onClick={() => testIntegration(item)}>检测</button><button className="danger-link" onClick={() => removeIntegration(item)}>删除</button></div>) : <Empty text="当前项目尚未配置工具集成" />}</div></article>
        </section>
      </>}
    </main>
  </div>;
}

function PlatformHeading({ eyebrow, title, text }:{ eyebrow:string; title:string; text:string }) { return <section className="platform-heading"><div><small>{eyebrow}</small><h1>{title}</h1><p>{text}</p></div></section>; }
function ProjectSelect({ projects, value, onChange }:{ projects:Project[]; value:string; onChange:(value:string)=>void }) { return <div className="platform-project-select"><label><span>当前配置项目</span><select value={value} onChange={(event) => onChange(event.target.value)}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.spu}</option>)}</select></label><button className="enter-workspace" onClick={() => window.location.assign(`/projects/${value}`)}>进入该项目工作台 <span>→</span></button></div>; }
function Empty({ text }:{ text:string }) { return <div className="platform-empty">{text}</div>; }
