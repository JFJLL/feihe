'use client';

import React from 'react';
import { ProjectProvider, useProject } from './ProjectContext';
import { ProjectSidebar } from './ProjectSidebar';
import { FeedbackToastContainer } from '../ui/FeedbackToast';

function ProjectShellContent({
  userName,
  signedIn,
  children,
}: {
  userName: string;
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const { toasts, removeToast } = useProject();

  return (
    <div className="app-shell">
      <ProjectSidebar userName={userName} signedIn={signedIn} />
      <main className="main">
        {children}
        <FeedbackToastContainer toasts={toasts} onClose={removeToast} />
      </main>
    </div>
  );
}

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
  return (
    <ProjectProvider projectId={projectId}>
      <ProjectShellContent userName={userName} signedIn={signedIn}>
        {children}
      </ProjectShellContent>
    </ProjectProvider>
  );
}