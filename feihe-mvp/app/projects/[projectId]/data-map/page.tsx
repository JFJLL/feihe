import { getChatGPTUser } from '../../../chatgpt-auth';
import IntelligenceClient from '../../../intelligence-client';
export const dynamic='force-dynamic';
export default async function DataMapPage({params}:{params:Promise<{projectId:string}>}){const [{projectId},user]=await Promise.all([params,getChatGPTUser()]);return <IntelligenceClient projectId={projectId} initialMode="map" userName={user?.displayName||'内部用户'}/>}
