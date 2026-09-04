'use client';

import { useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';

export function useProjectTab(
  defaultTab: string,
  allowedTabs: string[],
  aliases?: Record<string, string>
): [string, (tab: string) => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const rawTab = searchParams.get('tab');
  const resolvedRawTab = (rawTab && aliases && aliases[rawTab]) ? aliases[rawTab] : rawTab;
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  const activeTab =
    selectedTab && allowedTabs.includes(selectedTab)
      ? selectedTab
      : resolvedRawTab && allowedTabs.includes(resolvedRawTab)
      ? resolvedRawTab
      : defaultTab;

  useEffect(() => {
    if (rawTab && aliases && aliases[rawTab] && aliases[rawTab] !== rawTab) {
      try {
        const params = new URLSearchParams(window.location.search);
        params.set('tab', aliases[rawTab]);
        window.history.replaceState(null, '', pathname + '?' + params.toString());
      } catch {}
    }
  }, [rawTab, aliases, pathname]);

  const setTab = useCallback(
    (nextTab: string) => {
      if (nextTab === activeTab) return;
      setSelectedTab(nextTab);
      try {
        // Clear stale tab-specific filters when switching tabs
        const params = new URLSearchParams();
        params.set('tab', nextTab);
        window.history.pushState(null, '', pathname + '?' + params.toString());
      } catch {
        // Fallback
      }
    },
    [activeTab, pathname, setSelectedTab]
  );

  return [activeTab, setTab];
}
