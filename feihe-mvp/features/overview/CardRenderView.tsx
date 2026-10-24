'use client';

import type { DashboardCardConfig } from './CardEditModal';
import { useState } from 'react';
import type { MetricComputeResult } from '../../lib/metrics/engine';
import { ratioSampleLabel, CARD_PRESENTATIONS } from '../../lib/metrics/config';
import { formatMetricValue } from '../../lib/metrics/display';
import type { MetricQuery } from '../../lib/metrics/query';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import { MetricDetailTable } from './MetricDetailTable';

export function CardRenderView({
  card,
  metric,
  index,
  totalCards,
  isEditing,
  onMove,
  onEdit,
  onRemove,
  datasetName,
  projectId,
  query = {},
}: {
  card: DashboardCardConfig;
  metric?: Omit<MetricComputeResult, 'key' | 'name' | 'unit'>;
  index: number;
  totalCards: number;
  isEditing: boolean;
  onMove: (delta: number) => void;
  onEdit: () => void;
  onRemove: () => void;
  datasetName?: string;
  projectId?: string;
  query?: MetricQuery;
}) {
  const [showAllGroups, setShowAllGroups] = useState(false);
  const effective = metric?.effectiveConfig || card;
  const displayVal = metric?.formattedValue ?? '—';
  const sampleSize = metric?.sampleSize ?? 0;
  const isZeroDiv = metric?.status === 'zero_division';
  const isMissingSource = metric?.status === 'missing_source';
  const isEmpty = metric?.status === 'empty';
  const format = (value: number | null) => formatMetricValue(value, effective.aggregation === 'ratio' ? 'percent' : effective.format || 'number', effective.unit, effective.aggregation === 'ratio' ? 'percentage_points' : effective.percentScale);
  const target = card.target ?? (effective.aggregation === 'ratio' || effective.format === 'percent' ? effective.aggregation !== 'ratio' && effective.percentScale === 'fraction' ? 1 : 100 : undefined);
  const progressValue = metric?.value !== null && metric?.value !== undefined && target ? metric.value / target * 100 : null;

  return (
    <div
      role="article"
      aria-label={card.title}
      className={'shared-metric-card' + (CARD_PRESENTATIONS.find(item => item.type === card.type)?.wide ? ' shared-metric-wide' : '')}
      style={{
        background: '#fff',
        borderRadius: 12,
        border: isEditing ? '2px dashed #acd8fc' : '0.5px solid #d9d9e0',
        padding: '20px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        minHeight: 180,
      }}
    >
      {/* Edit mode top toolbar */}
      {isEditing && (
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            title="前移"
            style={{ padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '0.5px solid var(--slate-6, #d9d9e0)', background: '#fff', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.35 : 1 }}
          >
            ←
          </button>
          <button
            type="button"
            disabled={index === totalCards - 1}
            onClick={() => onMove(1)}
            title="后移"
            style={{ padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '0.5px solid var(--slate-6, #d9d9e0)', background: '#fff', cursor: index === totalCards - 1 ? 'default' : 'pointer', opacity: index === totalCards - 1 ? 0.35 : 1 }}
          >
            →
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="编辑卡片"
            style={{ padding: '2px 8px', fontSize: 12, borderRadius: 4, border: '0.5px solid #acd8fc', background: '#e6f4fe', color: '#0090ff', cursor: 'pointer' }}
          >
            ✏
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="删除卡片"
            style={{ padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '0.5px solid #fdbdbe', background: '#feebec', color: '#e5484d', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="shared-metric-title" style={{ fontSize: 14, color: 'var(--slate-11, #60646c)', fontWeight: 600 }}>{card.title}</span>
          {isMissingSource && (
            <span style={{ fontSize: 12, background: '#feebec', color: '#e5484d', padding: '1px 5px', borderRadius: 4 }}>
              来源缺失
            </span>
          )}
        </div>

        <div style={{ fontSize: 22, fontWeight: 700, color: isMissingSource || isEmpty ? '#60646c' : '#1c2024', margin: '8px 0 4px' }}>
          {displayVal}
          {effective.unit && !displayVal.endsWith(effective.unit) && !displayVal.endsWith('%') && !displayVal.startsWith('¥') && displayVal !== '—' ? (
            <small style={{ fontSize: 14, fontWeight: 500, color: 'var(--slate-11, #60646c)', marginLeft: 4 }}>{effective.unit}</small>
          ) : null}
        </div>

        {isZeroDiv && (
          <div style={{ fontSize: 12, color: '#ce2c31', marginTop: 2 }}>
            分母为0，无法计算比率
          </div>
        )}
        {metric && !['ok', 'zero', 'zero_division'].includes(metric.status) && <div style={{ fontSize: 12, color: '#ce2c31' }}>{metric.statusLabel}</div>}

        {/* Progress Card Display */}
        {card.type === 'progress_card' && (
          <div style={{ marginTop: 10 }}>
            <p>{metric?.status === 'error' && !metric.effectiveConfig ? '目标待确认或计算失败' : card.target !== undefined ? <>目标：{format(card.target)} / 达成 {progressValue === null ? '—' : progressValue.toFixed(1) + '%'}</> : '历史比率基准100%（尚未设置业务目标）'}</p>
            <div style={{ height: 6, background: '#f0f0f3', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, progressValue ?? 0))}%`,
                  height: '100%',
                  background: progressValue !== null && progressValue >= 100 ? '#29a383' : '#0090ff',
                  borderRadius: 3,
                }}
              />
            </div>
            {(metric?.numerator !== undefined || metric?.denominator !== undefined) && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--slate-11, #60646c)', marginTop: 4 }}>
              <span>分子: {metric?.numerator !== undefined && metric.numerator !== null ? metric.numerator.toLocaleString() : '—'}</span>
              <span>分母: {metric?.denominator !== undefined && metric.denominator !== null ? metric.denominator.toLocaleString() : '—'}</span>
            </div>}
          </div>
        )}
        {card.type === 'time_trend' && metric?.trend && <div className="shared-metric-trend">
          <TimeSeriesChart rows={metric.trend.map(point => ({ date: point.date, value: point.value }))} series={[{ key: 'value', label: metric.definition?.name || card.title, color: '#0090ff' }]} title={card.title + '时间趋势'} unit="" valueFormatter={value => format(value)} />
          <details><summary>查看每日数值与样本</summary><div className="data-table-scroll" tabIndex={0}><table aria-label={card.title + '每日结果'}><thead><tr><th>日期</th><th>指标结果</th><th>样本</th></tr></thead><tbody>{metric.trend.map(point => <tr key={point.date}><td>{point.date}</td><td>{point.formattedValue}</td><td>{point.pairedValidCount !== undefined ? ratioSampleLabel(point, effective.missingPolicy === 'zero') : point.sampleSize + ' 行'}{!['ok', 'zero'].includes(point.status) && ' / ' + point.statusLabel}</td></tr>)}</tbody></table></div></details>
        </div>}
        {card.type === 'detail_table' && metric?.detail && projectId && <MetricDetailTable key={JSON.stringify({ definition: metric.definition, data: metric.datasetVersion, query, card })} projectId={projectId} card={card} query={query} initial={metric.detail} datasetVersion={metric.datasetVersion} definitionVersion={metric.definition?.version} />}

        {/* Group Breakdown Display */}
        {metric?.groups && metric.groups.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {(showAllGroups ? metric.groups : metric.groups.slice(0, 4)).map((g) => (
              <div key={g.label} data-testid="metric-group" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', fontSize: 12, borderBottom: '0.5px dashed #f0f0f3', paddingBottom: 2 }}>
                <span style={{ color: '#60646c' }}>{g.label}</span>
                <strong style={{ color: '#1c2024' }}>
                  {g.formattedValue}
                  {g.count !== undefined && <small style={{ fontWeight: 400, color: 'var(--slate-11, #60646c)', marginLeft: 4 }}>({g.count})</small>}
                </strong>
                {g.pairedValidCount !== undefined && <small style={{ flexBasis: '100%' }}>{ratioSampleLabel(g, effective.missingPolicy === 'zero')}</small>}
              </div>
            ))}
            {metric.groups.length > 4 && <button type="button" onClick={() => setShowAllGroups(value => !value)}>{showAllGroups ? '收起分组' : '显示全部分组'}</button>}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, paddingTop: 8, borderTop: '0.5px solid #f0f0f3', fontSize: 12, color: 'var(--slate-11, #60646c)', display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' }}>
        <span>来源: {metric?.datasetName || datasetName || '当前数据集'}</span>
        {metric?.definition && <span>指标 v{metric.definition.version} / {metric.definition.policy === 'pinned' ? '固定口径' : '跟随最新'} / 数据 v{metric.datasetVersion}</span>}
        <span>{metric?.pairedValidCount !== undefined ? ratioSampleLabel(metric, effective.missingPolicy === 'zero') : `有效样本: ${sampleSize} 行`}</span>
        {metric?.appliedQuery && <span className="shared-metric-period">{metric.appliedQuery.rangePolicy === 'independent' ? '独立周期' : '项目周期'}：{metric.appliedQuery.from || '不限开始'} ～ {metric.appliedQuery.to || '不限结束'} / {metric.appliedQuery.timeZone}{Boolean(metric.appliedQuery.undatedRows) && ` / 无日期 ${metric.appliedQuery.undatedRows} 行${metric.appliedQuery.from || metric.appliedQuery.to || card.type === 'time_trend' ? '不参与日期范围或趋势' : '参与未限期总量'}`}</span>}
      </div>
    </div>
  );
}
