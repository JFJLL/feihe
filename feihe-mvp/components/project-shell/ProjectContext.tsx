'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from 'react';
import type { Project, Source, Workspace, Dashboard, Ops } from '../../lib/types/project';
import { api, useProjectData } from '../../lib/hooks/use-project-data';
import { readSessionCache, writeSessionCache } from '../../lib/browser-cache';

export type ToastMessage = {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
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
  setActiveSection: (sec: string) => void;
  navigateTo: (href: string) => void;
  dashboard: Dashboard | null;
  ops: Ops | null;
  dataLoading: boolean;
  dataError: string | null;
  refreshData: (opts?: { fresh?: boolean }) => Promise<void>;
};

const ProjectContext = createContext<ProjectContextType | null>(null);

let cachedWorkspace: Workspace | null = null;
let cachedWorkspaceAt = 0;
const WORKSPACE_CACHE_KEY = 'workspace';
const subscribeWorkspaceCache = () => () => undefined;
const WORKSPACE_REVALIDATE_AFTER = 2 * 60 * 1000;

function restoredWorkspace() {
  if (cachedWorkspace) return cachedWorkspace;
  const stored = readSessionCache<Workspace>(WORKSPACE_CACHE_KEY);
  if (!stored?.value?.projects || !stored.value.sources) return null;
  cachedWorkspace = stored.value;
  cachedWorkspaceAt = stored.timestamp;
  return cachedWorkspace;
}

export function ProjectProvider({
  projectId,
  initialWorkspace = null,
  children,
}: {
  projectId: string;
  initialWorkspace?: Workspace | null;
  children: React.ReactNode;
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(cachedWorkspace || initialWorkspace);
  const [loading, setLoading] = useState(!cachedWorkspace && !initialWorkspace);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // 共享项目数据（一次加载，全盘秒级复用，消除各板块切换白屏）
  const {
    dashboard,
    ops,
    loading: dataLoading,
    error: dataError,
    refresh: refreshData,
  } = useProjectData(projectId);

  // 解析当前激活板块（'' 为总览，'growth' 为增长机会，等等）
  const [activeSection, setActiveSection] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/^\/projects\/[^/]+(?:\/([^/]+))?/);
      return match ? match[1] || '' : '';
    }
    return '';
  });

  const navigateTo = useCallback((href: string) => {
    if (typeof window === 'undefined') return;
    try {
      const targetUrl = new URL(href, window.location.origin);
      const match = targetUrl.pathname.match(/^\/projects\/[^/]+(?:\/([^/]+))?/);
      if (match) {
        const nextSec = match[1] || '';
        setActiveSection(nextSec);
        window.history.pushState(null, '', href);
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        return;
      }
    } catch {
      // 容错降级
    }
    window.location.href = href;
  }, []);

  // 监听浏览器前进/后退
  useEffect(() => {
    const handlePop = () => {
      const match = window.location.pathname.match(/^\/projects\/[^/]+(?:\/([^/]+))?/);
      setActiveSection(match ? match[1] || '' : '');
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // 监听应用内跨组件超链接广播
  useEffect(() => {
    const onAppNav = (e: Event) => {
      const custom = e as CustomEvent<{ href: string }>;
      if (custom.detail?.href) {
        navigateTo(custom.detail.href);
      }
    };
    window.addEventListener('app:navigate', onAppNav);
    return () => window.removeEventListener('app:navigate', onAppNav);
  }, [navigateTo]);

  const storedWorkspace = useSyncExternalStore(
    subscribeWorkspaceCache,
    restoredWorkspace,
    () => null
  );

  const refreshWorkspace = useCallback(async () => {
    try {
      const data = await api<Workspace>('/api/projects');
      cachedWorkspace = data;
      cachedWorkspaceAt = Date.now();
      writeSessionCache(WORKSPACE_CACHE_KEY, data, cachedWorkspaceAt);
      setWorkspace(data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '项目列表加载失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoredWorkspace();
    if (cachedWorkspace && Date.now() - cachedWorkspaceAt < WORKSPACE_REVALIDATE_AFTER) return;
    const timer = setTimeout(() => {
      void refreshWorkspace();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshWorkspace]);

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
  const currentProject = projects.find((p) => p.id === projectId) || null;

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
        setActiveSection,
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
