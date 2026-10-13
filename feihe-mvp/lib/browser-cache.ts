const CACHE_PREFIX = 'feihe:v3:';
const OWNER_KEY = 'feihe:cache-identity';
const DEFAULT_MAX_AGE = 6 * 60 * 60 * 1000;
let activeIdentity: string | null = null;
type CacheEntry<T> = { identity: string; value: T; timestamp: number };
export function identityStorageKey(identity: string, key: string) { return encodeURIComponent(identity) + ':' + key; }
export function isActiveCacheIdentity(identity: string) { return Boolean(identity) && identity === activeIdentity; }
export function activateCacheIdentity(identity: string | null) {
  activeIdentity = identity;
  if (typeof window === 'undefined') return;
  try {
    if (!identity || sessionStorage.getItem(OWNER_KEY) !== identity) {
      for (const key of Object.keys(sessionStorage)) if (key.startsWith('feihe:v2:') || key.startsWith(CACHE_PREFIX) || key.startsWith('recommended-board:')) sessionStorage.removeItem(key);
      for (const key of Object.keys(localStorage)) if (key.startsWith('agent-sessions:')) localStorage.removeItem(key);
    }
    if (identity) sessionStorage.setItem(OWNER_KEY, identity); else sessionStorage.removeItem(OWNER_KEY);
  } catch { /* Optional storage; the identity guard remains in memory. */ }
}
export function clearIdentityCache(identity: string) {
  if (typeof window === 'undefined') return;
  try {
    const prefix = CACHE_PREFIX + encodeURIComponent(identity) + ':';
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix)) sessionStorage.removeItem(key);
    for (const key of Object.keys(localStorage)) if (key.startsWith('agent-sessions:' + encodeURIComponent(identity) + ':')) localStorage.removeItem(key);
  } catch { /* Access to the rendered view is removed independently. */ }
}
export function readSessionCache<T>(key: string, maxAge = DEFAULT_MAX_AGE, identity = ''): CacheEntry<T> | null {
  if (typeof window === 'undefined' || !identity || identity !== activeIdentity) return null;
  try {
    const storageKey = CACHE_PREFIX + identityStorageKey(identity, key), raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.identity !== identity || typeof entry.timestamp !== 'number' || Date.now() - entry.timestamp > maxAge) { sessionStorage.removeItem(storageKey); return null; }
    return entry;
  } catch { return null; }
}
export function writeSessionCache<T>(key: string, value: T, timestamp = Date.now(), identity = '') {
  if (typeof window === 'undefined' || !identity || identity !== activeIdentity) return;
  try { sessionStorage.setItem(CACHE_PREFIX + identityStorageKey(identity, key), JSON.stringify({ identity, value, timestamp })); } catch { /* Optional storage. */ }
}
