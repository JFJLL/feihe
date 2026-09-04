const CACHE_PREFIX = 'feihe:v2:';
const DEFAULT_MAX_AGE = 6 * 60 * 60 * 1000;

type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

export function readSessionCache<T>(key: string, maxAge = DEFAULT_MAX_AGE): CacheEntry<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || typeof entry.timestamp !== 'number' || Date.now() - entry.timestamp > maxAge) {
      window.sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(key: string, value: T, timestamp = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, timestamp }));
  } catch {
    // Storage may be disabled or full; the in-memory cache remains available.
  }
}
