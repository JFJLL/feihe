'use client';
import Link from '../../components/ui/AppLink';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project, Workspace } from '../../lib/types/project';
import { Dialog } from '../../components/ui/Dialog';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { FeedbackToastContainer } from '../../components/ui/FeedbackToast';
import type { ToastMessage } from '../../components/project-shell/ProjectContext';
import { api, cnTime, ApiError } from '../../lib/hooks/use-project-data';
import { useCacheIdentity } from '../../components/project-shell/IdentityBoundary';
import { AccessState } from '../../components/ui/AccessState';
import { ProjectFormDialog } from './ProjectFormDialog';
import { OrganizationManager } from './OrganizationManager';

export function ProjectCenter({ userName, isDevLocal = false }: { userName: string; isDevLocal?: boolean }) {
  const identity = useCacheIdentity();
  const [accessFailure, setAccessFailure] = useState<{ status: number; message: string } | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  const [organization, setOrganization] = useState(false), [contact, setContact] = useState(false);
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [query, setQuery] = useState(''), [scope, setScope] = useState('all');
  const [client, setClient] = useState('all'), [department, setDepartment] = useState('all');
  const [owner, setOwner] = useState('all'), [status, setStatus] = useState('all');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirm, setConfirm] = useState<{ project: Project; action: 'archive' | 'restore' | 'delete' } | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  function notify(text: string, type: ToastMessage['type'] = 'success') {
    setToasts(prev => [...prev, { id: crypto.randomUUID(), text, type }]);
  }
  const refresh = useCallback(async () => {
    const request = ++generation.current; setLoading(true);
    try {
      const next = await api<Workspace>('/api/projects');
      if (request === generation.current) {
        const confirmedUser = next.metadata?.currentUser;
        if (!confirmedUser || identity !== confirmedUser.orgId + ':' + confirmedUser.userId) { setWorkspace(null); setAccessFailure({ status: 401, message: '登录身份已变化，请重新打开项目中心' }); return; }
        setWorkspace(next); setError('');
      }
    } catch (e) { if (request === generation.current) { if (e instanceof ApiError && [401, 403].includes(e.status)) { setWorkspace(null); setAccessFailure({ status: e.status, message: e.message }); } setError(e instanceof Error ? e.message : '项目读取失败'); } }
    finally { if (request === generation.current) setLoading(false); }
  }, [identity]);
  const invalidateRequests = useCallback(() => { generation.current++; }, []);
  useEffect(() => { const timer = setTimeout(() => void refresh(), 0); return () => { clearTimeout(timer); invalidateRequests(); }; }, [refresh, invalidateRequests]);
  useEffect(() => { const returned = () => { void refresh(); }; window.addEventListener('focus', returned); return () => window.removeEventListener('focus', returned); }, [refresh]);
  const metadata = workspace?.metadata;
  const projects = useMemo(() => workspace?.projects || [], [workspace]);
  const filtered = useMemo(() => projects.filter(p => {
    const currentId = metadata?.currentUser?.userId;
    if (scope === 'owned' && p.ownerId !== currentId) return false;
    if (scope === 'participating' && !p.isParticipant && p.ownerId !== currentId) return false;
    if (client !== 'all' && (p.clientId || 'internal') !== client) return false;
    if (department !== 'all' && p.departmentId !== department) return false;
    if (owner !== 'all' && p.ownerId !== owner) return false;
    if (status !== 'all' && p.status !== status) return false;
    const needle = query.trim().toLowerCase();
    return !needle || [p.name, p.description, p.clientName, p.departmentName, p.ownerName].some(v => v?.toLowerCase().includes(needle));
  }), [projects, metadata, scope, client, department, owner, status, query]);
  async function confirmedAction() {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      await api('/api/projects', { method: 'POST', body: JSON.stringify({ action: confirm.action, projectId: confirm.project.id }) });
      notify(confirm.action === 'delete' ? '项目已删除' : confirm.action === 'archive' ? '项目已归档' : '项目已恢复');
      setConfirm(null); await refresh();
    } catch (e) { notify(e instanceof Error ? e.message : '操作失败', 'error'); }
    finally { setBusy(false); }
  }
  function freshness(p: Project) {
    if (p.templateId === 'campaign_review') {
      if (p.campaignSnapshotAt) return '快照更新 ' + cnTime(p.campaignSnapshotAt);
      return '待接入项目资料';
    }
    if (!p.sourceCount && !p.dataRowCount) return '未接入数据';
    if (!p.dataUpdatedAt) return '待首次同步';
    if (!p.dataRowCount) return '最近同步没有记录';
    return '数据更新 ' + cnTime(p.dataUpdatedAt);
  }
  function actions(p: Project) {
    const archived = Boolean(p.isArchived) || p.status === '已归档';
    return <div className="integration-project-actions">
      {p.canManage && !archived && <button type="button" onClick={() => setEditing(p)}>编辑</button>}
      {p.canManage && <button type="button" onClick={() => setConfirm({ project: p, action: archived ? 'restore' : 'archive' })}>{archived ? '恢复' : '归档'}</button>}
      {p.canDelete && <button type="button" onClick={() => setConfirm({ project: p, action: 'delete' })}>删除</button>}
      <Link className="primary" href={'/projects/' + encodeURIComponent(p.id)}>{p.canManage && p.onboardingStatus !== 'ready' ? '继续设置 →' : '进入工作区 →'}</Link>
    </div>;
  }
  if (accessFailure) return <AccessState status={accessFailure.status} message={accessFailure.message} />;
  return <div className="platform-shell">
    <header className="platform-top"><Link className="platform-brand" href="/"><b>协同</b><span>项目数据与报告协作</span></Link>
      <div className="platform-user"><span>{metadata?.currentUser?.displayName || (workspace ? userName : '验证身份中')}{(isDevLocal || metadata?.isDevLocal) && <span style={{ marginLeft: 6, fontSize: '0.72rem', color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: 4 }}>本地开发</span>}<small>{metadata?.currentUser?.role === 'platform_admin' ? '平台管理员' : '公司成员'}</small></span></div>
    </header>
    <main className="platform-main integration-center">
      <section className="integration-page-heading"><div><h1>项目中心</h1><p>查看负责的工作，或为团队建立自己的数据工作台。</p></div><div className="integration-actions">
        {metadata?.canManageOrganization ? <button type="button" onClick={() => setOrganization(true)}>客户与部门</button> : metadata && <button type="button" onClick={() => setContact(true)}>联系平台管理员</button>}
        <button type="button" className="primary" disabled={!metadata} onClick={() => setEditing(null)}>＋ 新建项目</button>
      </div></section>
      {error && <ErrorState error={error} onRetry={refresh} />}
      {loading && !workspace ? <LoadingState text="正在读取授权项目…" /> : <>
      <section className="integration-project-filters" aria-label="项目筛选">
        <label>搜索<input aria-label="搜索项目" value={query} onChange={e => setQuery(e.target.value)} placeholder="项目、客户、负责人或说明" /></label>
        <label>项目范围<CustomSelect ariaLabel="项目范围" value={scope} onChange={setScope} options={[{ value: 'all', label: '全部可见项目' }, { value: 'participating', label: '我参与的' }, { value: 'owned', label: '我负责的' }]} /></label>
        <label>客户<CustomSelect ariaLabel="筛选客户" value={client} onChange={setClient} options={[{ value: 'all', label: '全部客户' }, { value: 'internal', label: '内部项目' }, ...(metadata?.clients || []).map(c => ({ value: c.id, label: c.name }))]} /></label>
        <label>部门<CustomSelect ariaLabel="筛选部门" value={department} onChange={setDepartment} options={[{ value: 'all', label: '全部部门' }, ...(metadata?.departments || []).map(d => ({ value: d.id, label: d.name }))]} /></label>
        <label>负责人<CustomSelect ariaLabel="筛选负责人" value={owner} onChange={setOwner} options={[{ value: 'all', label: '全部负责人' }, ...(metadata?.users || []).map(u => ({ value: u.id, label: u.name }))]} /></label>
        <label>状态<CustomSelect ariaLabel="筛选状态" value={status} onChange={setStatus} options={[{ value: 'all', label: '全部状态' }, ...['筹备中', '进行中', '已结束', '已归档'].map(s => ({ value: s, label: s }))]} /></label>
      </section>
      <div className="integration-list-toolbar"><span>{filtered.length} 个授权项目</span><div role="group" aria-label="项目显示方式"><button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>项目卡片</button><button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>紧凑列表</button></div></div>
      {!filtered.length ? <EmptyState title="没有符合条件的项目" text={projects.length ? '调整筛选条件查看其他已授权项目。' : '新建项目，或请项目负责人将您加入团队。'} /> : view === 'cards' ?
        <div className="integration-project-grid">{filtered.map(p => <article key={p.id} aria-label={p.name} className="integration-project-card" style={{ borderTopColor: p.color }}>
          <div className="integration-card-status"><span>{p.status}</span><small>{p.templateName}</small></div>
          <div className="integration-project-card-header" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {p.logoUrl ? <img src={p.logoUrl} alt="" className="project-card-logo" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }} /> : null}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2>{p.name}</h2>
              {(p.brand || p.spu) && <small style={{ color: '#0369a1', fontSize: '12px' }}>{[p.brand, p.spu].filter(Boolean).join(' · ')}</small>}
            </div>
          </div>
          <p>{p.clientName || '内部项目'} · {p.departmentName || '部门待设置'}</p><p>负责人：{p.ownerName || '待设置'}</p>
          <p className="integration-project-description">{p.description || '团队数据、分析与报告工作台'}</p>
          <small>{freshness(p)}</small>{p.onboardingStatus !== 'ready' && <small className="integration-setup-status">{p.canManage ? '首次设置未完成' : '工作台待负责人发布'}</small>}
          {actions(p)}
        </article>)}</div> :
        <div className="integration-table-scroll"><table className="data-table" aria-label="项目紧凑列表"><thead><tr><th>项目</th><th>客户 / 部门</th><th>负责人</th><th>状态 / 数据</th><th>操作</th></tr></thead><tbody>{filtered.map(p => <tr key={p.id}><td><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>{p.logoUrl ? <img src={p.logoUrl} alt="" className="project-list-logo" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }} /> : null}<div style={{ minWidth: 0 }}><strong>{p.name}</strong>{(p.brand || p.spu) && <span style={{ marginLeft: '6px', fontSize: '12px', color: '#0369a1' }}>({[p.brand, p.spu].filter(Boolean).join(' · ')})</span>}<small>{p.templateName}</small></div></div></td><td>{p.clientName || '内部项目'}<small>{p.departmentName}</small></td><td>{p.ownerName || '待设置'}</td><td>{p.status}<small>{freshness(p)}</small></td><td>{actions(p)}</td></tr>)}</tbody></table></div>}
      </>}
    </main>
    {editing !== undefined && metadata && <ProjectFormDialog key={editing?.id || 'create'} project={editing} metadata={metadata} projects={projects} onClose={() => setEditing(undefined)} onSaved={async id => { const creating = editing === null; setEditing(undefined); notify(creating ? '项目已创建' : '项目资料已更新'); await refresh(); if (creating) window.location.href = '/projects/' + encodeURIComponent(id); }} />}
    {organization && metadata && <OrganizationManager metadata={metadata} onClose={() => setOrganization(false)} onRefresh={refresh} />}
    {contact && <Dialog title="联系平台管理员" onClose={() => setContact(false)}><p>客户、部门和公司成员由平台管理员维护。请说明需要登记的名称或企业账号；已有项目的接入与看板设置由项目负责人完成。</p>{(metadata?.platformContacts || []).map(c => <p key={c.id}>{c.name} · <a href={'mailto:' + c.email}>{c.email}</a></p>)}{!metadata?.platformContacts?.length && <p>管理员联系方式尚未登记，请联系公司平台运维负责人。</p>}</Dialog>}
    {confirm && <Dialog title={(confirm.action === 'delete' ? '删除项目“' : confirm.action === 'archive' ? '归档项目“' : '恢复项目“') + confirm.project.name + '”'} onClose={() => { if (!busy) setConfirm(null); }}
      footer={<><button disabled={busy} onClick={() => setConfirm(null)}>取消</button><button className="primary" disabled={busy} onClick={() => void confirmedAction()}>{busy ? '处理中…' : confirm.action === 'delete' ? '彻底删除' : confirm.action === 'archive' ? '确认归档' : '确认恢复'}</button></>}>
      <p>{confirm.action === 'delete' ? '永久删除该项目数据及配置，无法恢复。' : confirm.action === 'archive' ? '归档保留数据并暂停写入，之后可恢复。' : '恢复后可继续编辑与同步。'}</p>
    </Dialog>}
    <FeedbackToastContainer toasts={toasts} onClose={id => setToasts(prev => prev.filter(t => t.id !== id))} />
  </div>;
}
