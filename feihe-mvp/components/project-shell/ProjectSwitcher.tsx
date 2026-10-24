'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { Project } from '../../lib/types/project';
import { CustomSelect } from '../ui/CustomSelect';
import { useProject } from './ProjectContext';

export function ProjectSwitcher({
  projects,
  currentProjectId,
  currentProject,
  loading,
}: {
  projects: Project[];
  currentProjectId: string;
  currentProject: Project | null;
  loading?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigateTo } = useProject();

  function handleChange(nextId: string) {
    if (!nextId || nextId === currentProjectId) return;
    // Maintain current subpath e.g. /projects/qicui/comments -> /projects/other/comments
    const match = window.location.pathname.match(/^\/projects\/[^/]+(\/?.*)$/);
    const subpath = match ? match[1] : '';
    const qs = new URLSearchParams(window.location.search).toString();
    const fullQuery = qs ? '?' + qs : '';
    navigateTo('/projects/' + encodeURIComponent(nextId) + subpath + fullQuery);
  }

  return (
    <div className="project-switcher">
      <small>当前项目</small>
      <div className="switcher-control" style={{ width: '100%', marginTop: 4 }}>
        <CustomSelect
          value={currentProjectId}
          onChange={handleChange}
          ariaLabel="切换项目"
          style={{ width: '100%' }}
          options={projects.length > 0 ? projects.map(p => ({
            value: p.id,
            label: p.name,
            color: p.color || '#0090ff',
          })) : [{ value: currentProjectId, label: loading ? '项目加载中…' : currentProjectId }]}
        />
      </div>
      {currentProject ? (
        <p className="project-subtext">
          <span>{currentProject.brand || '品牌未设置'}</span>
          <span style={{ margin: '0 5px', opacity: 0.35 }}>/</span>
          <span>{currentProject.spu || currentProject.name}</span>
          <span style={{ margin: '0 5px', opacity: 0.35 }}>/</span>
          <span>{currentProject.status || '进行中'}</span>
        </p>
      ) : (
        <p className="project-subtext">
          {loading ? '正在同步项目信息…' : '未关联项目资料'}
        </p>
      )}
    </div>
  );
}
