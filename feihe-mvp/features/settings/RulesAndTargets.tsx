'use client';

import { useState, useEffect, useRef } from 'react';
import type { Dashboard, Ops, Pipeline, ReviewRule, Goals } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
import { MetricCard } from '../../components/ui/operations/MetricCard';
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
  onDone: () => Promise<void>;
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

  useEffect(() => {
    if (acceptance.supplierSimilarity !== undefined) {
      setSimilarityDraft(String(Number((acceptance.supplierSimilarity * 100).toPrecision(12))));
    }
  }, [acceptance.supplierSimilarity]);

  useEffect(() => {
    if (showCompletedJobs) {
      const closeBtn = dialogRef.current?.querySelector<HTMLButtonElement>('button[data-dialog-close]');
      closeBtn?.focus();
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [showCompletedJobs]);

  const list = (value: string) =>
    value
      .split(/[，,\n]+/)
      .map((x) => x.trim())
      .filter(Boolean);

  async function saveAll() {
    setLoading(true);
    try {
      await api('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ projectId, rules, acceptance, pipelines, goals }),
      });
      toast('项目目标与规则已保存', 'success');
      await onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setLoading(false);
    }
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
    <div className="stack">
      <section className="ops-metric-grid" aria-label="已保存的目标与执行概况">
        <MetricCard
          label="历史已完成任务"
          value={num(ops.settings.goals.workCompleted)}
          unit="项"
          theme="green"
          tag="查看最近明细 ↗"
          desc={`项目总目标 ${num(ops.settings.goals.workTarget)} 项 · 累计完成 ${num(ops.settings.goals.workCompleted)} 项 · 点击查看最近任务中的完成记录`}
          clickable
          onClick={() => {
            triggerRef.current = (document.activeElement as HTMLElement) || null;
            setShowCompletedJobs(true);
          }}
        />
        <MetricCard label="月度 / 季度目标" value={`${num(ops.settings.goals.monthlyTarget)} / ${num(ops.settings.goals.quarterlyTarget)}`} unit="项" theme="purple" tag="已保存" desc="月度与季度独立维护；0 表示尚未设置目标" />
        <MetricCard label="已发布笔记" value={num(data.metrics.publishedCount)} unit="篇" theme="blue" desc={`来自项目笔记库 · 发布目标 ${num(ops.settings.goals.publishTarget)} 篇`} />
        <MetricCard label="启用的补充规则" value={ops.reviewRules.filter(item => Boolean(item.enabled)).length} unit="条" theme="teal" desc={`已登记 ${ops.reviewRules.length} 条 · 执行主线 ${data.pipelines.length} 条`} />
      </section>
      {/* Project Totals & Goals */}
      <section className="panel project-goal-settings pastel-card reference-section section-purple" id="project-totals">
        <PanelHead eyebrow="PROJECT TOTALS" title="项目总盘与进度目标" />
        <p className="settings-hint">
          这些值决定首页项目进度、消耗进度、发布进度和评论交付的总值。预算或评论目标填 0 时，自动使用主线合计。
        </p>
       <div className="goal-form-grid">
         <label>
           项目总任务数
           <input
             type="number"
             min="0"
             value={goals.workTarget}
             onChange={(e) => setGoals({ ...goals, workTarget: num(e.target.value) })}
           />
           <small>整个项目计划完成的任务数</small>
         </label>
          <label>
            月度总任务数
            <input
              type="number"
              min="0"
              value={goals.monthlyTarget ?? 0}
              onChange={(e) => setGoals({ ...goals, monthlyTarget: num(e.target.value) })}
            />
            <small>当前月份计划承接任务总数</small>
          </label>
          <label>
            季度总任务数
            <input
              type="number"
              min="0"
              value={goals.quarterlyTarget ?? 0}
              onChange={(e) => setGoals({ ...goals, quarterlyTarget: num(e.target.value) })}
            />
            <small>当前季度全周期计划任务数</small>
          </label>
         <label>
           已完成任务数
           <input
             type="number"
             min="0"
             value={goals.workCompleted}
              disabled
              readOnly
              style={{ background: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
           />
            <small>系统被动自动刷新（来自作业执行已完成统计，不可手动编辑）</small>
         </label>
         <label>
           计划发布总量
            <input
              type="number"
              min="0"
              value={goals.publishTarget}
              onChange={(e) => setGoals({ ...goals, publishTarget: num(e.target.value) })}
            />
            <small>计划发布的自有与商业笔记总篇数</small>
          </label>
          <label>
            项目预算总额
            <input
              type="number"
              min="0"
              value={goals.budgetTarget}
              onChange={(e) => setGoals({ ...goals, budgetTarget: num(e.target.value) })}
            />
            <small>当前主线预算合计 ¥{pipelineBudget.toLocaleString()}</small>
          </label>
          <label>
            评论交付总目标
            <input
              type="number"
              min="0"
              value={goals.commentTarget}
              onChange={(e) => setGoals({ ...goals, commentTarget: num(e.target.value) })}
            />
            <small>当前主线目标合计 {pipelineComments.toLocaleString()} 条</small>
          </label>
        </div>
      </section>

      {/* Acceptance Thresholds & Keywords */}
      <section className="settings-grid">
        <article className="panel pastel-card reference-section section-blue">
          <PanelHead eyebrow="ACCEPTANCE" title="验收与更新阈值" />
          <div className="form-grid">
            <label>
              可汇报最低评论数
              <input
                type="number"
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
           </label>
          </div>
        </article>

        <article className="panel pastel-card reference-section section-blue">
          <PanelHead eyebrow="BRAND SCOPE" title="品牌与情绪词库" />
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
        </article>
      </section>

      {/* Supplemental Rules & Action Logic */}
      <section className="settings-grid">
        <article className="panel pastel-card reference-section section-blue">
          <PanelHead eyebrow="SUPPLEMENTAL REVIEW" title="补充审查规则" />
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
              <span>竞品提及默认进入“需删除”</span>
            </label>
          </div>
        </article>

        <article className="panel pastel-card reference-section section-blue">
          <PanelHead eyebrow="ACTION LOGIC" title="审查动作说明" />
          <ul className="insight-list">
            <li>
              <b>需达人回复</b>
              <span>命中问询词且未命中负向、出售或无关规则。</span>
            </li>
            <li>
              <b>需删除</b>
              <span>负向、出售引流、纯表情、无关灌水，以及开启后的竞品提及。</span>
            </li>
            <li>
              <b>需补充</b>
              <span>有效评论低于基础阈值，进入评论补量队列。</span>
            </li>
            <li>
              <b>符合且能汇报</b>
              <span>总评论和前排产品提及率同时达到项目阈值。</span>
            </li>
          </ul>
        </article>
      </section>

      {/* Pipelines & Custom Rules CRUD */}
      <section className="advanced-crud">
        <article className="panel pastel-card reference-section section-blue">
          <PanelHead eyebrow="CUSTOM REVIEW RULES" title="补充审查规则管理" />
          <div className="compact-crud-form">
            <input
              placeholder="规则名称"
              value={rule.name || ''}
              onChange={(e) => setRule({ ...rule, name: e.target.value })}
            />
            <input
              placeholder="关键词，逗号分隔"
              value={rule.keywords || ''}
              onChange={(e) => setRule({ ...rule, keywords: e.target.value })}
            />
            <select
              value={rule.sentiment || '中立'}
              onChange={(e) => setRule({ ...rule, sentiment: e.target.value })}
            >
              <option>正向</option>
              <option>中立</option>
              <option>问询</option>
              <option>负向</option>
            </select>
            <select
              value={rule.action || '保留观察'}
              onChange={(e) => setRule({ ...rule, action: e.target.value })}
            >
              <option>保留观察</option>
              <option>需达人回复</option>
              <option>需删除</option>
            </select>
            <button className="primary" onClick={saveRule}>
              {rule.id ? '保存修改' : '新增规则'}
            </button>
          </div>
          <div className="crud-list">
            {ops.reviewRules.map((item) => (
              <div key={item.id}>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.keywords} · {item.sentiment} · {item.action}
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
        </article>

        <article className="panel pastel-card reference-section section-blue">
          <PanelHead eyebrow="PIPELINE CRUD" title="执行主线管理" />
          <div className="compact-crud-form pipeline-add">
            <input
              placeholder="新主线名称"
              value={pipelineName}
              onChange={(e) => setPipelineName(e.target.value)}
            />
            <button className="primary" onClick={addPipeline}>
              新增主线
            </button>
          </div>
          <div className="crud-list">
            {pipelines.map((item) => (
              <div key={item.id}>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.deliveredCount}/{item.targetCount} 条 · ¥{item.spent}/¥{item.budget}
                  </small>
                </span>
                <button
                  className="danger-link"
                  onClick={() => mutate('pipeline_delete', { key: item.id }, '执行主线已删除')}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel pastel-card reference-section section-blue">
        <PanelHead eyebrow="EXECUTION TARGET" title="项目主线目标与费用" />
        <div className="pipeline-editor">
          {pipelines.map((p, pIdx) => (
            <article key={p.id}>
              <strong>{p.name}</strong>
              {[
                ['目标', 'targetCount'],
                ['已交付', 'deliveredCount'],
                ['预算', 'budget'],
                ['已花费', 'spent'],
              ].map(([label, key]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    value={num(p[key as keyof Pipeline])}
                    onChange={(e) =>
                      setPipelines(
                        pipelines.map((x, i) =>
                          i === pIdx ? { ...x, [key]: num(e.target.value) } : x
                        )
                      )
                    }
                  />
                </label>
              ))}
            </article>
          ))}
        </div>
        <div className="save-row">
          <p>保存后立即更新当前项目规则与总盘目标，不影响其他项目。</p>
          <button className="primary" disabled={loading} onClick={saveAll}>
            保存当前项目全部规则与目标
          </button>
        </div>
      </section>

      {/* 已完成任务明细查看弹窗 */}
      {showCompletedJobs && (
        <div
          className="entity-backdrop"
          onMouseDown={() => setShowCompletedJobs(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setShowCompletedJobs(false);
            }
          }}
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
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="section-mini-tag tag-green">最近任务</span>
                <h2 id="completed-jobs-dialog-title" style={{ fontSize: '17px', margin: 0, fontWeight: 700, color: '#0f172a' }}>
                  最近任务中的已完成记录
                </h2>
              </div>
              <button
                type="button"
                data-dialog-close
                onClick={() => setShowCompletedJobs(false)}
                aria-label="关闭已完成任务明细弹窗"
                style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#64748b', padding: '4px 8px' }}
              >
                ×
              </button>
            </header>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12.5px', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span>
                系统当前展示最近 <strong>{ops.jobs?.length ?? 0}</strong> 条任务中已完成的 <strong>{completedJobs.length}</strong> 项
              </span>
              <span style={{ color: '#64748b' }}>
                全历史累计完成：<strong style={{ color: '#16a34a' }}>{num(ops.settings.goals.workCompleted)}</strong> 项（受系统接口限制，明细仅回溯最近 40 条任务）
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: '260px', maxHeight: 'calc(85vh - 180px)' }}>
              {completedJobs.length > 0 ? (
                <table className="ops-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px', background: '#f8fafc', color: '#475569', fontSize: '12.5px' }}>任务名称</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', background: '#f8fafc', color: '#475569', fontSize: '12.5px' }}>类型</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', background: '#f8fafc', color: '#475569', fontSize: '12.5px' }}>处理数量</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', background: '#f8fafc', color: '#475569', fontSize: '12.5px' }}>进度</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', background: '#f8fafc', color: '#475569', fontSize: '12.5px' }}>执行结果</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', background: '#f8fafc', color: '#475569', fontSize: '12.5px' }}>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedJobs.map((job) => {
                      const hasSucceeded = typeof job.succeeded === 'number' && Number.isFinite(job.succeeded);
                      const hasTotal = typeof job.total === 'number' && Number.isFinite(job.total);
                      const progressPct = typeof job.progress === 'number' && Number.isFinite(job.progress) ? job.progress : null;
                      return (
                      <tr key={job.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                          {job.title || '未命名任务'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12.5px', color: '#64748b' }}>
                          <span className="section-mini-tag tag-blue" style={{ fontSize: '11px' }}>
                            {job.type}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12.5px', color: '#0f172a' }}>
                          {hasSucceeded || hasTotal ? `${hasSucceeded ? job.succeeded : '—'} / ${hasTotal ? job.total : '—'}` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
                          {progressPct !== null ? `${progressPct}%` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', maxWidth: '260px' }}>
                          {job.message || '执行成功完成'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {job.finishedAt ? (
                            <span>完成于 {job.finishedAt}</span>
                          ) : job.createdAt ? (
                            <span style={{ color: '#64748b' }}>创建于 {job.createdAt}</span>
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

            <footer style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <button
                type="button"
                className="primary"
                onClick={() => setShowCompletedJobs(false)}
                style={{ padding: '7px 16px', fontSize: '13px' }}
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
