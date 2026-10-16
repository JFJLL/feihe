import { requireProjectAccess, jsonError } from '../../../lib/api-auth';
import { db } from '../../../lib/db';
import { getCompetitorConfig, saveCompetitorConfig, ensureCompetitorsSchema } from '../../../lib/competitors/db';
import { queueCompetitorSyncTask } from '../../../lib/business-sync/store';
import { runCompetitorSync } from '../../../lib/competitors/worker';
import type { CompetitorAggregatedData, CompetitorNote, ConsumerIssue } from '../../../lib/competitors/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId') || '';
  if (!projectId) return jsonError('缺少 projectId 参数', 400);

  const access = await requireProjectAccess(request, projectId);
  if (!access.ok) return jsonError(access.error || '无权访问该项目', access.status || 403);

  await ensureCompetitorsSchema();
  const action = url.searchParams.get('action') || 'data';

  if (action === 'config') {
    const config = await getCompetitorConfig(projectId);
    return Response.json({ ok: true, config });
  }

  // 默认 action = data
  try {
    const config = await getCompetitorConfig(projectId);
    if (!config || !config.isConfigured || !config.taskId) {
      return Response.json({
        ok: true,
        configured: false,
        message: '当前项目未配置竞品监测任务',
        config,
        data: null,
      });
    }

    const d = db();

    // 筛选参数
    const keywordFilter = url.searchParams.get('keyword') || '';
    const brandFilter = url.searchParams.get('brand') || '';
    const natureFilter = url.searchParams.get('nature') || '';
    const sentimentFilter = url.searchParams.get('sentiment') || '';
    const dateFrom = url.searchParams.get('from') || '';
    const dateTo = url.searchParams.get('to') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const offset = (page - 1) * pageSize;

    const requestedTaskId = url.searchParams.get('taskId');
    const targetTaskId = requestedTaskId ? requestedTaskId.trim() : config.taskId;
    const whereClauses: string[] = ['project_id = ? AND task_id = ?'];
    const whereParams: unknown[] = [projectId, targetTaskId];

    if (keywordFilter) {
      whereClauses.push('keyword_hit = ?');
      whereParams.push(keywordFilter);
    }
    if (brandFilter) {
      whereClauses.push('brand_attributed = ?');
      whereParams.push(brandFilter);
    }
    if (natureFilter) {
      whereClauses.push('content_nature = ?');
      whereParams.push(natureFilter);
    }
    if (sentimentFilter) {
      whereClauses.push('sentiment_tendency = ?');
      whereParams.push(sentimentFilter);
    }
    if (dateFrom) {
      whereClauses.push('asof_date >= ?');
      whereParams.push(dateFrom);
    }
    if (dateTo) {
      whereClauses.push('asof_date <= ?');
      whereParams.push(dateTo);
    }

    const whereSql = whereClauses.join(' AND ');

    // 1. 总计数与汇总
    const countSql = [
      'SELECT',
      '  COUNT(*) as total_notes,',
      '  SUM(interaction_total) as total_interactions,',
      '  SUM(CASE WHEN content_nature = \'commercial\' THEN 1 ELSE 0 END) as commercial_count,',
      '  SUM(CASE WHEN content_nature = \'natural\' THEN 1 ELSE 0 END) as natural_count,',
      '  SUM(CASE WHEN content_nature = \'unknown\' THEN 1 ELSE 0 END) as unknown_nature_count,',
      '  SUM(CASE WHEN duplicate_status = \'suspected_dup\' THEN 1 ELSE 0 END) as suspected_dup_count,',
      '  MIN(asof_date) as min_date,',
      '  MAX(asof_date) as max_date',
      'FROM competitor_notes',
      'WHERE ' + whereSql,
    ].join('\n');

    const countRow = await d.prepare(countSql).bind(...whereParams).first<any>();

    const totalNotes = Number(countRow?.total_notes || 0);
    const totalInteractions = Number(countRow?.total_interactions || 0);
    const commercialCount = Number(countRow?.commercial_count || 0);
    const naturalCount = Number(countRow?.natural_count || 0);
    const unknownNatureCount = Number(countRow?.unknown_nature_count || 0);
    const suspectedDupCount = Number(countRow?.suspected_dup_count || 0);
    const minDate = countRow?.min_date || '';
    const maxDate = countRow?.max_date || '';

    const checkpoints = Object.values(config.syncCheckpoints || {});
    const upstreamTotalCount = checkpoints.reduce((acc, c) => acc + (c.upstreamTotalCount || 0), 0);
    const coverageRatio = upstreamTotalCount > 0 ? (totalNotes / upstreamTotalCount) : 0;

    // 2. 品牌份额聚合（不受当前单品牌筛选影响，保持全盘品牌分布可交互）
    const brandWhereClauses: string[] = ['project_id = ? AND task_id = ?'];
    const brandWhereParams: unknown[] = [projectId, targetTaskId];
    if (keywordFilter) {
      brandWhereClauses.push('keyword_hit = ?');
      brandWhereParams.push(keywordFilter);
    }
    if (natureFilter) {
      brandWhereClauses.push('content_nature = ?');
      brandWhereParams.push(natureFilter);
    }
    if (sentimentFilter) {
      brandWhereClauses.push('sentiment_tendency = ?');
      brandWhereParams.push(sentimentFilter);
    }
    if (dateFrom) {
      brandWhereClauses.push('asof_date >= ?');
      brandWhereParams.push(dateFrom);
    }
    if (dateTo) {
      brandWhereClauses.push('asof_date <= ?');
      brandWhereParams.push(dateTo);
    }
    const brandWhereSql = brandWhereClauses.join(' AND ');

    const brandSql = [
      'SELECT',
      '  brand_attributed as brand,',
      '  COUNT(*) as note_count,',
      '  SUM(interaction_total) as interaction_count',
      'FROM competitor_notes',
      'WHERE ' + brandWhereSql,
      'GROUP BY brand_attributed',
      'ORDER BY note_count DESC',
    ].join('\n');

    const brandRows = await d.prepare(brandSql).bind(...brandWhereParams).all<any>();

    const brandTotalNotes = brandRows.results.reduce((acc: number, r: any) => acc + Number(r.note_count || 0), 0);

    const brandShares = brandRows.results.map((r: any) => {
      const nc = Number(r.note_count || 0);
      const ic = Number(r.interaction_count || 0);
      return {
        brand: r.brand,
        noteCount: nc,
        interactionCount: ic,
        sharePercent: brandTotalNotes > 0 ? (nc / brandTotalNotes) * 100 : 0,
        avgInteractions: nc > 0 ? Math.round(ic / nc) : 0,
      };
    });

    // 3. 趋势走势聚合（按 asof_date）
    const trendSql = [
      'SELECT',
      '  asof_date as date,',
      '  brand_attributed as brand,',
      '  COUNT(*) as cnt',
      'FROM competitor_notes',
      'WHERE ' + whereSql + ' AND asof_date IS NOT NULL AND asof_date != \'\'',
      'GROUP BY asof_date, brand_attributed',
      'ORDER BY asof_date ASC',
    ].join('\n');

    const trendRows = await d.prepare(trendSql).bind(...whereParams).all<any>();

    const trendMap = new Map<string, { date: string; total: number; byBrand: Record<string, number> }>();
    for (const r of trendRows.results) {
      const dt = r.date;
      if (!trendMap.has(dt)) {
        trendMap.set(dt, { date: dt, total: 0, byBrand: {} });
      }
      const entry = trendMap.get(dt)!;
      const c = Number(r.cnt || 0);
      entry.total += c;
      entry.byBrand[r.brand] = (entry.byBrand[r.brand] || 0) + c;
    }
    const topicTrends = Array.from(trendMap.values());

    // 4. 内容性质分布
    const natureBreakdown = [
      {
        nature: 'commercial' as const,
        label: '商业合作 / 商单',
        count: commercialCount,
        percentage: totalNotes > 0 ? (commercialCount / totalNotes) * 100 : 0,
      },
      {
        nature: 'natural' as const,
        label: '真实自费 / 个人分享',
        count: naturalCount,
        percentage: totalNotes > 0 ? (naturalCount / totalNotes) * 100 : 0,
      },
      {
        nature: 'unknown' as const,
        label: '未确定 / 特征不显著',
        count: unknownNatureCount,
        percentage: totalNotes > 0 ? (unknownNatureCount / totalNotes) * 100 : 0,
      },
    ];

    // 5. 达人层级（恪守事实：无粉丝数标为 unknown）
    const creatorTiers = [
      {
        tier: 'unknown' as const,
        label: '未提供粉丝数 (Unknown)',
        count: totalNotes,
        percentage: 100,
        note: '上游接口未返回博主粉丝数字段，严格按事实标注为 unknown，避免人为编造达人层级。',
      },
    ];

    // 6. 消费者问题与反馈提取聚合
    const issueSql = [
      'SELECT consumer_issues_json, raw_note_id, title, brand_attributed',
      'FROM competitor_notes',
      'WHERE ' + whereSql + ' AND consumer_issues_json != \'[]\'',
      'LIMIT 500',
    ].join('\n');

    const rawIssueRows = await d.prepare(issueSql).bind(...whereParams).all<any>();

    const issueCategoryMap = new Map<string, {
      category: string;
      label: string;
      count: number;
      kwMap: Map<string, number>;
      sampleNotes: { noteId: string; title: string; excerpt: string; brand: string }[];
    }>();

    const categoryLabels: Record<string, string> = {
      digestive: '消化吸收与肠胃 (便秘/腹泻/胀气)',
      taste: '口味口感与接受度 (腥味/不爱喝/香精)',
      mixability: '冲调溶解与质地 (结块/挂壁/起泡)',
      safety: '过敏体质与安全性 (湿疹/红疹/上火)',
      service: '产品渠道与服务 (假货/破损/售后)',
      general: '其他综合疑虑',
    };

    let totalConsumerIssuesCount = 0;
    for (const row of rawIssueRows.results) {
      try {
        const issues = JSON.parse(row.consumer_issues_json || '[]') as ConsumerIssue[];
        for (const iss of issues) {
          totalConsumerIssuesCount++;
          if (!issueCategoryMap.has(iss.category)) {
            issueCategoryMap.set(iss.category, {
              category: iss.category,
              label: categoryLabels[iss.category] || iss.category,
              count: 0,
              kwMap: new Map(),
              sampleNotes: [],
            });
          }
          const catEntry = issueCategoryMap.get(iss.category)!;
          catEntry.count++;
          catEntry.kwMap.set(iss.keyword, (catEntry.kwMap.get(iss.keyword) || 0) + 1);
          if (catEntry.sampleNotes.length < 5) {
            catEntry.sampleNotes.push({
              noteId: row.raw_note_id,
              title: row.title,
              excerpt: iss.excerpt,
              brand: row.brand_attributed,
            });
          }
        }
      } catch {}
    }

    const issueBreakdown = Array.from(issueCategoryMap.values()).map(e => ({
      category: e.category,
      label: e.label,
      count: e.count,
      topKeywords: Array.from(e.kwMap.entries())
        .map(([k, v]) => ({ keyword: k, count: v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      sampleNotes: e.sampleNotes,
    })).sort((a, b) => b.count - a.count);

    // 7. 分页笔记明细列表
    const notesSql = [
      'SELECT *',
      'FROM competitor_notes',
      'WHERE ' + whereSql,
      'ORDER BY pub_time DESC, created_at DESC',
      'LIMIT ? OFFSET ?',
    ].join('\n');

    const noteRows = await d.prepare(notesSql).bind(...whereParams, pageSize, offset).all<any>();

    const recentNotes: CompetitorNote[] = noteRows.results.map((r: any) => {
      let tags = [];
      let issues = [];
      try { tags = JSON.parse(r.tags_json || '[]'); } catch {}
      try { issues = JSON.parse(r.consumer_issues_json || '[]'); } catch {}
      return {
        id: r.id,
        projectId: r.project_id,
        taskId: r.task_id,
        rawNoteId: r.raw_note_id,
        idHexLength: Number(r.id_hex_length || r.raw_note_id?.length || 0),
        title: r.title,
        content: r.content,
        authorName: r.author_name,
        authorId: r.author_id,
        avatarUrl: r.avatar_url,
        pubTime: r.pub_time,
        insertTime: r.insert_time,
        lastUpdateTime: r.last_update_time,
        asofDate: r.asof_date,
        collectionDate: r.collection_date,
        keywordHit: r.keyword_hit,
        brandAttributed: r.brand_attributed,
        productLine: r.product_line,
        contentType: r.content_type,
        contentNature: r.content_nature,
        natureEvidence: r.nature_evidence,
        creatorTier: r.creator_tier,
        likedCount: Number(r.liked_count || 0),
        commentCount: Number(r.comment_count || 0),
        collectedCount: Number(r.collected_count || 0),
        shareCount: Number(r.share_count || 0),
        interactionTotal: Number(r.interaction_total || 0),
        noteUrl: r.note_url,
        videoUrl: r.video_url || '',
        tags,
        rawPayload: {},
        duplicateStatus: r.duplicate_status,
        suspectedDupTarget: r.suspected_dup_target,
        consumerIssues: issues,
        sentimentTendency: r.sentiment_tendency,
        dataQuality: r.data_quality,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    const totalPages = Math.ceil(totalNotes / pageSize);

    const aggregated: CompetitorAggregatedData = {
      config,
      summary: {
        totalNotes,
        totalInteractions,
        commercialCount,
        naturalCount,
        unknownNatureCount,
        commercialRatio: totalNotes > 0 ? (commercialCount / totalNotes) * 100 : 0,
        suspectedDupCount,
        consumerIssuesCount: totalConsumerIssuesCount,
        upstreamTotalCount,
        coverageRatio,
        dateRange: { minDate, maxDate },
      },
      brandShares,
      topicTrends,
      issueBreakdown,
      creatorTiers,
      natureBreakdown,
      recentNotes,
      pagination: {
        page,
        pageSize,
        total: totalNotes,
        totalPages,
      },
    };

    return Response.json({
      ok: true,
      configured: true,
      data: aggregated,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '获取竞品数据失败', 500);
  }
}

export async function POST(request: Request) {
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return jsonError('无效的 JSON 数据', 400);
  }

  const projectId = String(body.projectId || '').trim();
  if (!projectId) return jsonError('缺少 projectId 参数', 400);

  // 严格写权限控制：仅管理员或编辑者可以保存配置或触发同步
  const access = await requireProjectAccess(request, projectId, 'write');
  if (!access.ok) return jsonError(access.error || '需要编辑或管理权限以执行此操作', access.status || 403);

  const action = body.action;

  if (action === 'save_config') {
    const taskId = String(body.taskId || '').trim();
    if (!taskId) return jsonError('任务 ID (taskId) 不能为空', 400);

    const keywords = Array.isArray(body.keywords) ? body.keywords.filter(Boolean) : [];
    if (keywords.length === 0) return jsonError('必须至少配置一个竞品关键词', 400);

    try {
      const saved = await saveCompetitorConfig(projectId, {
        taskId,
        keywords,
        brandRules: Array.isArray(body.brandRules) ? body.brandRules : undefined,
        overlapWindowDays: body.overlapWindowDays ? Number(body.overlapWindowDays) : undefined,
        rateLimitMs: body.rateLimitMs ? Number(body.rateLimitMs) : undefined,
        maxPagesPerRun: body.maxPagesPerRun ? Number(body.maxPagesPerRun) : undefined,
        pageSize: body.pageSize ? Number(body.pageSize) : undefined,
      });
      return Response.json({ ok: true, config: saved });
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : '保存配置失败', 500);
    }
  }

  if (action === 'trigger_sync') {
    try {
      const config = await getCompetitorConfig(projectId);
      if (!config || !config.isConfigured || !config.taskId) {
        return jsonError('项目未配置竞品任务，无法排队', 400);
      }
      const queueRes = await queueCompetitorSyncTask(projectId, {
        taskId: config.taskId,
        keywords: Array.isArray(body.keywords) && body.keywords.length ? body.keywords : config.keywords,
        from: body.from ? String(body.from) : undefined,
        to: body.to ? String(body.to) : undefined,
        windowType: body.windowType || 'pubTime',
        maxPagesPerRun: body.maxPagesPerRun ? Number(body.maxPagesPerRun) : config.maxPagesPerRun,
        pageSize: body.pageSize ? Number(body.pageSize) : config.pageSize,
        overlapWindowDays: config.overlapWindowDays,
        rateLimitMs: config.rateLimitMs,
      });

      return Response.json({
        ok: true,
        queued: true,
        jobId: queueRes.requestId,
        taskId: queueRes.taskId,
        message: '已成功写入持久化调度队列，等待独立 worker claim lease 执行',
      }, { status: 202 });
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : '排队失败', 500);
    }
  }

  if (action === 'reset_checkpoints') {
    try {
      const config = await getCompetitorConfig(projectId);
      if (config) {
        await saveCompetitorConfig(projectId, {
          syncCheckpoints: {},
          lastError: null,
          syncStatus: 'idle',
        });
      }
      return Response.json({ ok: true, message: '已重置同步游标与 Checkpoints' });
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : '重置失败', 500);
    }
  }

  return jsonError('不支持的操作类型', 400);
}
