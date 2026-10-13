'use client';

import type { DashboardCardConfig } from './CardEditModal';
import { useState } from 'react';
import type { MetricComputeResult } from '../../lib/metrics/engine';
import { ratioSampleLabel } from '../../lib/metrics/config';

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
}) {
  const [showAllGroups, setShowAllGroups] = useState(false);
  const displayVal = metric?.formattedValue ?? '—';
  const sampleSize = metric?.sampleSize ?? 0;
  const isZeroDiv = metric?.status === 'zero_division';
  const isMissingSource = metric?.status === 'missing_source';
  const isEmpty = metric?.status === 'empty';
  const progressValue = (metric?.value ?? 0) * (card.aggregation !== 'ratio' && card.percentScale === 'fraction' ? 100 : 1);

  return (
    <div
      role="article"
      aria-label={card.title}
      style={{
        background: '#fff',
        borderRadius: 12,
        border: isEditing ? '2px dashed #93c5fd' : '1px solid #e2e8f0',
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
            style={{ padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.35 : 1 }}
          >
            ←
          </button>
          <button
            type="button"
            disabled={index === totalCards - 1}
            onClick={() => onMove(1)}
            title="后移"
            style={{ padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: index === totalCards - 1 ? 'default' : 'pointer', opacity: index === totalCards - 1 ? 0.35 : 1 }}
          >
            →
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="编辑卡片"
            style={{ padding: '2px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #93c5fd', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}
          >
            ✏
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="删除卡片"
            style={{ padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #fca5a5', background: '#fee2e2', color: '#ef4444', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{card.title}</span>
          {isMissingSource && (
            <span style={{ fontSize: 10, background: '#fee2e2', color: '#ef4444', padding: '1px 5px', borderRadius: 4 }}>
              来源缺失
            </span>
          )}
        </div>

        <div style={{ fontSize: 28, fontWeight: 700, color: isMissingSource || isEmpty ? '#94a3b8' : '#0f172a', margin: '8px 0 4px' }}>
          {displayVal}
          {card.unit && !displayVal.endsWith(card.unit) && !displayVal.endsWith('%') && !displayVal.startsWith('¥') && displayVal !== '—' ? (
            <small style={{ fontSize: 14, fontWeight: 500, color: '#64748b', marginLeft: 4 }}>{card.unit}</small>
          ) : null}
        </div>

        {isZeroDiv && (
          <div style={{ fontSize: 11, color: '#e11d48', marginTop: 2 }}>
            分母为0，无法计算比率
          </div>
        )}
        {metric && !['ok', 'zero', 'zero_division'].includes(metric.status) && <div style={{ fontSize: 12, color: '#b91c1c' }}>{metric.statusLabel}</div>}

        {/* Progress Card Display */}
        {card.type === 'progress_card' && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, progressValue))}%`,
                  height: '100%',
                  background: progressValue >= 100 ? '#16a34a' : '#2563eb',
                  borderRadius: 3,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 4 }}>
              <span>分子: {metric?.numerator !== undefined && metric.numerator !== null ? metric.numerator.toLocaleString() : '—'}</span>
              <span>分母: {metric?.denominator !== undefined && metric.denominator !== null ? metric.denominator.toLocaleString() : '—'}</span>
            </div>
          </div>
        )}

        {/* Group Breakdown Display */}
        {metric?.groups && metric.groups.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {(showAllGroups ? metric.groups : metric.groups.slice(0, 4)).map((g) => (
              <div key={g.label} data-testid="metric-group" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px dashed #f1f5f9', paddingBottom: 2 }}>
                <span style={{ color: '#475569' }}>{g.label}</span>
                <strong style={{ color: '#0f172a' }}>
                  {g.formattedValue}
                  {g.count !== undefined && <small style={{ fontWeight: 400, color: '#64748b', marginLeft: 4 }}>({g.count})</small>}
                </strong>
                {g.pairedValidCount !== undefined && <small style={{ flexBasis: '100%' }}>{ratioSampleLabel(g, card.missingPolicy === 'zero')}</small>}
              </div>
            ))}
            {metric.groups.length > 4 && <button type="button" onClick={() => setShowAllGroups(value => !value)}>{showAllGroups ? '收起分组' : '显示全部分组'}</button>}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, paddingTop: 8, borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' }}>
        <span>来源: {datasetName || '当前数据集'}</span>
        <span>{metric?.pairedValidCount !== undefined ? ratioSampleLabel(metric, card.missingPolicy === 'zero') : `有效样本: ${sampleSize} 行`}</span>
      </div>
    </div>
  );
}
