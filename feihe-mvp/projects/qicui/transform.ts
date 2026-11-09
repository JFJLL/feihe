/**
 * Qicui (飞鹤启萃) Board Transformation & Assembly Module
 */

import type { BoardPayload, DatasetTable, SectionSpec, AnalysisCardSpec, ColumnDef } from '../../lib/core/types';
import { manifest } from './manifest';
import { db, ensureSchema } from '../../lib/db';
import { toIsoDate, strictNum } from '../../lib/core/transform-kit';

export async function transformProject(rawSources?: unknown): Promise<BoardPayload> {
  await ensureSchema();
  const d1 = db();

  // 1. Query aggregated summary KPIs from DB
  const noteAgg = await d1.prepare(`
    SELECT
      COUNT(*) AS noteCount,
      COALESCE(SUM(pn.comment_total), 0) AS commentTotal,
      COALESCE(SUM(pn.positive_count), 0) AS positiveCount,
      COALESCE(SUM(pn.negative_count), 0) AS negativeCount,
      COALESCE(SUM(pn.question_count), 0) AS questionCount,
      COALESCE(SUM(p.exposure), 0) AS exposure,
      COALESCE(SUM(p.read_count), 0) AS readCount,
      COALESCE(SUM(p.interaction_count), 0) AS interactionCount,
      COALESCE(SUM(p.note_price), 0) AS creatorCost
    FROM project_notes pn
    LEFT JOIN note_profiles p ON p.note_id = pn.note_id
    WHERE pn.project_id = 'qicui'
  `).first<Record<string, number>>();

  const noteCount = Number(noteAgg?.noteCount ?? 0);
  const commentTotal = noteAgg?.commentTotal || 0;
  const positiveCount = noteAgg?.positiveCount || 0;
  const negativeCount = noteAgg?.negativeCount || 0;
  const exposure = noteAgg?.exposure || 0;
  const readCount = noteAgg?.readCount || 0;
  const interactionCount = noteAgg?.interactionCount || 0;
  const creatorCost = noteAgg?.creatorCost || 0;

  // 2. Query latest business daily report
  const latestDaily = await d1.prepare(`
    SELECT business_day, payload_json
    FROM business_daily_reports
    WHERE project_id = 'qicui'
    ORDER BY business_day DESC, created_at DESC
    LIMIT 1
  `).first<{ business_day: string; payload_json: string }>();

  let latestAdSpend: number | null = null;
  let latestSettlement: number | null = null;
  let latestMonthlyBudget: number | null = null;
  let latestMonthlySettlement: number | null = null;
  let latestCreatorCost: number | null = null;
  let latestProjectInvestment: number | null = null;

  if (latestDaily?.payload_json) {
    try {
      const p = JSON.parse(latestDaily.payload_json);
      const c = p.core || {};
      latestAdSpend = strictNum(c.adSpend?.value ?? c.adSpend);
      latestSettlement = strictNum(c.settlement?.value ?? c.settlement);
      latestMonthlyBudget = strictNum(c.monthlyBudget?.value ?? c.monthlyBudget);
      latestMonthlySettlement = strictNum(c.monthlySettlement?.value ?? c.monthlySettlement);
      latestCreatorCost = strictNum(c.creatorCost?.value ?? c.creatorCost);
      latestProjectInvestment = strictNum(c.projectInvestment?.value ?? c.projectInvestment);
    } catch {}
  }

  // 3. Query all daily rows
  // Deduplicate multiple versions per business_day (confirmed > latest created_at)
  const dailyRowsDb = await d1.prepare(`
    SELECT business_day, status, created_at, payload_json
    FROM business_daily_reports
    WHERE project_id = 'qicui'
    ORDER BY business_day ASC, CASE WHEN status='confirmed' THEN 1 ELSE 0 END DESC, created_at DESC
  `).all<{ business_day: string; status: string; created_at: string; payload_json: string }>();

  const dailyByDay = new Map<string, string>();
  for (const r of dailyRowsDb.results || []) {
    const dayKey = toIsoDate(r.business_day);
    if (dayKey && !dailyByDay.has(dayKey)) {
      dailyByDay.set(dayKey, r.payload_json);
    }
  }

  const dailyFlowRows: Array<Record<string, unknown>> = [];
  for (const [dayKey, payloadJson] of dailyByDay.entries()) {
    let adSpend: number | null = null;
    let creator: number | null = null;
    let totalInvest: number | null = null;
    let settle: number | null = null;
    if (payloadJson) {
      try {
        const p = JSON.parse(payloadJson);
        const c = p.core || {};
        adSpend = strictNum(c.adSpend?.value ?? c.adSpend);
        creator = strictNum(c.creatorCost?.value ?? c.creatorCost);
        totalInvest = strictNum(c.projectInvestment?.value ?? c.projectInvestment);
        settle = strictNum(c.settlement?.value ?? c.settlement);
      } catch {}
    }
    dailyFlowRows.push({
      date: dayKey,
      ad_spend: adSpend,
      creator_cost: creator,
      project_investment: totalInvest,
      settlement: settle,
    });
  }
  dailyFlowRows.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // 4. Query top notes
  const topNotesDb = await d1.prepare(`
    SELECT
      pn.note_id,
      pn.source_type,
      p.note_type,
      p.creator_level,
      p.exposure,
      p.interaction_count,
      p.note_price,
      pn.comment_total,
      pn.positive_count,
      pn.negative_count
    FROM project_notes pn
    LEFT JOIN note_profiles p ON p.note_id = pn.note_id
    WHERE pn.project_id = 'qicui'
    ORDER BY p.interaction_count DESC
    LIMIT 50
  `).all<Record<string, unknown>>();

  const datasets: Record<string, DatasetTable> = {
    summary_kpis: {
      id: 'summary_kpis',
      name: '启萃全域核心指标',
      description: '全域笔记、互动、曝光与投放消耗',
      columns: [
        { key: 'note_count', label: '收录笔记总数', type: 'number', format: 'integer', decimals: 0, displayUnits: '篇', role: 'METRIC' },
        { key: 'exposure', label: '全域累计曝光量', type: 'number', format: 'integer', decimals: 0, displayUnits: '次', role: 'METRIC' },
        { key: 'interaction_count', label: '全域累计互动量', type: 'number', format: 'integer', decimals: 0, displayUnits: '次', role: 'METRIC' },
        { key: 'comment_total', label: '沉淀总评论数', type: 'number', format: 'integer', decimals: 0, displayUnits: '条', role: 'METRIC' },
        { key: 'ad_spend', label: '投流消耗', type: 'number', format: 'currency', decimals: 2, displayUnits: '元', role: 'METRIC' },
        { key: 'settlement', label: '结算金额', type: 'number', format: 'currency', decimals: 2, displayUnits: '元', role: 'METRIC' },
        { key: 'project_investment', label: '项目总投资', type: 'number', format: 'currency', decimals: 2, displayUnits: '元', role: 'METRIC' },
        { key: 'creator_cost', label: '达人总成本', type: 'number', format: 'currency', decimals: 2, displayUnits: '元', role: 'METRIC' },
      ],
      rows: [
        {
          note_count: noteCount,
          exposure,
          interaction_count: interactionCount,
          comment_total: commentTotal,
          ad_spend: latestAdSpend,
          settlement: latestSettlement,
          project_investment: latestProjectInvestment,
          creator_cost: latestCreatorCost,
        },
      ],
      totalRows: 1,
    },
    daily_flow: {
      id: 'daily_flow',
      name: '启萃分日业务流水',
      columns: [
        { key: 'date', label: '业务日期', type: 'date', role: 'TIMESTAMP' },
        { key: 'ad_spend', label: '投流广告消耗', type: 'number', format: 'currency', decimals: 2, displayUnits: '元', role: 'METRIC' },
        { key: 'creator_cost', label: '达人采买成本', type: 'number', format: 'currency', decimals: 2, displayUnits: '元', role: 'METRIC' },
        { key: 'project_investment', label: '项目累计总投资', type: 'number', format: 'currency', decimals: 2, displayUnits: '元', role: 'METRIC' },
        { key: 'settlement', label: '当日结算金额', type: 'number', format: 'currency', decimals: 2, displayUnits: '元', role: 'METRIC' },
      ],
      rows: dailyFlowRows,
      totalRows: dailyFlowRows.length,
    },
    creator_notes: {
      id: 'creator_notes',
      name: '达人重点笔记榜单 (TOP50)',
      columns: [
        { key: 'note_id', label: '笔记ID', type: 'string' },
        { key: 'creator_level', label: '达人梯队', type: 'badge' },
        { key: 'source_type', label: '笔记性质', type: 'badge' },
        { key: 'exposure', label: '曝光量', type: 'number', format: 'integer', decimals: 0, displayUnits: '次' },
        { key: 'interaction_count', label: '互动量', type: 'number', format: 'integer', decimals: 0, displayUnits: '次' },
        { key: 'note_price', label: '报价金额', type: 'number', format: 'currency', decimals: 2, displayUnits: '元' },
        { key: 'comment_total', label: '总评论数', type: 'number', format: 'integer', decimals: 0 },
        { key: 'negative_count', label: '负向评论', type: 'number', format: 'integer', decimals: 0 },
      ],
      rows: topNotesDb.results || [],
      totalRows: (topNotesDb.results || []).length,
    },
  };

  const sections: SectionSpec[] = [
    {
      id: 'summary-kpis',
      tab: 'overview',
      title: '启萃核心声量与消耗',
      description: '全量达人与广告消耗大盘',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'kpi-notes',
          type: 'metric-card',
          title: '收录笔记总数',
          query: 'summary_kpis',
          field: 'note_count',
          width: 'quarter',
        },
        {
          id: 'kpi-exposure',
          type: 'metric-card',
          title: '全域累计曝光量',
          query: 'summary_kpis',
          field: 'exposure',
          width: 'quarter',
        },
        {
          id: 'kpi-interaction',
          type: 'metric-card',
          title: '全域累计互动量',
          query: 'summary_kpis',
          field: 'interaction_count',
          width: 'quarter',
        },
        {
          id: 'kpi-comments',
          type: 'metric-card',
          title: '沉淀总评论数',
          query: 'summary_kpis',
          field: 'comment_total',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'daily-trend-section',
      tab: 'overview',
      title: '分日投资与消耗趋势',
      hint: '分日双轴趋势：左轴展示投流消耗，右轴展示项目累计投资',
      layout: 'bento-split',
      columns: 2,
      components: [
        {
          id: 'trend-spend',
          type: 'line-bar-combo',
          title: '分日投流消耗 (元) 与项目累计投资 (元)',
          query: 'daily_flow',
          xField: 'date',
          yField: 'ad_spend',
          y2Field: 'project_investment',
          width: 'half',
        },
        {
          id: 'trend-settlement',
          type: 'line-bar-combo',
          title: '分日结算金额 (元) 与达人成本 (元)',
          query: 'daily_flow',
          xField: 'date',
          yField: 'settlement',
          y2Field: 'creator_cost',
          width: 'half',
        },
      ],
    },
    {
      id: 'ads-kpis-section',
      tab: 'ads',
      title: '版位投放与预算成本指标',
      description: '投流预算、达人成本与结算对账',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'kpi-ad-spend',
          type: 'metric-card',
          title: '累计投流消耗',
          query: 'summary_kpis',
          field: 'ad_spend',
          width: 'quarter',
        },
        {
          id: 'kpi-investment',
          type: 'metric-card',
          title: '项目总投资',
          query: 'summary_kpis',
          field: 'project_investment',
          width: 'quarter',
        },
        {
          id: 'kpi-creator-cost',
          type: 'metric-card',
          title: '达人总成本',
          query: 'summary_kpis',
          field: 'creator_cost',
          width: 'quarter',
        },
        {
          id: 'kpi-settlement',
          type: 'metric-card',
          title: '累计结算金额',
          query: 'summary_kpis',
          field: 'settlement',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'ads-trend-section',
      tab: 'ads',
      title: '投放效率双轴走势',
      description: '广告投放消耗与项目投资进度',
      hint: '广告投流消耗与项目投资进度动态走势对比',
      layout: 'bento-split',
      columns: 2,
      components: [
        {
          id: 'ads-trend-spend',
          type: 'line-bar-combo',
          title: '分日投流消耗 (元) 与投资进度',
          query: 'daily_flow',
          xField: 'date',
          yField: 'ad_spend',
          y2Field: 'project_investment',
          width: 'half',
        },
        {
          id: 'ads-trend-settlement',
          type: 'line-bar-combo',
          title: '分日结算金额 (元) 与达人成本走势',
          query: 'daily_flow',
          xField: 'date',
          yField: 'settlement',
          y2Field: 'creator_cost',
          width: 'half',
        },
      ],
    },
    {
      id: 'ads-flow-table-section',
      tab: 'ads',
      title: '分日投放结算流水明细',
      description: '分日投流广告与达人采买真实出入账流水',
      layout: 'stack',
      components: [
        {
          id: 'comp-ads-daily-table',
          type: 'data-table',
          query: 'daily_flow',
          width: 'full',
        },
      ],
    },
    {
      id: 'content-kpis-section',
      tab: 'content',
      title: '内容声量与互动指标',
      description: '达人笔记库与粉丝互动质检',
      layout: 'paired-metrics',
      variant: 'hero-spotlight',
      columns: 4,
      components: [
        {
          id: 'content-kpi-notes',
          type: 'metric-card',
          title: '收录爆文笔记数',
          query: 'summary_kpis',
          field: 'note_count',
          width: 'quarter',
        },
        {
          id: 'content-kpi-exposure',
          type: 'metric-card',
          title: '全量笔记总曝光',
          query: 'summary_kpis',
          field: 'exposure',
          width: 'quarter',
        },
        {
          id: 'content-kpi-interaction',
          type: 'metric-card',
          title: '全量笔记总互动',
          query: 'summary_kpis',
          field: 'interaction_count',
          width: 'quarter',
        },
        {
          id: 'content-kpi-comments',
          type: 'metric-card',
          title: '沉淀总评论数',
          query: 'summary_kpis',
          field: 'comment_total',
          width: 'quarter',
        },
      ],
    },
    {
      id: 'content-diagnostic-section',
      tab: 'content',
      title: '达人笔记互动贡献分析',
      hint: '帕累托二八法则：前20%重点笔记贡献了全盘近80%的互动',
      layout: 'grid',
      columns: 2,
      components: [
        {
          id: 'comp-content-pareto',
          type: 'pareto-chart',
          title: 'TOP笔记互动量帕累托集中度',
          query: 'creator_notes',
          categoryField: 'note_id',
          field: 'interaction_count',
          width: 'half',
        },
        {
          id: 'comp-content-rose',
          type: 'donut-rose',
          title: '达人梯队互动分布玫瑰图',
          query: 'creator_notes',
          categoryField: 'creator_level',
          field: 'interaction_count',
          width: 'half',
        },
      ],
    },
    {
      id: 'content-notes-table-section',
      tab: 'content',
      title: '达人爆文与重点笔记库',
      description: 'TOP50 核心笔记与互动质检明细',
      layout: 'stack',
      components: [
        {
          id: 'comp-content-notes-table',
          type: 'data-table',
          query: 'creator_notes',
          width: 'full',
        },
      ],
    },
  ];

  const hasComments = commentTotal > 0;
  const safeNegRate = hasComments ? (negativeCount / commentTotal) * 100 : null;
  const safeCleanRate = hasComments && safeNegRate !== null ? 100 - safeNegRate : null;

  let sentimentSeverity: 'success' | 'warning' | 'info' = 'info';
  let sentimentSummary = '';
  if (hasComments && safeNegRate !== null && safeCleanRate !== null) {
    sentimentSeverity = safeCleanRate >= 95 ? 'success' : 'warning';
    sentimentSummary = `全域沉淀 ${noteCount} 篇笔记与 ${commentTotal} 条评论，负向评论占比 ${safeNegRate.toFixed(1)}%（非负向清洁度 ${safeCleanRate.toFixed(1)}%）。`;
  } else {
    sentimentSeverity = 'info';
    sentimentSummary = `当前系统收录 ${noteCount} 篇笔记，尚无评论互动沉淀，数据就绪待初次外显质检（当前状态：待观测）。`;
  }

  const analysisCards: AnalysisCardSpec[] = [
    {
      id: 'insight-qicui-sentiment',
      targetQueryIds: ['summary_kpis', 'creator_notes'],
      type: 'insight',
      title: hasComments ? '启萃全域声量与评论外显质检' : '启萃全域声量与评论外显质检（待观测）',
      summary: sentimentSummary,
      recommendations: [
        '针对提问高频词（如转奶、便秘、乳铁蛋白）配置官方解答置顶',
        '继续跟进供应商待核验评论的外显状态',
      ],
      severity: sentimentSeverity,
    },
  ];

  return {
    projectId: manifest.id,
    name: manifest.name,
    brand: manifest.brand,
    spu: manifest.spu,
    category: manifest.category,
    themeColor: manifest.color,
    themeId: manifest.themeId || 'teal-mist',
    reportPeriod: manifest.defaultReportPeriod,
    mode: manifest.mode,
    rendererMode: manifest.rendererMode || 'universal',
    datasets,
    sections,
    analysisCards,
    warnings: [],
    sources: [
      { id: 'db-notes', name: '全量笔记库', status: '已连接', detail: `收录 ${noteCount} 篇笔记` },
      { id: 'db-daily', name: '分日业务日报', status: '已连接', detail: `共 ${dailyFlowRows.length} 天快照` },
    ],
    actions: { title: '启萃重点事项', items: [] },
    kpis: [],
    tables: [],
    dailyDatasets: [],
  };
}

export default transformProject;
