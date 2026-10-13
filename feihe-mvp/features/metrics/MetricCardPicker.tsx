'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { LoadingState } from '../../components/ui/LoadingState';
import { api } from '../../lib/hooks/use-project-data';
import type { ReusableMetric } from '../../lib/metrics/definitions';
import type { Dataset } from '../../lib/datasets';
import type { MetricComputeResult } from '../../lib/metrics/engine';
import type { DashboardCardConfig } from '../overview/CardEditModal';

export function MetricCardPicker({ projectId, metricId, initialCard, onClose, onSave, onAdvanced, onNew }: {
  projectId: string; metricId?: string; initialCard?: DashboardCardConfig | null; onClose: () => void;
  onSave: (card: DashboardCardConfig) => void; onAdvanced: (config?: DashboardCardConfig) => void; onNew: () => void;
}) {
  const [index, setIndex] = useState<{ metrics: ReusableMetric[]; datasets: Dataset[] } | null>(null), [error, setError] = useState('');
  const [selected, setSelected] = useState(initialCard?.metricId || metricId || ''), [title, setTitle] = useState(initialCard?.title || '');
  const [type, setType] = useState<DashboardCardConfig['type']>(initialCard?.type || 'metric_card'), [groupBy, setGroupBy] = useState(initialCard?.groupBy || '');
  const [policy, setPolicy] = useState(initialCard?.metricVersionPolicy === 'pinned' ? String(initialCard.metricVersion) : 'latest');
  const metric = index?.metrics.find(item => item.id === selected) || index?.metrics[0];
  const dataset = index?.datasets.find(item => item.id === metric?.config.datasetId);
  const card: DashboardCardConfig = { id: initialCard?.id || 'card-' + (metric?.id || ''), title: title || metric?.name || '', type, metricId: metric?.id,
    metricVersionPolicy: policy === 'latest' ? 'latest' : 'pinned', metricVersion: policy === 'latest' ? undefined : Number(policy), groupBy: type === 'breakdown' ? groupBy : '', from: initialCard?.from, to: initialCard?.to };
  const key = JSON.stringify(card);
  const [preview, setPreview] = useState<{ key: string; metric?: MetricComputeResult; error?: string }>({ key: '' });
  const invalid = !metric || type === 'breakdown' && !groupBy;
  useEffect(() => {
    const controller = new AbortController(); let current = true;
    api<{ metrics: ReusableMetric[]; datasets: Dataset[] }>('/api/metric-definitions?projectId=' + encodeURIComponent(projectId), { signal: controller.signal }).then(value => { if (current) setIndex(value); }).catch(e => { if (current) setError(e instanceof Error ? e.message : '指标加载失败'); });
    return () => { current = false; controller.abort(); };
  }, [projectId]);
  useEffect(() => {
    if (invalid) return;
    const controller = new AbortController(); let current = true;
    api<{ metric: MetricComputeResult }>('/api/metrics', { method: 'POST', signal: controller.signal, body: JSON.stringify({ projectId, card: JSON.parse(key) }) }).then(value => { if (current) setPreview({ key, metric: value.metric }); })
      .catch(e => { if (current) setPreview({ key, error: e instanceof Error ? e.message : '试算失败' }); });
    return () => { current = false; controller.abort(); };
  }, [projectId, key, invalid]);
  const currentPreview = preview.key === key ? preview : null;
  return <Dialog title={initialCard ? '编辑共享指标卡片' : '添加共享指标卡片'} onClose={onClose} footer={<><button className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={Boolean(invalid || !currentPreview?.metric || currentPreview.error || ['error', 'invalid_value', 'needs_configuration', 'missing_source'].includes(currentPreview.metric.status))} onClick={() => onSave({ ...card, id: initialCard?.id || 'card-' + crypto.randomUUID() })}>加入草稿</button></>}>
    <div className="integration-project-form metric-picker-fields">
      {error && <p role="alert">{error}</p>}
      {!index ? <LoadingState text="正在读取可引用指标…" /> : !index.metrics.length ? <p>尚无共享指标。新建一次后，多张卡片即可共同引用。</p> : <>
        <label>选择指标<CustomSelect ariaLabel="选择指标" value={metric?.id || ''} options={index.metrics.map(item => ({ value: item.id, label: item.name + ' · v' + item.version + ' · ' + item.datasetName }))} onChange={id => { setSelected(id); setTitle(''); setGroupBy(''); setPolicy('latest'); }} /></label>
        <label>卡片标题<input aria-label="卡片标题" value={title || metric?.name || ''} onChange={e => setTitle(e.target.value)} /></label>
        <label>展示呈现形式<CustomSelect ariaLabel="展示呈现形式" value={type} onChange={value => setType(value as DashboardCardConfig['type'])} options={[{ value: 'metric_card', label: '单值指标' }, { value: 'breakdown', label: '分组对比' }, { value: 'progress_card', label: '比率进度', disabled: metric?.config.aggregation !== 'ratio' && metric?.config.format !== 'percent' }]} /></label>
        {type === 'breakdown' && <label>分组字段<CustomSelect ariaLabel="分组字段" value={groupBy} placeholder="选择分组字段" onChange={setGroupBy} options={(dataset?.columns || []).map(column => ({ value: column.key, label: column.name }))} /></label>}
        <label>指标版本<CustomSelect ariaLabel="指标版本" value={policy} onChange={setPolicy} options={[{ value: 'latest', label: '跟随最新版本（推荐）' }, ...(metric?.versions || []).map(version => ({ value: String(version.version), label: '固定 v' + version.version }))]} /></label>
        <p>计算来源、单位与缺失规则由指标定义统一维护；当前来源：{metric?.datasetName}。</p>
        {currentPreview?.error ? <p role="alert">{currentPreview.error}</p> : currentPreview?.metric ? <p role="status">预览：{currentPreview.metric.formattedValue} · 指标 v{currentPreview.metric.definition?.version}{!['ok', 'zero'].includes(currentPreview.metric.status) && ' · ' + currentPreview.metric.statusLabel}</p> : <p>等待有效配置试算…</p>}
      </>}
      <div className="data-actions"><button className="secondary" onClick={onNew}>新建指标</button><button className="secondary" onClick={() => onAdvanced(currentPreview?.metric?.effectiveConfig ? { ...currentPreview.metric.effectiveConfig, id: initialCard?.id, title: card.title, type: card.type } as DashboardCardConfig : undefined)}>高级：独立卡片</button></div>
      <p>高级独立卡片保留历史配置；它不会随共享指标定义更新。</p>
    </div>
  </Dialog>;
}
