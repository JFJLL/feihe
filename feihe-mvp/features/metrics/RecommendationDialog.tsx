'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { LoadingState } from '../../components/ui/LoadingState';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { api } from '../../lib/hooks/use-project-data';
import type { Dataset } from '../../lib/datasets';
import type { MetricRecommendation, FieldRoles } from '../../lib/metrics/recommendations';
import type { MetricComputeResult } from '../../lib/metrics/engine';
import type { DashboardCardConfig } from '../overview/CardEditModal';

type Plan = { dataset: Dataset; roles: FieldRoles; recommendations: Array<MetricRecommendation & { preview: MetricComputeResult }>; missing: string[] };
export function RecommendationDialog({ projectId, datasetId, templateId, onClose, onDone }: {
  projectId: string; datasetId: string; templateId?: string; onClose: () => void; onDone: (cards: DashboardCardConfig[]) => void;
}) {
  const [roles, setRoles] = useState<FieldRoles | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [selected, setSelected] = useState<string[] | null>(null);
  const key = JSON.stringify({ projectId, datasetId, roles });
  const [snapshot, setSnapshot] = useState<{ key: string; value: Plan | null }>({ key: '', value: null });
  const plan = snapshot.key === key ? snapshot.value : null;
  const lock = useRef(false);
  const picked = selected || plan?.recommendations.map(item => item.key) || [];
  useEffect(() => {
    const controller = new AbortController(); let current = true;
    const params = new URLSearchParams({ projectId, datasetId }); if (roles) params.set('roles', JSON.stringify(roles));
    api<Plan>('/api/metric-recommendations?' + params, { signal: controller.signal }).then(value => { if (current) { setSnapshot({ key, value }); setError(''); } }).catch(error => { if (current) setError(error instanceof Error ? error.message : '字段推荐加载失败'); });
    return () => { current = false; controller.abort(); };
  }, [projectId, datasetId, roles, key]);
  async function confirm() {
    if (lock.current || !plan) return; lock.current = true; setBusy(true); setError('');
    try {
      const response = await api<{ confirmed: Array<{ metricId: string; key: string; views: MetricRecommendation['views'] }> }>('/api/metric-recommendations', { method: 'POST', body: JSON.stringify({ projectId, datasetId, datasetVersion: plan.dataset.version, selected: picked, roles: plan.roles, bindBusiness: templateId === 'ad_performance' && !plan.missing.length }) });
      const cards = response.confirmed.map(item => ({ ...item.views[0], id: 'recommended-' + item.metricId + '-value', metricId: item.metricId, metricVersionPolicy: 'latest' as const, rangePolicy: 'project' as const }));
      const focus = response.confirmed.find(item => ['conversion', 'ctr'].includes(item.key)) || response.confirmed.find(item => item.key !== 'records') || response.confirmed[0];
      if (focus) for (const view of focus.views.slice(1)) cards.push({ ...view, id: 'recommended-' + focus.metricId + '-' + view.type, metricId: focus.metricId, metricVersionPolicy: 'latest', rangePolicy: 'project' });
      onDone(cards);
    } catch (error) { setError(error instanceof Error ? error.message : '推荐保存失败'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Dialog title="确认适用的指标与看板" onClose={() => { if (!busy) onClose(); }} footer={<><button className="secondary" disabled={busy} onClick={onClose}>取消</button><button className="primary" disabled={busy || !plan || !picked.length} onClick={() => void confirm()}>{busy ? '正在确认…' : '创建指标并进入看板草稿'}</button></>}>
    {error && <p role="alert">{error}</p>}
    {!plan ? <LoadingState text="根据真实字段计算推荐结果…" /> : <div inert={busy}>
      <p>原表：{plan.dataset.name} · {plan.dataset.rowCount} 条记录。以下推荐仅使用已有字段；不会安装任务、预算或固定目标。</p>
      {plan.missing.length > 0 && <p role="status">专属投放分析仍缺少：{plan.missing.join('、')}。可先使用下面能够计算的内容，补齐字段后再配置投放页。</p>}
      <details open={templateId === 'ad_performance' && plan.missing.length > 0}><summary>确认字段对应</summary><div className="metric-picker-fields">{(templateId === 'ad_performance' ? [['date', '日期'], ['channel', '渠道'], ['spend', '花费'], ['impressions', '曝光'], ['clicks', '点击']] : [['date', '日期'], ['channel', '渠道'], ['consultations', '咨询人数'], ['deals', '成交人数']]).map(([role, label]) => <label key={role}>{label}对应字段<CustomSelect ariaLabel={label + '对应字段'} value={plan.roles[role as keyof FieldRoles] || ''} onChange={value => setRoles({ ...plan.roles, [role]: value })} options={[{ value: '', label: '未指定' }, ...plan.dataset.columns.filter(column => role === 'date' ? column.type === 'date' : role === 'channel' ? ['text', 'category'].includes(column.type) : column.type === 'number' && column.numericUnit !== 'percent').map(column => ({ value: column.key, label: column.name }))]} /></label>)}</div></details>
      {plan.recommendations.map(item => <label className="recommendation-option" key={item.key}><input type="checkbox" aria-label={'推荐' + item.name} checked={picked.includes(item.key)} onChange={event => setSelected(event.target.checked ? [...picked, item.key] : picked.filter(key => key !== item.key))} /><span><strong>{item.name}：{item.preview.formattedValue}</strong><small>{item.explanation}</small></span></label>)}
      <p>生成核心指标，并为主要指标添加日期趋势和渠道对比（有对应字段时）。指标只定义一次，各图表引用同一口径；团队看板仍需确认发布。</p>
      {templateId === 'ad_performance' && !plan.missing.length && <p>确认后专属投放页也引用这组指标。没有配置真实广告账户时，标明为授权飞书投放表。</p>}
    </div>}
  </Dialog>;
}
