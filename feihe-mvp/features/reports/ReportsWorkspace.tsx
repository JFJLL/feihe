'use client';
import { useEffect, useRef, useState } from 'react';
import Link from '../../components/ui/AppLink';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { useProject } from '../../components/project-shell/ProjectContext';
import { api, cnTime } from '../../lib/hooks/use-project-data';
import { BoardQueryBar } from '../overview/BoardQueryBar';
import { formatMetricValue } from '../../lib/metrics/display';
import { queryErrors, type MetricQuery } from '../../lib/metrics/query';
import { ratioSampleLabel } from '../../lib/metrics/config';
import type { Dataset } from '../../lib/datasets';
import type { ProjectReportSpec } from '../../lib/project-reports';
import type { ReportSpec } from '../../lib/report-agent';

type History = { id: string; title: string; createdAt: string; periodStart: string; periodEnd: string };
type ReportState = { board: { id: string; version: number; cardCount: number } | null; datasets: Dataset[]; query: MetricQuery; reports: History[]; total: number; pagination: { page: number; totalPages: number }; report: { id: string; spec: ProjectReportSpec | ReportSpec; createdAt: string; createdBy: string } | null };
export function ReportsWorkspace({ projectId }: { projectId: string }) {
  const { currentProject } = useProject();
  const [selectedId, setSelectedId] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [query, setQuery] = useState<MetricQuery | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), key = JSON.stringify({ projectId, selectedId, page, revision });
  const [snapshot, setSnapshot] = useState<{ key: string; value?: ReportState; error?: string }>({ key: '' });
  useEffect(() => {
    const controller = new AbortController(); let current = true;
    const urlQuery = new URLSearchParams(window.location.search), params = new URLSearchParams({ projectId, page: String(page) });
    const id = selectedId || urlQuery.get('id'); if (id) params.set('id', id);
    if (urlQuery.has('query')) params.set('query', urlQuery.get('query')!);
    api<ReportState>('/api/reports?' + params, { signal: controller.signal }).then(value => { if (current) setSnapshot({ key, value }); }).catch(error => { if (current) setSnapshot({ key, error: error instanceof Error ? error.message : '报告读取失败' }); });
    return () => { current = false; controller.abort(); };
  }, [projectId, selectedId, page, revision, key]);
  const current = snapshot.key === key ? snapshot : null, data = current?.value;
  async function generate() {
    if (lock.current || !data) return; lock.current = true; setBusy(true); setError('');
    try {
      const result = await api<{ reportId: string; spec: { queryConfig: MetricQuery } }>('/api/reports', { method: 'POST', body: JSON.stringify({ projectId, query: query ?? data.query, dashboardVersion: data.board?.version }) });
      setSelectedId(result.reportId); setQuery(result.spec.queryConfig); setPage(1); setRevision(value => value + 1);
      const url = new URL(window.location.href); url.searchParams.set('id', result.reportId); url.searchParams.set('query', JSON.stringify(result.spec.queryConfig)); window.history.replaceState(null, '', url.pathname + url.search);
    } catch (error) { setError((error instanceof Error ? error.message : '报告生成失败') + '；当前范围和历史报告仍保留。'); }
    finally { lock.current = false; setBusy(false); }
  }
  if (current?.error) return <ErrorState error={current.error} onRetry={() => setRevision(value => value + 1)} />;
  if (!data) return <LoadingState text="正在读取本项目报告与团队看板…" />;
  const selected = data.report, spec = selected?.spec;
  const metricsSpec = spec && 'kind' in spec && spec.kind === 'project_metrics_report' ? spec as ProjectReportSpec : null;
  const canGenerate = currentProject?.canWrite && !currentProject.isArchived;
  return <div className="stack" data-testid="project-reports">
    <PageHeader variant="light" title="项目报告" subtitle={(currentProject?.name || '当前项目') + ' · 使用已发布看板的同一指标，历史快照保留原口径'}><Link className="secondary" href={'/projects/' + encodeURIComponent(projectId)}>返回项目看板</Link></PageHeader>
    {canGenerate && <section className="platform-panel data-panel" aria-label="报告生成范围">
      <h2>生成当前范围的报告</h2>
      <BoardQueryBar projectId={projectId} dataset={data.datasets[0]} query={query ?? data.query} disabled={busy} editing={false} onChange={setQuery} />
      <p>默认继承看板周期；独立周期卡片仍使用自己的范围。生成时固定指标和数据版本，之后的编辑不会改变历史报告。当前未启用AI增强；无需模型凭证即可查看、保存和导出真实结果。</p>
      <button className="primary" disabled={busy || !data.board?.cardCount || queryErrors(query ?? data.query).length > 0} onClick={() => void generate()}>{busy ? '正在生成指标快照…' : '生成并保存报告'}</button>
      {!data.board?.cardCount && <p>尚未发布需要汇报的指标，请先在团队看板确认并发布。</p>}
      {error && <p role="alert">{error}</p>}
    </section>}
    <section className="platform-panel data-panel" aria-label="报告历史">
      <h2>报告历史 · {data.total} 份</h2>
      {data.reports.length ? <><div className="data-table-scroll" tabIndex={0}><table aria-label="项目报告历史"><thead><tr><th>生成时间</th><th>周期</th><th>操作</th></tr></thead><tbody>{data.reports.map(report => <tr key={report.id}><td>{cnTime(report.createdAt)}</td><td>{report.periodStart || '不限开始'} 至 {report.periodEnd || '不限结束'}</td><td><button className="secondary" disabled={busy} aria-label={'查看报告 ' + report.id} onClick={() => { setSelectedId(report.id); const url = new URL(window.location.href); url.searchParams.set('id', report.id); window.history.replaceState(null, '', url.pathname + url.search); }}>查看快照</button></td></tr>)}</tbody></table></div><div className="data-actions"><p>第 {data.pagination.page} / {data.pagination.totalPages} 页</p><div><button className="secondary" disabled={busy || data.pagination.page <= 1} onClick={() => setPage(data.pagination.page - 1)}>报告历史上一页</button><button className="secondary" disabled={busy || data.pagination.page >= data.pagination.totalPages} onClick={() => setPage(data.pagination.page + 1)}>报告历史下一页</button></div></div></> : <EmptyState title="尚未生成项目报告" text={canGenerate ? '先发布团队看板，再将当前结果保存为可核对的报告。' : '负责人或业务成员生成报告后，您可以查看和导出同一份结果。'} />}
    </section>
    {selected && spec && <section className="stack report-snapshot" aria-label="已保存的报告快照">
      <div className="platform-panel data-panel"><h2>{spec.title}</h2><p>报告周期：{spec.period.start} 至 {spec.period.end} · 生成于 {cnTime(spec.generatedAt || selected.createdAt)}</p><p>此处是已保存快照，日期输入调整后需生成新报告。</p><a className="secondary" href={'/api/report-html?projectId=' + encodeURIComponent(projectId) + '&id=' + encodeURIComponent(selected.id) + '&download=1'}>导出当前报告 HTML</a></div>
      {metricsSpec ? <>
        <section className="report-metric-grid" aria-label="报告关键指标">{metricsSpec.metrics.filter(metric => metricsSpec.kpis.some(kpi => kpi.key === metric.cardId)).map(metric => <article className="platform-panel data-panel" aria-label={metric.title + '报告结果'} key={metric.cardId}><h3>{metric.title}</h3><strong className="report-metric-value">{metric.result.formattedValue}</strong><p>{metric.metricId ? '指标 v' + metric.metricVersion : '看板独立口径 v' + metricsSpec.dashboardVersion} · 数据 v{metric.result.datasetVersion}</p><p>{metric.result.pairedValidCount !== undefined ? ratioSampleLabel(metric.result, metric.config.missingPolicy === 'zero') : '有效样本 ' + metric.result.sampleSize + ' 行'}</p><p>{metric.comparison}</p>{metric.config.target !== undefined && <p>明确目标：{formatMetricValue(metric.config.target, metric.config.aggregation === 'ratio' ? 'percent' : metric.config.format, metric.config.unit, metric.config.aggregation === 'ratio' ? 'percentage_points' : metric.config.percentScale)}</p>}{!['ok', 'zero'].includes(metric.result.status) && <p role="status">{metric.result.statusLabel}</p>}</article>)}</section>
        {metricsSpec.metrics.filter(metric => metric.type === 'time_trend').map(metric => <section className="platform-panel data-panel" key={metric.cardId}><h3>{metric.title}</h3><TimeSeriesChart title={metric.title} rows={(metric.result.trend || []).map(point => ({ date: point.date, value: point.value }))} series={[{ key: 'value', label: metric.title, color: '#2563eb' }]} unit="" valueFormatter={value => formatMetricValue(value, metric.config.aggregation === 'ratio' ? 'percent' : metric.config.format, metric.config.unit, metric.config.aggregation === 'ratio' ? 'percentage_points' : metric.config.percentScale)} /></section>)}
        {spec.sections.map(section => <details className="platform-panel data-panel" open={['status', 'sources'].includes(section.id)} key={section.id}><summary>{section.title}</summary>{section.kind === 'insights' ? <ul>{section.data.map((row, index) => <li key={index}>{String(row.text || '')}</li>)}</ul> : section.data.length ? <div className="data-table-scroll" tabIndex={0}><table aria-label={section.title}><thead><tr>{Object.keys(section.data[0]).map(key => <th key={key}>{key}</th>)}</tr></thead><tbody>{section.data.map((row, index) => <tr key={index}>{Object.values(row).map((value, i) => <td key={i}>{String(value)}</td>)}</tr>)}</tbody></table></div> : <p>当前没有该项记录。</p>}</details>)}
      </> : <iframe title="历史业务报告预览" className="report-legacy-preview" sandbox="" src={'/api/report-html?projectId=' + encodeURIComponent(projectId) + '&id=' + encodeURIComponent(selected.id)} />}
    </section>}
  </div>;
}
