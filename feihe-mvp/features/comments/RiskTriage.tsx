'use client';

import { useState } from 'react';
import Link from '../../components/ui/AppLink';
import type { KeyComment } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
import { cnTime } from '../../lib/hooks/use-project-data';

export function RiskTriage({
  comments,
  resolveComment,
  removeComment,
  projectId,
}: {
  comments: KeyComment[];
  resolveComment: (item: KeyComment, method: string) => void;
  removeComment: (item: KeyComment) => void;
  projectId: string;
}) {
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const rows = comments.filter(
    (x) =>
      (!query || (x.content + x.noteId + x.category).toLowerCase().includes(query.toLowerCase())) &&
      (!action || x.action === action)
  );

  return (
    <section className="panel" id="risk-list">
      <PanelHead
        eyebrow="RISK TRIAGE"
        title="关键评论与风险处置台"
        extra={
          <Link
            className="text-link"
            href={'/api/export?type=comments&projectId=' + encodeURIComponent(projectId)}
          >
            导出关键评论 ↗
          </Link>
        }
      />
      <div className="filterbar">
        <input
          placeholder="搜索评论 / 笔记ID / 分类"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">全部动作</option>
          <option>需达人回复</option>
          <option>需删除</option>
          <option>保留观察</option>
        </select>
        <span>{rows.length} 条结果</span>
      </div>
      <div className="comment-list">
        {rows.length ? (
          rows.map((item) => (
            <article className="comment-row" key={item.id}>
              <div
                className={
                  'sentiment-dot ' +
                  (item.sentiment === '负向'
                    ? 'red'
                    : item.sentiment === '问询'
                    ? 'orange'
                    : 'blue')
                }
              />
              <div className="comment-main">
                <div>
                  <i className="pill">{item.sentiment}</i>
                  <i className="pill gray-pill">{item.category}</i>
                  <span>笔记 {item.noteId}</span>
                </div>
                <p>{item.content}</p>
                <small>
                  {item.author || '未知用户'} · 最近检出 {cnTime(item.lastSeenAt)}
                  {item.disappearedAt ? ' · 已消失' : ''} · 回复 {item.replyCount}
                </small>
              </div>
              <div className="comment-actions">
                <b>{item.action}</b>
                {item.treatmentStatus !== '已处理' ? (
                  <>
                    <button onClick={() => resolveComment(item, '达人回复')}>
                      已回复
                    </button>
                    <button onClick={() => resolveComment(item, '删除')}>
                      已删除
                    </button>
                  </>
                ) : (
                  <span className="done">{item.treatmentMethod || '已处理'}</span>
                )}
                <button className="danger-link" onClick={() => removeComment(item)}>
                  移除记录
                </button>
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="暂无关键评论" text="当前筛选条件下没有待处置的评论记录。" />
        )}
      </div>
    </section>
  );
}
