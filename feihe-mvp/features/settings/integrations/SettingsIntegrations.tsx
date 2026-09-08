'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Integration, IntegrationData } from '../../../lib/types/project';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { MetricCard } from '../../../components/ui/operations/MetricCard';
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

  const load = useCallback(async () => {
    try {
      const data = await api<IntegrationData>('/api/integrations');
      setTools(data);
      setLoaded(true);
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '集成状态加载失败');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
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
      toast('工具集成已保存', 'success');
      setIntegration(emptyIntegration);
      setIsAdding(false);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setBusy('');
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

  async function removeIntegration(item: Integration) {
    if (!confirm('删除集成“' + item.name + '”？')) return;
    setBusy(item.id);
    try {
      await api('/api/integrations', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', projectId: item.projectId, id: item.id }),
      });
      toast('工具集成已删除', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    } finally {
      setBusy('');
    }
  }

  const integrations = tools.integrations.filter((item) => item.projectId === projectId);

  if (!loaded) return loadError
    ? <ErrorState error={loadError} onRetry={load} />
    : <LoadingState text="正在读取集成与凭证状态…" />;

  return (
    <div className="stack">
      {loadError && <ErrorState error={`${loadError}；下方显示上次读取的状态。`} onRetry={load} />}
      <section className="ops-metric-grid" aria-label="当前项目接口状态">
        <MetricCard label="已登记集成" value={integrations.length} unit="个" theme="blue" desc="仅统计当前项目的工具与接口配置" />
        <MetricCard label="已启用集成" value={integrations.filter(item => Boolean(item.enabled)).length} unit="个" theme="purple" desc="启用表示允许调用，连接是否可用需单独检测" />
        <MetricCard label="最近检测正常" value={integrations.filter(item => item.lastTestedAt && item.status === '连接正常' && !item.lastError).length} unit="个" theme="green" desc="依据最近一次检测结果，不代表实时可用性" />
        <MetricCard label="最近检测异常" value={integrations.filter(item => item.lastError).length} unit="个" theme="yellow" desc="错误原因和检测时间见下方接口列表" />
      </section>
      <section className="credential-strip">
        <span className={tools.credentialStatus.redtrend ? 'ok' : ''}>
          <b>RT</b>RedTrend 地址
          <em>{tools.credentialStatus.redtrend ? '已配置' : '未配置'}</em>
        </span>
        <span className={tools.credentialStatus.oss ? 'ok' : ''}>
          <b>OS</b>OSS Cookie 池
          <em>{tools.credentialStatus.oss ? '已配置' : '未配置'}</em>
        </span>
        <span className={tools.credentialStatus.feishu ? 'ok' : ''}>
          <b>FS</b>飞书应用凭证
          <em>{tools.credentialStatus.feishu ? '已配置' : '未配置'}</em>
        </span>
        <span className={tools.credentialStatus.keystone ? 'ok' : ''}>
          <b>AI</b>Keystone 网关
          <em>{tools.credentialStatus.keystone ? '已配置' : '待配置'}</em>
        </span>
      </section>

      <section className="settings-integrations-section">
        <article className="platform-panel pastel-card reference-section section-teal">
          <div className="list-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div className="section-kicker">ACTIVE CONNECTIONS</div>
              <h2 style={{ margin: '2px 0 4px' }}>当前项目的工具与接口</h2>
              <p style={{ margin: 0 }}>抓取任务会优先使用这里启用的接口配置；凭证由安全环境托管。</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="section-mini-tag tag-blue" style={{ fontSize: '12px', padding: '4px 10px' }}>
                共 {integrations.length} 个接口
              </span>
              {!isAdding && !integration.id && (
                <button
                  type="button"
                  className="primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '13px' }}
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

          {(isAdding || Boolean(integration.id)) && (
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
                    {integration.id ? '编辑模式' : '新增模式'}
                  </span>
                  <h3 style={{ margin: '4px 0 0', fontSize: '16px', color: '#0f172a' }}>
                    {integration.id ? ('编辑集成：' + String(integration.name || '')) : '新增工具接口集成'}
                  </h3>
                </div>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
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
                  <select
                    value={String(integration.provider || 'redtrend')}
                    onChange={(e) => setIntegration({ ...integration, provider: e.target.value })}
                  >
                    <option value="redtrend">RedTrend / 内容与评论</option>
                    <option value="feishu">飞书开放平台</option>
                    <option value="oss">阿里云 OSS</option>
                    <option value="custom_http">自定义 HTTP API</option>
                  </select>
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
                    <small style={{ color: '#94a3b8', fontWeight: 'normal' }}>普通业务人员通常无需修改</small>
                  </div>
                  <textarea
                    rows={5}
                    style={{ fontFamily: 'monospace', fontSize: '12px' }}
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
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={busy === 'integration' || !integration.name}
                  onClick={saveIntegration}
                >
                  {busy === 'integration' ? '正在保存…' : '保存集成'}
                </button>
              </div>
            </div>
          )}

          <div className="integration-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
            {integrations.length ? (
              integrations.map((item) => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: '14px', padding: '14px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{item.name}</strong>
                      <span className={`section-mini-tag tag-${item.enabled ? 'green' : 'gray'}`} style={{ fontSize: '11px' }}>
                        {item.enabled ? '已启用' : '已停用'}
                      </span>
                      <span className="section-mini-tag tag-blue" style={{ fontSize: '11px' }}>
                        {item.provider}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      地址：<code style={{ color: '#0369a1' }}>{item.baseUrl || '使用环境默认托管配置'}</code>
                    </div>
                    {item.lastError && (
                      <div style={{ fontSize: '11.5px', color: '#e11d48' }}>
                        ⚠ 检测异常：{item.lastError}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: item.lastTestedAt && !item.lastError && item.status === '连接正常' ? '#16a34a' : '#ea580c' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.lastTestedAt && !item.lastError && item.status === '连接正常' ? '#16a34a' : '#ea580c' }} />
                      {item.lastError ? '检测异常' : !item.lastTestedAt ? '尚无检测记录' : item.status}
                    </span>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      {item.lastTestedAt ? cnTime(item.lastTestedAt) : '未检测'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => testIntegration(item)}
                      style={{ padding: '6px 12px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #0284c7', background: '#f0f9ff', color: '#0284c7', cursor: 'pointer', fontWeight: 500 }}
                    >
                      {busy === item.id ? '检测中…' : '检测连接'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIntegration({ ...item, enabled: Boolean(item.enabled) });
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
                      onClick={() => removeIntegration(item)}
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
      </section>
    </div>
  );
}
