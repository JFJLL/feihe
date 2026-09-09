'use client';

import { useState } from 'react';
import type { Project } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { useProject } from '../../components/project-shell/ProjectContext';
import { api } from '../../lib/hooks/use-project-data';
import { MetricCard } from '../../components/ui/operations/MetricCard';

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
  const { error, refreshWorkspace } = useProject();

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

  return (
    <div className="stack">
      <section className="two-col-chart-grid" aria-label="已保存的项目资料">
        <MetricCard label="项目状态" value={project.status || '未设置'} theme="green" tag="已保存" desc={`项目标识：${project.id}`} />
        <MetricCard label="品牌 / SPU" value={project.brand || '未填写'} theme="purple" desc={`SPU：${project.spu || '未填写'} · 品类：${project.category || '未填写'}`} />
      </section>
    <ProjectProfileForm
      key={project.id + '-' + project.updatedAt}
      project={project}
      projectId={projectId}
      onDone={onDone}
      toast={toast}
    />
    </div>
  );
}

function ProjectProfileForm({
  project,
  projectId,
  onDone,
  toast,
}: {
  project: Project;
  projectId: string;
  onDone: () => Promise<void>;
  toast: (v: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [form, setForm] = useState<Project>(project);
  const [busy, setBusy] = useState(false);

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

  return (
    <article className="panel pastel-card reference-section section-blue">
      <PanelHead eyebrow="PROJECT PROFILE" title="项目基本资料" />
      <div className="project-form compact-form">
        <label>
          项目名称
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          SPU
          <input
            value={form.spu}
            onChange={(e) => setForm({ ...form, spu: e.target.value })}
          />
        </label>
        <label>
          品牌
          <input
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
          />
        </label>
        <label>
          品类
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%', gap: 6 }}>
          <span>状态</span>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, color: '#1e293b' }}
          >
            <option>进行中</option>
            <option>筹备中</option>
            <option>已结束</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%', gap: 6 }}>
          <span>识别色</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38, padding: '0 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }}>
            <input
              type="color"
              value={form.color || '#2563eb'}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              style={{ width: 26, height: 26, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
            />
            <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#334155', fontWeight: 600 }}>{form.color || '#2563eb'}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              {[
                { label: '品牌蓝', color: '#1e40af' },
                { label: '活力黄', color: '#eab308' },
                { label: '清新绿', color: '#0d9488' },
                { label: '优雅紫', color: '#7c3aed' },
              ].map(preset => (
                <button
                  key={preset.color}
                  type="button"
                  title={preset.label}
                  onClick={() => setForm({ ...form, color: preset.color })}
                  style={{
                    width: 20,
                    height: 20,
                    minWidth: 20,
                    minHeight: 20,
                    borderRadius: 4,
                    flexShrink: 0,
                    background: preset.color,
                    border: form.color === preset.color ? '2px solid #0f172a' : '1px solid rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
        </label>
        <label className="wide-field">
          项目说明
          <textarea
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
      </div>
      <button className="primary wide" disabled={busy} onClick={update}>
        {busy ? '正在保存…' : '保存项目资料'}
      </button>
    </article>
  );
}
