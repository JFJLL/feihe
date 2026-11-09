/**
 * Copilot Context Extractor
 * Slices and formats BoardPayload for AI Assistant & Agent endpoints (/api/agent).
 * Eliminates project-specific hardcoding in assistant-context.ts.
 */

import type { BoardPayload } from './types';

export interface CopilotProjectContext {
  projectId: string;
  projectName: string;
  brand: string;
  spu?: string;
  category?: string;
  dataThrough?: string | null;
  publishedAt?: string;
  isFiltered: boolean;
  summaryKpiScope: 'full_cycle' | 'range_scoped';
  reportPeriod?: string;
  queryPeriod?: string;
  summaryKpis: Record<string, { label: string; value: string | number | null; unit?: string }>;
  keyTablesSummary: Array<{
    id: string;
    name: string;
    rowCount: number;
    columns: string[];
    sampleRows: Record<string, unknown>[];
  }>;
  analysisInsights: Array<{
    title: string;
    summary: string;
    recommendations?: string[];
    severity?: string;
  }>;
  warnings: string[];
  markdownFactSheet: string;
}

export function buildCopilotContext(
  payload: BoardPayload,
  filterOptions?: { day?: string; from?: string; to?: string }
): CopilotProjectContext {
  const summaryKpis: CopilotProjectContext['summaryKpis'] = {};

  // Extract KPIs from summary_kpis or first metric dataset
  const kpiDs = payload.datasets['summary_kpis'] || Object.values(payload.datasets).find(d => d.id.includes('kpi') || d.id.includes('summary'));
  if (kpiDs && kpiDs.rows.length > 0) {
    const firstRow = kpiDs.rows[0];
    for (const col of kpiDs.columns) {
      summaryKpis[col.key] = {
        label: col.label,
        value: firstRow[col.key] as string | number | null,
        unit: col.displayUnits,
      };
    }
  }

  const filterDay = filterOptions?.day;
  const filterFrom = filterOptions?.from;
  const filterTo = filterOptions?.to;
  const isFiltered = Boolean(filterDay || (filterFrom && filterTo));

  const keyTablesSummary: CopilotProjectContext['keyTablesSummary'] = [];
  for (const [id, ds] of Object.entries(payload.datasets)) {
    let effectiveRows = ds.rows;
    const dateCol = ds.columns.find(c => c.type === 'date' || c.key.toLowerCase().includes('date') || c.role === 'TIMESTAMP');
    if (dateCol && isFiltered) {
      effectiveRows = ds.rows.filter(r => {
        const rowDate = String(r[dateCol.key] || '');
        if (filterDay) return rowDate.startsWith(filterDay);
        if (filterFrom && filterTo) return rowDate >= filterFrom && rowDate <= filterTo;
        return true;
      });
    }

    keyTablesSummary.push({
      id,
      name: ds.name || id,
      rowCount: effectiveRows.length,
      columns: ds.columns.map(c => `${c.label} (${c.key})`),
      sampleRows: effectiveRows.slice(0, 3),
    });
  }

  const analysisInsights: CopilotProjectContext['analysisInsights'] = (payload.analysisCards || []).map(c => ({
    title: c.title,
    summary: c.summary,
    recommendations: c.recommendations,
    severity: c.severity,
  }));

  // Build compact markdown fact sheet for prompt injection
  const mdLines: string[] = [
    `# 项目事实卡：${payload.name} (${payload.brand})`,
    `- 核心SPU: ${payload.spu || '核心主推品'} | 所属类目: ${payload.category || '消费零售'}`,
    `- 观测周期: ${payload.reportPeriod || '最新观测周期'}`,
    `- 业务数据截止日期 (dataThrough): ${payload.dataThrough || payload.reportPeriod || '全周期'}`,
    `- 看板发布时间: ${payload.syncMetadata?.publishedAt || payload.updatedAt || '已发布正式快照'}`,
    ...(filterDay ? [`- 当前查询指定业务日: ${filterDay}`] : []),
    ...(filterFrom && filterTo ? [`- 当前查询时间范围: ${filterFrom} ~ ${filterTo}`] : []),
    '',
    '## 核心指标看板 (KPIs):',
  ];

  if (Object.keys(summaryKpis).length > 0) {
    if (isFiltered) {
      mdLines.push('> 注意：以下核心指标卡为全周期累计/基线值，非安全加和指标未在指定子区间中重算。如需特定时间段指标，请参考下方明细记录。');
    }
    for (const [k, v] of Object.entries(summaryKpis)) {
      mdLines.push(`- **${v.label}**: ${v.value !== null ? v.value : '未观测'} ${v.unit || ''}`);
    }
  } else {
    mdLines.push('- 暂无标量指标卡，请参考各业务表明细');
  }

  mdLines.push('', '## 业务数据表总览:');
  for (const t of keyTablesSummary) {
    mdLines.push(`- **${t.name}** [${t.id}]: 共 ${t.rowCount} 行记录, 字段: ${t.columns.join(', ')}`);
    if (t.sampleRows.length > 0) {
      mdLines.push(`  - 样本事实数据: ${JSON.stringify(t.sampleRows[0])}`);
    }
  }

  if (analysisInsights.length > 0) {
    mdLines.push('', '## 重点洞察与建议:');
    if (isFiltered) {
      mdLines.push('> 说明：以下策略洞察卡片属于全周期宏观结论，并非仅基于当前选定子区间。');
    }
    for (const insight of analysisInsights) {
      mdLines.push(`- **[${insight.severity || 'info'}] ${insight.title}**: ${insight.summary}`);
      if (insight.recommendations?.length) {
        mdLines.push(`  - 建议行动: ${insight.recommendations.join('；')}`);
      }
    }
  }

  if (payload.warnings?.length) {
    mdLines.push('', '## 数据口径与注意说明:');
    for (const w of payload.warnings) {
      mdLines.push(`- ⚠️ ${w}`);
    }
  }

  return {
    projectId: payload.projectId,
    projectName: payload.name,
    brand: payload.brand,
    spu: payload.spu,
    category: payload.category,
    dataThrough: payload.dataThrough,
    publishedAt: payload.syncMetadata?.publishedAt || payload.updatedAt,
    isFiltered,
    summaryKpiScope: isFiltered ? 'range_scoped' : 'full_cycle',
    reportPeriod: payload.reportPeriod,
    queryPeriod: filterDay || (filterFrom && filterTo ? `${filterFrom}~${filterTo}` : undefined),
    summaryKpis,
    keyTablesSummary,
    analysisInsights,
    warnings: payload.warnings || [],
    markdownFactSheet: mdLines.join('\n'),
  };
}
