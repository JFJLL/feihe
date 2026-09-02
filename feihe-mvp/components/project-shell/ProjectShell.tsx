'use client';

import React, { useState, useEffect } from 'react';
import { ProjectSidebar } from './ProjectSidebar';
import type { Workspace } from '../../lib/types/project';
import { api, fallbackProject } from '../../lib/hooks/use-project-data';

export function ProjectShell({
  projectId,
  userName = '内部用户',
  signedIn = true,
  children,
}: {
  projectId: string;
  userName?: string;
  signedIn?: boolean;
  children: React.ReactNode;
}) {
  const [workspace, setWorkspace] = useState<Workspace>({
    projects: [fallbackProject],
    sources: [],
  });

  useEffect(() => {
    let cancelled = false;
    api<Workspace>('/api/projects')
      .then((data) => {
        if (!cancelled) setWorkspace(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const currentProject =
    workspace.projects.find((p) => p.id === projectId) || fallbackProject;

  return (
    <div className="app-shell">
      <ProjectSidebar
        projectId={projectId}
        projects={workspace.projects}
        userName={userName}
        signedIn={signedIn}
        syncedAt={currentProject.updatedAt}
      />
      <main className="main">{children}</main>
    </div>
  );
}
