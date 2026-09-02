'use client';

import { useState } from 'react';
import type { Project } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { useProject } from '../../components/project-shell/ProjectContext';
import { api } from '../../lib/hooks/use-project-data';

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
        <article className="panel">
          <PanelHead eyebrow="PROJECT PROFILE" title="项目基本资料" />
          <ErrorState error={error} onRetry={refreshWorkspace} />
        </article>
      );
    }
    return (
      <article className="panel">
        <PanelHead eyebrow="PROJECT PROFILE" title="项目基本资料" />
        <LoadingState text="正在获取项目资料…" />
      </article>
    );
  }

  return (
    <ProjectProfileForm
      key={project.id + '-' + project.updatedAt}
      project={project}
      projectId={projectId}
      onDone={onDone}
      toast={toast}
    />
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
    <article className="panel">
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
        <label>
          状态
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option>进行中</option>
            <option>筹备中</option>
            <option>已结束</option>
          </select>
        </label>
        <label>
          识别色
          <input
            type="color"
            value={form.color || '#2563eb'}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
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
