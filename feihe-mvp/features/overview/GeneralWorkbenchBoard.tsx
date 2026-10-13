'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Project } from '../../lib/types/project';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { api, cnTime } from '../../lib/hooks/use-project-data';
import { useProject } from '../../components/project-shell/ProjectContext';
import Link from '../../components/ui/AppLink';
import { CardEditModal, type DashboardCardConfig } from './CardEditModal';
import { CardRenderView } from './CardRenderView';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { ConflictResolutionDialog } from './ConflictResolutionDialog';

interface DatasetSummary {
  id: string;
  name: string;
  rowCount: number;
  columns?: Array<{ key: string; name: string; type: string }>;
  updatedAt: string;
}

export function GeneralWorkbenchBoard({
  projectId,
  project,
}: {
  projectId: string;
  project?: Project;
}) {
  const { showToast } = useProject();
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [activeDataset, setActiveDataset] = useState<{
    id: string;
    name: string;
    columns: Array<{ key: string; name: string; type: string }>;
    rowCount: number;
    rows: Array<Record<string, unknown>>;
    pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  } | null>(null);

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

  // Card modal state
  const [modalCard, setModalCard] = useState<DashboardCardConfig | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null);

  // Unsaved changes & conflict dialogs
  const [pendingDatasetSwitch, setPendingDatasetSwitch] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<{ serverVersion: number; localVersion: number } | null>(null);

  // Metric evaluation results
  const [metricResults, setMetricResults] = useState<Record<string, any>>({});
  const [evaluatingMetrics, setEvaluatingMetrics] = useState(false);

  // Table pagination and search
  const [searchTable, setSearchTable] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const hasUnsavedChanges = useMemo(() => {
    return isEditingBoard && JSON.stringify(draftCards) !== JSON.stringify(publishedCards);
  }, [isEditingBoard, draftCards, publishedCards]);

  // Load datasets and dashboard configuration
  const loadWorkspaceData = useCallback(async () => {
    setLoading(true);
    setDataError('');
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

      const dsList = dsRes.datasets || [];
      setDatasets(dsList);

      const chosenDsId = selectedDatasetId || dsList[0]?.id || '';
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
          let conf: any = {};
          try { conf = JSON.parse(c.configJson || '{}'); } catch {}
          return {
            id: c.id,
            title: c.title,
            type: (c.type as any) || 'metric_card',
            ...conf,
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
      setDataError(err instanceof Error ? err.message : '获取工作台数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedDatasetId]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Load active dataset rows with server-side pagination & search
  const loadDatasetDetail = useCallback(async (dsId: string, page = 1, search = '') => {
    if (!dsId) {
      setActiveDataset(null);
      return;
    }
    try {
      const url = `/api/datasets?projectId=${encodeURIComponent(projectId)}&id=${encodeURIComponent(dsId)}&page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`;
      const detail = await api<{ ok: boolean; dataset: any }>(url);
      if (detail.dataset) {
        setActiveDataset(detail.dataset);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '加载数据集记录失败', 'error');
    }
  }, [projectId, showToast]);

  useEffect(() => {
    if (selectedDatasetId) {
      void loadDatasetDetail(selectedDatasetId, currentPage, searchTable);
    }
  }, [selectedDatasetId, currentPage, searchTable, loadDatasetDetail]);

  // Evaluate cards through unified backend metric engine
  const activeCards = isEditingBoard ? draftCards : publishedCards;

  const evaluateCardsOnServer = useCallback(async (cardsToEval: DashboardCardConfig[]) => {
    if (!cardsToEval.length) {
      setMetricResults({});
      return;
    }
    setEvaluatingMetrics(true);
    try {
      const res = await api<{ ok: boolean; metrics: any[] }>('/api/metrics', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          cards: cardsToEval.map((c) => ({
            ...c,
            datasetId: c.datasetId || selectedDatasetId,
          })),
        }),
      });
      if (res.metrics) {
        const resultsMap: Record<string, any> = {};
        cardsToEval.forEach((c, idx) => {
          const key = c.id || `card-${idx}`;
          resultsMap[key] = res.metrics[idx];
        });
        setMetricResults(resultsMap);
      }
    } catch {}
    finally {
      setEvaluatingMetrics(false);
    }
  }, [projectId, selectedDatasetId]);

  useEffect(() => {
    void evaluateCardsOnServer(activeCards);
  }, [activeCards, evaluateCardsOnServer]);

  // Dataset switching guard
  function requestDatasetSwitch(dsId: string) {
    if (hasUnsavedChanges) {
      setPendingDatasetSwitch(dsId);
      setShowUnsavedDialog(true);
    } else {
      setSelectedDatasetId(dsId);
      setCurrentPage(1);
      setSearchTable('');
    }
  }

  // Save Dashboard with version lock
  const saveDashboard = async (force = false) => {
    setSavingBoard(true);
    try {
      const res = await api<{ ok: boolean; version: number; conflict?: boolean; serverVersion?: number }>(
        `/api/dashboards`,
        {
          method: 'POST',
          body: JSON.stringify({
            projectId,
            dashboardId: dashboardId || `dash-${projectId}-default`,
            name: '默认工作台看板',
            version: dashboardVersion,
            force,
            cards: draftCards.map((c, idx) => ({
              id: c.id,
              title: c.title,
              type: c.type,
              metricKeys: c.metric ? [c.metric] : [],
              config: {
                datasetId: c.datasetId || selectedDatasetId,
                metric: c.metric,
                aggregation: c.aggregation,
                field: c.field,
                numField: c.numField,
                denField: c.denField,
                groupBy: c.groupBy,
                dateField: c.dateField,
                unit: c.unit,
                format: c.format,
                desc: c.desc,
              },
              sortOrder: idx,
            })),
          }),
        }
      );

      setDashboardVersion(res.version);
      setPublishedCards(draftCards);
      showToast('看板已成功保存并发布！', 'success');
      setIsEditingBoard(false);
      setConflictInfo(null);
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('冲突') || err.message?.includes('409')) {
        setConflictInfo({
          serverVersion: dashboardVersion + 1,
          localVersion: dashboardVersion,
        });
      } else {
        showToast(err instanceof Error ? err.message : '保存看板失败', 'error');
      }
    } finally {
      setSavingBoard(false);
    }
  };

  function handleCancelEdit() {
    setDraftCards(publishedCards);
    setIsEditingBoard(false);
  }

  function handleAddCardClick() {
    setModalCard(null);
    setEditingCardIndex(null);
    setShowCardModal(true);
  }

  function handleEditCardClick(index: number) {
    setModalCard(draftCards[index]);
    setEditingCardIndex(index);
    setShowCardModal(true);
  }

  function handleSaveCardFromModal(savedCard: DashboardCardConfig) {
    if (editingCardIndex !== null && editingCardIndex >= 0) {
      const next = [...draftCards];
      next[editingCardIndex] = savedCard;
      setDraftCards(next);
    } else {
      setDraftCards([...draftCards, savedCard]);
    }
    setShowCardModal(false);
    showToast('卡片已更新至本地草稿，请点击右上角「保存并发布看板」', 'info');
  }

  function handleRemoveCard(index: number) {
    setDraftCards(draftCards.filter((_, i) => i !== index));
  }

  function handleMoveCard(index: number, delta: number) {
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
      return activeDataset.columns.map((c) => c.name || c.key);
    }
    if (activeDataset?.rows?.length) {
      return Object.keys(activeDataset.rows[0] || {});
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

          {viewMode === 'board' && (
            <>
              {isEditingBoard ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
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

      {viewMode === 'board' ? (
        <>
          {datasets.length === 0 ? (
            <EmptyState
              title="当前项目尚未接入通用数据集"
              text="请进入项目设置中的「数据源」配置并同步飞书表格，即可生成动态业务度量看板。"
              action={
                <Link
                  href={`/projects/${encodeURIComponent(projectId)}/settings?tab=data-sources`}
                  style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: 13 }}
                >
                  前往接入数据源 →
                </Link>
              }
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
                  text={isEditingBoard ? '点击上方「＋ 添加卡片」添加自定义业务度量卡片。' : '点击右上角「⚙ 自定义看板卡片」开始配置个性化指标。'}
                  action={
                    isEditingBoard ? (
                      <button
                        onClick={handleAddCardClick}
                        style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                      >
                        ＋ 添加卡片
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setDraftCards(publishedCards);
                          setIsEditingBoard(true);
                        }}
                        style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                      >
                        ⚙ 自定义看板卡片
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
                        isEditing={isEditingBoard}
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
                      <th key={col} style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>
                        {col}
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
                        <td key={col} style={{ padding: '8px 12px', color: '#1e293b' }}>
                          {String(row[col] ?? '—')}
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
      {showCardModal && (
        <CardEditModal
          projectId={projectId}
          initialCard={modalCard}
          datasets={datasets}
          onSave={handleSaveCardFromModal}
          onClose={() => setShowCardModal(false)}
        />
      )}

      {/* Unsaved Changes Warning Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onSave={async () => {
          await saveDashboard(false);
          setShowUnsavedDialog(false);
          if (pendingDatasetSwitch) {
            setSelectedDatasetId(pendingDatasetSwitch);
            setPendingDatasetSwitch(null);
            setCurrentPage(1);
          }
        }}
        onDiscard={() => {
          setDraftCards(publishedCards);
          setIsEditingBoard(false);
          setShowUnsavedDialog(false);
          if (pendingDatasetSwitch) {
            setSelectedDatasetId(pendingDatasetSwitch);
            setPendingDatasetSwitch(null);
            setCurrentPage(1);
          }
        }}
        onCancel={() => {
          setShowUnsavedDialog(false);
          setPendingDatasetSwitch(null);
        }}
      />

      {/* 409 Concurrency Conflict Dialog */}
      <ConflictResolutionDialog
        open={Boolean(conflictInfo)}
        serverVersion={conflictInfo?.serverVersion || dashboardVersion + 1}
        localVersion={conflictInfo?.localVersion || dashboardVersion}
        onReload={() => {
          setConflictInfo(null);
          void loadWorkspaceData();
        }}
        onForceSave={() => {
          setConflictInfo(null);
          void saveDashboard(true);
        }}
        onCancel={() => setConflictInfo(null)}
      />
    </div>
  );
}
