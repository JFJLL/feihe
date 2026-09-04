export type Row = Record<string, unknown>;

export type Project = {
  id: string;
  name: string;
  spu: string;
  brand: string;
  category: string;
  description: string;
  status: string;
  color: string;
  startAt?: string;
  endAt?: string;
  updatedAt: string;
  noteCount: number;
  reportableCount: number;
};

export type Pipeline = {
  id: string;
  name: string;
  targetCount: number;
  deliveredCount: number;
  budget: number;
  spent: number;
};

export type KeyComment = {
  id: string;
  noteId: string;
  content: string;
  author: string;
  sentiment: string;
  category: string;
  action: string;
  treatmentStatus: string;
  treatmentMethod?: string;
  lastSeenAt: string;
  disappearedAt?: string;
  replyCount: number;
};

export type Note = {
  id: string;
  url: string;
  author: string;
  title: string;
  sourceType: string;
  pipeline: string;
  level: string;
  productScope: string;
  publishedAt?: string;
  lastFetchedAt?: string;
  commentTotal: number;
  positiveCount: number;
  negativeCount: number;
  questionCount: number;
  brandMentionTop5: number;
  status: string;
  coverUrl?: string;
  category1?: string;
  category2?: string;
  cooperation?: number;
  promoted?: number;
  noteType?: string;
  notePrice?: number;
  exposure?: number;
  readCount?: number;
  interactionCount?: number;
  likeCount?: number;
  favoriteCount?: number;
  shareCount?: number;
  fansCount?: number;
  creatorLevel?: string;
  province?: string;
  city?: string;
  gender?: string;
  brand?: string;
  cpm?: number;
  cpr?: number;
  cpe?: number;
  engagementRate?: number;
};

export type AnalyticRow = Record<string, string | number | null>;

export type Analytics = {
  trend: AnalyticRow[];
  sourceDistribution: AnalyticRow[];
  scopeDistribution: AnalyticRow[];
  statusDistribution: AnalyticRow[];
  topics: AnalyticRow[];
  brands: AnalyticRow[];
  formats: AnalyticRow[];
  creatorLevels: AnalyticRow[];
  categories: AnalyticRow[];
  locations: AnalyticRow[];
  dataQuality: AnalyticRow;
  topNotes: AnalyticRow[];
};

export type AdsAccount = {
  account: string;
  brand: string;
  metricDate: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  interactions: number;
  balance: number;
};

export type AdsTotals = {
  accounts?: number;
  spend?: number;
  impressions?: number;
  clicks?: number;
  interactions?: number;
  ctr?: number;
};

export type Ads = {
  totals: AdsTotals;
  accounts: AdsAccount[];
};

export type DashboardMetrics = {
  noteCount: number;
  commentTotal: number;
  positiveCount: number;
  positiveRate: number;
  negativeCount: number;
  negativeRate: number;
  questionCount: number;
  questionRate: number;
  neutralCount?: number;
  exposure?: number;
  readCount?: number;
  interactionCount?: number;
  creatorCost?: number;
  promotedCount?: number;
  commercialCount?: number;
  publishedCount?: number;
  engagementRate?: number;
  cpm?: number;
  cpr?: number;
  cpe?: number;
  supplier: Record<string, number>;
  actions: Record<string, number>;
};

export type DailyMetricRow = {
  date: string;
  plan_spend: number;
  actual_spend: number;
  achieve_pct: number;
  feed_spend: number;
  feed_ctr: number;
  search_spend: number;
  search_ctr: number;
  xhm_cpuv: number;
  xhx_cpuv: number;
  notes_today: number;
  comments_today: number;
  impressions?: number;
  clicks?: number;
  interactions?: number;
};

export type Dashboard = {
  projectId?: string;
  pipelines: Pipeline[];
  metrics: DashboardMetrics;
  analytics: Analytics;
  keyComments: KeyComment[];
  notes: Note[];
  ads?: Ads;
  dailyMetrics?: DailyMetricRow[];
  syncedAt: string;
};

export type Job = {
  id: string;
  type: string;
  title: string;
  status: string;
  progress: number;
  total: number;
  succeeded: number;
  failed: number;
  message: string;
  createdAt: string;
  finishedAt?: string;
};

export type SupplierRow = {
  id: number;
  noteId: string;
  noteUrl: string;
  creator: string;
  plannedContent: string;
  commentFormat: string;
  visibility: string;
  matchedContent?: string;
  verifiedAt?: string;
};

export type Feature = {
  visibility: string;
  count: number;
  avgLength: number;
  commaRate: number;
  detailRate: number;
};

export type ReviewRule = {
  id: string;
  name: string;
  keywords: string;
  sentiment: string;
  category: string;
  action: string;
  priority: number;
  enabled: number;
  updatedAt: string;
};

