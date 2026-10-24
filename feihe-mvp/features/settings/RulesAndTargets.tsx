'use client';

import { useState, useEffect, useRef } from 'react';
import type { Dashboard, Ops, Pipeline, ReviewRule, Goals } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
import { StyledSelect } from '../../components/ui/StyledSelect';
import { num, api } from '../../lib/hooks/use-project-data';

export function RulesAndTargets({
  data,
  ops,
  projectId,
  onDone,
  toast,
}: {
  data: Dashboard;
  ops: Ops;
  projectId: string;
  onDone: (opts?: { fresh?: boolean; throwOnError?: boolean }) => Promise<void>;
  toast: (v: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [goals, setGoals] = useState<Goals>(ops.settings.goals);
  const [rules, setRules] = useState(ops.settings.rules);
  const [acceptance, setAcceptance] = useState(ops.settings.acceptance);
  const [pipelines, setPipelines] = useState<Pipeline[]>(data.pipelines);
  const [rule, setRule] = useState<Partial<ReviewRule>>({
    name: '',
    keywords: '',
    sentiment: '中立',
    category: '自定义规则',
    action: '保留观察',
    priority: 100,
    enabled: 1,
  });
  const [pipelineName, setPipelineName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCompletedJobs, setShowCompletedJobs] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const initialSimilarity = acceptance.supplierSimilarity ?? 0.58;
  const [similarityDraft, setSimilarityDraft] = useState(() => {
    return Number.isFinite(initialSimilarity) ? String(Number((initialSimilarity * 100).toPrecision(12))) : '58';
  });

  // Saved baseline tracking & conflict detection
  const isSavingRef = useRef(false);
  const [readBackError, setReadBackError] = useState<string | null>(null);
  const [savedBaseline, setSavedBaseline] = useState({
    goals: JSON.stringify(ops.settings.goals),
    rules: JSON.stringify(ops.settings.rules),
    acceptance: JSON.stringify(ops.settings.acceptance),
    pipelines: JSON.stringify(data.pipelines),
  });
  const [serverConflictWarning, setServerConflictWarning] = useState(false);

  const isGoalsDirty = JSON.stringify(goals) !== savedBaseline.goals;
  const isRulesDirty = JSON.stringify(rules) !== savedBaseline.rules;
  const isAcceptanceDirty = JSON.stringify(acceptance) !== savedBaseline.acceptance ||
    similarityDraft !== String(Number(((acceptance.supplierSimilarity ?? 0.58) * 100).toPrecision(12)));
  const isPipelinesDirty = JSON.stringify(pipelines) !== savedBaseline.pipelines;

  useEffect(() => {
    if (isSavingRef.current) return;
    const incomingGoals = JSON.stringify(ops.settings.goals);
    const incomingRules = JSON.stringify(ops.settings.rules);
    const incomingAcceptance = JSON.stringify(ops.settings.acceptance);
    const incomingPipelines = JSON.stringify(data.pipelines);

    const hasNewGoals = incomingGoals !== savedBaseline.goals;
    const hasNewRules = incomingRules !== savedBaseline.rules;
    const hasNewAcceptance = incomingAcceptance !== savedBaseline.acceptance;
    const hasNewPipelines = incomingPipelines !== savedBaseline.pipelines;

    if (!hasNewGoals && !hasNewRules && !hasNewAcceptance && !hasNewPipelines) return;

    if (isGoalsDirty || isRulesDirty || isAcceptanceDirty || isPipelinesDirty) {
      queueMicrotask(() => {
        setServerConflictWarning(true);
      });
      return;
    }

    queueMicrotask(() => {
      setGoals(ops.settings.goals);
      setRules(ops.settings.rules);
      setAcceptance(ops.settings.acceptance);
      setPipelines(data.pipelines);
      if (ops.settings.acceptance.supplierSimilarity !== undefined) {
        setSimilarityDraft(String(Number((ops.settings.acceptance.supplierSimilarity * 100).toPrecision(12))));
      }
      setSavedBaseline({
        goals: incomingGoals,
        rules: incomingRules,
        acceptance: incomingAcceptance,
        pipelines: incomingPipelines,
      });
      setServerConflictWarning(false);
    });
  }, [ops.settings, data.pipelines, savedBaseline, isGoalsDirty, isRulesDirty, isAcceptanceDirty, isPipelinesDirty]);

  useEffect(() => {
    if (showCompletedJobs) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const closeBtn = dialogRef.current?.querySelector<HTMLButtonElement>('button[data-dialog-close]');
      closeBtn?.focus();
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [showCompletedJobs]);

  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      setShowCompletedJobs(false);
      return;
    }

    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  const list = (value: string) =>
    value
      .split(/[，,\n]+/)
      .map((x) => x.trim())
      .filter(Boolean);

  async function saveAll() {
    const rawSimilarity = similarityDraft.trim();
    const similarityPct = parseFloat(rawSimilarity);
    if (!rawSimilarity || !Number.isFinite(similarityPct) || similarityPct < 30 || similarityPct > 100) {
      toast('供应商相似度阈值超出有效范围，请输入 30% 至 100% 之间的数值', 'error');
      return;
    }

    const finalSimilarity = Number((similarityPct / 100).toPrecision(12));
    const finalAcceptance = {
      ...acceptance,
      supplierSimilarity: finalSimilarity,
    };
    const submitted = { goals, rules, acceptance: finalAcceptance, pipelines };

    isSavingRef.current = true;
    setLoading(true);
    setReadBackError(null);

    try {
      await api('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ projectId, rules: submitted.rules, acceptance: submitted.acceptance, pipelines: submitted.pipelines, goals: submitted.goals }),
      });
    } catch (err) {
      isSavingRef.current = false;
      toast(err instanceof Error ? err.message : '保存失败', 'error');
      setLoading(false);
      return;
    }

    // POST succeeded! Now execute fresh read-back
    try {
      await onDone({ fresh: true, throwOnError: true });
    } catch (readErr) {
      isSavingRef.current = false;
      const msg = readErr instanceof Error ? readErr.message : '最新数据回读失败';
      setReadBackError(msg);
      toast('配置已保存至服务端，但最新数据回读未完成，请重试', 'info');
      setLoading(false);
      return;
    }

    // Both save and read-back succeeded!
    isSavingRef.current = false;
    setReadBackError(null);
    setServerConflictWarning(false);

    setSavedBaseline({
      goals: JSON.stringify(submitted.goals),
      rules: JSON.stringify(submitted.rules),
      acceptance: JSON.stringify(submitted.acceptance),
      pipelines: JSON.stringify(submitted.pipelines),
    });

    if (JSON.stringify(goals) === JSON.stringify(submitted.goals)) {
      setGoals(submitted.goals);
    }
    if (JSON.stringify(rules) === JSON.stringify(submitted.rules)) {
      setRules(submitted.rules);
    }
    if (JSON.stringify(acceptance) === JSON.stringify(submitted.acceptance)) {
      setAcceptance(submitted.acceptance);
      setSimilarityDraft(String(Number((finalSimilarity * 100).toPrecision(12))));
    }
    if (JSON.stringify(pipelines) === JSON.stringify(submitted.pipelines)) {
      setPipelines(submitted.pipelines);
    }

    toast('项目目标与规则已保存并同步', 'success');
    setLoading(false);
  }

  async function mutate(action: string, payload: Record<string, unknown>, message: string) {
    try {
      await api('/api/resources', {
        method: 'POST',
        body: JSON.stringify({ action, projectId, ...payload }),
      });
      toast(message, 'success');
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error');
    }
  }

  async function saveRule() {
    await mutate(
      'rule_upsert',
      { ...rule, nextAction: rule.action, enabled: Boolean(rule.enabled) },
      rule.id ? '补充规则已更新' : '补充规则已创建'
    );
    setRule({
      name: '',
      keywords: '',
      sentiment: '中立',
      category: '自定义规则',
      action: '保留观察',
      priority: 100,
      enabled: 1,
    });
  }

  async function addPipeline() {
    if (!pipelineName.trim()) return;
    await mutate('pipeline_upsert', { name: pipelineName.trim(), targetCount: 0 }, '执行主线已创建');
    setPipelineName('');
  }

  const pipelineBudget = pipelines.reduce((sum, row) => sum + num(row.budget), 0);
  const pipelineComments = pipelines.reduce((sum, row) => sum + num(row.targetCount), 0);
  const completedJobs = (ops.jobs || []).filter(j => j.status === '已完成');

  return (
    <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Area 1: 项目目标 (阶段目标设定 + 主线预算编辑与增删归属一起) */}
      <section
        className="panel project-goal-settings"
        id="project-totals"
        style={{
          background: 'var(--bg-card, #ffffff)',
          border: '0.5px solid var(--slate-6, #d9d9e0)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(28, 32, 36, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <PanelHead title="项目目标" />
        <p className="settings-hint" style={{ margin: 0, fontSize: '12px', color: 'var(--slate-11, #60646c)' }}>
          设定项目总盘、月度、季度与评论交付目标。预算或评论目标填 0 时，自动使用主线合计。
        </p>

        {/* 紧凑已完成任务查看按钮条 */}
        <div className="rules-completed-jobs-bar">
          <div className="rules-completed-jobs-info">
            <span className="rules-completed-jobs-count">
              历史已完成 <strong>{num(ops.settings.goals.workCompleted)}</strong> 项
            </span>
            <span className="rules-completed-jobs-hint">
              最近40条明细
            </span>
          </div>
          <button
            type="button"
            className="rules-view-jobs-btn"
            onClick={() => {
              triggerRef.current = (document.activeElement as HTMLElement) || null;
              setShowCompletedJobs(true);
            }}
          >
            查看最近任务 ↗
          </button>
        </div>

        <div className="goal-form-grid">
          <label>
            项目总任务数
            <input
              type="number"
              min="0"
              value={goals.workTarget}
              onChange={(e) => setGoals({ ...goals, workTarget: num(e.target.value) })}
            />
          </label>
          <label>
            月度总任务数
            <input
              type="number"
              min="0"
              value={goals.monthlyTarget ?? 0}
              onChange={(e) => setGoals({ ...goals, monthlyTarget: num(e.target.value) })}
            />
          </label>
          <label>
            季度总任务数
            <input
              type="number"
              min="0"
              value={goals.quarterlyTarget ?? 0}
              onChange={(e) => setGoals({ ...goals, quarterlyTarget: num(e.target.value) })}
            />
          </label>
          <label>
            已完成任务数
            <input
              type="number"
              min="0"
              value={goals.workCompleted}
              disabled
              readOnly
              style={{ background: 'var(--slate-3, #f0f0f3)', cursor: 'not-allowed', color: 'var(--slate-11, #60646c)' }}
            />
            <small>系统自动统计（只读）</small>
          </label>
          <label>
            计划发布总量
            <input
              type="number"
              min="0"
              value={goals.publishTarget}
              onChange={(e) => setGoals({ ...goals, publishTarget: num(e.target.value) })}
            />
          </label>
          <label>
            项目预算总额
            <input
              type="number"
              min="0"
              value={goals.budgetTarget}
              onChange={(e) => setGoals({ ...goals, budgetTarget: num(e.target.value) })}
            />
            <small>当前主线预算合计 ¥{pipelineBudget.toLocaleString()}（填 0 自动汇总）</small>
          </label>
          <label>
            评论交付总目标
            <input
              type="number"
              min="0"
              value={goals.commentTarget}
              onChange={(e) => setGoals({ ...goals, commentTarget: num(e.target.value) })}
            />
            <small>当前主线目标合计 {pipelineComments.toLocaleString()} 条（填 0 自动汇总）</small>
          </label>
        </div>

        {/* 执行主线管理与主线预算编辑归属在项目目标区 */}
        <div style={{ borderTop: '0.5px solid var(--slate-6, #d9d9e0)', paddingTop: '16px' }}>
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--slate-12, #1c2024)', margin: 0 }}>执行主线与费用预算</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--slate-11, #60646c)' }}>
              统一维护各执行主线的目标篇数、已交付数与预算消耗。可直接在此新增或删除主线。
            </p>
          </div>
          <div className="compact-crud-form pipeline-add" style={{ marginBottom: '16px' }}>
            <input
              placeholder="新主线名称"
              value={pipelineName}
              onChange={(e) => setPipelineName(e.target.value)}
              style={{ fontSize: '14px', height: '36px', borderRadius: '8px', border: '0.5px solid var(--slate-6, #d9d9e0)' }}
            />
            <button className="primary" onClick={addPipeline} style={{ fontSize: '14px', height: '36px', borderRadius: '8px' }}>
              新增主线
            </button>
          </div>
          <div className="pipeline-editor">
            {pipelines.map((p, pIdx) => {
              const target = num(p.targetCount) || 0;
              const delivered = num(p.deliveredCount) || 0;
              const budget = num(p.budget) || 0;
              const spent = num(p.spent) || 0;
              const deliveryPct = target > 0 ? Math.min(100, Math.round((delivered / target) * 100)) : null;
              const spendPct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : null;
              return (
                <article key={p.id} style={{ background: 'var(--bg-card, #ffffff)', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid var(--slate-6, #d9d9e0)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--slate-12, #1c2024)', fontWeight: 600 }}>{p.name}</strong>
                      {deliveryPct !== null && (
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--teal-11, #008573)', background: 'var(--teal-3, #e0f8f3)', padding: '2px 8px', borderRadius: '8px' }}>
                          交付率 {deliveryPct}%
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="danger-link"
                      onClick={() => mutate('pipeline_delete', { key: p.id }, '执行主线已删除')}
                      style={{ fontSize: '12px' }}
                    >
                      删除主线
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 500 }}>目标篇数</span>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={num(p.targetCount)}
                          onChange={(e) => setPipelines(pipelines.map((x, i) => i === pIdx ? { ...x, targetCount: num(e.target.value) } : x))}
                          style={{ width: '100%', height: '36px', padding: '0 28px 0 10px', fontSize: '14px', fontWeight: 600, color: 'var(--slate-12, #1c2024)', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', background: 'var(--slate-2, #f9f9fb)', textAlign: 'right' }}
                        />
                        <span style={{ position: 'absolute', right: '8px', fontSize: '12px', color: 'var(--slate-11, #60646c)', pointerEvents: 'none' }}>篇</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 500 }}>已交付篇数</span>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={num(p.deliveredCount)}
                          onChange={(e) => setPipelines(pipelines.map((x, i) => i === pIdx ? { ...x, deliveredCount: num(e.target.value) } : x))}
                          style={{ width: '100%', height: '36px', padding: '0 28px 0 10px', fontSize: '14px', fontWeight: 600, color: 'var(--teal-11, #008573)', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', background: 'var(--slate-2, #f9f9fb)', textAlign: 'right' }}
                        />
                        <span style={{ position: 'absolute', right: '8px', fontSize: '12px', color: 'var(--slate-11, #60646c)', pointerEvents: 'none' }}>篇</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 500 }}>预算费用</span>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: '8px', fontSize: '12px', color: 'var(--slate-11, #60646c)', pointerEvents: 'none' }}>¥</span>
                        <input
                          type="number"
                          value={num(p.budget)}
                          onChange={(e) => setPipelines(pipelines.map((x, i) => i === pIdx ? { ...x, budget: num(e.target.value) } : x))}
                          style={{ width: '100%', height: '36px', padding: '0 10px 0 22px', fontSize: '14px', fontWeight: 600, color: 'var(--slate-12, #1c2024)', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', background: 'var(--slate-2, #f9f9fb)', textAlign: 'right' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--slate-11, #60646c)', fontWeight: 500 }}>已花费费用</span>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: '8px', fontSize: '12px', color: 'var(--slate-11, #60646c)', pointerEvents: 'none' }}>¥</span>
                        <input
                          type="number"
                          value={num(p.spent)}
                          onChange={(e) => setPipelines(pipelines.map((x, i) => i === pIdx ? { ...x, spent: num(e.target.value) } : x))}
                          style={{ width: '100%', height: '36px', padding: '0 10px 0 22px', fontSize: '14px', fontWeight: 600, color: 'var(--teal-11, #008573)', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', background: 'var(--slate-2, #f9f9fb)', textAlign: 'right' }}
                        />
                      </div>
                    </div>
                  </div>
                  {spendPct !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--slate-11, #60646c)' }}>
                      <span>预算消耗进度</span>
                      <div style={{ flex: 1, height: '6px', background: 'var(--slate-3, #f0f0f3)', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${spendPct}%`, height: '100%', background: 'var(--teal-9, #12a594)', borderRadius: '8px' }} />
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--teal-11, #008573)' }}>{spendPct}%</span>
                    </div>
                  )}
                </article>
              );
            })}
            {!pipelines.length && <EmptyState title="尚未添加执行主线" />}
          </div>
        </div>
      </section>

      {/* Area 2: 评论区验收标准 */}
      <section
        className="panel"
        style={{
          background: 'var(--bg-card, #ffffff)',
          border: '0.5px solid var(--slate-6, #d9d9e0)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(28, 32, 36, 0.04)',
        }}
      >
        <PanelHead title="评论区验收标准" />
        <p style={{ margin: '4px 0 16px', fontSize: '12px', color: 'var(--slate-11, #60646c)' }}>
          {acceptance.targetsConfirmed === false || !acceptance.reportCount || !acceptance.baseCount ? '评论验收目标未设置。0表示未设置；填写本项目的正整数目标并保存后才用于验收，不继承其他客户目标。' : '当前为本项目已确认的验收目标，修改后请保存。'}
        </p>
        <div className="form-grid">
          <label>
            可汇报最低评论数
            <input
              type="number"
              min="0"
              step="1"
              value={acceptance.reportCount}
              onChange={(e) =>
                setAcceptance({ ...acceptance, reportCount: num(e.target.value) })
              }
            />
          </label>
          <label>
            基础达标评论数
            <input
              type="number"
              min="0"
              step="1"
              value={acceptance.baseCount}
              onChange={(e) =>
                setAcceptance({ ...acceptance, baseCount: num(e.target.value) })
              }
            />
          </label>
          <label>
            前排产品提及率（%）
            <input
              type="number"
              value={acceptance.brandTopRate * 100}
              onChange={(e) =>
                setAcceptance({ ...acceptance, brandTopRate: num(e.target.value) / 100 })
              }
            />
          </label>
          <label>
            数据新鲜度（小时）
            <input
              type="number"
              value={acceptance.freshnessHours || 24}
              onChange={(e) =>
                setAcceptance({ ...acceptance, freshnessHours: num(e.target.value) })
              }
            />
          </label>
          <label>
            供应商相似度阈值（%）
            <input
              type="number"
              step="any"
              min="30"
              max="100"
              value={similarityDraft}
              onChange={(e) => {
                const raw = e.target.value;
                setSimilarityDraft(raw);
                if (raw.trim() !== '') {
                  const parsed = parseFloat(raw);
                  if (Number.isFinite(parsed)) {
                    const decimalVal = Number((parsed / 100).toPrecision(12));
                    setAcceptance((prev) => ({
                      ...prev,
                      supplierSimilarity: decimalVal,
                    }));
                  }
                }
              }}
              onBlur={() => {
                if (similarityDraft.trim() === '') {
                  const fallback = acceptance.supplierSimilarity ?? 0.58;
                  setSimilarityDraft(String(Number((fallback * 100).toPrecision(12))));
                }
              }}
            />
            <small style={{ display: 'block', color: 'var(--slate-11, #60646c)', marginTop: '4px', fontSize: '12px' }}>
              有效范围 30% – 100%（对应底层阈值 0.3 – 1.0）
            </small>
          </label>
        </div>
      </section>

      {/* Area 3: 识别与处置规则 (词库配置 + 补充审查与处置动作 + 动作说明 + 自定义补充规则 CRUD) */}
      <section
        className="panel"
        style={{
          background: 'var(--bg-card, #ffffff)',
          border: '0.5px solid var(--slate-6, #d9d9e0)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(28, 32, 36, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <div>
          <PanelHead title="识别与处置规则" />
          <p style={{ margin: '4px 0 16px', fontSize: '12px', color: 'var(--slate-11, #60646c)' }}>
            配置本品、竞品与情绪识别词库，定义补充处置规则与动作说明。
          </p>
          <div className="form-grid">
            <label>
              本品 / SPU 词
              <textarea
                value={rules.brands.join(',')}
                onChange={(e) => setRules({ ...rules, brands: list(e.target.value) })}
              />
            </label>
            <label>
              竞品词
              <textarea
                value={rules.competitors.join(',')}
                onChange={(e) => setRules({ ...rules, competitors: list(e.target.value) })}
              />
            </label>
            <label>
              正向词
              <textarea
                value={rules.positiveWords.join(',')}
                onChange={(e) => setRules({ ...rules, positiveWords: list(e.target.value) })}
              />
            </label>
            <label>
              负向词
              <textarea
                value={rules.negativeWords.join(',')}
                onChange={(e) => setRules({ ...rules, negativeWords: list(e.target.value) })}
              />
            </label>
          </div>
        </div>

        <div style={{ borderTop: '0.5px solid var(--slate-6, #d9d9e0)', paddingTop: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--slate-12, #1c2024)', margin: '0 0 12px' }}>补充审查与处置动作</h3>
          <div className="form-grid">
            <label>
              问询识别词
              <textarea
                value={(rules.questionWords || []).join(',')}
                onChange={(e) => setRules({ ...rules, questionWords: list(e.target.value) })}
              />
            </label>
            <label>
              出售 / 引流词
              <textarea
                value={(rules.sellingWords || []).join(',')}
                onChange={(e) => setRules({ ...rules, sellingWords: list(e.target.value) })}
              />
            </label>
            <label>
              无关 / 灌水词
              <textarea
                value={(rules.irrelevantWords || []).join(',')}
                onChange={(e) => setRules({ ...rules, irrelevantWords: list(e.target.value) })}
              />
            </label>
            <label className="check-label full-width-check" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '4px', userSelect: 'none' }}>
              <input
                type="checkbox"
                style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer' }}
                checked={rules.deleteCompetitorMentions !== false}
                onChange={(e) =>
                  setRules({ ...rules, deleteCompetitorMentions: e.target.checked })
                }
              />
              <span style={{ fontSize: '14px' }}>竞品提及默认进入“需删除”</span>
            </label>
          </div>
        </div>

        <div style={{ background: 'var(--slate-2, #f9f9fb)', borderRadius: '8px', padding: '16px', border: '0.5px solid var(--slate-6, #d9d9e0)' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: 'var(--slate-12, #1c2024)' }}>审查动作说明</h4>
          <ul className="insight-list" style={{ margin: 0, padding: 0 }}>
            <li style={{ fontSize: '12px' }}>
              <b>需达人回复</b>
              <span>命中问询词且未命中负向、出售或无关规则。</span>
            </li>
            <li style={{ fontSize: '12px' }}>
              <b>需删除</b>
              <span>负向、出售引流、纯表情、无关灌水，以及开启后的竞品提及。</span>
            </li>
            <li style={{ fontSize: '12px' }}>
              <b>需补充</b>
              <span>有效评论低于基础阈值，进入评论补量队列。</span>
            </li>
            <li style={{ fontSize: '12px' }}>
              <b>符合且能汇报</b>
              <span>总评论和前排产品提及率同时达到项目阈值。</span>
            </li>
          </ul>
        </div>

        <div style={{ borderTop: '0.5px solid var(--slate-6, #d9d9e0)', paddingTop: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--slate-12, #1c2024)', margin: '0 0 12px' }}>自定义补充规则</h3>
          <div className="compact-crud-form">
            <input
              placeholder="规则名称"
              value={rule.name || ''}
              onChange={(e) => setRule({ ...rule, name: e.target.value })}
              style={{ fontSize: '14px', height: '36px', borderRadius: '8px', border: '0.5px solid var(--slate-6, #d9d9e0)' }}
            />
            <input
              placeholder="关键词，逗号分隔"
              value={rule.keywords || ''}
              onChange={(e) => setRule({ ...rule, keywords: e.target.value })}
              style={{ fontSize: '14px', height: '36px', borderRadius: '8px', border: '0.5px solid var(--slate-6, #d9d9e0)' }}
            />
            <StyledSelect
              value={rule.sentiment || '中立'}
              onChange={(e) => setRule({ ...rule, sentiment: e.target.value })}
              aria-label="情绪分类"
            >
              <option>正向</option>
              <option>中立</option>
              <option>问询</option>
              <option>负向</option>
            </StyledSelect>
            <StyledSelect
              value={rule.action || '保留观察'}
              onChange={(e) => setRule({ ...rule, action: e.target.value })}
              aria-label="规则处置动作"
            >
              <option>保留观察</option>
              <option>需达人回复</option>
              <option>需删除</option>
            </StyledSelect>
            <button className="primary" onClick={saveRule} style={{ fontSize: '14px', height: '36px', borderRadius: '8px' }}>
              {rule.id ? '保存修改' : '新增规则'}
            </button>
          </div>
          <div className="crud-list">
            {ops.reviewRules.map((item) => (
              <div key={item.id}>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.keywords} / {item.sentiment} / {item.action}
                  </small>
                </span>
                <button onClick={() => setRule(item)}>编辑</button>
                <button
                  className="danger-link"
                  onClick={() => mutate('rule_delete', { id: item.id }, '规则已删除')}
                >
                  删除
                </button>
              </div>
            ))}
            {!ops.reviewRules.length && <EmptyState title="尚未创建补充审查规则" />}
          </div>
        </div>
      </section>

      {/* 状态预警与回读重试横条 */}
      {serverConflictWarning && (
        <div style={{ background: 'var(--amber-3, #fff7c2)', border: '0.5px solid var(--amber-6, #f3d673)', color: 'var(--amber-11, #ab6400)', padding: '10px 16px', borderRadius: '8px', fontSize: '12px' }}>
          ⚠️ 检测到服务端规则或目标已有外部变更，当前已保留您的本地草稿。请核对后再保存全部配置。
        </div>
      )}
      {readBackError && (
        <div style={{ background: 'var(--iris-3, #f0f1fe)', border: '0.5px solid var(--iris-6, #cbcdff)', color: 'var(--iris-11, #5753c6)', padding: '10px 16px', borderRadius: '8px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span>配置已保存至服务器，但最新数据回读未完成（{readBackError}）。</span>
          <button
            type="button"
            className="subtle-btn"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={async () => {
              setLoading(true);
              try {
                await onDone({ fresh: true, throwOnError: true });
                setReadBackError(null);
                toast('最新数据回读成功', 'success');
              } catch (e) {
                toast('重试回读失败：' + (e instanceof Error ? e.message : '未知错误'), 'error');
              } finally {
                setLoading(false);
              }
            }}
          >
            重试回读最新数据
          </button>
        </div>
      )}

      {/* 显眼粘性底部独立操作条：明确保存全部配置 */}
      <div className="settings-sticky-action-bar" aria-label="项目规则与目标保存操作栏">
        <div>
          <p className="settings-sticky-action-desc">
            应用到当前项目。
          </p>
        </div>
        <button
          type="button"
          className="primary settings-sticky-action-btn"
          disabled={loading}
          onClick={saveAll}
        >
          {loading ? '正在保存…' : '保存全部配置'}
        </button>
      </div>

      {/* 已完成任务明细查看弹窗 */}
      {showCompletedJobs && (
        <div
          className="entity-backdrop"
          onMouseDown={() => setShowCompletedJobs(false)}
          onKeyDown={handleDialogKeyDown}
        >
          <div
            ref={dialogRef}
            className="entity-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="completed-jobs-dialog-title"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ width: '880px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
          >
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid var(--slate-6, #d9d9e0)', paddingBottom: '14px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="section-mini-tag tag-green">最近任务</span>
                <h2 id="completed-jobs-dialog-title" style={{ fontSize: '16px', margin: 0, fontWeight: 600, color: 'var(--slate-12, #1c2024)' }}>
                  最近任务中的已完成记录
                </h2>
              </div>
              <button
                type="button"
                data-dialog-close
                onClick={() => setShowCompletedJobs(false)}
                aria-label="关闭已完成任务明细弹窗"
                style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--slate-11, #60646c)', padding: '4px 8px' }}
              >
                ×
              </button>
            </header>

            <div style={{ background: 'var(--slate-2, #f9f9fb)', border: '0.5px solid var(--slate-6, #d9d9e0)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: 'var(--slate-11, #60646c)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span>
                系统当前展示最近 <strong>{ops.jobs?.length ?? 0}</strong> 条任务中已完成的 <strong>{completedJobs.length}</strong> 项
              </span>
              <span style={{ color: 'var(--slate-11, #60646c)' }}>
                全历史累计完成：<strong style={{ color: 'var(--jade-9, #29a383)' }}>{num(ops.settings.goals.workCompleted)}</strong> 项（受系统接口限制，明细仅回溯最近 40 条任务）
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: '260px', maxHeight: 'calc(85vh - 180px)' }}>
              {completedJobs.length > 0 ? (
                <table className="ops-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px', background: 'var(--slate-2, #f9f9fb)', color: 'var(--slate-12, #1c2024)', fontSize: '12px' }}>任务名称</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', background: 'var(--slate-2, #f9f9fb)', color: 'var(--slate-12, #1c2024)', fontSize: '12px' }}>类型</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', background: 'var(--slate-2, #f9f9fb)', color: 'var(--slate-12, #1c2024)', fontSize: '12px' }}>处理数量</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', background: 'var(--slate-2, #f9f9fb)', color: 'var(--slate-12, #1c2024)', fontSize: '12px' }}>进度</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', background: 'var(--slate-2, #f9f9fb)', color: 'var(--slate-12, #1c2024)', fontSize: '12px' }}>执行结果</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', background: 'var(--slate-2, #f9f9fb)', color: 'var(--slate-12, #1c2024)', fontSize: '12px' }}>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedJobs.map((job) => {
                      const hasSucceeded = typeof job.succeeded === 'number' && Number.isFinite(job.succeeded);
                      const hasTotal = typeof job.total === 'number' && Number.isFinite(job.total);
                      const progressPct = typeof job.progress === 'number' && Number.isFinite(job.progress) ? job.progress : null;
                      return (
                      <tr key={job.id} style={{ borderBottom: '0.5px solid var(--slate-6, #d9d9e0)' }}>
                        <td style={{ padding: '10px 12px', fontSize: '14px', fontWeight: 600, color: 'var(--slate-12, #1c2024)' }}>
                          {job.title || '未命名任务'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--slate-11, #60646c)' }}>
                          <span className="section-mini-tag tag-blue" style={{ fontSize: '12px' }}>
                            {job.type}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', color: 'var(--slate-12, #1c2024)' }}>
                          {hasSucceeded || hasTotal ? `${hasSucceeded ? job.succeeded : '—'} / ${hasTotal ? job.total : '—'}` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', color: 'var(--jade-9, #29a383)', fontWeight: 600 }}>
                          {progressPct !== null ? `${progressPct}%` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--slate-11, #60646c)', maxWidth: '260px' }}>
                          {job.message || '执行成功完成'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', color: 'var(--slate-11, #60646c)', whiteSpace: 'nowrap' }}>
                          {job.finishedAt ? (
                            <span>完成于 {job.finishedAt}</span>
                          ) : job.createdAt ? (
                            <span style={{ color: 'var(--slate-11, #60646c)' }}>创建于 {job.createdAt}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : num(ops.settings.goals.workCompleted) > 0 ? (
                <EmptyState
                  title="最近任务中无已完成记录"
                  text={`系统接口仅保留最近 40 条任务记录，当前这批任务中暂无已完成项（全历史累计已完成 ${num(ops.settings.goals.workCompleted)} 项）。`}
                />
              ) : (
                <EmptyState title="暂无已完成任务记录" text="系统作业执行完成后将在此处归档留痕。" />
              )}
            </div>

            <footer style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', borderTop: '0.5px solid var(--slate-6, #d9d9e0)', paddingTop: '12px' }}>
              <button
                type="button"
                className="primary"
                onClick={() => setShowCompletedJobs(false)}
                style={{ padding: '6px 16px', fontSize: '14px', borderRadius: '8px' }}
              >
                关闭
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
