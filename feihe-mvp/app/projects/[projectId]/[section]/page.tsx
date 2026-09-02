import { getChatGPTUser } from '../../../chatgpt-auth';
import DashboardClient from '../../../dashboard-client';
export const dynamic = 'force-dynamic';
const allowed = new Set(['growth', 'content', 'acceptance', 'risk', 'insights', 'settings', 'voice', 'competitor', 'progress', 'sentiment', 'notes', 'supplier', 'reports', 'tasks']);
export default async function ProjectSectionPage({ params }: { params: Promise<{ projectId: string; section: string }> }) {
  const [{ projectId, section }, user] = await Promise.all([params, getChatGPTUser()]);
  return <DashboardClient initialProjectId={projectId} initialSection={allowed.has(section) ? section : 'cockpit'} userName={user?.displayName || '内部用户'} signedIn={Boolean(user)} />;
}
