'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProjectData } from '../../../../lib/hooks/use-project-data';
import { InsightsWorkspace } from '../../../../features/insights/InsightsWorkspace';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { ErrorState } from '../../../../components/ui/ErrorState';

export default function InsightsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'voice';
  const { dashboard, ops, currentProject, loading, error, refresh, setToast } =
    useProjectData(projectId);

  if (loading && !dashboard) return <LoadingState text="正在加载分析与复盘数据…" />;
  if (error && !dashboard) return <ErrorState error={error} onRetry={refresh} />;
  if (!dashboard || !ops) return <LoadingState text="正在初始化…" />;

  return (
    <InsightsWorkspace
      projectId={projectId}
      project={currentProject}
      dashboard={dashboard}
      ops={ops}
      initialTab={tab}
      onRefresh={refresh}
      toast={setToast}
    />
  );
}
