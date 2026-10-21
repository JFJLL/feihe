'use client';

import React from 'react';
import type { CompetitorComparisonItem } from '../../lib/industry-types';

export function IndustryCompetitorTable({
  items,
}: {
  items: CompetitorComparisonItem[];
  brand: string;
}) {
  if (items.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#64748b', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        暂无竞品样本数据。请在右上角「配置竞品与词包」中添加目标竞品品牌后执行同步。
      </div>
    );
  }

  return (
    <div className="panel" style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 16 }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 12px 0', color: '#0f172a' }}>
        品牌归因与样本表现
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
              <th style={{ padding: '10px 12px' }}>品牌</th>
              <th style={{ padding: '10px 12px' }}>属性</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>样本笔记数</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>已返回互动项合计</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>篇均已返回互动</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>商业合作比例</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.brand}
                style={{
                  borderBottom: '1px solid #f1f5f9',
                  background: item.isOurBrand ? '#f0f9ff' : 'transparent',
                }}
              >
                <td style={{ padding: '10px 12px', fontWeight: item.isOurBrand ? 700 : 500, color: '#0f172a' }}>
                  {item.brand}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {item.isOurBrand ? (
                    <span style={{ fontSize: '0.75rem', background: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>
                      本品
                    </span>
                  ) : item.brand === '未识别品牌' ? (
                    <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: 4 }}>
                      待识别
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: 4 }}>
                      其他品牌
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                  {item.noteCount}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#334155' }}>
                  {item.interactionCount !== null ? item.interactionCount.toLocaleString() : '-'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#334155' }}>
                  {item.avgInteractionPerNote !== null ? item.avgInteractionPerNote.toLocaleString() : '-'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#334155' }}>
                  {item.commercialRatio !== null ? (Math.round(item.commercialRatio * 100) + '%') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
