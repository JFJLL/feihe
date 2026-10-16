export type DuplicateStatus = 'unique' | 'confirmed_dup' | 'suspected_dup';

export type ContentNature = 'commercial' | 'natural' | 'unknown';

export type CreatorTier = 'top' | 'waist' | 'junior' | 'amateur' | 'unknown';

export type SentimentTendency = 'positive' | 'negative' | 'neutral' | 'question';

export interface ConsumerIssue {
  category: 'digestive' | 'taste' | 'mixability' | 'service' | 'safety' | 'general';
  keyword: string;
  excerpt: string;
  confidence: number;
}

export interface BrandRuleMapping {
  brand: string;
  aliases: string[];
  productLines: { line: string; keywords: string[] }[];
}

export interface KeywordSyncCheckpoint {
  keyword: string;
  windowFrom?: string | null;
  windowTo?: string | null;
  windowType?: 'pubTime' | 'insertTime' | 'all';
  pageCursor: number; // 当前已提交/已成功抓取的页码
  rowsRead: number;
  rowsImported: number;
  duplicatesFound: number;
  suspectedDupsFound: number;
  upstreamTotalCount: number;
  coverageComplete: boolean; // 稳定排序未证实前，分页未达末尾或窗口超限均保守标 false
  lastSuccessAt?: string | null;
  lastError?: string | null;
}

export interface CompetitorConfig {
  projectId: string;
  taskId: string; // 必须明确绑定，禁止为空；新项目默认空字符串
  keywords: string[];
  brandRules: BrandRuleMapping[];
  syncCheckpoints: Record<string, KeywordSyncCheckpoint>;
  lastSyncedAt?: string | null;
  syncStatus: 'idle' | 'running' | 'error' | 'paused';
  lastError?: string | null;
  overlapWindowDays: number;
  rateLimitMs: number;
  maxPagesPerRun: number;
  pageSize: number;
  isConfigured: boolean;
  updatedAt: string;
}

export interface RawIpscgRecord {
  auth?: string | null;
  avatar?: string | null;
  collectedCount?: number | null;
  commentCount?: number | null;
  constellation?: string | null;
  content?: string | null;
  gender?: string | null;
  imageList?: string | null;
  insertTime?: string | null;
  ipLocation?: string | null;
  keyword?: string | null;
  lastUpdateTime?: string | null;
  likedCount?: number | null;
  nickname?: string | null;
  noteId: string;
  noteUrl?: string | null;
  pubTime?: string | null;
  redId?: string | null;
  shareCount?: number | null;
  shareUrl?: string | null;
  tagList?: string | null;
  title?: string | null;
  type?: string | null;
  userDesc?: string | null;
  userId?: string | null;
  userIpLocation?: string | null;
  userTagList?: string | null;
  videoUrl?: string | null;
}

export interface RawIpscgApiResponse {
  count?: number;
  yimeiCommonAppList?: RawIpscgRecord[];
  code?: number;
  message?: string;
  [key: string]: unknown;
}

export interface CompetitorNote {
  id: string; // ${projectId}:
  projectId: string;
  taskId: string;
  rawNoteId: string;
  idHexLength: number; // 24 or 32
  title: string;
  content: string;
  authorName: string;
  authorId: string;
  avatarUrl: string;
  pubTime: string;
  insertTime: string;
  lastUpdateTime: string;
  asofDate: string; // YYYY-MM-DD
  collectionDate: string; // YYYY-MM-DD
  keywordHit: string;
  brandAttributed: string;
  productLine: string;
  contentType: string;
  contentNature: ContentNature;
  natureEvidence: string;
  creatorTier: CreatorTier;
  likedCount: number;
  commentCount: number;
  collectedCount: number;
  shareCount: number;
  interactionTotal: number;
  noteUrl: string;
  videoUrl: string;
  tags: string[];
  rawPayload: Record<string, unknown>;
  duplicateStatus: DuplicateStatus;
  suspectedDupTarget?: string | null;
  consumerIssues: ConsumerIssue[];
  sentimentTendency: SentimentTendency;
  dataQuality: 'complete' | 'partial' | 'degraded';
  createdAt: string;
  updatedAt: string;
}

export interface CompetitorSyncOptions {
  taskId?: string; // 若传入，必须与项目绑定的 taskId 一致，否则拒绝
  keywords?: string[];
  from?: string; // 窗口起始，格式 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss
  to?: string; // 窗口截止
  windowType?: 'pubTime' | 'insertTime' | 'all'; // 筛选发布时间(beginTime/endTime)还是采集时间(insertbBeginTime/insertEndTime)
  maxPagesPerRun?: number;
  pageSize?: number;
  overlapWindowDays?: number;
  rateLimitMs?: number;
  dryRun?: boolean;
  signal?: AbortSignal;
}

export interface CompetitorSyncResult {
  success: boolean;
  projectId: string;
  taskId: string;
  keywords: string[];
  pagesFetched: number;
  rowsRead: number;
  rowsImported: number;
  rowsUpdated: number;
  duplicatesDetected: number;
  suspectedDuplicates: number;
  coverageComplete: boolean;
  checkpoints: Record<string, KeywordSyncCheckpoint>;
  watermarkAdvanced: boolean;
  error?: string | null;
  durationMs: number;
}

export interface CompetitorSyncSpec {
  type: 'competitor_ipscg';
  projectId: string;
  taskId: string;
  keywords: string[];
  from?: string;
  to?: string;
  windowType?: 'pubTime' | 'insertTime' | 'all';
  pageSize: number;
  maxPagesPerRun: number;
  overlapWindowDays: number;
  rateLimitMs: number;
}

export interface CompetitorAggregatedData {
  config: CompetitorConfig;
  summary: {
    totalNotes: number;
    totalInteractions: number;
    commercialCount: number;
    naturalCount: number;
    unknownNatureCount: number;
    commercialRatio: number;
    suspectedDupCount: number;
    consumerIssuesCount: number;
    upstreamTotalCount: number;
    coverageRatio: number;
    dateRange: { minDate: string; maxDate: string };
  };
  brandShares: {
    brand: string;
    noteCount: number;
    interactionCount: number;
    sharePercent: number;
    avgInteractions: number;
  }[];
  topicTrends: {
    date: string;
    total: number;
    byBrand: Record<string, number>;
  }[];
  issueBreakdown: {
    category: string;
    label: string;
    count: number;
    topKeywords: { keyword: string; count: number }[];
    sampleNotes: { noteId: string; title: string; excerpt: string; brand: string }[];
  }[];
  creatorTiers: {
    tier: CreatorTier;
    label: string;
    count: number;
    percentage: number;
    note: string;
  }[];
  natureBreakdown: {
    nature: ContentNature;
    label: string;
    count: number;
    percentage: number;
  }[];
  recentNotes: CompetitorNote[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
