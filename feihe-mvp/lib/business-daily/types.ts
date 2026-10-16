export type CellState = 'observed' | 'missing' | 'not_collected' | 'formula_error';
export type SourceRef = { sourceKey: string; url: string; version: string; capturedAt: string; captureId?: string; range?: string; row?: number; column?: number };
export type Cell = { value: number | null; state: CellState; reason?: string; source?: SourceRef };
export type SourceRole = 'weekly' | 'budget_plan' | 'platform_snapshot' | 'creator_snapshot' | 'keywords' | 'keyword_notes' | 'rectification' | 'execution' | 'seo_acceptance' | 'seo_plan' | 'platform_ads' | 'platform_commerce' | 'comment_register' | 'comment_statistics' | 'comment_plan';
export type SourceTable = { key: string; role: SourceRole; url: string; version: string; capturedAt: string; captureId?: string; range: string; rows: unknown[][]; reportDay?: string; periodFrom?: string; periodTo?: string; complete: boolean; sheetId?: string };
export type Narrative = { title: string; level: number; text: string; source: SourceRef };
export type ReportDocument = { key: string; url: string; version: string; capturedAt: string; captureId?: string; year: number; content: string };
export type SourceBundle = { tables: SourceTable[]; document?: ReportDocument };
export type DailyPoint = { date: string; week: string; plan: Cell; adSpend: Cell; creatorCost: Cell; projectInvestment: Cell; settlement: Cell; feed: Cell; search: Cell; seo: Cell; comments: Cell; other: Cell; star: CommercePoint; alliance: CommercePoint; source: SourceRef };
export type CommercePoint = {
  investment: Cell;
  shopUv: Cell;
  readUv: Cell;
  purchaseUv: Cell;
  newCustomerUv: Cell;
  monitoredShopUv: Cell;
  coverage?: {
    coveredDays: number;
    totalDays: number;
    periodFrom: string;
    periodTo: string;
  };
  observedTotals?: {
    shopUv: number | null;
    readUv: number | null;
    purchaseUv: number | null;
    newCustomerUv: number | null;
    investment: number | null;
    monitoredShopUv: number | null;
  };
  observedSummary?: {
    shopUv: number | null;
    readUv: number | null;
    purchaseUv: number | null;
    newCustomerUv: number | null;
    investment: number | null;
    monitoredShopUv: number | null;
  };
};
export type TableView = { key: string; title: string; columns: string[]; rows: (string | number | null)[][]; source: SourceRef; scope: string; totalRows?: number; pageOffset?: number };
export type CostComparison = { channel: string; actual: number | null; low: number | null; high: number | null };
export type RankValue = { label: string; value: number | null };

export type SectionStatus = 'current' | 'historical_reference' | 'missing' | 'pending';
export type SectionMetadata = {
  key: string;
  title: string;
  sourceBusinessDay: string | null;
  capturedAt: string | null;
  isHistoricalSnapshot: boolean;
  status: SectionStatus;
  reason?: string;
};

