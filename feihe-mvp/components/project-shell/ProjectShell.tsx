'use client';

import React from 'react';
import type { ProjectBootstrap } from '../../lib/project-bootstrap';
import { ProjectProvider, useProject } from './ProjectContext';
import { ProjectSidebar } from './ProjectSidebar';
import { FeedbackToastContainer } from '../ui/FeedbackToast';
import { FloatingAgent } from './FloatingAgent';
import { LoadingState } from '../ui/LoadingState';
import { ErrorState } from '../ui/ErrorState';
import { emptyDashboard, emptyOps } from '../../lib/hooks/use-project-data';

// 各板块工作区（全盘预载入内存，0ms 极速切换）
import { OverviewWorkspace } from '../../features/overview/OverviewWorkspace';
import { GrowthWorkspace } from '../../features/growth/GrowthWorkspace';
import { ContentWorkspace } from '../../features/content/ContentWorkspace';
import { CommentsWorkspace } from '../../features/comments/CommentsWorkspace';
import { SettingsWorkspace } from '../../features/settings/SettingsWorkspace';
import { DataWorkspace } from '../../features/data/DataWorkspace';

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

  const isSettingsOrData = activeSection === "settings" || activeSection === "data";

  // 首屏未加载完时展示骨架加载（设置和数据页面不阻塞）
  if (dataLoading && !dashboard && !isSettingsOrData) {
    return (
      <div className="app-shell">
        <ProjectSidebar userName={userName} signedIn={signedIn} />
        <main className="main">
          <LoadingState text="正在准备项目全盘数据…" />
        </main>
      </div>
    );
  }

  if (dataError && !dashboard && !isSettingsOrData) {
    return (
      <div className="app-shell">
        <ProjectSidebar userName={userName} signedIn={signedIn} />
        <main className="main">
          <ErrorState error={dataError} onRetry={refreshData} />
        </main>
      </div>
    );
  }

  const effectiveDashboard = dashboard || emptyDashboard;
  const effectiveOps = ops || emptyOps;

  // 客户端单页即时切换（0ms 响应，彻底消除白屏刷新与等待）
  let content = children;
  switch (activeSection) {
    case "":
    case "overview":
      if (dataError && !dashboard) {
        content = <ErrorState error={dataError} onRetry={refreshData} />;
      } else {
        content = (
          <OverviewWorkspace
            projectId={projectId}
            project={currentProject || undefined}
            dashboard={effectiveDashboard}
            ops={effectiveOps}
            loading={dataLoading}
            onRefresh={refreshData}
          />
        );
      }
      break;
    case "growth":
    case "competitor":
      content = (
        <GrowthWorkspace
          projectId={projectId}
          dashboard={effectiveDashboard}
          ops={effectiveOps}
          onRefresh={refreshData}
        />
      );
      break;
    case "content":
      content = (
        <ContentWorkspace
          projectId={projectId}
          dashboard={effectiveDashboard}
          ops={effectiveOps}
          onRefresh={refreshData}
        />
      );
      break;
    case "comments":
    case "insights":
      content = (
        <CommentsWorkspace
          projectId={projectId}
          dashboard={effectiveDashboard}
          ops={effectiveOps}
          onRefresh={refreshData}
        />
      );
      break;
    case "data":
      content = <DataWorkspace key={projectId} projectId={projectId} />;
      break;
    case "settings":
      content = (
        <>
          {dataError && (
            <div style={{ padding: "10px 16px", background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              ⚠️ 分析数据接口暂不可用，但您可以正常维护项目设置、数据源与成员权限。
            </div>
          )}
          <SettingsWorkspace
            projectId={projectId}
            project={currentProject}
            dashboard={effectiveDashboard}
            ops={effectiveOps}
            onRefresh={refreshData}
          />
        </>
      );
      break;
    default:
      content = children;
      break;
  }

  return (
    <div className="app-shell">
      <ProjectSidebar userName={userName} signedIn={signedIn} />
      <main className="main">
        {content}
        <FeedbackToastContainer toasts={toasts} onClose={removeToast} />
      </main>
      {currentProject?.canWrite && activeSection !== 'data' && <FloatingAgent projectId={projectId} />}
    </div>
  );
}

export function ProjectShell({
  projectId,
  initialData,
  userName = '内部用户',
  signedIn = true,
  children,
}: {
  projectId: string;
  initialData?: ProjectBootstrap | null;
  userName?: string;
  signedIn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ProjectProvider key={projectId} projectId={projectId} initialData={initialData} initialWorkspace={initialData?.workspace}>
      <ProjectShellContent userName={userName} signedIn={signedIn}>
        {children}
      </ProjectShellContent>
    </ProjectProvider>
  );
}
