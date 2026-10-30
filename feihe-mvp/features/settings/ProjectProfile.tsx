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
  const isOngoing = project.status === '进行中';

  const fieldBoxStyle: React.CSSProperties = {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '14px 18px',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.02)',
  };

  return (
    <article
      className="panel integration-project-profile"
      aria-label="已保存的项目资料"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '22px 24px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div
        className="integration-page-heading"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '16px',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>项目资料</h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>团队共享的项目基本信息与基础配置</p>
        </div>
        {project.canManage && !archived && (
          <button
            type="button"
            className="primary"
            disabled={!hydrated}
            onClick={() => setEditing(true)}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              background: '#0d6e52',
              borderColor: '#0d6e52',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            编辑项目资料
          </button>
        )}
      </div>

      {project.logoUrl && (
        <div
          className="project-profile-logo-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '18px',
            padding: '12px 16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
          }}
        >
          <img
            src={project.logoUrl}
            alt="项目 Logo"
            style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #cbd5e1' }}
          />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{project.name}</div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>项目标识 Logo</span>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '14px',
        }}
      >
        {/* 1. 项目名称 */}
        <div style={fieldBoxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>项目名称</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '1px 7px',
                borderRadius: '4px',
                background: '#dff6f0',
                color: '#006858',
                border: '1px solid #b8eae0',
              }}
            >
              当前项目
            </span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>
            {project.name}
          </div>
        </div>

        {/* 2. 所属客户 */}
        <div style={fieldBoxStyle}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>所属客户</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>
            {project.clientName || '内部项目'}
          </div>
        </div>

        {/* 3. 负责部门 */}
        <div style={fieldBoxStyle}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>负责部门</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>
            {project.departmentName || '待设置'}
          </div>
        </div>

        {/* 4. 项目负责人 */}
        <div style={fieldBoxStyle}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>项目负责人</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>
            {project.ownerName || '待设置'}
          </div>
        </div>

        {/* 5. 业务状态 */}
        <div style={fieldBoxStyle}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>业务状态</div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 10px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              background: isOngoing ? '#dff6f0' : '#f1f5f9',
              color: isOngoing ? '#006858' : '#475569',
              border: isOngoing ? '1px solid #b8eae0' : '1px solid #cbd5e1',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isOngoing ? '#0d6e52' : '#64748b',
              }}
            />
            {project.status}
          </span>
        </div>

        {/* 6. 业务模板 */}
        <div style={fieldBoxStyle}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>业务模板</div>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
            }}
          >
            {project.templateName || '轻量营销看板'}
          </span>
        </div>

        {/* 7. 品牌 / SPU / 品类 */}
        <div style={{ ...fieldBoxStyle, gridColumn: 'span 1' }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>品牌 / SPU / 品类</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>
            {brandProductText}
          </div>
        </div>

        {/* 8. 项目说明 */}
        <div style={{ ...fieldBoxStyle, gridColumn: 'span 2' }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>项目说明</div>
          <div style={{ fontSize: '14px', color: '#0f172a', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {project.description || '未填写'}
          </div>
        </div>
      </div>

      {!project.canManage && (
        <p className="integration-form-help" style={{ margin: '16px 0 0', fontSize: '12px', color: '#64748b' }}>
          项目资料由负责人维护，需要调整时请联系{project.ownerName || '项目负责人'}。
        </p>
      )}
      {archived && (
        <p style={{ margin: '16px 0 0', fontSize: '12px', color: '#e5484d' }}>
          项目已归档，恢复后可以继续编辑。
        </p>
      )}
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
