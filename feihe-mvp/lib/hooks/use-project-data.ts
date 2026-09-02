import { useCallback, useEffect, useState } from 'react';
import type { Dashboard, Ops, Workspace, Project } from '../types/project';

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
      brands: ['飞鹤', '启萃', '卓睿'],
      competitors: ['爱他美', '合生元', '派星', 'A2', '至初', '美素', '金领冠'],
      positiveWords: ['好吸收', '长肉', '适应', '抵抗力'],
      negativeWords: ['不好', '过敏', '便秘', '胀气', '吐奶'],
      questionWords: ['吗', '怎么', '多少'],
      sellingWords: ['出售', '加微'],
      irrelevantWords: ['互赞', '打卡'],
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

export const fallbackProject: Project = {
  id: 'qicui',
  name: '启萃评论与声量项目',
  spu: '启萃',
  brand: '飞鹤',
  category: '婴幼儿奶粉',
  description: '评论执行、口碑舆情与本竞品监测',
  status: '进行中',
  color: '#1769d5',
  updatedAt: '',
  noteCount: 0,
  reportableCount: 0,
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
  const data = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || '操作失败');
  }
  return data as T;
}

export function useProjectData(projectId: string, initialFrom?: string, initialTo?: string) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [ops, setOps] = useState<Ops | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [from, setFrom] = useState(initialFrom || daysAgo(90));
  const [to, setTo] = useState(initialTo || new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ from, to, projectId });
      if (source) query.set('source', source);
      const [dashRes, opsRes, projRes] = await Promise.all([
        api<Dashboard>('/api/dashboard?' + query.toString()),
        api<Ops>('/api/ops?projectId=' + encodeURIComponent(projectId)),
        api<Workspace>('/api/projects'),
      ]);
      setDashboard(dashRes);
      setOps(opsRes);
      setWorkspace(projRes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '数据加载失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId, from, to, source]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const currentProject =
    workspace?.projects.find((p) => p.id === projectId) || fallbackProject;

  return {
    dashboard,
    ops,
    workspace,
    currentProject,
    loading,
    error,
    toast,
    setToast,
    from,
    setFrom,
    to,
    setTo,
    source,
    setSource,
    refresh,
  };
}
