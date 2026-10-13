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

  const resolveTab = useCallback((raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const mapped = aliases && aliases[raw] ? aliases[raw] : raw;
    return allowedTabs.includes(mapped) ? mapped : null;
  }, [aliases, allowedTabs]);

  const urlTab = resolveTab(searchParams?.get('tab'));
  const [activeTab, setActiveTab] = useState<string>(urlTab || defaultTab);

  // Sync state whenever URL searchParams change
  useEffect(() => {
    const nextTab = resolveTab(searchParams?.get('tab')) || defaultTab;
    setActiveTab(nextTab);
  }, [searchParams, resolveTab, defaultTab]);

  // Listen to popstate for browser Back / Forward
  useEffect(() => {
    const onPopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const popTab = resolveTab(params.get('tab')) || defaultTab;
        setActiveTab(popTab);
      } catch {}
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [resolveTab, defaultTab]);

  const setTab = useCallback(
    (nextTab: string) => {
      const target = resolveTab(nextTab) || defaultTab;
      setActiveTab(target);
      try {
        const params = new URLSearchParams(window.location.search);
        params.set('tab', target);
        const newUrl = pathname + '?' + params.toString();
        window.history.pushState({ tab: target }, '', newUrl);
        window.dispatchEvent(new Event('popstate'));
      } catch {}
    },
    [pathname, resolveTab, defaultTab]
  );

  return [activeTab, setTab];
}
