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
  TargetBulletChart,
  NightingaleRoseChart,
  CapabilityRadarChart,
  MultiDimensionComparisonDeck,
  StackedHorizontalBarChart,
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
  if (typeof val === 'number') {
    if (col?.format === 'percent') {
      const pctVal = col.percentInput === 'points' ? val : val * 100;
      const dec = col.decimals ?? 2;
      return `${pctVal.toFixed(dec)}%`;
    }
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
  return String(val);
}

export function UniversalBoardRenderer({ payload, sectionId, className = '' }: UniversalBoardRendererProps) {
  const { projectId, name, sections = [], datasets = {}, analysisCards = [], warnings = [] } = payload;
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});

  const displayedSections = useMemo(() => {
    if (!sectionId || sectionId === 'overview') {
      return sections;
    }
    const filtered = sections.filter(
      s => s.id === sectionId || s.id.toLowerCase().includes(sectionId.toLowerCase())
    );
    return filtered.length > 0 ? filtered : sections;
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
  const renderComponent = (comp: ComponentInstanceSpec, section: SectionSpec) => {
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
        <div className="ca-card ca-card-empty" key={comp.id} {...provenanceProps}>
          <div className="ca-card-header">{comp.title || comp.id}</div>
          <div style={{ padding: 16, color: '#999', fontSize: 13 }}>
            未找到绑定数据集: <code>{comp.query}</code>
          </div>
        </div>
      );
    }

    // 1. metric-card
    if (comp.type === 'metric-card') {
      const col = dataset.columns.find(c => c.key === comp.field);
      const rawVal = dataset.rows[0]?.[comp.field || ''];
      const formattedVal = formatDatasetValue(rawVal, col);
      const unit = col?.displayUnits || '';

      return (
        <div
          className="ca-card ca-kpi-card"
          key={comp.id}
          {...provenanceProps}
          style={{ flex: 1, minWidth: 200 }}
        >
          <div className="ca-kpi-label" style={{ fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
            {comp.title || col?.label || comp.id}
          </div>
          <div className="ca-kpi-value-row" style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 }}>
            <span className="ca-kpi-value" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
              {formattedVal}
            </span>
            {unit && <span className="ca-kpi-unit" style={{ fontSize: 13, color: '#64748b' }}>{unit}</span>}
          </div>
        </div>
      );
    }

    // 2. data-table
    if (comp.type === 'data-table') {
      const cols = dataset.columns || [];
      const rows = dataset.rows || [];
      const displayRows = rows.slice(0, 50);

      return (
        <div className="ca-card ca-table-card" key={comp.id} {...provenanceProps} style={{ width: '100%', overflow: 'hidden' }}>
          <div className="ca-card-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{comp.title || dataset.name || comp.id}</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>共 {rows.length} 条记录</span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 420 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                <tr>
                  {cols.map(c => (
                    <th
                      key={c.key}
                      style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid #cbd5e1',
                        fontWeight: 600,
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
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    {cols.map(c => {
                      const cellVal = row[c.key];
                      return (
                        <td
                          key={c.key}
                          style={{
                            padding: '8px 12px',
                            textAlign: c.align || (c.type === 'number' ? 'right' : 'left'),
                            whiteSpace: 'nowrap',
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
        </div>
      );
    }

    // 3. line-bar-combo or time-series (Render with CampaignComboChart)
    if (comp.type === 'line-bar-combo' || comp.type === 'time-series') {
      const rows = dataset.rows || [];
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
          color: '#0F5E52',
        },
      ];
      if (comp.y2Field) {
        series.push({
          key: comp.y2Field,
          label: y2Col?.label || comp.y2Field || '对比指标',
          unit: y2Col?.displayUnits || '',
          axis: 'right',
          kind: 'line',
          color: '#D95D39',
        });
      }

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{comp.title || comp.id}</span>
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

    // 4. target-bullet (Target Bullet Chart)
    if (comp.type === 'target-bullet') {
      const bulletData: ComparisonDatum[] = dataset.rows.map(r => ({
        label: String(r[comp.categoryField || 'label'] || r.label || r.name || ''),
        actual: Number(r[comp.field || 'actual'] ?? r.value ?? 0),
        target: Number(r[comp.targetField || 'target'] ?? 0),
        unit: (comp as any).unit || '元',
      }));

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{comp.title || comp.id}</span>
          </div>
          <TargetBulletChart data={bulletData} />
        </div>
      );
    }

    // 5. donut-rose (Nightingale Rose Chart)
    if (comp.type === 'donut-rose') {
      const roseData: NightingaleRoseDatum[] = dataset.rows.map((r, i) => ({
        name: String(r[comp.categoryField || 'label'] || r.name || r.channel || `类别${i + 1}`),
        value: Math.max(0, Number(r[comp.field || 'value'] || 0)),
        cpm: r.cpm !== undefined ? Number(r.cpm) : undefined,
        cpuv: r.cpuv !== undefined ? Number(r.cpuv) : undefined,
      }));

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{comp.title || comp.id}</span>
          </div>
          <NightingaleRoseChart data={roseData} height={250} />
        </div>
      );
    }

    // 6. capability-radar (Multi-dimensional Radar Chart)
    if (comp.type === 'capability-radar') {
      const numCols = dataset.columns.filter(c => c.type === 'number').slice(0, 6);
      const dims: RadarDimension[] = numCols.map(c => {
        const maxVal = Math.max(...dataset.rows.map(r => Number(r[c.key]) || 0), 100);
        return { name: c.label, max: maxVal > 0 ? maxVal : 100 };
      });
      const colors = ['#0F5E52', '#D95D39', '#2E6F8E'];
      const radarSeries: RadarSeries[] = dataset.rows.slice(0, 3).map((r, i) => ({
        name: String(r[comp.categoryField || 'name'] || r.label || `系列${i + 1}`),
        values: numCols.map(c => Number(r[c.key]) || 0),
        color: colors[i % colors.length],
      }));

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{comp.title || comp.id}</span>
          </div>
          <CapabilityRadarChart dimensions={dims} series={radarSeries} height={250} />
        </div>
      );
    }

    // 7. multi-line-deck (Multi-channel / Business lines deck)
    if (comp.type === 'multi-line-deck') {
      const deckItems = dataset.rows.map(r => ({
        title: String(r[comp.categoryField || 'name'] || r.channel || r.line || '业务线'),
        metrics: dataset.columns.filter(c => c.key !== 'name' && c.key !== 'id').slice(0, 4).map(c => ({
          label: c.label,
          value: formatDatasetValue(r[c.key], c),
        })),
      }));

      return (
        <div className="ca-card ca-deck-card" key={comp.id} {...provenanceProps} style={{ padding: 16, width: '100%' }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{comp.title || comp.id}</span>
          </div>
          <MultiDimensionComparisonDeck items={deckItems} />
        </div>
      );
    }

    // 8. percent-stack (100% Stacked Bar Chart)
    if (comp.type === 'percent-stack') {
      const numCols = dataset.columns.filter(c => c.type === 'number');
      const pal = ['#0F5E52', '#D95D39', '#2E6F8E', '#C87D20', '#5B8266'];
      const segments: StackedBarSegment[] = numCols.map((c, i) => ({
        key: c.key,
        label: c.label,
        color: pal[i % pal.length],
      }));
      const stackRows: StackedBarRow[] = dataset.rows.map(r => ({
        label: String(r[comp.xField || 'name'] || r.label || ''),
        segments: Object.fromEntries(numCols.map(c => [c.key, Number(r[c.key]) || 0])),
      }));

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{comp.title || comp.id}</span>
          </div>
          <StackedHorizontalBarChart rows={stackRows} segments={segments} normalize100={true} />
        </div>
      );
    }

    // 9. effect-scatter (Scatter quadrant chart)
    if (comp.type === 'effect-scatter') {
      const xCol = dataset.columns.find(c => c.key === comp.xField);
      const yCol = dataset.columns.find(c => c.key === comp.yField);
      const pal = ['#0F5E52', '#D95D39', '#2E6F8E', '#C87D20'];
      const points = dataset.rows.map((r, i) => ({
        x: Number(r[comp.xField || 'x'] || 0),
        y: Number(r[comp.yField || 'y'] || 0),
        size: Math.max(4, Math.min(20, Math.sqrt(Number(r.spend || r.size || 100)))),
        color: pal[i % pal.length],
        label: String(r[comp.categoryField || 'label'] || r.name || `实体${i + 1}`),
        id: String(r.id || i),
      }));

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16, width: '100%' }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{comp.title || comp.id}</span>
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
      const bins = dataset.rows.map(r => ({
        label: String(r.bucket || r.label || r[comp.categoryField || 'name'] || ''),
        count: Number(r.count || r.value || r[comp.field || 'count'] || 0),
      }));

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{comp.title || comp.id}</span>
          </div>
          <DistributionHistogram bins={bins} height={240} />
        </div>
      );
    }

    // 11. grouped-boxplot
    if (comp.type === 'grouped-boxplot') {
      const pal = ['#0F5E52', '#D95D39', '#2E6F8E'];
      const groups = dataset.rows.map((r, i) => {
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
            <span style={{ fontWeight: 600, fontSize: 15 }}>{comp.title || comp.id}</span>
          </div>
          <BoxPlotChart groups={groups} height={250} />
        </div>
      );
    }

    // 12. comment-qc-panel
    if (comp.type === 'comment-qc-panel') {
      const rows = dataset.rows || [];
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

    // Clean Data Preview Fallback for any unmapped component (never prints text placeholder)
    const displayCols = dataset.columns.slice(0, 5);
    const previewRows = dataset.rows.slice(0, 6);
    return (
      <div className="ca-card" key={comp.id} {...provenanceProps} style={{ padding: 16, width: '100%' }}>
        <div className="ca-card-header" style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
          <span>{comp.title || dataset.name || comp.id}</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>共 {dataset.rows.length} 条记录</span>
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
  const renderSection = (sec: SectionSpec) => {
    const layout = sec.layout || 'stack';

    // Tabs layout
    if (sec.tabs && sec.tabs.length > 0) {
      const activeTabId = activeTabs[sec.id] || sec.tabs[0].id;
      const activeTab = sec.tabs.find(t => t.id === activeTabId) || sec.tabs[0];

      return (
        <div className="ca-section" key={sec.id} style={{ marginBottom: 24 }}>
          {sec.title && <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{sec.title}</h3>}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
            {sec.tabs.map(tab => (
              <button
                type="button"
                key={tab.id}
                onClick={() => handleTabChange(sec.id, tab.id)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTabId === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                  color: activeTabId === tab.id ? '#2563eb' : '#64748b',
                  fontWeight: activeTabId === tab.id ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {tab.title}
              </button>
            ))}
          </div>
          <div>{activeTab.sections?.map(s => renderSection(s))}</div>
        </div>
      );
    }

    // Paired metrics or grid
    if (layout === 'paired-metrics' || layout === 'grid') {
      const cols = sec.columns || (layout === 'paired-metrics' ? 4 : 2);
      return (
        <div className="ca-section" key={sec.id} style={{ marginBottom: 24 }}>
          {sec.title && <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{sec.title}</h3>}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: 16,
            }}
          >
            {sec.components.map(comp => renderComponent(comp, sec))}
          </div>
        </div>
      );
    }

    // Stack layout
    return (
      <div className="ca-section" key={sec.id} style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sec.title && <h3 style={{ fontSize: 16, fontWeight: 600 }}>{sec.title}</h3>}
        {sec.components.map(comp => renderComponent(comp, sec))}
      </div>
    );
  };

  return (
    <div className={`universal-board-root ${className}`} data-project-id={projectId} style={{ padding: '16px 0' }}>
      {/* Warnings bar */}
      {warnings.length > 0 && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            color: '#b45309',
            borderRadius: 6,
            padding: '10px 16px',
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          {warnings.map((w, idx) => (
            <div key={idx}>⚠️ {w}</div>
          ))}
        </div>
      )}

      {/* Sections */}
      {displayedSections.map(sec => renderSection(sec))}

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
                  borderLeft: `4px solid ${c.severity === 'warning' ? '#f59e0b' : '#10b981'}`,
                  background: '#fff',
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
