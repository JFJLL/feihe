import React from 'react';
import { DashboardSection } from '../../components/ui/operations/DashboardSection';
import { MetricCard } from '../../components/ui/operations/MetricCard';
import { HorizontalBarList } from '../overview/OverviewCharts';

type Summary = {
  totalPending: number;
  replyPending: number;
  deletePending: number;
  supplementPending: number;
  observePending: number;
  handledCount: number;
};

export function CommentEfficiencyBoard({
  summary,
  onSelectAction,
}: {
  summary: Summary;
  onSelectAction: (action: string) => void;
}) {
  const actions = [
    { action: 'reply', label: '需回复', amount: summary.replyPending, color: '#1e6091' },
    { action: 'delete', label: '需删除', amount: summary.deletePending, color: '#b0483f' },
    { action: 'supplement', label: '需补充', amount: summary.supplementPending, color: '#a66f22' },
    { action: 'observe', label: '保留观察', amount: summary.observePending, color: '#64748b' },
  ];

  const pendingMatches = actions.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="workspace-two-col" style={{ alignItems: 'stretch' }}>
      <DashboardSection
        eyebrow="ACTION SLA"
        title="待办动作命中分布"
        desc="项目未消失关键评论 + 所选（默认最新）有效判定批次；占比为该动作命中次数 ÷ 四类命中次数之和。一条记录可命中多类。"
      >
        {pendingMatches > 0 ? (
          <HorizontalBarList
            items={actions
              .filter((item) => item.amount > 0)
              .map((item) => ({
                ...item,
                pct: (item.amount / pendingMatches) * 100,
                subText: item.amount.toLocaleString() + ' 次命中',
              }))}
          />
        ) : (
          <div className="empty">当前统计范围内暂无待办动作</div>
        )}
        <div className="workspace-header-actions" style={{ flexWrap: 'wrap', marginTop: 16 }}>
          {actions.map((item) => (
            <button
              type="button"
              className="subtle-btn"
              key={item.action}
              onClick={() => onSelectAction(item.action)}
            >
              筛选{item.label}记录
            </button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          列表按回复、删除、补充、观察顺序为每条记录归类，因此筛选结果数可能少于动作命中次数；保留观察汇总仅含关键评论。
        </p>
      </DashboardSection>

      <DashboardSection
        eyebrow="ACTION SLA"
        title="已处理记录与待办工作量"
        desc="同一项目与判定批次范围，不随列表搜索或状态筛选缩小；已处理按记录计数，待办按动作命中计数。"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', justifyContent: 'space-between' }}>
          {/* 双指标卡紧凑排列，消除单个指标拉伸畸变 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <MetricCard
              theme="green"
              label="已处理记录"
              value={summary.handledCount.toLocaleString()}
              unit="条"
              desc="关键评论记录 + 有效判定记录；同一笔记可对应多条记录"
              tag="处理归档"
            />
            <MetricCard
              theme="blue"
              label="待办动作命中"
              value={pendingMatches.toLocaleString()}
              unit="次"
              desc="需回复/需删除/需补充/保留观察动作命中合计"
              tag="待办总盘"
            />
          </div>

          {/* 状态看板提示卡片 */}
          <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>处置统计与口径约束</div>
            <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
              待办动作共 {pendingMatches.toLocaleString()} 次命中，包含保留观察 {summary.observePending.toLocaleString()} 次。
            </p>
            <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#64748b' }}>
              接口未提供同口径的去重待办总数，暂不计算闭环率。
            </p>
          </div>

          {/* 底部详细口径提示 */}
          <div style={{ padding: '10px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '11.5px', color: '#64748b', lineHeight: 1.5 }}>
            <div>• 已处理按物理记录条数归档，待办按规则动作独立命中计数。</div>
            <div>• 若单篇笔记命中多个不同处置动作，待办状态下分别跟进，处置后统一归入归档池。</div>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
}

