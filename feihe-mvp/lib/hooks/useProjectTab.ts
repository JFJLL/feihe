'use client';

import { useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';

export function useProjectTab(defaultTab: string, allowedTabs: string[]): [string, (tab: string) => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const rawTab = searchParams.get('tab');
  const initialTab = rawTab && allowedTabs.includes(rawTab) ? rawTab : defaultTab;
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync state if URL query changes externally (e.g. browser back/forward)
  useEffect(() => {
    if (rawTab && allowedTabs.includes(rawTab) && rawTab !== activeTab) {
      setActiveTab(rawTab);
    }
  }, [rawTab, allowedTabs, activeTab]);

  const setTab = useCallback(
    (nextTab: string) => {
      if (nextTab === activeTab) return;
      setActiveTab(nextTab);
      try {
        const params = new URLSearchParams(window.location.search);
        params.set('tab', nextTab);
        window.history.replaceState(null, '', pathname + '?' + params.toString());
      } catch {
        // Fallback
      }
    },
    [activeTab, pathname]
  );

  return [activeTab, setTab];
}

