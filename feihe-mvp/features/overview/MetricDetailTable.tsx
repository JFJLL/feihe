'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/hooks/use-project-data';
import { formatMetricValue } from '../../lib/metrics/display';
import type { MetricComputeResult } from '../../lib/metrics/engine';
import type { MetricQuery } from '../../lib/metrics/query';
import type { DatasetColumn } from '../../lib/datasets';
import type { DashboardCardConfig } from './CardEditModal';

function cell(value: unknown, column: DatasetColumn) {
  if (value === null || value === undefined || value === '') return '—';
  if (column.type === 'number' && typeof value === 'number') return formatMetricValue(value, column.numericUnit === 'percent' ? 'percent' : 'number', '', column.percentScale);
  if (typeof value === 'boolean') return value ? '是' : '否';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
// The parent keys this component by definition/data/query, so a changed context starts at page one.
export function MetricDetailTable({ projectId, card, query, initial, datasetVersion, definitionVersion }: {
  projectId: string; card: DashboardCardConfig; query: MetricQuery; initial: NonNullable<MetricComputeResult['detail']>;
  datasetVersion?: number; definitionVersion?: number;
}) {
  const [page, setPage] = useState(1), [snapshot, setSnapshot] = useState<{ key: string; data?: MetricComputeResult['detail']; error?: string; notice?: string }>({ key: '' });
  const key = JSON.stringify({ projectId, card, query, page });
  useEffect(() => {
    if (page === 1) return;
    const controller = new AbortController(); let current = true;
    const params = JSON.parse(key);
    api<{ metric: MetricComputeResult }>('/api/metrics', { method: 'POST', signal: controller.signal, body: JSON.stringify({ projectId: params.projectId, card: params.card, query: { ...params.query, detailPage: params.page } }) }).then(result => {
      if (current && (result.metric.datasetVersion !== datasetVersion || result.metric.definition?.version !== definitionVersion)) {
        setSnapshot({ key, notice: '来源或口径已更新，正在重读同一版本的看板与明细…' });
        window.dispatchEvent(new CustomEvent('app:datasets-changed', { detail: { projectId: params.projectId } }));
        return;
      }
      if (current) setSnapshot(result.metric.detail ? { key, data: result.metric.detail } : { key, error: result.metric.statusLabel || '明细查询失败' });
    }).catch(error => { if (current) setSnapshot({ key, error: error instanceof Error ? error.message : '明细查询失败' }); });
    return () => { current = false; controller.abort(); };
  }, [key, page, datasetVersion, definitionVersion]);
  const data = page === 1 ? initial : snapshot.key === key ? snapshot.data : undefined;
  if (!data) return <div>{snapshot.key === key && snapshot.error ? <p role="alert">{snapshot.error}<button onClick={() => setPage(1)}>返回首页重试</button></p> : <p role="status">{snapshot.key === key && snapshot.notice || '正在查询明细…'}</p>}</div>;
  return <div className="metric-detail">
    <div className="data-table-scroll" tabIndex={0} aria-label="指标明细横向滚动" onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.currentTarget.scrollBy({ left: e.key === 'ArrowRight' ? 120 : -120 }); } }}><table aria-label={card.title + '明细'}><thead><tr>{data.columns.map(column => <th key={column.key}>{column.name}</th>)}</tr></thead><tbody>{data.rows.map((row, index) => <tr key={index}>{data.columns.map(column => <td key={column.key}>{cell(row[column.key], column)}</td>)}</tr>)}</tbody></table></div>
    <p>共 {data.total} 条符合条件记录 · 第 {data.page} / {data.totalPages} 页</p>
    {!data.rows.length && <p>当前周期和筛选没有记录。</p>}
    <div className="data-actions"><button disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>明细上一页</button><button disabled={data.page >= data.totalPages} onClick={() => setPage(data.page + 1)}>明细下一页</button></div>
  </div>;
}
