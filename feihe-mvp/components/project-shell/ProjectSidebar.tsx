'use client';

import { useMemo } from 'react';
import Link from '../ui/AppLink';
import { PROJECT_NAV_ITEMS } from '../../lib/navigation/project-navigation';
import { ProjectSwitcher } from './ProjectSwitcher';
import { useProject } from './ProjectContext';
import { cnTime } from '../../lib/hooks/use-project-data';

const PROJECT_CUSTOM_TABS: Record<string, Record<string, string>> = {
  qicui: {
    overview: '全域声量总览',
    comments: '评论外显质检',
    industry: '竞品社媒监控',
    content: '达人爆文矩阵',
  },
  kailas: {
    overview: '预算控盘总览',
    ads: '版位效率寻优',
    content: '达人种草执行',
    industry: '行业竞品监控',
  },
  meiling: {
    overview: '双11四线总览',
    ads: '渠道ROI赛马',
    content: 'KOL审稿与外溢',
    industry: '行业竞品监控',
  },
  'winner-wipes': {
    overview: '日常种草控盘',
    ads: '版位与52词投流',
    content: '达人内容矩阵',
    industry: '行业竞品监控',
  },
  'huang-tiane': {
    overview: '三线全域核算',
    ads: '商销与CID引流',
    content: '品牌FS种草执行',
    industry: '行业竞品监控',
  },
};

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

  const projectNavItems = useMemo(() => {
    const customMap = PROJECT_CUSTOM_TABS[projectId];
    const allowedKeys = customMap
      ? [...Object.keys(customMap), 'settings']
      : currentProject?.templateId === 'campaign_review'
      ? ['overview', 'ads', 'content', 'industry', 'settings']
      : currentProject?.templateId === 'comment_qc'
      ? ['overview', 'comments', 'settings']
      : currentProject?.templateId === 'ad_performance'
      ? ['overview', 'ads', 'settings']
      : ['overview', 'industry', 'settings'];

    return allowedKeys
      .map(key => {
        const base = PROJECT_NAV_ITEMS.find(n => n.id === key);
        if (!base) return null;
        const customLabel =
          currentProject?.enabledTabs?.find((t: { key?: string; id?: string; label: string }) => (t.key || t.id) === key)?.label ||
          customMap?.[key] ||
          base.label;
        return {
          ...base,
          label: customLabel,
        };
      })
      .filter((n): n is (typeof PROJECT_NAV_ITEMS)[number] => Boolean(n));
  }, [projectId, currentProject]);

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
        <div className="brand-title">
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
        {projectNavItems.map((item, index) => {
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

      <div className={`sidebar-foot ${connectionStatus.ok ? 'is-ok' : 'has-error'}`}>
        <i className={connectionStatus.ok ? 'ok-dot' : 'err-dot'} /> {connectionStatus.text}
        <br />
        <small>
          {(workspace?.metadata?.currentUser?.displayName || (signedIn ? userName : '身份待验证'))?.replace(/\(张晓\)|张晓/g, '').trim() || '业务编辑者'}{(isDevLocal || workspace?.metadata?.isDevLocal) && <span style={{ marginLeft: 6, fontSize: 12, color: '#0b5cad', background: 'var(--blue-3, #e6f4fe)', padding: '1px 6px', borderRadius: 4 }}>本地开发</span>} <span style={{ margin: '0 4px', opacity: 0.35 }}>/</span>{' '}
          {currentProject?.updatedAt ? cnTime(currentProject.updatedAt) : '就绪'}
        </small>
      </div>
    </aside>
  );
}
