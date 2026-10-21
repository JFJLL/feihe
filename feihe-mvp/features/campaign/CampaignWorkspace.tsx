'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  CampaignDashboard as CampaignDashboardData,
} from '../../lib/campaign-types';
import { CampaignOverviewPage } from './CampaignOverviewPage';
import { CampaignDailyPage } from './CampaignDailyPage';
import { CampaignAdsPage } from './CampaignAdsPage';
import { CampaignContentPage } from './CampaignContentPage';
import { HuangTianeBoard } from './HuangTianeBoard';
import { useProjectTab } from '../../lib/hooks/useProjectTab';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { DashboardFrame } from '../overview/DashboardFrame';
import { resolveDashboardPreset } from '../overview/dashboard-template';
import { WorkspaceModuleTabs } from '../../components/ui/operations/WorkspaceModuleTabs';
import { ProjectContext } from '../../components/project-shell/ProjectContext';
import './campaign-analytics.css';
import './campaign-shell.css';

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

  const projectContext = React.useContext(ProjectContext);
  const project = projectContext?.currentProject?.id === projectId
    ? projectContext.currentProject
    : projectContext?.projects?.find((p) => p.id === projectId);
  const preset = resolveDashboardPreset('content_marketing');

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

  const refreshAction = (
    <button
      type="button"
      onClick={handleReload}
      disabled={loading}
      className="ca-subnav-reload-btn button button-secondary"
      title="重新请求最新复盘数据"
      style={{
        padding: '4px 12px',
        borderRadius: 6,
        fontSize: 13,
        cursor: loading ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {loading ? '刷新中…' : '↻ 刷新'}
    </button>
  );

  const tabsSlot = currentSection === 'overview' ? (
    <WorkspaceModuleTabs
      tabs={[
        { id: 'overview', title: '数据总览', desc: '预算进度与阶段效果', icon: '📊' },
        { id: 'daily', title: '分日看板', desc: '当日指标与明细', icon: '📅' },
      ]}
      activeTab={overviewTab}
      onChange={setOverviewTab}
      variant="cards"
    />
  ) : null;

  if (loading && !activeDashboard) {
    return (
      <DashboardFrame preset={preset} project={project} actions={refreshAction} tabsSlot={tabsSlot}>
        <div className={`campaign-workspace-root ${className}`}>
          <LoadingState text="正在准备战役全盘数据…" />
        </div>
      </DashboardFrame>
    );
  }

  if (error && !activeDashboard) {
    return (
      <DashboardFrame preset={preset} project={project} actions={refreshAction} tabsSlot={tabsSlot}>
        <div className={`campaign-workspace-root ${className}`}>
          <ErrorState error={error} onRetry={handleReload} />
        </div>
      </DashboardFrame>
    );
  }

  if (!activeDashboard) {
    return (
      <DashboardFrame preset={preset} project={project} actions={refreshAction} tabsSlot={tabsSlot}>
        <div className={`campaign-workspace-root ${className}`}>
          <ErrorState error="暂无当前项目的复盘数据" onRetry={handleReload} />
        </div>
      </DashboardFrame>
    );
  }

  return (
    <DashboardFrame
      preset={preset}
      project={project}
      actions={refreshAction}
      tabsSlot={tabsSlot}
    >
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

      {/* 黄天鹅专属看板：分发 overview / ads / content 到 HuangTianeBoard，daily 保持共享分日看板 */}
      {projectId === 'huang-tiane' && (
        currentSection === 'overview' && overviewTab === 'daily' ? (
          <div
            id="workspace-tabpanel-daily"
            role="tabpanel"
            aria-labelledby="workspace-tab-daily"
            tabIndex={0}
          >
            <CampaignDailyPage key={projectId} dashboard={activeDashboard} />
          </div>
        ) : (
          <HuangTianeBoard
            key={projectId}
            dashboard={activeDashboard}
            section={currentSection}
          />
        )
      )}

      {/* 其它项目标准分发 */}
      {projectId !== 'huang-tiane' && currentSection === 'ads' && (
        <CampaignAdsPage key={projectId} dashboard={activeDashboard} />
      )}

      {projectId !== 'huang-tiane' && currentSection === 'content' && (
        <CampaignContentPage key={projectId} dashboard={activeDashboard} />
      )}

      {projectId !== 'huang-tiane' && currentSection === 'overview' && (
        overviewTab === 'daily' ? (
          <div
            id="workspace-tabpanel-daily"
            role="tabpanel"
            aria-labelledby="workspace-tab-daily"
            tabIndex={0}
          >
            <CampaignDailyPage key={projectId} dashboard={activeDashboard} />
          </div>
        ) : (
          <div
            id="workspace-tabpanel-overview"
            role="tabpanel"
            aria-labelledby="workspace-tab-overview"
            tabIndex={0}
          >
            <CampaignOverviewPage key={projectId} dashboard={activeDashboard} />
          </div>
        )
      )}
    </div>
    </DashboardFrame>
  );
}
