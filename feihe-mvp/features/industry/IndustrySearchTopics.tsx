'use client';

import React from 'react';
import type { IndustrySearchTopic } from '../../lib/industry-types';

export function IndustrySearchTopics({
  topics,
  spu,
}: {
  topics: IndustrySearchTopic[];
  spu: string;
}) {
  if (topics.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#64748b', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        暂无样本标题分析数据。
      </div>
    );
  }

  return (
    <div className="panel" style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 16 }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 12px 0', color: '#0f172a' }}>
        高互动标题参考（「{spu}」检索样本）
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
        {topics.map((t, idx) => (
          <div
            key={idx}
            style={{
              padding: 12,
              borderRadius: 6,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                {t.topic}
              </span>
              <span style={{ fontSize: '0.75rem', background: '#e2e8f0', color: '#475569', padding: '1px 6px', borderRadius: 4 }}>
                {t.intentCategory}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
              <span>样本覆盖: <strong>{t.noteCount}</strong> 篇</span>
              <span>已返回互动项合计: {t.heatIndex !== null ? t.heatIndex.toLocaleString() : '-'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
