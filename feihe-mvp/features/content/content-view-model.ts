export type NoteListItem = {
  id: string;
  url: string;
  author: string;
  title: string;
  publishedAt?: string;
  sourceType: string;
  pipeline: string;
  level: string;
  productScope: string;
  status: string;
  lastFetchedAt?: string;
  commentTotal: number;
  positiveCount: number;
  negativeCount: number;
  questionCount: number;
  brandMentionTop5: number;
  addedAt: string;
  coverUrl?: string;
  category1?: string;
  category2?: string;
  noteType?: string;
  readCount?: number;
  interactionCount?: number;
  likeCount?: number;
  favoriteCount?: number;
  creatorLevel?: string;
  brand?: string;
  notePrice?: number;
  cpe?: number | null;
  latestSnapshotTime?: string;
  latestL1Count?: number;
  latestL2Count?: number;
  latestSnapshotTotal?: number;
  prevSnapshotTotal?: number;
  commentDelta: number | null;
  isFetched: number;
  isProfileComplete: number;
  pendingRiskCount: number;
};

export type NotesListResponse = {
  ok: boolean;
  items: NoteListItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    total: number;
    coverCount: number;
    categoryCount: number;
    performanceMetricCount: number;
    linkCount: number;
    creatorLevelCount: number;
    readMetricCount: number;
    interactionMetricCount: number;
    ownedCount: number;
    commercialCount: number;
    ownedPublishedCount: number;
    publishedCount: number;
    scanCount: number;
    completeCount: number;
    missingProfileCount: number;
    reportableCount: number;
    baseCount: number;
    supplementCount: number;
    fetchedCount: number;
    unfetchedCount: number;
    totalComments: number;
    totalReads: number;
    totalInteractions: number;
  };
  coverageFeedback?: Array<{
    direction: string;
    owned: number;
    commercial: number;
    natural: number;
    interactions: number;
    comments: number;
  }>;
};

export const emptyNotesSummary: NotesListResponse['summary'] = {
  total: 0,
  coverCount: 0,
  categoryCount: 0,
  performanceMetricCount: 0,
  linkCount: 0,
  creatorLevelCount: 0,
  readMetricCount: 0,
  interactionMetricCount: 0,
  ownedCount: 0,
  commercialCount: 0,
  ownedPublishedCount: 0,
  publishedCount: 0,
  scanCount: 0,
  completeCount: 0,
  missingProfileCount: 0,
  reportableCount: 0,
  baseCount: 0,
  supplementCount: 0,
  fetchedCount: 0,
  unfetchedCount: 0,
  totalComments: 0,
  totalReads: 0,
  totalInteractions: 0,
};
