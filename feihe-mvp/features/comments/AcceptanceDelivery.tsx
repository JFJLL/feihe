'use client';

import Link from '../../components/ui/AppLink';
import type { Dashboard, Acceptance } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { pct } from '../../lib/hooks/use-project-data';

function StatusCard({
  value,
  title,
  note,
  cls,
}: {
  value: number;
  title: string;
  note: string;
  cls: string;
}) {
  return (
    <article className={'status-card ' + cls}>
      <b>{value}</b>
      <span>{title}</span>
      <small>{note}</small>
    </article>
  );
}

export function AcceptanceDelivery({
  data,
  acceptance,
  projectId,
}: {
  data: Dashboard;
  acceptance: Acceptance;
  projectId: string;
}) {
  const status = {
    report: data.notes.filter((n) => n.status === '符合且能汇报').length,
    base: data.notes.filter((n) => n.status === '符合基础要求').length,
    fill: data.notes.filter((n) => n.status.includes('补充')).length,
  };

  return (
    <div className="stack">
      <section className="status-grid">
        <StatusCard
          value={status.report}
          title="符合且能汇报"
          note={'≥' + acceptance.reportCount + '条且前排提及率≥' + pct(acceptance.brandTopRate)}
          cls="good"
        />
        <StatusCard
          value={status.base}
          title="符合基础要求"
          note={'有效评论达到 ' + acceptance.baseCount + ' 条'}
          cls="base"
        />
        <StatusCard
          value={status.fill}
          title="需补充"
          note={'不足 ' + acceptance.baseCount + ' 条，进入补量'}
          cls="warn"
        />
        <StatusCard
          value={Number(data.metrics.actions.replyPending || 0)}
          title="需达人回复"
          note="问询和轻负面优先闭环"
          cls="danger-card"
        />
      </section>

      <section className="panel">
        <PanelHead
          eyebrow="DELIVERY"
          title="三条主线交付与费用"
          extra={
            <Link
              className="text-link"
              href={'/api/export?type=jobs&projectId=' + encodeURIComponent(projectId)}
            >
              导出任务记录 ↗
            </Link>
          }
        />
        <div className="data-table">
          <div className="tr th">
            <span>主线</span>
            <span>评论进度</span>
            <span>费用进度</span>
            <span>剩余</span>
            <span>状态</span>
          </div>
          {data.pipelines.map((p) => (
            <div className="tr" key={p.id}>
              <strong>{p.name}</strong>
              <span>
                {p.deliveredCount} / {p.targetCount}
              </span>
              <span>
                ¥{p.spent.toLocaleString()} / ¥{p.budget.toLocaleString()}
              </span>
              <span>{Math.max(0, p.targetCount - p.deliveredCount)} 条</span>
              <span>
                <i className="pill blue-pill">
                  {p.deliveredCount >= p.targetCount ? '已完成' : '执行中'}
                </i>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
