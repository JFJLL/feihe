'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  CampaignDashboard as CampaignDashboardData,
} from '../../lib/campaign-types';
import { CampaignOverviewPage } from './CampaignOverviewPage';
import { CampaignDailyPage } from './CampaignDailyPage';
import { CampaignAdsPage } from './CampaignAdsPage';
import { CampaignContentPage } from './CampaignContentPage';
import { useProjectTab } from '../../lib/hooks/useProjectTab';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import './campaign-analytics.css';

interface CampaignApiResponse {
  error?: string;
  message?: string;
  dashboard?: CampaignDashboardData;
  data?: CampaignDashboardData;
  projectId?: string;
}

export interface CampaignWorkspaceProps {
  projectId: string;
  section?: 'overview' | 'ads' | 'content';
  initialTab?: string;
  className?: string;
}

function resolveSection(
  section?: 'overview' | 'ads' | 'content',
  initialTab?: string
): 'overview' | 'ads' | 'content' {
  if (section === 'ads' || section === 'content' || section === 'overview') {
    return section;
  }
  if (initialTab === 'ads' || initialTab === 'tables') return 'ads';
  if (initialTab === 'content' || initialTab === 'actions') return 'content';
  return 'overview';
}

export function CampaignWorkspace({
  projectId,
  section,
  initialTab,
  className = '',
}: CampaignWorkspaceProps) {
  const currentSection = resolveSection(section, initialTab);
  const [overviewTab, setOverviewTab] = useProjectTab('overview', ['overview', 'daily']);

  const [dashboard, setDashboard] = useState<CampaignDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchDashboard = useCallback(async (pid: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaign-dashboard?projectId=${encodeURIComponent(pid)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      const isAuthOrNotFound = res.status === 401 || res.status === 403 || res.status === 404;

      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as CampaignApiResponse | null;
        const message = errorData?.error || errorData?.message || `获取复盘数据失败 (HTTP ${res.status})`;
        if (!controller.signal.aborted) {
          if (isAuthOrNotFound) setDashboard(null);
          setError(String(message));
        }
        return;
      }

      const raw = (await res.json()) as CampaignApiResponse;
      const payload: CampaignDashboardData | undefined =
        raw.dashboard ?? raw.data ?? (raw.projectId ? (raw as unknown as CampaignDashboardData) : undefined);

      if (controller.signal.aborted) return;

      if (!payload || payload.projectId !== pid) {
        setDashboard(null);
        setError(`返回的复盘数据不匹配项目 (${pid})`);
        return;
      }

      setDashboard(payload);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : '加载复盘数据发生异常');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    void Promise.resolve().then(() => {
      if (!ignore) {
        void fetchDashboard(projectId);
      }
    });
    return () => {
      ignore = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [projectId, fetchDashboard]);

  const handleReload = () => {
    void fetchDashboard(projectId);
  };

  // 严格按项目隔离数据，避免跨项目串流
  const activeDashboard = dashboard && dashboard.projectId === projectId ? dashboard : null;

  if (loading && !activeDashboard) {
    return (
      <div className={`campaign-workspace-root ${className}`}>
        <LoadingState text="正在准备战役全盘数据…" />
      </div>
    );
  }

  if (error && !activeDashboard) {
    return (
      <div className={`campaign-workspace-root ${className}`}>
        <ErrorState error={error} onRetry={handleReload} />
      </div>
    );
  }

  if (!activeDashboard) {
    return (
      <div className={`campaign-workspace-root ${className}`}>
        <ErrorState error="暂无当前项目的复盘数据" onRetry={handleReload} />
      </div>
    );
  }

  return (
    <div className={`campaign-workspace-root ${className}`}>
      {/* 重新加载失败时的轻量警示条 */}
      {error && (
        <div
          role="alert"
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
            padding: '8px 16px',
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>重新加载失败：{error}</span>
          <button
            type="button"
            onClick={handleReload}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#0284c7',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            重试
          </button>
        </div>
      )}

      {/* 投流分析独立页面 */}
      {currentSection === 'ads' && (
        <CampaignAdsPage dashboard={activeDashboard} />
      )}

      {/* 内容管理独立页面 */}
      {currentSection === 'content' && (
        <CampaignContentPage dashboard={activeDashboard} />
      )}

      {/* 首页总览 / 分日看板：仅在 overview 状态下提供紧凑切换条与刷新 */}
      {currentSection === 'overview' && (
        <>
          <div
            className="ca-overview-subnav-bar"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 16px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              gap: 12,
            }}
          >
            <div
              className="ca-overview-subnav-tabs"
              role="tablist"
              aria-label="看板模式切换"
              style={{ display: 'flex', gap: 6 }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={overviewTab === 'overview'}
                className={`ca-subnav-pill ${overviewTab === 'overview' ? 'active' : ''}`}
                onClick={() => setOverviewTab('overview')}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: overviewTab === 'overview' ? '#2c7168' : '#e2e8f0',
                  background: overviewTab === 'overview' ? '#2c7168' : '#ffffff',
                  color: overviewTab === 'overview' ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                }}
              >
                总览
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={overviewTab === 'daily'}
                className={`ca-subnav-pill ${overviewTab === 'daily' ? 'active' : ''}`}
                onClick={() => setOverviewTab('daily')}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: overviewTab === 'daily' ? '#2c7168' : '#e2e8f0',
                  background: overviewTab === 'daily' ? '#2c7168' : '#ffffff',
                  color: overviewTab === 'daily' ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                }}
              >
                分日
              </button>
            </div>

            <div className="ca-overview-subnav-actions">
              <button
                type="button"
                onClick={handleReload}
                disabled={loading}
                className="ca-subnav-reload-btn"
                title="重新请求最新复盘数据"
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? '刷新中…' : '↻ 刷新'}
              </button>
            </div>
          </div>

          {overviewTab === 'daily' ? (
            <CampaignDailyPage dashboard={activeDashboard} />
          ) : (
            <CampaignOverviewPage dashboard={activeDashboard} />
          )}
        </>
      )}
    </div>
  );
}
