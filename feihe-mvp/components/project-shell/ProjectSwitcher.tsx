'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Project } from '../../lib/types/project';

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(nextId: string) {
    if (!nextId || nextId === currentProjectId) return;
    // Maintain current subpath e.g. /projects/qicui/comments -> /projects/other/comments
    const match = pathname.match(/^\/projects\/[^/]+(\/?.*)$/);
    const subpath = match ? match[1] : '';
    const qs = searchParams?.toString();
    const fullQuery = qs ? '?' + qs : '';
    router.push('/projects/' + encodeURIComponent(nextId) + subpath + fullQuery);
  }

  return (
    <div className="project-switcher">
      <small>当前项目</small>
      <div className="switcher-control">
        <i
          className="project-dot"
          style={{ background: currentProject?.color || '#2563eb' }}
        />
        <select
          value={currentProjectId}
          onChange={(e) => handleChange(e.target.value)}
          aria-label="切换项目"
          disabled={loading && !projects.length}
        >
          {projects.length > 0 ? (
            projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))
          ) : (
            <option value={currentProjectId}>
              {loading ? '项目加载中…' : currentProjectId}
            </option>
          )}
        </select>
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