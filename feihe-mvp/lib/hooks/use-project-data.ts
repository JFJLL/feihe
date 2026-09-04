import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { Dashboard, Ops } from '../types/project';
import { readSessionCache, writeSessionCache } from '../browser-cache';

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
      reportCount: 200,
      baseCount: 30,
      brandTopRate: 0.4,
      freshnessHours: 24,
      supplierSimilarity: 0.58,
    },
    goals: {
      workTarget: 0,
      workCompleted: 0,
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
      throw new Error(`服务响应异常 (HTTP ${response.status}): ${rawText.slice(0, 150) || '无响应体'}`);
    }
    throw new Error(`数据格式解析异常: ${rawText.slice(0, 150)}`);
  }
  if (!response.ok || (data && data.ok === false)) {
    throw new Error(data?.error || `操作失败 (HTTP ${response.status})`);
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

function restoredProjectData(cacheKey: string) {
  const memory = projectDataCache.get(cacheKey);
  if (memory) return memory;
  const stored = readSessionCache<{ dashboard: Dashboard; ops: Ops }>(projectCacheStorageKey(cacheKey));
  if (!stored?.value?.dashboard || !stored.value.ops) return null;
  const restored = { ...stored.value, timestamp: stored.timestamp };
  projectDataCache.set(cacheKey, restored);
  return restored;
}

export function useProjectData(
  projectId: string,
  filters?: ProjectDataFilters
) {
  const from = filters?.from;
  const to = filters?.to;
  const source = filters?.source;
  const cacheKey = projectId + '_' + (from || '') + '_' + (to || '') + '_' + (source || '');
  const cached = projectDataCache.get(cacheKey);
  const restored = useSyncExternalStore(
    subscribeCache,
    () => restoredProjectData(cacheKey),
    () => null
  );

  const [dashboard, setDashboard] = useState<Dashboard | null>(cached?.dashboard || null);
  const [ops, setOps] = useState<Ops | null>(cached?.ops || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ projectId });
      if (from) query.set('from', from);
      if (to) query.set('to', to);
      if (source) query.set('source', source);
      const [dashRes, opsRes] = await Promise.all([
        api<Dashboard>('/api/dashboard?' + query.toString()),
        api<Ops>('/api/ops?projectId=' + encodeURIComponent(projectId)),
      ]);
      const timestamp = Date.now();
      projectDataCache.set(cacheKey, { dashboard: dashRes, ops: opsRes, timestamp });
      writeSessionCache(projectCacheStorageKey(cacheKey), { dashboard: dashRes, ops: opsRes }, timestamp);
      setDashboard(dashRes);
      setOps(opsRes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '数据加载失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId, from, to, source, cacheKey]);

  useEffect(() => {
    const current = restoredProjectData(cacheKey);
    if (current && Date.now() - current.timestamp < REVALIDATE_AFTER) return;
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh, cacheKey]);

  const visibleDashboard = dashboard || restored?.dashboard || null;
  const visibleOps = ops || restored?.ops || null;

  return {
    dashboard: visibleDashboard,
    ops: visibleOps,
    loading: loading && !visibleDashboard,
    error,
    refresh,
  };
}


