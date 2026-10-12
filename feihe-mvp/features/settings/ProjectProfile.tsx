'use client';

import { useState } from 'react';
import type { Project } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { useProject } from '../../components/project-shell/ProjectContext';
import { api } from '../../lib/hooks/use-project-data';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { CustomSelect } from '../../components/ui/CustomSelect';

const PRESET_COLORS = [
  { value: '#2563eb', label: '品牌蓝' },
  { value: '#059669', label: '翡翠绿' },
  { value: '#4f46e5', label: '靛青蓝' },
  { value: '#d97706', label: '琥珀黄' },
  { value: '#e11d48', label: '玫瑰红' },
  { value: '#7c3aed', label: '优雅紫' },
  { value: '#0891b2', label: '青色' },
  { value: '#475569', label: '石板灰' },
];

const STATUS_OPTIONS = [
  { value: '进行中', label: '进行中', color: '#16a34a' },
  { value: '筹备中', label: '筹备中', color: '#d97706' },
  { value: '已结束', label: '已结束', color: '#64748b' },
];

export function ProjectProfile({
  project,
  projectId,
  onDone,
  toast,
}: {
  project: Project | null;
  projectId: string;
  onDone: () => Promise<void>;
  toast: (v: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const { error, refreshWorkspace, workspace } = useProject();

  if (!project) {
    if (error) {
      return (
        <article className="panel pastel-card reference-section section-blue">
          <PanelHead eyebrow="PROJECT PROFILE" title="项目基本资料" />
          <ErrorState error={error} onRetry={refreshWorkspace} />
        </article>
      );
    }
    return (
      <article className="panel pastel-card reference-section section-blue">
        <PanelHead eyebrow="PROJECT PROFILE" title="项目基本资料" />
        <LoadingState text="正在获取项目资料…" />
      </article>
    );
  }

  const isGeneral = project.templateId === 'general_workbench';

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className="two-col-chart-grid" aria-label="已保存的项目资料">
        <MetricCard label="项目状态" value={project.status || '未设置'} theme="green" tag="已保存" desc={`项目标识：${project.id}`} />
        <MetricCard
          label={isGeneral ? '负责部门 / 负责人' : '品牌 / SPU'}
          value={isGeneral ? (project.departmentName || '综合管理部') : (project.brand || '未填写')}
          theme="purple"
          desc={isGeneral ? `模板：${project.templateName || '通用数据工作台'}` : `SPU：${project.spu || '未填写'} · 品类：${project.category || '未填写'}`}
        />
      </section>

      <ProjectProfileForm
        key={project.id + '-' + project.updatedAt}
        project={project}
        projectId={projectId}
        onDone={onDone}
        toast={toast}
        departments={workspace?.metadata?.departments || []}
        clients={workspace?.metadata?.clients || []}
      />
    </div>
  );
}

function ProjectProfileForm({
  project,
  projectId,
  onDone,
  toast,
  departments,
  clients,
}: {
  project: Project;
  projectId: string;
  onDone: () => Promise<void>;
  toast: (v: string, type?: 'success' | 'error' | 'info') => void;
  departments: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
}) {
  const [form, setForm] = useState<Project>(project);
  const [busy, setBusy] = useState(false);

  const deptOptions = departments.length > 0
    ? departments.map((d) => ({ value: d.id, label: d.name }))
    : [
        { value: 'dept-marketing', label: '市场与营销部' },
        { value: 'dept-operations', label: '渠道与运营部' },
        { value: 'dept-brand', label: '品牌战略部' },
        { value: 'dept-general', label: '综合管理部' },
      ];

  const clientOptions = [
    { value: '', label: '内部部门项目 (无特定客户)' },
    ...clients.map((c) => ({ value: c.id, label: c.name })),
  ];

  async function update() {
    setBusy(true);
    try {
      await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ action: 'update', projectId, ...form }),
      });
      toast('项目资料已更新', 'success');
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setBusy(false);
    }
  }

  const showSocialFields =
    project.templateId === 'content_marketing' ||
    project.templateId === 'comment_qc' ||
    Boolean(form.brand || form.spu || form.category);

  return (
    <article className="panel pastel-card reference-section section-blue" style={{ padding: 24, borderRadius: 12, border: '1px solid #cbd5e1' }}>
      <PanelHead eyebrow="PROJECT PROFILE" title="编辑项目基本资料" />
      <div className="project-form compact-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>项目名称 *</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{ height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>负责部门</span>
          <CustomSelect
            value={form.departmentId || 'dept-general'}
            onChange={(val) => setForm({ ...form, departmentId: val })}
            options={deptOptions}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>所属客户</span>
          <CustomSelect
            value={form.clientId || ''}
            onChange={(val) => setForm({ ...form, clientId: val })}
            options={clientOptions}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>业务状态</span>
          <CustomSelect
            value={form.status || '进行中'}
            onChange={(val) => setForm({ ...form, status: val })}
            options={STATUS_OPTIONS}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>项目识别色</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38 }}>
            {PRESET_COLORS.map((p) => {
              const active = form.color === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  title={p.label}
                  onClick={() => setForm({ ...form, color: p.value })}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: p.value,
                    border: active ? '2px solid #0f172a' : '1px solid rgba(0,0,0,0.15)',
                    outline: active ? '2px solid #93c5fd' : 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              );
            })}
          </div>
        </label>

        {showSocialFields && (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>品牌</span>
              <input
                value={form.brand || ''}
                placeholder="如：飞鹤"
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                style={{ height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>SPU / 核心单品</span>
              <input
                value={form.spu || ''}
                placeholder="如：启萃"
                onChange={(e) => setForm({ ...form, spu: e.target.value })}
                style={{ height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>品类 / 场景</span>
              <input
                value={form.category || ''}
                placeholder="如：婴幼儿奶粉"
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={{ height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </label>
          </>
        )}

        <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>项目说明</span>
          <textarea
            rows={3}
            value={form.description || ''}
            placeholder="项目背景、分工与核心目标简述…"
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
          />
        </label>
      </div>

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="primary"
          disabled={busy || !form.name}
          onClick={update}
          style={{ padding: '9px 24px', fontSize: 13, fontWeight: 600, borderRadius: 6 }}
        >
          {busy ? '正在保存…' : '保存项目资料'}
        </button>
      </div>
    </article>
  );
}
