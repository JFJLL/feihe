'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/hooks/use-project-data';
import type { BusinessConfig } from '../../lib/business-daily/store';
import type { SourceRole } from '../../lib/business-daily/types';

const ROLE_OPTIONS: { role: SourceRole | 'document'; label: string }[] = [
  { role: 'weekly', label: '周趋势底表 (weekly)' },
  { role: 'budget_plan', label: '预算排期 (budget_plan)' },
  { role: 'platform_snapshot', label: '平台效果快照 (platform_snapshot)' },
  { role: 'creator_snapshot', label: '达人储备快照 (creator_snapshot)' },
  { role: 'keywords', label: '关键词底表 (keywords)' },
  { role: 'keyword_notes', label: '关键词回搜笔记 (keyword_notes)' },
  { role: 'rectification', label: '在投笔记整改表 (rectification)' },
  { role: 'execution', label: '执行进度大表 (execution)' },
  { role: 'seo_acceptance', label: 'SEO验收表 (seo_acceptance)' },
  { role: 'seo_plan', label: 'SEO规划表 (seo_plan)' },
  { role: 'comment_register', label: '评论登记大表 (comment_register)' },
  { role: 'comment_statistics', label: '评论统计大表 (comment_statistics)' },
  { role: 'comment_plan', label: '评论计划表 (comment_plan)' },
  { role: 'platform_ads', label: '广告投流原始表 (platform_ads)' },
  { role: 'platform_commerce', label: '电商转化原始表 (platform_commerce)' },
  { role: 'document', label: '业务日报报告 (document)' },
];

