/**
 * Universal Board Renderer
 * Inspired by Tencent Beacon (灯塔) Dashboard Runtime & Component Architecture.
 *
 * Features:
 * 1. Declarative layout rendering (stack | grid | tabs | paired-metrics).
 * 2. Mandatory DOM Provenance Attributes on every card/chart container:
 *    - data-project-id
 *    - data-source-file
 *    - data-section-id
 *    - data-comp-type
 *    - data-query-id
 *    - data-fields
 * 3. Generic drilldown dialog (detailFields) without bespoke handlers.
 * 4. Strict decoupling: all formatting comes from DatasetTable.columns declarations.
 */

'use client';

import React, { useState, useMemo } from 'react';
import type {
  BoardPayload,
  SectionSpec,
  ComponentInstanceSpec,
  DatasetTable,
  ColumnDef,
  AnalysisCardSpec,
} from '../../lib/core/types';
import {
  deriveThemeFromBrandColor,
  type BeaconTheme,
} from '../../lib/core/themes';
import {
  TargetBulletChart,
  NightingaleRoseChart,
  CapabilityRadarChart,
  MultiDimensionComparisonDeck,
  StackedHorizontalBarChart,
  PlacementCpmStrip,
  type ComparisonDatum,
  type NightingaleRoseDatum,
  type RadarDimension,
  type RadarSeries,
  type StackedBarRow,
  type StackedBarSegment,
} from './CampaignCharts';
import { CampaignComboChart, type ComboSeries } from './CampaignComboChart';
import {
  EffectScatterChart,
  DistributionHistogram,
  BoxPlotChart,
} from '../overview/AdvancedCharts';
import { formatPercentValue } from '../../lib/core/transform-kit';
import './campaign-analytics.css';

export interface UniversalBoardRendererProps {
  payload: BoardPayload;
  sectionId?: string;
  className?: string;
}

/**
 * Formats a raw value according to column definition.
 */
