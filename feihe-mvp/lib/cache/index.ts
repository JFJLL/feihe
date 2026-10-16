'use client';

export {
  buildNormalizedUrl,
  buildCacheKey,
  getCachedQuery,
  setCachedQuery,
  fetchWithCache,
  invalidateQueryCache,
  clearQueryCacheForIdentity,
  getKeyEpoch,
  bumpKeyEpoch,
  getIdentityEpoch,
  bumpIdentityEpoch,
  type CacheEntry,
} from './query-cache';

export {
  useCachedQuery,
  type UseCachedQueryOptions,
  type UseCachedQueryResult,
} from '../hooks/use-cached-query';
