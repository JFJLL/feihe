import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Dashboard, Ops } from '../types/project';
import { readSessionCache, writeSessionCache, clearIdentityCache, isActiveCacheIdentity } from '../browser-cache';
import { useCacheIdentity } from '../../components/project-shell/IdentityBoundary';
import type { ProjectBootstrap } from '../project-bootstrap';

export const emptyAnalytics = {
  trend: [],
  sourceDistribution: [],
  scopeDistribution: [],
  statusDistribution: [],
  topics: [],
  brands: [],
  formats: [],
  creatorLevels: [],
  categories: [],
  locations: [],
  dataQuality: {},
  topNotes: [],
};

export const emptyDashboard: Dashboard = {
  pipelines: [],
  metrics: {
    noteCount: 0,
    commentTotal: 0,
    positiveCount: 0,
    positiveRate: 0,
    negativeCount: 0,
    negativeRate: 0,
    questionCount: 0,
    questionRate: 0,
    publishedCount: 0,
    supplier: {},
    actions: {},
  },
  analytics: emptyAnalytics,
  keyComments: [],
  notes: [],
  ads: { totals: {}, accounts: [] },
  syncedAt: '',
};

export const emptyOps: Ops = {
  jobs: [],
  logs: [],
  supplier: [],
  supplierFeatures: [],
  categories: [],
  reviewRules: [],
  reports: [],
  settings: {
    rules: {
      brands: [],
      competitors: [],
      positiveWords: [],
      negativeWords: [],
      questionWords: [],
      sellingWords: [],
      irrelevantWords: [],
      deleteCompetitorMentions: true,
    },
    acceptance: {
      reportCount: 0,
      baseCount: 0,
      brandTopRate: 0,
      targetsConfirmed: false,
      freshnessHours: 24,
      supplierSimilarity: 0.58,
    },
    goals: {
      workTarget: 0,
      workCompleted: 0,
      monthlyTarget: 0,
      quarterlyTarget: 0,
      publishTarget: 0,
      budgetTarget: 0,
      commentTarget: 0,
    },
    growth: {
      watchKeywords: [],
      inspirations: [],
      seedNoteIds: [],
      thresholds: {
        breakoutInteractions: 1000,
        seedScore: 65,
        ctr: 0.15,
        cpuv: 0.7,
      },
    },
  },
};

export const pct = (value: number | string | null | undefined) =>
  (Number(value || 0) * 100).toFixed(1) + '%';

export const cnTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';

export const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

export const num = (value: unknown) => Number(value || 0);

export const compact = (value: unknown) =>
  new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num(value));

export const shown = (v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : String(v);

export const size = (v: unknown) => {
  const n = Number(v || 0);
  return n > 1048576
    ? (n / 1048576).toFixed(1) + ' MB'
    : Math.ceil(n / 1024) + ' KB';
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public data?: Record<string, unknown>) { super(message); this.name = 'ApiError'; }
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  let data: (T & { ok?: boolean; error?: string }) | null = null;
  const rawText = await response.text().catch(() => '');
  try {
    data = JSON.parse(rawText) as T & { ok?: boolean; error?: string };
  } catch {
    if (!response.ok) {
      const isHtml = /^\s*<(!DOCTYPE|html)/i.test(rawText);
      const friendlyMsg = response.status === 504
        ? '网关响应超时 (504)，请稍后重试'
        : response.status === 502
        ? '网关服务暂时不可用 (502)，请稍后重试'
        : `服务响应异常 (HTTP ${response.status})`;
      throw new ApiError(isHtml ? friendlyMsg : `${friendlyMsg}: ${rawText.slice(0, 150) || '无响应体'}`, response.status);
    }
    throw new Error(`数据格式解析异常: ${rawText.slice(0, 150)}`);
  }
  if (response.ok && data?.ok !== false && typeof window !== 'undefined' && options?.method === 'POST' && /^\/api\/(datasets|feishu\/sync)(?:\?|$)/.test(url)) {
    let affectedProject = '';
    try { affectedProject = JSON.parse(String(options.body || '{}')).projectId || ''; } catch {}
    window.dispatchEvent(new CustomEvent('app:datasets-changed', { detail: { projectId: affectedProject } }));
  }
  if (!response.ok || (data && data.ok === false)) {
    if (typeof window !== 'undefined' && [401, 403].includes(response.status) && !(url.startsWith('/api/projects') && options?.method !== 'POST')) {
      let affectedProject = new URL(url, window.location.origin).searchParams.get('projectId') || '';
      try { affectedProject ||= JSON.parse(String(options?.body || '{}')).projectId || ''; } catch {}
      window.dispatchEvent(new CustomEvent('app:permission-response', { detail: { projectId: affectedProject, status: response.status } }));
    }
    throw new ApiError(data?.error || `操作失败 (HTTP ${response.status})`, response.status, data as Record<string, unknown>);
  }
  return data as T;
}

export type ProjectDataFilters = {
  from?: string;
  to?: string;
  source?: string;
};

