'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  CampaignDashboard as CampaignDashboardData,
} from '../../lib/campaign-types';
import type { BoardPayload } from '../../lib/core/types';
import { CampaignOverviewPage } from './CampaignOverviewPage';
import { CampaignDailyPage } from './CampaignDailyPage';
import { CampaignAdsPage } from './CampaignAdsPage';
import { CampaignContentPage } from './CampaignContentPage';
import { HuangTianeBoard } from './HuangTianeBoard';
import { UniversalBoardRenderer } from './UniversalBoardRenderer';
import { useProjectTab } from '../../lib/hooks/useProjectTab';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { DashboardFrame } from '../overview/DashboardFrame';
import { resolveDashboardPreset } from '../overview/dashboard-template';
import { WorkspaceModuleTabs } from '../../components/ui/operations/WorkspaceModuleTabs';
import { ProjectContext } from '../../components/project-shell/ProjectContext';
import { deriveThemeFromBrandColor } from '../../lib/core/themes';
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

type PaletteKey = 'botanical' | 'terracotta' | 'nordic';

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
  const [currentPalette, setCurrentPalette] = useState<PaletteKey>('terracotta');

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const applyPalette = (raw: string | null | undefined) => {
      const savedPalette: PaletteKey =
        raw === 'botanical' || raw === 'terracotta' || raw === 'nordic' ? raw : 'terracotta';
      document.documentElement.setAttribute('data-palette', savedPalette);
      setCurrentPalette(savedPalette);
    };

    const userSaved = window.localStorage.getItem('feihe_ui_palette');
    if (userSaved && (userSaved === 'botanical' || userSaved === 'terracotta' || userSaved === 'nordic')) {
      applyPalette(userSaved);
    }

    const onPaletteChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const next = typeof detail === 'string' ? detail : detail?.palette;
      if (next) applyPalette(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'feihe_ui_palette') {
        applyPalette(e.newValue || 'terracotta');
      }
    };

    window.addEventListener('palettechange', onPaletteChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('palettechange', onPaletteChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const [dashboard, setDashboard] = useState<CampaignDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (projectContext?.showToast) {
      projectContext.showToast(msg, 'success');
    }
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, [projectContext]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const fetchDashboard = useCallback(async (pid: string, fresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const url = fresh
        ? `/api/campaign-dashboard?projectId=${encodeURIComponent(pid)}&fresh=1`
        : `/api/campaign-dashboard?projectId=${encodeURIComponent(pid)}`;
      const res = await fetch(url, {
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

  const handleReload = async () => {
    setSyncing(true);
    try {
      const syncRes = await fetch('/api/feishu/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, all: true }),
      });
      const syncData = (await syncRes.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
        warnings?: string[];
      } | null;

      if (!syncRes.ok || !syncData?.ok) {
        const errorMsg = syncData?.message || syncData?.error || `同步失败 (HTTP ${syncRes.status})`;
        showToast(`数据源同步未完成: ${errorMsg}，已保留当前快照`);
        await fetchDashboard(projectId, false);
        return;
      }

      await fetchDashboard(projectId, false);
      if (syncData?.warnings && syncData.warnings.length > 0) {
        showToast(`已从外部数据源同步最新数据（有 ${syncData.warnings.length} 项警示）`);
      } else {
        showToast('已从外部数据源同步最新数据');
      }
    } catch {
      showToast('同步网络请求异常，已保留当前快照');
      await fetchDashboard(projectId, false);
    } finally {
      setSyncing(false);
    }
  };

  const activeDashboard = dashboard && dashboard.projectId === projectId ? dashboard : null;
  const activePayload = activeDashboard as unknown as BoardPayload;

  const activeBrandColor = activePayload?.themeColor || (activeDashboard as any)?.themeColor || project?.color;
  const activeThemeStyle = useMemo(() => {
    if (!activeBrandColor) return undefined;
    const theme = deriveThemeFromBrandColor(activeBrandColor, activePayload?.themeId || project?.templateId);
    return {
      ...theme.cssVariables,
      '--brand-primary': theme.chrome.accent,
      '--brand-primary-soft': `${theme.chrome.accent}18`,
      '--border-brand': `${theme.chrome.accent}40`,
      '--teal-11': theme.chrome.accent,
      '--primary-blue': theme.chrome.accent,
      '--accent-primary': theme.chrome.accent,
      '--dtc-theme-accent': theme.chrome.accent,
      '--dtc-chart-color-0': theme.chrome.accent,
    } as React.CSSProperties;
  }, [activeBrandColor, activePayload?.themeId, project?.templateId]);

  const refreshAction = (
    <button
      type="button"
      onClick={handleReload}
      disabled={loading || syncing}
      className={`ca-subnav-reload-btn ${syncing ? 'is-syncing' : ''}`}
      title="同步外部数据源并刷新"
      aria-label="同步外部数据源并刷新"
    >
      <svg
        className="ca-subnav-reload-icon"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M1.5 8a6.5 6.5 0 1 0 1.9-4.6L1.5 5.5" />
        <path d="M1.5 2v3.5H5" />
      </svg>
      <span>{syncing ? '数据同步中…' : loading ? '重新加载中…' : '同步最新数据'}</span>
    </button>
  );

  const frameActions = (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} data-active-palette={currentPalette}>
      {refreshAction}
    </div>
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
      <DashboardFrame preset={preset} project={project} actions={frameActions} tabsSlot={tabsSlot}>
        <div className={`campaign-workspace-root ${className}`}>
          <LoadingState text="正在准备战役全盘数据…" />
        </div>
      </DashboardFrame>
    );
  }

  if (error && !activeDashboard) {
    return (
      <DashboardFrame preset={preset} project={project} actions={frameActions} tabsSlot={tabsSlot}>
        <div className={`campaign-workspace-root ${className}`}>
          <ErrorState error={error} onRetry={handleReload} />
        </div>
      </DashboardFrame>
    );
  }

  if (!activeDashboard) {
    return (
      <DashboardFrame preset={preset} project={project} actions={frameActions} tabsSlot={tabsSlot}>
        <div className={`campaign-workspace-root ${className}`}>
          <ErrorState error="暂无当前项目的复盘数据" onRetry={handleReload} />
        </div>
      </DashboardFrame>
    );
  }

  const projDisplayName = activePayload?.name || activeDashboard.name || project?.name || '营销战役';
  const spu = activePayload?.spu || (activeDashboard as any).spu || '核心主推品';
  const category = activePayload?.category || (activeDashboard as any).category || '消费品与品牌营销';
  const mode = activePayload?.mode || (activeDashboard as any).mode || '全域数据贯通 · 真实入账';
  const period = activePayload?.reportPeriod || activeDashboard.reportPeriod || '观测周期中';
  const rendererMode = activePayload?.rendererMode || 'universal';

  return (
    <DashboardFrame
      preset={preset}
      project={project}
      actions={frameActions}
      tabsSlot={tabsSlot}
    >
      <div
        className={`campaign-workspace-root ${className}`}
        data-project-id={projectId}
        data-source-file={`projects/${projectId}/transform.ts`}
        style={activeThemeStyle}
      >
        {/* Project Context Ribbon */}
        <div
          className="project-context-bar"
          role="region"
          aria-label="当前项目档案元数据"
          data-project-id={projectId}
          data-source-file={`projects/${projectId}/transform.ts`}
          data-section-id="project-context-ribbon"
          style={{ borderLeft: '4px solid ' + (activeBrandColor || 'var(--brand-primary, #0F5E52)') }}
        >
          <div className="context-left">
            <div className="context-item">
              <span className="context-icon-badge" style={{ background: 'var(--brand-primary-soft, #EBF5F3)', color: 'var(--brand-primary, #0F5E52)' }}>💼</span>
              <span>当前聚焦项目：<b>{projDisplayName}</b></span>
            </div>
            <div className="context-item">
              <span className="context-icon-badge" style={{ background: 'var(--accent-secondary-soft, #FDF0EC)', color: 'var(--accent-secondary, #D95D39)' }}>🏷️</span>
              <span>核心 SPU：<b>{spu}</b></span>
            </div>
            <div className="context-item">
              <span className="context-icon-badge" style={{ background: 'var(--accent-tertiary-soft, #EEF6FA)', color: 'var(--accent-tertiary, #2E6F8E)' }}>📂</span>
              <span>所属类目：<b>{category}</b></span>
            </div>
            <div className="context-item">
              <span className="context-icon-badge" style={{ background: 'var(--accent-quaternary-soft, #FDF6EB)', color: 'var(--accent-quaternary, #C87D20)' }}>📅</span>
              <span>数据观测周期：<b>{period}</b></span>
            </div>
          </div>
          <div className="context-right">
            <span className="semantic-tag tag-ok">
              <span>🎯</span>
              <span>{mode}</span>
            </span>
          </div>
        </div>

        {/* 看板分发：优先判断 overviewTab 是否为 daily 共享看板，否则根据 rendererMode 进行视图分发 */}
        {overviewTab === 'daily' && currentSection === 'overview' ? (
          <div
            id="workspace-tabpanel-daily"
            role="tabpanel"
            aria-labelledby="workspace-tab-daily"
            tabIndex={0}
            data-project-id={projectId}
            data-source-file={`projects/${projectId}/transform.ts`}
            data-section-id="daily-tabpanel"
          >
            <CampaignDailyPage key={projectId} dashboard={activeDashboard} />
          </div>
        ) : rendererMode === 'legacy-huang-tiane' ? (
          <div
            data-project-id={projectId}
            data-source-file={`projects/${projectId}/transform.ts`}
            data-section-id={`board-${currentSection}`}
          >
            <HuangTianeBoard
              key={projectId}
              dashboard={activeDashboard}
              section={currentSection}
            />
          </div>
        ) : rendererMode === 'legacy-campaign' ? (
          <div
            data-project-id={projectId}
            data-source-file={`projects/${projectId}/transform.ts`}
            data-section-id={`${currentSection}-section`}
          >
            {currentSection === 'ads' && <CampaignAdsPage key={projectId} dashboard={activeDashboard} />}
            {currentSection === 'content' && <CampaignContentPage key={projectId} dashboard={activeDashboard} />}
            {currentSection === 'overview' && <CampaignOverviewPage key={projectId} dashboard={activeDashboard} />}
          </div>
        ) : (
          <div
            data-project-id={projectId}
            data-source-file={`projects/${projectId}/transform.ts`}
            data-section-id={`${currentSection}-section`}
          >
            {activePayload ? (
              <UniversalBoardRenderer payload={activePayload} sectionId={currentSection} />
            ) : currentSection === 'ads' ? (
              <CampaignAdsPage key={projectId} dashboard={activeDashboard} />
            ) : currentSection === 'content' ? (
              <CampaignContentPage key={projectId} dashboard={activeDashboard} />
            ) : (
              <CampaignOverviewPage key={projectId} dashboard={activeDashboard} />
            )}
          </div>
        )}

        {toastMessage && (
          <div className="ca-sync-toast" role="status">
            <span>✓</span>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </DashboardFrame>
  );
}
