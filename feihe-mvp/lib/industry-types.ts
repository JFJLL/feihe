export type IndustryProviderType = 'pgy' | 'ipscg';

export type IndustrySyncStatus =
  | 'idle'
  | 'running'
  | 'ready'
  | 'stale'
  | 'missing_spu'
  | 'missing_credentials'
  | 'awaiting_verification'
  | 'failed'
  | 'invalidated';

export interface IndustryProjectConfig {
  projectId: string;
  spu: string;
  category: string;
  brand: string;
  keywords: string[];
  competitorBrands: string[];
  provider: IndustryProviderType;
  dailySyncEnabled: boolean;
  lastSyncedAt?: string | null;
  lastStatus: IndustrySyncStatus;
  lastError?: string | null;
  updatedAt: string;
}

export interface IndustrySearchTopic {
  topic: string;
  heatIndex: number | null;
  noteCount: number;
  growthRate: number | null;
  intentCategory: string;
  sentimentScore: number | null;
}

export interface CompetitorComparisonItem {
  brand: string;
  isOurBrand: boolean;
  noteCount: number;
  interactionCount: number | null;
  commercialRatio: number | null;
  topCreatorShare: number | null;
  avgInteractionPerNote: number | null;
  sentimentPositiveRatio: number | null;
}

export interface IndustryNoteItem {
  id: string;
  noteId: string;
  title: string;
  bloggerName?: string | null;
  coverUrl?: string | null;
  noteUrl: string;
  pubTime?: string | null;
  likedCount: number | null;
  commentCount: number | null;
  collectedCount: number | null;
  brand: string;
  isOurBrand: boolean;
  nature: 'commercial' | 'natural' | 'unknown';
  sourceProvider: string;
  fetchedAt: string;
}

export interface IndustrySnapshotSummary {
  spu: string;
  totalNotes: number;
  totalInteractions: number | null;
  ourBrandShare: number | null;
  commercialRatio: number | null;
  avgSentimentScore: number | null;
  topKeyword: string;
}

export interface IndustryProvenance {
  projectId: string;
  spu: string;
  dateKey: string;
  provider: IndustryProviderType;
  fetchedAt: string;
  recordCount: number;
  liveVerified: boolean;
  invalidatedAt?: string | null;
  invalidationReason?: string | null;
  previousSpu?: string | null;
}

export interface IndustrySnapshot {
  id: string;
  projectId: string;
  spu: string;
  dateKey: string;
  status: 'ready' | 'stale' | 'invalidated';
  invalidationReason?: string | null;
  provenance: IndustryProvenance;
  summary: IndustrySnapshotSummary;
  searchTopics: IndustrySearchTopic[];
  competitorComparison: CompetitorComparisonItem[];
  recentNotes: IndustryNoteItem[];
  createdAt: string;
  updatedAt: string;
}

export interface IndustryTaskRecord {
  id: string;
  projectId: string;
  taskType: 'daily_monitor' | 'manual_sync';
  dateKey: string;
  spu: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  provider: IndustryProviderType;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface ProviderFetchOptions {
  projectId: string;
  spu: string;
  brand: string;
  keywords: string[];
  competitorBrands: string[];
  maxPages?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface ProviderFetchResult {
  success: boolean;
  provider: IndustryProviderType;
  liveVerified: boolean;
  notes: IndustryNoteItem[];
  recordCount: number;
  status?: IndustrySyncStatus;
  errorMessage?: string | null;
}
