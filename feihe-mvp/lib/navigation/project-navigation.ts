export type NavItem = {
  id: string;
  path: string;
  number: string;
  label: string;
  title: string;
  description: string;
  defaultTab?: string;
};

export const PROJECT_NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    path: '',
    number: '01',
    label: '项目总览',
    title: '项目总览',
    description: '项目经营与全盘进展',
  },
  {
    id: 'growth',
    path: 'growth',
    number: '02',
    label: '竞品分析',
    title: '竞品分析',
    description: '声量格局、本竞品对比与机会雷达',
    defaultTab: 'competitor',
  },
  {
    id: 'content',
    path: 'content',
    number: '03',
    label: '内容管理',
    title: '内容管理',
    description: '内容效率、内容台账与发布监测',
    defaultTab: 'analysis',
  },
  {
    id: 'comments',
    path: 'comments',
    number: '04',
    label: '评论运营',
    title: '评论运营',
    description: '口碑分析、评论采集、处置与供应商核验',
    defaultTab: 'voice',
  },
  {
    id: 'settings',
    path: 'settings',
    number: '05',
    label: '项目设置',
    title: '项目设置',
    description: '项目资料、目标规则、数据源与数据地图',
    defaultTab: 'profile',
  },
];

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
  reports: { module: 'comments', tab: 'voice' },
  report: { module: 'comments', tab: 'voice' },
  agent: { module: 'comments', tab: 'voice' },
  ai: { module: 'comments', tab: 'voice' },
  settings: { module: 'settings', tab: 'profile' },
  profile: { module: 'settings', tab: 'profile' },
  rules: { module: 'settings', tab: 'rules' },
  'data-sources': { module: 'settings', tab: 'data-sources' },
  sources: { module: 'settings', tab: 'data-sources' },
  integrations: { module: 'settings', tab: 'integrations' },
  tools: { module: 'settings', tab: 'integrations' },
  'data-map': { module: 'settings', tab: 'data-map' },
  map: { module: 'settings', tab: 'data-map' },
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