export type SavedReport = {
  id: string;
  title: string;
  periodStart?: string;
  periodEnd?: string;
  status: string;
  summaryJson: string;
  createdAt: string;
  updatedAt: string;
};

export type Rules = {
  brands: string[];
  competitors: string[];
  positiveWords: string[];
  negativeWords: string[];
  questionWords?: string[];
  sellingWords?: string[];
  irrelevantWords?: string[];
  deleteCompetitorMentions?: boolean;
};

export type Acceptance = {
  reportCount: number;
  baseCount: number;
  brandTopRate: number;
  freshnessHours?: number;
  supplierSimilarity?: number;
};

export type Goals = {
  workTarget: number;
  workCompleted: number;
  publishTarget: number;
  budgetTarget: number;
  commentTarget: number;
};

export type GrowthKeyword = {
  id: string;
  keyword: string;
  scope: string;
  source: string;
  status: string;
  priority: number;
};

export type GrowthInspiration = {
  id: string;
  title: string;
  keyword: string;
  stage: string;
  reason: string;
  sourceNoteId?: string;
  sourceType: string;
  owner?: string;
};

export type GrowthSettings = {
  watchKeywords: GrowthKeyword[];
  inspirations: GrowthInspiration[];
  seedNoteIds: string[];
  thresholds: {
    breakoutInteractions: number;
    seedScore: number;
    ctr: number;
    cpuv: number;
  };
};

export type Ops = {
  jobs: Job[];
  logs: Array<{
    id: number;
    action: string;
    targetType: string;
    targetId: string;
    detail: string;
    createdAt: string;
  }>;
  supplier: SupplierRow[];
  supplierFeatures: Feature[];
  categories: Array<{ category: string; sentiment: string; count: number }>;
  reviewRules: ReviewRule[];
  reports: SavedReport[];
  settings: {
    rules: Rules;
    acceptance: Acceptance;
    goals: Goals;
    growth: GrowthSettings;
  };
};

export type NoteDetail = {
  note?: Note;
  snapshots: Array<{
    capturedAt: string;
    l1Count: number;
    l2Count: number;
    totalCount: number;
    positiveCount: number;
    negativeCount: number;
    questionCount: number;
  }>;
  comments: KeyComment[];
};

export type DataSource = {
  id: string;
  projectId: string;
  type: string;
  name: string;
  spreadsheet: string;
  sheetId: string;
  range: string;
  kind: 'owned' | 'supplier';
  syncFrequency: string;
  status: string;
  lastSyncedAt?: string;
  lastRowCount: number;
  mappingJson?: string;
  lastError?: string;
  updatedAt?: string;
};

export type Source = {
  id: string;
  projectId: string;
  type: string;
  name: string;
  spreadsheet: string;
  sheetId: string;
  range: string;
  kind: string;
  syncFrequency: string;
  status: string;
  lastSyncedAt?: string;
  lastRowCount: number;
  mappingJson: string;
  lastError: string;
};

export type Integration = {
  id: string;
  projectId: string;
  provider: string;
  name: string;
  baseUrl: string;
  enabled: number | boolean;
  configJson: string;
  status: string;
  lastTestedAt?: string;
  lastError: string;
};

export type Workspace = {
  projects: Project[];
  sources: Source[];
};

export type IntegrationData = {
  integrations: Integration[];
  credentialStatus: {
    redtrend: boolean;
    oss: boolean;
    feishu: boolean;
    keystone: boolean;
  };
};

export type Keystone = {
  configured: boolean;
  status: string;
  models: string[];
  textModels: string[];
  imageModels: string[];
  textModel: string;
  imageModel: string;
  baseUrl: string;
  error?: string;
};

export type MapData = {
  accounts: Row[];
  endpoints: Row[];
  metrics: Row[];
  bindings: Row[];
  sources: Row[];
  integrations: Row[];
  runs: Row[];
  reports: Row[];
  assets: Row[];
  keystone: Keystone;
};

export type Plan = {
  intent: string;
  period: { start: string; end: string };
  requestedMetrics: string[];
  requestedDimensions: string[];
  sources: Row[];
  endpoints: Row[];
  warnings: string[];
  steps: Array<{ name: string; detail: string }>;
};

export type Spec = {
  title: string;
  subtitle: string;
  period: { start: string; end: string };
  engine: string;
  summary: string[];
  kpis: Array<{
    key: string;
    label: string;
    value: string | number;
    unit?: string;
    note?: string;
    tone?: string;
  }>;
  sections: Array<{
    id: string;
    title: string;
    eyebrow: string;
    kind: string;
    description?: string;
    data: Row[];
  }>;
  sources: Array<{
    name: string;
    type: string;
    freshness: string;
    rows: number;
  }>;
  quality: Array<{ label: string; value: number; status: string }>;
};


