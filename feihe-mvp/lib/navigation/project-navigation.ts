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
    label: '增长机会',
    title: '增长机会',
    description: '机会雷达与灵感选题',
    defaultTab: 'radar',
  },
  {
    id: 'content',
    path: 'content',
    number: '03',
    label: '内容管理',
    title: '内容管理',
    description: '内容台账、发布管理与内容监测',
    defaultTab: 'registry',
  },
  {
    id: 'comments',
    path: 'comments',
    number: '04',
    label: '评论运营',
    title: '评论运营',
    description: '评论采集、处置、验收与供应商核验',
    defaultTab: 'collection',
  },
  {
    id: 'insights',
    path: 'insights',
    number: '05',
    label: '分析报告',
    title: '分析报告',
    description: '口碑、竞品、内容分析、复盘与 AI 报告',
    defaultTab: 'voice',
  },
  {
    id: 'settings',
    path: 'settings',
    number: '06',
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
  growth: { module: 'growth', tab: 'radar' },
  radar: { module: 'growth', tab: 'radar' },
  inspiration: { module: 'growth', tab: 'inspiration' },
  seeds: { module: 'growth', tab: 'radar' },
  seed: { module: 'growth', tab: 'radar' },
  lingxi_track: { module: 'growth', tab: 'radar' },
  content: { module: 'content', tab: 'registry' },
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
  sentiment: { module: 'comments', tab: 'actions' },
  insights: { module: 'insights', tab: 'voice' },
  voice: { module: 'insights', tab: 'voice' },
  competitor: { module: 'insights', tab: 'competitor' },
  reports: { module: 'insights', tab: 'report' },
  report: { module: 'insights', tab: 'report' },
  agent: { module: 'insights', tab: 'ai' },
  ai: { module: 'insights', tab: 'ai' },
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
  const mapping = LEGACY_SECTION_REDIRECTS[section.toLowerCase()];
  const targetModule = mapping ? mapping.module : '';
  const params = new URLSearchParams(searchParams?.toString() || '');
  const tab = params.get('tab') || mapping?.tab;
  if (tab) params.set('tab', tab);
  return resolveProjectRoute(projectId, targetModule, params);
}
