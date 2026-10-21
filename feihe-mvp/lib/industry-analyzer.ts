import { canonicalIndustryBrand } from './industry-brand';
import type {
  IndustryNoteItem,
  IndustrySnapshot,
  IndustrySnapshotSummary,
  IndustrySearchTopic,
  CompetitorComparisonItem,
  IndustryProvenance,
  IndustryProviderType,
} from './industry-types';

export function analyzeIndustryNotes(params: {
  projectId: string;
  spu: string;
  brand: string;
  competitorBrands: string[];
  notes: IndustryNoteItem[];
  dateKey: string;
  provider: IndustryProviderType;
  liveVerified: boolean;
}): IndustrySnapshot {
  const { projectId, spu, brand, competitorBrands, dateKey, provider, liveVerified } = params;
  const notes = params.notes.map(note => {
    const canonical = canonicalIndustryBrand(note.brand, brand, spu);
    return { ...note, brand: canonical, isOurBrand: Boolean(brand) && canonical === brand };
  });
  const totalNotes = notes.length;
  const now = new Date().toISOString();

  // Empty state handling: If 0 notes, return factual empty structure without fabricated metrics
  if (totalNotes === 0) {
    const emptyProvenance: IndustryProvenance = {
      projectId,
      spu,
      dateKey,
      provider,
      fetchedAt: now,
      recordCount: 0,
      liveVerified,
    };
    const emptySummary: IndustrySnapshotSummary = {
      spu,
      totalNotes: 0,
      totalInteractions: null,
      ourBrandShare: null,
      commercialRatio: null,
      avgSentimentScore: null,
      topKeyword: spu,
    };
    return {
      id: `ind_snap:${projectId}:${dateKey}:${spu}`,
      projectId,
      spu,
      dateKey,
      status: 'ready',
      provenance: emptyProvenance,
      summary: emptySummary,
      searchTopics: [],
      competitorComparison: [],
      recentNotes: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  // 1. Group by factual brand mentions
  let totalInteractionsSum = 0;
  let hasAnyInteractions = false;
  let ourBrandCount = 0;
  let commercialCount = 0;
  let knownNatureCount = 0;

  const brandMap = new Map<string, {
    notes: IndustryNoteItem[];
    interactionsSum: number;
    hasInteractions: boolean;
    commercialCount: number;
    knownNatureCount: number;
  }>();

  // Initialize known brands
  const allTargetBrands = [brand, ...competitorBrands].filter(Boolean);
  for (const b of allTargetBrands) {
    brandMap.set(b, {
      notes: [],
      interactionsSum: 0,
      hasInteractions: false,
      commercialCount: 0,
      knownNatureCount: 0,
    });
  }

  for (const note of notes) {
    const resolvedBrand = (note.brand || '').trim() || '未识别品牌';
    const isOur = Boolean(note.isOurBrand || resolvedBrand === brand);

    const entry = brandMap.get(resolvedBrand) || {
      notes: [],
      interactionsSum: 0,
      hasInteractions: false,
      commercialCount: 0,
      knownNatureCount: 0,
    };

    entry.notes.push(note);
    if (isOur) ourBrandCount++;

    const noteInteractions = [note.likedCount, note.commentCount, note.collectedCount]
      .filter((v): v is number => typeof v === 'number');

    if (noteInteractions.length > 0) {
      const sum = noteInteractions.reduce((acc, curr) => acc + curr, 0);
      entry.interactionsSum += sum;
      entry.hasInteractions = true;
      totalInteractionsSum += sum;
      hasAnyInteractions = true;
    }

    if (note.nature === 'commercial') {
      entry.commercialCount++;
      commercialCount++;
      entry.knownNatureCount++;
      knownNatureCount++;
    } else if (note.nature === 'natural') {
      entry.knownNatureCount++;
      knownNatureCount++;
    }

    brandMap.set(resolvedBrand, entry);
  }

  const ourBrandShare = totalNotes > 0 ? Math.round((ourBrandCount / totalNotes) * 100) / 100 : null;
  const commercialRatio = knownNatureCount > 0 ? Math.round((commercialCount / knownNatureCount) * 100) / 100 : null;

  // 2. Build competitor comparison strictly from factual notes
  const competitorComparison: CompetitorComparisonItem[] = [];
  for (const [bName, data] of brandMap.entries()) {
    const count = data.notes.length;
    if (count === 0 && bName !== brand) continue; // Skip zero-mention competitor brands to avoid noise

    const isOur = bName === brand;
    const avgInter = data.hasInteractions && count > 0 ? Math.round(data.interactionsSum / count) : null;
    const bCommercialRatio = data.knownNatureCount > 0 ? Math.round((data.commercialCount / data.knownNatureCount) * 100) / 100 : null;

    competitorComparison.push({
      brand: bName,
      isOurBrand: isOur,
      noteCount: count,
      interactionCount: data.hasInteractions ? data.interactionsSum : null,
      commercialRatio: bCommercialRatio,
      topCreatorShare: null, // No fabricated creator share without raw fans data
      avgInteractionPerNote: avgInter,
      sentimentPositiveRatio: null, // No fabricated sentiment without real sentiment model output
    });
  }

  // Sort comparison: our brand first, then descending by note count
  competitorComparison.sort((a, b) => {
    if (a.isOurBrand) return -1;
    if (b.isOurBrand) return 1;
    return b.noteCount - a.noteCount;
  });

  // 3. Factual topic extraction from note titles
  const topicFrequency = new Map<string, { count: number; totalInteractions: number }>();
  for (const n of notes) {
    const t = n.title.trim();
    if (!t) continue;
    // Preserve full title for high-interaction reference
    const existing = topicFrequency.get(t) || { count: 0, totalInteractions: 0 };
    existing.count++;
    const noteSum = [n.likedCount, n.commentCount, n.collectedCount].filter((x): x is number => typeof x === 'number').reduce((a, b) => a + b, 0);
    existing.totalInteractions += noteSum;
    topicFrequency.set(t, existing);
  }

  const searchTopics: IndustrySearchTopic[] = Array.from(topicFrequency.entries())
    .sort((a, b) => b[1].totalInteractions - a[1].totalInteractions)
    .slice(0, 8)
    .map(([topic, stat]) => ({
      topic,
      heatIndex: stat.totalInteractions > 0 ? stat.totalInteractions : null,
      noteCount: stat.count,
      growthRate: null, // No fake growth rate
      intentCategory: '高互动标题参考',
      sentimentScore: null, // No fake sentiment score
    }));

  const summary: IndustrySnapshotSummary = {
    spu,
    totalNotes,
    totalInteractions: hasAnyInteractions ? totalInteractionsSum : null,
    ourBrandShare,
    commercialRatio,
    avgSentimentScore: null,
    topKeyword: spu,
  };

  const provenance: IndustryProvenance = {
    projectId,
    spu,
    dateKey,
    provider,
    fetchedAt: now,
    recordCount: totalNotes,
    liveVerified,
  };

  return {
    id: `ind_snap:${projectId}:${dateKey}:${spu}`,
    projectId,
    spu,
    dateKey,
    status: 'ready',
    provenance,
    summary,
    searchTopics,
    competitorComparison,
    recentNotes: notes.slice(0, 50),
    createdAt: now,
    updatedAt: now,
  };
}
