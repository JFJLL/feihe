'use client';

import { useState, useEffect, useCallback } from 'react';
import { FeishuSources, SyncButton } from '../../../components/ui/FeishuSources';
import type { FeishuData } from '../../../lib/feishu-model';
import type { Source, Workspace } from '../../../lib/types/project';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { MetricCard } from '../../../components/ui/operations/MetricCard';
import { api, cnTime } from '../../../lib/hooks/use-project-data';

const emptySource: Record<string, unknown> = {
  name: '实时发布进度表',
  type: 'feishu_sheet',
  spreadsheet: '',
  sheetId: '',
  range: 'A1:AZ5000',
  kind: 'owned',
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

  async function removeSource(item: Source) {
    if (!confirm('移除数据源“' + item.name + '”？')) return;
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
    }
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
      {projectId === 'qicui' && feishu && <section className="pastel-card reference-section section-teal">
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
      </section>}
      <section className="settings-sources-section">
        <article className="platform-panel pastel-card reference-section section-teal">
          <div className="list-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div className="section-kicker">CONNECTED SOURCES</div>
              <h2 style={{ margin: '2px 0 4px' }}>{currentProject?.name || '当前项目'}的数据源</h2>
              <p style={{ margin: 0 }}>同步记录、数据量和错误信息统一留痕；支持在线同步与受控维护。</p>
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
                    setIsAdding(true);
                  }}
                >
                  <span>＋</span> 新增数据源
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
                    {source.id ? ('编辑数据源：' + String(source.name || '')) : '新增飞书表格数据源'}
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
                  名称
                  <input
                    value={String(source.name || '')}
                    placeholder="如：实时发布进度表"
                    onChange={(e) => setSource({ ...source, name: e.target.value })}
                  />
                </label>
                <label>
                  用途
                  <select
                    value={String(source.kind || 'owned')}
                    onChange={(e) => setSource({ ...source, kind: e.target.value })}
                  >
                    <option value="owned">发布进度 / 自有笔记</option>
                    <option value="supplier">供应商评论交付</option>
                  </select>
                </label>
                <label>
                  更新策略
                  <select
                    value={String(source.syncFrequency || 'manual')}
                    onChange={(e) => setSource({ ...source, syncFrequency: e.target.value })}
                  >
                    <option value="manual">手动更新</option>
                    <option value="hourly">每小时自动同步</option>
                    <option value="daily">每日自动同步</option>
                  </select>
                </label>
                <label className="full">
                  飞书表格链接或 Token
                  <input
                    value={String(source.spreadsheet || '')}
                    placeholder="https://yimeichuanbo.feishu.cn/wiki/... 或 表格Token"
                    onChange={(e) => setSource({ ...source, spreadsheet: e.target.value })}
                  />
                </label>
                <label>
                  工作表 ID (Sheet ID)
                  <input
                    value={String(source.sheetId || '')}
                    placeholder="例如：kMYs9o"
                    onChange={(e) => setSource({ ...source, sheetId: e.target.value })}
                  />
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
                    <span>字段映射 JSON（高级设置）</span>
                    <small style={{ color: '#94a3b8', fontWeight: 'normal' }}>非技术人员保持默认即可</small>
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
                  disabled={busy === 'source' || !source.name}
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
                        {item.kind === 'owned' ? '发布进度' : item.kind === 'supplier' ? '供应商交付' : item.kind || '未标注用途'} ·{' '}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        {item.syncFrequency === 'hourly' ? '每小时自动' : item.syncFrequency === 'daily' ? '每日自动' : '手动'}
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: !item.lastError && item.status?.includes('正常') ? '#16a34a' : '#ea580c' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: !item.lastError && item.status?.includes('正常') ? '#16a34a' : '#ea580c' }} />
                      {item.lastError ? '异常' : item.status || '就绪'}
                    </span>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      {item.lastSyncedAt ? cnTime(item.lastSyncedAt) : '暂未同步'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
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
                      onClick={() => {
                        setSource({ ...item });
                        setIsAdding(false);
                      }}
                      style={{ padding: '6px 10px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="danger-link"
                      style={{ padding: '6px 10px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #fecdd3', background: '#fff1f2', color: '#e11d48', cursor: 'pointer' }}
                      onClick={() => removeSource(item)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="当前项目尚未配置数据源" text="点击上方「新增数据源」开始添加飞书多维表格。" />
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
