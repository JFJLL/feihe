'use client';

import React, { useState } from 'react';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import type { Dashboard, AnalyticRow } from '../../lib/types/project';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { compact, num, pct } from '../../lib/hooks/use-project-data';

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
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((x) => num(x[valueKey])));
  const sum = rows.reduce((s, x) => s + num(x[valueKey]), 0) || 1;

  return (
    <div className="distribution-bars">
      {rows.length ? (
        rows.slice(0, 10).map((row, index) => {
          const val = num(row[valueKey]);
          const pctVal = ((val / sum) * 100).toFixed(1);
          const isHovered = hoveredIdx === index;
          return (
            <div
              key={String(row[labelKey]) + '-' + index}
              onMouseEnter={() => setHoveredIdx(index)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 8px',
                borderRadius: '6px',
                background: isHovered ? '#f0f9ff' : 'transparent',
                border: isHovered ? '1px solid #bae6fd' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  width: '100px',
                  fontSize: '12.5px',
                  color: isHovered ? '#0369a1' : '#334155',
                  fontWeight: isHovered ? 600 : 400,
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
                title={String(row[labelKey])}
              >
                {String(row[labelKey] || '待补充')}
              </span>
              <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: Math.max(3, (val / max) * 100) + '%',
                    height: '100%',
                    background: isHovered ? '#0284c7' : '#3b82f6',
                    borderRadius: '4px',
                    transition: 'width 0.4s ease, background 0.15s ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <strong style={{ width: '45px', textAlign: 'right', fontSize: '13px', color: '#0f172a' }}>
                  {compact(val)}
                </strong>
                <span style={{ fontSize: '11px', color: isHovered ? '#0284c7' : '#94a3b8', width: '40px', textAlign: 'right' }}>
                  {pctVal}%
                </span>
              </div>
            </div>
          );
        })
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>{empty}</div>
      )}
    </div>
  );
}

