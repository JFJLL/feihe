'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
  useRef,
} from 'react';
import type { Project, Source, Workspace, Dashboard, Ops } from '../../lib/types/project';
import { api, useProjectData, clearProjectDataCache, ApiError } from '../../lib/hooks/use-project-data';
import { readSessionCache, writeSessionCache, clearIdentityCache, activateCacheIdentity, isActiveCacheIdentity } from '../../lib/browser-cache';
import { clearQueryCacheForIdentity } from '../../lib/cache/query-cache';
import { useCacheIdentity } from './IdentityBoundary';
import { AccessState } from '../ui/AccessState';
import { usePathname } from 'next/navigation';
import type { ProjectBootstrap } from '../../lib/project-bootstrap';

export type ToastMessage = {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
};

export type NavigateOptions = {
  replace?: boolean;
};

type ProjectContextType = {
  projectId: string;
  workspace: Workspace | null;
  projects: Project[];
  sources: Source[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
  refreshWorkspace: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  toasts: ToastMessage[];
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  // 高性能客户端单页导航与全盘数据共享
  activeSection: string;
  activeTab: string;
  navigateTo: (href: string, options?: NavigateOptions | boolean) => void;
  dashboard: Dashboard | null;
  ops: Ops | null;
  dataLoading: boolean;
  dataError: string | null;
  refreshData: (opts?: { fresh?: boolean; throwOnError?: boolean }) => Promise<void>;
};

export const ProjectContext = createContext<ProjectContextType | null>(null);

const workspaceCache = new Map<string, { value: Workspace; timestamp: number }>();
const WORKSPACE_CACHE_KEY = 'workspace';
const subscribeWorkspaceCache = () => () => undefined;
const WORKSPACE_REVALIDATE_AFTER = 2 * 60 * 1000;
function restoredWorkspace(identity: string) {
  if (!isActiveCacheIdentity(identity) || typeof window === 'undefined') return null;
  const memory = workspaceCache.get(identity); if (memory) return memory.value;
  const stored = readSessionCache<Workspace>(WORKSPACE_CACHE_KEY, undefined, identity);
  if (!stored?.value?.projects || !stored.value.sources) return null;
  workspaceCache.set(identity, { value: stored.value, timestamp: stored.timestamp });
  return stored.value;
}

function subscribeRoute(listener: () => void) {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
}
function routeLocation() {
  return window.location.pathname + window.location.search;
}

export function ProjectProvider({
  projectId,
  initialWorkspace = null,
  initialData = null,
  userId,
  initialRole,
  children,
}: {
  projectId: string;
  initialWorkspace?: Workspace | null;
  initialData?: ProjectBootstrap | null;
  userId?: string;
  initialRole?: 'project_admin' | 'editor' | 'viewer';
  children: React.ReactNode;
}) {
  const identity = useCacheIdentity();
  const expectedUser = userId || initialWorkspace?.metadata?.currentUser?.userId || '';
  const [role, setRole] = useState(initialRole);
  const [accessFailure, setAccessFailure] = useState<{ status: number; message: string } | null>(null);
  const requestGeneration = useRef(0);
  const invalidateRequests = useCallback(() => { requestGeneration.current++; }, []);
  const [workspace, setWorkspace] = useState<Workspace | null>(initialWorkspace || workspaceCache.get(identity)?.value || null);
  const [loading, setLoading] = useState(!workspaceCache.has(identity) && !initialWorkspace);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // 共享项目数据（一次加载，全盘秒级复用，消除各板块切换白屏）
  const {
    dashboard,
    ops,
    loading: dataLoading,
    error: dataError,
    refresh: refreshData,
  } = useProjectData(projectId, undefined, initialData);

  // 解析当前激活板块（'' 为总览，'growth' 为增长机会，等等）
  const pathname = usePathname();
  const location = useSyncExternalStore(subscribeRoute, routeLocation, () => pathname || '');
  const activeTab = new URLSearchParams(location.split('?')[1] || '').get('tab') || '';
  const activeSection = location.match(/^\/projects\/[^/]+(?:\/([^/?]+))?/)?.[1] || '';

  const navigateTo = useCallback((href: string, options?: NavigateOptions | boolean) => {
    if (typeof window === 'undefined') return;
    const replace = typeof options === 'boolean' ? options : !!options?.replace;
    const intent = new CustomEvent('app:before-navigate', { cancelable: true, detail: { href, replace } });
    if (!window.dispatchEvent(intent)) return;
    try {
      const targetUrl = new URL(href, window.location.origin);
      if (
        window.location.pathname + window.location.search + (window.location.hash || '') ===
        targetUrl.pathname + targetUrl.search + (targetUrl.hash || '')
      ) {
        return;
      }
      const match = targetUrl.pathname.match(/^\/projects\/[^/]+(?:\/([^/]+))?/);
      if (match && targetUrl.origin === window.location.origin && (targetUrl.pathname.startsWith(`/projects/${encodeURIComponent(projectId)}/`) || targetUrl.pathname === `/projects/${encodeURIComponent(projectId)}`)) {
        if (replace) {
          window.history.replaceState(null, '', href);
        } else {
          window.history.pushState(null, '', href);
        }
        window.dispatchEvent(new PopStateEvent('popstate'));
        if (!targetUrl.hash) {
          window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        }
        return;
      }
    } catch {
      // 容错降级
    }
    if (replace) {
      window.location.replace(href);
    } else {
      window.location.href = href;
    }
  }, [projectId]);

  // 监听应用内跨组件超链接广播
  useEffect(() => {
    const onAppNav = (e: Event) => {
      const custom = e as CustomEvent<{ href: string; replace?: boolean }>;
      if (custom.detail?.href) {
        navigateTo(custom.detail.href, { replace: custom.detail.replace });
      }
    };
    window.addEventListener('app:navigate', onAppNav);
    return () => window.removeEventListener('app:navigate', onAppNav);
  }, [navigateTo]);

  // 全局拦截同项目内的未封装 <a> 标签跳转，全面杜绝整页重载与白屏刷新
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onGlobalClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;
      if (anchor.target || anchor.hasAttribute('download') || anchor.getAttribute('rel')?.includes('external')) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || /^https?:\/\//i.test(href)) return;
      // 尊重同页内的分区锚点与 hash 滚动（本轮分区锚点不能坏）
      const [pathAndQuery, hash] = href.split('#');
      if (hash && (!pathAndQuery || pathAndQuery === window.location.pathname || pathAndQuery === window.location.pathname + window.location.search)) {
        return;
      }
      const currentMatch = window.location.pathname.match(/^\/projects\/([^/?#]+)/);
      const targetMatch = href.match(/^\/projects\/([^/?#]+)/);
      if (currentMatch && targetMatch && currentMatch[1] === targetMatch[1]) {
        e.preventDefault();
        navigateTo(href);
      }
    };
    document.addEventListener('click', onGlobalClick, true);
    return () => document.removeEventListener('click', onGlobalClick, true);
  }, [navigateTo]);

  const storedWorkspace = useSyncExternalStore(
    subscribeWorkspaceCache,
    () => restoredWorkspace(identity),
    () => null
  );

  const refreshWorkspace = useCallback(async () => {
    const generation = ++requestGeneration.current;
    const deny = (status: number, message: string) => {
      workspaceCache.delete(identity); clearIdentityCache(identity); clearProjectDataCache(identity); clearQueryCacheForIdentity(identity); activateCacheIdentity(null);
      setWorkspace(null); setAccessFailure({ status, message });
    };
    try {
      const data = await api<Workspace>('/api/projects', { cache: 'no-store' });
      if (generation !== requestGeneration.current) return;
      const confirmedUser = data.metadata?.currentUser;
      if (!confirmedUser || confirmedUser.userId !== expectedUser || identity !== confirmedUser.orgId + ':' + confirmedUser.userId) { deny(401, '登录身份已变化，请重新打开项目'); return; }
      const project = data.projects.find(project => project.id === projectId);
      if (!project) { deny(403, '项目访问权限已撤回，请联系项目负责人'); return; }
      activateCacheIdentity(identity);
      workspaceCache.set(identity, { value: data, timestamp: Date.now() });
      writeSessionCache(WORKSPACE_CACHE_KEY, data, Date.now(), identity);
      setWorkspace(data); setRole(project.projectRole as 'project_admin' | 'editor' | 'viewer'); setAccessFailure(null); setError(null);
    } catch (err) {
      if (generation !== requestGeneration.current) return;
      const message = err instanceof Error ? err.message : '项目列表加载失败';
      if (err instanceof ApiError && [401, 403].includes(err.status)) deny(err.status, message);
      setError(message);
    } finally { if (generation === requestGeneration.current) setLoading(false); }
  }, [identity, expectedUser, projectId]);

  useEffect(() => {
    if (initialWorkspace) {
      const timestamp = initialData?.timestamp || Date.now();
      workspaceCache.set(identity, { value: initialWorkspace, timestamp });
      writeSessionCache(WORKSPACE_CACHE_KEY, initialWorkspace, timestamp, identity);
    }
    const cached = workspaceCache.get(identity);
    if (cached && Date.now() - cached.timestamp < WORKSPACE_REVALIDATE_AFTER) return;
    const timer = setTimeout(() => { void refreshWorkspace(); }, 0);
    return () => clearTimeout(timer);
  }, [refreshWorkspace, initialWorkspace, initialData, identity]);
  useEffect(() => {
    const refresh = () => { void refreshWorkspace(); };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    const response = (event: Event) => { const detail = (event as CustomEvent<{ projectId?: string }>).detail; if (!detail?.projectId || detail.projectId === projectId) refresh(); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible); window.addEventListener('app:permission-response', response);
    return () => { invalidateRequests(); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); window.removeEventListener('app:permission-response', response); };
  }, [refreshWorkspace, projectId, invalidateRequests]);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const visibleWorkspace = workspace || storedWorkspace;
  const projects = visibleWorkspace?.projects || [];
  const sources = visibleWorkspace?.sources || [];
  const foundProject = projects.find((p) => p.id === projectId);
  const currentProject = foundProject ? { ...foundProject, projectRole: role || foundProject.projectRole,
    canManage: role ? role === 'project_admin' : foundProject.canManage,
    canWrite: !foundProject.isArchived && (role ? ['project_admin', 'editor'].includes(role) : foundProject.canWrite) } : null;
  if (accessFailure) return <AccessState status={accessFailure.status} message={accessFailure.message} />;

  return (
    <ProjectContext.Provider
      value={{
        projectId,
        workspace: visibleWorkspace,
        projects,
        sources,
        currentProject,
        loading: loading && !visibleWorkspace,
        error,
        refreshWorkspace,
        refreshProjects: refreshWorkspace,
        toasts,
        showToast,
        removeToast,
        activeSection,
        activeTab,
        navigateTo,
        dashboard,
        ops,
        dataLoading,
        dataError,
        refreshData,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return ctx;
}

