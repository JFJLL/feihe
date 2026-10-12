'use client';

import { useState, useEffect, useCallback } from 'react';
import { FeishuSources, SyncButton } from '../../../components/ui/FeishuSources';
import type { FeishuData } from '../../../lib/feishu-model';
import type { Source, Workspace } from '../../../lib/types/project';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { MetricCard } from '../../../components/ui/operations/MetricCard';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { api, cnTime } from '../../../lib/hooks/use-project-data';

const emptySource: Record<string, unknown> = {
  name: '业务数据表',
  type: 'feishu_sheet',
  spreadsheet: '',
  sheetId: '',
  range: 'A1:AZ5000',
  kind: 'general',
  syncFrequency: 'manual',
  mappingJson: '{}',
};

export function SettingsDataSources({
  projectId,
  workspace,
  onDone,
  toast,
}: {
  projectId: string;
  workspace: Workspace | null;
  onDone: () => Promise<void>;
  toast: (v: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [source, setSource] = useState<Record<string, unknown>>(emptySource);
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState('');
  const [feishu, setFeishu] = useState<FeishuData>();
  const [statusError, setStatusError] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [detectedSheets, setDetectedSheets] = useState<Array<{ sheetId: string; title: string; rowCount?: number }>>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: async () => {},
  });

  const loadSources = useCallback(async () => {
    try {
      const data = await api<FeishuData>(`/api/feishu/sync?projectId=${encodeURIComponent(projectId)}`);
      setFeishu(data);
      setStatusError('');
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : '同步状态加载失败');
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    api<FeishuData>(`/api/feishu/sync?projectId=${encodeURIComponent(projectId)}`).then(data => {
      if (!cancelled) setFeishu(data);
    }).catch((e) => { if (!cancelled) setStatusError(e instanceof Error ? e.message : '同步状态加载失败'); });
    return () => { cancelled = true; };
  }, [projectId]);

  const sources = (workspace?.sources || []).filter((item) => item.projectId === projectId);
  const currentProject = workspace?.projects.find((item) => item.id === projectId);
  const syncedSources = sources.filter(item => item.lastSyncedAt);
  const failedSources = sources.filter(item => item.lastError);
  const latestSync = syncedSources.map(item => item.lastSyncedAt).sort().at(-1);

  async function handleInspectLink() {
    const url = String(source.spreadsheet || '').trim();
    if (!url) {
      toast('请先粘贴飞书表格链接', 'error');
      return;
    }
    setInspecting(true);
    try {
      const res = await api<{ ok: boolean; detected: { type: string; spreadsheetToken?: string; sheetId?: string; sheets?: Array<{ sheetId: string; title: string; rowCount: number }> } }>('/api/feishu/inspect', {
        method: 'POST',
        body: JSON.stringify({ url, projectId }),
      });
      if (res.detected) {
        toast('链接解析成功', 'success');
        if (res.detected.sheets && res.detected.sheets.length > 0) {
          setDetectedSheets(res.detected.sheets);
          if (!source.sheetId && res.detected.sheets[0]) {
            setSource((prev) => ({ ...prev, sheetId: res.detected.sheets![0].sheetId, name: prev.name || res.detected.sheets![0].title }));
          }
        }
        if (res.detected.sheetId) {
          setSource((prev) => ({ ...prev, sheetId: res.detected.sheetId }));
        }
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '检测链接失败', 'error');
    } finally {
      setInspecting(false);
    }
  }

  async function saveSource() {
    setBusy('source');
    try {
      await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ action: 'save_source', projectId, ...source }),
      });
      toast('数据源已保存', 'success');
      setSource(emptySource);
      setIsAdding(false);
      setDetectedSheets([]);
      await onDone();
      await loadSources();
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setBusy('');
    }
  }

  async function syncSource(item: Source) {
    setBusy(item.id);
    try {
      await api('/api/feishu/sync', {
        method: 'POST',
        body: JSON.stringify({ ...item, projectId: item.projectId, sourceId: item.id }),
      });
      toast(item.name + ' 同步完成', 'success');
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : '同步失败', 'error');
    } finally {
      setBusy('');
      await loadSources();
    }
  }

  function removeSource(item: Source) {
    setConfirmDialog({
      open: true,
      title: `移除数据源“${item.name}”`,
      description: '移除数据源后，系统将停止对该表格的同步。历史已导入的业务数据将予以保留。',
      onConfirm: async () => {
        setBusy(item.id);
        try {
          await api('/api/projects', {
            method: 'POST',
            body: JSON.stringify({ action: 'remove_source', projectId: item.projectId, id: item.id }),
          });
          toast('数据源已移除', 'success');
          await onDone();
          await loadSources();
        } catch (err) {
          toast(err instanceof Error ? err.message : '移除失败', 'error');
        } finally {
          setBusy('');
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  }

  return (
    <div className="stack">
      <section className="ops-metric-grid" aria-label="项目数据源同步概况">
        <MetricCard label="已配置数据源" value={workspace ? sources.length : '—'} unit="个" theme="blue" desc="当前项目手动登记的数据源，不含内置工作表" />
        <MetricCard label="有同步记录" value={workspace ? syncedSources.length : '—'} unit="个" theme="green" desc={latestSync ? `最近同步 ${cnTime(latestSync)}` : '尚无同步记录'} />
        <MetricCard label="需处理的数据源" value={workspace ? failedSources.length : '—'} unit="个" theme={failedSources.length ? 'red' : 'teal'} desc="按最近错误记录统计；详情见下方数据源列表" />
        <MetricCard label="最近读取行数合计" value={workspace && syncedSources.length ? syncedSources.reduce((sum, item) => sum + (Number(item.lastRowCount) || 0), 0).toLocaleString() : '—'} unit="行" theme="purple" desc="各源最近一次读取量相加，未经跨表去重；无记录显示 —" />
      </section>

      {statusError && <ErrorState error={`${statusError}${feishu ? '；下方保留上次读取的状态。' : ''}`} onRetry={loadSources} />}
      {!feishu && !statusError && <LoadingState text="正在读取同步核对状态…" />}

      {projectId === 'qicui' && feishu && (
        <section className="pastel-card reference-section section-teal">
          <div className="card-header-row">
            <div className="header-left">
              <span className="section-mini-tag tag-teal">内置工作表核对</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0 }}>真实同步快照</h3>
                <SyncButton projectId={projectId} onRefresh={async () => { await onDone(); await loadSources(); }} />
              </div>
            </div>
            <span className="header-tag">{feishu.checkedAt ? cnTime(feishu.checkedAt) : '尚未核对'}</span>
          </div>
          <p className="reference-note">已返回 {feishu.reports.length} 张工作表报告，其中 {feishu.reports.filter(report => report.status === 'error').length} 张读取失败。投放数据截至 {feishu.latestDate || '暂无日期'}；同步核对时间不代表业务数据日期。</p>
          <p className="reference-note">展开下方溯源明细查看原表链接、工作表 ID、读取范围与逐表错误。</p>
          <FeishuSources data={feishu} projectId={projectId} />
        </section>
      )}

      <section className="settings-sources-section">
        <article className="platform-panel pastel-card reference-section section-teal">
          <div className="list-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div className="section-kicker">CONNECTED SOURCES</div>
              <h2 style={{ margin: '2px 0 4px' }}>{currentProject?.name || '当前项目'}的数据源</h2>
              <p style={{ margin: 0 }}>支持飞书电子表格、多维表格与通用任务表接入；同步记录与错误信息留痕。</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="section-mini-tag tag-blue" style={{ fontSize: '12px', padding: '4px 10px' }}>
                共 {sources.length} 个配置
              </span>
              {!isAdding && !source.id && (
                <button
                  type="button"
                  className="primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '13px' }}
                  onClick={() => {
                    setSource(emptySource);
                    setDetectedSheets([]);
                    setIsAdding(true);
                  }}
                >
                  <span>＋</span> 接入飞书数据源
                </button>
              )}
            </div>
          </div>

          {(isAdding || Boolean(source.id)) && (
            <div
              style={{
                marginTop: '18px',
                marginBottom: '18px',
                padding: '20px',
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                <div>
                  <span className="section-mini-tag tag-blue" style={{ marginBottom: '4px' }}>
                    {source.id ? '编辑模式' : '新增模式'}
                  </span>
                  <h3 style={{ margin: '4px 0 0', fontSize: '16px', color: '#0f172a' }}>
                    {source.id ? ('编辑数据源：' + String(source.name || '')) : '接入飞书表格数据源'}
                  </h3>
                </div>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
                  onClick={() => {
                    setSource(emptySource);
                    setIsAdding(false);
                  }}
                  title="关闭"
                >
                  ✕
                </button>
              </div>

              <div className="platform-form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <label>
                  数据源名称
                  <input
                    value={String(source.name || '')}
                    placeholder="如：活动排期与执行进度表"
                    onChange={(e) => setSource({ ...source, name: e.target.value })}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>数据用途</span>
                  <CustomSelect
                    value={String(source.kind || 'general')}
                    onChange={(val) => setSource({ ...source, kind: val })}
                    options={[
                      { value: 'general', label: '通用表格数据集（任务、活动、预算）', badge: '通用' },
                      { value: 'owned', label: '发布进度 / 自有笔记', badge: '内容' },
                      { value: 'supplier', label: '供应商评论交付', badge: '评论' },
                      { value: 'competitor', label: '竞品监测数据', badge: '竞品' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>同步策略</span>
                  <CustomSelect
                    value={String(source.syncFrequency || 'manual')}
                    onChange={(val) => setSource({ ...source, syncFrequency: val })}
                    options={[
                      { value: 'manual', label: '手动同步 (已就绪)', color: '#16a34a' },
                      { value: 'hourly', label: '每小时自动 (调度待启用)', color: '#d97706' },
                      { value: 'daily', label: '每日自动 (调度待启用)', color: '#64748b' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </label>

                <label className="full">
                  飞书文档链接
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <input
                      style={{ flex: 1 }}
                      value={String(source.spreadsheet || '')}
                      placeholder="https://yimeichuanbo.feishu.cn/wiki/... 或 sheets/..."
                      onChange={(e) => setSource({ ...source, spreadsheet: e.target.value })}
                    />
                    <button
                      type="button"
                      disabled={inspecting || !source.spreadsheet}
                      onClick={handleInspectLink}
                      style={{ padding: '0 14px', borderRadius: 6, border: '1px solid #0284c7', background: '#e0f2fe', color: '#0369a1', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600 }}
                    >
                      {inspecting ? '正在检测…' : '智能检测工作表'}
                    </button>
                  </div>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span>工作表 ID (Sheet / Table ID)</span>
                  {detectedSheets.length > 0 ? (
                    <CustomSelect
                      value={String(source.sheetId || '')}
                      onChange={(val) => setSource({ ...source, sheetId: val })}
                      placeholder="-- 请选择工作表 / 数据表 --"
                      options={[
                        { value: '', label: '-- 请选择工作表 / 数据表 --' },
                        ...detectedSheets.map((s) => ({
                          value: s.sheetId,
                          label: `${s.title} (${s.sheetId})`,
                        })),
                      ]}
                      style={{ width: '100%' }}
                    />
                  ) : (
                    <input
                      value={String(source.sheetId || '')}
                      placeholder="例如：kMYs9o 或点击上方智能检测自动填入"
                      onChange={(e) => setSource({ ...source, sheetId: e.target.value })}
                      style={{ height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  )}
                </label>

                <label>
                  读取范围
                  <input
                    value={String(source.range || '')}
                    placeholder="例如：A1:AZ5000"
                    onChange={(e) => setSource({ ...source, range: e.target.value })}
                  />
                </label>

                <label className="full">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>字段映射 JSON（可选）</span>
                    <small style={{ color: '#94a3b8' }}>支持定义主键与字段类型转换；默认直接读取原表头</small>
                  </div>
                  <textarea
                    rows={3}
                    value={String(source.mappingJson || '{}')}
                    onChange={(e) => setSource({ ...source, mappingJson: e.target.value })}
                  />
                </label>
              </div>

              <div className="editor-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSource(emptySource);
                    setIsAdding(false);
                  }}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={busy === 'source' || !source.name || !source.spreadsheet}
                  onClick={saveSource}
                >
                  {busy === 'source' ? '正在保存…' : '保存数据源'}
                </button>
              </div>
            </div>
          )}
          <div className="management-list" style={{ marginTop: '14px' }}>
            {sources.length ? (
              sources.map((item) => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', gap: '14px', padding: '14px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                    飞
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{item.name}</strong>
                      <span className="section-mini-tag tag-blue" style={{ fontSize: '11px' }}>
                        {item.kind === 'general' ? '通用数据集' : item.kind === 'owned' ? '发布进度' : item.kind === 'supplier' ? '供应商交付' : item.kind || '未标注用途'} ·{' '}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        {item.syncFrequency === 'hourly' ? '每小时自动(待启用)' : item.syncFrequency === 'daily' ? '每日自动(待启用)' : '手动同步'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span>工作表：<code style={{ color: '#0369a1' }}>{item.sheetId || '未填写 Sheet ID'}</code></span>
                      <span>范围：<code>{item.range}</code></span>
                      <span>最近读取：<strong>{item.lastSyncedAt ? (String(item.lastRowCount) + ' 行') : '—'}</strong></span>
                    </div>
                    {item.lastError && (
                      <div style={{ fontSize: '11.5px', color: '#e11d48' }}>
                        ⚠ 同步异常：{item.lastError}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: !item.lastError && (item.status?.includes('正常') || item.status?.includes('已连接')) ? '#16a34a' : '#ea580c' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: !item.lastError && (item.status?.includes('正常') || item.status?.includes('已连接')) ? '#16a34a' : '#ea580c' }} />
                      {item.lastError ? '异常' : item.status || '就绪'}
                    </span>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      {item.lastSyncedAt ? cnTime(item.lastSyncedAt) : '暂未同步'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      disabled={busy === item.id || !item.spreadsheet || !item.sheetId}
                      onClick={() => syncSource(item)}
                      style={{ padding: '6px 12px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #0284c7', background: '#f0f9ff', color: '#0284c7', cursor: 'pointer', fontWeight: 500 }}
                    >
                      {busy === item.id ? '同步中…' : '立即同步'}
                    </button>
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => removeSource(item)}
                      style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#ef4444', cursor: 'pointer' }}
                    >
                      移除
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="当前项目尚未配置数据源" text="点击上方「接入飞书数据源」开始绑定飞书表格或多维表格。" />
            )}
          </div>
        </article>
      </section>

      {/* Confirmation Modal */}
      {confirmDialog.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 440, width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{confirmDialog.title}</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: 14, color: '#475569', lineHeight: 1.5 }}>{confirmDialog.description}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 14 }}
              >
                取消
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
              >
                确认移除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
