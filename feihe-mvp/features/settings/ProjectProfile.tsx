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
  const brandProductText = [project.brand, project.spu, project.category].filter(Boolean).join(' / ') || '未配置';

  return (
    <article
      className="panel integration-project-profile"
      aria-label="已保存的项目资料"
      style={{
        background: 'var(--bg-card, #ffffff)',
        border: '0.5px solid var(--slate-6, #d9d9e0)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(28, 32, 36, 0.04)',
      }}
    >
      <div className="integration-page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--slate-12, #1c2024)' }}>项目资料</h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--slate-11, #60646c)' }}>团队共享的项目基本信息与基础配置</p>
        </div>
        {project.canManage && !archived && (
          <button
            type="button"
            className="primary"
            disabled={!hydrated}
            onClick={() => setEditing(true)}
            style={{ padding: '6px 16px', fontSize: '14px', borderRadius: '8px' }}
          >
            编辑项目资料
          </button>
        )}
      </div>

      {project.logoUrl && (
        <div className="project-profile-logo-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', padding: '10px 16px', background: 'var(--slate-2, #f9f9fb)', borderRadius: '8px', border: '0.5px solid var(--slate-6, #d9d9e0)' }}>
          <img src={project.logoUrl} alt="项目 Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '0.5px solid var(--slate-6, #d9d9e0)' }} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--slate-12, #1c2024)' }}>{project.name}</div>
            <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)' }}>项目标识 Logo</span>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '16px',
        }}
      >
        {[
          { label: '项目名称', value: project.name },
          { label: '所属客户', value: project.clientName || '内部项目' },
          { label: '负责部门', value: project.departmentName || '待设置' },
          { label: '项目负责人', value: project.ownerName || '待设置' },
          { label: '业务状态', value: project.status },
          { label: '业务模板', value: project.templateName || '通用数据工作台' },
        ].map((item, idx) => (
          <div
            key={idx}
            style={{
              background: 'var(--slate-2, #f9f9fb)',
              borderRadius: '8px',
              border: '0.5px solid var(--slate-6, #d9d9e0)',
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', marginBottom: '4px' }}>{item.label}</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--slate-12, #1c2024)', wordBreak: 'break-all' }}>{item.value}</div>
          </div>
        ))}

        <div
          style={{
            gridColumn: 'span 1',
            background: 'var(--slate-2, #f9f9fb)',
            borderRadius: '8px',
            border: '0.5px solid var(--slate-6, #d9d9e0)',
            padding: '12px 16px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', marginBottom: '4px' }}>品牌 / SPU / 品类</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--slate-12, #1c2024)', wordBreak: 'break-all' }}>{brandProductText}</div>
        </div>

        <div
          style={{
            gridColumn: 'span 2',
            background: 'var(--slate-2, #f9f9fb)',
            borderRadius: '8px',
            border: '0.5px solid var(--slate-6, #d9d9e0)',
            padding: '12px 16px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', marginBottom: '4px' }}>项目说明</div>
          <div style={{ fontSize: '14px', color: 'var(--slate-12, #1c2024)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{project.description || '未填写'}</div>
        </div>
      </div>

      {!project.canManage && <p className="integration-form-help" style={{ margin: '16px 0 0', fontSize: '12px', color: 'var(--slate-11, #60646c)' }}>项目资料由负责人维护，需要调整时请联系{project.ownerName || '项目负责人'}。</p>}
      {archived && <p style={{ margin: '16px 0 0', fontSize: '12px', color: 'var(--red-9, #e5484d)' }}>项目已归档，恢复后可以继续编辑。</p>}
      {editing && (
        <ProjectFormDialog
          key={projectId}
          project={project}
          metadata={workspace.metadata}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            toast('项目资料已更新', 'success');
            await refreshWorkspace();
            await onDone();
          }}
        />
      )}
    </article>
  );
}
