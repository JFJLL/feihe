'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { CustomDatePicker } from '../../components/ui/CustomDatePicker';
import { api } from '../../lib/hooks/use-project-data';
import { Dialog } from '../../components/ui/Dialog';
import type { MetricComputeResult } from '../../lib/metrics/engine';
import { isTemplateCard, validateCardConfig, ratioSampleLabel, transitionCardConfig, isCountAggregation, CARD_PRESENTATIONS, type CardPresentationType, type CardAggregation } from '../../lib/metrics/config';

export interface DashboardCardConfig {
  metricId?: string;
  metricVersionPolicy?: 'latest' | 'pinned';
  metricVersion?: number;
  id?: string;
  title: string;
  type: CardPresentationType;
  datasetId?: string;
  mode?: 'template' | 'custom';
  missingPolicy?: 'skip' | 'zero';
  percentScale?: 'fraction' | 'percentage_points';
  ratioBasis?: 'paired' | 'independent';
  displayOrigin?: 'auto' | 'manual';
  displayNeedsConfirmation?: boolean;
  metric?: string;
  aggregation?: CardAggregation;
  field?: string;
  numField?: string;
  denField?: string;
  groupBy?: string;
  dateField?: string;
  from?: string;
  to?: string;
  rangePolicy?: 'project' | 'independent';
  target?: number;
  targetMetricVersion?: number;
  unit?: string;
  format?: 'number' | 'percent' | 'currency' | 'compact';
  desc?: string;
  sortOrder?: number;
}

