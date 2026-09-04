'use client';

import Link from '../ui/AppLink';
import { usePathname } from 'next/navigation';
import { PROJECT_NAV_ITEMS } from '../../lib/navigation/project-navigation';
import { ProjectSwitcher } from './ProjectSwitcher';
import { useProject } from './ProjectContext';
import { cnTime } from '../../lib/hooks/use-project-data';

export function ProjectSidebar({
  userName,
  signedIn = true,
}: {
  userName: string;
  signedIn?: boolean;
}) {
  const pathname = usePathname();
  const { projectId, projects, currentProject, loading, error } = useProject();

  const match = pathname.match(/^\/projects\/[^/]+(?:\/([^/]+))?/);
  const activeSegment = match ? match[1] || '' : '';

  const connectionStatus = error
    ? { text: '项目资料加载失败', ok: false }
    : loading && !currentProject
    ? { text: '正在连接项目资料…', ok: true }
    : { text: '项目资料已连接', ok: true };

  return (
    <aside className="sidebar" aria-label="项目主要导航">
      <Link className="back-platform" href="/" aria-label="返回项目中心">
        ← 项目中心
      </Link>

      <div className="brand">
        <span>智</span>
        <div>
          社媒增长中台
          <small>PROJECT WORKSPACE</small>
        </div>
      </div>

      <ProjectSwitcher
        projects={projects}
        currentProjectId={projectId}
        currentProject={currentProject}
        loading={loading}
      />

      <nav className="project-main-nav" aria-label="项目模块">
        {PROJECT_NAV_ITEMS.map((item) => {
          const href =
            item.path === ''
              ? '/projects/' + encodeURIComponent(projectId)
              : '/projects/' + encodeURIComponent(projectId) + '/' + item.path;
          const isActive =
            item.path === ''
              ? activeSegment === ''
              : activeSegment === item.path;

          return (
            <Link
              key={item.id}
              href={href}
              className={isActive ? 'active' : ''}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-num">{item.number}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <i className={connectionStatus.ok ? 'ok-dot' : 'err-dot'} /> {connectionStatus.text}
        <br />
        <small>
          {signedIn ? userName : '公开访问'} · 无需登录 ·{' '}
          {currentProject?.updatedAt ? cnTime(currentProject.updatedAt) : '实时连接'}
        </small>
      </div>
    </aside>
  );
}
