import { GET as dashboard } from '../app/api/dashboard/route';
import { GET as operations } from '../app/api/ops/route';
import { GET as workspace } from '../app/api/projects/route';
import type { Dashboard, Ops, Workspace } from './types/project';

export type ProjectBootstrap = {
  dashboard: Dashboard;
  ops: Ops;
  workspace: Workspace;
  timestamp: number;
};

// Reuse the authenticated read handlers in-process, without HTTP round trips.
// A failed read falls back to the existing client retry/error flow.
export async function loadProjectBootstrap(projectId: string): Promise<ProjectBootstrap | null> {
  try {
    const query = new URLSearchParams({ projectId });
    const responses = await Promise.all([
      dashboard(new Request(`http://localhost/api/dashboard?${query}`)),
      operations(new Request(`http://localhost/api/ops?${query}`)),
      workspace(),
    ]);
    if (responses.some(response => !response.ok)) return null;
    const [dashboardData, ops, workspaceData] = await Promise.all([
      responses[0].json() as Promise<Dashboard>,
      responses[1].json() as Promise<Ops>,
      responses[2].json() as Promise<Workspace>,
    ]);
    return { dashboard: dashboardData, ops, workspace: workspaceData, timestamp: Date.now() };
  } catch {
    return null;
  }
}
