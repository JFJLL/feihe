'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProjectData } from '../../../../lib/hooks/use-project-data';
import { CommentsWorkspace } from '../../../../features/comments/CommentsWorkspace';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { ErrorState } from '../../../../components/ui/ErrorState';

export default function CommentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'acceptance';
  const { dashboard, ops, loading, error, refresh, setToast } = useProjectData(projectId);

  if (loading && !dashboard) return <LoadingState text="正在加载评论验收与处置数据…" />;
  if (error && !dashboard) return <ErrorState error={error} onRetry={refresh} />;
  if (!dashboard || !ops) return <LoadingState text="正在初始化…" />;

  return (
    <CommentsWorkspace
      projectId={projectId}
      dashboard={dashboard}
      ops={ops}
      initialTab={tab}
      onRefresh={refresh}
      toast={setToast}
    />
  );
}
