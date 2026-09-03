import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AgentRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') sp.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => sp.append(key, v));
  }
  sp.set('tab', 'ai');
  redirect('/projects/' + encodeURIComponent(projectId) + '/insights?' + sp.toString());
}