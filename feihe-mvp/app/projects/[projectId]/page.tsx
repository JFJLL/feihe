import { getChatGPTUser } from '../../chatgpt-auth';
import DashboardClient from '../../dashboard-client';
export const dynamic='force-dynamic';
export default async function ProjectPage({params}:{params:Promise<{projectId:string}>}){const [{projectId},user]=await Promise.all([params,getChatGPTUser()]);return <DashboardClient initialProjectId={projectId} initialSection="cockpit" userName={user?.displayName||'内部用户'} signedIn={Boolean(user)}/>}
