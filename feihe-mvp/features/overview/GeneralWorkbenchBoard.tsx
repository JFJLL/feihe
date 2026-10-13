'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { Project } from '../../lib/types/project';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { api, cnTime, ApiError } from '../../lib/hooks/use-project-data';
import { useProject } from '../../components/project-shell/ProjectContext';
import Link from '../../components/ui/AppLink';
import { CardEditModal, type DashboardCardConfig } from './CardEditModal';
import { CardRenderView } from './CardRenderView';
import type { MetricComputeResult } from '../../lib/metrics/engine';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { ConflictResolutionDialog } from './ConflictResolutionDialog';
import { MetricCardPicker } from '../metrics/MetricCardPicker';

interface DatasetSummary {
  id: string;
  name: string;
  rowCount: number;
  columns?: Array<{ key: string; name: string; type: string }>;
  updatedAt: string;
}

interface DatasetDetail {
  id: string; name: string; columns: Array<{ key: string; name: string; type: string }>;
  rowCount: number; rows: Array<Record<string, unknown>>;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
}

export function GeneralWorkbenchBoard({
  projectId,
  project,
}: {
  projectId: string;
  project?: Project;
}) {
  const { showToast, navigateTo } = useProject();
  const canConfigure = Boolean(project?.canManage && !project.isArchived);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [detailSnapshot, setDetailSnapshot] = useState<{ key: string; data: DatasetDetail | null; error: string }>({ key: '', data: null, error: '' });

  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [viewMode, setViewMode] = useState<'board' | 'data'>('board');

  // Draft vs Published Cards separation
  const [isEditingBoard, setIsEditingBoard] = useState(false);
  const [dashboardVersion, setDashboardVersion] = useState<number>(1);
  const [dashboardId, setDashboardId] = useState<string>('');
  const [publishedCards, setPublishedCards] = useState<DashboardCardConfig[]>([]);
  const [draftCards, setDraftCards] = useState<DashboardCardConfig[]>([]);
  const [savingBoard, setSavingBoard] = useState(false);

  const saveLock = useRef(false);
  const allowNavigation = useRef(false);
  const workspaceRequest = useRef(0);
  const detailRequest = useRef(0);
  const summaryRequest = useRef(0);
  const metricRequest = useRef(0);
  const [datasetRevision, setDatasetRevision] = useState(0);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Card modal state
  const [modalCard, setModalCard] = useState<DashboardCardConfig | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showMetricPicker, setShowMetricPicker] = useState(false);
  const [pickerMetricId, setPickerMetricId] = useState('');
  const handledMetricIntent = useRef('');
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null);

  // Unsaved changes & conflict dialogs
  const [pendingDatasetSwitch, setPendingDatasetSwitch] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<{ serverVersion: number; localVersion: number } | null>(null);

  // Metric evaluation results
  const [metricSnapshot, setMetricSnapshot] = useState<{ key: string; results: Record<string, MetricComputeResult>; error: string }>({ key: '', results: {}, error: '' });

  // Table pagination and search
  const [searchTable, setSearchTable] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    const configure = (event: Event) => {
      const target = (event as CustomEvent<{ projectId: string }>).detail?.projectId;
      if (target !== projectId || !canConfigure || saveLock.current) return;
      if (!isEditingBoard) { setDraftCards(publishedCards); setIsEditingBoard(true); }
      setViewMode('board');
    };
    window.addEventListener('workbench:configure', configure);
    return () => window.removeEventListener('workbench:configure', configure);
  }, [projectId, canConfigure, isEditingBoard, publishedCards]);

  const detailKey = JSON.stringify({ projectId, selectedDatasetId, currentPage, searchTable, datasetRevision });
  const activeDataset = detailSnapshot.key === detailKey ? detailSnapshot.data : null;
  const detailError = detailSnapshot.key === detailKey ? detailSnapshot.error : '';

  const hasUnsavedChanges = useMemo(() => {
    return isEditingBoard && JSON.stringify(draftCards) !== JSON.stringify(publishedCards);
  }, [isEditingBoard, draftCards, publishedCards]);

  // Load datasets and dashboard configuration
  const loadWorkspaceData = useCallback(async () => {
    const requestId = ++workspaceRequest.current;
    try {
      const [dsRes, dashRes] = await Promise.all([
        api<{ ok: boolean; datasets: DatasetSummary[] }>(`/api/datasets?projectId=${encodeURIComponent(projectId)}`),
        api<{
          ok: boolean;
          dashboards: Array<{ id: string; version: number; name: string }>;
          targetDashboardId?: string;
          cards: Array<{ id: string; title: string; type: string; configJson: string; sortOrder: number }>;
        }>(`/api/dashboards?projectId=${encodeURIComponent(projectId)}`),
      ]);

      if (requestId !== workspaceRequest.current) return;
      setDataError('');
      const dsList = dsRes.datasets || [];
      setDatasets(dsList);

      const chosenDsId = dsList[0]?.id || '';
      setSelectedDatasetId(chosenDsId);

      const targetDash = dashRes.dashboards?.find((d) => d.id === dashRes.targetDashboardId) || dashRes.dashboards?.[0];
      if (targetDash) {
        setDashboardId(targetDash.id);
        setDashboardVersion(targetDash.version || 1);
      } else {
        setDashboardId(`dash-${projectId}-default`);
        setDashboardVersion(1);
      }

      // If cards are stored in database for this dashboard, parse them
      if (dashRes.cards) {
        const parsedCards: DashboardCardConfig[] = dashRes.cards.map((c) => {
          let conf: Partial<DashboardCardConfig> & { dimension?: string } = {};
          try { conf = JSON.parse(c.configJson || '{}'); } catch {}
          return {
            ...conf,
            id: c.id,
            title: c.title,
            type: c.type === 'bar_chart' ? 'breakdown' : (c.type as DashboardCardConfig['type']) || 'metric_card',
            groupBy: conf.groupBy || (c.type === 'bar_chart' ? conf.dimension : undefined),
            sortOrder: c.sortOrder,
          };
        });
        setPublishedCards(parsedCards);
        setDraftCards(parsedCards);
      } else if (!dashRes.dashboards?.length) {
        // Initial default install only when no dashboard existed before
        const defaults: DashboardCardConfig[] = [
          { title: '任务总数', type: 'metric_card', metric: 'task_total', unit: '项' },
          { title: '已完成项', type: 'metric_card', metric: 'task_completed', unit: '项' },
          { title: '任务完成率', type: 'progress_card', metric: 'task_completion_rate', unit: '%' },
          { title: '预算执行率', type: 'progress_card', metric: 'budget_spent_rate', unit: '%' },
        ];
        setPublishedCards(defaults);
        setDraftCards(defaults);
      } else {
        // Saved as empty dashboard: stay empty!
        setPublishedCards([]);
        setDraftCards([]);
      }
    } catch (err) {
      if (requestId === workspaceRequest.current) setDataError(err instanceof Error ? err.message : '获取工作台数据失败');
    } finally {
      if (requestId === workspaceRequest.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadWorkspaceData();
    return () => { workspaceRequest.current++; detailRequest.current++; metricRequest.current++; };
  }, [loadWorkspaceData]);

  // Load active dataset rows with server-side pagination & search
  const loadDatasetDetail = useCallback(async (dsId: string, page = 1, search = '', requestKey = detailKey) => {
    const requestId = ++detailRequest.current;
    if (!dsId) return;
    try {
      const url = `/api/datasets?projectId=${encodeURIComponent(projectId)}&id=${encodeURIComponent(dsId)}&page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`;
      const detail = await api<{ ok: boolean; dataset: DatasetDetail }>(url);
      if (requestId !== detailRequest.current) return;
      if (detail.dataset?.pagination && page > detail.dataset.pagination.totalPages) {
        setCurrentPage(Math.max(1, detail.dataset.pagination.totalPages));
        return;
      }
      if (detail.dataset) {
        setDetailSnapshot({ key: requestKey, data: detail.dataset, error: '' });
      }
    } catch (err) {
      if (requestId === detailRequest.current) setDetailSnapshot({ key: requestKey, data: null, error: err instanceof Error ? err.message : '加载数据集记录失败' });
    }
  }, [projectId, detailKey]);

  useEffect(() => {
    if (selectedDatasetId) {
      void loadDatasetDetail(selectedDatasetId, currentPage, searchTable);
    }
  }, [selectedDatasetId, currentPage, searchTable, datasetRevision, loadDatasetDetail]);

  // Data refresh updates summaries and detail independently of dashboard drafts.
  useEffect(() => {
    let cancelled = false;
    const refreshDatasets = async (event?: Event) => {
      const affected = (event as CustomEvent<{ projectId?: string }> | undefined)?.detail?.projectId;
      if (affected && affected !== projectId) return;
      const requestId = ++summaryRequest.current;
      try {
        const response = await api<{ datasets: DatasetSummary[] }>('/api/datasets?projectId=' + encodeURIComponent(projectId));
        if (cancelled || requestId !== summaryRequest.current) return;
        setDatasets(response.datasets);
        setDatasetRevision(r => r + 1);
      } catch (error) {
        if (!cancelled && requestId === summaryRequest.current) setDetailSnapshot(previous => ({ ...previous, error: error instanceof Error ? error.message : '数据刷新失败' }));
      }
    };
    window.addEventListener('app:datasets-changed', refreshDatasets);
    window.addEventListener('focus', refreshDatasets);
    return () => { cancelled = true; window.removeEventListener('app:datasets-changed', refreshDatasets); window.removeEventListener('focus', refreshDatasets); };
  }, [projectId]);

  // Evaluate cards through unified backend metric engine
  const activeCards = isEditingBoard ? draftCards : publishedCards;
  useEffect(() => {
    if (loading || !canConfigure) return;
    const id = new URLSearchParams(window.location.search).get('addMetric');
    if (!id || handledMetricIntent.current === id) return;
    handledMetricIntent.current = id; setPickerMetricId(id); setModalCard(null); setEditingCardIndex(null);
    setDraftCards(publishedCards); setIsEditingBoard(true); setShowMetricPicker(true);
    window.history.replaceState(null, '', '/projects/' + encodeURIComponent(projectId));
  }, [loading, canConfigure, projectId, publishedCards]);
  const metricKey = JSON.stringify({ projectId, selectedDatasetId, activeCards, datasetRevision });
  const currentMetrics = metricSnapshot.key === metricKey;
  const metricResults = currentMetrics ? metricSnapshot.results : {};
  const metricError = currentMetrics ? metricSnapshot.error : '';
  const evaluatingMetrics = activeCards.length > 0 && !currentMetrics;

  const evaluateCardsOnServer = useCallback(async (cardsToEval: DashboardCardConfig[]) => {
    const requestId = ++metricRequest.current;
    if (!cardsToEval.length) return;
    try {
      const res = await api<{ ok: boolean; metrics: MetricComputeResult[] }>('/api/metrics', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          cards: cardsToEval.map((c) => ({
            ...c,
            datasetId: c.datasetId || selectedDatasetId,
          })),
        }),
      });
      if (requestId !== metricRequest.current) return;
      if (res.metrics) {
        const resultsMap: Record<string, MetricComputeResult> = {};
        cardsToEval.forEach((c, idx) => {
          const key = c.id || `card-${idx}`;
          resultsMap[key] = res.metrics[idx];
        });
        setMetricSnapshot({ key: metricKey, results: resultsMap, error: '' });
      }
    } catch (error) {
      if (requestId === metricRequest.current) setMetricSnapshot({ key: metricKey, results: {}, error: error instanceof Error ? error.message : '指标计算失败' });
    }
  }, [projectId, selectedDatasetId, metricKey]);

  useEffect(() => {
    void evaluateCardsOnServer(activeCards);
  }, [activeCards, evaluateCardsOnServer, datasetRevision]);

  // Dataset switching guard
  function requestDatasetSwitch(dsId: string) {
    if (saveLock.current || dsId === selectedDatasetId) return;
    if (hasUnsavedChanges) {
      setPendingDatasetSwitch(dsId);
      setShowUnsavedDialog(true);
    } else {
      setSelectedDatasetId(dsId);
      setCurrentPage(1);
      setSearchTable('');
    }
  }

  // Only a confirmed server snapshot can advance a pending dataset or navigation.
  const saveDashboard = async (force = false): Promise<boolean> => {
    if (saveLock.current) return false;
    saveLock.current = true;
    setSavingBoard(true);
    const snapshot = draftCards.map((c, idx) => ({ id: c.id, title: c.title, type: c.type, metricKeys: c.metric ? [c.metric] : [], config: { ...c, datasetId: c.datasetId || selectedDatasetId }, sortOrder: idx }));
    try {
      const res = await api<{ ok: boolean; dashboardId: string; version: number; cards: Array<{ id: string; title: string; type: string; configJson: string; sortOrder: number }> }>('/api/dashboards', {
        method: 'POST', body: JSON.stringify({ projectId, dashboardId: dashboardId || 'dash-' + projectId + '-default', name: '默认工作台看板', version: dashboardVersion, force, cards: snapshot }),
      });
      const confirmed = res.cards.map(c => ({ ...JSON.parse(c.configJson), id: c.id, title: c.title, type: c.type, sortOrder: c.sortOrder } as DashboardCardConfig));
      setDashboardId(res.dashboardId);
      setDashboardVersion(res.version);
      setPublishedCards(confirmed);
      setDraftCards(confirmed);
      setIsEditingBoard(false);
      setConflictInfo(null);
      showToast('看板已成功保存并发布！', 'success');
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const version = Number(err.data?.serverVersion);
        if (Number.isFinite(version)) setConflictInfo({ serverVersion: version, localVersion: dashboardVersion });
        else showToast('看板冲突响应缺少服务器版本，请保留草稿并重试', 'error');
      } else showToast(err instanceof Error ? err.message : '保存看板失败', 'error');
      return false;
    } finally { saveLock.current = false; setSavingBoard(false); }
  };

  function completePendingSwitch() {
    setShowUnsavedDialog(false);
    if (pendingDatasetSwitch) { setSelectedDatasetId(pendingDatasetSwitch); setCurrentPage(1); setSearchTable(''); setPendingDatasetSwitch(null); }
    if (pendingNavigation) { const target = pendingNavigation; setPendingNavigation(null); allowNavigation.current = true; navigateTo(target); }
  }

  useEffect(() => {
    if (!hasUnsavedChanges && !savingBoard) return;
    const beforeUnload = (e: BeforeUnloadEvent) => { if (allowNavigation.current) return; e.preventDefault(); e.returnValue = ''; };
    const navigation = (e: Event) => {
      if (allowNavigation.current) return;
      const target = (e as CustomEvent<{ href: string }>).detail?.href;
      if (!target || target === window.location.pathname + window.location.search) return;
      e.preventDefault();
      if (!saveLock.current) { setPendingNavigation(target); setShowUnsavedDialog(true); }
    };
    const linkClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest?.('a[href]');
      if (!anchor || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || anchor.getAttribute('target') === '_blank') return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      e.preventDefault(); e.stopPropagation();
      if (!saveLock.current) { setPendingNavigation(href); setShowUnsavedDialog(true); }
    };
    const protectedHref = window.location.pathname + window.location.search;
    const historyNavigation = (e: PopStateEvent) => {
      if (allowNavigation.current) { allowNavigation.current = false; return; }
      const target = window.location.pathname + window.location.search;
      if (target === protectedHref) return;
      // Restore the protected screen before route subscribers can unmount the draft.
      e.stopImmediatePropagation();
      window.history.pushState(null, '', protectedHref);
      if (!saveLock.current) { setPendingNavigation(target); setShowUnsavedDialog(true); }
    };
    const browserNavigation = (window as Window & { navigation?: EventTarget }).navigation;
    const traversal = (event: Event) => {
      const intent = event as Event & { navigationType?: string; destination?: { url: string } };
      if (intent.navigationType !== 'traverse' || !intent.cancelable || allowNavigation.current || !intent.destination) return;
      const target = new URL(intent.destination.url);
      event.preventDefault();
      if (!saveLock.current) { setPendingNavigation(target.pathname + target.search); setShowUnsavedDialog(true); }
    };
    browserNavigation?.addEventListener('navigate', traversal);
    window.addEventListener('popstate', historyNavigation, true);
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('app:before-navigate', navigation);
    document.addEventListener('click', linkClick, true);
    return () => { browserNavigation?.removeEventListener('navigate', traversal); window.removeEventListener('popstate', historyNavigation, true); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('app:before-navigate', navigation); document.removeEventListener('click', linkClick, true); };
  }, [hasUnsavedChanges, savingBoard]);

  function handleCancelEdit() {
    if (saveLock.current) return;
    setDraftCards(publishedCards);
    setIsEditingBoard(false);
  }

  function handleAddCardClick() {
    if (saveLock.current) return;
    setModalCard(null);
    setEditingCardIndex(null);
    setPickerMetricId(''); setShowMetricPicker(true);
  }

  function handleEditCardClick(index: number) {
    if (saveLock.current) return;
    setModalCard(draftCards[index]);
    setEditingCardIndex(index);
    if (draftCards[index].metricId) setShowMetricPicker(true); else setShowCardModal(true);
  }

  function handleSaveCardFromModal(savedCard: DashboardCardConfig) {
    if (saveLock.current) return;
    if (editingCardIndex !== null && editingCardIndex >= 0) {
      const next = [...draftCards];
      next[editingCardIndex] = savedCard;
      setDraftCards(next);
    } else {
      setDraftCards([...draftCards, savedCard]);
    }
    setShowCardModal(false);
    setShowMetricPicker(false);
    showToast('卡片已更新至本地草稿，请点击右上角「保存并发布看板」', 'info');
  }

  function handleRemoveCard(index: number) {
    if (saveLock.current) return;
    setDraftCards(draftCards.filter((_, i) => i !== index));
  }

  function handleMoveCard(index: number, delta: number) {
    if (saveLock.current) return;
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= draftCards.length) return;
    const next = [...draftCards];
    const temp = next[index];
    next[index] = next[nextIdx];
    next[nextIdx] = temp;
    setDraftCards(next);
  }

  const availableColumns = useMemo(() => {
    if (activeDataset?.columns?.length) {
      return activeDataset.columns;
    }
    if (activeDataset?.rows?.length) {
      return Object.keys(activeDataset.rows[0] || {}).map(key => ({ key, name: key, type: 'text' }));
    }
    return [];
  }, [activeDataset]);

  const totalPages = activeDataset?.pagination?.totalPages || 1;
  const totalCount = activeDataset?.pagination?.total ?? activeDataset?.rowCount ?? 0;
  const currentRows = activeDataset?.rows || [];

  if (loading) return <LoadingState text="正在获取工作台数据集与看板…" />;
  if (dataError) return <ErrorState error={dataError} onRetry={loadWorkspaceData} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header / View & Dataset Bar */}
      <div
        className="workbench-toolbar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 18px',
          background: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>当前业务数据集:</span>
          {datasets.length > 0 ? (
            <CustomSelect
              ariaLabel="当前业务数据集"
              disabled={savingBoard}
              value={selectedDatasetId}
              onChange={requestDatasetSwitch}
              options={datasets.map((d) => ({
                value: d.id,
                label: `${d.name} (${d.rowCount} 行)`,
                badge: cnTime(d.updatedAt),
              }))}
              style={{ width: 280 }}
            />
          ) : (
            <span style={{ fontSize: 13, color: '#94a3b8' }}>暂无导入数据集</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('board')}
              style={{
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'board' ? '#2563eb' : '#fff',
                color: viewMode === 'board' ? '#fff' : '#475569',
              }}
            >
              📊 看板视图
            </button>
            <button
              onClick={() => setViewMode('data')}
              style={{
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'data' ? '#2563eb' : '#fff',
                color: viewMode === 'data' ? '#fff' : '#475569',
              }}
            >
              📋 数据明细 ({totalCount} 行)
            </button>
          </div>

          {viewMode === 'board' && canConfigure && (
            <>
              {isEditingBoard ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    disabled={savingBoard}
                    onClick={handleAddCardClick}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: '1px solid #2563eb',
                      background: '#eff6ff',
                      color: '#2563eb',
                      cursor: 'pointer',
                    }}
                  >
                    ＋ 添加卡片
                  </button>
                  <button
                    disabled={savingBoard}
                    onClick={() => saveDashboard(false)}
                    style={{
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: 'none',
                      background: '#16a34a',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {savingBoard ? '正在发布…' : '✓ 保存并发布看板'}
                  </button>
                  <button
                    disabled={savingBoard}
                    onClick={handleCancelEdit}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    取消编辑
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setDraftCards(publishedCards);
                    setIsEditingBoard(true);
                  }}
                  style={{
                    padding: '6px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#1e293b',
                    cursor: 'pointer',
                  }}
                >
                  ⚙ 自定义看板卡片
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {metricError && <div role="alert">指标计算失败：{metricError}</div>}
      {evaluatingMetrics && <div role="status">正在重新计算指标…</div>}
      {detailError && <ErrorState error={detailError} onRetry={() => loadDatasetDetail(selectedDatasetId, currentPage, searchTable)} />}
      {viewMode === 'board' ? (
        <>
          {datasets.length === 0 ? (
            <EmptyState
              title="当前项目尚未接入通用数据集"
              text={canConfigure ? '接入业务表后，选择适用的指标与图表。飞书原表保持不变。' : '工作台由项目负责人接入数据。已有结果发布后会显示在这里。'}
              action={canConfigure ? (<Link
                  href={`/projects/${encodeURIComponent(projectId)}/settings?tab=data-sources`}
                  style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: 13 }}
                >
                  前往接入数据源 →
                </Link>) : undefined}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isEditingBoard && (
                <div style={{ padding: 12, background: '#fefce8', border: '1px solid #fef08a', borderRadius: 8, fontSize: 13, color: '#854d0e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>您正在编辑看板布局。您可以添加卡片、修改指标规则、调整顺序或删除卡片。修改完成后点击「保存并发布看板」。</span>
                  <span style={{ fontSize: 12, color: '#a16207' }}>版本: v{dashboardVersion}</span>
                </div>
              )}

              {activeCards.length === 0 ? (
                <EmptyState
                  title="当前看板未添加任何指标卡片"
                  text={!canConfigure ? '负责人尚未添加团队指标；您可以查看已接入的数据明细。' : isEditingBoard ? '点击上方「＋ 添加卡片」添加自定义业务度量卡片。' : '点击右上角「⚙ 自定义看板卡片」开始配置个性化指标。'}
                  action={
                    !canConfigure ? undefined : isEditingBoard ? (
                      <button
                        onClick={handleAddCardClick}
                        style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                      >
                        添加第一张卡片
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setDraftCards(publishedCards);
                          setIsEditingBoard(true);
                          handleAddCardClick();
                        }}
                        style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                      >
                        创建第一张卡片
                      </button>
                    )
                  }
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                  {activeCards.map((card, idx) => {
                    const cardKey = card.id || `card-${idx}`;
                    const metric = metricResults[cardKey];
                    const cardDataset = datasets.find((d) => d.id === (card.datasetId || selectedDatasetId));

                    return (
                      <CardRenderView
                        key={cardKey}
                        card={card}
                        metric={metric}
                        index={idx}
                        totalCards={activeCards.length}
                        isEditing={isEditingBoard && !savingBoard}
                        onMove={(delta) => handleMoveCard(idx, delta)}
                        onEdit={() => handleEditCardClick(idx)}
                        onRemove={() => handleRemoveCard(idx)}
                        datasetName={cardDataset?.name}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Data Detail View with Server-Side Pagination and Search */
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>数据集记录明细</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                查看已从飞书表格同步的结构化原始数据，服务端全量检索与分页。
              </p>
            </div>
            <input
              type="text"
              placeholder="全量搜索记录关键字…"
              value={searchTable}
              onChange={(e) => {
                setSearchTable(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 220, padding: '7px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
            />
          </div>

          {!currentRows.length ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>没有匹配的数据记录</div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 12px', color: '#64748b' }}>#</th>
                    {availableColumns.map((col) => (
                      <th key={col.key} style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentRows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                        {(currentPage - 1) * pageSize + rIdx + 1}
                      </td>
                      {availableColumns.map((col) => (
                        <td key={col.key} style={{ padding: '8px 12px', color: '#1e293b' }}>
                          {String(row[col.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              共 {totalCount} 条记录 · 第 {currentPage} / {totalPages} 页
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: currentPage <= 1 ? 'default' : 'pointer' }}
              >
                上一页
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: currentPage >= totalPages ? 'default' : 'pointer' }}
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Creation / Editing Modal */}
      {showMetricPicker && <MetricCardPicker projectId={projectId} metricId={pickerMetricId} initialCard={modalCard} onClose={() => setShowMetricPicker(false)} onSave={handleSaveCardFromModal}
        onAdvanced={config => { setShowMetricPicker(false); setModalCard(config || null); setShowCardModal(true); }}
        onNew={() => { setShowMetricPicker(false); navigateTo('/projects/' + encodeURIComponent(projectId) + '/metrics?new=true&datasetId=' + encodeURIComponent(selectedDatasetId)); }} />}
      {showCardModal && (
        <CardEditModal
          projectId={projectId}
          initialCard={modalCard}
          datasets={datasets}
          defaultDatasetId={selectedDatasetId}
          onSave={handleSaveCardFromModal}
          onClose={() => setShowCardModal(false)}
        />
      )}

      {/* Unsaved Changes Warning Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        busy={savingBoard}
        onSave={async () => { if (await saveDashboard(false)) completePendingSwitch(); }}
        onDiscard={() => { if (saveLock.current) return; setDraftCards(publishedCards); setIsEditingBoard(false); completePendingSwitch(); }}
        onCancel={() => { if (saveLock.current) return; setShowUnsavedDialog(false); setPendingDatasetSwitch(null); setPendingNavigation(null); }}
      />

      {/* 409 Concurrency Conflict Dialog */}
      <ConflictResolutionDialog
        open={Boolean(conflictInfo)}
        serverVersion={conflictInfo?.serverVersion ?? dashboardVersion}
        localVersion={conflictInfo?.localVersion || dashboardVersion}
        onReload={() => {
          setConflictInfo(null);
          setShowUnsavedDialog(false);
          setPendingDatasetSwitch(null);
          setPendingNavigation(null);
          setIsEditingBoard(false);
          void loadWorkspaceData();
        }}
        busy={savingBoard}
        onForceSave={async () => { if (await saveDashboard(true)) completePendingSwitch(); }}
        onCancel={() => setConflictInfo(null)}
      />
    </div>
  );
}
