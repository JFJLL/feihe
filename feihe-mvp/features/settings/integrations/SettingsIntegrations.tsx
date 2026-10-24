'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from '../../../components/ui/AppLink';
import type { Integration, IntegrationData } from '../../../lib/types/project';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Dialog } from '../../../components/ui/Dialog';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { api, cnTime } from '../../../lib/hooks/use-project-data';

const redtrendConfig = JSON.stringify(
  {
    searchPath: '/api/solar/content_square/searchNote',
    detailPath: '/api/solar/note/{noteId}/detail?bizCode=',
    l1Path: '/api/solar/note/{noteId}/l1_comments',
    l2Path: '/api/solar/note/{noteId}/l2_comments',
  },
  null,
  2
);

const emptyIntegration = {
  name: 'RedTrend 内容与评论接口',
  provider: 'redtrend',
  baseUrl: '',
  enabled: true,
  configJson: redtrendConfig,
};

const PROVIDER_OPTIONS = [
  { value: 'redtrend', label: 'RedTrend / 内容与评论' },
  { value: 'feishu', label: '飞书开放平台' },
  { value: 'oss', label: '阿里云 OSS' },
  { value: 'custom_http', label: '自定义 HTTP API' },
];

export function SettingsIntegrations({
  projectId,
  toast,
}: {
  projectId: string;
  toast: (v: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [tools, setTools] = useState<IntegrationData>({
    integrations: [],
    credentialStatus: { redtrend: false, oss: false, feishu: false, keystone: false },
  });
  const [integration, setIntegration] = useState<Record<string, unknown>>(emptyIntegration);
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Delete modal states
  const [pendingDelete, setPendingDelete] = useState<Integration | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<IntegrationData>('/api/integrations');
      setTools(data);
      setLoaded(true);
      setLoadError('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '集成状态加载失败';
      setLoadError(msg);
      throw e;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, [load, projectId]);

  async function saveIntegration() {
    setBusy('integration');
    try {
      await api('/api/integrations', {
        method: 'POST',
        body: JSON.stringify({ action: 'save', projectId, ...integration }),
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
      setBusy('');
      return;
    }

    toast('工具集成已保存', 'success');
    setIntegration(emptyIntegration);
    setIsAdding(false);
    setBusy('');

    try {
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知异常';
      toast('工具集成已保存，但刷新列表失败：' + msg, 'error');
    }
  }

  async function testIntegration(item: Integration) {
    setBusy(item.id);
    try {
      await api('/api/integrations', {
        method: 'POST',
        body: JSON.stringify({ action: 'test', projectId: item.projectId, id: item.id }),
      });
      toast(item.name + ' 连接正常', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '检测失败', 'error');
    } finally {
      setBusy('');
    }
  }

  function requestDelete(item: Integration) {
    if (isDeleting) return;
    setPendingDelete(item);
    setDeleteError(null);
  }

  function handleCancelDelete() {
    if (isDeleting) return; // Busy protection
    setPendingDelete(null);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api('/api/integrations', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', projectId: pendingDelete.projectId, id: pendingDelete.id }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '删除失败';
      setDeleteError(msg);
      toast(msg, 'error');
      setIsDeleting(false);
      return;
    }

    setPendingDelete(null);
    setIsDeleting(false);
    toast('工具集成已删除', 'success');

    try {
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知异常';
      toast('工具集成已删除，但刷新列表失败：' + msg, 'error');
    }
  }

  const integrations = tools.integrations.filter((item) => item.projectId === projectId);
  const registeredCount = integrations.length;
  const enabledCount = integrations.filter((item) => Boolean(item.enabled)).length;
  const healthyCount = integrations.filter((item) => item.lastTestedAt && item.status === '连接正常' && !item.lastError).length;

  if (!loaded) return loadError
    ? <ErrorState error={loadError} onRetry={load} />
    : <LoadingState text="正在读取集成与凭证状态…" />;

  return (
    <div className="stack" style={{ gap: 0 }}>
      {loadError && <ErrorState error={`${loadError}；下方显示上次读取的状态。`} onRetry={load} />}
      <article className="platform-panel" style={{ background: 'var(--ws-surface, #ffffff)', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: 'var(--ws-radius-card, 12px)', padding: '24px' }}>
          <div className="list-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: '2px 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--slate-12, #1c2024)' }}>当前项目的工具与接口</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--slate-11, #60646c)' }}>抓取任务会优先使用这里启用的接口配置；凭证由安全环境托管。</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Link
                href={`/projects/${encodeURIComponent(projectId)}/settings?tab=data-map`}
                style={{ padding: '6px 12px', borderRadius: 'var(--ws-radius-control, 8px)', background: 'var(--slate-2, #f9f9fb)', color: 'var(--slate-12, #1c2024)', fontSize: 12, fontWeight: 500, textDecoration: 'none', border: '0.5px solid var(--slate-6, #d9d9e0)' }}
              >
                数据地图与模型网关 ↗
              </Link>
              <span style={{ fontSize: 12, padding: '4px 10px', background: 'var(--slate-2, #f9f9fb)', color: 'var(--slate-11, #60646c)', borderRadius: 'var(--ws-radius-control, 8px)', fontWeight: 500, border: '0.5px solid var(--slate-6, #d9d9e0)' }}>
                已登记 {registeredCount} / 已启用 {enabledCount} / 正常 {healthyCount}
              </span>
              {!isAdding && !integration.id && (
                <button
                  type="button"
                  className="primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: 12, borderRadius: 'var(--ws-radius-control, 8px)', fontWeight: 600 }}
                  onClick={() => {
                    setIntegration(emptyIntegration);
                    setIsAdding(true);
                  }}
                >
                  <span>＋</span> 新增工具集成
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              background: 'var(--slate-2, #f9f9fb)',
              borderRadius: 'var(--ws-radius-control, 8px)',
              border: '0.5px solid var(--slate-6, #d9d9e0)',
              margin: '16px 0 18px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-12, #1c2024)', marginRight: '4px' }}>平台凭证托管：</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: 12, padding: '2px 8px', borderRadius: 4, background: tools.credentialStatus.redtrend ? 'var(--jade-3, #e6f7ed)' : 'var(--slate-2, #f9f9fb)', color: tools.credentialStatus.redtrend ? 'var(--jade-11, #208368)' : 'var(--slate-11, #60646c)', border: `0.5px solid ${tools.credentialStatus.redtrend ? 'var(--jade-6, #acdec8)' : 'var(--slate-6, #d9d9e0)'}` }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: tools.credentialStatus.redtrend ? 'var(--jade-9, #29a383)' : 'var(--slate-9, #8b8d98)' }} />
              RedTrend {tools.credentialStatus.redtrend ? '已配置' : '未配置'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: 12, padding: '2px 8px', borderRadius: 4, background: tools.credentialStatus.oss ? 'var(--jade-3, #e6f7ed)' : 'var(--slate-2, #f9f9fb)', color: tools.credentialStatus.oss ? 'var(--jade-11, #208368)' : 'var(--slate-11, #60646c)', border: `0.5px solid ${tools.credentialStatus.oss ? 'var(--jade-6, #acdec8)' : 'var(--slate-6, #d9d9e0)'}` }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: tools.credentialStatus.oss ? 'var(--jade-9, #29a383)' : 'var(--slate-9, #8b8d98)' }} />
              OSS {tools.credentialStatus.oss ? '已配置' : '未配置'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: 12, padding: '2px 8px', borderRadius: 4, background: tools.credentialStatus.feishu ? 'var(--jade-3, #e6f7ed)' : 'var(--slate-2, #f9f9fb)', color: tools.credentialStatus.feishu ? 'var(--jade-11, #208368)' : 'var(--slate-11, #60646c)', border: `0.5px solid ${tools.credentialStatus.feishu ? 'var(--jade-6, #acdec8)' : 'var(--slate-6, #d9d9e0)'}` }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: tools.credentialStatus.feishu ? 'var(--jade-9, #29a383)' : 'var(--slate-9, #8b8d98)' }} />
              飞书 {tools.credentialStatus.feishu ? '已配置' : '未配置'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: 12, padding: '2px 8px', borderRadius: 4, background: tools.credentialStatus.keystone ? 'var(--jade-3, #e6f7ed)' : 'var(--slate-2, #f9f9fb)', color: tools.credentialStatus.keystone ? 'var(--jade-11, #208368)' : 'var(--slate-11, #60646c)', border: `0.5px solid ${tools.credentialStatus.keystone ? 'var(--jade-6, #acdec8)' : 'var(--slate-6, #d9d9e0)'}` }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: tools.credentialStatus.keystone ? 'var(--jade-9, #29a383)' : 'var(--slate-9, #8b8d98)' }} />
              Keystone {tools.credentialStatus.keystone ? '已配置' : '待配置'}
            </span>
          </div>

          {(isAdding || Boolean(integration.id)) && (
            <div
              style={{
                marginTop: '18px',
                marginBottom: '18px',
                padding: '20px',
                background: 'var(--slate-2, #f9f9fb)',
                border: '0.5px solid var(--slate-6, #d9d9e0)',
                borderRadius: 'var(--ws-radius-control, 8px)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '0.5px solid var(--slate-6, #d9d9e0)', paddingBottom: '10px' }}>
                <div>
                  <span className="section-mini-tag tag-blue" style={{ marginBottom: '4px' }}>
                    {integration.id ? '编辑模式' : '新增模式'}
                  </span>
                  <h3 style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--slate-12, #1c2024)' }}>
                    {integration.id ? ('编辑集成：' + String(integration.name || '')) : '新增工具接口集成'}
                  </h3>
                </div>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--slate-11, #60646c)' }}
                  onClick={() => {
                    setIntegration(emptyIntegration);
                    setIsAdding(false);
                  }}
                  title="关闭"
                >
                  ✕
                </button>
              </div>

              <div className="platform-form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <label>
                  集成名称
                  <input
                    value={String(integration.name || '')}
                    placeholder="如：RedTrend 内容与评论接口"
                    onChange={(e) => setIntegration({ ...integration, name: e.target.value })}
                  />
                </label>
                <label>
                  提供方
                  <CustomSelect
                    value={String(integration.provider || 'redtrend')}
                    onChange={(val) => setIntegration({ ...integration, provider: val })}
                    ariaLabel="提供方选择"
                    options={PROVIDER_OPTIONS}
                  />
                </label>
                <label className="full">
                  Base URL
                  <input
                    value={String(integration.baseUrl || '')}
                    onChange={(e) => setIntegration({ ...integration, baseUrl: e.target.value })}
                    placeholder="https://...（留空使用系统默认）"
                  />
                </label>
                <label className="full">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>接口路径与参数 JSON（高级参数）</span>
                    <small style={{ color: 'var(--slate-9, #8b8d98)', fontWeight: 'normal' }}>普通业务人员通常无需修改</small>
                  </div>
                  <textarea
                    rows={5}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                    value={String(integration.configJson || '{}')}
                    onChange={(e) => setIntegration({ ...integration, configJson: e.target.value })}
                  />
                </label>
                <label className="check" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={integration.enabled !== false}
                    onChange={(e) => setIntegration({ ...integration, enabled: e.target.checked })}
                  />
                  启用此集成服务
                </label>
              </div>

              <div className="editor-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIntegration(emptyIntegration);
                    setIsAdding(false);
                  }}
                  style={{ padding: '6px 14px', borderRadius: 'var(--ws-radius-control, 8px)', border: '0.5px solid var(--slate-6, #d9d9e0)', background: 'var(--ws-surface, #ffffff)', color: 'var(--slate-12, #1c2024)', cursor: 'pointer', fontSize: 12 }}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={busy === 'integration' || !integration.name}
                  onClick={saveIntegration}
                  style={{ padding: '6px 16px', fontSize: 12 }}
                >
                  {busy === 'integration' ? '正在保存…' : '保存集成'}
                </button>
              </div>
            </div>
          )}

          <div className="integration-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
            {integrations.length ? (
              integrations.map((item) => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: '14px', padding: '14px 16px', background: 'var(--ws-surface, #ffffff)', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: 'var(--ws-radius-control, 8px)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14, color: 'var(--slate-12, #1c2024)' }}>{item.name}</strong>
                      <span className={`section-mini-tag tag-${item.enabled ? 'green' : 'gray'}`} style={{ fontSize: 12 }}>
                        {item.enabled ? '已启用' : '已停用'}
                      </span>
                      <span className="section-mini-tag tag-blue" style={{ fontSize: 12 }}>
                        {item.provider}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--slate-11, #60646c)' }}>
                      地址：<code style={{ color: 'var(--teal-11, #008573)' }}>{item.baseUrl || '使用环境默认托管配置'}</code>
                    </div>
                    {item.lastError && (
                      <div style={{ fontSize: 12, color: 'var(--red-11, #ce2c31)' }}>
                        ⚠ 检测异常：{item.lastError}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 12, fontWeight: 600, color: item.lastTestedAt && !item.lastError && item.status === '连接正常' ? 'var(--jade-11, #208368)' : 'var(--amber-11, #ab6400)' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.lastTestedAt && !item.lastError && item.status === '连接正常' ? 'var(--jade-9, #29a383)' : 'var(--amber-9, #ffc53d)' }} />
                      {item.lastError ? '检测异常' : !item.lastTestedAt ? '尚无检测记录' : item.status}
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--slate-9, #8b8d98)', marginTop: '2px' }}>
                      {item.lastTestedAt ? cnTime(item.lastTestedAt) : '未检测'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      disabled={busy === item.id || isDeleting}
                      onClick={() => testIntegration(item)}
                      style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--ws-radius-control, 8px)', border: '0.5px solid var(--teal-6, #a1ded2)', background: 'var(--teal-2, #f3fbf9)', color: 'var(--teal-11, #008573)', cursor: busy === item.id || isDeleting ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                    >
                      {busy === item.id ? '检测中…' : '检测连接'}
                    </button>
                    <button
                      type="button"
                      disabled={busy === item.id || isDeleting}
                      onClick={() => {
                        setIntegration({ ...item, enabled: Boolean(item.enabled) });
                        setIsAdding(false);
                      }}
                      style={{ padding: '6px 10px', fontSize: 12, borderRadius: 'var(--ws-radius-control, 8px)', border: '0.5px solid var(--slate-6, #d9d9e0)', background: 'var(--ws-surface, #ffffff)', color: 'var(--slate-12, #1c2024)', cursor: busy === item.id || isDeleting ? 'not-allowed' : 'pointer' }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      disabled={busy === item.id || isDeleting}
                      onClick={() => requestDelete(item)}
                      style={{ padding: '6px 10px', fontSize: 12, borderRadius: 'var(--ws-radius-control, 8px)', border: '0.5px solid var(--red-6, #fdbdbe)', background: 'var(--red-3, #feebec)', color: 'var(--red-11, #ce2c31)', cursor: busy === item.id || isDeleting ? 'not-allowed' : 'pointer' }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="当前项目尚未配置工具集成" text="点击右上角「新增工具集成」添加自定义接口。" />
            )}
          </div>
        </article>

      {/* Delete Confirmation Dialog */}
      {pendingDelete && (
        <Dialog
          open={Boolean(pendingDelete)}
          title={`确认删除集成“${pendingDelete.name}”？`}
          width={460}
          onClose={handleCancelDelete}
          footer={
            <>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleCancelDelete}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--ws-radius-control, 8px)',
                  border: '0.5px solid var(--slate-6, #d9d9e0)',
                  background: 'var(--ws-surface, #ffffff)',
                  color: 'var(--slate-12, #1c2024)',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--ws-radius-control, 8px)',
                  border: 'none',
                  background: 'var(--red-9, #e5484d)',
                  color: '#ffffff',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {isDeleting ? '正在删除…' : '确认删除'}
              </button>
            </>
          }
        >
          <p style={{ margin: '0 0 10px 0', fontSize: 14, color: 'var(--slate-11, #60646c)', lineHeight: 1.5 }}>
            删除后，当前项目将无法使用该接口配置，依赖该接口的抓取与分析任务可能受影响。
          </p>
          {deleteError && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--red-3, #feebec)', color: 'var(--red-11, #ce2c31)', borderRadius: 'var(--ws-radius-control, 8px)', fontSize: 12, border: '0.5px solid var(--red-6, #fdbdbe)' }}>
              删除失败：{deleteError}
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
