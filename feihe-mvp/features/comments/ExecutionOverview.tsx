'use client';

import React from 'react';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { ProgressBar } from '../../components/ui/operations/ProgressBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import type { Dashboard, Ops } from '../../lib/types/project';
import { num, pct, compact } from '../../lib/hooks/use-project-data';

function ProgressRow({ label, done, total, tone = 'blue', detail }: {
  label: string; done: number; total: number; tone?: string; detail?: string;
}) {
  const rate = total > 0 ? Math.round((done / total) * 1000) / 10 : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{label}</span>
        <span style={{ fontSize: 12.5, color: '#64748b' }}>
          <strong style={{ color: '#0f172a', fontSize: 14 }}>{done}</strong> / {total}
          <span style={{ marginLeft: 8, color: tone === 'green' ? '#16a34a' : tone === 'red' ? '#dc2626' : '#2563eb', fontWeight: 700 }}>{rate}%</span>
        </span>
      </div>
      <ProgressBar value={done} max={total || 1} theme={tone as any} />
      {detail && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{detail}</div>}
    </div>
  );
}

export function ExecutionOverview({
  dashboard,
  ops,
}: {
  dashboard: Dashboard;
  ops: Ops;
}) {
  const m = dashboard.metrics;
  const actions = m.actions || {};
  const supplier = m.supplier || {};

  const totalActions = num(actions.total);
  const handled = num(actions.handled);
  const replyPending = num(actions.replyPending);
  const deletePending = num(actions.deletePending);
  const disappeared = num(actions.disappeared);
  const closureRate = totalActions > 0 ? pct(handled / totalActions) : '—';

  const supplierTotal = num(supplier.total) || num(supplier.exactCount) + num(supplier.modifiedCount) + num(supplier.missingCount) + num(supplier.pendingCount);
  const supplierExact = num(supplier.exactCount);
  const supplierModified = num(supplier.modifiedCount);
  const supplierMissing = num(supplier.missingCount);
  const supplierVisible = supplierExact + supplierModified;
  const supplierVisibleRate = supplierTotal > 0 ? pct(supplierVisible / supplierTotal) : '—';

  const activeJobs = ops.jobs?.filter(j => j.status === 'running' || j.status === 'pending') || [];
  const completedJobs = ops.jobs?.filter(j => j.status === 'completed') || [];

  // 从笔记快照聚合日执行趋势（评论数变化作为执行量代理指标）
  const trendData = (dashboard.analytics?.trend || []).map(r => ({
    date: String(r.date),
    total: num(r.total),
    positive: num(r.positive),
    negative: num(r.negative),
  })).filter(r => r.date);

  return (
    <div className="stack animate-fade-in">
      {/* 顶部 KPI 卡片 */}
      <section className="ops-metric-grid">
        <MetricCard
          theme="blue"
          label="风险评论总任务"
          value={totalActions.toLocaleString()}
          unit="条"
          desc="纳入闭环管理的关键风险评论总数"
          tag="执行池"
        />
        <MetricCard
          theme="green"
          label="已闭环完成"
          value={handled.toLocaleString()}
          unit="条"
          desc="达人回复、删除下架或自然消失的已处理记录"
          tag={`闭环率 ${closureRate}`}
        />
        <MetricCard
          theme="yellow"
          label="待处置风险"
          value={(replyPending + deletePending).toLocaleString()}
          unit="条"
          desc={`待达人回复 ${replyPending} · 待删除 ${deletePending}`}
          tag="需跟进"
        />
        <MetricCard
          theme="purple"
          label="供应商外显率"
          value={supplierTotal > 0 ? supplierVisibleRate : '—'}
          unit={supplierTotal > 0 ? '' : '待导入'}
          desc={`原文一致 ${supplierExact} · 改写外显 ${supplierModified} · 未外显 ${supplierMissing}`}
          tag={`共 ${supplierTotal} 条交付`}
        />
      </section>

      {/* 完成进度追踪 */}
      <div className="workspace-two-col">
        <DashboardSection
          eyebrow="CLOSURE PROGRESS"
          title="风险评论闭环进度"
          desc="追踪各类处置动作的完成进度，包含达人回复、删除下架与自然消失。"
        >
          <div style={{ padding: '6px 0' }}>
            <ProgressRow
              label="整体闭环率"
              done={handled + disappeared}
              total={totalActions}
              tone="green"
              detail={`已处理 ${handled} 条 + 自然消失 ${disappeared} 条`}
            />
            <ProgressRow
              label="已处理归档"
              done={handled}
              total={totalActions}
              tone="blue"
              detail="达人回复、删除下架等已完成处置的记录"
            />
            <ProgressRow
              label="待处置占比"
              done={replyPending + deletePending}
              total={totalActions}
              tone={replyPending + deletePending > 0 ? 'red' : 'teal'}
              detail={replyPending + deletePending > 0 ? `待回复 ${replyPending} 条 · 待删除 ${deletePending} 条，需加快闭环` : '所有风险评论均已处置或自然消失'}
            />
          </div>
        </DashboardSection>

        <DashboardSection
          eyebrow="SUPPLIER DELIVERY"
          title="供应商交付与外显进度"
          desc="追踪供应商评论交付的外显核验进度，区分原文一致、改写外显与未外显。"
        >
          <div style={{ padding: '6px 0' }}>
            <ProgressRow
              label="整体外显达成率"
              done={supplierVisible}
              total={supplierTotal}
              tone="green"
              detail={`原文一致 ${supplierExact} + 改写外显 ${supplierModified}`}
            />
            <ProgressRow
              label="原文一致外显"
              done={supplierExact}
              total={supplierTotal}
              tone="blue"
              detail="实际抓取与计划内容完全一致，无需修改"
            />
            <ProgressRow
              label="未外显需补发"
              done={supplierMissing}
              total={supplierTotal}
              tone="red"
              detail={supplierMissing > 0 ? `${supplierMissing} 条未在前台检索到，需供应商补发` : '全部交付均已外显'}
            />
          </div>
        </DashboardSection>
      </div>

      {/* 执行质量监控 */}
      <DashboardSection
        eyebrow="QUALITY MONITORING"
        title="执行质量与异常监控"
        desc="监控评论执行过程中的链接失效、内容修改与异常波动。"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div className="pastel-card pastel-red" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#991b1b' }}>未外显 / 链接失效</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626', margin: '4px 0' }}>{supplierMissing}</div>
            <div style={{ fontSize: 11.5, color: '#991b1b' }}>供应商交付未在前台检索到</div>
          </div>
          <div className="pastel-card pastel-amber" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#92400e' }}>有修改外显</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706', margin: '4px 0' }}>{supplierModified}</div>
            <div style={{ fontSize: 11.5, color: '#92400e' }}>执行团队改写后成功外显</div>
          </div>
          <div className="pastel-card pastel-blue" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#1e40af' }}>待核验评论</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb', margin: '4px 0' }}>{num(supplier.pendingCount)}</div>
            <div style={{ fontSize: 11.5, color: '#1e40af' }}>新导入等待下一轮核验比对</div>
          </div>
          <div className="pastel-card pastel-teal" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#115e59' }}>进行中任务</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0d9488', margin: '4px 0' }}>{activeJobs.length}</div>
            <div style={{ fontSize: 11.5, color: '#115e59' }}>采集 / 核验 / 导入等异步任务</div>
          </div>
        </div>
        {activeJobs.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeJobs.slice(0, 3).map(job => (
              <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#f0fdfa', borderRadius: 8, border: '1px solid #99f6e4' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0f766e', minWidth: 100 }}>{job.title}</span>
                <ProgressBar value={job.progress} max={job.total || 100} theme="teal" />
                <span style={{ fontSize: 11.5, color: '#0f766e', whiteSpace: 'nowrap' }}>{job.progress}/{job.total}</span>
              </div>
            ))}
          </div>
        )}
      </DashboardSection>

      {/* 日执行量趋势 */}
      <div className="workspace-two-col">
        <DashboardSection
          eyebrow="DAILY EXECUTION TREND"
          title="评论监测日度趋势"
          desc="基于真实抓取快照的评论总量与情感构成趋势。不同日期监测笔记范围可能不同。"
        >
          {trendData.length >= 3 ? (
            <TimeSeriesChart
              rows={trendData}
              title="评论监测日度趋势"
              unit="条"
              series={[
                { key: 'total', label: '总评论', color: '#1e6091' },
                { key: 'positive', label: '正向', color: '#16a34a' },
                { key: 'negative', label: '负向', color: '#dc2626' },
              ]}
            />
          ) : (
            <EmptyState title="历史快照不足" text="积累至少 3 个观测日期后展示评论监测趋势。当前可通过采集监测页抓取更多快照。" />
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="EXECUTION PIPELINE"
          title="执行管线与任务统计"
          desc="系统异步任务的执行统计，包含采集、核验、导入等操作。"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: '#f0f9ff', padding: '12px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11.5, color: '#0369a1' }}>已完成任务</div>
                <strong style={{ fontSize: 22, color: '#075985' }}>{completedJobs.length}</strong>
              </div>
              <div style={{ background: '#fefce8', padding: '12px', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 11.5, color: '#a16207' }}>进行中任务</div>
                <strong style={{ fontSize: 22, color: '#854d0e' }}>{activeJobs.length}</strong>
              </div>
            </div>
            {ops.jobs && ops.jobs.length > 0 ? (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {[...ops.jobs].reverse().slice(0, 8).map(job => (
                  <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                    <span style={{ color: '#334155', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{job.title}</span>
                    <span style={{
                      fontSize: 10.5,
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 600,
                      background: job.status === 'completed' ? '#f0fdf4' : job.status === 'running' ? '#f0f9ff' : '#fef2f2',
                      color: job.status === 'completed' ? '#15803d' : job.status === 'running' ? '#0369a1' : '#b91c1c',
                    }}>{job.status === 'completed' ? '已完成' : job.status === 'running' ? '进行中' : job.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: '#94a3b8', textAlign: 'center', padding: 16 }}>暂无异步任务记录</div>
            )}
          </div>
        </DashboardSection>
      </div>

      {/* 数据接入说明 */}
      <DashboardSection
        eyebrow="DATA INTEGRATION NOTE"
        title="执行数据接入说明"
        desc="以下看板维度待接入「评论区执行文档」飞书表格后可自动填充。"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { title: '月度执行量仪表盘', desc: '按月统计评论发布、达人回复、删除处置的执行总量与目标达成率', status: '待接入' },
            { title: '日执行量趋势', desc: '按日追踪执行团队的评论发布量、回复量与删引量，识别执行节奏波动', status: '待接入' },
            { title: '完成进度甘特图', desc: '按执行批次或项目阶段展示任务起止时间与完成进度的甘特视图', status: '待接入' },
            { title: '链接失效量趋势', desc: '追踪已发布评论的链接失效/被屏蔽数量随时间的变化趋势', status: '待接入' },
            { title: '达人 vs 素人对比', desc: '对比达人评论与素人评论在外显率、互动量、转化效果上的差异', status: '待接入' },
            { title: '表情包占比趋势', desc: '监控评论中表情包/纯表情评论的占比变化，评估内容质量', status: '待接入' },
          ].map(item => (
            <div key={item.title} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{item.title}</span>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>{item.status}</span>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: '#64748b', lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </DashboardSection>
    </div>
  );
}
