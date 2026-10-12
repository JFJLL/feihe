'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Project } from '../../lib/types/project';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { api, cnTime } from '../../lib/hooks/use-project-data';
import { useProject } from '../../components/project-shell/ProjectContext';
import Link from '../../components/ui/AppLink';

interface DatasetSummary {
  id: string;
  name: string;
  rowCount: number;
  columns?: Array<{ key: string; name: string; type: string }>;
  updatedAt: string;
}

interface DashboardCardConfig {
  id?: string;
  title: string;
  type: 'metric_card' | 'progress_card' | 'breakdown';
  metric?: string;
  field?: string;
  numField?: string;
  denField?: string;
  groupBy?: string;
  unit?: string;
  desc?: string;
  sortOrder?: number;
}

export function isStatusCompleted(status: unknown): boolean {
  const s = String(status ?? '').trim();
  if (!s) return false;
  if (/^(未完成|尚未完成|未开始|待开始|进行中|排队中|待处理|异常|失败)$/i.test(s) || /未完成|尚未完成|not done|unfinished/i.test(s)) {
    return false;
  }
  return /^(已完成|完成|done|finished|已达成|已结项|外显成功|已外显)$/i.test(s) || /^完成$/i.test(s);
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
  const [activeDataset, setActiveDataset] = useState<{ id: string; name: string; columns: any[]; rows: Array<Record<string, unknown>> } | null>(null);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<'board' | 'data'>('board');
  const [isEditingBoard, setIsEditingBoard] = useState(false);
  const [dashboardVersion, setDashboardVersion] = useState<number>(1);
  const [dashboardId, setDashboardId] = useState<string>('');
  const [cards, setCards] = useState<DashboardCardConfig[]>([]);
  const [savingBoard, setSavingBoard] = useState(false);

  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState<DashboardCardConfig>({
    title: '新增指标卡',
    type: 'metric_card',
    metric: 'custom',
    field: '',
    unit: '',
  });

  const [searchTable, setSearchTable] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const loadWorkspaceData = useCallback(async () => {
    setLoading(true);
    try {
      const [dsRes, dashRes] = await Promise.all([
        api<{ ok: boolean; datasets: DatasetSummary[] }>(`/api/datasets?projectId=${encodeURIComponent(projectId)}`),
        api<{
          ok: boolean;
          dashboards: Array<{ id: string; version: number; name: string }>;
          cards: Array<{ id: string; title: string; type: string; configJson: string; sortOrder: number }>;
        }>(`/api/dashboards?projectId=${encodeURIComponent(projectId)}`),
      ]);

      const dsList = dsRes.datasets || [];
      setDatasets(dsList);

      const chosenDsId = selectedDatasetId || (dsList[0]?.id ?? '');
      setSelectedDatasetId(chosenDsId);

      if (chosenDsId) {
        const detail = await api<{ ok: boolean; dataset: { id: string; name: string; columns: any[]; rows: Array<Record<string, unknown>> } }>(
          `/api/datasets?projectId=${encodeURIComponent(projectId)}&id=${encodeURIComponent(chosenDsId)}`
        );
        if (detail.dataset) setActiveDataset(detail.dataset);
      } else {
        setActiveDataset(null);
      }

      if (dashRes.dashboards?.length) {
        const defaultDash = dashRes.dashboards[0];
        setDashboardId(defaultDash.id);
        setDashboardVersion(defaultDash.version || 1);
      }
      if (dashRes.cards?.length) {
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
        setCards(parsedCards);
      } else {
        setCards([
          { title: '任务总数', type: 'metric_card', metric: 'task_total', unit: '项' },
          { title: '已完成项', type: 'metric_card', metric: 'task_completed', unit: '项' },
          { title: '任务完成率', type: 'progress_card', metric: 'task_completion_rate', unit: '%' },
          { title: '预算执行率', type: 'progress_card', metric: 'budget_spent_rate', unit: '%' },
        ]);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedDatasetId]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);
  const handleSelectDataset = async (dsId: string) => {
    setSelectedDatasetId(dsId);
    if (!dsId) {
      setActiveDataset(null);
      return;
    }
    try {
      const detail = await api<{ ok: boolean; dataset: { id: string; name: string; columns: any[]; rows: Array<Record<string, unknown>> } }>(
        `/api/datasets?projectId=${encodeURIComponent(projectId)}&id=${encodeURIComponent(dsId)}`
      );
      if (detail.dataset) setActiveDataset(detail.dataset);
    } catch {}
  };

  const rows = activeDataset?.rows || [];

  const evaluateCard = (card: DashboardCardConfig) => {
    if (!rows.length) {
      return { val: '—', num: 0, den: 0, rate: 0, groups: [] };
    }

    if (card.metric === 'task_total') {
      return { val: String(rows.length), num: rows.length, den: rows.length, rate: 100, groups: [] };
    }

    if (card.metric === 'task_completed') {
      const c = rows.filter((r) => isStatusCompleted(r.status || r['状态'] || r.state)).length;
      return { val: String(c), num: c, den: rows.length, rate: rows.length > 0 ? (c / rows.length) * 100 : 0, groups: [] };
    }

    if (card.metric === 'task_completion_rate') {
      const c = rows.filter((r) => isStatusCompleted(r.status || r['状态'] || r.state)).length;
      const rate = rows.length > 0 ? ((c / rows.length) * 100).toFixed(1) + '%' : '—';
      return { val: rate, num: c, den: rows.length, rate: rows.length > 0 ? (c / rows.length) * 100 : 0, groups: [] };
    }

    if (card.metric === 'budget_total') {
      const total = rows.reduce((acc, r) => acc + (Number(String(r.budget ?? r['预算'] ?? 0).replace(/[,￥¥%]/g, '')) || 0), 0);
      return { val: `¥${total.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`, num: total, den: 0, rate: 0, groups: [] };
    }

    if (card.metric === 'spent_total') {
      const total = rows.reduce((acc, r) => acc + (Number(String(r.spent ?? r.actual_spent ?? r['实际支出'] ?? 0).replace(/[,￥¥%]/g, '')) || 0), 0);
      return { val: `¥${total.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`, num: total, den: 0, rate: 0, groups: [] };
    }

    if (card.metric === 'budget_spent_rate') {
      const b = rows.reduce((acc, r) => acc + (Number(String(r.budget ?? r['预算'] ?? 0).replace(/[,￥¥%]/g, '')) || 0), 0);
      const s = rows.reduce((acc, r) => acc + (Number(String(r.spent ?? r.actual_spent ?? r['实际支出'] ?? 0).replace(/[,￥¥%]/g, '')) || 0), 0);
      const rate = b > 0 ? ((s / b) * 100).toFixed(1) + '%' : '—';
      return { val: rate, num: s, den: b, rate: b > 0 ? (s / b) * 100 : 0, groups: [] };
    }

    if (card.metric === 'consultation_total') {
      const sum = rows.reduce((acc, r) => acc + (Number(String(r['咨询人数'] ?? r.inquiries ?? 0).replace(/[,￥¥%]/g, '')) || 0), 0);
      return { val: String(sum), num: sum, den: 0, rate: 0, groups: [] };
    }

    if (card.metric === 'conversion_total') {
      const sum = rows.reduce((acc, r) => acc + (Number(String(r['成交人数'] ?? r.orders ?? 0).replace(/[,￥¥%]/g, '')) || 0), 0);
      return { val: String(sum), num: sum, den: 0, rate: 0, groups: [] };
    }

    if (card.metric === 'conversion_rate' || (card.numField && card.denField)) {
      const numF = card.numField || '成交人数';
      const denF = card.denField || '咨询人数';
      const numSum = rows.reduce((acc, r) => acc + (Number(String(r[numF] ?? 0).replace(/[,￥¥%]/g, '')) || 0), 0);
      const denSum = rows.reduce((acc, r) => acc + (Number(String(r[denF] ?? 0).replace(/[,￥¥%]/g, '')) || 0), 0);
      const rate = denSum > 0 ? ((numSum / denSum) * 100).toFixed(1) + '%' : '—';

      let groups: Array<{ label: string; pct: number; count: number }> = [];
      if (card.groupBy) {
        const gMap = new Map<string, { n: number; d: number }>();
        for (const r of rows) {
          const g = String(r[card.groupBy] || '其他');
          const nv = Number(String(r[numF] ?? 0).replace(/[,￥¥%]/g, '')) || 0;
          const dv = Number(String(r[denF] ?? 0).replace(/[,￥¥%]/g, '')) || 0;
          const entry = gMap.get(g) || { n: 0, d: 0 };
          entry.n += nv;
          entry.d += dv;
          gMap.set(g, entry);
        }
        groups = Array.from(gMap.entries()).map(([label, st]) => ({
          label,
          pct: st.d > 0 ? (st.n / st.d) * 100 : 0,
          count: st.n,
        }));
      }

      return { val: rate, num: numSum, den: denSum, rate: denSum > 0 ? (numSum / denSum) * 100 : 0, groups };
    }

    if (card.field) {
      const f = card.field;
      const sum = rows.reduce((acc, r) => acc + (Number(String(r[f] ?? 0).replace(/[,￥¥%]/g, '')) || 0), 0);
      return { val: String(sum), num: sum, den: 0, rate: 0, groups: [] };
    }

    return { val: '0', num: 0, den: 0, rate: 0, groups: [] };
  };
  const saveDashboard = async () => {
    setSavingBoard(true);
    try {
      const res = await api<{ ok: boolean; version: number }>(`/api/dashboards`, {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          dashboardId: dashboardId || `dash-${projectId}-default`,
          name: '默认工作台看板',
          version: dashboardVersion,
          cards: cards.map((c, idx) => ({
            id: c.id,
            title: c.title,
            type: c.type,
            metricKeys: c.metric ? [c.metric] : [],
            config: {
              metric: c.metric,
              field: c.field,
              numField: c.numField,
              denField: c.denField,
              groupBy: c.groupBy,
              unit: c.unit,
              desc: c.desc,
            },
            sortOrder: idx,
          })),
        }),
      });
      setDashboardVersion(res.version);
      showToast('看板已保存并发布！', 'success');
      setIsEditingBoard(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存看板失败', 'error');
    } finally {
      setSavingBoard(false);
    }
  };

  const handleRemoveCard = (index: number) => {
    setCards(cards.filter((_, i) => i !== index));
  };

  const handleMoveCard = (index: number, delta: number) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= cards.length) return;
    const newCards = [...cards];
    const temp = newCards[index];
    newCards[index] = newCards[nextIdx];
    newCards[nextIdx] = temp;
    setCards(newCards);
  };

  const availableColumns = useMemo(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0] || {});
  }, [rows]);

  const handleAddCardSubmit = () => {
    if (!newCard.title) {
      showToast('请填写卡片标题', 'error');
      return;
    }
    setCards([...cards, { ...newCard, id: `card-user-${Date.now()}` }]);
    setShowAddCard(false);
    showToast('卡片已添加到草稿，请点击「保存并发布看板」使其生效', 'info');
  };

  const filteredRows = useMemo(() => {
    if (!searchTable.trim()) return rows;
    const q = searchTable.toLowerCase();
    return rows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [rows, searchTable]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) return <LoadingState text="正在获取工作台数据集与看板…" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
              onChange={handleSelectDataset}
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
              📋 数据明细 ({rows.length} 行)
            </button>
          </div>

          {viewMode === 'board' && (
            <>
              {isEditingBoard ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setShowAddCard(true)}
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
                    onClick={saveDashboard}
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
                    onClick={() => setIsEditingBoard(false)}
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
                  onClick={() => setIsEditingBoard(true)}
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
                  <span>您正在编辑看板布局。您可以添加卡片、调整卡片顺序或删除不适用的指标卡。修改完成后请点击右上角「保存并发布看板」。</span>
                  <span style={{ fontSize: 12, color: '#a16207' }}>当前版本: v{dashboardVersion}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                {cards.map((card, idx) => {
                  const ev = evaluateCard(card);

                  return (
                    <div
                      key={card.id || idx}
                      style={{
                        background: '#fff',
                        borderRadius: 12,
                        border: isEditingBoard ? '2px dashed #93c5fd' : '1px solid #e2e8f0',
                        padding: '20px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                      }}
                    >
                      {isEditingBoard && (
                        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveCard(idx, -1)}
                            title="前移"
                            style={{ padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.4 : 1 }}
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            disabled={idx === cards.length - 1}
                            onClick={() => handleMoveCard(idx, 1)}
                            title="后移"
                            style={{ padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: idx === cards.length - 1 ? 'default' : 'pointer', opacity: idx === cards.length - 1 ? 0.4 : 1 }}
                          >
                            →
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveCard(idx)}
                            title="删除卡片"
                            style={{ padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #fca5a5', background: '#fee2e2', color: '#ef4444', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      <div>
                        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{card.title}</span>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', margin: '8px 0 4px' }}>
                          {ev.val} {card.unit && !ev.val.endsWith(card.unit) && !ev.val.endsWith('%') && !ev.val.startsWith('¥') ? <small style={{ fontSize: 14, fontWeight: 500, color: '#64748b' }}>{card.unit}</small> : null}
                        </div>

                        {card.type === 'progress_card' && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, Math.max(0, ev.rate))}%`, height: '100%', background: '#16a34a', borderRadius: 3 }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 4 }}>
                              <span>分子: {ev.num.toLocaleString()}</span>
                              <span>分母: {ev.den.toLocaleString()}</span>
                            </div>
                          </div>
                        )}

                        {ev.groups && ev.groups.length > 0 && (
                          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {ev.groups.slice(0, 4).map((g) => (
                              <div key={g.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                <span style={{ color: '#475569' }}>{g.label}</span>
                                <strong style={{ color: '#0f172a' }}>{g.pct.toFixed(1)}% ({g.count}人)</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                        <span>来源: {activeDataset?.name || '当前数据集'}</span>
                        <span>样本量: {rows.length} 行</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>数据集记录明细</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>查看已从飞书表格同步的结构化原始数据，支持搜索与分页。</p>
            </div>
            <input
              type="text"
              placeholder="搜索记录关键字…"
              value={searchTable}
              onChange={(e) => { setSearchTable(e.target.value); setCurrentPage(1); }}
              style={{ width: 220, padding: '7px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
            />
          </div>

          {!filteredRows.length ? (
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
                  {pagedRows.map((row, rIdx) => (
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
              共 {filteredRows.length} 条记录 · 第 {currentPage} / {totalPages} 页
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

      {showAddCard && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 480, width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 700 }}>添加看板指标卡</h3>
              <button onClick={() => setShowAddCard(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                卡片标题
                <input
                  value={newCard.title}
                  onChange={(e) => setNewCard({ ...newCard, title: e.target.value })}
                  style={{ height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                展示类型
                <CustomSelect
                  value={newCard.type}
                  onChange={(val: any) => setNewCard({ ...newCard, type: val })}
                  options={[
                    { value: 'metric_card', label: '单值指标卡 (数值/金额)' },
                    { value: 'progress_card', label: '达成进度卡 (比率/进度条)' },
                    { value: 'breakdown', label: '分组对比卡 (按维度细分)' },
                  ]}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                指标模板
                <CustomSelect
                  value={newCard.metric || 'custom'}
                  onChange={(val) => {
                    let defaultTitle = newCard.title;
                    let defaultType = newCard.type;
                    if (val === 'task_completion_rate') { defaultTitle = '任务完成率'; defaultType = 'progress_card'; }
                    if (val === 'conversion_rate') { defaultTitle = '成交转化率'; defaultType = 'progress_card'; }
                    if (val === 'consultation_total') { defaultTitle = '总咨询人数'; defaultType = 'metric_card'; }
                    if (val === 'conversion_total') { defaultTitle = '总成交人数'; defaultType = 'metric_card'; }
                    setNewCard({ ...newCard, metric: val, title: defaultTitle, type: defaultType });
                  }}
                  options={[
                    { value: 'task_completion_rate', label: '任务完成率 (已完成 / 任务总数)' },
                    { value: 'conversion_rate', label: '成交率 (成交人数 / 咨询人数)' },
                    { value: 'consultation_total', label: '总咨询人数 (咨询人数合计)' },
                    { value: 'conversion_total', label: '总成交人数 (成交人数合计)' },
                    { value: 'budget_spent_rate', label: '预算执行率 (支出 / 预算)' },
                    { value: 'custom_field', label: '自定义字段求和' },
                  ]}
                />
              </label>

              {newCard.metric === 'custom_field' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                  选择求和字段
                  <CustomSelect
                    value={newCard.field || ''}
                    onChange={(val) => setNewCard({ ...newCard, field: val })}
                    options={availableColumns.map((c) => ({ value: c, label: c }))}
                  />
                </label>
              )}

              {newCard.type === 'breakdown' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                  细分维度 (分组依据)
                  <CustomSelect
                    value={newCard.groupBy || ''}
                    onChange={(val) => setNewCard({ ...newCard, groupBy: val })}
                    options={availableColumns.map((c) => ({ value: c, label: c }))}
                  />
                </label>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                单位 (选填)
                <input
                  value={newCard.unit || ''}
                  placeholder="如：人、元、%、项"
                  onChange={(e) => setNewCard({ ...newCard, unit: e.target.value })}
                  style={{ height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setShowAddCard(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13 }}
              >
                取消
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleAddCardSubmit}
                style={{ padding: '8px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                加入看板
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}