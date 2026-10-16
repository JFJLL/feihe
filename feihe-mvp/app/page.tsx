import { headers } from 'next/headers';
import { getAuthenticatedUser } from '../lib/api-auth';
import { ProjectCenter } from '../features/project-center/ProjectCenter';
import { AccessState } from '../components/ui/AccessState';
import { IdentityBoundary } from '../components/project-shell/IdentityBoundary';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getAuthenticatedUser(new Request('http://localhost/', { headers: new Headers(await headers()) }));
  if (!user) return <IdentityBoundary identity={null}><AccessState status={401} message="请通过已验证的公司身份入口登录后查看项目。" /></IdentityBoundary>;
  return <IdentityBoundary identity={user.orgId + ':' + user.userId}><ProjectCenter userName={user.displayName} /></IdentityBoundary>;
}
