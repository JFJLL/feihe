'use client';

import { api, ApiError } from '../hooks/use-project-data';
import { isActiveCacheIdentity, activateCacheIdentity } from '../browser-cache';
export { isActiveCacheIdentity, activateCacheIdentity };

export type CacheEntry<T = unknown> = {
  data: T;
  timestamp: number;
  identity: string;
  projectId: string;
  ttl: number;
};

const MAX_MEMORY_ENTRIES = 150;
const DEFAULT_STALE_TIME = 60 * 1000; // 60 seconds
const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes
const SESSION_STORAGE_PREFIX = 'feihe:qc:';
const isClient = typeof window !== 'undefined';

// In-memory bounded cache
const memoryStore = new Map<string, CacheEntry>();
// In-flight request deduplication map
const inflightRequests = new Map<string, Promise<unknown>>();
// Epoch tracking per cache key, scope (project + endpoint), and identity to prevent stale write-backs
const keyEpochs = new Map<string, number>();
const scopeEpochs = new Map<string, number>();
const identityEpochs = new Map<string, number>();

export function extractEndpoint(url: string): string {
  return url.split('?')[0];
}

function scopeKey(projectId = '', endpoint = ''): string {
  return `${projectId || '_all'}::${endpoint || '_all'}`;
}

export function getKeyEpoch(key: string): number {
  return keyEpochs.get(key) || 0;
}

export function bumpKeyEpoch(key: string): number {
  const next = (keyEpochs.get(key) || 0) + 1;
  keyEpochs.set(key, next);
  return next;
}

export function getScopeEpoch(projectId = '', endpoint = ''): number {
  const specific = scopeEpochs.get(scopeKey(projectId, endpoint)) || 0;
  const projectAll = scopeEpochs.get(scopeKey(projectId, '_all')) || 0;
  const globalAll = scopeEpochs.get(scopeKey('_all', '_all')) || 0;
  return specific + projectAll + globalAll;
}

export function bumpScopeEpoch(projectId = '', endpoint = ''): number {
  const k = scopeKey(projectId, endpoint);
  const next = (scopeEpochs.get(k) || 0) + 1;
  scopeEpochs.set(k, next);
  return next;
}

export function getIdentityEpoch(identity: string): number {
  return identityEpochs.get(identity) || 0;
}

export function bumpIdentityEpoch(identity: string): number {
  const next = (identityEpochs.get(identity) || 0) + 1;
  identityEpochs.set(identity, next);
  return next;
}

export function buildNormalizedUrl(url: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  const [pathname, existingQuery] = url.split('?');
  const sp = new URLSearchParams(existingQuery || '');
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        sp.set(k, String(v));
      }
    }
  }
  // Sort params for deterministic cache keys
  const sortedParams = new URLSearchParams();
  const keys = Array.from(sp.keys()).sort();
  for (const k of keys) {
    const vals = sp.getAll(k).sort();
    for (const v of vals) sortedParams.append(k, v);
  }
  const qs = sortedParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function buildCacheKey(identity: string, projectId: string, normalizedUrl: string): string {
  const safeIdentity = identity || 'anon';
  const safeProject = projectId || '_global';
  return `${safeIdentity}::${safeProject}::${normalizedUrl}`;
}

function readFromSession<T>(key: string, identity: string): CacheEntry<T> | null {
  if (!isClient || !identity || !isActiveCacheIdentity(identity)) return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_PREFIX + encodeURIComponent(key));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.identity !== identity) {
      sessionStorage.removeItem(SESSION_STORAGE_PREFIX + encodeURIComponent(key));
      return null;
    }
    if (Date.now() - entry.timestamp > entry.ttl) {
      sessionStorage.removeItem(SESSION_STORAGE_PREFIX + encodeURIComponent(key));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writeToSession<T>(key: string, entry: CacheEntry<T>): void {
  if (!isClient || !entry.identity || !isActiveCacheIdentity(entry.identity)) return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_PREFIX + encodeURIComponent(key), JSON.stringify(entry));
  } catch {
    // SessionStorage may be full or disabled; safely fall back to memory
  }
}

function pruneMemoryStore(): void {
  if (memoryStore.size <= MAX_MEMORY_ENTRIES) return;
  const now = Date.now();
  // Evict expired entries first
  for (const [key, entry] of memoryStore.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      memoryStore.delete(key);
    }
  }
  // If still above limit, evict oldest entries
  if (memoryStore.size > MAX_MEMORY_ENTRIES) {
    const sorted = Array.from(memoryStore.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = sorted.slice(0, memoryStore.size - MAX_MEMORY_ENTRIES + 10);
    for (const [key] of toRemove) {
      memoryStore.delete(key);
    }
  }
}

