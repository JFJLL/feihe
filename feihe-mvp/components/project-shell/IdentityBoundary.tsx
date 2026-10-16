'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { activateCacheIdentity } from '../../lib/browser-cache';
import { LoadingState } from '../ui/LoadingState';
const IdentityContext = createContext('');
export function useCacheIdentity() { return useContext(IdentityContext); }
export function IdentityBoundary({ identity, children }: { identity: string | null; children: ReactNode }) {
  const [readyIdentity, setReadyIdentity] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let current = true; activateCacheIdentity(identity);
    queueMicrotask(() => { if (current) setReadyIdentity(identity); });
    return () => { current = false; };
  }, [identity]);
  return <IdentityContext.Provider value={identity || ''}>{readyIdentity === identity ? children : <LoadingState text="正在准备已验证身份的项目空间…" />}</IdentityContext.Provider>;
}
