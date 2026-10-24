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
  const validVals = rows.map((x) => num(x[valueKey])).filter((v): v is number => Number.isFinite(v) && v > 0);
  const max = validVals.length ? Math.max(0, ...validVals) : 0;
  const sum = rows.reduce((s, x) => s + (num(x[valueKey]) || 0), 0) || 1;

  return (
    <div className="distribution-bars">
      {rows.length ? (
        rows.slice(0, 10).map((row, index) => {
          const val = num(row[valueKey]);
          const isPos = Number.isFinite(val) && val > 0;
          const barWidth = isPos && max > 0 ? (val / max) * 100 : 0;
          const pctVal = isPos ? ((val / sum) * 100).toFixed(1) : '0.0';
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
                background: isHovered ? '#e6f4fe' : 'transparent',
                border: isHovered ? '0.5px solid #acd8fc' : '0.5px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  width: '100px',
                  fontSize: 14,
                  color: isHovered ? '#0d74ce' : '#1c2024',
                  fontWeight: isHovered ? 600 : 400,
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
                title={String(row[labelKey])}
              >
                {String(row[labelKey] || '待补充')}
              </span>
              <div style={{ flex: 1, height: '8px', background: '#f0f0f3', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: '100%',
                    background: isHovered ? '#0d74ce' : '#0090ff',
                    borderRadius: '4px',
                    transition: 'width 0.4s ease, background 0.15s ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <strong style={{ width: '45px', textAlign: 'right', fontSize: 14, color: '#1c2024' }}>
                  {compact(val)}
                </strong>
                <span style={{ fontSize: 12, color: isHovered ? '#0d74ce' : '#60646c', width: '40px', textAlign: 'right' }}>
                  {pctVal}%
                </span>
              </div>
            </div>
          );
        })
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: '#60646c', fontSize: 14 }}>{empty}</div>
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
  positive: number | null;
  neutral: number | null;
  question: number | null;
  negative: number | null;
  total: number;
  positiveRate: number | null;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const pos = positive ?? 0;
  const neu = neutral ?? 0;
  const q = question ?? 0;
  const neg = negative ?? 0;
  const items = [
    { label: '正向好评', count: pos, color: '#29a383', pct: total ? (pos / total) * 100 : 0 },
    { label: '中立讨论', count: neu, color: '#60646c', pct: total ? (neu / total) * 100 : 0 },
    { label: '购买问询', count: q, color: '#ffc53d', pct: total ? (q / total) * 100 : 0 },
    { label: '负向风险', count: neg, color: '#ce2c31', pct: total ? (neg / total) * 100 : 0 },
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
          <circle cx={center} cy={center} r={(size - baseStroke) / 2} fill="none" stroke="#f0f0f3" strokeWidth={baseStroke} />
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
              <strong style={{ fontSize: 16, color: activeItem.color, lineHeight: 1.1 }}>
                {activeItem.count}条
              </strong>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1c2024', marginTop: 3 }}>
                {activeItem.label}
              </span>
              <span style={{ fontSize: 12, color: '#60646c' }}>
                {activeItem.pct.toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <strong style={{ fontSize: 16, color: '#1c2024' }}>{total ? pct(positiveRate) : '—'}</strong>
              <span style={{ fontSize: 12, color: '#60646c', marginTop: 2 }}>正向口碑</span>
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
                fontSize: 14,
                padding: '5px 8px',
                borderRadius: '6px',
                background: isHovered ? '#f9f9fb' : 'transparent',
                border: isHovered ? `0.5px solid ${item.color}` : '0.5px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isHovered ? '#1c2024' : '#60646c', fontWeight: isHovered ? 600 : 400 }}>
                <i style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                {item.label}
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <strong style={{ color: '#1c2024' }}>{compact(item.count)}</strong>
                <span style={{ color: isHovered ? item.color : '#60646c', fontSize: 12, width: '45px', textAlign: 'right', fontWeight: isHovered ? 600 : 400 }}>
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
  const total = m.commentTotal;
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
          <div className="reference-kpi-delta">{total ? `基于 ${compact(total)} 条已监测评论` : '暂无监测评论，暂不判断口碑'}</div>
        </article>
        <article className="pastel-card pastel-green reference-kpi">
          <div className="stat-head">
            <span>正向好评评论</span>
            <span className="section-mini-tag tag-green">正向沉淀</span>
          </div>
          <div className="stat-value">{compact(m.positiveCount)}<small> 条</small></div>
          <div className="reference-kpi-meta">已识别为正向的评论</div>
          <div className="reference-kpi-delta">{topPositive ? `主要主题：${String(topPositive.name)}` : '暂无正向主题分类'}</div>
        </article>
        <article className={`pastel-card pastel-${num(m.negativeCount) > 0 ? 'amber' : 'teal'} reference-kpi`}>
          <div className="stat-head">
            <span>负向风险评论</span>
            <span className={`section-mini-tag tag-${num(m.negativeCount) > 0 ? 'orange' : 'teal'}`}>风险监控</span>
          </div>
          <div className="stat-value">{compact(m.negativeCount)}<small> 条</small></div>
          <div className="reference-kpi-meta">需闭环处置的负面舆情</div>
          <div className="reference-kpi-delta">{topNegative ? `重点：${String(topNegative.name)}` : '暂无负向主题分类'}</div>
        </article>
        <article className="pastel-card pastel-purple reference-kpi">
          <div className="stat-head">
            <span>决策问询评论</span>
            <span className="section-mini-tag tag-purple">转化契机</span>
          </div>
          <div className="stat-value">{compact(m.questionCount)}<small> 条</small></div>
          <div className="reference-kpi-meta">已识别为问询的评论</div>
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
          {(data.analytics?.trend || []).length < 3 ? <div className="empty">真实历史快照不足，暂不展示趋势。积累至少 3 个观测日期后显示。</div> : <TimeSeriesChart rows={(data.analytics?.trend || []).map(r=>({...r,date:String(r.date)}))} title="供应商交付登记日度趋势" series={[
            {key:'total',label:'交付量',color:'#0d74ce'}, {key:'positive',label:'正向',color:'#29a383'},
            {key:'negative',label:'负向',color:'#ce2c31'}, {key:'question',label:'问询',color:'#ffc53d'},
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
            <div style={{ background: '#f9f9fb', border: '0.5px solid #d9d9e0', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#29a383', marginBottom: '4px' }}>
                ✓ 核心正向体验
              </div>
              <div style={{ fontSize: 14, color: '#1c2024', lineHeight: 1.5 }}>
                {topPositive
                  ? '“' + String(topPositive.name) + '”是当前最集中的正向体验，累计共 ' + num(topPositive.count) + ' 条。'
                  : '暂无可用的正向主题样本，暂不生成结论。'}
              </div>
            </div>

            <div style={{ background: '#f9f9fb', border: '0.5px solid #d9d9e0', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#ce2c31', marginBottom: '4px' }}>
                ⚠ 问题与风险焦点
              </div>
              <div style={{ fontSize: 14, color: '#1c2024', lineHeight: 1.5 }}>
                {topNegative
                  ? '“' + String(topNegative.name) + '”为当前首要风险主题，共 ' + num(topNegative.count) + ' 条，需重点处置。'
                  : '暂无可用的负向主题样本，不能据此判断风险已消除。'}
              </div>
            </div>

            <div style={{ background: '#f9f9fb', border: '0.5px solid #d9d9e0', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffc53d', marginBottom: '4px' }}>
                💡 购买决策问询
              </div>
              <div style={{ fontSize: 14, color: '#1c2024', lineHeight: 1.5 }}>
                问询占 {pct(m.questionRate)}，建议按产品适用、使用效果与价格服务分流承接，促成种草拔草。
              </div>
            </div>

            {onSwitchTab && (
              <button
                type="button"
                className="btn-link"
                style={{
                  background: '#0090ff',
                  color: '#ffffff',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: 14,
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
            <div style={{ fontSize: '12px', color: '#60646c' }}>整体闭环率</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#1c2024', margin: '4px 0' }}>
              {num(actions.total) > 0 ? pct(num(actions.handled) / handledTotal) : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#208368', fontWeight: 600 }}>已处置完成比例</div>
          </div>
          <div className="pastel-card pastel-green" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#60646c' }}>已闭环处理</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#29a383', margin: '4px 0' }}>
              {num(actions.handled)}
            </div>
            <div style={{ fontSize: 12, color: '#60646c' }}>处理完成条数</div>
          </div>
          <div className="pastel-card pastel-blue" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#60646c' }}>待达人回复</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0090ff', margin: '4px 0' }}>
              {num(actions.replyPending)}
            </div>
            <div style={{ fontSize: 12, color: '#60646c' }}>引导达人介入</div>
          </div>
          <div className="pastel-card pastel-amber" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#60646c' }}>待删除</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#ce2c31', margin: '4px 0' }}>
              {num(actions.deletePending)}
            </div>
            <div style={{ fontSize: 12, color: '#60646c' }}>违规/黑产删除</div>
          </div>
          <div className="pastel-card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#60646c' }}>已自然消失</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#60646c', margin: '4px 0' }}>
              {num(actions.disappeared)}
            </div>
            <div style={{ fontSize: 12, color: '#60646c' }}>博主自删或系统屏蔽</div>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
}
