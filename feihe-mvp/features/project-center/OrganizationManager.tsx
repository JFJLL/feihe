'use client';
import { useRef, useState } from 'react';
import type { WorkspaceMetadata } from './ProjectFormDialog';
import { Dialog } from '../../components/ui/Dialog';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { api } from '../../lib/hooks/use-project-data';
type Kind = 'client' | 'department' | 'user';
type Entry = { id: string; name: string; industry?: string; email?: string; departmentId?: string };
export function OrganizationManager({ metadata, onClose, onRefresh }: { metadata: WorkspaceMetadata; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [kind, setKind] = useState<Kind>('client'), [editing, setEditing] = useState<Entry | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false);
  const label = kind === 'client' ? '客户' : kind === 'department' ? '部门' : '公司成员';
  const entries: Entry[] = kind === 'client' ? metadata.clients : kind === 'department' ? metadata.departments : metadata.users || [];
  function edit(entry?: Entry) { setCreating(!entry); setError(''); setEditing(entry || { id: '', name: '', industry: '', email: '', departmentId: metadata.departments[0]?.id || '' }); }
  async function save() {
    if (!editing || submitting.current || !editing.name.trim()) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      await api('/api/projects', { method: 'POST', body: JSON.stringify({ action: 'save_' + kind, ...editing }) });
      await onRefresh(); setEditing(null);
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败，填写内容已保留'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <Dialog title="平台基础管理" width={760} onClose={() => { if (!busy) onClose(); }}>
    <div className="integration-management-head">
      <label>管理类别<CustomSelect ariaLabel="基础管理类别" value={kind} disabled={busy} onChange={value => { setKind(value as Kind); setEditing(null); setError(''); }} options={[{ value: 'client', label: '客户' }, { value: 'department', label: '部门' }, { value: 'user', label: '成员目录' }]} /></label>
      <button type="button" className="primary" disabled={busy} onClick={() => edit()}>{kind === 'user' ? '登记公司成员' : '新增' + label}</button>
    </div>
    {kind === 'user' && <p className="integration-form-help">登记已验证企业账号与部门，供负责人和项目成员选择。这里不提供密码登录，也不授予平台管理员权限。</p>}
    {editing && <form className="integration-inline-editor" onSubmit={e => { e.preventDefault(); void save(); }}>
      <fieldset disabled={busy} className="integration-form-grid">
        {kind === 'user' && <label>企业账号ID<input aria-label="企业账号ID" disabled={!creating || busy} value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value })} required /></label>}
        <label>{kind === 'user' ? '成员姓名' : label + '名称'}<input aria-label={kind === 'user' ? '成员姓名' : label + '名称'} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} maxLength={100} required /></label>
        {kind === 'client' && <label>行业（选填）<input value={editing.industry || ''} onChange={e => setEditing({ ...editing, industry: e.target.value })} /></label>}
        {kind === 'user' && <><label>成员邮箱<input type="email" aria-label="成员邮箱" value={editing.email || ''} onChange={e => setEditing({ ...editing, email: e.target.value })} required /></label><label>成员部门<CustomSelect ariaLabel="成员部门" disabled={busy} value={editing.departmentId || ''} onChange={value => setEditing({ ...editing, departmentId: value })} options={metadata.departments.map(d => ({ value: d.id, label: d.name }))} /></label></>}
      </fieldset>
      {error && <p role="alert" className="integration-error">{error}</p>}
      <div className="integration-actions"><button type="button" disabled={busy} onClick={() => setEditing(null)}>取消编辑</button><button type="submit" className="primary" disabled={busy || !editing.name.trim()}>{busy ? '正在保存…' : '保存' + label}</button></div>
    </form>}
    <div className="integration-table-scroll"><table className="data-table" aria-label={label + '目录'}><thead><tr><th>名称</th><th>{kind === 'client' ? '行业' : kind === 'user' ? '邮箱 / 部门' : '项目使用'}</th><th>操作</th></tr></thead><tbody>
      {entries.map(entry => <tr key={entry.id}><td>{entry.name}</td><td>{kind === 'client' ? entry.industry || '未填写' : kind === 'user' ? (entry.email || '') + ' · ' + (metadata.departments.find(d => d.id === entry.departmentId)?.name || '未设置') : '可用于项目归属'}</td><td><button type="button" disabled={busy} aria-label={'编辑' + label + '：' + entry.name} onClick={() => edit(entry)}>编辑</button></td></tr>)}
      {!entries.length && <tr><td colSpan={3}>暂无{label}，可从上方登记。</td></tr>}
    </tbody></table></div>
  </Dialog>;
}
