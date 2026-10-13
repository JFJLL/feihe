'use client';

import Link from '../ui/AppLink';
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
  const {
    projectId,
    projects,
    currentProject,
    workspace,
    loading,
    error,
    activeSection,
    activeTab,
    navigateTo,
  } = useProject();

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
        <span aria-hidden="true"><svg viewBox="0 0 64 64" width="32" height="32" fill="none"><path d="M16 44V32m16 12V24m16 20V16" stroke="white" strokeWidth="7" strokeLinecap="round"/><path d="m15 22 15-10 9 2" stroke="#a5f3fc" strokeWidth="4" strokeLinecap="round"/></svg></span>
        <div>
          项目工作台

        </div>
      </div>

      <ProjectSwitcher
        projects={projects}
        currentProjectId={projectId}
        currentProject={currentProject}
        loading={loading}
      />

      <nav className="project-main-nav" aria-label="项目模块">
        {PROJECT_NAV_ITEMS.filter((item) => {
          if (item.id === 'ads') return currentProject?.templateId === 'ad_performance';
          if (item.id === 'data' || item.id === 'metrics') return true;
          if (currentProject?.templateId === 'ad_performance') return ['overview', 'ads', 'settings'].includes(item.id);
          if (['general_workbench', 'blank'].includes(currentProject?.templateId || '')) {
            return item.id === 'overview' || item.id === 'data' || item.id === 'settings';
          }
          if (currentProject?.templateId === 'comment_qc') {
            return item.id === 'overview' || item.id === 'comments' || item.id === 'settings';
          }
          // All project directions use the same data workspace.
          return true;
        }).map((item) => {
          const href =
            item.path === ''
              ? '/projects/' + encodeURIComponent(projectId)
              : item.path.includes('?')
              ? '/projects/' + encodeURIComponent(projectId) + '/' + item.path
              : '/projects/' + encodeURIComponent(projectId) + '/' + item.path;
          const inData = activeSection === 'data' || (activeSection === 'settings' && activeTab === 'data-sources');
          const isActive = item.id === 'data' ? inData : item.id === 'settings' ? activeSection === 'settings' && !inData : activeSection === item.path;

          return (
            <a
              key={item.id}
              href={href}
              aria-label={item.label}
              className={isActive ? 'active' : ''}
              aria-current={isActive ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigateTo(href);
              }}
            >
              <span className="nav-num">{item.number}</span>
              <span className="nav-label">{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <i className={connectionStatus.ok ? 'ok-dot' : 'err-dot'} /> {connectionStatus.text}
        <br />
        <small>
          {workspace?.metadata?.currentUser?.displayName || (signedIn ? userName : '身份待验证')} ·{' '}
          {currentProject?.updatedAt ? cnTime(currentProject.updatedAt) : '就绪'}
        </small>
      </div>
    </aside>
  );
}
