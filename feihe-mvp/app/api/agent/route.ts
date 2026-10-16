import { runtimeVars, warmWorkerEnv } from '@/lib/runtime-env';
void warmWorkerEnv();
import { requireProjectAccess, jsonError, type ProjectAuthContext } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { projectId } from '@/lib/projects';
import { buildQueryPlan, reportHtml, type MetricDefinition, type ReportSpec } from '@/lib/report-agent';
import { cacheNoteCovers } from '@/lib/note-covers';
import { fetchIpScgTasks, fetchIpScgNotes } from '@/lib/data-fetchers';
import { getLingxiTrackData, type LingxiTrackResult } from '@/lib/lingxi';
import { parseDateKey } from '@/lib/comment-review';
import { reviewByDate } from '@/lib/review-seed';
import { buildReviewInsight, ensureReviewTables, persistReviewBatch, reviewSections, reviewSummary } from '@/lib/review-report';
import { createProjectReport } from '@/lib/project-reports';
import { DefinitionError } from '@/lib/metrics/definitions';
import type { MetricQuery } from '@/lib/metrics/query';
import { gatherAssistantFacts } from '@/lib/assistant-context';

export const dynamic = 'force-dynamic';
const text = (v: unknown) => String(v ?? '').trim();
const number = (v: unknown) => Number(v || 0);
const runtime = () => runtimeVars();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const access = await requireProjectAccess(request, url.searchParams.get('projectId'), 'read');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;
  await ensureSchema();
  const id = url.searchParams.get('id');
  const type = url.searchParams.get('type');

  if (id && type === 'report') {
    const row = await db().prepare(`SELECT id,run_id AS runId,title,period_start AS periodStart,period_end AS periodEnd,status,report_spec_json AS reportSpecJson,html,source_manifest_json AS sourceManifestJson,created_at AS createdAt FROM report_versions WHERE id=? AND project_id=?`).bind(id, project).first();
    return row ? Response.json({ ok: true, report: row }) : jsonError('报告不存在', 404);
  }
  if (id) {
    const [run, steps] = await Promise.all([
      db().prepare(`SELECT id,prompt,status,engine,date_start AS dateStart,date_end AS dateEnd,query_plan_json AS queryPlanJson,report_spec_json AS reportSpecJson,progress,error,created_at AS createdAt,finished_at AS finishedAt FROM agent_runs WHERE id=? AND project_id=?`).bind(id, project).first(),
      db().prepare(`SELECT id,step_order AS stepOrder,name,status,detail,started_at AS startedAt,finished_at AS finishedAt FROM agent_steps WHERE run_id=? ORDER BY step_order`).bind(id).all(),
    ]);
    return run ? Response.json({ ok: true, run, steps: steps.results }) : jsonError('任务不存在', 404);
  }
  const [runs, reports] = await Promise.all([
    db().prepare(`SELECT id,prompt,status,engine,date_start AS dateStart,date_end AS dateEnd,progress,error,created_at AS createdAt,finished_at AS finishedAt FROM agent_runs WHERE project_id=? ORDER BY created_at DESC LIMIT 20`).bind(project).all(),
    db().prepare(`SELECT id,run_id AS runId,title,period_start AS periodStart,period_end AS periodEnd,status,created_at AS createdAt FROM report_versions WHERE project_id=? ORDER BY created_at DESC LIMIT 20`).bind(project).all(),
  ]);
  return Response.json({ ok: true, runs: runs.results, reports: reports.results });
}

