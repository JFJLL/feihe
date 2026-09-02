'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Project, Workspace } from '../../lib/types/project';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { api } from '../../lib/hooks/use-project-data';

const emptyProject = {
  name: '',
  spu: '',
  brand: '',
  category: '',
  description: '',
  status: '进行中',
  color: '#2563eb',
};

export function ProjectCenter({ userName }: { userName: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingProject, setEditingProject] = useState<Record<string, unknown>>(emptyProject);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextWorkspace = await api<Workspace>('/api/projects');
      setWorkspace(nextWorkspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : '项目列表加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  async function saveProject() {
    const isEdit = Boolean(editingProject.id);
    const action = isEdit ? 'update' : 'create';
    setBusy('project');
    try {
      await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action,
          projectId: editingProject.id,
          ...editingProject,
        }),
      });
      setMessage(isEdit ? '项目资料已更新' : '项目已创建');
      setShowEditor(false);
      setEditingProject(emptyProject);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存项目失败');
    } finally {
      setBusy('');
    }
  }

  async function removeProject(item: Project) {
    if (!confirm('确认删除项目“' + item.name + '”？项目内规则、评论、任务和数据源会一并删除。')) return;
    setBusy(item.id);
    try {
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({ action: 'project_delete', projectId: item.id }),
      });
      setMessage('项目已删除');
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '删除失败');
    } finally {
      setBusy('');
    }
  }

  function openEdit(item?: Project) {
    setEditingProject(item ? { ...item } : emptyProject);
    setShowEditor(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const projects = workspace?.projects || [];
  const activeCount = projects.filter((p) => p.status === '进行中').length;

  return (
    <div className="platform-shell">
      <header className="platform-top">
        <Link className="platform-brand" href="/">
          <b>智</b>
          <span>
            社媒增长中台
            <small>CONTENT INTELLIGENCE OS</small>
          </span>
        </Link>
        <div className="platform-user">
          <i>{userName.slice(0, 1).toUpperCase()}</i>
          <span>
            {userName}
            <small>平台管理员</small>
          </span>
        </div>
      </header>

      <main className="platform-main">
        {message && (
          <div className="platform-message">
            <span>{message}</span>
            <button onClick={() => setMessage('')} aria-label="关闭提示">
              ×
            </button>
          </div>
        )}

        <section className="platform-heading">
          <div>
            <small>PROJECT PORTFOLIO</small>
            <h1>项目中心</h1>
            <p>以品牌或 SPU 为单位组织数据、规则、评论执行与经营复盘。</p>
          </div>
          <div className="heading-actions">
            <span>
              {projects.length} 个项目 · {activeCount} 个进行中
            </span>
            <button className="primary" onClick={() => openEdit()}>
              ＋ 创建项目
            </button>
          </div>
        </section>

        {showEditor && (
          <section className="project-compose">
            <div className="compose-title">
              <div>
                <small>{editingProject.id ? 'EDIT PROJECT' : 'NEW PROJECT'}</small>
                <h2>{editingProject.id ? '编辑项目资料' : '创建品牌 / SPU 项目'}</h2>
                <p>建立独立的数据边界、审查规则和业务看板。</p>
              </div>
              <button onClick={() => setShowEditor(false)} aria-label="关闭编辑器">
                ×
              </button>
            </div>
            <div className="platform-form project-form-wide">
              <label>
                项目名称
                <input
                  value={String(editingProject.name || '')}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  placeholder="如：启萃评论与声量项目"
                />
              </label>
              <label>
                SPU 名称
                <input
                  value={String(editingProject.spu || '')}
                  onChange={(e) => setEditingProject({ ...editingProject, spu: e.target.value })}
                  placeholder="如：启萃 3 段"
                />
              </label>
              <label>
                品牌
                <input
                  value={String(editingProject.brand || '')}
                  onChange={(e) => setEditingProject({ ...editingProject, brand: e.target.value })}
                  placeholder="如：飞鹤"
                />
              </label>
              <label>
                品类
                <input
                  value={String(editingProject.category || '')}
                  onChange={(e) => setEditingProject({ ...editingProject, category: e.target.value })}
                  placeholder="如：婴幼儿奶粉"
                />
              </label>
              <label>
                项目状态
                <select
                  value={String(editingProject.status || '进行中')}
                  onChange={(e) => setEditingProject({ ...editingProject, status: e.target.value })}
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
                  value={String(editingProject.color || '#2563eb')}
                  onChange={(e) => setEditingProject({ ...editingProject, color: e.target.value })}
                />
              </label>
              <label className="full">
                项目说明
                <textarea
                  value={String(editingProject.description || '')}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  placeholder="描述该项目的业务目标与重点监测方向"
                />
              </label>
            </div>
            <div className="editor-actions">
              <button onClick={() => setShowEditor(false)}>取消</button>
              <button
                className="primary"
                disabled={busy === 'project' || !editingProject.name || !editingProject.spu}
                onClick={saveProject}
              >
                {editingProject.id ? '保存修改' : '创建并初始化项目'}
              </button>
            </div>
          </section>
        )}

        {loading && !workspace ? (
          <LoadingState text="正在获取项目列表…" />
        ) : error && !workspace ? (
          <ErrorState error={error} onRetry={refresh} />
        ) : !projects.length ? (
          <EmptyState
            title="暂无项目"
            text="点击右上角“创建项目”建立您的第一个品牌/SPU工作区。"
            action={
              <button className="primary" onClick={() => openEdit()}>
                ＋ 创建项目
              </button>
            }
          />
        ) : (
          <section className="portfolio-grid">
            {projects.map((item) => (
              <article className="portfolio-card" key={item.id}>
                <div className="portfolio-accent" style={{ background: item.color || '#2563eb' }} />
                <div className="portfolio-card-head">
                  <span
                    className={
                      'project-state ' +
                      (item.status === '已结束'
                        ? 'closed'
                        : item.status === '筹备中'
                        ? 'pending'
                        : '')
                    }
                  >
                    <i />
                    {item.status || '进行中'}
                  </span>
                  <div className="secondary-actions">
                    <button onClick={() => openEdit(item)}>编辑</button>
                    {item.id !== 'qicui' && (
                      <button
                        className="danger-link"
                        disabled={busy === item.id}
                        onClick={() => removeProject(item)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
                <div className="project-identity">
                  <b style={{ background: item.color || '#2563eb' }}>
                    {(item.brand || item.name || '项').slice(0, 1)}
                  </b>
                  <div>
                    <h2>{item.name}</h2>
                    <p>
                      {item.brand || '未设置品牌'} / {item.spu || item.id}
                    </p>
                  </div>
                </div>
                <p className="project-description">
                  {item.description ||
                    (item.category || '社媒项目') + '的数据接入、评论审查与增长分析工作区。'}
                </p>
                <dl className="portfolio-metrics">
                  <div>
                    <dt>笔记资产</dt>
                    <dd>{item.noteCount || 0}</dd>
                  </div>
                  <div>
                    <dt>可汇报</dt>
                    <dd>{item.reportableCount || 0}</dd>
                  </div>
                  <div>
                    <dt>数据源</dt>
                    <dd>
                      {(workspace?.sources || []).filter((s) => s.projectId === item.id).length}
                    </dd>
                  </div>
                </dl>
                <div className="portfolio-actions">
                  <Link className="enter-project-btn" href={'/projects/' + encodeURIComponent(item.id)}>
                    进入项目 <span>→</span>
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}