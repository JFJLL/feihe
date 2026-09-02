import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DataSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project = 'qicui' } = await searchParams;
  redirect('/projects/' + encodeURIComponent(project) + '/settings?tab=data-sources');
}
