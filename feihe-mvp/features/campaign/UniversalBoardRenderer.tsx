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
import './campaign-analytics.css';

export interface UniversalBoardRendererProps {
  payload: BoardPayload;
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

export function UniversalBoardRenderer({ payload, className = '' }: UniversalBoardRendererProps) {
  const { projectId, name, sections = [], datasets = {}, analysisCards = [], warnings = [] } = payload;
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});
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

    // 3. line-bar-combo or time-series (Visual SVG dual-axis representation)
    if (comp.type === 'line-bar-combo' || comp.type === 'time-series') {
      const rows = dataset.rows || [];
      const xCol = dataset.columns.find(c => c.key === comp.xField);
      const yCol = dataset.columns.find(c => c.key === comp.yField);
      const y2Col = comp.y2Field ? dataset.columns.find(c => c.key === comp.y2Field) : undefined;

      const maxY = Math.max(...rows.map(r => Number(r[comp.yField || '']) || 0), 10);
      const maxY2 = comp.y2Field ? Math.max(...rows.map(r => Number(r[comp.y2Field || '']) || 0), 1) : 1;

      return (
        <div className="ca-card ca-chart-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
          <div className="ca-card-header" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{comp.title || comp.id}</span>
            <div style={{ fontSize: 12, display: 'flex', gap: 12 }}>
              <span style={{ color: '#2563eb' }}>■ {yCol?.label || comp.yField}</span>
              {y2Col && <span style={{ color: '#d97706' }}>● {y2Col.label || comp.y2Field}</span>}
            </div>
          </div>
          <div style={{ height: 220, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 4, paddingBottom: 24 }}>
            {rows.slice(-20).map((r, i) => {
              const yVal = Number(r[comp.yField || '']) || 0;
              const y2Val = comp.y2Field ? Number(r[comp.y2Field || '']) || 0 : 0;
              const heightPct = Math.min((yVal / maxY) * 100, 100);
              const dotBottomPct = Math.min((y2Val / maxY2) * 100, 100);
              const dateLabel = String(r[comp.xField || ''] || '').slice(-5);

              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    position: 'relative',
                  }}
                  title={`${r[comp.xField || '']}: ${yCol?.label || comp.yField}=${yVal}, ${y2Col?.label || comp.y2Field}=${y2Val}`}
                  onClick={() => {
                    if (comp.detailFields) {
                      setDrilldownModal({
                        title: `${comp.title} - ${r[comp.xField || '']}`,
                        dataset,
                        rows: [r],
                        columns: dataset.columns.filter(c => comp.detailFields!.includes(c.key)),
                      });
                    }
                  }}
                >
                  <div
                    style={{
                      width: '70%',
                      height: `${heightPct}%`,
                      background: 'rgba(37, 99, 235, 0.7)',
                      borderRadius: '2px 2px 0 0',
                    }}
                  />
                  {comp.y2Field && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: `${dotBottomPct}%`,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#d97706',
                      }}
                    />
                  )}
                  <span style={{ position: 'absolute', bottom: -20, fontSize: 10, color: '#94a3b8' }}>
                    {dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Generic fallback for other components
    return (
      <div className="ca-card" key={comp.id} {...provenanceProps} style={{ padding: 16 }}>
        <div className="ca-card-header" style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
          {comp.title || comp.id}
        </div>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          组件类型: <code>{comp.type}</code> | 数据集: <code>{comp.query}</code> ({dataset.rows.length} 条记录)
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
      {sections.map(sec => renderSection(sec))}

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
