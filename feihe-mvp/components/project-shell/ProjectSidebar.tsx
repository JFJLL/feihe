'use client';

import Link from '../ui/AppLink';
import { PROJECT_NAV_ITEMS } from '../../lib/navigation/project-navigation';
import { ProjectSwitcher } from './ProjectSwitcher';
import { useProject } from './ProjectContext';
import { cnTime } from '../../lib/hooks/use-project-data';

export function ProjectSidebar({
  userName,
  signedIn = true,
  isDevLocal = false,
  collapsed = false,
  onToggleCollapse,
}: {
  userName: string;
  signedIn?: boolean;
  isDevLocal?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const {
    projectId,
    projects,
    currentProject,
    workspace,
    loading,
    error,
    activeSection,
    navigateTo,
  } = useProject();

  const connectionStatus = error
    ? { text: '项目资料加载失败', ok: false }
    : loading && !currentProject
    ? { text: '正在连接项目资料…', ok: true }
    : { text: '项目资料已连接', ok: true };

  return (
    <aside className="sidebar" aria-label="项目主要导航">
      <div className="sidebar-header-row">
        <Link className="back-platform" href="/" aria-label="返回项目中心">
          ← 项目中心
        </Link>
        <button
          type="button"
          className="sidebar-toggle-btn"
          aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
          title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
          onClick={onToggleCollapse}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor">
            {collapsed ? (
              <path d="M6 3l5 5-5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M10 3l-5 5 5 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
      </div>

      <div className="brand">
        <span aria-hidden="true"><svg viewBox="0 0 64 64" width="32" height="32" fill="none"><path d="M16 44V32m16 12V24m16 20V16" stroke="white" strokeWidth="7" strokeLinecap="round"/><path d="m15 22 15-10 9 2" stroke="#a1ded2" strokeWidth="4" strokeLinecap="round"/></svg></span>
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
          if (item.inSidebar === false) return false;
          if (['data', 'metrics', 'reports'].includes(item.id)) return false;
          if (currentProject?.templateId === 'campaign_review') {
            return ['overview', 'ads', 'content', 'industry', 'settings'].includes(item.id);
          }
          if (item.id === 'industry') return false;
          if (item.id === 'ads') return ['content_marketing', 'ad_performance'].includes(currentProject?.templateId || '');
          if (currentProject?.templateId === 'ad_performance') return ['overview', 'ads', 'settings'].includes(item.id);
          if (['general_workbench', 'blank'].includes(currentProject?.templateId || '')) {
            return item.id === 'overview' || item.id === 'settings';
          }
          if (currentProject?.templateId === 'comment_qc') {
            return item.id === 'overview' || item.id === 'comments' || item.id === 'settings';
          }
          return true;
        }).map((item, index) => {
          const href =
            item.path === ''
              ? '/projects/' + encodeURIComponent(projectId)
              : '/projects/' + encodeURIComponent(projectId) + '/' + item.path;

          const isSettingsActive = ['settings', 'data', 'metrics', 'reports'].includes(activeSection);
          const isActive = item.id === 'settings' ? isSettingsActive : activeSection === item.path;

          return (
            <a
              key={item.id}
              href={href}
              aria-label={item.label}
              title={item.label}
              className={isActive ? 'active' : ''}
              aria-current={isActive ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigateTo(href);
              }}
            >
              <span className="nav-num">{String(index + 1).padStart(2, '0')}</span>
              <span className="nav-label">{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <i className={connectionStatus.ok ? 'ok-dot' : 'err-dot'} /> {connectionStatus.text}
        <br />
        <small>
          {workspace?.metadata?.currentUser?.displayName || (signedIn ? userName : '身份待验证')}{(isDevLocal || workspace?.metadata?.isDevLocal) && <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--blue-11, #0d74ce)', background: 'var(--blue-3, #e6f4fe)', padding: '1px 6px', borderRadius: 4 }}>本地开发</span>} <span style={{ margin: '0 4px', opacity: 0.35 }}>/</span>{' '}
          {currentProject?.updatedAt ? cnTime(currentProject.updatedAt) : '就绪'}
        </small>
      </div>
    </aside>
  );
}