export function formatDatasetValue(val: unknown, col?: ColumnDef): string {
  if (val === null || val === undefined) return '-';
  if (col?.format === 'percent') {
    return formatPercentValue(val, col.percentInput || 'ratio', col.decimals ?? 2);
  }
  if (typeof val === 'number') {
    if (col?.format === 'currency') {
      const dec = col.decimals ?? 2;
      return `¥${val.toLocaleString('zh-CN', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
    }
    if (col?.format === 'integer') {
      return Math.round(val).toLocaleString('zh-CN');
    }
    const dec = col?.decimals ?? 2;
    return val.toLocaleString('zh-CN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s || s === '-' || s === '--' || s === 'null' || s === 'undefined') return '-';
    if (s.endsWith('%')) return s;
    return s;
  }
  return String(val);
}

/**
 * Large number Chinese unit formatting for Metric Cards (万 / 亿)
 * Keeps precise full value in tooltip/title to prevent card overflow.
 */
export function formatMetricCardValue(val: unknown, col?: ColumnDef): {
  display: string;
  unit: string;
  fullTitle: string;
} {
  const baseUnit = col?.displayUnits || '';
  if (val === null || val === undefined) {
    return { display: '未观测', unit: baseUnit, fullTitle: '未观测' };
  }
  if (col?.format === 'percent') {
    const formatted = formatPercentValue(val, col.percentInput || 'ratio', col.decimals ?? 2);
    return { display: formatted, unit: '', fullTitle: `${col?.label || ''}: ${formatted}` };
  }
  if (typeof val === 'number') {
    const abs = Math.abs(val);
    const fullFormatted = formatDatasetValue(val, col) + (baseUnit ? ` ${baseUnit}` : '');

    if (abs >= 100_000_000) {
      const yi = val / 100_000_000;
      const dec = col?.decimals ?? 2;
      return {
        display: yi.toFixed(dec),
        unit: '亿' + (baseUnit ? ` ${baseUnit}` : ''),
        fullTitle: fullFormatted,
      };
    }
    if (abs >= 100_000) {
      const wan = val / 10_000;
      const dec = col?.decimals ?? 2;
      return {
        display: wan.toFixed(dec),
        unit: '万' + (baseUnit ? ` ${baseUnit}` : ''),
        fullTitle: fullFormatted,
      };
    }

    return {
      display: formatDatasetValue(val, col),
      unit: baseUnit,
      fullTitle: fullFormatted,
    };
  }
  return { display: String(val), unit: baseUnit, fullTitle: String(val) };
}

/**
 * Pareto 80/20 Diagnostic Chart
 * Displays descending bars + cumulative % line + 80% reference threshold line.
 */
function ParetoChartComponent({
  rows,
  categoryField,
  valueField,
  theme,
  title,
  height = 260,
}: {
  rows: Record<string, unknown>[];
  categoryField?: string;
  valueField?: string;
  theme: BeaconTheme;
  title?: string;
  height?: number;
}) {
  const sorted = useMemo(() => {
    const list = rows.map((r, i) => ({
      label: String(r[categoryField || 'label'] || r.name || r.item || `项${i + 1}`),
      value: Math.max(0, Number(r[valueField || 'value'] || r.count || 0)),
    }));
    list.sort((a, b) => b.value - a.value);
    const top = list.slice(0, 10);
    const others = list.slice(10);
    if (others.length > 0) {
      const otherVal = others.reduce((acc, curr) => acc + curr.value, 0);
      top.push({ label: '其它汇总', value: otherVal });
    }
    const total = top.reduce((acc, curr) => acc + curr.value, 0);
    let cum = 0;
    return top.map(item => {
      cum += item.value;
      const pct = total > 0 ? (cum / total) * 100 : 0;
      return { ...item, cumulativePct: pct };
    });
  }, [rows, categoryField, valueField]);

  if (sorted.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.chrome.muted, fontSize: 13 }}>
        暂无数据
      </div>
    );
  }

  const maxVal = Math.max(...sorted.map(s => s.value), 1);
  const svgWidth = 600;
  const svgHeight = height;
  const padLeft = 50;
  const padRight = 50;
  const padTop = 30;
  const padBottom = 40;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const barW = Math.max(12, Math.min(36, (plotW / sorted.length) * 0.55));

  const linePoints = sorted.map((d, i) => {
    const x = padLeft + (i + 0.5) * (plotW / sorted.length);
    const y = padTop + plotH - (d.cumulativePct / 100) * plotH;
    return { x, y };
  });
  const linePath = linePoints.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const y80 = padTop + plotH - 0.8 * plotH;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', maxHeight: height }}>
        {/* Background Grid Lines */}
        {[0, 25, 50, 75, 100].map(pct => {
          const y = padTop + plotH - (pct / 100) * plotH;
          return (
            <g key={pct}>
              <line x1={padLeft} y1={y} x2={padLeft + plotW} y2={y} stroke={theme.chrome.border} strokeDasharray="2 2" />
              <text x={svgWidth - padRight + 6} y={y + 4} fontSize="10" fill={theme.chrome.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {pct}%
              </text>
            </g>
          );
        })}

        {/* 80% Threshold Line */}
        <line
          x1={padLeft}
          y1={y80}
          x2={padLeft + plotW}
          y2={y80}
          stroke={theme.semanticColors.warning}
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <text x={padLeft + 6} y={y80 - 6} fontSize="10" fontWeight="600" fill={theme.semanticColors.warning}>
          80% 核心累计贡献线
        </text>

        {/* Bars */}
        {sorted.map((d, i) => {
          const cx = padLeft + (i + 0.5) * (plotW / sorted.length);
          const barH = (d.value / maxVal) * plotH;
          const bx = cx - barW / 2;
          const by = padTop + plotH - barH;
          return (
            <g key={i}>
              <rect
                x={bx}
                y={by}
                width={barW}
                height={Math.max(2, barH)}
                fill={theme.chartPalette[0]}
                rx="3"
              >
                <title>{`${d.label}: ${d.value.toLocaleString()} (累计: ${d.cumulativePct.toFixed(1)}%)`}</title>
              </rect>
              <text
                x={cx}
                y={padTop + plotH + 16}
                fontSize="10"
                fill={theme.chrome.muted}
                textAnchor="middle"
              >
                {d.label.length > 5 ? d.label.slice(0, 4) + '..' : d.label}
              </text>
            </g>
          );
        })}

        {/* Cumulative Line */}
        <path d={linePath} fill="none" stroke={theme.chartPalette[1]} strokeWidth="2.5" />
        {linePoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill={theme.chrome.surface}
            stroke={theme.chartPalette[1]}
            strokeWidth="2"
          >
            <title>{`${sorted[i].label} 累计: ${sorted[i].cumulativePct.toFixed(1)}%`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

/**
 * Contribution Waterfall Diagnostic Chart
 * Visualizes step increases, decreases, and net change.
 */
function WaterfallChartComponent({
  rows,
  categoryField,
  valueField,
  theme,
  title,
  height = 260,
}: {
  rows: Record<string, unknown>[];
  categoryField?: string;
  valueField?: string;
  theme: BeaconTheme;
  title?: string;
  height?: number;
}) {
  const steps = useMemo(() => {
    let current = 0;
    return rows.slice(0, 10).map((r, i) => {
      const label = String(r[categoryField || 'label'] || r.name || r.step || `环节${i + 1}`);
      const delta = Number(r[valueField || 'delta'] ?? r.value ?? 0);
      const isTotal = Boolean(r.isTotal);
      const start = isTotal ? 0 : current;
      const end = isTotal ? delta : current + delta;
      if (!isTotal) current += delta;
      return { label, delta, start, end, isTotal };
    });
  }, [rows, categoryField, valueField]);

  if (steps.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.chrome.muted, fontSize: 13 }}>
        暂无数据
      </div>
    );
  }

  const allVals = steps.flatMap(s => [s.start, s.end]);
  const minVal = Math.min(0, ...allVals);
  const maxVal = Math.max(1, ...allVals);
  const range = maxVal - minVal;

  const svgWidth = 600;
  const svgHeight = height;
  const padLeft = 50;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;
  const colW = Math.max(14, Math.min(42, (plotW / steps.length) * 0.6));

  const getY = (val: number) => padTop + plotH - ((val - minVal) / range) * plotH;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', maxHeight: height }}>
        {/* Zero baseline */}
        <line x1={padLeft} y1={getY(0)} x2={padLeft + plotW} y2={getY(0)} stroke={theme.chrome.border} strokeWidth="1" />

        {/* Steps */}
        {steps.map((s, i) => {
          const cx = padLeft + (i + 0.5) * (plotW / steps.length);
          const bx = cx - colW / 2;
          const yStart = getY(s.start);
          const yEnd = getY(s.end);
          const topY = Math.min(yStart, yEnd);
          const barH = Math.max(2, Math.abs(yStart - yEnd));
          const isPositive = s.delta >= 0;
          const fill = s.isTotal
            ? theme.chartPalette[0]
            : isPositive
            ? theme.semanticColors.positive
            : theme.semanticColors.negative;

          return (
            <g key={i}>
              <rect x={bx} y={topY} width={colW} height={barH} fill={fill} rx="3">
                <title>{`${s.label}: ${s.delta >= 0 ? '+' : ''}${s.delta.toLocaleString()} (累计: ${s.end.toLocaleString()})`}</title>
              </rect>
              {/* Step connector line */}
              {i < steps.length - 1 && !s.isTotal && (
                <line
                  x1={bx + colW}
                  y1={yEnd}
                  x2={padLeft + (i + 1.5) * (plotW / steps.length) - colW / 2}
                  y2={yEnd}
                  stroke={theme.chrome.muted}
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
              )}
              <text x={cx} y={padTop + plotH + 16} fontSize="10" fill={theme.chrome.muted} textAnchor="middle">
                {s.label.length > 5 ? s.label.slice(0, 4) + '..' : s.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function UniversalBoardRenderer({ payload, sectionId, className = '' }: UniversalBoardRendererProps) {
  const { projectId, name, sections = [], datasets = {}, analysisCards = [], warnings = [] } = payload;
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [tablePages, setTablePages] = useState<Record<string, number>>({});

  const theme = useMemo(
    () => deriveThemeFromBrandColor(payload.themeColor, payload.themeId),
    [payload.themeColor, payload.themeId]
  );

  const handleFilterChange = (filterId: string, val: string) => {
    setFilterValues(prev => ({ ...prev, [filterId]: val }));
  };

  const displayedSections = useMemo(() => {
    const currentTab = sectionId || 'overview';
    // 1. Match sections with explicit tab attribute
    const matchedByTab = sections.filter(s => (s.tab || 'overview') === currentTab);
    if (matchedByTab.length > 0) {
      return matchedByTab;
    }
    // 2. Fallback matching by section id or substring
    const filteredById = sections.filter(
      s => s.id === currentTab || s.id.toLowerCase().includes(currentTab.toLowerCase())
    );
    if (filteredById.length > 0) {
      return filteredById;
    }
    // 3. Fallback to all sections for overview
    if (currentTab === 'overview') {
      return sections;
    }
    return sections;
  }, [sections, sectionId]);
  const [drilldownModal, setDrilldownModal] = useState<{
    title: string;
    dataset: DatasetTable;
    rows: Record<string, unknown>[];
    columns: ColumnDef[];
  } | null>(null);

  const handleTabChange = (sectionId: string, tabId: string) => {
    setActiveTabs(prev => ({ ...prev, [sectionId]: tabId }));
  };

  // Render individual component
  const renderComponent = (comp: ComponentInstanceSpec, section: SectionSpec, compIndex = 0) => {
    const dataset = datasets[comp.query];
    const sourceFile = `projects/${projectId}/transform.ts`;
    const fieldsAttr = [comp.field, comp.xField, comp.yField, comp.y2Field, comp.categoryField]
      .filter(Boolean)
      .join(',');

    const provenanceProps = {
      'data-project-id': projectId,
      'data-source-file': sourceFile,
      'data-section-id': section.id,
      'data-comp-type': comp.type,
      'data-query-id': comp.query,
      'data-fields': fieldsAttr,
    };

    if (!dataset) {
      return (
        <div
          className="ca-card ca-card-empty"
          key={comp.id}
          {...provenanceProps}
          style={{
            background: 'var(--dtc-theme-surface, #fff)',
            border: '1px solid var(--dtc-theme-border, #e2e8f0)',
            borderRadius: 'var(--dtc-radius, 8px)',
            padding: 16,
          }}
        >
          <div className="ca-card-header">{comp.title || comp.id}</div>
          <div style={{ color: 'var(--dtc-theme-muted, #64748b)', fontSize: 13, marginTop: 8 }}>
            未找到绑定数据集: <code>{comp.query}</code>
          </div>
        </div>
      );
    }

    // In-page interactive filtering
    let effectiveRows = dataset.rows || [];
    const dateStart = filterValues['__date_start'];
    const dateEnd = filterValues['__date_end'];
    if (dateStart || dateEnd) {
      const dateCol = dataset.columns.find(c => c.type === 'date' || c.role === 'TIMESTAMP' || c.key.includes('date'));
      if (dateCol) {
        effectiveRows = effectiveRows.filter(r => {
          const d = String(r[dateCol.key] || '');
          if (dateStart && d < dateStart) return false;
          if (dateEnd && d > dateEnd) return false;
          return true;
        });
      }
    }

    const activeFilters = Object.entries(filterValues).filter(([k, v]) => v && v !== 'all' && !k.startsWith('__date_'));
    if (activeFilters.length > 0 && effectiveRows.length > 0) {
      effectiveRows = effectiveRows.filter(row => {
        return activeFilters.every(([fKey, fVal]) => {
          if (row[fKey] !== undefined) {
            return String(row[fKey]) === fVal;
          }
          return true;
        });
      });
    }

    // 0. select-filter (interactive in-page filter)
    if (comp.type === 'select-filter') {
      const filterKey = comp.field || comp.categoryField || 'category';
      const options = Array.from(
        new Set((dataset.rows || []).map(r => String(r[filterKey] || '')).filter(Boolean))
      );
      const currentVal = filterValues[filterKey] || 'all';

      return (
        <div
          key={comp.id}
          {...provenanceProps}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            background: 'var(--dtc-theme-surface, #ffffff)',
            border: '1px solid var(--dtc-theme-border, #e2e8f0)',
            borderRadius: 'var(--dtc-radius, 8px)',
            minHeight: 36,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--dtc-theme-muted, #64748b)', fontWeight: 500 }}>
            {comp.title || '筛选维度'}:
          </span>
          <select
            value={currentVal}
            onChange={e => handleFilterChange(filterKey, e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 13,
              color: 'var(--dtc-theme-text, #18263c)',
              cursor: 'pointer',
              outline: 'none',
              fontWeight: 500,
            }}
          >
            <option value="all">全部选项 ({options.length})</option>
            {options.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // 0. date-range-filter (interactive in-page date badge)
    if (comp.type === 'date-range-filter') {
      const targetDateField = (comp.props?.dateField as string) || comp.field || comp.xField;
      const dateCol = targetDateField
        ? dataset.columns.find(c => c.key === targetDateField)
        : dataset.columns.find(c => c.type === 'date' || c.role === 'TIMESTAMP' || c.key.toLowerCase().includes('date'));
      const allDates = dateCol ? (dataset.rows || []).map(r => String(r[dateCol.key] || '')).filter(Boolean).sort() : [];
      const minDate = allDates[0] || '';
      const maxDate = allDates[allDates.length - 1] || '';
      const startDate = filterValues['__date_start'] || '';
      const endDate = filterValues['__date_end'] || '';

      return (
        <div
          key={comp.id}
          {...provenanceProps}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            padding: '6px 14px',
            background: 'var(--dtc-theme-surface, #ffffff)',
            border: '1px solid var(--dtc-theme-border, #e2e8f0)',
            borderRadius: 'var(--dtc-radius, 8px)',
            minHeight: 36,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--dtc-theme-muted, #64748b)', fontWeight: 500 }}>
            📅 {comp.title || '观测周期'}:
          </span>
          <input
            type="date"
            value={startDate}
            min={minDate}
            max={maxDate}
            onChange={e => {
              const newStart = e.target.value;
              handleFilterChange('__date_start', newStart);
              if (endDate && newStart > endDate) {
                handleFilterChange('__date_end', newStart);
              }
            }}
            style={{
              border: '1px solid var(--dtc-theme-border, #cbd5e1)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 12,
              color: 'var(--dtc-theme-text, #18263c)',
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--dtc-theme-muted, #64748b)' }}>至</span>
          <input
            type="date"
            value={endDate}
            min={minDate}
            max={maxDate}
            onChange={e => {
              const newEnd = e.target.value;
              handleFilterChange('__date_end', newEnd);
              if (startDate && newEnd < startDate) {
                handleFilterChange('__date_start', newEnd);
              }
            }}
            style={{
              border: '1px solid var(--dtc-theme-border, #cbd5e1)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 12,
              color: 'var(--dtc-theme-text, #18263c)',
            }}
          />
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                handleFilterChange('__date_start', '');
                handleFilterChange('__date_end', '');
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: theme.chrome.accent,
                fontSize: 12,
                cursor: 'pointer',
                padding: '0 4px',
              }}
            >
              重置
            </button>
          )}
        </div>
      );
    }

    // 1. metric-card
    if (comp.type === 'metric-card') {
      const col = dataset.columns.find(c => c.key === comp.field);
      const rawVal = effectiveRows[0]?.[comp.field || ''];
      const { display, unit, fullTitle } = formatMetricCardValue(rawVal, col);
      const isHeroSpotlight =
        (section.layout === 'paired-metrics' || section.variant === 'hero-spotlight') && compIndex === 0;

      if (isHeroSpotlight) {
        return (
          <div
            className="ca-card ca-kpi-card ca-kpi-card-hero"
            key={comp.id}
            title={fullTitle}
            {...provenanceProps}
            style={{
              flex: 1,
              minWidth: 180,
              background: `linear-gradient(135deg, ${theme.chrome.accent}, color-mix(in srgb, ${theme.chrome.accent} 82%, #000))`,
              border: `1px solid ${theme.chrome.accent}`,
              borderRadius: 'var(--dtc-radius, 8px)',
              boxShadow: '0 4px 14px -2px rgba(0, 0, 0, 0.12)',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: 12,
                top: 10,
                fontSize: 18,
                opacity: 0.28,
                userSelect: 'none',
              }}
            >
              ★
            </span>
            <div className="ca-kpi-label" style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.88)', fontWeight: 600, letterSpacing: '0.02em' }}>
              {comp.title || col?.label || comp.id}
            </div>
            <div className="ca-kpi-value-row" style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
              <span
                className="ca-kpi-value"
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: '#ffffff',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.8px',
                }}
              >
                {display}
              </span>
              {unit && (
                <span className="ca-kpi-unit" style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.82)', fontWeight: 500 }}>
                  {unit}
                </span>
              )}
            </div>
          </div>
        );
      }

      return (
        <div
          className="ca-card ca-kpi-card"
          key={comp.id}
          title={fullTitle}
          {...provenanceProps}
          style={{
            flex: 1,
            minWidth: 180,
            background: 'var(--dtc-theme-surface, #ffffff)',
            border: '1px solid var(--dtc-theme-border, #e2e8f0)',
            borderTop: '2px solid var(--dtc-theme-border, #cbd5e1)',
            borderRadius: 'var(--dtc-radius, 8px)',
            boxShadow: 'none',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div className="ca-kpi-label" style={{ fontSize: 13, color: 'var(--dtc-theme-muted, #64748b)', fontWeight: 500 }}>
            {comp.title || col?.label || comp.id}
          </div>
          <div className="ca-kpi-value-row" style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 }}>
            <span
              className="ca-kpi-value"
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--dtc-theme-text, #18263c)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.5px',
              }}
            >
              {display}
            </span>
            {unit && (
              <span className="ca-kpi-unit" style={{ fontSize: 12, color: 'var(--dtc-theme-muted, #64748b)' }}>
                {unit}
              </span>
            )}
          </div>
        </div>
      );
    }

    // 2. data-table
    if (comp.type === 'data-table') {
      const cols = dataset.columns || [];
      const rows = effectiveRows;
      const pageSize = 15;
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
      const currentPage = Math.min(totalPages, Math.max(1, tablePages[comp.id] || 1));
      const displayRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

      return (
        <div
          className="ca-card ca-table-card"
          key={comp.id}
          {...provenanceProps}
          style={{
            width: '100%',
            overflow: 'hidden',
            background: 'var(--dtc-theme-surface, #ffffff)',
            border: '1px solid var(--dtc-theme-border, #e2e8f0)',
            borderRadius: 'var(--dtc-radius, 8px)',
            boxShadow: 'none',
          }}
        >
          <div
            className="ca-card-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--dtc-theme-border, #e2e8f0)',
              background: 'var(--dtc-theme-surface, #ffffff)',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--dtc-theme-text, #18263c)' }}>
              {comp.title || dataset.name || comp.id}
            </span>
            <span style={{ fontSize: 12, color: 'var(--dtc-theme-muted, #64748b)' }}>共 {rows.length} 条记录</span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 420 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead style={{ background: theme.chrome.headBg, position: 'sticky', top: 0 }}>
                <tr>
                  {cols.map(c => (
                    <th
                      key={c.key}
                      style={{
                        padding: '10px 12px',
                        borderBottom: `1px solid ${theme.chrome.border}`,
                        fontWeight: 600,
                        color: theme.chrome.text,
                        textAlign: c.align || (c.type === 'number' ? 'right' : 'left'),
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: `1px solid ${theme.chrome.border}`,
                      background: idx % 2 === 0 ? theme.chrome.surface : theme.chrome.canvas,
                    }}
                  >
                    {cols.map(c => {
                      const cellVal = row[c.key];
                      return (
                        <td
                          key={c.key}
                          style={{
                            padding: '8px 12px',
                            textAlign: c.align || (c.type === 'number' ? 'right' : 'left'),
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums',
                            color: theme.chrome.text,
                          }}
                        >
                          {formatDatasetValue(cellVal, c)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 16px',
                background: theme.chrome.headBg,
                borderTop: `1px solid ${theme.chrome.border}`,
                fontSize: 12,
              }}
            >
              <span style={{ color: theme.chrome.muted }}>
                第 {currentPage} / {totalPages} 页 (共 {rows.length} 条记录)
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setTablePages(prev => ({ ...prev, [comp.id]: currentPage - 1 }))}
                  style={{
                    padding: '3px 8px',
                    background: theme.chrome.surface,
                    border: `1px solid ${theme.chrome.border}`,
                    borderRadius: 4,
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage <= 1 ? 0.4 : 1,
                    fontSize: 12,
                    color: theme.chrome.text,
                  }}
                >
                  上一页
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setTablePages(prev => ({ ...prev, [comp.id]: currentPage + 1 }))}
                  style={{
                    padding: '3px 8px',
                    background: theme.chrome.surface,
                    border: `1px solid ${theme.chrome.border}`,
                    borderRadius: 4,
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage >= totalPages ? 0.4 : 1,
                    fontSize: 12,
                    color: theme.chrome.text,
                  }}
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // 3. line-bar-combo or time-series (Render with CampaignComboChart)
    if (comp.type === 'line-bar-combo' || comp.type === 'time-series') {
      const rows = effectiveRows;

      // Graceful fallback for 0 rows
      if (rows.length === 0) {
        return (
          <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
            <div className="ca-card-header" style={{ marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: theme.chrome.text }}>{comp.title || comp.id}</span>
            </div>
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.chrome.muted, fontSize: 13 }}>
              暂无趋势数据
            </div>
          </div>
        );
      }

      const xCol = dataset.columns.find(c => c.key === comp.xField);
      const yCol = dataset.columns.find(c => c.key === comp.yField);
      const y2Col = comp.y2Field ? dataset.columns.find(c => c.key === comp.y2Field) : undefined;

      const series: ComboSeries[] = [
        {
          key: comp.yField || 'spend',
          label: yCol?.label || comp.yField || '主要指标',
          unit: yCol?.displayUnits || '',
          axis: 'left',
          kind: 'bar',
          color: theme.chartPalette[0],
        },
      ];
      if (comp.y2Field) {
        series.push({
          key: comp.y2Field,
          label: y2Col?.label || comp.y2Field || '对比指标',
          unit: y2Col?.displayUnits || '',
          axis: 'right',
          kind: 'line',
          color: theme.chartPalette[1],
        });
      }

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: theme.chrome.text }}>{comp.title || comp.id}</span>
          </div>
          <CampaignComboChart
            rows={rows}
            series={series}
            xKey={comp.xField || 'date'}
            title={comp.title || comp.id}
            height={260}
          />
        </div>
      );
    }

    // 3.5 pareto-chart (Pareto 80/20 Diagnostic Chart)
    if (comp.type === 'pareto-chart') {
      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16, width: '100%' }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: theme.chrome.text }}>
              {comp.title || '帕累托二八贡献分析'}
            </span>
          </div>
          <ParetoChartComponent
            rows={effectiveRows}
            categoryField={comp.categoryField || comp.xField}
            valueField={comp.field || comp.yField}
            theme={theme}
            title={comp.title}
            height={260}
          />
        </div>
      );
    }

    // 3.6 contribution-waterfall (Contribution Waterfall Chart)
    if (comp.type === 'contribution-waterfall') {
      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16, width: '100%' }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: theme.chrome.text }}>
              {comp.title || '增减贡献瀑布图'}
            </span>
          </div>
          <WaterfallChartComponent
            rows={effectiveRows}
            categoryField={comp.categoryField || comp.xField}
            valueField={comp.field || comp.yField}
            theme={theme}
            title={comp.title}
            height={260}
          />
        </div>
      );
    }

    // 4. target-bullet (Target Bullet Chart)
    if (comp.type === 'target-bullet') {
      const bulletData: ComparisonDatum[] = effectiveRows
        .filter(r => (r[comp.field || 'actual'] ?? r.value) !== null && (r[comp.field || 'actual'] ?? r.value) !== undefined)
        .map(r => ({
          label: String(r[comp.categoryField || 'label'] || r.label || r.name || ''),
          actual: Number(r[comp.field || 'actual'] ?? r.value),
          target: r[comp.targetField || 'target'] !== null && r[comp.targetField || 'target'] !== undefined ? Number(r[comp.targetField || 'target']) : 0,
          unit: (comp as any).unit || '元',
        }));

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: theme.chrome.text }}>{comp.title || comp.id}</span>
          </div>
          <TargetBulletChart data={bulletData} />
        </div>
      );
    }

    // 5. donut-rose (Nightingale Rose Chart)
    if (comp.type === 'donut-rose') {
      const roseData: NightingaleRoseDatum[] = effectiveRows.map((r, i) => ({
        name: String(r[comp.categoryField || 'label'] || r.name || r.channel || `类别${i + 1}`),
        value: Math.max(0, Number(r[comp.field || 'value'] || 0)),
        cpm: r.cpm !== undefined ? Number(r.cpm) : undefined,
        cpuv: r.cpuv !== undefined ? Number(r.cpuv) : undefined,
      }));

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: theme.chrome.text }}>{comp.title || comp.id}</span>
          </div>
          <NightingaleRoseChart data={roseData} height={250} />
        </div>
      );
    }

    // 6. capability-radar (Multi-dimensional Radar Chart)
    if (comp.type === 'capability-radar') {
      const numCols = dataset.columns.filter(c => c.type === 'number').slice(0, 6);
      const dims: RadarDimension[] = numCols.map(c => {
        const maxVal = Math.max(...effectiveRows.map(r => Number(r[c.key]) || 0), 100);
        return { name: c.label, max: maxVal > 0 ? maxVal : 100 };
      });
      const colors = theme.chartPalette.slice(0, 4);
      const radarSeries: RadarSeries[] = effectiveRows.slice(0, 3).map((r, i) => ({
        name: String(r[comp.categoryField || 'name'] || r.label || `系列${i + 1}`),
        values: numCols.map(c => Number(r[c.key]) || 0),
        color: colors[i % colors.length],
      }));

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: theme.chrome.text }}>{comp.title || comp.id}</span>
          </div>
          <CapabilityRadarChart dimensions={dims} series={radarSeries} height={250} />
        </div>
      );
    }

    // 7. multi-line-deck (Multi-channel / Business lines deck)
    if (comp.type === 'multi-line-deck') {
      const pal = theme.chartPalette;
      const deckItems = effectiveRows.map((r, rIdx) => ({
        title: String(r[comp.categoryField || 'name'] || r.channel || r.line || '业务线'),
        color: pal[rIdx % pal.length],
        metrics: dataset.columns.filter(c => c.key !== 'name' && c.key !== 'id').slice(0, 4).map(c => ({
          label: c.label,
          value: formatDatasetValue(r[c.key], c),
        })),
      }));

      return (
        <div className="ca-card ca-deck-card" key={comp.id} {...provenanceProps} style={{ padding: 16, width: '100%' }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: theme.chrome.text }}>{comp.title || comp.id}</span>
          </div>
          <MultiDimensionComparisonDeck items={deckItems} />
        </div>
      );
    }

    // 8. percent-stack (100% Stacked Bar Chart)
    if (comp.type === 'percent-stack') {
      const numCols = dataset.columns.filter(c => c.type === 'number');
      const pal = theme.chartPalette;
      const segments: StackedBarSegment[] = numCols.map((c, i) => ({
        key: c.key,
        label: c.label,
        color: pal[i % pal.length],
      }));
      const stackRows: StackedBarRow[] = effectiveRows.map(r => ({
        label: String(r[comp.xField || 'name'] || r.label || ''),
        segments: Object.fromEntries(numCols.map(c => [c.key, Number(r[c.key]) || 0])),
      }));

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: theme.chrome.text }}>{comp.title || comp.id}</span>
          </div>
          <StackedHorizontalBarChart rows={stackRows} segments={segments} normalize100={true} />
        </div>
      );
    }

    // 9. effect-scatter (Scatter quadrant chart)
    if (comp.type === 'effect-scatter') {
      const xCol = dataset.columns.find(c => c.key === comp.xField);
      const yCol = dataset.columns.find(c => c.key === comp.yField);
      const pal = theme.chartPalette;
      const points = effectiveRows
        .filter(r => r[comp.xField || 'x'] !== null && r[comp.xField || 'x'] !== undefined && r[comp.yField || 'y'] !== null && r[comp.yField || 'y'] !== undefined)
        .map((r, i) => ({
          x: Number(r[comp.xField || 'x']),
          y: Number(r[comp.yField || 'y']),
          size: Math.max(4, Math.min(20, Math.sqrt(Number(r.spend || r.size || 100)))),
          color: pal[i % pal.length],
          label: String(r[comp.categoryField || 'label'] || r.name || `实体${i + 1}`),
          id: String(r.id || i),
        }));

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16, width: '100%' }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: theme.chrome.text }}>{comp.title || comp.id}</span>
          </div>
          <EffectScatterChart
            points={points}
            xLabel={xCol?.label || '成本投入'}
            yLabel={yCol?.label || '转化效率'}
            height={280}
          />
        </div>
      );
    }

    // 10. distribution-histogram
    if (comp.type === 'distribution-histogram') {
      const bins = effectiveRows.map(r => ({
        label: String(r.bucket || r.label || r[comp.categoryField || 'name'] || ''),
        count: Number(r.count || r.value || r[comp.field || 'count'] || 0),
      }));

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: theme.chrome.text }}>{comp.title || comp.id}</span>
          </div>
          <DistributionHistogram bins={bins} height={240} />
        </div>
      );
    }

    // 11. grouped-boxplot
    if (comp.type === 'grouped-boxplot') {
      const pal = theme.chartPalette;
      const groups = effectiveRows.map((r, i) => {
        const rawVals = r.values;
        const vals = Array.isArray(rawVals)
          ? (rawVals as number[])
          : [Number(r.min || 0), Number(r.q1 || 0), Number(r.median || 0), Number(r.q3 || 0), Number(r.max || 0)];
        return {
          label: String(r.group || r.label || r.name || `组${i + 1}`),
          values: vals,
          color: pal[i % pal.length],
        };
      });

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: theme.chrome.text }}>{comp.title || comp.id}</span>
          </div>
          <BoxPlotChart groups={groups} height={250} />
        </div>
      );
    }

    // 12. comment-qc-panel
    if (comp.type === 'comment-qc-panel') {
      const rows = effectiveRows;
      return (
        <div className="ca-card" key={comp.id} {...provenanceProps} style={{ padding: 16, width: '100%' }}>
          <div className="ca-card-header" style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
            {comp.title || '舆情与评论质检面板'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {rows.slice(0, 4).map((r, i) => (
              <div key={i} style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>{String(r.label || r.keyword || `规则${i + 1}`)}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: '#0f172a' }}>
                  {String(r.value || r.count || '-')}
                </div>
                {Boolean(r.status) && (
                  <span className="semantic-tag tag-ok" style={{ marginTop: 6, display: 'inline-block', fontSize: 11 }}>
                    {String(r.status)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 10. placement-efficiency-strip / placement-cpm-strip
    if (comp.type === 'placement-efficiency-strip' || comp.type === 'placement-cpm-strip') {
      const items = effectiveRows.map(r => ({
        name: String(r.name || r.placement || r.channel || r.line || r.title || r.category || '版位'),
        spend: typeof r.spend === 'number' ? r.spend : typeof r.cost === 'number' ? r.cost : typeof r.actualSpend === 'number' ? r.actualSpend : null,
        cpm: typeof r.cpm === 'number' ? r.cpm : typeof r.cost_per_mille === 'number' ? r.cost_per_mille : null,
        cpuv: typeof r.cpuv === 'number' ? r.cpuv : typeof r.cost_per_uv === 'number' ? r.cost_per_uv : typeof r.cpc === 'number' ? r.cpc : null,
      }));

      return (
        <div
          className="ca-card"
          key={comp.id}
          {...provenanceProps}
          style={{
            padding: '16px 20px',
            width: '100%',
            background: '#ffffff',
            borderRadius: 10,
            border: `1px solid ${theme.chrome.border}`,
          }}
        >
          {comp.title && (
            <div className="ca-card-header" style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: theme.chrome.text }}>
              {comp.title}
            </div>
          )}
          <PlacementCpmStrip items={items} />
        </div>
      );
    }

    // Clean Data Preview Fallback for any unmapped component (never prints text placeholder)
    const displayCols = dataset.columns.slice(0, 5);
    const previewRows = effectiveRows.slice(0, 6);
    return (
      <div className="ca-card" key={comp.id} {...provenanceProps} style={{ padding: 16, width: '100%' }}>
        <div className="ca-card-header" style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
          <span>{comp.title || dataset.name || comp.id}</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>共 {effectiveRows.length} 条记录</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                {displayCols.map(c => (
                  <th key={c.key} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {displayCols.map(c => (
                    <td key={c.key} style={{ padding: '6px 10px' }}>{formatDatasetValue(r[c.key], c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render section layout
  const renderSection = (sec: SectionSpec, secIndex = 0) => {
    const layout = sec.layout || 'stack';
    const components = sec.components || [];

    const sectionHeader = sec.title ? (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: `1px solid ${theme.chrome.border}35`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: 6,
              background: `linear-gradient(135deg, ${theme.chrome.accent}, ${theme.chrome.accent}dd)`,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              boxShadow: `0 2px 4px ${theme.chrome.accent}33`,
            }}
          >
            {String(secIndex + 1).padStart(2, '0')}
          </span>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.chrome.text, margin: 0, letterSpacing: '-0.01em' }}>
            {sec.title}
          </h3>
        </div>
        {(sec.hint || sec.description) && (
          <span
            style={{
              fontSize: 12,
              color: theme.chrome.muted,
              background: theme.chrome.headBg || '#f8fafc',
              border: `1px solid ${theme.chrome.border}`,
              padding: '3px 10px',
              borderRadius: 9999,
              fontWeight: 500,
            }}
          >
            {sec.hint || sec.description}
          </span>
        )}
      </div>
    ) : null;

    let bodyContent: React.ReactNode = null;

    // Tabs layout
    if (sec.tabs && sec.tabs.length > 0) {
      const activeTabId = activeTabs[sec.id] || sec.tabs[0].id;
      const activeTab = sec.tabs.find(t => t.id === activeTabId) || sec.tabs[0];

      bodyContent = (
        <div>
          <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${theme.chrome.border}`, marginBottom: 16 }}>
            {sec.tabs.map(tab => (
              <button
                type="button"
                key={tab.id}
                onClick={() => handleTabChange(sec.id, tab.id)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTabId === tab.id ? `2px solid ${theme.chrome.accent}` : '2px solid transparent',
                  color: activeTabId === tab.id ? theme.chrome.accent : theme.chrome.muted,
                  fontWeight: activeTabId === tab.id ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {tab.title}
              </button>
            ))}
          </div>
          <div>{activeTab.sections?.map((s, sIdx) => renderSection(s, sIdx))}</div>
        </div>
      );
    } else if (layout === 'paired-metrics') {
      const count = components.length;
      let gridTemplate = 'repeat(4, minmax(0, 1fr))';
      if (count === 4) {
        gridTemplate = 'repeat(4, minmax(0, 1fr))';
      } else if (count === 2 || count === 6) {
        gridTemplate = `repeat(${count}, minmax(0, 1fr))`;
      } else if (count % 2 === 1) {
        gridTemplate = `repeat(${count}, minmax(180px, 1fr))`;
      }

      bodyContent = (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: gridTemplate,
            gap: 16,
          }}
        >
          {components.map((comp, cIdx) => renderComponent(comp, sec, cIdx))}
        </div>
      );
    } else if (layout === 'bento-split') {
      bodyContent = (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          {components.map((comp, cIdx) => (
            <div key={comp.id} style={{ minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
              {renderComponent(comp, sec, cIdx)}
            </div>
          ))}
        </div>
      );
    } else if (layout === 'grid') {
      const cols = sec.columns || 2;
      bodyContent = (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: 16,
          }}
        >
          {components.map((comp, cIdx) => {
            const isLastOdd = cols === 2 && components.length % 2 === 1 && cIdx === components.length - 1;
            return (
              <div
                key={comp.id}
                style={{
                  gridColumn: isLastOdd ? '1 / -1' : undefined,
                  minWidth: 0,
                }}
              >
                {renderComponent(comp, sec, cIdx)}
              </div>
            );
          })}
        </div>
      );
    } else {
      bodyContent = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {components.map((comp, cIdx) => renderComponent(comp, sec, cIdx))}
        </div>
      );
    }

    return (
      <div
        className="ca-section ca-macro-section-card"
        key={sec.id}
        data-section-id={sec.id}
        style={{
          backgroundColor: '#ffffff',
          border: `1px solid ${theme.chrome.border}`,
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 20,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
        }}
      >
        {sectionHeader}
        {bodyContent}
      </div>
    );
  };

  return (
    <div
      className={`ca-universal-board universal-board-root ${className}`}
      data-project-id={projectId}
      style={{
        maxWidth: 1440,
        margin: '0 auto',
        padding: '20px clamp(16px, 3vw, 36px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minWidth: 0,
        backgroundColor: theme.chrome.canvas,
        color: theme.chrome.text,
        fontFamily: "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
        ...(theme.cssVariables as any),
      }}
    >
      {/* Warnings bar */}
      {warnings.length > 0 && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            color: theme.semanticColors.warning,
            borderRadius: 6,
            padding: '10px 16px',
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {warnings.map((w, idx) => (
            <div key={idx}>⚠️ {w}</div>
          ))}
        </div>
      )}

      {/* Sections */}
      {displayedSections.map((sec, idx) => renderSection(sec, idx))}

      {/* Analysis Cards */}
      {analysisCards.length > 0 && (
        <div className="ca-analysis-deck" style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>💡 AI 洞察与行动建议</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {analysisCards.map(c => (
              <div
                key={c.id}
                className="ca-card ca-insight-card"
                data-project-id={projectId}
                data-source-file={`projects/${projectId}/transform.ts`}
                data-comp-type="analysis-insight-card"
                data-target-query-ids={c.targetQueryIds.join(',')}
                style={{
                  padding: 16,
                  borderLeft: `4px solid ${c.severity === 'warning' ? theme.semanticColors.warning : theme.semanticColors.positive}`,
                  background: theme.chrome.surface,
                  border: `1px solid ${theme.chrome.border}`,
                  borderRadius: 'var(--dtc-radius, 8px)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{c.title}</div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{c.summary}</div>
                {c.recommendations && c.recommendations.length > 0 && (
                  <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 12, color: '#64748b' }}>
                    {c.recommendations.map((rec, rIdx) => (
                      <li key={rIdx}>{rec}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generic Drilldown Modal */}
      {drilldownModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setDrilldownModal(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 24,
              maxWidth: '80vw',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h4 style={{ margin: 0, fontSize: 16 }}>{drilldownModal.title}</h4>
              <button type="button" onClick={() => setDrilldownModal(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {drilldownModal.columns.map(c => (
                    <th key={c.key} style={{ padding: 8, borderBottom: '1px solid #cbd5e1' }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drilldownModal.rows.map((r, i) => (
                  <tr key={i}>
                    {drilldownModal.columns.map(c => (
                      <td key={c.key} style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>{String(r[c.key] ?? '-')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
