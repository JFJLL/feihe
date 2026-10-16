'use client';
import { MetricWorkspace } from '../../../../features/metrics/MetricWorkspace';
import { useProject } from '../../../../components/project-shell/ProjectContext';
export default function MetricsPage() {
  const { projectId } = useProject();
  return <MetricWorkspace key={projectId} projectId={projectId} />;
}
