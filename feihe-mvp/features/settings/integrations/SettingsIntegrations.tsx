'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Integration, IntegrationData } from '../../../lib/types/project';
import { EmptyState } from '../../../components/ui/EmptyState';
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
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api<IntegrationData>('/api/integrations');
      setTools(data);
    } catch {
      // ignore
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

  return (
    <div className="stack">
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

      <section className="platform-split">
        <article className="platform-panel side-form-panel">
          <div className="section-kicker">CONNECTION PROFILE</div>
          <h2>{integration.id ? '编辑集成' : '新增工具集成'}</h2>
          <p className="section-copy">敏感凭证由托管环境管理，不写入数据库。</p>
          <div className="platform-form">
            <label>
              集成名称
              <input
                value={String(integration.name || '')}
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
                placeholder="https://..."
              />
            </label>
            <label className="full">
              接口路径与参数 JSON
              <textarea
                rows={7}
                value={String(integration.configJson || '{}')}
                onChange={(e) => setIntegration({ ...integration, configJson: e.target.value })}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={integration.enabled !== false}
                onChange={(e) => setIntegration({ ...integration, enabled: e.target.checked })}
              />
              启用此集成
            </label>
          </div>
          <div className="editor-actions">
            {Boolean(integration.id) && (
              <button onClick={() => setIntegration(emptyIntegration)}>取消编辑</button>
            )}
            <button
              className="primary"
              disabled={busy === 'integration' || !integration.name}
              onClick={saveIntegration}
            >
              保存集成
            </button>
          </div>
        </article>

        <article className="platform-panel">
          <div className="list-head">
            <div>
              <div className="section-kicker">ACTIVE CONNECTIONS</div>
              <h2>当前项目的工具与接口</h2>
              <p>抓取任务会优先使用这里启用的接口配置。</p>
            </div>
            <b>{integrations.length}</b>
          </div>
          <div className="integration-list">
            {integrations.length ? (
              integrations.map((item) => (
                <div key={item.id}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.provider} · {item.baseUrl || '使用环境默认地址'}
                    </small>
                    <em>
                      最近检测 {cnTime(item.lastTestedAt)}
                      {item.lastError ? ' · ' + item.lastError : ''}
                    </em>
                  </span>
                  <i className={item.status === '连接正常' ? 'ok' : 'warn'}>
                    {item.status}
                  </i>
                  <button
                    onClick={() =>
                      setIntegration({ ...item, enabled: Boolean(item.enabled) })
                    }
                  >
                    编辑
                  </button>
                  <button disabled={busy === item.id} onClick={() => testIntegration(item)}>
                    检测
                  </button>
                  <button className="danger-link" onClick={() => removeIntegration(item)}>
                    删除
                  </button>
                </div>
              ))
            ) : (
              <EmptyState title="当前项目尚未配置工具集成" />
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
