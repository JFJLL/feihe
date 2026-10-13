'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useSyncExternalStore } from 'react';

function subscribeUrl(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

export function useProjectTab(defaultTab: string, allowedTabs: string[], aliases?: Record<string, string>): [string, (tab: string) => void] {
  const searchParams = useSearchParams();
  const search = useSyncExternalStore(subscribeUrl, () => window.location.search, () => '?' + (searchParams?.toString() || ''));
  const resolveTab = useCallback((raw: string | null | undefined) => {
    const mapped = raw && aliases?.[raw] ? aliases[raw] : raw;
    return mapped && allowedTabs.includes(mapped) ? mapped : defaultTab;
  }, [aliases, allowedTabs, defaultTab]);
  const activeTab = resolveTab(new URLSearchParams(search).get('tab'));
  const setTab = useCallback((nextTab: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', resolveTab(nextTab));
    window.history.pushState({ tab: nextTab }, '', window.location.pathname + '?' + params.toString());
    window.dispatchEvent(new Event('popstate'));
  }, [resolveTab]);
  return [activeTab, setTab];
}