export function CardEditModal({
  projectId,
  initialCard,
  datasets,
  defaultDatasetId,
  onSave,
  onClose,
  dialogTitle,
  saveLabel = '保存并加入看板',
  titleLabel = '卡片标题',
  headerContent,
  definitionOnly = false,
  saveRevision = 0,
}: {
  projectId: string;
  initialCard?: DashboardCardConfig | null;
  datasets: Array<{ id: string; name: string; columns?: Array<{ key: string; name: string; type: string; numericUnit?: string; percentScale?: 'fraction' | 'percentage_points' }> }>;
  defaultDatasetId?: string;
  onSave: (card: DashboardCardConfig) => void | Promise<void>;
  onClose: () => void;
  dialogTitle?: string;
  saveLabel?: string;
  titleLabel?: string;
  headerContent?: ReactNode;
  definitionOnly?: boolean;
  saveRevision?: number;
}) {
  const submitLock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<{ revision: number; message: string } | null>(null);
  const [card, setCard] = useState<DashboardCardConfig>(() => ({
    id: initialCard?.id || `card-${Date.now()}`,
    title: initialCard?.title || '新增指标卡',
    type: initialCard?.type || 'metric_card',
    datasetId: initialCard?.datasetId || defaultDatasetId || datasets[0]?.id || '',
    aggregation: initialCard && isTemplateCard(initialCard) ? undefined : (initialCard?.aggregation || (initialCard?.field ? 'sum' : initialCard?.numField ? 'ratio' : 'count')),
    metric: initialCard?.metric || 'custom',
    mode: initialCard && isTemplateCard(initialCard) ? 'template' : 'custom',
    missingPolicy: initialCard?.missingPolicy || 'skip',
    percentScale: initialCard?.percentScale,
    ratioBasis: initialCard?.ratioBasis,
    from: initialCard?.from || '',
    to: initialCard?.to || '',
    rangePolicy: initialCard?.rangePolicy,
    target: initialCard?.target,
    desc: initialCard?.desc || '',
    field: initialCard?.field || '',
    numField: initialCard?.numField || '',
    denField: initialCard?.denField || '',
    groupBy: initialCard?.groupBy || '',
    dateField: initialCard?.dateField || '',
    unit: initialCard?.unit || '',
    format: initialCard?.format || 'number',
    displayOrigin: initialCard ? (initialCard.displayOrigin || 'manual') : 'auto',
    displayNeedsConfirmation: initialCard?.displayNeedsConfirmation,
  }));

  const previewKey = JSON.stringify({ projectId, card, datasets });
  const [previewSnapshot, setPreviewSnapshot] = useState<{ key: string; metric: MetricComputeResult | null; error: string }>({ key: '', metric: null, error: '' });
  const validationErrors = validateCardConfig(card, datasets, true);
  const currentPreview = previewSnapshot.key === previewKey;
  const preview = currentPreview ? previewSnapshot.metric : null;
  const previewError = currentPreview ? previewSnapshot.error : '';
  const loadingPreview = !validationErrors.length && !currentPreview;
  const templateBound = isTemplateCard(card);
  const invalidPreview = Boolean(preview && ['error', 'invalid_value', 'missing_source', 'needs_configuration'].includes(preview.status));

  // Available columns from selected dataset
  const activeDataset = datasets.find((d) => d.id === card.datasetId);
  const columns = activeDataset?.columns || [];
  const fieldOptions = columns.map(c => ({ value: c.key, label: c.name || c.key }));

  // Fetch live calculation preview
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (validateCardConfig(card, datasets, true).length) return;
    api<{ ok: boolean; metric: MetricComputeResult }>('/api/metrics', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({
        projectId,
        action: 'evaluate',
        card: {
          ...card,
          datasetId: card.datasetId || activeDataset?.id,
        },
      }),
    })
      .then((res) => {
        if (!cancelled && res.metric) {
          setPreviewSnapshot({ key: previewKey, metric: res.metric, error: '' });
        }
      })
      .catch(error => { if (!cancelled) setPreviewSnapshot({ key: previewKey, metric: null, error: error instanceof Error ? error.message : '试算失败' }); });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId, card, activeDataset?.id, datasets, previewKey]);

  async function handleSubmit() {
    if (submitLock.current || validationErrors.length || previewError || invalidPreview || loadingPreview || !preview) return;
    submitLock.current = true; setSubmitting(true); setSaveError(null);
    try { await onSave({
      ...card,
      datasetId: card.datasetId || activeDataset?.id,
    }); } catch (error) { setSaveError({ revision: saveRevision, message: error instanceof Error ? error.message : '保存失败，修改仍保留' }); }
    finally { submitLock.current = false; setSubmitting(false); }
  }

  return (
    <Dialog title={dialogTitle || (initialCard ? '编辑看板指标卡' : '添加看板指标卡')} onClose={() => { if (!submitLock.current) onClose(); }} footer={<div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13 }}
          >
            取消
          </button>
          <button
            type="button"
            className="primary"
            disabled={Boolean(submitting || validationErrors.length || previewError || invalidPreview || loadingPreview || !preview)}
            onClick={handleSubmit}
            style={{ padding: '8px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {submitting ? '保存中…' : saveLabel}
          </button>
        </div>}>
        <div inert={submitting} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {saveError?.revision === saveRevision && <p role="alert">{saveError.message}；当前修改仍保留。</p>}
          {headerContent}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
            {titleLabel}
            <input
              value={card.title}
              placeholder="例如：签约达成率 或 门店咨询总人数"
              onChange={(e) => setCard({ ...card, title: e.target.value })}
              style={{ height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
            绑定数据集
            <CustomSelect
              value={card.datasetId || activeDataset?.id || ''}
              ariaLabel="绑定数据集"
              onChange={(val) => setCard(transitionCardConfig(card, { kind: 'dataset', datasetId: val }, datasets.find(d => d.id === val)?.columns))}
              options={datasets.map((d) => ({ value: d.id, label: d.name }))}
            />
          </label>

          {!definitionOnly && <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
            展示呈现形式
            <CustomSelect
              ariaLabel="展示呈现形式"
              value={card.type}
              onChange={val => setCard({ ...card, type: val as DashboardCardConfig["type"] })}
              options={CARD_PRESENTATIONS.map(item => ({ value: item.type, label: item.advancedLabel }))}
            />
          </label>}
          {!definitionOnly && card.type === 'progress_card' && <label>目标数值<input aria-label="目标数值" type="number" min="0" step="any" value={card.target ?? ''} onChange={e => setCard({ ...card, target: e.target.value === '' ? undefined : Number(e.target.value) })} /><small>与计算结果采用同一存储单位；比率20表示20%，比例字段0.2表示20%。未设置的历史比率进度继续显示100%基准。</small></label>}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
            指标计算方式
            <CustomSelect
              ariaLabel="指标计算方式"
              value={templateBound ? 'template' : (card.aggregation || 'count')}
              onChange={val => setCard(transitionCardConfig(card, { kind: 'aggregation', aggregation: val as CardAggregation }, columns))}
              options={[
                ...(templateBound ? [{ value: 'template', label: '模板指标（选择下方计算方式可转为自定义）', disabled: true }] : []),
                { value: 'ratio', label: '比率转化 (分子 / 分母 加权比率)' },
                { value: 'sum', label: '数值求和 (Sum)' },
                { value: 'avg', label: '数值平均 (Average)' },
                { value: 'count', label: '记录计数 (Count)' },
                { value: 'nonempty_count', label: '字段非空数' },
                { value: 'distinct_count', label: '唯一值计数 (去重计数)' },
              ]}
            />
          </label>

          {templateBound && <p>当前模板：{card.metric}。切换计算方式将清除模板绑定。</p>}
          {!templateBound && (card.aggregation === 'ratio' ? (
            <div className="card-edit-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                分子字段 (Numerator)
                <CustomSelect
                  ariaLabel="分子字段"
                value={card.numField || ''}
                  onChange={(val) => setCard({ ...card, numField: val })}
                  placeholder="-- 选择分子字段 --"
                  options={fieldOptions}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                分母字段 (Denominator)
                <CustomSelect
                  ariaLabel="分母字段"
                value={card.denField || ''}
                  onChange={(val) => setCard({ ...card, denField: val })}
                  placeholder="-- 选择分母字段 --"
                  options={fieldOptions}
                />
              </label>
            </div>
          ) : card.aggregation !== 'count' ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
              目标计算字段
              <CustomSelect
                ariaLabel="目标计算字段"
                value={card.field || ''}
                onChange={(val) => setCard(transitionCardConfig(card, { kind: 'field', field: val }, columns))}
                placeholder="-- 选择字段 --"
                options={fieldOptions}
              />
            </label>
          ) : null)}

          <div className="card-edit-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
              细分维度 (可选分组)
              <CustomSelect
                ariaLabel="细分维度"
                value={card.groupBy || ''}
                onChange={(val) => setCard({ ...card, groupBy: val })}
                placeholder="不分组 (全盘合计)"
                options={[{ value: '', label: '不分组 (全盘合计)' }, ...fieldOptions]}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
              单位 (选填)
              <input
                value={card.unit || ''}
                placeholder={isCountAggregation(card.aggregation) ? '计数单位，如：项、个、行' : '如：%、人、元、单'}
                onChange={(e) => setCard(transitionCardConfig(card, { kind: 'display', patch: { unit: e.target.value } }, columns))}
                style={{ height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </label>
          </div>

          {card.aggregation === 'ratio' ? <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>比率样本口径<CustomSelect ariaLabel="比率样本口径" value={card.ratioBasis || 'paired'} onChange={value => setCard({ ...card, ratioBasis: value as DashboardCardConfig['ratioBasis'] })} options={[{ value: 'paired', label: '成对有效行（默认）' }, { value: 'independent', label: '独立汇总（分别求和）' }]} /><small>缺失不补零时，默认仅计算两字段均有效的行；独立汇总分别求和并展示各自覆盖率。</small></label> : <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>显示格式<CustomSelect ariaLabel="显示格式" value={card.format || 'number'} onChange={value => setCard(transitionCardConfig(card, { kind: 'display', patch: { format: value as DashboardCardConfig['format'] } }, columns))} options={[{ value: 'number', label: '普通数值' }, { value: 'percent', label: '百分比', disabled: isCountAggregation(card.aggregation) }, { value: 'currency', label: '金额', disabled: isCountAggregation(card.aggregation) }, { value: 'compact', label: '简写数值' }]} /></label>
            {(card.format === 'percent' || card.unit === '%') && <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>百分比数值口径<CustomSelect ariaLabel="百分比数值口径" value={card.percentScale || ''} placeholder="确认单位后可保存" onChange={value => setCard(transitionCardConfig(card, { kind: 'display', patch: { percentScale: value as DashboardCardConfig['percentScale'] } }, columns))} options={[{ value: 'fraction', label: '比例小数：0.005 = 0.5%' }, { value: 'percentage_points', label: '百分点：0.5 = 0.5%' }]} /><small>历史配置须明确确认；不改写历史数据，不按大小猜单位。</small></label>}
          </>}
          <label>缺失值规则<CustomSelect ariaLabel="缺失值规则" value={card.missingPolicy || 'skip'} onChange={value => setCard({ ...card, missingPolicy: value as 'skip' | 'zero' })} options={[{ value: 'skip', label: '缺失不补零（忽略空值）' }, { value: 'zero', label: '明确补零' }]} /></label>
          <label>日期字段<CustomSelect ariaLabel="日期字段" value={card.dateField || ''} onChange={value => setCard({ ...card, dateField: value, ...(value ? {} : { from: '', to: '' }) })} options={[{ value: '', label: '不限定日期' }, ...columns.filter(c => c.type === 'date').map(c => ({ value: c.key, label: c.name }))]} /></label>
          {card.dateField && <div className="card-edit-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><label>开始日期<CustomDatePicker aria-label="开始日期" value={card.from || ''} onChange={e => setCard({ ...card, from: e.target.value })} /></label><label>结束日期<CustomDatePicker aria-label="结束日期" value={card.to || ''} onChange={e => setCard({ ...card, to: e.target.value })} /></label></div>}
          {card.dateField && <small>按项目时区包含完整结束日；无日期记录不进入指定周期。</small>}
          {validationErrors.length > 0 && <div role="alert">{validationErrors.join('；')}</div>}
          {card.displayNeedsConfirmation && <button type="button" onClick={() => setCard(transitionCardConfig(card, { kind: 'confirm' }, columns))}>确认当前显示设置</button>}
          {invalidPreview && <div role="alert">试算不可用：{preview?.statusLabel}</div>}
          {previewError && <div role="alert">试算失败：{previewError}</div>}
          {/* Live Calculation Preview Box */}
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
              🔍 全量指标实时试算预览：
            </div>
            {loadingPreview ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>正在试算当前配置…</div>
            ) : preview ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
                    {preview.formattedValue}
                  </span>
                  <span style={{ fontSize: 12, color: preview.status === 'ok' ? '#16a34a' : preview.status === 'zero' ? '#64748b' : '#e11d48', fontWeight: 600 }}>
                    [{preview.statusLabel}]
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {preview.pairedValidCount !== undefined ? ratioSampleLabel(preview, card.missingPolicy === 'zero') : `有效样本量: ${preview.sampleSize} 行`}
                  {preview.denominator !== undefined ? ` · 分子合计: ${preview.numerator?.toLocaleString()} · 分母合计: ${preview.denominator?.toLocaleString()}` : ''}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>暂无可预览数据</div>
            )}
          </div>
        </div>

    </Dialog>
  );
}
