import { db } from './db';
import {
  ensureIndustrySchema,
  getIndustryConfig,
  saveIndustryConfig,
  getLatestIndustrySnapshot,
  saveIndustrySnapshot,
  saveIndustryNotes,
  claimIndustryTaskAtomic,
  updateIndustryTask,
  invalidateIndustrySnapshot,
} from './industry-db';
import { fetchIndustryData } from './industry-provider';
import { analyzeIndustryNotes } from './industry-analyzer';
import type {
  IndustrySnapshot,
  IndustrySyncStatus,
} from './industry-types';
import { CAMPAIGN_PROJECT_CATALOG, isCampaignProject } from './campaign-catalog';

export const MAX_PAGES_PER_PROJECT = 2; // Strict daily page limit <= 2 pages to bound API costs

/**
 * Returns YYYY-MM-DD formatted date in Asia/Shanghai timezone
 */
export function getShanghaiDateKey(d: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

export interface SyncIndustryOptions {
  projectId: string;
  dateKey?: string;
  force?: boolean;
}

export interface SyncIndustryResult {
  ok: boolean;
  status: IndustrySyncStatus;
  projectId: string;
  spu: string;
  dateKey: string;
  snapshot?: IndustrySnapshot;
  error?: string;
  skipped?: boolean;
}

/**
 * Look up persisted SPU and metadata for a project.
 * Strictly project-isolated from DB projects table.
 * If projects.spu is empty, returns empty string — NEVER falls back to old config.spu or client keyword.
 */
export async function resolveProjectIndustryMeta(projectId: string): Promise<{
  spu: string;
  brand: string;
  category: string;
  name: string;
}> {
  const d = db();
  const projectRow = await d
    .prepare('SELECT id, name, spu, brand, category FROM projects WHERE id = ?')
    .bind(projectId)
    .first<{ id: string; name: string; spu?: string; brand?: string; category?: string }>()
    .catch(() => null);

  const catalog = isCampaignProject(projectId) ? CAMPAIGN_PROJECT_CATALOG[projectId] : null;
  const spu = (projectRow?.spu || '').trim();
  const brand = (projectRow?.brand || catalog?.brand || '').trim();
  const category = (projectRow?.category || catalog?.category || '').trim();
  const name = projectRow?.name || catalog?.name || projectId;

  return {
    spu,
    brand,
    category,
    name,
  };
}

/**
 * Default competitor brands and search keywords per campaign project
 */
function getDefaultCompetitors(projectId: string, brand: string, spu: string): {
  competitors: string[];
  keywords: string[];
} {
  switch (projectId) {
    case 'kailas':
      return {
        competitors: ['始祖鸟', '北面', '萨洛蒙', '哥伦比亚'],
        keywords: [spu, `${brand} ${spu}`.trim()].filter(Boolean),
      };
    case 'meiling':
      return {
        competitors: ['海尔', '美的', '容声', '西门子'],
        keywords: [spu, `${brand} ${spu}`.trim()].filter(Boolean),
      };
    case 'winner-wipes':
      return {
        competitors: ['心相印', '维达', '全棉时代', '洁柔'],
        keywords: [spu, `${brand} ${spu}`.trim()].filter(Boolean),
      };
    case 'huang-tiane':
      return {
        competitors: ['圣迪乐村', '正大', '德青源', '兰皇'],
        keywords: [spu, `${brand} ${spu}`.trim()].filter(Boolean),
      };
    default:
      return {
        competitors: [],
        keywords: [spu, `${brand} ${spu}`.trim()].filter(Boolean),
      };
  }
}

/**
 * Core industry monitor sync execution with:
 * - Missing SPU guard (rejects empty SPU, no fallback to old SPU, does NOT expose old snapshot)
 * - Dynamic SPU change invalidation with provenance
 * - SPU in-flight change check before writing snapshot
 * - Duplicate daily job prevention (Shanghai timezone) via atomic task claim
 * - Resilient restart on crashes
 * - Bounded retries and failure stale-state preservation
 * - Bounded daily pages <= 2
 */
export async function runIndustrySync(
  options: SyncIndustryOptions,
  fetcher: typeof fetchIndustryData = fetchIndustryData
): Promise<SyncIndustryResult> {
  await ensureIndustrySchema();
  const { projectId, force = false } = options;
  const dateKey = options.dateKey || getShanghaiDateKey();

  // 1. Resolve project SPU strictly from DB
  const meta = await resolveProjectIndustryMeta(projectId);
  const currentSpu = meta.spu;

  let config = await getIndustryConfig(projectId);
  if (!config) {
    const defaults = getDefaultCompetitors(projectId, meta.brand, currentSpu);
    config = await saveIndustryConfig(projectId, {
      spu: currentSpu,
      brand: meta.brand,
      category: meta.category,
      keywords: defaults.keywords,
      competitorBrands: defaults.competitors,
      dailySyncEnabled: true,
      lastStatus: 'idle',
    });
  }

  // Missing SPU guard: Reject with honest missing_spu status without fabricated fake data
  if (!currentSpu) {
    await saveIndustryConfig(projectId, {
      spu: '',
      lastStatus: 'missing_spu',
      lastError: '项目尚未在项目资料中配置 SPU，无法执行行业分析抓取与分析',
    });
    return {
      ok: false,
      status: 'missing_spu',
      projectId,
      spu: '',
      dateKey,
      error: '项目尚未配置 SPU，请在项目设置中维护 SPU 后再同步',
    };
  }

  // Check if SPU changed dynamically compared to previous snapshot
  const latestSnapshot = await getLatestIndustrySnapshot(projectId, currentSpu);
  if (latestSnapshot && latestSnapshot.spu && latestSnapshot.spu !== currentSpu) {
    await invalidateIndustrySnapshot(
      projectId,
      latestSnapshot.spu,
      currentSpu,
      `SPU 变更：由「${latestSnapshot.spu}」切换为「${currentSpu}」`
    );
  }

  // 2. Scheduler deduplication: Atomic task claim
  if (!config.dailySyncEnabled && !force) {
    return {
      ok: true,
      status: 'idle',
      projectId,
      spu: currentSpu,
      dateKey,
      skipped: true,
    };
  }

  const taskId = `task_${projectId}_${dateKey}_${Date.now()}`;
  const claimResult = await claimIndustryTaskAtomic({
    taskId,
    projectId,
    dateKey,
    spu: currentSpu,
    provider: config.provider,
    maxAttempts: 3,
  });

  if (!claimResult.claimed) {
    if (claimResult.task?.status === 'completed') {
      const snapshot = await getLatestIndustrySnapshot(projectId, currentSpu);
      return {
        ok: true,
        status: 'ready',
        projectId,
        spu: currentSpu,
        dateKey,
        snapshot: snapshot || undefined,
        skipped: true,
      };
    }

    if (claimResult.task?.status === 'running') {
      return {
        ok: true,
        status: 'running',
        projectId,
        spu: currentSpu,
        dateKey,
        skipped: true,
      };
    }

    return {
      ok: false,
      status: (claimResult.task?.status as IndustrySyncStatus) || 'failed',
      projectId,
      spu: currentSpu,
      dateKey,
      error: claimResult.reason || '无法锁定任务执行',
    };
  }

  const claimedTaskId = claimResult.task?.id || taskId;
  await saveIndustryConfig(projectId, {
    spu: currentSpu,
    lastStatus: 'running',
    lastError: null,
  });

  // 3. Execute provider fetch (bounded to MAX_PAGES_PER_PROJECT <= 2)
  const keywords = config.keywords.length > 0 ? config.keywords : [currentSpu];
  const fetchRes = await fetcher({
    projectId,
    spu: currentSpu,
    brand: config.brand || meta.brand,
    keywords,
    competitorBrands: config.competitorBrands,
    maxPages: MAX_PAGES_PER_PROJECT,
    pageSize: 60,
  });

  // 4. In-flight SPU change verification: Re-read DB SPU to prevent writing stale snapshot
  const recheckMeta = await resolveProjectIndustryMeta(projectId);
  if (recheckMeta.spu !== currentSpu) {
    await updateIndustryTask(claimedTaskId, {
      status: 'failed',
      errorMessage: `执行期间项目 SPU 已由「${currentSpu}」变更为「${recheckMeta.spu}」，丢弃本次采集结果`,
      completedAt: new Date().toISOString(),
    });
    return {
      ok: false,
      status: 'invalidated',
      projectId,
      spu: recheckMeta.spu,
      dateKey,
      error: '执行期间项目 SPU 发生变更，已放弃写入旧 SPU 快照',
    };
  }

  if (!fetchRes.success) {
    const errorStatus = fetchRes.status || 'failed';
    await updateIndustryTask(claimedTaskId, {
      status: 'failed',
      errorMessage: fetchRes.errorMessage || '抓取未成功',
      completedAt: new Date().toISOString(),
    });
    await saveIndustryConfig(projectId, {
      lastStatus: errorStatus,
      lastError: fetchRes.errorMessage || '数据源采集失败，已保留上一版本数据',
    });

    // If an existing snapshot exists, mark status as stale
    if (latestSnapshot && latestSnapshot.status === 'ready') {
      latestSnapshot.status = 'stale';
      await saveIndustrySnapshot(latestSnapshot);
    }

    return {
      ok: false,
      status: errorStatus,
      projectId,
      spu: currentSpu,
      dateKey,
      snapshot: latestSnapshot || undefined,
      error: fetchRes.errorMessage || '抓取未成功',
    };
  }

  // 5. Successful fetch: Store notes and analyze
  await saveIndustryNotes(projectId, currentSpu, fetchRes.notes);

  const snapshot = analyzeIndustryNotes({
    projectId,
    spu: currentSpu,
    brand: config.brand || meta.brand,
    competitorBrands: config.competitorBrands,
    notes: fetchRes.notes,
    dateKey,
    provider: fetchRes.provider,
    liveVerified: fetchRes.liveVerified,
  });

  await saveIndustrySnapshot(snapshot);

  await updateIndustryTask(claimedTaskId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    errorMessage: null,
  });

  await saveIndustryConfig(projectId, {
    spu: currentSpu,
    lastSyncedAt: new Date().toISOString(),
    lastStatus: 'ready',
    lastError: null,
  });

  return {
    ok: true,
    status: 'ready',
    projectId,
    spu: currentSpu,
    dateKey,
    snapshot,
  };
}
