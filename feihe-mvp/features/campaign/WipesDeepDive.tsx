'use client';

import React, { useMemo, useState } from 'react';
import type { CampaignDashboard, CampaignTable } from '../../lib/campaign-types';
import { CampaignComboChart, type ComboSeries, fmtComboNum } from './CampaignComboChart';
import { ChartPanel } from './CampaignCharts';
import './wipes-deep-dive.css';

interface WipesDeepDiveProps {
  dashboard: CampaignDashboard;
  section: 'ads' | 'content';
}

function parseFiniteNum(val: unknown): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === 'string') {
    const s = val.replace(/[¥,%\s]/g, '').trim();
    if (!s || s === '-' || s === '--' || s === 'null' || s === 'None') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * WipesDeepDive Component
 * Visualizes deep-mined data for the wipes campaign.
 * Reads directly from dashboard.tables without static JSON imports.
 */
export function WipesDeepDive({ dashboard, section }: WipesDeepDiveProps) {
  const [adsDimension, setAdsDimension] = useState<'audience' | 'keyword'>('audience');

  // Locate newly enriched tables from dashboard.tables
  const tablesMap = useMemo(() => {
    const map = new Map<string, CampaignTable>();
    for (const t of dashboard.tables || []) {
      map.set(t.id, t);
    }
    return map;
  }, [dashboard.tables]);

  const kwCatTable = tablesMap.get('wipes-keyword-category-table');
  const kwDetailTable = tablesMap.get('wipes-keyword-detail-table');
  const audienceTable = tablesMap.get('wipes-audience-packages-table');
  const tierTable = tablesMap.get('wipes-tier-efficiency-table');
  const directionTable = tablesMap.get('wipes-direction-efficiency-table');

  // =========================================================================
  // SECTION: ADS (搜索与人群)
  // =========================================================================
  if (section === 'ads') {
    if (!kwCatTable && !audienceTable && !kwDetailTable) {
      return null;
    }

    // 1. Four keyword categories data (filter out total row)
    const categoryChartRows = (kwCatTable?.rows || [])
      .filter((r) => r.category !== '总计')
      .map((r) => ({
        ...r,
        spend: parseFiniteNum(r.spend),
        cpuv: parseFiniteNum(r.cpuv),
      }));

    const categorySeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'cpuv', label: '访客成本 (CPUV)', unit: '元/人', axis: 'right', kind: 'point', color: '#b88a45' },
    ];

    // 2. Audience packages Top 8 (filter out total row, sort with nulls last)
    const audienceDetailRows = (audienceTable?.rows || [])
      .filter((r) => r.packageName !== '总计')
      .map((r) => ({
        ...r,
        spend: parseFiniteNum(r.spend),
        cpuv: parseFiniteNum(r.cpuv),
        shortName: String(r.packageName || '').replace(/^人群包-/, ''),
      }))
      .sort((a, b) => {
        if (a.spend === null && b.spend === null) return 0;
        if (a.spend === null) return 1;
        if (b.spend === null) return -1;
        return b.spend - a.spend;
      });

    const top8Audiences = audienceDetailRows.slice(0, 8);

    const audienceSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: '#8273a3' },
      { key: 'cpuv', label: '访客成本 (CPUV)', unit: '元/人', axis: 'right', kind: 'point', color: '#bd7964' },
    ];

    // Alternative: Keywords Top 8 (filter out total row, sort with nulls last)
    const keywordDetailRows = (kwDetailTable?.rows || [])
      .filter((r) => r.keyword !== '总计')
      .map((r) => ({
        ...r,
        spend: parseFiniteNum(r.spend),
        cpuv: parseFiniteNum(r.cpuv),
        shortName: String(r.keyword || ''),
      }))
      .sort((a, b) => {
        if (a.spend === null && b.spend === null) return 0;
        if (a.spend === null) return 1;
        if (b.spend === null) return -1;
        return b.spend - a.spend;
      });

    const top8Keywords = keywordDetailRows.slice(0, 8);

    const keywordSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'cpuv', label: '访客成本 (CPUV)', unit: '元/人', axis: 'right', kind: 'point', color: '#b88a45' },
    ];

    const activeRightPeriod =
      adsDimension === 'audience'
        ? audienceTable?.period || '未注明'
        : kwDetailTable?.period || '未注明';

    return (
      <div className="wipes-dive-root">
        <div className="wipes-dive-header">
          <div className="wipes-dive-header-left">
            <span className="wipes-dive-chapter-badge">01</span>
            <div>
              <h3 className="wipes-dive-title">搜索与人群</h3>
              <span className="wipes-dive-subtitle">四词类大盘消耗与CPUV结构、定向人群包Top8投放效能</span>
            </div>
          </div>
        </div>

        <div className="wipes-dive-grid">
          {/* Chart 1: Four Keyword Categories */}
          <ChartPanel
            title="四词类消耗与访客成本"
            subtitle={`统计周期：${kwCatTable?.period || '未注明'}`}
          >
            <div className="wipes-dive-panel-content">
              <CampaignComboChart
                title="四词类投放结构与CPUV"
                xKey="category"
                rows={categoryChartRows}
                series={categorySeries}
                height={260}
              />
              <p className="wipes-dive-note">
                对比不同词类大盘的投放规模与访客成本（CPUV）。站外活跃UV为小红星30日归因活跃人数，不同词类受众存在交叉重叠，不可跨词类直接相加。
              </p>
            </div>
          </ChartPanel>

          {/* Chart 2: Audience Top 8 or Keywords Top 8 */}
          <ChartPanel
            title={adsDimension === 'audience' ? '定向人群包消耗 Top 8' : '搜索关键词消耗 Top 8'}
            subtitle={`统计周期：${activeRightPeriod}（排除合计行）`}
            actions={
              <div className="wipes-dive-btn-group">
                <button
                  type="button"
                  className={`wipes-dive-btn ${adsDimension === 'audience' ? 'active' : ''}`}
                  onClick={() => setAdsDimension('audience')}
                >
                  人群包 (Top 8)
                </button>
                <button
                  type="button"
                  className={`wipes-dive-btn ${adsDimension === 'keyword' ? 'active' : ''}`}
                  onClick={() => setAdsDimension('keyword')}
                >
                  关键词 (Top 8)
                </button>
              </div>
            }
          >
            <div className="wipes-dive-panel-content">
              {adsDimension === 'audience' ? (
                <CampaignComboChart
                  title="定向人群包 Top 8 效果"
                  xKey="shortName"
                  rows={top8Audiences}
                  series={audienceSeries}
                  height={260}
                />
              ) : (
                <CampaignComboChart
                  title="核心关键词 Top 8 效果"
                  xKey="shortName"
                  rows={top8Keywords}
                  series={keywordSeries}
                  height={260}
                />
              )}
              <p className="wipes-dive-note">
                按实际消耗降序取前8项展示。受众与归因UV存在交叉，不可直接相加。缺失UV项保持为空，不伪造低成本。全量数据见下方折叠明细。
              </p>
            </div>
          </ChartPanel>
        </div>

        {/* Full Detail Tables in Expandable Container */}
        {audienceTable && (
          <details className="wipes-dive-details">
            <summary className="wipes-dive-summary">
              <span>查看全量聚光定向人群包明细表（共 {audienceDetailRows.length} 个人群包，含汇总行）</span>
              <span>点击展开 / 折叠</span>
            </summary>
            <div className="wipes-dive-table-wrap">
              <table className="wipes-dive-table">
                <thead>
                  <tr>
                    <th>人群包名称</th>
                    <th style={{ textAlign: 'right' }}>消耗金额(元)</th>
                    <th style={{ textAlign: 'right' }}>展现量</th>
                    <th style={{ textAlign: 'right' }}>点击量</th>
                    <th style={{ textAlign: 'right' }}>互动量</th>
                    <th style={{ textAlign: 'right' }}>站外活跃UV</th>
                    <th style={{ textAlign: 'right' }}>CPM(元)</th>
                    <th style={{ textAlign: 'right' }}>CTR(%)</th>
                    <th style={{ textAlign: 'right' }}>CPE(元)</th>
                    <th style={{ textAlign: 'right' }}>CPUV(元)</th>
                  </tr>
                </thead>
                <tbody>
                  {(audienceTable.rows || []).map((r, i) => (
                    <tr key={i} style={r.packageName === '总计' ? { fontWeight: 'bold', background: '#f9fafb' } : undefined}>
                      <td>{String(r.packageName || '-')}</td>
                      <td className="num">{fmtComboNum(r.spend)}</td>
                      <td className="num">{fmtComboNum(r.impressions, 0)}</td>
                      <td className="num">{fmtComboNum(r.clicks, 0)}</td>
                      <td className="num">{fmtComboNum(r.interactions, 0)}</td>
                      <td className="num">{fmtComboNum(r.uv, 0)}</td>
                      <td className="num">{fmtComboNum(r.cpm)}</td>
                      <td className="num">{r.ctr !== null && r.ctr !== undefined ? `${fmtComboNum(r.ctr)}%` : '-'}</td>
                      <td className="num">{fmtComboNum(r.cpe)}</td>
                      <td className="num">{r.cpuv !== null && r.cpuv !== undefined ? fmtComboNum(r.cpuv) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {kwDetailTable && (
          <details className="wipes-dive-details">
            <summary className="wipes-dive-summary">
              <span>查看核心搜索关键词明细表（共 {keywordDetailRows.length} 词）</span>
              <span>点击展开 / 折叠</span>
            </summary>
            <div className="wipes-dive-table-wrap">
              <table className="wipes-dive-table">
                <thead>
                  <tr>
                    <th>词类</th>
                    <th>关键词</th>
                    <th style={{ textAlign: 'right' }}>消耗金额(元)</th>
                    <th style={{ textAlign: 'right' }}>展现量</th>
                    <th style={{ textAlign: 'right' }}>点击量</th>
                    <th style={{ textAlign: 'right' }}>互动量</th>
                    <th style={{ textAlign: 'right' }}>站外活跃UV</th>
                    <th style={{ textAlign: 'right' }}>CPM(元)</th>
                    <th style={{ textAlign: 'right' }}>CPC(元)</th>
                    <th style={{ textAlign: 'right' }}>CTR(%)</th>
                    <th style={{ textAlign: 'right' }}>CPE(元)</th>
                    <th style={{ textAlign: 'right' }}>CPUV(元)</th>
                  </tr>
                </thead>
                <tbody>
                  {(kwDetailTable.rows || []).map((r, i) => (
                    <tr key={i}>
                      <td>{String(r.category || '-')}</td>
                      <td>{String(r.keyword || '-')}</td>
                      <td className="num">{fmtComboNum(r.spend)}</td>
                      <td className="num">{fmtComboNum(r.impressions, 0)}</td>
                      <td className="num">{fmtComboNum(r.clicks, 0)}</td>
                      <td className="num">{fmtComboNum(r.interactions, 0)}</td>
                      <td className="num">{fmtComboNum(r.uv, 0)}</td>
                      <td className="num">{fmtComboNum(r.cpm)}</td>
                      <td className="num">{fmtComboNum(r.cpc)}</td>
                      <td className="num">{r.ctr !== null && r.ctr !== undefined ? `${fmtComboNum(r.ctr)}%` : '-'}</td>
                      <td className="num">{fmtComboNum(r.cpe)}</td>
                      <td className="num">{r.cpuv !== null && r.cpuv !== undefined ? fmtComboNum(r.cpuv) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    );
  }

  // =========================================================================
  // SECTION: CONTENT (达人与内容效率)
  // =========================================================================
  if (section === 'content') {
    if (!tierTable && !directionTable) {
      return null;
    }

    // 1. Tier efficiency rows (filter out total row)
    const tierChartRows = (tierTable?.rows || [])
      .filter((r) => r.tier !== '总计')
      .map((r) => ({
        ...r,
        kFee: parseFiniteNum(r.kFee),
        fsSpend: parseFiniteNum(r.fsSpend),
        noteCount: parseFiniteNum(r.noteCount),
      }));

    const tierSeries: ComboSeries[] = [
      { key: 'kFee', label: '达人采买费', unit: '元', axis: 'left', kind: 'bar', color: '#8273a3' },
      { key: 'fsSpend', label: 'FS投流费', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'noteCount', label: '笔记篇数', unit: '篇', axis: 'right', kind: 'line', color: '#b88a45' },
    ];

    // 2. Direction efficiency rows (filter out total row)
    const directionChartRows = (directionTable?.rows || [])
      .filter((r) => r.direction !== '总计')
      .map((r) => ({
        ...r,
        engagements: parseFiniteNum(r.engagements),
        cpe: parseFiniteNum(r.cpe),
      }));

    const directionSeries: ComboSeries[] = [
      { key: 'engagements', label: '总互动量', unit: '次', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'cpe', label: 'KFS CPE', unit: '元/次', axis: 'right', kind: 'line', color: '#bd7964' },
    ];

    return (
      <div className="wipes-dive-root">
        <div className="wipes-dive-header">
          <div className="wipes-dive-header-left">
            <span className="wipes-dive-chapter-badge">02</span>
            <div>
              <h3 className="wipes-dive-title">达人与内容效率</h3>
              <span className="wipes-dive-subtitle">K端达人采买与FS投流费双轴透视、各内容方向互动与KFS成本</span>
            </div>
          </div>
        </div>

        <div className="wipes-dive-grid">
          {/* Chart 1: Creator Tiers */}
          <ChartPanel
            title="达人层级采买与投流结构"
            subtitle={`统计周期：${tierTable?.period || '未注明'}（排除合计行）`}
          >
            <div className="wipes-dive-panel-content">
              <CampaignComboChart
                title="达人层级投放结构"
                xKey="tier"
                rows={tierChartRows}
                series={tierSeries}
                height={260}
              />
              <p className="wipes-dive-note">
                同轴对比各层级K端达人采买费与FS聚光投流费，右轴对照笔记发布篇数。严格区分采买与投流预算。
              </p>
            </div>
          </ChartPanel>

          {/* Chart 2: Content Direction */}
          <ChartPanel
            title="内容方向互动与KFS成本"
            subtitle={`统计周期：${directionTable?.period || '未注明'}（排除合计行）`}
          >
            <div className="wipes-dive-panel-content">
              <CampaignComboChart
                title="内容方向互动与成本"
                xKey="direction"
                rows={directionChartRows}
                series={directionSeries}
                height={260}
              />
              <p className="wipes-dive-note">
                展示各内容方向的总互动量与KFS综合互动成本（CPE）。各方向独立核算，不与FS投流访客成本混作同一预算。
              </p>
            </div>
          </ChartPanel>
        </div>

        {/* Full Detail Tables in Expandable Container */}
        {tierTable && (
          <details className="wipes-dive-details">
            <summary className="wipes-dive-summary">
              <span>查看达人层级投放结构与转化效率明细表</span>
              <span>点击展开 / 折叠</span>
            </summary>
            <div className="wipes-dive-table-wrap">
              <table className="wipes-dive-table">
                <thead>
                  <tr>
                    <th>达人层级</th>
                    <th style={{ textAlign: 'right' }}>发布篇数</th>
                    <th style={{ textAlign: 'right' }}>KFS总消耗(元)</th>
                    <th style={{ textAlign: 'right' }}>K端达人费(元)</th>
                    <th style={{ textAlign: 'right' }}>FS聚光投流(元)</th>
                    <th style={{ textAlign: 'right' }}>总曝光量</th>
                    <th style={{ textAlign: 'right' }}>总互动量</th>
                    <th style={{ textAlign: 'right' }}>FS站外活跃UV</th>
                    <th style={{ textAlign: 'right' }}>KFS CPM(元)</th>
                    <th style={{ textAlign: 'right' }}>KFS CPE(元)</th>
                    <th style={{ textAlign: 'right' }}>FS CPUV(元)</th>
                    <th style={{ textAlign: 'right' }}>阅读CTR(%)</th>
                  </tr>
                </thead>
                <tbody>
                  {(tierTable.rows || []).map((r, i) => (
                    <tr key={i} style={r.tier === '总计' ? { fontWeight: 'bold', background: '#f9fafb' } : undefined}>
                      <td>{String(r.tier || '-')}</td>
                      <td className="num">{fmtComboNum(r.noteCount, 0)}</td>
                      <td className="num">{fmtComboNum(r.totalSpend)}</td>
                      <td className="num">{fmtComboNum(r.kFee)}</td>
                      <td className="num">{fmtComboNum(r.fsSpend)}</td>
                      <td className="num">{fmtComboNum(r.impressions, 0)}</td>
                      <td className="num">{fmtComboNum(r.engagements, 0)}</td>
                      <td className="num">{fmtComboNum(r.fsUv, 0)}</td>
                      <td className="num">{fmtComboNum(r.cpm)}</td>
                      <td className="num">{fmtComboNum(r.cpe)}</td>
                      <td className="num">{r.fsCpuv !== null && r.fsCpuv !== undefined ? fmtComboNum(r.fsCpuv) : '-'}</td>
                      <td className="num">{r.ctr !== null && r.ctr !== undefined ? `${fmtComboNum(r.ctr)}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {directionTable && (
          <details className="wipes-dive-details">
            <summary className="wipes-dive-summary">
              <span>查看内容方向投放结构与转化效率明细表</span>
              <span>点击展开 / 折叠</span>
            </summary>
            <div className="wipes-dive-table-wrap">
              <table className="wipes-dive-table">
                <thead>
                  <tr>
                    <th>内容方向</th>
                    <th style={{ textAlign: 'right' }}>发布篇数</th>
                    <th style={{ textAlign: 'right' }}>KFS总消耗(元)</th>
                    <th style={{ textAlign: 'right' }}>K端达人费(元)</th>
                    <th style={{ textAlign: 'right' }}>FS聚光投流(元)</th>
                    <th style={{ textAlign: 'right' }}>总曝光量</th>
                    <th style={{ textAlign: 'right' }}>总互动量</th>
                    <th style={{ textAlign: 'right' }}>FS站外活跃UV</th>
                    <th style={{ textAlign: 'right' }}>KFS CPM(元)</th>
                    <th style={{ textAlign: 'right' }}>KFS CPE(元)</th>
                    <th style={{ textAlign: 'right' }}>FS CPUV(元)</th>
                    <th style={{ textAlign: 'right' }}>阅读CTR(%)</th>
                  </tr>
                </thead>
                <tbody>
                  {(directionTable.rows || []).map((r, i) => (
                    <tr key={i} style={r.direction === '总计' ? { fontWeight: 'bold', background: '#f9fafb' } : undefined}>
                      <td>{String(r.direction || '-')}</td>
                      <td className="num">{fmtComboNum(r.noteCount, 0)}</td>
                      <td className="num">{fmtComboNum(r.totalSpend)}</td>
                      <td className="num">{fmtComboNum(r.kFee)}</td>
                      <td className="num">{fmtComboNum(r.fsSpend)}</td>
                      <td className="num">{fmtComboNum(r.impressions, 0)}</td>
                      <td className="num">{fmtComboNum(r.engagements, 0)}</td>
                      <td className="num">{fmtComboNum(r.fsUv, 0)}</td>
                      <td className="num">{fmtComboNum(r.cpm)}</td>
                      <td className="num">{fmtComboNum(r.cpe)}</td>
                      <td className="num">{r.fsCpuv !== null && r.fsCpuv !== undefined ? fmtComboNum(r.fsCpuv) : '-'}</td>
                      <td className="num">{r.ctr !== null && r.ctr !== undefined ? `${fmtComboNum(r.ctr)}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    );
  }

  return null;
}
