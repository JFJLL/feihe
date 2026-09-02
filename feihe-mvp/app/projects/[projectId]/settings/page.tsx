'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProjectData } from '../../../../lib/hooks/use-project-data';
import { SettingsWorkspace } from '../../../../features/settings/SettingsWorkspace';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { ErrorState } from '../../../../components/ui/ErrorState';

export default function SettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'profile';
  const { dashboard, ops, workspace, currentProject, loading, error, refresh, setToast } =
    useProjectData(projectId);

  if (loading && !dashboard) return <LoadingState text="正在加载项目设置数据…" />;
  if (error && !dashboard) return <ErrorState error={error} onRetry={refresh} />;
  if (!dashboard || !ops) return <LoadingState text="正在初始化…" />;

  return (
    <SettingsWorkspace
      projectId={projectId}
      project={currentProject}
      dashboard={dashboard}
      ops={ops}
      workspace={workspace}
      initialTab={tab}
      onRefresh={refresh}
      toast={setToast}
    />
  );
}
