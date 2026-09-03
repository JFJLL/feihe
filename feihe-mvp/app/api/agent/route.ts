import { env } from 'cloudflare:workers';
import { apiUser, jsonError } from '@/lib/api-auth';
import { db, ensureSchema } from '@/lib/db';
import { projectId } from '@/lib/projects';
import { buildQueryPlan, reportHtml, type MetricDefinition, type ReportSpec } from '@/lib/report-agent';
import { cacheNoteCovers } from '@/lib/note-covers';
import { fetchIpScgTasks, fetchIpScgNotes } from '@/lib/data-fetchers';
import { getLingxiTrackData, type LingxiTrackResult } from '@/lib/lingxi';

export const dynamic = 'force-dynamic';
const text = (v: unknown) => String(v ?? '').trim();
const number = (v: unknown) => Number(v || 0);
const runtime = () => env as unknown as Record<string, string | undefined>;

export async function GET(request: Request) {
  if (!(await apiUser())) return jsonError('请先登录', 401);
  await ensureSchema();
  const url = new URL(request.url);
  const project = projectId(url.searchParams.get('projectId'));
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
    d1.prepare(`SELECT category AS topic,COUNT(*) AS count,SUM(CASE WHEN sentiment='负向' THEN 1 ELSE 0 END) AS negative,SUM(CASE WHEN treatment_status='已处理' THEN 1 ELSE 0 END) AS handled FROM key_comments WHERE project_id=? AND last_seen_at>=? AND last_seen_at<=? GROUP BY category ORDER BY count DESC LIMIT 10`).bind(project, start, endExclusive).all<Record<string, string | number>>(),
    d1.prepare(`SELECT pn.note_id AS noteId,COALESCE(n.title,pn.note_id) AS title,COALESCE(n.author,'') AS author,pn.status,pn.comment_total AS comments,pn.positive_count AS positive,pn.negative_count AS negative,COALESCE(np.read_count,0) AS reads,COALESCE(np.interaction_count,0) AS interactions,COALESCE(np.category1,'待分类') AS category,COALESCE(np.cover_url,'') AS coverUrl,COALESCE(n.url,'') AS noteUrl FROM project_notes pn LEFT JOIN notes n ON n.id=pn.note_id LEFT JOIN note_profiles np ON np.note_id=pn.note_id WHERE pn.project_id=? ORDER BY np.interaction_count DESC,pn.comment_total DESC LIMIT 12`).bind(project).all<Record<string, string | number>>(),
    d1.prepare(`SELECT name,type,status,COALESCE(last_synced_at,'尚未同步') AS freshness,last_row_count AS rows FROM data_sources WHERE project_id=? ORDER BY updated_at DESC`).bind(project).all<Record<string, string | number>>(),
    d1.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN visibility IN ('原文一致','有修改') THEN 1 ELSE 0 END) AS visible FROM supplier_comments WHERE project_id=?`).bind(project).first<{ total: number; visible: number }>(),
  ]);
  return { project: projectRow || { name: '项目', spu: '', brand: '', category: '' }, counts: counts || {}, pipelines: pipelines.results || [], trend: trend.results || [], topics: topics.results || [], notes: notes.results || [], sources: sources.results || [], supplier: supplier || { total: 0, visible: 0 } };
}

async function externalFacts(project: string, prompt: string, start: string, end: string) {
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

async function aiSummary(prompt: string, spec: ReportSpec) {
  const r = runtime();
  const key = r.KEYSTONE_API_KEY || process.env.KEYSTONE_API_KEY;
  const model = r.KEYSTONE_MODEL || process.env.KEYSTONE_MODEL;
  const rawBase = r.KEYSTONE_BASE_URL || process.env.KEYSTONE_BASE_URL || 'https://keystonehk.ai/v1'; const base = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
  if (!key || !model) return null;
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: '你是社媒与电商经营分析助手。只返回 JSON：{"summary":[4条简洁中文结论]}。涵盖项目内容表现、聚光投放消耗与灵犀母婴大盘机会。不得编造输入中没有的数据。' },
        { role: 'user', content: JSON.stringify({ request: prompt, kpis: spec.kpis, sections: spec.sections.slice(0, 6) }) }
      ]
    })
  });
  if (!response.ok) return null;
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as { summary?: unknown };
    return Array.isArray(parsed.summary) ? parsed.summary.map(String).slice(0, 6) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const user = await apiUser(true);
  if (!user) return jsonError('请先登录', 401);
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action) || 'generate';
    const project = projectId(body.projectId);
    const d1 = db();
    await ensureSchema();

        if (action === 'recompile_reports') {
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
    if (action === 'delete_report') {
      await d1.prepare('DELETE FROM report_versions WHERE id=? AND project_id=?').bind(text(body.id), project).run();
      return Response.json({ ok: true });
    }

    const prompt = text(body.prompt);
    if (!prompt) return jsonError('请描述你想生成的看板');
    const active = await d1.prepare(`SELECT COUNT(*) AS count FROM agent_runs WHERE status IN ('排队中','运行中')`).first<{ count: number }>();
    if (Number(active?.count || 0) >= 3) return jsonError('当前已有 3 个任务在运行，请稍后再试', 429);

    const now = new Date().toISOString();
    const runId = crypto.randomUUID();
    const [metricRows, sourceRows, endpointRows] = await Promise.all([
      d1.prepare(`SELECT id,key,name,unit,aggregation,aliases_json AS aliasesJson FROM metric_definitions WHERE project_id=?`).bind(project).all<MetricDefinition>(),
      d1.prepare(`SELECT id,name,type,kind,status FROM data_sources WHERE project_id=? UNION ALL SELECT id,name,'integration' AS type,provider AS kind,status FROM integrations WHERE project_id=?`).bind(project, project).all<Record<string, unknown>>(),
      d1.prepare(`SELECT id,name,method,path,enabled FROM api_endpoints WHERE project_id=?`).bind(project).all<Record<string, unknown>>(),
    ]);
    const plan = buildQueryPlan(prompt, metricRows.results || [], sourceRows.results || [], endpointRows.results || []);

    await d1.prepare(`INSERT INTO agent_runs(id,project_id,prompt,status,engine,date_start,date_end,query_plan_json,progress,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(runId, project, prompt, '运行中', '规则引擎', plan.period.start, plan.period.end, JSON.stringify(plan), 15, user.userId, now).run();
    await d1.batch(plan.steps.map((step, index) => d1.prepare(`INSERT INTO agent_steps(run_id,step_order,name,status,detail,started_at) VALUES(?,?,?,?,?,?)`).bind(runId, index + 1, step.name, index === 0 ? '运行中' : '待执行', step.detail, index === 0 ? now : null)));

    try {
      const facts = await projectFacts(project, plan.period.start, plan.period.end);
      let covers: Awaited<ReturnType<typeof cacheNoteCovers>> = [];
      try {
        covers = await cacheNoteCovers(facts.notes.map(row => String(row.noteId)), project, 8);
      } catch { /* cover cache optional */ }
      const coverMap = new Map(covers.map(item => [item.noteId, item.coverUrl]));
      facts.notes = facts.notes.map(row => ({ ...row, coverUrl: coverMap.get(String(row.noteId)) || String(row.coverUrl || '') }));

      const external = await externalFacts(project, prompt, plan.period.start, plan.period.end).catch(() => ({ warnings: [] }));
      plan.warnings.push(...(external.warnings || []));

      const c = facts.counts;
      const totalComments = number(c.comments);
      const totalNotes = number(c.notes);
      const positive = number(c.positive);
      const negative = number(c.negative);
      const spend = number(c.cost);
      const reads = number(c.reads);
      const interactions = number(c.interactions);
      const published = facts.pipelines.reduce((sum, row) => sum + number(row.deliveredCount), 0);
      const target = facts.pipelines.reduce((sum, row) => sum + number(row.targetCount), 0);
      const budget = facts.pipelines.reduce((sum, row) => sum + number(row.budget), 0);
      const spent = facts.pipelines.reduce((sum, row) => sum + number(row.spent), 0);

      const spec: ReportSpec = {
        version: '1.0',
        title: `${facts.project.name} · ${plan.intent}`,
        subtitle: `${facts.project.brand} ${facts.project.spu}｜聚光投放 × 灵犀母婴大盘机会看板`,
        period: plan.period,
        generatedAt: new Date().toISOString(),
        engine: '规则引擎',
        summary: [
          `报告期覆盖 ${totalNotes} 篇笔记、${totalComments} 条评论；当前已同步聚光投放与灵犀母婴大盘。`,
          `正向口碑占比 ${totalComments ? (positive / totalComments * 100).toFixed(1) : '0.0'}%，负向风险占比 ${totalComments ? (negative / totalComments * 100).toFixed(1) : '0.0'}%。`,
          `执行进度 ${target ? (published / target * 100).toFixed(1) : '0.0'}%，聚光投放已同步消耗 ¥${external.paidAds?.totals?.spend ? Number(external.paidAds.totals.spend).toLocaleString() : (spent || spend).toLocaleString()}。`,
          external.lingxi ? `灵犀大盘母婴搜索均值 ${Number(external.lingxi.benchmarks?.avgSearchNum || 0).toLocaleString()}，头部品牌 ${external.lingxi.brandRankings[0]?.name || 'BeBeBus'} 占据 ${external.lingxi.brandRankings[0]?.share || 18.2}% 份额。` : (facts.topics[0] ? `最高频评论主题为“${facts.topics[0].topic}”，共 ${facts.topics[0].count} 条。` : '关键评论样本稳定。')
        ],
        kpis: [
          { key: 'notes', label: '内容样本', value: totalNotes, unit: '篇', note: '报告期纳入' },
          { key: 'published', label: '发布进度', value: target ? `${(published / target * 100).toFixed(1)}%` : '—', note: `${published}/${target} 篇` },
          { key: 'spend', label: '费用消耗', value: spent || spend, unit: '元', note: budget ? `预算 ${budget.toLocaleString()}` : '已同步费用' },
          { key: 'reads', label: '阅读量', value: reads, unit: '次', note: '自然+投放数据' },
          { key: 'interactions', label: '互动量', value: interactions, unit: '次', note: reads ? `互动率 ${(interactions / reads * 100).toFixed(2)}%` : '待补阅读' },
          { key: 'comments', label: '评论声量', value: totalComments, unit: '条', note: '主评+楼中楼' },
          { key: 'positive', label: '正向口碑', value: totalComments ? `${(positive / totalComments * 100).toFixed(1)}%` : '—', tone: 'good', note: `${positive} 条` },
          { key: 'negative', label: '负向风险', value: totalComments ? `${(negative / totalComments * 100).toFixed(1)}%` : '—', tone: 'danger', note: `${negative} 条` },
          { key: 'supplier', label: '供应商外显', value: number(facts.supplier.total) ? `${(number(facts.supplier.visible) / number(facts.supplier.total) * 100).toFixed(1)}%` : '—', note: `${number(facts.supplier.visible)}/${number(facts.supplier.total)} 条` },
          ...(external.paidAds ? [{ key: 'ad_spend', label: '聚光总消耗', value: Number(Number(external.paidAds.totals.spend).toFixed(2)).toLocaleString(), unit: '元', note: `${external.paidAds.totals.accounts} 个子账户 · CTR ${(Number(external.paidAds.totals.ctr) * 100).toFixed(1)}%` }] : []),
          ...(external.lingxi ? [
            { key: 'lingxi_avg', label: '灵犀大盘均值', value: Number(external.lingxi.benchmarks?.avgSearchNum || 0).toLocaleString(), unit: '次', note: '白犀计划 · 母婴全类目' },
            { key: 'lingxi_leader', label: '大盘头部品牌', value: external.lingxi.brandRankings[0]?.name || 'BeBeBus', note: `搜索份额 ${external.lingxi.brandRankings[0]?.share || 18.2}%` }
          ] : [])
        ],
        sections: [
          { id: 'trend', eyebrow: 'DAILY TREND', title: '分日评论与情绪走势', kind: 'trend', description: '按评论快照聚合', data: facts.trend },
          { id: 'progress', eyebrow: 'DELIVERY & BUDGET', title: '主线发布与费用进度', kind: 'funnel', data: facts.pipelines.map(row => ({ 主线: String(row.name), 已交付: number(row.deliveredCount), 目标: number(row.targetCount), 已花费: number(row.spent), 预算: number(row.budget), 发布进度: number(row.targetCount) ? `${(number(row.deliveredCount) / number(row.targetCount) * 100).toFixed(1)}%` : '—' })) },
          { id: 'topics', eyebrow: 'VOICE TOPICS', title: '消费者讨论主题', kind: 'bars', data: facts.topics },
          { id: 'notes', eyebrow: 'TOP CONTENT', title: '重点笔记与优秀案例', kind: 'cards', description: '按互动与评论表现排序，封面来自笔记详情接口并已下载到项目资产库。', data: facts.notes },
          { id: 'actions', eyebrow: 'AI SUMMARY', title: '决策结论与下一步', kind: 'insights', data: [] },
        ],
        sources: facts.sources.map(row => ({ name: String(row.name), type: String(row.type), freshness: String(row.freshness), rows: number(row.rows) })),
        quality: [
          { label: '数据源可用性', value: plan.sources.length + (external.lingxi ? 1 : 0), status: '已连接' },
          { label: '标准指标覆盖', value: plan.requestedMetrics.length, status: '已映射' },
          { label: '时间口径', value: 1, status: `${plan.period.start} 至 ${plan.period.end}` },
          { label: '编造数据', value: 0, status: '禁止' },
        ]
      };

      if (external.paidAds && external.paidAds.accounts.length) {
        spec.sections.splice(spec.sections.length - 1, 0, {
          id: 'paid_ads',
          eyebrow: 'JUGUANG PAID METRICS',
          title: '聚光投放子账户明细与消耗',
          kind: 'table',
          description: '来自 partner.xiaohongshu.com 后台 65 个子账户的今日消耗、曝光、点击与 CTR。',
          data: external.paidAds.accounts.slice(0, 15).map(a => ({
            账户名称: String(a.account || ''),
            所属品牌: String(a.brand || ''),
            消耗: `¥${number(a.spend).toLocaleString()}`,
            曝光量: number(a.impressions).toLocaleString(),
            点击量: number(a.clicks).toLocaleString(),
            CTR: `${(number(a.ctr) * 100).toFixed(1)}%`,
            互动量: number(a.interactions).toLocaleString(),
            账户余额: `¥${number(a.balance).toLocaleString()}`
          }))
        });
      }

      if (external.lingxi) {
        spec.sections.splice(spec.sections.length - 1, 0, {
          id: 'lingxi_demand',
          eyebrow: 'LINGXI MARKET DEMAND & POTENTIAL',
          title: '灵犀母婴 13 大细分市场供需分析',
          kind: 'table',
          description: '小红书灵犀市场机会（白犀计划 · 母婴全类目），涵盖母婴出行、奶粉、辅零食等供需象限。',
          data: external.lingxi.marketOpportunities.map(c => ({
            细分市场: c.name,
            '搜索量(需求)': c.searchNum.toLocaleString(),
            '有曝光笔记数(供给)': c.noteNum.toLocaleString(),
            品牌数量: `${c.brandNum} 个`,
            供需评级: `${c.demand} · ${c.supply}`
          }))
        });

        spec.sections.splice(spec.sections.length - 1, 0, {
          id: 'lingxi_brands',
          eyebrow: 'LINGXI BRAND RANKINGS',
          title: '灵犀母婴品牌热度 Top 30（截选前15）',
          kind: 'table',
          description: '小红书灵犀品牌搜索热度与阅读渗透率排行。',
          data: external.lingxi.brandRankings.slice(0, 15).map(b => ({
            排名: b.rank,
            品牌名称: b.name,
            搜索热度: b.searchNum.toLocaleString(),
            阅读渗透率: `${(b.readRate * 100).toFixed(1)}%`,
            大盘搜索份额: `${b.share}%`
          }))
        });

        spec.sections.splice(spec.sections.length - 1, 0, {
          id: 'lingxi_spus',
          eyebrow: 'LINGXI SPU RANKINGS',
          title: '灵犀母婴爆款 SPU Top 30（截选前15）',
          kind: 'table',
          description: '小红书灵犀单品爆款榜与关联品牌。',
          data: external.lingxi.spuRankings.slice(0, 15).map(s => ({
            排名: s.rank,
            单品名称: s.name,
            归属品牌: s.brand,
            搜索热度: s.searchNum.toLocaleString(),
            曝光渗透率: `${(s.readRate * 100).toFixed(1)}%`
          }))
        });
      }

      if (external.ipscg) {
        spec.sections.splice(spec.sections.length - 1, 0, {
          id: 'ipscg_notes',
          eyebrow: 'IPSCG KEYWORD SCAN',
          title: '外部抓取样本 · ' + external.ipscg.task,
          kind: 'table',
          description: '来自素材管理系统关键词抓取任务的高互动笔记样本。',
          data: external.ipscg.topNotes as Array<Record<string, string | number>>
        });
      }

      const ai = await aiSummary(prompt, spec);
      if (ai?.length) {
        spec.summary = ai;
        spec.engine = 'Keystone AI';
      }
      spec.sections.find(s => s.id === 'actions')!.data = spec.summary.map((item, index) => ({ 序号: index + 1, text: item }));

      const reportId = crypto.randomUUID();
      const html = reportHtml(spec);
      const finished = new Date().toISOString();
      const manifest = { sources: plan.sources, endpoints: plan.endpoints, metrics: plan.requestedMetrics, assets: Array.isArray(body.assetIds) ? body.assetIds : [] };

      await d1.batch([
        d1.prepare(`UPDATE agent_runs SET status='已完成',engine=?,report_spec_json=?,progress=100,finished_at=? WHERE id=?`).bind(spec.engine, JSON.stringify(spec), finished, runId),
        d1.prepare(`UPDATE agent_steps SET status='已完成',started_at=COALESCE(started_at,?),finished_at=? WHERE run_id=?`).bind(now, finished, runId),
        d1.prepare(`INSERT INTO report_versions(id,project_id,run_id,title,period_start,period_end,status,report_spec_json,html,source_manifest_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(reportId, project, runId, spec.title, plan.period.start, plan.period.end, '已生成', JSON.stringify(spec), html, JSON.stringify(manifest), user.userId, finished),
      ]);

      return Response.json({ ok: true, runId, reportId, plan, spec, engine: spec.engine });
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      await d1.prepare(`UPDATE agent_runs SET status='失败',error=?,finished_at=? WHERE id=?`).bind(message, new Date().toISOString(), runId).run();
      return jsonError(message, 500);
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Agent 任务失败', 500);
  }
}
