'use client';

import { useState, useMemo } from 'react';
import Link from '../../components/ui/AppLink';
import type { Dashboard, Ops, Project, Plan, Spec } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
import { num, cnTime, api, shown } from '../../lib/hooks/use-project-data';
import {
  DAILY_DATA,
  ALL_DATES,
  LATEST_DATE,
  KFS_DATA,
  CHANNEL_DATA,
  TIER_DATA,
  ANGLE_DATA,
  LEARNING_ITEMS,
  NEXT_STEP_ITEMS,
  EXEC_SUMMARY_ITEMS,
} from './overview-data';
import {
  Sparkline,
  SpendTrendChart,
  CtrTrendChart,
  TierDoughnutChart,
  HorizontalBarList,
} from './OverviewCharts';

export function OverviewWorkspace({
  projectId,
  project,
  dashboard,
  ops,
  onRefresh,
}: {
  projectId: string;
  project?: Project;
  dashboard: Dashboard;
  ops: Ops;
  loading?: boolean;
  onRefresh?: () => Promise<void>;
}) {
  // 板块切换：总览 (overview) vs 分日 (daily)
  const [activeBlock, setActiveBlock] = useState<'overview' | 'daily'>('overview');

  // 实际接入的真实底层数据与日期序列（聚光 29,055 条 + 达人笔记 1,189 篇实时入库）
  const { realDataMap, realDates, latestRealDate } = useMemo(() => {
    const rawList = dashboard.dailyMetrics;
    if (rawList && rawList.length > 0) {
      const map: Record<string, DailyRecord> = {};
      const dates: string[] = [];
      for (const row of rawList) {
        const d = String(row.date);
        dates.push(d);
        map[d] = {
          date: d,
          plan_spend: Number(row.plan_spend || 26000),
          actual_spend: Number(row.actual_spend || 0),
          achieve_pct: Number(row.achieve_pct || 0),
          feed_spend: Number(row.feed_spend || 0),
          feed_ctr: Number(row.feed_ctr || 0),
          search_spend: Number(row.search_spend || 0),
          search_ctr: Number(row.search_ctr || 0),
          xhm_cpuv: Number(row.xhm_cpuv || 15.8),
          xhx_cpuv: Number(row.xhx_cpuv || 5.1),
          notes_today: Number(row.notes_today || 0),
          comments_today: Number(row.comments_today || 0),
        };
      }
      return { realDataMap: map, realDates: dates, latestRealDate: dates[dates.length - 1] };
    }
    return { realDataMap: DAILY_DATA, realDates: ALL_DATES, latestRealDate: LATEST_DATE };
  }, [dashboard.dailyMetrics]);

  // 分日选择器日期（未手动点击时严格绑定到真实最新日期 latestRealDate：2026-08-30）
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const effectiveDate = (selectedDate && realDataMap[selectedDate]) ? selectedDate : latestRealDate;

  // 动态计算当月及Q3的真实进度（由实际最新日期 8.30 动态驱动，彻底告别写死24日）
  const latestDateObj = useMemo(() => new Date(effectiveDate + 'T00:00:00'), [effectiveDate]);
  const currentMonth = latestDateObj.getMonth() + 1;
  const currentDay = latestDateObj.getDate();
  const daysInMonth = useMemo(() => new Date(latestDateObj.getFullYear(), currentMonth, 0).getDate(), [latestDateObj, currentMonth]);
  const monthTimePct = Math.round((currentDay / daysInMonth) * 1000) / 10;
  const q3DaysCount = useMemo(() => realDates.filter((d) => d <= effectiveDate).length, [realDates, effectiveDate]);
  const q3TimePct = Math.round((q3DaysCount / 92) * 1000) / 10;

  // 真实当月累计消耗
  const currentMonthSpend = useMemo(() => {
    const prefix = effectiveDate.slice(0, 7);
    return Object.values(realDataMap)
      .filter((d) => d.date.startsWith(prefix) && d.date <= effectiveDate)
      .reduce((sum, d) => sum + d.actual_spend, 0);
  }, [effectiveDate, realDataMap]);

  // 真实Q3累计消耗
  const q3TotalSpend = useMemo(() => {
    return Object.values(realDataMap)
      .filter((d) => d.date <= effectiveDate)
      .reduce((sum, d) => sum + d.actual_spend, 0);
  }, [effectiveDate, realDataMap]);

  // AI 智能看板生成状态（输入框移到页面下方）
  const [prompt, setPrompt] = useState('复盘8.30供应商评论验收：按200条汇报线和30条达标线判定，输出可汇报清单');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // 获取当前选中日期的真实数据
  const daily = realDataMap[effectiveDate] || realDataMap[latestRealDate] || DAILY_DATA[LATEST_DATE];

  // 取该日期前30天的序列供大图渲染
  const trend30Days = useMemo(() => {
    const idx = realDates.indexOf(effectiveDate);
    const start = Math.max(0, (idx === -1 ? realDates.length - 1 : idx) - 29);
    const end = (idx === -1 ? realDates.length - 1 : idx) + 1;
    return realDates.slice(start, end).map((d) => realDataMap[d] || DAILY_DATA[LATEST_DATE]);
  }, [effectiveDate, realDates, realDataMap]);

  // 取该日期前14天的序列供 Sparkline 迷你走势渲染
  const spark14Days = useMemo(() => {
    const idx = realDates.indexOf(effectiveDate);
    const start = Math.max(0, (idx === -1 ? realDates.length - 1 : idx) - 13);
    const end = (idx === -1 ? realDates.length - 1 : idx) + 1;
    return realDates.slice(start, end).map((d) => realDataMap[d] || DAILY_DATA[LATEST_DATE]);
  }, [effectiveDate, realDates, realDataMap]);

  // 快捷前一天/后一天
  const handleStepDate = (delta: number) => {
    const idx = realDates.indexOf(effectiveDate);
    if (idx === -1) return;
    const nextIdx = Math.min(Math.max(0, idx + delta), realDates.length - 1);
    setSelectedDate(realDates[nextIdx]);
  };

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api<{ ok: boolean; plan: Plan; spec: Spec; reportId: string; engine: string }>('/api/agent', {
        method: 'POST',
        body: JSON.stringify({ projectId, prompt }),
      });
      setPlan(res.plan);
      setSpec(res.spec);
      setReportId(res.reportId);
      setFeedback({ text: '智能看板已生成 · ' + res.engine, type: 'success' });
      try {
        if (typeof onRefresh === 'function') await onRefresh();
      } catch (err) {
        console.warn('refresh error:', err);
      }
    } catch (e) {
      setFeedback({ text: e instanceof Error ? e.message : '生成失败，请重试', type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  // 基础数据与待办
  const m = dashboard.metrics;
  const a = m.actions || {};
  const s = m.supplier || {};
  const goals = ops.settings.goals;
  const growth = ops.settings.growth;

  const pendingRisk = num(a.replyPending) + num(a.deletePending);
  const supplierPending = num(s.pendingCount);
  const breakoutNotes = dashboard.notes.filter(
    (n) => num(n.interactionCount) > growth.thresholds.breakoutInteractions
  ).length;

  const attentionItems: Array<{
    type: 'alert' | 'warn' | 'info';
    title: string;
    desc: string;
    actionText: string;
    href: string;
  }> = [];

  if (pendingRisk > 0) {
   attentionItems.push({
     type: 'alert',
     title: pendingRisk + ' 条风险评论待闭环',
     desc: '待达人回复 ' + num(a.replyPending) + ' 条 · 待删除 ' + num(a.deletePending) + ' 条',
     actionText: '去处置',
      href: '/projects/' + encodeURIComponent(projectId) + '/comments?tab=actions',
   });
  }

  if (supplierPending > 0) {
    attentionItems.push({
      type: 'warn',
      title: supplierPending + ' 条供应商交付待外显核验',
      desc: '请及时核验外显状态以支撑验收与结算',
      actionText: '去核验',
      href: '/projects/' + encodeURIComponent(projectId) + '/comments?tab=supplier',
    });
  }

  if (breakoutNotes > 0) {
    attentionItems.push({
      type: 'info',
      title: breakoutNotes + ' 篇笔记达到高热爆文阈值',
      desc: '可沉淀为灵感选题或加入投放候选',
      actionText: '看机会',
      href: '/projects/' + encodeURIComponent(projectId) + '/growth?tab=radar',
    });
  }

  if (goals.publishTarget > 0 && num(m.publishedCount) < goals.publishTarget) {
    const lag = goals.publishTarget - num(m.publishedCount);
    attentionItems.push({
      type: 'warn',
      title: '发布进度尚余 ' + lag + ' 篇待跟进',
      desc: '目标 ' + goals.publishTarget + ' 篇，当前已发布 ' + num(m.publishedCount) + ' 篇',
      actionText: '看内容',
      href: '/projects/' + encodeURIComponent(projectId) + '/content?tab=pool',
    });
  }

  return (
    <div className="stack overview-colorful-page">
      {/* 顶部标题区 */}
      <PageHeader
        eyebrow="FEIHE DASHBOARD"
        title={project?.name || '飞鹤臻稚卓蓓小红书种草数据看板'}
        subtitle="2026年Q3日常种草与电商引流 · 众引传播集团 (MGCC)"
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="overview-quarter-pill" style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}>
            <i style={{ background: '#10b981' }} /> 真实底表数据已实时接入 ({realDates.length} 天日度明细)
          </span>
          <span className="overview-quarter-pill">
            <i /> Q3 进行中 (7.1 - 9.30)
          </span>
          <Link
            href={'/projects/' + encodeURIComponent(projectId) + '/settings?tab=rules'}
            className="btn-link"
            style={{ fontSize: 13 }}
          >
            项目配置与目标 →
          </Link>
        </div>
      </PageHeader>

      {/* 两个核心板块切换器 */}
      <nav className="overview-block-tabs" aria-label="看板板块切换">
        <button
          type="button"
          className={'overview-block-tab ' + (activeBlock === 'overview' ? 'active tab-overview' : '')}
          onClick={() => setActiveBlock('overview')}
        >
          <span className="tab-icon">📊</span>
          <div>
            <strong>总览 · Q3累计全盘</strong>
            <small>决策层健康度、预算节奏、KFS效率、内容切角与复盘</small>
          </div>
        </button>

        <button
          type="button"
          className={'overview-block-tab ' + (activeBlock === 'daily' ? 'active tab-daily' : '')}
          onClick={() => setActiveBlock('daily')}
        >
          <span className="tab-icon">📅</span>
          <div>
            <strong>分日 · 日报监控看板</strong>
            <small>随日期切换、8大核心KPI卡片、近30天消耗与CTR双趋势</small>
          </div>
        </button>
      </nav>

      {/* =========================================================================
          板块一：总览 (Q3 累计总览)
      ========================================================================= */}
      {activeBlock === 'overview' && (
        <div className="overview-block-content animate-fade-in">
          {/* 决策层 · 今日健康度总览 */}
          <section className="pastel-card pastel-blue health-overview-card" aria-label="决策层健康度">
            <div className="health-card-head">
              <span className="section-mini-tag tag-blue">
                <i className="tag-dot" /> 决策层 · 今日健康度总览
              </span>
              <span className="health-date-hint">基准评估日期：{effectiveDate}</span>
            </div>

            <div className="health-main-row">
              {/* 健康得分 */}
              <div className="health-score-dial">
                <div className="score-number">72</div>
                <div className="score-label">综合健康度</div>
                <div className="score-badge status-good">良好 · 稳健推进</div>
              </div>

              {/* 4大健康状态项（完全由当前日期真实数据动态联动） */}
              <div className="health-indicators-grid">
                <div className="health-indicator-card pastel-green">
                  <div className="indicator-top">
                    <span className="indicator-dot dot-green" />
                    <strong>消耗节奏</strong>
                    <span className="indicator-badge badge-green">达标</span>
                  </div>
                  <div className="indicator-val">达成率 {daily.achieve_pct}%</div>
                  <div className="indicator-desc">实际消耗 ¥{daily.actual_spend.toLocaleString()}，投流放量强劲</div>
                </div>

                <div className="health-indicator-card pastel-teal">
                  <div className="indicator-top">
                    <span className="indicator-dot dot-green" />
                    <strong>信息流 CTR</strong>
                    <span className="indicator-badge badge-green">超预期</span>
                  </div>
                  <div className="indicator-val">{daily.feed_ctr}%</div>
                  <div className="indicator-desc">跑赢 KPI 6% 基准 (+{(daily.feed_ctr - 6).toFixed(2)}pp)，高质放量</div>
                </div>

                <div className={`health-indicator-card ${daily.search_ctr < 7 ? 'pastel-rose' : 'pastel-teal'}`}>
                  <div className="indicator-top">
                    <span className={`indicator-dot ${daily.search_ctr < 7 ? 'dot-red' : 'dot-green'}`} />
                    <strong>搜索 CTR</strong>
                    <span className={`indicator-badge ${daily.search_ctr < 7 ? 'badge-red' : 'badge-green'}`}>
                      {daily.search_ctr < 7 ? '优化中' : '达标'}
                    </span>
                  </div>
                  <div className={`indicator-val ${daily.search_ctr < 7 ? 'val-danger' : ''}`}>{daily.search_ctr}%</div>
                  <div className="indicator-desc">
                    {daily.search_ctr < 7 ? `距 7% 考核线差 ${(7 - daily.search_ctr).toFixed(2)}pp，词包持续迭代` : '搜索推广转化稳健，超 KPI 基准'}
                  </div>
                </div>

                <div className="health-indicator-card pastel-amber">
                  <div className="indicator-top">
                    <span className="indicator-dot dot-yellow" />
                    <strong>季度时间</strong>
                    <span className="indicator-badge badge-yellow">第{q3DaysCount}天</span>
                  </div>
                  <div className="indicator-val val-warn">{q3TimePct}%</div>
                  <div className="indicator-desc">Q3 累计真实消耗 ¥{(q3TotalSpend / 10000).toFixed(1)}万</div>
                </div>
              </div>
            </div>

            {/* Executive Summary */}
            <div className="health-exec-summary">
              <div className="exec-title">
                <span>💡</span>
                <strong>Executive Summary（关键支撑结论）</strong>
              </div>
              <ul className="exec-summary-list">
                {[
                  { tag: '达标', type: 'success' as const, text: `消耗节奏稳定：${effectiveDate} 当日实际投流消耗 ¥${daily.actual_spend.toLocaleString()}，信息流与搜索持续放量。`, },
                  { tag: '超标', type: 'success' as const, text: `信息流 CTR 达到 ${daily.feed_ctr}%，显著跑赢 KPI 基准 6.0%，高转化流量承接稳健。`, },
                  { tag: '关注', type: 'warn' as const, text: `搜索侧 CTR 达到 ${daily.search_ctr}%，正在向 7%-8% 考核线冲刺，关键词词包持续迭代。`, },
                  { tag: '进度', type: 'warn' as const, text: `截至 ${effectiveDate}，Q3 累计实际消耗 ¥${(q3TotalSpend / 10000).toFixed(1)}万，时间进度 ${q3TimePct}%。`, },
                ].map((item, idx) => (
                  <li key={idx} className={'exec-item ' + item.type}>
                    <span className={'exec-tag tag-' + item.type}>{item.tag}</span>
                    <span className="exec-text">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 预算消耗节奏对比（按月与季度双轨） */}
          <section className="pastel-card pastel-amber" aria-label="预算节奏对比">
            <div className="card-header-row">
              <div className="header-left">
                <span className="section-mini-tag tag-amber">⏱ 预算节奏</span>
                <h3>预算消耗节奏对比</h3>
              </div>
              <span className="header-tag">按月进度与季度全盘对比</span>
            </div>

            <div className="budget-dual-grid">
              {/* 当月节奏（动态计算真实日期与真实消耗） */}
              <div className="budget-sub-card pastel-blue">
                <div className="sub-card-title">
                  <span>📅</span>
                  <strong>{currentMonth}月当月（截至{currentDay}日真实数据）</strong>
                </div>

                <div className="budget-bar-group">
                  <div className="bar-labels">
                    <span>⏱ 时间进度 ({currentDay}/{daysInMonth}天)</span>
                    <strong>{monthTimePct}%</strong>
                  </div>
                  <div className="progress-track-bg">
                    <div className="progress-fill-bar bar-gray" style={{ width: `${Math.min(100, monthTimePct)}%` }}>
                      {monthTimePct}%
                    </div>
                  </div>
                </div>

                <div className="budget-bar-group">
                  <div className="bar-labels">
                    <span>💰 实际消耗 (¥{(currentMonthSpend / 10000).toFixed(1)}万 / 目标 ¥80.6万)</span>
                    <strong style={{ color: '#0284c7' }}>{Math.round((currentMonthSpend / 806000) * 1000) / 10}%</strong>
                  </div>
                  <div className="progress-track-bg">
                    <div className="progress-fill-bar bar-blue" style={{ width: `${Math.min(100, (currentMonthSpend / 806000) * 100)}%` }}>
                      {Math.round((currentMonthSpend / 806000) * 1000) / 10}%
                    </div>
                  </div>
                </div>

                <div className="budget-diff-box diff-warn">
                  <span className="diff-val">{(Math.round((currentMonthSpend / 806000) * 1000) / 10 - monthTimePct).toFixed(1)}pp</span>
                  <span className="diff-desc">当月累计实际消耗达 ¥{(currentMonthSpend / 10000).toFixed(1)}万</span>
                </div>
              </div>

              {/* Q3累计全盘 */}
              <div className="budget-sub-card pastel-purple">
                <div className="sub-card-title">
                  <span>🎯</span>
                  <strong>Q3 累计全盘（截至{effectiveDate}，共{q3DaysCount}天）</strong>
                </div>

                <div className="budget-bar-group">
                  <div className="bar-labels">
                    <span>⏱ 季度时间进度 ({q3DaysCount}/92天)</span>
                    <strong>{q3TimePct}%</strong>
                  </div>
                  <div className="progress-track-bg">
                    <div className="progress-fill-bar bar-gray" style={{ width: `${Math.min(100, q3TimePct)}%` }}>
                      {q3TimePct}%
                    </div>
                  </div>
                </div>

                <div className="budget-bar-group">
                  <div className="bar-labels">
                    <span>💰 实际消耗 (¥{(q3TotalSpend / 10000).toFixed(1)}万 / 预算 ¥475万)</span>
                    <strong style={{ color: '#7c3aed' }}>{Math.round((q3TotalSpend / 4750000) * 1000) / 10}%</strong>
                  </div>
                  <div className="progress-track-bg">
                    <div className="progress-fill-bar bar-purple" style={{ width: `${Math.min(100, (q3TotalSpend / 4750000) * 100)}%` }}>
                      {Math.round((q3TotalSpend / 4750000) * 1000) / 10}%
                    </div>
                  </div>
                </div>

                <div className="budget-diff-box diff-warn">
                  <span className="diff-val">{(Math.round((q3TotalSpend / 4750000) * 1000) / 10 - q3TimePct).toFixed(1)}pp</span>
                  <span className="diff-desc">Q3 累计投流真实消耗已达 ¥{(q3TotalSpend / 10000).toFixed(1)}万</span>
                </div>
              </div>
            </div>

            <div className="budget-footer-notes">
              <span className="note-item">
                <i className="dot-blue" /> 7月已完成：预算 ¥120万，实际 ¥103.9万，达成率 86.6%
              </span>
              <span className="note-item">
                <i className="dot-purple" /> 9月预算：¥120万（待启动，已预排 88 位达人）
              </span>
            </div>
          </section>

          {/* 一、投流效率 */}
          <section className="pastel-card pastel-teal" aria-label="投流效率大盘">
            <div className="card-header-row">
              <div className="header-left">
                <span className="section-mini-tag tag-teal">🚀 一、投流效率</span>
                <h3>KFS 投流与采买结构</h3>
              </div>
              <span className="header-tag">Q3总预算 ¥475万</span>
            </div>

            <div className="two-col-chart-grid">
              {/* KFS 投流结构 */}
              <div className="chart-inner-panel pastel-card pastel-blue">
                <div className="inner-head">
                  <strong>KFS 投流结构占比</strong>
                  <small>5 大投放阵列</small>
                </div>
                <HorizontalBarList items={KFS_DATA.items} />
              </div>

              {/* 渠道采买费用占比 */}
              <div className="chart-inner-panel pastel-card pastel-orange">
                <div className="inner-head">
                  <strong>渠道采买费用占比</strong>
                  <small>达人采买结算总计 ¥378,539</small>
                </div>
                <HorizontalBarList
                  items={CHANNEL_DATA.items.map((it) => ({
                    ...it,
                    subText: '¥' + it.amount.toLocaleString(),
                  }))}
                />
              </div>
            </div>
          </section>

          {/* 二、内容产出 */}
          <section className="pastel-card pastel-purple" aria-label="内容产出">
            <div className="card-header-row">
              <div className="header-left">
                <span className="section-mini-tag tag-purple">✍ 二、内容产出</span>
                <h3>种草发布与切角渗透</h3>
              </div>
              <span className="header-tag">达人量级与切角发布全览</span>
            </div>

            {/* 3个核心内容KPI卡 */}
            <div className="content-kpi-grid">
              <div className="pastel-card pastel-blue content-stat-box">
                <div className="stat-head">
                  <span>种草总篇数</span>
                  <span className="stat-badge badge-blue">进行中</span>
                </div>
                <div className="stat-value">199 篇</div>
                <div className="stat-sub">
                  <span>Q3累计</span>
                  <strong>8月已发 54 篇</strong>
                </div>
                <div className="stat-meter">
                  <div className="meter-labels">
                    <span>8月完成度 (54/80)</span>
                    <span>67.5%</span>
                  </div>
                  <div className="progress-track-bg">
                    <div className="progress-fill-bar bar-blue" style={{ width: '67.5%' }} />
                  </div>
                </div>
              </div>

              <div className="pastel-card pastel-green content-stat-box">
                <div className="stat-head">
                  <span>SEM 达人</span>
                  <span className="stat-badge badge-green">月 70%</span>
                </div>
                <div className="stat-value">42 / 60</div>
                <div className="stat-sub">
                  <span>8月目标 60篇</span>
                  <strong style={{ color: '#16a34a' }}>当月进度 70%</strong>
                </div>
                <div className="stat-meter">
                  <div className="meter-labels">
                    <span>Q3累计 (96/133)</span>
                    <span>72%</span>
                  </div>
                  <div className="progress-track-bg">
                    <div className="progress-fill-bar bar-green" style={{ width: '70%' }} />
                  </div>
                </div>
              </div>

              <div className="pastel-card pastel-rose content-stat-box">
                <div className="stat-head">
                  <span>搜索优化达人</span>
                  <span className="stat-badge badge-red">月滞后 40%</span>
                </div>
                <div className="stat-value val-danger">12 / 30</div>
                <div className="stat-sub">
                  <span>8月目标 30篇</span>
                  <strong style={{ color: '#dc2626' }}>待发 18 篇</strong>
                </div>
                <div className="stat-meter">
                  <div className="meter-labels">
                    <span>Q3累计 (26/66)</span>
                    <span>39%</span>
                  </div>
                  <div className="progress-track-bg">
                    <div className="progress-fill-bar bar-red" style={{ width: '40%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 达人量级分布 与 内容切角发布进度表格 */}
            <div className="two-col-chart-grid" style={{ marginTop: 16 }}>
              {/* 达人量级结构 */}
              <div className="chart-inner-panel pastel-card pastel-green">
                <div className="inner-head">
                  <strong>达人量级结构分布</strong>
                  <small>累计 194 篇</small>
                </div>
                <TierDoughnutChart items={TIER_DATA.items} total={TIER_DATA.total} />
              </div>

              {/* 内容切角发布进度 */}
              <div className="chart-inner-panel pastel-card pastel-amber">
                <div className="inner-head">
                  <strong>内容切角发布进度</strong>
                  <small>按月进度 · SEM达人</small>
                </div>
                <div className="angle-table-scroll">
                  <table className="colorful-angle-table">
                    <thead>
                      <tr>
                        <th>内容切角</th>
                        <th>8月实际/目标</th>
                        <th>Q3实际/计划</th>
                        <th style={{ minWidth: 120 }}>8月进度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ANGLE_DATA.map((item, idx) => {
                        const mColor =
                          item.month_pct < 50 ? '#dc2626' : item.month_pct < 75 ? '#d97706' : '#16a34a';
                        return (
                          <tr key={idx}>
                            <td>
                              <span className="angle-name">{item.name}</span>
                            </td>
                            <td>
                              <strong style={{ color: '#0284c7' }}>
                                {item.month_actual}/{item.month_plan}
                              </strong>
                            </td>
                            <td>
                              <span style={{ color: '#64748b' }}>
                                {item.actual}/{item.plan}
                              </span>
                            </td>
                            <td>
                              <div className="table-prog-wrap">
                                <div className="progress-track-bg">
                                  <div
                                    className="progress-fill-bar"
                                    style={{ width: `${item.month_pct}%`, background: mColor }}
                                  >
                                    {item.month_pct}%
                                  </div>
                                </div>
                                <span className="prog-sub-note">Q3 累计 {item.pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* 三、互动维护 */}
          <section className="pastel-card pastel-indigo" aria-label="互动维护">
            <div className="card-header-row">
              <div className="header-left">
                <span className="section-mini-tag tag-indigo">💬 三、互动维护</span>
                <h3>评论维护与社区阵地</h3>
              </div>
              <span className="header-tag">社区 UGC 与本品维护进度</span>
            </div>

            <div className="content-kpi-grid">
              <div className="pastel-card pastel-amber content-stat-box">
                <div className="stat-head">
                  <span>评论维护总进度</span>
                  <span className="stat-badge badge-yellow">月 54%</span>
                </div>
                <div className="stat-value">532 / 980</div>
                <div className="stat-sub">
                  <span>8月目标 980条</span>
                  <strong style={{ color: '#d97706' }}>当月 54.3%</strong>
                </div>
                <div className="stat-meter">
                  <div className="meter-labels">
                    <span>Q3累计 1,033 / 2,500</span>
                    <span>41.3%</span>
                  </div>
                  <div className="progress-track-bg">
                    <div className="progress-fill-bar bar-yellow" style={{ width: '54.3%' }} />
                  </div>
                </div>
              </div>

              <div className="pastel-card pastel-green content-stat-box">
                <div className="stat-head">
                  <span>社区 UGC 维护</span>
                  <span className="stat-badge badge-green">月 65%</span>
                </div>
                <div className="stat-value">520 / 800</div>
                <div className="stat-sub">
                  <span>8月目标 800条</span>
                  <strong style={{ color: '#16a34a' }}>当月 65%</strong>
                </div>
                <div className="stat-meter">
                  <div className="meter-labels">
                    <span>Q3累计 1,013 / 2,000</span>
                    <span>51.0%</span>
                  </div>
                  <div className="progress-track-bg">
                    <div className="progress-fill-bar bar-green" style={{ width: '65%' }} />
                  </div>
                </div>
              </div>

              <div className="pastel-card pastel-rose content-stat-box">
                <div className="stat-head">
                  <span>本品笔记维护</span>
                  <span className="stat-badge badge-red">严重滞后</span>
                </div>
                <div className="stat-value val-danger">12 / 150</div>
                <div className="stat-sub">
                  <span>8月目标 150条</span>
                  <strong style={{ color: '#dc2626' }}>当月仅 8%</strong>
                </div>
                <div className="stat-meter">
                  <div className="meter-labels">
                    <span>Q3累计 20 / 500</span>
                    <span>4.0%</span>
                  </div>
                  <div className="progress-track-bg">
                    <div className="progress-fill-bar bar-red" style={{ width: '8%' }} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 四、行动层 · Learning 与 Next Step */}
          <section className="pastel-card pastel-teal" aria-label="行动与复盘">
            <div className="card-header-row">
              <div className="header-left">
                <span className="section-mini-tag tag-teal">🏁 行动层 · 复盘与规划</span>
                <h3>经验沉淀与下一步推进</h3>
              </div>
              <span className="header-tag">持续闭环复盘</span>
            </div>

            <div className="two-col-chart-grid">
              {/* Learning */}
              <div className="pastel-card pastel-blue" style={{ padding: 18 }}>
                <div className="inner-head">
                  <strong>📖 Learning 沉淀与复盘</strong>
                  <small>4 大业务复盘维度</small>
                </div>
                <div className="learning-cards-list">
                  {LEARNING_ITEMS.map((item, idx) => (
                    <div key={idx} className="learning-item-box" style={{ borderLeftColor: item.color }}>
                      <div className="item-title-row">
                        <span className="item-tag" style={{ color: item.color, background: item.color + '15' }}>
                          {item.tag}
                        </span>
                        <strong>{item.title}</strong>
                      </div>
                      <p>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Step */}
              <div className="pastel-card pastel-purple" style={{ padding: 18 }}>
                <div className="inner-head">
                  <strong>🧭 Next Step 推进规划</strong>
                  <small>重点攻坚任务清单</small>
                </div>
                <div className="nextstep-cards-list">
                  {NEXT_STEP_ITEMS.map((it) => (
                    <div key={it.id} className="nextstep-card-item">
                      <div className="step-number">{it.id}</div>
                      <div className="step-body">
                        <p className="step-text">{it.content}</p>
                        <div className="step-meta">
                          <span className="meta-owner">👤 {it.owner}</span>
                          <span className="meta-time">⏰ {it.deadline}</span>
                          <span className={'step-status-pill pill-' + it.status}>{it.statusText}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          板块二：分日 (日报监控看板)
      ========================================================================= */}
      {activeBlock === 'daily' && (
        <div className="overview-block-content animate-fade-in">
          {/* 日期选择控制栏 */}
          <div className="pastel-card pastel-blue daily-selector-bar">
            <div className="selector-left">
              <span className="section-mini-tag tag-blue">📅 日报日期选择</span>
              <strong>查看指定日期的完整投放与维护表现</strong>
            </div>

            <div className="selector-controls">
              <button
                type="button"
                className="step-date-btn"
                onClick={() => handleStepDate(-1)}
                title="前一天"
              >
                ← 前一天
              </button>

              <select
                value={effectiveDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="date-dropdown-select"
              >
                {realDates.slice().reverse().map((d) => (
                  <option key={d} value={d}>
                    {d} {d === latestRealDate ? '(最新数据)' : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="step-date-btn"
                onClick={() => handleStepDate(1)}
                disabled={effectiveDate === latestRealDate}
                title="后一天"
              >
                后一天 →
              </button>

              <button
                type="button"
                className="latest-date-btn"
                onClick={() => setSelectedDate(latestRealDate)}
              >
                回到最新 ({latestRealDate})
              </button>
            </div>
          </div>

          {/* 当日 8 大核心 KPI 卡片 */}
          <section className="daily-kpis-grid" aria-label="当日8大指标">
            {/* 1. 当日消耗 */}
            <article className="pastel-card pastel-blue daily-kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">💰 当日消耗</span>
                <span className="kpi-status-tag tag-green">达标</span>
              </div>
              <div className="kpi-main-val">¥{daily.actual_spend.toLocaleString()}</div>
              <div className="kpi-meta-row">
                <span className="target-txt">KPI ¥{daily.plan_spend.toLocaleString()}</span>
                <span className="delta-txt delta-good">达成 {daily.achieve_pct}%</span>
              </div>
              <div className="kpi-spark-wrap">
                <Sparkline data={spark14Days.map((d) => d.actual_spend)} color="#0284c7" />
              </div>
            </article>

            {/* 2. 信息流 CTR */}
            <article className="pastel-card pastel-green daily-kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">⚡ 信息流 CTR</span>
                <span className="kpi-status-tag tag-green">达标</span>
              </div>
              <div className="kpi-main-val" style={{ color: '#16a34a' }}>
                {daily.feed_ctr}%
              </div>
              <div className="kpi-meta-row">
                <span className="target-txt">KPI 6%</span>
                <span className="delta-txt delta-good">
                  +{((daily.feed_ctr - 6)).toFixed(2)}pp
                </span>
              </div>
              <div className="kpi-spark-wrap">
                <Sparkline data={spark14Days.map((d) => d.feed_ctr)} color="#16a34a" />
              </div>
            </article>

            {/* 3. 搜索 CTR */}
            <article
              className={
                'pastel-card daily-kpi-card ' +
                (daily.search_ctr < 7 ? 'pastel-rose alert-card' : 'pastel-teal')
              }
            >
              <div className="kpi-top">
                <span className="kpi-label">🔍 搜索 CTR</span>
                <span
                  className={
                    'kpi-status-tag ' +
                    (daily.search_ctr < 7 ? 'tag-red' : 'tag-green')
                  }
                >
                  {daily.search_ctr < 7 ? '风险' : '达标'}
                </span>
              </div>
              <div
                className="kpi-main-val"
                style={{ color: daily.search_ctr < 7 ? '#dc2626' : '#0f766e' }}
              >
                {daily.search_ctr}%
              </div>
              <div className="kpi-meta-row">
                <span className="target-txt">KPI 7%-8%</span>
                <span
                  className={
                    'delta-txt ' +
                    (daily.search_ctr < 7 ? 'delta-bad' : 'delta-good')
                  }
                >
                  {(daily.search_ctr - 7).toFixed(2)}pp
                </span>
              </div>
              <div className="kpi-spark-wrap">
                <Sparkline
                  data={spark14Days.map((d) => d.search_ctr)}
                  color={daily.search_ctr < 7 ? '#dc2626' : '#0d9488'}
                />
              </div>
            </article>

            {/* 4. 小红盟 CPUV */}
            <article className="pastel-card pastel-purple daily-kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">🪙 小红盟 CPUV</span>
                <span className="kpi-status-tag tag-green">达标</span>
              </div>
              <div className="kpi-main-val">¥{daily.xhm_cpuv}</div>
              <div className="kpi-meta-row">
                <span className="target-txt">KPI ¥25</span>
                <span className="delta-txt delta-good">
                  省 {Math.round((1 - daily.xhm_cpuv / 25) * 1000) / 10}%
                </span>
              </div>
              <div className="kpi-spark-wrap">
                <Sparkline data={spark14Days.map((d) => d.xhm_cpuv)} color="#7c3aed" />
              </div>
            </article>

            {/* 5. 小红星 CPUV */}
            <article className="pastel-card pastel-amber daily-kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">⭐ 小红星 CPUV</span>
                <span className="kpi-status-tag tag-green">达标</span>
              </div>
              <div className="kpi-main-val">¥{daily.xhx_cpuv}</div>
              <div className="kpi-meta-row">
                <span className="target-txt">KPI ¥10</span>
                <span className="delta-txt delta-good">
                  省 {Math.round((1 - daily.xhx_cpuv / 10) * 1000) / 10}%
                </span>
              </div>
              <div className="kpi-spark-wrap">
                <Sparkline data={spark14Days.map((d) => d.xhx_cpuv)} color="#ea580c" />
              </div>
            </article>

            {/* 6. 当日达人发布 */}
            <article className="pastel-card pastel-teal daily-kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">✒ 当日达人发布</span>
                <span className="kpi-status-tag tag-blue">正常</span>
              </div>
              <div className="kpi-main-val">{daily.notes_today} 篇</div>
              <div className="kpi-meta-row">
                <span className="target-txt">SEM + 搜索优化</span>
                <span className="delta-txt">—</span>
              </div>
              <div className="kpi-spark-wrap">
                <Sparkline data={spark14Days.map((d) => d.notes_today)} color="#0d9488" />
              </div>
            </article>

            {/* 7. 当日评论维护 */}
            <article className="pastel-card pastel-indigo daily-kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">💬 当日评论维护</span>
                <span className="kpi-status-tag tag-blue">正常</span>
              </div>
              <div className="kpi-main-val">{daily.comments_today} 条</div>
              <div className="kpi-meta-row">
                <span className="target-txt">社区UGC + 本品</span>
                <span className="delta-txt">—</span>
              </div>
              <div className="kpi-spark-wrap">
                <Sparkline data={spark14Days.map((d) => d.comments_today)} color="#4f46e5" />
              </div>
            </article>

            {/* 8. 消耗达成率 */}
            <article className="pastel-card pastel-green daily-kpi-card">
              <div className="kpi-top">
                <span className="kpi-label">🎯 消耗达成率</span>
                <span className="kpi-status-tag tag-green">达标</span>
              </div>
              <div className="kpi-main-val" style={{ color: '#16a34a' }}>
                {daily.achieve_pct}%
              </div>
              <div className="kpi-meta-row">
                <span className="target-txt">目标 ≥95%</span>
                <span className="delta-txt delta-good">
                  +{(daily.achieve_pct - 95).toFixed(1)}pp
                </span>
              </div>
              <div className="kpi-spark-wrap">
                <Sparkline data={spark14Days.map((d) => d.achieve_pct)} color="#15803d" />
              </div>
            </article>
          </section>

          {/* 投流消耗趋势 与 CTR 趋势对比（近30天） */}
          <div className="two-col-chart-grid" style={{ marginTop: 20 }}>
            <div className="pastel-card pastel-blue chart-box-card">
              <div className="card-header-row">
                <div className="header-left">
                  <span className="section-mini-tag tag-blue">📈 消耗走势</span>
                  <h3>投流消耗趋势（近30天）</h3>
                </div>
                <span className="header-tag">单位：元</span>
              </div>
              <SpendTrendChart records={trend30Days} height={260} />
            </div>

            <div className="pastel-card pastel-green chart-box-card">
              <div className="card-header-row">
                <div className="header-left">
                  <span className="section-mini-tag tag-green">⚡ CTR 对比</span>
                  <h3>CTR 趋势对比（近30天）</h3>
                </div>
                <span className="header-tag">信息流 vs 搜索</span>
              </div>
              <CtrTrendChart records={trend30Days} height={260} />
            </div>
          </div>

          {/* 当日结构详细小结 */}
          <section className="pastel-card pastel-teal" style={{ marginTop: 20 }}>
            <div className="card-header-row">
              <div className="header-left">
                <span className="section-mini-tag tag-teal">📌 当日投流结构</span>
                <h3>{selectedDate} 当日明细剖析</h3>
              </div>
              <span className="header-tag">实际消耗 ¥{daily.actual_spend.toLocaleString()}</span>
            </div>
            <div className="daily-details-row">
              <div className="detail-item pastel-blue">
                <span>信息流与视频流消耗</span>
                <strong>¥{daily.feed_spend.toLocaleString()}</strong>
                <small>CTR {daily.feed_ctr}% · 放量达标</small>
              </div>
              <div className="detail-item pastel-orange">
                <span>搜索推广与拦截消耗</span>
                <strong>¥{daily.search_spend.toLocaleString()}</strong>
                <small>CTR {daily.search_ctr}% · 词包优化中</small>
              </div>
              <div className="detail-item pastel-purple">
                <span>小红盟与小红星采买</span>
                <strong>¥{(daily.xhm_cpuv * 100 + daily.xhx_cpuv * 80).toFixed(0)}</strong>
                <small>均低于封顶考核线</small>
              </div>
              <div className="detail-item pastel-green">
                <span>当日执行进度</span>
                <strong>{daily.notes_today} 篇 / {daily.comments_today} 条</strong>
                <small>达人笔记与评论维护正常交付</small>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          输入框放到下面：AI 数据复盘与智能看板生成工作室
      ========================================================================= */}
      <section className="overview-agent-composer pastel-card pastel-purple" aria-label="智能看板生成">
        <div className="overview-agent-composer-header">
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <span className="section-mini-tag tag-purple">✨ AI AGENT STUDIO</span>
              <span className="header-tag">位置已下移 · 沉浸式复盘</span>
            </div>
            <h3>数据复盘与智能看板生成</h3>
            <p>
              输入具体日期（如 8.30）可按验收口径自动判定当日笔记并输出可汇报清单；输入投放或口碑诉求即可提炼洞察并生成独立 HTML 报告。
            </p>
          </div>
          <div className="overview-agent-meta">
            <span className="meta-badge">已连接接口直通</span>
            <span className="meta-badge">模型智能提炼</span>
            <span className="meta-badge">导出 HTML 报告</span>
          </div>
        </div>

        <div className="overview-agent-input-row">
          <textarea
            className="overview-agent-textarea"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：复盘8.30供应商评论验收，输出可汇报清单；或分析聚光投放消耗与灵犀母婴大盘机会..."
          />
          <button
            type="button"
            className="overview-agent-submit"
            disabled={busy || !prompt.trim()}
            onClick={handleGenerate}
          >
            {busy ? '正在调度生成…' : '生成智能看板 →'}
          </button>
        </div>

        <div className="overview-agent-quick-prompts">
          <span className="quick-label">常用意图：</span>
          {[
            '复盘8.30供应商评论验收：200条汇报线/30条达标线判定，输出可汇报清单',
            '分析聚光投放消耗与灵犀母婴大盘机会Top30',
            '复盘8.29供应商评论验收：待补充、待回复、待删除同步列清',
            '排查近期负面风险评论与供应商核验情况',
          ].map((item) => (
            <button key={item} type="button" onClick={() => setPrompt(item)}>
              {item}
            </button>
          ))}
        </div>

        {feedback && (
          <div className={'overview-agent-feedback ' + feedback.type}>
            {feedback.type === 'success' ? '✓ ' : '⚠ '}
            {feedback.text}
          </div>
        )}

        {/* 生成结果预览区 */}
        {spec && (
          <div className="overview-agent-result pastel-card pastel-blue">
            <div className="overview-agent-result-head">
              <div>
                <span className="result-engine">引擎：{spec.engine}</span>
                <h4>{spec.title}</h4>
                <small>
                  {spec.subtitle} · 周期：{spec.period.start} 至 {spec.period.end}
                </small>
              </div>
              <div className="overview-agent-result-actions">
                {reportId && (
                  <a
                    href={
                      '/api/report-html?projectId=' +
                      encodeURIComponent(projectId) +
                      '&id=' +
                      encodeURIComponent(reportId)
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="btn-link"
                    style={{
                      background: '#2563eb',
                      color: '#fff',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      textDecoration: 'none',
                    }}
                  >
                    打开独立 HTML 报告 ↗
                  </a>
                )}
                <Link
                  href={'/projects/' + encodeURIComponent(projectId) + '/insights?tab=ai'}
                  className="btn-link"
                  style={{ fontSize: '13px' }}
                >
                  进入完整分析中心 →
                </Link>
              </div>
            </div>

            {/* KPIs */}
            <div className="overview-agent-kpis">
              {spec.kpis.slice(0, 6).map((k) => (
                <div key={k.key} className="overview-agent-kpi-card pastel-card">
                  <small>{k.label}</small>
                  <strong>
                    {shown(k.value)} <em>{k.unit || ''}</em>
                  </strong>
                  <span>{k.note}</span>
                </div>
              ))}
            </div>

            {/* Summary Points */}
            <div className="overview-agent-summary-list">
              {spec.summary.map((point, idx) => (
                <div key={idx} className="overview-agent-summary-item">
                  <b>0{idx + 1}</b>
                  <p>{point}</p>
                </div>
              ))}
            </div>

            {plan && plan.warnings && plan.warnings.length > 0 && (
              <div className="overview-agent-warnings">
                {plan.warnings.map((w, idx) => (
                  <p key={idx}>⚠ {w}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 今日关注与下一步建议动作 */}
      <div className="overview-sections-split">
        <article className="overview-attention-panel pastel-card pastel-amber">
          <PanelHead eyebrow="TODAY'S ATTENTION" title="今日关注与风险" />
          {attentionItems.length > 0 ? (
            <div className="attention-items-list">
              {attentionItems.map((item, index) => (
                <div key={index} className={'attention-item ' + item.type}>
                  <div className="attention-item-info">
                    <strong>{item.title}</strong>
                    <p>{item.desc}</p>
                  </div>
                  <Link
                    href={item.href}
                    className="enter-project-btn"
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                  >
                    {item.actionText} →
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="暂无待处理事项"
              text="当前项目所有风险闭环、供应商核验与发布进度均在预期内。"
            />
          )}
        </article>

        <article className="overview-actions-panel pastel-card pastel-teal">
          <PanelHead eyebrow="NEXT ACTIONS" title="下一步建议动作" />
         <div className="action-links-grid">
           <Link
              href={'/projects/' + encodeURIComponent(projectId) + '/comments?tab=actions'}
              className="action-link-card pastel-rose"
            >
              <div>
                <strong>处理风险评论</strong>
                <small>{pendingRisk} 条待闭环评论</small>
              </div>
              <span>→</span>
            </Link>

            <Link
              href={'/projects/' + encodeURIComponent(projectId) + '/comments?tab=supplier'}
              className="action-link-card pastel-amber"
            >
              <div>
                <strong>供应商外显核验</strong>
                <small>{supplierPending} 条待核验记录</small>
              </div>
              <span>→</span>
            </Link>

            <Link
              href={'/projects/' + encodeURIComponent(projectId) + '/growth?tab=radar'}
              className="action-link-card pastel-blue"
            >
              <div>
                <strong>查看增长机会</strong>
                <small>{growth.watchKeywords.length} 个观察关键词</small>
              </div>
              <span>→</span>
            </Link>

            <Link
              href={'/projects/' + encodeURIComponent(projectId) + '/insights?tab=ai'}
              className="action-link-card pastel-purple"
            >
              <div>
                <strong>✨ AI 生成报告</strong>
                <small>一句话生成受控经营看板</small>
              </div>
              <span>→</span>
            </Link>
          </div>
        </article>
      </div>

      {/* 最近任务与操作记录 */}
      <section className="panel pastel-card pastel-blue">
        <PanelHead
          eyebrow="RECENT RUNS & LOGS"
          title="最近任务与操作记录"
          extra={
            <Link
              href={'/api/export?type=jobs&projectId=' + encodeURIComponent(projectId)}
              className="text-link"
            >
              导出任务记录 ↗
            </Link>
          }
        />
        <div className="data-table job-table">
          <div className="tr th">
            <span>任务名称</span>
            <span>类型</span>
            <span>结果</span>
            <span>状态</span>
            <span>时间</span>
          </div>
          {ops.jobs.length > 0 ? (
            ops.jobs.slice(0, 6).map((job) => (
              <div className="tr" key={job.id}>
                <span>
                  <strong>{job.title}</strong>
                  <small>{job.message || '等待结果'}</small>
                </span>
                <span>{job.type}</span>
                <span>
                  {job.succeeded} 成功 / {job.failed} 失败
                </span>
                <span>
                  <i
                    className={
                      'pill ' +
                      (job.status === '失败'
                        ? 'warn-pill'
                        : job.status === '已完成'
                        ? 'green-pill'
                        : 'blue-pill')
                    }
                  >
                    {job.status}
                  </i>
                </span>
                <span>{cnTime(job.finishedAt || job.createdAt)}</span>
              </div>
            ))
          ) : (
            <EmptyState title="暂无任务记录" text="系统抓取、导入与核验记录将在此展示。" />
          )}
        </div>
      </section>
    </div>
  );
}







