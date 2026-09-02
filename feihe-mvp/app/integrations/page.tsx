import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project = 'qicui' } = await searchParams;
  redirect('/projects/' + encodeURIComponent(project) + '/settings?tab=integrations');
}
