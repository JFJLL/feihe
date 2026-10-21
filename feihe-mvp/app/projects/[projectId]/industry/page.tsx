'use client';

import { use } from 'react';
import { IndustryWorkspace } from '../../../../features/industry/IndustryWorkspace';

export default function IndustryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  return <IndustryWorkspace projectId={projectId} />;
}
