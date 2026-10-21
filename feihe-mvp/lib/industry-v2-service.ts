import { fetchIndustryV2Query } from './industry-v2-provider';
import { analyzeIndustryV2 } from './industry-v2-analyzer';
import { getIndustryV2Config, enqueueIndustryV2, claimIndustryV2Job, finishIndustryV2Job, releaseIndustryV2Lease, readIndustryV2Data, INDUSTRY_V2_PAGES_PER_JOB, IndustryConfigError } from './industry-v2-store';
import type { IndustryV2FetchResult } from './industry-v2-types';

export async function getIndustryV2Report(projectId: string, now = new Date(), queryId?: string) {
  const config = await getIndustryV2Config(projectId);
  if (!config) return { configV2: null, report: null };
  const data = await readIndustryV2Data(config, now);
  if (queryId && queryId !== 'all') {
    const query = config.queries.find(item => item.id === queryId);
    if (!query) throw new IndustryConfigError('检索词已变更，请刷新后重新选择');
    data.config = { ...config, queries: [query] };
    data.notes = data.notes.filter(note => note.queryIds.includes(queryId));
    data.coverage = data.coverage.filter(row => row.queryId === queryId);
  }
  const report = analyzeIndustryV2(data);
  // Keep the interactive payload bounded; all collected records remain in the day ledger.
  if (report.notes.length > 500) report.limitations.push(`笔记明细展示前 500 篇，汇总使用全部 ${report.summary.notes} 篇去重样本。`);
  const distributions = [...report.content.scenes, ...report.content.sellingPoints, ...report.content.formats, ...report.content.titlePatterns, ...report.creators.tiers, ...report.traffic.weekday, ...report.traffic.commercialVsNatural, ...report.traffic.promotedVsOrganic];
  const evidence = new Set([...report.actions.flatMap(action => action.evidenceIds), ...distributions.flatMap(item => item.evidenceIds.slice(0, 10))]);
  // Evidence can lie beyond the analyzer's detail cap; resolve it from the collected ledger.
  const detailMap = new Map(report.notes.map(note => [note.noteId, note]));
  for (const note of data.notes) if (evidence.has(note.noteId)) {
    const previous = detailMap.get(note.noteId);
    if (!previous || note.capturedAt > previous.capturedAt) detailMap.set(note.noteId, { ...note, queryIds: [...new Set([...(previous?.queryIds ?? []), ...note.queryIds])] });
  }
  report.notes = [...detailMap.values()].sort((a, b) => Number(evidence.has(b.noteId)) - Number(evidence.has(a.noteId)) || (b.interactions ?? -1) - (a.interactions ?? -1)).slice(0, 500).map(note => ({ ...note, content: note.content.slice(0, 400) }));
  const included = new Set(report.notes.map(note => note.noteId));
  for (const item of distributions) item.evidenceIds = item.evidenceIds.filter(id => included.has(id)).slice(0, 10);
  return { configV2: config, report };
}

export async function queueIndustryV2(projectId: string, now = new Date(), manual = true) {
  const config = await getIndustryV2Config(projectId);
  if (!config) throw new Error('项目不存在或已归档');
  const queued = await enqueueIndustryV2(config, now, manual);
  return { configV2: config, ...queued };
}

export async function runNextIndustryV2Job(projectId: string, options: { now?: Date; force?: boolean; fetcher?: typeof fetchIndustryV2Query } = {}) {
  const now = options.now ?? new Date();
  const config = await getIndustryV2Config(projectId);
  if (!config?.spu) return { status: 'disabled', projectId };
  if (config.dailyEnabled || options.force) await enqueueIndustryV2(config, now, Boolean(options.force));
  const job = await claimIndustryV2Job(config, now);
  if (!job) return { status: 'idle', projectId };
  try {
    let result: IndustryV2FetchResult;
    try {
      result = await (options.fetcher ?? fetchIndustryV2Query)(job.query, job.date, config, { maxPages: INDUSTRY_V2_PAGES_PER_JOB });
    } catch {
      result = { ok: false, notes: [], pages: 0, reportedTotal: null, truncated: false, error: '采集请求异常；保留历史数据，稍后有限重试' };
    }
    const saved = await finishIndustryV2Job(job, result);
    return { status: !saved ? 'invalidated' : !result.ok ? 'failed' : result.truncated ? 'partial' : 'complete', projectId, query: job.query.keyword, date: job.date, notes: result.notes.length, pages: result.pages };
  } finally { await releaseIndustryV2Lease(projectId, job.token); }
}
