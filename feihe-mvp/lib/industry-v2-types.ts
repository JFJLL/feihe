export type QueryKind = 'own' | 'category' | 'competitor';
export interface IndustryQuery { id: string; kind: QueryKind; label: string; keyword: string; }
export interface IndustryV2Config {
  projectId: string; spu: string; brand: string; scopeKey: string;
  categoryKeyword: string; competitorKeywords: string[]; historyDays: number;
  dailyEnabled: boolean; queries: IndustryQuery[];
}
export interface IndustryV2Note {
  noteId: string; title: string; content: string; url: string; coverUrl: string | null;
  publishedAt: string | null; publishedDate: string | null; brand: string;
  creatorId: string | null; creatorName: string | null; fans: number | null;
  creatorRegion: string | null; creatorGender: string | null;
  taxonomy1: string | null; taxonomy2: string | null;
  format: 'image' | 'video' | 'unknown'; commercial: boolean | null; promoted: boolean | null;
  impressions: number | null; reads: number | null; interactions: number | null;
  likes: number | null; comments: number | null; collects: number | null;
  quotedPrice: number | null; capturedAt: string;
  queryIds: string[];
}
export type IndustryJobStatus = 'pending' | 'running' | 'complete' | 'partial' | 'failed';
export interface IndustryDayCoverage {
  queryId: string; date: string; status: IndustryJobStatus;
  fetched: number; reportedTotal: number | null; pages: number; error: string | null;
}
export interface IndustryV2FetchResult {
  ok: boolean; notes: IndustryV2Note[]; pages: number; reportedTotal: number | null;
  truncated: boolean; error: string | null;
}
export interface IndustryV2Metric { value: number | null; known: number; total: number; }
export interface IndustryV2Distribution { label: string; count: number; interactions: number | null; meanInteractions: number | null; evidenceIds: string[]; }
export interface IndustryV2Report {
  version: 2; config: IndustryV2Config; from: string; to: string; generatedAt: string; latestCollectedAt: string | null;
  coverage: { expected: number; complete: number; partial: number; failed: number; running: number; pending: number; rows: IndustryDayCoverage[] };
  summary: { notes: number; creators: number; impressions: IndustryV2Metric; reads: IndustryV2Metric; interactions: IndustryV2Metric; commercialRate: IndustryV2Metric; promotedRate: IndustryV2Metric; noteChange: number | null; changeReason: string };
  comparison: Array<{ query: IndustryQuery; notes: number; creators: number; interactions: IndustryV2Metric; impressions: IndustryV2Metric; commercialRate: IndustryV2Metric; promotedRate: IndustryV2Metric; completeDays: number; expectedDays: number }>;
  trend: Array<{ date: string; notes: number | null; commercial: number | null; promoted: number | null; interactions: number | null; complete: boolean }>;
  content: { scenes: IndustryV2Distribution[]; sellingPoints: IndustryV2Distribution[]; formats: IndustryV2Distribution[]; titlePatterns: IndustryV2Distribution[]; topNotes: IndustryV2Note[] };
  creators: { tiers: IndustryV2Distribution[]; top: Array<{ id: string; name: string; fans: number | null; notes: number; interactions: number | null; quotedPrice: number | null; queryIds: string[] }>; repeatCreators: number; unknownCreators: number };
  traffic: { weekday: IndustryV2Distribution[]; commercialVsNatural: IndustryV2Distribution[]; promotedVsOrganic: IndustryV2Distribution[]; readingRate: IndustryV2Metric; interactionRate: IndustryV2Metric };
  actions: Array<{ id: string; priority: 'high' | 'medium'; title: string; finding: string; suggestion: string; evidenceIds: string[]; basis: string }>;
  notes: IndustryV2Note[]; limitations: string[];
}
export interface IndustryV2AnalysisInput { config: IndustryV2Config; from: string; to: string; notes: IndustryV2Note[]; coverage: IndustryDayCoverage[]; }
