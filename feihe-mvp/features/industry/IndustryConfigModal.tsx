'use client';

import React, { useState } from 'react';
import type { IndustryProjectConfig } from '../../lib/industry-types';

export function IndustryConfigModal({
  projectId,
  spu,
  brand: _brand,
  config,
  onClose,
  onSaved,
}: {
  projectId: string;
  spu: string;
  brand: string;
  config: IndustryProjectConfig | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [competitorsText, setCompetitorsText] = useState(
    (config?.competitorBrands || []).join('\n')
  );
  const [dailySync, setDailySync] = useState(config?.dailySyncEnabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const competitorBrands = competitorsText
        .split(/[\n,，]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/industry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          projectId,
          competitorBrands,
          dailySyncEnabled: dailySync,
        }),
      });

      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '保存配置失败');
      }

      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(28, 32, 36, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 10,
          width: 500,
          maxWidth: '92vw',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>配置竞品品牌归因词包</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#60646c' }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{ padding: 10, background: '#feebec', border: '0.5px solid #fdbdbe', color: '#ce2c31', borderRadius: 6, fontSize: 14 }}>
            {error}
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1c2024', marginBottom: 4 }}>
            项目标准品 (SPU)
          </label>
          <input
            type="text"
            disabled
            value={spu || '未在项目资料中配置'}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '0.5px solid #cdced6', background: '#f0f0f3', color: '#60646c' }}
          />
          <small style={{ color: '#60646c', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
            SPU 严格与数据库项目资料绑定，修改请前往「项目设置 &gt; 项目资料」。
          </small>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1c2024', marginBottom: 4 }}>
            竞品品牌对比词包 (每行一个品牌，用于样本归因)
          </label>
          <textarea
            rows={4}
            value={competitorsText}
            onChange={(e) => setCompetitorsText(e.target.value)}
            placeholder="例如：始祖鸟&#10;北面&#10;萨洛蒙"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '0.5px solid #cdced6', fontSize: '0.875rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id="dailySyncCheckbox"
            checked={dailySync}
            onChange={(e) => setDailySync(e.target.checked)}
          />
          <label htmlFor="dailySyncCheckbox" style={{ fontSize: '0.875rem', color: '#1c2024' }}>
            启用每日定时采集 (Asia/Shanghai 调度器按该开关执行)
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 6, border: '0.5px solid #cdced6', background: '#fff', cursor: 'pointer' }}
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#0d74ce', color: '#fff', cursor: 'pointer' }}
          >
            {saving ? '保存中…' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
}
