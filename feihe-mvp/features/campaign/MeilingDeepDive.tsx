'use client';

import React, { useMemo, useState } from 'react';
import type { CampaignDashboard, CampaignTable } from '../../lib/campaign-types';
import { CampaignComboChart, type ComboSeries } from './CampaignComboChart';
import { ChartPanel, ScatterChart } from './CampaignCharts';
import './meiling-deep-dive.css';

interface MeilingDeepDiveProps {
  dashboard: CampaignDashboard;
  section: 'ads' | 'content';
}

function parseFiniteNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string' && val.trim() === '') return null;
  const num = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(num) ? num : null;
}

function formatNum(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return val.toLocaleString('zh-CN', { maximumFractionDigits: digits });
}

export function MeilingDeepDive({ dashboard, section }: MeilingDeepDiveProps) {
  const [channelFilter, setChannelFilter] = useState<'all' | 'tm' | 'jd'>('all');
  const [minSpendThreshold, setMinSpendThreshold] = useState<number>(0);
  const [matrixDimension, setMatrixDimension] = useState<'product' | 'platform'>('product');

  const tablesMap = useMemo(() => {
    const map = new Map<string, CampaignTable>();
    for (const t of dashboard.tables || []) {
      map.set(t.id, t);
    }
    return map;
  }, [dashboard.tables]);

  const prodMatrixTable = tablesMap.get('meiling-enrich-matrix-product-stage');
  const platMatrixTable = tablesMap.get('meiling-enrich-matrix-platform-stage');
  const themeTable = tablesMap.get('meiling-enrich-content-theme-format');
  const chanEffTable = tablesMap.get('meiling-enrich-channel-creative-efficiency');
  const noteEffTable = tablesMap.get('meiling-enrich-note-creative-efficiency');

  // =========================================================================
  // SECTION: ADS (投放转化与笔记效率)
  // =========================================================================
  if (section === 'ads') {
    if (!noteEffTable) {
      return null;
    }

    const allRawNotes = noteEffTable.rows || [];

    // 1. Channel Filtering
    const filteredNotes = allRawNotes.filter((r) => {
      const ch = String(r.channel || '');
      if (channelFilter === 'tm') return ch.includes('天猫');
      if (channelFilter === 'jd') return ch.includes('京东');
      return true;
    });

    const totalCount = filteredNotes.length;

    // Dynamic period based on selected channel scope (never single note period)
    const activePeriod = useMemo(() => {
      if (channelFilter === 'tm') {
        const tmRow = chanEffTable?.rows?.find((r) => String(r.channel || '').includes('天猫'));
        return (tmRow?.period as string) || '2026-09-30 ~ 2026-10-18';
      }
      if (channelFilter === 'jd') {
        const jdRow = chanEffTable?.rows?.find((r) => String(r.channel || '').includes('京东'));
        return (jdRow?.period as string) || '2026-09-29 ~ 2026-10-18';
      }
      return noteEffTable.period || '2026-09-29 ~ 2026-10-18';
    }, [channelFilter, chanEffTable, noteEffTable]);

    // 2. Chart 1: Notes Top 8 by Spend + CPUV Combo
    const sortedBySpend = [...filteredNotes].sort((a, b) => {
      const sa = parseFiniteNum(a.spend);
      const sb = parseFiniteNum(b.spend);
      if (sa === null && sb === null) return 0;
      if (sa === null) return 1;
      if (sb === null) return -1;
      return sb - sa;
    });

    const top8Notes = sortedBySpend.slice(0, 8);
    const top8Count = top8Notes.length;

    const comboRows = top8Notes.map((r) => {
      const fullName = String(r.material_name || r.note_id || '');
      return {
        ...r,
        fullName,
        spend: parseFiniteNum(r.spend),
        cpuv: parseFiniteNum(r.cpuv),
      };
    });

    const comboSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'cpuv', label: '30日归因UV成本', unit: '元/人', axis: 'right', kind: 'point', color: '#b88a45' },
    ];

    // 3. Chart 2: Scatter Plot with Spend Threshold Filter
    const thresholdFilteredNotes = sortedBySpend.filter((r) => {
      const sp = parseFiniteNum(r.spend);
      if (minSpendThreshold <= 0) return true;
      return sp !== null && sp >= minSpendThreshold;
    });

    const scatterPoints = thresholdFilteredNotes
      .map((r) => {
        const xVal = parseFiniteNum(r.spend);
        const yVal = parseFiniteNum(r.cpuv);
        const sizeVal = parseFiniteNum(r.uv);
        const labelStr = `${String(r.material_name || r.note_id || '')} (${String(r.channel || '')})`;
        return {
          label: labelStr,
          x: xVal,
          y: yVal,
          size: sizeVal,
        };
      })
      .filter(
        (p): p is { label: string; x: number; y: number; size: number | null } =>
          p.x !== null && p.y !== null
      );

    return (
      <div className="mdd-root">
        <div className="mdd-header">
          <div className="mdd-header-left">
            <span className="mdd-chapter-badge">01</span>
            <div>
              <h3 className="mdd-title">商业笔记素材投放效率</h3>
              <span className="mdd-subtitle">商单素材投流规模、归因UV成本与全量笔记效率明细</span>
            </div>
          </div>
          <div className="mdd-btn-group" role="group" aria-label="渠道筛选">
            <button
              type="button"
              className={`mdd-btn ${channelFilter === 'all' ? 'active' : ''}`}
              onClick={() => setChannelFilter('all')}
            >
              全部渠道
            </button>
            <button
              type="button"
              className={`mdd-btn ${channelFilter === 'tm' ? 'active' : ''}`}
              onClick={() => setChannelFilter('tm')}
            >
              天猫渠道
            </button>
            <button
              type="button"
              className={`mdd-btn ${channelFilter === 'jd' ? 'active' : ''}`}
              onClick={() => setChannelFilter('jd')}
            >
              京东渠道
            </button>
          </div>
        </div>

        <div className="mdd-grid">
          {/* Chart 1: Notes Top 8 Combo Chart */}
          <ChartPanel
            title="商单素材消耗与归因UV成本"
            subtitle={`统计周期：${activePeriod}（取消耗排名前 ${top8Count} 篇，共 ${totalCount} 篇）`}
          >
            <div className="mdd-panel-content">
              <CampaignComboChart
                title="商单素材消耗与归因UV成本"
                xKey="fullName"
                rows={comboRows}
                series={comboSeries}
                height={260}
              />
              <p className="mdd-note">
                柱状表示累计投流消耗，散点表示30日归因活跃UV成本（CPUV）。站外活跃UV为各创意归因活跃人数累加，非全案去重人数。
              </p>
            </div>
          </ChartPanel>

          {/* Chart 2: Notes Efficiency Scatter Plot */}
          <ChartPanel
            title="素材投流规模与UV成本分布"
            subtitle={`气泡大小代表30日归因活跃UV；有效观测值 ${scatterPoints.length}/${totalCount} 篇`}
            actions={
              <div className="mdd-btn-group" role="group" aria-label="最低消耗过滤">
                <button
                  type="button"
                  className={`mdd-btn ${minSpendThreshold === 0 ? 'active' : ''}`}
                  onClick={() => setMinSpendThreshold(0)}
                >
                  全量
                </button>
                <button
                  type="button"
                  className={`mdd-btn ${minSpendThreshold === 1000 ? 'active' : ''}`}
                  onClick={() => setMinSpendThreshold(1000)}
                >
                  ≥1,000元
                </button>
                <button
                  type="button"
                  className={`mdd-btn ${minSpendThreshold === 5000 ? 'active' : ''}`}
                  onClick={() => setMinSpendThreshold(5000)}
                >
                  ≥5,000元
                </button>
              </div>
            }
          >
            <div className="mdd-panel-content">
              <ScatterChart
                data={scatterPoints}
                xLabel="投流消耗 (元)"
                yLabel="30日归因UV成本 CPUV (元/人)"
              />
              <p className="mdd-note">
                横轴为累计投流消耗，纵轴为30日归因活跃UV成本。未产生有效UV记录的数据项不参与绘图，以防因分母为零造成坐标失真。
              </p>
            </div>
          </ChartPanel>
        </div>

        {/* Full Details Table */}
        <details className="mdd-details">
          <summary>查看投放流水与全量笔记效率明细（当前渠道共 {totalCount} 篇）</summary>
          <div className="mdd-details-body">
            <div className="mdd-data-table-scroll">
              <table className="mdd-data-table">
                <thead>
                  <tr>
                    <th>投放渠道</th>
                    <th className="text-left">素材创意名称（非实名）</th>
                    <th>笔记ID</th>
                    <th>实际投放周期</th>
                    <th>消耗 (元)</th>
                    <th>展现量</th>
                    <th>点击量</th>
                    <th>点击率</th>
                    <th>CPC (元)</th>
                    <th>CPM (元)</th>
                    <th>互动量</th>
                    <th>CPE (元)</th>
                    <th>归因UV (人)</th>
                    <th>CPUV (元/人)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotes.map((r, idx) => {
                    const ctrVal = parseFiniteNum(r.ctr);
                    return (
                      <tr key={String(r.note_id || idx)}>
                        <td className="text-center">{String(r.channel || '—')}</td>
                        <td className="text-left">{String(r.material_name || '—')}</td>
                        <td className="text-center">{String(r.note_id || '—')}</td>
                        <td className="text-center">{String(r.period || '—')}</td>
                        <td>{formatNum(parseFiniteNum(r.spend))}</td>
                        <td>{formatNum(parseFiniteNum(r.impressions), 0)}</td>
                        <td>{formatNum(parseFiniteNum(r.clicks), 0)}</td>
                        <td>{ctrVal !== null ? `${formatNum(ctrVal)}%` : '—'}</td>
                        <td>{formatNum(parseFiniteNum(r.cpc))}</td>
                        <td>{formatNum(parseFiniteNum(r.cpm))}</td>
                        <td>{formatNum(parseFiniteNum(r.engagements), 0)}</td>
                        <td>{formatNum(parseFiniteNum(r.cpe))}</td>
                        <td>{formatNum(parseFiniteNum(r.uv), 0)}</td>
                        <td>{formatNum(parseFiniteNum(r.cpuv))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mdd-footnote">
              注：各渠道起止日期不同（天猫与京东并非同一日历区间），各指标为渠道独立统计，不可跨渠道直接对比作为同比或环比。
            </p>
          </div>
        </details>
      </div>
    );
  }

  // =========================================================================
  // SECTION: CONTENT (内容执行与交叉矩阵)
  // =========================================================================
  if (section === 'content') {
    if (!prodMatrixTable && !platMatrixTable && !themeTable) {
      return null;
    }

    const activeMatrixTable = matrixDimension === 'product' ? prodMatrixTable : platMatrixTable;
    const matrixRows = activeMatrixTable?.rows || [];

    // 1. Build Cross Matrix for Area 1
    const stageCanonicalOrder = [
      '已发布',
      '定稿可上传',
      '待确认预览',
      '达人拍摄中',
      '达人修改中',
      '品牌审核中',
      '内审中',
      '可推进',
      '未进入审核',
    ];

    // Collect dimensions preserving appearance order
    const dimensions: string[] = [];
    const dimSet = new Set<string>();
    for (const r of matrixRows) {
      const dim = String(r.dimension || '');
      if (dim && !dimSet.has(dim)) {
        dimSet.add(dim);
        dimensions.push(dim);
      }
    }

    // Collect stages appearing in data
    const observedStages = new Set<string>();
    for (const r of matrixRows) {
      const st = String(r.stage || '');
      if (st) observedStages.add(st);
    }

    const activeStages = stageCanonicalOrder.filter((s) => observedStages.has(s));
    for (const s of Array.from(observedStages)) {
      if (!activeStages.includes(s)) activeStages.push(s);
    }

    // Map (dim, stage) -> count | null
    const cellCountMap = new Map<string, number | null>();
    const dimTotalMap = new Map<string, number>();
    const dimHasNullMap = new Map<string, boolean>();
    const stageTotalMap = new Map<string, number>();
    const stageHasNullMap = new Map<string, boolean>();
    let grandTotal = 0;
    let grandHasNull = false;

    for (const r of matrixRows) {
      const dim = String(r.dimension || '');
      const st = String(r.stage || '');
      const cnt = parseFiniteNum(r.count);
      cellCountMap.set(`${dim}::${st}`, cnt);
      if (cnt === null) {
        dimHasNullMap.set(dim, true);
        stageHasNullMap.set(st, true);
        grandHasNull = true;
      } else {
        dimTotalMap.set(dim, (dimTotalMap.get(dim) || 0) + cnt);
        stageTotalMap.set(st, (stageTotalMap.get(st) || 0) + cnt);
        grandTotal += cnt;
      }
    }

    // Cell intensity helper
    function getCellClass(count: number | null): string {
      if (count === null) return 'mdd-cell-null';
      if (count === 0) return 'mdd-cell-zero';
      if (count <= 3) return 'mdd-cell-low';
      if (count <= 8) return 'mdd-cell-med';
      return 'mdd-cell-high';
    }

    let maxCellCount = 1;
    cellCountMap.forEach((cnt) => {
      if (cnt && cnt > maxCellCount) maxCellCount = cnt;
    });

    let maxDimTotal = 1;
    dimTotalMap.forEach((tot) => {
      if (tot > maxDimTotal) maxDimTotal = tot;
    });

    function getCellHeatStyle(count: number | null): React.CSSProperties | undefined {
      if (count === null || count === 0) return undefined;
      const ratio = Math.min(1, count / maxCellCount);
      const alpha = 0.12 + ratio * 0.72;
      return {
        backgroundColor: `rgba(44, 113, 104, ${alpha.toFixed(2)})`,
        color: ratio > 0.45 ? '#ffffff' : '#004d40',
        fontWeight: ratio > 0.25 ? 700 : 600,
      };
    }

    // 2. Build Theme & Format Bars for Area 2
    const themeRows = themeTable?.rows || [];
    const themeMap = new Map<string, { imageText: number; video: number; other: number; total: number }>();

    for (const r of themeRows) {
      const th = String(r.content_theme || '未指定');
      const fmt = String(r.format || '');
      const cnt = parseFiniteNum(r.count) || 0;

      if (!themeMap.has(th)) {
        themeMap.set(th, { imageText: 0, video: 0, other: 0, total: 0 });
      }
      const cur = themeMap.get(th)!;
      if (fmt.includes('图文')) {
        cur.imageText += cnt;
      } else if (fmt.includes('视频')) {
        cur.video += cnt;
      } else {
        cur.other += cnt;
      }
      cur.total += cnt;
    }

    const sortedThemes = Array.from(themeMap.entries()).sort((a, b) => b[1].total - a[1].total);
    const themeTotalAccounts = sortedThemes.reduce((acc, t) => acc + t[1].total, 0);

    // 3. Build Platform Progress Series for Area 3 (Side-by-side with theme)
    const platRows = platMatrixTable?.rows || [];
    const platSummaryMap = new Map<string, { confirmed: number; published: number }>();

    for (const r of platRows) {
      const pl = String(r.dimension || '未指定');
      const st = String(r.stage || '');
      const cnt = parseFiniteNum(r.count) || 0;

      if (!platSummaryMap.has(pl)) {
        platSummaryMap.set(pl, { confirmed: 0, published: 0 });
      }
      const cur = platSummaryMap.get(pl)!;
      cur.confirmed += cnt;
      if (st === '已发布') {
        cur.published += cnt;
      }
    }

    const platComboRows = Array.from(platSummaryMap.entries())
      .sort((a, b) => b[1].confirmed - a[1].confirmed)
      .map(([plName, counts]) => ({
        platformName: plName,
        confirmed: counts.confirmed,
        published: counts.published,
      }));

    const platComboSeries: ComboSeries[] = [
      { key: 'confirmed', label: '二核确认达人', unit: '位', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'published', label: '实际已发布', unit: '位', axis: 'left', kind: 'bar', color: '#8273a3' },
    ];

    return (
      <div className="mdd-root">
        <div className="mdd-header">
          <div className="mdd-header-left">
            <span className="mdd-chapter-badge">02</span>
            <div>
              <h3 className="mdd-title">二核合作达人执行状态与内容形式</h3>
              <span className="mdd-subtitle">主推型号全链路审核进度与图文视频内容分布</span>
            </div>
          </div>
        </div>

        <div className="mdd-grid">
          {/* Area 1: Heatmap Cross Matrix (Full Width) */}
          <ChartPanel
            className="mdd-panel-full"
            title={matrixDimension === 'product' ? '主推产品 × 审核执行阶段矩阵' : '外溢平台 × 审核执行阶段矩阵'}
            subtitle={`统计周期：${activeMatrixTable?.period || '未注明'}；全量二核合作达人 ${grandHasNull ? '—' : grandTotal} 位`}
            actions={
              <div className="mdd-btn-group" role="group" aria-label="矩阵维度选择">
                <button
                  type="button"
                  className={`mdd-btn ${matrixDimension === 'product' ? 'active' : ''}`}
                  onClick={() => setMatrixDimension('product')}
                >
                  按主推产品
                </button>
                <button
                  type="button"
                  className={`mdd-btn ${matrixDimension === 'platform' ? 'active' : ''}`}
                  onClick={() => setMatrixDimension('platform')}
                >
                  按外溢平台
                </button>
              </div>
            }
          >
            <div className="mdd-panel-content">
              <div className="mdd-matrix-container">
                <div className="mdd-matrix-scroll">
                  <table className="mdd-matrix-table">
                    <thead>
                      <tr>
                        <th className="mdd-dim-th">
                          {matrixDimension === 'product' ? '主推产品型号' : '外溢平台链路'}
                        </th>
                        {activeStages.map((st) => (
                          <th key={st}>{st}</th>
                        ))}
                        <th>合计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dimensions.map((dim) => {
                        const rowTot = dimTotalMap.get(dim) || 0;
                        const rowHasNull = dimHasNullMap.get(dim) || false;
                        return (
                          <tr key={dim}>
                            <td className="mdd-dim-td">{dim}</td>
                            {activeStages.map((st) => {
                              const key = `${dim}::${st}`;
                              const count = cellCountMap.has(key) ? cellCountMap.get(key)! : 0;
                              return (
                                <td
                                  key={st}
                                  className={`mdd-matrix-cell ${getCellClass(count)}`}
                                  style={getCellHeatStyle(count)}
                                >
                                  {count === null ? '—' : count}
                                </td>
                              );
                            })}
                            <td className="mdd-matrix-row-total">
                              <div className="mdd-row-total-wrap">
                                <span>{rowHasNull ? '—' : rowTot}</span>
                                {!rowHasNull && rowTot > 0 && (
                                  <div className="mdd-row-total-bar-track">
                                    <div
                                      className="mdd-row-total-bar-fill"
                                      style={{ width: `${Math.min(100, (rowTot / maxDimTotal) * 100)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="mdd-matrix-foot">
                      <tr>
                        <td className="mdd-dim-td">阶段合计</td>
                        {activeStages.map((st) => {
                          const colHasNull = stageHasNullMap.get(st) || false;
                          const colTot = stageTotalMap.get(st) || 0;
                          return <td key={st}>{colHasNull ? '—' : colTot}</td>;
                        })}
                        <td>{grandHasNull ? '—' : grandTotal}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="mdd-matrix-legend">
                  <span className="mdd-legend-item">
                    <span className="mdd-legend-swatch mdd-cell-zero" /> 0位
                  </span>
                  <span className="mdd-legend-item">
                    <span className="mdd-legend-swatch mdd-cell-low" /> 1–3位
                  </span>
                  <span className="mdd-legend-item">
                    <span className="mdd-legend-swatch mdd-cell-med" /> 4–8位
                  </span>
                  <span className="mdd-legend-item">
                    <span className="mdd-legend-swatch mdd-cell-high" /> 9位及以上
                  </span>
                </div>
              </div>
              <p className="mdd-note">
                展示二核确认达人在各产品或平台链路与审核执行阶段的交叉分布，同一母集下未发生的组合按 0 呈现以保证全矩阵可比。
              </p>
            </div>
          </ChartPanel>

          {/* Area 2: Content Theme x Format Comparison (Half Width) */}
          <ChartPanel
            title="内容类型与图文/视频形式分布"
            subtitle={`统计周期：${themeTable?.period || '未注明'}；全量二核合作达人 ${themeTotalAccounts} 位`}
          >
            <div className="mdd-panel-content">
              <div className="mdd-theme-list">
                {sortedThemes.map(([themeName, counts]) => {
                  const imgPercent = counts.total > 0 ? (counts.imageText / counts.total) * 100 : 0;
                  const vidPercent = counts.total > 0 ? (counts.video / counts.total) * 100 : 0;
                  const othPercent = counts.total > 0 ? (counts.other / counts.total) * 100 : 0;
                  return (
                    <div key={themeName} className="mdd-theme-item">
                      <div className="mdd-theme-head">
                        <span className="mdd-theme-name">{themeName}</span>
                        <span className="mdd-theme-total">
                          共 {counts.total} 篇（图文 {counts.imageText} / 视频 {counts.video}{counts.other > 0 ? ` / 其他 ${counts.other}` : ''}）
                        </span>
                      </div>
                      <div className="mdd-bar-track">
                        {counts.imageText > 0 && (
                          <div
                            className="mdd-bar-segment imgtext"
                            style={{ width: `${imgPercent}%` }}
                            title={`图文: ${counts.imageText}篇 (${imgPercent.toFixed(1)}%)`}
                          >
                            {counts.imageText > 2 ? `图文 ${counts.imageText}` : counts.imageText}
                          </div>
                        )}
                        {counts.video > 0 && (
                          <div
                            className="mdd-bar-segment video"
                            style={{ width: `${vidPercent}%` }}
                            title={`视频: ${counts.video}篇 (${vidPercent.toFixed(1)}%)`}
                          >
                            {counts.video > 2 ? `视频 ${counts.video}` : counts.video}
                          </div>
                        )}
                        {counts.other > 0 && (
                          <div
                            className="mdd-bar-segment other"
                            style={{ width: `${othPercent}%` }}
                            title={`未注明/其他: ${counts.other}篇 (${othPercent.toFixed(1)}%)`}
                          >
                            {counts.other}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mdd-matrix-legend">
                <span className="mdd-legend-item">
                  <span className="mdd-legend-swatch" style={{ background: '#2c7168' }} /> 图文
                </span>
                <span className="mdd-legend-item">
                  <span className="mdd-legend-swatch" style={{ background: '#8273a3' }} /> 视频
                </span>
              </div>

              <p className="mdd-note">
                横条长度反映该内容主题下的形式配比。图文以深青色标识，视频以紫色标识。
              </p>
            </div>
          </ChartPanel>

          {/* Area 3: Platform Confirmed vs Published Progress (Half Width) */}
          <ChartPanel
            title="外溢平台确认与已发布进展"
            subtitle={`同母集全量达人在各外溢链路推进对比；全量达人 ${grandHasNull ? '—' : grandTotal} 位`}
          >
            <div className="mdd-panel-content">
              <CampaignComboChart
                title="外溢平台确认与已发布进展"
                xKey="platformName"
                rows={platComboRows}
                series={platComboSeries}
                height={260}
              />
              <p className="mdd-note">
                青色表示二核确认合作达人总数，紫色表示其中已发布达人数。直观展现各外溢平台落地进度。
              </p>
            </div>
          </ChartPanel>
        </div>
      </div>
    );
  }

  return null;
}
