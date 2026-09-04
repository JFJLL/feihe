'use client';

import React from 'react';
import type { Dashboard, AnalyticRow } from '../../lib/types/project';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { EmptyState } from '../../components/ui/EmptyState';
import { compact, num, pct } from '../../lib/hooks/use-project-data';

function TrendChart({ data, multi = false }: { data: AnalyticRow[]; multi?: boolean }) {
  if (!data.length) return <EmptyState title="完成至少两轮评论抓取后生成趋势" />;
  const width = 760;
  const height = 220;
  const pad = 28;
  const max = Math.max(1, ...data.map((x) => num(x.total)));
  const points = (key: string) =>
    data
      .map(
        (row, index) =>
          (pad + (index * (width - pad * 2)) / Math.max(1, data.length - 1)) +
          ',' +
          (height - pad - (num(row[key]) / max) * (height - pad * 2))
      )
      .join(' ');

  return (
    <div className="trend-wrap" style={{ background: '#ffffff', borderRadius: '10px', padding: '12px' }}>
      <svg viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label="评论声量趋势">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2e7be7" stopOpacity=".24" />
            <stop offset="1" stopColor="#2e7be7" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <line
            key={v}
            x1={pad}
            x2={width - pad}
            y1={pad + v * (height - pad * 2)}
            y2={pad + v * (height - pad * 2)}
            stroke="#edf1f6"
          />
        ))}
        <polyline
          points={points('total')}
          fill="none"
          stroke="#176be0"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {multi && (
          <>
            <polyline
              points={points('positive')}
              fill="none"
              stroke="#16a34a"
              strokeWidth="2"
            />
            <polyline
              points={points('negative')}
              fill="none"
              stroke="#dc2626"
              strokeWidth="2"
            />
            <polyline
              points={points('question')}
              fill="none"
              stroke="#ea580c"
              strokeWidth="2"
            />
          </>
        )}
      </svg>
      <div className="trend-axis" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
        <span>{String(data[0]?.date || '')}</span>
        <span>{String(data.at(-1)?.date || '')}</span>
      </div>
      <div className="trend-legend" style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '12px', color: '#475569', marginTop: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <i style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#176be0', display: 'inline-block' }} /> 总评论
        </span>
        {multi && (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /> 正向
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} /> 负向
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} /> 问询
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function DistributionBars({
  rows,
  valueKey,
  labelKey,
  empty,
}: {
  rows: AnalyticRow[];
  valueKey: string;
  labelKey: string;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((x) => num(x[valueKey])));
  return (
    <div className="distribution-bars">
      {rows.length ? (
        rows.slice(0, 10).map((row, index) => (
          <div key={String(row[labelKey]) + '-' + index} style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
            <span style={{ width: '90px', fontSize: '12.5px', color: '#334155', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {String(row[labelKey] || '待补充')}
            </span>
            <div style={{ flex: 1, height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: Math.max(3, (num(row[valueKey]) / max) * 100) + '%', height: '100%', background: '#3b82f6', borderRadius: '4px' }} />
            </div>
            <strong style={{ width: '45px', textAlign: 'right', fontSize: '13px', color: '#0f172a' }}>
              {compact(row[valueKey])}
            </strong>
          </div>
        ))
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>{empty}</div>
      )}
    </div>
  );
}

export function VoiceIntelligence({
  data,
  onSwitchTab,
}: {
  data: Dashboard;
  onSwitchTab?: (tab: string) => void;
}) {
  const m = data.metrics;
  const total = Math.max(1, m.commentTotal);
  const topPositive = data.analytics?.topics?.find((x) => x.sentiment === '正向');
  const topNegative = data.analytics?.topics?.find((x) => x.sentiment === '负向');
  const actions = m.actions || {};
  const handledTotal = Math.max(1, num(actions.total));

  return (
    <div className="stack animate-fade-in">
      {/* 顶部指标卡 */}
      <section className="ops-metric-grid">
        <MetricCard
          theme="blue"
          label="正向口碑率"
          value={pct(m.positiveRate)}
          unit=""
          desc="高好评赞誉占比"
          tag="口碑定调"
        />
        <MetricCard
          theme="green"
          label="正向好评评论"
          value={compact(m.positiveCount)}
          unit="条"
          desc="功效、吸收与口感好评"
          tag="正向沉淀"
        />
        <MetricCard
          theme={m.negativeCount > 0 ? 'yellow' : 'teal'}
          label="负向风险评论"
          value={compact(m.negativeCount)}
          unit="条"
          desc="需闭环处置的负面舆情"
          tag="风险监控"
        />
        <MetricCard
          theme="purple"
          label="决策问询评论"
          value={compact(m.questionCount)}
          unit="条"
          desc="段位、转奶与真伪咨询"
          tag="转化契机"
        />
      </section>

      {/* 消费者反馈结构与口碑趋势 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        <DashboardSection
          eyebrow="SENTIMENT COMPOSITION"
          title="消费者反馈情感结构"
          desc="分析评论总体的情感极性分布与正中负问构成。"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', padding: '12px 0' }}>
            <div
              className="donut"
              style={{
                width: '130px',
                height: '130px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'conic-gradient(#16a34a 0 ' +
                  m.positiveRate * 100 +
                  '%,#94a3b8 ' +
                  m.positiveRate * 100 +
                  '% ' +
                  (m.positiveRate + num(m.neutralCount) / total) * 100 +
                  '%,#ea580c ' +
                  (m.positiveRate + num(m.neutralCount) / total) * 100 +
                  '% ' +
                  (m.positiveRate + num(m.neutralCount) / total + m.questionRate) * 100 +
                  '%,#dc2626 0)',
              }}
            >
              <div
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <strong style={{ fontSize: '18px', color: '#0f172a' }}>{pct(m.positiveRate)}</strong>
                <span style={{ fontSize: '11px', color: '#64748b' }}>正向口碑</span>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                ['正向好评', m.positiveCount, '#16a34a', pct(m.positiveRate)],
                ['中立讨论', num(m.neutralCount), '#94a3b8', pct(num(m.neutralCount) / total)],
                ['购买问询', m.questionCount, '#ea580c', pct(m.questionRate)],
                ['负向风险', m.negativeCount, '#dc2626', pct(num(m.negativeCount) / total)],
              ].map(([label, value, color, rate]) => (
                <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                    <i style={{ width: '8px', height: '8px', borderRadius: '50%', background: String(color), display: 'inline-block' }} />
                    {label}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <strong style={{ color: '#0f172a' }}>{compact(value)}</strong>
                    <span style={{ color: '#64748b', fontSize: '11.5px', width: '42px', textAlign: 'right' }}>{rate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DashboardSection>

        <DashboardSection
          eyebrow="VOICE TREND"
          title="口碑趋势动态走势"
          desc="按时间监测正向、负向与问询评论的走势波动。"
        >
          <TrendChart data={data.analytics?.trend || []} multi />
        </DashboardSection>
      </div>

      {/* 动态话题与核心口碑结论 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        <DashboardSection
          eyebrow="TOPIC TAXONOMY"
          title="动态话题分类与分布"
          desc="基于关键词与 NLP 提炼的评论话题聚类。"
        >
          <DistributionBars
            rows={data.analytics?.topics || []}
            valueKey="count"
            labelKey="name"
            empty="暂无关键评论主题分类"
          />
        </DashboardSection>

        <DashboardSection
          eyebrow="VOICE OF CUSTOMER"
          title="口碑核心结论与闭环"
          desc="对高频好评、风险焦点与决策问询的策略性提炼。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', marginBottom: '4px' }}>
                ✓ 核心正向体验
              </div>
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                {topPositive
                  ? '“' + String(topPositive.name) + '”是当前最集中的正向体验，累计共 ' + num(topPositive.count) + ' 条。'
                  : '正向样本持续积累，形成集中正向讨论。'}
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626', marginBottom: '4px' }}>
                ⚠ 问题与风险焦点
              </div>
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                {topNegative
                  ? '“' + String(topNegative.name) + '”为当前首要风险主题，共 ' + num(topNegative.count) + ' 条，需重点处置。'
                  : '当前尚未形成集中的高危负向主题，舆情态势平稳。'}
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#ea580c', marginBottom: '4px' }}>
                💡 购买决策问询
              </div>
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                问询占 {pct(m.questionRate)}，建议按产品适用、使用效果与价格服务分流承接，促成种草拔草。
              </div>
            </div>

            {onSwitchTab && (
              <button
                type="button"
                className="btn-link"
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'center',
                  marginTop: '4px',
                }}
                onClick={() => onSwitchTab('actions')}
              >
                前往处置工作台查看与闭环评论 →
              </button>
            )}
          </div>
        </DashboardSection>
      </div>

      {/* 风险处置闭环 SLA */}
      <DashboardSection
        eyebrow="ACTION SLA"
        title="评论处置与风险闭环进度"
        desc="全盘追踪风险评论的达人回复、删除下架与消失态闭环率。"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>整体闭环率</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>
              {pct(num(actions.handled) / handledTotal)}
            </div>
            <div style={{ fontSize: '11.5px', color: '#15803d' }}>已处置完成比例</div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>已闭环处理</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#16a34a', margin: '4px 0' }}>
              {num(actions.handled)}
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>处理完成条数</div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>待达人回复</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#2563eb', margin: '4px 0' }}>
              {num(actions.replyPending)}
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>引导达人介入</div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>待删除</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626', margin: '4px 0' }}>
              {num(actions.deletePending)}
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>违规/黑产删除</div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>已自然消失</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#64748b', margin: '4px 0' }}>
              {num(actions.disappeared)}
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>博主自删或系统屏蔽</div>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
}

