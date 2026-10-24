'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  CampaignDashboard,
  CampaignSource,
} from '../../lib/campaign-types';
import {
  getCampaignDailyDatasets,
  type CampaignDailyDataset,
} from '../../lib/campaign-daily';
import { SettingsDataSources } from '../settings/data-sources/SettingsDataSources';
import { useProject } from '../../components/project-shell/ProjectContext';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';

export interface CampaignSourcesPanelProps {
  projectId: string;
  initialDashboard?: CampaignDashboard | null;
  onDone?: () => Promise<void>;
}

function getSafeUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function formatSourceStatus(status?: string): { label: string; tone: 'success' | 'warning' | 'danger' | 'slate' } {
  switch (status) {
    case 'ready':
      return { label: '已读取', tone: 'success' };
    case 'manual':
      return { label: '离线补录', tone: 'slate' };
    case 'metadata_only':
      return { label: '仅元数据 (正文待导入)', tone: 'warning' };
    case 'error':
      return { label: '读取异常', tone: 'danger' };
    case 'syncing':
      return { label: '读取中', tone: 'warning' };
    case 'pending':
      return { label: '待核对', tone: 'warning' };
    default:
      return { label: status || '未知', tone: 'slate' };
  }
}

function formatProvenance(prov?: unknown): string {
  if (!prov) return '未知';
  if (typeof prov === 'string') {
    return prov === 'feishu' ? '飞书读取快照' : prov === 'manual' ? '离线补录' : prov;
  }
  const p = prov as { type?: string; sourceName?: string; note?: string };
  if (p.sourceName) return p.sourceName;
  if (p.type === 'feishu') return '飞书读取快照';
  if (p.type === 'manual') return '离线手工录入';
  return p.type || '数据源';
}

