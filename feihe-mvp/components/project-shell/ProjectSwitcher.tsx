'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { Project } from '../../lib/types/project';
import { CustomSelect } from '../ui/CustomSelect';

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

  function handleChange(nextId: string) {
    if (!nextId || nextId === currentProjectId) return;
    // Maintain current subpath e.g. /projects/qicui/comments -> /projects/other/comments
    const match = pathname.match(/^\/projects\/[^/]+(\/?.*)$/);
    const subpath = match ? match[1] : '';
    const qs = searchParams?.toString();
    const fullQuery = qs ? '?' + qs : '';
    window.location.assign('/projects/' + encodeURIComponent(nextId) + subpath + fullQuery);
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
            color: p.color || '#2563eb',
          })) : [{ value: currentProjectId, label: loading ? '项目加载中…' : currentProjectId }]}
        />
      </div>
      {currentProject ? (
        <p className="project-subtext">
          {currentProject.brand || '品牌未设置'} · {currentProject.spu || currentProject.name} ·{' '}
          {currentProject.status || '进行中'}
        </p>
      ) : (
        <p className="project-subtext">
          {loading ? '正在同步项目信息…' : '未关联项目资料'}
        </p>
      )}
    </div>
  );
}