export function getCachedQuery<T>(key: string, identity = ''): { data: T; isStale: boolean; timestamp: number } | null {
  // Server-side calls must bypass module cache to avoid cross-request data leaks
  if (!isClient) return null;
  const now = Date.now();
  let entry = memoryStore.get(key) as CacheEntry<T> | undefined;

  if (!entry && identity) {
    const sessionEntry = readFromSession<T>(key, identity);
    if (sessionEntry) {
      entry = sessionEntry;
      memoryStore.set(key, sessionEntry as CacheEntry);
    }
  }

  if (!entry) return null;

  // Check if expired past TTL
  if (now - entry.timestamp > entry.ttl) {
    memoryStore.delete(key);
    if (isClient) {
      try { sessionStorage.removeItem(SESSION_STORAGE_PREFIX + encodeURIComponent(key)); } catch {}
    }
    return null;
  }

  const isStale = (now - entry.timestamp) > DEFAULT_STALE_TIME;
  return {
    data: entry.data,
    isStale,
    timestamp: entry.timestamp,
  };
}

export function setCachedQuery<T>(
  key: string,
  data: T,
  opts: { identity?: string; projectId?: string; ttl?: number } = {}
): void {
  // Never cache in SSR environment
  if (!isClient) return;
  // Never cache null, undefined, or empty error shapes
  if (data === null || data === undefined) return;
  const identity = opts.identity || '';
  const projectId = opts.projectId || '';
  const ttl = opts.ttl || DEFAULT_TTL;
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    identity,
    projectId,
    ttl,
  };
  memoryStore.set(key, entry as CacheEntry);
  pruneMemoryStore();
  if (identity) {
    writeToSession(key, entry);
  }
}

