'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from '../../components/ui/AppLink';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { api, cnTime } from '../../lib/hooks/use-project-data';
import { useCachedQuery } from '../../lib/hooks/use-cached-query';
import { invalidateQueryCache } from '../../lib/cache/query-cache';
import type { Dataset } from '../../lib/datasets';
import type { BusinessRecord } from '../../lib/business-records';
import type { FieldRoles } from '../../lib/metrics/recommendations';
import type { MetricComputeResult } from '../../lib/metrics/engine';
import type { MetricQuery } from '../../lib/metrics/query';
import { formatMetricValue } from '../../lib/metrics/display';
import { BoardQueryBar } from './BoardQueryBar';
import { useProject } from '../../components/project-shell/ProjectContext';
import { PageHeader } from '../../components/ui/PageHeader';

type State = { configured: boolean; dataset: Dataset; source?: { name: string; url?: string; lastError?: string; syncedAt?: string }; roles: FieldRoles; query: MetricQuery;
  metrics: Record<string, MetricComputeResult>; trend?: MetricComputeResult; channel?: MetricComputeResult; sentiment?: MetricComputeResult; status?: MetricComputeResult;
  records: { items: BusinessRecord[]; total: number; page: number; totalPages: number; pageSize: number }; identityPolicy: string };
export function DatasetDomainOverview({ projectId, kind, legacy, hasLegacyData, embedded = false }: { projectId: string; kind: 'content' | 'comment'; legacy?: ReactNode; hasLegacyData?: boolean; embedded?: boolean }) {
  const { currentProject, navigateTo } = useProject();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState<MetricQuery | null>(null), [revision, setRevision] = useState(0);

  const queryStr = query !== null ? JSON.stringify(query) : undefined;
  const {
    data: state,
    loading: stateLoading,
    error: loadError,
    refresh: refreshAnalytics,
  } = useCachedQuery<State>({
    url: '/api/business-analytics',
    projectId,
    params: {
      projectId,
      kind,
      ...(queryStr ? { query: queryStr } : {}),
      ...(revision > 0 ? { _r: String(revision) } : {}),
    },
    staleTime: 60 * 1000,
    ttl: 15 * 60 * 1000,
  });

  useEffect(() => {
    const refresh = () => {
      invalidateQueryCache({ projectId, endpoint: '/api/business-analytics' });
      setRevision(value => value + 1);
      void refreshAnalytics({ fresh: true });
    };
    window.addEventListener('app:datasets-changed', refresh); window.addEventListener('focus', refresh);
    return () => { window.removeEventListener('app:datasets-changed', refresh); window.removeEventListener('focus', refresh); };
  }, [projectId, refreshAnalytics]);
  const dataHref = '/projects/' + encodeURIComponent(projectId) + '/data?tab=datasets';
  if (searchParams.get('legacy') === '1' && legacy) return <>{legacy}</>;
  if (loadError && !state) return <div className="stack ops-workspace reference-workspace data-workspace" data-testid={kind + '-domain-overview'}><ErrorState error={loadError} onRetry={() => { setRevision(value => value + 1); void refreshAnalytics({ fresh: true }); }} /><div className="data-actions"><button className="secondary" onClick={() => setQuery({})}>清除查看筛选</button><Link href={dataHref}>检查来源与字段</Link></div></div>;
  if (!state) return <LoadingState text="正在读取本项目业务记录与指标…" />;
  if (legacy && !state.configured && (hasLegacyData ?? true)) return <>{legacy}</>;
  if (!state.configured) return <div className="stack ops-workspace reference-workspace data-workspace" data-testid={kind + '-domain-overview'}>
    {kind === 'comment' && (embedded ? <h2>评论运营</h2> : <PageHeader variant="light" title="评论运营" subtitle="先接入本项目评论来源，再核对标注与处置状态。" />)}
    <EmptyState title={kind === 'content' ? '先确认本项目内容表' : '先确认本项目评论表'} text={kind === 'content' ? '需要内容编号或内容链接；标题、发布日期、渠道、阅读、互动和费用可选。接入后确认字段与推荐指标，内容分析将使用这张表。' : '需要评论内容；评论编号、日期、来源情感和处置状态可选。接入后确认字段与推荐指标，评论分析将使用这张表。'} action={<Link className="primary" href={dataHref + '&purpose=' + kind}>{currentProject?.canManage ? '确认来源与指标' : '查看已接入数据'}</Link>} />
    {kind === 'comment' && <section className="platform-panel data-panel"><h3>消费者反馈情感结构</h3><p>评论来源尚未确认，当前没有可计算的情感分布。外部自动识别待配置；来源标注不会冒充平台判断。</p>{legacy && <><p>笔记与供应商评论仍由现有处置工作台管理；未接入对应来源时没有待办。飞书原表的标注请回原表处理。</p><button className="secondary" onClick={() => navigateTo('/projects/' + encodeURIComponent(projectId) + '/comments?legacy=1&tab=actions')}>前往处置工作台查看与闭环评论 →</button></>}</section>}
    {!currentProject?.canManage && <p>请联系项目负责人确认业务来源与指标。</p>}<p>外部采集与自动处置尚未配置；接入表格不会自动启用这些能力。</p></div>;
  const metricLabels = kind === 'content' ? [['records', '内容记录数'], ['reads', '阅读总量'], ['interactions', '互动总量'], ['spend', '内容费用']] : [['records', '评论记录数'], ['sentiment', '有情感标注的评论'], ['treatmentStatus', '有处置状态的评论']];
  const columns: Array<[keyof BusinessRecord, string]> = kind === 'content' ? [['recordId', '内容编号/链接'], ['title', '标题'], ['date', '发布日期'], ['channel', '渠道'], ['reads', '阅读量'], ['interactions', '互动量'], ['spend', '内容费用']] : [['recordId', state.identityPolicy === 'row_position' ? '当前原表行序' : '评论编号'], ['commentText', '评论内容'], ['date', '记录日期'], ['sentiment', '来源情感标注'], ['treatmentStatus', '来源处置状态']];
  const trendTitle = kind === 'content' && state.metrics.reads ? (state.metrics.reads.definition?.name || '阅读') + '趋势' : kind === 'content' ? '内容记录趋势' : '评论记录趋势';
  const groups = kind === 'content' ? [[state.channel, '内容渠道对比']] as const : [[state.sentiment, '来源情感分布'], [state.status, '来源处置状态']] as const;
  return <div className="stack ops-workspace reference-workspace data-workspace" data-testid={kind + '-domain-overview'}>
    {!embedded && <PageHeader variant="light" title={kind === 'content' ? '内容分析' : '评论分析'} subtitle={kind === 'content' ? '核对本项目内容表现、趋势与原表记录。' : '核对本项目评论、来源标注与处置状态。'} />}
    <div className="data-context"><p>来源：{state.source?.name || state.dataset.name} / 数据 v{state.dataset.version} / 更新于 {cnTime(state.source?.syncedAt || state.dataset.updatedAt)}</p>
      {state.source?.lastError && <p role="status">最近同步失败，当前为上次成功数据：{state.source.lastError}</p>}
      <div className="data-actions"><Link href={dataHref}>查看字段与同步记录</Link>{state.source?.url && <a href={state.source.url} target="_blank" rel="noreferrer">在飞书原表处理记录 ↗</a>}<button className="secondary" onClick={() => setRevision(value => value + 1)}>刷新业务分析</button></div><p>原始记录在飞书修改；当前未启用自动同步，请从数据页手动同步。</p></div>
    <BoardQueryBar projectId={projectId} dataset={state.dataset} query={query || state.query} disabled={false} editing={false} onChange={value => setQuery({ ...value, detailPage: undefined })} />
    {!state.roles.date && <p role="status">未对应日期字段，暂不能按周期分析；记录数量和已有字段仍可核对。</p>}
    <section className="ops-metric-grid" aria-label={kind === 'content' ? '内容分析指标' : '评论分析指标'}>{metricLabels.map(([metricKey, label]) => {
      const result = state.metrics[metricKey]; return <MetricCard key={metricKey} label={result?.definition?.name || label} value={result?.formattedValue || '未配置'} desc={result ? '指标 v' + result.definition?.version + ' / 有效样本 ' + result.sampleSize + ' 行' + (!['ok', 'zero'].includes(result.status) ? ' / ' + result.statusLabel : '') : '原表没有对应字段，请确认后再分析'} />;
    })}</section>
    {state.trend && <section className="platform-panel data-panel"><h3>{trendTitle}</h3><TimeSeriesChart title={trendTitle} rows={(state.trend.trend || []).map(point => ({ date: point.date, value: point.value }))} series={[{ key: 'value', label: state.trend.definition?.name || trendTitle, color: '#0090ff' }]} unit="" valueFormatter={value => formatMetricValue(value, state.trend?.effectiveConfig?.format, state.trend?.effectiveConfig?.unit, state.trend?.effectiveConfig?.percentScale)} /><p>与看板和报告引用同一指标 v{state.trend.definition?.version}。缺失不补零；无日期记录不进入指定周期。</p></section>}
    {groups.map(([result, title]) => <section className="platform-panel data-panel" key={title}><h3>{title}</h3>{!result ? <p>原表未对应相关字段，当前无法计算。</p> : <div className="data-table-scroll" tabIndex={0}><table aria-label={title}><thead><tr><th>来源分组</th><th>{kind === 'content' && state.metrics.reads ? state.metrics.reads.definition?.name || '阅读总量' : '记录数'}</th><th>有效样本</th></tr></thead><tbody>{(result.groups || []).map(group => <tr key={group.label}><td>{group.label}</td><td>{group.formattedValue}</td><td>{group.sampleSize}</td></tr>)}</tbody></table></div>}</section>)}
    <section className="platform-panel data-panel"><h3>{kind === 'content' ? '项目内容记录' : '项目评论记录'}</h3><p>当前筛选共 {state.records.total} 条记录。{state.identityPolicy === 'row_position' ? '未对应评论编号，行序仅用于当前批次显示，不是跨批次主键。' : '使用已确认的来源编号或链接识别记录。'}</p>
      <div className="data-table-scroll" tabIndex={0}><table aria-label={kind === 'content' ? '项目内容记录' : '项目评论记录'}><thead><tr>{columns.map(([columnKey, label]) => <th key={columnKey}>{label}</th>)}</tr></thead><tbody>{state.records.items.map((row, index) => <tr key={index}>{columns.map(([columnKey]) => <td key={columnKey}>{columnKey === 'recordId' && row.link ? <a href={row.link} target="_blank" rel="noreferrer">{row.recordId}</a> : ['reads', 'interactions', 'spend'].includes(columnKey) ? row[columnKey] === null || row[columnKey] === undefined ? '—' : formatMetricValue(Number(row[columnKey]), 'number') : String(row[columnKey] || '—')}</td>)}</tr>)}</tbody></table></div>
      {state.records.items.length === 0 && <p>当前周期或筛选没有记录，可清除筛选或检查原表。</p>}
      <div className="data-actions"><span>第 {state.records.page} / {state.records.totalPages} 页</span><div><button className="secondary" disabled={state.records.page <= 1} onClick={() => setQuery({ ...(query || state.query), detailPage: state.records.page - 1 })}>上一页记录</button><button className="secondary" disabled={state.records.page >= state.records.totalPages} onClick={() => setQuery({ ...(query || state.query), detailPage: state.records.page + 1 })}>下一页记录</button></div></div>
    </section>
    {kind === 'comment' && <p>情感和处置状态均为来源原有标注，不代表平台自动识别或已执行处理。验收目标需在本项目明确设置；外部采集、自动删除与自动回复待配置。</p>}
    {kind === 'comment' && hasLegacyData && legacy && <button className="secondary" onClick={() => navigateTo('/projects/' + encodeURIComponent(projectId) + '/comments?legacy=1&tab=actions')}>查看笔记与供应商评论处置工作台</button>}
    {kind === 'content' && <p>本页核对原表内容与表现；自动发布、抓取平台表现待配置。费用未声明币种时按普通数值显示，不从其他客户继承目标。</p>}
  </div>;
}
