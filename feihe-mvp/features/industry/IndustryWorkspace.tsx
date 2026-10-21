'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { IndustryHeader } from './IndustryHeader';
import { IndustryCompetitorTable } from './IndustryCompetitorTable';
import { IndustrySearchTopics } from './IndustrySearchTopics';
import { IndustryNotesTable } from './IndustryNotesTable';
import { IndustryConfigModal } from './IndustryConfigModal';
import { IndustryCharts } from './IndustryCharts';
import './industry.css';
import type {
  IndustryProjectConfig,
  IndustrySnapshot,
  IndustryTaskRecord,
} from '../../lib/industry-types';

export function IndustryWorkspace({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spu, setSpu] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [projectName, setProjectName] = useState(projectId);
  const [canWrite, setCanWrite] = useState(false);
  const [config, setConfig] = useState<IndustryProjectConfig | null>(null);
  const [snapshot, setSnapshot] = useState<IndustrySnapshot | null>(null);
  const [_history, setHistory] = useState<IndustryTaskRecord[]>([]);
  const [liveVerified, setLiveVerified] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/industry?projectId=' + encodeURIComponent(projectId));
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        spu?: string;
        brand?: string;
        category?: string;
        projectName?: string;
        canWrite?: boolean;
        config?: IndustryProjectConfig;
        snapshot?: IndustrySnapshot;
        history?: IndustryTaskRecord[];
        liveVerified?: boolean;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '获取行业分析数据失败');
      }

      setSpu(json.spu || '');
      setBrand(json.brand || '');
      setCategory(json.category || '');
      setProjectName(json.projectName || projectId);
      setCanWrite(Boolean(json.canWrite));
      setConfig(json.config || null);
      setSnapshot(json.snapshot || null);
      setHistory(json.history || []);
      setLiveVerified(Boolean(json.liveVerified));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let ignore = false;
    void Promise.resolve().then(() => {
      if (!ignore) {
        void loadData();
      }
    });
    return () => {
      ignore = true;
    };
  }, [loadData]);

  async function handleTriggerSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/industry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger_sync',
          projectId,
          force: true,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '同步执行失败');
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  if (loading && !snapshot && !config) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        正在读取行业分析数据与项目配置…
      </div>
    );
  }

  const validSnapshot = snapshot?.spu === spu && snapshot.status !== 'invalidated' ? snapshot : null;
  const summary = validSnapshot?.summary;
  const isMissingSpu = !spu;
  const isStale = snapshot?.status === 'stale' || config?.lastStatus === 'stale';
  const isInvalidated = snapshot?.status === 'invalidated';

  return (
    <div className="industry-workspace" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
      <IndustryHeader
        projectId={projectId}
        projectName={projectName}
        spu={spu}
        brand={brand}
        category={category}
        config={config}
        snapshot={snapshot}
        syncing={syncing}
        liveVerified={liveVerified}
        canWrite={canWrite}
        onTriggerSync={handleTriggerSync}
        onOpenConfig={() => setConfigModalOpen(true)}
      />

      {error && (
        <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, fontSize: '0.875rem' }}>
          ⚠️ {error}
        </div>
      )}

      {isMissingSpu && (
        <div style={{ padding: '16px 20px', background: '#fffbeb', border: '1px solid #fef3c7', color: '#92400e', borderRadius: 8, fontSize: '0.9rem', lineHeight: 1.6 }}>
          <strong>未配置项目 SPU（标准品）：</strong>
          <br />
          行业分析严格依据项目持久化的 SPU 与竞品词包发起检索。当前项目尚未配置 SPU，请前往「<strong>项目设置 &gt; 项目资料</strong>」维护 SPU（如“登山鞋”、“冰箱”、“酒精湿巾”、“可生食鸡蛋”）后重新进入。
        </div>
      )}

      {isInvalidated && (
        <div style={{ padding: '14px 18px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 8, fontSize: '0.875rem' }}>
          <strong>SPU 变更提示：</strong>
          {snapshot?.invalidationReason || '当前 SPU 已更新，旧快照已失效'}。请点击上方「立即更新」生成当前 SPU 的最新分析数据。
        </div>
      )}

      {isStale && !isMissingSpu && (
        <div style={{ padding: '12px 16px', background: '#fff7ed', border: '1px solid #ffedd5', color: '#9a3412', borderRadius: 8, fontSize: '0.85rem' }}>
          <strong>数据状态提示：</strong> 当前展示为历史快照。最新一次同步异常：
          {config?.lastError || '采集服务暂未响应'}。已严格保留上一版本真实数据，未进行覆盖。
        </div>
      )}

      {Boolean(spu) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div className="panel" style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 14 }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>样本笔记覆盖数</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {summary ? summary.totalNotes.toLocaleString() : '-'}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>SPU: {spu}</span>
          </div>

          <div className="panel" style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 14 }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>已返回互动项合计</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {summary?.totalInteractions !== null && summary?.totalInteractions !== undefined
                ? summary.totalInteractions.toLocaleString()
                : '-'}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>有效数值累加 (缺项不补0)</span>
          </div>

          <div className="panel" style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 14 }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>样本中本品归因占比</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {summary?.ourBrandShare !== null && summary?.ourBrandShare !== undefined
                ? (Math.round(summary.ourBrandShare * 100) + '%')
                : '-'}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{brand || '本品牌'}</span>
          </div>

          <div className="panel" style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 14 }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>商业合作笔记占比</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {summary?.commercialRatio !== null && summary?.commercialRatio !== undefined
                ? (Math.round(summary.commercialRatio * 100) + '%')
                : '-'}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>已标注合作性质样本</span>
          </div>
        </div>
      )}

      {Boolean(spu) && validSnapshot && validSnapshot.summary.totalNotes > 0 && (
        <>
          <div className="industry-scope">数据来源：蒲公英真实检索 · 以项目 SPU「{spu}」查询近 30 天热度样本，每次最多 120 篇。品牌归因词只用于识别已返回笔记，不代表独立竞品检索或全行业覆盖；缺失字段显示为「-」。</div>
          <IndustryCharts snapshot={validSnapshot} />
          <IndustryCompetitorTable
            items={snapshot?.competitorComparison || []}
            brand={brand}
          />

          <IndustrySearchTopics
            topics={snapshot?.searchTopics || []}
            spu={spu}
          />

          <IndustryNotesTable
            notes={snapshot?.recentNotes || []}
          />
        </>
      )}
      {Boolean(spu) && (!validSnapshot || validSnapshot.summary.totalNotes === 0) && <section className="industry-empty"><h3>{validSnapshot ? '本次检索未返回相关笔记' : '等待首份真实行业样本'}</h3><p>{config?.lastError || '每天自动按项目 SPU 更新，也可以点击「立即更新」。采集前不展示模拟指标。'}</p></section>}

      {configModalOpen && canWrite && (
        <IndustryConfigModal
          projectId={projectId}
          spu={spu}
          brand={brand}
          config={config}
          onClose={() => setConfigModalOpen(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
