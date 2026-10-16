'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { LoadingState } from '../../components/ui/LoadingState';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { api, ApiError } from '../../lib/hooks/use-project-data';
import type { Dataset } from '../../lib/datasets';
import { defaultBusinessDomain, fieldRoleAccepts, requiredBusinessMetricKeys, type MetricRecommendation, type BusinessDomain, type FieldRoles } from '../../lib/metrics/recommendations';
import type { MetricComputeResult } from '../../lib/metrics/engine';
import type { DashboardCardConfig } from '../overview/CardEditModal';

type Plan = { dataset: Dataset; domain?: BusinessDomain; roles: FieldRoles; recommendations: Array<MetricRecommendation & { preview: MetricComputeResult }>; missing: string[] };
export function RecommendationDialog({ projectId, datasetId, templateId, initialDomain, onClose, onDone }: {
  projectId: string; datasetId: string; templateId?: string; initialDomain?: BusinessDomain; onClose: () => void; onDone: (cards: DashboardCardConfig[]) => void;
}) {
  const [roles, setRoles] = useState<FieldRoles | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [selected, setSelected] = useState<string[] | null>(null);
  const [domain, setDomain] = useState(initialDomain || defaultBusinessDomain(templateId || '')), [bindBusiness, setBindBusiness] = useState(true);
  const [revision, setRevision] = useState(0);
  const baseKey = JSON.stringify({ projectId, datasetId, domain });
  const key = JSON.stringify({ projectId, datasetId, roles, domain, revision });
  const [snapshot, setSnapshot] = useState<{ key: string; baseKey: string; value: Plan | null }>({ key: '', baseKey: '', value: null });
  const plan = snapshot.key === key ? snapshot.value : null;
  const editor = snapshot.baseKey === baseKey ? snapshot.value : null;
  const currentRoles = roles || editor?.roles || {};
  const lock = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) { errorRef.current?.focus(); errorRef.current?.scrollIntoView({ block: 'nearest' }); } }, [error]);
  const picked = selected || plan?.recommendations.map(item => item.key) || [];
  const incompleteBusinessSelection = Boolean(bindBusiness && domain && plan && !plan.missing.length && requiredBusinessMetricKeys(domain, plan.roles).some(metricKey => !picked.includes(metricKey)));
  useEffect(() => {
    const controller = new AbortController(); let current = true;
    const params = new URLSearchParams({ projectId, datasetId }); if (roles) params.set('roles', JSON.stringify(roles)); if (domain) params.set('domain', domain);
    api<Plan>('/api/metric-recommendations?' + params, { signal: controller.signal }).then(value => { if (current) { setSnapshot({ key, baseKey, value }); setError(''); } }).catch(error => { if (current) setError(error instanceof Error ? error.message : '字段推荐加载失败'); });
    return () => { current = false; controller.abort(); };
  }, [projectId, datasetId, roles, domain, key, baseKey]);
  async function confirm() {
    if (lock.current || !plan) return; lock.current = true; setBusy(true); setError('');
    try {
      const response = await api<{ confirmed: Array<{ metricId: string; key: string; views: MetricRecommendation['views'] }> }>('/api/metric-recommendations', { method: 'POST', body: JSON.stringify({ projectId, datasetId, datasetVersion: plan.dataset.version, selected: picked, roles: plan.roles, domain, bindBusiness: Boolean(domain && bindBusiness && !plan.missing.length) }) });
      const cards = response.confirmed.map(item => ({ ...item.views[0], id: 'recommended-' + item.metricId + '-value', metricId: item.metricId, metricVersionPolicy: 'latest' as const, rangePolicy: 'project' as const }));
      const focus = response.confirmed.find(item => ['conversion', 'ctr', 'reads', 'comment_records'].includes(item.key)) || response.confirmed.find(item => !['records', 'content_records'].includes(item.key)) || response.confirmed[0];
      if (focus) for (const view of focus.views.slice(1)) cards.push({ ...view, id: 'recommended-' + focus.metricId + '-' + view.type + '-' + encodeURIComponent(view.groupBy || 'date'), metricId: focus.metricId, metricVersionPolicy: 'latest', rangePolicy: 'project' });
      onDone(cards);
    } catch (error) {
      setError(error instanceof Error ? error.message : '推荐保存失败');
      if (error instanceof ApiError && error.status === 409) setSnapshot(previous => ({ ...previous, key: '' }));
    }
    finally { lock.current = false; setBusy(false); }
  }
  return <Dialog title="确认适用的指标与看板" onClose={() => { if (!busy) onClose(); }} footer={<><button className="secondary" disabled={busy} onClick={onClose}>取消</button><button className="primary" disabled={busy || !plan || !picked.length || incompleteBusinessSelection} onClick={() => void confirm()}>{busy ? '正在确认…' : '创建指标并进入看板草稿'}</button></>}>
    {error && <><p role="alert" tabIndex={-1} ref={errorRef}>{error}</p>{!plan && <button className="secondary" disabled={busy} onClick={() => { setError(''); setRevision(value => value + 1); }}>重试字段试算</button>}</>}
    {!editor ? <LoadingState text="根据真实字段计算推荐结果…" /> : <div inert={busy}>
      <p>原表：{editor.dataset.name} · {editor.dataset.rowCount} 条记录。以下推荐仅使用已有字段；不会安装任务、预算或固定目标。</p>
      {templateId === 'content_marketing' && <label>这张表用于<CustomSelect ariaLabel="这张表用于" value={domain || 'content'} onChange={value => { setDomain(value as BusinessDomain); setRoles(null); setSelected(null); setError(''); }} options={[{ value: 'content', label: '内容分析' }, { value: 'comment', label: '评论分析' }]} /></label>}
      {plan && plan.missing.length > 0 && <p role="status">专属{domain === 'ad' ? '投放' : domain === 'content' ? '内容' : domain === 'comment' ? '评论' : '业务'}分析仍缺少：{plan.missing.join('、')}。可先使用下面能够计算的内容，补齐字段后再确认业务页。</p>}
      <details open={Boolean(domain && editor.missing.length)}><summary>确认字段对应</summary><div className="metric-picker-fields">{(domain === 'ad' ? [['date', '日期'], ['channel', '渠道'], ['spend', '花费'], ['impressions', '曝光'], ['clicks', '点击']] : domain === 'content' ? [['contentId', '内容编号'], ['link', '内容链接'], ['title', '标题'], ['date', '发布日期'], ['channel', '渠道'], ['reads', '阅读量'], ['interactions', '互动量'], ['spend', '内容费用']] : domain === 'comment' ? [['commentText', '评论内容'], ['commentId', '评论编号'], ['date', '记录日期'], ['sentiment', '来源情感'], ['treatmentStatus', '来源处置状态']] : [['date', '日期'], ['channel', '渠道'], ['consultations', '咨询人数'], ['deals', '成交人数']]).map(([role, label]) => <label key={role}>{label}对应字段<CustomSelect ariaLabel={label + '对应字段'} value={currentRoles[role as keyof FieldRoles] || ''} onChange={value => { setRoles({ ...currentRoles, [role]: value }); setSelected(null); }} options={[{ value: '', label: '未指定' }, ...editor.dataset.columns.filter(column => fieldRoleAccepts(role as keyof FieldRoles, column)).map(column => ({ value: column.key, label: column.name }))]} /></label>)}</div></details>
      {!plan ? <LoadingState text="字段已更新，正在重新试算；旧结果不用于确认。" /> : plan.recommendations.map(item => <label className="recommendation-option" key={item.key}><input type="checkbox" aria-label={'推荐' + item.name} checked={picked.includes(item.key)} onChange={event => setSelected(event.target.checked ? [...picked, item.key] : picked.filter(key => key !== item.key))} /><span><strong>{item.name}：{item.preview.formattedValue}</strong><small>{item.explanation}</small></span></label>)}
      <p>生成核心指标，并为主要指标添加日期趋势和渠道对比（有对应字段时）。指标只定义一次，各图表引用同一口径；团队看板仍需确认发布。</p>
      {domain && plan && !plan.missing.length && <label className="recommendation-option"><input type="checkbox" aria-label="同时用于专属业务分析" checked={bindBusiness} onChange={event => setBindBusiness(event.target.checked)} /><span>同时用于{domain === 'ad' ? '投放' : domain === 'content' ? '内容' : '评论'}分析页。业务页需要全部已对应字段的指标；取消可先只创建所选指标。</span></label>}
      {incompleteBusinessSelection && <p role="status">请勾选业务页所需的全部指标，或取消“同时用于专属业务分析”后只创建所选指标。</p>}
      {domain === 'ad' && plan && !plan.missing.length && <p>没有配置真实广告账户时，标明为授权飞书投放表。</p>}
      {domain === 'comment' && <p>情感和处置状态来自原表标注；外部采集和自动处置仍待配置。评论编号可选，未对应时行序仅用于当前批次显示。</p>}
    </div>}
  </Dialog>;
}
