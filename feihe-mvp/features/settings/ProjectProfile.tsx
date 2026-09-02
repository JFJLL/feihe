'use client';

import { useState } from 'react';
import type { Project } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { api } from '../../lib/hooks/use-project-data';

export function ProjectProfile({
  project: initialProject,
  projectId,
  onDone,
  toast,
}: {
  project: Project;
  projectId: string;
  onDone: () => Promise<void>;
  toast: (v: string) => void;
}) {
  const [project, setProject] = useState(initialProject);
  const [busy, setBusy] = useState(false);

  async function update() {
    setBusy(true);
    try {
      await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ action: 'update', projectId, ...project }),
      });
      toast('项目资料已更新');
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败');
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
            value={project.name}
            onChange={(e) => setProject({ ...project, name: e.target.value })}
          />
        </label>
        <label>
          SPU
          <input
            value={project.spu}
            onChange={(e) => setProject({ ...project, spu: e.target.value })}
          />
        </label>
        <label>
          品牌
          <input
            value={project.brand}
            onChange={(e) => setProject({ ...project, brand: e.target.value })}
          />
        </label>
        <label>
          品类
          <input
            value={project.category}
            onChange={(e) => setProject({ ...project, category: e.target.value })}
          />
        </label>
        <label>
          状态
          <select
            value={project.status}
            onChange={(e) => setProject({ ...project, status: e.target.value })}
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
            value={project.color || '#2563eb'}
            onChange={(e) => setProject({ ...project, color: e.target.value })}
          />
        </label>
        <label className="wide-field">
          项目说明
          <textarea
            value={project.description || ''}
            onChange={(e) => setProject({ ...project, description: e.target.value })}
          />
        </label>
      </div>
      <button className="primary wide" disabled={busy} onClick={update}>
        {busy ? '正在保存…' : '保存项目资料'}
      </button>
    </article>
  );
}
