export type NavItem = {
  id: string;
  path: string;
  number: string;
  label: string;
  title: string;
  description: string;
  defaultTab?: string;
  inSidebar?: boolean;
};

export const PROJECT_NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    path: '',
    number: '01',
    label: '项目总览',
    title: '项目总览',
    description: '项目经营与全盘进展',
    inSidebar: true,
  },
  {
    id: 'ads',
    path: 'ads',
    number: '02',
    label: '投流分析',
    title: '投流分析',
    description: '信息流分析与搜索分析',
    inSidebar: true,
  },
  {
    id: 'growth',
    path: 'growth',
    number: '02',
    label: '竞品分析',
    title: '竞品分析',
    description: '声量格局、本竞品对比与机会雷达',
    defaultTab: 'competitor',
    inSidebar: true,
  },
  {
    id: 'content',
    path: 'content',
    number: '03',
    label: '内容管理',
    title: '内容管理',
    description: '内容效率、内容台账与发布监测',
    defaultTab: 'analysis',
    inSidebar: true,
  },
  {
    id: 'comments',
    path: 'comments',
    number: '04',
    label: '评论运营',
    title: '评论运营',
    description: '口碑分析、评论采集、处置与供应商核验',
    defaultTab: 'voice',
    inSidebar: true,
  },
  {
    id: 'settings',
    path: 'settings',
    number: '05',
    label: '项目设置',
    title: '项目设置',
    description: '项目资料、目标规则、数据管理、指标、报告与数据地图',
    defaultTab: 'profile',
    inSidebar: true,
  },
  // 以下模块已归入项目设置二级导航，不再平铺在主侧栏，但保留条目以兼容旧路由/深链与校验
  {
    id: 'data',
    path: 'data',
    number: '06',
    label: '数据管理',
    title: '数据管理',
    description: '数据源、数据集与同步配置',
    defaultTab: 'sources',
    inSidebar: false,
  },
  {
    id: 'metrics',
    path: 'metrics',
    number: '07',
    label: '指标',
    title: '项目指标',
    description: '共享计算口径、版本和项目来源',
    inSidebar: false,
  },
  {
    id: 'reports',
    path: 'reports',
    number: '08',
    label: '报告',
    title: '项目报告',
    description: '同口径结果、报告历史与导出',
    inSidebar: false,
  },
];

export const SETTINGS_SECTION_IDS = new Set(['settings', 'data', 'metrics', 'reports']);
export function isSettingsSection(section: string): boolean {
  return SETTINGS_SECTION_IDS.has(section);
}

export const LEGACY_SECTION_REDIRECTS: Record<string, { module: string; tab?: string }> = {
  cockpit: { module: '' },
  overview: { module: '' },
  tasks: { module: '' },
  growth: { module: 'growth', tab: 'competitor' },
  competitor: { module: 'growth', tab: 'competitor' },
  radar: { module: 'growth', tab: 'radar' },
  inspiration: { module: 'growth', tab: 'inspiration' },
  seeds: { module: 'growth', tab: 'radar' },
  seed: { module: 'growth', tab: 'radar' },
  lingxi_track: { module: 'growth', tab: 'radar' },
  content: { module: 'content', tab: 'analysis' },
  analysis: { module: 'content', tab: 'analysis' },
  notes: { module: 'content', tab: 'registry' },
  pool: { module: 'content', tab: 'registry' },
  registry: { module: 'content', tab: 'registry' },
  linkage: { module: 'content', tab: 'publishing' },
  publishing: { module: 'content', tab: 'publishing' },
  performance: { module: 'content', tab: 'monitoring' },
  monitoring: { module: 'content', tab: 'monitoring' },
  collection: { module: 'comments', tab: 'collection' },
  actions: { module: 'comments', tab: 'actions' },
  risk: { module: 'comments', tab: 'actions' },
  review: { module: 'comments', tab: 'actions' },
  acceptance: { module: 'comments', tab: 'acceptance' },
  progress: { module: 'comments', tab: 'acceptance' },
  supplier: { module: 'comments', tab: 'supplier' },
  sentiment: { module: 'comments', tab: 'voice' },
  voice: { module: 'comments', tab: 'voice' },
  insights: { module: 'comments', tab: 'voice' },
  reports: { module: 'reports' },
  report: { module: 'reports' },
  metrics: { module: 'metrics' },
  metric: { module: 'metrics' },
  agent: { module: 'comments', tab: 'voice' },
  ai: { module: 'comments', tab: 'voice' },
  settings: { module: 'settings', tab: 'profile' },
  profile: { module: 'settings', tab: 'profile' },
  rules: { module: 'settings', tab: 'rules' },
  board: { module: 'settings', tab: 'board' },
  'data-sources': { module: 'data', tab: 'sources' },
  sources: { module: 'data', tab: 'sources' },
  integrations: { module: 'settings', tab: 'integrations' },
  tools: { module: 'settings', tab: 'integrations' },
  'data-map': { module: 'settings', tab: 'data-map' },
  map: { module: 'settings', tab: 'data-map' },
  data: { module: 'data' },
};

export function resolveProjectRoute(projectId: string, section?: string, searchParams?: URLSearchParams): string {
  const base = '/projects/' + encodeURIComponent(projectId);
  const cleanSection = section ? section.startsWith('/') ? section.slice(1) : section : '';
  const pathPart = cleanSection ? base + '/' + cleanSection : base;
  const qs = searchParams && searchParams.toString() ? '?' + searchParams.toString() : '';
  return pathPart + qs;
}

export function getLegacyRedirectUrl(projectId: string, section: string, searchParams?: URLSearchParams): string {
  const s = section.toLowerCase();
  const params = new URLSearchParams(searchParams?.toString() || '');
  const tab = params.get('tab');
  if (s === 'insights') {
    if (tab === 'competitor') return resolveProjectRoute(projectId, 'growth', new URLSearchParams({ tab: 'competitor' }));
    if (tab === 'content') return resolveProjectRoute(projectId, 'content', new URLSearchParams({ tab: 'analysis' }));
    return resolveProjectRoute(projectId, 'comments', new URLSearchParams({ tab: 'voice' }));
  }
  const mapping = LEGACY_SECTION_REDIRECTS[s];
  const targetModule = mapping ? mapping.module : '';
  const targetTab = tab || mapping?.tab;
  if (targetTab) params.set('tab', targetTab);
  return resolveProjectRoute(projectId, targetModule, params);
}
