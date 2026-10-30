'use client';

import React from 'react';
import { useProject } from '../../components/project-shell/ProjectContext';
import { useCacheIdentity } from '../../components/project-shell/IdentityBoundary';
import { useCachedQuery } from '../../lib/hooks/use-cached-query';
import type { DailyView, DailyPoint } from '../../lib/business-daily/types';
import { DashboardFrame } from './DashboardFrame';
import { resolveDashboardPreset } from './dashboard-template';
import { SpendBars } from './SpendBars';
import {
  SearchVisuals,
  SearchCoreWordsVisuals,
  FeedVisuals,
  FeedAudienceVisuals,
} from './BusinessVisuals';

const formatNum = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });

export function AdsPlaceholder() {
  const { projectId, currentProject } = useProject();
  useCacheIdentity();

  const effectiveProjectId = projectId || 'qicui';

  const { data, loading, error } = useCachedQuery<{ view: DailyView }>({
    url: '/api/business-daily',
    projectId: effectiveProjectId,
    params: { projectId: effectiveProjectId, summary: '1' },
  });

  const view = data?.view;
  const series: DailyPoint[] = view?.series || [];

  const sumMetric = (getter: (p: DailyPoint) => number | null | undefined): number => {
    return series.reduce((acc, p) => {
      const v = getter(p);
      return acc + (typeof v === 'number' && !isNaN(v) ? v : 0);
    }, 0);
  };

  const totalAdSpend = sumMetric(p => p.adSpend?.value);
  const totalFeed = sumMetric(p => p.feed?.value);
  const totalSearch = sumMetric(p => p.search?.value);
  const totalSettlement = sumMetric(p => p.settlement?.value);

  const adPoints = series.filter(p => typeof p.adSpend?.value === 'number');
  const feedPoints = series.filter(p => typeof p.feed?.value === 'number');
  const searchPoints = series.filter(p => typeof p.search?.value === 'number');
  const settlementPoints = series.filter(p => typeof p.settlement?.value === 'number');

  const preset = resolveDashboardPreset('ad_performance');

  return (
    <DashboardFrame
      preset={preset}
      project={currentProject || undefined}
      subtitle="搜索广告 (S) 与信息流 (F) 投放消耗、CPUV 行业基准对照、核心占位词及人群定向渗透"
    >
      <div className="business-daily" data-testid="ad-performance-dashboard">
        {loading && !view ? (
          <div className="bd-panel">
            <p className="bd-caption">正在加载投流分析数据…</p>
          </div>
        ) : error && !view ? (
          <div className="bd-panel">
            <p className="bd-caption" style={{ color: '#ce2c31' }}>
              加载投流分析看板失败: {String(error)}
            </p>
          </div>
        ) : view ? (
          <>
            {/* 4 Rich KPI Cards */}
            <div className="bd-kpi-grid-rich">
              <article className="bd-kpi-card-rich">
                <div className="bd-kpi-head">
                  <span>平台广告累计消耗</span>
                  <span className="bd-kpi-badge">KFS投流总盘</span>
                </div>
                <div className="bd-kpi-val">{'¥' + formatNum(totalAdSpend)}</div>
                <div className="bd-kpi-sub">
                  {'覆盖 ' + adPoints.length + ' 个有效观测日 / 日均 ¥' + formatNum(totalAdSpend / (adPoints.length || 1))}
                </div>
              </article>

              <article className="bd-kpi-card-rich">
                <div className="bd-kpi-head">
                  <span>信息流 (F) 累计消耗</span>
                  <span className="bd-kpi-badge">聚光信息流</span>
                </div>
                <div className="bd-kpi-val">{'¥' + formatNum(totalFeed)}</div>
                <div className="bd-kpi-sub">
                  {'覆盖 ' + feedPoints.length + ' 个有效观测日 / 占投流总盘 ' + (totalAdSpend > 0 ? ((totalFeed / totalAdSpend) * 100).toFixed(1) + '%' : '—')}
                </div>
              </article>

              <article className="bd-kpi-card-rich">
                <div className="bd-kpi-head">
                  <span>搜索广告 (S) 累计消耗</span>
                  <span className="bd-kpi-badge">搜索词占位</span>
                </div>
                <div className="bd-kpi-val">{'¥' + formatNum(totalSearch)}</div>
                <div className="bd-kpi-sub">
                  {'覆盖 ' + searchPoints.length + ' 个有效观测日 / 占投流总盘 ' + (totalAdSpend > 0 ? ((totalSearch / totalAdSpend) * 100).toFixed(1) + '%' : '—')}
                </div>
              </article>

              <article className="bd-kpi-card-rich">
                <div className="bd-kpi-head">
                  <span>政策后结算金额</span>
                  <span className="bd-kpi-badge">星盟总结算</span>
                </div>
                <div className="bd-kpi-val">{'¥' + formatNum(totalSettlement)}</div>
                <div className="bd-kpi-sub">
                  {view.core?.monthlySettlement?.value
                    ? '月累计结算 ¥' + formatNum(view.core.monthlySettlement.value)
                    : '覆盖 ' + settlementPoints.length + ' 个完整投流核算日'}
                </div>
              </article>
            </div>

            {/* Spend Bars in .bd-panel */}
            <section className="bd-panel" style={{ marginTop: 12 }}>
              <div className="bd-panel-head">
                <div>
                  <h3>投流趋势与每日消耗明细</h3>
                  <p className="bd-caption">覆盖日维度搜索广告与信息流投放支出明细，支持点击查看单日构成</p>
                </div>
              </div>
              <SpendBars view={view} />
            </section>

            {/* Side-by-side .bd-two-col panels for Search vs Feed */}
            <div className="bd-two-col" style={{ marginTop: 12 }}>
              {view.highlights?.search && (
                <section className="bd-panel" data-section="search">
                  <div className="bd-panel-head">
                    <div>
                      <h3>搜索分析 / 成本与基准</h3>
                      <p className="bd-caption">月累计搜索消耗、行业 CPUV 对照及关键词表现</p>
                    </div>
                  </div>
                  <SearchVisuals
                    data={view.highlights.search}
                    hideCoreWords={true}
                    hideTopKeywords={true}
                  />
                </section>
              )}

              {view.highlights?.feed && (
                <section className="bd-panel" data-section="feed">
                  <div className="bd-panel-head">
                    <div>
                      <h3>信息流分析 / 成本与渗透</h3>
                      <p className="bd-caption">小红星与小红盟投流成本对比及回搜效率</p>
                    </div>
                  </div>
                  <FeedVisuals
                    data={view.highlights.feed}
                    hideAudienceRanks={true}
                  />
                </section>
              )}
            </div>

            {/* Search Core Words Full-Width Row */}
            {view.highlights?.search && (
              <section className="bd-panel" data-section="search" style={{ marginTop: 12 }}>
                <div className="bd-panel-head">
                  <div>
                    <h3>搜索核心占位大词与高消耗词</h3>
                    <p className="bd-caption">品类核心词占位表现与高消耗关键词排行，反映搜索拦截效率</p>
                  </div>
                </div>
                <SearchCoreWordsVisuals data={view.highlights.search} />
              </section>
            )}

            {/* Feed Audience Full-Width Row */}
            {view.highlights?.feed && (
              <section className="bd-panel" data-section="feed" style={{ marginTop: 12 }}>
                <div className="bd-panel-head">
                  <div>
                    <h3>信息流人群定向与渗透分析</h3>
                    <p className="bd-caption">小红星 / 小红盟定向人群包月累计 CPUV 分布与竞品人群渗透对比</p>
                  </div>
                </div>
                <FeedAudienceVisuals data={view.highlights.feed} />
              </section>
            )}
          </>
        ) : null}
      </div>
    </DashboardFrame>
  );
}

export default AdsPlaceholder;
