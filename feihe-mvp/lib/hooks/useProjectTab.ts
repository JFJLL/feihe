'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export function useProjectTab(defaultTab: string, allowedTabs: string[]): [string, (tab: string) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTab = searchParams.get('tab');
  const activeTab = rawTab && allowedTabs.includes(rawTab) ? rawTab : defaultTab;

  const setTab = useCallback(
    (nextTab: string) => {
      if (nextTab === activeTab) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', nextTab);
      router.push(pathname + '?' + params.toString());
    },
    [activeTab, searchParams, router, pathname]
  );

  return [activeTab, setTab];
}