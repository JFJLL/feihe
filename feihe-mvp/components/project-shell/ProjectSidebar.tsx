'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PROJECT_NAV_ITEMS } from '../../lib/navigation/project-navigation';
import type { Project } from '../../lib/types/project';
import { ProjectSwitcher } from './ProjectSwitcher';
import { cnTime } from '../../lib/hooks/use-project-data';

export function ProjectSidebar({
  projectId,
  projects,
  userName,
  signedIn = true,
  syncedAt,
}: {
  projectId: string;
  projects: Project[];
  userName: string;
  signedIn?: boolean;
  syncedAt?: string;
}) {
  const pathname = usePathname();

  const match = pathname.match(/^\/projects\/[^/]+(?:\/([^/]+))?/);
  const activeSegment = match ? match[1] || '' : '';

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

      <ProjectSwitcher projects={projects} currentProjectId={projectId} />

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
        <i></i> 服务与数据连接正常
        <br />
        <small>
          {userName} · {signedIn ? '已登录' : '本地预览'} · {cnTime(syncedAt)}
        </small>
      </div>
    </aside>
  );
}