const projectDataCache = new Map<string, { dashboard: Dashboard; ops: Ops; timestamp: number }>();
const projectCacheStorageKey = (cacheKey: string) => 'project-data:' + cacheKey;
const subscribeCache = () => () => undefined;
const REVALIDATE_AFTER = 2 * 60 * 1000;

export function clearProjectDataCache(identity: string) {
  for (const key of projectDataCache.keys()) if (key.startsWith(identity + '|')) projectDataCache.delete(key);
  clearIdentityCache(identity);
}
function restoredProjectData(cacheKey: string, identity: string) {
  if (!isActiveCacheIdentity(identity) || typeof window === 'undefined') return null;
  const memory = projectDataCache.get(cacheKey);
  if (memory) return memory;
  const stored = readSessionCache<{ dashboard: Dashboard; ops: Ops }>(projectCacheStorageKey(cacheKey), undefined, identity);
  if (!stored?.value?.dashboard || !stored.value.ops) return null;
  const restored = { ...stored.value, timestamp: stored.timestamp };
  projectDataCache.set(cacheKey, restored);
  return restored;
}

export function useProjectData(
  projectId: string,
  filters?: ProjectDataFilters,
  initialData?: ProjectBootstrap | null
) {
  const identity = useCacheIdentity();
  const requestGeneration = useRef(0);
  const from = filters?.from;
  const to = filters?.to;
  const source = filters?.source;
  const cacheKey = identity + '|' + projectId + '_' + (from || '') + '_' + (to || '') + '_' + (source || '');
  const cached = initialData || (identity ? projectDataCache.get(cacheKey) : null);
  const restored = useSyncExternalStore(
    subscribeCache,
    () => restoredProjectData(cacheKey, identity),
    () => null
  );

  const [dashboard, setDashboard] = useState<Dashboard | null>(cached?.dashboard || null);
  const [ops, setOps] = useState<Ops | null>(cached?.ops || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (opts?: { fresh?: boolean; throwOnError?: boolean }) => {
    const generation = ++requestGeneration.current;
    const isFresh = opts?.fresh ?? false;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ projectId });
      const now = Date.now();
      if (isFresh) {
        query.set('fresh', '1');
        query.set('_t', String(now));
      }
      if (from) query.set('from', from);
      if (to) query.set('to', to);
      if (source) query.set('source', source);

      const opsQuery = new URLSearchParams({ projectId });
      if (isFresh) {
        opsQuery.set('fresh', '1');
        opsQuery.set('_t', String(now));
      }
      const opsUrl = '/api/ops?' + opsQuery.toString();
      const fetchOpts: RequestInit = isFresh ? { cache: 'no-store' } : {};

      const [dashRes, opsRes] = await Promise.all([
        api<Dashboard>('/api/dashboard?' + query.toString(), fetchOpts),
        api<Ops>(opsUrl, fetchOpts),
      ]);
      if (generation !== requestGeneration.current || identity && !isActiveCacheIdentity(identity)) return null;
      if (isActiveCacheIdentity(identity)) projectDataCache.set(cacheKey, { dashboard: dashRes, ops: opsRes, timestamp: now });
      writeSessionCache(projectCacheStorageKey(cacheKey), { dashboard: dashRes, ops: opsRes }, now, identity);
      setDashboard(dashRes);
      setOps(opsRes);
      return { dashboard: dashRes, ops: opsRes };
    } catch (err) {
      if (generation !== requestGeneration.current) return null;
      if (err instanceof ApiError && [401, 403].includes(err.status)) { clearProjectDataCache(identity); setDashboard(null); setOps(null); }
      const msg = err instanceof Error ? err.message : '数据加载失败';
      setError(msg);
      if (opts?.throwOnError) {
        throw err;
      }
      return null;
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [projectId, from, to, source, cacheKey, identity]);

  useEffect(() => {
    if (initialData) {
      const { dashboard, ops, timestamp } = initialData;
      if (isActiveCacheIdentity(identity)) projectDataCache.set(cacheKey, { dashboard, ops, timestamp });
      setTimeout(() => {
        writeSessionCache(projectCacheStorageKey(cacheKey), { dashboard, ops }, timestamp, identity);
      }, 60);
    }
    const current = restoredProjectData(cacheKey, identity);
    if (current && Date.now() - current.timestamp < REVALIDATE_AFTER) return;
    const timer = setTimeout(() => {
      void refresh({ fresh: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh, cacheKey, initialData, identity]);
  useEffect(() => () => { requestGeneration.current++; }, [cacheKey]);

  const denied = Boolean(error && !dashboard && !ops);
  const visibleDashboard = dashboard || (!denied ? restored?.dashboard : null) || null;
  const visibleOps = ops || (!denied ? restored?.ops : null) || null;

  return {
    dashboard: visibleDashboard,
    ops: visibleOps,
    loading: loading && !visibleDashboard,
    error,
    refresh: (async (opts?: { fresh?: boolean; throwOnError?: boolean }) => {
      await refresh(opts);
    }),
  };
}
