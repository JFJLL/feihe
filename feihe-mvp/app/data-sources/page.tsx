import { getChatGPTUser } from '../chatgpt-auth';
import PlatformClient from '../platform-client';
export const dynamic='force-dynamic';
export default async function DataSourcesPage({searchParams}:{searchParams:Promise<{project?:string}>}){const [user,query]=await Promise.all([getChatGPTUser(),searchParams]);return <PlatformClient initialView="sources" initialProjectId={query.project||'qicui'} userName={user?.displayName||'内部用户'}/>}
