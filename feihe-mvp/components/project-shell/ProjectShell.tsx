'use client';

import React from 'react';
import { ProjectProvider, useProject } from './ProjectContext';
import { ProjectSidebar } from './ProjectSidebar';
import { FeedbackToastContainer } from '../ui/FeedbackToast';
import { FloatingAgent } from './FloatingAgent';
import { LoadingState } from '../ui/LoadingState';
import { ErrorState } from '../ui/ErrorState';

// 各板块工作区（全盘预载入内存，0ms 极速切换）
import { OverviewWorkspace } from '../../features/overview/OverviewWorkspace';
import { GrowthWorkspace } from '../../features/growth/GrowthWorkspace';
import { ContentWorkspace } from '../../features/content/ContentWorkspace';
import { CommentsWorkspace } from '../../features/comments/CommentsWorkspace';
import { SettingsWorkspace } from '../../features/settings/SettingsWorkspace';

function ProjectShellContent({
  userName,
  signedIn,
  children,
}: {
  userName: string;
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const {
    toasts,
    removeToast,
    projectId,
    currentProject,
    activeSection,
    dashboard,
    ops,
    dataLoading,
    dataError,
    refreshData,
  } = useProject();

  // 首屏未加载完时展示骨架加载
  if (dataLoading && !dashboard) {
    return (
      <div className="app-shell">
        <ProjectSidebar userName={userName} signedIn={signedIn} />
        <main className="main">
          <LoadingState text="正在准备项目全盘数据…" />
        </main>
      </div>
    );
  }

  if (dataError && !dashboard) {
    return (
      <div className="app-shell">
        <ProjectSidebar userName={userName} signedIn={signedIn} />
        <main className="main">
          <ErrorState error={dataError} onRetry={refreshData} />
        </main>
      </div>
    );
  }

  // 客户端单页即时切换（0ms 响应，彻底消除白屏刷新与等待）
  let content = children;
  if (dashboard && ops) {
    switch (activeSection) {
      case '':
      case 'overview':
        content = (
          <OverviewWorkspace
            projectId={projectId}
            project={currentProject || undefined}
            dashboard={dashboard}
            ops={ops}
            loading={dataLoading}
            onRefresh={refreshData}
          />
        );
        break;
      case 'growth':
      case 'competitor':
        content = (
          <GrowthWorkspace
            projectId={projectId}
            dashboard={dashboard}
            ops={ops}
            onRefresh={refreshData}
          />
        );
        break;
      case 'content':
      content = (
        <ContentWorkspace
          projectId={projectId}
          dashboard={dashboard}
          ops={ops}
          onRefresh={refreshData}
        />
      );
        break;
      case 'comments':
        content = (
          <CommentsWorkspace
            projectId={projectId}
            dashboard={dashboard}
            ops={ops}
            onRefresh={refreshData}
          />
        );
        break;
      case 'insights':
        content = (
          <CommentsWorkspace
            projectId={projectId}
            dashboard={dashboard}
            ops={ops}
            onRefresh={refreshData}
          />
        );
        break;
      case 'settings':
        content = (
          <SettingsWorkspace
            projectId={projectId}
            project={currentProject}
            dashboard={dashboard}
            ops={ops}
            onRefresh={refreshData}
          />
        );
        break;
      default:
        content = children;
        break;
    }
  }

  return (
    <div className="app-shell">
      <ProjectSidebar userName={userName} signedIn={signedIn} />
      <main className="main">
        {content}
        <FeedbackToastContainer toasts={toasts} onClose={removeToast} />
      </main>
      <FloatingAgent projectId={projectId} />
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
