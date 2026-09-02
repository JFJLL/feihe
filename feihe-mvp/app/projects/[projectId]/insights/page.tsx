'use client';

import { use } from 'react';
import { useProjectData } from '../../../../lib/hooks/use-project-data';
import { useProject } from '../../../../components/project-shell/ProjectContext';
import { InsightsWorkspace } from '../../../../features/insights/InsightsWorkspace';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { ErrorState } from '../../../../components/ui/ErrorState';

export default function InsightsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { currentProject } = useProject();
  const { dashboard, ops, loading, error, refresh } = useProjectData(projectId);

  if (loading && !dashboard) return <LoadingState text="正在加载分析与复盘数据…" />;
  if (error && !dashboard) return <ErrorState error={error} onRetry={refresh} />;
  if (!dashboard || !ops) return <LoadingState text="正在初始化…" />;

  return (
    <InsightsWorkspace
      projectId={projectId}
      project={currentProject}
      dashboard={dashboard}
      ops={ops}
      onRefresh={refresh}
    />
  );
}