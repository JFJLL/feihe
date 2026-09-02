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
  const tab = searchParams.get('tab') || 'pool';
  const {
    dashboard,
    loading,
    error,
    refresh,
    setToast,
    from,
    to,
    setFrom,
    setTo,
    source,
    setSource,
  } = useProjectData(projectId);

  if (loading && !dashboard) return <LoadingState text="正在加载内容资产与发布数据…" />;
  if (error && !dashboard) return <ErrorState error={error} onRetry={refresh} />;
  if (!dashboard) return <LoadingState text="正在初始化…" />;

  return (
    <ContentWorkspace
      projectId={projectId}
      dashboard={dashboard}
      initialTab={tab}
      onRefresh={refresh}
      toast={setToast}
      from={from}
      to={to}
      setFrom={setFrom}
      setTo={setTo}
      source={source}
      setSource={setSource}
    />
  );
}
