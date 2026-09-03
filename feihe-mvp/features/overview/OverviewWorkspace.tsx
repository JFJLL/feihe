'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Dashboard, Ops, Project, Plan, Spec } from '../../lib/types/project';
import { PageHeader } from '../../components/ui/PageHeader';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
import { compact, num, cnTime, api, shown } from '../../lib/hooks/use-project-data';

export function OverviewWorkspace({
  projectId,
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
  const [prompt, setPrompt] = useState('复盘8.30供应商评论验收：按200条汇报线和30条达标线判定，输出可汇报清单');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

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
      try { if (typeof onRefresh === 'function') await onRefresh(); } catch(err) { console.warn('refresh error:', err); }
    } catch (e) {
      setFeedback({ text: e instanceof Error ? e.message : '生成失败，请重试', type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const m = dashboard.metrics;
  const a = m.actions || {};
  const s = m.supplier || {};
  const goals = ops.settings.goals;
  const growth = ops.settings.growth;

  const spent = dashboard.pipelines.reduce((sum, row) => sum + num(row.spent), 0);
  const delivered = dashboard.pipelines.reduce((sum, row) => sum + num(row.deliveredCount), 0);
  const budgetTarget = num(goals.budgetTarget) || dashboard.pipelines.reduce((sum, row) => sum + num(row.budget), 0);
  const commentTarget = num(goals.commentTarget) || dashboard.pipelines.reduce((sum, row) => sum + num(row.targetCount), 0);

  const goalCards = [
    {
      label: '项目进度',
      actual: num(goals.workCompleted),
      target: num(goals.workTarget),
      unit: '项',
      note: '项目任务总盘',
    },
    {
      label: '消耗进度',
      actual: spent,
      target: budgetTarget,
      unit: '元',
      note: goals.budgetTarget ? '项目总预算' : '按主线预算合计',
    },
    {
      label: '发布进度',
      actual: num(m.publishedCount),
      target: num(goals.publishTarget),
      unit: '篇',
      note: '已发布笔记',
    },
    {
      label: '评论交付',
      actual: delivered,
      target: commentTarget,
      unit: '条',
      note: goals.commentTarget ? '项目评论总目标' : '按主线目标合计',
    },
  ];

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
      href: '/projects/' + encodeURIComponent(projectId) + '/comments?tab=risk',
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
      desc: '可沉淀为灵感选题或加入投流种子池',
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
    <div className="stack">
      <PageHeader
        eyebrow="PROJECT OVERVIEW"
        title="项目总览"
        subtitle="掌握项目全盘目标、今日待办与关键动作。"
      >
        <Link
          href={'/projects/' + encodeURIComponent(projectId) + '/settings?tab=rules'}
          className="btn-link"
        >
          配置项目总目标 →
        </Link>
      </PageHeader>

      {/* 4 Core Totals Cards */}
      <section className="overview-totals-grid" aria-label="项目总盘指标">
        {goalCards.map((card) => {
          const rate = card.target > 0 ? card.actual / card.target : 0;
          return (
            <article key={card.label} className="overview-total-card">
              <div className="overview-total-card-head">
                <span>{card.label}</span>
                <i>{card.target > 0 ? Math.round(rate * 100) + '%' : '待设置'}</i>
              </div>
              <div className="overview-total-value">
                {card.unit === '元' ? '¥' + compact(card.actual) : compact(card.actual)}
                <small>
                  {' / '}
                  {card.target > 0
                    ? card.unit === '元'
                      ? '¥' + compact(card.target)
                      : compact(card.target) + ' ' + card.unit
                    : '未设置'}
                </small>
              </div>
              <div className="overview-total-track">
                <i style={{ width: Math.min(100, rate * 100) + '%' }} />
              </div>
              <p className="overview-total-note">
                {card.note}
                {card.target > 0 && rate > 1
                  ? ' · 超出 ' + Math.round((rate - 1) * 100) + '%'
                  : card.target > 0
                  ? ' · 尚余 ' + compact(Math.max(0, card.target - card.actual)) + card.unit
                  : ''}
              </p>
            </article>
          );
        })}
      </section>

      {/* Closed-loop Mini Status Bar */}
      <section className="workflow-ribbon" aria-label="项目业务闭环状态">
        <div>
          <small>BUSINESS LOOP</small>
          <strong>业务闭环状态</strong>
        </div>
        <span>
          <i>1</i> 机会: {growth.watchKeywords.length} 词 / {breakoutNotes} 爆文
        </span>
        <span>
          <i>2</i> 内容: {m.noteCount} 篇入库
        </span>
        <span>
          <i>3</i> 评论: {delivered}/{commentTarget} 条
        </span>
        <span className={pendingRisk > 0 ? 'active' : ''}>
          <i>4</i> 风险: {pendingRisk} 待办
        </span>
        <span>
          <i>5</i> 复盘: {ops.reports.length} 份报告
        </span>
      </section>

      {/* AI Agent Intelligent Query & Generation Studio */}
      <section className="overview-agent-composer" aria-label="智能看板生成">
        <div className="overview-agent-composer-header">
          <div>
            <small>REVIEW & REPORT</small>
            <h3>数据复盘与看板生成</h3>
            <p>输入具体日期如8.30，即按验收口径判定当日笔记并输出可汇报清单；其他分析诉求也会自动匹配接口生成 HTML 报告。</p>
          </div>
          <div className="overview-agent-meta">
            <span>已连接接口直通</span>
            <span>模型智能提炼</span>
            <span>导出 HTML 报告</span>
          </div>
        </div>

        <div className="overview-agent-input-row">
          <textarea
            className="overview-agent-textarea"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：复盘8.30供应商评论验收，输出可汇报清单；或分析聚光消耗与灵犀母婴大盘机会..."
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

        {/* Generated Result Container */}
        {spec && (
          <div className="overview-agent-result">
            <div className="overview-agent-result-head">
              <div>
                <span className="result-engine">引擎：{spec.engine}</span>
                <h4>{spec.title}</h4>
                <small>{spec.subtitle} · 周期：{spec.period.start} 至 {spec.period.end}</small>
              </div>
              <div className="overview-agent-result-actions">
                {reportId && (
                  <a
                    href={'/api/report-html?projectId=' + encodeURIComponent(projectId) + '&id=' + encodeURIComponent(reportId)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-link"
                    style={{ background: '#2563eb', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '13px' }}
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
                <div key={k.key} className="overview-agent-kpi-card">
                  <small>{k.label}</small>
                  <strong>{shown(k.value)} <em>{k.unit || ''}</em></strong>
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

      {/* Today's Attention & Next Actions */}
      <div className="overview-sections-split">
        <article className="overview-attention-panel">
          <PanelHead eyebrow="TODAY'S ATTENTION" title="今日关注与风险" />
          {attentionItems.length > 0 ? (
            <div className="attention-items-list">
              {attentionItems.map((item, index) => (
                <div key={index} className={'attention-item ' + item.type}>
                  <div className="attention-item-info">
                    <strong>{item.title}</strong>
                    <p>{item.desc}</p>
                  </div>
                  <Link href={item.href} className="enter-project-btn" style={{ padding: '4px 12px', fontSize: '12px' }}>
                    {item.actionText} →
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="暂无待处理事项" text="当前项目所有风险闭环、供应商核验与发布进度均在预期内。" />
          )}
        </article>

        <article className="overview-actions-panel">
          <PanelHead eyebrow="NEXT ACTIONS" title="下一步建议动作" />
          <div className="action-links-grid">
            <Link
              href={'/projects/' + encodeURIComponent(projectId) + '/comments?tab=risk'}
              className="action-link-card"
            >
              <div>
                <strong>处理风险评论</strong>
                <small>{pendingRisk} 条待闭环评论</small>
              </div>
              <span>→</span>
            </Link>

            <Link
              href={'/projects/' + encodeURIComponent(projectId) + '/comments?tab=supplier'}
              className="action-link-card"
            >
              <div>
                <strong>供应商外显核验</strong>
                <small>{supplierPending} 条待核验记录</small>
              </div>
              <span>→</span>
            </Link>

            <Link
              href={'/projects/' + encodeURIComponent(projectId) + '/growth?tab=radar'}
              className="action-link-card"
            >
              <div>
                <strong>查看增长机会</strong>
                <small>{growth.watchKeywords.length} 个观察关键词</small>
              </div>
              <span>→</span>
            </Link>

            <Link
              href={'/projects/' + encodeURIComponent(projectId) + '/insights?tab=ai'}
              className="action-link-card"
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

      {/* Recent Tasks & Audit Logs */}
      <section className="panel">
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
