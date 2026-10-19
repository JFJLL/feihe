'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  CampaignDashboard as CampaignDashboardData,
  CampaignDashboardTabKey,
} from '../../lib/campaign-types';
import { CampaignDashboard } from './CampaignDashboard';
import './campaign.css';

interface CampaignApiResponse {
  error?: string;
  message?: string;
  dashboard?: CampaignDashboardData;
  data?: CampaignDashboardData;
  projectId?: string;
}

export interface CampaignWorkspaceProps {
  projectId: string;
  initialTab?: string;
  className?: string;
}

export function resolveCampaignTabKey(tab?: string): CampaignDashboardTabKey {
  if (tab === 'ads') return 'tables';
  if (tab === 'content') return 'actions';
  if (tab === 'kpis' || tab === 'tables' || tab === 'actions' || tab === 'sources' || tab === 'overview') {
    return tab;
  }
  return 'overview';
}

export function CampaignWorkspace({
  projectId,
  initialTab,
  className = '',
}: CampaignWorkspaceProps) {
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
        if (abortControllerRef.current === controller && !controller.signal.aborted) {
          if (isAuthOrNotFound) setDashboard(null);
          setError(String(message));
        }
        return;
      }

      const raw = (await res.json()) as CampaignApiResponse;
      const payload: CampaignDashboardData | undefined =
        raw.dashboard ?? raw.data ?? (raw.projectId ? (raw as unknown as CampaignDashboardData) : undefined);

      if (abortControllerRef.current !== controller || controller.signal.aborted) return;

      if (!payload || payload.projectId !== pid) {
        setDashboard(null);
        setError(`返回的复盘数据不匹配项目 (${pid})`);
        return;
      }

      setDashboard(payload);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (abortControllerRef.current === controller && !controller.signal.aborted) {
        setError(err instanceof Error ? err.message : '加载复盘数据发生异常');
      }
    } finally {
      if (abortControllerRef.current === controller && !controller.signal.aborted) {
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

  const getSourceBadgeText = (d: CampaignDashboardData) => {
    const provs = (d.sources || []).map((s) => {
      if (typeof s.provenance === 'string') return s.provenance;
      return s.provenance?.type || '';
    });
    const hasFeishu =
      provs.includes('feishu') ||
      (d.sources || []).some((s) => /feishu|bitable|sheets/i.test(s.url || ''));
    const hasManual =
      provs.includes('manual') ||
      (d.sources || []).some((s) => s.status === 'manual' || s.id === 'manual-report');

    if (hasFeishu && hasManual) return '飞书快照 · 日报补充';
    if (hasFeishu) return '飞书同步';
    if (hasManual) return '离线日报补录';
    return '复盘看板';
  };

  const activeDashboard = dashboard && dashboard.projectId === projectId ? dashboard : null;
  const mappedTab = resolveCampaignTabKey(initialTab);

  if (loading && !activeDashboard) {
    return (
      <div className={`campaign-workspace-root ${className}`}>
        <div className="campaign-workspace-loading" role="status">
          <div className="campaign-loading-spinner" />
          <p className="campaign-loading-text">正在加载复盘数据...</p>
        </div>
      </div>
    );
  }

  if (error && !activeDashboard) {
    return (
      <div className={`campaign-workspace-root ${className}`}>
        <div className="campaign-workspace-error" role="alert">
          <div className="campaign-error-card">
            <h3 className="campaign-error-title">复盘数据加载失败</h3>
            <p className="campaign-error-message">{error}</p>
            <button
              type="button"
              className="campaign-btn campaign-btn-primary"
              onClick={handleReload}
            >
              重新加载
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeDashboard) {
    return (
      <div className={`campaign-workspace-root ${className}`}>
        <div className="campaign-workspace-empty">
          <p className="campaign-text-muted">暂无复盘数据</p>
          <button type="button" className="campaign-btn campaign-btn-secondary" onClick={handleReload}>
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`campaign-workspace-root ${className}`}>
      <div className="campaign-workspace-toolbar">
        <div className="campaign-workspace-status">
          <span className="campaign-status-tag">
            {getSourceBadgeText(activeDashboard)}
          </span>
        </div>
        <button
          type="button"
          className="campaign-btn campaign-btn-secondary campaign-reload-btn"
          onClick={handleReload}
          disabled={loading}
          title="重新请求最新复盘数据"
        >
          {loading ? '加载中...' : '↻ 重新加载'}
        </button>
      </div>

      {error && (
        <div className="campaign-banner-warning" role="alert">
          <span>重新加载失败：{error}</span>
          <button
            type="button"
            className="campaign-btn-link"
            onClick={handleReload}
          >
            重试
          </button>
        </div>
      )}

      <CampaignDashboard dashboard={activeDashboard} initialTab={mappedTab} />
    </div>
  );
}
