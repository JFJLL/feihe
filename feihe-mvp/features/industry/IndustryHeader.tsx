'use client';

import React from 'react';
import type { IndustryProjectConfig, IndustrySnapshot } from '../../lib/industry-types';

export function IndustryHeader({
  projectName,
  spu,
  brand,
  category,
  config,
  snapshot,
  syncing,
  liveVerified,
  canWrite = false,
  onTriggerSync,
  onOpenConfig,
}: {
  projectId: string;
  projectName: string;
  spu: string;
  brand: string;
  category: string;
  config: IndustryProjectConfig | null;
  snapshot: IndustrySnapshot | null;
  syncing: boolean;
  liveVerified: boolean;
  canWrite?: boolean;
  onTriggerSync: () => Promise<void>;
  onOpenConfig: () => void;
}) {
  const lastSyncText = config?.lastSyncedAt
    ? new Date(config.lastSyncedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    : '尚未同步';

  const healthy = Boolean(liveVerified && snapshot?.status === 'ready' && snapshot.spu === spu && !config?.lastError);
  const dotClass = !spu ? 'error' : healthy ? 'ready' : 'warning';

  return (
    <div className="comp-status-banner" style={{ marginBottom: 16 }}>
      <div className="comp-status-left">
        <span
          className={'comp-pulse-dot ' + dotClass}
          title={!spu ? '缺少 SPU' : healthy ? '真实数据已更新' : '待更新或上次更新失败'}
        />
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          行业分析 · {projectName}
        </h2>

        {Boolean(spu) && (
          <span className="comp-tag info" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            SPU: {spu}
          </span>
        )}

        {Boolean(brand) && (
          <span className="comp-tag" style={{ background: '#f1f5f9', color: '#475569' }}>
            本品: {brand}
          </span>
        )}

        {Boolean(category) && (
          <span className="comp-tag" style={{ background: '#f8fafc', color: '#64748b' }}>
            品类: {category}
          </span>
        )}

        <span style={{ fontSize: '0.82rem', color: '#64748b', marginLeft: 8 }}>
          上次更新: {lastSyncText}
          {' · '}{config?.dailySyncEnabled === false ? '自动更新已暂停' : '每日自动更新'}
        </span>
      </div>

      {canWrite && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="ops-btn-secondary"
            onClick={onOpenConfig}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
          >
            配置竞品与归因
          </button>
          <button
            type="button"
            className="ops-btn-primary"
            disabled={syncing || !spu}
            onClick={onTriggerSync}
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              background: syncing || !spu ? '#94a3b8' : '#0284c7',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: syncing || !spu ? 'not-allowed' : 'pointer',
            }}
          >
            {syncing ? '同步中…' : '立即更新'}
          </button>
        </div>
      )}
    </div>
  );
}
