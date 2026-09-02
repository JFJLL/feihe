import { getChatGPTUser } from './chatgpt-auth';
import { ProjectCenter } from '../features/project-center/ProjectCenter';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();
  return <ProjectCenter userName={user?.displayName || '内部用户'} />;
}
