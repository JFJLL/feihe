'use client';

import React, { useState, useMemo } from 'react';
import type { IndustryV2Report } from '../../lib/industry-v2-types';
import {
  formatMetricNumber,
  PaginationBar,
  EmptyStateBox,
  QueryPillBadge,
} from './IndustryV2Widgets';

export function IndustryV2CreatorsTab({
  report,
}: {
  report: IndustryV2Report;
}) {
  const { creators, config } = report;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);

  // Query lookup map
  const queryMap = useMemo(() => {
    const map = new Map<string, { kind: 'own' | 'category' | 'competitor'; label: string }>();
    for (const q of config.queries || []) {
      map.set(q.id, { kind: q.kind, label: q.label });
    }
    return map;
  }, [config.queries]);

  const topList = creators.top || [];
  const totalPages = Math.max(1, Math.ceil(topList.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedCreators = topList.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const maxTierCount = Math.max(1, ...(creators.tiers || []).map((t) => t.count || 0));

  return (
    <div className="v2-tab-content">
      {/* Summary KPI row */}
      <section className="v2-section" aria-label="创作者概况">
        <div className="v2-grid-3">
          <div className="v2-kpi-card">
            <span className="v2-kpi-label">覆盖创作者总量</span>
            <div className="v2-kpi-value-row">
              <span className="v2-kpi-value">{report.summary.creators}</span>
              <span className="v2-kpi-unit">位</span>
            </div>
            <span className="v2-kpi-subtext">样本涉及的去重创作者数</span>
          </div>
          <div className="v2-kpi-card">
            <span className="v2-kpi-label">多篇发文 / 高频创作者</span>
            <div className="v2-kpi-value-row">
              <span className="v2-kpi-value">{creators.repeatCreators}</span>
              <span className="v2-kpi-unit">位</span>
            </div>
            <span className="v2-kpi-subtext">样本期内发文 ≥ 2 篇的博主</span>
          </div>
          <div className="v2-kpi-card">
            <span className="v2-kpi-label">缺少创作者标识的笔记</span>
            <div className="v2-kpi-value-row">
              <span className="v2-kpi-value">{creators.unknownCreators}</span>
              <span className="v2-kpi-unit">篇</span>
            </div>
            <span className="v2-kpi-subtext">源数据未返回有效创作者唯一 ID</span>
          </div>
        </div>
      </section>

      {/* Tier distribution chart */}
      <section className="v2-section" aria-label="达人层级的内容分布">
        <div className="v2-card">
          <div className="v2-card-header">
            <div>
              <h3 className="v2-card-title">达人层级的内容分布 (笔记篇数)</h3>
              <p className="v2-card-subtitle">
                样本期内各粉丝量级达人发文篇数分布及篇均互动表现。注：此为创作者账号阶梯，非受众画像。
              </p>
            </div>
          </div>

          {!creators.tiers || creators.tiers.length === 0 ? (
            <EmptyStateBox message="暂无创作者量级分布数据。" />
          ) : (
            <div className="v2-dist-list">
              {creators.tiers.map((tier) => {
                const pct = maxTierCount > 0 && tier.count > 0 ? Math.round((tier.count / maxTierCount) * 100) : 0;
                return (
                  <div key={tier.label} className="v2-dist-item static">
                    <div className="v2-dist-item-head">
                      <span className="v2-dist-label">{tier.label}</span>
                      <span className="v2-dist-count">
                        {tier.count} 篇
                        {tier.interactions !== null && tier.interactions !== undefined && (
                          <small> · 总互动 {formatMetricNumber(tier.interactions)}</small>
                        )}
                        {tier.meanInteractions !== null && tier.meanInteractions !== undefined && (
                          <small> · 篇均互动 {Math.round(tier.meanInteractions)}</small>
                        )}
                      </span>
                    </div>
                    <div className="v2-dist-track">
                      <div
                        className="v2-dist-bar v2-bg-teal"
                        style={{ width: `${tier.count > 0 && pct > 0 ? Math.max(3, pct) : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Top Creators Table */}
      <section className="v2-section" aria-label="高互动创作者列表">
        <div className="v2-card">
          <div className="v2-card-header">
            <div>
              <h3 className="v2-card-title">重点创作者互动榜单 (共 {topList.length} 位)</h3>
              <p className="v2-card-subtitle">
                注意：标称报价为对外参考价，非实际商务采买成本；粉丝量依据采集时刻快照。
              </p>
            </div>
          </div>

          {topList.length === 0 ? (
            <EmptyStateBox message="暂无高互动创作者明细。" />
          ) : (
            <>
              <div className="v2-table-wrapper">
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th>创作者名称</th>
                      <th style={{ textAlign: 'right' }}>粉丝量</th>
                      <th style={{ textAlign: 'right' }}>样本发文数</th>
                      <th style={{ textAlign: 'right' }}>样本总互动</th>
                      <th style={{ textAlign: 'right' }}>标称参考报价</th>
                      <th>涉及查询词</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCreators.map((creator) => {
                      let fansDisplay = '-';
                      if (creator.fans !== null && creator.fans !== undefined) {
                        if (creator.fans >= 10000) {
                          fansDisplay = `${(creator.fans / 10000).toFixed(1)}万`;
                        } else {
                          fansDisplay = creator.fans.toLocaleString('zh-CN');
                        }
                      }

                      let priceDisplay = '未公开报价';
                      if (creator.quotedPrice !== null && creator.quotedPrice !== undefined && creator.quotedPrice > 0) {
                        priceDisplay = `¥${creator.quotedPrice.toLocaleString('zh-CN')} (报价)`;
                      }

                      return (
                        <tr key={creator.id || creator.name}>
                          <td>
                            <strong style={{ color: '#0f172a' }}>{creator.name}</strong>
                          </td>
                          <td style={{ textAlign: 'right' }} className="v2-num">
                            {fansDisplay}
                          </td>
                          <td style={{ textAlign: 'right' }} className="v2-num">
                            {creator.notes} 篇
                          </td>
                          <td style={{ textAlign: 'right' }} className="v2-num">
                            {formatMetricNumber(creator.interactions)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span
                              className={`v2-price-tag ${
                                creator.quotedPrice ? 'v2-price-known' : 'v2-price-unknown'
                              }`}
                            >
                              {priceDisplay}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {(creator.queryIds || []).map((qid) => {
                                const q = queryMap.get(qid);
                                if (!q) return null;
                                return (
                                  <QueryPillBadge key={qid} kind={q.kind} label={q.label} />
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <PaginationBar
                total={topList.length}
                page={currentPage}
                pageSize={pageSize}
                onPageChange={(p) => setPage(p)}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(0);
                }}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
