'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Project, Workspace } from '../../lib/types/project';
import { api } from '../../lib/hooks/use-project-data';

export type ToastMessage = {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
};

type ProjectContextType = {
  projectId: string;
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
  refreshProjects: () => Promise<void>;
  toasts: ToastMessage[];
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
};

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({
  projectId,
  initialProjects = [],
  children,
}: {
  projectId: string;
  initialProjects?: Project[];
  children: React.ReactNode;
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [loading, setLoading] = useState(initialProjects.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const refreshProjects = useCallback(async () => {
    try {
      const data = await api<Workspace>('/api/projects');
      setProjects(data.projects || []);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '项目列表加载失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshProjects();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshProjects]);

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

  const currentProject = projects.find((p) => p.id === projectId) || null;

  return (
    <ProjectContext.Provider
      value={{
        projectId,
        projects,
        currentProject,
        loading,
        error,
        refreshProjects,
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