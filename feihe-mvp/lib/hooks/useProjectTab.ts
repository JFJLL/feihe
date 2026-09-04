'use client';

import { useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export function useProjectTab(defaultTab: string, allowedTabs: string[]): [string, (tab: string) => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const rawTab = searchParams.get('tab');
  const activeTab = rawTab && allowedTabs.includes(rawTab) ? rawTab : defaultTab;

  const setTab = useCallback(
    (nextTab: string) => {
      if (nextTab === activeTab) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', nextTab);
      window.location.assign(pathname + '?' + params.toString());
    },
    [activeTab, searchParams, router, pathname]
  );

  return [activeTab, setTab];
}