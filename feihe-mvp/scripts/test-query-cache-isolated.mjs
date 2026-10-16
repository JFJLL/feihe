import assert from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

// Setup browser-like globals in Node for the test
const mockSessionStore = new Map();
globalThis.window = {
  location: { origin: 'http://localhost' },
  dispatchEvent: () => true,
};
globalThis.sessionStorage = {
  getItem: (k) => mockSessionStore.get(k) || null,
  setItem: (k, v) => mockSessionStore.set(k, String(v)),
  removeItem: (k) => mockSessionStore.delete(k),
  keys: () => mockSessionStore.keys(),
};
globalThis.DOMException = class DOMException extends Error {
  constructor(message, name) {
    super(message);
    this.name = name;
  }
};

function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Mock fetch router for realistic deferred testing of fetchWithCache
const fetchMockRoutes = new Map();
globalThis.fetch = async (url, options) => {
  const urlStr = String(url);
  for (const [pattern, handler] of fetchMockRoutes.entries()) {
    if (urlStr.includes(pattern)) {
      return handler(urlStr, options);
    }
  }
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: true, defaultMock: true }),
  };
};

// Self-bundle query-cache to OS temp via esbuild (no untracked bundles or machine-path dependency)
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const entryFile = path.resolve(currentDir, '../lib/cache/query-cache.ts');
const tempBundle = path.join(os.tmpdir(), `query-cache-bundle-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);

await esbuild.build({
  entryPoints: [entryFile],
  outfile: tempBundle,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
});

let cacheModule;
try {
  cacheModule = await import(pathToFileURL(tempBundle).href);
} finally {
  try {
    fs.unlinkSync(tempBundle);
  } catch {}
}
const {
  buildNormalizedUrl,
  buildCacheKey,
  getCachedQuery,
  setCachedQuery,
  fetchWithCache,
  invalidateQueryCache,
  clearQueryCacheForIdentity,
  activateCacheIdentity,
  isActiveCacheIdentity,
  getKeyEpoch,
  getScopeEpoch,
  getIdentityEpoch,
} = cacheModule;

console.log('🧪 Starting Rigorous Race-Condition & Epoch Tests for QueryCache...');

// Establish active authenticated session
activateCacheIdentity('user-test');
assert.strictEqual(isActiveCacheIdentity('user-test'), true, 'Session active');

// =========================================================================
// Test 1: URL Normalization & Key Determinism
// =========================================================================
console.log('\n--- Test 1: URL Normalization & Key Determinism ---');
const u1 = buildNormalizedUrl('/api/reports', { page: 1, projectId: 'qicui', sort: 'desc' });
const u2 = buildNormalizedUrl('/api/reports?sort=desc', { projectId: 'qicui', page: '1' });
assert.strictEqual(u1, u2, 'URL normalization must sort query params deterministically');

const kQicui = buildCacheKey('userA', 'qicui', u1);
const kBrandB = buildCacheKey('userA', 'brand-b', u1);
assert.notStrictEqual(kQicui, kBrandB, 'Projects must have strictly separate cache keys');

// =========================================================================
// Test 2: Deferred fetchWithCache: Invalidate mid-flight -> Old A late arrival must NOT resurrect
// =========================================================================
console.log('\n--- Test 2: Invalidate mid-flight -> Old A late arrival must NOT resurrect ---');
const defA = createDeferred();
fetchMockRoutes.set('/api/test-deferred-a', async () => {
  const data = await defA.promise;
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: true, ...data }),
  };
});

const cacheKeyA = buildCacheKey('user-test', 'qicui', buildNormalizedUrl('/api/test-deferred-a', { projectId: 'qicui' }));

// Launch real fetchWithCache
console.log('Action: Initiating fetchWithCache for A...');
const promiseA = fetchWithCache('/api/test-deferred-a', {
  identity: 'user-test',
  projectId: 'qicui',
  params: { projectId: 'qicui' },
});

// While A is in-flight, trigger cache invalidation
console.log('Action: Invalidate query cache while fetch A is pending...');
invalidateQueryCache({ projectId: 'qicui', endpoint: '/api/test-deferred-a' });

// Now resolve Deferred A with stale data
console.log('Action: Deferred A resolves late with stale data...');
defA.resolve({ reportId: 'stale-A', timestamp: 100 });
await promiseA;

const cachedAfterLateA = getCachedQuery(cacheKeyA, 'user-test');
console.log('Cache state after late A:', cachedAfterLateA);
assert.strictEqual(cachedAfterLateA, null, 'Stale A MUST NOT resurrect in cache after invalidation!');

// =========================================================================
// Test 3: Race: Invalidate -> Fresh B -> Old A arrives later (B must be preserved)
// =========================================================================
console.log('\n--- Test 3: Invalidate -> Fresh B -> Old A arrives later (B must be preserved) ---');
const defOldA = createDeferred();
const defFreshB = createDeferred();

let fetchCallCount = 0;
fetchMockRoutes.set('/api/test-compete-ab', async () => {
  fetchCallCount++;
  if (fetchCallCount === 1) {
    // First call: Old A
    const data = await defOldA.promise;
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, ...data }) };
  } else {
    // Second call: Fresh B
    const data = await defFreshB.promise;
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, ...data }) };
  }
});

const compKey = buildCacheKey('user-test', 'qicui', buildNormalizedUrl('/api/test-compete-ab', { projectId: 'qicui' }));

// 1. Start Old A
console.log('Action: Initiating Old A fetchWithCache...');
const pOldA = fetchWithCache('/api/test-compete-ab', {
  identity: 'user-test',
  projectId: 'qicui',
  params: { projectId: 'qicui' },
  fresh: true,
});

// 2. Invalidate mid-flight while A is waiting
console.log('Action: Invalidate query cache while Old A is in flight...');
invalidateQueryCache({ projectId: 'qicui', endpoint: '/api/test-compete-ab' });

// 3. Start Fresh B after invalidation for the EXACT SAME KEY
console.log('Action: Initiating Fresh B fetchWithCache for same key...');
const pFreshB = fetchWithCache('/api/test-compete-ab', {
  identity: 'user-test',
  projectId: 'qicui',
  params: { projectId: 'qicui' },
  fresh: true,
});

// 4. Fresh B resolves first
console.log('Action: Fresh B resolves first with version B-FRESH...');
defFreshB.resolve({ version: 'B-FRESH', count: 42 });
const resB = await pFreshB;
assert.strictEqual(resB.version, 'B-FRESH');

const cachedValB = getCachedQuery(compKey, 'user-test');
console.log('Cache state after Fresh B:', cachedValB?.data);
assert.strictEqual(cachedValB?.data?.version, 'B-FRESH', 'Fresh B is in cache');

// 5. Old A resolves later with stale data
console.log('Action: Old A resolves LATER with version A-STALE...');
defOldA.resolve({ version: 'A-STALE', count: 0 });
await pOldA;

const cachedFinal = getCachedQuery(compKey, 'user-test');
console.log('Final cache state after Old A completed:', cachedFinal?.data);
assert.strictEqual(cachedFinal?.data?.version, 'B-FRESH', 'Old A MUST NOT overwrite Fresh B in cache!');

// =========================================================================
// Test 4: Identity Logout / 401 / 403 Revocation Race
// =========================================================================
console.log('\n--- Test 4: Identity Revocation Race (Logout / 401 / 403) ---');
activateCacheIdentity('user-private');
const defSensitive = createDeferred();
fetchMockRoutes.set('/api/confidential-data', async () => {
  const data = await defSensitive.promise;
  return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, ...data }) };
});

const sensKey = buildCacheKey('user-private', 'qicui', buildNormalizedUrl('/api/confidential-data', { projectId: 'qicui' }));

const sensFetch = fetchWithCache('/api/confidential-data', {
  identity: 'user-private',
  projectId: 'qicui',
  params: { projectId: 'qicui' },
});

// User logs out / 401 received while fetch was in flight
console.log('Action: Identity cleared mid-flight (logout/401)...');
clearQueryCacheForIdentity('user-private');
activateCacheIdentity(null);

// Fetch returns late
console.log('Action: Confidential data resolves late...');
defSensitive.resolve({ salary: 999999 });
await sensFetch;

const sensCached = getCachedQuery(sensKey, 'user-private');
console.log('Sensitive cache state after late arrival:', sensCached);
assert.strictEqual(sensCached, null, 'Private data must NOT resurrect in cache after identity clear!');

// =========================================================================
// Test 5: Two Consumers Concurrency & Abort Independence
// =========================================================================
console.log('\n--- Test 5: Two Consumers - Consumer 1 Abort must NOT cancel Consumer 2 ---');
activateCacheIdentity('user-test');
const defShared = createDeferred();
let networkFetchCount = 0;

fetchMockRoutes.set('/api/shared-concurrency', async () => {
  networkFetchCount++;
  const data = await defShared.promise;
  return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, ...data }) };
});

const controller1 = new AbortController();
const controller2 = new AbortController();

// Consumer 1 calls fetchWithCache
const c1Promise = fetchWithCache('/api/shared-concurrency', {
  identity: 'user-test',
  projectId: 'qicui',
  params: { projectId: 'qicui' },
  signal: controller1.signal,
});

// Consumer 2 calls fetchWithCache concurrently for same endpoint
const c2Promise = fetchWithCache('/api/shared-concurrency', {
  identity: 'user-test',
  projectId: 'qicui',
  params: { projectId: 'qicui' },
  signal: controller2.signal,
});

// Consumer 1 aborts early!
console.log('Action: Consumer 1 aborts its signal...');
controller1.abort();

let c1Error = null;
try {
  await c1Promise;
} catch (e) {
  c1Error = e;
}
assert.strictEqual(c1Error?.name, 'AbortError', 'Consumer 1 receives AbortError');

// Shared fetch resolves now
console.log('Action: Shared fetch resolves data for remaining Consumer 2...');
defShared.resolve({ sharedPayload: 42 });

const c2Result = await c2Promise;
assert.strictEqual(c2Result?.sharedPayload, 42, 'Consumer 2 successfully receives data!');
assert.strictEqual(networkFetchCount, 1, 'Only ONE shared network fetch was dispatched for both consumers');

console.log('\n🎉 ALL 5 RIGOROUS RACE-CONDITION & CONCURRENCY TESTS PASSED!');

// =========================================================================
// Test 6: In-memory & SessionStorage TTL expiration boundary
// =========================================================================
console.log('\n--- Test 6: In-memory & SessionStorage TTL Expiration Boundary ---');
const ttlKey = buildCacheKey('user-test', 'qicui', '/api/test-ttl-boundary');
setCachedQuery(ttlKey, { greeting: 'hello' }, { identity: 'user-test', projectId: 'qicui', ttl: 40 });

const immediate = getCachedQuery(ttlKey, 'user-test');
assert.strictEqual(immediate?.data?.greeting, 'hello', 'Immediate read before TTL must succeed');
assert.strictEqual(immediate?.isStale, false, 'Fresh entry is not stale');

// Wait for TTL expiration
await new Promise((r) => setTimeout(r, 60));
const expired = getCachedQuery(ttlKey, 'user-test');
assert.strictEqual(expired, null, 'Expired entry past TTL must return null and be purged');

// =========================================================================
// Test 7: Null & Undefined Rejection (Poison Cache Prevention)
// =========================================================================
console.log('\n--- Test 7: Null & Undefined Rejection Boundary ---');
const nullKey = buildCacheKey('user-test', 'qicui', '/api/test-null-data');
setCachedQuery(nullKey, null, { identity: 'user-test', projectId: 'qicui' });
assert.strictEqual(getCachedQuery(nullKey, 'user-test'), null, 'Null must never be stored in cache');

setCachedQuery(nullKey, undefined, { identity: 'user-test', projectId: 'qicui' });
assert.strictEqual(getCachedQuery(nullKey, 'user-test'), null, 'Undefined must never be stored in cache');

// =========================================================================
// Test 8: Project Scope Invalidation Isolation Boundary
// =========================================================================
console.log('\n--- Test 8: Project Scope Invalidation Isolation Boundary ---');
const keyAlpha = buildCacheKey('user-test', 'project-alpha', '/api/reports?page=1');
const keyBeta = buildCacheKey('user-test', 'project-beta', '/api/reports?page=1');

setCachedQuery(keyAlpha, { name: 'Alpha Reports' }, { identity: 'user-test', projectId: 'project-alpha' });
setCachedQuery(keyBeta, { name: 'Beta Reports' }, { identity: 'user-test', projectId: 'project-beta' });

assert.strictEqual(getCachedQuery(keyAlpha, 'user-test')?.data?.name, 'Alpha Reports');
assert.strictEqual(getCachedQuery(keyBeta, 'user-test')?.data?.name, 'Beta Reports');

// Invalidate only project-alpha
invalidateQueryCache({ projectId: 'project-alpha', endpoint: '/api/reports' });

assert.strictEqual(getCachedQuery(keyAlpha, 'user-test'), null, 'project-alpha cache must be evicted');
assert.strictEqual(getCachedQuery(keyBeta, 'user-test')?.data?.name, 'Beta Reports', 'project-beta cache must remain intact');

// =========================================================================
// Test 9: StaleTime Hit vs Fresh Bypass Boundary
// =========================================================================
console.log('\n--- Test 9: StaleTime Hit vs Fresh Bypass Boundary ---');
let networkHits = 0;
fetchMockRoutes.set('/api/test-stale-fresh', async () => {
  networkHits++;
  return { ok: true, status: 200, text: async () => JSON.stringify({ hit: networkHits }) };
});

const stale1 = await fetchWithCache('/api/test-stale-fresh', {
  identity: 'user-test', projectId: 'qicui', staleTime: 60000,
});
assert.strictEqual(stale1.hit, 1, 'First fetch hits network');

const stale2 = await fetchWithCache('/api/test-stale-fresh', {
  identity: 'user-test', projectId: 'qicui', staleTime: 60000,
});
assert.strictEqual(stale2.hit, 1, 'Second fetch within staleTime reuses cache, networkHits remains 1');
assert.strictEqual(networkHits, 1, 'No additional network call made');

const fresh3 = await fetchWithCache('/api/test-stale-fresh', {
  identity: 'user-test', projectId: 'qicui', staleTime: 60000, fresh: true,
});
assert.strictEqual(fresh3.hit, 2, 'fresh: true explicitly bypasses cache and hits network');
assert.strictEqual(networkHits, 2, 'Network hit incremented to 2');

console.log('🎉 ALL 4 BOUNDARY REGRESSION TESTS (6-9) PASSED!');
