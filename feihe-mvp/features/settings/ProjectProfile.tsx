'use client';
import { useState, useSyncExternalStore } from 'react';
const subscribeHydration = () => () => {};
import type { Project } from '../../lib/types/project';
import { useProject } from '../../components/project-shell/ProjectContext';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ProjectFormDialog } from '../project-center/ProjectFormDialog';
export function ProjectProfile({ project, projectId, onDone, toast }: {
  project: Project | null; projectId: string; onDone: () => Promise<void>;
  toast: (value: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const { workspace, error, refreshWorkspace } = useProject();
  const [editing, setEditing] = useState(false);
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  if (!project || !workspace?.metadata) return error ? <ErrorState error={error} onRetry={refreshWorkspace} /> : <LoadingState text="正在读取项目资料…" />;
  const archived = Boolean(project.isArchived) || project.status === '已归档';
  return <article className="panel integration-project-profile" aria-label="已保存的项目资料">
    <div className="integration-page-heading"><div><h2>项目资料</h2><p>团队共享的项目基本信息</p></div>{project.canManage && !archived && <button className="primary" disabled={!hydrated} onClick={() => setEditing(true)}>编辑项目资料</button>}</div>
    <dl className="integration-profile-details"><div><dt>项目名称</dt><dd>{project.name}</dd></div><div><dt>客户</dt><dd>{project.clientName || '内部项目'}</dd></div><div><dt>负责部门</dt><dd>{project.departmentName || '待设置'}</dd></div><div><dt>负责人</dt><dd>{project.ownerName || '待设置'}</dd></div><div><dt>业务状态</dt><dd>{project.status}</dd></div><div><dt>业务方向</dt><dd>{project.templateName || '通用数据工作台'}</dd></div><div className="full-field"><dt>项目说明</dt><dd>{project.description || '未填写'}</dd></div></dl>
    {project.logoUrl && (
      <div className="project-profile-logo-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0' }}>
        <img src={project.logoUrl} alt="项目 Logo" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
        <span style={{ fontSize: '13px', color: '#64748b' }}>项目标识 Logo</span>
      </div>
    )}
    {(project.brand || project.spu || project.category) && <details><summary>品牌与产品信息</summary><p>{[project.brand, project.spu, project.category].filter(Boolean).join(' · ')}</p></details>}
    {!project.canManage && <p className="integration-form-help">项目资料由负责人维护，需要调整时请联系{project.ownerName || '项目负责人'}。</p>}
    {archived && <p>项目已归档，恢复后可以继续编辑。</p>}
    {editing && <ProjectFormDialog key={projectId} project={project} metadata={workspace.metadata} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); toast('项目资料已更新', 'success'); await refreshWorkspace(); await onDone(); }} />}
  </article>;
}
