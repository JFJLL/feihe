import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const sp = new URLSearchParams();
  let project = 'qicui';
  for (const [key, value] of Object.entries(query)) {
    if (key === 'project' && typeof value === 'string') {
      project = value;
    } else if (typeof value === 'string') {
      sp.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((v) => sp.append(key, v));
    }
  }
  sp.set('tab', 'integrations');
  redirect('/projects/' + encodeURIComponent(project) + '/settings?' + sp.toString());
}