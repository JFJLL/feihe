'use client';

import React, { useState, useMemo } from 'react';
import type { CampaignDashboard, CampaignTable } from '../../lib/campaign-types';
import { ChartPanel, ScatterChart } from './CampaignCharts';
import { CampaignComboChart } from './CampaignComboChart';
import './kailas-deep-dive.css';

export interface KailasDeepDiveProps {
  dashboard: CampaignDashboard;
  section: 'ads' | 'content';
}

function parseFiniteNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const s = String(val).trim();
  if (!s || s === '/' || s === '-' || s === '--' || s === '—') return null;
  if (s.includes('#REF') || s.includes('#VALUE') || s.includes('#N/A') || s.includes('#DIV/0!')) return null;
  const cleaned = s.replace(/[¥￥,\s%]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function fmtNum(val: unknown, decimals = 0): string {
  const n = parseFiniteNum(val);
  if (n === null) return '-';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(val: unknown, decimals = 2): string {
  const n = parseFiniteNum(val);
  if (n === null) return '-';
  return `¥${n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function fmtPercent(val: unknown, decimals = 2): string {
  const n = parseFiniteNum(val);
  if (n === null) return '-';
  return `${n.toFixed(decimals)}%`;
}


export interface GroupedContentTypeRow {
  contentType: string;
  rawContentType: string;
  kCost: number | null;
  fsSpend: number | null;
  count: number;
  [key: string]: unknown;
}

export function calculateTrackedGroupSum(
  items: Array<{ kCost?: unknown; fsSpend?: unknown; contentType?: unknown }>
): GroupedContentTypeRow[] {
  interface GroupTracker {
    kSum: number;
    kHasMissing: boolean;
    kValidCount: number;
    fsSum: number;
    fsHasMissing: boolean;
    fsValidCount: number;
    totalRecords: number;
  }
  const map = new Map<string, GroupTracker>();

  items.forEach((r) => {
    const type = String(r.contentType || '未分类');
    const k = parseFiniteNum(r.kCost);
    const fs = parseFiniteNum(r.fsSpend);
    const cur = map.get(type) || {
      kSum: 0,
      kHasMissing: false,
      kValidCount: 0,
      fsSum: 0,
      fsHasMissing: false,
      fsValidCount: 0,
      totalRecords: 0,
    };

    if (k === null) {
      cur.kHasMissing = true;
    } else {
      cur.kSum += k;
      cur.kValidCount += 1;
    }

    if (fs === null) {
      cur.fsHasMissing = true;
    } else {
      cur.fsSum += fs;
      cur.fsValidCount += 1;
    }

    cur.totalRecords += 1;
    map.set(type, cur);
  });

  return Array.from(map.entries()).map(([contentType, v]) => ({
    contentType: `${contentType} (篇)`,
    rawContentType: contentType,
    kCost: v.kHasMissing || v.kValidCount === 0 ? null : Number(v.kSum.toFixed(2)),
    fsSpend: v.fsHasMissing || v.fsValidCount === 0 ? null : Number(v.fsSum.toFixed(2)),
    count: v.totalRecords,
  }));
}

export function KailasDeepDive({ dashboard, section }: KailasDeepDiveProps) {
  const tables = useMemo((): CampaignTable[] => dashboard.tables || [], [dashboard.tables]);

  // Perspectives
  const [adsPerspective, setAdsPerspective] = useState<'notes' | 'keywords'>('notes');
  const [noteFilter, setNoteFilter] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');

  // Resolved Tables
  const notesScatterTable = useMemo(
    () => tables.find((t) => t.id === 'kailas-notes-performance-scatter'),
    [tables]
  );
  const organicVsPaidTable = useMemo(
    () => tables.find((t) => t.id === 'kailas-q3-organic-vs-paid'),
    [tables]
  );
  const materialDualTable = useMemo(
    () => tables.find((t) => t.id === 'kailas-kol-material-kfs-dual'),
    [tables]
  );
  const keywordsCatTable = useMemo(
    () => tables.find((t) => t.id === 'kailas-search-keywords-category'),
    [tables]
  );

  if (section === 'ads') {
    return (
      <section className="ca-kdd-root">
        <div className="ca-kdd-controls">
          <div className="ca-kdd-toggle-group">
            <button
              type="button"
              className={`ca-kdd-btn ${adsPerspective === 'notes' ? 'active' : ''}`}
              onClick={() => setAdsPerspective('notes')}
            >
              素材笔记视角
            </button>
            <button
              type="button"
              className={`ca-kdd-btn ${adsPerspective === 'keywords' ? 'active' : ''}`}
              onClick={() => setAdsPerspective('keywords')}
            >
              搜索词类视角
            </button>
          </div>
        </div>

        {adsPerspective === 'notes' ? (
          <AdsNotesView
            table={notesScatterTable}
            filterText={noteFilter}
            onFilterChange={setNoteFilter}
          />
        ) : (
          <AdsKeywordsView table={keywordsCatTable} />
        )}
      </section>
    );
  }

  return (
    <section className="ca-kdd-root">
      <ContentDualView
        organicVsPaidTable={organicVsPaidTable}
        materialDualTable={materialDualTable}
        selectedBatch={selectedBatch}
        onBatchChange={setSelectedBatch}
      />
    </section>
  );
}

/**
 * Ads: Notes Perspective
 */
function AdsNotesView({
  table,
  filterText,
  onFilterChange,
}: {
  table?: CampaignTable;
  filterText: string;
  onFilterChange: (val: string) => void;
}) {
  const rawRows = useMemo(() => (Array.isArray(table?.rows) ? table!.rows : []), [table]);

  // Strict finite parser for scatter points
  const scatterData = useMemo(() => {
    return rawRows
      .map((r) => {
        const spend = parseFiniteNum(r.spend);
        const cpe = parseFiniteNum(r.cpe);
        const engagements = parseFiniteNum(r.engagements);
        if (spend === null || cpe === null) return null;
        return {
          label: String(r.kolName || r.noteId || '笔记'),
          x: spend,
          y: cpe,
          size: engagements,
        };
      })
      .filter((d): d is { label: string; x: number; y: number; size: number | null } => d !== null);
  }, [rawRows]);

  // Top 8 sorted by spend for combo chart
  const top8Rows = useMemo(() => {
    const valid = rawRows
      .map((r) => ({
        kolName: String(r.kolName || '未命名'),
        spend: parseFiniteNum(r.spend),
        engagements: parseFiniteNum(r.engagements),
      }))
      .filter((r) => r.spend !== null);
    valid.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
    return valid.slice(0, 8);
  }, [rawRows]);

  // Filtered rows for table
  const filteredRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return rawRows;
    return rawRows.filter((r) => {
      const kol = String(r.kolName || '').toLowerCase();
      const id = String(r.noteId || '').toLowerCase();
      return kol.includes(q) || id.includes(q);
    });
  }, [rawRows, filterText]);

  return (
    <>
      <div className="ca-kdd-grid">
        <ChartPanel
          title="达人笔记消费与互动成本分布"
          subtitle={table?.period ? `业务周期：${table.period} · 消费与互动成本散点分布` : '业务周期：统计截止未注明 · 消费与互动成本散点分布'}
        >
          <ScatterChart data={scatterData} xLabel="消费 (元)" yLabel="互动成本 CPE (元/次)" />
          <div className="ca-kdd-caption">
            各笔记消费与互动成本对应分布；气泡越大表示互动量越多。
          </div>
        </ChartPanel>

        <ChartPanel
          title="笔记消费与互动量对比 (Top 8)"
          subtitle={table?.period ? `业务周期：${table.period} · 按消费排序前列笔记` : '业务周期：统计截止未注明 · 按消费排序前列笔记'}
        >
          <CampaignComboChart
            title="达人笔记消费与互动量对比 (Top 8)"
            rows={top8Rows}
            xKey="kolName"
            series={[
              { key: 'spend', label: '消费', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
              { key: 'engagements', label: '互动量', unit: '次', axis: 'right', kind: 'line', color: '#b88a45' },
            ]}
          />
          <div className="ca-kdd-caption">
            柱形代表总消费 (元)，折线代表获得互动量 (次)。
          </div>
        </ChartPanel>
      </div>

      <details className="ca-kdd-details">
        <summary className="ca-kdd-summary">
          <span>查看达人笔记投放明细 (当前呈现 {filteredRows.length} 条记录)</span>
          <input
            type="text"
            className="ca-kdd-filter-input"
            placeholder="按达人昵称筛选..."
            value={filterText}
            onChange={(e) => onFilterChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </summary>
        <div className="ca-kdd-details-body">
          <div className="ca-kdd-table-container">
            <table className="ca-kdd-table">
              <thead>
                <tr>
                  <th>达人昵称</th>
                  <th>笔记ID</th>
                  <th className="num">总消费</th>
                  <th className="num">任务期消费</th>
                  <th className="num">展现量</th>
                  <th className="num">点击量</th>
                  <th className="num">点击率</th>
                  <th className="num">CPC</th>
                  <th className="num">互动量</th>
                  <th className="num">CPE</th>
                  <th className="num">站外活跃UV</th>
                  <th className="num">CPUV</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, idx) => (
                  <tr key={String(r.noteId || idx)}>
                    <td>{String(r.kolName || '-')}</td>
                    <td>{String(r.noteId || '-')}</td>
                    <td className="num">{fmtCurrency(r.spend)}</td>
                    <td className="num">{fmtCurrency(r.taskSpend)}</td>
                    <td className="num">{fmtNum(r.impressions)}</td>
                    <td className="num">{fmtNum(r.clicks)}</td>
                    <td className="num">{fmtPercent(r.ctr)}</td>
                    <td className="num">{fmtCurrency(r.cpc)}</td>
                    <td className="num">{fmtNum(r.engagements)}</td>
                    <td className="num">{fmtCurrency(r.cpe)}</td>
                    <td className="num">{fmtNum(r.externalUv)}</td>
                    <td className="num">{fmtCurrency(r.cpuv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ca-kdd-caption">
            注：原表 CPUV 计算分子为小红盟任务期消费，非总消费，两口径未予混算。
          </div>
        </div>
      </details>
    </>
  );
}

/**
 * Ads: Keywords Perspective
 */
function AdsKeywordsView({ table }: { table?: CampaignTable }) {
  const rows = useMemo(() => (Array.isArray(table?.rows) ? table!.rows : []), [table]);

  const parsedRows = useMemo(() => {
    return rows.map((r) => ({
      category: String(r.category || '-'),
      spend: parseFiniteNum(r.spend),
      ctr: parseFiniteNum(r.ctr),
      cpc: parseFiniteNum(r.cpc),
      cpuv: parseFiniteNum(r.cpuv),
      clicks: parseFiniteNum(r.clicks),
      impressions: parseFiniteNum(r.impressions),
    }));
  }, [rows]);

  return (
    <>
      <div className="ca-kdd-grid">
        <ChartPanel
          title="搜索词类消费与点击率对比"
          subtitle={table?.period ? `业务周期：${table.period} · 搜索消费规模与点击率` : '业务周期：统计截止未注明 · 搜索消费规模与点击率'}
        >
          <CampaignComboChart
            title="搜索词类消费与点击率对比"
            rows={parsedRows}
            xKey="category"
            series={[
              { key: 'spend', label: '搜索消费', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
              { key: 'ctr', label: '点击率', unit: '%', axis: 'right', kind: 'line', color: '#bd7964' },
            ]}
          />
          <div className="ca-kdd-caption">
            柱形代表搜索消费金额 (元)，折线代表点击率 (%)。
          </div>
        </ChartPanel>

        <ChartPanel
          title="搜索词类原表成本对比 (CPUV 与 CPC)"
          subtitle={table?.period ? `业务周期：${table.period} · 原表成本结构` : '业务周期：统计截止未注明 · 原表成本结构'}
        >
          <CampaignComboChart
            title="搜索词类原表成本对比 (CPUV 与 CPC)"
            rows={parsedRows}
            xKey="category"
            series={[
              { key: 'cpuv', label: '原表CPUV', unit: '元', axis: 'left', kind: 'bar', color: '#8273a3' },
              { key: 'cpc', label: 'CPC', unit: '元', axis: 'right', kind: 'line', color: '#2c7168' },
            ]}
          />
          <div className="ca-kdd-caption">
            注：原表各词类 CPUV 分子基于小红盟归因消费，与搜索总消费口径不同，未行混算。
          </div>
        </ChartPanel>
      </div>

      <details className="ca-kdd-details">
        <summary className="ca-kdd-summary">
          <span>查看搜索词类明细表 (共 {parsedRows.length} 个分类)</span>
        </summary>
        <div className="ca-kdd-details-body">
          <div className="ca-kdd-table-container">
            <table className="ca-kdd-table">
              <thead>
                <tr>
                  <th>关键词分类</th>
                  <th className="num">消费</th>
                  <th className="num">展现量</th>
                  <th className="num">点击量</th>
                  <th className="num">点击率</th>
                  <th className="num">CPC</th>
                  <th className="num">原表CPUV</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((r, idx) => (
                  <tr key={r.category || idx}>
                    <td>{r.category}</td>
                    <td className="num">{fmtCurrency(r.spend)}</td>
                    <td className="num">{fmtNum(r.impressions)}</td>
                    <td className="num">{fmtNum(r.clicks)}</td>
                    <td className="num">{fmtPercent(r.ctr)}</td>
                    <td className="num">{fmtCurrency(r.cpc)}</td>
                    <td className="num">{fmtCurrency(r.cpuv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </>
  );
}

/**
 * Content: Dual View (Organic vs Paid & Material Groups)
 */
function ContentDualView({
  organicVsPaidTable,
  materialDualTable,
  selectedBatch,
  onBatchChange,
}: {
  organicVsPaidTable?: CampaignTable;
  materialDualTable?: CampaignTable;
  selectedBatch: string;
  onBatchChange: (val: string) => void;
}) {
  // Chart 1: Organic vs Paid (exclude total summary row)
  const organicPaidRows = useMemo(() => {
    const rows = Array.isArray(organicVsPaidTable?.rows) ? organicVsPaidTable!.rows : [];
    return rows
      .filter((r) => !String(r.channel || '').includes('汇总'))
      .map((r) => ({
        channel: String(r.channel || '-'),
        impressions: parseFiniteNum(r.impressions),
        engagements: parseFiniteNum(r.engagements),
        spend: parseFiniteNum(r.spend),
        cpe: parseFiniteNum(r.cpe),
      }));
  }, [organicVsPaidTable]);

  // Material rows
  const rawMaterialRows = useMemo(
    () => (Array.isArray(materialDualTable?.rows) ? materialDualTable!.rows : []),
    [materialDualTable]
  );

  // Batches
  const availableBatches = useMemo(() => {
    const s = new Set<string>();
    rawMaterialRows.forEach((r) => {
      if (r.stage) s.add(String(r.stage));
    });
    return Array.from(s);
  }, [rawMaterialRows]);

  // Filtered by batch
  const batchFilteredMaterialRows = useMemo(() => {
    if (selectedBatch === 'all') return rawMaterialRows;
    return rawMaterialRows.filter((r) => String(r.stage || '') === selectedBatch);
  }, [rawMaterialRows, selectedBatch]);

  // Group by contentType strictly tracking missing values
  const groupedContentTypeRows = useMemo(() => {
    return calculateTrackedGroupSum(batchFilteredMaterialRows);
  }, [batchFilteredMaterialRows]);

  return (
    <>
      <div className="ca-kdd-controls">
        <div style={{ fontSize: '0.875rem', color: '#475569', fontWeight: 500 }}>
          执行批次筛选：
        </div>
        <select
          className="ca-kdd-select"
          value={selectedBatch}
          onChange={(e) => onBatchChange(e.target.value)}
        >
          <option value="all">全部执行批次</option>
          {availableBatches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div className="ca-kdd-grid">
        <ChartPanel
          title="自然端与投流端曝光及互动对比"
          subtitle={organicVsPaidTable?.period ? `业务周期：${organicVsPaidTable.period} · 内容端自然沉淀与投流端商业放量` : '业务周期：统计截止未注明 · 内容端自然沉淀与投流端商业放量'}
        >
          <CampaignComboChart
            title="自然端与投流端曝光及互动对比"
            rows={organicPaidRows}
            xKey="channel"
            series={[
              { key: 'impressions', label: '曝光量', unit: '次', axis: 'left', kind: 'bar', color: '#2c7168' },
              { key: 'engagements', label: '互动量', unit: '次', axis: 'right', kind: 'line', color: '#b88a45' },
            ]}
          />
          <div className="ca-kdd-caption">
            对比内容端自然沉淀与投流端商业竞价的曝光与互动贡献。
          </div>
        </ChartPanel>

        <ChartPanel
          title="达人素材按内容类型费用构成"
          subtitle={materialDualTable?.period ? `业务周期：${materialDualTable.period} · 达人采买金额与投流消耗对比` : '业务周期：统计截止未注明 · 达人采买金额与投流消耗对比'}
        >
          <CampaignComboChart
            title="达人素材按内容类型费用构成"
            rows={groupedContentTypeRows}
            xKey="contentType"
            series={[
              { key: 'kCost', label: 'K端合作金额', unit: '元', axis: 'left', kind: 'bar', color: '#8273a3' },
              { key: 'fsSpend', label: 'FS投流消耗', unit: '元', axis: 'left', kind: 'bar', color: '#bd7964' },
            ]}
          />
          <div className="ca-kdd-caption">
            注：当前呈现选定批次样本统计，非全案总集。
          </div>
        </ChartPanel>
      </div>

      <details className="ca-kdd-details">
        <summary className="ca-kdd-summary">
          <span>查看达人素材合作与投流明细 (共 {batchFilteredMaterialRows.length} 条记录)</span>
        </summary>
        <div className="ca-kdd-details-body">
          <div className="ca-kdd-table-container">
            <table className="ca-kdd-table">
              <thead>
                <tr>
                  <th>批次</th>
                  <th>达人昵称</th>
                  <th>内容类型</th>
                  <th>合作形式</th>
                  <th>量级</th>
                  <th className="num">K端合作金额</th>
                  <th className="num">自然端曝光</th>
                  <th className="num">自然端互动</th>
                  <th className="num">自然CPE</th>
                  <th className="num">FS投流消耗</th>
                  <th className="num">投流展现量</th>
                  <th className="num">投流互动量</th>
                  <th className="num">投流CPE</th>
                  <th className="num">TI人群</th>
                  <th className="num">归因UV</th>
                  <th className="num">CPUV</th>
                </tr>
              </thead>
              <tbody>
                {batchFilteredMaterialRows.map((r, idx) => (
                  <tr key={String(r.noteId || idx)}>
                    <td>{String(r.stage || '-')}</td>
                    <td>{String(r.kolName || '-')}</td>
                    <td>{String(r.contentType || '-')}</td>
                    <td>{String(r.coopFormat || '-')}</td>
                    <td>{String(r.tier || '-')}</td>
                    <td className="num">{fmtCurrency(r.kCost)}</td>
                    <td className="num">{fmtNum(r.pgyImp)}</td>
                    <td className="num">{fmtNum(r.pgyEng)}</td>
                    <td className="num">{fmtCurrency(r.pgyCpe)}</td>
                    <td className="num">{fmtCurrency(r.fsSpend)}</td>
                    <td className="num">{fmtNum(r.fsImp)}</td>
                    <td className="num">{fmtNum(r.fsEng)}</td>
                    <td className="num">{fmtCurrency(r.fsCpe)}</td>
                    <td className="num">{fmtNum(r.tiScale)}</td>
                    <td className="num">{fmtNum(r.externalUv)}</td>
                    <td className="num">{fmtCurrency(r.cpuv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </>
  );
}