export async function fetchWithCache<T>(
  url: string,
  opts: {
    identity?: string;
    projectId?: string;
    params?: Record<string, string | number | boolean | undefined | null>;
    fresh?: boolean;
    staleTime?: number;
    ttl?: number;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const normalizedUrl = buildNormalizedUrl(url, opts.params);
  // On server (SSR), bypass module cache and concurrency map completely
  if (!isClient) {
    return api<T>(normalizedUrl, { cache: 'no-store' });
  }
  const identity = opts.identity || '';
  const projectId = opts.projectId || '';
  const endpoint = extractEndpoint(url);
  const key = buildCacheKey(identity, projectId, normalizedUrl);
  const ttl = opts.ttl || DEFAULT_TTL;
  const staleTime = opts.staleTime || DEFAULT_STALE_TIME;

  // 1. If not fresh, check cache first
  if (!opts.fresh) {
    const cached = getCachedQuery<T>(key, identity);
    if (cached && (Date.now() - cached.timestamp < staleTime)) {
      if (opts.signal?.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      return cached.data;
    }
  }

  // Capture epochs at the exact moment this fetch is initiated
  const startKeyEpoch = getKeyEpoch(key);
  const startScopeEpoch = getScopeEpoch(projectId, endpoint);
  const startIdentityEpoch = getIdentityEpoch(identity);

  // 2. Concurrency deduplication: reuse in-flight request if present
  let sharedPromise = inflightRequests.get(key) as Promise<T> | undefined;

  if (!sharedPromise) {
    // 3. Launch shared background fetch
    // Notice: We do NOT bind the shared fetch directly to a single component's abort signal,
    // so that unmounting one consumer does not cancel other consumers' shared promise!
    sharedPromise = (async () => {
      try {
        const fetchUrl = opts.fresh
          ? `${normalizedUrl}${normalizedUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`
          : normalizedUrl;
        const res = await api<T>(fetchUrl, {
          cache: opts.fresh ? 'no-store' : 'default',
        });

        // Generation / Epoch guard before write-back:
        // If the key, scope, or identity was invalidated/cleared during this fetch, do NOT write back!
        const currentKeyEpoch = getKeyEpoch(key);
        const currentScopeEpoch = getScopeEpoch(projectId, endpoint);
        const currentIdentityEpoch = getIdentityEpoch(identity);
        const isIdentityValid = !identity || isActiveCacheIdentity(identity);

        if (
          currentKeyEpoch === startKeyEpoch &&
          currentScopeEpoch === startScopeEpoch &&
          currentIdentityEpoch === startIdentityEpoch &&
          isIdentityValid
        ) {
          setCachedQuery<T>(key, res, { identity, projectId, ttl });
        }
        return res;
      } catch (err) {
        if (err instanceof ApiError && [401, 403].includes(err.status)) {
          // Auth failure: immediately evict cache for this identity and project
          invalidateQueryCache({ projectId, identity });
          if (identity) clearQueryCacheForIdentity(identity);
        }
        throw err;
      } finally {
        // Crucial: Only delete from inflightRequests if it is STILL this exact promise!
        // If an invalidation or new fetch already replaced it, do NOT delete the new entry!
        if (inflightRequests.get(key) === sharedPromise) {
          inflightRequests.delete(key);
        }
      }
    })();

    inflightRequests.set(key, sharedPromise as Promise<unknown>);
  }

  // 4. Attach consumer-level signal handling without aborting the shared underlying fetch!
  if (!opts.signal) {
    return sharedPromise;
  }

  if (opts.signal.aborted) {
    throw new DOMException('The user aborted a request.', 'AbortError');
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      opts.signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('The user aborted a request.', 'AbortError'));
    };
    opts.signal?.addEventListener('abort', onAbort);

    sharedPromise!.then(
      (val) => {
        opts.signal?.removeEventListener('abort', onAbort);
        // Check if invalidated while waiting; if fresh data exists in cache, prefer it
        if (
          getKeyEpoch(key) !== startKeyEpoch ||
          getScopeEpoch(projectId, endpoint) !== startScopeEpoch ||
          getIdentityEpoch(identity) !== startIdentityEpoch
        ) {
          const freshCached = getCachedQuery<T>(key, identity);
          if (freshCached) {
            resolve(freshCached.data);
            return;
          }
        }
        resolve(val);
      },
      (err) => {
        opts.signal?.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

export function invalidateQueryCache(options: {
  projectId?: string;
  endpoint?: string;
  pattern?: RegExp;
  identity?: string;
} = {}): void {
  const { projectId, endpoint, pattern, identity } = options;
  const keysToBump = new Set<string>();

  for (const [key, entry] of memoryStore.entries()) {
    let match = true;
    if (identity && entry.identity !== identity) match = false;
    if (projectId && entry.projectId !== projectId) match = false;
    if (endpoint && !key.includes(endpoint)) match = false;
    if (pattern && !pattern.test(key)) match = false;

    if (match) {
      keysToBump.add(key);
      memoryStore.delete(key);
      if (isClient) {
        try { sessionStorage.removeItem(SESSION_STORAGE_PREFIX + encodeURIComponent(key)); } catch {}
      }
    }
  }

  // Also clear in-flight promises matching the criteria and bump their epochs
  for (const [key] of inflightRequests.entries()) {
    let match = true;
    if (projectId && !key.includes(`::${projectId}::`)) match = false;
    if (endpoint && !key.includes(endpoint)) match = false;
    if (pattern && !pattern.test(key)) match = false;
    if (identity && !key.startsWith(`${identity}::`)) match = false;
    if (match) {
      keysToBump.add(key);
      inflightRequests.delete(key);
    }
  }

  // Bump epochs for all matching keys
  for (const key of keysToBump) {
    bumpKeyEpoch(key);
  }

  // Bump scope epochs for this project and endpoint
  bumpScopeEpoch(projectId, endpoint);

  // Notify listeners across components
  if (isClient) {
    window.dispatchEvent(new CustomEvent('app:query-cache-invalidated', {
      detail: { projectId, endpoint },
    }));
  }
}

export function clearQueryCacheForIdentity(identity: string): void {
  if (!identity) return;
  bumpIdentityEpoch(identity);

  for (const [key, entry] of memoryStore.entries()) {
    if (entry.identity === identity || key.startsWith(`${identity}::`)) {
      memoryStore.delete(key);
      bumpKeyEpoch(key);
    }
  }
  for (const [key] of inflightRequests.entries()) {
    if (key.startsWith(`${identity}::`)) {
      inflightRequests.delete(key);
      bumpKeyEpoch(key);
    }
  }
  if (isClient) {
    try {
      for (const k of Object.keys(sessionStorage)) {
        if (k.startsWith(SESSION_STORAGE_PREFIX)) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {}
  }
}

