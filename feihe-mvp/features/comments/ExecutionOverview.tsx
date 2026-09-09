'use client';

import React from 'react';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { ProgressBar } from '../../components/ui/operations/ProgressBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { TimeSeriesChart } from '../../components/ui/TimeSeriesChart';
import type { Dashboard, Ops } from '../../lib/types/project';
import { num, pct } from '../../lib/hooks/use-project-data';

function ProgressRow({ label, done, total, tone = 'blue', detail }: {
  label: string; done: number; total: number; tone?: React.ComponentProps<typeof ProgressBar>['theme']; detail?: string;
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
      <ProgressBar value={done} max={total || 1} theme={tone} />
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

  const supplierTotal = num(supplier.total) || num(supplier.exactCount) + num(supplier.modifiedCount) + num(supplier.missingCount) + num(supplier.pendingCount);
  const supplierExact = num(supplier.exactCount);
  const supplierModified = num(supplier.modifiedCount);
  const supplierMissing = num(supplier.missingCount);
  const supplierVisible = supplierExact + supplierModified;

  const activeJobs = ops.jobs?.filter(j => j.status === 'running' || j.status === 'pending') || [];
  const completedJobs = ops.jobs?.filter(j => j.status === 'completed') || [];

  // 从笔记快照聚合日执行趋势
  const trendData = (dashboard.analytics?.trend || []).map(r => ({
    date: String(r.date),
    total: num(r.total),
    positive: num(r.positive),
    negative: num(r.negative),
  })).filter(r => r.date);

  // === 评论区执行数据（飞书同步） ===
  const execRows = (dashboard.feishu?.commentExecution || []) as Array<{
    date: string; type: string; textCount: number; emojiCount: number; total: number;
    progress: string; settlement: string; month: string;
  }>;
  const brokenRows = (dashboard.feishu?.commentBroken || []) as Array<{ blogger: string; status: string }>;
  const modifiedRows = (dashboard.feishu?.commentModified || []) as Array<{ blogger: string; internalReview: string }>;

  const hasExecData = execRows.length > 0;

  // 月度汇总
  const monthlyStats = execRows.reduce((acc, r) => {
    const key = r.month || '未知';
    if (!acc[key]) acc[key] = { total: 0, text: 0, emoji: 0, darent: 0, amateur: 0, completed: 0, settled: 0 };
    acc[key].total += r.total || 0;
    acc[key].text += r.textCount || 0;
    acc[key].emoji += r.emojiCount || 0;
    if (r.type?.includes('达人')) acc[key].darent += r.total || 0;
    if (r.type?.includes('素人')) acc[key].amateur += r.total || 0;
    if (r.progress === '已完成') acc[key].completed += r.total || 0;
    if (r.settlement === '已结算') acc[key].settled += r.total || 0;
    return acc;
  }, {} as Record<string, { total: number; text: number; emoji: number; darent: number; amateur: number; completed: number; settled: number }>);

  const totalExec = Object.values(monthlyStats).reduce((s, v) => s + v.total, 0);
  const totalText = Object.values(monthlyStats).reduce((s, v) => s + v.text, 0);
  const totalEmoji = Object.values(monthlyStats).reduce((s, v) => s + v.emoji, 0);
  const totalDarent = Object.values(monthlyStats).reduce((s, v) => s + v.darent, 0);
  const totalAmateur = Object.values(monthlyStats).reduce((s, v) => s + v.amateur, 0);
  const emojiRatio = totalExec > 0 ? pct(totalEmoji / totalExec) : '—';

  // 日执行趋势
  const dailyTrend = execRows.reduce((acc, r) => {
    if (!r.date) return acc;
    const key = r.date;
    if (!acc[key]) acc[key] = { date: key, total: 0, darent: 0, amateur: 0 };
    acc[key].total += r.total || 0;
    if (r.type?.includes('达人')) acc[key].darent += r.total || 0;
    if (r.type?.includes('素人')) acc[key].amateur += r.total || 0;
    return acc;
  }, {} as Record<string, { date: string; total: number; darent: number; amateur: number }>);
  const dailyTrendArr = Object.values(dailyTrend).sort((a, b) => a.date.localeCompare(b.date));

  // 链接失效统计
  const brokenCount = brokenRows.length;
  const brokenApproved = brokenRows.filter(r => r.status === '审核通过').length;
  // 修改评论统计
  const modifiedCount = modifiedRows.length;
  const modifiedReasons = modifiedRows.reduce((acc, r) => {
    const reason = r.internalReview || '未知';
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="stack animate-fade-in">
      {hasExecData && <p className="metric-note">执行量按源表月份区块归属统计；链接失效和修改记录当前仅覆盖7月。缺少完整日期的记录保留在月度统计中，不进入日趋势。</p>}
      {execRows.some(r => !r.date) && <details><summary>查看 {execRows.filter(r => !r.date).length} 条日期待核对记录</summary><div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>归属月份</th><th>原始执行时间</th><th>类型</th><th>数量</th></tr></thead><tbody>{dashboard.feishu?.commentExecution?.filter(r => !r.date).map((r, i) => <tr key={i}><td>{r.month}</td><td>{r.dateLabel || '未填写'}</td><td>{r.type}</td><td>{r.total}</td></tr>)}</tbody></table></div></details>}
      {/* === 评论执行核心 KPI === */}
      {hasExecData && (
        <section className="ops-metric-grid">
          <MetricCard
            theme="blue"
            label="评论执行总量"
            value={totalExec.toLocaleString()}
            unit="条"
            desc={`纯文案 ${totalText.toLocaleString()} · 表情包 ${totalEmoji.toLocaleString()}`}
            tag={`表情包占比 ${emojiRatio}`}
          />
          <MetricCard
            theme="green"
            label="达人评论执行"
            value={totalDarent.toLocaleString()}
            unit="条"
            desc="源表标记为达人评论的执行量"
            tag={`占比 ${totalExec > 0 ? pct(totalDarent / totalExec) : '—'}`}
          />
          <MetricCard
            theme="purple"
            label="素人评论执行"
            value={totalAmateur.toLocaleString()}
            unit="条"
            desc="源表标记为素人评论的执行量"
            tag={`占比 ${totalExec > 0 ? pct(totalAmateur / totalExec) : '—'}`}
          />
          <MetricCard
            theme="yellow"
            label="链接失效 / 需修改"
            value={(brokenCount + modifiedCount).toLocaleString()}
            unit="条"
            desc={`链接失效 ${brokenCount} · 需修改 ${modifiedCount}`}
            tag="质量监控"
          />
        </section>
      )}

      {/* === 月度执行仪表盘 === */}
      {hasExecData && (
        <DashboardSection
          eyebrow="MONTHLY EXECUTION DASHBOARD"
          title="月度执行量仪表盘"
          desc="按月统计评论执行总量、达人/素人构成、纯文案/表情包占比与完成结算进度。"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {Object.entries(monthlyStats).sort(([a], [b]) => a.localeCompare(b, 'zh-CN', { numeric: true })).map(([month, stats]) => {
              const completeRate = stats.total > 0 ? pct(stats.completed / stats.total) : '—';
              const settleRate = stats.total > 0 ? pct(stats.settled / stats.total) : '0%';
              return (
                <div key={month} style={{ padding: '16px 18px', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', borderRadius: 12, border: '1px solid #bae6fd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#0c4a6e' }}>{month}执行统计</span>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#0284c7', color: '#fff', fontWeight: 700 }}>完成率 {completeRate}</span>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#0369a1', marginBottom: 4 }}>{stats.total.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 500, color: '#0369a1', marginLeft: 6 }}>条</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8 }}>
                      <div style={{ fontSize: 10.5, color: '#64748b' }}>达人评论</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{stats.darent.toLocaleString()}</div>
                    </div>
                    <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8 }}>
                      <div style={{ fontSize: 10.5, color: '#64748b' }}>素人评论</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#7c3aed' }}>{stats.amateur.toLocaleString()}</div>
                    </div>
                    <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8 }}>
                      <div style={{ fontSize: 10.5, color: '#64748b' }}>纯文案</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#0f766e' }}>{stats.text.toLocaleString()}</div>
                    </div>
                    <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 8 }}>
                      <div style={{ fontSize: 10.5, color: '#64748b' }}>表情包</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#b45309' }}>{stats.emoji.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <ProgressRow label="完成进度" done={stats.completed} total={stats.total} tone="green" />
                    <ProgressRow label="结算进度" done={stats.settled} total={stats.total} tone="blue" detail={settleRate === '0%' ? '当前均为未结算状态' : undefined} />
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardSection>
      )}

      {/* === 日执行量趋势 + 达人vs素人对比 === */}
      {hasExecData && dailyTrendArr.length >= 3 && (
        <div className="workspace-two-col">
          <DashboardSection
            eyebrow="DAILY EXECUTION TREND"
            title="日执行量趋势图"
            desc="按日展示评论执行数量，区分达人评论与素人评论，识别执行节奏波动。"
          >
            <TimeSeriesChart
              rows={dailyTrendArr}
              title="日执行量趋势"
              unit="条"
              series={[
                { key: 'total', label: '总执行', color: '#1e6091' },
                { key: 'darent', label: '达人评论', color: '#2563eb' },
                { key: 'amateur', label: '素人评论', color: '#7c3aed' },
              ]}
            />
          </DashboardSection>

          <DashboardSection
            eyebrow="DARRENT VS AMATEUR"
            title="达人 vs 素人执行对比"
            desc="对比达人评论与素人评论的执行数量、纯文案占比与表情包占比。"
          >
            <div style={{ padding: '8px 0' }}>
              <ProgressRow label="达人评论执行量" done={totalDarent} total={totalExec} tone="blue" detail={`纯文案为主，占比 ${totalDarent > 0 ? pct(totalDarent / totalExec) : '—'}`} />
              <ProgressRow label="素人评论执行量" done={totalAmateur} total={totalExec} tone="teal" detail={`占比 ${totalAmateur > 0 ? pct(totalAmateur / totalExec) : '—'}`} />
              <div style={{ marginTop: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>执行形式构成</div>
                <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${totalExec > 0 ? (totalText / totalExec) * 100 : 0}%`, background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                    {totalExec > 0 && totalText / totalExec > 0.15 ? `纯文案 ${pct(totalText / totalExec)}` : ''}
                  </div>
                  <div style={{ width: `${totalExec > 0 ? (totalEmoji / totalExec) * 100 : 0}%`, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                    {totalExec > 0 && totalEmoji / totalExec > 0.15 ? `表情包 ${pct(totalEmoji / totalExec)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#64748b' }}>
                  <span>纯文案 {totalText.toLocaleString()} 条</span>
                  <span>表情包 {totalEmoji.toLocaleString()} 条</span>
                </div>
              </div>
            </div>
          </DashboardSection>
        </div>
      )}

      {/* === 执行质量监控 === */}
      {(brokenCount > 0 || modifiedCount > 0) && (
        <DashboardSection
          eyebrow="EXECUTION QUALITY"
          title="执行质量监控"
          desc="监控评论执行过程中的链接失效、内容修改与审核异常。"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div className="pastel-card pastel-red" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: '#991b1b' }}>链接失效评论</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626', margin: '4px 0' }}>{brokenCount}</div>
              <div style={{ fontSize: 11.5, color: '#991b1b' }}>审核通过 {brokenApproved} 条</div>
            </div>
            <div className="pastel-card pastel-amber" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: '#92400e' }}>需修改评论</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#d97706', margin: '4px 0' }}>{modifiedCount}</div>
              <div style={{ fontSize: 11.5, color: '#92400e' }}>内部审核不通过需修改</div>
            </div>
            <div className="pastel-card pastel-blue" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: '#1e40af' }}>7月异常记录数</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb', margin: '4px 0' }}>{brokenCount + modifiedCount}</div>
              <div style={{ fontSize: 11.5, color: '#1e40af' }}>两张异常表的记录合计，未去重，不计算跨月异常率</div>
            </div>
            <div className="pastel-card pastel-teal" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: '#115e59' }}>修改原因分布</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f766e', marginTop: 6 }}>
                {Object.entries(modifiedReasons).sort(([, a], [, b]) => b - a).map(([reason, count]) => (
                  <div key={reason} style={{ marginBottom: 3 }}>{reason}: {count}条</div>
                ))}
              </div>
            </div>
          </div>
        </DashboardSection>
      )}

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
    </div>
  );
}
