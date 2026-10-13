'use client';
import { useRef, useState } from 'react';
import type { Project, Workspace } from '../../lib/types/project';
import { api } from '../../lib/hooks/use-project-data';
import { Dialog } from '../../components/ui/Dialog';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { PROJECT_COLORS, PROJECT_STATUSES, automaticProjectColor, projectDraftErrors, type ProjectDraft } from '../../lib/project-form';
import { templateGuide } from '../../lib/project-templates';

export type WorkspaceMetadata = NonNullable<Workspace['metadata']>;
export function ProjectFormDialog({ project, metadata, onClose, onSaved }: {
  project?: Project | null; metadata: WorkspaceMetadata; onClose: () => void;
  onSaved: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState<ProjectDraft>(() => ({
    id: project?.id, name: project?.name || '', description: project?.description || '',
    departmentId: project?.departmentId || metadata.currentUser?.departmentId || 'dept-general',
    ownerId: project?.ownerId || metadata.currentUser?.userId || '', clientId: project?.clientId || '',
    templateId: project?.templateId || 'general_workbench', status: project?.status || '筹备中',
    color: project?.color || '', brand: project?.brand || '', spu: project?.spu || '', category: project?.category || '',
  }));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false);
  const errors = projectDraftErrors(form);
  const guide = templateGuide(form.templateId);
  const isEdit = Boolean(project);
  function field<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
    if (!submitting.current) { setForm(prev => ({ ...prev, [key]: value })); setError(''); }
  }
  async function save() {
    if (submitting.current || errors.length) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const saved = await api<{ id: string }>('/api/projects', { method: 'POST', body: JSON.stringify({ ...form, color: form.color || automaticProjectColor(form.name), action: isEdit ? 'update' : 'create', projectId: project?.id }) });
      await onSaved(saved.id);
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败，已保留填写内容'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <Dialog initialFocus={'input[aria-label="项目名称"]'} title={isEdit ? '编辑项目资料' : '新建项目'} onClose={() => { if (!busy) onClose(); }} width={760}
    footer={<><button type="button" disabled={busy} onClick={onClose}>取消</button><button type="button" className="primary" disabled={busy || errors.length > 0} onClick={() => void save()}>{busy ? '正在保存…' : isEdit ? '保存项目资料' : '创建项目并开启向导'}</button></>}>
    <form className="integration-project-form" onSubmit={e => { e.preventDefault(); void save(); }}>
      <fieldset disabled={busy} className="integration-form-grid">
        <label className="full-field">项目名称<input aria-label="项目名称" value={form.name} onChange={e => field('name', e.target.value)} maxLength={100} placeholder="如：咨询成交分析" required /></label>
        <label>负责部门<CustomSelect ariaLabel="负责部门" value={form.departmentId} disabled={busy} onChange={value => field('departmentId', value)} options={metadata.departments.map(d => ({ value: d.id, label: d.name }))} /></label>
        <label>项目负责人<CustomSelect ariaLabel="项目负责人" value={form.ownerId} disabled={busy} onChange={value => field('ownerId', value)} options={(metadata.users || []).map(u => ({ value: u.id, label: u.name }))} /></label>
        <label className="full-field">客户或内部项目<CustomSelect ariaLabel="客户或内部项目" value={form.clientId} disabled={busy} onChange={value => field('clientId', value)} options={[{ value: '', label: '内部项目' }, ...metadata.clients.map(c => ({ value: c.id, label: c.name }))]} /></label>
        {!isEdit && <label className="full-field">业务方向<CustomSelect ariaLabel="业务方向" value={form.templateId} disabled={busy} onChange={value => field('templateId', value)} options={metadata.templates.map(t => ({ value: t.id, label: t.name }))} /></label>}
        {guide && <div className="full-field integration-form-help"><strong>{guide.name}</strong><p>{guide.description}</p><small>必要字段：{guide.requiredFields.join('、') || '无固定业务字段'}。可选：{guide.optionalFields.join('、') || '按需添加'}。<br />推荐：{guide.recommended}。</small></div>}
        <label className="full-field">项目说明<textarea aria-label="项目说明" value={form.description} onChange={e => field('description', e.target.value)} rows={2} placeholder="这项工作要回答什么问题，团队如何使用结果" /></label>
        <details className="full-field">
          <summary>业务状态与识别色</summary>
          <div className="integration-form-grid secondary-fields">
            <label>业务状态<CustomSelect ariaLabel="业务状态" value={form.status} disabled={busy} onChange={value => field('status', value)} options={PROJECT_STATUSES.map(s => ({ value: s, label: s }))} /></label>
            <div><span>识别色（自动分配，可调整）</span><div className="integration-color-options" role="group" aria-label="项目识别色">{PROJECT_COLORS.map(c => <button key={c.value} type="button" aria-label={'项目识别色：' + c.label} aria-pressed={(form.color || automaticProjectColor(form.name)) === c.value} title={c.label} style={{ background: c.value }} onClick={() => field('color', c.value)} />)}</div></div>
          </div>
        </details>
        {(form.templateId === 'content_marketing' || form.templateId === 'comment_qc' || form.brand || form.spu || form.category) && <details className="full-field"><summary>品牌与产品信息（选填）</summary><div className="integration-form-grid secondary-fields">
          <label>品牌<input value={form.brand} onChange={e => field('brand', e.target.value)} /></label><label>SPU / 产品<input value={form.spu} onChange={e => field('spu', e.target.value)} /></label><label>品类<input value={form.category} onChange={e => field('category', e.target.value)} /></label>
        </div></details>}
      </fieldset>
      {error && <p role="alert" className="integration-error">{error}</p>}
      {errors.length > 0 && <p className="integration-form-hint" aria-live="polite">{errors.join('；')}</p>}
    </form>
  </Dialog>;
}
