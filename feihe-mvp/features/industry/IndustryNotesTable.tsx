'use client';

import React, { useState } from 'react';
import type { IndustryNoteItem } from '../../lib/industry-types';

export function IndustryNotesTable({
  notes,
}: {
  notes: IndustryNoteItem[];
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(notes.length / 10));
  const current = Math.min(page, pageCount - 1);
  if (notes.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#64748b', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        暂无样本笔记明细。
      </div>
    );
  }

  return (
    <div className="panel" style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 16 }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 12px 0', color: '#0f172a' }}>
        高热度样本明细（展示 {notes.length} 条）
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
              <th style={{ padding: '10px 12px' }}>标题 / 链接</th>
              <th style={{ padding: '10px 12px' }}>品牌</th>
              <th style={{ padding: '10px 12px' }}>博主</th>
              <th style={{ padding: '10px 12px' }}>性质</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>点赞</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>评论</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>发布时间</th>
            </tr>
          </thead>
          <tbody>
            {notes.slice(current * 10, current * 10 + 10).map((note) => (
              <tr key={note.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 12px', maxWidth: 360 }}>
                  <a
                    href={note.noteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 500 }}
                  >
                    {note.title} ↗
                  </a>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: note.isOurBrand ? '#e0f2fe' : '#f1f5f9',
                      color: note.isOurBrand ? '#0369a1' : '#475569',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {note.brand || '未识别'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: '#475569' }}>
                  {note.bloggerName || '-'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {note.nature === 'commercial' ? (
                    <span style={{ fontSize: '0.75rem', color: '#b45309', background: '#fef3c7', padding: '1px 5px', borderRadius: 3 }}>商业</span>
                  ) : note.nature === 'natural' ? (
                    <span style={{ fontSize: '0.75rem', color: '#16a34a', background: '#dcfce7', padding: '1px 5px', borderRadius: 3 }}>自然</span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>-</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#334155' }}>
                  {note.likedCount !== null ? note.likedCount.toLocaleString() : '-'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#334155' }}>
                  {note.commentCount !== null ? note.commentCount.toLocaleString() : '-'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontSize: '0.8rem' }}>
                  {note.pubTime || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', marginTop: 14, fontSize: 12 }}>
        <span>第 {current + 1} / {pageCount} 页 · 每页 10 条</span>
        <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>上一页</button>
        <button type="button" disabled={current + 1 >= pageCount} onClick={() => setPage(current + 1)}>下一页</button>
      </div>
    </div>
  );
}
