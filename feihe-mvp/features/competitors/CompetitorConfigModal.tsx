'use client';

import React, { useState } from 'react';
import type { CompetitorConfig } from '../../lib/competitors/types';

interface ConfigModalProps {
  projectId: string;
  config: CompetitorConfig;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (updated: CompetitorConfig) => void;
}

export function CompetitorConfigModal({
  projectId,
  config,
  isOpen,
  onClose,
  onSaveSuccess,
}: ConfigModalProps) {
  const [taskId, setTaskId] = useState(config.taskId || '');
  const [keywordsText, setKeywordsText] = useState((config.keywords || []).join(', '));
  const [maxPages, setMaxPages] = useState(config.maxPagesPerRun || 3);
  const [pageSize, setPageSize] = useState(config.pageSize || 20);
  const [rateLimitMs, setRateLimitMs] = useState(config.rateLimitMs || 1200);
  const [overlapDays, setOverlapDays] = useState(config.overlapWindowDays || 3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedTaskId = taskId.trim();
    if (!trimmedTaskId) {
      setError('必须提供明确的采集任务 ID (taskId)');
      return;
    }
    const kwList = keywordsText.split(/[,，\n]+/).map(s => s.trim()).filter(Boolean);
    if (kwList.length === 0) {
      setError('必须至少指定一个监测关键词');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          projectId,
          taskId: trimmedTaskId,
          keywords: kwList,
          maxPagesPerRun: Number(maxPages),
          pageSize: Number(pageSize),
          rateLimitMs: Math.max(1000, Number(rateLimitMs)),
          overlapWindowDays: Number(overlapDays),
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '保存配置失败');
      }
      onSaveSuccess(data.config);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '540px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '1.125rem 1.5rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: '#0f172a' }}>
              竞品监测数据源绑定与调度参数
            </h3>
            <small style={{ color: '#64748b' }}>项目专属配置 · 仅管理员/编辑权限可修改</small>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem' }}>
          {error && (
            <div style={{
              padding: '0.625rem 0.875rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#b91c1c',
              fontSize: '0.8125rem',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              上游采集系统 Task ID <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              placeholder="例如 ba7a885c-16b5-479d-a2a9-9cceb5908e9c"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8125rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontFamily: 'monospace',
              }}
            />
            <small style={{ display: 'block', color: '#64748b', marginTop: '0.25rem', fontSize: '0.75rem' }}>
              必须为公司采集系统 (http://xhs.yq.ipscg.com/grab) 中经核验的只读任务 ID，禁止跨项目越权。
            </small>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              监测竞品关键词 (逗号分隔) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={keywordsText}
              onChange={e => setKeywordsText(e.target.value)}
              placeholder="例如 合生元, 金领冠, 飞鹤, 爱他美"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8125rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                单次增量预算页数
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxPages}
                onChange={e => setMaxPages(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.8125rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              />
              <small style={{ color: '#64748b', fontSize: '0.71875rem' }}>单次运行限制页数，防止耗尽额度</small>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                每页记录条数
              </label>
              <input
                type="number"
                min={5}
                max={50}
                value={pageSize}
                onChange={e => setPageSize(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.8125rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              />
              <small style={{ color: '#64748b', fontSize: '0.71875rem' }}>建议 20 条，验证时可调小</small>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                安全限速延时 (ms)
              </label>
              <input
                type="number"
                min={1000}
                step={100}
                value={rateLimitMs}
                onChange={e => setRateLimitMs(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.8125rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              />
              <small style={{ color: '#64748b', fontSize: '0.71875rem' }}>必须 &gt;= 1000ms 保护上游</small>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                近期回刷窗口 (天)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={overlapDays}
                onChange={e => setOverlapDays(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.8125rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              />
              <small style={{ color: '#64748b', fontSize: '0.71875rem' }}>重叠回刷应对排序不稳定</small>
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.625rem',
            borderTop: '1px solid #e2e8f0',
            paddingTop: '1rem',
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.45rem 0.875rem',
                fontSize: '0.8125rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                background: '#0284c7',
                color: '#ffffff',
                border: '1px solid #0284c7',
                borderRadius: '6px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
