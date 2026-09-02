'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProjectData } from '../../../../lib/hooks/use-project-data';
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
  const fromQuery = searchParams.get('from') || undefined;
  const toQuery = searchParams.get('to') || undefined;
  const sourceQuery = searchParams.get('source') || undefined;

  const {
    dashboard,
    loading,
    error,
    refresh,
    from,
    to,
    source,
  } = useProjectData(projectId, fromQuery, toQuery, sourceQuery);

  if (loading && !dashboard) return <LoadingState text="正在加载内容资产与发布数据…" />;
  if (error && !dashboard) return <ErrorState error={error} onRetry={refresh} />;
  if (!dashboard) return <LoadingState text="正在初始化…" />;

  return (
    <ContentWorkspace
      projectId={projectId}
      dashboard={dashboard}
      onRefresh={refresh}
      from={from}
      to={to}
      source={source}
    />
  );
}