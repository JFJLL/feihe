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
            style={{ padding: '6px 16px', fontSize: '14px', borderRadius: '8px', background: '#0d6e52', borderColor: '#0d6e52', color: '#ffffff' }}
          >
            编辑项目资料
          </button>
        )}
      </div>

      {project.logoUrl && (
        <div className="project-profile-logo-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', padding: '12px 16px', background: 'linear-gradient(180deg, #f0fbf8 0%, #ffffff 100%)', borderRadius: '8px', border: '0.5px solid #b8eae0' }}>
          <img src={project.logoUrl} alt="项目 Logo" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', border: '0.5px solid #cbd5e1' }} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--slate-12, #1c2024)' }}>{project.name}</div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>项目标识 Logo</span>
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
        ].map((item, idx) => {
          const isName = item.label === '项目名称';
          const isStatus = item.label === '业务状态';
          return (
            <div
              key={idx}
              style={{
                background: isName ? 'linear-gradient(180deg, #f0fbf8 0%, #ffffff 100%)' : '#ffffff',
                borderRadius: '8px',
                border: isName ? '0.5px solid #b8eae0' : '0.5px solid #e2e8f0',
                padding: '12px 16px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>{item.label}</div>
              {isStatus ? (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 600,
                    background: item.value === '进行中' ? '#dff6f0' : '#f1f5f9',
                    color: item.value === '进行中' ? '#006858' : '#475569',
                    border: item.value === '进行中' ? '0.5px solid #b8eae0' : '0.5px solid #cbd5e1',
                  }}
                >
                  {item.value}
                </span>
              ) : (
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>{item.value}</div>
              )}
            </div>
          );
        })}

        <div
          style={{
            gridColumn: 'span 1',
            background: '#ffffff',
            borderRadius: '8px',
            border: '0.5px solid #e2e8f0',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>品牌 / SPU / 品类</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>{brandProductText}</div>
        </div>

        <div
          style={{
            gridColumn: 'span 2',
            background: '#ffffff',
            borderRadius: '8px',
            border: '0.5px solid #e2e8f0',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>项目说明</div>
          <div style={{ fontSize: '14px', color: '#0f172a', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{project.description || '未填写'}</div>
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
