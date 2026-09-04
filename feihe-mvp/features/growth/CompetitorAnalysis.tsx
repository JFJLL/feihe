'use client';

import React from 'react';
import type { Dashboard, AnalyticRow } from '../../lib/types/project';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { StatusBadge } from '../../components/ui/operations/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { compact, num, pct } from '../../lib/hooks/use-project-data';

function bestBrand(rows: AnalyticRow[], key: 'positive' | 'negative', inverse = false) {
  const valid = rows.filter((x) => num(x.comments) > 0);
  if (!valid.length) return '暂无足够评论样本。';
  const sorted = [...valid].sort(
    (a, b) => num(b[key]) / num(b.comments) - num(a[key]) / num(a.comments)
  );
  const row = sorted[0];
  return (
    String(row.brand) +
    ' 的' +
    (inverse ? '负向风险' : '正向口碑') +
    '占比最高，为 ' +
    pct(num(row[key]) / num(row.comments)) +
    '。'
  );
}

export function CompetitorAnalysis({ data, onSwitchTab }: { data: Dashboard; onSwitchTab?: (tab: string) => void }) {
  const brands = data.analytics?.brands || [];
  const maxComments = Math.max(1, ...brands.map((x) => num(x.comments)));

  const totalBrandComments = brands.reduce((sum, b) => sum + num(b.comments), 0);
  const totalBrandNotes = brands.reduce((sum, b) => sum + num(b.notes), 0);
  const totalBrandInteractions = brands.reduce((sum, b) => sum + num(b.interactions), 0);
  const leadBrand = brands[0];

  return (
    <div className="stack animate-fade-in">
      {/* 顶部指标卡 */}
      <section className="ops-metric-grid">
        <MetricCard
          theme="blue"
          label="监测品牌总数"
          value={brands.length}
          unit="个"
          desc="覆盖本品与核心竞品"
          tag="竞品大盘"
        />
        <MetricCard
          theme="teal"
          label="竞品横向总声量"
          value={compact(totalBrandComments)}
          unit="条"
          desc="全网评论样本累计"
          tag="声量池"
        />
        <MetricCard
          theme="green"
          label="累计内容样本"
          value={totalBrandNotes.toLocaleString()}
          unit="篇"
          desc="全品牌关联笔记总数"
          tag="内容矩阵"
        />
        <MetricCard
          theme="purple"
          label="总互动量"
          value={compact(totalBrandInteractions)}
          unit="次"
          desc={leadBrand ? '声量领先：' + String(leadBrand.brand) : '互动样本已汇聚'}
          tag="互动格局"
        />
      </section>

      {/* 品牌竞争格局卡片 */}
      <DashboardSection
        eyebrow="BRAND LANDSCAPE"
        title="品牌竞争格局"
        desc="横向对比本品与各核心竞品在评论声量、正向率与风险率的综合表现。"
      >
        {brands.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {brands.slice(0, 6).map((row, index) => {
              const comments = num(row.comments);
              const positive = num(row.positive);
              const negative = num(row.negative);
              const posRate = comments ? Math.round((positive / comments) * 1000) / 10 : 0;
              const negRate = comments ? Math.round((negative / comments) * 1000) / 10 : 0;
              const isOwn = String(row.brand).includes('飞鹤') || String(row.brand).includes('启萃') || String(row.brand).includes('本品');
              return (
                <div
                  key={String(row.brand) + '-' + index}
                  style={{
                    background: '#ffffff',
                    border: isOwn ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: isOwn ? '0 4px 12px rgba(37, 99, 235, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: isOwn ? '#eff6ff' : '#f1f5f9',
                          color: isOwn ? '#1d4ed8' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '13px',
                        }}
                      >
                        {String(row.brand).slice(0, 1)}
                      </span>
                      <strong style={{ fontSize: '15px', color: '#0f172a' }}>{String(row.brand)}</strong>
                    </div>
                    {isOwn ? (
                      <span style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        本品重点
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', background: '#f8fafc', color: '#64748b', padding: '2px 8px', borderRadius: '4px' }}>
                        TOP 0{index + 1}
                      </span>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{compact(comments)}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>评论声量</span>
                    </div>
                    {/* 声量进度条 */}
                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden', marginTop: '6px' }}>
                      <div
                        style={{
                          height: '100%',
                          width: Math.max(6, (comments / maxComments) * 100) + '%',
                          background: isOwn ? 'linear-gradient(90deg, #3b82f6, #1d4ed8)' : '#94a3b8',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', borderTop: '1px dashed #f1f5f9', paddingTop: '10px' }}>
                    <span>{num(row.notes)} 篇笔记</span>
                    <span>{compact(row.interactions)} 互动</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>正向率：</span>
                      <strong style={{ color: '#16a34a' }}>{comments ? posRate + '%' : '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>风险率：</span>
                      <strong style={{ color: negRate > 5 ? '#dc2626' : '#64748b' }}>{comments ? negRate + '%' : '—'}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="暂无竞品数据" text="关键词扫描或添加竞品后将自动生成品牌竞争格局。" />
        )}
      </DashboardSection>

      {/* 品牌横向对比数据明细 */}
      <DashboardSection
        eyebrow="CROSS BRAND COMPARISON"
        title="品牌横向对比明细表"
        desc="多维度拆解品牌内容篇数、评论声量、口碑正负比、阅读与互动效率指标。"
      >
        <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <table className="ops-table">
            <thead>
              <tr>
                <th>品牌 / 关键词</th>
                <th>笔记数</th>
                <th>评论声量</th>
                <th>正向口碑率</th>
                <th>负向风险率</th>
                <th>累计阅读</th>
                <th>累计互动</th>
                <th>预估费用</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((row, index) => {
                const comments = num(row.comments);
                const isOwn = String(row.brand).includes('飞鹤') || String(row.brand).includes('启萃') || String(row.brand).includes('本品');
                return (
                  <tr key={String(row.brand) + '-' + index} style={isOwn ? { background: '#f8fbff' } : undefined}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14px', color: isOwn ? '#1d4ed8' : '#0f172a' }}>{String(row.brand)}</strong>
                        {isOwn && (
                          <StatusBadge status="本品" theme="blue" />
                        )}
                      </div>
                    </td>
                    <td><strong>{num(row.notes)}</strong></td>
                    <td><strong>{compact(comments)}</strong></td>
                    <td>
                      <span style={{ fontWeight: 600, color: comments ? '#16a34a' : '#94a3b8' }}>
                        {comments ? pct(num(row.positive) / comments) : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: comments && (num(row.negative) / comments > 0.05) ? '#dc2626' : '#64748b' }}>
                        {comments ? pct(num(row.negative) / comments) : '—'}
                      </span>
                    </td>
                    <td>{compact(row.reads)}</td>
                    <td><strong>{compact(row.interactions)}</strong></td>
                    <td>{num(row.cost) ? '¥' + compact(row.cost) : '—'}</td>
                  </tr>
                );
              })}
              {!brands.length && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="暂无对比明细" text="导入或扫描竞品数据后在此呈现全维度矩阵。" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      {/* 竞品策略解读与机会洞察 */}
      <DashboardSection
        eyebrow="STRATEGY MAP"
        title="竞品策略解读与机会洞察"
        desc="基于横向声量格局提炼的策略洞察，指导下一步选题流转与机会跟进。"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '16px' }}>🏆</span>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>声量领先格局</strong>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
              {brands[0]
                ? String(brands[0].brand) + ' 当前覆盖 ' + num(brands[0].notes) + ' 篇、' + compact(brands[0].comments) + ' 条评论，处于声量优势位。建议持续关注其高热内容方向。'
                : '扫描竞品关键词后生成声量格局诊断。'}
            </p>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '16px' }}>✨</span>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>口碑优势归属</strong>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
              {bestBrand(brands, 'positive')}
            </p>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>风险与拦截机会</strong>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
              {bestBrand(brands, 'negative', true)}
            </p>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px' }}>🎯</span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>下一步建议动作</strong>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                可下钻同品牌的高热内容切角，结合机会雷达快速沉淀灵感选题。
              </p>
            </div>
            {onSwitchTab && (
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => onSwitchTab('radar')}
                  className="btn-link"
                  style={{ fontSize: '12.5px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                >
                  前往机会雷达追踪关键词 →
                </button>
              </div>
            )}
          </div>
        </div>
      </DashboardSection>
    </div>
  );
}

