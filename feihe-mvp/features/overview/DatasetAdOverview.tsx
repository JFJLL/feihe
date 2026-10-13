'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from '../../components/ui/AppLink';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { api, cnTime } from '../../lib/hooks/use-project-data';
import type { Dataset } from '../../lib/datasets';
import type { MetricComputeResult } from '../../lib/metrics/engine';
import type { MetricQuery } from '../../lib/metrics/query';
import { formatMetricValue } from '../../lib/metrics/display';
import { BoardQueryBar } from './BoardQueryBar';
type State = { configured: boolean; dataset?: Dataset; source?: { name: string; type: string; spreadsheet: string; lastError?: string; syncedAt: string }; query: MetricQuery; metrics: Record<string, MetricComputeResult>; trends: Record<string, MetricComputeResult>; channel?: MetricComputeResult };
export function DatasetAdOverview({ projectId, legacy }: { projectId: string; legacy?: ReactNode }) {
  const [query, setQuery] = useState<MetricQuery | null>(null), [revision, setRevision] = useState(0);
  const key = JSON.stringify({ projectId, query, revision });
  const [snapshot, setSnapshot] = useState<{ key: string; data?: State; error?: string }>({ key: '' });
  useEffect(() => {
    const controller = new AbortController(); let current = true;
    const params = new URLSearchParams({ projectId }); if (query !== null) params.set('query', JSON.stringify(query));
    api<State>('/api/business-analytics?' + params, { signal: controller.signal }).then(data => { if (current) setSnapshot({ key, data }); }).catch(error => { if (current) setSnapshot({ key, error: error instanceof Error ? error.message : '投放来源读取失败' }); });
    return () => { current = false; controller.abort(); };
  }, [projectId, query, revision, key]);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('app:datasets-changed', refresh); window.addEventListener('focus', refresh);
    return () => { window.removeEventListener('app:datasets-changed', refresh); window.removeEventListener('focus', refresh); };
  }, []);
  const current = snapshot.key === key ? snapshot : null;
  const state = current?.data;
  if (current?.error) return <ErrorState error={current.error} onRetry={() => setRevision(value => value + 1)} />;
  if (!state) return <LoadingState text="正在读取本项目投放来源与指标…" />;
  if (!state.configured && legacy) return <>{legacy}</>;
  if (!state.configured) return <div data-testid="ad-performance-overview"><EmptyState title="先确认本项目投放表" text="需要日期、花费、曝光、点击；渠道可选。接入后在数据页确认推荐指标，投放页和看板将引用同一口径。" action={<Link className="primary" href={'/projects/' + encodeURIComponent(projectId) + '/data?tab=datasets'}>确认投放来源与指标</Link>} /><h3>广告消耗趋势</h3><p>来源尚未确认，当前没有可计算的投放趋势。未配置广告账户时可使用授权飞书投放表；在线账户接口仍需另行配置。</p><h3>投放点击效率</h3><p>确认本项目的点击与曝光字段后，显示真实点击率及其每日变化。</p></div>;
  return <div className="stack" data-testid="ad-performance-overview">
    <div className="data-context"><p>来源：{state.source?.name || state.dataset?.name} · {state.source && ['feishu_sheet', 'feishu_bitable'].includes(state.source.type) ? '授权飞书投放表' : '项目导入数据'} · 数据 v{state.dataset?.version}</p><p>同步时间：{cnTime(state.source?.syncedAt || state.dataset?.updatedAt)}</p>{state.source?.lastError && <p role="status">最近同步失败，当前为上次成功数据：{state.source.lastError}</p>}<Link href={'/projects/' + encodeURIComponent(projectId) + '/data?tab=datasets'}>查看原表与字段</Link></div>
    <BoardQueryBar projectId={projectId} dataset={state.dataset} query={query || state.query} disabled={false} editing={false} onChange={setQuery} />
    <section className="ops-metric-grid" aria-label="投放分析指标">{[['spend', '广告消耗'], ['impressions', '曝光量'], ['clicks', '点击量'], ['ctr', '点击率']].map(([key, label]) => { const result = state.metrics[key]; return <MetricCard key={key} label={label} value={result.formattedValue} desc={'指标 v' + result.definition?.version + ' · 有效样本 ' + result.sampleSize + ' 行' + (!['ok', 'zero'].includes(result.status) ? ' · ' + result.statusLabel : '')} />; })}</section>
    {[['spend', '广告消耗趋势'], ['ctr', '投放点击效率']].map(([key, title]) => { const result = state.trends[key], config = result.effectiveConfig; return <section className="platform-panel data-panel" key={key}><h3>{title}</h3><TimeSeriesChart title={title} rows={(result.trend || []).map(point => ({ date: point.date, value: point.value }))} series={[{ key: 'value', label: result.definition?.name || title, color: '#2563eb' }]} unit="" valueFormatter={value => formatMetricValue(value, config?.aggregation === 'ratio' ? 'percent' : config?.format, config?.unit, config?.aggregation === 'ratio' ? 'percentage_points' : config?.percentScale)} /><p>与团队看板引用同一指标 v{result.definition?.version}；按项目时区每日汇总，缺失不补零。</p></section>; })}
    {state.channel?.groups && <section className="platform-panel data-panel"><h3>投放渠道对比</h3><div className="data-table-scroll" tabIndex={0}><table aria-label="投放渠道消耗"><thead><tr><th>渠道</th><th>广告消耗</th><th>有效样本</th></tr></thead><tbody>{state.channel.groups.map(group => <tr key={group.label}><td>{group.label}</td><td>{group.formattedValue}</td><td>{group.sampleSize}</td></tr>)}</tbody></table></div></section>}
    <p>目标不从模板或其他客户继承。需要目标时，使用团队看板的“目标进度”并确认本项目数值。</p>
  </div>;
}
