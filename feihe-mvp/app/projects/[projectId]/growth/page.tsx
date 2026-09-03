'use client';

import { use } from 'react';
import { useProjectData } from '../../../../lib/hooks/use-project-data';
import { GrowthWorkspace } from '../../../../features/growth/GrowthWorkspace';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { ErrorState } from '../../../../components/ui/ErrorState';

export default function GrowthPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { dashboard, ops, loading, error, refresh } = useProjectData(projectId);

  if (loading && !dashboard) return <LoadingState text="正在加载增长机会数据…" />;
  if (error && !dashboard) return <ErrorState error={error} onRetry={refresh} />;
  if (!dashboard || !ops) return <LoadingState text="正在初始化…" />;

  return (
    <GrowthWorkspace
      projectId={projectId}
      dashboard={dashboard}
      ops={ops}
      onRefresh={refresh}
    />
  );
}
