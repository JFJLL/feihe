import { db } from '../db';
import { ensureCompetitorsSchema, getCompetitorConfig, saveCompetitorConfig } from './db';
import { fetchIpscgKeywordPage } from './ipscg-client';
import { parseRawIpscgRecord } from './analyzer';
import type {
  CompetitorNote,
  CompetitorSyncOptions,
  CompetitorSyncResult,
  KeywordSyncCheckpoint,
} from './types';

export async function runCompetitorSync(
  projectId: string,
  options: CompetitorSyncOptions = {}
): Promise<CompetitorSyncResult> {
  const start = Date.now();
  await ensureCompetitorsSchema();

  // 1. 读取并严格校验项目配置
  const config = await getCompetitorConfig(projectId);
  if (!config || !config.isConfigured || !config.taskId) {
    return {
      success: false,
      projectId,
      taskId: config?.taskId || '',
      keywords: [],
      pagesFetched: 0,
      rowsRead: 0,
      rowsImported: 0,
      rowsUpdated: 0,
      duplicatesDetected: 0,
      suspectedDuplicates: 0,
      coverageComplete: false,
      checkpoints: {},
      watermarkAdvanced: false,
      error: '项目 [' + projectId + '] 尚未绑定竞品监测数据源任务。请先在管理设置中配置专属 taskId。',
      durationMs: Date.now() - start,
    };
  }

  // 严防越权切换任务 ID
  if (options.taskId && options.taskId !== config.taskId) {
    return {
      success: false,
      projectId,
      taskId: config.taskId,
      keywords: [],
      pagesFetched: 0,
      rowsRead: 0,
      rowsImported: 0,
      rowsUpdated: 0,
      duplicatesDetected: 0,
      suspectedDuplicates: 0,
      coverageComplete: false,
      checkpoints: {},
      watermarkAdvanced: false,
      error: '传入的 taskId 与项目绑定任务不符，禁止越权操作。',
      durationMs: Date.now() - start,
    };
  }

  const taskId = config.taskId;
  const keywords = (options.keywords && options.keywords.length > 0)
    ? options.keywords.filter(k => config.keywords.includes(k) || options.keywords?.length)
    : config.keywords;

  if (keywords.length === 0) {
    return {
      success: false,
      projectId,
      taskId,
      keywords: [],
      pagesFetched: 0,
      rowsRead: 0,
      rowsImported: 0,
      rowsUpdated: 0,
      duplicatesDetected: 0,
      suspectedDuplicates: 0,
      coverageComplete: false,
      checkpoints: {},
      watermarkAdvanced: false,
      error: '没有配置任何待同步的竞品关键词。',
      durationMs: Date.now() - start,
    };
  }

  const pageSize = Number(options.pageSize || config.pageSize || 20);
  const maxPagesPerRun = Number(options.maxPagesPerRun || config.maxPagesPerRun || 3);
  const rateLimitMs = Math.max(1000, Number(options.rateLimitMs || config.rateLimitMs || 1200));
  const windowType = options.windowType || 'pubTime';
  const overlapWindowDays = Math.max(1, Number(options.overlapWindowDays || config.overlapWindowDays || 14));

  // 落地 overlapWindowDays：未显式传 from/to 时，自动推算近期重叠回刷窗口
  let from = options.from;
  let to = options.to;
  if (!from || !to) {
    const nowRef = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toStr = nowRef.getFullYear() + '-' + pad(nowRef.getMonth() + 1) + '-' + pad(nowRef.getDate());
    const fromRef = new Date(nowRef.getTime() - overlapWindowDays * 24 * 3600 * 1000);
    const fromStr = fromRef.getFullYear() + '-' + pad(fromRef.getMonth() + 1) + '-' + pad(fromRef.getDate());
    from = from || fromStr;
    to = to || toStr;
  }

  const d = db();

  // 加载已有记录映射以支持去重与疑似判定
  const existingRows = await d.prepare(
    'SELECT id, raw_note_id, title, author_name, pub_time FROM competitor_notes WHERE project_id = ?'
  ).bind(projectId).all<{ id: string; raw_note_id: string; title: string; author_name: string; pub_time: string }>();

  const existingNotesMap = new Map<string, { id: string; rawNoteId: string; title: string; authorName: string; pubTime: string }>();
  for (const r of existingRows.results) {
    existingNotesMap.set(r.raw_note_id, {
      id: r.id,
      rawNoteId: r.raw_note_id,
      title: r.title,
      authorName: r.author_name,
      pubTime: r.pub_time,
    });
  }

  let totalPagesFetched = 0;
  let totalRowsRead = 0;
  let totalRowsImported = 0;
  let totalRowsUpdated = 0;
  let totalDuplicatesDetected = 0;
  let totalSuspectedDuplicates = 0;
  let overallWatermarkAdvanced = false;
  let hasAnyFailure = false;
  let lastErrorMessage: string | null = null;

  const updatedCheckpoints: Record<string, KeywordSyncCheckpoint> = { ...(config.syncCheckpoints || {}) };

  const noteInsertSql = [
    'INSERT INTO competitor_notes (',
    '  id, project_id, task_id, raw_note_id, id_hex_length, title, content,',
    '  author_name, author_id, avatar_url, pub_time, insert_time, last_update_time,',
    '  asof_date, collection_date, keyword_hit, brand_attributed, product_line,',
    '  content_type, content_nature, nature_evidence, creator_tier,',
    '  liked_count, comment_count, collected_count, share_count, interaction_total,',
    '  note_url, video_url, tags_json, raw_payload_json, duplicate_status,',
    '  suspected_dup_target, consumer_issues_json, sentiment_tendency, data_quality,',
    '  created_at, updated_at',
    ') VALUES (',
    '  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?',
    ')',
    'ON CONFLICT(id) DO UPDATE SET',
    '  title = excluded.title,',
    '  content = excluded.content,',
    '  author_name = excluded.author_name,',
    '  avatar_url = excluded.avatar_url,',
    '  liked_count = excluded.liked_count,',
    '  comment_count = excluded.comment_count,',
    '  collected_count = excluded.collected_count,',
    '  share_count = excluded.share_count,',
    '  interaction_total = excluded.interaction_total,',
    '  consumer_issues_json = excluded.consumer_issues_json,',
    '  sentiment_tendency = excluded.sentiment_tendency,',
    '  data_quality = excluded.data_quality,',
    '  updated_at = excluded.updated_at',
  ].join('\n');

  const logInsertSql = [
    'INSERT INTO competitor_sync_logs (',
    '  project_id, task_id, keyword, window_from, window_to, window_type,',
    '  page_start, page_end, rows_read, rows_imported, rows_updated,',
    '  duplicates_found, suspected_dups_found, upstream_total_count,',
    '  coverage_complete, status, error_message, duration_ms, created_at',
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ].join('\n');

  // 逐个关键词串行执行同步
  for (const kw of keywords) {
    const cpKey = taskId + ':' + kw + ':' + windowType + ':' + (from || 'all') + '_' + (to || 'all');
    const legacyCpKey = kw + ':' + windowType + ':' + (from || 'all') + '_' + (to || 'all');
    const prevCp: KeywordSyncCheckpoint = updatedCheckpoints[cpKey] ||
      (config.taskId === taskId && updatedCheckpoints[legacyCpKey] ? updatedCheckpoints[legacyCpKey] : null) || {
      keyword: kw,
      windowFrom: from || null,
      windowTo: to || null,
      windowType,
      pageCursor: 0,
      rowsRead: 0,
      rowsImported: 0,
      duplicatesFound: 0,
      suspectedDupsFound: 0,
      upstreamTotalCount: 0,
      coverageComplete: false,
    };

    let curPage = prevCp.pageCursor + 1;
    let kwPagesFetched = 0;
    let kwRowsRead = 0;
    let kwRowsImported = 0;
    let kwRowsUpdated = 0;
    let kwDuplicates = 0;
    let kwSuspected = 0;
    let kwTotalCount = prevCp.upstreamTotalCount;
    let kwComplete = false;

    while (kwPagesFetched < maxPagesPerRun) {
      if (options.signal?.aborted) {
        lastErrorMessage = '同步被主动终止';
        break;
      }

      try {
        const fetchRes = await fetchIpscgKeywordPage({
          taskId,
          keyword: kw,
          page: curPage,
          pageSize,
          from,
          to,
          windowType,
          signal: options.signal,
        }, rateLimitMs);

        kwTotalCount = fetchRes.count;
        const records = fetchRes.list;
        kwRowsRead += records.length;
        totalPagesFetched++;
        kwPagesFetched++;

        if (records.length === 0) {
          kwComplete = true;
          break;
        }

        // 解析并入库
        const parsedNotes: CompetitorNote[] = [];
        for (const raw of records) {
          const parsed = parseRawIpscgRecord(raw, projectId, taskId, kw, config.brandRules, existingNotesMap);
          parsedNotes.push(parsed);

          if (parsed.duplicateStatus === 'confirmed_dup') {
            kwDuplicates++;
            totalDuplicatesDetected++;
          } else if (parsed.duplicateStatus === 'suspected_dup') {
            kwSuspected++;
            totalSuspectedDuplicates++;
          }

          existingNotesMap.set(parsed.rawNoteId, {
            id: parsed.id,
            rawNoteId: parsed.rawNoteId,
            title: parsed.title,
            authorName: parsed.authorName,
            pubTime: parsed.pubTime,
          });
        }

        if (!options.dryRun && parsedNotes.length > 0) {
          const insertStmts = parsedNotes.map(n => d.prepare(noteInsertSql).bind(
            n.id, n.projectId, n.taskId, n.rawNoteId, n.idHexLength, n.title, n.content,
            n.authorName, n.authorId, n.avatarUrl, n.pubTime, n.insertTime, n.lastUpdateTime,
            n.asofDate, n.collectionDate, n.keywordHit, n.brandAttributed, n.productLine,
            n.contentType, n.contentNature, n.natureEvidence, n.creatorTier,
            n.likedCount, n.commentCount, n.collectedCount, n.shareCount, n.interactionTotal,
            n.noteUrl, n.videoUrl, JSON.stringify(n.tags), JSON.stringify(n.rawPayload),
            n.duplicateStatus, n.suspectedDupTarget || null, JSON.stringify(n.consumerIssues),
            n.sentimentTendency, n.dataQuality, n.createdAt, n.updatedAt
          ));

          await d.batch(insertStmts);
        }

        // 成功写入后推进水位
        prevCp.pageCursor = curPage;
        prevCp.rowsRead += records.length;
        prevCp.rowsImported += (records.length - kwDuplicates);
        prevCp.duplicatesFound += kwDuplicates;
        prevCp.suspectedDupsFound += kwSuspected;
        prevCp.upstreamTotalCount = kwTotalCount;
        prevCp.lastSuccessAt = new Date().toISOString();
        prevCp.lastError = null;

        totalRowsImported += (records.length - kwDuplicates);
        overallWatermarkAdvanced = true;

        if (records.length < pageSize) {
          kwComplete = true;
          break;
        }

        curPage++;
      } catch (err) {
        console.error("[WorkerCatchError]", err); hasAnyFailure = true;
        lastErrorMessage = err instanceof Error ? err.message : String(err);
        prevCp.lastError = lastErrorMessage;
        // 失败时绝不推进当前页游标
        break;
      }
    }

    prevCp.coverageComplete = Boolean(kwComplete && !hasAnyFailure);
    updatedCheckpoints[cpKey] = prevCp;

    await d.prepare(logInsertSql).bind(
      projectId, taskId, kw, from || null, to || null, windowType,
      curPage - kwPagesFetched, curPage - 1,
      kwRowsRead, kwRowsImported, kwRowsUpdated,
      kwDuplicates, kwSuspected, kwTotalCount,
      prevCp.coverageComplete ? 1 : 0,
      hasAnyFailure ? 'partial_error' : 'success',
      hasAnyFailure ? lastErrorMessage : null,
      Date.now() - start,
      new Date().toISOString()
    ).run();

    totalRowsRead += kwRowsRead;
  }

  await saveCompetitorConfig(projectId, {
    syncCheckpoints: updatedCheckpoints,
    lastSyncedAt: new Date().toISOString(),
    syncStatus: hasAnyFailure ? 'error' : 'idle',
    lastError: lastErrorMessage,
  });

  return {
    success: !hasAnyFailure || overallWatermarkAdvanced,
    projectId,
    taskId,
    keywords,
    pagesFetched: totalPagesFetched,
    rowsRead: totalRowsRead,
    rowsImported: totalRowsImported,
    rowsUpdated: totalRowsUpdated,
    duplicatesDetected: totalDuplicatesDetected,
    suspectedDuplicates: totalSuspectedDuplicates,
    coverageComplete: Object.values(updatedCheckpoints).every(c => c.coverageComplete),
    checkpoints: updatedCheckpoints,
    watermarkAdvanced: overallWatermarkAdvanced,
    error: lastErrorMessage,
    durationMs: Date.now() - start,
  };
}
