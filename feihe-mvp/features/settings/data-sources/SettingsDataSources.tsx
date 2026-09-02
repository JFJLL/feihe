'use client';

import { useState } from 'react';
import type { Source, Workspace } from '../../../lib/types/project';
import { EmptyState } from '../../../components/ui/EmptyState';
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

  const sources = (workspace?.sources || []).filter((item) => item.projectId === projectId);
  const currentProject = workspace?.projects.find((item) => item.id === projectId);

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
    } catch (err) {
      toast(err instanceof Error ? err.message : '移除失败', 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="stack">
      <section className="platform-split">
        <article className="platform-panel side-form-panel">
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

        <article className="platform-panel">
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
                      {item.kind === 'owned' ? '发布进度' : '供应商交付'} ·{' '}
                      {item.sheetId || '未填写 Sheet ID'} · {item.range}
                    </small>
                    <em>
                      最近同步 {cnTime(item.lastSyncedAt)} · {item.lastRowCount} 条
                      {item.lastError ? ' · ' + item.lastError : ''}
                    </em>
                  </span>
                  <i className={item.status.includes('正常') ? 'ok' : 'warn'}>
                    {item.status}
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
