'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  buildNormalizedUrl,
  buildCacheKey,
  getCachedQuery,
  setCachedQuery,
  fetchWithCache,
  getKeyEpoch,
  getIdentityEpoch,
} from '../cache/query-cache';
import { ApiError } from './use-project-data';
import { useCacheIdentity } from '../../components/project-shell/IdentityBoundary';
import { isActiveCacheIdentity } from '../browser-cache';

export type UseCachedQueryOptions<T> = {
  url: string;
  projectId?: string;
  params?: Record<string, string | number | boolean | undefined | null>;
  enabled?: boolean;
  staleTime?: number;
  ttl?: number;
  initialData?: T | null;
};

export type UseCachedQueryResult<T> = {
  data: T | null;
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: (opts?: { fresh?: boolean; throwOnError?: boolean }) => Promise<T | null>;
  setData: (updater: T | ((prev: T | null) => T)) => void;
};

export function useCachedQuery<T>({
  url,
  projectId = '',
  params,
  enabled = true,
  staleTime = 60 * 1000,
  ttl = 10 * 60 * 1000,
  initialData = null,
}: UseCachedQueryOptions<T>): UseCachedQueryResult<T> {
  const identity = useCacheIdentity();
  const normalizedUrl = buildNormalizedUrl(url, params);
  const cacheKey = buildCacheKey(identity, projectId, normalizedUrl);

  // Synchronous cache hit on first render frame
  const cached = getCachedQuery<T>(cacheKey, identity);
  const effectiveInitialData = cached?.data ?? initialData ?? null;

  const [data, setDataState] = useState<T | null>(effectiveInitialData);
  const [loading, setLoading] = useState<boolean>(!effectiveInitialData && enabled);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const requestGenRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // If cacheKey changed (e.g. query params changed or project changed), check new cache key synchronously
  const lastCacheKeyRef = useRef(cacheKey);
  if (lastCacheKeyRef.current !== cacheKey) {
    lastCacheKeyRef.current = cacheKey;
    requestGenRef.current++;
    const newCached = getCachedQuery<T>(cacheKey, identity);
    if (newCached) {
      setDataState(newCached.data);
      setLoading(false);
      setError(null);
    } else {
      setDataState(null);
      setLoading(enabled);
      setError(null);
    }
  }

  const doFetch = useCallback(
    async (opts?: { fresh?: boolean; throwOnError?: boolean }): Promise<T | null> => {
      if (!enabled) return null;
      const gen = ++requestGenRef.current;
      const isFresh = opts?.fresh ?? false;
      const startKeyEpoch = getKeyEpoch(cacheKey);
      const startIdentityEpoch = getIdentityEpoch(identity);

      // If we don't have data, mark loading; otherwise mark isRefreshing
      if (!data && !cached?.data) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const result = await fetchWithCache<T>(url, {
          identity,
          projectId,
          params,
          fresh: isFresh,
          staleTime,
          ttl,
        });

        // Strict generation & epoch protection:
        // 1. Must be the latest request generation for this hook instance
        // 2. Component must still be mounted
        if (gen !== requestGenRef.current || !mountedRef.current) return null;

        // 3. Identity validation: if identity became inactive or logged out, clear UI
        if (identity && !isActiveCacheIdentity(identity)) {
          setDataState(null);
          setLoading(false);
          setIsRefreshing(false);
          return null;
        }

        // 4. Invalidation check: did an invalidation or clear occur while this fetch was in flight?
        const currentKeyEpoch = getKeyEpoch(cacheKey);
        const currentIdentityEpoch = getIdentityEpoch(identity);
        if (currentKeyEpoch !== startKeyEpoch || currentIdentityEpoch !== startIdentityEpoch) {
          // Stale response from a superseded generation; do not apply to state!
          const freshCached = getCachedQuery<T>(cacheKey, identity);
          setDataState(freshCached ? freshCached.data : null);
          setLoading(false);
          setIsRefreshing(false);
          return freshCached?.data ?? null;
        }

        setDataState(result);
        setLoading(false);
        setIsRefreshing(false);
        setError(null);
        return result;
      } catch (err) {
        if (gen === requestGenRef.current && mountedRef.current) {
          const msg = err instanceof Error ? err.message : '数据加载失败';
          setError(msg);
          setLoading(false);
          setIsRefreshing(false);
          // 401/403: must immediately clear protected data so old sensitive data is not presented
          if (err instanceof ApiError && [401, 403].includes(err.status)) {
            setDataState(null);
          }
        }
        if (opts?.throwOnError) {
          throw err;
        }
        return null;
      }
    },
    [enabled, url, identity, projectId, params, staleTime, ttl, data, cached?.data, cacheKey]
  );

  // Main effect: revalidate if stale or missing
  useEffect(() => {
    if (!enabled) return;
    const currentCached = getCachedQuery<T>(cacheKey, identity);
    if (!currentCached || currentCached.isStale) {
      void doFetch();
    }
  }, [enabled, cacheKey, identity, doFetch]);

  // Listen to invalidations from mutations
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleInvalidation = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string; endpoint?: string }>).detail;
      if (!detail) return;
      if (detail.projectId && detail.projectId !== projectId) return;
      if (detail.endpoint && !url.includes(detail.endpoint)) return;
      // Invalidation received: supersede in-flight generation immediately
      requestGenRef.current++;
      // Matching invalidation: re-fetch fresh
      void doFetch({ fresh: true });
    };
    window.addEventListener('app:query-cache-invalidated', handleInvalidation);
    return () => window.removeEventListener('app:query-cache-invalidated', handleInvalidation);
  }, [projectId, url, doFetch]);

  const setData = useCallback(
    (updater: T | ((prev: T | null) => T)) => {
      setDataState((prev) => {
        const next = typeof updater === 'function' ? (updater as (prev: T | null) => T)(prev) : updater;
        if (next !== null && next !== undefined) {
          setCachedQuery<T>(cacheKey, next, { identity, projectId, ttl });
        }
        return next;
      });
    },
    [cacheKey, identity, projectId, ttl]
  );

  return {
    data,
    loading,
    isRefreshing,
    error,
    refresh: doFetch,
    setData,
  };
}
