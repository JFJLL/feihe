import React, { useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { CustomSelect } from '../../components/ui/CustomSelect';
import type { IndustryV2Config } from '../../lib/industry-v2-types';

export interface IndustryV2ConfigDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  spu: string;
  brand: string;
  initialConfig: IndustryV2Config | null;
  onSaved: (enqueueTriggered?: boolean) => Promise<void>;
}

export function IndustryV2ConfigDialog(props: IndustryV2ConfigDialogProps) {
  if (!props.open) return null;
  return <IndustryV2ConfigDialogModal {...props} />;
}

function IndustryV2ConfigDialogModal({
  onClose,
  projectId,
  spu,
  brand,
  initialConfig,
  onSaved,
}: IndustryV2ConfigDialogProps) {
  const [categoryKeyword, setCategoryKeyword] = useState(
    () => initialConfig?.categoryKeyword || ''
  );
  const [competitors, setCompetitors] = useState<string[]>(() => {
    const existing = initialConfig?.competitorKeywords || [];
    if (existing.length === 0) return ['', ''];
    return existing.slice(0, 5);
  });
  const [historyDays, setHistoryDays] = useState<string>(
    () => String(initialConfig?.historyDays || 30)
  );
  const [dailyEnabled, setDailyEnabled] = useState(
    () => initialConfig?.dailyEnabled !== false
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddCompetitor = () => {
    if (competitors.length < 5) {
      setCompetitors((prev) => [...prev, '']);
    }
  };

  const handleRemoveCompetitor = (index: number) => {
    setCompetitors((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.length > 0 ? updated : [''];
    });
  };

  const handleCompetitorChange = (index: number, val: string) => {
    setCompetitors((prev) => {
      const updated = [...prev];
      updated[index] = val;
      return updated;
    });
  };

  const handleSubmit = async (enqueueNow: boolean) => {
    setError(null);
    const trimmedCategory = categoryKeyword.trim();
    const validCompetitors = competitors
      .map((c) => c.trim())
      .filter((c) => Boolean(c))
      .slice(0, 5);

    const daysNum = Number(historyDays);
    const validatedDays: 7 | 14 | 30 | 90 =
      daysNum === 7 || daysNum === 14 || daysNum === 90 ? daysNum : 30;

    setSubmitting(true);
    try {
      // Step 1: Save config
      const res = await fetch('/api/industry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config_v2',
          projectId,
          categoryKeyword: trimmedCategory,
          competitorKeywords: validCompetitors,
          historyDays: validatedDays,
          dailyEnabled,
        }),
      });

      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || '保存行业配置失败');
      }

      // Step 2: Enqueue if requested
      if (enqueueNow) {
        const eqRes = await fetch('/api/industry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'enqueue_v2',
            projectId,
          }),
        });
        const eqJson = (await eqRes.json()) as { ok?: boolean; error?: string };
        if (!eqRes.ok || !eqJson.ok) {
          throw new Error(eqJson.error || '保存成功，但排队补采启动失败');
        }
      }

      await onSaved(enqueueNow);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={true}
      title="配置行业分析词包与采样参数"
      onClose={onClose}
      width={620}
      footer={
        <>
          <button
            type="button"
            className="v2-btn v2-btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            取消
          </button>
          <button
            type="button"
            className="v2-btn v2-btn-secondary"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
          >
            {submitting ? '保存中...' : '仅保存配置'}
          </button>
          <button
            type="button"
            className="v2-btn v2-btn-primary"
            onClick={() => handleSubmit(true)}
            disabled={submitting}
          >
            {submitting ? '排队提交中...' : '保存并立即排队补采'}
          </button>
        </>
      }
    >
      <div className="v2-dialog-content">
        {error && (
          <div className="v2-alert-error" role="alert">
            ⚠️ {error}
          </div>
        )}

        {/* Project Meta context */}
        <div className="v2-form-group">
          <label className="v2-form-label">本品 SPU 与归属品牌（自动关联）</label>
          <div className="v2-readonly-box">
            <span>本品标准词：<strong>{spu || '（当前项目未维护 SPU）'}</strong></span>
            <span>品牌：<strong>{brand || '未定义'}</strong></span>
          </div>
          <span className="v2-form-hint">
            本品词由项目资料的 SPU 字段驱动。如需变更本品词，请前往「项目设置」修改 SPU。
          </span>
        </div>

        {/* Category Keyword */}
        <div className="v2-form-group">
          <label htmlFor="categoryKeywordInput" className="v2-form-label">
            品类大词（必填/核心词 1 个）
          </label>
          <input
            id="categoryKeywordInput"
            type="text"
            className="v2-input"
            value={categoryKeyword}
            onChange={(e) => setCategoryKeyword(e.target.value)}
            placeholder="示例：越野跑鞋 / 冰箱 / 酒精湿巾 / 鸡蛋 / 奶粉 等品类词"
            maxLength={60}
          />
          <span className="v2-form-hint">
            用于跟踪品类关键词下的检索样本趋势（非全网大盘总量）。
          </span>
        </div>

        {/* Competitor Keywords */}
        <div className="v2-form-group">
          <div className="v2-form-label-row">
            <label className="v2-form-label">
              竞品监测词包（最多 5 个，默认 2 个）
            </label>
            <span className="v2-counter-text">{competitors.length} / 5</span>
          </div>
          <div className="v2-competitor-inputs">
            {competitors.map((item, idx) => (
              <div key={idx} className="v2-comp-input-row">
                <span className="v2-comp-index">竞品 {idx + 1}</span>
                <input
                  type="text"
                  className="v2-input"
                  value={item}
                  onChange={(e) => handleCompetitorChange(idx, e.target.value)}
                  placeholder="示例：竞品产品名或品牌词（如 FUJITRABUCO / 海尔 / 稳健）"
                  maxLength={60}
                />
                {competitors.length > 1 && (
                  <button
                    type="button"
                    className="v2-btn-icon-del"
                    onClick={() => handleRemoveCompetitor(idx)}
                    title="删除此竞品词"
                    aria-label={`删除竞品词 ${idx + 1}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {competitors.length < 5 && (
            <button
              type="button"
              className="v2-btn v2-btn-sm v2-btn-dashed"
              onClick={handleAddCompetitor}
              style={{ marginTop: 8 }}
            >
              + 添加竞品词
            </button>
          )}
          <span className="v2-form-hint">
            支持输入具体产品名或竞品品牌词，系统对每个词发起独立样本抓取。
          </span>
        </div>

        {/* History Range & Daily Switch */}
        <div className="v2-form-row">
          <div className="v2-form-group" style={{ flex: 1 }}>
            <label className="v2-form-label">历史补采区间</label>
            <CustomSelect
              value={historyDays}
              onChange={(val) => setHistoryDays(val)}
              options={[
                { value: '7', label: '近 7 天历史' },
                { value: '14', label: '近 14 天历史' },
                { value: '30', label: '近 30 天历史（推荐）' },
                { value: '90', label: '近 90 天历史' },
              ]}
            />
            <span className="v2-form-hint">
              初始将对所选历史天数进行渐进排队补采，截止上海前天（T-2）。
            </span>
          </div>

          <div className="v2-form-group" style={{ flex: 1 }}>
            <label className="v2-form-label">每日自动同步</label>
            <label className="v2-checkbox-label">
              <input
                type="checkbox"
                checked={dailyEnabled}
                onChange={(e) => setDailyEnabled(e.target.checked)}
              />
              <span>开启每日自动更新（截止 T-2）</span>
            </label>
            <span className="v2-form-hint">
              每天预算 360 页，单日单词上限 3 页。
            </span>
          </div>
        </div>

        {/* Budget & Compliance notice */}
        <div className="v2-dialog-notice">
          💡 <strong>调度与预算规则说明：</strong>
          每日预算上限 360 页，单业务日单查询词最多 3 页，超出时截断并标记为部分覆盖（partial），不伪装全量覆盖；所有补采均为后台异步排队调度，不阻塞界面交互。
        </div>
      </div>
    </Dialog>
  );
}
