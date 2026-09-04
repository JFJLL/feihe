'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProjectData, daysAgo } from '../../../../lib/hooks/use-project-data';
import { ContentWorkspace } from '../../../../features/content/ContentWorkspace';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { ErrorState } from '../../../../components/ui/ErrorState';

export default function ContentPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || daysAgo(90);
  const to = searchParams.get('to') || new Date().toISOString().slice(0, 10);
  const source = searchParams.get('source') || '';

  const {
    dashboard,
    ops,
    loading,
    error,
    refresh,
  } = useProjectData(projectId, { from, to, source });

  if (loading && !dashboard) return <LoadingState text="正在加载内容资产与发布数据…" />;
  if (error && !dashboard) return <ErrorState error={error} onRetry={refresh} />;
  if (!dashboard || !ops) return <LoadingState text="正在初始化…" />;

  return (
    <ContentWorkspace
      projectId={projectId}
      dashboard={dashboard}
      ops={ops}
      onRefresh={refresh}
    />
  );
}
