import { getChatGPTUser } from './chatgpt-auth';
import PlatformClient from './platform-client';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getChatGPTUser();
  return <PlatformClient initialView="projects" userName={user?.displayName || '内部用户'} />;
}
