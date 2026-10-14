'use client';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { LoadingState } from '../../components/ui/LoadingState';
import { api } from '../../lib/hooks/use-project-data';
import type { Dataset } from '../../lib/datasets';
import type { StructureBlueprint, StructureBindings, StructureChoices } from '../../lib/project-structure';
import type { MetricComputeResult } from '../../lib/metrics/engine';
import type { DashboardCardConfig } from '../overview/CardEditModal';
import { ratioSampleLabel } from '../../lib/metrics/config';

type SavedBlueprint = StructureBlueprint & { applied?: StructureChoices & { cards: DashboardCardConfig[] } };
type Plan = { blueprint: SavedBlueprint; datasets: Dataset[]; bindings: StructureBindings; selectedCards: string[]; errors: string[]; previews: Array<{ key: string; title: string; preview: MetricComputeResult | null; error: string }> };
export function StructureSetup({ projectId, datasetId, canManage, onDone }: { projectId: string; datasetId: string; canManage?: boolean; onDone: (cards: DashboardCardConfig[]) => void }) {
  const [snapshot, setSnapshot] = useState<{ key: string; blueprint?: SavedBlueprint | null; error?: string }>({ key: '' });
  const [open, setOpen] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<{ blueprint: SavedBlueprint | null }>('/api/project-structure?' + new URLSearchParams({ projectId, mode: 'summary' }), { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setSnapshot({ key: projectId, blueprint: result.blueprint }); })
      .catch(error => { if (!controller.signal.aborted) setSnapshot({ key: projectId, error: error instanceof Error ? error.message : '结构读取失败' }); });
    return () => controller.abort();
  }, [projectId, revision]);
  if (snapshot.key !== projectId) return null;
  if (snapshot.error) return <section className="platform-panel"><p role="alert">项目结构检查失败：{snapshot.error}</p><button onClick={() => setRevision(value => value + 1)}>重新检查结构</button></section>;
  if (!snapshot.blueprint) return null;
  const blueprint = snapshot.blueprint;
  return <section className="platform-panel data-panel" aria-label="复用项目结构准备">
    <h2>{blueprint.applied ? '已确认本项目的复用指标' : '等待绑定自己的来源与目标'}</h2>
    <p>已选 {blueprint.metrics.length} 个指标、{blueprint.cards.length} 个卡片结构。原项目来源、记录、报告与目标均未复制。</p>
    {canManage ? <button className="primary" disabled={!datasetId && !blueprint.applied} onClick={() => blueprint.applied ? onDone(blueprint.applied.cards) : setOpen(true)}>{blueprint.applied ? '继续配置复用看板' : '确认复用指标与看板'}</button> : <p>请项目负责人接入并确认本项目的来源与目标。</p>}
    {!datasetId && !blueprint.applied && <p>先在下方接入自己的业务表，再对应实际字段。</p>}
    {open && <StructureDialog projectId={projectId} datasetId={datasetId} onClose={() => setOpen(false)} onDone={cards => { setOpen(false); setRevision(value => value + 1); onDone(cards); }} />}
  </section>;
}
function StructureDialog({ projectId, datasetId, onClose, onDone }: { projectId: string; datasetId: string; onClose: () => void; onDone: (cards: DashboardCardConfig[]) => void }) {
  const [choices, setChoices] = useState<StructureChoices | null>(null), [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ key: string; plan?: Plan; error?: string }>({ key: '' });
  const [busy, setBusy] = useState(false), [saveError, setSaveError] = useState(''); const lock = useRef(false);
  const errorTarget = useRef<HTMLParagraphElement>(null);
  const refreshRequests = useRef(new Set<AbortController>());
  useEffect(() => { const active = refreshRequests.current; return () => { for (const controller of active) controller.abort(); }; }, []);
  const key = JSON.stringify({ projectId, datasetId, choices, revision });
  const visibleError = saveError || (snapshot.key === key ? snapshot.error : '') || '';
  useEffect(() => { if (visibleError) { errorTarget.current?.focus(); errorTarget.current?.scrollIntoView({ block: 'nearest' }); } }, [visibleError]);
  const plan = snapshot.key === key && !snapshot.error ? snapshot.plan : undefined;
  const model = snapshot.plan;
  const view = model ? { ...model, bindings: choices?.bindings || model.bindings, selectedCards: choices?.selectedCards || model.selectedCards, previews: plan?.previews || [], errors: plan?.errors || [] } : undefined;
  useEffect(() => {
    const controller = new AbortController(), query = new URLSearchParams({ projectId, datasetId }); if (choices) query.set('choices', JSON.stringify(choices));
    api<Plan>('/api/project-structure?' + query, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setSnapshot({ key, plan: result }); })
      .catch(error => { if (!controller.signal.aborted) setSnapshot(previous => ({ key, plan: previous.plan, error: error instanceof Error ? error.message : '结构试算失败' })); });
    return () => controller.abort();
  }, [projectId, datasetId, choices, key]);
  function currentChoices(): StructureChoices { return choices || { bindings: model?.bindings, selectedCards: model?.selectedCards, targets: {}, percentConfirmations: {} }; }
  function update(next: StructureChoices) { if (!lock.current) { setChoices(next); setSaveError(''); } }
  async function readLatestFields() {
    if (lock.current) return; lock.current = true; setBusy(true); const controller = new AbortController(); refreshRequests.current.add(controller);
    const previous = currentChoices();
    try {
      const fresh = await api<Plan>('/api/project-structure?' + new URLSearchParams({ projectId, datasetId }), { signal: controller.signal });
      if (controller.signal.aborted) return;
      const bindings = Object.fromEntries(fresh.blueprint.groups.map(group => {
        const old = previous.bindings?.[group.key], dataset = fresh.datasets.find(dataset => dataset.id === old?.datasetId) || fresh.datasets[0];
        return [group.key, { datasetId: dataset?.id || '', datasetVersion: dataset?.version || 0, fields: Object.fromEntries(group.fields.map(field => [field.key, dataset?.columns.some(column => column.key === old?.fields[field.key] && column.type === field.type) ? old!.fields[field.key] : ''])) }];
      }));
      setSnapshot({ key: '', plan: fresh }); setChoices({ ...previous, bindings, percentConfirmations: {} }); setRevision(value => value + 1); setSaveError('');
    } catch (error) { if (!controller.signal.aborted) setSaveError(error instanceof Error ? error.message : '字段读取失败，选择和目标仍保留'); }
    finally { refreshRequests.current.delete(controller); lock.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  async function confirm() {
    if (!plan || plan.errors.length || lock.current) return; lock.current = true; setBusy(true); setSaveError('');
    try {
      const saved = await api<{ cards: DashboardCardConfig[] }>('/api/project-structure', { method: 'POST', body: JSON.stringify({ projectId, revision: plan.blueprint.revision, ...currentChoices() }) });
      onDone(saved.cards);
    } catch (error) { setSaveError(error instanceof Error ? error.message : '保存失败，字段对应和目标仍保留'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Dialog title="绑定本项目来源并确认复用看板" onClose={() => { if (!busy) onClose(); }} width={820}
    footer={<><button disabled={busy} onClick={onClose}>取消</button><button className="primary" disabled={busy || !plan || Boolean(plan.errors.length)} onClick={() => void confirm()}>{busy ? '正在确认…' : '确认复用并进入看板草稿'}</button></>}>
    {visibleError && <p role="alert" tabIndex={-1} ref={errorTarget}>{visibleError}</p>}
    {snapshot.key === key && snapshot.error && <button disabled={busy} onClick={() => setRevision(value => value + 1)}>重新读取结构</button>}
    {!view ? <LoadingState text="读取本项目字段并真实试算…" /> : <div inert={busy}>
      <p>将模板字段对应到自己的来源。计算口径与呈现顺序会保留；日期范围重新选择，目标进度使用本项目明确填写的目标。</p>
      <button className="secondary" disabled={busy} onClick={() => void readLatestFields()}>重新读取来源字段</button>
      {view.blueprint.groups.map(group => {
        const binding = view.bindings[group.key], dataset = view.datasets.find(item => item.id === binding?.datasetId);
        return <fieldset key={group.key}><legend>{group.label}</legend><label>本项目数据集<CustomSelect ariaLabel={group.label + '本项目数据集'} value={binding?.datasetId || ''} options={view.datasets.map(dataset => ({ value: dataset.id, label: dataset.name }))} onChange={id => {
          const selected = view.datasets.find(item => item.id === id)!;
          update({ ...currentChoices(), percentConfirmations: {}, bindings: { ...view.bindings, [group.key]: { datasetId: id, datasetVersion: selected.version, fields: Object.fromEntries(group.fields.map(field => [field.key, selected.columns.find(column => column.key === field.key && column.type === field.type)?.key || ''])) } } });
        }} /></label><div className="metric-picker-fields">{group.fields.map(field => <label key={field.key}>{field.name}对应字段<CustomSelect ariaLabel={group.label + ' ' + field.name + '对应字段'} value={binding?.fields[field.key] || ''} options={[{ value: '', label: '请选择实际字段' }, ...(dataset?.columns || []).filter(column => column.type === field.type).map(column => ({ value: column.key, label: column.name }))]} onChange={value => update({ ...currentChoices(), percentConfirmations: {}, bindings: { ...view.bindings, [group.key]: { ...binding, fields: { ...binding.fields, [field.key]: value } } } })} /></label>)}</div></fieldset>;
      })}
      {view.blueprint.metrics.filter(metric => metric.config.aggregation !== 'ratio' && (metric.config.format === 'percent' || metric.config.unit === '%')).map(metric => {
        const binding = view.bindings[metric.groupKey], dataset = view.datasets.find(dataset => dataset.id === binding?.datasetId), field = dataset?.columns.find(field => field.key === binding?.fields[metric.config.field || '']);
        if (field?.numericUnit === 'percent') return <p key={metric.key}>{metric.name}：采用字段已确认的百分比存储口径。</p>;
        if (metric.config.displayOrigin === 'auto') return <p key={metric.key}>{metric.name}：当前字段是普通数值，自动恢复普通显示，请核对字段含义。</p>;
        return <label key={metric.key}>{metric.name}百分比口径确认<CustomSelect ariaLabel={metric.name + '百分比口径确认'} value={choices?.percentConfirmations?.[metric.key] || ''} options={[{ value: '', label: '需明确确认，不按数值大小猜测' }, { value: 'fraction', label: '比例小数：0.005 表示 0.5%' }, { value: 'percentage_points', label: '百分点：0.5 表示 0.5%' }]} onChange={value => update({ ...currentChoices(), percentConfirmations: { ...currentChoices().percentConfirmations, [metric.key]: value as 'fraction' | 'percentage_points' } })} /></label>;
      })}
      <h3>卡片和本项目目标</h3>{view.blueprint.cards.map(card => {
        const picked = view.selectedCards.includes(card.key), preview = view.previews.find(item => item.key === card.key), metric = view.blueprint.metrics.find(metric => metric.key === card.metricKey);
        return <div className="recommendation-option" key={card.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" aria-label={'复用' + card.title} checked={picked} onChange={event => update({ ...currentChoices(), selectedCards: event.target.checked ? [...view.selectedCards, card.key] : view.selectedCards.filter(key => key !== card.key) })} />{card.title}</label>{picked && <><p>{preview?.preview ? '本项目试算：' + preview.preview.formattedValue : preview?.error || (plan ? '等待完整字段对应' : '正在试算新配置…')}</p>{preview?.preview && metric?.config.aggregation === 'ratio' && <small>{ratioSampleLabel(preview.preview, metric.config.missingPolicy === 'zero')}</small>}{card.requiresTarget && <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>本项目目标<input aria-label={card.title + '本项目目标'} type="number" min="0" step="any" value={choices?.targets?.[card.key] ?? ''} onChange={event => { const targets = { ...currentChoices().targets }; if (event.target.value === '') delete targets[card.key]; else targets[card.key] = Number(event.target.value); update({ ...currentChoices(), targets }); }} /></label>}</>}</div>;
      })}
      {view.errors.length > 0 && <p role="status">{view.errors.join('；')}</p>}
      {view.blueprint.business && <p>专属{view.blueprint.business.kind === 'dataset_ad' ? '投放' : view.blueprint.business.kind === 'dataset_content' ? '内容' : '评论'}页也将绑定本项目来源和这组共享指标；不会携带原账户或授权。</p>}
      <p>确认后指标持久保存，看板进入草稿；仍须由您发布团队看板。</p>
    </div>}
  </Dialog>;
}
