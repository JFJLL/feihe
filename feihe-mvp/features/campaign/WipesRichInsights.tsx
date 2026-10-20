'use client';

import React, { useMemo, useState } from 'react';
import type { CampaignDashboard, CampaignTable } from '../../lib/campaign-types';
import { CampaignComboChart, type ComboSeries, fmtComboNum } from './CampaignComboChart';
import { ChartPanel } from './CampaignCharts';
import './wipes-rich-insights.css';

interface WipesRichInsightsProps {
  dashboard: CampaignDashboard;
  section: 'overview' | 'ads' | 'content';
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

function roundNum(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function WipesRichInsights({ dashboard, section }: WipesRichInsightsProps) {
  const [audienceCostFilter, setAudienceCostFilter] = useState<'all' | 'low_cpuv' | 'high_cpuv' | 'has_uv'>('all');
  const [cidView, setCidView] = useState<'all' | 'converters'>('all');

  const tablesMap = useMemo(() => {
    const map = new Map<string, CampaignTable>();
    for (const t of dashboard.tables || []) {
      map.set(t.id, t);
    }
    return map;
  }, [dashboard.tables]);

  const kpiTable = tablesMap.get('wipes-kpi-achievement-table');
  const xingheTable = tablesMap.get('wipes-taobao-xinghe-table');
  const budgetTable = tablesMap.get('wipes-budget-dual-track-table');
  const cidTable = tablesMap.get('wipes-cid-full-attribution-table');
  const weeklyTable = tablesMap.get('wipes-weekly-sprint-table');
  const channelsTable = tablesMap.get('wipes-channel-structure-table');
  const kwDetailTable = tablesMap.get('wipes-keyword-detail-table');
  const kwCatTable = tablesMap.get('wipes-keyword-category-table');
  const audienceTable = tablesMap.get('wipes-audience-packages-table');
  const placementTable = tablesMap.get('wipes-placement-efficiency-table');
  const tierTable = tablesMap.get('wipes-tier-efficiency-table');
  const directionTable = tablesMap.get('wipes-direction-efficiency-table');

  // =========================================================================
  // SECTION: OVERVIEW
  // =========================================================================
  if (section === 'overview') {
    const kpiRows = (kpiTable?.rows || []).map((r) => ({
      dimension: String(r.dimension || ''),
      metric: String(r.metric || ''),
      subChannel: String(r.subChannel || ''),
      rawTarget: String(r.rawTarget || r.target || ''),
      rawActual: String(r.rawActual || r.actual || ''),
      comparator: String(r.comparator || 'gte'),
      numericTarget: parseFiniteNum(r.numericTarget),
      numericActual: parseFiniteNum(r.numericActual),
      sourceProgress: String(r.sourceProgress || ''),
      calculatedAchievementPct: String(r.calculatedAchievementPct || ''),
      isSurpassed: typeof r.isSurpassed === 'boolean' ? r.isSurpassed : null,
      auditNote: r.auditNote ? String(r.auditNote) : null,
    }));

    const xingheRows = (xingheTable?.rows || []).map((r) => {
      const sUv = parseFiniteNum(r.search_in_uv);
      const nUv = parseFiniteNum(r.note_in_uv);
      return {
        date: String(r.date || ''),
        fs_spend: parseFiniteNum(r.fs_spend),
        shop_total_gmv: parseFiniteNum(r.shop_total_gmv),
        task_item_gmv: parseFiniteNum(r.task_item_gmv),
        search_in_uv: sUv !== null ? sUv : null,
        note_in_uv: nUv !== null ? nUv : null,
        new_visitor_uv: parseFiniteNum(r.new_visitor_uv),
        shop_buy_uv: parseFiniteNum(r.shop_buy_uv),
      };
    });

    const xingheSeries: ComboSeries[] = [
      { key: 'fs_spend', label: 'FS投流消耗', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'task_item_gmv', label: '任务单品直接GMV', unit: '元', axis: 'left', kind: 'bar', color: '#b88a45' },
      { key: 'shop_total_gmv', label: '全店成交GMV (宏观走势)', unit: '元', axis: 'left', kind: 'line', color: '#8273a3' },
      { key: 'note_in_uv', label: '笔记进店UV', unit: '人', axis: 'right', kind: 'point', color: '#bd7964' },
      { key: 'search_in_uv', label: '手淘搜索进店UV', unit: '人', axis: 'right', kind: 'line', color: '#4d8b80' },
    ];

    const weeklyRows = (weeklyTable?.rows || []).map((r) => ({
      sourcePeriod: String(r.sourcePeriod || r.period || ''),
      actualObservedPeriod: String(r.actualObservedPeriod || r.sourcePeriod || ''),
      spend: parseFiniteNum(r.spend),
      cpuv: parseFiniteNum(r.cpuv),
      dailySpendAvg: parseFiniteNum(r.dailySpendAvg),
      observedDays: parseFiniteNum(r.observedDays),
      uv_30d: parseFiniteNum(r.uv_30d),
    }));

    const weeklySeries: ComboSeries[] = [
      { key: 'spend', label: '阶段累计消耗', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'cpuv', label: '阶段访客成本 (CPUV)', unit: '元/人', axis: 'right', kind: 'line', color: '#b88a45' },
    ];

    const channelRows = (channelsTable?.rows || []).filter((r) => String(r.channel) !== 'Total');

    // Budget Dynamic Derivations (zero hardcoding)
    const budgetRows = budgetTable?.rows || [];
    const clientRows = budgetRows.filter((r) => String(r.track) === '客户打款口径' && String(r.category) !== '打款总计');
    const usableRows = budgetRows.filter((r) => String(r.track) === '实际可消耗口径' && String(r.category) !== '实际可消耗总计');
    const clientTotal = budgetRows.find((r) => String(r.track) === '客户打款口径' && String(r.category) === '打款总计');
    const usableTotal = budgetRows.find((r) => String(r.track) === '实际可消耗口径' && String(r.category) === '实际可消耗总计');

    const budgetPairs = clientRows.map((cr) => {
      const ur = usableRows.find((u) => String(u.category) === String(cr.category));
      return {
        category: String(cr.category || ''),
        clientBudget: parseFiniteNum(cr.budget),
        clientSpent: parseFiniteNum(cr.spent),
        clientRate: String(cr.spentRate || ''),
        usableBudget: parseFiniteNum(ur?.budget),
        usableSpent: parseFiniteNum(ur?.spent),
        usableRate: String(ur?.spentRate || ''),
      };
    });

    const budgetComboSeries: ComboSeries[] = [
      { key: 'clientBudget', label: '打款预算', unit: '元', axis: 'left', kind: 'bar', color: '#b88a45' },
      { key: 'clientSpent', label: '打款已用', unit: '元', axis: 'left', kind: 'bar', color: '#bd7964' },
      { key: 'usableBudget', label: '可消耗预算', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'usableSpent', label: '可消耗已用', unit: '元', axis: 'left', kind: 'bar', color: '#4d8b80' },
    ];

    return (
      <div className="wipes-rich-container">
        <div className="wipes-rich-header">
          <div className="wipes-rich-header-title">
            <span className="wipes-rich-tag">专项洞察</span>
            <span>稳健玉米湿巾投放与转化数据透视</span>
          </div>
          <div className="wipes-rich-notice">
            *全店GMV含自然及其他渠道成交，不作广告直接ROI；站外活跃UV为各对象30日独立归因。
          </div>
        </div>

        {/* Panel 1: KPI Goals vs Actuals Matrix */}
        <ChartPanel
          title="KPI目标与实绩全景达成矩阵"
          subtitle="源表快照底表对账（日常种草7项 + 医生专家4项），按成本越低越优与规模越高越优双向判定"
        >
          <div className="wipes-rich-grid-3">
            {kpiRows.map((kpi, idx) => {
              const statusBadge =
                kpi.isSurpassed === true
                  ? { text: '达标/超额', cls: 'surpassed' }
                  : kpi.isSurpassed === false
                  ? { text: '滞后/超支', cls: 'lagging' }
                  : { text: '待核验', cls: 'pending' };

              const achNum = parseFiniteNum(kpi.calculatedAchievementPct);
              const fillPct = achNum !== null ? Math.min(achNum, 100) : 0;
              return (
                <div key={idx} className="wipes-kpi-card">
                  <div className="wipes-kpi-head">
                    <span className="wipes-kpi-name">
                      [{kpi.dimension}] {kpi.metric}
                    </span>
                    <span className={`wipes-kpi-badge ${statusBadge.cls}`}>
                      {statusBadge.text}
                    </span>
                  </div>
                  <div className="wipes-kpi-values">
                    <div className="wipes-kpi-actual">实绩: {kpi.rawActual}</div>
                    <div className="wipes-kpi-target">目标: {kpi.rawTarget}</div>
                  </div>
                  <div className="wipes-kpi-progress-bar">
                    <div
                      className={`wipes-kpi-progress-fill ${statusBadge.cls}`}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                  <div className="wipes-kpi-footer">
                    <span>达成率: {kpi.calculatedAchievementPct || kpi.sourceProgress || '--'}</span>
                    <span>{kpi.subChannel ? `渠道: ${kpi.subChannel}` : ''}</span>
                  </div>
                  {kpi.auditNote && <div className="wipes-kpi-note">*{kpi.auditNote}</div>}
                </div>
              );
            })}
          </div>
        </ChartPanel>

        {/* Panel 2: Budget Dual-Track Visualization */}
        <ChartPanel
          title="预算双轨结构对比（打款账本 vs 可消耗账本）"
          subtitle="对比客户打款口径与实际可消耗口径下各费用类目的规划预算与实际支出"
        >
          <CampaignComboChart
            rows={budgetPairs}
            series={budgetComboSeries}
            xKey="category"
            title="各费用类目预算与支出对比（双账本独立核算）"
            height={280}
          />

          <div className="wipes-rich-grid-2" style={{ marginTop: '14px' }}>
            <div className="wipes-info-card">
              <div className="wipes-info-title">
                <span>客户打款账本进度</span>
              </div>
              <div className="wipes-info-stat">
                ¥{fmtComboNum(clientTotal?.spent)} / ¥{fmtComboNum(clientTotal?.budget)}
              </div>
              <div className="wipes-info-desc">
                <p><strong>• 累计消耗进度：</strong>{String(clientTotal?.spentRate ?? '--')}</p>
                <p><strong>• 剩余预算额度：</strong>¥{fmtComboNum(clientTotal?.remaining)}</p>
              </div>
            </div>

            <div className="wipes-info-card">
              <div className="wipes-info-title">
                <span>实际可消耗账本进度</span>
              </div>
              <div className="wipes-info-stat">
                ¥{fmtComboNum(usableTotal?.spent)} / ¥{fmtComboNum(usableTotal?.budget)}
              </div>
              <div className="wipes-info-desc">
                <p><strong>• 累计消耗进度：</strong>{String(usableTotal?.spentRate ?? '--')}</p>
                <p><strong>• 剩余预算额度：</strong>¥{fmtComboNum(usableTotal?.remaining)}</p>
              </div>
            </div>
          </div>

          <details style={{ marginTop: '12px', cursor: 'pointer', fontSize: '13px', color: '#475569' }}>
            <summary style={{ padding: '6px 0', fontWeight: 600 }}>查看费用类目双轨明细表</summary>
            <table className="wipes-summary-table" style={{ marginTop: '8px' }}>
              <thead>
                <tr>
                  <th>费用类目</th>
                  <th>打款预算</th>
                  <th>打款已用</th>
                  <th>打款进度</th>
                  <th>可消耗预算</th>
                  <th>可消耗已用</th>
                </tr>
              </thead>
              <tbody>
                {budgetPairs.map((p, i) => (
                  <tr key={i}>
                    <td>{p.category}</td>
                    <td>¥{fmtComboNum(p.clientBudget)}</td>
                    <td>¥{fmtComboNum(p.clientSpent)}</td>
                    <td>{p.clientRate}</td>
                    <td>¥{fmtComboNum(p.usableBudget)}</td>
                    <td>¥{fmtComboNum(p.usableSpent)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 'bold', background: '#f8fafc' }}>
                  <td>总计</td>
                  <td>¥{fmtComboNum(clientTotal?.budget)}</td>
                  <td>¥{fmtComboNum(clientTotal?.spent)}</td>
                  <td>{String(clientTotal?.spentRate ?? '--')}</td>
                  <td>¥{fmtComboNum(usableTotal?.budget)}</td>
                  <td>¥{fmtComboNum(usableTotal?.spent)}</td>
                </tr>
              </tbody>
            </table>
          </details>

          <div className="wipes-attribution-callout" style={{ marginTop: '12px' }}>
            <strong>账本说明：</strong>打款口径与可消耗口径为两套独立核算账本，不可跨账本累加。发布数据追踪截至10/12，投流数据按T-1更新。
          </div>
        </ChartPanel>

        {/* Panel 3: Taobao Xinghe E-commerce Attribution */}
        <ChartPanel
          title={`淘宝星河：手淘搜索曝光进店与全店GMV走势（共 ${xingheRows.length} 天）`}
          subtitle="全店GMV为淘宝全店总成交额，任务单品GMV为玉米湿巾直接成交"
        >
          <CampaignComboChart
            rows={xingheRows}
            series={xingheSeries}
            xKey="date"
            title="淘宝星河投放消耗与进店GMV宏观走势"
            height={300}
          />
          <div className="wipes-attribution-callout" style={{ marginTop: '12px' }}>
            <strong>数据说明：</strong>全店成交GMV(累计¥74,489.30)包含自然搜索与多渠道转化，不作广告直接ROI。10/8起加大投流后，笔记进店UV（累计12,197人）与手淘搜索进店UV（累计4,844人）保持正向关联，全店新客占比稳定在50%~80%，任务单品直接成交GMV为¥8,741.81。
          </div>
        </ChartPanel>

        {/* Panel 4: Weekly Progression */}
        <ChartPanel
          title={`各阶段消耗与访客成本对比（共 ${weeklyRows.length} 期）`}
          subtitle="源表第5期行标为10/13-10/29规划窗口，实测加总截止10/19共7天（消耗¥76,964，日均¥10,995/天）"
        >
          <CampaignComboChart
            rows={weeklyRows}
            series={weeklySeries}
            xKey="sourcePeriod"
            title="各阶段消耗、日均消耗与CPUV走势"
            height={280}
          />
          <div className="wipes-rich-grid-3" style={{ marginTop: '14px' }}>
            <div className="wipes-info-card">
              <div className="wipes-info-title">W1~W3 早期投放阶段（9/16~10/5）</div>
              <div className="wipes-info-desc">
                CPUV从冷启动W1的¥28.17下降至W3的¥4.29（记录周期最低点），日均消耗保持在2.5k~4.1k，累计获取9,462站外活跃UV。
              </div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">W4 节后执行阶段（10/6~10/12）</div>
              <div className="wipes-info-desc">
                10/6~10/12达人集中发布，互动量达5,996次，CPE为¥5.75，阶段记录CPUV为¥45.13。
              </div>
            </div>
            <div className="wipes-info-card">
              <div className="wipes-info-title">W5 大促加速阶段（10/13~10/19）</div>
              <div className="wipes-info-desc">
                7天实际消耗¥76,964（日均¥10,995/天），CPUV处于¥14.40区间，单周对应站外活跃UV 5,345。
              </div>
            </div>
          </div>
        </ChartPanel>

        {/* Panel 5: Channel Spend Structure */}
        <ChartPanel
          title="渠道费用构成与占比"
          subtitle="淘搜底表全量36天对账（¥369,798.36），各渠道消耗与份额按源表记录动态呈现"
        >
          <div className="wipes-rich-grid-4">
            {channelRows.map((c, i) => (
              <div key={i} className="wipes-info-card">
                <div className="wipes-info-title">
                  <span className="wipes-rich-tag" style={{ background: i === 0 ? '#2c7168' : i === 1 ? '#8273a3' : i === 2 ? '#b88a45' : '#bd7964' }}>
                    {String(c.channel ?? '')}端
                  </span>
                  <span>{String(c.channelName ?? '')}</span>
                </div>
                <div className="wipes-info-stat">¥{fmtComboNum(c.spend)}</div>
                <div className="wipes-info-desc">
                  <p><strong>占比：</strong>{String(c.share ?? '--')}</p>
                  <p><strong>定位：</strong>{String(c.role ?? '--')}</p>
                </div>
              </div>
            ))}
          </div>
        </ChartPanel>
      </div>
    );
  }

  // =========================================================================
  // SECTION: ADS (搜索与人群)
  // =========================================================================
  if (section === 'ads') {
    const rawKwRows = (kwDetailTable?.rows || [])
      .filter((r) => String(r.keyword) !== '总计')
      .map((r) => ({
        keyword: String(r.keyword || ''),
        category: String(r.category || ''),
        spend: parseFiniteNum(r.spend),
        impressions: parseFiniteNum(r.impressions),
        clicks: parseFiniteNum(r.clicks),
        uv: parseFiniteNum(r.uv),
        cpuv: parseFiniteNum(r.cpuv),
        cpm: parseFiniteNum(r.cpm),
      }))
      .sort((a, b) => (b.spend || 0) - (a.spend || 0));

    const totalKwSpend = rawKwRows.reduce((sum, r) => sum + (r.spend || 0), 0);
    const paretoKwRows = rawKwRows.map((r, idx) => {
      const prefixSpend = rawKwRows.slice(0, idx + 1).reduce((sum, item) => sum + (item.spend || 0), 0);
      const cumPct = totalKwSpend > 0 ? roundNum((prefixSpend / totalKwSpend) * 100, 1) : 0;
      return {
        ...r,
        cumSpendShare: cumPct,
      };
    });

    const top12Pareto = paretoKwRows.slice(0, 12);
    const paretoSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗金额', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'cumSpendShare', label: '累计消耗占比', unit: '%', axis: 'right', kind: 'line', color: '#b88a45' },
    ];

    const catRows = (kwCatTable?.rows || []).filter((r) => String(r.category) !== '总计');

    const audienceRows = (audienceTable?.rows || [])
      .filter((r) => String(r.packageName) !== '总计')
      .map((r) => ({
        ...r,
        packageName: String(r.packageName || ''),
        shortName: String(r.packageName || '').replace(/^人群包-/, ''),
        spend: parseFiniteNum(r.spend),
        uv: parseFiniteNum(r.uv),
        cpuv: parseFiniteNum(r.cpuv),
      }))
      .sort((a, b) => (b.spend || 0) - (a.spend || 0));

    const filteredAudiences = audienceCostFilter === 'all'
      ? audienceRows
      : audienceCostFilter === 'low_cpuv'
      ? audienceRows.filter((r) => r.cpuv !== null && r.cpuv <= 20)
      : audienceCostFilter === 'high_cpuv'
      ? audienceRows.filter((r) => r.cpuv !== null && r.cpuv > 20)
      : audienceRows.filter((r) => (r.uv || 0) > 0);

    const audienceSeries: ComboSeries[] = [
      { key: 'spend', label: '消耗金额', unit: '元', axis: 'left', kind: 'bar', color: '#8273a3' },
      { key: 'cpuv', label: '访客成本 (CPUV)', unit: '元/人', axis: 'right', kind: 'point', color: '#bd7964' },
    ];

    const placementRows = (placementTable?.rows || []).filter((r) => String(r.placement) !== '总计');

    return (
      <div className="wipes-rich-container">
        <div className="wipes-rich-header">
          <div className="wipes-rich-header-title">
            <span className="wipes-rich-tag">搜索与人群</span>
            <span>搜索关键词Pareto贡献度、四大词类效率与定向人群透视</span>
          </div>
          <div className="wipes-rich-notice">
            *人群包与关键词UV为各对象30日独立归因，受众存在交叉，不可直接累加。
          </div>
        </div>

        {/* Chart 1: True Pareto Chart */}
        <ChartPanel
          title="核心搜索关键词消耗与累计贡献 Pareto 分析 (Top 12)"
          subtitle="按单词消耗降序排列。展示头部关键词对总搜索支出的累计贡献比例 (Pareto曲线)"
        >
          <CampaignComboChart
            rows={top12Pareto}
            series={paretoSeries}
            xKey="keyword"
            title="Top 12 核心关键词消耗与累计贡献"
            height={300}
          />
        </ChartPanel>

        {/* Chart 2: Keyword Categories Quadrant */}
        <ChartPanel
          title="四大搜索词类效果结构与指标对比"
          subtitle="对比品牌词、场景词、品类词与竞品词的曝光、点击、UV与成本效率"
        >
          <div className="wipes-rich-grid-4">
            {catRows.map((cat, i) => (
              <div key={i} className="wipes-info-card">
                <div className="wipes-info-title">
                  <span className="wipes-rich-tag" style={{ background: i === 0 ? '#2c7168' : i === 1 ? '#8273a3' : i === 2 ? '#b88a45' : '#bd7964' }}>
                    {String(cat.category ?? '')}
                  </span>
                </div>
                <div className="wipes-info-stat">¥{fmtComboNum(cat.spend)}</div>
                <div className="wipes-info-desc">
                  <p><strong>展现量：</strong>{fmtComboNum(cat.impressions)}</p>
                  <p><strong>归因UV：</strong>{fmtComboNum(cat.uv)} 人</p>
                  <p><strong>CPUV成本：</strong>¥{cat.cpuv ? String(cat.cpuv) : '--'}</p>
                  <p><strong>CPM成本：</strong>¥{cat.cpm ? String(cat.cpm) : '--'}</p>
                </div>
              </div>
            ))}
          </div>
        </ChartPanel>

        {/* Chart 3: Audience Packages Filterable Chart */}
        <ChartPanel
          title="31定向人群包消耗与成本分布"
          subtitle="支持按成本区间（CPUV ≤ 20元 vs CPUV > 20元）或是否产生转化进行筛选查看"
          actions={
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>筛选条件:</span>
              <button
                className={`btn btn-sm ${audienceCostFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAudienceCostFilter('all')}
              >
                全部(31)
              </button>
              <button
                className={`btn btn-sm ${audienceCostFilter === 'low_cpuv' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAudienceCostFilter('low_cpuv')}
              >
                CPUV ≤ 20元
              </button>
              <button
                className={`btn btn-sm ${audienceCostFilter === 'high_cpuv' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAudienceCostFilter('high_cpuv')}
              >
                {'CPUV > 20元'}
              </button>
              <button
                className={`btn btn-sm ${audienceCostFilter === 'has_uv' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAudienceCostFilter('has_uv')}
              >
                有归因UV
              </button>
            </div>
          }
        >
          <CampaignComboChart
            rows={filteredAudiences.slice(0, 10)}
            series={audienceSeries}
            xKey="shortName"
            title="人群包消耗与访客成本分布"
            height={280}
          />
        </ChartPanel>

        {/* Chart 4: Placement Comparison */}
        <ChartPanel
          title="广告投放版位（视频内流 vs 搜索推广 vs 信息流推广）对比"
          subtitle="视频内流转化效率最优(CPUV ¥4.83)，搜索推广曝光成本最低(CPM ¥42.83)，信息流定向精准"
        >
          <table className="wipes-summary-table">
            <thead>
              <tr>
                <th>版位类型</th>
                <th>消耗金额</th>
                <th>展现量</th>
                <th>点击量</th>
                <th>互动量</th>
                <th>归因活跃UV</th>
                <th>CPM (元)</th>
                <th>CTR (%)</th>
                <th>CPUV (元)</th>
              </tr>
            </thead>
            <tbody>
              {placementRows.map((p, i) => (
                <tr key={i}>
                  <td><strong>{String(p.placement ?? '')}</strong></td>
                  <td>¥{fmtComboNum(p.spend)}</td>
                  <td>{fmtComboNum(p.impressions)}</td>
                  <td>{fmtComboNum(p.clicks)}</td>
                  <td>{fmtComboNum(p.interactions)}</td>
                  <td>{fmtComboNum(p.uv)}</td>
                  <td>¥{String(p.cpm ?? '--')}</td>
                  <td>{String(p.ctr ?? '--')}%</td>
                  <td><span className="wipes-kpi-badge surpassed">¥{String(p.cpuv ?? '--')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartPanel>
      </div>
    );
  }

  // =========================================================================
  // SECTION: CONTENT (内容与达人)
  // =========================================================================
  if (section === 'content') {
    const cidRows = (cidTable?.rows || []).map((r) => ({
      creator: String(r.creator || ''),
      spend: parseFiniteNum(r.spend),
      component_clicks: parseFiniteNum(r.component_clicks),
      cost_per_component_click: parseFiniteNum(r.cost_per_component_click),
      orders_30d: parseFiniteNum(r.orders_30d),
      gmv_30d: parseFiniteNum(r.gmv_30d),
      roi_30d: parseFiniteNum(r.roi_30d),
    }));

    const filteredCid = cidView === 'converters'
      ? cidRows.filter((r) => (r.orders_30d || 0) > 0)
      : cidRows;

    const cidSeries: ComboSeries[] = [
      { key: 'spend', label: 'CID消耗', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'component_clicks', label: '组件点击量', unit: '次', axis: 'right', kind: 'bar', color: '#8273a3' },
    ];

    const tierChartRows = (tierTable?.rows || [])
      .filter((r) => String(r.tier) !== '总计')
      .map((r) => ({
        tier: String(r.tier || ''),
        kFee: parseFiniteNum(r.kFee),
        fsSpend: parseFiniteNum(r.fsSpend),
        totalSpend: parseFiniteNum(r.totalSpend),
        engagements: parseFiniteNum(r.engagements),
        cpe: parseFiniteNum(r.cpe),
        fsCpuv: parseFiniteNum(r.fsCpuv),
      }));

    const tierSeries: ComboSeries[] = [
      { key: 'kFee', label: 'K端达人费', unit: '元', axis: 'left', kind: 'bar', color: '#b88a45' },
      { key: 'fsSpend', label: 'FS投流费', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'engagements', label: '总互动量', unit: '次', axis: 'right', kind: 'line', color: '#8273a3' },
    ];

    const directionChartRows = (directionTable?.rows || [])
      .filter((r) => String(r.direction) !== '总计')
      .map((r) => ({
        direction: String(r.direction || ''),
        totalSpend: parseFiniteNum(r.totalSpend),
        fsUv: parseFiniteNum(r.fsUv),
        fsCpuv: parseFiniteNum(r.fsCpuv),
        cpe: parseFiniteNum(r.cpe),
      }));

    const directionSeries: ComboSeries[] = [
      { key: 'totalSpend', label: '总消耗金额', unit: '元', axis: 'left', kind: 'bar', color: '#2c7168' },
      { key: 'fsUv', label: 'FS站外活跃UV', unit: '人', axis: 'right', kind: 'bar', color: '#8273a3' },
    ];

    return (
      <div className="wipes-rich-container">
        <div className="wipes-rich-header">
          <div className="wipes-rich-header-title">
            <span className="wipes-rich-tag">内容与达人</span>
            <span>CID 10位达人跨端引流追踪、4层级达人结构与5大内容方向对比</span>
          </div>
          <div className="wipes-rich-notice">
            *CID计划于10/16~10/19启动试跑；116篇达人笔记于10/12全量发布完毕。
          </div>
        </div>

        {/* Chart 1: CID 10 Creators */}
        <ChartPanel
          title="CID组件跨端直连：10位创作者消耗、点击与转化跟踪"
          subtitle="10/16~10/19试跑4天。总消耗¥2,881.17，组件点击105次。当前宸妈妈达成1笔归因订单(GMV ¥25.55)"
          actions={
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`btn btn-sm ${cidView === 'all' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCidView('all')}
              >
                全部10位创作者
              </button>
              <button
                className={`btn btn-sm ${cidView === 'converters' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCidView('converters')}
              >
                有成交订单 (宸妈妈)
              </button>
            </div>
          }
        >
          <CampaignComboChart
            rows={filteredCid}
            series={cidSeries}
            xKey="creator"
            title="CID创作者引流与成本分布"
            height={280}
          />
          <div className="wipes-attribution-callout" style={{ marginTop: '12px' }}>
            <strong>数据说明：</strong>全站智投占消耗91.6%（¥2,638.40，97次点击），信息流推广占8.4%（¥242.77，8次点击且产出1笔成交）。柚柚&果果(23次点击)、宸妈妈(34次点击)、我是小雪呀(22次点击)组件点击量排名前三。
          </div>
        </ChartPanel>

        {/* Chart 2: Creator Tiers Visual Combo Chart */}
        <ChartPanel
          title="达人4大层级投放投入与互动产出对比"
          subtitle="涵盖专家(3篇)、腰部KOL(3篇)、尾部KOL(24篇)、素人KOC(86篇)。对比K端达人费与FS投流费结构"
        >
          <CampaignComboChart
            rows={tierChartRows}
            series={tierSeries}
            xKey="tier"
            title="达人层级投入与产出对比"
            height={280}
          />
        </ChartPanel>

        {/* Chart 3: Content Direction Visual Combo Chart */}
        <ChartPanel
          title="5大内容方向消耗与产出对比"
          subtitle="居家清洁(31篇)、流感换季(31篇)、户外清洁(27篇)、大促囤货(24篇)、专家背书(3篇)"
        >
          <CampaignComboChart
            rows={directionChartRows}
            series={directionSeries}
            xKey="direction"
            title="内容方向消耗、归因UV与CPUV对比"
            height={280}
          />
        </ChartPanel>
      </div>
    );
  }

  return null;
}
