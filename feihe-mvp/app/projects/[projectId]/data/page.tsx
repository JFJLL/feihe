'use client';

import { DataWorkspace } from '../../../../features/data/DataWorkspace';
import { useProject } from '../../../../components/project-shell/ProjectContext';

export default function DataPage() {
  const { projectId } = useProject();
  return <DataWorkspace key={projectId} projectId={projectId} />;
}
