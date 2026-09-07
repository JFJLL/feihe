import { getChatGPTUser } from '../../chatgpt-auth';
import { ProjectShell } from '../../../components/project-shell/ProjectShell';
import { loadProjectBootstrap } from '../../../lib/project-bootstrap';

export const dynamic = 'force-dynamic';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const [{ projectId }, user] = await Promise.all([params, getChatGPTUser()]);
  const initialData = await loadProjectBootstrap(projectId);

  return (
    <ProjectShell
      projectId={projectId}
      initialData={initialData}
      userName={user?.displayName || '公开访问'}
      signedIn={Boolean(user)}
    >
      {children}
    </ProjectShell>
  );
}
