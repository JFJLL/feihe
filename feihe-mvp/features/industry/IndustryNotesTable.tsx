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
      <div style={{ padding: 24, textAlign: 'center', color: '#60646c', background: '#fff', borderRadius: 8, border: '0.5px solid #d9d9e0' }}>
        暂无样本笔记明细。
      </div>
    );
  }

  return (
    <div className="panel" style={{ background: '#fff', borderRadius: 8, border: '0.5px solid #d9d9e0', padding: 16 }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 12px 0', color: '#1c2024' }}>
        高热度样本明细（展示 {notes.length} 条）
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f9f9fb', borderBottom: '0.5px solid #d9d9e0', textAlign: 'left', color: '#60646c' }}>
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
              <tr key={note.id} style={{ borderBottom: '0.5px solid #f0f0f3' }}>
                <td style={{ padding: '10px 12px', maxWidth: 360 }}>
                  <a
                    href={note.noteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0d74ce', textDecoration: 'none', fontWeight: 500 }}
                  >
                    {note.title} ↗
                  </a>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: note.isOurBrand ? '#e6f4fe' : '#f0f0f3',
                      color: note.isOurBrand ? '#0d74ce' : '#60646c',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {note.brand || '未识别'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: '#60646c' }}>
                  {note.bloggerName || '-'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {note.nature === 'commercial' ? (
                    <span style={{ fontSize: '0.75rem', color: '#ab6400', background: '#fff7c2', padding: '1px 5px', borderRadius: 3 }}>商业</span>
                  ) : note.nature === 'natural' ? (
                    <span style={{ fontSize: '0.75rem', color: '#29a383', background: '#e6f7ed', padding: '1px 5px', borderRadius: 3 }}>自然</span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#60646c' }}>-</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1c2024' }}>
                  {note.likedCount !== null ? note.likedCount.toLocaleString() : '-'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1c2024' }}>
                  {note.commentCount !== null ? note.commentCount.toLocaleString() : '-'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#60646c', fontSize: 14 }}>
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
