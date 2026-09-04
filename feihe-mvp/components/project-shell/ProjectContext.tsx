'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import type { Project, Source, Workspace } from '../../lib/types/project';
import { api } from '../../lib/hooks/use-project-data';
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
