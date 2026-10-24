/**
 * CampaignDailyDiagnostics.tsx
 *
 * Daily Diagnostic Analysis:
 * 1. 累计消耗 vs 累计产出 (缺日断线不以0充数，清晰标注覆盖天数)
 * 2. 日期 x 指标热力图 (每指标独立色系，可键盘/点击交互，稳定读数，缺失置灰)
 * 3. 投放规模与单位成本/效率 (散点分布，包含真实0成本/ROI，动态单位)
 * 4. 自然周阶段规模与加权效率 (标明实际采集天数，加权指标全周完整才计算)
 */

'use client';

import React, { useMemo, useState } from 'react';
import type { CampaignDailyDataset } from '../../lib/campaign-daily';
import { ChartPanel, ScatterChart } from './CampaignCharts';
import { CampaignComboChart } from './CampaignComboChart';
import {
  computeCumulativeTrend,
  computeMetricHeatmap,
  computeScaleCostScatter,
  computeWeeklyPacing,
  type HeatmapCell,
} from './daily-diagnostics-model';
import './campaign-analytics.css';
import './campaign-combo.css';
import './campaign-daily-diagnostics.css';

export interface CampaignDailyDiagnosticsProps {
  dataset: CampaignDailyDataset;
  calendarRows: Array<Record<string, unknown>>;
  startDate: string;
  endDate: string;
}

