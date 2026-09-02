import { getChatGPTUser } from '../../../chatgpt-auth';
import IntelligenceClient from '../../../intelligence-client';
export const dynamic='force-dynamic';
export default async function AgentPage({params}:{params:Promise<{projectId:string}>}){const [{projectId},user]=await Promise.all([params,getChatGPTUser()]);return <IntelligenceClient projectId={projectId} initialMode="agent" userName={user?.displayName||'内部用户'}/>}
