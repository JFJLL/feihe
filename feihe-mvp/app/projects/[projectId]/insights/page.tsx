'use client';

import { use, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingState } from '../../../../components/ui/LoadingState';

export default function InsightsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'competitor') {
      router.replace('/projects/' + encodeURIComponent(projectId) + '/growth?tab=competitor');
    } else if (tab === 'content') {
      router.replace('/projects/' + encodeURIComponent(projectId) + '/content?tab=analysis');
    } else {
      router.replace('/projects/' + encodeURIComponent(projectId) + '/comments?tab=voice');
    }
  }, [projectId, router, searchParams]);

  return <LoadingState text="正在跳转至对应分析看板…" />;
}
