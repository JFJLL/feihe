'use client';

import { useState } from 'react';
import type { Dashboard, Ops, Pipeline, ReviewRule, Goals } from '../../lib/types/project';
import { PanelHead } from '../../components/ui/PanelHead';
import { EmptyState } from '../../components/ui/EmptyState';
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

  return (
    <div className="stack">
      {/* Project Totals & Goals */}
      <section className="panel project-goal-settings" id="project-totals">
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
            已完成任务数
            <input
              type="number"
              min="0"
              value={goals.workCompleted}
              onChange={(e) => setGoals({ ...goals, workCompleted: num(e.target.value) })}
            />
            <small>当前项目已完成的任务数</small>
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
        <article className="panel">
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
                value={(acceptance.supplierSimilarity || 0.58) * 100}
                onChange={(e) =>
                  setAcceptance({
                    ...acceptance,
                    supplierSimilarity: num(e.target.value) / 100,
                  })
                }
              />
            </label>
          </div>
        </article>

        <article className="panel">
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
        <article className="panel">
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
            <label className="check-label">
              <input
                type="checkbox"
                checked={rules.deleteCompetitorMentions !== false}
                onChange={(e) =>
                  setRules({ ...rules, deleteCompetitorMentions: e.target.checked })
                }
              />
              竞品提及默认进入“需删除”
            </label>
          </div>
        </article>

        <article className="panel">
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
        <article className="panel">
          <PanelHead eyebrow="CUSTOM REVIEW RULES" title="补充审查规则 CRUD" />
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

        <article className="panel">
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

      <section className="panel">
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
    </div>
  );
}