export type BusinessHighlights = {
  search: {
    source?: SourceRef;
    tableSource?: SourceRef;
    scope: string;
    costs: CostComparison[];
    returnRate: number | null;
    coreWords: { word: string; spend: number | null; share: number | null; cpuv: number | null; ctr: number | null; index: number | null; soc: number | null; rank: number | null; reportShare: number | null }[];
    topKeywords: RankValue[];
    actions: string[];
    sourceBusinessDay?: string | null;
    capturedAt?: string | null;
    isHistoricalSnapshot?: boolean;
    status?: SectionStatus;
    reason?: string;
  };
  feed: {
    source?: SourceRef;
    scope: string;
    costs: CostComparison[];
    returnRate: number | null;
    starGroups: RankValue[];
    allianceGroups: RankValue[];
    audience: { name: string; value: number | null; previous: number | null; observedOn: string; previousOn: string; size: string; logic: string }[];
    actions: string[];
    sourceBusinessDay?: string | null;
    capturedAt?: string | null;
    isHistoricalSnapshot?: boolean;
    status?: SectionStatus;
    reason?: string;
  };
  creators: {
    source?: SourceRef;
    levels: { label: string; plan: number | null; selected: number | null; published: number | null }[];
    plan: number | null;
    selected: number | null;
    published: number | null;
    currentPublished: number | null;
    currentSource?: SourceRef;
    snapshotBusinessDay?: string | null;
    snapshotCapturedAt?: string | null;
    isHistoricalSnapshot?: boolean;
    status?: SectionStatus;
    reason?: string;
  };
  maintenance: {
    source?: SourceRef;
    notesPlan: number | null;
    notesRegistered: number | null;
    commentsPlan: number | null;
    commentsRegistered: number | null;
    pure: number | null;
    live: number | null;
    minds: { label: string; comments: number; notes: number }[];
    sourceBusinessDay?: string | null;
    capturedAt?: string | null;
    isHistoricalSnapshot?: boolean;
    status?: SectionStatus;
    reason?: string;
  };
  rectification: {
    source?: SourceRef;
    total: number;
    statuses: RankValue[];
    report?: { source: SourceRef; inspected: number | null; problematic: number | null; fixed: number | null; remaining: number | null; deadline: string };
    sourceBusinessDay?: string | null;
    capturedAt?: string | null;
    isHistoricalSnapshot?: boolean;
    status?: SectionStatus;
    reason?: string;
  };
  seo: {
    source?: SourceRef;
    acceptanceSource?: SourceRef;
    indexed: number | null;
    submitted: number | null;
    occupied: number | null;
    target: number | null;
    buckets: { label: string; actual: number; target: number }[];
    keywords: { word: string; achieved: number | null; target: number | null; registeredText: string; top3: string | null }[];
    sourceBusinessDay?: string | null;
    snapshotCapturedAt?: string | null;
    acceptanceCapturedAt?: string | null;
    acceptanceScope?: string;
    isHistoricalSnapshot?: boolean;
    status?: SectionStatus;
    reason?: string;
  };
  today: { title: string; detail: string; owner: string; deadline: string; tone: 'warning' | 'info'; source?: SourceRef }[];
  sectionMetadata?: Record<string, SectionMetadata>;
};

export type NoteSpend = { id: string; link: string; author: string; publishedDay: string | null; monthSpend: Cell; totalSpend: Cell; audit: string; advice: string; correction: string; problem: string; owner: string; source: SourceRef };
export type Difference = { key: string; title: string; details: string; sources: SourceRef[] };
export type DailyView = {
  projectId: string; day: string; dates: string[]; mode: 'latest' | 'source_snapshot' | 'confirmed'; schemaVersion: string;
  capturedAt: string | null; businessThrough: string | null; from: string; to: string; series: DailyPoint[];
  narrative: Narrative[]; tables: TableView[]; notes: NoteSpend[];
  core: { adSpend: Cell; creatorCost: Cell; projectInvestment: Cell; settlement: Cell; monthlySettlement: Cell; monthlyBudget: Cell };
  progress: { timeFraction: number; scheduleFraction: number | null; settlementFraction: number | null; lagPoints: number | null; alertThresholdPoints: number; planThroughData: number | null; actualThroughData: number | null; gapThroughData: number | null };
  funnel: { star: CommercePoint; alliance: CommercePoint; scope: string; aggregation: string };
  differences: Difference[]; sourceVersions: SourceRef[]; snapshotId?: string; fingerprint?: string; confirmedBy?: string;
  highlights?: BusinessHighlights; noteCount?: number; isSummary?: boolean;
  selectedDay?: string;
  defaultDay?: string;
  dayStatus?: 'complete' | 'partial' | 'pending' | 'empty';
  latestReportDay?: string | null;
  latestCompleteDay?: string | null;
  narrativeBusinessDay?: string | null;
  isNarrativeHistorical?: boolean;
  sectionMetadata?: Record<string, SectionMetadata>;
};