export function CampaignSourcesPanel({
  projectId,
  initialDashboard,
  onDone,
}: CampaignSourcesPanelProps) {
  const { workspace, showToast, refreshWorkspace } = useProject();
  const [dashboard, setDashboard] = useState<CampaignDashboard | null>(initialDashboard || null);
  const [loading, setLoading] = useState<boolean>(!initialDashboard);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchDashboard = useCallback(async (pid: string) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaign-dashboard?projectId=${encodeURIComponent(pid)}`, {
        signal: ctrl.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const msg = `获取数据源状态失败 (HTTP ${res.status})`;
        if (!ctrl.signal.aborted) {
          setDashboard(null);
          setError(msg);
        }
        return;
      }
      const raw = (await res.json()) as { dashboard?: CampaignDashboard; data?: CampaignDashboard; projectId?: string } | null;
      const payload: CampaignDashboard | undefined =
        raw?.dashboard ?? raw?.data ?? (raw?.projectId ? (raw as unknown as CampaignDashboard) : undefined);

      if (ctrl.signal.aborted) return;
      if (!payload || payload.projectId !== pid) {
        setDashboard(null);
        setError(`数据源项目不匹配 (${pid})`);
        return;
      }
      setDashboard(payload);
      setError(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (!ctrl.signal.aborted) {
        setError(err instanceof Error ? err.message : '加载数据源发生异常');
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    void Promise.resolve().then(() => {
      if (!ignore) {
        if (!initialDashboard || initialDashboard.projectId !== projectId) {
          void fetchDashboard(projectId);
        } else {
          setDashboard(initialDashboard);
          setLoading(false);
          setError(null);
        }
      }
    });
    return () => {
      ignore = true;
      if (abortRef.current) abortRef.current.abort();
    };
  }, [projectId, initialDashboard, fetchDashboard]);

  const handleReload = () => {
    void fetchDashboard(projectId);
  };

  const handleDataSourcesDone = async () => {
    if (onDone) {
      await onDone();
    } else {
      await refreshWorkspace();
    }
    void fetchDashboard(projectId);
  };

  // 严格隔离跨项目数据：仅当 dashboard.projectId 与当前 projectId 一致时激活，避免切换项目闪现旧源
  const activeDashboard = dashboard && dashboard.projectId === projectId ? dashboard : null;
  const sources: CampaignSource[] = useMemo(() => activeDashboard?.sources || [], [activeDashboard?.sources]);
  const dailyDatasets: CampaignDailyDataset[] = useMemo(
    () => getCampaignDailyDatasets(activeDashboard),
    [activeDashboard]
  );

  if (loading && !activeDashboard) {
    return <LoadingState text="正在获取项目数据源与快照状态…" />;
  }

  if (error && !activeDashboard) {
    return (
      <div style={{ padding: '24px 0' }}>
        <ErrorState error={error} onRetry={handleReload} />
      </div>
    );
  }

  return (
    <div className="campaign-sources-panel" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 顶部概览说明条 */}
      <div
        style={{
          background: '#f9f9fb',
          border: '0.5px solid #d9d9e0',
          borderRadius: 8,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1c2024' }}>
            战役复盘底表与快照数据源
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#60646c' }}>
            展示当前战役项目绑定的飞书文档、多维表格与离线日报元数据，真实反映读取状态与快照周期。
            {activeDashboard?.reportPeriod && (
              <span style={{ marginLeft: 8, fontWeight: 500, color: '#1c2024' }}>
                统计周期：{activeDashboard.reportPeriod}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeDashboard?.updatedAt && (
            <span style={{ fontSize: 12, color: '#60646c' }}>
              快照时间：{activeDashboard.updatedAt}
            </span>
          )}
          <button
            type="button"
            onClick={handleReload}
            disabled={loading}
            style={{
              fontSize: 14,
              padding: '6px 14px',
              borderRadius: 6,
              border: '0.5px solid #cdced6',
              background: '#fff',
              color: '#1c2024',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '刷新中…' : '↻ 刷新状态'}
          </button>
        </div>
      </div>

      {/* 异常说明 / 注意事项提示条 */}
      {activeDashboard?.warnings && activeDashboard.warnings.length > 0 && (
        <div
          style={{
            background: '#fff7c2',
            border: '0.5px solid #fff7c2',
            borderRadius: 8,
            padding: '14px 18px',
          }}
        >
          <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#ab6400' }}>
            ⚠️ 数据源核对与口径注意事项 ({activeDashboard.warnings.length}项)
          </h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#ab6400', lineHeight: 1.6 }}>
            {activeDashboard.warnings.slice(0, 5).map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
            {activeDashboard.warnings.length > 5 && (
              <li style={{ color: '#4f3422', listStyleType: 'none', marginTop: 4 }}>
                …其余 {activeDashboard.warnings.length - 5} 项异常说明已在对应明细指标中标识。
              </li>
            )}
          </ul>
        </div>
      )}

      {/* 1. 复盘底表卡片网格 */}
      <div>
        <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#1c2024' }}>
          底表与快照清单 ({sources.length})
        </h4>
        {sources.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', background: '#f9f9fb', borderRadius: 8, color: '#60646c' }}>
            暂无绑定的底表或快照来源
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 16,
            }}
          >
            {sources.map((src) => {
              const safeUrl = getSafeUrl(src.url);
              const statusInfo = formatSourceStatus(src.status);
              const provText = formatProvenance(src.provenance);
              const isKailasH9 = src.id === 'src-kailas-node-H9y3wPrjQi817YkAyrvcaxzAncg';

              const badgeBg =
                statusInfo.tone === 'success'
                  ? '#e6f7ed'
                  : statusInfo.tone === 'danger'
                  ? '#feebec'
                  : statusInfo.tone === 'warning'
                  ? '#fff7c2'
                  : '#f0f0f3';
              const badgeColor =
                statusInfo.tone === 'success'
                  ? '#208368'
                  : statusInfo.tone === 'danger'
                  ? '#641723'
                  : statusInfo.tone === 'warning'
                  ? '#ab6400'
                  : '#60646c';

              return (
                <div
                  key={src.id}
                  style={{
                    border: '0.5px solid #d9d9e0',
                    borderRadius: 8,
                    padding: 16,
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <h5 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1c2024', lineHeight: 1.4 }}>
                        {src.name}
                      </h5>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          background: badgeBg,
                          color: badgeColor,
                        }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#60646c' }}>
                      来源通道：{provText}
                    </div>
                    {src.detail && (
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#60646c', lineHeight: 1.5 }}>
                        {src.detail}
                      </p>
                    )}
                    {isKailasH9 && (
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ab6400', background: '#fff7c2', padding: '4px 8px', borderRadius: 4 }}>
                        ⚠️ 原汇总表公式存在 #REF 异常保持异常标记；分日流水已由同工作簿底表清洗后供 Daily 独立使用。
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      borderTop: '0.5px solid #f0f0f3',
                      paddingTop: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 12,
                      color: '#60646c',
                    }}
                  >
                    <span>
                      {src.fetchedAt ? `最后读取：${src.fetchedAt.slice(0, 16).replace('T', ' ')}` : '离线录入 / 待抓取'}
                    </span>
                    {safeUrl ? (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#0d74ce', textDecoration: 'none', fontWeight: 500 }}
                      >
                        访问原表 ↗
                      </a>
                    ) : (
                      <span>无外链</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. 新分日流水数据集清单 */}
      {dailyDatasets.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1c2024' }}>
              分日流水数据集来源与周期 ({dailyDatasets.length})
            </h4>
            <span style={{ fontSize: 12, color: '#60646c' }}>
              专供「首页分日看板」绘制真实时序走势，与大盘累计 KPI 严格隔离
            </span>
          </div>
          <div style={{ overflowX: 'auto', border: '0.5px solid #d9d9e0', borderRadius: 8, background: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9f9fb', borderBottom: '0.5px solid #d9d9e0', color: '#60646c' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>数据集名称</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>覆盖周期</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>记录天数</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>包含指标</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>来源说明</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>原表链接</th>
                </tr>
              </thead>
              <tbody>
                {dailyDatasets.map((ds) => {
                  const safeUrl = getSafeUrl(ds.sourceUrl);
                  return (
                    <tr key={ds.id} style={{ borderBottom: '0.5px solid #f0f0f3' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: '#1c2024' }}>{ds.label}</td>
                      <td style={{ padding: '10px 14px', color: '#1c2024' }}>{ds.period}</td>
                      <td style={{ padding: '10px 14px', color: '#1c2024' }}>{ds.rows?.length || 0} 天</td>
                      <td style={{ padding: '10px 14px', color: '#60646c' }}>
                        {ds.metrics?.map((m) => m.label).join('、') || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#60646c', maxWidth: 260 }}>
                        {ds.note || '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {safeUrl ? (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#0d74ce', textDecoration: 'none', fontWeight: 500 }}
                          >
                            打开原表 ↗
                          </a>
                        ) : (
                          <span style={{ color: '#60646c' }}>同工作簿底表</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. 保留现有数据源登记与权限管理（收纳在折叠卡片中，避免与上方卡片巨大重复） */}
      <details
        style={{
          border: '0.5px solid #d9d9e0',
          borderRadius: 8,
          background: '#ffffff',
          padding: '14px 18px',
          marginTop: 8,
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14,
            color: '#1c2024',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>⚙️ 底表登记与授权管理 (高级配置)</span>
          <span style={{ fontSize: 12, color: '#60646c', fontWeight: 'normal' }}>
            展开配置飞书表格绑定与字段映射 ▼
          </span>
        </summary>
        <div style={{ marginTop: 16, borderTop: '0.5px solid #f0f0f3', paddingTop: 16 }}>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: '#60646c' }}>
            支持管理员与编辑者补充登记飞书电子表格、多维表格与自定义映射规则。
          </p>
          <SettingsDataSources
            projectId={projectId}
            workspace={workspace}
            onDone={handleDataSourcesDone}
            toast={showToast}
          />
        </div>
      </details>
    </div>
  );
}
