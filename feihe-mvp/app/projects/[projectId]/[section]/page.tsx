import { redirect } from 'next/navigation';
import { getLegacyRedirectUrl } from '../../../../lib/navigation/project-navigation';

export const dynamic = 'force-dynamic';

export default async function ProjectSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ projectId, section }, query] = await Promise.all([params, searchParams]);
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') sp.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => sp.append(key, v));
  }
  const targetUrl = getLegacyRedirectUrl(projectId, section, sp);
  redirect(targetUrl);
}
