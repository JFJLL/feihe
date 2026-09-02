'use client';

import { use } from 'react';
import { useProjectData } from '../../../lib/hooks/use-project-data';
import { useProject } from '../../../components/project-shell/ProjectContext';
import { OverviewWorkspace } from '../../../features/overview/OverviewWorkspace';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ErrorState } from '../../../components/ui/ErrorState';

export default function OverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { currentProject } = useProject();
  const { dashboard, ops, loading, error, refresh } = useProjectData(projectId);

  if (loading && !dashboard) return <LoadingState text="正在加载项目总览数据…" />;
  if (error && !dashboard) return <ErrorState error={error} onRetry={refresh} />;
  if (!dashboard || !ops) return <LoadingState text="正在初始化…" />;

  return (
    <OverviewWorkspace
      projectId={projectId}
      project={currentProject || undefined}
      dashboard={dashboard}
      ops={ops}
      loading={loading}
      onRefresh={refresh}
    />
  );
}