export function BusinessConfigDrawer({
  projectId,
  isOpen,
  onClose,
  onSaved,
}: {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [rawConfig, setRawConfig] = useState<Record<string, unknown>>({});
  const [expectedVersion, setExpectedVersion] = useState<number>(0);
  const [canWrite, setCanWrite] = useState<boolean>(false);

  const [brandsText, setBrandsText] = useState('');
  const [competitorWordsText, setCompetitorWordsText] = useState('');
  const [alertThreshold, setAlertThreshold] = useState<number>(5);
  const [bindings, setBindings] = useState<{ key: string; role: SourceRole | 'document'; url: string }[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    setNotice('');
    api<{ ok: boolean; config: (BusinessConfig & { version?: number }) | null; canWrite: boolean }>(
      '/api/business-daily?projectId=' + encodeURIComponent(projectId) + '&action=config'
    )
      .then((res) => {
        setCanWrite(res.canWrite);
        const c = res.config || { bindings: [] };
        setRawConfig((c as unknown as Record<string, unknown>) || {});
        setExpectedVersion(c.version || 0);
        setBrandsText((c.brands || []).join('，'));
        setCompetitorWordsText((c.competitorWords || []).join('，'));
        setAlertThreshold(c.alertThresholdPoints !== undefined ? c.alertThresholdPoints : 5);
        setBindings((c.bindings || []).map(b => ({ ...b })));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : '读取业务配置失败');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  function updateBinding(index: number, field: string, value: string) {
    setBindings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addBinding() {
    setBindings((prev) => [
      ...prev,
      { key: 'source_' + Date.now().toString().slice(-4), role: 'weekly', url: '' },
    ]);
  }

  function removeBinding(index: number) {
    setBindings((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!canWrite) {
      setError('权限不足：当前角色无权修改项目业务配置');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');

    for (let i = 0; i < bindings.length; i++) {
      const b = bindings[i];
      if (!b.key.trim()) {
        setError('第 ' + (i + 1) + ' 项来源 key 不能为空');
        setSaving(false);
        return;
      }
      if (!b.url.trim()) {
        setError('来源 [' + b.key + '] 缺少有效 URL 地址');
        setSaving(false);
        return;
      }
      try {
        const u = new URL(b.url.trim());
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
      } catch {
        setError('来源 [' + b.key + '] 的 URL 必须是有效的 http/https 协议地址');
        setSaving(false);
        return;
      }
    }

    const keySet = new Set(bindings.map((b) => b.key.trim()));
    if (keySet.size !== bindings.length) {
      setError('存在重复的来源 key，请保持唯一');
      setSaving(false);
      return;
    }

    const brands = brandsText
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const competitorWords = competitorWordsText
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const mergedConfig: BusinessConfig & Record<string, unknown> = {
      ...rawConfig,
      bindings: bindings.map((b) => ({
        key: b.key.trim(),
        role: b.role,
        url: b.url.trim(),
      })),
      alertThresholdPoints: Number(alertThreshold),
      brands,
      competitorWords,
    };
    delete (mergedConfig as { version?: unknown }).version;

    try {
      const res = await api<{ ok: boolean; version: number }>('/api/business-daily', {
        method: 'POST',
        body: JSON.stringify({
          action: 'configure',
          projectId,
          config: mergedConfig,
          expectedVersion,
        }),
      });
      setExpectedVersion(res.version);
      setNotice('配置已成功保存！');
      onSaved();
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败，已保留修改草稿');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-backdrop" onMouseDown={onClose} data-testid="business-config-drawer">
      <aside
        className="drawer"
        style={{ width: '560px', maxWidth: '92vw' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="drawer-close" onClick={onClose} aria-label="关闭抽屉">
          ×
        </button>
        <small style={{ color: '#4175a0', fontWeight: 600 }}>BUSINESS CONFIGURATION</small>
        <h2>项目业务来源与规则配置</h2>
        <p className="drawer-meta">
          项目 ID: <code>{projectId}</code> · 当前版本: v{expectedVersion} ·{' '}
          {canWrite ? <span style={{ color: '#0d9488' }}>可编辑</span> : <span style={{ color: '#9a691e' }}>只读模式</span>}
        </p>

        {notice && <p role="status" style={{ background: '#ecfdf5', color: '#065f46', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}>{notice}</p>}
        {error && <p role="alert" style={{ background: '#fff1f2', color: '#9f1239', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}>{error}</p>}

        {loading ? (
          <p className="bd-caption">正在拉取项目配置详情…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              <strong>本品品牌与词库（逗号分隔）</strong>
              <input
                aria-label="本品品牌与词库"
                type="text"
                disabled={!canWrite || saving}
                value={brandsText}
                onChange={(e) => setBrandsText(e.target.value)}
                placeholder="例如: 飞鹤启萃"
                style={{ padding: '8px 10px', border: '1px solid #cdd8e6', borderRadius: '6px', fontSize: '13px' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              <strong>竞品对比词（逗号分隔）</strong>
              <input
                aria-label="竞品对比词"
                type="text"
                disabled={!canWrite || saving}
                value={competitorWordsText}
                onChange={(e) => setCompetitorWordsText(e.target.value)}
                placeholder="例如: 合生元派星, a2至初"
                style={{ padding: '8px 10px', border: '1px solid #cdd8e6', borderRadius: '6px', fontSize: '13px' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              <strong>FS 业务排期落后预警阈值（百分点）</strong>
              <input
                aria-label="预警阈值"
                type="number"
                min="0"
                max="100"
                disabled={!canWrite || saving}
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(Number(e.target.value))}
                style={{ padding: '8px 10px', border: '1px solid #cdd8e6', borderRadius: '6px', fontSize: '13px', width: '120px' }}
              />
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>来源绑定列表 ({bindings.length} 个)</strong>
                {canWrite && (
                  <button
                    type="button"
                    onClick={addBinding}
                    disabled={saving}
                    style={{ padding: '4px 10px', fontSize: '12px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '5px', cursor: 'pointer' }}
                  >
                    + 新增来源绑定
                  </button>
                )}
              </div>

              {bindings.length === 0 ? (
                <p className="bd-caption">当前尚未绑定任何来源表格或日报文档，请点击新增。</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                  {bindings.map((b, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>#{idx + 1}</span>
                        <input
                          aria-label={'来源标识-' + idx}
                          type="text"
                          disabled={!canWrite || saving}
                          value={b.key}
                          onChange={(e) => updateBinding(idx, 'key', e.target.value)}
                          placeholder="key 唯一英文标识"
                          style={{ flex: 1, padding: '4px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                        />
                        <select
                          aria-label={'业务角色-' + idx}
                          disabled={!canWrite || saving}
                          value={b.role}
                          onChange={(e) => updateBinding(idx, 'role', e.target.value as SourceRole)}
                          style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', maxWidth: '200px' }}
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.role} value={opt.role}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => removeBinding(idx)}
                            disabled={saving}
                            aria-label={'删除来源-' + idx}
                            style={{ padding: '4px 8px', fontSize: '12px', color: '#dc2626', border: '1px solid #fecaca', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            删除
                          </button>
                        )}
                      </div>
                      <input
                        aria-label={'来源地址-' + idx}
                        type="url"
                        disabled={!canWrite || saving}
                        value={b.url}
                        onChange={(e) => updateBinding(idx, 'url', e.target.value)}
                        placeholder="飞书表格、文档或系统接口的有效 http/https URL"
                        style={{ width: '100%', padding: '5px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{ padding: '8px 16px', fontSize: '13px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
              >
                取消
              </button>
              {canWrite && (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleSave}
                  disabled={saving || loading}
                  style={{ padding: '8px 18px', fontSize: '13px', background: '#1769d5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {saving ? '正在保存…' : '保存配置'}
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
