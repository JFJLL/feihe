import { headers } from 'next/headers';
import { requireProjectAccess } from '../../../lib/api-auth';
import { ProjectShell } from '../../../components/project-shell/ProjectShell';
import { IdentityBoundary } from '../../../components/project-shell/IdentityBoundary';
import { AccessState } from '../../../components/ui/AccessState';
import { loadProjectBootstrap } from '../../../lib/project-bootstrap';
export const dynamic = 'force-dynamic';
export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const forwarded = new Headers(await headers());
  const access = await requireProjectAccess(new Request('http://localhost/', { headers: forwarded }), projectId, 'read');
  if (!access.ok) return <IdentityBoundary identity={null}><AccessState status={access.status || 403} message={access.error} /></IdentityBoundary>;
  const context = access.context!;
  const initialData = await loadProjectBootstrap(projectId, forwarded);
  return <IdentityBoundary identity={context.user.orgId + ':' + context.user.userId}><ProjectShell projectId={projectId} initialData={initialData} userName={context.user.displayName} signedIn={true} userId={context.user.userId} initialRole={context.projectRole}>{children}</ProjectShell></IdentityBoundary>;
}