function SentimentDonut({
  positive,
  neutral,
  question,
  negative,
  total,
  positiveRate,
}: {
  positive: number;
  neutral: number;
  question: number;
  negative: number;
  total: number;
  positiveRate: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const items = [
    { label: '正向好评', count: positive, color: '#16a34a', pct: total ? (positive / total) * 100 : 0 },
    { label: '中立讨论', count: neutral, color: '#94a3b8', pct: total ? (neutral / total) * 100 : 0 },
    { label: '购买问询', count: question, color: '#ea580c', pct: total ? (question / total) * 100 : 0 },
    { label: '负向风险', count: negative, color: '#dc2626', pct: total ? (negative / total) * 100 : 0 },
  ];
  const size = 150;
  const baseStroke = 24;
  const center = size / 2;
  const validTotal = Math.max(1, total);

  const slices = items.map((item, idx) => {
    const ratio = item.count / validTotal;
    const prevSum = items.slice(0, idx).reduce((sum, it) => sum + it.count / validTotal, 0);
    const radius = (size - (hoveredIdx === idx ? 28 : baseStroke)) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = `${ratio * circumference} ${circumference}`;
    const strokeDashoffset = -prevSum * circumference;
    return { ...item, strokeDasharray, strokeDashoffset, radius };
  });

  const activeItem = hoveredIdx !== null ? items[hoveredIdx] : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', padding: '8px 0' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          <circle cx={center} cy={center} r={(size - baseStroke) / 2} fill="none" stroke="#f1f5f9" strokeWidth={baseStroke} />
          {slices.map((s, idx) => (
            <circle
              key={idx}
              cx={center}
              cy={center}
              r={s.radius}
              fill="none"
              stroke={s.color}
              strokeWidth={hoveredIdx === idx ? 28 : baseStroke}
              strokeDasharray={s.strokeDasharray}
              strokeDashoffset={s.strokeDashoffset}
              transform={`rotate(-90 ${center} ${center})`}
              style={{
                cursor: 'pointer',
                transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                opacity: hoveredIdx === null || hoveredIdx === idx ? 1 : 0.6,
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            padding: '0 6px',
          }}
        >
          {activeItem ? (
            <>
              <strong style={{ fontSize: '18px', color: activeItem.color, lineHeight: 1.1 }}>
                {activeItem.count}条
              </strong>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', marginTop: 3 }}>
                {activeItem.label}
              </span>
              <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                {activeItem.pct.toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <strong style={{ fontSize: '18px', color: '#0f172a' }}>{total ? pct(positiveRate) : '—'}</strong>
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: 2 }}>正向口碑</span>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map((item, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={item.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12.5px',
                padding: '5px 8px',
                borderRadius: '6px',
                background: isHovered ? '#f8fafc' : 'transparent',
                border: isHovered ? `1px solid ${item.color}` : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isHovered ? '#0f172a' : '#475569', fontWeight: isHovered ? 600 : 400 }}>
                <i style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                {item.label}
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <strong style={{ color: '#0f172a' }}>{compact(item.count)}</strong>
                <span style={{ color: isHovered ? item.color : '#64748b', fontSize: '11.5px', width: '45px', textAlign: 'right', fontWeight: isHovered ? 600 : 400 }}>
                  {item.pct.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
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
      {/* 顶部指标卡 (统一项目总览马卡龙风格) */}
      <div className="reference-daily-grid">
        <article className="pastel-card pastel-blue reference-kpi">
          <div className="stat-head">
            <span>正向口碑率</span>
            <span className="section-mini-tag tag-blue">口碑定调</span>
          </div>
          <div className="stat-value">{m.commentTotal ? pct(m.positiveRate) : '—'}</div>
          <div className="reference-kpi-meta">高好评赞誉占比</div>
          <div className="reference-kpi-delta">正向口碑基调稳定</div>
        </article>
        <article className="pastel-card pastel-green reference-kpi">
          <div className="stat-head">
            <span>正向好评评论</span>
            <span className="section-mini-tag tag-green">正向沉淀</span>
          </div>
          <div className="stat-value">{compact(m.positiveCount)}<small> 条</small></div>
          <div className="reference-kpi-meta">功效、吸收与口感好评</div>
          <div className="reference-kpi-delta">高频词：好吸收、转奶顺</div>
        </article>
        <article className={`pastel-card pastel-${m.negativeCount > 0 ? 'amber' : 'teal'} reference-kpi`}>
          <div className="stat-head">
            <span>负向风险评论</span>
            <span className={`section-mini-tag tag-${m.negativeCount > 0 ? 'orange' : 'teal'}`}>风险监控</span>
          </div>
          <div className="stat-value">{compact(m.negativeCount)}<small> 条</small></div>
          <div className="reference-kpi-meta">需闭环处置的负面舆情</div>
          <div className="reference-kpi-delta">重点：胀气、核销问题</div>
        </article>
        <article className="pastel-card pastel-purple reference-kpi">
          <div className="stat-head">
            <span>决策问询评论</span>
            <span className="section-mini-tag tag-purple">转化契机</span>
          </div>
          <div className="stat-value">{compact(m.questionCount)}<small> 条</small></div>
          <div className="reference-kpi-meta">段位、转奶与真伪咨询</div>
          <div className="reference-kpi-delta">购买前核心决策阻力</div>
        </article>
      </div>

      {/* 消费者反馈结构与口碑趋势 */}
      <div className="workspace-two-col">
        <DashboardSection
          eyebrow="SENTIMENT COMPOSITION"
          title="消费者反馈情感结构"
          desc="分析评论总体的情感极性分布与正中负问构成。鼠标悬停查看各情感占比。"
        >
          <SentimentDonut
            positive={m.positiveCount}
            neutral={num(m.neutralCount)}
            question={m.questionCount}
            negative={m.negativeCount}
            total={total}
            positiveRate={m.positiveRate}
          />
        </DashboardSection>

        <DashboardSection
          eyebrow="VOICE TREND"
          title="口碑趋势动态走势"
          desc="仅显示真实抓取快照；不同日期的监测笔记范围可能不同，数值不是每日新增评论。"
        >
          {(data.analytics?.trend || []).length < 3 ? <div className="empty">真实历史快照不足，暂不展示趋势。积累至少 3 个观测日期后显示。</div> : <TimeSeriesChart rows={(data.analytics?.trend || []).map(r=>({...r,date:String(r.date)}))} title="口碑趋势动态走势" series={[
            {key:'total',label:'总评论',color:'#0284c7'}, {key:'positive',label:'正向',color:'#16a34a'},
            {key:'negative',label:'负向',color:'#dc2626'}, {key:'question',label:'问询',color:'#ea580c'},
          ]} />}
        </DashboardSection>
      </div>

      {/* 动态话题与核心口碑结论 */}
      <div className="workspace-two-col">
        <DashboardSection
          eyebrow="TOPIC TAXONOMY"
          title="动态话题分类与分布"
          desc="基于关键词与 NLP 提炼的评论话题聚类。鼠标悬停查看各分类条数与占比。"
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
          <div className="pastel-card pastel-blue" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>整体闭环率</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
              {pct(num(actions.handled) / handledTotal)}
            </div>
            <div style={{ fontSize: '11.5px', color: '#15803d', fontWeight: 600 }}>已处置完成比例</div>
          </div>
          <div className="pastel-card pastel-green" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>已闭环处理</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a', margin: '4px 0' }}>
              {num(actions.handled)}
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>处理完成条数</div>
          </div>
          <div className="pastel-card pastel-blue" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>待达人回复</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563eb', margin: '4px 0' }}>
              {num(actions.replyPending)}
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>引导达人介入</div>
          </div>
          <div className="pastel-card pastel-amber" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>待删除</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626', margin: '4px 0' }}>
              {num(actions.deletePending)}
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>违规/黑产删除</div>
          </div>
          <div className="pastel-card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>已自然消失</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#64748b', margin: '4px 0' }}>
              {num(actions.disappeared)}
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>博主自删或系统屏蔽</div>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
}