export function CampaignDailyDiagnostics({
  dataset,
  calendarRows,
  startDate,
  endDate,
}: CampaignDailyDiagnosticsProps) {
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<{
    cell: HeatmapCell;
    metricLabel: string;
  } | null>(null);

  // 1. Cumulative Spend vs Output
  const cumResult = useMemo(() => {
    return computeCumulativeTrend(dataset, calendarRows);
  }, [dataset, calendarRows]);

  // 2. Metric Heatmap
  const heatmapRows = useMemo(() => {
    return computeMetricHeatmap(dataset, calendarRows);
  }, [dataset, calendarRows]);

  // 3. Scale vs Cost Scatter
  const scatterResult = useMemo(() => {
    return computeScaleCostScatter(dataset, calendarRows);
  }, [dataset, calendarRows]);

  // 4. Weekly Pacing & Weighted Efficiency
  const weeklyResult = useMemo(() => {
    return computeWeeklyPacing(dataset, calendarRows);
  }, [dataset, calendarRows]);

  // Subtitle for Cumulative Trend (computed via useMemo BEFORE any conditional returns)
  const cumSubtitle = useMemo(() => {
    const coverageText = `连续有效数据 ${cumResult.spendPrefixCount}/${cumResult.totalDays} 天；缺数后的累计暂不可用`;
    if (!cumResult.outputLabel) {
      return `统计区间: ${startDate} ~ ${endDate} · ${coverageText} · 左轴 累计消耗 (元)`;
    }
    if (cumResult.outputAxis === 'left') {
      return `统计区间: ${startDate} ~ ${endDate} · ${coverageText} · 左轴 累计消耗与累计${cumResult.outputLabel} (${cumResult.outputUnit})`;
    }
    return `统计区间: ${startDate} ~ ${endDate} · ${coverageText} · 左轴 累计消耗 (元) vs 右轴 累计${cumResult.outputLabel} (${cumResult.outputUnit})`;
  }, [cumResult, startDate, endDate]);

  // If no diagnostic panels have valid data, do not render an empty container
  const hasAnyDiagnostic =
    cumResult.hasValidData ||
    heatmapRows.length > 0 ||
    scatterResult.hasEnoughPoints ||
    weeklyResult.hasValidData;

  if (!calendarRows.length || !hasAnyDiagnostic) return null;

  return (
    <section className="ca-diagnostics-root" aria-label="分日累计与周度分析">
      {/* Header */}
      <div className="ca-diagnostics-header">
        <div className="ca-diagnostics-title-wrap">
          <span className="ca-diagnostics-tag">数据诊断</span>
          <h3 className="ca-diagnostics-title">累计与周度分析</h3>
        </div>
        <span className="ca-diagnostics-desc">
          区间: {startDate} ~ {endDate} · 动态联动过滤 · 缺日真实断线
        </span>
      </div>

      {/* Grid: only renders panels with valid data */}
      <div className="ca-diagnostics-grid">
        {/* Panel 1: 累计消耗 vs 累计产出 */}
        {cumResult.hasValidData && (
          <div className="ca-diag-panel">
            <ChartPanel
              title="累计消耗 vs 累计产出走势"
              subtitle={cumSubtitle}
            >
              <CampaignComboChart
                rows={cumResult.rows}
                series={cumResult.series}
                xKey="date"
                title="累计消耗与累计产出对比走势"
                height={260}
                xLabel="日期"
              />
            </ChartPanel>
          </div>
        )}

        {/* Panel 2: 日期 x 指标热力图 */}
        {heatmapRows.length > 0 && (
          <div className="ca-diag-panel">
            <ChartPanel
              title="日期 × 核心指标强度热力图"
              subtitle="每指标独立色系 · 颜色越深数值相对越强 · 灰色为缺失天 · 支持键盘与触屏聚焦查看"
              actions={
                selectedHeatmapCell && (
                  <span
                    style={{
                      fontSize: 12,
                      color: '#1c2024',
                      fontWeight: 600,
                      background: '#f9f9fb',
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '0.5px solid #d9d9e0',
                    }}
                    role="status"
                    aria-live="polite"
                  >
                    {selectedHeatmapCell.cell.date} {selectedHeatmapCell.metricLabel}:{' '}
                    {selectedHeatmapCell.cell.formatted} {selectedHeatmapCell.cell.unit}
                  </span>
                )
              }
            >
              <div className="ca-heatmap-wrap">
                {heatmapRows.map((m) => (
                  <div key={m.key} className="ca-heatmap-row">
                    <div className="ca-heatmap-label-col">
                      <span className="ca-heatmap-metric-name" title={m.label}>
                        {m.label}
                      </span>
                      <span className="ca-heatmap-metric-meta">
                        {m.validCount}天有值 {m.unit ? `(${m.unit})` : ''}
                      </span>
                    </div>
                    <div className="ca-heatmap-cells" role="group" aria-label={`${m.label}每日强度`}>
                      {m.cells.map((c) => {
                        const bg = c.isMissing
                          ? '#f0f0f3'
                          : `${m.themeColor}${Math.round(c.intensity * 215 + 40)
                              .toString(16)
                              .padStart(2, '0')}`;
                        const isFocused =
                          selectedHeatmapCell?.cell.date === c.date &&
                          selectedHeatmapCell?.metricLabel === m.label;
                        return (
                          <button
                            type="button"
                            key={c.date}
                            className={`ca-heatmap-cell ${c.isMissing ? 'ca-heatmap-cell-missing' : ''}`}
                            style={{
                              backgroundColor: bg,
                              outline: isFocused ? '2px solid #1c2024' : 'none',
                              border: isFocused ? '0.5px solid #fff' : undefined,
                            }}
                            tabIndex={0}
                            aria-label={`${c.date} ${m.label}: ${c.formatted}${c.unit ? ` ${c.unit}` : ''}`}
                            title={`${c.date} ${m.label}: ${c.formatted}${c.unit ? ` ${c.unit}` : ''}`}
                            onClick={() =>
                              setSelectedHeatmapCell({
                                cell: c,
                                metricLabel: m.label,
                              })
                            }
                            onFocus={() =>
                              setSelectedHeatmapCell({
                                cell: c,
                                metricLabel: m.label,
                              })
                            }
                            onMouseEnter={() =>
                              setSelectedHeatmapCell({
                                cell: c,
                                metricLabel: m.label,
                              })
                            }
                          >
                            {c.isMissing ? '—' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {/* Date labels row */}
                <div className="ca-heatmap-dates-row" aria-hidden="true">
                  <div className="ca-heatmap-label-col">
                    <span style={{ fontSize: 12, color: '#60646c' }}>日期序列</span>
                  </div>
                  <div className="ca-heatmap-cells">
                    {calendarRows.map((r, i) => {
                      const showLabel =
                        calendarRows.length <= 15 || i % Math.ceil(calendarRows.length / 12) === 0;
                      return (
                        <div key={String(r.date)} className="ca-heatmap-date-label">
                          {showLabel ? String(r.date).slice(5) : ''}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ChartPanel>
          </div>
        )}

        {/* Panel 3: 每日规模 / 成本成对散点 */}
        {scatterResult.hasEnoughPoints && (
          <div className="ca-diag-panel">
            <ChartPanel
              title="投放规模与单位成本/效率"
              subtitle={`横轴: ${scatterResult.xLabel} · 纵轴: ${scatterResult.yLabel} · 观察不同投放规模下的单位效率分布`}
            >
              <ScatterChart
                data={scatterResult.points}
                xLabel={scatterResult.xLabel}
                yLabel={scatterResult.yLabel}
              />
            </ChartPanel>
          </div>
        )}

        {/* Panel 4: 周阶段规模 + 加权效率 */}
        {weeklyResult.hasValidData && (
          <div className="ca-diag-panel">
            <ChartPanel
              title="自然周阶段规模与加权效率"
              subtitle="按日历周聚合 · 标明各周实际采集天数 · 按各周所选日期计算，缺数时不计算单位成本"
            >
              <div>
                <CampaignComboChart
                  rows={weeklyResult.chartRows}
                  series={weeklyResult.series}
                  xKey="week"
                  title="自然周规模与加权效率"
                  height={190}
                  xLabel="周序列"
                />
                {/* Structured weekly summary list */}
                <div className="ca-weekly-table-wrap">
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {weeklyResult.weeks.map((w) => (
                      <div
                        key={w.weekLabel}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '0.5px solid #d9d9e0',
                          background: '#f9f9fb',
                          fontSize: 12,
                          flex: '1 1 140px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 2,
                          }}
                        >
                          <strong>{w.weekLabel}</strong>
                          <span
                            className={`ca-weekly-badge ${
                              w.isCompleteInSpan && w.isFullCalendarWeek
                                ? 'ca-weekly-badge-full'
                                : 'ca-weekly-badge-partial'
                            }`}
                          >
                            {w.validDays}/{w.calendarDays}天{w.isCompleteInSpan && !w.isFullCalendarWeek ? ' (区间完整)' : ''}
                          </span>
                        </div>
                        <div style={{ color: '#60646c' }}>
                          消耗: {w.weekSpend !== null ? `¥${w.weekSpend.toLocaleString()}` : `— (${w.coverageNote})`}
                        </div>
                        {w.weightedEfficiency !== null ? (
                          <div style={{ color: '#ffc53d', fontWeight: 600 }}>
                            {w.efficiencyLabel}: {w.weightedEfficiency} {w.efficiencyUnit}
                          </div>
                        ) : (
                          <div style={{ color: '#60646c', fontSize: 12 }}>
                            {w.efficiencyLabel}: — (按所选日期，缺数时不计算单位成本)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ChartPanel>
          </div>
        )}
      </div>
    </section>
  );
}
