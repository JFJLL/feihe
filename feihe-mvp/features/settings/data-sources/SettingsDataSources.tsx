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
        <div className="card-header-row"><div className="header-left"><span className="section-mini-tag tag-teal">内置工作表核对</span><h3>真实同步快照</h3></div><span className="header-tag">{feishu.checkedAt ? cnTime(feishu.checkedAt) : '尚未核对'}</span></div>
        <p className="reference-note">已返回 {feishu.reports.length} 张工作表报告，其中 {feishu.reports.filter(report => report.status === 'error').length} 张读取失败。投放数据截至 {feishu.latestDate || '暂无日期'}；同步核对时间不代表业务数据日期。</p>
        <p className="reference-note">展开下方溯源明细查看原表链接、工作表 ID、读取范围与逐表错误。</p>
      </section>}
      {projectId==='qicui'&&<><SyncButton projectId={projectId} onRefresh={async()=>{await onDone();await loadSources();}}/><FeishuSources data={feishu} projectId={projectId}/></>}
      <section className="platform-split">
        <article className="platform-panel side-form-panel pastel-card reference-section section-blue">
          <div className="section-kicker">FEISHU SHEET</div>
          <h2>{source.id ? '编辑数据源' : '新增数据源'}</h2>
          <p className="section-copy">配置飞书表格位置、同步策略与字段映射。</p>
          <div className="platform-form">
            <label>
              名称
              <input
                value={String(source.name || '')}
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
            <label className="full">
              飞书表格链接或 Token
              <input
                value={String(source.spreadsheet || '')}
                onChange={(e) => setSource({ ...source, spreadsheet: e.target.value })}
              />
            </label>
            <label>
              工作表 ID
              <input
                value={String(source.sheetId || '')}
                onChange={(e) => setSource({ ...source, sheetId: e.target.value })}
              />
            </label>
            <label>
              读取范围
              <input
                value={String(source.range || '')}
                onChange={(e) => setSource({ ...source, range: e.target.value })}
              />
            </label>
            <label>
              更新策略
              <select
                value={String(source.syncFrequency || 'manual')}
                onChange={(e) => setSource({ ...source, syncFrequency: e.target.value })}
              >
                <option value="manual">手动</option>
                <option value="hourly">每小时</option>
                <option value="daily">每日</option>
              </select>
            </label>
            <label className="full">
              字段映射 JSON
              <textarea
                value={String(source.mappingJson || '{}')}
                onChange={(e) => setSource({ ...source, mappingJson: e.target.value })}
              />
            </label>
          </div>
          <div className="editor-actions">
            {Boolean(source.id) && (
              <button onClick={() => setSource(emptySource)}>取消编辑</button>
            )}
            <button
              className="primary"
              disabled={busy === 'source' || !source.name}
              onClick={saveSource}
            >
              保存数据源
            </button>
          </div>
        </article>

        <article className="platform-panel pastel-card reference-section section-teal">
          <div className="list-head">
            <div>
              <div className="section-kicker">CONNECTED SOURCES</div>
              <h2>{currentProject?.name || '当前项目'}的数据源</h2>
              <p>同步记录、数据量和错误信息统一留痕。</p>
            </div>
            <b>{sources.length}</b>
          </div>
          <div className="management-list">
            {sources.length ? (
              sources.map((item) => (
                <div key={item.id}>
                  <b>飞</b>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.kind === 'owned' ? '发布进度' : item.kind === 'supplier' ? '供应商交付' : item.kind || '未标注用途'} ·{' '}
                      {item.sheetId || '未填写 Sheet ID'} · {item.range}
                    </small>
                    <em>
                      最近同步 {cnTime(item.lastSyncedAt)} · {item.lastSyncedAt ? item.lastRowCount : '—'} 行
                      {item.lastError ? ' · ' + item.lastError : ''}
                    </em>
                  </span>
                  <i className={!item.lastError && item.status.includes('正常') ? 'ok' : 'warn'}>
                    {item.lastError ? '同步异常' : item.status || '未同步'}
                  </i>
                  <button onClick={() => setSource({ ...item })}>编辑</button>
                  <button
                    disabled={busy === item.id || !item.spreadsheet || !item.sheetId}
                    onClick={() => syncSource(item)}
                  >
                    同步
                  </button>
                  <button className="danger-link" onClick={() => removeSource(item)}>
                    删除
                  </button>
                </div>
              ))
            ) : (
              <EmptyState title="当前项目尚未配置数据源" />
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
