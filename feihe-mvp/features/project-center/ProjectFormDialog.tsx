'use client';
import { useEffect, useRef, useState } from 'react';
import type { Project, Workspace } from '../../lib/types/project';
import { api } from '../../lib/hooks/use-project-data';
import { Dialog } from '../../components/ui/Dialog';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { PROJECT_COLORS, PROJECT_STATUSES, STANDARD_DEPARTMENTS, automaticProjectColor, projectDraftErrors, validateLogoFile, type ProjectDraft } from '../../lib/project-form';

export type WorkspaceMetadata = NonNullable<Workspace['metadata']>;
export function ProjectFormDialog({ project, metadata, projects = [], onClose, onSaved }: {
  project?: Project | null; metadata: WorkspaceMetadata; onClose: () => void;
  projects?: Project[];
  onSaved: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState<ProjectDraft>(() => ({
    id: project?.id, name: project?.name || '', description: project?.description || '',
    departmentId: project?.departmentId || '',
    ownerId: project?.ownerId || metadata.currentUser?.userId || '', clientId: project?.clientId || '',
    ownerName: project?.ownerName || (metadata.users?.find(u => u.id === project?.ownerId)?.name) || '',
    templateId: project?.templateId || 'general_workbench', status: project?.status || '筹备中',
    color: project?.color || '', brand: project?.brand || '', spu: project?.spu || '', category: project?.category || '',
    logoUrl: project?.logoUrl || '',
  }));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>(() => project?.logoUrl || '');
  const [logoError, setLogoError] = useState('');
  const submitting = useRef(false);
  const errors = projectDraftErrors(form);
  const isEdit = Boolean(project);
  const isLegacyDept = Boolean(
    isEdit &&
    form.departmentId &&
    !STANDARD_DEPARTMENTS.some(d => d.id === form.departmentId || d.name === form.departmentId)
  );
  const departmentOptions = STANDARD_DEPARTMENTS.map(d => ({ value: d.id, label: d.name }));
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);
  function handleLogoFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateLogoFile(file);
    if (!validation.valid) {
      setLogoError(validation.error || '图片格式不正确');
      e.target.value = '';
      return;
    }
    setLogoError('');
    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    e.target.value = '';
  }
  function handleLogoRemove() {
    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoFile(null);
    setLogoPreview('');
    setLogoError('');
    field('logoUrl', '');
  }
  function field<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
    if (!submitting.current) { setForm(prev => ({ ...prev, [key]: value })); setError(''); }
  }
  async function save() {
    if (submitting.current || errors.length) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      let finalLogoUrl = form.logoUrl || '';
      if (logoFile) {
        const formData = new FormData();
        formData.append('file', logoFile);
        if (project?.id) formData.append('projectId', project.id);
        const uploadRes = await api<{ ok: boolean; logoUrl: string }>('/api/projects/logo', {
          method: 'POST',
          body: formData,
        });
        finalLogoUrl = uploadRes.logoUrl;
      } else if (!logoPreview) {
        finalLogoUrl = '';
      }
      const saved = await api<{ id: string }>('/api/projects', { method: 'POST', body: JSON.stringify({
        ...form,
        ownerName: form.ownerName?.trim(),
        templateId: isEdit ? (project?.templateId || form.templateId) : (form.templateId || 'general_workbench'),
        color: form.color || automaticProjectColor(form.name),
        action: isEdit ? 'update' : 'create',
        projectId: project?.id,
        logoUrl: finalLogoUrl,
      }) });
      await onSaved(saved.id);
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败，已保留填写内容'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <Dialog initialFocus={'input[aria-label="项目名称"]'} title={isEdit ? '编辑项目资料' : '新建项目'} onClose={() => { if (!busy) onClose(); }} width={760}
    footer={<><button type="button" disabled={busy} onClick={onClose}>取消</button><button type="button" className="primary" disabled={busy || errors.length > 0} onClick={() => void save()}>{busy ? '正在保存…' : isEdit ? '保存项目资料' : '创建项目'}</button></>}>
    <form className="integration-project-form" onSubmit={e => { e.preventDefault(); void save(); }}>
      <fieldset disabled={busy} className="integration-form-grid">
        <label className="full-field">项目名称<input aria-label="项目名称" value={form.name} onChange={e => field('name', e.target.value)} maxLength={100} placeholder="如：咨询成交分析" required /></label>
        <label>品牌名称（选填）<input aria-label="品牌名称" value={form.brand} onChange={e => field('brand', e.target.value)} maxLength={50} placeholder="如：飞鹤（选填）" /></label>
        <label>产品 / SPU（选填）<input aria-label="产品或SPU" value={form.spu} onChange={e => field('spu', e.target.value)} maxLength={50} placeholder="如：星飞帆卓睿（选填）" /></label>
        <label>
          负责部门
          <CustomSelect
            ariaLabel="负责部门"
            value={isLegacyDept ? '' : form.departmentId}
            disabled={busy}
            placeholder={project?.departmentName || form.departmentId || '请选择负责部门'}
            onChange={value => field('departmentId', value)}
            options={departmentOptions}
          />
          {isLegacyDept && (
            <small style={{ color: '#64748b', fontSize: '12px', display: 'block', marginTop: '4px' }}>
              当前项目保留历史部门“{project?.departmentName || form.departmentId}”，更新时请选择上方 7 个标准部门之一。
            </small>
          )}
        </label>
        <label>项目负责人<input aria-label="项目负责人" value={form.ownerName || ''} disabled={busy} onChange={e => field('ownerName', e.target.value)} maxLength={50} placeholder="填写负责人姓名，如：张晓" required /></label>
        <label className="full-field">客户或内部项目<CustomSelect ariaLabel="客户或内部项目" value={form.clientId} disabled={busy} onChange={value => field('clientId', value)} options={[{ value: '', label: '内部项目' }, ...metadata.clients.map(c => ({ value: c.id, label: c.name }))]} /></label>
        <div className="full-field project-logo-field">
          <span className="project-logo-label" style={{ fontSize: '13px', fontWeight: 500, color: '#334155', display: 'block', marginBottom: '6px' }}>项目 Logo（选填）</span>
          <div className="project-logo-uploader" style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '12px 16px', background: '#f8fafc' }}>
            {logoPreview ? (
              <div className="project-logo-preview-row" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <img src={logoPreview} alt="Logo 预览" className="project-logo-preview" style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0', background: '#fff' }} />
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <label className="project-logo-btn secondary" style={{ cursor: 'pointer', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff', color: '#334155' }}>
                    更换图片
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="更换项目Logo" onChange={handleLogoFileSelect} style={{ display: 'none' }} />
                  </label>
                  <button type="button" className="project-logo-btn danger" onClick={handleLogoRemove} style={{ cursor: 'pointer', padding: '6px 12px', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '13px', background: '#fef2f2', color: '#b91c1c' }}>移除</button>
                </div>
              </div>
            ) : (
              <div className="project-logo-empty-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="project-logo-upload-btn" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content', padding: '7px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff', color: '#1e293b', fontWeight: 500 }}>
                  <span>＋ 上传 Logo 图片</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="上传项目Logo" onChange={handleLogoFileSelect} style={{ display: 'none' }} />
                </label>
                <small style={{ color: '#64748b', fontSize: '12px' }}>支持 PNG、JPEG、WebP、GIF，不超过 2MB；不支持 SVG 格式</small>
              </div>
            )}
            {logoError && <p role="alert" style={{ color: '#dc2626', fontSize: '12px', margin: '8px 0 0' }}>{logoError}</p>}
          </div>
        </div>
        <label className="full-field">项目说明<textarea aria-label="项目说明" value={form.description} onChange={e => field('description', e.target.value)} rows={2} placeholder="这项工作要回答什么问题，团队如何使用结果" /></label>
        <details className="full-field">
          <summary>业务状态与识别色</summary>
          <div className="integration-form-grid secondary-fields">
            <label>业务状态<CustomSelect ariaLabel="业务状态" value={form.status} disabled={busy} onChange={value => field('status', value)} options={PROJECT_STATUSES.map(s => ({ value: s, label: s }))} /></label>
            <div><span>识别色（自动分配，可调整）</span><div className="integration-color-options" role="group" aria-label="项目识别色">{PROJECT_COLORS.map(c => <button key={c.value} type="button" aria-label={'项目识别色：' + c.label} aria-pressed={(form.color || automaticProjectColor(form.name)) === c.value} title={c.label} style={{ background: c.value }} onClick={() => field('color', c.value)} />)}</div></div>
          </div>
        </details>
        {(form.templateId === 'content_marketing' || form.templateId === 'comment_qc' || form.category) && <details className="full-field"><summary>补充品类信息（选填）</summary><div className="integration-form-grid secondary-fields">
          <label className="full-field">品类<input aria-label="品类" value={form.category} onChange={e => field('category', e.target.value)} placeholder="如：奶粉、辅食（选填）" /></label>
        </div></details>}
      </fieldset>
      {error && <p role="alert" className="integration-error">{error}</p>}
      {errors.length > 0 && <p className="integration-form-hint" aria-live="polite">{errors.join('；')}</p>}
    </form>
  </Dialog>;
}
