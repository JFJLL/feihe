'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { CustomDatePicker } from '../../components/ui/CustomDatePicker';
import { LoadingState } from '../../components/ui/LoadingState';
import { api } from '../../lib/hooks/use-project-data';
import type { ReusableMetric } from '../../lib/metrics/definitions';
import type { Dataset } from '../../lib/datasets';
import type { MetricComputeResult } from '../../lib/metrics/engine';
import type { DashboardCardConfig } from '../overview/CardEditModal';
import { queryErrors, type MetricQuery } from '../../lib/metrics/query';
import { CARD_PRESENTATIONS, resultUnitKey } from '../../lib/metrics/config';

export function MetricCardPicker({ projectId, metricId, initialCard, query = {}, onClose, onSave, onAdvanced, onNew }: {
  projectId: string; metricId?: string; initialCard?: DashboardCardConfig | null; onClose: () => void;
  query?: MetricQuery;
  onSave: (card: DashboardCardConfig) => void; onAdvanced: (config?: DashboardCardConfig) => void; onNew: () => void;
}) {
  const [index, setIndex] = useState<{ metrics: ReusableMetric[]; datasets: Dataset[] } | null>(null), [error, setError] = useState('');
  const [selected, setSelected] = useState(initialCard?.metricId || metricId || ''), [title, setTitle] = useState(initialCard?.title || '');
  const [type, setType] = useState<DashboardCardConfig['type']>(initialCard?.type || 'metric_card'), [groupBy, setGroupBy] = useState(initialCard?.groupBy || '');
  const [policy, setPolicy] = useState(initialCard?.metricVersionPolicy === 'pinned' ? String(initialCard.metricVersion) : 'latest');
  const metric = index?.metrics.find(item => item.id === selected) || index?.metrics[0];
  const config = policy === 'latest' ? metric?.config : metric?.versions.find(item => item.version === Number(policy))?.config;
  const dataset = index?.datasets.find(item => item.id === config?.datasetId);
  const [target, setTarget] = useState<string | null>(null);
  const targetScale = config?.aggregation !== 'ratio' && config?.format === 'percent' && config?.percentScale === 'fraction' ? 100 : 1;
  const originalTargetConfig = metric?.versions.find(item => item.version === initialCard?.targetMetricVersion)?.config;
  const originalScale = originalTargetConfig?.aggregation !== 'ratio' && originalTargetConfig?.format === 'percent' && originalTargetConfig?.percentScale === 'fraction' ? 100 : 1;
  const targetInput = target ?? (initialCard?.target !== undefined ? String(initialCard.target * (originalTargetConfig ? originalScale : targetScale)) : '');
  const targetNeedsConfirmation = type === 'progress_card' && target === null && originalTargetConfig && config && resultUnitKey(originalTargetConfig) !== resultUnitKey(config);
  const [rangePolicy, setRangePolicy] = useState(initialCard?.rangePolicy === 'independent' || initialCard?.from || initialCard?.to ? 'independent' : 'project');
  const [from, setFrom] = useState(initialCard?.from || ''), [to, setTo] = useState(initialCard?.to || '');
  const card: DashboardCardConfig = { id: initialCard?.id || 'card-' + (metric?.id || ''), title: title || metric?.name || '', type, metricId: metric?.id,
    metricVersionPolicy: policy === 'latest' ? 'latest' : 'pinned', metricVersion: policy === 'latest' ? undefined : Number(policy), groupBy: type === 'breakdown' ? groupBy : '',
    rangePolicy: rangePolicy as DashboardCardConfig['rangePolicy'], ...(rangePolicy === 'independent' ? { from, to } : {}),
    ...(type === 'progress_card' && targetInput ? { target: Number(targetInput) / targetScale, targetMetricVersion: target === null && initialCard?.targetMetricVersion ? initialCard.targetMetricVersion : policy === 'latest' ? metric?.version : Number(policy) } : {}) };
  const key = JSON.stringify({ card, query });
  const [preview, setPreview] = useState<{ key: string; metric?: MetricComputeResult; error?: string }>({ key: '' });
  const invalid = !metric || targetNeedsConfirmation || type === 'breakdown' && !groupBy || type === 'time_trend' && !config?.dateField || type === 'progress_card' && (!targetInput || !Number.isFinite(Number(targetInput)) || Number(targetInput) <= 0) || rangePolicy === 'independent' && (!from && !to || queryErrors({ from, to }).length > 0) || queryErrors(query).length > 0;
  useEffect(() => {
    const controller = new AbortController(); let current = true;
    api<{ metrics: ReusableMetric[]; datasets: Dataset[] }>('/api/metric-definitions?projectId=' + encodeURIComponent(projectId), { signal: controller.signal }).then(value => { if (current) setIndex(value); }).catch(e => { if (current) setError(e instanceof Error ? e.message : '指标加载失败'); });
    return () => { current = false; controller.abort(); };
  }, [projectId]);
  useEffect(() => {
    if (invalid) return;
    const controller = new AbortController(); let current = true;
    api<{ metric: MetricComputeResult }>('/api/metrics', { method: 'POST', signal: controller.signal, body: JSON.stringify({ projectId, ...JSON.parse(key) }) }).then(value => { if (current) setPreview({ key, metric: value.metric }); })
      .catch(e => { if (current) setPreview({ key, error: e instanceof Error ? e.message : '试算失败' }); });
    return () => { current = false; controller.abort(); };
  }, [projectId, key, invalid]);
  const currentPreview = preview.key === key ? preview : null;
  return <Dialog title={initialCard ? '编辑共享指标卡片' : '添加共享指标卡片'} onClose={onClose} footer={<><button className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={Boolean(invalid || !currentPreview?.metric || currentPreview.error || ['error', 'invalid_value', 'needs_configuration', 'missing_source'].includes(currentPreview.metric.status))} onClick={() => onSave({ ...card, id: initialCard?.id || 'card-' + crypto.randomUUID() })}>加入草稿</button></>}>
    <div className="integration-project-form metric-picker-fields">
      {error && <p role="alert">{error}</p>}
      {!index ? <LoadingState text="正在读取可引用指标…" /> : !index.metrics.length ? <p>尚无共享指标。新建一次后，多张卡片即可共同引用。</p> : <>
        <label>选择指标<CustomSelect ariaLabel="选择指标" value={metric?.id || ''} options={index.metrics.map(item => ({ value: item.id, label: item.name + ' · v' + item.version + ' · ' + item.datasetName }))} onChange={id => { setSelected(id); setTitle(''); setGroupBy(''); setPolicy('latest'); setTarget(''); }} /></label>
        <label>卡片标题<input aria-label="卡片标题" value={title || metric?.name || ''} onChange={e => setTitle(e.target.value)} /></label>
        <label>展示呈现形式<CustomSelect ariaLabel="展示呈现形式" value={type} onChange={value => setType(value as DashboardCardConfig['type'])} options={CARD_PRESENTATIONS.map(item => ({ value: item.type, label: item.label, disabled: item.requiresDate && !config?.dateField }))} /></label>
        {type === 'time_trend' && <p>按项目时区汇总每日结果；沿用同一指标口径，缺失日期不会补成零。未绑定日期的指标请先到指标页设置。</p>}
        {type === 'breakdown' && <label>分组字段<CustomSelect ariaLabel="分组字段" value={groupBy} placeholder="选择分组字段" onChange={setGroupBy} options={(dataset?.columns || []).map(column => ({ value: column.key, label: column.name }))} /></label>}
        {type === 'detail_table' && <p>显示该指标来源在同一周期和筛选下的原始记录，每页15行；上方指标始终计算完整符合条件的数据。</p>}
        {type === 'progress_card' && <label>目标数值{config?.format === 'percent' || config?.aggregation === 'ratio' ? '（%）' : config?.unit ? '（' + config.unit + '）' : ''}<input aria-label="目标数值" type="number" min="0" step="any" value={targetInput} onChange={e => setTarget(e.target.value)} /><small>请填写本项目确认的目标。百分比输入20表示20%；计数或金额目标沿用指标单位。</small>{(!targetInput || Number(targetInput) <= 0) && <small role="alert">填写正数目标后才能加入草稿</small>}</label>}
        {targetNeedsConfirmation && <p role="alert">指标结果单位已变化。旧目标对应指标 v{initialCard?.targetMetricVersion}，请核对新单位并重新填写目标后保存。</p>}
        <label>卡片日期范围<CustomSelect ariaLabel="卡片日期范围" value={rangePolicy} onChange={setRangePolicy} options={[{ value: 'project', label: '跟随项目周期' }, { value: 'independent', label: '使用独立周期', disabled: !config?.dateField }]} /></label>
        {rangePolicy === 'independent' && <div className="card-edit-fields"><label>卡片开始日期<CustomDatePicker aria-label="卡片开始日期" value={from} onChange={e => setFrom(e.target.value)} /></label><label>卡片结束日期<CustomDatePicker aria-label="卡片结束日期" value={to} onChange={e => setTo(e.target.value)} /></label></div>}
        <label>指标版本<CustomSelect ariaLabel="指标版本" value={policy} onChange={setPolicy} options={[{ value: 'latest', label: '跟随最新版本（推荐）' }, ...(metric?.versions || []).map(version => ({ value: String(version.version), label: '固定 v' + version.version }))]} /></label>
        <p>计算来源、单位与缺失规则由指标定义统一维护；当前来源：{metric?.datasetName}。</p>
        {currentPreview?.error ? <p role="alert">{currentPreview.error}</p> : currentPreview?.metric ? <p role="status">预览：{currentPreview.metric.formattedValue} · 指标 v{currentPreview.metric.definition?.version}{!['ok', 'zero'].includes(currentPreview.metric.status) && ' · ' + currentPreview.metric.statusLabel}</p> : <p>等待有效配置试算…</p>}
        {currentPreview?.metric?.trend && <div className="metric-trend-preview">{currentPreview.metric.trend.map(point => <p key={point.date}>{point.date}：{point.formattedValue}</p>)}</div>}
      </>}
      <div className="data-actions"><button className="secondary" onClick={onNew}>新建指标</button><button className="secondary" onClick={() => onAdvanced(currentPreview?.metric?.effectiveConfig ? { ...currentPreview.metric.effectiveConfig, id: initialCard?.id, title: card.title, type: card.type } as DashboardCardConfig : undefined)}>高级：独立卡片</button></div>
      <p>高级独立卡片保留历史配置；它不会随共享指标定义更新。</p>
    </div>
  </Dialog>;
}
