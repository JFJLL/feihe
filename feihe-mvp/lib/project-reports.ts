import { db } from './db';
import { getProjectDatasets, type Dataset } from './datasets';
import type { ProjectAuthContext } from './api-auth';
import { evaluateCardMetric, type MetricComputeResult } from './metrics/engine';
import { getDefinition, resolveCardDefinition, DefinitionError } from './metrics/definitions';
import { ratioSampleLabel, type CardMetricConfig } from './metrics/config';
import { formatMetricValue } from './metrics/display';
import { canonicalQuery, queryErrors, readDashboardLayout, type MetricQuery } from './metrics/query';
import { reportHtml, type ReportSpec, type QueryPlan } from './report-agent';

export type ReportMetric = { cardId: string; title: string; type: string; metricId?: string; metricVersion?: number; config: CardMetricConfig; result: MetricComputeResult; previous?: MetricComputeResult; comparison: string };
export type ProjectReportSpec = ReportSpec & { kind: 'project_metrics_report'; projectId: string; dashboardId: string; dashboardVersion: number; queryConfig: MetricQuery; metrics: ReportMetric[]; datasets: Array<Omit<Dataset, 'rows'>>; aiStatus: 'not_enabled' };
type Board = { id: string; version: number; layoutJson: string; cardCount: number };
export async function reportBoard(projectId: string) {
  return db().prepare('SELECT d.id,d.version,d.layout_json AS layoutJson,(SELECT COUNT(*) FROM dashboard_cards c WHERE c.dashboard_id=d.id AND c.project_id=d.project_id) AS cardCount FROM dashboards d WHERE d.project_id=? ORDER BY d.is_default DESC,d.updated_at DESC LIMIT 1').bind(projectId).first<Board>();
}
function previousPeriod(query: MetricQuery): MetricQuery | undefined {
  if (!query.from || !query.to) return;
  const first = Date.parse(query.from + 'T00:00:00Z'), last = Date.parse(query.to + 'T00:00:00Z');
  const day = 86400000, duration = last - first + day, iso = (time: number) => new Date(time).toISOString().slice(0, 10);
  return { ...query, from: iso(first - duration), to: iso(first - day) };
}
export function reportSample(result: MetricComputeResult, fillZero = result.effectiveConfig?.missingPolicy === 'zero') {
  return result.pairedValidCount !== undefined ? ratioSampleLabel(result, fillZero) : '有效样本 ' + result.sampleSize + ' 行';
}
function comparison(result: MetricComputeResult, prior?: MetricComputeResult) {
  if (!prior) return result.appliedQuery?.rangePolicy === 'independent' ? '独立周期，不与项目上期比较' : '选择完整起止日期后可比较上期';
  if (!['ok', 'zero'].includes(result.status) || !['ok', 'zero'].includes(prior.status) || result.value === null || prior.value === null) return '上期或本期无可比数据';
  const config = result.effectiveConfig, difference = result.value - prior.value;
  const formatted = formatMetricValue(Math.abs(difference), config?.aggregation === 'ratio' ? 'percent' : config?.format, config?.unit, config?.aggregation === 'ratio' ? 'percentage_points' : config?.percentScale);
  const percent = config?.aggregation === 'ratio' || config?.format === 'percent' || config?.unit === '%';
  return '较上期 ' + (difference > 0 ? '+' : difference < 0 ? '−' : '') + (percent ? formatted.replace(/%$/, ' 个百分点') : formatted);
}
export async function createProjectReport(context: ProjectAuthContext, options: { query?: MetricQuery; dashboardVersion?: number; prompt?: string } = {}) {
  const projectId = context.projectId, board = await reportBoard(projectId);
  if (!board) throw new DefinitionError('请先发布团队看板，再生成同口径报告');
  if (options.dashboardVersion !== undefined && options.dashboardVersion !== board.version) throw new DefinitionError('看板已更新，请刷新报告配置后重试', 409, board.version);
  const query = options.query ?? readDashboardLayout(board.layoutJson).query;
  const errors = queryErrors(query); if (errors.length) throw new DefinitionError(errors.join('；'));
  const canonical = canonicalQuery(query), priorQuery = previousPeriod(canonical);
  const cards = await db().prepare('SELECT id,title,type,config_json AS configJson FROM dashboard_cards WHERE project_id=? AND dashboard_id=? ORDER BY sort_order ASC').bind(projectId, board.id).all<{ id: string; title: string; type: string; configJson: string }>();
  if (!cards.results.length) throw new DefinitionError('团队看板为空，请先添加需要汇报的指标');
  const datasets = await getProjectDatasets(projectId), versions = new Map<string, number>(), metrics: ReportMetric[] = [];
  for (const card of cards.results) {
    const reference: CardMetricConfig = { ...JSON.parse(card.configJson), id: card.id, title: card.title, type: card.type };
    if (reference.metricId && reference.metricVersionPolicy !== 'pinned') {
      if (!versions.has(reference.metricId)) versions.set(reference.metricId, (await getDefinition(projectId, reference.metricId)).protocol.version);
      reference.metricVersionPolicy = 'pinned'; reference.metricVersion = versions.get(reference.metricId);
    }
    const resolved = await resolveCardDefinition(projectId, reference);
    // Daily results and grouped results use the same captured definition as the value.
    const compute = { ...reference, type: resolved.config.dateField ? 'time_trend' : reference.type };
    const result = await evaluateCardMetric(projectId, compute, canonical);
    const previous = priorQuery && result.appliedQuery?.rangePolicy === 'project' ? await evaluateCardMetric(projectId, compute, priorQuery) : undefined;
    metrics.push({ cardId: card.id, title: card.title, type: card.type, metricId: result.definition?.id, metricVersion: result.definition?.version, config: result.effectiveConfig || resolved.config, result, previous, comparison: comparison(result, previous) });
  }
  const usedIds = new Set(metrics.map(metric => metric.result.datasetId));
  const used = datasets.filter(dataset => usedIds.has(dataset.id) || usedIds.has(dataset.sourceId));
  const after = await getProjectDatasets(projectId), latestBoard = await reportBoard(projectId);
  if (latestBoard?.version !== board.version || latestBoard.id !== board.id || used.some(dataset => after.find(item => item.id === dataset.id)?.version !== dataset.version)) throw new DefinitionError('看板或数据在计算期间已更新，请重新生成', 409);
  for (const [id, version] of versions) if ((await getDefinition(projectId, id)).protocol.version !== version) throw new DefinitionError('指标口径在计算期间已更新，请重新生成', 409);
  const sourceRows = await db().prepare('SELECT id,name,type,spreadsheet,last_synced_at AS syncedAt,last_error AS lastError FROM data_sources WHERE project_id=?').bind(projectId).all<{ id: string; name: string; type: string; spreadsheet: string; syncedAt: string; lastError: string }>();
  const sourceManifest = used.map(dataset => ({ datasetId: dataset.id, version: dataset.version, updatedAt: dataset.updatedAt, rows: dataset.rowCount, source: sourceRows.results.find(source => source.id === dataset.sourceId) || null }));
  const sections: ReportSpec['sections'] = [];
  for (const metric of metrics) {
    if (metric.result.trend?.length) sections.push({ id: metric.cardId + ':trend', title: metric.title + '每日趋势', eyebrow: '', kind: 'trend', description: reportSample(metric.result), data: metric.result.trend.map(point => ({ 日期: point.date, 结果: point.formattedValue, 样本: reportSample(point, metric.config.missingPolicy === 'zero'), 状态: point.statusLabel })) });
    if (metric.result.groups?.length) sections.push({ id: metric.cardId + ':groups', title: metric.title + '分组对比', eyebrow: '', kind: 'bars', data: metric.result.groups.map(group => ({ 分组: group.label, 结果: group.formattedValue, 样本: reportSample(group, metric.config.missingPolicy === 'zero'), 状态: group.statusLabel })) });
  }
  sections.push({ id: 'sources', title: '来源与数据更新时间', eyebrow: '', kind: 'table', data: sourceManifest.map(item => ({ 来源: item.source?.name || used.find(dataset => dataset.id === item.datasetId)!.name, 数据版本: item.version, 原表记录: item.rows, 数据更新时间: item.updatedAt, 同步状态: item.source?.lastError ? '最近失败，使用上次成功数据：' + item.source.lastError : item.source?.syncedAt ? '最近成功：' + item.source.syncedAt : '项目导入数据；未启用自动同步' })) });
  sections.push({ id: 'definitions', title: '指标口径与版本', eyebrow: '', kind: 'table', data: metrics.map(metric => ({ 指标: metric.title, 标识: metric.metricId || '看板独立配置:' + metric.cardId, 口径版本: metric.metricVersion || '看板v' + board.version, 聚合: metric.config.aggregation || metric.config.metric || '', 样本: reportSample(metric.result), 周期: (metric.result.appliedQuery?.from || '不限开始') + ' 至 ' + (metric.result.appliedQuery?.to || '不限结束'), 比较: metric.comparison })) });
  const uncomputable = metrics.filter(metric => !['ok', 'zero'].includes(metric.result.status));
  const summary = ['仅使用本项目已发布的看板指标；报告保留生成时的口径与数据版本，不随之后修改重算。', uncomputable.length ? uncomputable.map(metric => metric.title + '：' + metric.result.statusLabel).join('；') : '当前指标均可核对；这里不自动推断业务原因。', ...sourceManifest.filter(item => item.source?.lastError).map(item => '来源' + item.source!.name + '最近同步失败，当前是上次成功数据。')];
  sections.unshift({ id: 'status', title: '需要关注的状态', eyebrow: '', kind: 'insights', data: summary.map(text => ({ text })) });
  const generatedAt = new Date().toISOString(), engine = '项目指标快照（未启用AI）';
  const headlines = new Map<string, ReportMetric>();
  for (const metric of [...metrics.filter(item => ['metric_card', 'progress_card'].includes(item.type)), ...metrics]) {
    const key = JSON.stringify([metric.metricId || metric.cardId, metric.metricVersion, metric.result.appliedQuery]);
    if (!headlines.has(key)) headlines.set(key, metric);
  }
  const spec: ProjectReportSpec = { version: '1.0', kind: 'project_metrics_report', projectId, title: String(context.project.name) + ' · 项目报告', subtitle: '团队看板同口径结果、每日趋势、来源与样本', dashboardId: board.id, dashboardVersion: board.version, queryConfig: canonical, period: { start: canonical.from || '不限开始', end: canonical.to || '不限结束' }, generatedAt, engine, query: String(options.prompt || '已发布团队看板').slice(0, 2000), summary, metrics, datasets: used, aiStatus: 'not_enabled',
    kpis: [...headlines.values()].map(metric => ({ key: metric.cardId, label: metric.title, value: metric.result.formattedValue, note: reportSample(metric.result) + ' · ' + metric.comparison })), sections,
    sources: sourceManifest.map(item => ({ name: item.source?.name || used.find(dataset => dataset.id === item.datasetId)!.name, type: item.source?.type || 'dataset', freshness: item.updatedAt, rows: item.rows })), quality: uncomputable.map(metric => ({ label: metric.title, value: metric.result.sampleSize, status: metric.result.statusLabel })) };
  const reportId = crypto.randomUUID(), html = reportHtml(spec);
  await db().batch([
    db().prepare("INSERT INTO report_versions(id,project_id,title,period_start,period_end,status,report_spec_json,html,source_manifest_json,created_by,created_at) VALUES(?,?,?,?,?,'已生成',?,?,?,?,?)").bind(reportId, projectId, spec.title, canonical.from || null, canonical.to || null, JSON.stringify(spec), html, JSON.stringify(sourceManifest), context.user.userId, generatedAt),
    db().prepare('INSERT INTO action_logs(project_id,action,target_type,target_id,detail,created_at,actor_user_id) VALUES(?,?,?,?,?,?,?)').bind(projectId, '生成项目指标报告', 'report', reportId, spec.title, generatedAt, context.user.userId),
  ]);
  const plan: QueryPlan = { intent: '已发布看板指标报告', period: spec.period, requestedMetrics: metrics.map(metric => metric.title), requestedDimensions: [], sources: spec.sources.map((source, i) => ({ id: sourceManifest[i].datasetId, name: source.name, type: source.type, reason: '当前项目实际指标来源' })), endpoints: [], warnings: uncomputable.map(metric => metric.title + '：' + metric.result.statusLabel), steps: [{ name: '读取已发布指标', detail: '固定口径与数据版本' }, { name: '保存报告快照', detail: '本地真实结果，可授权导出' }] };
  return { ok: true, reportId, spec, plan, engine };
}
