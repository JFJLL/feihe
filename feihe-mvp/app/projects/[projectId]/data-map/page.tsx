import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DataMapRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect('/projects/' + encodeURIComponent(projectId) + '/settings?tab=data-map');
}