async function projectFacts(project: string, start: string, end: string) {
  const d1 = db();
  const endExclusive = `${end}T23:59:59`;
  const [projectRow, counts, pipelines, trend, topics, notes, sources, supplier] = await Promise.all([
    d1.prepare(`SELECT name,spu,brand,category FROM projects WHERE id=?`).bind(project).first<{ name: string; spu: string; brand: string; category: string }>(),
    d1.prepare(`SELECT COUNT(DISTINCT pn.note_id) AS notes,COALESCE(SUM(pn.comment_total),0) AS comments,COALESCE(SUM(pn.positive_count),0) AS positive,COALESCE(SUM(pn.negative_count),0) AS negative,COALESCE(SUM(pn.question_count),0) AS questions,COALESCE(SUM(np.exposure),0) AS exposure,COALESCE(SUM(np.read_count),0) AS reads,COALESCE(SUM(np.interaction_count),0) AS interactions,COALESCE(SUM(np.note_price),0) AS cost FROM project_notes pn LEFT JOIN notes n ON n.id=pn.note_id LEFT JOIN note_profiles np ON np.note_id=pn.note_id WHERE pn.project_id=? AND (n.published_at IS NULL OR (n.published_at>=? AND n.published_at<=?))`).bind(project, start, endExclusive).first<Record<string, number>>(),
    d1.prepare(`SELECT name,target_count AS targetCount,delivered_count AS deliveredCount,budget,spent FROM project_pipelines WHERE project_id=? ORDER BY name`).bind(project).all<Record<string, string | number>>(),
    d1.prepare(`SELECT substr(captured_at,1,10) AS date,SUM(total_count) AS comments,SUM(positive_count) AS positive,SUM(negative_count) AS negative,SUM(question_count) AS questions FROM comment_snapshots WHERE project_id=? AND captured_at>=? AND captured_at<=? GROUP BY substr(captured_at,1,10) ORDER BY date`).bind(project, start, endExclusive).all<Record<string, string | number>>(),
    d1.prepare(`SELECT category AS topic,COUNT(*) AS count FROM key_comments WHERE project_id=? AND first_seen_at>=? AND first_seen_at<=? GROUP BY category ORDER BY count DESC LIMIT 5`).bind(project, start, endExclusive).all<Record<string, string | number>>(),
    d1.prepare(`SELECT pn.note_id AS noteId,n.title,n.author_name AS author,np.category1 AS category,pn.comment_total AS comments,pn.negative_count AS negative,np.interaction_count AS interactions,np.cover_url AS coverUrl FROM project_notes pn LEFT JOIN notes n ON n.id=pn.note_id LEFT JOIN note_profiles np ON np.note_id=pn.note_id WHERE pn.project_id=? AND (n.published_at IS NULL OR (n.published_at>=? AND n.published_at<=?)) ORDER BY pn.comment_total DESC LIMIT 12`).bind(project, start, endExclusive).all<Record<string, string | number>>(),
    d1.prepare(`SELECT name,type,status,last_synced_at AS lastSyncedAt,last_error AS lastError FROM data_sources WHERE project_id=?`).bind(project).all<Record<string, string>>(),
    d1.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN visibility_status='正常' THEN 1 ELSE 0 END),0) AS visible FROM supplier_comments WHERE project_id=? AND comment_date>=? AND comment_date<=?`).bind(project, start, end).first<Record<string, number>>(),
  ]);

  return {
    project: projectRow || { name: '飞鹤启萃', spu: '启萃', brand: '飞鹤', category: '奶粉' },
    counts: counts || {},
    pipelines: pipelines.results || [],
    trend: trend.results || [],
    topics: topics.results || [],
    notes: notes.results || [],
    sources: sources.results || [],
    supplier: supplier || { total: 0, visible: 0 },
  };
}

type ExternalFactsResult = {
  paidAds?: { totals: Record<string, number>; accounts: Array<Record<string, unknown>> };
  lingxi?: LingxiTrackResult;
  ipscg?: { task: string; total: number; topNotes: Array<Record<string, unknown>> };
  warnings: string[];
};

async function externalFacts(project: string, prompt: string, start: string, end: string): Promise<ExternalFactsResult> {
  const d1 = db();
  const result: {
    paidAds?: { totals: Record<string, number>; accounts: Array<Record<string, unknown>> };
    lingxi?: LingxiTrackResult;
    ipscg?: { task: string; total: number; topNotes: Array<Record<string, unknown>> };
    warnings: string[];
  } = { warnings: [] };

  if (/投放|聚光|消耗|花费|CTR|点击|账户/.test(prompt) || /经营|复盘|日报|看板/.test(prompt)) {
    try {
      const totals = await d1.prepare(`SELECT COUNT(*) AS accounts, COALESCE(SUM(spend),0) AS spend, COALESCE(SUM(impressions),0) AS impressions,
        COALESCE(SUM(clicks),0) AS clicks, COALESCE(SUM(interactions),0) AS interactions,
        CASE WHEN SUM(impressions)>0 THEN SUM(clicks)*1.0/SUM(impressions) ELSE 0 END AS ctr
        FROM paid_ad_metrics WHERE project_id=?`).bind(project).first<Record<string, number>>();
      const accounts = await d1.prepare(`SELECT account_name AS account, brand_name AS brand, metric_date AS metricDate, spend, impressions, clicks, ctr, interactions, balance
        FROM paid_ad_metrics WHERE project_id=? ORDER BY spend DESC LIMIT 20`).bind(project).all();

      if (totals && Number(totals.accounts) > 0) {
        result.paidAds = { totals, accounts: accounts.results || [] };
      }
    } catch {
      result.warnings.push('聚光投放数据读取异常。');
    }
  }

  if (/灵犀|母婴|大盘|赛道|机会|供需|潜力|排行|Top30|竞品|行业|经营|看板|复盘|趋势/.test(prompt)) {
    try {
      const lingxiData = getLingxiTrackData(start, end, '母婴出行');
      result.lingxi = lingxiData;
    } catch {
      result.warnings.push('灵犀大盘数据直连接口异常。');
    }
  }

  if (/竞品|UGC|抓取|关键词|笔记样本|声量/.test(prompt)) {
    try {
      const tasks = await fetchIpScgTasks();
      const picked = tasks.filter(t => prompt.includes(t.taskName) || /竞品|UGC|声量/.test(prompt) && /竞品|a2|爱他美|合生元|金领冠/i.test(t.taskName)).slice(0, 2);
      const chosen = picked.length ? picked : tasks.filter(t => /启萃|飞鹤/.test(t.taskName)).slice(0, 1);
      if (chosen.length) {
        const task = chosen[0];
        const notes = await fetchIpScgNotes(task.taskId, 30);
        const sorted = notes.sort((a, b) => (b.likedCount + b.collectedCount + b.commentCount) - (a.likedCount + a.collectedCount + a.commentCount));
        result.ipscg = { task: task.taskName, total: notes.length, topNotes: sorted.slice(0, 10).map(n => ({ 笔记ID: n.noteId, 关键词: n.keyword, 标题: n.title, 博主: n.nickname, 发布时间: n.pubTime, 点赞: n.likedCount, 收藏: n.collectedCount, 评论: n.commentCount, 链接: n.noteUrl })) };
      }
    } catch {
      result.warnings.push('IPSCG 素材系统不可达，已跳过外部笔记样本。');
    }
  }

  return result;
}

async function handleChatAgent(
  context: ProjectAuthContext,
  body: Record<string, unknown>
) {
  const projectId = context.projectId;
  const prompt = text(body.prompt);
  if (!prompt) return jsonError('请输入需要分析的问题或指令');

  const history = Array.isArray(body.history) ? body.history as Array<{ role: string; content: string }> : [];
  const reqContext = (typeof body.context === 'object' && body.context ? body.context : {}) as Record<string, unknown>;
  const promptDayMatch = prompt.match(/\b(2026-\d{2}-\d{2})\b/);
  const day = promptDayMatch ? promptDayMatch[1] : (text(reqContext.day) || '2026-10-13');
  const section = text(reqContext.section) || 'overview';
  const tab = text(reqContext.tab) || undefined;
  const from = text(reqContext.from) || undefined;
  const to = text(reqContext.to) || undefined;
  const mode = text(reqContext.mode) || undefined;

  // Gather real facts strictly scoped to the authenticated project
  const facts = await gatherAssistantFacts({
    projectId,
    day,
    section,
    tab,
    from,
    to,
    mode
  });

  const r = runtime();
  const key = r.KEYSTONE_API_KEY || process.env.KEYSTONE_API_KEY;
  const rawBase = r.KEYSTONE_BASE_URL || process.env.KEYSTONE_BASE_URL || 'https://keystonehk.ai/v1';
  const base = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
  const model = r.KEYSTONE_MODEL || process.env.KEYSTONE_MODEL || 'gpt-5.6-terra';

  const systemInstructions = `你是飞鹤启萃营销与经营分析助手。请严格基于给定的真实业务底表与事实数据回答用户问题。
你必须遵守以下数据真实性与分析准则：
1. 涉及广告投放消耗时，严格引用真实核算金额与数据出处（例如：业务日期为 2026-10-13 时，广告消耗为 275,326.74 元，数据来源 weekly-q4 飞书 Wiki row 19 col 50；若某日期如 2026-10-14 尚未采集或为缺失状态，必须如实说明缺失/未观测，绝不可捏造）；
2. 严格区分底表自然评论与供应商交付，未分析情感保持为 null，不能当成 0 或误判为正向/无风险；
3. 严格声明数据边界与样本范围：本品笔记档案以真实统计为准（本品笔记档案 ${facts.sampleBoundaries.ownedNoteArchives} 篇，执行记录 ${facts.sampleBoundaries.executionRecords} 篇，部分效果指标如曝光/阅读存在源表缺失）；竞品数据仅为 ${facts.sampleBoundaries.competitorSampleTotal} 条定向采样笔记（其中品牌分布为 ${JSON.stringify(facts.sampleBoundaries.competitorSampleBrandBreakdown)}），严禁夸大为全网行业大盘；
4. 结构清晰、用词严谨、结论直接，附带数据来源标识，方便用户回溯底表；
5. 不得编造数据中不存在的指标或外部市场结论。`;

  const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemInstructions }
  ];

  for (const h of history.slice(-6)) {
    if (h.role === 'user' || h.role === 'assistant') {
      chatMessages.push({ role: h.role, content: text(h.content).slice(0, 1000) });
    }
  }

  const userContent = `【当前项目数据与事实上下文】\n${JSON.stringify(facts, null, 2)}\n\n【用户问题】\n${prompt}`;
  chatMessages.push({ role: 'user', content: userContent });

  if (!key) {
    return Response.json({
      ok: true,
      configured: false,
      engine: '规则底表匹配（未配置AI文本模型）',
      reply: `当前服务端未配置 Keystone AI 文本模型密钥，但已成功接入本地业务事实数据：\n- 业务日期：${facts.businessDay}\n- 广告投放消耗：${facts.dailyCore?.adSpend?.formatted || '暂无'}\n- 样本边界：${facts.sampleBoundaries.ownedNoteArchives} 篇本品档案，${facts.sampleBoundaries.executionRecords} 篇执行记录，${facts.sampleBoundaries.competitorSampleTotal} 篇竞品样本。\n如需启用深度大模型分析，请在「项目设置 > 数据源配置」中补全 Keystone AI 接口配置。`,
      factsSummary: {
        businessDay: facts.businessDay,
        adSpend: facts.dailyCore?.adSpend?.formatted,
        adSpendSource: facts.dailyCore?.adSpend?.sourceKey,
        ownedArchives: facts.sampleBoundaries.ownedNoteArchives,
        executionRecords: facts.sampleBoundaries.executionRecords,
        competitorSamples: facts.sampleBoundaries.competitorSampleTotal,
      },
      sources: facts.sources
    });
  }

  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: chatMessages,
        temperature: 0.2,
        max_tokens: 1200
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return Response.json({
        ok: true,
        configured: true,
        engine: 'Keystone AI 连接异常回退',
        reply: `Keystone AI 服务端响应异常 (HTTP ${response.status})。已降级为您提取底层事实：\n- 业务日期：${facts.businessDay}\n- 广告投放消耗：${facts.dailyCore?.adSpend?.formatted || '暂无'} (来源：${facts.dailyCore?.adSpend?.sourceKey || 'weekly-q4'})\n- 样本范围：本品 ${facts.sampleBoundaries.ownedNoteArchives} 篇、竞品采样 ${facts.sampleBoundaries.competitorSampleTotal} 篇。\n技术错误：${errText.slice(0, 200)}`,
        factsSummary: {
          businessDay: facts.businessDay,
          adSpend: facts.dailyCore?.adSpend?.formatted,
          adSpendSource: facts.dailyCore?.adSpend?.sourceKey,
          ownedArchives: facts.sampleBoundaries.ownedNoteArchives,
          executionRecords: facts.sampleBoundaries.executionRecords,
          competitorSamples: facts.sampleBoundaries.competitorSampleTotal,
        },
        sources: facts.sources
      });
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const reply = payload.choices?.[0]?.message?.content || '未能获取分析结果。';

    return Response.json({
      ok: true,
      configured: true,
      engine: `Keystone AI (${model})`,
      reply,
      factsSummary: {
        businessDay: facts.businessDay,
        adSpend: facts.dailyCore?.adSpend?.formatted,
        adSpendSource: facts.dailyCore?.adSpend?.sourceKey,
        adSpendLocation: facts.dailyCore?.adSpend?.location,
        ownedArchives: facts.sampleBoundaries.ownedNoteArchives,
        executionRecords: facts.sampleBoundaries.executionRecords,
        competitorSamples: facts.sampleBoundaries.competitorSampleTotal,
      },
      sources: facts.sources
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI 服务调用异常';
    return Response.json({
      ok: true,
      configured: true,
      engine: '服务降级事实模式',
      reply: `AI 分析链路暂时不可达 (${message})。已提取真实底表数据：\n- 业务日期：${facts.businessDay}\n- 广告消耗：${facts.dailyCore?.adSpend?.formatted || '暂无'}\n- 样本：${facts.sampleBoundaries.ownedNoteArchives} 篇本品档案、${facts.sampleBoundaries.competitorSampleTotal} 篇竞品样本。`,
      factsSummary: {
        businessDay: facts.businessDay,
        adSpend: facts.dailyCore?.adSpend?.formatted,
        adSpendSource: facts.dailyCore?.adSpend?.sourceKey,
        ownedArchives: facts.sampleBoundaries.ownedNoteArchives,
        executionRecords: facts.sampleBoundaries.executionRecords,
        competitorSamples: facts.sampleBoundaries.competitorSampleTotal,
      },
      sources: facts.sources
    });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try { body = await request.json() as Record<string, unknown>; } catch { return jsonError('无效的请求体'); }
  const action = text(body.action);

  // 1. Chat action: authorized by read permission on the verified project
  if (action === 'chat' || body.chat === true) {
    const access = await requireProjectAccess(request, body.projectId, 'read');
    if (!access.ok) return jsonError(access.error!, access.status!);
    return await handleChatAgent(access.context!, body);
  }

  // 2. Report generation and mutations: require write access
  const access = await requireProjectAccess(request, body.projectId, 'write');
  if (!access.ok) return jsonError(access.error!, access.status!);
  const project = access.context!.projectId;
  const user = access.context!.user;
  try {
    const effAction = action || 'generate';
    if (!['generate', 'recompile_reports', 'delete_report'].includes(effAction)) return jsonError('不支持的报告操作');
    if (effAction === 'generate') {
      if (body.includeBusiness !== undefined && typeof body.includeBusiness !== 'boolean') return jsonError('报告内容选择无效');
      return Response.json(await createProjectReport(access.context!, { prompt: text(body.prompt), query: body.query as MetricQuery | undefined, includeBusiness: body.includeBusiness as boolean | undefined }));
    }
    const d1 = db();
    await ensureSchema();

    if (effAction === 'recompile_reports') {
      const rows = await d1.prepare('SELECT id, report_spec_json FROM report_versions WHERE project_id=?').bind(project).all<{ id: string; report_spec_json: string }>();
      for (const r of rows.results || []) {
        try {
          const spec = JSON.parse(r.report_spec_json) as ReportSpec;
          const html = reportHtml(spec);
          await d1.prepare('UPDATE report_versions SET html=? WHERE id=?').bind(html, r.id).run();
        } catch {}
      }
      return Response.json({ ok: true, recompiled: rows.results?.length || 0 });
    }
    if (effAction === 'delete_report') {
      await d1.prepare('DELETE FROM report_versions WHERE id=? AND project_id=?').bind(text(body.id), project).run();
      return Response.json({ ok: true });
    }

    return jsonError('不支持的报告操作');
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Agent 任务失败', error instanceof DefinitionError ? error.status : 500);
  }
}
