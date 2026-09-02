'use client';

import type { Dashboard, Project, Ops, SavedReport } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { LoadingState } from '../../components/ui/LoadingState';
import { compact, cnTime, num, pct, api } from '../../lib/hooks/use-project-data';

export function DynamicReports({
  data,
  project,
  ops,
  projectId,
  onDone,
  toast,
}: {
  data: Dashboard;
  project: Project | null;
  ops: Ops;
  projectId: string;
  onDone: () => Promise<void>;
  toast: (v: string, type?: 'success' | 'error' | 'info') => void;
}) {
  if (!project) {
    return (
      <div className="report-page">
        <LoadingState text="正在获取项目资料以生成复盘…" />
      </div>
    );
  }

  const m = data.metrics;
  const a = m.actions || {};
  const topTopic = data.analytics.topics[0];
  const topBrand = data.analytics.brands[0];

  async function saveReport() {
    if (!project) return;
    try {
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({
          action: 'report_upsert',
          projectId,
          title: project.name + '动态经营复盘',
          status: '草稿',
          summary: { metrics: m, topTopic, topBrand },
        }),
      });
      toast('当前复盘已保存', 'success');
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
    }
  }

  async function deleteReport(id: string) {
    if (!confirm('确认删除保存的复盘？')) return;
    try {
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({ action: 'report_delete', projectId, id }),
      });
      toast('复盘已删除', 'success');
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    }
  }

  async function toggleReport(item: SavedReport) {
    const status = item.status === '已发布' ? '草稿' : '已发布';
    try {
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({
          action: 'report_upsert',
          projectId,
          id: item.id,
          title: item.title,
          status,
          summary: item.summaryJson,
        }),
      });
      toast('复盘已设为' + status, 'success');
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : '更新失败', 'error');
    }
  }

  return (
    <div className="report-page">
      <section className="report-cover">
        <div>
          <small>
            {(project.brand || 'PROJECT').toUpperCase()} · {(project.spu || project.name).toUpperCase()} · DYNAMIC REVIEW
          </small>
          <h2>{project.name}动态经营复盘</h2>
          <p>
            {project.category || '社媒项目'} · 数据更新时间 {cnTime(data.syncedAt)}
          </p>
        </div>
        <div className="report-actions">
          <button onClick={saveReport}>保存本次复盘</button>
          <button className="primary" onClick={() => window.print()}>
            打印 / 导出 PDF
          </button>
        </div>
      </section>

      <section className="report-summary">
        <article>
          <b>01</b>
          <div>
            <h3>整体经营</h3>
            <p>
              覆盖 {m.noteCount} 篇笔记、{m.commentTotal} 条评论；正向率 {pct(m.positiveRate)}，负向率{' '}
              {pct(m.negativeRate)}，问询率 {pct(m.questionRate)}。
            </p>
          </div>
        </article>
        <article>
          <b>02</b>
          <div>
            <h3>内容表现</h3>
            <p>
              累计 {compact(m.readCount)} 阅读、{compact(m.interactionCount)} 互动，互动率{' '}
              {pct(num(m.engagementRate))}；内容指标完整度{' '}
              {pct(
                num(data.analytics.dataQuality.metricCount) /
                  Math.max(1, num(data.analytics.dataQuality.total))
              )}
              。
            </p>
          </div>
        </article>
        <article>
          <b>03</b>
          <div>
            <h3>消费者声音</h3>
            <p>
              {topTopic
                ? '首要讨论主题为“' + String(topTopic.name) + '”，共 ' + num(topTopic.count) + ' 条。'
                : '尚待更多关键评论形成稳定主题。'}{' '}
              当前有 {num(a.replyPending) + num(a.deletePending)} 条风险待办。
            </p>
          </div>
        </article>
        <article>
          <b>04</b>
          <div>
            <h3>本竞品格局</h3>
            <p>
              {topBrand
                ? String(topBrand.brand) +
                  ' 当前声量居前，覆盖 ' +
                  num(topBrand.notes) +
                  ' 篇笔记、' +
                  compact(topBrand.comments) +
                  ' 条评论。'
                : '扫描品牌关键词后形成横向对比。'}
            </p>
          </div>
        </article>
      </section>

      {ops.reports.length > 0 && (
        <section className="panel">
          <PanelHead eyebrow="SAVED REVIEWS" title="已保存复盘" />
          <div className="saved-reports">
            {ops.reports.map((item) => (
              <article key={item.id}>
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {item.status} · {cnTime(item.updatedAt)}
                  </small>
                </span>
                <button onClick={() => toggleReport(item)}>
                  {item.status === '已发布' ? '转为草稿' : '发布'}
                </button>
                <button className="danger-link" onClick={() => deleteReport(item.id)}>
                  删除
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="report-panels">
        <article className="panel">
          <PanelHead eyebrow="ACTION LIST" title="结构化行动清单" />
          <ol className="action-list">
            <li>
              <b>立即执行</b>
              <span>
                闭环 {num(a.replyPending)} 条待回复与 {num(a.deletePending)} 条待删除评论。
              </span>
            </li>
            <li>
              <b>本周</b>
              <span>
                补齐互动指标、内容分类与达人画像缺失字段，提升内容投放分析可信度。
              </span>
            </li>
            <li>
              <b>本月</b>
              <span>以动态话题和竞品高效内容为依据，沉淀下一轮评论话术与选题策略。</span>
            </li>
          </ol>
        </article>
      </section>
    </div>
  );
}
